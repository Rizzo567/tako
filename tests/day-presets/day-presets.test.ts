/** F2 — preset settimanali: CRUD, modalità, job delle 06:00 con orologio finto, live, traduzioni, PDF.
 * Postgres locale usa-e-getta (tests/day-presets/local-pg.ts): nessun DB reale, nessuna rete. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { startLocalPg } from './local-pg.js'

let pg: Awaited<ReturnType<typeof startLocalPg>>
let P: typeof import('../../apps/server/src/lib/menu-day-presets.js')
let T: typeof import('../../apps/server/src/lib/menu-text-translations.js')
let S: typeof import('../../apps/server/src/lib/menu-workspace-store.js')
let C: typeof import('../../apps/server/src/lib/menu-workspace-contract.js')

const VICTORIA = '528e263c-634e-4695-9632-6c5cc6a3302f' // locale con PDF caricato a mano (supplied-menu-pdf.ts)
type Ids = { tenant: string; actor: string; pranzo: string; cena: string; drinks: string; carbonara: string; amatriciana: string; tiramisu: string; secPrimi: string }

async function seed(opts: { timezone?: string; id?: string } = {}): Promise<Ids> {
 const sql = pg.client
 const tenant = opts.id ?? randomUUID(), actor = randomUUID()
 await sql`INSERT INTO restaurants(id,name,slug,plan,settings) VALUES(${tenant},'Trattoria Prova',${'prova-' + tenant.slice(0, 8)},'pro',${sql.json(opts.timezone ? { timezone: opts.timezone } : {})})`
 await sql`INSERT INTO users(id,restaurant_id,name,email,role) VALUES(${actor},${tenant},'Titolare',${actor + '@test.local'},'owner')`
 const ids = { tenant, actor, pranzo: randomUUID(), cena: randomUUID(), drinks: randomUUID(), carbonara: randomUUID(), amatriciana: randomUUID(), tiramisu: randomUUID(), secPrimi: randomUUID() }
 const w = C.workspaceSchema.parse({ languages: ['it', 'en', 'de'], menus: [
  { id: ids.pranzo, name: 'Pranzo', type: 'lunch', sections: [
   { id: ids.secPrimi, name: 'Primi', items: [
    { id: ids.carbonara, name: 'Carbonara', description: 'Guanciale e pecorino', price: 10, allergens: ['glutine', 'uova'], tags: ['locale'], featured: true, priceDisplay: null, variants: [{ id: randomUUID(), name: 'Grande', priceModifier: 2 }], translations: { en: { name: 'Carbonara', description: 'Guanciale and pecorino' } } },
    { id: ids.amatriciana, name: 'Amatriciana', price: 9 }] },
   { id: randomUUID(), name: 'Dolci', items: [{ id: ids.tiramisu, name: 'Tiramisù', price: 5 }] }] },
  { id: ids.cena, name: 'Cena', type: 'dinner', sections: [{ id: randomUUID(), name: 'Secondi', items: [{ id: randomUUID(), name: 'Tagliata', price: 16 }] }] },
  { id: ids.drinks, name: 'Drinks', type: 'drinks', sections: [{ id: randomUUID(), name: 'Vini', items: [{ id: randomUUID(), name: 'Rosso della casa', price: 4 }] }] }] })
 await sql`INSERT INTO menu_workspaces(restaurant_id,draft,published,revision,published_revision) VALUES(${tenant},${sql.json(w)},${sql.json(w)},1,1)`
 await S.mutateWorkspace(tenant, actor, 1, w, false, 'Seed')
 await S.mutateWorkspace(tenant, actor, 2, w, true, 'Seed')
 return ids
}
const published = async (tenant: string) => (await S.readWorkspace(tenant))!
const publishedMenu = async (tenant: string, menuId: string) => C.workspaceSchema.parse((await published(tenant)).published).menus.find(m => m.id === menuId)!
const names = (menu: { sections: { items: { name: string }[] }[] }) => menu.sections.flatMap(s => s.items.map(i => i.name))
const broadcasts = async (tenant: string) => Number((await pg.client`SELECT count(*) n FROM realtime.sent WHERE topic=${'menu-live:' + tenant}`)[0]!.n)
const section = (name: string, items: { name: string; price: number; description?: string }[]) => ({ id: randomUUID(), name, items: items.map(i => ({ id: randomUUID(), ...i })) })
const at = (iso: string) => new Date(iso)

beforeAll(async () => {
 pg = await startLocalPg(55471)
 process.env.DATABASE_URL = pg.url
 P = await import('../../apps/server/src/lib/menu-day-presets.js')
 T = await import('../../apps/server/src/lib/menu-text-translations.js')
 S = await import('../../apps/server/src/lib/menu-workspace-store.js')
 C = await import('../../apps/server/src/lib/menu-workspace-contract.js')
}, 60000)
afterAll(async () => { try { const { db } = await import('../../packages/db/src/client.js'); await (db as unknown as { $client: { end: (o: object) => Promise<void> } }).$client.end({ timeout: 1 }) } catch { /* già chiuso */ } await pg?.stop() })

