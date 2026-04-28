'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2, X, UtensilsCrossed, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Allergen emoji map ───────────────────────────────────────────────────────

const ALLERGEN_EMOJI: Record<string, string> = {
  glutine: '🌾', grano: '🌾', frumento: '🌾',
  latte: '🥛', latticini: '🥛',
  uova: '🥚',
  pesce: '🐟',
  crostacei: '🦐',
  arachidi: '🥜',
  soia: '🫘',
  fruttasecca: '🌰', nocciole: '🌰', mandorle: '🌰', noci: '🌰',
  sedano: '🥬',
  senape: '🟡',
  sesamo: '🌿',
  anidridesolfurosa: '🍷', solfiti: '🍷',
  lupini: '🌱',
  molluschi: '🐚',
}

function allergenEmoji(a: string): string {
  const key = a.toLowerCase().replace(/\s/g, '')
  return ALLERGEN_EMOJI[key] ?? '⚠️'
}

// ─── Item modal (add / edit) ──────────────────────────────────────────────────

type ItemForm = {
  name: string
  price: string
  description: string
  allergens: string
  imageUrl: string
  prepTimeMinutes: string
}

const emptyForm: ItemForm = { name: '', price: '', description: '', allergens: '', imageUrl: '', prepTimeMinutes: '10' }

