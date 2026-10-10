// Categorie del menu cliente come pagine: logica pura, senza DOM, testata in tests/web.
export type CategorySection = { id: string; parentSectionId?: string | null; items: { available?: boolean }[] }
export type CategoryGroup<T extends CategorySection = CategorySection> = { id: string; section: T; children: T[] }

/** Raggruppa le sezioni per categoria principale: le sottocategorie (anche annidate) restano nella pagina della radice.
 *  Una sottocategoria orfana o in ciclo diventa una categoria a sé. L'ordine segue quello del menu. */
export function categoryGroups<T extends CategorySection>(sections: T[]): CategoryGroup<T>[] {
  const byId = new Map(sections.map(s => [s.id, s]))
  const rootOf = (s: T): T => {
    let current = s
    for (let depth = 0; current.parentSectionId && byId.has(current.parentSectionId); depth++) {
      if (depth > 32) return s
      current = byId.get(current.parentSectionId)!
      if (current.id === s.id) return s
    }
    return current
  }
  const groups = new Map<string, CategoryGroup<T>>()
  const roots = sections.map(s => [s, rootOf(s)] as const)
  for (const [s, root] of roots) if (s === root) groups.set(s.id, { id: s.id, section: s, children: [] })
  for (const [s, root] of roots) if (s !== root) groups.get(root.id)?.children.push(s)
  return [...groups.values()]
}

const hasItems = (g: CategoryGroup, available: boolean) => [g.section, ...g.children].some(s => s.items.some(it => !available || it.available !== false))

/** Prima categoria con piatti disponibili; altrimenti la prima con piatti; altrimenti la prima. */
export function initialCategory(groups: CategoryGroup[]): string {
  return (groups.find(g => hasItems(g, true)) || groups.find(g => hasItems(g, false)) || groups[0])?.id || ''
}

/** Categoria da mostrare: al cambio di menu si riparte dalla prima; altrimenti quella voluta se esiste ancora. */
export function resolveCategory(groups: CategoryGroup[], wanted: string | null | undefined, menuChanged = false): string {
  if (!menuChanged && wanted && groups.some(g => g.id === wanted)) return wanted
  return initialCategory(groups)
}

/** Sezioni visibili: con la ricerca tutte quelle passate (già filtrate), altrimenti solo la categoria scelta. */
export function pageSections<T extends CategorySection>(sections: T[], active: string, searching: boolean): T[] {
  if (searching) return sections
  const group = categoryGroups(sections).find(g => g.id === active)
  if (!group) return []
  const ids = new Set([group.id, ...group.children.map(c => c.id)])
  return sections.filter(s => ids.has(s.id))
}

/** +1 se la categoria di arrivo è più avanti nell'elenco, -1 se è prima, 0 se è la stessa o sconosciuta. */
export function categoryDirection(groups: CategoryGroup[], from: string, to: string): number {
  const a = groups.findIndex(g => g.id === from), b = groups.findIndex(g => g.id === to)
  return a < 0 || b < 0 || a === b ? 0 : b > a ? 1 : -1
}
