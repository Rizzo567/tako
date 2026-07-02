'use client'
import { useEffect, useRef, useState } from 'react'
import { socket, joinTable } from '@/lib/socket'
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
  const [error, setError] = useState(false)
  const notifiedReady = useRef(false) // evita notifiche "pronto" doppie

  useEffect(() => {
    // Nessun ordine attivo: niente spinner infinito.
    if (!orderId) { setLoading(false); setOrder(null); return }
    setLoading(true); setError(false)
    notifiedReady.current = false
    api.get(`/customer/orders/${orderId}`)
      .then(r => setOrder(r.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [orderId])

  useEffect(() => {
    if (!tableId) return
    // Singleton same-origin con re-join automatico: il tracking resta vivo anche
    // dopo un drop di rete (niente disconnect su unmount, solo off del listener).
    joinTable(tableId)
    const onUpdated = ({ orderId: oid, status }: { orderId: string; status: string }) => {
      if (oid !== orderId) return
      setOrder((o: any) => o ? { ...o, status } : o)
      // Notifica "pronto" SOLO alla prima transizione (più emit 'ready' possibili).
      if (status === 'ready' && !notifiedReady.current) {
        notifiedReady.current = true
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Il tuo ordine è pronto', { body: 'Il cameriere sta arrivando.' })
        }
      }
    }
    // Ad ogni (ri)connessione del socket rifetcha lo stato reale: un telefono
    // risvegliato/riconnesso può aver perso emit 'order:updated' mentre dormiva.
    const onReconnect = () => {
      if (!orderId) return
      api.get(`/customer/orders/${orderId}`)
        .then(r => setOrder(r.data.data))
        .catch(() => {})
    }
    socket.on('order:updated', onUpdated)
    socket.on('connect', onReconnect)
    return () => { socket.off('order:updated', onUpdated); socket.off('connect', onReconnect) }
  }, [tableId, orderId])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const isCancelled = order?.status === 'cancelled'
  // 'paid' è uno stato finale positivo non presente in STEPS: mappalo all'ultimo
  // step ('served') così lo stepper risulta completo invece di ripartire da 0.
  const effectiveStatus = order?.status === 'paid' ? 'served' : order?.status
  const stepIdx = STEPS.findIndex(s => s.key === effectiveStatus)
  const currentIdx = stepIdx < 0 ? 0 : stepIdx

  if (loading) return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
    </div>
  )

  // Nessun ordine (tab aperta senza aver ordinato) o errore di caricamento.
  if (error || !order) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-serif text-2xl text-[var(--text-primary)]">{error ? 'Errore di caricamento' : 'Nessun ordine attivo'}</p>
      <p className="text-sm font-medium text-[var(--text-secondary)]">{error ? 'Non riesco a recuperare l\'ordine. Riprova.' : 'Quando ordini, qui vedrai lo stato in tempo reale.'}</p>
      <button onClick={onOrderAgain} className="btn-coral mt-2 px-6 py-2.5 text-sm">Vai al menu</button>
    </div>
  )

  // Ordine annullato: stato terminale negativo, esplicito e senza stepper.
  if (isCancelled) return (
    <div className="min-h-[100dvh] bg-[var(--surface-base)]">
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={onBack} aria-label="Indietro" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border-default)] text-[var(--text-primary)] active:scale-95"><ArrowLeft size={18} strokeWidth={2.4} /></button>
        <h1 className="font-serif text-xl text-[var(--text-primary)]">Il tuo ordine</h1>
      </div>
      <div className="p-4">
        <div
          className="p-6 text-center"
          style={{ borderRadius: 'var(--r-card)', background: 'color-mix(in srgb, var(--status-danger) 8%, var(--surface-raised))', border: '1px solid color-mix(in srgb, var(--status-danger) 30%, transparent)', boxShadow: 'var(--elev-1)' }}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--status-danger)' }}>Stato ordine</p>
          <p className="font-serif text-3xl" style={{ color: 'var(--status-danger)' }}>Annullato</p>
          <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">Ordine annullato — chiedi allo staff per assistenza.</p>
          <button onClick={onOrderAgain} className="btn-coral mt-5 px-6 py-2.5 text-sm">Vai al menu</button>
        </div>
      </div>
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