function ItemModal({
  sectionId,
  item,
  onClose,
}: {
  sectionId: string
  item?: any
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<ItemForm>(
    item
      ? { name: item.name, price: String(item.price), description: item.description ?? '', allergens: (item.allergens ?? []).join(', '), imageUrl: item.imageUrl ?? '', prepTimeMinutes: String(item.prepTimeMinutes ?? 10) }
      : emptyForm
  )

  const f = (k: keyof ItemForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      item
        ? api.patch(`/menus/items/${item.id}`, data)
        : api.post(`/menus/sections/${sectionId}/items`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-full'] })
      toast.success(item ? 'Piatto aggiornato' : 'Piatto aggiunto')
      onClose()
    },
    onError: () => toast.error('Errore nel salvataggio'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.price) return
    saveMutation.mutate({
      name: form.name.trim(),
      price: parseFloat(form.price),
      description: form.description.trim() || undefined,
      allergens: form.allergens.split(',').map(a => a.trim()).filter(Boolean),
      imageUrl: form.imageUrl.trim() || undefined,
      prepTimeMinutes: parseInt(form.prepTimeMinutes) || 10,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60" onClick={onClose}>
      <div
        className="bg-cream rounded-2xl border-2 border-ink w-full max-w-md"
        style={{ boxShadow: '6px 6px 0 #2A1F1A' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-ink/10">
          <h2 className="font-display font-black text-xl">{item ? 'Modifica piatto' : 'Nuovo piatto'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-ink/10 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nome piatto *</label>
              <input className="input" value={form.name} onChange={f('name')} placeholder="es. Spaghetti cacio e pepe" autoFocus />
            </div>
            <div>
              <label className="label">Prezzo (€) *</label>
              <input className="input" type="number" step="0.01" min="0" value={form.price} onChange={f('price')} placeholder="12.50" />
            </div>
            <div>
              <label className="label">Prep. (min)</label>
              <input className="input" type="number" min="1" value={form.prepTimeMinutes} onChange={f('prepTimeMinutes')} />
            </div>
            <div className="col-span-2">
              <label className="label">Descrizione</label>
              <textarea className="input resize-none" rows={2} value={form.description} onChange={f('description')} placeholder="Ingredienti principali, note..." />
            </div>
            <div className="col-span-2">
              <label className="label">Allergeni <span className="font-semibold text-ink/40">(separati da virgola)</span></label>
              <input className="input" value={form.allergens} onChange={f('allergens')} placeholder="glutine, latte, uova" />
              {form.allergens.trim() && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.allergens.split(',').map(a => a.trim()).filter(Boolean).map(a => (
                    <span key={a} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-coral/10 text-coral-deep border border-coral/20">
                      {allergenEmoji(a)} {a}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="label">URL foto</label>
              <input className="input" type="url" value={form.imageUrl} onChange={f('imageUrl')} placeholder="https://..." />
              {form.imageUrl && (
                <img src={form.imageUrl} alt="" className="mt-2 w-full h-32 object-cover rounded-xl border-2 border-ink/10" onError={e => (e.currentTarget.style.display = 'none')} />
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saveMutation.isPending || !form.name || !form.price} className="btn-coral flex-1 py-2.5">
              {saveMutation.isPending ? 'Salvataggio...' : item ? 'Salva modifiche' : 'Aggiungi piatto'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline px-4 py-2.5">Annulla</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── First-time wizard ────────────────────────────────────────────────────────

function EmptyMenuWizard({ onCreated }: { onCreated: () => void }) {
  const qc = useQueryClient()
  const [step, setStep] = useState<'menu' | 'section'>('menu')
  const [menuName, setMenuName] = useState('Menu principale')
  const [sectionName, setSectionName] = useState('')
  const [createdMenuId, setCreatedMenuId] = useState<string | null>(null)

  const createMenuMutation = useMutation({
    mutationFn: () => api.post('/menus', { name: menuName.trim(), type: 'main' }),
    onSuccess: (res) => {
      setCreatedMenuId(res.data.data.id)
      setStep('section')
    },
    onError: () => toast.error('Errore nella creazione del menu'),
  })

  const createSectionMutation = useMutation({
    mutationFn: () => api.post(`/menus/${createdMenuId}/sections`, { name: sectionName.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menus'] })
      qc.invalidateQueries({ queryKey: ['menu-full'] })
      toast.success('Menu creato!')
      onCreated()
    },
    onError: () => toast.error('Errore nella creazione della sezione'),
  })

  return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <div className="card p-8">
        <div className="w-16 h-16 bg-coral/10 rounded-2xl grid place-items-center mx-auto mb-5">
          <UtensilsCrossed size={28} className="text-coral" />
        </div>
        <h2 className="font-display font-black text-2xl mb-2">Crea il tuo menu</h2>
        <p className="text-ink/60 font-semibold text-sm mb-8">Inizia creando il menu principale e la prima sezione.</p>

        {step === 'menu' && (
          <div className="text-left space-y-4">
            <div>
              <label className="label">Nome menu</label>
              <input className="input" value={menuName} onChange={e => setMenuName(e.target.value)} placeholder="Menu principale" />
            </div>
            <button
              onClick={() => createMenuMutation.mutate()}
              disabled={!menuName.trim() || createMenuMutation.isPending}
              className="btn-coral w-full py-3"
            >
              Continua →
            </button>
          </div>
        )}

        {step === 'section' && (
          <div className="text-left space-y-4">
            <p className="text-sm font-bold text-mint bg-mint/10 rounded-xl px-3 py-2">✓ Menu "{menuName}" creato</p>
            <div>
              <label className="label">Prima sezione</label>
              <input className="input" value={sectionName} onChange={e => setSectionName(e.target.value)} placeholder="es. Antipasti, Primi, Bevande..." autoFocus />
            </div>
            <button
              onClick={() => createSectionMutation.mutate()}
              disabled={!sectionName.trim() || createSectionMutation.isPending}
              className="btn-coral w-full py-3"
            >
              Crea sezione e inizia
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const qc = useQueryClient()
  const [itemModal, setItemModal] = useState<{ sectionId: string; item?: any } | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [showAddSection, setShowAddSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [wizardDone, setWizardDone] = useState(false)

  const { data: menus = [], isLoading: loadingMenus } = useQuery({
    queryKey: ['menus'],
    queryFn: () => api.get('/menus').then(r => r.data.data),
  })

  const menuId = menus[0]?.id

  const { data: fullMenu, isLoading: loadingMenu } = useQuery({
    queryKey: ['menu-full', menuId],
    queryFn: () => api.get(`/menus/${menuId}`).then(r => r.data.data),
    enabled: !!menuId,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ itemId, available }: { itemId: string; available: boolean }) =>
      api.patch(`/menus/items/${itemId}/availability`, { available }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['menu-full'] })
      toast.success(vars.available ? 'Disponibile' : 'Non disponibile')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/menus/items/${itemId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-full'] }); toast.success('Piatto rimosso') },
  })

  const addSectionMutation = useMutation({
    mutationFn: () => api.post(`/menus/${menuId}/sections`, { name: newSectionName.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-full'] })
      toast.success('Sezione aggiunta')
      setShowAddSection(false)
      setNewSectionName('')
    },
  })

  function toggleSection(id: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isLoading = loadingMenus || loadingMenu

  // Skeleton
  if (isLoading) return (
    <div className="p-8">
      <div className="skeleton h-9 w-32 mb-8" />
      {[1, 2, 3].map(i => (
        <div key={i} className="mb-8">
          <div className="skeleton h-7 w-40 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => <div key={j} className="skeleton h-16 rounded-xl" />)}
          </div>
        </div>
      ))}
    </div>
  )

  // No menu yet — show wizard
  if (!menuId && !wizardDone) return (
    <div className="p-8">
      <EmptyMenuWizard onCreated={() => setWizardDone(true)} />
    </div>
  )

  const sections = fullMenu?.sections ?? []

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-black text-3xl">Menu</h1>
          <p className="text-ink/60 font-semibold mt-1">{fullMenu?.name}</p>
        </div>
        <button
          onClick={() => setShowAddSection(true)}
          className="btn-outline flex items-center gap-2 text-sm px-4 py-2.5"
        >
          <Plus size={14} /> Nuova sezione
        </button>
      </div>

      {/* Add section inline form */}
      {showAddSection && (
        <div className="card mb-6 border-coral/30 flex items-center gap-3">
          <input
            className="input flex-1"
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            placeholder="Nome sezione (es. Antipasti)"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') addSectionMutation.mutate() }}
          />
          <button onClick={() => addSectionMutation.mutate()} disabled={!newSectionName.trim()} className="btn-coral px-4 py-3 text-sm">Aggiungi</button>
          <button onClick={() => { setShowAddSection(false); setNewSectionName('') }} className="btn-outline px-4 py-3 text-sm">✕</button>
        </div>
      )}

      {/* Sections */}
      {sections.map((section: any) => {
        const collapsed = collapsedSections.has(section.id)
        const count = section.items?.length ?? 0
        return (
          <div key={section.id} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => toggleSection(section.id)}
                className="flex items-center gap-2 group"
              >
                {collapsed ? <ChevronRight size={18} className="text-ink/40" /> : <ChevronDown size={18} className="text-ink/40" />}
                <h2 className="font-display font-black text-xl group-hover:text-coral transition-colors">{section.name}</h2>
                <span className="text-xs font-black text-ink/40 bg-ink/5 px-2 py-0.5 rounded-full">{count}</span>
              </button>
              <button
                onClick={() => setItemModal({ sectionId: section.id })}
                className="btn-outline text-sm px-3 py-2 flex items-center gap-1"
              >
                <Plus size={13} /> Piatto
              </button>
            </div>

            {!collapsed && (
              <div className="space-y-2">
                {count === 0 && (
                  <div className="border-2 border-dashed border-ink/15 rounded-xl p-5 text-center">
                    <p className="text-sm font-bold text-ink/40 mb-2">Sezione vuota</p>
                    <button onClick={() => setItemModal({ sectionId: section.id })} className="text-coral font-black text-sm hover:underline">
                      + Aggiungi il primo piatto
                    </button>
                  </div>
                )}

                {section.items.map((item: any) => (
                  <div
                    key={item.id}
                    className={cn(
                      'card-sm flex items-center gap-4 transition-opacity',
                      !item.available && 'opacity-50'
                    )}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-ink/10 shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-ink/5 grid place-items-center shrink-0 text-xl">🍽️</div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display font-black truncate">{item.name}</p>
                        {!item.available && (
                          <span className="badge bg-ink/10 text-ink/50 text-xs">Esaurito</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-ink/60 font-semibold truncate">{item.description}</p>
                      )}
                      {item.allergens?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.allergens.map((a: string) => (
                            <span key={a} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-black bg-coral/8 text-coral-deep border border-coral/15">
                              {allergenEmoji(a)} {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-display font-black text-lg">{formatEuro(item.price)}</span>
                      <button
                        onClick={() => toggleMutation.mutate({ itemId: item.id, available: !item.available })}
                        className="transition-colors"
                        title={item.available ? 'Segna esaurito' : 'Rendi disponibile'}
                      >
                        {item.available
                          ? <ToggleRight size={30} className="text-coral" />
                          : <ToggleLeft size={30} className="text-ink/30" />
                        }
                      </button>
                      <button onClick={() => setItemModal({ sectionId: section.id, item })} className="text-ink/30 hover:text-ink transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Elimina "${item.name}"?`)) deleteMutation.mutate(item.id) }}
                        className="text-ink/30 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {sections.length === 0 && menuId && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-display font-black text-xl text-ink/40 mb-4">Nessuna sezione nel menu</p>
          <button onClick={() => setShowAddSection(true)} className="btn-coral px-6 py-3">
            <Plus size={16} /> Crea prima sezione
          </button>
        </div>
      )}

      {/* Item modal */}
      {itemModal && (
        <ItemModal
          sectionId={itemModal.sectionId}
          item={itemModal.item}
          onClose={() => setItemModal(null)}
        />
      )}
    </div>
  )
}
