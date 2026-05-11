'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { api } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2, X, UtensilsCrossed, ChevronDown, ChevronRight, FileText, Loader2, CheckCircle2, MoreHorizontal, Upload, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<ItemForm>(
    item
      ? { name: item.name, price: String(item.price), description: item.description ?? '', allergens: (item.allergens ?? []).join(', '), imageUrl: item.imageUrl ?? '', prepTimeMinutes: String(item.prepTimeMinutes ?? 10) }
      : emptyForm
  )
  const [uploading, setUploading] = useState(false)
  const [newVariantName, setNewVariantName] = useState('')
  const [newVariantPrice, setNewVariantPrice] = useState('0')

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

  const addVariantMutation = useMutation({
    mutationFn: () => api.post(`/menus/items/${item.id}/variants`, { name: newVariantName.trim(), priceModifier: parseFloat(newVariantPrice) || 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-full'] })
      setNewVariantName('')
      setNewVariantPrice('0')
      toast.success('Variante aggiunta')
    },
    onError: () => toast.error('Errore'),
  })

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: string) => api.delete(`/menus/items/${item.id}/variants/${variantId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-full'] }); toast.success('Variante rimossa') },
  })

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm(prev => ({ ...prev, imageUrl: res.data.data.url }))
    } catch {
      toast.error('Errore upload immagine')
    } finally {
      setUploading(false)
    }
  }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-cream rounded-2xl border-2 border-ink w-full max-w-md my-4"
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
              <label className="label">Foto</label>
              <div className="flex gap-2">
                <input className="input flex-1" type="url" value={form.imageUrl} onChange={f('imageUrl')} placeholder="https://... oppure carica sotto" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-outline px-3 py-2 flex items-center gap-1.5 text-sm shrink-0"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? 'Upload...' : 'Carica'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </div>
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

        {/* Variants section — only when editing */}
        {item && (
          <div className="border-t border-ink/10 p-5">
            <h3 className="font-display font-black text-base mb-3">Varianti (S/M/L, opzioni)</h3>
            <div className="space-y-2 mb-3">
              {(item.variants ?? []).map((v: any) => (
                <div key={v.id} className="flex items-center gap-2 bg-ink/3 rounded-xl px-3 py-2">
                  <span className="font-bold text-sm flex-1">{v.name}</span>
                  <span className="font-black text-sm text-ink/60">
                    {v.priceModifier > 0 ? '+' : ''}{formatEuro(v.priceModifier)}
                  </span>
                  <button
                    onClick={() => deleteVariantMutation.mutate(v.id)}
                    className="text-ink/30 hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {(item.variants ?? []).length === 0 && (
                <p className="text-xs text-ink/40 font-semibold">Nessuna variante</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm py-2"
                placeholder="Nome (es. Grande)"
                value={newVariantName}
                onChange={e => setNewVariantName(e.target.value)}
              />
              <input
                className="input w-24 text-sm py-2"
                type="number"
                step="0.5"
                placeholder="+€"
                value={newVariantPrice}
                onChange={e => setNewVariantPrice(e.target.value)}
              />
              <button
                type="button"
                onClick={() => addVariantMutation.mutate()}
                disabled={!newVariantName.trim() || addVariantMutation.isPending}
                className="btn-coral px-3 py-2 text-sm"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section sortable wrapper ─────────────────────────────────────────────────

function SectionRow({ sectionId, children }: { sectionId: string; children: React.ReactNode }) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: `sec-${sectionId}` })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="mb-6"
    >
      {children}
    </div>
  )
}

function SectionDragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({ id })
  return (
    <button
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing text-ink/20 hover:text-ink/50 transition-colors p-1 shrink-0"
    >
      <GripVertical size={16} />
    </button>
  )
}

// ─── Sortable item row ────────────────────────────────────────────────────────

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-ink/20 hover:text-ink/50 transition-colors p-1 shrink-0">
        <GripVertical size={14} />
      </button>
      <div className="flex-1">{children}</div>
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

// ─── Import text modal ───────────────────────────────────────────────────────

type ParsedSection = {
  name: string
  items: { name: string; description?: string; price: number; allergens: string[] }[]
}

function ImportTextModal({ menuId, onClose, onImported }: { menuId: string; onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ParsedSection[] | null>(null)
  const [step, setStep] = useState<'input' | 'preview'>('input')

  const parseMutation = useMutation({
    mutationFn: () => api.post(`/menus/${menuId}/import-text`, { text }),
    onSuccess: (res) => {
      setPreview(res.data.data.sections)
      setStep('preview')
    },
    onError: () => toast.error('Errore nel parsing del testo'),
  })

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/menus/${menuId}/import-confirm`, { sections: preview }),
    onSuccess: (res) => {
      const { sections, items } = res.data.data
      toast.success(`Importati ${sections} sezioni e ${items} piatti`)
      onImported()
      onClose()
    },
    onError: () => toast.error('Errore durante l\'importazione'),
  })

  function removeSection(si: number) {
    setPreview(prev => prev!.filter((_, i) => i !== si))
  }

  function removeItem(si: number, ii: number) {
    setPreview(prev => prev!.map((s, i) => i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s))
  }

  function editItemPrice(si: number, ii: number, val: string) {
    const n = parseFloat(val)
    if (isNaN(n)) return
    setPreview(prev => prev!.map((s, i) => i === si ? {
      ...s,
      items: s.items.map((item, j) => j === ii ? { ...item, price: n } : item)
    } : s))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60" onClick={onClose}>
      <div
        className="bg-cream rounded-2xl border-2 border-ink w-full max-w-2xl max-h-[90vh] flex flex-col"
        style={{ boxShadow: '6px 6px 0 #2A1F1A' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-ink/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-coral/10 rounded-xl grid place-items-center">
              <FileText size={18} className="text-coral" />
            </div>
            <div>
              <h2 className="font-display font-black text-xl">Importa da testo</h2>
              <p className="text-xs text-ink/50 font-semibold">
                {step === 'input' ? 'Incolla il testo del tuo menu' : 'Verifica e conferma'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-ink/10 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'input' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-ink/60">
                Incolla il testo del menu fisico, un PDF copiato, o scrivi liberamente.<br />
                Es: <span className="text-ink/80 italic">"Antipasti: Bruschetta 6€, Tagliere 12€. Primi: Carbonara 14€..."</span>
              </p>
              <textarea
                className="input resize-none w-full font-mono text-sm"
                rows={12}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={"ANTIPASTI\nBruschetta al pomodoro    6,00€\nTagliere misto            12,00€\n\nPRIMI\nSpaghetti cacio e pepe    14,00€\nRisotto ai funghi         16,00€\n\nSECONDI\n..."}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => parseMutation.mutate()}
                  disabled={!text.trim() || parseMutation.isPending}
                  className="btn-coral flex-1 py-3 flex items-center justify-center gap-2"
                >
                  {parseMutation.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Analisi in corso...</>
                  ) : (
                    'Analizza menu →'
                  )}
                </button>
                <button onClick={onClose} className="btn-outline px-5 py-3">Annulla</button>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-bold text-mint bg-mint/10 rounded-xl px-3 py-2">
                <CheckCircle2 size={16} />
                Trovate {preview.length} sezioni e {preview.reduce((acc, s) => acc + s.items.length, 0)} piatti. Puoi modificare prima di importare.
              </div>

              {preview.map((section, si) => (
                <div key={si} className="border-2 border-ink/10 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-ink/3">
                    <h3 className="font-display font-black text-base">{section.name}</h3>
                    <button onClick={() => removeSection(si)} className="text-xs text-ink/40 hover:text-red-500 transition-colors font-bold">
                      Rimuovi sezione
                    </button>
                  </div>
                  <div className="divide-y divide-ink/5">
                    {section.items.map((item, ii) => (
                      <div key={ii} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{item.name}</p>
                          {item.description && <p className="text-xs text-ink/50 truncate">{item.description}</p>}
                          {item.allergens.length > 0 && (
                            <p className="text-xs text-coral/70 font-semibold">{item.allergens.join(', ')}</p>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={e => editItemPrice(si, ii, e.target.value)}
                          className="input w-24 text-right font-black text-sm py-1.5"
                        />
                        <span className="text-sm font-bold text-ink/50">€</span>
                        <button onClick={() => removeItem(si, ii)} className="text-ink/30 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {step === 'preview' && (
          <div className="flex gap-2 p-5 border-t border-ink/10 shrink-0">
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || preview!.length === 0}
              className="btn-coral flex-1 py-3 flex items-center justify-center gap-2"
            >
              {confirmMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Importazione...</>
              ) : (
                `Importa ${preview!.reduce((acc, s) => acc + s.items.length, 0)} piatti`
              )}
            </button>
            <button onClick={() => setStep('input')} className="btn-outline px-5 py-3">← Modifica testo</button>
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
  const [showImport, setShowImport] = useState(false)
  const [sectionMenu, setSectionMenu] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

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
    onError: () => toast.error('Errore nella rimozione del piatto'),
  })

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => api.delete(`/menus/sections/${sectionId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-full'] }); toast.success('Sezione eliminata') },
    onError: () => toast.error('Errore nella rimozione della sezione'),
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

  const patchSectionPosition = useMutation({
    mutationFn: ({ id, position }: { id: string; position: number }) =>
      api.patch(`/menus/sections/${id}`, { position }),
  })

  const patchItemPosition = useMutation({
    mutationFn: ({ id, position }: { id: string; position: number }) =>
      api.patch(`/menus/items/${id}`, { position }),
  })

  function toggleSection(id: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith('sec-') && overId.startsWith('sec-')) {
      const secs = fullMenu?.sections ?? []
      const oldIdx = secs.findIndex((s: any) => `sec-${s.id}` === activeId)
      const newIdx = secs.findIndex((s: any) => `sec-${s.id}` === overId)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(secs, oldIdx, newIdx)
      // Optimistic update via cache
      qc.setQueryData(['menu-full', menuId], (old: any) => old ? { ...old, sections: reordered } : old)
      reordered.forEach((s: any, i: number) => {
        if (secs[i]?.id !== s.id) patchSectionPosition.mutate({ id: s.id, position: i })
      })
      return
    }

    if (activeId.startsWith('item-') && overId.startsWith('item-')) {
      const secs = fullMenu?.sections ?? []
      for (const sec of secs) {
        const items = sec.items ?? []
        const oldIdx = items.findIndex((it: any) => `item-${it.id}` === activeId)
        if (oldIdx === -1) continue
        const newIdx = items.findIndex((it: any) => `item-${it.id}` === overId)
        if (newIdx === -1) continue
        const reordered = arrayMove(items, oldIdx, newIdx)
        qc.setQueryData(['menu-full', menuId], (old: any) => old ? {
          ...old,
          sections: old.sections.map((s: any) => s.id === sec.id ? { ...s, items: reordered } : s)
        } : old)
        reordered.forEach((it: any, i: number) => {
          if (items[i]?.id !== it.id) patchItemPosition.mutate({ id: it.id, position: i })
        })
        return
      }
    }
  }

  const isLoading = loadingMenus || loadingMenu

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

  if (!menuId && !wizardDone) return (
    <div className="p-8">
      <EmptyMenuWizard onCreated={() => setWizardDone(true)} />
    </div>
  )

  const sections: any[] = fullMenu?.sections ?? []

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-black text-3xl">Menu</h1>
          <p className="text-ink/60 font-semibold mt-1">{fullMenu?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="btn-outline flex items-center gap-2 text-sm px-4 py-2.5"
          >
            <FileText size={14} /> Importa da testo
          </button>
          <button
            onClick={() => setShowAddSection(true)}
            className="btn-outline flex items-center gap-2 text-sm px-4 py-2.5"
          >
            <Plus size={14} /> Nuova sezione
          </button>
        </div>
      </div>

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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s: any) => `sec-${s.id}`)} strategy={verticalListSortingStrategy}>
          {sections.map((section: any) => {
            const collapsed = collapsedSections.has(section.id)
            const count = section.items?.length ?? 0
            return (
              <SectionRow key={section.id} sectionId={section.id}>
                {/* Section header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1">
                    <SectionDragHandle id={`sec-${section.id}`} />
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="flex items-center gap-2 group"
                    >
                      {collapsed ? <ChevronRight size={18} className="text-ink/40" /> : <ChevronDown size={18} className="text-ink/40" />}
                      <h2 className="font-display font-black text-xl group-hover:text-coral transition-colors">{section.name}</h2>
                      <span className="text-xs font-black text-ink/40 bg-ink/5 px-2 py-0.5 rounded-full">{count}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setItemModal({ sectionId: section.id })}
                      className="btn-outline text-sm px-3 py-2 flex items-center gap-1"
                    >
                      <Plus size={13} /> Piatto
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setSectionMenu(sectionMenu === section.id ? null : section.id)}
                        className="p-2 hover:bg-ink/10 rounded-lg transition-colors text-ink/40 hover:text-ink"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {sectionMenu === section.id && (
                        <div
                          className="absolute right-0 top-full mt-1 bg-white border-2 border-ink/10 rounded-xl shadow-lg z-10 min-w-[160px]"
                          onClick={() => setSectionMenu(null)}
                        >
                          <button
                            onClick={() => {
                              if (confirm(`Elimina la sezione "${section.name}" e tutti i suoi piatti?`)) {
                                deleteSectionMutation.mutate(section.id)
                              }
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <Trash2 size={14} /> Elimina sezione
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
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

                    <SortableContext items={(section.items ?? []).map((it: any) => `item-${it.id}`)} strategy={verticalListSortingStrategy}>
                      {(section.items ?? []).map((item: any) => (
                        <SortableItem key={item.id} id={`item-${item.id}`}>
                          <div
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
                                {(item.variants ?? []).length > 0 && (
                                  <span className="badge bg-sky/20 text-ink text-xs">{item.variants.length} varianti</span>
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
                                onClick={() => deleteMutation.mutate(item.id)}
                                disabled={deleteMutation.isPending}
                                className="text-ink/30 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </SortableItem>
                      ))}
                    </SortableContext>
                  </div>
                )}
              </SectionRow>
            )
          })}
        </SortableContext>
      </DndContext>

      {sections.length === 0 && menuId && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-display font-black text-xl text-ink/40 mb-4">Nessuna sezione nel menu</p>
          <button onClick={() => setShowAddSection(true)} className="btn-coral px-6 py-3">
            <Plus size={16} /> Crea prima sezione
          </button>
        </div>
      )}

      {itemModal && (
        <ItemModal
          sectionId={itemModal.sectionId}
          item={itemModal.item}
          onClose={() => setItemModal(null)}
        />
      )}

      {showImport && menuId && (
        <ImportTextModal
          menuId={menuId}
          onClose={() => setShowImport(false)}
          onImported={() => {
            qc.invalidateQueries({ queryKey: ['menu-full'] })
            qc.invalidateQueries({ queryKey: ['menus'] })
          }}
        />
      )}
    </div>
  )
}
