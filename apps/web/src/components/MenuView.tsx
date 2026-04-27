'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useSessionStore, useCartStore } from '@/lib/store'
import { formatEuro, cn } from '@/lib/utils'
import { ShoppingCart, MessageCircle, Minus, Plus, X, Filter } from 'lucide-react'
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
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-ink/40 hover:text-ink"><X size={20} /></button>
        {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-48 object-cover rounded-2xl mb-4 border-2 border-ink/10" />}
        <h2 className="font-display font-black text-2xl mb-1">{item.name}</h2>
        {item.description && <p className="text-ink/60 font-semibold text-sm mb-3">{item.description}</p>}
        {item.allergens.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {item.allergens.map(a => (
              <span key={a} className="badge-tag">{ALLERGEN_ICONS[a.toLowerCase()] ?? '⚠️'} {a}</span>
            ))}
          </div>
        )}
        {item.variants && item.variants.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-display font-black text-ink/60 mb-2">VARIANTE</p>
            <div className="flex flex-wrap gap-2">
              {item.variants.map(v => (
                <button key={v.id} onClick={() => setSelectedVariant(v.id)} className={cn('px-3 py-1.5 rounded-xl border-2 text-sm font-bold transition-all', selectedVariant === v.id ? 'border-coral bg-coral/10 text-coral-deep' : 'border-ink/20')}>
                  {v.name} {v.priceModifier !== 0 && <span className="opacity-60">{v.priceModifier > 0 ? '+' : ''}{formatEuro(v.priceModifier)}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mb-5">
          <p className="text-xs font-display font-black text-ink/60 mb-2">NOTE (opzionale)</p>
          <input className="w-full px-4 py-3 rounded-xl border-2 border-ink/20 font-body font-semibold text-sm focus:outline-none focus:border-coral" placeholder="Es: senza cipolla, ben cotto..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-xl border-2 border-ink/20 grid place-items-center hover:border-coral"><Minus size={16} /></button>
            <span className="font-display font-black text-xl w-8 text-center">{qty}</span>
            <button onClick={() => setQty(q => q + 1)} className="w-10 h-10 rounded-xl border-2 border-ink/20 grid place-items-center hover:border-coral"><Plus size={16} /></button>
          </div>
          <button onClick={() => onAdd(qty, selectedVariant, notes)} className="btn-coral px-6">
            Aggiungi {formatEuro(price * qty)}
          </button>
        </div>
      </div>
    </div>
  )
}

export function MenuView({ onGoCart, onGoChat }: { onGoCart: () => void; onGoChat: () => void }) {
  const { restaurantId, tableNumber, restaurantName, primaryColor, aiEnabled } = useSessionStore()
  const [menu, setMenu] = useState<PublicMenu | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<PublicItem | null>(null)
  const [filterAllergen, setFilterAllergen] = useState<string | null>(null)
  const { add, count } = useCartStore()

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
    toast.success(`${selectedItem.name} aggiunto!`, { icon: '✅' })
    setSelectedItem(null)
  }

  const activeItems = menu?.sections.find(s => s.id === activeSection)?.items.filter(i => i.available && (!filterAllergen || !i.allergens.includes(filterAllergen))) ?? []

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b-2 border-ink/10 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-display font-black text-xl text-ink">{restaurantName}</h1>
            <p className="text-xs font-semibold text-ink/50">Tavolo {tableNumber}</p>
          </div>
          <div className="flex gap-2">
            {aiEnabled && (
              <button onClick={onGoChat} className="w-10 h-10 rounded-xl bg-ink grid place-items-center">
                <MessageCircle size={18} className="text-cream" />
              </button>
            )}
            <button onClick={onGoCart} className="relative w-10 h-10 rounded-xl grid place-items-center" style={{ background: primaryColor }}>
              <ShoppingCart size={18} className="text-white" />
              {count() > 0 && <span className="absolute -top-1.5 -right-1.5 bg-white text-ink text-[10px] font-black w-5 h-5 rounded-full grid place-items-center border-2 border-ink">{count()}</span>}
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {menu?.sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} className={cn('shrink-0 px-4 py-1.5 rounded-xl text-sm font-display font-black transition-all', activeSection === s.id ? 'text-white' : 'bg-ink/5 text-ink/60')} style={{ background: activeSection === s.id ? primaryColor : undefined }}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="p-4 space-y-3">
        {activeItems.map(item => (
          <div key={item.id} className="item-card flex gap-3" onClick={() => setSelectedItem(item)}>
            {item.imageUrl && <img src={item.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover border-2 border-ink/10 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-black leading-tight">{item.name}</h3>
                <span className="font-display font-black text-lg shrink-0" style={{ color: primaryColor }}>{formatEuro(item.price)}</span>
              </div>
              {item.description && <p className="text-xs text-ink/60 font-semibold mt-0.5 line-clamp-2">{item.description}</p>}
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {item.tags.map(t => <span key={t} className="badge-tag">{t}</span>)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedItem && <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} onAdd={handleAdd} />}

      {/* Cart FAB */}
      {count() > 0 && (
        <div className="bottom-bar">
          <button onClick={onGoCart} className="btn-coral w-full py-4 text-lg flex items-center justify-between px-6" style={{ background: primaryColor, boxShadow: `0 4px 0 ${primaryColor}cc` }}>
            <span className="bg-white/20 px-2 py-0.5 rounded-lg text-sm">{count()}</span>
            <span>Vedi carrello</span>
            <ShoppingCart size={20} />
          </button>
        </div>
      )}
    </>
  )
}
