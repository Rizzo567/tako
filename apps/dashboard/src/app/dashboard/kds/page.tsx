'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { socket } from '@/lib/socket'
import { cn } from '@/lib/utils'
import { Clock, CheckCircle2, LayoutGrid, List } from 'lucide-react'

// ─── Audio ding via Web Audio API ────────────────────────────────────────────

function playDing() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch {}
}

function playReady() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    ;[523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25)
      osc.start(ctx.currentTime + i * 0.12)
      osc.stop(ctx.currentTime + i * 0.12 + 0.3)
    })
  } catch {}
}

function vibrate(pattern: number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern)
}

// ─── Timer hook ───────────────────────────────────────────────────────────────

function useElapsed(createdAt: string) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = new Date(createdAt).getTime()
    const calc = () => Math.max(0, Math.floor((Date.now() - start) / 1000))
    setElapsed(calc())
    const id = setInterval(() => setElapsed(calc()), 1000)
    return () => clearInterval(id)
  }, [createdAt])
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return { display: `${m}:${s.toString().padStart(2, '0')}`, minutes: m }
}

// ─── KDS Card ─────────────────────────────────────────────────────────────────

const CARD_COLORS: Record<string, string> = {
  pending: 'border-coral bg-coral/10',
  confirmed: 'border-sun bg-sun/10',
  preparing: 'border-sun bg-sun/10',
  ready: 'border-mint bg-mint/10',
}

const ITEM_STATUS_LABELS: Record<string, string> = {
  pending: 'da fare', preparing: 'in corso', ready: '✓ pronto', served: '✓ servito',
}

const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'served',
}
const BUMP_LABEL: Record<string, string> = {
  pending: 'PRENDI IN CARICO', confirmed: 'PRENDI IN CARICO', preparing: 'PRONTO ✓', ready: 'SERVITO',
}

