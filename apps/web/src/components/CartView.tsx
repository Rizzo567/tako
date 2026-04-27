'use client'
import { useState } from 'react'
import { useCartStore, useSessionStore } from '@/lib/store'
import { formatEuro, cn } from '@/lib/utils'
import { ArrowLeft, Minus, Plus, Trash2, Send } from 'lucide-react'
import { api } from '@/lib/api'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'

export function CartView({ onBack, onOrderPlaced }: { onBack: () => void; onOrderPlaced: (orderId: string) => void }) {
  const { items, updateQty, remove, clear, total } = useCartStore()
  const { restaurantId, tableId, tableNumber, primaryColor, setOrderId } = useSessionStore()
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
      toast.success('Ordine inviato! 🎉')
      onOrderPlaced(data.data.id)
    } catch {
      toast.error('Errore nell\'invio. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="sticky top-0 z-40 bg-white border-b-2 border-ink/10 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl border-2 border-ink/20 grid place-items-center"><ArrowLeft size={18} /></button>
        <h1 className="font-display font-black text-xl">Il tuo ordine</h1>
      </div>

      <div className="p-4 space-y-3 pb-40">
        {items.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🛒</p>
            <p className="font-display font-black text-xl text-ink/40">Carrello vuoto</p>
            <button onClick={onBack} className="mt-4 btn-coral text-sm px-5 py-2.5">Torna al menu</button>
          </div>
        )}
        {items.map(item => (
          <div key={`${item.menuItemId}-${item.variantId}`} className="bg-white rounded-2xl p-4 border-2 border-ink/10">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1">
                <p className="font-display font-black">{item.name}</p>
                {item.notes && <p className="text-xs text-ink/50 font-semibold">{item.notes}</p>}
              </div>
              <span className="font-display font-black text-lg" style={{ color: primaryColor ?? '#ED7159' }}>{formatEuro(item.unitPrice * item.quantity)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => updateQty(item.menuItemId, item.quantity - 1, item.variantId)} className="w-8 h-8 rounded-lg border-2 border-ink/20 grid place-items-center"><Minus size={14} /></button>
              <span className="font-display font-black text-lg w-6 text-center">{item.quantity}</span>
              <button onClick={() => updateQty(item.menuItemId, item.quantity + 1, item.variantId)} className="w-8 h-8 rounded-lg border-2 border-ink/20 grid place-items-center"><Plus size={14} /></button>
              <button onClick={() => remove(item.menuItemId, item.variantId)} className="ml-auto text-ink/30 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}

        {items.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border-2 border-ink/10">
            <p className="text-xs font-display font-black text-ink/60 mb-2">NOTE PER LA CUCINA</p>
            <textarea className="w-full text-sm font-body font-semibold resize-none focus:outline-none" rows={2} placeholder="Es: allergie, preferenze di cottura..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="bottom-bar">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-ink/60">Totale</span>
            <span className="font-display font-black text-2xl">{formatEuro(total())}</span>
          </div>
          <button onClick={placeOrder} disabled={loading} className="btn-coral w-full py-4 text-lg flex items-center justify-center gap-2" style={{ background: primaryColor ?? '#ED7159' }}>
            <Send size={18} /> {loading ? 'Invio...' : 'Conferma ordine'}
          </button>
        </div>
      )}
    </div>
  )
}
