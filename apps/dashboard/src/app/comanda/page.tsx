'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Users, ChevronLeft, ShoppingBag } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useComandaStore } from '@/lib/comanda-store'

type TableStatus = 'free' | 'occupied' | 'waiting' | 'cleaning' | 'reserved'

type TableLite = {
  id: string
  number: string
  seats: number
  status: TableStatus
  openedAt: string | null
}

type Room = {
  id: string
  name: string
  tables: TableLite[]
}

const STATUS_LABELS: Record<TableStatus, string> = {
  free: 'Libero',
  occupied: 'Occupato',
  waiting: 'In attesa',
  cleaning: 'Pulizia',
  reserved: 'Riservato',
}

const STATUS_COLORS: Record<TableStatus, string> = {
  free: 'bg-ink/5 border-ink/20 text-ink/60',
  occupied: 'bg-sun/20 border-sun text-ink',
  waiting: 'bg-coral/20 border-coral text-coral-deep',
  cleaning: 'bg-sky/30 border-sky text-ink',
  reserved: 'bg-mint/20 border-mint text-ink',
}

export default function ComandaPage() {
  const router = useRouter()
  const carts = useComandaStore((s) => s.carts)

  const { data: rooms = [], isLoading, isError } = useQuery<Room[]>({
    queryKey: ['comanda-rooms'],
    queryFn: () => api.get('/tables/rooms').then((r) => r.data.data),
  })

  function openTable(table: TableLite, roomName: string) {
    const params = new URLSearchParams({
      number: table.number,
      room: roomName,
    })
    router.push(`/comanda/${table.id}?${params.toString()}`)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm font-display font-black text-ink/70 hover:text-coral transition-colors"
        >
          <ChevronLeft size={18} /> Dashboard
        </Link>
        <h1 className="font-display font-black text-xl">Seleziona tavolo</h1>
      </div>

      {isLoading && (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i}>
              <div className="skeleton h-5 w-24 mb-3" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="skeleton h-24 rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="font-display font-black text-ink/60">Errore nel caricare i tavoli</p>
        </div>
      )}

      {!isLoading && !isError && rooms.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🪑</p>
          <p className="font-display font-black text-ink/50">Nessuna sala configurata</p>
        </div>
      )}

      <div className="space-y-6">
        {rooms.map((room) => (
          <section key={room.id}>
            <h2 className="font-display font-black text-base text-ink/70 mb-3 px-1">
              {room.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(room.tables ?? []).map((table) => {
                const cartCount = (carts[table.id] ?? []).reduce(
                  (sum, i) => sum + i.quantity,
                  0,
                )
                return (
                  <button
                    key={table.id}
                    onClick={() => openTable(table, room.name)}
                    className={cn(
                      'rounded-2xl border-2 p-4 text-left active:scale-95 transition-transform relative',
                      STATUS_COLORS[table.status],
                    )}
                    style={{ boxShadow: '3px 3px 0 rgba(42,31,26,0.15)' }}
                  >
                    {cartCount > 0 && (
                      <span
                        className="absolute -top-2 -right-2 bg-coral text-white font-black text-xs px-2 py-1 rounded-full border-2 border-white flex items-center gap-1"
                        style={{ boxShadow: '2px 2px 0 rgba(42,31,26,0.2)' }}
                      >
                        <ShoppingBag size={12} /> {cartCount}
                      </span>
                    )}
                    <div className="font-display font-black text-3xl mb-1">
                      T{table.number}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold opacity-70">
                      <Users size={11} /> {table.seats} posti
                    </div>
                    <div className="text-[11px] font-black mt-2 opacity-80 uppercase tracking-wider">
                      {STATUS_LABELS[table.status]}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