function KdsCard({ order, compact, onStatusChange, onItemStatusChange }: { order: any; compact: boolean; onStatusChange: (orderId: string, status: string) => void; onItemStatusChange: (orderId: string, itemId: string, status: string) => void }) {
  const { display, minutes } = useElapsed(order.createdAt)

  const timerColor = minutes < 5
    ? 'text-mint'
    : minutes < 10
    ? 'text-sun'
    : 'text-coral animate-pulse'

  const nextStatus = NEXT_STATUS[order.status] ?? 'served'

  function handleBump() {
    if (nextStatus === 'ready') {
      playReady()
      vibrate([100, 50, 100])
    } else {
      vibrate([60])
    }
    onStatusChange(order.id, nextStatus)
  }

  if (compact) {
    return (
      <div
        className={cn('rounded-xl border-2 px-4 py-3 flex items-center gap-4', CARD_COLORS[order.status] ?? 'border-ink/20 bg-white')}
        style={{ boxShadow: '3px 3px 0 rgba(42,31,26,0.1)' }}
      >
        <span className="font-display font-black text-xl w-12">T{order.tableNumber ?? '?'}</span>
        <span className={cn('font-display font-black text-sm w-10', timerColor)}>{display}</span>
        <div className="flex-1 flex flex-wrap gap-1">
          {order.items.map((item: any) => (
            <span key={item.id} className="text-sm font-black">{item.quantity}× {item.name}</span>
          ))}
        </div>
        <button
          onClick={handleBump}
          className={cn('px-4 py-2 rounded-xl font-display font-black text-sm text-white shrink-0 active:scale-95 transition-transform',
            order.status === 'preparing' ? 'bg-mint' : 'bg-coral'
          )}
          style={{ boxShadow: '0 3px 0 rgba(0,0,0,0.2)' }}
        >
          {BUMP_LABEL[order.status] ?? 'AVANTI'}
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn('rounded-2xl border-2 p-5 flex flex-col', CARD_COLORS[order.status] ?? 'border-ink/20 bg-white')}
      style={{ boxShadow: '4px 4px 0 rgba(42,31,26,0.12)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="font-display font-black text-3xl">T{order.tableNumber ?? '?'}</span>
          <span className="text-xs font-bold text-ink/50 ml-2">#{order.id.slice(-6).toUpperCase()}</span>
        </div>
        <div className={cn('flex items-center gap-1 font-display font-black text-xl', timerColor)}>
          <Clock size={18} /> {display}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4 flex-1">
        {order.items.map((item: any) => (
          <div key={item.id} className="flex items-start justify-between bg-white/70 rounded-xl px-3 py-2.5">
            <div>
              <span className="font-black text-base">{item.quantity}× {item.name}</span>
              {item.notes && <p className="text-xs text-ink/60 font-semibold mt-0.5">{item.notes}</p>}
            </div>
            {item.status === 'pending' && (
              <button
                onClick={() => onItemStatusChange(order.id, item.id, 'preparing')}
                className="text-xs font-black px-2 py-0.5 rounded-full shrink-0 ml-2 active:scale-95 transition-transform"
                style={{ background: '#7FC4A8', color: 'white' }}
              >
                ▶ Inizia
              </button>
            )}
            {item.status === 'preparing' && (
              <button
                onClick={() => onItemStatusChange(order.id, item.id, 'ready')}
                className="text-xs font-black px-2 py-0.5 rounded-full shrink-0 ml-2 active:scale-95 transition-transform"
                style={{ background: '#F5C065', color: '#2A1F1A' }}
              >
                ✓ Pronto
              </button>
            )}
            {(item.status === 'ready' || item.status === 'served') && (
              <span className="text-xs font-black px-2 py-0.5 rounded-full shrink-0 ml-2" style={{ background: '#7FC4A8', color: 'white' }}>
                {ITEM_STATUS_LABELS[item.status] ?? item.status}
              </span>
            )}
          </div>
        ))}
      </div>

      {order.notes && (
        <p className="text-sm bg-sun/30 rounded-xl px-3 py-2 font-semibold mb-4">📝 {order.notes}</p>
      )}

      {/* Bump */}
      <button
        onClick={handleBump}
        className={cn(
          'w-full py-4 rounded-xl font-display font-black text-base transition-all flex items-center justify-center gap-2 active:scale-95 select-none',
          order.status === 'preparing' ? 'bg-mint text-white' : 'bg-coral text-white'
        )}
        style={{ boxShadow: '0 5px 0 rgba(0,0,0,0.2)' }}
      >
        <CheckCircle2 size={20} />
        {BUMP_LABEL[order.status] ?? 'AVANTI'}
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function KdsPage() {
  const qc = useQueryClient()
  const [station, setStation] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('kds-station') ?? 'all'
    return 'all'
  })
  const [compact, setCompact] = useState(false)
  const initialized = useRef(false)

  const { data: orders = [] } = useQuery({
    queryKey: ['active-orders'],
    queryFn: () => api.get('/orders/active').then(r => r.data.data),
    refetchInterval: 5000,
  })

  // Persist station filter
  useEffect(() => {
    localStorage.setItem('kds-station', station)
  }, [station])

  // Real-time socket updates
  useEffect(() => {
    socket.on('order:new', (order: any) => {
      qc.setQueryData(['active-orders'], (old: any[]) => [order, ...(old ?? [])])
      playDing()
      vibrate([200])
    })
    socket.on('order:updated', ({ orderId, status, itemId, itemStatus }: any) => {
      if (['paid', 'cancelled'].includes(status)) {
        qc.setQueryData(['active-orders'], (old: any[]) => old?.filter(o => o.id !== orderId) ?? [])
      } else {
        qc.setQueryData(['active-orders'], (old: any[]) =>
          old?.map(o => {
            if (o.id !== orderId) return o
            const updatedOrder = { ...o, status }
            if (itemId && itemStatus) {
              updatedOrder.items = o.items.map((i: any) => i.id === itemId ? { ...i, status: itemStatus } : i)
            }
            return updatedOrder
          }) ?? []
        )
      }
    })
    return () => { socket.off('order:new'); socket.off('order:updated') }
  }, [qc])

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-orders'] }),
  })

  const bumpItemMutation = useMutation({
    mutationFn: ({ orderId, itemId, status }: { orderId: string; itemId: string; status: string }) =>
      api.patch(`/orders/${orderId}/items/${itemId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-orders'] }),
  })

  const stations = ['all', ...Array.from(new Set(orders.flatMap((o: any) => o.items.map((i: any) => i.kitchenStation).filter(Boolean))) as Set<string>)]
  const filtered = station === 'all' ? orders : orders.filter((o: any) => o.items.some((i: any) => i.kitchenStation === station))

  const pendingCount = filtered.filter((o: any) => o.status === 'pending').length
  const preparingCount = filtered.filter((o: any) => ['confirmed', 'preparing'].includes(o.status)).length
  const readyCount = filtered.filter((o: any) => o.status === 'ready').length

  return (
    <div className="p-6 min-h-screen bg-ink">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="font-display font-black text-3xl text-cream">Cucina</h1>

        {/* Counters */}
        <div className="flex gap-2">
          <span className="px-3 py-1 rounded-xl bg-coral/20 text-coral font-display font-black text-sm">
            {pendingCount} in attesa
          </span>
          <span className="px-3 py-1 rounded-xl bg-sun/20 text-sun font-display font-black text-sm">
            {preparingCount} in corso
          </span>
          {readyCount > 0 && (
            <span className="px-3 py-1 rounded-xl bg-mint/30 text-mint font-display font-black text-sm animate-pulse">
              {readyCount} pronti
            </span>
          )}
        </div>

        {/* Station filter */}
        <div className="flex gap-2 ml-auto flex-wrap">
          {stations.map(s => (
            <button
              key={s}
              onClick={() => setStation(s)}
              className={cn('px-3 py-1.5 rounded-xl text-sm font-black transition-all', station === s ? 'bg-coral text-white' : 'bg-white/10 text-cream/70 hover:bg-white/20')}
            >
              {s === 'all' ? 'Tutto' : s}
            </button>
          ))}
        </div>

        {/* Compact toggle */}
        <button
          onClick={() => setCompact(v => !v)}
          className={cn('p-2 rounded-xl transition-all', compact ? 'bg-coral text-white' : 'bg-white/10 text-cream/70')}
          title={compact ? 'Vista espansa' : 'Vista compatta'}
        >
          {compact ? <LayoutGrid size={18} /> : <List size={18} />}
        </button>
      </div>

      {/* Cards */}
      {compact ? (
        <div className="space-y-2">
          {filtered.map((order: any) => (
            <KdsCard key={order.id} order={order} compact={true} onStatusChange={(id, s) => statusMutation.mutate({ orderId: id, status: s })} onItemStatusChange={(oId, iId, s) => bumpItemMutation.mutate({ orderId: oId, itemId: iId, status: s })} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((order: any) => (
            <KdsCard key={order.id} order={order} compact={false} onStatusChange={(id, s) => statusMutation.mutate({ orderId: id, status: s })} onItemStatusChange={(oId, iId, s) => bumpItemMutation.mutate({ orderId: oId, itemId: iId, status: s })} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-24 text-cream/30 font-display font-black text-3xl">
          Nessun ordine attivo 🎉
        </div>
      )}
    </div>
  )
}
