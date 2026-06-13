'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'
import type { PublicMenu, PublicItem, PublicVariant } from '@tako/types'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useComandaStore, type ComandaItem } from '@/lib/comanda-store'
import { cn, formatEuro } from '@/lib/utils'

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'

type ActiveOrderItem = {
  id: string
  name: string
  quantity: number
  unitPrice: number
}

type ActiveOrder = {
  id: string
  status: OrderStatus
  items: ActiveOrderItem[]
  createdAt: string
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'In attesa',
  confirmed: 'Confermato',
  preparing: 'In preparazione',
  ready: 'Pronto',
  served: 'Servito',
  paid: 'Pagato',
  cancelled: 'Annullato',
}

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-sun/30 text-ink',
  confirmed: 'bg-sky/30 text-ink',
  preparing: 'bg-coral/20 text-coral-deep',
  ready: 'bg-mint/30 text-ink',
  served: 'bg-ink/10 text-ink/60',
  paid: 'bg-ink/5 text-ink/40',
  cancelled: 'bg-ink/5 text-ink/30',
}

function VariantSheet({
  item,
  onClose,
  onAdd,
}: {
  item: PublicItem
  onClose: () => void
  onAdd: (variant: PublicVariant, qty: number, notes: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(item.variants?.[0]?.id)
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')

  const variant = item.variants?.find((v) => v.id === selectedId)
  const price = item.price + (variant?.priceModifier ?? 0)

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[640px] mx-auto rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-display font-black text-xl">{item.name}</h3>
            {item.description && (
              <p className="text-sm text-ink/60 font-semibold mt-1">{item.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-ink/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-xs font-display font-black text-ink/60 mb-2 uppercase tracking-wider">
            Variante
          </p>
          <div className="flex flex-wrap gap-2">
            {item.variants?.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={cn(
                  'px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all',
                  selectedId === v.id
                    ? 'border-coral bg-coral/10 text-coral-deep'
                    : 'border-ink/20 text-ink/70',
                )}
              >
                {v.name}
                {v.priceModifier !== 0 && (
                  <span className="opacity-70 ml-1">
                    {v.priceModifier > 0 ? '+' : ''}
                    {formatEuro(v.priceModifier)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="text-xs font-display font-black text-ink/60 mb-2 uppercase tracking-wider">
            Note (opzionale)
          </p>
          <input
            className="input"
            placeholder="Es: senza cipolla, ben cotto..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-11 h-11 rounded-xl border-2 border-ink/20 grid place-items-center hover:border-coral active:scale-95 transition-all"
            >
              <Minus size={16} />
            </button>
            <span className="font-display font-black text-2xl w-10 text-center">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="w-11 h-11 rounded-xl border-2 border-ink/20 grid place-items-center hover:border-coral active:scale-95 transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            onClick={() => {
              if (!variant) return
              onAdd(variant, qty, notes)
            }}
            disabled={!variant}
            className="btn-coral flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Plus size={16} /> Aggiungi {formatEuro(price * qty)}
          </button>
        </div>
      </div>
    </div>
  )
}

function CartSheet({
  tableId,
  tableNumber,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  tableId: string
  tableNumber: string
  onClose: () => void
  onSubmit: () => void
  isSubmitting: boolean
}) {
  const cartItems = useComandaStore((s) => s.carts[tableId])
  const cart = cartItems ?? []
  const updateQty = useComandaStore((s) => s.updateQty)
  const removeItem = useComandaStore((s) => s.removeItem)
  const clearCart = useComandaStore((s) => s.clearCart)
  const total = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[640px] mx-auto rounded-t-3xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-ink/10 flex items-center justify-between">
          <div>
            <h3 className="font-display font-black text-xl">Carrello — Tavolo {tableNumber}</h3>
            <p className="text-xs text-ink/50 font-semibold mt-0.5">
              {cart.length} prodotti distinti
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-ink/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {cart.length === 0 && (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">🛒</p>
              <p className="font-display font-black text-ink/40">Carrello vuoto</p>
            </div>
          )}
          {cart.map((item) => (
            <div
              key={`${item.menuItemId}-${item.variantId ?? 'default'}`}
              className="flex items-start gap-3 p-3 rounded-xl border-2 border-ink/10 bg-cream/50"
            >
              <div className="flex-1 min-w-0">
                <p className="font-display font-black text-sm leading-tight">{item.name}</p>
                {item.notes && (
                  <p className="text-xs text-ink/50 font-semibold mt-0.5 italic">
                    {item.notes}
                  </p>
                )}
                <p className="text-xs font-bold text-ink/60 mt-1">
                  {formatEuro(item.unitPrice)} cad.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    updateQty(tableId, item.menuItemId, item.quantity - 1, item.variantId)
                  }
                  className="w-8 h-8 rounded-lg border-2 border-ink/20 grid place-items-center hover:border-coral active:scale-95 transition-all"
                >
                  <Minus size={12} />
                </button>
                <span className="font-display font-black text-base w-6 text-center">
                  {item.quantity}
                </span>
                <button
                  onClick={() =>
                    updateQty(tableId, item.menuItemId, item.quantity + 1, item.variantId)
                  }
                  className="w-8 h-8 rounded-lg border-2 border-ink/20 grid place-items-center hover:border-coral active:scale-95 transition-all"
                >
                  <Plus size={12} />
                </button>
              </div>
              <button
                onClick={() => removeItem(tableId, item.menuItemId, item.variantId)}
                className="p-1.5 rounded-lg text-ink/40 hover:text-coral hover:bg-coral/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t-2 border-ink/10 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-display font-black text-ink/60 text-sm uppercase tracking-wider">
                Totale
              </span>
              <span className="font-display font-black text-2xl">{formatEuro(total)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => clearCart(tableId)}
                className="btn-outline px-4 py-3 text-sm"
                disabled={isSubmitting}
              >
                <Trash2 size={14} /> Svuota
              </button>
              <button
                onClick={onSubmit}
                disabled={isSubmitting}
                className="btn-coral flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={15} />
                {isSubmitting ? 'Invio...' : 'Invia comanda'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ComandaTablePage() {
  const params = useParams<{ tableId: string }>()
  const tableId = params?.tableId ?? ''
  const searchParams = useSearchParams()
  const tableNumber = searchParams?.get('number') ?? '?'
  const router = useRouter()
  const qc = useQueryClient()

  const restaurant = useAuthStore((s) => s.restaurant)
  const restaurantId = restaurant?.id

  const addItem = useComandaStore((s) => s.addItem)
  const clearCart = useComandaStore((s) => s.clearCart)
  const cartItems = useComandaStore((s) => s.carts[tableId])
  const cart = cartItems ?? []
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [variantItem, setVariantItem] = useState<PublicItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [activeOrdersOpen, setActiveOrdersOpen] = useState(true)

  const { data: menu, isLoading: menuLoading } = useQuery<PublicMenu>({
    queryKey: ['comanda-menu', restaurantId],
    queryFn: () =>
      api.get(`/customer/restaurant/${restaurantId}/menu`).then((r) => r.data.data),
    enabled: !!restaurantId,
  })

  const { data: activeOrders = [] } = useQuery<ActiveOrder[]>({
    queryKey: ['comanda-table-orders', tableId],
    queryFn: () => api.get(`/orders/table/${tableId}`).then((r) => r.data.data),
    enabled: !!tableId,
    refetchInterval: 15_000,
  })

  useEffect(() => {
    if (menu && !activeSection && menu.sections[0]) {
      setActiveSection(menu.sections[0].id)
    }
  }, [menu, activeSection])

  const visibleActiveOrders = useMemo(
    () =>
      activeOrders.filter((o) =>
        ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status),
      ),
    [activeOrders],
  )

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error('Restaurant non disponibile')
      if (cart.length === 0) throw new Error('Carrello vuoto')
      const items = cart.map((i) => ({
        menuItemId: i.menuItemId,
        variantId: i.variantId,
        quantity: i.quantity,
        notes: i.notes,
      }))
      return api.post('/customer/orders', {
        restaurantId,
        tableId,
        tableNumber,
        type: 'table',
        items,
        idempotencyKey: nanoid(),
      })
    },
    onSuccess: () => {
      toast.success('Comanda inviata!', { icon: '✅' })
      clearCart(tableId)
      setCartOpen(false)
      qc.invalidateQueries({ queryKey: ['comanda-table-orders', tableId] })
      router.push('/comanda')
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : 'Errore nell\'invio della comanda'
      toast.error(message)
    },
  })

  function handleAddItem(item: PublicItem) {
    const hasVariants = !!item.variants && item.variants.length > 0
    if (hasVariants) {
      setVariantItem(item)
      return
    }
    const cartItem: ComandaItem = {
      menuItemId: item.id,
      name: item.name,
      quantity: 1,
      unitPrice: item.price,
    }
    addItem(tableId, cartItem)
    toast.success(`${item.name} aggiunto`, { icon: '➕' })
  }

  function handleAddVariant(variant: PublicVariant, qty: number, notes: string) {
    if (!variantItem) return
    const cartItem: ComandaItem = {
      menuItemId: variantItem.id,
      variantId: variant.id,
      name: `${variantItem.name} (${variant.name})`,
      quantity: qty,
      unitPrice: variantItem.price + variant.priceModifier,
      notes: notes || undefined,
    }
    addItem(tableId, cartItem)
    toast.success(`${variantItem.name} aggiunto`, { icon: '➕' })
    setVariantItem(null)
  }

  const activeItems =
    menu?.sections.find((s) => s.id === activeSection)?.items.filter((i) => i.available) ?? []

  return (
    <div className="pb-32">
      <div className="sticky top-[60px] z-20 bg-white border-b-2 border-ink/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/comanda')}
            className="flex items-center gap-1.5 font-display font-black text-ink/80 hover:text-coral transition-colors"
          >
            <ChevronLeft size={20} /> Tavolo {tableNumber}
          </button>
          <button
            onClick={() => setCartOpen(true)}
            className="relative w-10 h-10 rounded-xl bg-coral grid place-items-center active:scale-95 transition-transform"
            style={{ boxShadow: '3px 3px 0 rgba(42,31,26,0.15)' }}
          >
            <ShoppingCart size={18} className="text-white" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-white text-ink text-[10px] font-black w-5 h-5 rounded-full grid place-items-center border-2 border-ink">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {menu && menu.sections.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
            {menu.sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  'shrink-0 px-4 py-2 rounded-xl text-sm font-display font-black transition-all border-2',
                  activeSection === s.id
                    ? 'bg-coral text-white border-coral'
                    : 'bg-white text-ink/60 border-ink/10',
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {visibleActiveOrders.length > 0 && (
        <section className="px-4 pt-4">
          <button
            onClick={() => setActiveOrdersOpen((v) => !v)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-mint/20 border-2 border-mint"
            style={{ boxShadow: '3px 3px 0 rgba(42,31,26,0.15)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🍽️</span>
              <span className="font-display font-black text-sm">
                Già ordinato ({visibleActiveOrders.length})
              </span>
            </div>
            {activeOrdersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {activeOrdersOpen && (
            <div className="mt-3 space-y-2">
              {visibleActiveOrders.map((o) => (
                <div
                  key={o.id}
                  className="bg-white rounded-xl border-2 border-ink/10 p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display font-black text-xs">
                      #{o.id.slice(-6).toUpperCase()}
                    </span>
                    <span
                      className={cn(
                        'badge text-[10px] uppercase tracking-wider',
                        ORDER_STATUS_COLORS[o.status],
                      )}
                    >
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {(o.items ?? []).map((i) => (
                      <li
                        key={i.id}
                        className="flex justify-between text-xs font-semibold text-ink/70"
                      >
                        <span>
                          {i.quantity}× {i.name}
                        </span>
                        <span>{formatEuro(i.unitPrice * i.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="px-4 pt-4">
        {menuLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        )}

        {!menuLoading && activeItems.length === 0 && menu && (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">📭</p>
            <p className="font-display font-black text-ink/40">Nessun prodotto disponibile</p>
          </div>
        )}

        <div className="space-y-3">
          {activeItems.map((item) => {
            const hasVariants = !!item.variants && item.variants.length > 0
            return (
              <button
                key={item.id}
                onClick={() => handleAddItem(item)}
                className="w-full bg-white rounded-2xl border-2 border-ink/10 p-3 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
                style={{ boxShadow: '3px 3px 0 rgba(42,31,26,0.1)' }}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-black text-base leading-tight">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-ink/50 font-semibold mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-display font-black text-coral text-base">
                      {formatEuro(item.price)}
                    </span>
                    {hasVariants && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky/30 text-ink/70">
                        Varianti
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className="w-11 h-11 rounded-xl bg-coral grid place-items-center text-white shrink-0"
                  style={{ boxShadow: '2px 2px 0 rgba(42,31,26,0.2)' }}
                >
                  <Plus size={18} />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pt-2 pointer-events-none">
          <div className="max-w-[640px] mx-auto pointer-events-auto">
            <button
              onClick={() => setCartOpen(true)}
              className="btn-coral w-full py-3.5 flex items-center justify-between px-5"
              style={{ boxShadow: '4px 4px 0 #2A1F1A' }}
            >
              <span className="bg-white/25 px-2 py-0.5 rounded-lg text-sm font-black">
                {cartCount}
              </span>
              <span className="font-display font-black">Vedi carrello</span>
              <ShoppingCart size={18} />
            </button>
          </div>
        </div>
      )}

      {variantItem && (
        <VariantSheet
          item={variantItem}
          onClose={() => setVariantItem(null)}
          onAdd={handleAddVariant}
        />
      )}

      {cartOpen && (
        <CartSheet
          tableId={tableId}
          tableNumber={tableNumber}
          onClose={() => setCartOpen(false)}
          onSubmit={() => submitMutation.mutate()}
          isSubmitting={submitMutation.isPending}
        />
      )}
    </div>
  )
}
