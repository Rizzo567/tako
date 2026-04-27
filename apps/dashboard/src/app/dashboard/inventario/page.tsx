'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Plus, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function InventarioPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', unit: 'kg', quantity: '0', minQuantity: '0', supplier: '' })

  const { data: items = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: () => api.get('/inventory/alerts').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); setShowAdd(false); toast.success('Ingrediente aggiunto') },
  })

  const movementMutation = useMutation({
    mutationFn: ({ itemId, type, quantity }: { itemId: string; type: string; quantity: number }) =>
      api.post(`/inventory/${itemId}/movements`, { type, quantity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black text-3xl">Inventario</h1>
        <button onClick={() => setShowAdd(true)} className="btn-coral flex items-center gap-2"><Plus size={16} /> Aggiungi</button>
      </div>

      {alerts.length > 0 && (
        <div className="bg-coral/10 border-2 border-coral rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle size={18} className="text-coral" /><p className="font-display font-black text-coral">Scorte basse</p></div>
          {alerts.map((a: any) => <p key={a.id} className="text-sm font-semibold text-coral-deep">• {a.name}: {a.quantity} {a.unit} rimasti</p>)}
        </div>
      )}

      {showAdd && (
        <div className="card mb-6 border-coral/30">
          <h2 className="font-display font-black text-xl mb-4">Nuovo ingrediente</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="label">Nome</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="label">Unità</label><select className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>{['kg', 'g', 'litri', 'ml', 'pz', 'confezioni'].map(u => <option key={u}>{u}</option>)}</select></div>
            <div><label className="label">Quantità iniziale</label><input className="input" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
            <div><label className="label">Soglia minima</label><input className="input" type="number" value={form.minQuantity} onChange={e => setForm(f => ({ ...f, minQuantity: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Fornitore</label><input className="input" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate({ ...form, quantity: parseFloat(form.quantity), minQuantity: parseFloat(form.minQuantity) })} className="btn-coral px-5 py-2">Salva</button>
            <button onClick={() => setShowAdd(false)} className="btn-outline px-5 py-2">Annulla</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item: any) => {
          const isLow = item.quantity <= item.minQuantity
          return (
            <div key={item.id} className={cn('card flex items-center gap-4', isLow && 'border-coral/50')}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display font-black">{item.name}</p>
                  {isLow && <AlertTriangle size={14} className="text-coral" />}
                </div>
                <p className="text-sm font-bold"><span className={cn('text-2xl font-display font-black', isLow ? 'text-coral' : 'text-ink')}>{item.quantity}</span> {item.unit}</p>
                {item.supplier && <p className="text-xs text-ink/50 font-semibold">{item.supplier}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => movementMutation.mutate({ itemId: item.id, type: 'load', quantity: 1 })} className="w-9 h-9 rounded-xl border-2 border-mint grid place-items-center text-mint font-black hover:bg-mint/10">+</button>
                <button onClick={() => movementMutation.mutate({ itemId: item.id, type: 'unload', quantity: 1 })} className="w-9 h-9 rounded-xl border-2 border-ink/20 grid place-items-center font-black hover:bg-ink/5">−</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
