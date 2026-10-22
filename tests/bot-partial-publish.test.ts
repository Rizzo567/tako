/** Dashboard editor 22/10 — T3: il bot pubblica SOLO la sua modifica, la bozza del ristoratore non si perde e non si pubblica mai.
 * Postgres locale usa-e-getta (tests/day-presets/local-pg.ts): migrazioni reali, nessun DB remoto, nessuna rete, nessun LLM.
 * Matrice: i 15 scenari del PIANO §4 T3 + varianti per tipo di azione. Invarianti dopo ogni scenario: documenti validi (id unici),
 * tabelle del menu allineate al pubblicato, nessuna modifica di bozza pubblicata dal bot, nessuna perdita di bozza. */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { startLocalPg } from './day-presets/local-pg.js'

let pg: Awaited<ReturnType<typeof startLocalPg>>
let S: typeof import('../apps/server/src/lib/menu-workspace-store.js')
let B: typeof import('../apps/server/src/lib/menu-workspace-bot.js')
let C: typeof import('../apps/server/src/lib/menu-workspace-contract.js')
let AI: typeof import('../apps/server/src/lib/twilio-menu-ai.js')
let H: typeof import('../apps/server/src/lib/twilio-menu-hold.js')
let P: typeof import('../apps/server/src/lib/menu-day-presets.js')
let T: typeof import('../apps/server/src/lib/menu-text-translations.js')
let PEND: typeof import('../apps/server/src/lib/menu-workspace-pending.js')

type Ids = Record<'tenant' | 'actor' | 'pranzo' | 'cena' | 'drinks' | 'primi' | 'fresche' | 'dolci' | 'secondi' | 'vini' | 'carbonara' | 'amatriciana' | 'cacio' | 'pici' | 'tiramisu' | 'tagliata' | 'rosso', string>
const U = () => randomUUID()

async function seed(opts: { published?: boolean } = {}): Promise<Ids> {
 const sql = pg.client
 const ids = Object.fromEntries(['tenant', 'actor', 'pranzo', 'cena', 'drinks', 'primi', 'fresche', 'dolci', 'secondi', 'vini', 'carbonara', 'amatriciana', 'cacio', 'pici', 'tiramisu', 'tagliata', 'rosso'].map(k => [k, U()])) as Ids
 await sql`INSERT INTO restaurants(id,name,slug,plan,settings) VALUES(${ids.tenant},'Trattoria Bozza',${'bozza-' + ids.tenant.slice(0, 8)},'pro',${sql.json({})})`
 await sql`INSERT INTO users(id,restaurant_id,name,email,role) VALUES(${ids.actor},${ids.tenant},'Titolare',${ids.actor + '@test.local'},'owner')`
 const w = C.workspaceSchema.parse({ languages: ['it', 'en'], menus: [
  { id: ids.pranzo, name: 'Pranzo', type: 'lunch', sections: [
   { id: ids.primi, name: 'Primi', items: [{ id: ids.carbonara, name: 'Carbonara', price: 10, description: 'Guanciale', tags: [] }, { id: ids.amatriciana, name: 'Amatriciana', price: 9 }, { id: ids.cacio, name: 'Cacio e pepe', price: 8 }] },
   { id: ids.fresche, name: 'Paste fresche', parentSectionId: ids.primi, items: [{ id: ids.pici, name: 'Pici', price: 11 }] },
   { id: ids.dolci, name: 'Dolci', items: [{ id: ids.tiramisu, name: 'Tiramisù', price: 5 }] }] },
  { id: ids.cena, name: 'Cena', type: 'dinner', sections: [{ id: ids.secondi, name: 'Secondi', items: [{ id: ids.tagliata, name: 'Tagliata', price: 16 }] }] },
  { id: ids.drinks, name: 'Drinks', type: 'drinks', sections: [{ id: ids.vini, name: 'Vini', items: [{ id: ids.rosso, name: 'Rosso della casa', price: 4 }] }] }] })
 if (opts.published === false) { await sql`INSERT INTO menu_workspaces(restaurant_id,draft,published,revision,published_revision) VALUES(${ids.tenant},${sql.json(w)},NULL,1,NULL)`; return ids }
 await sql`INSERT INTO menu_workspaces(restaurant_id,draft,published,revision,published_revision) VALUES(${ids.tenant},${sql.json(w)},${sql.json(w)},1,1)`
 await S.mutateWorkspace(ids.tenant, ids.actor, 1, w, false, 'Seed')
 await S.mutateWorkspace(ids.tenant, ids.actor, 2, w, true, 'Seed')
 return ids
}
const raw = async (t: string) => (await S.readWorkspace(t))!
const docs = async (t: string) => { const r = await raw(t); return { r, draft: C.workspaceSchema.parse(r.draft), pub: C.workspaceSchema.parse(r.published) } }
const item = (w: any, id: string) => { for (const m of w.menus) for (const s of m.sections) { const i = s.items.find((x: any) => x.id === id); if (i) return { ...i, sectionId: s.id, menuId: m.id } } return null }
const section = (w: any, id: string) => { for (const m of w.menus) { const s = m.sections.find((x: any) => x.id === id); if (s) return { ...s, menuId: m.id } } return null }
const byName = (w: any, name: string) => w.menus.flatMap((m: any) => m.sections.flatMap((s: any) => s.items)).filter((i: any) => i.name === name)
/** Modifica della dashboard (solo bozza), come le op/PUT: mutateWorkspace senza pubblicare. */
async function dash(t: string, actor: string, edit: (w: any) => void) { const r = await raw(t), w = C.workspaceSchema.parse(r.draft); edit(w); await S.mutateWorkspace(t, actor, r.revision, C.workspaceSchema.parse(w), false, 'Dashboard') }
/** «Pubblica» della dashboard. */
async function publish(t: string, actor: string) { const r = await raw(t); await S.mutateWorkspace(t, actor, r.revision, C.workspaceSchema.parse(r.draft), true, 'Pubblica') }
/** Turno del bot come nella rotta: legge la vista del bot (pubblicato), applica le azioni, scrive con applyBotChange. */
async function bot(t: string, actor: string, actions: any[], o: { uploads?: Map<string, string>; seed?: string } = {}) {
 const view = (await B.readBotWorkspace(t))!, before = C.workspaceSchema.parse(view.draft), w = structuredClone(before)
 AI.applyActions(w, actions, { uploads: o.uploads, timezone: 'Europe/Rome', newId: B.seededIds(o.seed ?? U()) })
 const next = C.workspaceSchema.parse(w)
 const res = await B.applyBotChange(t, actor, ['WhatsApp: aggiornamento automatico', 'WhatsApp: pubblicazione automatica'], { expectedPublishedRevision: view.revision, next })
 return { res, before, next, view }
}
/** Invarianti: documenti validi (id unici), revision >= published_revision, tabelle = pubblicato. */
async function invariants(t: string) {
 const r = await raw(t)
 C.workspaceSchema.parse(r.draft)
 if (!r.published) return
 const pub = C.workspaceSchema.parse(r.published)
 expect(r.revision).toBeGreaterThanOrEqual(Number(r.published_revision))
 const rows = await pg.client`SELECT id,name,price,available FROM menu_items WHERE restaurant_id=${t}`
 const table = new Map(rows.map((x: any) => [String(x.id), x]))
 for (const m of pub.menus) for (const s of m.sections) for (const i of s.items) {
  const row: any = table.get(i.id); expect(row, 'menu_items per ' + i.name).toBeTruthy()
  expect(row.name).toBe(i.name); expect(Number(row.price)).toBe(Number(i.price))
 }
}
const touched: string[] = []
afterEach(async () => { for (const t of touched.splice(0)) await invariants(t) })
async function fresh(opts?: { published?: boolean }) { const ids = await seed(opts); touched.push(ids.tenant); return ids }

