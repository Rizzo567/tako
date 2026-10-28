// F3+F4 su Postgres locale usa-e-getta (embedded-postgres, nessun DB remoto): salvataggio, pubblicazione,
// lettura pubblica col percorso del Worker (catalogOnly=1), esaurito operativo e «piatto del giorno». Orologio finto solo su Date.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import postgres from 'postgres'

vi.mock('../../apps/server/src/index.js', () => ({ io: { to: () => ({ emit: () => {} }) } }))
const dbRequire = createRequire(resolve('packages/db/package.json'))
const EmbeddedPostgres = dbRequire('embedded-postgres').default
const { drizzle } = dbRequire('drizzle-orm/postgres-js')
const { migrate } = dbRequire('drizzle-orm/postgres-js/migrator')
async function freePort() { const s = createServer(); await new Promise<void>((ok, ko) => { s.once('error', ko); s.listen(0, '127.0.0.1', ok) }); const port = (s.address() as { port: number }).port; await new Promise<void>(ok => s.close(() => ok())); return port }

describe('promo e scarsità su Postgres locale', () => {
  let dir: string, pg: any, sql: ReturnType<typeof postgres>, tenant: string, owner: string, itemId: string
  const saved = { ...process.env }
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tako-sales-test-')); const port = await freePort()
    pg = new EmbeddedPostgres({ databaseDir: join(dir, 'pg'), port, user: 'sales_test', password: 'sales_test', persistent: false, initdbFlags: ['--encoding=UTF8'] })
    await pg.initialise(); await pg.start(); await pg.createDatabase('sales_test')
    process.env.DATABASE_URL = `postgresql://sales_test:sales_test@127.0.0.1:${port}/sales_test`; process.env.TAKO_MODE = 'web'; delete process.env.DATABASE_CA_CERT_PATH
    sql = postgres(process.env.DATABASE_URL, { max: 2 })
    await migrate(drizzle(sql), { migrationsFolder: resolve('packages/db/src/migrations') })
    await sql.unsafe(await readFile('docs/webapp/parity/menu-workspace.sql', 'utf8'))
    const [r] = await sql`insert into restaurants(name,slug,plan) values ('Locale prova promo','locale-prova-promo','pro') returning id`; tenant = r!.id
    const [u] = await sql`insert into users(restaurant_id,name,email,role,password_hash,email_verified) values (${tenant},'Titolare','titolare@prova.test','owner','x',true) returning id`; owner = u!.id
    const [m] = await sql`insert into menus(restaurant_id,name,type,active,position) values (${tenant},'Cena','main',true,0) returning id`
    const [s] = await sql`insert into menu_sections(menu_id,name,position,active) values (${m!.id},'Primi',0,true) returning id`
    const [i] = await sql`insert into menu_items(restaurant_id,section_id,name,price,available,position) values (${tenant},${s!.id},'Carbonara',12,true,0) returning id`; itemId = i!.id
    await sql`insert into menu_items(restaurant_id,section_id,name,price,available,position) values (${tenant},${s!.id},'Tiramisù',6,true,1)`
  }, 120000)
  afterEach(() => { vi.useRealTimers() })
  afterAll(async () => { await sql?.end(); await pg?.stop(); await rm(dir, { recursive: true, force: true }); process.env = saved }, 60000)

  it('salva e pubblica i campi nuovi, la lettura pubblica del Worker li risolve e li fa scadere alle 06:00', async () => {
    const { ensureWorkspace, mutateWorkspace, readWorkspace } = await import('../../apps/server/src/lib/menu-workspace-store.js')
    const { workspaceSchema } = await import('../../apps/server/src/lib/menu-workspace-contract.js')
    const { readPublishedCatalog, publicMenuProjection } = await import('../../apps/server/src/lib/published-menu.js')
    const row = await ensureWorkspace(tenant), draft = workspaceSchema.parse(row.draft)
    const items = draft.menus[0]!.sections[0]!.items
    items.find(i => i.name === 'Carbonara')!.promo = { price: 9, until: '2026-10-18' }
    items.find(i => i.name === 'Carbonara')!.scarcity = { lastPortions: true, onlyToday: null }
    items.find(i => i.name === 'Tiramisù')!.scarcity = { lastPortions: false, onlyToday: '2026-10-16' }
    const saved = await mutateWorkspace(tenant, owner, row.revision, draft, false, 'prova')
    await mutateWorkspace(tenant, owner, saved.revision, draft, true, 'prova')
    const stored = await readWorkspace(tenant)
    expect(stored!.published!.menus[0]!.sections[0]!.items[0]).toMatchObject({ promo: { price: 9, until: '2026-10-18' }, scarcity: { lastPortions: true, onlyToday: null } })
    const project = async (iso: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); try { const c = await readPublishedCatalog(tenant, { catalogOnly: true }); return publicMenuProjection(c!.workspace.menus[0]!).sections[0]!.items } finally { vi.useRealTimers() } }
    const friday = await project('2026-10-16T17:00:00Z')
    expect(friday[0]).toMatchObject({ name: 'Carbonara', price: 12, promoPrice: 9, lastPortions: true }); expect(friday[1]).toMatchObject({ name: 'Tiramisù', onlyToday: true })
    const saturday = await project('2026-10-17T04:00:00Z') // 06:00 Roma
    expect(saturday[1]).not.toHaveProperty('onlyToday'); expect(saturday[0]).toMatchObject({ promoPrice: 9 })
    const monday = await project('2026-10-19T04:00:00Z')
    expect(monday[0]).not.toHaveProperty('promoPrice'); expect(monday[0]).toMatchObject({ price: 12, lastPortions: true })
  })

  it('esaurito operativo: «Ultime porzioni» tolta da bozza e pubblicato con SQL reale, revisione invariata', async () => {
    const { clearLastPortionsOnSoldOut } = await import('../../apps/server/src/lib/menu-sales-store.js')
    const [before] = await sql`select revision,published_revision from menu_workspaces where restaurant_id=${tenant}`
    expect(await clearLastPortionsOnSoldOut(tenant, itemId)).toBe(true)
    const [after] = await sql`select revision,published_revision,draft,published from menu_workspaces where restaurant_id=${tenant}`
    expect([after!.revision, after!.published_revision]).toEqual([before!.revision, before!.published_revision])
    for (const doc of [after!.draft, after!.published]) expect((doc as any).menus[0].sections[0].items[0].scarcity).toBeUndefined()
    expect((after!.published as any).menus[0].sections[0].items[0].promo).toEqual({ price: 9, until: '2026-10-18' })
    expect(await clearLastPortionsOnSoldOut(tenant, itemId)).toBe(false)
  })

  it('bug esistente corretto: il «piatto del giorno» pubblicato dal bot sparisce dalla pagina pubblica del giorno dopo', async () => {
    const { readWorkspace, mutateWorkspace } = await import('../../apps/server/src/lib/menu-workspace-store.js')
    const { workspaceSchema } = await import('../../apps/server/src/lib/menu-workspace-contract.js')
    const { applyActions } = await import('../../apps/server/src/lib/twilio-menu-ai.js')
    const { readPublishedCatalog } = await import('../../apps/server/src/lib/published-menu.js')
    const row = await readWorkspace(tenant), w: any = workspaceSchema.parse(row!.draft)
    applyActions(w, [{ kind: 'special', name: 'Risotto del giorno', price: 16, description: null }], { timezone: 'Europe/Rome', now: new Date('2026-10-15T10:00:00Z') })
    const next = workspaceSchema.parse(w), saved = await mutateWorkspace(tenant, owner, row!.revision, next, false, 'bot'); await mutateWorkspace(tenant, owner, saved.revision, next, true, 'bot')
    const names = async (iso: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); try { return (await readPublishedCatalog(tenant, { catalogOnly: true }))!.workspace.menus.flatMap(m => m.sections.flatMap(s => s.items.map(i => i.name))) } finally { vi.useRealTimers() } }
    expect(await names('2026-10-15T19:00:00Z')).toContain('Risotto del giorno')
    expect(await names('2026-10-16T03:59:00Z')).toContain('Risotto del giorno')
    expect(await names('2026-10-16T04:00:00Z')).not.toContain('Risotto del giorno')
    expect(await names('2026-10-17T12:00:00Z')).toEqual(['Carbonara', 'Tiramisù'])
  })
})
