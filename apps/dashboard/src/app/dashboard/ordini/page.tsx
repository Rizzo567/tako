'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useMemo } from 'react'
import { api } from '@/lib/api'
import { socket } from '@/lib/socket'
import { formatDate, formatEuro, cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import {
  Search, ChevronDown, ChevronUp, Clock, ShoppingBag,
  ChevronRight, Filter, ClipboardList,
} from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  pending: 'In attesa', confirmed: 'Confermato', preparing: 'In preparazione',
  ready: 'Pronto', served: 'Servito', paid: 'Pagato', cancelled: 'Annullato',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-coral/20 text-coral-deep', confirmed: 'bg-sun/20 text-ink',
  preparing: 'bg-sun/30 text-ink', ready: 'bg-mint/30 text-ink',
  served: 'bg-ink/10 text-ink/60', paid: 'bg-mint/10 text-mint', cancelled: 'bg-ink/5 text-ink/40',
}

const FILTER_TABS = [
  { key: 'all', label: 'Tutti' },
  { key: 'pending', label: 'In attesa' },
  { key: 'confirmed', label: 'Confermati' },
  { key: 'preparing', label: 'In preparazione' },
  { key: 'ready', label: 'Pronti' },
  { key: 'served', label: 'Serviti' },
]

const TIME_OPTIONS = [
  { key: 'all', label: 'Tutto' },
  { key: '1h', label: 'Ultima ora' },
  { key: '3h', label: 'Ultime 3 ore' },
]

type Order = {
  id: string
  tableNumber: number | null
  status: string
  total: number
  items: { name: string; quantity: number; price: number }[]
  notes?: string
  createdAt: string
  statusHistory?: { status: string; timestamp: string }[]
}

function canActOnOrders(role: string | undefined) {
  if (!role) return true
  return ['dipendente', 'owner'].includes(role)
}