beforeAll(async () => {
 pg = await startLocalPg(55489)
 process.env.DATABASE_URL = pg.url
 S = await import('../apps/server/src/lib/menu-workspace-store.js')
 B = await import('../apps/server/src/lib/menu-workspace-bot.js')
 C = await import('../apps/server/src/lib/menu-workspace-contract.js')
 AI = await import('../apps/server/src/lib/twilio-menu-ai.js')
 H = await import('../apps/server/src/lib/twilio-menu-hold.js')
 P = await import('../apps/server/src/lib/menu-day-presets.js')
 T = await import('../apps/server/src/lib/menu-text-translations.js')
 PEND = await import('../apps/server/src/lib/menu-workspace-pending.js')
}, 90000)
afterAll(async () => { try { const { db } = await import('../packages/db/src/client.js'); await (db as any).$client.end({ timeout: 1 }) } catch { /* già chiuso */ } await pg?.stop() })

describe('senza bozza pendente: identico a prima', () => {
 it('S0 — bozza = pubblicato = next, revisione +2, due versioni con le etichette di prima', async () => {
  const ids = await fresh(), before = await raw(ids.tenant)
  const { res, next } = await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.carbonara, price: 12 }])
  const { r, draft, pub } = await docs(ids.tenant)
  expect(res.partial).toBe(false)
  expect(PEND.jsonEqual(draft, pub)).toBe(true); expect(item(pub, ids.carbonara)!.price).toBe(12)
  expect(r.revision).toBe(before.revision + 2); expect(r.published_revision).toBe(r.revision); expect(res.revision + 1).toBe(r.published_revision)
  expect(PEND.jsonEqual(pub, next)).toBe(true)
  const v = await pg.client`SELECT label FROM menu_workspace_versions WHERE restaurant_id=${ids.tenant} ORDER BY revision DESC LIMIT 2`
  expect(v.map((x: any) => x.label)).toEqual(['WhatsApp: pubblicazione automatica', 'WhatsApp: aggiornamento automatico'])
 })
})

