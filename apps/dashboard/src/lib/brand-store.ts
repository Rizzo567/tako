import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const BRANDS = ['arancione', 'blu', 'giallo', 'verde', 'rosa'] as const
export type Brand = (typeof BRANDS)[number]

// Hex "brand" di ogni palette — utile per sincronizzare restaurant.primaryColor.
export const BRAND_HEX: Record<Brand, string> = {
  arancione: '#ED7159',
  blu: '#3E7BD0',
  giallo: '#F0B429',
  verde: '#4FA980',
  rosa: '#E86FA6',
}

export const BRAND_LABEL: Record<Brand, string> = {
  arancione: 'Arancione', blu: 'Blu', giallo: 'Giallo', verde: 'Verde', rosa: 'Rosa',
}

interface BrandState {
  brand: Brand
  setBrand: (b: Brand) => void
}

// La palette attiva è una preferenza UI persistita; applicata a <html data-brand>.
export const useBrandStore = create<BrandState>()(
  persist(
    (set) => ({ brand: 'arancione', setBrand: (brand) => set({ brand }) }),
    { name: 'tako-brand' }
  )
)

// Trova la palette più vicina a un hex (per inizializzare dal primaryColor del ristorante).
export function brandFromHex(hex?: string | null): Brand | null {
  if (!hex) return null
  const norm = hex.trim().toLowerCase()
  const found = (Object.entries(BRAND_HEX) as [Brand, string][]).find(([, h]) => h.toLowerCase() === norm)
  return found ? found[0] : null
}
