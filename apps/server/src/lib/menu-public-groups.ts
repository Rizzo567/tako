// FILE GENERATO da scripts/bot/sync-menu-public-groups.mjs: copia identica di apps/web/src/lib/menu-category-pages.ts. NON modificare a mano.
// Categorie del menu cliente come pagine: logica pura, senza DOM, testata in tests/web.
export type CategorySection = { id: string; name?: string; sourceName?: string; parentSectionId?: string | null; items: { available?: boolean }[] }
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

export function macroCategoryGroups<T extends CategorySection>(sections:T[]):CategoryGroup<T>[] {
  const groups=new Map(categoryGroups(sections).map(g=>[g.id,g]))
  const normalize=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
  const macro=(name:string):string=>{
    const n=normalize(name)
    // Gruppi con un nome proprio, che le regole generiche confonderebbero (es. aperitivo → Cocktail).
    if(/domenical/.test(n))return 'Menù domenicale'
    if(/chef|consigli/.test(n))return 'Lo chef consiglia'
    if(/^(aperitivo e )?apericena$/.test(n))return 'Aperitivo e apericena'
    if(/narghil|shisha/.test(n))return 'Narghilè'
    if(/\bextra\b|aggiunt|supplement|coperto/.test(n))return 'Extra e supplementi'
    if(/event|serat|\blive\b|inform|\binfo\b|allergen/.test(n))return 'Informazioni'
    if(/french toast|brunch|brioch|cornett|colazion|pancake|croissant/.test(n))return 'Colazione e brunch'
    if(/cocktail|negroni|\bgin\b|tonic|aperitiv|spritz|long drink|mixolog|low.?alcol/.test(n))return 'Cocktail'
    if(/birr/.test(n))return 'Birre'
    if(/\bvin|bollicin|champagne|prosecco|spumant|\brossi\b|\bbianchi\b|\brose\b|frizzant|\bbolle\b|calice|cantina|bottigli/.test(n))return 'Vini e bollicine'
    if(/whisk|grapp|\bamar|liquor|distillat|\brum\b|rhum|vodka|tequila|cognac|superalcol|digestiv|dopo pasto/.test(n))return 'Distillati e liquori'
    if(/\bbev|caff|bibit|acqu|soft drink|analcolic|no.{0,3}alcohol|\bte\b|\btea\b|tisan|succh/.test(n))return 'Bevande e caffetteria'
    if(/dolc|dessert|frutt|gelat|pasticc|\btort/.test(n))return 'Dolci e frutta'
    if(/panin|sandwich|toast|bagel|piadin|kebab/.test(n)&&!/^(le |la )?(pizz|pins)/.test(n))return 'Secondi e panini'
    if(/pizz|pins|focacc|calzon|sfilatin|trancio/.test(n))return 'Pizze e pinse'
    if(/formagg/.test(n))return 'Formaggi'
    if(/prim|\bpasta\b|risott|gnocch/.test(n))return 'Primi'
    if(/second|carne|pesce|grigli|burger|panin|kebab|toast|sandwich|bagel|piadin|ripiegh|\btaco|\bmeat\b|\bfish\b|piatto unico/.test(n))return 'Secondi e panini'
    if(/contorn|insalat|\bsalad/.test(n))return 'Contorni e insalate'
    if(/antipast|sfizio|taglier|fritt|starter|piatti freddi|\bcrudi\b|crudit|bruschett/.test(n))return 'Antipasti e sfiziosità'
    if(/propost|giorno|formul|sagra|special|degust|menu|menù/.test(n))return 'Proposte e formule'
    return 'Altre proposte'
  }
  const merged=new Map<string,CategoryGroup<T>>()
  for(const group of groups.values()){
    if(!group.section.name){merged.set(group.id,group);continue}
    // Un contenitore dal nome generico (es. "Cucina") resta con il suo nome: le sue sottocategorie possono essere di tipi diversi.
    const own=macro(group.section.sourceName||group.section.name),first=group.children[0],title=own==='Altre proposte'&&first?String(group.section.sourceName||group.section.name):own,existing=merged.get(title)
    if(existing){existing.children.push(group.section,...group.children)}
    else merged.set(title,{...group,section:{...group.section,name:title},children:[...group.children]})
  }
  const order=['Lo chef consiglia','Menù domenicale','Proposte e formule','Colazione e brunch','Aperitivo e apericena','Antipasti e sfiziosità','Primi','Secondi e panini','Contorni e insalate','Formaggi','Pizze e pinse','Dolci e frutta','Cocktail','Birre','Vini e bollicine','Distillati e liquori','Bevande e caffetteria','Narghilè','Extra e supplementi','Altre proposte','Informazioni']
  return [...merged.values()].sort((a,b)=>order.indexOf(a.section.name||'')-order.indexOf(b.section.name||''))
}

const hasItems = (g: CategoryGroup, available: boolean) => [g.section, ...g.children].some(s => s.items.some(it => !available || it.available !== false))

/** Prima categoria con piatti disponibili; altrimenti la prima con piatti; altrimenti la prima. */
export function initialCategory(groups: CategoryGroup[]): string {
  return (groups.find(g => hasItems(g, true)) || groups.find(g => hasItems(g, false)) || groups[0])?.id || ''
}

/** Categoria da mostrare: al cambio di menu si riparte dalla prima; altrimenti quella voluta se esiste ancora. */
export function resolveCategory(groups: CategoryGroup[], wanted: string | null | undefined, menuChanged = false): string {
  if (!menuChanged && wanted) {const group=groups.find(g=>g.id===wanted||g.children.some(c=>c.id===wanted));if(group)return group.id}
  return initialCategory(groups)
}

/** Sezioni visibili: con la ricerca tutte quelle passate (già filtrate), altrimenti solo la categoria scelta. */
export function pageSections<T extends CategorySection>(sections: T[], active: string, searching: boolean, macros=false): T[] {
  if (searching) return sections
  const group = (macros?macroCategoryGroups(sections):categoryGroups(sections)).find(g => g.id === active)
  if (!group) return []
  const ids = new Set([group.id, ...group.children.map(c => c.id)])
  return sections.filter(s => ids.has(s.id))
}

/** +1 se la categoria di arrivo è più avanti nell'elenco, -1 se è prima, 0 se è la stessa o sconosciuta. */
export function categoryDirection(groups: CategoryGroup[], from: string, to: string): number {
  const a = groups.findIndex(g => g.id === from), b = groups.findIndex(g => g.id === to)
  return a < 0 || b < 0 || a === b ? 0 : b > a ? 1 : -1
}
