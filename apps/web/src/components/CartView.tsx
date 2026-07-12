'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Minus, Plus, Check, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore, useSessionStore } from '@/lib/store'
import { formatEuro } from '@/lib/utils'
import { useCountUp, confettiBurst, SPRING } from '@/lib/motion'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/api'
import { Dish } from './ui/Dish'

// Stepper riga carrello (min 0 = rimuovi).
function LineQty({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full p-1" style={{ background: 'var(--sunken)' }}>
      <button aria-label="Diminuisci" onClick={() => onChange(value - 1)}
        className="grid h-8 w-8 place-items-center rounded-full active:scale-90"
        style={{ background: 'var(--raised)', color: 'var(--ink)', boxShadow: 'var(--sh-1)' }}>
        <Minus size={15} />
      </button>
      <motion.span key={value} className="tnum min-w-[24px] text-center text-[15px] font-bold text-[var(--ink)]"
        initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={SPRING}>{value}</motion.span>
      <button aria-label="Aumenta" onClick={() => onChange(value + 1)}
        className="grid h-8 w-8 place-items-center rounded-full text-[var(--on-brand)] active:scale-90"
        style={{ background: 'var(--brand)', boxShadow: 'var(--sh-1)' }}>
        <Plus size={15} />
      </button>
    </div>
  )
}

export function CartView({ onBack, onOrderPlaced }: { onBack: () => void; onOrderPlaced: (orderId: string) => void }) {
  const { t } = useI18n()
  const { items, updateQty, remove, clear, total, ensureCheckoutKey } = useCartStore()
  const { restaurantId, tableId, tableNumber, setOrderId } = useSessionStore()
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const animTotal = useCountUp(total())

  async function placeOrder() {
    if (!items.length || !restaurantId) return
    setLoading(true)
    try {
      // Stessa chiave su ogni retry: un reinvio dopo timeout non crea ordini doppi.
      const idempotencyKey = ensureCheckoutKey()
      const snapshot = items.slice()
      const orderNotes = notes
      const { data } = await api.post('/customer/orders', {
        restaurantId, tableId, tableNumber, type: 'table',
        items: snapshot.map(i => ({ menuItemId: i.menuItemId, variantId: i.variantId, quantity: i.quantity, notes: i.notes })),
        notes: orderNotes || undefined,
        idempotencyKey,
      })
      setOrderId(data.data.id)
      clear()
      confettiBurst()
      toast.success(t('toastOrderSent'))
      // Richiedi il permesso notifiche: il tracking avvisa quando l'ordine è pronto.
      try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() } catch { /* noop */ }
      onOrderPlaced(data.data.id)
    } catch (e: any) {
      // 409 ITEM_UNAVAILABLE: alcuni piatti sono stati esauriti tra il caricamento del
      // menu e l'invio. Il server risponde con la lista di menuItemId non più disponibili
      // → li rimuoviamo dal carrello e mostriamo un messaggio chiaro (non un errore generico).
      const err = e?.response?.data?.error
      if (e?.response?.status === 409 && err?.code === 'ITEM_UNAVAILABLE') {
        const ids: string[] = Array.isArray(err.items) ? err.items : []
        for (const id of ids) remove(id)
        toast.error(t('orderItemsUnavailable'))
      } else {
        toast.error(t('orderError'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="px-8 pb-[calc(var(--safe-b)+40px)] pt-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tako/tako-pasta.png" alt="" className="anim-float mx-auto w-[150px]" style={{ filter: 'drop-shadow(0 16px 26px rgba(217,83,58,.18))' }} />
        <h3 className="mt-2 text-[19px] font-bold text-[var(--ink)]">{t('cartEmpty')}</h3>
        <p className="mb-5 mt-1.5 text-[14px] text-[var(--ink-2)]">{t('cartEmptySub')}</p>
        <button onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-bold text-[var(--on-brand)] active:scale-95"
          style={{ background: 'var(--brand)', boxShadow: '0 8px 22px -8px var(--brand)' }}>
          <ArrowLeft size={18} /> {t('backToMenu')}
        </button>
      </div>
    )
  }

  return (
    <>
      <p className="px-5 pb-1 text-[13px] font-semibold text-[var(--ink-2)]">{t('table')} <span className="tnum">{tableNumber}</span></p>
      <div className="flex flex-col gap-2.5 px-5 pb-2 pt-1">
        {items.map(item => (
          <motion.div key={`${item.menuItemId}-${item.variantId}`}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 border-b py-2.5" style={{ borderColor: 'var(--hairline)' }}>
            <Dish name={item.name} size={52} radius={12} />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold leading-tight text-[var(--ink)]">{item.name}</p>
              {item.notes && <p className="mt-0.5 text-[12px] italic text-[var(--ink-3)]">“{item.notes}”</p>}
              <p className="tnum mt-1 text-[13px] font-semibold text-[var(--ink-2)]">{formatEuro(item.unitPrice)}</p>
            </div>
            <LineQty value={item.quantity} onChange={q => updateQty(item.menuItemId, q, item.variantId)} />
          </motion.div>
        ))}
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder={t('orderNotesPh')}
          className="mt-1.5 w-full resize-none rounded-[var(--r-input)] px-3.5 py-3 text-[14px] text-[var(--ink)] outline-none"
          style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1.5px var(--hairline)' }}
        />
      </div>

      <div className="sticky bottom-0 border-t px-5 py-3" style={{ background: 'var(--raised)', borderColor: 'var(--hairline)' }}>
        <div className="mb-2.5 flex items-baseline justify-between">
          <span className="font-semibold text-[var(--ink-2)]">{t('total')}</span>
          <span className="serif tnum text-[26px] text-[var(--ink)]">{formatEuro(animTotal)}</span>
        </div>
        <button onClick={placeOrder} disabled={loading}
          className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-[var(--on-brand)] active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'var(--brand)', boxShadow: '0 8px 22px -8px var(--brand)' }}>
          <Check size={18} strokeWidth={2.4} /> {loading ? t('sending') : t('confirmOrder')}
        </button>
      </div>
    </>
  )
}
