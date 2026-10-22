// Applicazione delle operazioni di bozza a un documento menu. Pura: non muta mai l'input.
// Lessico: Menu = menus[]; Sottomenu = sezione radice (parentSectionId null); Sezione = sezione figlia; Piatto = item.
// Regole: CONTRATTO.md §1. Nessuna API di Node/browser (gira nel server, in apps/web e nel bundle globale della SPA).
import { FIELD_WHITELIST, GROUP } from './types.js'
import type { At, Kind, ManualOrderView, Op, OpErrorCode, OpResult, ReorderDrop, WsDocument, WsItem, WsMenu, WsSection } from './types.js'

const OK: OpResult = { ok: true }
const fail = (code: OpErrorCode, message?: string): OpResult => (message ? { ok: false, code, message } : { ok: false, code })
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Copia profonda di un documento JSON (oggetti/array semplici). Non usa structuredClone: deve girare anche in node:vm. */
export function cloneDocument<T>(value: T): T {
  if (Array.isArray(value)) return value.map(v => cloneDocument(v)) as unknown as T
  if (isObj(value)) {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value)) out[k] = cloneDocument(value[k])
    return out as T
  }
  return value
}

/** Uguaglianza come jsonb: chiavi undefined ignorate, ordine delle chiavi irrilevante. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) { const bb = b as unknown[]; return a.length === bb.length && a.every((v, i) => same(v, bb[i])) }
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>
  const ak = Object.keys(ao).filter(k => ao[k] !== undefined), bk = Object.keys(bo).filter(k => bo[k] !== undefined)
  return ak.length === bk.length && ak.every(k => Object.prototype.hasOwnProperty.call(bo, k) && same(ao[k], bo[k]))
}

// ── Ricerca ──
type Found =
  | { kind: 'menu'; menu: WsMenu; index: number }
  | { kind: 'section'; menu: WsMenu; section: WsSection; index: number }
  | { kind: 'item'; menu: WsMenu; section: WsSection; item: WsItem; index: number }

function findAny(w: WsDocument, id: string): Found | null {
  for (let mi = 0; mi < w.menus.length; mi++) {
    const menu = w.menus[mi]!
    if (menu.id === id) return { kind: 'menu', menu, index: mi }
    for (let si = 0; si < menu.sections.length; si++) {
      const section = menu.sections[si]!
      if (section.id === id) return { kind: 'section', menu, section, index: si }
      for (let ii = 0; ii < section.items.length; ii++) {
        const item = section.items[ii]!
        if (item.id === id) return { kind: 'item', menu, section, item, index: ii }
      }
    }
  }
  return null
}
function find(w: WsDocument, kind: Kind, id: string): Found | null {
  const f = findAny(w, id)
  return f && f.kind === kind ? f : null
}
const isRoot = (s: WsSection) => !s.parentSectionId
const childrenOf = (menu: WsMenu, rootId: string) => menu.sections.filter(s => s.parentSectionId === rootId)
const rootOf = (menu: WsMenu, s: WsSection): WsSection => (s.parentSectionId ? menu.sections.find(x => x.id === s.parentSectionId) ?? s : s)

// ── Inserimento posizionale ──
function anchorOf(at: At | undefined): { id: string; after: boolean } | null {
  if (!at || !isObj(at)) return null
  if ('beforeId' in at && typeof at.beforeId === 'string') return { id: at.beforeId, after: false }
  if ('afterId' in at && typeof at.afterId === 'string') return { id: at.afterId, after: true }
  return null
}
/** Inserisce `values` in `list` prima/dopo l'ancora; ancora assente o non trovata = in fondo. */
function insertAt<T extends { id: string }>(list: T[], values: T[], at: At | undefined) {
  const a = anchorOf(at)
  const idx = a ? list.findIndex(x => x.id === a.id) : -1
  if (idx < 0) list.push(...values)
  else list.splice(a!.after ? idx + 1 : idx, 0, ...values)
}

