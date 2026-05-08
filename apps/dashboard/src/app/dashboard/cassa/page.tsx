'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatEuro, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CreditCard, Banknote, Smartphone, Search, Users, Delete, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// ─── Numeric keypad ───────────────────────────────────────────────────────────

function Keypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function press(key: string) {
    if (key === 'DEL') { onChange(value.slice(0, -1) || '0'); return }
    if (key === '.' && value.includes('.')) return
    if (key === '.' && value === '0') { onChange('0.'); return }
    if (value === '0' && key !== '.') { onChange(key); return }
    if (value.includes('.') && value.split('.')[1]!.length >= 2) return
    onChange(value + key)
  }

  const keys = ['7','8','9','4','5','6','1','2','3','.','0','DEL']

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map(k => (
        <button
          key={k}
          onClick={() => press(k)}
          className={cn(
            'h-14 rounded-xl font-display font-black text-lg transition-all active:scale-95',
            k === 'DEL'
              ? 'bg-ink/10 text-ink/60'
              : 'bg-white border-2 border-ink/15 text-ink hover:border-coral'
          )}
          style={{ boxShadow: k !== 'DEL' ? '2px 2px 0 rgba(42,31,26,0.1)' : undefined }}
        >
          {k === 'DEL' ? <Delete size={18} className="mx-auto" /> : k}
        </button>
      ))}
    </div>
  )
}

// ─── Payment modal ────────────────────────────────────────────────────────────

function PaymentModal({ bill, onClose, onPaid }: { bill: any; onClose: () => void; onPaid: () => void }) {
  const qc = useQueryClient()
  const [method, setMethod] = useState<'cash' | 'card' | 'digital'>('cash')
  const [cashInput, setCashInput] = useState(bill.total.toFixed(2))
  const [splitPeople, setSplitPeople] = useState(1)

  const cashAmount = parseFloat(cashInput) || 0
  const resto = method === 'cash' ? Math.max(0, cashAmount - bill.total) : 0
  const perPerson = splitPeople > 1 ? bill.total / splitPeople : 0

  const payMutation = useMutation({
    mutationFn: () => api.post(`/bills/${bill.id}/payments`, { amount: bill.total, method }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-bills'] })
      qc.invalidateQueries({ queryKey: ['today-summary'] })
      toast.success('Pagamento registrato!')
      onPaid()
    },
    onError: () => toast.error('Errore nel pagamento'),
  })

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-end md:items-center justify-center z-50 p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-cream rounded-t-3xl md:rounded-2xl w-full md:max-w-md max-h-[95vh] overflow-y-auto"
        style={{ boxShadow: '0 -4px 0 rgba(42,31,26,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-black text-2xl">Tavolo {bill.tableNumber}</h2>
              {bill.createdAt && <p className="text-xs text-ink/50 font-semibold">{formatDate(bill.createdAt)}</p>}
            </div>
            <p className="font-display font-black text-3xl text-coral">{formatEuro(bill.total)}</p>
          </div>

          {/* Method tabs */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { id: 'cash', icon: Banknote, label: 'Contanti' },
              { id: 'card', icon: CreditCard, label: 'Carta' },
              { id: 'digital', icon: Smartphone, label: 'Digitale' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setMethod(id as any)}
                className={cn('py-3 rounded-xl border-2 font-display font-black text-sm flex flex-col items-center gap-1 transition-all', method === id ? 'border-coral bg-coral/10 text-coral-deep' : 'border-ink/15 bg-white')}
              >
                <Icon size={20} />
                {label}
              </button>
            ))}
          </div>

          {/* Cash keypad + resto */}
          {method === 'cash' && (
            <div className="mb-5">
              <div className="bg-white rounded-2xl border-2 border-ink/10 p-4 mb-3 text-center">
                <p className="text-xs font-black text-ink/50 mb-1">IMPORTO RICEVUTO</p>
                <p className="font-display font-black text-4xl">€{cashInput}</p>
                {cashAmount >= bill.total && (
                  <p className="text-sm font-black text-mint mt-1">Resto: {formatEuro(resto)}</p>
                )}
                {cashAmount < bill.total && cashAmount > 0 && (
                  <p className="text-sm font-black text-coral mt-1">Mancano: {formatEuro(bill.total - cashAmount)}</p>
                )}
              </div>
              <Keypad value={cashInput} onChange={setCashInput} />
            </div>
          )}

          {/* Split */}
          <div className="bg-white rounded-xl border-2 border-ink/10 p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-display font-black text-sm">
                <Users size={16} /> Dividi il conto
              </div>
              <span className="font-display font-black text-sm text-ink/50">{splitPeople === 1 ? 'Non diviso' : `${splitPeople} persone — ${formatEuro(perPerson)} / persona`}</span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              value={splitPeople}
              onChange={e => setSplitPeople(parseInt(e.target.value))}
              className="w-full accent-coral"
            />
            <div className="flex justify-between text-xs text-ink/40 font-bold mt-1">
              <span>1</span><span>6</span><span>12</span>
            </div>
          </div>

          {/* Confirm */}
          <div className="flex gap-3">
            <button
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending || (method === 'cash' && cashAmount < bill.total)}
              className="btn-coral flex-1 py-3.5 text-base disabled:opacity-50"
            >
              {payMutation.isPending ? 'Registrazione...' : 'Conferma pagamento'}
            </button>
            <button onClick={onClose} className="btn-outline px-5 py-3.5">Annulla</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── New bill modal ───────────────────────────────────────────────────────────

