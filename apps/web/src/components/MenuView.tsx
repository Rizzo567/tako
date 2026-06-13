'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useSessionStore, useCartStore } from '@/lib/store'
import { formatEuro } from '@/lib/utils'
import { ShoppingCart, MessageCircle, Minus, Plus, X, Filter, Bell } from 'lucide-react'
import type { PublicMenu, PublicItem } from '@tako/types'
import toast from 'react-hot-toast'

const ALLERGEN_ICONS: Record<string, string> = {
  glutine: '🌾', latte: '🥛', uova: '🥚', pesce: '🐟', arachidi: '🥜',
  soia: '🫘', noci: '🌰', sedano: '🌿', senape: '🌱', sesamo: '🫛',
  lupini: '🌸', molluschi: '🦑',
}

function ItemModal({ item, onClose, onAdd }: { item: PublicItem; onClose: () => void; onAdd: (qty: number, variantId: string | undefined, notes: string) => void }) {
  const [qty, setQty] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>(item.variants?.[0]?.id)
  const [notes, setNotes] = useState('')

  const variant = item.variants?.find(v => v.id === selectedVariant)
  const price = item.price + (variant?.priceModifier ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(42,31,26,0.55)' }} onClick={onClose}>
      <div
        className="relative mx-auto w-full max-w-lg overflow-hidden bg-[var(--surface-raised)] p-6 pb-10"
        style={{ borderTopLeftRadius: 'var(--r-sheet)', borderTopRightRadius: 'var(--r-sheet)', boxShadow: 'var(--elev-3)' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Chiudi" className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)] active:scale-95"><X size={18} /></button>
        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt=""
            className="-mx-6 -mt-6 mb-4 h-52 object-cover"
            style={{ width: 'calc(100% + 48px)' }}
          />
        )}
        <h2 className="mb-1 font-serif text-2xl text-[var(--text-primary)]">{item.name}</h2>
        {item.description && <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">{item.description}</p>}
        {item.allergens.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {item.allergens.map(a => (
              <span key={a} className="badge-tag">{ALLERGEN_ICONS[a.toLowerCase()] ?? '⚠️'} {a}</span>
            ))}
          </div>
        )}
        {item.variants && item.variants.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Variante</p>
            <div className="flex flex-wrap gap-2">
              {item.variants.map(v => {
                const active = selectedVariant === v.id
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v.id)}
                    className="rounded-full px-3.5 py-2 text-sm font-semibold transition-all active:scale-95"
                    style={active
                      ? { background: 'var(--brand)', color: 'var(--on-brand)' }
                      : { background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}
                  >
                    {v.name} {v.priceModifier !== 0 && <span className="tabular-nums opacity-70">{v.priceModifier > 0 ? '+' : ''}{formatEuro(v.priceModifier)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Note (opzionale)</p>
          <input className="input text-sm" placeholder="Es: senza cipolla, ben cotto..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Diminuisci" className="stepper-btn h-10 w-10"><Minus size={16} /></button>
            <span className="w-8 text-center font-semibold text-xl tabular-nums text-[var(--text-primary)]">{qty}</span>
            <button onClick={() => setQty(q => q + 1)} aria-label="Aumenta" className="stepper-btn h-10 w-10"><Plus size={16} /></button>
          </div>
          <button onClick={() => onAdd(qty, selectedVariant, notes)} className="btn-coral flex flex-col items-center px-6 leading-tight">
            <span className="text-xs font-semibold opacity-80">Aggiungi</span>
            <span className="font-serif text-2xl tabular-nums">{formatEuro(price * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function MenuView({ onGoCart, onGoChat, onWaiterCall }: { onGoCart: () => void; onGoChat: () => void; onWaiterCall: () => void }) {
  const { restaurantId, tableNumber, restaurantName, aiEnabled } = useSessionStore()
  const [menu, setMenu] = useState<PublicMenu | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<PublicItem | null>(null)
  const [filterAllergens, setFilterAllergens] = useState<Set<string>>(new Set())
  const { add, count, items } = useCartStore()

  useEffect(() => {
    if (!restaurantId) return
    api.get(`/customer/restaurant/${restaurantId}/menu`).then(r => {
      setMenu(r.data.data)
      setActiveSection(r.data.data.sections[0]?.id ?? null)
    })
  }, [restaurantId])

  function handleAdd(qty: number, variantId: string | undefined, notes: string) {
    if (!selectedItem) return
    const variant = selectedItem.variants?.find(v => v.id === variantId)
    add({
      menuItemId: selectedItem.id,
      variantId,
      name: selectedItem.name + (variant ? ` (${variant.name})` : ''),
      quantity: qty,
      unitPrice: selectedItem.price + (variant?.priceModifier ?? 0),
      notes: notes || undefined,
    })
    toast.success(`${selectedItem.name} aggiunto`)
    setSelectedItem(null)
  }

  function handleAddDirect(item: PublicItem) {
    add({
      menuItemId: item.id,
      name: item.name,
      quantity: 1,
      unitPrice: item.price,
    })
    toast.success(`${item.name} aggiunto`)
  }

  const allAllergens = Array.from(new Set(menu?.sections.flatMap(s => s.items.flatMap(i => i.allergens)) ?? []))

  function toggleAllergen(a: string) {
    setFilterAllergens(prev => {
      const next = new Set(prev)
      next.has(a) ? next.delete(a) : next.add(a)
      return next
    })
  }

  const activeItems = menu?.sections.find(s => s.id === activeSection)?.items.filter(i =>
    i.available && (filterAllergens.size === 0 || !i.allergens.some(a => filterAllergens.has(a)))
  ) ?? []

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/90 px-4 py-3 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-xl text-[var(--text-primary)]">{restaurantName}</h1>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Tavolo <span className="tabular-nums">{tableNumber}</span></p>
          </div>
          <div className="flex gap-2">
            {aiEnabled && (
              <button onClick={onGoChat} aria-label="Assistente" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-primary)] active:scale-95">
                <MessageCircle size={18} strokeWidth={2.2} />
              </button>
            )}
            <button onClick={onWaiterCall} aria-label="Chiama cameriere" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-primary)] active:scale-95">
              <Bell size={18} strokeWidth={2.2} />
            </button>
            <button onClick={onGoCart} aria-label="Carrello" className="relative grid h-11 w-11 place-items-center rounded-full text-[var(--on-brand)] active:scale-95" style={{ background: 'var(--brand)' }}>
              <ShoppingCart size={18} strokeWidth={2.2} />
              {count() > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--surface-raised)] text-[10px] font-bold tabular-nums text-[var(--text-primary)] shadow-[var(--elev-1)]">{count()}</span>}
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          {menu?.sections.map(s => {
            const active = activeSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all active:scale-95"
                style={active
                  ? { background: 'var(--brand)', color: 'var(--on-brand)' }
                  : { background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}
              >
                {s.name}
              </button>
            )
          })}
        </div>

        {/* Allergen filters */}
        {allAllergens.length > 0 && (
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1 pt-2">
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[var(--text-tertiary)]"><Filter size={11} /> Escludi:</span>
            {allAllergens.map(a => {
              const active = filterAllergens.has(a)
              return (
                <button
                  key={a}
                  onClick={() => toggleAllergen(a)}
                  className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all active:scale-95"
                  style={active
                    ? { background: 'color-mix(in srgb, var(--status-danger) 12%, white)', color: 'var(--status-danger)' }
                    : { background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}
                >
                  {ALLERGEN_ICONS[a.toLowerCase()] ?? '⚠️'} {a}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="space-y-3 p-4">
        {activeItems.map(item => {
          const hasVariants = item.variants && item.variants.length > 0
          const cartQty = items.filter(i => i.menuItemId === item.id).reduce((sum, i) => sum + i.quantity, 0)
          return (
            <div
              key={item.id}
              className="item-card flex gap-3"
              onClick={() => {
                if (hasVariants) {
                  setSelectedItem(item)
                } else {
                  handleAddDirect(item)
                }
              }}
            >
              {item.imageUrl
                ? <img src={item.imageUrl} alt="" className="h-20 w-20 shrink-0 object-cover" style={{ borderRadius: 'var(--r-photo)' }} />
                : <div className="grid h-20 w-20 shrink-0 place-items-center font-serif text-2xl" style={{ borderRadius: 'var(--r-photo)', background: 'var(--brand-tint)', color: 'var(--brand)' }}>{item.name.charAt(0)}</div>
              }
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight text-[var(--text-primary)]">{item.name}</h3>
                  <span className="shrink-0 font-semibold tabular-nums" style={{ color: 'var(--brand)' }}>{formatEuro(item.price)}</span>
                </div>
                {item.description && <p className="mt-0.5 line-clamp-2 text-xs font-medium text-[var(--text-secondary)]">{item.description}</p>}
                {item.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.tags.map(t => <span key={t} className="badge-tag">{t}</span>)}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    {item.allergens && item.allergens.length > 0 && (
                      <div className="flex flex-wrap gap-1 text-xs">
                        {item.allergens.map(a => (
                          <span key={a} title={a}>{ALLERGEN_ICONS[a.toLowerCase()] ?? '⚠️'}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {!hasVariants && (
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {cartQty > 0 && <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--brand)' }}>{cartQty} nel carrello</span>}
                      <button
                        onClick={e => { e.stopPropagation(); handleAddDirect(item) }}
                        aria-label="Aggiungi"
                        className="grid h-9 w-9 place-items-center rounded-full text-[var(--on-brand)] transition-transform active:scale-90"
                        style={{ background: 'var(--brand)', boxShadow: 'var(--elev-brand)' }}
                      ><Plus size={18} strokeWidth={2.6} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selectedItem && <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} onAdd={handleAdd} />}

      {/* Cart bar */}
      {count() > 0 && (
        <div className="bottom-bar safe-bottom">
          <button onClick={onGoCart} className="btn-coral flex w-full items-center justify-between px-6 py-4 text-lg">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm tabular-nums">{count()}</span>
            <span>Vedi carrello</span>
            <ShoppingCart size={20} />
          </button>
        </div>
      )}
    </>
  )
}