/** Posiziona un blocco Sottomenu (radice + figlie) fra i blocchi radice del Menu. */
function placeRootBlock(menu: WsMenu, block: WsSection[], at: At | undefined) {
  const a = anchorOf(at)
  const anchor = a ? menu.sections.find(s => s.id === a.id) : undefined
  if (!anchor) { menu.sections.push(...block); return }
  const anchorRoot = rootOf(menu, anchor)
  if (!a!.after) { menu.sections.splice(menu.sections.indexOf(anchorRoot), 0, ...block); return }
  // dopo il blocco dell'ancora (radice + sue figlie): subito dopo l'ultimo elemento del blocco
  let last = menu.sections.indexOf(anchorRoot)
  menu.sections.forEach((s, i) => { if (s.parentSectionId === anchorRoot.id && i > last) last = i })
  menu.sections.splice(last + 1, 0, ...block)
}
/** Posiziona una Sezione figlia fra le figlie del suo Sottomenu; in fondo = dopo l'ultima figlia (o subito dopo la radice). */
function placeChild(menu: WsMenu, child: WsSection, parentId: string, at: At | undefined) {
  const a = anchorOf(at)
  const anchor = a ? menu.sections.find(s => s.id === a.id && s.parentSectionId === parentId && s.id !== child.id) : undefined
  if (anchor) { const i = menu.sections.indexOf(anchor); menu.sections.splice(a!.after ? i + 1 : i, 0, child); return }
  let last = menu.sections.findIndex(s => s.id === parentId)
  menu.sections.forEach((s, i) => { if (s.parentSectionId === parentId && i > last) last = i })
  menu.sections.splice(last + 1, 0, child)
}

// ── Valori di partenza (stessi default dello schema zod del server: dopo il parse il documento non cambia) ──
function blank(kind: Kind, id: string): Record<string, unknown> {
  if (kind === 'menu') return { id, name: '', description: null, type: 'main', active: true, translations: {}, sections: [] }
  if (kind === 'section') return { id, parentSectionId: null, name: '', description: null, active: true, translations: {}, items: [] }
  return {
    id, name: '', description: null, price: 0, imageUrl: null, allergens: [], tags: [], additives: [], available: true, hidden: false,
    featured: false, displayMode: 'normal', externalLink: null, priceDisplay: null, kitchenStation: null, prepTimeMinutes: 10,
    costPrice: null, calories: null, variants: [], translations: {},
  }
}
function checkFields(kind: Kind, fields: unknown, extra: readonly string[] = []): OpResult | null {
  if (!isObj(fields)) return fail('FIELD', 'fields non è un oggetto')
  const allowed = FIELD_WHITELIST[kind]
  for (const k of Object.keys(fields)) if (!allowed.includes(k) && !extra.includes(k)) return fail('FIELD', `campo non modificabile: ${k}`)
  return null
}

// ── Singole operazioni (mutano `w`, che è già una copia) ──
function opSet(w: WsDocument, op: Extract<Op, { op: 'set' }>): OpResult {
  const bad = checkFields(op.kind, op.fields); if (bad) return bad
  const f = find(w, op.kind, op.id); if (!f) return fail('NOT_FOUND')
  const target = (f.kind === 'menu' ? f.menu : f.kind === 'section' ? f.section : f.item) as Record<string, unknown>
  for (const [k, v] of Object.entries(op.fields)) { if (v === undefined) delete target[k]; else target[k] = cloneDocument(v) }
  return OK
}