function NewBillModal({ onClose, onCreated }: { onClose: () => void; onCreated: (bill: any) => void }) {
  const { data: tables = [] } = useQuery({
    queryKey: ['tables-list'],
    queryFn: () => api.get('/tables').then(r => r.data.data),
  })
  const [tableId, setTableId] = useState('')

  const createMutation = useMutation({
    mutationFn: () => api.post('/bills', tableId ? { tableId } : {}),
    onSuccess: (res) => onCreated(res.data.data),
    onError: () => toast.error('Errore nella creazione del conto'),
  })

  // Flatten rooms → tables
  const allTables = Array.isArray(tables)
    ? tables.flatMap((r: any) => r.tables ?? [])
    : []

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-cream rounded-2xl border-2 border-ink w-full max-w-sm p-6" style={{ boxShadow: '6px 6px 0 #2A1F1A' }} onClick={e => e.stopPropagation()}>
        <h2 className="font-display font-black text-xl mb-5">Nuovo conto</h2>
        <div className="mb-4">
          <label className="label">Tavolo (opzionale)</label>
          <select className="input" value={tableId} onChange={e => setTableId(e.target.value)}>
            <option value="">— Asporto / senza tavolo —</option>
            {allTables.map((t: any) => (
              <option key={t.id} value={t.id}>Tavolo {t.number}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-coral flex-1 py-3">
            {createMutation.isPending ? 'Creazione...' : 'Crea conto'}
          </button>
          <button onClick={onClose} className="btn-outline px-4 py-3">Annulla</button>
        </div>
      </div>
    </div>
  )
}

// ─── Inner page (uses search params) ─────────────────────────────────────────

function CassaInner() {
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const [selectedBill, setSelectedBill] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [autoOpenTableId, setAutoOpenTableId] = useState<string | null>(null)
  const [showNewBill, setShowNewBill] = useState(false)

  const { data: openBills = [], isLoading } = useQuery({
    queryKey: ['open-bills'],
    queryFn: () => api.get('/bills/open').then(r => r.data.data),
    refetchInterval: 10_000,
  })

  const { data: today } = useQuery({
    queryKey: ['today-summary'],
    queryFn: () => api.get('/bills/summary/today').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const createBillMutation = useMutation({
    mutationFn: (tableId: string) => api.post('/bills', { tableId }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['open-bills'] })
      setSelectedBill(res.data.data)
    },
    onError: () => toast.error('Errore nella creazione del conto'),
  })

  // Auto-open from sala "Apri conto" CTA
  const tableIdParam = searchParams.get('tableId')
  useEffect(() => {
    if (!tableIdParam) return
    const existing = openBills.find((b: any) => b.tableId === tableIdParam)
    if (existing) { setSelectedBill(existing); return }
    if (tableIdParam !== autoOpenTableId) {
      setAutoOpenTableId(tableIdParam)
      createBillMutation.mutate(tableIdParam)
    }
  }, [tableIdParam, openBills])

  const filtered = openBills.filter((b: any) =>
    !search || b.tableNumber?.toString().toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black text-3xl">Cassa</h1>
        <button onClick={() => setShowNewBill(true)} className="btn-coral flex items-center gap-2">
          <Plus size={16} /> Nuovo conto
        </button>
      </div>

      {showNewBill && (
        <NewBillModal
          onClose={() => setShowNewBill(false)}
          onCreated={(bill) => { setShowNewBill(false); setSelectedBill(bill) }}
        />
      )}

      {/* Today KPIs */}
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

      {/* Search + header */}
      <div className="flex items-center gap-4 mb-5">
        <h2 className="font-display font-black text-xl">Conti aperti</h2>
        <span className="badge bg-coral/15 text-coral font-black">{openBills.length}</span>
        <div className="relative ml-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            className="input pl-9 py-2 w-48 text-sm"
            placeholder="Cerca tavolo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Bills grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((bill: any) => (
            <div
              key={bill.id}
              className="card hover:border-coral transition-all cursor-pointer group"
              onClick={() => setSelectedBill(bill)}
              style={{ boxShadow: '4px 4px 0 #2A1F1A' }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-display font-black text-3xl">T{bill.tableNumber}</p>
                  <p className="text-xs text-ink/50 font-semibold">{formatDate(bill.createdAt)}</p>
                </div>
                <p className="font-display font-black text-2xl text-coral">{formatEuro(bill.total)}</p>
              </div>
              <button
                className="btn-coral w-full text-sm py-2.5 group-hover:shadow-none"
                onClick={e => { e.stopPropagation(); setSelectedBill(bill) }}
              >
                Registra pagamento
              </button>
            </div>
          ))}

          {filtered.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-16">
              <p className="text-4xl mb-3">💰</p>
              <p className="font-display font-black text-xl text-ink/40">
                {search ? `Nessun tavolo "${search}"` : 'Nessun conto aperto'}
              </p>
            </div>
          )}
        </div>
      )}

      {selectedBill && (
        <PaymentModal
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
          onPaid={() => setSelectedBill(null)}
        />
      )}
    </div>
  )
}

// ─── Export wrapped in Suspense (required by useSearchParams) ────────────────

export default function CassaPage() {
  return (
    <Suspense>
      <CassaInner />
    </Suspense>
  )
}
