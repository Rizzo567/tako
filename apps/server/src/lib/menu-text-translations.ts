/** Cache traduzioni per testo normalizzato e lingua (F2, 16/10/2026).
 * Regola di Manuel: tutte le lingue, ma SOLO la prima volta che compare un testo nuovo.
 * Un testo già in cache (tradotto o in coda) non viene mai rimesso in coda né ritradotto,
 * anche quando torna in un altro preset o in un altro giorno. Le traduzioni non bloccano
 * la pubblicazione: finché mancano, il menu pubblico mostra l'italiano. */
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db, type DB } from '@tako/db'
import { z } from 'zod'
import { workspaceSchema, type Workspace } from './menu-workspace-contract.js'
import { COMMON_MENU_LANGUAGES } from './menu-workspace-languages.js'
import { translationFingerprint, groqTranslationProvider, translationGroqKey, type TranslationProvider } from './menu-workspace-translate.js'
import { mutateWorkspace, readWorkspace, WorkspaceConflict } from './menu-workspace-store.js'
import { applyBotChange } from './menu-workspace-bot.js'
import { pendingOf } from './menu-workspace-pending.js'

type Conn = Pick<DB,'execute'>
const LANGUAGE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/

/** Forma canonica del testo: NFC, spazi compressi, minuscole (it). «Carbonara » e «carbonara» sono lo stesso testo. */
export function normalizeMenuText(text: string): string {
 return text.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('it')
}
export function menuTextKey(text: string): string {
 return createHash('sha256').update(normalizeMenuText(text)).digest('hex')
}
/** Lingue di destinazione: tutte le lingue comuni del prodotto tranne quella originale. */
export function targetLanguages(sourceLanguage = 'it', languages: readonly string[] = COMMON_MENU_LANGUAGES): string[] {
 return [...new Set(languages)].filter(l => LANGUAGE.test(l) && l !== sourceLanguage)
}
/** Tutte le lingue: quelle comuni del prodotto più quelle già abilitate nel documento, meno l'originale. */
export function allLanguages(workspace: Pick<Workspace, 'languages' | 'defaultLanguage'>): string[] {
 return targetLanguages(workspace.defaultLanguage, [...COMMON_MENU_LANGUAGES, ...workspace.languages])
}
/** Testi traducibili di un contenuto: nomi e descrizioni di menu, categorie e piatti. */
export function workspaceTexts(entities: Iterable<{ name: string; description?: string | null }>): string[] {
 const out: string[] = []
 for (const e of entities) { if (e.name?.trim()) out.push(e.name); if (e.description?.trim()) out.push(e.description) }
 return out
}
export function sectionEntities(sections: Workspace['menus'][number]['sections']) {
 return sections.flatMap(s => [s, ...s.items])
}
function uniqueTexts(texts: Iterable<string>) {
 const map = new Map<string, string>()
 for (const raw of texts) { if (typeof raw !== 'string') continue; const text = raw.normalize('NFC').replace(/\s+/g, ' ').trim(); if (!text || text.length > 4000) continue; const key = menuTextKey(text); if (!map.has(key)) map.set(key, text) }
 return map
}

/** Interfaccia condivisa con F1 (bot): mette in coda SOLO i testi mai visti per questo locale, in tutte le lingue.
 * Ritorna quante coppie testo×lingua sono state accodate e quante erano già note (mai ritradotte). */
export async function enqueueNewTextTranslations(restaurantId: string, texts: Iterable<string>, options: { languages?: string[]; sourceLanguage?: string; connection?: Conn } = {}): Promise<{ enqueued: number; known: number }> {
 const connection = options.connection ?? db
 const languages = options.languages ?? targetLanguages(options.sourceLanguage ?? 'it')
 const unique = uniqueTexts(texts)
 if (!unique.size || !languages.length) return { enqueued: 0, known: 0 }
 const rows = [...unique].flatMap(([key, source]) => languages.map(lang => ({ key, lang, source })))
 let enqueued = 0
 for (let i = 0; i < rows.length; i += 500) {
  const batch = JSON.stringify(rows.slice(i, i + 500))
  const inserted = await connection.execute(sql`INSERT INTO menu_text_translations(restaurant_id,text_key,lang,source) SELECT ${restaurantId}::uuid,r.key,r.lang,r.source FROM jsonb_to_recordset(${batch}::jsonb) AS r(key text,lang text,source text) ON CONFLICT(restaurant_id,text_key,lang) DO NOTHING RETURNING text_key`)
  enqueued += inserted.length
 }
 return { enqueued, known: rows.length - enqueued }
}