function opCreate(w: WsDocument, op: Extract<Op, { op: 'create' }>): OpResult {
  const bad = checkFields(op.kind, op.fields, op.kind === 'section' ? ['parentSectionId'] : []); if (bad) return bad
  if (typeof op.id !== 'string' || !op.id) return fail('FIELD', 'id mancante')
  const existing = findAny(w, op.id)
  if (existing) {
    // Idempotenza: stesso id, stesso livello, stessi campi (e stesso genitore) = già fatto, riuscita.
    if (existing.kind !== op.kind) return fail('EXISTS')
    const target = (existing.kind === 'menu' ? existing.menu : existing.kind === 'section' ? existing.section : existing.item) as Record<string, unknown>
    const fieldsMatch = Object.entries(op.fields).every(([k, v]) => same(target[k] ?? null, v ?? null))
    const parentMatch = op.parentId === undefined || (existing.kind === 'section' ? existing.menu.id === op.parentId : existing.kind === 'item' ? existing.section.id === op.parentId : true)
    return fieldsMatch && parentMatch ? OK : fail('EXISTS')
  }
  if (typeof op.fields.name !== 'string' || !op.fields.name.trim()) return fail('FIELD', 'nome mancante')
  const value = { ...blank(op.kind, op.id), ...cloneDocument(op.fields) }
  for (const k of Object.keys(value)) if (value[k] === undefined) delete value[k]
  if (op.kind === 'menu') { insertAt(w.menus, [value as WsMenu], op.at); return OK }
  if (op.kind === 'section') {
    const menu = typeof op.parentId === 'string' ? w.menus.find(m => m.id === op.parentId) : undefined
    if (!menu) return fail('NOT_FOUND', 'Menu genitore non trovato')
    const parentSectionId = value.parentSectionId
    if (parentSectionId != null) {
      if (typeof parentSectionId !== 'string') return fail('FIELD', 'parentSectionId non valido')
      const parent = menu.sections.find(s => s.id === parentSectionId)
      if (!parent) return findAny(w, parentSectionId) ? fail('HIERARCHY', 'Sottomenu di un altro Menu') : fail('NOT_FOUND', 'Sottomenu genitore non trovato')
      if (!isRoot(parent)) return fail('HIERARCHY', 'profondità massima 2')
      placeChild(menu, value as WsSection, parent.id, op.at)
    } else { value.parentSectionId = null; placeRootBlock(menu, [value as WsSection], op.at) }
    return OK
  }
  const parent = typeof op.parentId === 'string' ? find(w, 'section', op.parentId) : null
  if (!parent || parent.kind !== 'section') return fail('NOT_FOUND', 'Sezione genitore non trovata')
  insertAt(parent.section.items, [value as WsItem], op.at)
  return OK
}

function opMove(w: WsDocument, op: Extract<Op, { op: 'move' }>): OpResult {
  const f = find(w, op.kind, op.id); if (!f) return fail('NOT_FOUND')
  if (f.kind === 'menu') {
    if (op.toParentId != null) return fail('HIERARCHY', 'un Menu non ha genitore')
    w.menus.splice(f.index, 1); insertAt(w.menus, [f.menu], op.at); return OK
  }
  if (f.kind === 'item') {
    let target = f.section
    if (op.toParentId !== undefined) {
      if (op.toParentId === null) return fail('HIERARCHY', 'un Piatto sta sempre in una Sezione')
      const t = find(w, 'section', op.toParentId)
      if (!t || t.kind !== 'section') return findAny(w, op.toParentId) ? fail('HIERARCHY') : fail('NOT_FOUND', 'Sezione di arrivo non trovata')
      target = t.section
    }
    f.section.items.splice(f.index, 1)
    insertAt(target.items, [f.item], op.at)
    return OK
  }
  // Sezioni: restano nel loro Menu.
  const { menu, section } = f
  const toParent = op.toParentId === undefined ? (section.parentSectionId ?? null) : op.toParentId
  if (toParent === null) {
    // diventa (o resta) Sottomenu: si sposta col suo blocco di figlie
    const block = [section, ...childrenOf(menu, section.id)]
    menu.sections = menu.sections.filter(s => !block.includes(s))
    section.parentSectionId = null
    placeRootBlock(menu, block, op.at)
    return OK
  }
  if (toParent === section.id) return fail('HIERARCHY', 'una Sezione non può contenere se stessa')
  const parent = menu.sections.find(s => s.id === toParent)
  if (!parent) return findAny(w, toParent) ? fail('HIERARCHY', 'la Sezione resta nel suo Menu') : fail('NOT_FOUND', 'Sottomenu di arrivo non trovato')
  if (!isRoot(parent)) return fail('HIERARCHY', 'profondità massima 2')
  if (childrenOf(menu, section.id).length) return fail('HIERARCHY', 'un Sottomenu con Sezioni non diventa Sezione')
  menu.sections.splice(menu.sections.indexOf(section), 1)
  section.parentSectionId = parent.id
  placeChild(menu, section, parent.id, op.at)
  return OK
}