describe('giorno di servizio (06:00 nel fuso del locale)', () => {
 it('cambia giornata alle 06:00, non a mezzanotte; ora legale e fusi diversi', () => {
  expect(P.serviceDay(at('2026-10-19T22:30:00Z'), 'Europe/Rome')).toMatchObject({ date: '2026-10-19', weekday: 1 }) // 00:30 di martedì: ancora lunedì
  expect(P.serviceDay(at('2026-10-20T03:59:00Z'), 'Europe/Rome')).toMatchObject({ date: '2026-10-19', weekday: 1 }) // 05:59
  expect(P.serviceDay(at('2026-10-20T04:00:00Z'), 'Europe/Rome')).toMatchObject({ date: '2026-10-20', weekday: 2 }) // 06:00
  expect(P.serviceDay(at('2026-10-25T04:59:00Z'), 'Europe/Rome')).toMatchObject({ date: '2026-10-24', weekday: 6 }) // 05:59 dopo il cambio dell'ora
  expect(P.serviceDay(at('2026-10-25T05:00:00Z'), 'Europe/Rome')).toMatchObject({ date: '2026-10-25', weekday: 7 })
  expect(P.serviceDay(at('2026-10-20T08:00:00Z'), 'America/New_York')).toMatchObject({ date: '2026-10-19', weekday: 1 }) // 04:00 a New York
  expect(P.serviceDay(at('2026-10-20T10:00:00Z'), 'America/New_York')).toMatchObject({ date: '2026-10-20', weekday: 2 })
  expect(P.restaurantTimezone({})).toBe('Europe/Rome')
  expect(P.restaurantTimezone({ timezone: 'Marte/Olympus' })).toBe('Europe/Rome')
  expect(P.restaurantTimezone({ timezone: 'Asia/Tokyo' })).toBe('Asia/Tokyo')
 })
})

