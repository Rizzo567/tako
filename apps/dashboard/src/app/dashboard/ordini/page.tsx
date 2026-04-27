'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '@/lib/api'
import { socket } from '@/lib/socket'
import { formatDate, formatEuro, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUS_LABEL: Record<string, string> = {
  pending: 'In attesa', confirmed: 'Confermato', preparing: 'In preparazione',
  ready: 'Pronto', served: 'Servito', paid: 'Pagato', cancelled: 'Annullato',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-coral/20 text-coral-deep', confirmed: 'bg-sun/20 text-ink',
  preparing: 'bg-sun/30 text-ink', ready: 'bg-mint/30 text-ink',
  served: 'bg-ink/10 text-ink/60', paid: 'bg-mint/10 text-mint', cancelled: 'bg-ink/5 text-ink/40',
}

export default function OrdiniPage() {
  const qc = useQueryClient()
  const { data: orders = [] } = useQuery({
    queryKey: ['active-orders-list'],
    queryFn: () => api.get('/orders/active').then(r => r.data.data),
    refetchInterval: 10_000,
  })

  useEffect(() => {
    socket.on('order:new', (order) => {
      qc.setQueryData(['active-orders-list'], (old: any[]) => [order, ...(old ?? [])])
      toast.success(`Nuovo ordine: T${order.tableNumber}`, { icon: '🛎' })
    })
    socket.on('order:updated', ({ orderId, status }) => {
      qc.setQueryData(['active-orders-list'], (old: any[]) => old?.map(o => o.id === orderId ? { ...o, status } : o) ?? [])
    })
    return () => { socket.off('order:new'); socket.off('order:updated') }
  }, [qc])

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-orders-list'] }),
  })

  return (
    <div className="p-8">
      <h1 className="font-display font-black text-3xl mb-6">Ordini live</h1>
      <div className="space-y-3">
        {orders.map((order: any) => (
          <div key={order.id} className="card">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="font-display font-black text-2xl">T{order.tableNumber ?? 'Asp.'}</div>
                <div>
                  <p className="font-bold text-sm">{order.items?.map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                  <p className="text-xs text-ink/50 font-semibold">{formatDate(order.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-black text-xl">{formatEuro(order.total)}</span>
                <span className={cn('badge', STATUS_COLOR[order.status])}>{STATUS_LABEL[order.status]}</span>
              </div>
            </div>
            {order.notes && <p className="text-sm mt-2 bg-sun/10 rounded-lg px-3 py-1.5 font-semibold">📝 {order.notes}</p>}
            <div className="flex gap-2 mt-4 flex-wrap">
              {order.status === 'pending' && (
                <button onClick={() => statusMutation.mutate({ orderId: order.id, status: 'confirmed' })} className="btn-coral text-sm px-4 py-2">Conferma</button>
              )}
              {order.status === 'ready' && (
                <button onClick={() => statusMutation.mutate({ orderId: order.id, status: 'served' })} className="btn-coral text-sm px-4 py-2">Segna Servito</button>
              )}
              {!['paid', 'cancelled'].includes(order.status) && (
                <button onClick={() => statusMutation.mutate({ orderId: order.id, status: 'cancelled' })} className="btn-outline text-sm px-4 py-2 text-red-600">Annulla</button>
              )}
            </div>
          </div>
        ))}
        {orders.length === 0 && <div className="text-center py-16 text-ink/40 font-display font-black text-xl">Nessun ordine attivo</div>}
      </div>
    </div>
  )
}