function opRemove(w: WsDocument, op: Extract<Op, { op: 'remove' }>): OpResult {
  const f = find(w, op.kind, op.id); if (!f) return fail('NOT_FOUND')
  if (f.kind === 'menu') w.menus.splice(f.index, 1)
  else if (f.kind === 'item') f.section.items.splice(f.index, 1)
  // Un Sottomenu eliminato porta via le sue Sezioni figlie (con i loro Piatti): nessuna figlia orfana.
  else f.menu.sections = f.menu.sections.filter(s => s.id !== f.section.id && s.parentSectionId !== f.section.id)
  return OK
}

/** Ordine tollerante: id sconosciuti/duplicati ignorati, mancanti accodati nell'ordine relativo di prima. */
function reorderList<T extends { id: string }>(list: T[], ids: unknown[]): T[] {
  const byId = new Map(list.map(x => [x.id, x]))
  const out: T[] = [], seen = new Set<string>()
  for (const id of ids) if (typeof id === 'string' && byId.has(id) && !seen.has(id)) { seen.add(id); out.push(byId.get(id)!) }
  for (const x of list) if (!seen.has(x.id)) out.push(x)
  return out
}
function opReorder(w: WsDocument, op: Extract<Op, { op: 'reorder' }>): OpResult {
  if (!Array.isArray(op.ids)) return fail('FIELD', 'ids non è un array')
  if (op.kind === 'menu') { w.menus = reorderList(w.menus, op.ids); return OK }
  if (op.kind !== 'section') return fail('FIELD', 'reorder vale per menu o section')
  const menu = typeof op.parentId === 'string' ? w.menus.find(m => m.id === op.parentId) : undefined
  if (!menu) return fail('NOT_FOUND', 'Menu non trovato')
  menu.sections = reorderList(menu.sections, op.ids)
  return OK
}

function opManualOrder(w: WsDocument, op: Extract<Op, { op: 'manualOrder' }>): OpResult {
  if (typeof op.value !== 'boolean') return fail('FIELD', 'value deve essere booleano')
  if (!isObj(w.design)) w.design = {}
  w.design.manualOrder = op.value
  return OK
}

/** Applica UNA op al documento passato (mutandolo). Per uso interno e per chi ha già una copia. */
export function applyOp(w: WsDocument, op: Op): OpResult {
  if (!isObj(op)) return fail('FIELD', 'op non valida')
  if (op.op === 'manualOrder') return opManualOrder(w, op)
  if (op.op === 'reorder') return opReorder(w, op)
  if (op.kind !== 'menu' && op.kind !== 'section' && op.kind !== 'item') return fail('FIELD', 'kind non valido')
  if (typeof op.id !== 'string') return fail('FIELD', 'id non valido')
  switch (op.op) {
    case 'set': return opSet(w, op)
    case 'create': return opCreate(w, op)
    case 'move': return opMove(w, op)
    case 'remove': return opRemove(w, op)
    default: return fail('FIELD', 'op sconosciuta')
  }
}

/** Applica le op in ordine su una copia. Un'op rifiutata non ferma le successive. L'input non viene mai mutato. */
export function applyOps<W extends WsDocument>(w: W, ops: Op[]): { workspace: W; results: OpResult[] } {
  const workspace = cloneDocument(w)
  const results = ops.map(op => applyOp(workspace, op))
  return { workspace, results }
}

// ── Gesto → op ──
const groupId = (g: string, prefix: string) => (g.startsWith(prefix + ':') ? g.slice(prefix.length + 1) : null)
/** Ancora per inserire all'indice `toIndex` di `siblings` (già senza l'elemento trascinato). */
function atIndex(siblings: string[], toIndex: number): At | undefined {
  const i = Math.max(0, Math.floor(Number.isFinite(toIndex) ? toIndex : siblings.length))
  if (i < siblings.length) return { beforeId: siblings[i]! }
  return siblings.length ? { afterId: siblings[siblings.length - 1]! } : undefined
}
const insertIdAt = (list: string[], id: string, toIndex: number) => {
  const i = Math.min(list.length, Math.max(0, Math.floor(Number.isFinite(toIndex) ? toIndex : list.length)))
  const out = list.slice(); out.splice(i, 0, id); return out
}
/** Ordine piatto delle sezioni dato l'ordine dei Sottomenu: ogni radice seguita dalle sue figlie (ordine attuale). */
function flatFromRoots(menu: WsMenu, rootIds: string[]): string[] {
  const out: string[] = []
  for (const r of rootIds) { out.push(r); for (const c of childrenOf(menu, r)) out.push(c.id) }
  return out
}

