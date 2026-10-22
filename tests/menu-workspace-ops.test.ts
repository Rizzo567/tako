// Dashboard editor 22/10 (CONTRATTO §3): /ops, /status, /discard, pending, publish 409, PROVA, ruoli, concorrenza, flag, S4.
// Postgres isolato (embedded-postgres, migrazioni vere) + rotte vere via HTTP inject. Solo l'autenticazione è sostituita:
// requireAuth legge l'utente dall'intestazione di prova, requireRole ha la stessa regola di middleware/auth.ts
// (l'autenticazione vera è coperta da web-tenant-integration). Nessun DB remoto.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

vi.mock('../apps/server/src/index.js', () => ({ io: { to: () => ({ emit: () => {} }) } }))
vi.mock('../apps/server/src/middleware/auth.js', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  const requireAuth = async (req: any, reply: any) => {
    const raw = req.headers['x-test-user']
    if (!raw) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    req.user = JSON.parse(String(raw))
  }
  const requireRole = (...roles: string[]) => async (req: any, reply: any) => {
    await requireAuth(req, reply)
    if (reply.sent) return
    if (!req.user || !roles.includes(req.user.role)) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
  }
  return { ...original, requireAuth, requireRole }
})

const serverRequire = createRequire(resolve('apps/server/package.json'))
const dbRequire = createRequire(resolve('packages/db/package.json'))
const Fastify = serverRequire('fastify')
const EmbeddedPostgres = dbRequire('embedded-postgres').default
const { drizzle } = dbRequire('drizzle-orm/postgres-js')
const { migrate } = dbRequire('drizzle-orm/postgres-js/migrator')

async function freePort() {
  const server = createServer()
  await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done) })
  const port = (server.address() as { port: number }).port
  await new Promise<void>((done) => server.close(() => done()))
  return port
}
const pct = (values: number[], p: number) => { const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]! }

