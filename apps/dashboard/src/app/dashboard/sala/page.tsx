'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '@/lib/api'
import { socket } from '@/lib/socket'
import { cn } from '@/lib/utils'
import { Users } from 'lucide-react'
import toast from 'react-hot-toast'

type TableStatus = 'free' | 'occupied' | 'waiting' | 'cleaning' | 'reserved'

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

export default function SalaPage() {
  const qc = useQueryClient()
  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/tables/rooms').then(r => r.data.data),
  })

  // Real-time table updates
  useEffect(() => {
    socket.on('table:updated', ({ tableId, status }) => {
      qc.setQueryData(['rooms'], (old: any[]) =>
        old?.map(room => ({
          ...room,
          tables: room.tables.map((t: any) => t.id === tableId ? { ...t, status } : t),
        })) ?? []
      )
    })
    socket.on('waiter:called', ({ tableNumber, type }) => {
      toast(`🔔 T${tableNumber} chiama: ${type}`, { duration: 8000, icon: '🔔' })
    })
    return () => { socket.off('table:updated'); socket.off('waiter:called') }
  }, [qc])

  const statusMutation = useMutation({
    mutationFn: ({ tableId, status }: { tableId: string; status: TableStatus }) =>
      api.patch(`/tables/${tableId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  })

  const nextStatus: Record<TableStatus, TableStatus> = {
    free: 'occupied', occupied: 'cleaning', cleaning: 'free', waiting: 'occupied', reserved: 'occupied',
  }

  if (isLoading) return <div className="p-8"><p className="font-display font-black text-xl">Carico sala...</p></div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-black text-3xl">Sala</h1>
          <p className="text-ink/60 font-semibold mt-1">Stato live di tutti i tavoli</p>
        </div>
        <div className="flex gap-3 text-xs font-bold flex-wrap">
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <span key={k} className={cn('px-2 py-1 rounded-lg border-2', STATUS_COLORS[k as TableStatus])}>{v}</span>
          ))}
        </div>
      </div>

      {rooms.map((room: any) => (
        <div key={room.id} className="mb-8">
          <h2 className="font-display font-black text-xl mb-4">{room.name}</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {room.tables.map((table: any) => (
              <button
                key={table.id}
                onClick={() => statusMutation.mutate({ tableId: table.id, status: nextStatus[table.status as TableStatus] })}
                className={cn('rounded-2xl p-4 border-2 text-left transition-all hover:scale-105 active:scale-95', STATUS_COLORS[table.status as TableStatus])}
                style={{ boxShadow: '3px 3px 0 rgba(42,31,26,0.15)' }}
              >
                <div className="font-display font-black text-2xl mb-1">T{table.number}</div>
                <div className="flex items-center gap-1 text-xs font-bold">
                  <Users size={10} /> {table.seats}
                </div>
                <div className="text-xs font-black mt-2 opacity-80">{STATUS_LABELS[table.status as TableStatus]}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
