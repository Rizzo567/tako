// Prezzo mostrato al cliente (menu pubblico, anteprima, scheda piatto).
// Regola: testo libero (priceDisplay) se presente; altrimenti il prezzo se > 0;
// con prezzo base 0 si usa il prezzo minimo delle varianti a pagamento;
// se non c'è nessun prezzo reale ritorna null (niente "0,00 €", niente puntini).
// La dashboard di modifica NON usa questa funzione: lì lo 0 resta visibile.
export type PriceLike = { price: number; priceDisplay?: string | null; variants?: { priceModifier: number }[] | null }

export function menuItemPriceLabel(item: PriceLike, format: (value: number) => string): string | null {
  const text = typeof item.priceDisplay === 'string' ? item.priceDisplay.trim() : ''
  if (text) return text
  const base = Number.isFinite(item.price) ? item.price : 0
  if (base > 0) return format(base)
  const priced = (item.variants || []).map(v => base + (Number.isFinite(v.priceModifier) ? v.priceModifier : 0)).filter(v => v > 0)
  return priced.length ? format(Math.min(...priced)) : null
}
