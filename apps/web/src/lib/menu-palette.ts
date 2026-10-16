// Colori del menu cliente. Il server applica l'arancione Tako come default quando il ristorante
// non sceglie nulla (schema workspace e restaurants.primary_color): qui lo trattiamo come "non scelto".
export const DEFAULT_MENU_ACCENT = '#1d1d1f'
const TAKO_DEFAULT_ORANGES = new Set(['#ed7159', '#ed725b'])
const hex = (value: unknown) => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value) ? value.toLowerCase() : ''

/** Colore principale del menu: quello del ristorante, oppure un neutro scuro se manca o è il default Tako. */
export function menuAccent(value: unknown): string {
  const color = hex(value)
  return color && !TAKO_DEFAULT_ORANGES.has(color) ? color : DEFAULT_MENU_ACCENT
}

/** Sfondo della categoria attiva: quello scelto, altrimenti il colore principale. */
export function menuActiveBackground(value: unknown, accent: string): string {
  const color = hex(value)
  return color && !TAKO_DEFAULT_ORANGES.has(color) ? color : accent
}

const rgb = (color: string) => { const c = hex(color); return c ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : null }

const DARK_TEXT = '#1d1d1f'
/** Luminanza relativa WCAG (0–1); null se non è un colore pieno. */
export const luminance = (color: string): number | null => { const c = rgb(color); if (!c) return null; const [r, g, b] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
/** Rapporto di contrasto WCAG tra due colori esadecimali; null se uno dei due non è un colore pieno. */
export function contrastRatio(a: string, b: string): number | null {
  const x = luminance(a), y = luminance(b)
  return x === null || y === null ? null : (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Testo leggibile su uno sfondo: bianco o scuro, quello con contrasto WCAG maggiore. */
export function readableOn(background: string): string {
  const onWhite = contrastRatio('#ffffff', background), onDark = contrastRatio(DARK_TEXT, background)
  if (onWhite === null || onDark === null) return '#ffffff'
  return onDark > onWhite ? DARK_TEXT : '#ffffff'
}

/** Distanza RGB tra due colori esadecimali; Infinity se uno dei due non è un colore pieno. */
export function colorDistance(a: unknown, b: unknown): number {
  const x = rgb(String(a || '')), y = rgb(String(b || ''))
  return x && y ? Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) : Infinity
}
