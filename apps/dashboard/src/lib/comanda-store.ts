'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ComandaItem = {
  menuItemId: string
  variantId?: string
  name: string
  quantity: number
  unitPrice: number
  notes?: string
}

type ComandaStore = {
  carts: Record<string, ComandaItem[]>
  addItem: (tableId: string, item: ComandaItem) => void
  removeItem: (tableId: string, menuItemId: string, variantId?: string) => void
  updateQty: (tableId: string, menuItemId: string, qty: number, variantId?: string) => void
  clearCart: (tableId: string) => void
  getCart: (tableId: string) => ComandaItem[]
  getTotal: (tableId: string) => number
  getCount: (tableId: string) => number
}

export const useComandaStore = create<ComandaStore>()(
  persist(
    (set, get) => ({
      carts: {},
      addItem: (tableId, item) =>
        set((s) => {
          const cart = s.carts[tableId] ?? []
          const existing = cart.find(
            (i) => i.menuItemId === item.menuItemId && i.variantId === item.variantId,
          )
          if (existing) {
            return {
              carts: {
                ...s.carts,
                [tableId]: cart.map((i) =>
                  i.menuItemId === item.menuItemId && i.variantId === item.variantId
                    ? { ...i, quantity: i.quantity + item.quantity }
                    : i,
                ),
              },
            }
          }
          return { carts: { ...s.carts, [tableId]: [...cart, item] } }
        }),
      removeItem: (tableId, menuItemId, variantId) =>
        set((s) => ({
          carts: {
            ...s.carts,
            [tableId]: (s.carts[tableId] ?? []).filter(
              (i) => !(i.menuItemId === menuItemId && i.variantId === variantId),
            ),
          },
        })),
      updateQty: (tableId, menuItemId, qty, variantId) =>
        set((s) => {
          const cart = s.carts[tableId] ?? []
          if (qty <= 0) {
            return {
              carts: {
                ...s.carts,
                [tableId]: cart.filter(
                  (i) => !(i.menuItemId === menuItemId && i.variantId === variantId),
                ),
              },
            }
          }
          return {
            carts: {
              ...s.carts,
              [tableId]: cart.map((i) =>
                i.menuItemId === menuItemId && i.variantId === variantId
                  ? { ...i, quantity: qty }
                  : i,
              ),
            },
          }
        }),
      clearCart: (tableId) =>
        set((s) => {
          const c = { ...s.carts }
          delete c[tableId]
          return { carts: c }
        }),
      getCart: (tableId) => get().carts[tableId] ?? [],
      getTotal: (tableId) =>
        (get().carts[tableId] ?? []).reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
      getCount: (tableId) =>
        (get().carts[tableId] ?? []).reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'tako-comanda-carts' },
  ),
)
