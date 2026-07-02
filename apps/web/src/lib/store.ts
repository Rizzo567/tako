import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { PublicItem, PublicVariant } from '@tako/types'

// Un carrello persistito non deve sopravvivere oltre la sessione al tavolo: si
// invalida al cambio tavolo/ristorante (scope) o dopo scadenza.
const CART_TTL_MS = 3 * 60 * 60 * 1000 // 3 ore

export interface CartItem {
  menuItemId: string
  variantId?: string
  name: string
  quantity: number
  unitPrice: number
  notes?: string
}

interface CartState {
  items: CartItem[]
  // Scope = `${restaurantId}:${tableId}` della sessione a cui appartiene il carrello.
  scope: string | null
  touchedAt: number
  // Chiave di idempotenza stabile per tentativo di checkout: generata una volta e
  // riusata sui retry finché l'ordine non va a buon fine o il carrello non cambia.
  checkoutKey: string | null
  add: (item: CartItem) => void
  remove: (menuItemId: string, variantId?: string) => void
  updateQty: (menuItemId: string, qty: number, variantId?: string) => void
  clear: () => void
  total: () => number
  count: () => number
  ensureScope: (scope: string) => void
  ensureCheckoutKey: () => string
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      scope: null,
      touchedAt: 0,
      checkoutKey: null,
      add: (item) => set((s) => {
        const existing = s.items.find(i => i.menuItemId === item.menuItemId && i.variantId === item.variantId)
        const items = existing
          ? s.items.map(i => i.menuItemId === item.menuItemId && i.variantId === item.variantId ? { ...i, quantity: i.quantity + item.quantity } : i)
          : [...s.items, item]
        return { items, touchedAt: Date.now(), checkoutKey: null }
      }),
      remove: (menuItemId, variantId) => set((s) => ({
        items: s.items.filter(i => !(i.menuItemId === menuItemId && i.variantId === variantId)),
        touchedAt: Date.now(),
        checkoutKey: null,
      })),
      updateQty: (menuItemId, qty, variantId) => set((s) => ({
        items: qty <= 0
          ? s.items.filter(i => !(i.menuItemId === menuItemId && i.variantId === variantId))
          : s.items.map(i => i.menuItemId === menuItemId && i.variantId === variantId ? { ...i, quantity: qty } : i),
        touchedAt: Date.now(),
        checkoutKey: null,
      })),
      clear: () => set({ items: [], checkoutKey: null }),
      total: () => get().items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
      // Chiamata al resolve della sessione: azzera il carrello se cambia
      // tavolo/ristorante o se è più vecchio del TTL (pranzo precedente).
      ensureScope: (scope) => set((s) => {
        const expired = s.touchedAt > 0 && Date.now() - s.touchedAt > CART_TTL_MS
        if (s.scope !== scope || expired) {
          return { items: [], scope, touchedAt: 0, checkoutKey: null }
        }
        return { scope }
      }),
      ensureCheckoutKey: () => {
        let k = get().checkoutKey
        if (!k) { k = nanoid(); set({ checkoutKey: k }) }
        return k
      },
    }),
    { name: 'tako-cart' }
  )
)

interface SessionState {
  restaurantId: string | null
  tableId: string | null
  tableNumber: string | null
  restaurantName: string | null
  primaryColor: string
  aiEnabled: boolean
  logoUrl?: string
  orderId: string | null
  sessionId: string | null
  setSession: (data: Partial<SessionState>) => void
  setOrderId: (id: string) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      restaurantId: null, tableId: null, tableNumber: null,
      restaurantName: null, primaryColor: '#ED7159', aiEnabled: false, orderId: null,
      sessionId: null,
      setSession: (data) => set(data),
      setOrderId: (id) => set({ orderId: id }),
    }),
    { name: 'tako-session' }
  )
)
