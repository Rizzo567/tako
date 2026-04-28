import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PublicItem, PublicVariant } from '@tako/types'

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
  add: (item: CartItem) => void
  remove: (menuItemId: string, variantId?: string) => void
  updateQty: (menuItemId: string, qty: number, variantId?: string) => void
  clear: () => void
  total: () => number
  count: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => set((s) => {
        const existing = s.items.find(i => i.menuItemId === item.menuItemId && i.variantId === item.variantId)
        if (existing) return { items: s.items.map(i => i.menuItemId === item.menuItemId && i.variantId === item.variantId ? { ...i, quantity: i.quantity + item.quantity } : i) }
        return { items: [...s.items, item] }
      }),
      remove: (menuItemId, variantId) => set((s) => ({ items: s.items.filter(i => !(i.menuItemId === menuItemId && i.variantId === variantId)) })),
      updateQty: (menuItemId, qty, variantId) => set((s) => ({
        items: qty <= 0
          ? s.items.filter(i => !(i.menuItemId === menuItemId && i.variantId === variantId))
          : s.items.map(i => i.menuItemId === menuItemId && i.variantId === variantId ? { ...i, quantity: qty } : i),
      })),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
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
  setSession: (data: Partial<SessionState>) => void
  setOrderId: (id: string) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      restaurantId: null, tableId: null, tableNumber: null,
      restaurantName: null, primaryColor: '#ED7159', aiEnabled: false, orderId: null,
      setSession: (data) => set(data),
      setOrderId: (id) => set({ orderId: id }),
    }),
    { name: 'tako-session' }
  )
)
