'use client'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useSessionStore } from '@/lib/store'
import { api } from '@/lib/api'
import { formatEuro, cn } from '@/lib/utils'
import { ArrowLeft, Bell } from 'lucide-react'

const STEPS = [
  { key: 'pending', label: 'Ricevuto', desc: 'Tako ha ricevuto il tuo ordine' },
  { key: 'confirmed', label: 'Confermato', desc: 'Il ristorante ha confermato' },
  { key: 'preparing', label: 'In cucina', desc: 'Lo chef sta preparando' },
  { key: 'ready', label: 'Pronto!', desc: 'In arrivo al tuo tavolo 🚀' },
  { key: 'served', label: 'Servito', desc: 'Buon appetito! 🍝' },
]

export function OrderTracking({ onBack, onOrderAgain }: { onBack: () => void; onOrderAgain: () => void }) {
  const { orderId, restaurantId, tableId, primaryColor } = useSessionStore()
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
          new Notification('🍝 Il tuo ordine è pronto!', { body: 'Il cameriere sta arrivando.' })
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

  const stepIdx = STEPS.findIndex(s => s.key === order?.status) ?? 0
  const isReady = order?.status === 'ready'
  const isServed = order?.status === 'served'

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 rounded-full border-4 border-coral border-t-transparent animate-spin" /></div>

  return (
    <div className="min-h-screen bg-cream">
      <div className="sticky top-0 z-40 bg-white border-b-2 border-ink/10 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl border-2 border-ink/20 grid place-items-center"><ArrowLeft size={18} /></button>
        <h1 className="font-display font-black text-xl">Traccia ordine</h1>
      </div>

      <div className="p-4">
        {/* Status card */}
        <div
          className={cn('rounded-3xl p-6 mb-6 text-white text-center transition-all duration-700', isReady && 'animate-pulse')}
          style={{ background: isReady ? '#7FC4A8' : (primaryColor ?? '#ED7159') }}
        >
          <p className="text-sm font-black opacity-80 mb-1">STATO ORDINE</p>
          <p className="font-display font-black text-3xl">{STEPS[stepIdx]?.label ?? 'In lavorazione'}</p>
          <p className="text-sm opacity-80 mt-1">{STEPS[stepIdx]?.desc}</p>
        </div>

        {/* Progress steps con linea verticale */}
        <div className="bg-white rounded-2xl p-5 border-2 border-ink/10 mb-4">
          {STEPS.slice(0, -1).map((step, i) => {
            const done = i < stepIdx
            const current = i === stepIdx
            const isLast = i === STEPS.length - 2
            return (
              <div key={step.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={cn('w-9 h-9 rounded-full grid place-items-center text-sm font-black shrink-0 transition-all duration-500', done ? 'text-white' : current ? 'text-white animate-pulse' : 'bg-ink/10 text-ink/40')}
                    style={{ background: done || current ? (primaryColor ?? '#ED7159') : undefined }}
                  >
                    {done ? '✓' : current ? '●' : i + 1}
                  </div>
                  {!isLast && (
                    <div
                      className={cn('w-0.5 h-8 my-1 transition-all duration-500', done ? 'bg-coral' : 'bg-ink/10')}
                      style={{ background: done ? (primaryColor ?? '#ED7159') : undefined }}
                    />
                  )}
                </div>
                <div className="pb-4 last:pb-0">
                  <p className={cn('font-display font-black text-sm', done || current ? 'text-ink' : 'text-ink/40')}>{step.label}</p>
                  <p className="text-xs font-semibold text-ink/40">{step.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Order summary */}
        {order?.items && (
          <div className="bg-white rounded-2xl p-5 border-2 border-ink/10">
            <p className="font-display font-black text-sm text-ink/60 mb-3">RIEPILOGO ORDINE</p>
            {order.items.map((item: any) => (
              <div key={item.id} className="flex justify-between py-2 border-b border-dashed border-ink/10 last:border-0">
                <span className="font-semibold text-sm">{item.quantity}× {item.name}</span>
                <span className="font-display font-black text-sm">{formatEuro(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            <div className="flex justify-between mt-3 pt-2 border-t-2 border-ink/10">
              <span className="font-display font-black">Totale</span>
              <span className="font-display font-black text-xl" style={{ color: primaryColor ?? '#ED7159' }}>{formatEuro(order.total)}</span>
            </div>

            <button
              onClick={onOrderAgain}
              className="w-full mt-4 bg-white border-2 border-ink/15 rounded-2xl py-4 font-display font-black text-center text-ink active:scale-95 transition-transform"
            >
              🍹 Aggiungi altro ordine
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
