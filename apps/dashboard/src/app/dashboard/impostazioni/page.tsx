'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

export default function ImpostazioniPage() {
  const qc = useQueryClient()
  const { data: restaurant } = useQuery({
    queryKey: ['restaurant-me'],
    queryFn: () => api.get('/restaurants/me').then(r => r.data.data),
  })

  const [form, setForm] = useState({ name: '', address: '', phone: '', primaryColor: '#ED7159' })

  useEffect(() => {
    if (restaurant) setForm({ name: restaurant.name ?? '', address: restaurant.address ?? '', phone: restaurant.phone ?? '', primaryColor: restaurant.primaryColor ?? '#ED7159' })
  }, [restaurant])

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch('/restaurants/me', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant-me'] }); toast.success('Salvato!') },
  })

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display font-black text-3xl mb-8">Impostazioni</h1>

      <div className="card">
        <h2 className="font-display font-black text-xl mb-5">Dati ristorante</h2>
        <div className="space-y-4">
          <div><label className="label">Nome ristorante</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Indirizzo</label><input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div><label className="label">Telefono</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div>
            <label className="label">Colore brand</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="w-12 h-12 rounded-xl border-2 border-ink/20 cursor-pointer" />
              <span className="font-mono font-bold text-ink/60">{form.primaryColor}</span>
            </div>
          </div>
          <button onClick={() => saveMutation.mutate(form)} className="btn-coral px-6 py-3 mt-2">
            Salva modifiche
          </button>
        </div>
      </div>
    </div>
  )
}
