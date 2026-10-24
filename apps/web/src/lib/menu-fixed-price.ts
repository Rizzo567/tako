// Menu «a prezzo fisso» (21/10, contratto docs/webapp/menu-prezzo-fisso-2026-10-21/CONTRATTO.md).
// Modulo puro (niente React/API): lo usano il renderer condiviso, i testi fissi di i18n.tsx e i test.
// Copia identica di FIXED_PRICE_INCLUDED in apps/server/src/lib/menu-workspace-pdf.ts (il PDF): un test ne verifica la parità.
export const MENU_INCLUDED = {
  it: 'Compreso', en: 'Included', es: 'Incluido', de: 'Inklusive', fr: 'Compris',
  pt: 'Incluído', nl: 'Inbegrepen', pl: 'W cenie', ru: 'Включено', tr: 'Dahil',
  ar: 'يشمل', zh: '包含', ja: '含まれるもの', ko: '포함',
} as const

export function menuIncludedCopy(language = 'it'): string {
  const lang = String(language || 'it').split('-')[0] as keyof typeof MENU_INCLUDED
  return MENU_INCLUDED[lang] || MENU_INCLUDED.it
}

type FixedLike = { pricing?: 'carta' | 'fisso'; formulas?: { id: string; name: string; price: number; note?: string; sectionIds?: string[] }[]; included?: string }
/** In un menu fisso il prezzo dei piatti non si mostra (né puntini, né «da …», né promo, né varianti). */
export const isFixedMenu = (menu: FixedLike | null | undefined) => menu?.pricing === 'fisso'
/** Opzioni da mostrare nel riquadro: solo nei menu fissi, nell'ordine salvato, con nome non vuoto. */
export const fixedFormulas = (menu: FixedLike | null | undefined) => isFixedMenu(menu) ? (menu!.formulas || []).filter(f => f && typeof f.name === 'string' && f.name.trim()) : []
/** Testo «Compreso» del menu fisso (vuoto = nessuna riga). */
export const fixedIncluded = (menu: FixedLike | null | undefined) => isFixedMenu(menu) ? String(menu!.included || '').trim() : ''

type ViewSection = { id: string; name: string; sourceName?: string; parentSectionId?: string | null; items: object[] }
type ViewMenu = FixedLike & { sections: ViewSection[] }
/** Prefisso degli id delle viste ripetute (blocco opzione e sue sezioni): mai un id del documento. */
export const FORMULA_VIEW_PREFIX = 'formula~'
/** Riga «opzione» generata dalla vista: mostra il suo prezzo anche nel menu fisso e non si apre/ordina. */
export const isFormulaRow = (item: object | null | undefined) => !!item && (item as { fixedFormula?: unknown }).fixedFormula === true
/** «Nota. Compreso» nella stessa riga, come la descrizione scritta a mano oggi («Un primo. ¼ di vino oppure ½ litro d’acqua + caffè.»). */
export function formulaDescription(note?: string, included?: string): string {
  const sentence = (text?: string) => { const t = String(text || '').trim(); return !t || /[.!?;:…]$/.test(t) ? t : t + '.' }
  return [sentence(note), sentence(included)].filter(Boolean).join(' ')
}
/**
 * Resa del menu fisso (CONTRATTO §6). Opzioni con `sectionIds`: per ogni opzione, nell'ordine, un blocco (categoria) col nome
 * in maiuscolo e una riga «NOME … prezzo» + nota e Compreso, poi le Sezioni comprese (si ripete la VISTA, non i dati); in coda
 * le Sezioni non comprese da nessuna opzione. Nessuna opzione con `sectionIds` (o menu alla carta): il menu resta com'è
 * (il riquadro opzioni in cima lo disegna il renderer).
 */
export function fixedMenuView<M extends ViewMenu>(menu: M, language = 'it'): M {
  type S = M['sections'][number]
  const formulas = fixedFormulas(menu)
  const byId = new Map<string, S>(menu.sections.map(s => [s.id, s]))
  const linked = (f: { sectionIds?: string[] }) => (f.sectionIds || []).filter(id => byId.has(id))
  if (!formulas.some(f => linked(f).length)) return menu
  const included = fixedIncluded(menu)
  const childrenOf = (id: string) => menu.sections.filter(s => s.parentSectionId === id)
  const covered = new Set<string>()
  const subtree = (root: S, seen = new Set<string>()): S[] => { if (seen.has(root.id)) return []; seen.add(root.id); return [root, ...childrenOf(root.id).flatMap(c => subtree(c, seen))] }
  const upper = (name: string) => { try { return name.toLocaleUpperCase(language || 'it') } catch { return name.toUpperCase() } }
  const sections: S[] = []
  for (const f of formulas) {
    const blockId = FORMULA_VIEW_PREFIX + f.id
    sections.push({ id: blockId, name: upper(f.name.trim()), sourceName: upper(f.name.trim()), parentSectionId: null,
      items: [{ id: blockId, name: f.name.trim(), description: formulaDescription(f.note, included) || undefined, price: f.price, available: true, allergens: [], tags: [], additives: [], variants: [], displayMode: 'centered', fixedFormula: true }] } as unknown as S)
    for (const id of linked(f)) {
      for (const s of subtree(byId.get(id)!)) {
        covered.add(s.id)
        sections.push({ ...s, id: blockId + '~' + s.id, parentSectionId: s.id === id ? blockId : blockId + '~' + s.parentSectionId } as S)
      }
    }
  }
  const rest = menu.sections.filter(s => !covered.has(s.id) && !(s.parentSectionId && covered.has(s.parentSectionId)))
  return { ...menu, sections: [...sections, ...rest] }
}
