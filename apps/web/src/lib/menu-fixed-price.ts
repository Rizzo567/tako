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

type FixedLike = { pricing?: 'carta' | 'fisso'; formulas?: { id: string; name: string; price: number; note?: string }[]; included?: string }
/** In un menu fisso il prezzo dei piatti non si mostra (né puntini, né «da …», né promo, né varianti). */
export const isFixedMenu = (menu: FixedLike | null | undefined) => menu?.pricing === 'fisso'
/** Opzioni da mostrare nel riquadro: solo nei menu fissi, nell'ordine salvato, con nome non vuoto. */
export const fixedFormulas = (menu: FixedLike | null | undefined) => isFixedMenu(menu) ? (menu!.formulas || []).filter(f => f && typeof f.name === 'string' && f.name.trim()) : []
/** Testo «Compreso» del menu fisso (vuoto = nessuna riga). */
export const fixedIncluded = (menu: FixedLike | null | undefined) => isFixedMenu(menu) ? String(menu!.included || '').trim() : ''
