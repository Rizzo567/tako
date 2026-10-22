// Selezione della vista di modifica (dashboard editor 22/10, PIANO D8): logica pura, senza DOM, testata in tests/web.
import type { EditSelection, ModelKind } from './protocol'
import { orderDayMenus } from '@/lib/menu-day-order'
import { visibleSectionOrder } from '@/lib/menu-category-pages'
import { applyOps, dropToOps, manualOrderSnapshot } from '../../../../../packages/menu-ops/src/index'
import type { Op, ReorderDrop } from '../../../../../packages/menu-ops/src/types'

export type GestureKind = 'menu' | 'submenu' | 'section' | 'dish'
/** Il gesto parla menu|submenu|section|dish; il modello menu|section|item (CONTRATTO §4). */
export function modelKind(kind: string | null | undefined): ModelKind | null {
  return kind === 'menu' ? 'menu' : kind === 'submenu' || kind === 'section' ? 'section' : kind === 'dish' ? 'item' : null
}

/** Attributi letti da un elemento selezionabile → selezione. `select` = valore di data-edit-select («section:<id>» | «item:<id>»). */
export function selectionFromAttributes(attrs: { id?: string | null; kind?: string | null; select?: string | null }): EditSelection {
  if (attrs.select) {
    const i = attrs.select.indexOf(':'), kind = attrs.select.slice(0, i), id = attrs.select.slice(i + 1)
    if (i > 0 && id && (kind === 'section' || kind === 'item' || kind === 'menu')) return { kind, id }
    return null
  }
  const kind = modelKind(attrs.kind)
  return kind && attrs.id ? { kind, id: attrs.id } : null
}

const quote = (id: string) => '"' + id.replace(/["\\]/g, '\\$&') + '"'
/** Dove disegnare il riquadro, in ordine di preferenza: Menu = chip; Sottomenu/Sezione = titolo (poi pillola); Piatto = riga intera. */
export function frameSelectors(selection: EditSelection): string[] {
  if (!selection) return []
  const id = quote(selection.id)
  if (selection.kind === 'menu') return [`[data-edit-kind="menu"][data-edit-id=${id}]`]
  if (selection.kind === 'section') return [`[data-edit-select="section:${selection.id.replace(/["\\]/g, '\\$&')}"]`, `[data-edit-kind="section"][data-edit-id=${id}]`, `[data-edit-kind="submenu"][data-edit-id=${id}]`]
  return [`[data-edit-kind="dish"][data-edit-id=${id}]`, `[data-edit-select="item:${selection.id.replace(/["\\]/g, '\\$&')}"]`]
}

/** Nome del livello per il ristoratore (lessico fisso: Menu / Sottomenu / Sezione / Piatto). */
export function levelName(kind: ModelKind, isChildSection = false): string {
  return kind === 'menu' ? 'Menu' : kind === 'item' ? 'Piatto' : isChildSection ? 'Sezione' : 'Sottomenu'
}
export function pencilLabel(kind: ModelKind, name: string, isChildSection = false): string {
  const n = String(name || '').trim()
  return `Modifica ${levelName(kind, isChildSection).toLowerCase()}${n ? ` «${n}»` : ''}`
}

/** Tastiera sulla vista: Invio = matita dell'elemento selezionato, Esc = deseleziona. Tasti già gestiti dal gesto si ignorano. */
export function keyAction(key: string, state: { selected: boolean; handled: boolean; picking?: boolean }): 'open' | 'deselect' | null {
  if (state.handled || state.picking) return null
  if (key === 'Enter' && state.selected) return 'open'
  if (key === 'Escape' && state.selected) return 'deselect'
  return null
}

/** Il gesto può posare un elemento solo nel suo tipo di contenitore (piatti in Sezioni/Sottomenu, Sezioni sotto un Sottomenu,
 *  pillole nella barra del loro Menu, Menu nella barra dei Menu). */
export function canDropInto(kind: string, toGroup: string, menuId: string): boolean {
  if (kind === 'dish') return toGroup.startsWith('items:') && !toGroup.slice(6).startsWith('formula~')
  if (kind === 'section') return toGroup.startsWith('children:') && !toGroup.slice(9).startsWith('formula~')
  if (kind === 'submenu') return toGroup === 'pills:' + menuId
  if (kind === 'menu') return toGroup === 'menus'
  return false
}

type DocLike = { menus: { id: string; name: string; type?: string; sections: { id: string; name: string; parentSectionId?: string | null; items: unknown[] }[] }[]; design?: Record<string, unknown> }
/** Ordine visto in questo momento (ADDENDUM 1, migrazione pigra): Menu come li ordina la pagina all'ora del dispositivo e
 *  pillole calcolate come la pagina pubblica. Stesse funzioni del renderer. Con ordine già manuale: l'ordine del documento. */
export function currentOrderView(doc: DocLike, hour: number): { menuOrder: string[]; sectionOrder: Record<string, string[]> } {
  const manual = doc.design?.manualOrder === true
  const menuOrder = (manual ? doc.menus : orderDayMenus(doc.menus.map(m => ({ id: m.id, name: m.name, type: m.type })), hour)).map(m => m.id)
  const sectionOrder: Record<string, string[]> = {}
  for (const m of doc.menus) sectionOrder[m.id] = visibleSectionOrder(m.sections.map(s => ({ ...s, sourceName: s.name, items: s.items as { available?: boolean }[] })), manual)
  return { menuOrder, sectionOrder }
}

/** Op di un rilascio. Migrazione pigra all'ordine manuale (CONTRATTO §2, revisione 22/10): SOLO un rilascio di Menu o
 *  Sottomenu su documento non manuale fotografa l'ordine visto ora; fotografia + op del rilascio partono nello stesso
 *  messaggio (op reali, mai provvisorie). Piatti e Sezioni non cambiano le pillole: niente fotografia. */
export function dropOps(doc: any, drop: ReorderDrop, hour = new Date().getHours()): Op[] {
  if ((drop.kind === 'menu' || drop.kind === 'submenu') && doc?.design?.manualOrder !== true) {
    const snapshot = manualOrderSnapshot(doc, currentOrderView(doc, hour))
    const after = snapshot.length ? applyOps(doc, snapshot).workspace : doc
    const ops = dropToOps(after, drop)
    return ops.length ? [...snapshot, ...ops] : []
  }
  return dropToOps(doc, drop)
}

