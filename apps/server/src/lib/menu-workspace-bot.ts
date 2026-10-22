/**
 * Bot WhatsApp (e scrittori automatici: preset delle 06:00, traduzioni) — «pubblica solo la sua modifica» (dashboard editor 22/10,
 * PIANO D2/D5/§2.4, CONTRATTO §6, note in docs/webapp/dashboard-editor-2026-10-22/notes/A2-bot.md).
 *
 * Prima: il bot scriveva la bozza e poi pubblicava TUTTA la bozza; con una bozza pendente si rifiutava (copy.dashboardPending).
 * Ora:
 *  - il bot legge il catalogo dal PUBBLICATO e aggancia proposte/annulla a `published_revision` (readBotWorkspace);
 *  - la sua modifica (documento `next` = pubblicato + modifica, calcolato dal chiamante come prima) va nel pubblicato così com'è
 *    (rigoroso: gli errori restano quelli di prima, nel chiamante) e nella bozza «per entità» (tollerante): si applica a bozza
 *    solo ciò che il bot ha cambiato rispetto al pubblicato da cui è partito; bersaglio mancante in bozza = saltato e registrato;
 *    stesso campo = vince il bot; ciò che il bot non tocca resta come nella bozza. Gli id dei nuovi elementi sono quelli di
 *    `next`, quindi identici nei due documenti (e «Pubblica» non duplica nulla);
 *  - Menu sostituiti per intero (menu intero, ripristino, preset): quel Menu si sostituisce in entrambi; se la bozza di quel
 *    Menu aveva modifiche pendenti, prima si salva una versione della bozza (+ avviso, a cura del chiamante o qui con `notice`).
 *  - una sola transazione, sotto lock di riga.
 *
 * Senza bozza pendente (draft == published per contenuto) il percorso è IDENTICO a prima: due mutateWorkspace (bozza, poi
 * pubblicazione), stesse versioni, stesse revisioni. Così tutta la suite esistente del bot (che simula lo store) resta valida.
 *
 * Aritmetica delle revisioni (decisione A2): un'azione del bot avanza di `steps` (2, o 3 con la copia di sicurezza del menu
 * intero) sia la revisione della bozza sia quella pubblicata: P' = P+steps, D' = D+steps; se dopo la scrittura bozza e pubblicato
 * coincidono, si riallineano: P' = D' = D+steps. Il valore restituito `revision` è sempre P'-1, quindi il vecchio
 * `saved.revision+1` delle proposte/«ultima modifica» resta la nuova revisione pubblicata (= quella che il bot vedrà).
 * Invariante mantenuta: revision >= published_revision; revision != published_revision quasi sempre quando c'è bozza pendente
 * (così un rollback al bot vecchio torna a rifiutare con «modifiche in attesa» invece di pubblicare la bozza).
 *
 * Interruttore K2: TAKO_BOT_DRAFT_LEGACY=1 → comportamento di prima (il bot legge la bozza e rifiuta con dashboardPending).
 */
import { createHash, randomUUID } from 'node:crypto'
import { sql, eq } from 'drizzle-orm'
import { db, menuItems, type DB } from '@tako/db'
import { readWorkspace, mutateWorkspace, writePublication, verifyOwnership, WorkspaceConflict, WorkspaceMissing, WorkspaceTrialLocked, type WorkspaceRow } from './menu-workspace-store.js'
import { workspaceSchema, type Workspace } from './menu-workspace-contract.js'
import { pendingOf, jsonEqual } from './menu-workspace-pending.js'
import { applyActions, type MenuAction } from './twilio-menu-ai.js'

