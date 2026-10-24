// Riga «Menu in arrivo» della pagina pubblica (21/10): Menu o Sottomenu attivo ma ancora senza piatti.
// Modulo puro (niente React/API): lo usano il renderer condiviso, i testi fissi di i18n.tsx e i test.
export const MENU_COMING_SOON = {
  it: 'Menu in arrivo', en: 'Menu coming soon', es: 'Menú próximamente', de: 'Menü folgt in Kürze', fr: 'Menu bientôt disponible',
  pt: 'Menu em breve', nl: 'Menu volgt binnenkort', pl: 'Menu wkrótce', ru: 'Меню скоро появится', tr: 'Menü yakında',
  ar: 'القائمة قريبًا', zh: '菜单即将推出', ja: 'メニューは近日公開', ko: '메뉴 준비 중',
} as const

export function menuComingSoonCopy(language = 'it'): string {
  const lang = String(language || 'it').split('-')[0] as keyof typeof MENU_COMING_SOON
  return MENU_COMING_SOON[lang] || MENU_COMING_SOON.it
}
