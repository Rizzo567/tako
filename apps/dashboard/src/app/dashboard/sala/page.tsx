'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { socket } from '@/lib/socket'
import { cn, formatEuro } from '@/lib/utils'
import { Users, Plus, Clock, X, Receipt, Sparkles, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

type TableStatus = 'free' | 'occupied' | 'waiting' | 'cleaning' | 'reserved'
type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'

const STATUS_LABELS: Record<TableStatus, string> = {
  free: 'Libero', occupied: 'Occupato', waiting: 'In attesa', cleaning: 'Pulizia', reserved: 'Riservato',
}
const STATUS_COLORS: Record<TableStatus, string> = {
  free: 'bg-ink/5 border-ink/20 text-ink/50',
  occupied: 'bg-sun/20 border-sun text-ink',
  waiting: 'bg-coral/20 border-coral text-coral-deep',
  cleaning: 'bg-sky/30 border-sky text-ink',
  reserved: 'bg-mint/20 border-mint text-ink',
}
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'In attesa', confirmed: 'Confermato', preparing: 'In preparazione',
  ready: 'Pronto', served: 'Servito', paid: 'Pagato', cancelled: 'Annullato',
}
const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-sun/30 text-ink',
  confirmed: 'bg-sky/30 text-ink',
  preparing: 'bg-coral/20 text-coral-deep',
  ready: 'bg-mint/30 text-ink',
  served: 'bg-ink/10 text-ink/60',
  paid: 'bg-ink/5 text-ink/40',
  cancelled: 'bg-ink/5 text-ink/30',
}