describe('T3 — i 15 scenari', () => {
 it('1 — bozza su A, il bot cambia B: pubblicato solo B, bozza A+B', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { item(w, ids.carbonara); w.menus[0].sections[0].items[0].price = 13 })
  const { res } = await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.tagliata, price: 18 }])
  const { draft, pub } = await docs(ids.tenant)
  expect(res.partial).toBe(true)
  expect(item(pub, ids.tagliata)!.price).toBe(18); expect(item(pub, ids.carbonara)!.price).toBe(10)
  expect(item(draft, ids.tagliata)!.price).toBe(18); expect(item(draft, ids.carbonara)!.price).toBe(13)
  expect(PEND.pendingOf(await raw(ids.tenant))).toBe(true)
 })
 it('2 — stesso campo in bozza e dal bot: vince il bot, altri campi della bozza intatti', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { const i = w.menus[0].sections[0].items[0]; i.price = 13; i.description = 'Guanciale croccante' })
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.carbonara, price: 14 }])
  const { draft, pub } = await docs(ids.tenant)
  expect(item(draft, ids.carbonara)).toMatchObject({ price: 14, description: 'Guanciale croccante' })
  expect(item(pub, ids.carbonara)).toMatchObject({ price: 14, description: 'Guanciale' })
 })
 it('3 — A cancellato in bozza, il bot lo modifica: pubblicato modificato, bozza ancora senza A, nessun errore', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[0].items = w.menus[0].sections[0].items.filter((i: any) => i.id !== ids.amatriciana) })
  const { res } = await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.amatriciana, price: 11 }])
  const { draft, pub } = await docs(ids.tenant)
  expect(item(pub, ids.amatriciana)!.price).toBe(11); expect(item(draft, ids.amatriciana)).toBeNull()
  expect(res.skippedInDraft).toContain('item:' + ids.amatriciana + ':missing')
 })
 it('4 — A spostato in altra sezione in bozza, il bot lo rinomina: rinominato in entrambi, resta dove l’ha messo il titolare', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { const s = w.menus[0].sections[0], k = s.items.findIndex((i: any) => i.id === ids.cacio); const [it] = s.items.splice(k, 1); w.menus[0].sections[2].items.push(it) })
  await bot(ids.tenant, ids.actor, [{ kind: 'rename', id: ids.cacio, name: 'Cacio e pepe di Roma' }])
  const { draft, pub } = await docs(ids.tenant)
  expect(item(pub, ids.cacio)).toMatchObject({ name: 'Cacio e pepe di Roma', sectionId: ids.primi })
  expect(item(draft, ids.cacio)).toMatchObject({ name: 'Cacio e pepe di Roma', sectionId: ids.dolci })
 })
 it('5 — il bot crea un piatto: stessi id nei due documenti; «Pubblica» dopo non lo duplica', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 17 })
  await bot(ids.tenant, ids.actor, [{ kind: 'create', sectionId: ids.primi, name: 'Gricia', price: 9, description: null }], { seed: 'seme-5' })
  const { draft, pub } = await docs(ids.tenant)
  const [p] = byName(pub, 'Gricia'), [d] = byName(draft, 'Gricia')
  expect(p.id).toBe(d.id); expect(p.id).toBe(B.seededIds('seme-5')())
  await publish(ids.tenant, ids.actor)
  const after = await docs(ids.tenant)
  expect(byName(after.pub, 'Gricia')).toHaveLength(1); expect(item(after.pub, ids.tagliata)!.price).toBe(17)
  expect((await pg.client`SELECT count(*)::int n FROM menu_items WHERE restaurant_id=${ids.tenant} AND name='Gricia'`)[0]!.n).toBe(1)
  expect(PEND.pendingOf(after.r)).toBe(false)
 })
 it('6 — il bot nasconde un Sottomenu intero: in entrambi; la bozza tiene le sue modifiche dentro', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[2].items[0].price = 6 })
  await bot(ids.tenant, ids.actor, [{ kind: 'set_section_active', sectionId: ids.dolci, name: 'Dolci', value: false, items: 1 }])
  const { draft, pub } = await docs(ids.tenant)
  expect(section(pub, ids.dolci)!.active).toBe(false); expect(section(draft, ids.dolci)!.active).toBe(false)
  expect(item(draft, ids.tiramisu)!.price).toBe(6); expect(item(pub, ids.tiramisu)!.price).toBe(5)
  expect((await pg.client`SELECT available FROM menu_items WHERE id=${ids.tiramisu}`)[0]!.available).toBe(false)
 })
 it('7 — il bot rinomina un Sottomenu cancellato in bozza: solo pubblicato, la cancellazione resta pendente', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections = w.menus[0].sections.filter((s: any) => s.id !== ids.dolci) })
  const { res } = await bot(ids.tenant, ids.actor, [{ kind: 'rename_section', sectionId: ids.dolci, name: 'Dessert' }])
  const { draft, pub } = await docs(ids.tenant)
  expect(section(pub, ids.dolci)!.name).toBe('Dessert'); expect(section(draft, ids.dolci)).toBeNull()
  expect(res.skippedInDraft).toContain('section:' + ids.dolci + ':missing')
 })
 it('8 — menu intero con bozza pendente su quel Menu: versione «Bozza prima di WhatsApp» + avviso, altri Menu intatti', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[0].items[0].price = 13; w.menus[1].sections[0].items[0].price = 19 })
  const view = (await B.readBotWorkspace(ids.tenant))!, base = C.workspaceSchema.parse(view.draft), next = structuredClone(base)
  next.menus[0].sections = [{ ...next.menus[0].sections[0]!, parentSectionId: null, items: [{ ...next.menus[0].sections[0]!.items[0]!, price: 11 }, { id: U(), name: 'Lasagna', price: 12, translations: {} } as any] }]
  const res = await B.applyBotChange(ids.tenant, ids.actor, ['WhatsApp: menu intero (bozza)', 'WhatsApp: menu intero pubblicato'], { expectedPublishedRevision: view.revision, next: C.workspaceSchema.parse(next), replaceMenuIds: [ids.pranzo], before: [{ label: 'WhatsApp: copia prima del menu intero #' + ids.pranzo, doc: base }], draftBackupLabel: 'Bozza prima di WhatsApp (menu intero Pranzo)', notice: 'Avviso menu intero' })
  const { draft, pub, r } = await docs(ids.tenant)
  expect(res.draftBackupVersionId).toBeTruthy()
  const v = (await pg.client`SELECT label,snapshot FROM menu_workspace_versions WHERE id=${res.draftBackupVersionId}`)[0]!
  expect(v.label).toBe('Bozza prima di WhatsApp (menu intero Pranzo)'); expect(item(v.snapshot, ids.carbonara)!.price).toBe(13)
  expect(PEND.jsonEqual(draft.menus[0], pub.menus[0])).toBe(true); expect(item(draft, ids.carbonara)!.price).toBe(11)
  expect(item(draft, ids.tagliata)!.price).toBe(19); expect(item(pub, ids.tagliata)!.price).toBe(16)
  expect((await pg.client`SELECT kind FROM menu_owner_notices WHERE restaurant_id=${ids.tenant}`).map((x: any) => x.kind)).toEqual(['draft_discarded'])
  const snap = await pg.client`SELECT revision FROM menu_workspace_versions WHERE restaurant_id=${ids.tenant} AND label LIKE 'WhatsApp: copia prima del menu intero #%'`
  expect(snap).toHaveLength(1); expect(r.revision).toBeGreaterThan(Number(snap[0]!.revision))
 })
 it('9 — preset delle 06:00 con bozza su un altro Menu: la bozza resta, nessuna versione né avviso', async () => {
  const ids = await fresh()
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' })
  await P.saveDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 2, sections: [{ id: U(), name: 'Primi', items: [{ id: U(), name: 'Gnocchi', price: 12 }] }] as never })
  await P.setDayPresetAutoPublish(ids.tenant, ids.pranzo, true, { now: new Date('2026-10-19T10:00:00Z') })
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 99 })
  const out = (await P.runDayPresetAutopublish({ now: new Date('2026-10-20T04:00:00Z') })).filter(o => o.restaurantId === ids.tenant)
  expect(out).toMatchObject([{ status: 'published' }])
  const { draft, pub } = await docs(ids.tenant)
  expect(item(draft, ids.tagliata)!.price).toBe(99); expect(item(pub, ids.tagliata)!.price).toBe(16)
  expect(byName(pub, 'Gnocchi')).toHaveLength(1); expect(byName(draft, 'Gnocchi')[0].id).toBe(byName(pub, 'Gnocchi')[0].id)
  expect(await P.listOwnerNotices(ids.tenant)).toEqual([])
  expect((await pg.client`SELECT discarded_draft_version_id FROM menu_day_preset_runs WHERE restaurant_id=${ids.tenant}`)[0]!.discarded_draft_version_id).toBeNull()
 })
 it('9b — preset delle 06:00 con bozza sullo STESSO Menu: sostituito in entrambi, versione + avviso', async () => {
  const ids = await fresh()
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' })
  await P.saveDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 2, sections: [{ id: U(), name: 'Primi', items: [{ id: U(), name: 'Gnocchi', price: 12 }] }] as never })
  await P.setDayPresetAutoPublish(ids.tenant, ids.pranzo, true, { now: new Date('2026-10-19T10:00:00Z') })
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[0].items[0].price = 77; w.menus[1].sections[0].items[0].price = 99 })
  await P.runDayPresetAutopublish({ now: new Date('2026-10-20T04:00:00Z') })
  const { draft } = await docs(ids.tenant)
  expect(byName(draft, 'Gnocchi')).toHaveLength(1); expect(item(draft, ids.carbonara)).toBeNull(); expect(item(draft, ids.tagliata)!.price).toBe(99)
  expect((await P.listOwnerNotices(ids.tenant)).map(n => n.kind)).toEqual(['draft_discarded'])
  const run = (await pg.client`SELECT discarded_draft_version_id FROM menu_day_preset_runs WHERE restaurant_id=${ids.tenant}`)[0]!
  const v = (await pg.client`SELECT label,snapshot FROM menu_workspace_versions WHERE id=${run.discarded_draft_version_id}`)[0]!
  expect(v.label).toBe('Bozza non pubblicata, sostituita dal preset «Martedì» alle 06:00'); expect(item(v.snapshot, ids.carbonara)!.price).toBe(77)
 })
 it('10 — proposta agganciata a published_revision: resta valida dopo un’op di bozza, decade dopo «Pubblica»', async () => {
  const ids = await fresh()
  const pinned = (await B.readBotWorkspace(ids.tenant))!.revision
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[0].items[0].price = 13 })
  expect((await B.readBotWorkspace(ids.tenant))!.revision).toBe(pinned)
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[0].items[1].price = 7 })
  expect((await B.readBotWorkspace(ids.tenant))!.revision).toBe(pinned)
  await publish(ids.tenant, ids.actor)
  expect((await B.readBotWorkspace(ids.tenant))!.revision).not.toBe(pinned)
 })
 it('11 — «annulla» del bot dopo un’op di bozza: torna il prezzo in entrambi, l’op del titolare resta', async () => {
  const ids = await fresh()
  const { before, next } = await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.carbonara, price: 14 }])
  const rec = H.undoRecordFor(before, next)!
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 20 })
  const view = (await B.readBotWorkspace(ids.tenant))!, w = C.workspaceSchema.parse(view.draft)
  expect(H.applyUndo(w, rec).ok).toBe(true)
  await B.applyBotChange(ids.tenant, ids.actor, ['WhatsApp: annullamento', 'WhatsApp: annullamento pubblicato'], { expectedPublishedRevision: view.revision, next: C.workspaceSchema.parse(w) })
  const { draft, pub } = await docs(ids.tenant)
  expect(item(pub, ids.carbonara)!.price).toBe(10); expect(item(draft, ids.carbonara)!.price).toBe(10); expect(item(draft, ids.tagliata)!.price).toBe(20); expect(item(pub, ids.tagliata)!.price).toBe(16)
 })
 it('11b — «annulla» di un’eliminazione (struttura): il piatto torna in entrambi nel suo posto, bozza altrui intatta', async () => {
  const ids = await fresh()
  const { before, next } = await bot(ids.tenant, ids.actor, [{ kind: 'delete', id: ids.amatriciana }])
  const rec = H.undoRecordFor(before, next)!
  expect(rec.full).toBeTruthy()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 20 })
  expect(item((await docs(ids.tenant)).draft, ids.amatriciana)).toBeNull()
  const view = (await B.readBotWorkspace(ids.tenant))!, w = C.workspaceSchema.parse(view.draft)
  expect(H.applyUndo(w, rec).ok).toBe(true)
  await B.applyBotChange(ids.tenant, ids.actor, ['WhatsApp: annullamento', 'WhatsApp: annullamento pubblicato'], { expectedPublishedRevision: view.revision, next: C.workspaceSchema.parse(w) })
  const { draft, pub } = await docs(ids.tenant)
  expect(draft.menus[0]!.sections[0]!.items.map(i => i.id)).toEqual([ids.carbonara, ids.amatriciana, ids.cacio])
  expect(item(pub, ids.amatriciana)).toBeTruthy(); expect(item(draft, ids.tagliata)!.price).toBe(20)
 })
 it('12 — traduzioni automatiche con bozza pendente: nelle due copie, la bozza non si pubblica', async () => {
  const ids = await fresh()
  await bot(ids.tenant, ids.actor, [{ kind: 'create', sectionId: ids.dolci, name: 'Panna cotta', price: 5, description: null }])
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 21 })
  await T.enqueueNewTextTranslations(ids.tenant, ['Panna cotta'], { languages: ['en'], sourceLanguage: 'it' })
  await pg.client`UPDATE menu_text_translations SET status='done',translation='Panna cotta (EN)' WHERE restaurant_id=${ids.tenant}`
  expect(await T.writeCachedTranslations(ids.tenant)).toBe(true)
  const { draft, pub } = await docs(ids.tenant)
  expect(byName(pub, 'Panna cotta')[0].translations.en?.name).toBe('Panna cotta (EN)')
  expect(byName(draft, 'Panna cotta')[0].translations.en?.name).toBe('Panna cotta (EN)')
  expect(item(pub, ids.tagliata)!.price).toBe(16); expect(item(draft, ids.tagliata)!.price).toBe(21)
 })
 it('13 — PROVA: WorkspaceTrialLocked, la bozza (con la modifica del bot) è salvata, il pubblicato no', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 21 })
  await pg.client`UPDATE restaurants SET settings=${pg.client.json({ takomenuTrial: true })} WHERE id=${ids.tenant}`
  await expect(bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.carbonara, price: 15 }])).rejects.toBeInstanceOf(S.WorkspaceTrialLocked)
  const { draft, pub } = await docs(ids.tenant)
  expect(item(pub, ids.carbonara)!.price).toBe(10); expect(item(draft, ids.carbonara)!.price).toBe(15); expect(item(draft, ids.tagliata)!.price).toBe(21)
 })
 it('13b — PROVA senza bozza pendente: come prima (WorkspaceTrialLocked, niente pubblicato)', async () => {
  const ids = await fresh()
  await pg.client`UPDATE restaurants SET settings=${pg.client.json({ takomenuTrial: true })} WHERE id=${ids.tenant}`
  await expect(bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.carbonara, price: 15 }])).rejects.toBeInstanceOf(S.WorkspaceTrialLocked)
  expect(item((await docs(ids.tenant)).pub, ids.carbonara)!.price).toBe(10)
 })
 it('14 — due scritture del bot concorrenti sulla stessa revisione: una passa, l’altra «il menu è cambiato»', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 21 })
  const view = (await B.readBotWorkspace(ids.tenant))!, base = C.workspaceSchema.parse(view.draft)
  const mk = (price: number) => { const w = structuredClone(base); AI.applyActions(w, [{ kind: 'price', id: ids.carbonara, price }]); return B.applyBotChange(ids.tenant, ids.actor, ['a', 'b'], { expectedPublishedRevision: view.revision, next: C.workspaceSchema.parse(w) }) }
  const out = await Promise.allSettled([mk(11), mk(12)])
  expect(out.filter(o => o.status === 'fulfilled')).toHaveLength(1)
  const failed = out.find(o => o.status === 'rejected') as PromiseRejectedResult
  expect(String(failed.reason?.message)).toBe('Revision conflict')
  const { draft, pub } = await docs(ids.tenant)
  expect(item(draft, ids.carbonara)!.price).toBe(item(pub, ids.carbonara)!.price); expect(item(draft, ids.tagliata)!.price).toBe(21)
 })
 it('14b — dopo una scrittura del bot la revisione vista prima non vale più (anche senza bozza)', async () => {
  const ids = await fresh()
  const view = (await B.readBotWorkspace(ids.tenant))!
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.carbonara, price: 11 }])
  await expect(B.applyBotChange(ids.tenant, ids.actor, ['a', 'b'], { expectedPublishedRevision: view.revision, next: C.workspaceSchema.parse(view.draft) })).rejects.toThrow('Revision conflict')
 })
 it('15 — mai pubblicato: la vista resta la bozza senza pubblicato (il bot risponde «notPublished» come oggi)', async () => {
  const ids = await fresh({ published: false })
  const view = (await B.readBotWorkspace(ids.tenant))!
  expect(view.published).toBeNull(); expect(view.revision).toBe(1)
 })
})