/** Le traduzioni già presenti nel documento (dashboard, onboarding) entrano in cache come «done»:
 * così non vengono mai ritradotte. Si prende solo una traduzione che corrisponde al testo attuale. */
export async function seedTranslationCache(restaurantId: string, workspace: Workspace, connection: Conn = db): Promise<number> {
 const rows: { key: string; lang: string; source: string; translation: string }[] = []
 const seen = new Set<string>()
 const add = (source: string | null | undefined, lang: string, translation: string | undefined) => {
  if (!source?.trim() || !translation?.trim() || !LANGUAGE.test(lang) || lang === workspace.defaultLanguage) return
  const key = menuTextKey(source); if (seen.has(key + lang)) return; seen.add(key + lang)
  rows.push({ key, lang, source: source.trim().slice(0, 4000), translation: translation.trim().slice(0, 4000) })
 }
 for (const m of workspace.menus) for (const e of [m, ...sectionEntities(m.sections)]) {
  const fingerprint = translationFingerprint(e)
  for (const [lang, t] of Object.entries(e.translations ?? {})) {
   if (t.sourceFingerprint && t.sourceFingerprint !== fingerprint) continue // traduzione di un testo vecchio
   add(e.name, lang, t.name); add(e.description, lang, t.description)
  }
 }
 let inserted = 0
 for (let i = 0; i < rows.length; i += 500) {
  const batch = JSON.stringify(rows.slice(i, i + 500))
  // Una traduzione esistente nel documento completa anche una voce ancora in coda.
  inserted += (await connection.execute(sql`INSERT INTO menu_text_translations(restaurant_id,text_key,lang,source,translation,status) SELECT ${restaurantId}::uuid,r.key,r.lang,r.source,r.translation,'done' FROM jsonb_to_recordset(${batch}::jsonb) AS r(key text,lang text,source text,translation text) ON CONFLICT(restaurant_id,text_key,lang) DO UPDATE SET translation=excluded.translation,status='done',updated_at=now() WHERE menu_text_translations.status<>'done' RETURNING text_key`)).length
 }
 return inserted
}

export type TranslationCache = Map<string, string> // `${text_key}:${lang}` → traduzione
export async function readTranslationCache(restaurantId: string, texts: Iterable<string>, connection: Conn = db): Promise<TranslationCache> {
 const keys = [...uniqueTexts(texts).keys()]
 const cache: TranslationCache = new Map()
 if (!keys.length) return cache
 const rows = await connection.execute(sql`SELECT text_key,lang,translation FROM menu_text_translations WHERE restaurant_id=${restaurantId} AND status='done' AND text_key IN (SELECT jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb))`)
 for (const r of rows as unknown as { text_key: string; lang: string; translation: string }[]) cache.set(`${r.text_key}:${r.lang}`, r.translation)
 return cache
}

/** Riempie SOLO le traduzioni mancanti o non più valide (mai quelle approvate a mano) dal contenuto in cache.
 * Pura: lavora sulle entità passate. Ritorna quante voci entità×lingua ha completato. */