function elapsed(openedAt: string | null): string {
  if (!openedAt) return ''
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ─── Table detail modal ───────────────────────────────────────────────────────

function TableModal({ table, onClose }: { table: any; onClose: () => void }) {
  const router = useRouter()
  const qc = useQueryClient()

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['table-orders', table.id],
    queryFn: () => api.get(`/orders/table/${table.id}`).then(r => r.data.data),
  })

  const activeOrders = orders.filter((o: any) =>
    ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
  )

  const total = activeOrders.reduce((sum: number, o: any) => {
    const orderTotal = (o.items ?? []).reduce((s: number, item: any) => s + item.unitPrice * item.quantity, 0)
    return sum + orderTotal
  }, 0)

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: TableStatus }) =>
      api.patch(`/tables/${table.id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      onClose()
    },
  })

  const hasReadyOrders = activeOrders.some((o: any) => o.status === 'ready')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60"
      onClick={onClose}
    >
      <div
        className="bg-cream rounded-2xl border-2 border-ink w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ boxShadow: '6px 6px 0 #2A1F1A' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ink/10">
          <div>
            <h2 className="font-display font-black text-2xl">Tavolo {table.number}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn('badge', STATUS_COLORS[table.status as TableStatus])}>
                {STATUS_LABELS[table.status as TableStatus]}
              </span>
              {table.openedAt && (
                <span className="flex items-center gap-1 text-xs font-bold text-ink/50">
                  <Clock size={11} /> {elapsed(table.openedAt)}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs font-bold text-ink/50">
                <Users size={11} /> {table.seats} posti
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-ink/10 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Orders list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
            </div>
          )}

          {!isLoading && activeOrders.length === 0 && (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🍽️</p>
              <p className="font-display font-black text-ink/40">Nessun ordine attivo</p>
            </div>
          )}

          {activeOrders.map((order: any) => (
            <div key={order.id} className="bg-white rounded-xl border-2 border-ink/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display font-black text-sm">Ordine #{order.id.slice(-6).toUpperCase()}</span>
                <span className={cn('badge text-xs', ORDER_STATUS_COLORS[order.status as OrderStatus])}>
                  {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                </span>
              </div>
              <ul className="space-y-1">
                {(order.items ?? []).map((item: any) => (
                  <li key={item.id} className="flex justify-between text-sm font-semibold text-ink/70">
                    <span>{item.quantity}× {item.name}</span>
                    <span>{formatEuro(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        {activeOrders.length > 0 && (
          <div className="p-4 border-t border-ink/10 bg-white rounded-b-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-black text-sm text-ink/60">Totale parziale</span>
              <span className="font-display font-black text-xl">{formatEuro(total)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/dashboard/cassa?tableId=${table.id}`)}
                className="btn-coral flex-1 py-2.5 text-sm"
              >
                <Receipt size={15} /> Apri conto
              </button>
              <button
                onClick={() => statusMutation.mutate({ status: 'cleaning' })}
                disabled={statusMutation.isPending}
                className="btn-outline px-4 py-2.5 text-sm"
              >
                <Sparkles size={15} /> Segna pulito
              </button>
            </div>
          </div>
        )}

        {activeOrders.length === 0 && table.status !== 'free' && (
          <div className="p-4 border-t border-ink/10 flex gap-2">
            <button
              onClick={() => statusMutation.mutate({ status: 'free' })}
              disabled={statusMutation.isPending}
              className="btn-outline flex-1 py-2.5 text-sm"
            >
              Libera tavolo
            </button>
            <button
              onClick={() => statusMutation.mutate({ status: 'cleaning' })}
              disabled={statusMutation.isPending}
              className="btn-outline px-4 py-2.5 text-sm"
            >
              <Sparkles size={15} /> Pulizia
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SalaPage() {
  const qc = useQueryClient()
  const [selectedTable, setSelectedTable] = useState<any | null>(null)
  const [calledTables, setCalledTables] = useState<Set<string>>(new Set())
  const [readyTables, setReadyTables] = useState<Set<string>>(new Set())

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/tables/rooms').then(r => r.data.data),
  })

  // Fetch active orders to know which tables have ready orders
  const { data: activeOrders = [] } = useQuery({
    queryKey: ['active-orders'],
    queryFn: () => api.get('/orders/active').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    const ready = new Set<string>()
    activeOrders.forEach((o: any) => {
      if (o.status === 'ready' && o.tableId) ready.add(o.tableId)
    })
    setReadyTables(ready)
  }, [activeOrders])

  // Real-time updates
  useEffect(() => {
    socket.on('table:updated', ({ tableId, status }: { tableId: string; status: TableStatus }) => {
      qc.setQueryData(['rooms'], (old: any[]) =>
        old?.map(room => ({
          ...room,
          tables: room.tables.map((t: any) => t.id === tableId ? { ...t, status } : t),
        })) ?? []
      )
    })
    socket.on('waiter:called', ({ tableId, tableNumber, type }: any) => {
      toast(`🔔 T${tableNumber} chiama: ${type}`, { duration: 8000 })
      setCalledTables(prev => new Set(prev).add(tableId))
      setTimeout(() => {
        setCalledTables(prev => { const n = new Set(prev); n.delete(tableId); return n })
      }, 30000)
    })
    socket.on('order:updated', ({ status }: any) => {
      qc.invalidateQueries({ queryKey: ['active-orders'] })
      if (selectedTable) qc.invalidateQueries({ queryKey: ['table-orders', selectedTable.id] })
    })
    return () => {
      socket.off('table:updated')
      socket.off('waiter:called')
      socket.off('order:updated')
    }
  }, [qc, selectedTable])

  const statusMutation = useMutation({
    mutationFn: ({ tableId, status }: { tableId: string; status: TableStatus }) =>
      api.patch(`/tables/${tableId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  })

  const nextStatus: Record<TableStatus, TableStatus> = {
    free: 'occupied', occupied: 'cleaning', cleaning: 'free', waiting: 'occupied', reserved: 'occupied',
  }

  // Skeleton
  if (isLoading) return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="skeleton h-8 w-24 mb-2" />
          <div className="skeleton h-4 w-48" />
        </div>
      </div>
      {[1, 2].map(i => (
        <div key={i} className="mb-8">
          <div className="skeleton h-6 w-32 mb-4" />
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  // Empty state
  if (rooms.length === 0) return (
    <div className="p-8 text-center py-20">
      <p className="text-5xl mb-4">🪑</p>
      <p className="font-display font-black text-xl text-ink/40 mb-2">Nessuna sala configurata</p>
      <p className="text-sm text-ink/50 font-semibold mb-6">Crea la tua prima sala e aggiungi i tavoli</p>
      <Link href="/dashboard/sala/tavoli" className="btn-coral px-6 py-3 inline-flex items-center gap-2">
        <Plus size={16} /> Gestione Tavoli
      </Link>
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-black text-3xl">Sala</h1>
          <p className="text-ink/60 font-semibold mt-1">Stato live di tutti i tavoli</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs font-bold flex-wrap">
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <span key={k} className={cn('px-2 py-1 rounded-lg border-2', STATUS_COLORS[k as TableStatus])}>{v}</span>
            ))}
          </div>
          <Link href="/dashboard/sala/tavoli" className="btn-outline text-sm px-3 py-2 flex items-center gap-1.5">
            Gestisci <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {rooms.map((room: any) => (
        <div key={room.id} className="mb-10">
          <h2 className="font-display font-black text-xl mb-4 text-ink/70">{room.name}</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {(room.tables ?? []).map((table: any) => {
              const isCalled = calledTables.has(table.id)
              const hasReady = readyTables.has(table.id)
              const isOccupied = ['occupied', 'waiting'].includes(table.status)

              return (
                <button
                  key={table.id}
                  onClick={() => {
                    if (isOccupied) {
                      // dismiss waiter call on open
                      setCalledTables(prev => { const n = new Set(prev); n.delete(table.id); return n })
                      setSelectedTable(table)
                    } else {
                      statusMutation.mutate({ tableId: table.id, status: nextStatus[table.status as TableStatus] })
                    }
                  }}
                  className={cn(
                    'rounded-2xl p-4 border-2 text-left transition-all hover:scale-105 active:scale-95 relative',
                    STATUS_COLORS[table.status as TableStatus],
                    isCalled && 'animate-pulse ring-2 ring-coral ring-offset-2',
                  )}
                  style={{ boxShadow: '3px 3px 0 rgba(42,31,26,0.15)' }}
                >
                  {/* Waiter call indicator */}
                  {isCalled && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-coral rounded-full border-2 border-white animate-bounce" />
                  )}
                  {/* Ready order indicator */}
                  {hasReady && !isCalled && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-mint rounded-full border-2 border-white" />
                  )}

                  <div className="font-display font-black text-2xl mb-1">T{table.number}</div>
                  <div className="flex items-center gap-1 text-xs font-bold opacity-70">
                    <Users size={10} /> {table.seats}
                  </div>
                  {table.openedAt && isOccupied && (
                    <div className="flex items-center gap-1 text-xs font-black mt-1 opacity-80">
                      <Clock size={10} /> {elapsed(table.openedAt)}
                    </div>
                  )}
                  <div className="text-xs font-black mt-2 opacity-80">{STATUS_LABELS[table.status as TableStatus]}</div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {selectedTable && (
        <TableModal
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  )
}