describe('CRUD preset e modalità', () => {
 it('attiva i 7 giorni come copia del menu attuale, crea/copia/rinomina/elimina, rifiuta revisioni vecchie', async () => {
  const ids = await seed()
  const list = await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' }, { actor: ids.actor })
  expect(list.presets.map(p => [p.weekday, p.name, p.itemCount])).toEqual([[1, 'Lunedì', 3], [2, 'Martedì', 3], [3, 'Mercoledì', 3], [4, 'Giovedì', 3], [5, 'Venerdì', 3], [6, 'Sabato', 3], [7, 'Domenica', 3]])
  expect(list.settings).toMatchObject([{ menuId: ids.pranzo, enabled: true, autoPublish: false }])
  const monday = (await P.readDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 1 }))!
  // Copia generica del documento piatto: tutti i campi viaggiano (allergeni, etichette, evidenza, varianti, traduzioni).
  const carb = monday.sections!.flatMap(s => s.items).find(i => i.name === 'Carbonara')!
  expect(carb).toMatchObject({ id: ids.carbonara, allergens: ['glutine', 'uova'], tags: ['locale'], featured: true, translations: { en: { name: 'Carbonara' } } })
  expect(carb.variants).toHaveLength(1)
  const empty = await P.createDayPreset(ids.tenant, { menuId: ids.pranzo, name: 'Evento', source: { kind: 'empty' } })
  expect(empty).toMatchObject({ weekday: null, itemCount: 0, position: 8 })
  const pesce = await P.createDayPreset(ids.tenant, { menuId: ids.pranzo, name: 'Venerdì pesce', source: { kind: 'preset', fromPresetId: monday.id } })
  expect(pesce.itemCount).toBe(3)
  expect((await P.renameDayPreset(ids.tenant, pesce.id, '  Venerdì di pesce ')).name).toBe('Venerdì di pesce')
  const edited = await P.updateDayPreset(ids.tenant, pesce.id, { sections: [section('Pesce', [{ name: 'Branzino', price: 18 }])] as never, expectedRevision: 2 })
  expect(edited).toMatchObject({ revision: 3, itemCount: 1 })
  await expect(P.updateDayPreset(ids.tenant, pesce.id, { name: 'X', expectedRevision: 2 })).rejects.toMatchObject({ code: 'CONFLICT' })
  await expect(P.renameDayPreset(ids.tenant, pesce.id, '   ')).rejects.toMatchObject({ code: 'INVALID' })
  await expect(P.deleteDayPreset(ids.tenant, empty.id)).resolves.toEqual({ deleted: true })
  await expect(P.deleteDayPreset(ids.tenant, empty.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(P.activateDayPresets(ids.tenant, ids.drinks, { kind: 'empty' })).rejects.toMatchObject({ code: 'DRINKS' })
  // Isolamento: un altro locale non vede né tocca questi preset.
  const other = await seed()
  expect(await P.readDayPreset(other.tenant, { presetId: monday.id })).toBeNull()
  await expect(P.deleteDayPreset(other.tenant, monday.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  // La pubblicazione non è cambiata: creare e modificare preset non tocca il menu online.
  expect((await published(ids.tenant)).published_revision).toBe(3)
 })

 it('attiva vuoti oppure copia i giorni da un altro menu con id nuovi', async () => {
  const ids = await seed()
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' })
  await P.saveDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 3, sections: [section('Primi', [{ name: 'Gricia', price: 9 }])] as never })
  const cena = await P.activateDayPresets(ids.tenant, ids.cena, { kind: 'menu', fromMenuId: ids.pranzo })
  expect(cena.presets.filter(p => p.menuId === ids.cena)).toHaveLength(7)
  const wed = (await P.readDayPreset(ids.tenant, { menuId: ids.cena, weekday: 3 }))!
  expect(names({ sections: wed.sections! })).toEqual(['Gricia'])
  const pranzoWed = (await P.readDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 3 }))!
  expect(wed.sections![0]!.items[0]!.id).not.toBe(pranzoWed.sections![0]!.items[0]!.id)
  const other = await seed()
  const vuoti = await P.activateDayPresets(other.tenant, other.pranzo, { kind: 'empty' })
  expect(vuoti.presets.every(p => p.itemCount === 0)).toBe(true)
 })

 it('menu unico ⇄ settimanale senza perdere i preset; spegnere spegne anche l’automatico', async () => {
  const ids = await seed()
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' })
  await P.saveDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 2, sections: [section('Primi', [{ name: 'Cacio e pepe', price: 10 }])] as never })
  await P.setDayPresetAutoPublish(ids.tenant, ids.pranzo, true, { now: at('2026-10-19T10:00:00Z') })
  const before = (await P.listDayPresets(ids.tenant, { menuId: ids.pranzo })).presets
  expect(await P.setDayPresetsEnabled(ids.tenant, ids.pranzo, false)).toMatchObject({ enabled: false, autoPublish: false })
  expect((await P.listDayPresets(ids.tenant, { menuId: ids.pranzo })).presets).toEqual(before)
  await expect(P.setDayPresetAutoPublish(ids.tenant, ids.pranzo, true)).rejects.toMatchObject({ code: 'INVALID' })
  // Riattivare non ricrea niente: i preset (anche Martedì modificato) sono quelli di prima.
  const again = await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'empty' })
  expect(again.presets).toEqual(before)
  expect(names({ sections: (await P.readDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 2 }))!.sections! })).toEqual(['Cacio e pepe'])
  expect(names(await publishedMenu(ids.tenant, ids.pranzo))).toEqual(['Carbonara', 'Amatriciana', 'Tiramisù'])
 })
})

