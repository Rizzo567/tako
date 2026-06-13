'use client'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useSessionStore } from '@/lib/store'
import { api } from '@/lib/api'
import { formatEuro, cn } from '@/lib/utils'
import { ArrowLeft, Check, Plus } from 'lucide-react'

const STEPS = [
  { key: 'pending', label: 'Ricevuto', desc: 'Tako ha ricevuto il tuo ordine' },
  { key: 'confirmed', label: 'Confermato', desc: 'Il ristorante ha confermato' },
  { key: 'preparing', label: 'In cucina', desc: 'Lo chef sta preparando' },
  { key: 'ready', label: 'Pronto', desc: 'In arrivo al tuo tavolo' },
  { key: 'served', label: 'Servito', desc: 'Buon appetito' },
]

export function OrderTracking({ onBack, onOrderAgain }: { onBack: () => void; onOrderAgain: () => void }) {
  const { orderId, tableId } = useSessionStore()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) return
    api.get(`/customer/orders/${orderId}`).then(r => setOrder(r.data.data)).finally(() => setLoading(false))
  }, [orderId])

  useEffect(() => {
    if (!tableId) return
    const socket = io(process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001', { autoConnect: true })
    socket.emit('join:table', tableId)
    socket.on('order:updated', ({ orderId: oid, status }) => {
      if (oid === orderId) setOrder((o: any) => o ? { ...o, status } : o)
      if (status === 'ready') {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Il tuo ordine e pronto', { body: 'Il cameriere sta arrivando.' })
        }
      }
    })
    return () => { socket.disconnect() }
  }, [tableId, orderId])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const stepIdx = STEPS.findIndex(s => s.key === order?.status)
  const currentIdx = stepIdx < 0 ? 0 : stepIdx

  if (loading) return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-[var(--surface-base)]">
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={onBack} aria-label="Indietro" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border-default)] text-[var(--text-primary)] active:scale-95"><ArrowLeft size={18} strokeWidth={2.4} /></button>
        <h1 className="font-serif text-xl text-[var(--text-primary)]">Il tuo ordine</h1>
      </div>

      <div className="p-4">
        {/* Status card */}
        <div
          className="mb-6 p-6 text-center"
          style={{ borderRadius: 'var(--r-card)', background: 'var(--surface-raised)', boxShadow: 'var(--elev-2)' }}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Stato ordine</p>
          <p className="font-serif text-3xl text-[var(--text-primary)]">{STEPS[currentIdx]?.label ?? 'In lavorazione'}</p>
          <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">{STEPS[currentIdx]?.desc}</p>
        </div>

        {/* Vertical stepper */}
        <div
          className="mb-4 p-5"
          style={{ borderRadius: 'var(--r-card)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--elev-1)' }}
        >
          {STEPS.slice(0, -1).map((step, i) => {
            const done = i < currentIdx
            const current = i === currentIdx
            const isLast = i === STEPS.length - 2
            return (
              <div key={step.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold transition-all duration-500',
                      current && 'animate-pulse',
                    )}
                    style={{
                      background: done || current ? 'var(--brand)' : 'var(--surface-sunken)',
                      color: done || current ? 'var(--on-brand)' : 'var(--text-tertiary)',
                    }}
                  >
                    {done ? <Check size={16} strokeWidth={2.6} /> : i + 1}
                  </div>
                  {!isLast && (
                    <div
                      className="my-1 h-8 w-0.5 transition-all duration-500"
                      style={{ background: done ? 'var(--brand)' : 'var(--border-default)' }}
                    />
                  )}
                </div>
                <div className="pb-4 last:pb-0">
                  <p className={cn('text-sm font-semibold', done || current ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>{step.label}</p>
                  <p className="text-xs font-medium text-[var(--text-tertiary)]">{step.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Order summary */}
        {order?.items && (
          <div
            className="p-5"
            style={{ borderRadius: 'var(--r-card)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--elev-1)' }}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Riepilogo ordine</p>
            {order.items.map((item: any) => (
              <div key={item.id} className="flex justify-between border-b border-dashed border-[var(--border-subtle)] py-2 last:border-0">
                <span className="text-sm font-medium text-[var(--text-primary)]"><span className="tabular-nums">{item.quantity}×</span> {item.name}</span>
                <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{formatEuro(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            <div className="mt-3 flex justify-between border-t border-[var(--border-default)] pt-3">
              <span className="font-serif text-lg text-[var(--text-primary)]">Totale</span>
              <span className="font-serif text-lg tabular-nums" style={{ color: 'var(--brand)' }}>{formatEuro(order.total)}</span>
            </div>

            <button
              onClick={onOrderAgain}
              className="mt-4 flex w-full items-center justify-center gap-2 py-4 font-semibold text-[var(--text-primary)] transition-transform active:scale-[0.98]"
              style={{ borderRadius: 'var(--r-card)', background: 'var(--surface-sunken)' }}
            >
              <Plus size={18} strokeWidth={2.4} /> Aggiungi altro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
