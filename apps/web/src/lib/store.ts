import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'

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

// Invio dall'esito INCERTO (timeout/rete caduta durante la POST): la chiave e lo
// snapshot restano parcheggiati qui finché non sappiamo se l'ordine è atterrato.
// Il prossimo checkout fa PRIMA il probe by-key: se l'ordine esiste non si
// rispedisce nulla con una chiave nuova (doppio addebito), se non esiste si
// riparte puliti. Persistito: sopravvive anche a un reload della PWA.
export interface PendingSubmission {
  key: string
  items: CartItem[]
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
  pending: PendingSubmission | null
  add: (item: CartItem) => void
  remove: (menuItemId: string, variantId?: string) => void
  updateQty: (menuItemId: string, qty: number, variantId?: string) => void
  clear: () => void
  // Rimuove SOLO le quantità inviate: gli item aggiunti mentre l'ordine era in
  // volo restano nel carrello (prima clear() cancellava anche quelli).
  removeSent: (sent: CartItem[]) => void
  total: () => number
  count: () => number
  ensureScope: (scope: string) => void
  ensureCheckoutKey: () => string
  setPending: (p: PendingSubmission | null) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      pending: null,
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
      // variantId omesso = rimuovi TUTTE le righe di quel piatto (anche con
      // variante): è ciò che serve al 409 ITEM_UNAVAILABLE, che identifica solo
      // il menuItemId — prima le righe con variante restavano nel carrello e il
      // checkout si bloccava in loop.
      remove: (menuItemId, variantId) => set((s) => ({
        items: s.items.filter(i => !(i.menuItemId === menuItemId && (variantId === undefined || i.variantId === variantId))),
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
      removeSent: (sent) => set((s) => ({
        items: s.items
          .map(i => {
            const m = sent.find(x => x.menuItemId === i.menuItemId && x.variantId === i.variantId && (x.notes ?? '') === (i.notes ?? ''))
            return m ? { ...i, quantity: i.quantity - m.quantity } : i
          })
          .filter(i => i.quantity > 0),
        checkoutKey: null,
      })),
      total: () => get().items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
      // Chiamata al resolve della sessione: azzera il carrello se cambia
      // tavolo/ristorante o se è più vecchio del TTL (pranzo precedente).
      ensureScope: (scope) => set((s) => {
        const expired = s.touchedAt > 0 && Date.now() - s.touchedAt > CART_TTL_MS
        if (s.scope !== scope || expired) {
          return { items: [], scope, touchedAt: 0, checkoutKey: null, pending: null }
        }
        return { scope }
      }),
      ensureCheckoutKey: () => {
        let k = get().checkoutKey
        if (!k) { k = nanoid(); set({ checkoutKey: k }) }
        return k
      },
      setPending: (p) => set({ pending: p }),
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
  // Ordini dal telefono del cliente attivi. Se false il menu resta visibile ma
  // non si può ordinare (carrello/Aggiungi nascosti). Default true finché il menu non risponde.
  orderingEnabled: boolean
  // Prenotazioni tavolo attive per il ristorante. Popolato da MenuView al load del menu;
  // usato per decidere se mostrare l'azione "Prenota" nell'assistente.
  reservationsEnabled: boolean
  // Coperto A PERSONA in € (0 se non attivo). Informativo per il cliente: il conto del
  // tavolo lo aggiunge. Non si applica all'asporto (mostrato solo se c'è un tavolo).
  coverCharge: number
  logoUrl?: string
  orderId: string | null
  sessionId: string | null
  setSession: (data: Partial<SessionState>) => void
  setOrderId: (id: string | null) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      restaurantId: null, tableId: null, tableNumber: null,
      restaurantName: null, primaryColor: '#ED7159', aiEnabled: false, orderingEnabled: true, reservationsEnabled: false, coverCharge: 0, orderId: null,
      sessionId: null,
      // Se cambia il ristorante o il tavolo rispetto a quello corrente, azzera orderId:
      // altrimenti l'ordine di una visita precedente riaffiorerebbe su un tavolo/locale diverso.
      setSession: (data) => set((prev) => {
        const changedScope = (data.restaurantId !== undefined && data.restaurantId !== prev.restaurantId)
          || (data.tableId !== undefined && data.tableId !== prev.tableId)
        return changedScope && data.orderId === undefined ? { ...data, orderId: null } : data
      }),
      setOrderId: (id) => set({ orderId: id }),
    }),
    { name: 'tako-session' }
  )
)
