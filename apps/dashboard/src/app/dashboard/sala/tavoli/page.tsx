'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { Plus, QrCode, RefreshCw, Trash2, MoreVertical, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

type Table = {
  id: string
  number: string
  seats: number
  roomId: string | null
  shape: 'round' | 'square' | 'rectangle'
}

type Room = {
  id: string
  name: string
  tables?: Table[]
}

export default function TavoliPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [qrModal, setQrModal] = useState<{ qrDataUrl: string; tableNumber: string; url: string } | null>(null)
  const [form, setForm] = useState({ number: '', seats: '4', roomId: '' })
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editTable, setEditTable] = useState<Table | null>(null)
  const [editForm, setEditForm] = useState({ number: '', seats: '4', roomId: '', shape: 'square' as 'round' | 'square' | 'rectangle' })
  const menuRef = useRef<HTMLDivElement | null>(null)

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: () => api.get('/tables/rooms').then(r => r.data.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/tables', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); setShowAdd(false); setForm({ number: '', seats: '4', roomId: '' }); toast.success('Tavolo aggiunto') },
  })

  const editMutation = useMutation({
    mutationFn: ({ tableId, data }: { tableId: string; data: any }) => api.patch(`/tables/${tableId}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); setEditTable(null); toast.success('Tavolo aggiornato') },
    onError: () => toast.error('Errore aggiornamento tavolo'),
  })

  const deleteMutation = useMutation({
    mutationFn: (tableId: string) => api.delete(`/tables/${tableId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); setConfirmDeleteId(null); toast.success('Tavolo eliminato') },
    onError: () => toast.error('Errore eliminazione tavolo'),
  })

  const refreshQrMutation = useMutation({
    mutationFn: (tableId: string) => api.post(`/tables/${tableId}/qr/refresh`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); toast.success('QR rigenerato') },
    onError: () => toast.error('Errore rigenerazione QR'),
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId])

  async function showQr(tableId: string) {
    try {
      const { data } = await api.get(`/tables/${tableId}/qr`)
      setQrModal(data.data)
    } catch { toast.error('Errore nel caricamento QR') }
  }

  async function addRoom() {
    const name = prompt('Nome sala (es: Interno, Terrazza):')
    if (!name?.trim()) return
    await api.post('/tables/rooms', { name: name.trim() })
    qc.invalidateQueries({ queryKey: ['rooms'] })
    toast.success('Sala aggiunta')
  }

  function openEditModal(table: Table) {
    setEditForm({
      number: table.number,
      seats: String(table.seats),
      roomId: table.roomId ?? '',
      shape: table.shape ?? 'square',
    })
    setEditTable(table)
    setOpenMenuId(null)
  }

  function submitEdit() {
    if (!editTable) return
    editMutation.mutate({
      tableId: editTable.id,
      data: {
        number: editForm.number,
        seats: parseInt(editForm.seats) || 1,
        roomId: editForm.roomId || null,
        shape: editForm.shape,
      },
    })
  }

  const allTables = rooms.flatMap((r) => r.tables ?? [])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black text-3xl">Gestione Tavoli</h1>
        <div className="flex gap-2">
          <button onClick={addRoom} className="btn-outline flex items-center gap-2 text-sm px-4 py-2.5"><Plus size={14} /> Sala</button>
          <button onClick={() => setShowAdd(true)} className="btn-coral flex items-center gap-2"><Plus size={16} /> Tavolo</button>
        </div>
      </div>

      {showAdd && (
        <div className="card mb-6 border-coral/30">
          <h2 className="font-display font-black text-xl mb-4">Nuovo tavolo</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><label className="label">Numero *</label><input className="input" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="1, 2, A..." /></div>
            <div><label className="label">Posti</label><input className="input" type="number" min="1" value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} /></div>
            <div>
              <label className="label">Sala</label>
              <select className="input" value={form.roomId} onChange={e => setForm(f => ({ ...f, roomId: e.target.value }))}>
                <option value="">Nessuna sala</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate({ ...form, seats: parseInt(form.seats), roomId: form.roomId || undefined })} disabled={!form.number} className="btn-coral px-5 py-2">Aggiungi</button>
            <button onClick={() => setShowAdd(false)} className="btn-outline px-5 py-2">Annulla</button>
          </div>
        </div>
      )}

      {rooms.map((room) => (
        <div key={room.id} className="mb-8">
          <h2 className="font-display font-black text-xl mb-4 text-ink/70">{room.name}</h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {(room.tables ?? []).map((table) => (
              <div key={table.id} className="card flex flex-col items-center text-center gap-3 py-5 relative">
                <div className="absolute top-2 right-2" ref={openMenuId === table.id ? menuRef : null}>
                  <button
                    onClick={() => { setOpenMenuId(openMenuId === table.id ? null : table.id); setConfirmDeleteId(null) }}
                    className="p-1.5 rounded-full hover:bg-ink/5 transition"
                    aria-label="Menu tavolo"
                  >
                    <MoreVertical size={18} className="text-ink/60" />
                  </button>
                  {openMenuId === table.id && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border-2 border-ink/10 rounded-2xl shadow-lg overflow-hidden z-20">
                      <button
                        onClick={() => { showQr(table.id); setOpenMenuId(null) }}
                        className="w-full px-4 py-2.5 text-sm font-bold hover:bg-ink/5 flex items-center gap-2 text-left"
                      >
                        <QrCode size={14} /> Mostra QR
                      </button>
                      <button
                        onClick={() => { refreshQrMutation.mutate(table.id); setOpenMenuId(null) }}
                        className="w-full px-4 py-2.5 text-sm font-bold hover:bg-ink/5 flex items-center gap-2 text-left"
                      >
                        <RefreshCw size={14} /> Rigenera QR
                      </button>
                      <button
                        onClick={() => openEditModal(table)}
                        className="w-full px-4 py-2.5 text-sm font-bold hover:bg-ink/5 flex items-center gap-2 text-left"
                      >
                        <Pencil size={14} /> Modifica tavolo
                      </button>
                      <button
                        onClick={() => { setConfirmDeleteId(table.id); setOpenMenuId(null) }}
                        className="w-full px-4 py-2.5 text-sm font-bold hover:bg-coral/10 text-coral flex items-center gap-2 text-left"
                      >
                        <Trash2 size={14} /> Elimina tavolo
                      </button>
                    </div>
                  )}
                </div>

                <div className="font-display font-black text-4xl">T{table.number}</div>
                <p className="text-sm text-ink/50 font-semibold">{table.seats} posti</p>
                {table.shape && table.shape !== 'square' && (
                  <p className="text-xs text-ink/40 font-semibold uppercase">{table.shape === 'round' ? 'Rotondo' : 'Rettangolare'}</p>
                )}

                {confirmDeleteId === table.id && (
                  <div className="absolute inset-0 bg-white/95 rounded-3xl flex flex-col items-center justify-center gap-3 p-4 z-10 border-2 border-coral/30">
                    <p className="font-display font-black text-base text-ink">Eliminare T{table.number}?</p>
                    <p className="text-xs text-ink/50 font-semibold">Azione irreversibile</p>
                    <div className="flex gap-2 w-full mt-1">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="btn-outline flex-1 py-2 text-sm"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(table.id)}
                        disabled={deleteMutation.isPending}
                        className="btn-coral flex-1 py-2 text-sm"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {allTables.length === 0 && !showAdd && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🪑</p>
          <p className="font-display font-black text-xl text-ink/40 mb-4">Nessun tavolo ancora</p>
          <button onClick={() => setShowAdd(true)} className="btn-coral px-6 py-3">Aggiungi il primo tavolo</button>
        </div>
      )}

      {qrModal && (
        <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={() => setQrModal(null)}>
          <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-black text-2xl mb-1">Tavolo {qrModal.tableNumber}</h2>
            <p className="text-xs font-mono text-ink/40 mb-4 break-all">{qrModal.url}</p>
            <img src={qrModal.qrDataUrl} alt="QR Code" className="w-64 h-64 mx-auto mb-5 rounded-2xl border-2 border-ink/10" />
            <div className="flex gap-3">
              <a href={qrModal.qrDataUrl} download={`qr-tavolo-${qrModal.tableNumber}.png`} className="btn-coral flex-1 py-3 text-center">Scarica PNG</a>
              <button onClick={() => setQrModal(null)} className="btn-outline px-5 py-3">Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {editTable && (
        <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={() => setEditTable(null)}>
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-black text-2xl mb-4">Modifica tavolo</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Numero *</label>
                <input className="input" value={editForm.number} onChange={e => setEditForm(f => ({ ...f, number: e.target.value }))} />
              </div>
              <div>
                <label className="label">Posti</label>
                <input className="input" type="number" min="1" value={editForm.seats} onChange={e => setEditForm(f => ({ ...f, seats: e.target.value }))} />
              </div>
              <div>
                <label className="label">Sala</label>
                <select className="input" value={editForm.roomId} onChange={e => setEditForm(f => ({ ...f, roomId: e.target.value }))}>
                  <option value="">Nessuna sala</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Forma</label>
                <select className="input" value={editForm.shape} onChange={e => setEditForm(f => ({ ...f, shape: e.target.value as 'round' | 'square' | 'rectangle' }))}>
                  <option value="square">Quadrato</option>
                  <option value="round">Rotondo</option>
                  <option value="rectangle">Rettangolare</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submitEdit} disabled={!editForm.number || editMutation.isPending} className="btn-coral px-5 py-2">Salva</button>
              <button onClick={() => setEditTable(null)} className="btn-outline px-5 py-2">Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
