// Etichette pubbliche F3+F4 (Promo, Ultime porzioni, Solo oggi): traduzioni statiche, una volta sola, niente LLM.
// Copia identica di SALES_LABELS in apps/server/src/lib/menu-sales.ts (usata dal PDF): il test tests/menu-sales.test.ts ne verifica la parità.
export type SalesCopyKey = 'promo' | 'lastPortions' | 'onlyToday'
export const SALES_COPY: Record<string, Record<SalesCopyKey, string>> = {
  it: { promo: 'Promo', lastPortions: 'Ultime porzioni', onlyToday: 'Solo oggi' },
  en: { promo: 'Offer', lastPortions: 'Last portions', onlyToday: 'Today only' },
  fr: { promo: 'Promo', lastPortions: 'Dernières portions', onlyToday: 'Aujourd’hui seulement' },
  de: { promo: 'Angebot', lastPortions: 'Letzte Portionen', onlyToday: 'Nur heute' },
  es: { promo: 'Oferta', lastPortions: 'Últimas raciones', onlyToday: 'Solo hoy' },
  pt: { promo: 'Promoção', lastPortions: 'Últimas porções', onlyToday: 'Só hoje' },
  nl: { promo: 'Actie', lastPortions: 'Laatste porties', onlyToday: 'Alleen vandaag' },
  pl: { promo: 'Promocja', lastPortions: 'Ostatnie porcje', onlyToday: 'Tylko dziś' },
  ru: { promo: 'Акция', lastPortions: 'Последние порции', onlyToday: 'Только сегодня' },
  ar: { promo: 'عرض', lastPortions: 'آخر الحصص', onlyToday: 'اليوم فقط' },
  zh: { promo: '优惠', lastPortions: '最后几份', onlyToday: '仅限今日' },
  ja: { promo: 'セール', lastPortions: '残りわずか', onlyToday: '本日限り' },
}
export const salesCopy = (key: SalesCopyKey, language = 'it') => SALES_COPY[language.split('-')[0]!]?.[key] ?? SALES_COPY.it![key]