describe('varianti per tipo di azione (bozza pendente su un altro piatto)', () => {
 const pendingElsewhere = async (ids: Ids) => dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 30 })
 const cases: [string, (ids: Ids) => any[], (pub: any, draft: any, ids: Ids) => void][] = [
  ['price', ids => [{ kind: 'price', id: ids.cacio, price: 9.5 }], (p, d, ids) => { expect(item(p, ids.cacio)!.price).toBe(9.5); expect(item(d, ids.cacio)!.price).toBe(9.5) }],
  ['available false', ids => [{ kind: 'available', id: ids.pici, value: false }], (p, d, ids) => { expect(item(p, ids.pici)!.available).toBe(false); expect(item(d, ids.pici)!.available).toBe(false) }],
  ['hidden', ids => [{ kind: 'hidden', id: ids.tiramisu, value: true }], (p, d, ids) => { expect(item(p, ids.tiramisu)!.hidden).toBe(true); expect(item(d, ids.tiramisu)!.hidden).toBe(true) }],
  ['featured', ids => [{ kind: 'featured', id: ids.carbonara, value: true }], (p, d, ids) => { expect(item(p, ids.carbonara)!.featured).toBe(true); expect(item(d, ids.carbonara)!.featured).toBe(true) }],
  ['description', ids => [{ kind: 'description', id: ids.amatriciana, text: 'Guanciale e pomodoro' }], (p, d, ids) => { expect(item(p, ids.amatriciana)!.description).toBe('Guanciale e pomodoro'); expect(item(d, ids.amatriciana)!.description).toBe('Guanciale e pomodoro') }],
  ['tag on', ids => [{ kind: 'tag', id: ids.cacio, tag: 'vegetariano', value: true }], (p, d, ids) => { expect(item(p, ids.cacio)!.tags).toContain('vegetariano'); expect(item(d, ids.cacio)!.tags).toContain('vegetariano') }],
  ['image', ids => [{ kind: 'image', id: ids.carbonara, mediaUrl: 'x', mediaType: 'image/png' }], (p, d, ids) => { expect(item(p, ids.carbonara)!.imageUrl).toBe(`/uploads/${ids.tenant}/foto.png`); expect(item(d, ids.carbonara)!.imageUrl).toBe(`/uploads/${ids.tenant}/foto.png`) }],
  ['create', ids => [{ kind: 'create', sectionId: ids.secondi, name: 'Filetto', price: 22, description: 'Al pepe' }], (p, d) => { expect(byName(p, 'Filetto')[0].id).toBe(byName(d, 'Filetto')[0].id); expect(byName(d, 'Filetto')).toHaveLength(1) }],
  ['special (piatto del giorno)', () => [{ kind: 'special', name: 'Zuppa del giorno', price: 7, description: null }], (p, d) => { const a = byName(p, 'Zuppa del giorno')[0], b = byName(d, 'Zuppa del giorno')[0]; expect(a.id).toBe(b.id); expect(item(p, a.id)!.sectionId).toBe(item(d, b.id)!.sectionId) }],
  ['promo (vendite)', ids => [{ kind: 'promo', id: ids.carbonara, price: 8, until: null }], (p, d, ids) => { expect(item(p, ids.carbonara)!.promo?.price).toBe(8); expect(item(d, ids.carbonara)!.promo?.price).toBe(8) }],
  ['scarcity (vendite)', ids => [{ kind: 'scarcity', id: ids.pici, label: 'lastPortions', value: true }], (p, d, ids) => { expect(item(p, ids.pici)!.scarcity?.lastPortions).toBe(true); expect(item(d, ids.pici)!.scarcity?.lastPortions).toBe(true) }],
  ['rename', ids => [{ kind: 'rename', id: ids.tiramisu, name: 'Tiramisù della nonna' }], (p, d, ids) => { expect(item(p, ids.tiramisu)!.name).toBe('Tiramisù della nonna'); expect(item(d, ids.tiramisu)!.name).toBe('Tiramisù della nonna') }],
  ['move', ids => [{ kind: 'move', id: ids.cacio, sectionId: ids.fresche }], (p, d, ids) => { expect(item(p, ids.cacio)!.sectionId).toBe(ids.fresche); expect(item(d, ids.cacio)!.sectionId).toBe(ids.fresche) }],
  ['delete', ids => [{ kind: 'delete', id: ids.cacio }], (p, d, ids) => { expect(item(p, ids.cacio)).toBeNull(); expect(item(d, ids.cacio)).toBeNull() }],
  ['create_section + create dentro', ids => { const sid = '0a0a0a0a-0a0a-4a0a-8a0a-' + ids.tenant.slice(-12); return [{ kind: 'create_section', newSectionId: sid, name: 'Antipasti', menuId: ids.pranzo }, { kind: 'create', sectionId: sid, name: 'Bruschetta', price: 4, description: null }] }, (p, d) => { const a = byName(p, 'Bruschetta')[0], b = byName(d, 'Bruschetta')[0]; expect(a.id).toBe(b.id); expect(item(p, a.id)!.sectionId).toBe(item(d, b.id)!.sectionId); expect(p.menus[0].sections.map((s: any) => s.name)).toEqual(d.menus[0].sections.map((s: any) => s.name)) }],
  ['create_section figlia', ids => [{ kind: 'create_section', newSectionId: '0b0b0b0b-0b0b-4b0b-8b0b-' + ids.tenant.slice(-12), name: 'Paste secche', menuId: ids.pranzo, parentSectionId: ids.primi }], (p, d) => { expect(p.menus[0].sections.map((s: any) => s.name)).toEqual(d.menus[0].sections.map((s: any) => s.name)) }],
  ['rename_section', ids => [{ kind: 'rename_section', sectionId: ids.primi, name: 'Primi piatti' }], (p, d, ids) => { expect(section(p, ids.primi)!.name).toBe('Primi piatti'); expect(section(d, ids.primi)!.name).toBe('Primi piatti') }],
  ['set_menu_active', ids => [{ kind: 'set_menu_active', menuId: ids.drinks, name: 'Drinks', value: false, items: 1 }], (p, d) => { expect(p.menus[2].active).toBe(false); expect(d.menus[2].active).toBe(false) }],
  ['rename_menu', ids => [{ kind: 'rename_menu', menuId: ids.drinks, name: 'Bevande', before: 'Drinks' }], (p, d) => { expect(p.menus[2].name).toBe('Bevande'); expect(d.menus[2].name).toBe('Bevande') }],
  ['create_menu', ids => [{ kind: 'create_menu', newMenuId: '0c0c0c0c-0c0c-4c0c-8c0c-' + ids.tenant.slice(-12), name: 'Brunch', type: 'main' }], (p, d) => { expect(p.menus.map((m: any) => m.id)).toEqual(d.menus.map((m: any) => m.id)) }],
  ['set_menu_pricing + formula', ids => [{ kind: 'set_menu_pricing', menuId: ids.pranzo, name: 'Pranzo', value: 'fisso' }, { kind: 'set_formula', menuId: ids.pranzo, menuName: 'Pranzo', formulaId: '0d0d0d0d-0d0d-4d0d-8d0d-' + ids.tenant.slice(-12), isNew: true, name: 'Completo', price: 15 }], (p, d) => { expect(p.menus[0].pricing).toBe('fisso'); expect(PEND.jsonEqual(p.menus[0].formulas, d.menus[0].formulas)).toBe(true) }],
  ['delete_section (svuotata prima da un altro turno del bot)', ids => [{ kind: 'delete_section', sectionId: ids.fresche, name: 'Paste fresche' }], (p, d, ids) => { expect(section(p, ids.fresche)).toBeNull(); expect(section(d, ids.fresche)).toBeNull() }],
  ['più azioni insieme', ids => [{ kind: 'price', id: ids.carbonara, price: 11 }, { kind: 'hidden', id: ids.cacio, value: true }, { kind: 'featured', id: ids.pici, value: true }], (p, d, ids) => { for (const doc of [p, d]) { expect(item(doc, ids.carbonara)!.price).toBe(11); expect(item(doc, ids.cacio)!.hidden).toBe(true); expect(item(doc, ids.pici)!.featured).toBe(true) } }],
 ]
 for (const [name, actions, check] of cases) it('azione ' + name, async () => {
  const ids = await fresh()
  await pendingElsewhere(ids)
  if (name.startsWith('delete_section')) await bot(ids.tenant, ids.actor, [{ kind: 'delete', id: ids.pici }])
  const { res } = await bot(ids.tenant, ids.actor, actions(ids), { uploads: new Map([[ids.carbonara, `/uploads/${ids.tenant}/foto.png`]]) })
  const { draft, pub } = await docs(ids.tenant)
  expect(res.partial).toBe(true)
  check(pub, draft, ids)
  expect(item(draft, ids.tagliata)!.price).toBe(30) // 0 perdite di bozza
  expect(item(pub, ids.tagliata)!.price).toBe(16)   // 0 pubblicazioni di bozza altrui
  // «Pubblica» dopo: pubblicato = bozza, nessun duplicato
  await publish(ids.tenant, ids.actor)
  const after = await docs(ids.tenant)
  expect(PEND.pendingOf(after.r)).toBe(false); expect(item(after.pub, ids.tagliata)!.price).toBe(30)
 })
})

