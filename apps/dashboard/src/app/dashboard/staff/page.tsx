'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Plus, UserX } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-coral/20 text-coral-deep', manager: 'bg-sun/30 text-ink',
  waiter: 'bg-mint/20 text-ink', chef: 'bg-sky/30 text-ink', cashier: 'bg-ink/10 text-ink',
}

export default function StaffPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'waiter', pin: '', password: '' })

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get('/staff').then(r => r.data.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/staff', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); setShowAdd(false); toast.success('Staff aggiunto') },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/staff/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black text-3xl">Staff</h1>
        <button onClick={() => setShowAdd(true)} className="btn-coral flex items-center gap-2"><Plus size={16} /> Aggiungi</button>
      </div>

      {showAdd && (
        <div className="card mb-6 border-coral/40">
          <h2 className="font-display font-black text-xl mb-4">Nuovo membro</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="label">Nome</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div>
              <label className="label">Ruolo</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {['manager', 'waiter', 'chef', 'cashier'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><label className="label">PIN (4 cifre, per tablet)</label><input className="input" maxLength={4} value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Password (opzionale per accesso web)</label><input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate(form)} className="btn-coral px-5 py-2">Salva</button>
            <button onClick={() => setShowAdd(false)} className="btn-outline px-5 py-2">Annulla</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.map((member: any) => (
          <div key={member.id} className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-coral/20 grid place-items-center font-display font-black text-coral-deep text-xl">
              {member.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black truncate">{member.name}</p>
              <p className="text-xs text-ink/50 font-semibold truncate">{member.email}</p>
              <span className={cn('badge mt-1', ROLE_COLORS[member.role] ?? 'bg-ink/10')}>{member.role}</span>
            </div>
            {member.role !== 'owner' && (
              <button onClick={() => deleteMutation.mutate(member.id)} className="text-ink/30 hover:text-red-500 transition-colors">
                <UserX size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