describe('dashboard editor: bozza a operazioni', () => {
  let dir: string, pg: any, sql: ReturnType<typeof postgres>, app: any, databaseUrl: string
  let store: typeof import('../apps/server/src/lib/menu-workspace-store.js')
  let read: typeof import('../apps/server/src/lib/menu-workspace-read.js')
  const saved = { ...process.env }
  type Seed = { id: string; ownerId: string; menuId: string; sectionId: string; itemId: string }
  let A: Seed, B: Seed

  const as = (s: Seed, role = 'owner') => ({ 'x-test-user': JSON.stringify({ id: s.ownerId, restaurantId: s.id, name: 'T', email: 't@t', role }) })
  const req = (s: Seed, method: string, url: string, payload?: unknown, role = 'owner') => app.inject({ method, url: '/api/menu-workspace' + url, headers: as(s, role), ...(payload ? { payload } : {}) })
  const row = async (s: Seed) => (await sql`SELECT draft,published,revision,published_revision,(draft IS DISTINCT FROM published) AS pending FROM menu_workspaces WHERE restaurant_id=${s.id}`)[0]!
  const versions = async (s: Seed, label?: string) => Number((await (label ? sql`SELECT count(*) n FROM menu_workspace_versions WHERE restaurant_id=${s.id} AND label=${label}` : sql`SELECT count(*) n FROM menu_workspace_versions WHERE restaurant_id=${s.id}`))[0]!.n)
  const ops = (s: Seed, list: unknown[], role = 'owner') => req(s, 'POST', '/ops', { ops: list, clientId: 'test', seq: 1 }, role)
  const setPrice = (s: Seed, price: number) => ({ op: 'set', kind: 'item', id: s.itemId, fields: { price } })

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tako-menu-ops-test-'))
    const port = await freePort()
    pg = new EmbeddedPostgres({ databaseDir: join(dir, 'pg'), port, user: 'isolated_test', password: 'isolated_test', persistent: false, initdbFlags: ['--encoding=UTF8'] })
    await pg.initialise(); await pg.start(); await pg.createDatabase('ops_test')
    databaseUrl = `postgresql://isolated_test:isolated_test@127.0.0.1:${port}/ops_test`
    process.env.DATABASE_URL = databaseUrl
    process.env.TAKO_MODE = 'web'
    process.env.WEB_ORIGIN = 'https://app.isolated.test'
    delete process.env.DATABASE_CA_CERT_PATH
    sql = postgres(databaseUrl, { max: 4, onnotice: () => {} })
    await migrate(drizzle(sql), { migrationsFolder: resolve('packages/db/src/migrations') })
    async function seed(label: string): Promise<Seed> {
      const [r] = await sql`insert into restaurants(name,slug,plan) values (${label},${'ops-' + label.toLowerCase()},'pro') returning id`
      const [u] = await sql`insert into users(restaurant_id,name,email,role,password_hash,email_verified) values (${r!.id},${'Owner ' + label},${'owner-' + label.toLowerCase() + '@isolated.test'},'owner','x',true) returning id`
      const [m] = await sql`insert into menus(restaurant_id,name,type,active,position) values (${r!.id},${'Menu ' + label},'main',true,0) returning id`
      const [s] = await sql`insert into menu_sections(menu_id,name,position,active) values (${m!.id},'Primi',0,true) returning id`
      const [i] = await sql`insert into menu_items(restaurant_id,section_id,name,price,available,position) values (${r!.id},${s!.id},${'Piatto ' + label},12,true,0) returning id`
      return { id: r!.id, ownerId: u!.id, menuId: m!.id, sectionId: s!.id, itemId: i!.id }
    }
    A = await seed('A'); B = await seed('B')
    store = await import('../apps/server/src/lib/menu-workspace-store.js')
    read = await import('../apps/server/src/lib/menu-workspace-read.js')
    app = Fastify()
    const { menuWorkspaceRoutes } = await import('../apps/server/src/routes/menu-workspace.js')
    await app.register(menuWorkspaceRoutes, { prefix: '/api/menu-workspace' })
    await app.ready()
  }, 120_000)

  afterAll(async () => {
    if (app) await app.close()
    try { const { client } = await import('../packages/db/src/client.js') as any; await client?.end?.({ timeout: 5 }) } catch { /* client non esposto */ }
    if (sql) await sql.end({ timeout: 5 })
    if (pg) await pg.stop()
    if (dir) await rm(dir, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  }, 60_000)

  it('GET workspace: pending e dashboardEditor aggiunti, campi di prima intatti; /status sull\'edge di lettura', async () => {
    const res = await req(A, 'GET', '/')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ revision: 1, publishedRevision: 1, pending: false, dashboardEditor: false, presentation: { restaurantName: 'A' } })
    expect(body.data.menus[0].sections[0].items[0].id).toBe(A.itemId)
    const st = (await req(A, 'GET', '/status')).json()
    expect(st).toMatchObject({ revision: 1, publishedRevision: 1, pending: false, lastLabel: 'Menu originale' })
    expect(st.data).toEqual({ revision: st.revision, publishedRevision: st.publishedRevision, pending: st.pending, lastLabel: st.lastLabel, lastAt: st.lastAt })
    // locale senza workspace: stato vuoto, nessuna riga creata
    const ghost = { ...B, id: randomUUID() }
    expect((await req(ghost, 'GET', '/status')).json()).toMatchObject({ revision: 0, publishedRevision: null, pending: false })
    expect((await sql`SELECT count(*) n FROM menu_workspaces WHERE restaurant_id=${ghost.id}`)[0]!.n).toBe('0')
    const edge = readFileSync(resolve('apps/server/src/lib/edge-read-handler.ts'), 'utf8'), worker = readFileSync(resolve('deploy/cloudflare/worker.mjs'), 'utf8')
    expect(edge).toContain("'/api/menu-workspace/status'"); expect(worker).toContain("'/api/menu-workspace/status'")
  })

  it('ruoli: owner/manager/menu_editor scrivono, gli altri no', async () => {
    await req(B, 'GET', '/')
    for (const role of ['owner', 'manager', 'menu_editor']) expect((await ops(B, [setPrice(B, 13)], role)).statusCode).toBe(200)
    for (const role of ['dipendente', 'waiter', 'chef', 'cassiere']) expect((await ops(B, [setPrice(B, 99)], role)).statusCode).toBe(403)
    expect((await req(B, 'GET', '/status', undefined, 'dipendente')).statusCode).toBe(403)
    expect((await req(B, 'POST', '/discard', { expectedRevision: 1 }, 'cassiere')).statusCode).toBe(403)
    expect(Number((await row(B)).draft.menus[0].sections[0].items[0].price)).toBe(13)
  })

  it('ops: scrive solo la bozza, pending vero, risultati per op, nessuna scrittura se nulla cambia', async () => {
    const before = await row(A)
    const res = await ops(A, [setPrice(A, 15), { op: 'set', kind: 'item', id: randomUUID(), fields: { price: 1 } }])
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ revision: before.revision + 1, publishedRevision: 1, pending: true, results: [{ ok: true }, { ok: false, code: 'NOT_FOUND' }], seq: 1 })
    const after = await row(A)
    expect(after.published).toEqual(before.published)
    expect(after.pending).toBe(true)
    expect(Number((await sql`SELECT price FROM menu_items WHERE id=${A.itemId}`)[0]!.price)).toBe(12) // pubblicato intatto
    const same = await ops(A, [setPrice(A, 15)])
    expect(same.json()).toMatchObject({ revision: after.revision, pending: true })
    expect((await row(A)).revision).toBe(after.revision)
    expect((await req(A, 'GET', '/status')).json()).toMatchObject({ pending: true, revision: after.revision })
  })

  it('100 op in 100 chiamate → al più 1 riga «Bozza dashboard»', async () => {
    const start = await versions(A, store.DRAFT_VERSION_LABEL)
    for (let k = 0; k < 100; k++) expect((await ops(A, [setPrice(A, 20 + k)])).statusCode).toBe(200)
    expect(await versions(A, store.DRAFT_VERSION_LABEL)).toBeLessThanOrEqual(Math.max(1, start))
    expect(Number((await row(A)).draft.menus[0].sections[0].items[0].price)).toBe(119)
  })

  it('limiti e validazione: > 50 op, op malformate, documento finale invalido → 422 senza scritture parziali', async () => {
    const list = Array.from({ length: 51 }, () => setPrice(A, 1))
    expect((await ops(A, list)).statusCode).toBe(400)
    expect((await ops(A, list.slice(0, 50))).statusCode).toBe(200)
    expect((await ops(A, [])).statusCode).toBe(400)
    expect((await ops(A, [{ op: 'set', kind: 'dish', id: A.itemId, fields: {} }])).statusCode).toBe(400)
    expect((await req(A, 'POST', '/ops', { ops: [setPrice(A, 2)] })).statusCode).toBe(400) // clientId mancante
    const before = await row(A)
    const bad = await ops(A, [setPrice(A, 3), { op: 'set', kind: 'item', id: A.itemId, fields: { name: '' } }])
    expect(bad.statusCode).toBe(422)
    expect(bad.json().error.code).toBe('INVALID_DOCUMENT')
    const after = await row(A)
    expect(after.revision).toBe(before.revision); expect(after.draft).toEqual(before.draft)
  })

  it('ownership: id o immagine di un altro locale → 404 e nessuna scrittura', async () => {
    const before = await row(A)
    const foreignId = await ops(A, [{ op: 'create', kind: 'item', id: B.itemId, parentId: A.sectionId, fields: { name: 'Rubato' } }])
    expect(foreignId.statusCode).toBe(404)
    const foreignImage = await ops(A, [{ op: 'set', kind: 'item', id: A.itemId, fields: { imageUrl: `/uploads/${B.id}/x.webp` } }])
    expect(foreignImage.statusCode).toBe(404)
    expect((await row(A)).revision).toBe(before.revision)
    // creazione legittima con id del client
    const id = randomUUID()
    const ok = await ops(A, [{ op: 'create', kind: 'item', id, parentId: A.sectionId, fields: { name: 'Nuovo', price: 7 }, at: { beforeId: A.itemId } }])
    expect(ok.json().results).toEqual([{ ok: true }])
    expect((await row(A)).draft.menus[0].sections[0].items.map((i: any) => i.id)).toEqual([id, A.itemId])
  })

  it('publish 409 con currentRevision; dopo publish pending falso; discard riporta la bozza al pubblicato', async () => {
    const current = (await row(A)).revision
    const stale = await req(A, 'POST', '/publish', { expectedRevision: current - 1 })
    expect(stale.statusCode).toBe(409)
    expect(stale.json()).toMatchObject({ error: { code: 'CONFLICT' }, currentRevision: current })
    const pub = await req(A, 'POST', '/publish', { expectedRevision: current })
    expect(pub.statusCode).toBe(200)
    expect((await row(A)).pending).toBe(false)
    expect((await req(A, 'GET', '/status')).json()).toMatchObject({ pending: false, revision: current + 1, publishedRevision: current + 1, lastLabel: 'Pubblicazione' })
    // nuova modifica → pending; discard con revisione vecchia → 409; con quella giusta → bozza = pubblicato
    await ops(A, [setPrice(A, 77)])
    const r1 = await row(A)
    expect(r1.pending).toBe(true)
    const conflict = await req(A, 'POST', '/discard', { expectedRevision: r1.revision - 1 })
    expect(conflict.statusCode).toBe(409); expect(conflict.json().currentRevision).toBe(r1.revision)
    const discard = await req(A, 'POST', '/discard', { expectedRevision: r1.revision })
    expect(discard.statusCode).toBe(200)
    expect(discard.json()).toMatchObject({ pending: false, revision: r1.revision + 1 })
    const r2 = await row(A)
    expect(r2.pending).toBe(false); expect(r2.draft).toEqual(r2.published)
    const [v] = await sql`SELECT snapshot,revision FROM menu_workspace_versions WHERE restaurant_id=${A.id} AND label=${store.DISCARD_VERSION_LABEL} ORDER BY created_at DESC LIMIT 1`
    expect(v!.revision).toBe(r1.revision); expect(v!.snapshot).toEqual(r1.draft) // bozza scartata recuperabile
    // niente da scartare: nessuna scrittura
    expect((await req(A, 'POST', '/discard', { expectedRevision: r2.revision })).json().revision).toBe(r2.revision)
  })

  it('PROVA: ops ammesse, pubblicazione bloccata (403)', async () => {
    await sql`UPDATE restaurants SET settings=coalesce(settings,'{}'::jsonb)||'{"takomenuTrial":true}'::jsonb WHERE id=${B.id}`
    try {
      const res = await ops(B, [setPrice(B, 31)])
      expect(res.statusCode).toBe(200); expect(res.json().pending).toBe(true)
      const pub = await req(B, 'POST', '/publish', { expectedRevision: res.json().revision })
      expect(pub.statusCode).toBe(403); expect(pub.json().error.code).toBe('TRIAL_MENU_PRIVATE')
      expect((await row(B)).pending).toBe(true)
    } finally { await sql`UPDATE restaurants SET settings=settings||'{"takomenuTrial":false}'::jsonb WHERE id=${B.id}` }
  })

  it('due applyDraftOps concorrenti non perdono nulla (lock di riga)', async () => {
    const base = await row(A)
    const sectionId = base.draft.menus[0].sections[0].id
    const ids = Array.from({ length: 20 }, () => randomUUID())
    await Promise.all(ids.map((id, k) => store.applyDraftOps(A.id, A.ownerId, [{ op: 'create', kind: 'item', id, parentId: sectionId, fields: { name: 'C' + k, price: k } }], 'c' + k)))
    const after = await row(A)
    expect(after.revision).toBe(base.revision + 20)
    const present = new Set(after.draft.menus[0].sections[0].items.map((i: any) => i.id))
    for (const id of ids) expect(present.has(id)).toBe(true)
    expect(present.size).toBe(base.draft.menus[0].sections[0].items.length + 20)
  })

  it('manualOrder: campo facoltativo senza default, passa nel documento', async () => {
    const before = await row(A)
    expect(before.draft.design.manualOrder).toBeUndefined()
    const res = await ops(A, [{ op: 'manualOrder', value: true }])
    expect(res.json().results).toEqual([{ ok: true }])
    expect((await row(A)).draft.design.manualOrder).toBe(true)
    const { workspaceSchema } = await import('../apps/server/src/lib/menu-workspace-contract.js')
    const { publicWorkspace } = await import('../apps/server/src/lib/menu-workspace-schedule.js')
    expect(publicWorkspace(workspaceSchema.parse((await row(A)).draft)).design.manualOrder).toBe(true)
    expect('manualOrder' in workspaceSchema.parse({ menus: [] }).design).toBe(false)
  })

  it('agenzia: stato da pending SQL', async () => {
    const { agencyOverviewQuery } = await import('../apps/server/src/routes/agency.js')
    const { summarizeAgencyRestaurant } = await import('../apps/server/src/lib/agency-overview.js')
    const { db } = await import('../packages/db/src/index.js')
    const clean = await row(A)
    if (clean.pending) expect((await req(A, 'POST', '/discard', { expectedRevision: clean.revision })).statusCode).toBe(200)
    const rows = (await db.execute(agencyOverviewQuery)).map(summarizeAgencyRestaurant)
    const a = rows.find((r: any) => r.id === A.id)!, b = rows.find((r: any) => r.id === B.id)!
    expect(a.status).toBe('published') // bozza scartata = pubblicato, anche se revision ≠ published_revision
    expect((await row(A)).revision).not.toBe((await row(A)).published_revision)
    expect(b.status).toBe('draft')
    expect(summarizeAgencyRestaurant({ id: 'x', draft: { menus: [] }, revision: 3, published_revision: 3 }).status).toBe('published') // righe senza pending: regola di prima
  })

  it('flag dashboardEditor: script con id esplicito e --yes, prova senza --yes', async () => {
    const run = (...args: string[]) => { try { return { code: 0, out: execFileSync('node', ['scripts/set-dashboard-editor-flag.mjs', ...args], { env: { ...process.env, TAKO_FLAG_DATABASE_URL: databaseUrl }, stdio: 'pipe' }).toString() } } catch (e: any) { return { code: e.status, out: String(e.stderr) } } }
    expect(run().code).toBe(2)
    expect(run('on', '--yes').code).toBe(2)
    expect(run(A.id, 'forse', '--yes').code).toBe(2)
    expect(JSON.parse(run(A.id, 'on').out)).toMatchObject({ dryRun: true, current: false, next: true })
    expect((await req(A, 'GET', '/')).json().dashboardEditor).toBe(false)
    expect(JSON.parse(run(A.id, 'on', '--yes').out)).toMatchObject({ dashboardEditor: true })
    expect((await req(A, 'GET', '/')).json().dashboardEditor).toBe(true)
    expect((await req(B, 'GET', '/')).json().dashboardEditor).toBe(false)
    run(A.id, 'off', '--yes')
    expect((await req(A, 'GET', '/')).json().dashboardEditor).toBe(false)
    expect(read.dashboardEditorEnabled({ dashboardEditor: 'true' })).toBe(false)
  }, 30_000)

  it('S4: parse + applyOps + scrittura su documento sintetico ~388 KB (260 piatti, 12 lingue)', async () => {
    const { workspaceSchema } = await import('../apps/server/src/lib/menu-workspace-contract.js')
    const { applyOps } = await import('../packages/menu-ops/src/index.js')
    const langs = ['it', 'en', 'fr', 'de', 'es', 'pt', 'nl', 'pl', 'ru', 'ar', 'zh', 'ja']
    const tr = (base: string) => Object.fromEntries(langs.slice(1).map(l => [l, { name: `${base} ${l}`, description: `Descrizione tradotta ${l} di ${base}, con ingredienti e note` }]))
    const menuId = randomUUID(), itemIds: string[] = []
    const sections = Array.from({ length: 20 }, (_, s) => ({ id: randomUUID(), name: `Sottomenu ${s}`, translations: tr(`Sottomenu ${s}`), items: Array.from({ length: 13 }, (_, i) => { const id = randomUUID(); itemIds.push(id); return { id, name: `Piatto ${s}-${i}`, description: 'Pomodoro, mozzarella di bufala, basilico fresco, olio extravergine', price: 10 + i, allergens: ['glutine', 'latte'], tags: ['vegetariano'], translations: tr(`Piatto ${s}-${i}`) } }) }))
    const doc = workspaceSchema.parse({ languages: langs, menus: [{ id: menuId, name: 'Grande', sections }] })
    const bytes = Buffer.byteLength(JSON.stringify(doc))
    await sql`UPDATE menu_workspaces SET draft=${JSON.stringify(doc)}::jsonb WHERE restaurant_id=${B.id}`
    const cpu: number[] = [], wall: number[] = []
    for (let k = 0; k < 40; k++) {
      const op = { op: 'set' as const, kind: 'item' as const, id: itemIds[k % itemIds.length]!, fields: { price: 50 + k } }
      const c0 = process.cpuUsage()
      const w = workspaceSchema.parse(doc); const out = applyOps(w, [op]); workspaceSchema.parse(out.workspace); JSON.stringify(out.workspace)
      const c1 = process.cpuUsage(c0); cpu.push((c1.user + c1.system) / 1000)
      const t0 = performance.now(); await store.applyDraftOps(B.id, B.ownerId, [op], 's4'); wall.push(performance.now() - t0)
    }
    const report = { bytes, items: itemIds.length, languages: langs.length, cpuMs: { p50: pct(cpu, 50), p95: pct(cpu, 95) }, applyDraftOpsMs: { p50: pct(wall, 50), p95: pct(wall, 95) } }
    console.log('S4', JSON.stringify(report))
    expect(bytes).toBeGreaterThan(300_000)
    expect(report.cpuMs.p95).toBeLessThan(300)
  }, 120_000)
})
