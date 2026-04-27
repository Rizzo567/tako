'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MenuPage() {
  const qc = useQueryClient()
  const [showAddItem, setShowAddItem] = useState<string | null>(null)
  const [newItem, setNewItem] = useState({ name: '', price: '', description: '', allergens: '' })

  const { data: menus = [] } = useQuery({
    queryKey: ['menus'],
    queryFn: () => api.get('/menus').then(r => r.data.data),
  })

  const { data: fullMenu } = useQuery({
    queryKey: ['menu-full', menus[0]?.id],
    queryFn: () => api.get(`/menus/${menus[0]?.id}`).then(r => r.data.data),
    enabled: !!menus[0]?.id,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ itemId, available }: { itemId: string; available: boolean }) =>
      api.patch(`/menus/items/${itemId}/availability`, { available }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-full'] }); toast.success('Aggiornato') },
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/menus/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-full'] }),
  })

  const addItemMutation = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: any }) =>
      api.post(`/menus/sections/${sectionId}/items`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-full'] }); setShowAddItem(null); setNewItem({ name: '', price: '', description: '', allergens: '' }); toast.success('Piatto aggiunto') },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black text-3xl">Menu</h1>
      </div>

      {fullMenu?.sections?.map((section: any) => (
        <div key={section.id} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-black text-2xl">{section.name}</h2>
            <button onClick={() => setShowAddItem(section.id)} className="btn-outline text-sm px-3 py-2 flex items-center gap-1">
              <Plus size={14} /> Aggiungi piatto
            </button>
          </div>

          {showAddItem === section.id && (
            <div className="card mb-4 p-5 border-coral/40">
              <h3 className="font-display font-black mb-3">Nuovo piatto</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="label">Nome *</label><input className="input" value={newItem.name} onChange={e => setNewItem(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="label">Prezzo (€) *</label><input className="input" type="number" step="0.01" value={newItem.price} onChange={e => setNewItem(f => ({ ...f, price: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label">Descrizione</label><input className="input" value={newItem.description} onChange={e => setNewItem(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label">Allergeni (separati da virgola)</label><input className="input" value={newItem.allergens} onChange={e => setNewItem(f => ({ ...f, allergens: e.target.value }))} placeholder="glutine, latte, uova" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => addItemMutation.mutate({ sectionId: section.id, data: { name: newItem.name, price: parseFloat(newItem.price), description: newItem.description, allergens: newItem.allergens.split(',').map(a => a.trim()).filter(Boolean) } })} className="btn-coral text-sm px-4 py-2">Salva</button>
                <button onClick={() => setShowAddItem(null)} className="btn-outline text-sm px-4 py-2">Annulla</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {section.items.map((item: any) => (
              <div key={item.id} className="card-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-ink/10" />}
                  <div className="min-w-0">
                    <p className="font-display font-black truncate">{item.name}</p>
                    {item.description && <p className="text-xs text-ink/60 font-semibold truncate">{item.description}</p>}
                    {item.allergens?.length > 0 && <p className="text-xs text-coral font-bold">{item.allergens.join(', ')}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-display font-black text-xl">{formatEuro(item.price)}</span>
                  <button onClick={() => toggleMutation.mutate({ itemId: item.id, available: !item.available })} className="text-coral hover:text-coral-deep transition-colors">
                    {item.available ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-ink/30" />}
                  </button>
                  <button onClick={() => deleteMutation.mutate(item.id)} className="text-ink/30 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