describe('job delle 06:00 con orologio finto', () => {
 it('pubblica il preset del giorno una volta sola, via mutateWorkspace (tabelle + live), e salta i giorni vuoti con avviso', async () => {
  const ids = await seed()
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' })
  for (const [weekday, dish] of [[2, 'Martedì special'], [3, 'Mercoledì special'], [4, 'Giovedì special']] as const)
   await P.saveDayPreset(ids.tenant, { menuId: ids.pranzo, weekday, sections: [section('Primi', [{ name: dish, price: 11, description: 'Del giorno' }]), section('Dolci', [{ name: 'Tiramisù', price: 5 }])] as never })
  await P.saveDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 6, sections: [] })
  const sunday = (await P.readDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 7 }))!
  await P.deleteDayPreset(ids.tenant, sunday.id)
  // Acceso lunedì alle 17: niente cambio sotto gli occhi, si parte dal prossimo cambio giornata.
  expect((await P.setDayPresetAutoPublish(ids.tenant, ids.pranzo, true, { now: at('2026-10-19T15:00:00Z') })).autoFromDay).toBe('2026-10-20')
  const mine = (o: { restaurantId: string }[]) => o.filter(x => x.restaurantId === ids.tenant)
  expect(mine(await P.runDayPresetAutopublish({ now: at('2026-10-19T15:05:00Z') }))).toMatchObject([{ status: 'not_yet' }])
  expect(mine(await P.runDayPresetAutopublish({ now: at('2026-10-20T03:59:00Z') }))).toMatchObject([{ status: 'not_yet', serviceDay: '2026-10-19' }]) // 05:59 di martedì
  const live0 = await broadcasts(ids.tenant), rev0 = (await published(ids.tenant)).published_revision!
  // 06:00 di martedì: va online Martedì.
  expect(mine(await P.runDayPresetAutopublish({ now: at('2026-10-20T04:00:00Z') }))).toMatchObject([{ status: 'published', serviceDay: '2026-10-20' }])
  const tue = await publishedMenu(ids.tenant, ids.pranzo)
  expect(names(tue)).toEqual(['Martedì special', 'Tiramisù'])
  expect((await published(ids.tenant)).published_revision).toBe(rev0 + 2)
  expect(await broadcasts(ids.tenant)).toBeGreaterThan(live0) // il live del compito 2 scatta da solo
  const items = await pg.client`SELECT name,available FROM menu_items WHERE restaurant_id=${ids.tenant} AND available ORDER BY name`
  expect(items.map(i => i.name)).toEqual(['Martedì special', 'Rosso della casa', 'Tagliata', 'Tiramisù']) // gli altri menu restano
  expect((await P.readDayPresetSettings(ids.tenant, ids.pranzo)).onlinePresetId).toBe((await P.readDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 2 }))!.id)
  // Idempotente: rieseguito, nessuna nuova pubblicazione.
  expect(mine(await P.runDayPresetAutopublish({ now: at('2026-10-20T04:05:00Z') }))).toMatchObject([{ status: 'already_done' }])
  expect((await published(ids.tenant)).published_revision).toBe(rev0 + 2)
  // Due esecuzioni in parallelo mercoledì: una pubblica, l'altra trova il giorno già prenotato.
  const parallel = (await Promise.all([P.runDayPresetAutopublish({ now: at('2026-10-21T04:01:00Z') }), P.runDayPresetAutopublish({ now: at('2026-10-21T04:01:00Z') })])).flatMap(mine)
  expect(parallel.map(o => o.status).sort()).toEqual(['already_done', 'published'])
  expect(names(await publishedMenu(ids.tenant, ids.pranzo))).toEqual(['Mercoledì special', 'Tiramisù'])
  // Recupero dopo un fermo: giovedì il job riparte alle 14 e pubblica comunque Giovedì.
  expect(mine(await P.runDayPresetAutopublish({ now: at('2026-10-22T12:00:00Z') }))).toMatchObject([{ status: 'published', serviceDay: '2026-10-22' }])
  // Venerdì è la copia del menu attuale; sabato è vuoto; domenica non c'è.
  await P.runDayPresetAutopublish({ now: at('2026-10-23T04:00:00Z') })
  expect(names(await publishedMenu(ids.tenant, ids.pranzo))).toEqual(['Carbonara', 'Amatriciana', 'Tiramisù'])
  const revFri = (await published(ids.tenant)).published_revision
  expect(mine(await P.runDayPresetAutopublish({ now: at('2026-10-24T04:00:00Z') }))).toMatchObject([{ status: 'skipped_empty' }])
  expect(mine(await P.runDayPresetAutopublish({ now: at('2026-10-25T05:00:00Z') }))).toMatchObject([{ status: 'skipped_missing', serviceDay: '2026-10-25' }])
  expect((await published(ids.tenant)).published_revision).toBe(revFri) // resta il menu attuale
  expect(names(await publishedMenu(ids.tenant, ids.pranzo))).toEqual(['Carbonara', 'Amatriciana', 'Tiramisù'])
  const notices = await P.listOwnerNotices(ids.tenant)
  expect(notices.map(n => n.kind).sort()).toEqual(['preset_empty', 'preset_missing'])
  expect(notices.find(n => n.kind === 'preset_missing')!.message).toBe('Oggi (domenica 25/10) il Pranzo non ha un preset: resta online il menu attuale.')
  // L'avviso non si ripete per lo stesso giorno e si può segnare come letto.
  await P.runDayPresetAutopublish({ now: at('2026-10-25T05:30:00Z') })
  expect(await P.listOwnerNotices(ids.tenant)).toHaveLength(2)
  await P.markOwnerNoticeRead(ids.tenant, notices[0]!.id)
  expect(await P.listOwnerNotices(ids.tenant)).toHaveLength(1)
  // Spento l'interruttore, il job non tocca più il menu.
  await P.setDayPresetAutoPublish(ids.tenant, ids.pranzo, false)
  expect(mine(await P.runDayPresetAutopublish({ now: at('2026-10-27T04:00:00Z') }))).toEqual([])
 })

 it('bozza non pubblicata sul menu del preset alle 06:00: va persa, ma resta una versione recuperabile e un avviso', async () => {
  const ids = await seed()
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' })
  await P.saveDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 2, sections: [section('Primi', [{ name: 'Gnocchi', price: 12 }])] as never })
  await P.setDayPresetAutoPublish(ids.tenant, ids.pranzo, true, { now: at('2026-10-19T10:00:00Z') })
  const row = await published(ids.tenant), draft = C.workspaceSchema.parse(row.draft)
  // dashboard editor 22/10: il preset tocca SOLO il suo Menu; la bozza va salvata come versione solo se riguarda quel Menu
  // (bozza su un altro Menu = resta intatta: tests/bot-partial-publish.test.ts scenario 9).
  draft.menus.find(m => m.id === ids.pranzo)!.sections[0]!.items[0]!.price = 99 // modifica non pubblicata sul menu del preset
  await S.mutateWorkspace(ids.tenant, ids.actor, row.revision, draft, false, 'Bozza titolare')
  const [result] = (await P.runDayPresetAutopublish({ now: at('2026-10-20T04:00:00Z') })).filter(o => o.restaurantId === ids.tenant)
  expect(result).toMatchObject({ status: 'published' })
  const after = await published(ids.tenant)
  expect(after.revision).toBe(after.published_revision)
  expect(C.workspaceSchema.parse(after.draft).menus.find(m => m.id === ids.pranzo)!.sections[0]!.items[0]!.name).toBe('Gnocchi')
  const run = (await pg.client`SELECT discarded_draft_version_id FROM menu_day_preset_runs WHERE restaurant_id=${ids.tenant}`)[0]!
  const version = (await pg.client`SELECT label,snapshot FROM menu_workspace_versions WHERE id=${run.discarded_draft_version_id}`)[0]!
  expect(version.label).toBe('Bozza non pubblicata, sostituita dal preset «Martedì» alle 06:00')
  expect(C.workspaceSchema.parse(version.snapshot).menus.find(m => m.id === ids.pranzo)!.sections[0]!.items[0]!.price).toBe(99)
  expect((await P.listOwnerNotices(ids.tenant)).map(n => n.kind)).toEqual(['draft_discarded'])
 })

 it('un piatto esaurito ieri torna disponibile col preset del nuovo giorno; il fuso del locale decide l’ora', async () => {
  const ids = await seed({ timezone: 'America/New_York' })
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' })
  await P.setDayPresetAutoPublish(ids.tenant, ids.pranzo, true, { now: at('2026-10-19T15:00:00Z') })
  await pg.client`UPDATE menu_items SET available=false WHERE id=${ids.carbonara}` // «carbonara finita» lunedì
  const mine = (o: { restaurantId: string }[]) => o.filter(x => x.restaurantId === ids.tenant)
  expect(mine(await P.runDayPresetAutopublish({ now: at('2026-10-20T04:00:00Z') }))).toMatchObject([{ status: 'not_yet', serviceDay: '2026-10-19' }]) // 00:00 a New York
  expect(mine(await P.runDayPresetAutopublish({ now: at('2026-10-20T10:00:00Z') }))).toMatchObject([{ status: 'published', serviceDay: '2026-10-20' }]) // 06:00 a New York
  expect((await pg.client`SELECT available FROM menu_items WHERE id=${ids.carbonara}`)[0]!.available).toBe(true)
 })
})