describe('conflitti e bordi della fusione', () => {
 it('piatto creato solo in bozza: invisibile al bot, resta in bozza', async () => {
  const ids = await fresh(), mine = U()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[0].items.push({ id: mine, name: 'Solo bozza', price: 3 }) })
  const view = (await B.readBotWorkspace(ids.tenant))!
  expect(item(C.workspaceSchema.parse(view.draft), mine)).toBeNull()
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.cacio, price: 9 }])
  const { draft, pub } = await docs(ids.tenant)
  expect(item(draft, mine)).toBeTruthy(); expect(item(pub, mine)).toBeNull()
 })
 it('il bot elimina un Sottomenu dove la bozza ha aggiunto un piatto: il Sottomenu resta in bozza (mai perdere piatti)', async () => {
  const ids = await fresh(), mine = U()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[1].items.push({ id: mine, name: 'Tagliolini', price: 12 }) })
  await bot(ids.tenant, ids.actor, [{ kind: 'delete', id: ids.pici }])
  const { res } = await bot(ids.tenant, ids.actor, [{ kind: 'delete_section', sectionId: ids.fresche, name: 'Paste fresche' }])
  const { draft, pub } = await docs(ids.tenant)
  expect(section(pub, ids.fresche)).toBeNull(); expect(section(draft, ids.fresche)).toBeTruthy(); expect(item(draft, mine)).toBeTruthy(); expect(item(draft, ids.pici)).toBeNull()
  expect(res.skippedInDraft).toContain('section:' + ids.fresche + ':not-empty-in-draft')
 })
 it('il bot sposta un piatto in un Sottomenu cancellato in bozza: spostato solo nel pubblicato', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections = w.menus[0].sections.filter((s: any) => s.id !== ids.dolci) })
  const { res } = await bot(ids.tenant, ids.actor, [{ kind: 'move', id: ids.cacio, sectionId: ids.dolci }])
  const { draft, pub } = await docs(ids.tenant)
  expect(item(pub, ids.cacio)!.sectionId).toBe(ids.dolci); expect(item(draft, ids.cacio)!.sectionId).toBe(ids.primi)
  expect(res.skippedInDraft).toContain('item:' + ids.cacio + ':move-target-missing')
 })
 it('il bot crea un piatto in un Sottomenu cancellato in bozza: solo nel pubblicato', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections = w.menus[0].sections.filter((s: any) => s.id !== ids.dolci) })
  await bot(ids.tenant, ids.actor, [{ kind: 'create', sectionId: ids.dolci, name: 'Cannolo', price: 4, description: null }])
  const { draft, pub } = await docs(ids.tenant)
  expect(byName(pub, 'Cannolo')).toHaveLength(1); expect(byName(draft, 'Cannolo')).toHaveLength(0)
 })
 it('creato nella posizione giusta anche con la bozza riordinata', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[0].items.reverse() })
  await bot(ids.tenant, ids.actor, [{ kind: 'create', sectionId: ids.primi, name: 'Gricia', price: 9, description: null }])
  const { draft } = await docs(ids.tenant)
  expect(draft.menus[0]!.sections[0]!.items.map(i => i.name)).toEqual(['Cacio e pepe', 'Gricia', 'Amatriciana', 'Carbonara'])
 })
 it('disponibilità dal vivo: un piatto esaurito in cucina resta esaurito nel pubblicato e nella bozza non toccata', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 30 })
  await pg.client`UPDATE menu_items SET available=false WHERE id=${ids.amatriciana}`
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.cacio, price: 9 }])
  const { draft, pub } = await docs(ids.tenant)
  expect(item(pub, ids.amatriciana)!.available).toBe(false); expect(item(draft, ids.amatriciana)!.available).toBe(false)
 })
 it('aritmetica: P\' = P+2, D\' = D+2 con bozza pendente; il valore restituito è P\'-1', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 30 })
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 31 })
  const b = await raw(ids.tenant)
  const { res } = await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.cacio, price: 9 }])
  const a = await raw(ids.tenant)
  expect(a.published_revision).toBe(Number(b.published_revision) + 2); expect(a.revision).toBe(b.revision + 2); expect(res.revision).toBe(Number(a.published_revision) - 1)
  expect(a.revision).not.toBe(a.published_revision)
 })
 it('aritmetica: se dopo il bot bozza = pubblicato, le revisioni si riallineano', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[0].items[2].price = 9 })
  const b = await raw(ids.tenant)
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.cacio, price: 9 }])
  const a = await raw(ids.tenant)
  expect(PEND.pendingOf(a)).toBe(false); expect(a.revision).toBe(b.revision + 2); expect(a.published_revision).toBe(a.revision)
 })
 it('azioni con seme (applyBotChange actions + idSeed): stessi id deterministici', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 30 })
  const view = (await B.readBotWorkspace(ids.tenant))!
  await B.applyBotChange(ids.tenant, ids.actor, ['a', 'b'], { expectedPublishedRevision: view.revision, actions: [{ kind: 'create', sectionId: ids.secondi, name: 'Costata', price: 30, description: null }], idSeed: 'seme-x' })
  const { draft, pub } = await docs(ids.tenant)
  expect(byName(pub, 'Costata')[0].id).toBe(B.seededIds('seme-x')()); expect(byName(draft, 'Costata')[0].id).toBe(byName(pub, 'Costata')[0].id)
 })
 it('interruttore K2 (TAKO_BOT_DRAFT_LEGACY=1): la vista torna la riga vera, così la rotta rifiuta con dashboardPending', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 30 })
  process.env.TAKO_BOT_DRAFT_LEGACY = '1'
  try { const v = (await B.readBotWorkspace(ids.tenant))!; expect(v.revision).not.toBe(v.published_revision) } finally { delete process.env.TAKO_BOT_DRAFT_LEGACY }
  const v2 = (await B.readBotWorkspace(ids.tenant))!; expect(v2.revision).toBe(v2.published_revision)
 })
 it('bot due volte di fila con bozza pendente: la bozza accumula, pubblicato solo il bot', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 30 })
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.cacio, price: 9 }])
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.pici, price: 12 }])
  const { draft, pub } = await docs(ids.tenant)
  expect(item(pub, ids.cacio)!.price).toBe(9); expect(item(pub, ids.pici)!.price).toBe(12); expect(item(pub, ids.tagliata)!.price).toBe(16)
  expect(item(draft, ids.cacio)!.price).toBe(9); expect(item(draft, ids.pici)!.price).toBe(12); expect(item(draft, ids.tagliata)!.price).toBe(30)
 })
})

