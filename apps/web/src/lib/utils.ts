export function formatEuro(n: number) {
  // Evita "NaN €" se un valore arriva undefined/NaN dall'API.
  const v = Number.isFinite(n) ? n : 0
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)
}

/** Applica il colore brand del ristorante e sceglie il testo leggibile sopra (--on-brand). */
export function applyBrand(color?: string | null) {
  if (!color) return
  const root = document.documentElement
  root.style.setProperty('--brand', color)
  const hex = color.trim().replace('#', '')
  if (hex.length !== 6) return
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  root.style.setProperty('--on-brand', L > 0.62 ? '#2A1F1A' : '#FFFFFF')
}
