'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Plus, UserX, Phone, Pencil, X } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-coral/20 text-coral-deep',
  dipendente: 'bg-mint/20 text-ink', chef: 'bg-sky/30 text-ink', cassiere: 'bg-ink/10 text-ink',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Titolare', dipendente: 'Dipendente', chef: 'Chef', cassiere: 'Cassiere',
}

type StaffForm = { name: string; email: string; role: string; pin: string; password: string; phone: string }
const emptyForm: StaffForm = { name: '', email: '', role: 'dipendente', pin: '', password: '', phone: '' }

function StaffForm({
  title,
  form,
  onChange,
  onSave,
  onCancel,
  isPending,
  isEdit,
}: {
  title: string
  form: StaffForm
  onChange: (f: StaffForm) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  isEdit?: boolean
}) {
  const f = (k: keyof StaffForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })

  return (
    <div className="card mb-6 border-coral/40">
      <h2 className="font-display font-black text-xl mb-4">{title}</h2>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div><label className="label">Nome</label><input className="input" value={form.name} onChange={f('name')} /></div>
        {!isEdit && <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={f('email')} /></div>}
        <div>
          <label className="label">Ruolo</label>
          <select className="input" value={form.role} onChange={f('role')}>
            {['dipendente', 'chef', 'cassiere'].map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div><label className="label">PIN {isEdit && <span className="font-semibold text-ink/40">(lascia vuoto per non cambiare)</span>}</label><input className="input" maxLength={4} value={form.pin} onChange={f('pin')} /></div>
        <div><label className="label">Telefono</label><input className="input" type="tel" placeholder="+39 333 1234567" value={form.phone} onChange={f('phone')} /></div>
        {!isEdit && <div className="col-span-2"><label className="label">Password (opzionale per accesso web)</label><input className="input" type="password" value={form.password} onChange={f('password')} /></div>}
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={isPending} className="btn-coral px-5 py-2">{isPending ? 'Salvataggio...' : 'Salva'}</button>
        <button onClick={onCancel} className="btn-outline px-5 py-2">Annulla</button>
      </div>
    </div>
  )
}

export default function StaffPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addForm, setAddForm] = useState<StaffForm>(emptyForm)
  const [editForm, setEditForm] = useState<StaffForm>(emptyForm)

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get('/staff').then(r => r.data.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/staff', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); setShowAdd(false); setAddForm(emptyForm); toast.success('Staff aggiunto') },
    onError: () => toast.error('Errore nel salvataggio'),
  })

  const editMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: any }) => api.patch(`/staff/${userId}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); setEditingId(null); toast.success('Modifiche salvate') },
    onError: () => toast.error('Errore nel salvataggio'),
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/staff/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })

  function startEdit(member: any) {
    setEditForm({ name: member.name, email: member.email, role: member.role, pin: '', password: '', phone: member.phone ?? '' })
    setEditingId(member.id)
    setShowAdd(false)
  }

  function saveEdit(userId: string) {
    const payload: any = { name: editForm.name, role: editForm.role as any, phone: editForm.phone || undefined }
    if (editForm.pin) payload.pin = editForm.pin
    editMutation.mutate({ userId, data: payload })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black text-3xl">Staff</h1>
        <button onClick={() => { setShowAdd(true); setEditingId(null) }} className="btn-coral flex items-center gap-2"><Plus size={16} /> Aggiungi</button>
      </div>

      {showAdd && (
        <StaffForm
          title="Nuovo membro"
          form={addForm}
          onChange={setAddForm}
          onSave={() => addMutation.mutate(addForm)}
          onCancel={() => { setShowAdd(false); setAddForm(emptyForm) }}
          isPending={addMutation.isPending}
        />
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.map((member: any) => (
          <div key={member.id}>
            {editingId === member.id ? (
              <StaffForm
                title={`Modifica ${member.name}`}
                form={editForm}
                onChange={setEditForm}
                onSave={() => saveEdit(member.id)}
                onCancel={() => setEditingId(null)}
                isPending={editMutation.isPending}
                isEdit
              />
            ) : (
              <div className="card flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-coral/20 grid place-items-center font-display font-black text-coral-deep text-xl">
                  {member.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black truncate">{member.name}</p>
                  <p className="text-xs text-ink/50 font-semibold truncate">{member.email}</p>
                  {member.phone && (
                    <a href={`tel:${member.phone}`} className="text-xs text-ink/50 font-semibold flex items-center gap-1 hover:text-coral transition-colors">
                      <Phone size={10} />{member.phone}
                    </a>
                  )}
                  <span className={cn('badge mt-1', ROLE_COLORS[member.role] ?? 'bg-ink/10')}>{ROLE_LABELS[member.role] ?? member.role}</span>
                </div>
                {member.role !== 'owner' && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(member)} className="text-ink/30 hover:text-ink transition-colors p-1">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => deleteMutation.mutate(member.id)} className="text-ink/30 hover:text-red-500 transition-colors p-1">
                      <UserX size={15} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
