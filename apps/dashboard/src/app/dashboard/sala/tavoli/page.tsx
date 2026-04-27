'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Plus, QrCode, RefreshCw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TavoliPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [qrModal, setQrModal] = useState<{ qrDataUrl: string; tableNumber: string; url: string } | null>(null)
  const [form, setForm] = useState({ number: '', seats: '4', roomId: '' })

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/tables/rooms').then(r => r.data.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/tables', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); setShowAdd(false); setForm({ number: '', seats: '4', roomId: '' }); toast.success('Tavolo aggiunto') },
  })

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

  const allTables = rooms.flatMap((r: any) => r.tables ?? [])

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
                {rooms.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate({ ...form, seats: parseInt(form.seats), roomId: form.roomId || undefined })} disabled={!form.number} className="btn-coral px-5 py-2">Aggiungi</button>
            <button onClick={() => setShowAdd(false)} className="btn-outline px-5 py-2">Annulla</button>
          </div>
        </div>
      )}

      {rooms.map((room: any) => (
        <div key={room.id} className="mb-8">
          <h2 className="font-display font-black text-xl mb-4 text-ink/70">{room.name}</h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {(room.tables ?? []).map((table: any) => (
              <div key={table.id} className="card flex flex-col items-center text-center gap-3 py-5">
                <div className="font-display font-black text-4xl">T{table.number}</div>
                <p className="text-sm text-ink/50 font-semibold">{table.seats} posti</p>
                <button onClick={() => showQr(table.id)} className="btn-coral w-full text-sm py-2 flex items-center justify-center gap-1.5">
                  <QrCode size={14} /> Mostra QR
                </button>
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
    </div>
  )
}
