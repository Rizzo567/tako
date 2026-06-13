'use client'
import { useState } from 'react'
import { useCartStore, useSessionStore } from '@/lib/store'
import { formatEuro } from '@/lib/utils'
import { ChevronDown, Minus, Plus, Trash2, Send, ShoppingBag } from 'lucide-react'
import { api } from '@/lib/api'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'

export function CartView({ onBack, onOrderPlaced }: { onBack: () => void; onOrderPlaced: (orderId: string) => void }) {
  const { items, updateQty, remove, clear, total } = useCartStore()
  const { restaurantId, tableId, tableNumber, setOrderId } = useSessionStore()
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function placeOrder() {
    if (!items.length || !restaurantId) return
    setLoading(true)
    try {
      const { data } = await api.post('/customer/orders', {
        restaurantId,
        tableId,
        tableNumber,
        type: 'table',
        items: items.map(i => ({ menuItemId: i.menuItemId, variantId: i.variantId, quantity: i.quantity, notes: i.notes })),
        notes: notes || undefined,
        idempotencyKey: nanoid(),
      })
      setOrderId(data.data.id)
      clear()
      toast.success('Ordine inviato')
      onOrderPlaced(data.data.id)
    } catch {
      toast.error('Errore nell\'invio. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[var(--surface-base)]">
      {/* Sheet handle + header */}
      <div className="sticky top-0 z-10 bg-[var(--surface-base)] px-4 pt-3 pb-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--border-default)' }} />
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Chiudi"
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border-default)] text-[var(--text-primary)] active:scale-95"
          >
            <ChevronDown size={18} strokeWidth={2.4} />
          </button>
          <h1 className="font-serif text-xl text-[var(--text-primary)]">Il tuo ordine</h1>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-44 pt-1">
        {items.length === 0 && (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full" style={{ background: 'var(--brand-tint)' }}>
              <ShoppingBag size={26} strokeWidth={2} style={{ color: 'var(--brand)' }} />
            </div>
            <p className="font-serif text-lg text-[var(--text-primary)]">Il carrello e vuoto</p>
            <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">Scegli qualcosa di buono dal menu</p>
            <button onClick={onBack} className="btn-coral mt-5 px-6 py-2.5 text-sm">Torna al menu</button>
          </div>
        )}

        {items.map(item => (
          <div
            key={`${item.menuItemId}-${item.variantId}`}
            className="bg-[var(--surface-raised)] p-4"
            style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-card)', boxShadow: 'var(--elev-1)' }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--text-primary)]">{item.name}</p>
                {item.notes && <p className="mt-0.5 text-xs font-medium text-[var(--text-secondary)]">{item.notes}</p>}
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-[var(--text-primary)]">{formatEuro(item.unitPrice * item.quantity)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => updateQty(item.menuItemId, item.quantity - 1, item.variantId)} aria-label="Diminuisci" className="stepper-btn"><Minus size={15} /></button>
              <span className="w-6 text-center font-semibold tabular-nums text-[var(--text-primary)]">{item.quantity}</span>
              <button onClick={() => updateQty(item.menuItemId, item.quantity + 1, item.variantId)} aria-label="Aumenta" className="stepper-btn"><Plus size={15} /></button>
              <button onClick={() => remove(item.menuItemId, item.variantId)} aria-label="Rimuovi" className="ml-auto text-[var(--text-tertiary)] transition-colors hover:text-[var(--status-danger)]"><Trash2 size={17} /></button>
            </div>
          </div>
        ))}

        {items.length > 0 && (
          <div
            className="bg-[var(--surface-raised)] p-4"
            style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-card)', boxShadow: 'var(--elev-1)' }}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Note per la cucina</p>
            <textarea
              className="w-full resize-none bg-transparent text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
              rows={2}
              placeholder="Es: allergie, preferenze di cottura..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="bottom-bar safe-bottom">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-medium text-[var(--text-secondary)]">Totale</span>
            <span className="font-serif text-2xl tabular-nums text-[var(--text-primary)]">{formatEuro(total())}</span>
          </div>
          <button onClick={placeOrder} disabled={loading} className="btn-coral flex w-full items-center justify-center gap-2 py-4 text-lg disabled:opacity-60">
            <Send size={18} /> {loading ? 'Invio...' : 'Conferma ordine'}
          </button>
        </div>
      )}
    </div>
  )
}
