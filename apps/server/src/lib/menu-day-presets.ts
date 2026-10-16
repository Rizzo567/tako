/** F2 — Preset settimanali per menu (16/10/2026).
 * Un preset è il contenuto salvato di UN menu del documento (categorie e piatti copiati per intero).
 * Il contenuto online resta solo nel documento (menu_workspaces): pubblicare un preset copia le sue
 * sezioni nel menu e passa da mutateWorkspace(publish), quindi tabelle del menu, versioni, PDF
 * (generato da `published`) e trigger live restano allineati. Nessuna seconda fonte di verità.
 * Funzioni esportate e documentate per F1 (bot) in docs/webapp/feature-vendita-2026-10-16/contracts.md. */
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, type DB } from '@tako/db'
import { workspaceSchema, type Workspace } from './menu-workspace-contract.js'
import { mutateWorkspace, readWorkspace, WorkspaceConflict } from './menu-workspace-store.js'
import { enqueueNewTextTranslations, readTranslationCache, fillTranslationsFromCache, seedTranslationCache, sectionEntities, allLanguages, workspaceTexts, SYSTEM_ACTOR } from './menu-text-translations.js'
import { hasSuppliedMenuPdf } from './supplied-menu-pdf.js'

type Conn = Pick<DB,'execute'>
export type Weekday = 1|2|3|4|5|6|7
export type PresetSections = Workspace['menus'][number]['sections']
/** Stesso schema delle sezioni del documento: tutti i campi del piatto (anche quelli futuri, es. promo) entrano nel preset. */
export const presetSectionsSchema = workspaceSchema.innerType().shape.menus.element.shape.sections
export const presetContentSchema = z.object({ sections: presetSectionsSchema })
export type DayPreset = { id: string; restaurantId: string; menuId: string; name: string; weekday: Weekday | null; position: number; revision: number; itemCount: number; updatedAt: string; sections?: PresetSections }
export type DayPresetSettings = { menuId: string; enabled: boolean; autoPublish: boolean; autoFromDay: string | null; onlinePresetId: string | null; onlineAt: string | null }
export class DayPresetError extends Error { constructor(readonly code: 'NOT_FOUND'|'INVALID'|'CONFLICT'|'EMPTY'|'DRINKS', message: string) { super(message) } }

export const SERVICE_DAY_START_HOUR = 6
export const DEFAULT_TIMEZONE = 'Europe/Rome'
export const WEEKDAY_NAMES: Record<Weekday, string> = { 1: 'Lunedì', 2: 'Martedì', 3: 'Mercoledì', 4: 'Giovedì', 5: 'Venerdì', 6: 'Sabato', 7: 'Domenica' }
const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]

/** Fuso del locale (restaurants.settings.timezone), ripiego Europe/Rome come il bot. */
export function restaurantTimezone(settings: unknown): string {
 const tz = (settings as { timezone?: unknown } | null)?.timezone
 if (typeof tz === 'string' && tz) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz } catch { /* ripiego */ } }
 return DEFAULT_TIMEZONE
}
/** Giorno di servizio nel fuso del locale: la giornata cambia alle 06:00, non a mezzanotte
 * (chi resta dopo le 00 vede ancora il menu della sera). */
