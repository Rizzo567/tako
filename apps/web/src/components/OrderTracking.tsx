'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Clock, Plus } from 'lucide-react'
import { socket, joinTable, joinOrder } from '@/lib/socket'
import { useSessionStore } from '@/lib/store'
import { api } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import { useCountUp, EASE_OUT } from '@/lib/motion'
import { useI18n, ORDER_STEPS, stepIndexForStatus, trStep } from '@/lib/i18n'
import { Confetti } from './ui/Confetti'

interface OrderItem { id?: string; name: string; quantity: number; unitPrice: number; notes?: string }
interface Order { id?: string; status: string; items?: OrderItem[]; total: number; notes?: string }

export function OrderTracking({ onBack, onOrderAgain }: { onBack: () => void; onOrderAgain: () => void }) {
  const { t, lang } = useI18n()
  const { orderId, tableId, setOrderId } = useSessionStore()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const animTotal = useCountUp(order?.total ?? 0)

  useEffect(() => {
    if (!orderId) { setLoading(false); setOrder(null); return }
    setLoading(true); setError(false)
    api.get(`/customer/orders/${orderId}`)
      .then(r => setOrder(r.data.data))
      .catch((e) => {
        // Ordine non recuperabile (tipico: id stantìo di una sessione/ordine precedente)
        // → NON è un errore per l'utente: è "nessun ordine attivo". Pulisci l'id stantìo
        // così non riprova all'infinito. Solo un guasto di rete vero mostra il retry.
        const status = e?.response?.status
        if (status === 404 || status === 403 || status === 401) { setOrderId(null); setOrder(null) }
        else setError(true)
      })
      .finally(() => setLoading(false))
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    if (tableId) joinTable(tableId)
    else joinOrder(orderId)
    const onUpdated = ({ orderId: oid, status }: { orderId: string; status: string }) => {
      if (oid !== orderId) return
      // Solo rendering: il toast + Web Notification di "pronto" sono centralizzati nello
      // shell (useOrderReadyNotifier), attivi anche quando questo componente è smontato.
      setOrder((o) => o ? { ...o, status } : o)
    }
    const onReconnect = () => {
      if (!orderId) return
      api.get(`/customer/orders/${orderId}`).then(r => setOrder(r.data.data)).catch(() => {})
    }
    socket.on('order:updated', onUpdated)
    socket.on('connect', onReconnect)
    return () => { socket.off('order:updated', onUpdated); socket.off('connect', onReconnect) }
  }, [tableId, orderId, t])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
    </div>
  )

  // Nessun ordine attivo o errore → empty state con mascotte.
  if (error || !order) return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center gap-3 p-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/tako/tako-cloche.png" alt="" className="anim-float w-[150px]" style={{ filter: 'drop-shadow(0 16px 26px rgba(217,83,58,.18))' }} />
      <h3 className="text-[20px] font-bold text-[var(--ink)]">{error ? 'Errore di caricamento' : t('noActiveOrder')}</h3>
      <p className="mb-2 text-[14px] text-[var(--ink-2)]">{error ? 'Non riesco a recuperare l’ordine. Riprova.' : t('noActiveOrderSub')}</p>
      <button onClick={onOrderAgain}
        className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-bold text-[var(--on-brand)] active:scale-95"
        style={{ background: 'var(--brand)', boxShadow: '0 8px 22px -8px var(--brand)' }}>
        {t('goToMenu')}
      </button>
    </div>
  )

  const cancelled = order.status === 'cancelled'
  const cur = stepIndexForStatus(order.status)
  const ready = order.status === 'ready'
  const served = order.status === 'served' || order.status === 'paid'
  const step = ORDER_STEPS[cur]
  const stepTr = trStep(step.id, lang)

  if (cancelled) return (
    <div className="p-4">
      <div className="p-6 text-center" style={{ borderRadius: 'var(--r-card)', background: 'color-mix(in srgb, var(--danger) 8%, var(--raised))', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', boxShadow: 'var(--sh-1)' }}>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--danger)' }}>{t('orderWord')}</p>
        <p className="serif text-[28px]" style={{ color: 'var(--danger)' }}>Annullato</p>
        <p className="mt-2 text-[14px] font-medium text-[var(--ink-2)]">Ordine annullato — chiedi allo staff per assistenza.</p>
        <button onClick={onOrderAgain} className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[15px] font-bold text-[var(--on-brand)]" style={{ background: 'var(--brand)' }}>{t('goToMenu')}</button>
      </div>
    </div>
  )

  return (
    <div className="px-4 pb-6 pt-2">
      {/* current status hero (colore = stato) */}
      <motion.div
        key={order.status}
        className="relative overflow-hidden text-white"
        style={{ borderRadius: 'var(--r-card)', padding: '20px 18px', marginTop: 4, background: ready ? 'var(--ok)' : served ? 'var(--ink)' : 'var(--brand)', boxShadow: 'var(--sh-2)' }}
        initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: EASE_OUT }}
      >
        {(ready || served) && <Confetti n={16} />}
        <div className="flex items-center gap-3.5">
          <div className="relative h-[52px] w-[52px] flex-none">
            {!ready && !served && <span className="absolute inset-0 rounded-full" style={{ background: 'rgba(255,255,255,.5)', animation: 'pulse-ring 2.4s ease-out infinite' }} />}
            <span className="relative grid h-[52px] w-[52px] place-items-center rounded-full" style={{ background: 'rgba(255,255,255,.2)' }}>
              {ready || served ? <Check size={26} strokeWidth={2.4} /> : <Clock size={26} strokeWidth={2.4} className="anim-spin" />}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-[12px] font-bold uppercase tracking-[.08em] opacity-80">{t('orderWord')} #{order.id?.slice(-5) ?? ''}</p>
            <h2 className="serif mt-0.5 text-[28px] leading-none">{stepTr.label}</h2>
            <p className="mt-1 text-[14px] opacity-90">{stepTr.desc}</p>
          </div>
        </div>
      </motion.div>

      {/* vertical stepper */}
      <div className="mt-3" style={{ background: 'var(--raised)', borderRadius: 'var(--r-card)', padding: '18px 18px 6px', boxShadow: 'var(--sh-1)' }}>
        {ORDER_STEPS.map((s, i) => {
          const done = i < cur
          const on = i === cur
          const sTr = trStep(s.id, lang)
          return (
            <div key={s.id} className="flex gap-3.5">
              <div className="flex flex-none flex-col items-center">
                <div className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full transition-all duration-500"
                  style={{
                    background: done || on ? 'var(--brand)' : 'var(--surface)',
                    color: done || on ? 'var(--on-brand)' : 'var(--ink-3)',
                    boxShadow: on ? '0 0 0 5px var(--brand-tint)' : done ? 'none' : 'inset 0 0 0 2px var(--hairline)',
                  }}>
                  {done ? <Check size={17} strokeWidth={2.8} style={{ animation: 'check-pop .4s var(--spring)' }} />
                    : on ? <span className="h-[9px] w-[9px] rounded-full" style={{ background: '#fff', animation: 'badge-pop 1.6s ease-in-out infinite' }} />
                    : <span className="text-[13px] font-bold">{i + 1}</span>}
                </div>
                {i < ORDER_STEPS.length - 1 && (
                  <div className="my-1 w-[3px] flex-1" style={{ minHeight: 26, borderRadius: 99, background: i < cur ? 'var(--brand)' : 'var(--hairline)', transition: 'background .5s var(--out)' }} />
                )}
              </div>
              <div className="pb-4 pt-0.5" style={{ opacity: done || on ? 1 : 0.5, transition: 'opacity .4s' }}>
                <p className="text-[15.5px] font-bold text-[var(--ink)]">{sTr.label}</p>
                <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">{sTr.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* order summary */}
      {order.items && order.items.length > 0 && (
        <div className="mt-3" style={{ background: 'var(--raised)', borderRadius: 'var(--r-card)', padding: '16px 18px', boxShadow: 'var(--sh-1)' }}>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--ink-3)]">{t('summary')}</p>
          {order.items.map((it, i) => (
            <div key={it.id ?? i} className="mb-2.5 flex items-center gap-2.5">
              <span className="tnum grid h-[26px] min-w-[26px] place-items-center rounded-lg text-[13px] font-bold text-[var(--ink)]" style={{ background: 'var(--sunken)' }}>{it.quantity}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-[var(--ink)]">{it.name}</p>
                {it.notes && <p className="text-[12px] italic text-[var(--ink-3)]">“{it.notes}”</p>}
              </div>
              <span className="tnum text-[14px] font-semibold text-[var(--ink-2)]">{formatEuro(it.unitPrice * it.quantity)}</span>
            </div>
          ))}
          {order.notes && <p className="border-t pt-2.5 text-[12.5px] italic text-[var(--ink-2)]" style={{ borderColor: 'var(--hairline)' }}>{t('notePre')} {order.notes}</p>}
          <div className="mt-1 flex items-baseline justify-between border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
            <span className="font-bold text-[var(--ink)]">{t('total')}</span>
            <span className="serif tnum text-[23px] text-[var(--ink)]">{formatEuro(animTotal)}</span>
          </div>
        </div>
      )}

      <button onClick={onOrderAgain}
        className="mt-3.5 flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-bold text-[var(--ink)] active:scale-[0.98]"
        style={{ borderRadius: 'var(--r-card)', background: 'var(--sunken)' }}>
        <Plus size={18} strokeWidth={2.4} /> {t('addMore')}
      </button>
    </div>
  )
}