describe('correzioni revisione 22/10 (lato server)', () => {
 it('punto 2 — «Pubblica preset» dalla dashboard (expectedRevision): pubblica solo il Menu del preset, le bozze degli altri Menu restano', async () => {
  const ids = await fresh()
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' })
  const preset = await P.saveDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 2, sections: [{ id: U(), name: 'Primi', items: [{ id: U(), name: 'Gnocchi', price: 12 }] }] as never })
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 99 })
  const r = await raw(ids.tenant)
  await expect(P.publishDayPreset(ids.tenant, { presetId: preset.id, expectedRevision: r.revision - 1, actor: ids.actor })).rejects.toBeInstanceOf(S.WorkspaceConflict)
  const out = await P.publishDayPreset(ids.tenant, { presetId: preset.id, expectedRevision: r.revision, actor: ids.actor })
  const { r: after, draft, pub } = await docs(ids.tenant)
  expect(byName(pub, 'Gnocchi')).toHaveLength(1); expect(byName(draft, 'Gnocchi')[0].id).toBe(byName(pub, 'Gnocchi')[0].id)
  expect(item(pub, ids.tagliata)!.price).toBe(16) // bozza di Cena NON pubblicata
  expect(item(draft, ids.tagliata)!.price).toBe(99) // e resta in bozza
  expect(out.revision).toBe(after.revision); expect(out.publishedRevision).toBe(Number(after.published_revision))
  expect(Number((await pg.client`SELECT price FROM menu_items WHERE id=${ids.tagliata}`)[0]!.price)).toBe(16)
 })
 it('punto 2 — conflitto sulla revisione della bozza anche sotto lock (expectedDraftRevision)', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 50 })
  const view = (await B.readBotWorkspace(ids.tenant))!, r = await raw(ids.tenant)
  await expect(B.applyBotChange(ids.tenant, ids.actor, ['a', 'b'], { expectedPublishedRevision: view.revision, expectedDraftRevision: r.revision - 1, next: C.workspaceSchema.parse(view.draft) })).rejects.toThrow('Revision conflict')
  expect((await raw(ids.tenant)).revision).toBe(r.revision)
 })
 it('punto 4 — modifica online ma non nella bozza (piatto cancellato in bozza): avviso al titolare', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[0].items = w.menus[0].sections[0].items.filter((i: any) => i.id !== ids.amatriciana) })
  const { res } = await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.amatriciana, price: 11 }])
  expect(res.skippedInDraft).toContain('item:' + ids.amatriciana + ':missing')
  const notices = await pg.client`SELECT kind,menu_id,message FROM menu_owner_notices WHERE restaurant_id=${ids.tenant}`
  expect(notices).toHaveLength(1)
  expect(notices[0]).toMatchObject({ kind: 'draft_discarded', menu_id: ids.pranzo, message: B.SKIPPED_NOTICE })
  expect(B.SKIPPED_NOTICE).not.toMatch(/categori/i)
 })
 it('punto 4 — nessun salto: nessun avviso', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 30 })
  const { res } = await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.cacio, price: 9 }])
  expect(res.skippedInDraft).toEqual([])
  expect(await pg.client`SELECT 1 FROM menu_owner_notices WHERE restaurant_id=${ids.tenant}`).toHaveLength(0)
 })
 it('punto 5 — il bot tocca un campo di design: la bozza tiene manualOrder e gli stili non pubblicati', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.design.manualOrder = true; w.design.font = 'serif'; w.menus[1].sections[0].items[0].price = 30 })
  const view = (await B.readBotWorkspace(ids.tenant))!, next = structuredClone(C.workspaceSchema.parse(view.draft)) as any
  next.design.primary = '#112233'
  await B.applyBotChange(ids.tenant, ids.actor, ['a', 'b'], { expectedPublishedRevision: view.revision, next: C.workspaceSchema.parse(next) })
  const { draft, pub } = await docs(ids.tenant)
  expect(draft.design.primary).toBe('#112233'); expect(draft.design.manualOrder).toBe(true); expect(draft.design.font).toBe('serif')
  expect(pub.design.primary).toBe('#112233'); expect(pub.design.manualOrder).not.toBe(true); expect(pub.design.font).toBe('sans')
 })
 it('punto 5 — fusione per sotto-chiave anche in pdf (unità)', () => {
  const base: any = { menus: [], pdf: { a: 1, b: { x: 1, y: 1 } }, design: { k: 1 } }
  const next: any = { menus: [], pdf: { a: 2, b: { x: 1, y: 1 } }, design: { k: 1 } }
  const draft: any = { menus: [], pdf: { a: 1, b: { x: 9, y: 1 }, c: 3 }, design: { k: 1, manualOrder: true } }
  const out: any = B.mergeBotChange(base, next, draft).draft
  expect(out.pdf).toEqual({ a: 2, b: { x: 9, y: 1 }, c: 3 }); expect(out.design).toEqual({ k: 1, manualOrder: true })
 })
 it('punto 7 — la versione «pubblicata» del bot resta alla revisione della bozza (ordine per revisione di «ripristina menu di prima»)', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 30 })
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.cacio, price: 9 }])
  const a = await raw(ids.tenant)
  const [v] = await pg.client`SELECT revision FROM menu_workspace_versions WHERE restaurant_id=${ids.tenant} AND label='WhatsApp: pubblicazione automatica' ORDER BY created_at DESC LIMIT 1`
  expect(v!.revision).toBe(a.revision); expect(a.revision).toBeGreaterThan(Number(a.published_revision))
 })
})