export function fillTranslationsFromCache(entities: Iterable<{ name: string; description?: string | null; translations: Record<string, { name: string; description?: string; sourceFingerprint?: string; approved?: boolean }> }>, languages: string[], cache: TranslationCache): number {
 let filled = 0
 for (const e of entities) {
  const fingerprint = translationFingerprint(e)
  for (const lang of languages) {
   const old = e.translations[lang]
   if (old?.approved) continue
   const current = !!old?.name?.trim() && (!old.sourceFingerprint || old.sourceFingerprint === fingerprint) && (!e.description?.trim() || !!old.description?.trim())
   if (current) continue
   const name = cache.get(`${menuTextKey(e.name)}:${lang}`)
   const description = e.description?.trim() ? cache.get(`${menuTextKey(e.description)}:${lang}`) : undefined
   if (!name || (e.description?.trim() && !description)) continue // finché manca un pezzo resta l'italiano
   e.translations[lang] = { name, ...(e.description?.trim() ? { description } : {}), sourceFingerprint: fingerprint, approved: false }
   filled++
  }
 }
 return filled
}

/** Applica la cache a tutto il documento (menu, categorie, piatti). */
export async function applyCachedTranslations(restaurantId: string, workspace: Workspace, connection: Conn = db): Promise<number> {
 const entities = workspace.menus.flatMap(m => [m, ...sectionEntities(m.sections)])
 const cache = await readTranslationCache(restaurantId, workspaceTexts(entities), connection)
 return fillTranslationsFromCache(entities, allLanguages(workspace), cache)
}

const providerOutput = z.object({ translations: z.array(z.object({ id: z.string().max(100), name: z.string().min(1).max(4000) })).max(200) })
/** Lavora la coda: una chiamata per locale×lingua (max 200 testi), al massimo `maxCalls` chiamate per giro.
 * Poi scrive le traduzioni nel documento: bozza sempre; se non c'è una bozza pendente ripubblica (il live scatta). */
export async function processTranslationQueue(options: { connection?: DB; provider?: TranslationProvider; maxCalls?: number; actor?: string } = {}): Promise<{ calls: number; translated: number; failed: number; applied: string[]; skipped?: 'TRANSLATION_KEY_MISSING' }> {
 const connection = options.connection ?? db, provider = options.provider ?? groqTranslationProvider, maxCalls = options.maxCalls ?? 4
 // Senza la chiave dedicata alle traduzioni non si chiama nessun modello: la coda resta intatta e si mostra l'italiano.
 if (!options.provider && !translationGroqKey()) { console.warn('[traduzioni] chiave Groq dedicata assente (TAKO_CANDIDATE_GROQ_TRANSLATION_API_KEY): coda in attesa, si mostra l’italiano'); return { calls: 0, translated: 0, failed: 0, applied: [], skipped: 'TRANSLATION_KEY_MISSING' } }
 const groups = await connection.execute(sql`SELECT restaurant_id,lang,min(created_at) AS first FROM menu_text_translations WHERE status='pending' GROUP BY restaurant_id,lang ORDER BY first LIMIT ${maxCalls}`) as unknown as { restaurant_id: string; lang: string }[]
 let calls = 0, translated = 0, failed = 0
 const touched = new Set<string>()
 for (const g of groups) {
  const rows = await connection.execute(sql`SELECT text_key,source FROM menu_text_translations WHERE restaurant_id=${g.restaurant_id} AND lang=${g.lang} AND status='pending' ORDER BY created_at,text_key LIMIT 200`) as unknown as { text_key: string; source: string }[]
  if (!rows.length) continue
  const ws = await readWorkspace(g.restaurant_id, connection)
  const rules = ws?.draft.translationSettings ?? { protectedNames: [], glossary: [] }
  calls++
  try {
   const output = providerOutput.parse(await provider(g.lang, rows.map(r => ({ id: r.text_key, name: r.source })), { protectedNames: rules.protectedNames, glossary: rules.glossary.filter(x => x.language === g.lang) }))
   const wanted = new Set(rows.map(r => r.text_key))
   const good = output.translations.filter(t => wanted.has(t.id))
   if (good.length) {
    await connection.execute(sql`UPDATE menu_text_translations m SET translation=r.name,status='done',attempts=m.attempts+1,updated_at=now() FROM jsonb_to_recordset(${JSON.stringify(good)}::jsonb) AS r(id text,name text) WHERE m.restaurant_id=${g.restaurant_id} AND m.lang=${g.lang} AND m.text_key=r.id AND m.status='pending'`)
    translated += good.length; touched.add(g.restaurant_id)
   }
   const missing = rows.filter(r => !good.some(t => t.id === r.text_key)).map(r => r.text_key)
   if (missing.length) failed += await markAttempt(connection, g.restaurant_id, g.lang, missing)
  } catch {
   failed += await markAttempt(connection, g.restaurant_id, g.lang, rows.map(r => r.text_key))
  }
 }
 const applied: string[] = []
 for (const tenant of touched) if (await writeCachedTranslations(tenant, connection, options.actor)) applied.push(tenant)
 return { calls, translated, failed, applied }
}
async function markAttempt(connection: Conn, tenant: string, lang: string, keys: string[]) {
 // Dopo 3 tentativi la voce resta «failed»: niente ciclo infinito sulla quota Groq; si mostra l'italiano.
 const rows = await connection.execute(sql`UPDATE menu_text_translations SET attempts=attempts+1,status=CASE WHEN attempts+1>=3 THEN 'failed' ELSE 'pending' END,updated_at=now() WHERE restaurant_id=${tenant} AND lang=${lang} AND status='pending' AND text_key IN (SELECT jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb)) RETURNING status`) as unknown as { status: string }[]
 return rows.filter(r => r.status === 'failed').length
}
/** Scrive le traduzioni appena pronte nel documento: senza bozza pendente bozza + pubblicazione (come prima); con bozza
 * pendente nelle due copie separatamente (la bozza non si pubblica); mai pubblicato = solo bozza. */