export function serviceDay(now: Date, timezone: string): { date: string; weekday: Weekday; local: string } {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]))
 const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)))
 if (Number(parts.hour) < SERVICE_DAY_START_HOUR) day.setUTCDate(day.getUTCDate() - 1)
 const weekday = (((day.getUTCDay() + 6) % 7) + 1) as Weekday
 return { date: day.toISOString().slice(0, 10), weekday, local: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}` }
}
const nextDay = (date: string) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }
const itemCount = (sections: PresetSections) => sections.reduce((n, s) => n + s.items.length, 0)
const rowToPreset = (r: Record<string, unknown>, withContent: boolean): DayPreset => {
 const sections = presetContentSchema.parse(r.content ?? { sections: [] }).sections
 return { id: String(r.id), restaurantId: String(r.restaurant_id), menuId: String(r.menu_id), name: String(r.name), weekday: r.weekday == null ? null : Number(r.weekday) as Weekday, position: Number(r.position), revision: Number(r.revision), itemCount: itemCount(sections), updatedAt: new Date(String(r.updated_at)).toISOString(), ...(withContent ? { sections } : {}) }
}
const rowToSettings = (r: Record<string, unknown>): DayPresetSettings => ({ menuId: String(r.menu_id), enabled: !!r.enabled, autoPublish: !!r.auto_publish, autoFromDay: r.auto_from_day ? String(r.auto_from_day).slice(0, 10) : null, onlinePresetId: r.online_preset_id ? String(r.online_preset_id) : null, onlineAt: r.online_at ? new Date(String(r.online_at)).toISOString() : null })

/** Copia con id nuovi (sezioni, piatti, varianti) e riferimenti alle sottocategorie riallineati. */
export function freshIds(sections: PresetSections): PresetSections {
 const copy = structuredClone(sections), map = new Map<string, string>()
 for (const s of copy) { const id = randomUUID(); map.set(s.id, id); s.id = id; for (const i of s.items) { i.id = randomUUID(); for (const v of i.variants) v.id = randomUUID() } }
 for (const s of copy) if (s.parentSectionId) s.parentSectionId = map.get(s.parentSectionId) ?? null
 return copy
}
/** Le sezioni del preset entrano nel menu del documento: gli id già usati da ALTRI menu (o ripetuti) cambiano,
 * gli altri restano (stesso piatto = stesso id = stesse righe menu_items, foto e traduzioni). */
export function materializePresetSections(workspace: Workspace, menuId: string, sections: PresetSections): PresetSections {
 const used = new Set<string>()
 for (const m of workspace.menus) if (m.id !== menuId) { used.add(m.id); for (const s of m.sections) { used.add(s.id); for (const i of s.items) { used.add(i.id); for (const v of i.variants) used.add(v.id) } } }
 used.add(menuId)
 const copy = structuredClone(sections), remap = new Map<string, string>()
 const take = (id: string) => { if (!used.has(id)) { used.add(id); return id } const next = randomUUID(); used.add(next); return next }
 for (const s of copy) { const id = take(s.id); if (id !== s.id) remap.set(s.id, id); s.id = id; for (const i of s.items) { i.id = take(i.id); for (const v of i.variants) v.id = take(v.id) } }
 for (const s of copy) if (s.parentSectionId && remap.has(s.parentSectionId)) s.parentSectionId = remap.get(s.parentSectionId)!
 return copy
}

async function workspaceOf(tenant: string, connection: Conn) {
 const row = await readWorkspace(tenant, connection)
 if (!row) throw new DayPresetError('NOT_FOUND', 'Menu del locale non trovato')
 return row
}
function menuOf(workspace: Workspace, menuId: string) {
 const menu = workspace.menus.find(m => m.id === menuId)
 if (!menu) throw new DayPresetError('NOT_FOUND', 'Menu non trovato')
 return menu
}

export async function readDayPresetSettings(restaurantId: string, menuId: string, connection: Conn = db): Promise<DayPresetSettings> {
 const rows = await connection.execute(sql`SELECT * FROM menu_day_preset_settings WHERE restaurant_id=${restaurantId} AND menu_id=${menuId}`)
 return rows[0] ? rowToSettings(rows[0] as Record<string, unknown>) : { menuId, enabled: false, autoPublish: false, autoFromDay: null, onlinePresetId: null, onlineAt: null }
}
/** Elenco per la dashboard e per il bot: impostazioni di ogni menu, preset (senza contenuto), giorno di servizio. */
export async function listDayPresets(restaurantId: string, options: { menuId?: string; now?: Date; connection?: Conn } = {}) {
 const connection = options.connection ?? db
 const presets = await connection.execute(sql`SELECT * FROM menu_day_presets WHERE restaurant_id=${restaurantId} AND (${options.menuId ?? null}::uuid IS NULL OR menu_id=${options.menuId ?? null}::uuid) ORDER BY menu_id,weekday NULLS LAST,position,created_at`)
 const settings = await connection.execute(sql`SELECT * FROM menu_day_preset_settings WHERE restaurant_id=${restaurantId} AND (${options.menuId ?? null}::uuid IS NULL OR menu_id=${options.menuId ?? null}::uuid)`)
 const restaurant = await connection.execute(sql`SELECT settings FROM restaurants WHERE id=${restaurantId}`)
 const timezone = restaurantTimezone(restaurant[0]?.settings)
 return { timezone, serviceDay: serviceDay(options.now ?? new Date(), timezone), settings: (settings as unknown as Record<string, unknown>[]).map(rowToSettings), presets: (presets as unknown as Record<string, unknown>[]).map(r => rowToPreset(r, false)) }
}
/** Lettura di un preset con il contenuto: per id, per giorno della settimana o per nome (senza maiuscole/accenti). */
export async function readDayPreset(restaurantId: string, target: { presetId: string } | { menuId: string; weekday: Weekday } | { menuId: string; name: string }, connection: Conn = db): Promise<DayPreset | null> {
 let rows
 if ('presetId' in target) rows = await connection.execute(sql`SELECT * FROM menu_day_presets WHERE restaurant_id=${restaurantId} AND id=${target.presetId}`)
 else if ('weekday' in target) rows = await connection.execute(sql`SELECT * FROM menu_day_presets WHERE restaurant_id=${restaurantId} AND menu_id=${target.menuId} AND weekday=${target.weekday}`)
 else { const all = await connection.execute(sql`SELECT * FROM menu_day_presets WHERE restaurant_id=${restaurantId} AND menu_id=${target.menuId} ORDER BY weekday NULLS LAST,position`); const key = simpleName(target.name); rows = (all as unknown as Record<string, unknown>[]).filter(r => simpleName(String(r.name)) === key) }
 return rows[0] ? rowToPreset(rows[0] as Record<string, unknown>, true) : null
}
const simpleName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('it').replace(/\s+/g, ' ').trim()

async function insertPreset(connection: Conn, p: { id?: string; restaurantId: string; menuId: string; name: string; weekday: Weekday | null; position: number; sections: PresetSections; actor?: string | null }) {
 const sections = presetSectionsSchema.parse(p.sections)
 const rows = await connection.execute(sql`INSERT INTO menu_day_presets(id,restaurant_id,menu_id,name,weekday,position,content,created_by) VALUES(${p.id ?? randomUUID()},${p.restaurantId},${p.menuId},${p.name.trim().slice(0, 100)},${p.weekday},${p.position},${JSON.stringify({ sections })}::jsonb,${p.actor ?? null}) RETURNING *`)
 return rowToPreset(rows[0] as Record<string, unknown>, true)
}
async function upsertSettings(connection: Conn, restaurantId: string, menuId: string, patch: { enabled?: boolean; autoPublish?: boolean; autoFromDay?: string | null }) {
 await connection.execute(sql`INSERT INTO menu_day_preset_settings(restaurant_id,menu_id,enabled,auto_publish,auto_from_day) VALUES(${restaurantId},${menuId},${patch.enabled ?? false},${patch.autoPublish ?? false},${patch.autoFromDay ?? null}) ON CONFLICT(restaurant_id,menu_id) DO UPDATE SET enabled=coalesce(${patch.enabled ?? null}::boolean,menu_day_preset_settings.enabled),auto_publish=coalesce(${patch.autoPublish ?? null}::boolean,menu_day_preset_settings.auto_publish),auto_from_day=CASE WHEN ${patch.autoFromDay !== undefined} THEN ${patch.autoFromDay ?? null}::date ELSE menu_day_preset_settings.auto_from_day END,updated_at=now()`)
}

export type ActivationSource = { kind: 'empty' } | { kind: 'current' } | { kind: 'menu'; fromMenuId: string }
/** «Attiva i preset per <Menu>»: crea i 7 giorni (vuoti / copia del menu attuale / copia dei giorni di un altro menu)
 * oppure, se i preset ci sono già, li riaccende senza toccarli. Drinks escluso. */
export async function activateDayPresets(restaurantId: string, menuId: string, source: ActivationSource, options: { actor?: string | null; connection?: DB } = {}) {
 const connection = options.connection ?? db
 const row = await workspaceOf(restaurantId, connection)
 const menu = menuOf(row.draft, menuId)
 if (menu.type === 'drinks') throw new DayPresetError('DRINKS', 'I preset non sono previsti per il menu Drinks')
 return connection.transaction(async tx => {
  const existing = await tx.execute(sql`SELECT id FROM menu_day_presets WHERE restaurant_id=${restaurantId} AND menu_id=${menuId} LIMIT 1`)
  if (!existing.length) {
   let fromMenu: Map<number, PresetSections> | null = null
   if (source.kind === 'menu') {
    const others = await tx.execute(sql`SELECT weekday,content FROM menu_day_presets WHERE restaurant_id=${restaurantId} AND menu_id=${source.fromMenuId} AND weekday IS NOT NULL`)
    if (!others.length) throw new DayPresetError('NOT_FOUND', 'L’altro menu non ha preset da copiare')
    fromMenu = new Map((others as unknown as { weekday: number; content: unknown }[]).map(o => [Number(o.weekday), presetContentSchema.parse(o.content).sections]))
   }
   for (const weekday of WEEKDAYS) {
    // Copia del menu attuale: stessi id (stesso piatto, stesse traduzioni). Copia da un altro menu: id nuovi.
    const sections = source.kind === 'current' ? structuredClone(menu.sections) : source.kind === 'menu' ? freshIds(fromMenu!.get(weekday) ?? []) : []
    await insertPreset(tx, { restaurantId, menuId, name: WEEKDAY_NAMES[weekday], weekday, position: weekday, sections, actor: options.actor })
   }
  }
  await upsertSettings(tx, restaurantId, menuId, { enabled: true })
  return listDayPresets(restaurantId, { menuId, connection: tx })
 })
}
/** Modalità menu unico ⇄ settimanale. Spegnere NON cancella i preset; spegne anche l'automatico. */
export async function setDayPresetsEnabled(restaurantId: string, menuId: string, enabled: boolean, connection: Conn = db) {
 await upsertSettings(connection, restaurantId, menuId, enabled ? { enabled: true } : { enabled: false, autoPublish: false })
 return readDayPresetSettings(restaurantId, menuId, connection)
}
/** Interruttore «Pubblica in automatico» (dashboard e chat). Acceso a metà giornata, la prima pubblicazione
 * automatica è al prossimo cambio giornata delle 06:00: il menu online non cambia sotto gli occhi del titolare. */
export async function setDayPresetAutoPublish(restaurantId: string, menuId: string, enabled: boolean, options: { now?: Date; connection?: Conn } = {}) {
 const connection = options.connection ?? db
 const settings = await readDayPresetSettings(restaurantId, menuId, connection)
 if (enabled && !settings.enabled) throw new DayPresetError('INVALID', 'Attiva prima i preset per questo menu')
 const restaurant = await connection.execute(sql`SELECT settings FROM restaurants WHERE id=${restaurantId}`)
 const today = serviceDay(options.now ?? new Date(), restaurantTimezone(restaurant[0]?.settings)).date
 await upsertSettings(connection, restaurantId, menuId, enabled ? { autoPublish: true, autoFromDay: nextDay(today) } : { autoPublish: false })
 return readDayPresetSettings(restaurantId, menuId, connection)
}

export type CreateSource = { kind: 'empty' } | { kind: 'current' } | { kind: 'preset'; fromPresetId: string }
/** Nuovo preset con nome libero («Venerdì pesce»), vuoto / copia del menu attuale / copia di un altro preset. */
export async function createDayPreset(restaurantId: string, input: { menuId: string; name: string; source: CreateSource; weekday?: Weekday | null; actor?: string | null }, connection: Conn = db) {
 const name = input.name.trim()
 if (!name || name.length > 100) throw new DayPresetError('INVALID', 'Nome del preset non valido')
 const row = await workspaceOf(restaurantId, connection)
 const menu = menuOf(row.draft, input.menuId)
 if (menu.type === 'drinks') throw new DayPresetError('DRINKS', 'I preset non sono previsti per il menu Drinks')
 let sections: PresetSections = []
 if (input.source.kind === 'current') sections = structuredClone(menu.sections)
 if (input.source.kind === 'preset') { const from = await readDayPreset(restaurantId, { presetId: input.source.fromPresetId }, connection); if (!from) throw new DayPresetError('NOT_FOUND', 'Preset da copiare non trovato'); sections = from.menuId === input.menuId ? structuredClone(from.sections!) : freshIds(from.sections!) }
 const position = Number((await connection.execute(sql`SELECT coalesce(max(position),7)+1 AS p FROM menu_day_presets WHERE restaurant_id=${restaurantId} AND menu_id=${input.menuId}`))[0]?.p ?? 8)
 try { return await insertPreset(connection, { restaurantId, menuId: input.menuId, name, weekday: input.weekday ?? null, position, sections, actor: input.actor }) }
 catch (e) { if (/menu_day_presets_weekday/.test(String((e as Error)?.message) + String((e as { cause?: Error }).cause?.message))) throw new DayPresetError('CONFLICT', 'Esiste già un preset per quel giorno'); throw e }
}
/** Salva il contenuto e/o il nome. Con `expectedRevision` rifiuta le scritture su una versione vecchia (409). */
export async function updateDayPreset(restaurantId: string, presetId: string, patch: { name?: string; sections?: PresetSections; expectedRevision?: number }, connection: Conn = db) {
 const name = patch.name?.trim()
 if (patch.name !== undefined && (!name || name.length > 100)) throw new DayPresetError('INVALID', 'Nome del preset non valido')
 const content = patch.sections ? JSON.stringify({ sections: presetSectionsSchema.parse(patch.sections) }) : null
 const rows = await connection.execute(sql`UPDATE menu_day_presets SET name=coalesce(${name ?? null},name),content=coalesce(${content}::jsonb,content),revision=revision+1,updated_at=now() WHERE restaurant_id=${restaurantId} AND id=${presetId} AND (${patch.expectedRevision ?? null}::int IS NULL OR revision=${patch.expectedRevision ?? null}::int) RETURNING *`)
 if (!rows[0]) {
  const exists = await connection.execute(sql`SELECT revision FROM menu_day_presets WHERE restaurant_id=${restaurantId} AND id=${presetId}`)
  throw exists.length ? new DayPresetError('CONFLICT', 'Il preset è cambiato: ricarica prima di salvare') : new DayPresetError('NOT_FOUND', 'Preset non trovato')
 }
 return rowToPreset(rows[0] as Record<string, unknown>, true)
}
export const renameDayPreset = (restaurantId: string, presetId: string, name: string, connection: Conn = db) => updateDayPreset(restaurantId, presetId, { name }, connection)
/** Elimina un preset (la conferma la chiede l'interfaccia). Il menu online non cambia. */
export async function deleteDayPreset(restaurantId: string, presetId: string, connection: Conn = db) {
 const rows = await connection.execute(sql`DELETE FROM menu_day_presets WHERE restaurant_id=${restaurantId} AND id=${presetId} RETURNING id`)
 if (!rows.length) throw new DayPresetError('NOT_FOUND', 'Preset non trovato')
 return { deleted: true }
}
/** Per F1 (bot, «menu di lunedì: …»): salva il contenuto nel preset del giorno o con quel nome, creandolo se manca.
 * Non pubblica: per mettere online serve publishDayPreset dopo l'OK del titolare. */
export async function saveDayPreset(restaurantId: string, input: { menuId: string; sections: PresetSections; presetId?: string; weekday?: Weekday; name?: string; actor?: string | null }, connection: DB = db) {
 return connection.transaction(async tx => {
  const existing = input.presetId ? await readDayPreset(restaurantId, { presetId: input.presetId }, tx) : input.weekday ? await readDayPreset(restaurantId, { menuId: input.menuId, weekday: input.weekday }, tx) : input.name ? await readDayPreset(restaurantId, { menuId: input.menuId, name: input.name }, tx) : null
  if (input.presetId && !existing) throw new DayPresetError('NOT_FOUND', 'Preset non trovato')
  if (existing && existing.menuId !== input.menuId) throw new DayPresetError('INVALID', 'Il preset appartiene a un altro menu')
  const preset = existing ? await updateDayPreset(restaurantId, existing.id, { sections: input.sections }, tx) : await createDayPreset(restaurantId, { menuId: input.menuId, name: input.name ?? (input.weekday ? WEEKDAY_NAMES[input.weekday] : 'Preset'), weekday: input.weekday ?? null, source: { kind: 'empty' }, actor: input.actor }, tx).then(p => updateDayPreset(restaurantId, p.id, { sections: input.sections }, tx))
  const settings = await readDayPresetSettings(restaurantId, input.menuId, tx)
  if (!settings.enabled) await upsertSettings(tx, restaurantId, input.menuId, { enabled: true })
  return preset
 })
}

export type PublishResult = { revision: number; presetId: string; menuId: string; discardedDraftVersionId: string | null; notices: string[] }
/** Mette online un preset. `manual` (dashboard «Pubblica questo preset adesso», chat «metti online…»): parte dalla
 * bozza come ogni «Pubblica» e richiede la revisione vista dal titolare. `auto` (job delle 06:00): parte dal
 * pubblicato, una bozza pendente va persa ma viene salvata come versione recuperabile; le disponibilità della
 * giornata ripartono dal preset. Sempre via mutateWorkspace(publish): tabelle, versioni, PDF e live allineati. */
export async function publishDayPreset(restaurantId: string, input: { presetId: string; mode?: 'manual' | 'auto'; expectedRevision?: number; actor?: string | null; serviceDayLabel?: string }, connection: DB = db): Promise<PublishResult> {
 const mode = input.mode ?? 'manual'
 const preset = await readDayPreset(restaurantId, { presetId: input.presetId }, connection)
 if (!preset) throw new DayPresetError('NOT_FOUND', 'Preset non trovato')
 if (!preset.itemCount) throw new DayPresetError('EMPTY', `Il preset «${preset.name}» è vuoto: resta online il menu attuale`)
 const row = await workspaceOf(restaurantId, connection)
 if (input.expectedRevision !== undefined && input.expectedRevision !== row.revision) throw new WorkspaceConflict('Revision conflict')
 const pending = row.published_revision !== row.revision
 const base = workspaceSchema.parse(mode === 'auto' ? (row.published ?? row.draft) : row.draft)
 const menu = menuOf(base, preset.menuId)
 // Traduzioni: quelle già nel documento entrano in cache (mai ritradotte), quelle in cache completano il preset.
 await seedTranslationCache(restaurantId, workspaceSchema.parse(row.draft), connection)
 if (row.published) await seedTranslationCache(restaurantId, workspaceSchema.parse(row.published), connection)
 const sections = materializePresetSections(base, preset.menuId, preset.sections!)
 const languages = allLanguages(base)
 fillTranslationsFromCache(sectionEntities(sections), languages, await readTranslationCache(restaurantId, workspaceTexts(sectionEntities(sections)), connection))
 menu.sections = sections
 const next = workspaceSchema.parse(base)
 const actor = input.actor || SYSTEM_ACTOR
 const label = `Preset «${preset.name}» online${mode === 'auto' ? ` (automatico${input.serviceDayLabel ? ' ' + input.serviceDayLabel : ''})` : ''}`
 const notices: string[] = []
 const result = await connection.transaction(async tx => {
  const t = tx as unknown as DB
  let discarded: string | null = null
  if (mode === 'auto' && pending) {
   discarded = randomUUID()
   await tx.execute(sql`INSERT INTO menu_workspace_versions(id,restaurant_id,revision,label,snapshot,created_by) VALUES(${discarded},${restaurantId},${row.revision},${`Bozza non pubblicata, sostituita dal preset «${preset.name}» alle 06:00`},${JSON.stringify(row.draft)}::jsonb,${null})`)
  }
  if (mode === 'auto') {
   const ids = sections.flatMap(s => s.items.map(i => ({ id: i.id, available: i.available })))
   if (ids.length) await tx.execute(sql`UPDATE menu_items m SET available=x.available FROM jsonb_to_recordset(${JSON.stringify(ids)}::jsonb) AS x(id uuid,available boolean) WHERE m.restaurant_id=${restaurantId} AND m.id=x.id AND m.available IS DISTINCT FROM x.available`)
  }
  await mutateWorkspace(restaurantId, actor, row.revision, next, false, label, t)
  const published = await mutateWorkspace(restaurantId, actor, row.revision + 1, next, true, label, t)
  await tx.execute(sql`INSERT INTO menu_day_preset_settings(restaurant_id,menu_id,enabled,online_preset_id,online_at) VALUES(${restaurantId},${preset.menuId},true,${preset.id},now()) ON CONFLICT(restaurant_id,menu_id) DO UPDATE SET online_preset_id=excluded.online_preset_id,online_at=excluded.online_at,updated_at=now()`)
  return { revision: published.revision, discarded }
 })
 if (result.discarded) notices.push(await addOwnerNotice(connection, { restaurantId, kind: 'draft_discarded', menuId: preset.menuId, serviceDay: input.serviceDayLabel ?? null, message: `Alle 06:00 è andato online il preset «${preset.name}»: la bozza non pubblicata è stata sostituita. La trovi in Storico versioni.` }))
 if (hasSuppliedMenuPdf(restaurantId)) notices.push(await addOwnerNotice(connection, { restaurantId, kind: 'supplied_pdf', menuId: preset.menuId, serviceDay: input.serviceDayLabel ?? new Date().toISOString().slice(0, 10), message: 'Il PDF del locale è quello caricato a mano: non segue il preset. Il menu digitale e il QR sono aggiornati.' }))
 // Le traduzioni dei testi mai visti partono in coda e non bloccano: finché mancano si mostra l'italiano.
 await enqueueNewTextTranslations(restaurantId, workspaceTexts(sectionEntities(sections)), { sourceLanguage: next.defaultLanguage, languages, connection }).catch(() => undefined)
 return { revision: result.revision, presetId: preset.id, menuId: preset.menuId, discardedDraftVersionId: result.discarded, notices: notices.filter(Boolean) }
}

export type NoticeKind = 'preset_missing' | 'preset_empty' | 'preset_failed' | 'draft_discarded' | 'supplied_pdf'
export type OwnerNotice = { id: string; kind: NoticeKind; menuId: string | null; serviceDay: string | null; message: string; createdAt: string }
/** Avviso al titolare, una volta per tipo, menu e giorno. */
export async function addOwnerNotice(connection: Conn, n: { restaurantId: string; kind: NoticeKind; menuId: string | null; serviceDay: string | null; message: string }): Promise<string> {
 const rows = await connection.execute(sql`INSERT INTO menu_owner_notices(id,restaurant_id,kind,menu_id,service_day,message) VALUES(${randomUUID()},${n.restaurantId},${n.kind},${n.menuId},${n.serviceDay}::date,${n.message.slice(0, 500)}) ON CONFLICT DO NOTHING RETURNING id`)
 return rows[0] ? String(rows[0].id) : ''
}
export async function listOwnerNotices(restaurantId: string, connection: Conn = db): Promise<OwnerNotice[]> {
 const rows = await connection.execute(sql`SELECT id,kind,menu_id,service_day,message,created_at FROM menu_owner_notices WHERE restaurant_id=${restaurantId} AND read_at IS NULL ORDER BY created_at DESC LIMIT 20`)
 return (rows as unknown as Record<string, unknown>[]).map(r => ({ id: String(r.id), kind: r.kind as NoticeKind, menuId: r.menu_id ? String(r.menu_id) : null, serviceDay: r.service_day ? String(r.service_day).slice(0, 10) : null, message: String(r.message), createdAt: new Date(String(r.created_at)).toISOString() }))
}
export async function markOwnerNoticeRead(restaurantId: string, noticeId: string, connection: Conn = db) {
 const rows = await connection.execute(sql`UPDATE menu_owner_notices SET read_at=now() WHERE restaurant_id=${restaurantId} AND id=${noticeId} AND read_at IS NULL RETURNING id`)
 return { read: rows.length > 0 }
}

export type AutopublishOutcome = { restaurantId: string; menuId: string; serviceDay: string; status: 'published' | 'skipped_missing' | 'skipped_empty' | 'error' | 'already_done' | 'not_yet'; presetId?: string; detail?: string }
/** Job idempotente delle 06:00 (si chiama ogni pochi minuti). Per ogni menu con preset e automatico accesi calcola il
 * giorno di servizio nel fuso del locale; la riga in menu_day_preset_runs fa da prenotazione atomica, quindi due
 * esecuzioni in parallelo o ripetute pubblicano una volta sola. Giorno senza preset o vuoto: resta il menu attuale + avviso.
 * Un errore resta riprovabile fino a 3 tentativi. Recupera da solo ritardi e riavvii (pubblica il giorno corrente). */
export async function runDayPresetAutopublish(options: { now?: Date; connection?: DB; notify?: (notice: { restaurantId: string; kind: NoticeKind; message: string }) => Promise<void> | void } = {}): Promise<AutopublishOutcome[]> {
 const connection = options.connection ?? db, now = options.now ?? new Date()
 const candidates = await connection.execute(sql`SELECT s.restaurant_id,s.menu_id,s.auto_from_day,r.settings FROM menu_day_preset_settings s JOIN restaurants r ON r.id=s.restaurant_id WHERE s.enabled AND s.auto_publish AND r.active ORDER BY s.restaurant_id,s.menu_id`) as unknown as { restaurant_id: string; menu_id: string; auto_from_day: string | Date | null; settings: unknown }[]
 const out: AutopublishOutcome[] = []
 for (const c of candidates) {
  const day = serviceDay(now, restaurantTimezone(c.settings))
  const base = { restaurantId: c.restaurant_id, menuId: c.menu_id, serviceDay: day.date }
  const from = c.auto_from_day ? (c.auto_from_day instanceof Date ? c.auto_from_day.toISOString() : String(c.auto_from_day)).slice(0, 10) : null
  if (from && day.date < from) { out.push({ ...base, status: 'not_yet' }); continue }
  const claim = await connection.execute(sql`INSERT INTO menu_day_preset_runs(restaurant_id,menu_id,service_day,status) VALUES(${c.restaurant_id},${c.menu_id},${day.date}::date,'running') ON CONFLICT(restaurant_id,menu_id,service_day) DO UPDATE SET status='running',attempts=menu_day_preset_runs.attempts+1,updated_at=now() WHERE (menu_day_preset_runs.status='error' AND menu_day_preset_runs.attempts<3) OR (menu_day_preset_runs.status='running' AND menu_day_preset_runs.updated_at<now()-interval '10 minutes') RETURNING attempts`)
  if (!claim.length) { out.push({ ...base, status: 'already_done' }); continue }
  const finish = (status: string, extra: { presetId?: string | null; revision?: number | null; discarded?: string | null; detail?: string | null } = {}) => connection.execute(sql`UPDATE menu_day_preset_runs SET status=${status},preset_id=${extra.presetId ?? null},revision=${extra.revision ?? null},discarded_draft_version_id=${extra.discarded ?? null},detail=${extra.detail?.slice(0, 500) ?? null},updated_at=now() WHERE restaurant_id=${c.restaurant_id} AND menu_id=${c.menu_id} AND service_day=${day.date}::date`)
  const warn = async (kind: NoticeKind, message: string) => { const id = await addOwnerNotice(connection, { restaurantId: c.restaurant_id, kind, menuId: c.menu_id, serviceDay: day.date, message }); if (id) await options.notify?.({ restaurantId: c.restaurant_id, kind, message }) }
  try {
   const row = await readWorkspace(c.restaurant_id, connection)
   const menuName = row?.draft.menus.find(m => m.id === c.menu_id)?.name ?? 'menu'
   const dayLabel = `${WEEKDAY_NAMES[day.weekday].toLocaleLowerCase('it')} ${day.date.slice(8, 10)}/${day.date.slice(5, 7)}`
   const preset = await readDayPreset(c.restaurant_id, { menuId: c.menu_id, weekday: day.weekday }, connection)
   if (!preset) { await finish('skipped_missing'); await warn('preset_missing', `Oggi (${dayLabel}) il ${menuName} non ha un preset: resta online il menu attuale.`); out.push({ ...base, status: 'skipped_missing' }); continue }
   if (!preset.itemCount) { await finish('skipped_empty', { presetId: preset.id }); await warn('preset_empty', `Il preset «${preset.name}» del ${menuName} è vuoto: resta online il menu attuale.`); out.push({ ...base, status: 'skipped_empty', presetId: preset.id }); continue }
   const result = await publishDayPreset(c.restaurant_id, { presetId: preset.id, mode: 'auto', serviceDayLabel: day.date }, connection)
   await finish('published', { presetId: preset.id, revision: result.revision, discarded: result.discardedDraftVersionId })
   out.push({ ...base, status: 'published', presetId: preset.id })
  } catch (e) {
   const detail = e instanceof Error ? e.message : String(e)
   await finish('error', { detail })
   const attempts = Number(claim[0]?.attempts ?? 1)
   if (attempts >= 3) await warn('preset_failed', 'Il preset di oggi non è andato online per un errore: resta il menu attuale. Puoi pubblicarlo a mano dalla dashboard.')
   out.push({ ...base, status: 'error', detail })
  }
 }
 return out
}