describe('conflitti bot al Pubblica (notes/A1-server.md)', () => {
 const guarded = async (t: string, actor: string, confirmBotConflicts?: boolean) => { const r = await raw(t); return S.mutateWorkspace(t, actor, r.revision, C.workspaceSchema.parse(r.draft), true, 'Pubblicazione', undefined, { confirmBotConflicts }) }
 it('bozza cancella Y → bot modifica Y: conflitto in bozza (mai nel pubblicato); Pubblica senza conferma bloccato, con conferma pubblica e azzera', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[0].items = w.menus[0].sections[0].items.filter((i: any) => i.id !== ids.amatriciana) })
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.amatriciana, price: 11 }])
  const a = await raw(ids.tenant)
  expect((a.draft as any).botConflicts).toEqual([expect.objectContaining({ kind: 'item', id: ids.amatriciana, name: 'Amatriciana', reason: 'missing' })])
  expect(typeof (a.draft as any).botConflicts[0].at).toBe('string')
  expect((a.published as any).botConflicts).toBeUndefined()
  // un salvataggio della dashboard (documento senza il campo) non lo perde: lo decide il server
  await dash(ids.tenant, ids.actor, w => { delete w.botConflicts; w.menus[1].sections[0].items[0].price = 21 })
  const b = await raw(ids.tenant)
  expect((b.draft as any).botConflicts).toHaveLength(1)
  // senza conferma: 409 lato rotta (WorkspaceBotConflicts), nessuna scrittura
  const err = await guarded(ids.tenant, ids.actor).catch(e => e)
  expect(err).toBeInstanceOf(S.WorkspaceBotConflicts)
  expect(err.conflicts.map((c: any) => c.id)).toEqual([ids.amatriciana]); expect(err.currentRevision).toBe(b.revision)
  const c = await raw(ids.tenant)
  expect(c.revision).toBe(b.revision); expect(item(C.workspaceSchema.parse(c.published), ids.amatriciana)!.price).toBe(11)
  // con conferma: pubblica la bozza, campo azzerato, pubblicato == bozza (senza campo)
  await guarded(ids.tenant, ids.actor, true)
  const { r, draft, pub } = await docs(ids.tenant)
  expect((r.draft as any).botConflicts).toBeUndefined(); expect((r.published as any).botConflicts).toBeUndefined()
  expect(PEND.jsonEqual(r.draft, r.published)).toBe(true); expect(PEND.pendingOf(r)).toBe(false)
  expect(item(pub, ids.amatriciana)).toBeNull(); expect(item(draft, ids.tagliata)!.price).toBe(21)
 })
 it('Scarta azzera i conflitti (bozza = pubblicato)', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections = w.menus[0].sections.filter((s: any) => s.id !== ids.dolci) })
  await bot(ids.tenant, ids.actor, [{ kind: 'rename_section', sectionId: ids.dolci, name: 'Dessert' }])
  const a = await raw(ids.tenant)
  expect((a.draft as any).botConflicts).toEqual([expect.objectContaining({ kind: 'section', id: ids.dolci, name: 'Dessert', reason: 'missing' })])
  await S.discardDraft(ids.tenant, ids.actor, a.revision)
  const r = await raw(ids.tenant)
  expect((r.draft as any).botConflicts).toBeUndefined(); expect(PEND.jsonEqual(r.draft, r.published)).toBe(true)
  expect(section(C.workspaceSchema.parse(r.draft), ids.dolci)!.name).toBe('Dessert')
 })
 it('nessun conflitto: nessun campo, Pubblica senza conferma passa come prima; bot e preset non bloccati', async () => {
  const ids = await fresh()
  await dash(ids.tenant, ids.actor, w => { w.menus[1].sections[0].items[0].price = 30 })
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.cacio, price: 9 }])
  expect('botConflicts' in ((await raw(ids.tenant)).draft as any)).toBe(false)
  await guarded(ids.tenant, ids.actor)
  expect(PEND.pendingOf(await raw(ids.tenant))).toBe(false)
  // con conflitti in bozza il bot continua a pubblicare la sua modifica (nessun blocco)
  await dash(ids.tenant, ids.actor, w => { w.menus[0].sections[0].items = w.menus[0].sections[0].items.filter((i: any) => i.id !== ids.amatriciana) })
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.amatriciana, price: 12 }])
  await bot(ids.tenant, ids.actor, [{ kind: 'price', id: ids.amatriciana, price: 13 }])
  const r = await raw(ids.tenant)
  expect(item(C.workspaceSchema.parse(r.published), ids.amatriciana)!.price).toBe(13)
  expect((r.draft as any).botConflicts).toHaveLength(1) // stesso piatto: voce aggiornata, non duplicata
 })
 it('unità: bozza invalida → voce sull’elemento cambiato; massimo 50, le più recenti', () => {
  const base = C.workspaceSchema.parse({ menus: [{ id: U(), name: 'M', sections: [{ id: U(), name: 'S', items: [{ id: U(), name: 'Pane', price: 1 }] }] }] })
  const next = structuredClone(base); next.menus[0]!.sections[0]!.items[0]!.price = 2
  const out = B.botConflictsFor(['draft:invalid'], base, next, base, '2026-10-22T10:00:00.000Z')
  expect(out).toEqual([{ kind: 'item', id: base.menus[0]!.sections[0]!.items[0]!.id, name: 'Pane', at: '2026-10-22T10:00:00.000Z', reason: 'draft:invalid' }])
  const many = Array.from({ length: 60 }, (_, i) => ({ kind: 'item' as const, id: 'id' + i, name: 'P' + i, at: 'x', reason: 'missing' }))
  const merged = B.mergeBotConflicts(many.slice(0, 30), many.slice(30))
  expect(merged).toHaveLength(50); expect(merged[49]!.id).toBe('id59'); expect(merged[0]!.id).toBe('id10')
  expect(C.workspaceSchema.parse({ menus: [], botConflicts: merged }).botConflicts).toHaveLength(50)
 })
})
