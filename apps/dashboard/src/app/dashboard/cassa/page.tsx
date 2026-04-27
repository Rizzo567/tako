'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatEuro, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, CreditCard, Banknote } from 'lucide-react'
import toast from 'react-hot-toast'
import { useState } from 'react'

export default function CassaPage() {
  const qc = useQueryClient()
  const [selectedBill, setSelectedBill] = useState<any>(null)
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'digital'>('cash')

  const { data: openBills = [] } = useQuery({
    queryKey: ['open-bills'],
    queryFn: () => api.get('/bills/open').then(r => r.data.data),
    refetchInterval: 10_000,
  })

  const { data: today } = useQuery({
    queryKey: ['today-summary'],
    queryFn: () => api.get('/bills/summary/today').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const payMutation = useMutation({
    mutationFn: ({ billId, amount, method }: { billId: string; amount: number; method: string }) =>
      api.post(`/bills/${billId}/payments`, { amount, method }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-bills'] })
      qc.invalidateQueries({ queryKey: ['today-summary'] })
      setSelectedBill(null)
      toast.success('Pagamento registrato!')
    },
  })

  return (
    <div className="p-8">
      <h1 className="font-display font-black text-3xl mb-6">Cassa</h1>

      {/* Today summary */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="card text-center">
          <p className="text-sm font-bold text-ink/60 mb-1">Incasso oggi</p>
          <p className="font-display font-black text-3xl text-coral">{formatEuro(today?.revenue ?? 0)}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm font-bold text-ink/60 mb-1">Conti chiusi</p>
          <p className="font-display font-black text-3xl">{today?.billsCount ?? 0}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm font-bold text-ink/60 mb-1">Ticket medio</p>
          <p className="font-display font-black text-3xl text-mint">{formatEuro(today?.avgTicket ?? 0)}</p>
        </div>
      </div>

      {/* Open bills */}
      <h2 className="font-display font-black text-xl mb-4">Conti aperti ({openBills.length})</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {openBills.map((bill: any) => (
          <div key={bill.id} className="card hover:border-coral transition-all cursor-pointer" onClick={() => setSelectedBill(bill)}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-display font-black text-xl">T{bill.tableNumber}</p>
                <p className="text-xs text-ink/50 font-semibold">{formatDate(bill.createdAt)}</p>
              </div>
              <p className="font-display font-black text-2xl text-coral">{formatEuro(bill.total)}</p>
            </div>
            <button className="btn-coral w-full text-sm py-2" onClick={(e) => { e.stopPropagation(); setSelectedBill(bill) }}>
              Registra pagamento
            </button>
          </div>
        ))}
        {openBills.length === 0 && <p className="text-ink/40 font-display font-black col-span-full text-center py-10">Nessun conto aperto</p>}
      </div>

      {/* Payment modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="font-display font-black text-2xl mb-2">Conto T{selectedBill.tableNumber}</h2>
            <p className="text-3xl font-display font-black text-coral mb-6">{formatEuro(selectedBill.total)}</p>

            <p className="label mb-2">Metodo di pagamento</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {(['cash', 'card', 'digital'] as const).map(m => (
                <button key={m} onClick={() => setPayMethod(m)} className={cn('py-3 rounded-xl border-2 font-display font-black text-sm flex flex-col items-center gap-1 transition-all', payMethod === m ? 'border-coral bg-coral/10 text-coral-deep' : 'border-ink/20')}>
                  {m === 'cash' ? <Banknote size={20} /> : <CreditCard size={20} />}
                  {m === 'cash' ? 'Contanti' : m === 'card' ? 'Carta' : 'Digitale'}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => payMutation.mutate({ billId: selectedBill.id, amount: selectedBill.total, method: payMethod })} className="btn-coral flex-1 py-3">
                Conferma pagamento
              </button>
              <button onClick={() => setSelectedBill(null)} className="btn-outline px-5 py-3">Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