describe('pubblicazione manuale e preset di oggi', () => {
 it('modificare il preset online non cambia il pubblico finché il titolare non dà l’OK; poi sì (con live)', async () => {
  const ids = await seed()
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' })
  const today = (await P.readDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 2 }))!
  const r0 = await published(ids.tenant)
  await P.publishDayPreset(ids.tenant, { presetId: today.id, expectedRevision: r0.revision, actor: ids.actor })
  const sections = structuredClone(today.sections!)
  sections[0]!.items[0]!.price = 11
  await P.updateDayPreset(ids.tenant, today.id, { sections, expectedRevision: today.revision })
  expect((await publishedMenu(ids.tenant, ids.pranzo)).sections[0]!.items[0]!.price).toBe(10) // non ancora
  const r1 = await published(ids.tenant), live = await broadcasts(ids.tenant)
  await expect(P.publishDayPreset(ids.tenant, { presetId: today.id, expectedRevision: r1.revision - 1 })).rejects.toBeInstanceOf(S.WorkspaceConflict)
  const out = await P.publishDayPreset(ids.tenant, { presetId: today.id, expectedRevision: r1.revision, actor: ids.actor })
  expect(out.revision).toBe(r1.revision + 2)
  expect((await publishedMenu(ids.tenant, ids.pranzo)).sections[0]!.items[0]!.price).toBe(11)
  expect(await broadcasts(ids.tenant)).toBeGreaterThan(live)
  const versions = await pg.client`SELECT label FROM menu_workspace_versions WHERE restaurant_id=${ids.tenant} ORDER BY created_at DESC LIMIT 1`
  expect(versions[0]!.label).toBe('Preset «Martedì» online')
  // Un preset vuoto non si pubblica a mano: non svuota mai il menu online.
  const empty = await P.createDayPreset(ids.tenant, { menuId: ids.pranzo, name: 'Vuoto', source: { kind: 'empty' } })
  await expect(P.publishDayPreset(ids.tenant, { presetId: empty.id })).rejects.toMatchObject({ code: 'EMPTY' })
 })

 it('il PDF (generato da published) segue il preset; locale con PDF caricato a mano: resta il suo + avviso', async () => {
  const ids = await seed({ id: VICTORIA })
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'empty' })
  const p = await P.saveDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 1, sections: [section('Primi', [{ name: 'Pappardelle al cinghiale', price: 14 }])] as never })
  await P.publishDayPreset(ids.tenant, { presetId: p.id })
  const { renderWorkspacePdf } = await import('../../apps/server/src/lib/menu-workspace-pdf.js')
  const bytes = await renderWorkspacePdf(C.workspaceSchema.parse((await published(ids.tenant)).published), [ids.pranzo], 'it', 'Prova', ids.tenant)
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise
  const text = (await (await doc.getPage(1)).getTextContent()).items.map(i => ('str' in i ? i.str : '')).join(' ')
  expect(text).toContain('Pappardelle al cinghiale')
  expect(text).not.toContain('Carbonara')
  expect((await P.listOwnerNotices(ids.tenant)).map(n => n.kind)).toEqual(['supplied_pdf'])
 })
})