export async function writeCachedTranslations(tenant: string, connection: DB = db, actor?: string): Promise<boolean> {
 for (let attempt = 0; attempt < 2; attempt++) {
  const row = await readWorkspace(tenant, connection)
  if (!row) return false
  const draft = workspaceSchema.parse(row.draft)
  // dashboard editor 22/10: «pulito» per contenuto (pendingOf), non per revisione. Con bozza pendente le traduzioni vanno
  // in entrambe le copie (add-only), senza pubblicare la bozza: applyBotChange col pubblicato tradotto + bozza tradotta.
  const clean = !pendingOf(row)
  if (!clean && row.published) {
   const published = workspaceSchema.parse(row.published)
   const pubChanged = await applyCachedTranslations(tenant, published, connection)
   try {
    if (pubChanged) {
     await applyBotChange(tenant, actor || SYSTEM_ACTOR, ['Traduzioni automatiche', 'Traduzioni automatiche'], { expectedPublishedRevision: Number(row.published_revision ?? row.revision), next: workspaceSchema.parse(published), draft: async d => { await applyCachedTranslations(tenant, d, connection); return d } }, connection)
     return true
    }
    if (!await applyCachedTranslations(tenant, draft, connection)) return false
    await mutateWorkspace(tenant, actor || SYSTEM_ACTOR, row.revision, workspaceSchema.parse(draft), false, 'Traduzioni automatiche', connection)
    return true
   } catch (e) { if (!(e instanceof WorkspaceConflict)) throw e }
   continue
  }
  if (!await applyCachedTranslations(tenant, draft, connection)) return false
  try {
   await connection.transaction(async tx => {
    const t = tx as unknown as DB
    await mutateWorkspace(tenant, actor || SYSTEM_ACTOR, row.revision, workspaceSchema.parse(draft), false, 'Traduzioni automatiche', t)
    if (clean) await mutateWorkspace(tenant, actor || SYSTEM_ACTOR, row.revision + 1, draft, true, 'Traduzioni automatiche', t)
   })
   return true
  } catch (e) { if (!(e instanceof WorkspaceConflict)) throw e }
 }
 return false
}
/** Autore delle versioni scritte dai job (nessun utente). */
export const SYSTEM_ACTOR = null as unknown as string