/** K2: interruttore per tornare al bot di prima (rifiuto con bozza pendente). */
export const botDraftLegacy = () => (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.TAKO_BOT_DRAFT_LEGACY === '1'

/** Vista del workspace per il bot: catalogo = pubblicato, revisione = revisione pubblicata. Senza pubblicato: la riga com'è. */
export function botView(row: WorkspaceRow | null): WorkspaceRow | null {
 if (!row || botDraftLegacy() || row.published == null) return row
 const revision = Number(row.published_revision ?? row.revision)
 return { ...row, draft: row.published, revision, published_revision: revision }
}
export async function readBotWorkspace(tenant: string, connection: Pick<DB, 'execute'> = db) { return botView(await readWorkspace(tenant, connection)) }

/** Id deterministici: stesso seme = stessa sequenza (uuid v4 valido). */
export function seededIds(seed: string): () => string {
 let n = 0
 return () => { const h = createHash('sha256').update(seed + ':' + n++).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${(8 | (parseInt(h[16]!, 16) & 3)).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}` }
}

// ---------------------------------------------------------------------------------------------------------------------------
// Fusione a tre vie: base (pubblicato da cui è partito il bot) → next (pubblicato dopo la modifica), applicata alla bozza.
type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any
export type MergeResult = { draft: Workspace; skipped: string[]; replacedPending: string[] }
const clone = <T>(v: T): T => structuredClone(v)
function changedKeys(a: Any, b: Any, skip: string) {
 const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]); keys.delete(skip)
 return [...keys].filter(k => !jsonEqual(a?.[k], b?.[k]))
}
function setKeys(target: Any, source: Any, keys: string[]) { for (const k of keys) { if (source[k] === undefined) delete target[k]; else target[k] = clone(source[k]) } }
/** Inserisce `el` in `list` dopo il fratello precedente (in `order`) presente in `list`; altrimenti prima del successivo; altrimenti in fondo. */
function insertNear(list: Any[], el: Any, order: Any[], at: number, accept: (x: Any) => boolean = () => true) {
 for (let i = at - 1; i >= 0; i--) { const k = list.findIndex(x => x.id === order[i].id && accept(x)); if (k >= 0) { list.splice(k + 1, 0, el); return } }
 for (let i = at + 1; i < order.length; i++) { const k = list.findIndex(x => x.id === order[i].id && accept(x)); if (k >= 0) { list.splice(k, 0, el); return } }
 list.push(el)
}
const sectionsOf = (w: Any) => { const out = new Map<string, { menuId: string; s: Any; i: number }>(); for (const m of w.menus) m.sections.forEach((s: Any, i: number) => out.set(s.id, { menuId: m.id, s, i })); return out }
const itemsOf = (w: Any) => { const out = new Map<string, { sectionId: string; it: Any; i: number }>(); for (const m of w.menus) for (const s of m.sections) s.items.forEach((it: Any, i: number) => out.set(it.id, { sectionId: s.id, it, i })); return out }
const findSection = (d: Any, id: string) => { for (const m of d.menus) { const s = m.sections.find((x: Any) => x.id === id); if (s) return { m, s } } return null }
const findItem = (d: Any, id: string) => { for (const m of d.menus) for (const s of m.sections) { const k = s.items.findIndex((x: Any) => x.id === id); if (k >= 0) return { m, s, k, it: s.items[k] } } return null }

export function mergeBotChange(baseIn: Workspace, nextIn: Workspace, draftIn: Workspace, opts: { replaceMenuIds?: string[] } = {}): MergeResult {
 const base = baseIn as Any, next = nextIn as Any, d = clone(draftIn) as Any, skipped: string[] = [], replacedPending: string[] = []
 // 1) campi del documento fuori dai menu (design, lingue, pdf…): cambiati dal bot → vince il bot.
 setKeys(d, next, changedKeys(base, next, 'menus'))
 // 2) Menu sostituiti per intero: si prende quello di next; se la bozza di quel Menu era diversa dal pubblicato, va segnalato.
 const replaced = new Set(opts.replaceMenuIds ?? [])
 for (const id of replaced) {
  const nm = next.menus.find((m: Any) => m.id === id), bm = base.menus.find((m: Any) => m.id === id), k = d.menus.findIndex((m: Any) => m.id === id)
  if (k >= 0 && (!bm || !jsonEqual(bm, d.menus[k]))) replacedPending.push(id)
  if (!nm) { if (k >= 0) d.menus.splice(k, 1); continue }
  if (k >= 0) d.menus[k] = clone(nm); else insertNear(d.menus, clone(nm), next.menus, next.menus.indexOf(nm))
  // gli id del Menu sostituito non possono stare anche altrove nella bozza (la bozza li aveva spostati): li tiene il Menu sostituito.
  const ids = new Set<string>(nm.sections.flatMap((s: Any) => [s.id, ...s.items.map((i: Any) => i.id)]))
  for (const m of d.menus) if (m.id !== id) { m.sections = m.sections.filter((s: Any) => { if (ids.has(s.id)) { skipped.push('section:' + s.id + ':replaced'); return false } return true }); for (const s of m.sections) s.items = s.items.filter((i: Any) => { if (ids.has(i.id)) { skipped.push('item:' + i.id + ':replaced'); return false } return true }) }
 }
 const inReplaced = (menuId: string | undefined) => !!menuId && replaced.has(menuId)
 const bS = sectionsOf(base), nS = sectionsOf(next), bI = itemsOf(base), nI = itemsOf(next)
 // 3) Menu (campi, creati).
 next.menus.forEach((nm: Any, at: number) => {
  if (replaced.has(nm.id)) return
  const bm = base.menus.find((m: Any) => m.id === nm.id), dm = d.menus.find((m: Any) => m.id === nm.id)
  if (!bm) { if (dm) setKeys(dm, nm, changedKeys(dm, nm, 'sections')); else insertNear(d.menus, { ...clone(nm), sections: [] }, next.menus, at); return }
  const keys = changedKeys(bm, nm, 'sections'); if (!keys.length) return
  if (dm) setKeys(dm, nm, keys); else skipped.push('menu:' + nm.id + ':missing')
 })
 // 4) Sezioni (campi, create, cambio di Menu).
 for (const [id, n] of nS) {
  if (inReplaced(n.menuId)) continue
  const b = bS.get(id), found = findSection(d, id), nm = next.menus.find((m: Any) => m.id === n.menuId)
  if (!b) {
   if (found) { setKeys(found.s, n.s, changedKeys(found.s, n.s, 'items')); continue }
   const dm = d.menus.find((m: Any) => m.id === n.menuId)
   if (!dm) { skipped.push('section:' + id + ':menu-missing'); continue }
   if (n.s.parentSectionId && !dm.sections.some((s: Any) => s.id === n.s.parentSectionId && !s.parentSectionId)) { skipped.push('section:' + id + ':parent-missing'); continue }
   insertNear(dm.sections, { ...clone(n.s), items: [] }, nm.sections, n.i); continue
  }
  const keys = changedKeys(b.s, n.s, 'items')
  if (!found) { if (keys.length || b.menuId !== n.menuId) skipped.push('section:' + id + ':missing'); continue }
  if (keys.length) setKeys(found.s, n.s, keys)
  if (b.menuId !== n.menuId && found.m.id !== n.menuId) {
   const dm = d.menus.find((m: Any) => m.id === n.menuId)
   if (!dm) { skipped.push('section:' + id + ':move-target-missing'); continue }
   found.m.sections.splice(found.m.sections.indexOf(found.s), 1); insertNear(dm.sections, found.s, nm.sections, n.i)
  }
 }
 // 5) Piatti (campi, creati, spostati, eliminati).
 for (const [id, n] of nI) {
  const nSec = nS.get(n.sectionId)
  if (inReplaced(nSec?.menuId)) continue
  const b = bI.get(id), found = findItem(d, id), nOrder = nSec!.s.items
  if (!b) {
   if (found) { setKeys(found.it, n.it, changedKeys(found.it, n.it, '')); continue }
   const target = findSection(d, n.sectionId)
   if (!target) { skipped.push('item:' + id + ':section-missing'); continue }
   insertNear(target.s.items, clone(n.it), nOrder, n.i); continue
  }
  if (inReplaced(bS.get(b.sectionId)?.menuId)) continue
  const keys = changedKeys(b.it, n.it, ''), moved = b.sectionId !== n.sectionId
  if (!found) { if (keys.length || moved) skipped.push('item:' + id + ':missing'); continue }
  if (keys.length) setKeys(found.it, n.it, keys)
  if (moved && found.s.id !== n.sectionId) {
   const target = findSection(d, n.sectionId)
   if (!target) { skipped.push('item:' + id + ':move-target-missing'); continue }
   found.s.items.splice(found.k, 1); insertNear(target.s.items, found.it, nOrder, n.i)
  }
 }
 for (const [id, b] of bI) { if (nI.has(id) || inReplaced(bS.get(b.sectionId)?.menuId)) continue; const found = findItem(d, id); if (found) found.s.items.splice(found.k, 1) }
 // 6) Sezioni e Menu eliminati dal bot: si tolgono dalla bozza solo se lì sono rimasti vuoti (mai perdere piatti della bozza).
 for (const [id, b] of bS) {
  if (nS.has(id) || inReplaced(b.menuId)) continue
  const found = findSection(d, id); if (!found) continue
  if (found.s.items.length || found.m.sections.some((s: Any) => s.parentSectionId === id)) { skipped.push('section:' + id + ':not-empty-in-draft'); continue }
  found.m.sections.splice(found.m.sections.indexOf(found.s), 1)
 }
 for (const bm of base.menus) {
  if (replaced.has(bm.id) || next.menus.some((m: Any) => m.id === bm.id)) continue
  const k = d.menus.findIndex((m: Any) => m.id === bm.id); if (k < 0) continue
  if (d.menus[k].sections.length) { skipped.push('menu:' + bm.id + ':not-empty-in-draft'); continue }
  d.menus.splice(k, 1)
 }
 return { draft: d as Workspace, skipped, replacedPending }
}

// ---------------------------------------------------------------------------------------------------------------------------
export type BotChange = {
 /** Revisione pubblicata vista dal bot (readBotWorkspace().revision). Diversa sotto lock → WorkspaceConflict («il menu è cambiato»). */
 expectedPublishedRevision: number
 /** Pubblicato dopo la modifica, calcolato dal chiamante dal pubblicato che ha letto (rigoroso: errori nel chiamante). */
 next?: Workspace
 /** In alternativa a `next`: azioni applicate qui al pubblicato bloccato, con id deterministici dal seme. */
 actions?: MenuAction[]; idSeed?: string; applyOptions?: { uploads?: Map<string, string>; timezone?: string; now?: Date }
 /** Menu sostituiti per intero (menu intero da foto/PDF, ripristino, preset). */
 replaceMenuIds?: string[]
 /** Etichetta della versione che salva la bozza di prima quando un Menu sostituito aveva modifiche pendenti. */
 draftBackupLabel?: string
 /** Avviso al titolare (menu_owner_notices, draft_discarded) se è stata salvata la bozza di prima. */
 notice?: string
 /** Versioni da salvare prima (es. copia di sicurezza del menu intero). Senza bozza pendente = mutateWorkspace(bozza) come prima. */
 before?: { label: string; doc: Workspace }[]
 /** Trasformazione della bozza al posto della fusione (traduzioni: aggiunge solo ciò che manca). */
 draft?: (draft: Workspace) => Promise<Workspace> | Workspace
}
export type BotChangeResult = { revision: number; publishedRevision: number; draftRevision: number; data: Workspace; skippedInDraft: string[]; draftBackupVersionId: string | null; partial: boolean }

// Le classi dello store si costruiscono solo qui: nei test che simulano lo store con due sole funzioni non esistono.
const conflict = () => { try { return new WorkspaceConflict('Revision conflict') } catch { return new Error('Revision conflict') } }
const isConflict = (e: unknown) => e instanceof Error && e.message === 'Revision conflict'
type Locked = { revision: number; published_revision: number | null; draft: unknown; published: unknown; trial: boolean }
async function lockBotRow(tx: Pick<DB, 'execute'>, tenant: string): Promise<Locked | undefined> {
 const rows = await tx.execute(sql`SELECT revision,published_revision,draft,published,EXISTS(SELECT 1 FROM restaurants WHERE id=${tenant} AND settings->>'takomenuTrial'='true') AS trial FROM menu_workspaces WHERE restaurant_id=${tenant} FOR UPDATE`)
 const r = rows[0] as Record<string, unknown> | undefined
 return r ? { revision: Number(r.revision), published_revision: r.published_revision == null ? null : Number(r.published_revision), draft: r.draft, published: r.published, trial: r.trial === true } : undefined
}
async function version(tx: Pick<DB, 'execute'>, tenant: string, actor: string, revision: number, label: string, doc: unknown, id: string = randomUUID()) {
 await tx.execute(sql`INSERT INTO menu_workspace_versions(id,restaurant_id,revision,label,snapshot,created_by) VALUES(${id},${tenant},${revision},${label},${JSON.stringify(doc)}::jsonb,${actor})`)
 return id
}

/**
 * Scrittura del bot: pubblica solo la sua modifica e la riporta nella bozza (vedi intestazione).
 * labels = [etichetta della versione bozza, etichetta della versione pubblicata] (le stesse di prima).
 */
export async function applyBotChange(tenant: string, actor: string, labels: [string, string], change: BotChange, connection: DB = db): Promise<BotChangeResult> {
 const raw = await readWorkspace(tenant, connection)
 if (!raw) throw new WorkspaceMissing('Revision conflict')
 const rawP = Number(raw.published_revision ?? raw.revision)
 if (!botDraftLegacy() && raw.published != null && rawP !== change.expectedPublishedRevision) throw conflict()
 const computeNext = (published: Workspace) => {
  if (change.next) return change.next
  const w = clone(published) as Any
  applyActions(w, change.actions ?? [], { ...change.applyOptions, newId: seededIds(change.idSeed ?? randomUUID()) })
  return workspaceSchema.parse(w)
 }
 // Senza bozza pendente (o bot di prima, o mai pubblicato): esattamente il percorso di prima.
 if (botDraftLegacy() || raw.published == null || !pendingOf(raw)) {
  try { return await legacy(tenant, actor, labels, change, raw, computeNext(workspaceSchema.parse(raw.published ?? raw.draft)), connection) }
  catch (e) {
   // La bozza è diventata pendente fra la lettura e il lock (dashboard): si ripete col percorso parziale.
   if (botDraftLegacy() || raw.published == null || !isConflict(e)) throw e
   const again = await readWorkspace(tenant, connection)
   if (!again || !pendingOf(again) || Number(again.published_revision) !== change.expectedPublishedRevision) throw e
  }
 }
 return partial(tenant, actor, labels, change, computeNext, connection)
}

async function legacy(tenant: string, actor: string, labels: [string, string], change: BotChange, raw: WorkspaceRow, next: Workspace, connection: DB): Promise<BotChangeResult> {
 let revision = raw.revision
 for (const b of change.before ?? []) revision = (await mutateWorkspace(tenant, actor, revision, b.doc, false, b.label, connection)).revision
 const saved = await mutateWorkspace(tenant, actor, revision, next, false, labels[0], connection)
 const published = await mutateWorkspace(tenant, actor, saved.revision, next, true, labels[1], connection)
 const p = Number((published as { revision?: number } | undefined)?.revision ?? saved.revision + 1)
 return { revision: saved.revision, publishedRevision: p, draftRevision: p, data: next, skippedInDraft: [], draftBackupVersionId: null, partial: false }
}

async function partial(tenant: string, actor: string, labels: [string, string], change: BotChange, computeNext: (p: Workspace) => Workspace, connection: DB): Promise<BotChangeResult> {
 const out = await connection.transaction(async tx => {
  const row = await lockBotRow(tx, tenant)
  if (!row) throw new WorkspaceMissing('Revision conflict')
  if (row.published == null || Number(row.published_revision ?? row.revision) !== change.expectedPublishedRevision) throw conflict()
  const base = workspaceSchema.parse(row.published), draft = workspaceSchema.parse(row.draft)
  let next = workspaceSchema.parse(computeNext(base))
  const merged = change.draft ? { draft: await change.draft(clone(draft)), skipped: [] as string[], replacedPending: [] as string[] } : mergeBotChange(base, next, draft, { replaceMenuIds: change.replaceMenuIds })
  let newDraft: Workspace, skipped = merged.skipped
  const parsed = workspaceSchema.safeParse(merged.draft)
  if (parsed.success) newDraft = parsed.data
  else { newDraft = draft; skipped = [...skipped, 'draft:invalid'] } // mai una bozza invalida: resta quella di prima, la modifica è solo pubblicata
  const D = row.revision, P = Number(row.published_revision ?? row.revision), steps = (change.before?.length ?? 0) + 2
  // PROVA: come prima, la bozza si salva e la pubblicazione è bloccata.
  if (row.trial) {
   await verifyOwnership(tx, tenant, newDraft)
   await version(tx, tenant, actor, D + 1, labels[0], newDraft)
   await tx.execute(sql`UPDATE menu_workspaces SET draft=${JSON.stringify(newDraft)}::jsonb,revision=${D + 1},updated_at=now() WHERE restaurant_id=${tenant}`)
   return { trial: true as const }
  }
  // Disponibilità «dal vivo» (cucina/cassa) come in mutateWorkspace(publish): un piatto non toccato tiene il valore delle tabelle.
  const previousItems = new Map(base.menus.filter(m => m.active).flatMap(m => m.sections.filter(s => s.active).flatMap(s => s.items.filter(i => !i.hidden).map(i => [i.id, i.available] as const))))
  const liveItems = await tx.select({ id: menuItems.id, available: menuItems.available }).from(menuItems).where(eq(menuItems.restaurantId, tenant)).for('update')
  const live = new Map(liveItems.map(i => [i.id, i.available]))
  const fix = (w: Workspace) => { for (const m of w.menus) for (const s of m.sections) for (const i of s.items) if (previousItems.get(i.id) === i.available && live.has(i.id)) i.available = live.get(i.id)! }
  next = clone(next); fix(next); fix(newDraft)
  await verifyOwnership(tx, tenant, next)
  if (!jsonEqual(newDraft, draft)) await verifyOwnership(tx, tenant, newDraft)
  let backup: string | null = null, at = D
  for (const b of change.before ?? []) await version(tx, tenant, actor, ++at, b.label, b.doc)
  if (merged.replacedPending.length && change.draftBackupLabel) {
   backup = await version(tx, tenant, actor, D, change.draftBackupLabel, draft)
   if (change.notice) { const message = change.notice; await tx.transaction(async s => { await s.execute(sql`INSERT INTO menu_owner_notices(id,restaurant_id,kind,menu_id,service_day,message) VALUES(${randomUUID()},${tenant},'draft_discarded',${merged.replacedPending[0]!},${new Date().toISOString().slice(0, 10)}::date,${message.slice(0, 500)}) ON CONFLICT DO NOTHING`) }).catch(() => undefined) }
  }
  // Caso raro (bozza risultante invalida): la modifica del bot è online ma non nella bozza; un «Pubblica» la toglierebbe.
  // Non si scrive mai una bozza invalida: si avvisa il titolare (stessa tabella degli avvisi dei preset), così ricontrolla prima di pubblicare.
  if (skipped.includes('draft:invalid')) { const menuId = next.menus[0]?.id; if (menuId) await tx.transaction(async s => { await s.execute(sql`INSERT INTO menu_owner_notices(id,restaurant_id,kind,menu_id,service_day,message) VALUES(${randomUUID()},${tenant},'draft_discarded',${menuId},${new Date().toISOString().slice(0, 10)}::date,${'Una modifica da WhatsApp è già online ma non è entrata nella bozza della dashboard: ricontrolla la bozza prima di pubblicare, altrimenti la modifica verrebbe tolta.'}) ON CONFLICT DO NOTHING`) }).catch(() => undefined) }
  const clean = jsonEqual(newDraft, next), D2 = D + steps, P2 = clean ? D2 : P + steps
  await writePublication(tx, tenant, next, new Date())
  await version(tx, tenant, actor, D2 - 1, labels[0], newDraft)
  await version(tx, tenant, actor, D2, labels[1], next)
  await tx.execute(sql`UPDATE menu_workspaces SET draft=${JSON.stringify(newDraft)}::jsonb,revision=${D2},published=${JSON.stringify(next)}::jsonb,published_revision=${P2},updated_at=now() WHERE restaurant_id=${tenant}`)
  return { trial: false as const, result: { revision: P2 - 1, publishedRevision: P2, draftRevision: D2, data: next, skippedInDraft: skipped, draftBackupVersionId: backup, partial: true } }
 })
 if (out.trial) throw new WorkspaceTrialLocked()
 return out.result
}