describe('traduzioni: tutte le lingue, una volta sola per testo', () => {
 it('accoda solo i testi mai visti, riusa la cache nei preset e non ritraduce mai', async () => {
  const ids = await seed()
  const sent: { lang: string; texts: string[] }[] = []
  const provider = async (lang: string, rows: { id: string; name: string }[]) => { sent.push({ lang, texts: rows.map(r => r.name) }); return { translations: rows.map(r => ({ id: r.id, name: `[${lang}] ${r.name}` })) } }
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' })
  const mon = await P.saveDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 1, sections: [section('Primi', [{ name: 'Carbonara', price: 10, description: 'Guanciale e pecorino' }, { name: 'Pici cacio e pepe', price: 11 }])] as never })
  await P.publishDayPreset(ids.tenant, { presetId: mon.id })
  const queued = await pg.client`SELECT text_key,lang,source,status FROM menu_text_translations WHERE restaurant_id=${ids.tenant} ORDER BY source,lang`
  const pending = queued.filter(r => r.status === 'pending')
  // «Carbonara» e la sua descrizione in inglese erano già nel documento: in cache come fatte, mai in coda per l'inglese.
  expect(queued.filter(r => r.source === 'Carbonara' && r.lang === 'en')).toMatchObject([{ status: 'done' }])
  expect(new Set(pending.map(r => r.source))).toEqual(new Set(['Carbonara', 'Guanciale e pecorino', 'Pici cacio e pepe', 'Primi']))
  expect(pending.filter(r => r.source === 'Pici cacio e pepe')).toHaveLength(11) // tutte le lingue tranne l'italiano
  expect(pending.some(r => r.source === 'Carbonara' && r.lang === 'en')).toBe(false)
  // Finché mancano, il pubblico mostra l'italiano: la pubblicazione non ha aspettato nessuno.
  const before = (await publishedMenu(ids.tenant, ids.pranzo)).sections[0]!.items.find(i => i.name === 'Pici cacio e pepe')!
  expect(before.translations.fr).toBeUndefined()
  await pg.client`UPDATE menu_text_translations SET status='failed' WHERE restaurant_id<>${ids.tenant} AND status='pending'` // la coda è globale: isola questo locale
  let result = await T.processTranslationQueue({ provider, maxCalls: 20 })
  expect(result.calls).toBe(11)
  expect(sent.every(s => s.texts.length === new Set(s.texts).size)).toBe(true)
  const pici = (await publishedMenu(ids.tenant, ids.pranzo)).sections[0]!.items.find(i => i.name === 'Pici cacio e pepe')!
  expect(pici.translations.fr).toMatchObject({ name: '[fr] Pici cacio e pepe' })
  expect((await publishedMenu(ids.tenant, ids.pranzo)).sections[0]!.items.find(i => i.name === 'Carbonara')!.translations.en).toMatchObject({ name: 'Carbonara' }) // la traduzione esistente resta
  // Lo stesso piatto torna mercoledì in un altro preset: nessun testo nuovo, nessuna chiamata.
  const wed = await P.saveDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 3, sections: [section('Primi', [{ name: 'Pici cacio e pepe', price: 12 }])] as never })
  sent.length = 0
  await P.publishDayPreset(ids.tenant, { presetId: wed.id })
  expect(await T.enqueueNewTextTranslations(ids.tenant, ['Pici cacio e pepe', ' pici  CACIO e pepe '])).toEqual({ enqueued: 0, known: 11 })
  result = await T.processTranslationQueue({ provider, maxCalls: 20 })
  expect(result.calls).toBe(0)
  expect(sent).toEqual([])
  // Tradotto subito al momento della pubblicazione dalla cache, senza aspettare il job.
  expect((await publishedMenu(ids.tenant, ids.pranzo)).sections[0]!.items[0]!.translations.de).toMatchObject({ name: '[de] Pici cacio e pepe' })
  // Nome cambiato: si traduce solo il testo nuovo, una volta.
  expect(await T.enqueueNewTextTranslations(ids.tenant, ['Pici cacio e pepe al tartufo', 'Guanciale e pecorino'])).toEqual({ enqueued: 11, known: 11 })
  // Interfaccia per F1: firma (restaurantId, texts).
  expect(T.enqueueNewTextTranslations.length).toBeGreaterThanOrEqual(2)
 })

 it('errori del traduttore: tre tentativi poi resta l’italiano, nessun ciclo infinito', async () => {
  const ids = await seed()
  await T.enqueueNewTextTranslations(ids.tenant, ['Zuppa del giorno'], { languages: ['en'] })
  const broken = async () => { throw new Error('quota') }
  for (let i = 0; i < 3; i++) await T.processTranslationQueue({ provider: broken, maxCalls: 50 })
  expect((await pg.client`SELECT status,attempts FROM menu_text_translations WHERE restaurant_id=${ids.tenant}`)[0]).toMatchObject({ status: 'failed', attempts: 3 })
  expect((await T.processTranslationQueue({ provider: broken, maxCalls: 50 })).calls).toBe(0)
 })
})

