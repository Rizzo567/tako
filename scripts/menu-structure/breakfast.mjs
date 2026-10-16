// Regola COLAZIONE (decisione Manuel 16/10/2026): i prodotti da colazione (brioches/cornetti/croissant,
// french toast, pancake, bagel e uova da brunch, pasticceria da banco del mattino) non stanno mai in "Menu":
// vanno nel menu dedicato "Colazione" (type 'main', primo nella lista).
// CAFFETTERIA (decisione Manuel 16/10/2026): la caffetteria calda resta nelle bevande E viene anche copiata
// (id nuovi) in una sezione "Caffetteria" in fondo al menu Colazione, nello stesso ordine (vedi breakfastCoffeeCopies).
export const BREAKFAST_MENU = 'Colazione'
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
// Nome di sezione che dichiara la colazione.
const SECTION = /\b(colazion\w*|breakfast|brunch|brioch\w*|cornett\w*|croissant\w*|pancake\w*|french toast|bagel\w*|viennoiser\w*|pasticceria (da banco|del mattino|mattutina))\b/
// Piatto da colazione (riconosciuto dal nome).
const ITEM = /\b(brioch\w*|cornett\w*|croissant\w*|pain au chocolat|french toast|pancake\w*|bagel\w*|eggs? benedict|uova (alla )?benedict\w*|uova strapazzate|uova (e|con) bacon|uova al tegamino|bacon (and|&) eggs|muffin\w*|krapfen|bombolon\w*|waffle\w*|porridge|granola|colazione\w*)\b/
// Caffetteria/bevande: restano nelle bevande.
const DRINK = /\b(caffe\w*|cappuccin\w*|espresso|te|the|tisane?|infus\w*|succh\w*|spremut\w*|cioccolata calda|latte macchiato|ginseng|orzo|bibite|bevande)\b/

export const isBreakfastItemName = name => ITEM.test(norm(name))
export const isBreakfastMenuName = name => /\b(colazion\w*|breakfast|brunch)\b/.test(norm(name))
/** Sezione da colazione: lo dice il nome, oppure almeno metà dei piatti (min 2) è da colazione. Le sezioni di caffetteria no. */
export function isBreakfastSection(section) {
  const name = norm(section?.name)
  if (SECTION.test(name)) return true
  if (DRINK.test(name)) return false
  const items = (section?.items || []).filter(it => !it.hidden)
  const hits = items.filter(it => isBreakfastItemName(it.name)).length
  return hits >= 2 && hits * 2 >= items.length
}
/** Le sezioni da colazione rimaste fuori dal menu Colazione (nome e menu), per bloccare un piano che le mette in "Menu". */
export function misplacedBreakfast(menus) {
  const out = []
  for (const m of menus) {
    if (isBreakfastMenuName(m.name)) continue
    for (const s of m.sections) if (isBreakfastSection(s)) out.push({ menu: m.name, section: s.name })
  }
  return out
}

// --- Caffetteria anche in Colazione (16/10/2026) ---
export const BREAKFAST_COFFEE_SECTION = 'Caffetteria'
// Sezione di caffetteria tra le bevande (es. "Caffetteria", "Caffè e Succhi", "Caffè e amari").
const COFFEE_SECTION = /\b(caffetteria|caffe\w*|coffee|cafe)\b/
// Prodotto caldo di caffetteria (dal nome).
const HOT_COFFEE = /\b(caffe\w*|espresso|deca\w*|macchiat\w*|marocchin\w*|americano|cappuccin\w*|latte|mocaccin\w*|mokaccin\w*|moccacin\w*|ginseng|orzo|nutellino|cioccolat\w* calda|the|te|tea|tisan\w*|infus\w*|camomill\w*)\b/
// Esclusi: caffetteria fredda, succhi/bibite, alcolici e correzioni, tessere/abbonamenti, bevande fredde in bottiglia.
const NOT_HOT_COFFEE = /\b(shakerat\w*|freddo|fredda|ghiacci\w*|iced?|crema (di |al )?caffe|frapp\w*|estath\w*|succh\w*|spremut\w*|bibit\w*|acqua|brick|correzion\w*|tessera|abbonament\w*|carnet|liquor\w*|amar[oi]|grappa|rum|whisk\w*|baileys|sambuca|limone|pesca)\b/
export const isCoffeeSectionName = name => COFFEE_SECTION.test(norm(name))
export const isHotCoffeeItemName = name => { const n = norm(name); return HOT_COFFEE.test(n) && !NOT_HOT_COFFEE.test(n) }
/** Piatti di caffetteria calda da copiare in Colazione: dalle sezioni di caffetteria dei menu non-colazione, visibili, nell'ordine del menu. */
export function breakfastCoffeeSources(menus) {
  const out = []
  for (const m of menus) {
    if (isBreakfastMenuName(m.name)) continue
    for (const s of m.sections) {
      if (s.active === false || !isCoffeeSectionName(s.name)) continue
      for (const it of s.items) if (!it.hidden && isHotCoffeeItemName(it.name)) out.push({ menu: m, section: s, item: it })
    }
  }
  return out
}
/** Copia (id nuovi per piatto e varianti, tutto il resto identico). */
export function copyItemWithNewIds(item, newId) {
  const copy = structuredClone(item)
  copy.id = newId()
  if (Array.isArray(copy.variants)) copy.variants = copy.variants.map(v => ({ ...v, id: newId() }))
  return copy
}
