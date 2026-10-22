// Contratto delle operazioni di bozza (dashboard editor 22/10). TypeScript puro, senza dipendenze.
// Lessico: Menu = menus[]; Sottomenu = sezione radice (parentSectionId null); Sezione = sezione figlia; Piatto = item.
// Vedi docs/webapp/dashboard-editor-2026-10-22/CONTRATTO.md.

export type Kind = 'menu' | 'section' | 'item'
/** Posizione relativa a un fratello; assente (o ancora non trovata) = in fondo. */
export type At = { beforeId: string } | { afterId: string }

export type Op =
  | { op: 'set'; kind: Kind; id: string; fields: Record<string, unknown> }
  /** parentId: section → menuId; item → sectionId; menu → assente. Per una Sezione figlia: fields.parentSectionId. */
  | { op: 'create'; kind: Kind; id: string; parentId?: string; fields: Record<string, unknown>; at?: At }
  /** item → toParentId = sectionId (anche di un altro Menu); section → toParentId = id del Sottomenu genitore o null (diventa Sottomenu);
   *  la sezione resta nel suo Menu. menu → toParentId assente. */
  | { op: 'move'; kind: Kind; id: string; toParentId?: string | null; at?: At }
  | { op: 'remove'; kind: Kind; id: string }
  /** Ordine completo dei fratelli (tollerante: id sconosciuti ignorati, mancanti accodati nell'ordine relativo di prima).
   *  kind 'menu': ids = menus; kind 'section': parentId = menuId, ids = sections del Menu (array piatto, figlie comprese). */
  | { op: 'reorder'; kind: 'menu' | 'section'; parentId?: string; ids: string[] }
  /** Ordine manuale (addendum 22/10): con true la pagina pubblica mostra Menu e Sottomenu nell'ordine del documento,
   *  con i nomi veri e senza accorpare Sottomenu. Vive in design.manualOrder. */
  | { op: 'manualOrder'; value: boolean }

export type OpErrorCode = 'NOT_FOUND' | 'HIERARCHY' | 'FIELD' | 'EXISTS'
export type OpResult = { ok: true } | { ok: false; code: OpErrorCode; message?: string }

/** Whitelist dei campi modificabili con set/create per livello. */
export const FIELD_WHITELIST: Record<Kind, readonly string[]> = {
  menu: ['name', 'description', 'type', 'active', 'pricing', 'formulas', 'included', 'schedule'],
  section: ['name', 'description', 'active', 'schedule'],
  item: ['name', 'description', 'price', 'imageUrl', 'allergens', 'tags', 'additives', 'available', 'hidden', 'featured', 'displayMode', 'externalLink', 'priceDisplay', 'promo', 'scarcity', 'schedule', 'variants', 'costPrice', 'calories', 'kitchenStation', 'prepTimeMinutes'],
}

/** Rilascio del modulo gesto (packages/menu-gesture, CONTRATTO-GESTO.md). */
export type ReorderDrop = { id: string; kind: 'menu' | 'submenu' | 'section' | 'dish'; fromGroup: string; toGroup: string; toIndex: number }

/** Id dei gruppi DOM usati da renderer e gesto (data-edit-group-id). */
export const GROUP = {
  menus: 'menus',
  pills: (menuId: string) => `pills:${menuId}`,
  /** Sezioni figlie di un Sottomenu */
  children: (rootSectionId: string) => `children:${rootSectionId}`,
  /** Piatti di una Sezione o Sottomenu */
  items: (sectionId: string) => `items:${sectionId}`,
} as const

// ── Aggiunta A1 (additiva): Workspace strutturale minimo, nessun import da apps/server. ──
export type WsItem = { id: string; [k: string]: unknown }
export type WsSection = { id: string; parentSectionId?: string | null; items: WsItem[]; [k: string]: unknown }
export type WsMenu = { id: string; sections: WsSection[]; [k: string]: unknown }
export type WsDocument = { menus: WsMenu[]; design?: { manualOrder?: boolean; [k: string]: unknown }; [k: string]: unknown }
/** Ordine visto oggi (pillole + Menu) da fotografare al primo riordino (addendum 22/10). */
export type ManualOrderView = { menuOrder: string[]; sectionOrder: Record<string, string[]> }