describe('chiave Groq dedicata alle traduzioni', () => {
 it('usa solo TAKO_CANDIDATE_GROQ_TRANSLATION_API_KEY o il file locale; mai la chiave del bot', async () => {
  const { translationGroqKey } = await import('../../apps/server/src/lib/menu-workspace-translate.js')
  const noFile = () => { throw new Error('ENOENT') }
  expect(translationGroqKey({ TAKO_CANDIDATE_GROQ_TRANSLATION_API_KEY: ' tr-key ' }, noFile)).toBe('tr-key')
  expect(translationGroqKey({ GROQ_API_KEY: 'bot', TAKO_CANDIDATE_GROQ_API_KEY: 'bot' }, noFile)).toBeNull()
  expect(translationGroqKey({ GROQ_API_KEY: 'bot' }, () => 'file-key\n')).toBe('file-key')
  expect(translationGroqKey({ TAKO_EXECUTION_RUNTIME: 'edge', GROQ_API_KEY: 'bot' }, () => 'file-key')).toBeNull()
 })
 it('senza chiave dedicata la coda non chiama nessun modello e resta in attesa', async () => {
  const saved = { ...process.env }
  process.env.TAKO_EXECUTION_RUNTIME = 'edge'; delete process.env.TAKO_CANDIDATE_GROQ_TRANSLATION_API_KEY; process.env.GROQ_API_KEY = 'chiave-del-bot'
  try {
   const ids = await seed()
   await T.enqueueNewTextTranslations(ids.tenant, ['Polpette al sugo'], { languages: ['en'] })
   expect(await T.processTranslationQueue({ maxCalls: 50 })).toMatchObject({ calls: 0, skipped: 'TRANSLATION_KEY_MISSING' })
   expect((await pg.client`SELECT status,attempts FROM menu_text_translations WHERE restaurant_id=${ids.tenant}`)[0]).toMatchObject({ status: 'pending', attempts: 0 })
  } finally { process.env = saved }
 })
})

