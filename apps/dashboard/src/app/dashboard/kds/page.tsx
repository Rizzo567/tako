'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { socket } from '@/lib/socket'
import { cn } from '@/lib/utils'
import { Clock, CheckCircle2 } from 'lucide-react'

function useElapsed(createdAt: string) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = new Date(createdAt).getTime()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [createdAt])
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const STATUS_ITEM_NEXT: Record<string, string> = { pending: 'preparing', preparing: 'ready', ready: 'served' }
const STATUS_COLORS: Record<string, string> = {
  pending: 'border-coral bg-coral/10',
  confirmed: 'border-sun bg-sun/10',
  preparing: 'border-sun bg-sun/10',
  ready: 'border-mint bg-mint/10',
}

function KdsCard({ order, onStatusChange }: { order: any; onStatusChange: (orderId: string, status: string) => void }) {
  const elapsed = useElapsed(order.createdAt)
  const isUrgent = parseInt(elapsed.split(':')[0]!) >= 10

  return (
    <div className={cn('rounded-2xl border-2 p-5 relative', STATUS_COLORS[order.status] ?? 'border-ink/20 bg-white')} style={{ boxShadow: '4px 4px 0 rgba(42,31,26,0.12)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="font-display font-black text-2xl">T{order.tableNumber ?? '?'}</span>
          <span className="text-xs font-bold text-ink/50 ml-2">#{order.id.slice(-6).toUpperCase()}</span>
        </div>
        <div className={cn('flex items-center gap-1 font-display font-black text-lg', isUrgent ? 'text-coral' : 'text-ink/60')}>
          <Clock size={16} /> {elapsed}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        {order.items.map((item: any) => (
          <div key={item.id} className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2">
            <div>
              <span className="font-black text-sm">{item.quantity}× {item.name}</span>
              {item.notes && <p className="text-xs text-ink/60 font-semibold">{item.notes}</p>}
            </div>
            <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{
              background: item.status === 'ready' ? '#7FC4A8' : item.status === 'preparing' ? '#F5C065' : '#FFEEE8',
              color: item.status === 'ready' ? 'white' : '#2A1F1A',
            }}>{item.status}</span>
          </div>
        ))}
      </div>

      {order.notes && <p className="text-xs bg-sun/20 rounded-lg px-3 py-2 font-semibold mb-4">📝 {order.notes}</p>}

      {/* Bump button */}
      <button
        onClick={() => onStatusChange(order.id, STATUS_ITEM_NEXT[order.status] ?? 'served')}
        className={cn('w-full py-3 rounded-xl font-display font-black text-sm transition-all flex items-center justify-center gap-2',
          order.status === 'preparing' ? 'bg-mint text-white hover:bg-mint/80' : 'bg-coral text-white hover:bg-coral-deep'
        )}
        style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.2)' }}
      >
        <CheckCircle2 size={16} />
        {order.status === 'pending' ? 'PRENDI IN CARICO' : order.status === 'preparing' ? 'PRONTO' : 'SERVITO'}
      </button>
    </div>
  )
}

export default function KdsPage() {
  const qc = useQueryClient()
  const [station, setStation] = useState<string>('all')

  const { data: orders = [] } = useQuery({
    queryKey: ['active-orders'],
    queryFn: () => api.get('/orders/active').then(r => r.data.data),
    refetchInterval: 5000,
  })

  useEffect(() => {
    socket.on('order:new', (order) => {
      qc.setQueryData(['active-orders'], (old: any[]) => [order, ...(old ?? [])])
      const audio = new Audio('/sounds/ding.mp3')
      audio.play().catch(() => {})
    })
    socket.on('order:updated', ({ orderId, status }) => {
      if (['paid', 'cancelled'].includes(status)) {
        qc.setQueryData(['active-orders'], (old: any[]) => old?.filter(o => o.id !== orderId) ?? [])
      } else {
        qc.setQueryData(['active-orders'], (old: any[]) => old?.map(o => o.id === orderId ? { ...o, status } : o) ?? [])
      }
    })
    return () => { socket.off('order:new'); socket.off('order:updated') }
  }, [qc])

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-orders'] }),
  })

  const filtered = station === 'all' ? orders : orders.filter((o: any) => o.items.some((i: any) => i.kitchenStation === station))
  const stations = ['all', ...Array.from(new Set(orders.flatMap((o: any) => o.items.map((i: any) => i.kitchenStation).filter(Boolean))) as Set<string>)]

  return (
    <div className="p-6 min-h-screen bg-ink">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-black text-3xl text-cream">KDS — Cucina</h1>
        <div className="flex gap-2">
          {stations.map(s => (
            <button key={s} onClick={() => setStation(s)} className={cn('px-3 py-1.5 rounded-xl text-sm font-black transition-all', station === s ? 'bg-coral text-white' : 'bg-white/10 text-cream/70 hover:bg-white/20')}>
              {s === 'all' ? 'Tutto' : s}
            </button>
          ))}
        </div>
        <div className="font-display font-black text-cream/60">
          {filtered.length} ordini attivi
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((order: any) => (
          <KdsCard
            key={order.id}
            order={order}
            onStatusChange={(orderId, status) => statusMutation.mutate({ orderId, status })}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-20 text-cream/40 font-display font-black text-2xl">
            Nessun ordine attivo 🎉
          </div>
        )}
      </div>
    </div>
  )
}