function OrderCard({
  order,
  onStatusChange,
  isPending,
}: {
  order: Order
  onStatusChange: (orderId: string, status: string) => void
  isPending: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const role = useAuthStore((s) => s.user?.role)
  const canAct = canActOnOrders(role)

  const summaryItems = order.items.slice(0, 2)
  const extraCount = order.items.length - 2

  return (
    <div className="card-sm border border-ink/10 overflow-hidden transition-shadow hover:shadow-md">
      <button
        className="w-full text-left flex items-center gap-3 p-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="font-display font-black text-lg shrink-0 w-10 h-10 rounded-xl bg-coral/10 flex items-center justify-center text-coral-deep">
            {order.tableNumber ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate text-ink">
              {summaryItems.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
              {extraCount > 0 && <span className="text-ink/40 ml-1">+{extraCount}</span>}
            </p>
            <p className="text-xs text-ink/40 font-semibold mt-0.5">{formatDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-display font-black text-base">{formatEuro(order.total)}</span>
          <span className={cn('badge text-xs px-2 py-0.5 rounded-full font-semibold', STATUS_COLOR[order.status])}>
            {STATUS_LABEL[order.status]}
          </span>
          {expanded ? <ChevronUp size={16} className="text-ink/40" /> : <ChevronDown size={16} className="text-ink/40" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-ink/10 px-4 pb-4 pt-3 space-y-4">
          <div className="space-y-1.5">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-ink">
                  <span className="text-coral-deep font-bold mr-1.5">{item.quantity}×</span>
                  {item.name}
                </span>
                <span className="text-ink/60 font-semibold">{formatEuro(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          {order.notes && (
            <p className="text-sm bg-sun/10 rounded-lg px-3 py-2 font-semibold text-ink/80">
              📝 {order.notes}
            </p>
          )}

          {order.statusHistory && order.statusHistory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-ink/40 uppercase tracking-wide">Storico</p>
              <div className="space-y-1">
                {order.statusHistory.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={cn('px-2 py-0.5 rounded-full font-semibold', STATUS_COLOR[h.status])}>
                      {STATUS_LABEL[h.status] ?? h.status}
                    </span>
                    <span className="text-ink/40 font-semibold">{formatDate(h.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canAct && !['paid', 'cancelled', 'served'].includes(order.status) && (
            <div className="flex gap-2 flex-wrap pt-1">
              {order.status === 'pending' && (
                <button
                  onClick={() => onStatusChange(order.id, 'confirmed')}
                  disabled={isPending}
                  className="btn-coral text-sm px-4 py-2"
                >
                  Conferma
                </button>
              )}
              {order.status === 'ready' && (
                <button
                  onClick={() => onStatusChange(order.id, 'served')}
                  disabled={isPending}
                  className="btn-coral text-sm px-4 py-2"
                >
                  Segna Servito
                </button>
              )}
              <button
                onClick={() => onStatusChange(order.id, 'cancelled')}
                disabled={isPending}
                className="btn-outline text-sm px-4 py-2 text-red-500 border-red-200 hover:bg-red-50"
              >
                Annulla
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TableGroup({
  tableNumber,
  orders,
  onStatusChange,
  isPending,
}: {
  tableNumber: string
  orders: Order[]
  onStatusChange: (orderId: string, status: string) => void
  isPending: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="space-y-2">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-2 w-full group"
      >
        <span className="font-display font-black text-sm text-ink/50 uppercase tracking-widest">
          Tavolo {tableNumber === 'null' ? '—' : tableNumber}
        </span>
        <span className="text-xs font-bold text-ink/30 bg-ink/5 rounded-full px-2 py-0.5">
          {orders.length}
        </span>
        <span className="flex-1 h-px bg-ink/10" />
        {collapsed
          ? <ChevronRight size={14} className="text-ink/30 group-hover:text-ink/60 transition-colors" />
          : <ChevronDown size={14} className="text-ink/30 group-hover:text-ink/60 transition-colors" />
        }
      </button>
      {!collapsed && (
        <div className="space-y-2 pl-1">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={onStatusChange}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrdiniPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['active-orders-list'],
    queryFn: () => api.get('/orders/active').then((r) => r.data.data),
    refetchInterval: 10_000,
  })

  useEffect(() => {
    socket.on('order:new', (order: Order) => {
      qc.setQueryData(['active-orders-list'], (old: Order[]) => [order, ...(old ?? [])])
      toast.success(`Nuovo ordine: T${order.tableNumber}`, { icon: '🛎' })
    })
    socket.on('order:updated', ({ orderId, status }: { orderId: string; status: string }) => {
      qc.setQueryData(['active-orders-list'], (old: Order[]) =>
        old?.map((o) => (o.id === orderId ? { ...o, status } : o)) ?? []
      )
    })
    return () => {
      socket.off('order:new')
      socket.off('order:updated')
    }
  }, [qc])

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-orders-list'] }),
    onError: () => toast.error('Errore aggiornamento stato'),
  })

  const filtered = useMemo(() => {
    const now = Date.now()
    const cutoffMs = timeFilter === '1h' ? 60 * 60 * 1000 : timeFilter === '3h' ? 3 * 60 * 60 * 1000 : null

    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      if (cutoffMs && now - new Date(o.createdAt).getTime() > cutoffMs) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const tableStr = o.tableNumber != null ? String(o.tableNumber) : ''
        if (!tableStr.includes(q)) return false
      }
      return true
    })
  }, [orders, statusFilter, timeFilter, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Order[]>()
    for (const order of filtered) {
      const key = String(order.tableNumber ?? 'null')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(order)
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const na = parseInt(a, 10)
      const nb = parseInt(b, 10)
      if (isNaN(na) && isNaN(nb)) return 0
      if (isNaN(na)) return 1
      if (isNaN(nb)) return -1
      return na - nb
    })
  }, [filtered])

  function handleStatusChange(orderId: string, status: string) {
    statusMutation.mutate({ orderId, status })
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display font-black text-3xl text-ink">Ordini live</h1>
        <span className="text-sm font-bold text-ink/40">
          {filtered.length} ordine{filtered.length !== 1 ? 'i' : ''}
        </span>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <input
            className="input pl-9 w-full"
            placeholder="Cerca tavolo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30 pointer-events-none" />
          <select
            className="input pl-8 pr-4 appearance-none cursor-pointer"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTER_TABS.map((tab) => {
          const count = tab.key === 'all'
            ? orders.length
            : orders.filter((o) => o.status === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'shrink-0 text-sm font-bold px-4 py-2 rounded-xl transition-colors whitespace-nowrap',
                statusFilter === tab.key
                  ? 'bg-coral text-white'
                  : 'bg-ink/5 text-ink/60 hover:bg-ink/10'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'ml-1.5 text-xs font-black',
                  statusFilter === tab.key ? 'text-white/80' : 'text-ink/30'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-ink/5 flex items-center justify-center">
            <ClipboardList size={28} className="text-ink/20" />
          </div>
          <div className="text-center">
            <p className="font-display font-black text-xl text-ink/30">Nessun ordine attivo</p>
            <p className="text-sm text-ink/25 mt-1">
              {search || statusFilter !== 'all' || timeFilter !== 'all'
                ? 'Prova a cambiare i filtri'
                : 'Gli ordini appariranno qui in tempo reale'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([tableNumber, tableOrders]) => (
            <TableGroup
              key={tableNumber}
              tableNumber={tableNumber}
              orders={tableOrders}
              onStatusChange={handleStatusChange}
              isPending={statusMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}