describe('comandi dei preset in chat (bot del titolare, 16/10 sera)', () => {
 it('«cosa c\'è martedì a pranzo?», «metti online il menu di martedì» + OK, «attiva/disattiva la pubblicazione automatica del pranzo»', async () => {
  await pg.client.unsafe(`CREATE TABLE IF NOT EXISTS tako_whatsapp_proposals(phone text PRIMARY KEY,restaurant_id uuid,actor_id uuid,revision int,command jsonb,expires_at timestamptz)`)
  const { presetChatCommand } = await import('../../apps/server/src/lib/menu-preset-target.js')
  const { db } = await import('../../packages/db/src/client.js')
  const ids = await seed(), ctx = { tenant: ids.tenant, actor: ids.actor, phone: 'whatsapp:+390000000001' }
  expect(await presetChatCommand(db as never, ctx, 'cosa c\'è martedì a pranzo?')).toContain('preset')
  await P.activateDayPresets(ids.tenant, ids.pranzo, { kind: 'current' }, { actor: ids.actor })
  const tuesday = (await P.readDayPreset(ids.tenant, { menuId: ids.pranzo, weekday: 2 }))!
  await P.updateDayPreset(ids.tenant, tuesday.id, { sections: [section('Primi', [{ name: 'Gnocchi al pesto', price: 11 }])] })
  expect(await presetChatCommand(db as never, ctx, 'cosa c\'è martedì a pranzo?')).toContain('Gnocchi al pesto: 11,00 €')
  expect(await presetChatCommand(db as never, ctx, 'la carbonara costa 12')).toBeNull()
  expect(await presetChatCommand(db as never, ctx, 'ok')).toBeNull() // nessuna proposta preset in attesa
  const ask = await presetChatCommand(db as never, ctx, 'metti online il menu di martedì')
  expect(ask).toContain('Martedì · Pranzo'); expect(ask).toContain('*OK*')
  expect(names(await publishedMenu(ids.tenant, ids.pranzo))).not.toContain('Gnocchi al pesto') // regola dell'OK: niente prima della conferma
  expect(await presetChatCommand(db as never, ctx, 'ok va bene conferma')).toContain('*Confermato.*')
  expect(names(await publishedMenu(ids.tenant, ids.pranzo))).toEqual(['Gnocchi al pesto'])
  expect(await presetChatCommand(db as never, ctx, 'attiva la pubblicazione automatica del pranzo')).toContain('*attiva*')
  expect((await P.readDayPresetSettings(ids.tenant, ids.pranzo)).autoPublish).toBe(true)
  expect(await presetChatCommand(db as never, ctx, 'disattiva la pubblicazione automatica del pranzo')).toContain('*spenta*')
  expect((await P.readDayPresetSettings(ids.tenant, ids.pranzo)).autoPublish).toBe(false)
  expect(await presetChatCommand(db as never, ctx, 'metti online il menu di martedì a cena')).toContain('non ha un preset')
 }, 30000)
})