/** Rilascio del gesto (packages/menu-gesture) → op. Rilascio non valido o senza effetto riconoscibile = []. */
export function dropToOps(w: WsDocument, drop: ReorderDrop): Op[] {
  if (!drop || typeof drop.id !== 'string') return []
  if (drop.kind === 'dish') {
    const sectionId = groupId(drop.toGroup, 'items'); if (!sectionId) return []
    const t = find(w, 'section', sectionId); if (!t || t.kind !== 'section' || !find(w, 'item', drop.id)) return []
    const siblings = t.section.items.map(i => i.id).filter(id => id !== drop.id)
    return [{ op: 'move', kind: 'item', id: drop.id, toParentId: sectionId, at: atIndex(siblings, drop.toIndex) }]
  }
  if (drop.kind === 'section') {
    const rootId = groupId(drop.toGroup, 'children'); if (!rootId) return []
    const t = find(w, 'section', rootId); if (!t || t.kind !== 'section' || !find(w, 'section', drop.id)) return []
    const siblings = childrenOf(t.menu, rootId).map(s => s.id).filter(id => id !== drop.id)
    return [{ op: 'move', kind: 'section', id: drop.id, toParentId: rootId, at: atIndex(siblings, drop.toIndex) }]
  }
  if (drop.kind === 'submenu') {
    const menuId = groupId(drop.toGroup, 'pills'); if (!menuId) return []
    const menu = w.menus.find(m => m.id === menuId)
    const s = menu?.sections.find(x => x.id === drop.id)
    if (!menu || !s || !isRoot(s)) return []
    const roots = menu.sections.filter(isRoot).map(x => x.id).filter(id => id !== drop.id)
    return [{ op: 'reorder', kind: 'section', parentId: menuId, ids: flatFromRoots(menu, insertIdAt(roots, drop.id, drop.toIndex)) }]
  }
  if (drop.kind === 'menu') {
    if (drop.toGroup !== GROUP.menus || !w.menus.some(m => m.id === drop.id)) return []
    const others = w.menus.map(m => m.id).filter(id => id !== drop.id)
    return [{ op: 'reorder', kind: 'menu', ids: insertIdAt(others, drop.id, drop.toIndex) }]
  }
  return []
}

/** Fotografia dell'ordine visto oggi (Menu all'ora attuale + pillole calcolate) → reorder + manualOrder:true.
 *  `sectionOrder[menuId]` può elencare radici e/o figlie: ogni Sottomenu compare alla prima menzione (sua o di una figlia),
 *  seguito dalle sue figlie nell'ordine elencato e poi nelle restanti; le sezioni non elencate restano in coda (reorder tollerante). */
export function manualOrderSnapshot(w: WsDocument, view: ManualOrderView): Op[] {
  const ops: Op[] = []
  if (view && Array.isArray(view.menuOrder) && view.menuOrder.length) ops.push({ op: 'reorder', kind: 'menu', ids: view.menuOrder.slice() })
  const sectionOrder = view && isObj(view.sectionOrder) ? view.sectionOrder : {}
  for (const menu of w.menus) {
    const listed = sectionOrder[menu.id]
    if (!Array.isArray(listed) || !listed.length) continue
    const byId = new Map(menu.sections.map(s => [s.id, s]))
    const rank = new Map<string, number>()
    listed.forEach((id, i) => { if (!rank.has(id)) rank.set(id, i) })
    const rootsOrder: string[] = []
    for (const id of listed) {
      const s = byId.get(id); if (!s) continue
      const root = rootOf(menu, s)
      if (!rootsOrder.includes(root.id)) rootsOrder.push(root.id)
    }
    const ids: string[] = []
    for (const r of rootsOrder) {
      ids.push(r)
      const kids = childrenOf(menu, r)
      const ranked = kids.filter(k => rank.has(k.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
      for (const k of [...ranked, ...kids.filter(k => !rank.has(k.id))]) ids.push(k.id)
    }
    ops.push({ op: 'reorder', kind: 'section', parentId: menu.id, ids })
  }
  ops.push({ op: 'manualOrder', value: true })
  return ops
}
