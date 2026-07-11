'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Plus, Minus, Filter, Info, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { PublicMenu, PublicItem, PublicVariant } from '@tako/types'
import { api } from '@/lib/api'
import { joinMenu, socket } from '@/lib/socket'
import { useSessionStore, useCartStore } from '@/lib/store'
import { formatEuro } from '@/lib/utils'
import { SPRING, SPRING_SOFT, EASE_OUT, flyToCart, useCountUp } from '@/lib/motion'
import { useI18n, trTag, trAllergen } from '@/lib/i18n'
import { Dish, dishGradient } from './ui/Dish'
import { Sheet } from './ui/Sheet'

type ItemTranslation = { itemId: string; name: string; description?: string | null }

// 12 allergeni del prototipo: emoji per i badge + label per il filtro.
const ALLERGENS: { id: string; emoji: string; label: string }[] = [
  { id: 'glutine', emoji: '🌾', label: 'Glutine' },
  { id: 'latte', emoji: '🥛', label: 'Latte' },
  { id: 'uova', emoji: '🥚', label: 'Uova' },
  { id: 'pesce', emoji: '🐟', label: 'Pesce' },
  { id: 'molluschi', emoji: '🦪', label: 'Molluschi' },
  { id: 'arachidi', emoji: '🥜', label: 'Arachidi' },
  { id: 'soia', emoji: '🫛', label: 'Soia' },
  { id: 'noci', emoji: '🌰', label: 'Frutta a guscio' },
  { id: 'sedano', emoji: '🥬', label: 'Sedano' },
  { id: 'senape', emoji: '🌭', label: 'Senape' },
  { id: 'sesamo', emoji: '⚪', label: 'Sesamo' },
  { id: 'lupini', emoji: '🫘', label: 'Lupini' },
]
const ALLERGEN_MAP = Object.fromEntries(ALLERGENS.map(a => [a.id, a]))
const allergenEmoji = (a: string) => ALLERGEN_MAP[a.toLowerCase()]?.emoji ?? '⚠️'

function Tag({ children }: { children: string }) {
  const { lang } = useI18n()
  const danger = children === 'Piccante'
  const novita = children === 'Novità'
  return (
    <span
      className="whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-wide"
      style={{
        background: danger ? 'rgba(220,76,62,.1)' : novita ? 'var(--brand-tint)' : 'var(--sunken)',
        color: danger ? 'var(--danger)' : novita ? 'var(--brand-deep)' : 'var(--ink-2)',
      }}
    >
      {trTag(children, lang)}
    </span>
  )
}

function AllergenDot({ id, withLabel }: { id: string; withLabel?: boolean }) {
  const { lang } = useI18n()
  const label = trAllergen(id, lang, ALLERGEN_MAP[id.toLowerCase()]?.label ?? id)
  return (
    <span
      title={label}
      className="inline-flex items-center gap-1.5 font-semibold"
      style={{
        fontSize: withLabel ? 12.5 : 13,
        padding: withLabel ? '5px 10px 5px 8px' : 0,
        borderRadius: 999,
        background: withLabel ? 'var(--sunken)' : 'transparent',
        color: 'var(--ink-2)',
      }}
    >
      <span style={{ fontSize: 14 }}>{allergenEmoji(id)}</span>
      {withLabel && label}
    </span>
  )
}

// Stepper quantità (item sheet).
function Qty({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full p-1" style={{ background: 'var(--sunken)' }}>
      <button
        aria-label="Diminuisci" onClick={() => onChange(value - 1)}
        className="grid h-10 w-10 place-items-center rounded-full active:scale-90"
        style={{ background: 'var(--raised)', color: value <= min ? 'var(--ink-3)' : 'var(--ink)', boxShadow: 'var(--sh-1)' }}
      ><Minus size={18} /></button>
      <motion.span key={value} className="tnum min-w-[30px] text-center text-[18px] font-bold text-[var(--ink)]"
        initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={SPRING}>{value}</motion.span>
      <button
        aria-label="Aumenta" onClick={() => onChange(value + 1)}
        className="grid h-10 w-10 place-items-center rounded-full text-[var(--on-brand)] active:scale-90"
        style={{ background: 'var(--brand)', boxShadow: 'var(--sh-1)' }}
      ><Plus size={18} /></button>
    </div>
  )
}

/* ───────────────── item detail sheet ───────────────── */
function ItemSheet({ item, open, onClose }: { item: PublicItem | null; open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const reduce = useReducedMotion()
  const add = useCartStore(s => s.add)
  const [qty, setQty] = useState(1)
  const [variantId, setVariantId] = useState<string | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && item) {
      setQty(1)
      setVariantId(item.variants?.[0]?.id)
      setNotes('')
    }
  }, [open, item])

  if (!item) return null
  const variant: PublicVariant | undefined = item.variants?.find(v => v.id === variantId)
  const unit = item.price + (variant?.priceModifier ?? 0)

  function handleAdd() {
    if (!item) return
    add({
      menuItemId: item.id,
      variantId,
      name: item.name + (variant && variant.priceModifier ? ` · ${variant.name}` : ''),
      quantity: qty,
      unitPrice: unit,
      notes: notes.trim() || undefined,
    })
    flyToCart(heroRef.current, dishGradient(item.name))
    onClose()
    toast.success(`${qty}× ${item.name} ${t('added')}`)
  }

  return (
    <Sheet open={open} onClose={onClose} maxH="92vh">
      <div className="pb-[18px]">
        {/* hero (shared-element: cresce dalla tile lista via layoutId) */}
        <div className="px-5">
          <motion.div
            ref={heroRef}
            layoutId={reduce ? undefined : `dish-${item.id}`}
            className="relative grid h-[188px] w-full place-items-center overflow-hidden"
            style={{ borderRadius: 20, background: item.imageUrl ? 'var(--sunken)' : dishGradient(item.name) }}
          >
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="h-full w-full object-cover object-center" />
            ) : (
              <span className="serif" style={{ fontSize: 90, color: 'rgba(255,255,255,.9)', lineHeight: 1 }}>
                {item.name[0].toUpperCase()}
              </span>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="absolute left-3 top-3 flex gap-1.5">
                {item.tags.map(t => <Tag key={t}>{t}</Tag>)}
              </div>
            )}
          </motion.div>
        </div>

        <div className="px-5 pt-[18px]">
          <h3 className="text-[23px] font-bold text-[var(--ink)]">{item.name}</h3>
          {item.description && (
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--ink-2)]">{item.description}</p>
          )}

          {item.allergens.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--ink-3)]">{t('allergens')}</p>
              <div className="flex flex-wrap gap-[7px]">
                {item.allergens.map(a => <AllergenDot key={a} id={a} withLabel />)}
              </div>
            </div>
          )}

          {item.variants && item.variants.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--ink-3)]">{t('choosePortion')}</p>
              <div className="flex flex-col gap-2">
                {item.variants.map(opt => {
                  const on = variantId === opt.id
                  return (
                    <button
                      key={opt.id} onClick={() => setVariantId(opt.id)}
                      className="flex items-center justify-between rounded-[14px] px-4 py-3 text-left transition-all active:scale-[0.99]"
                      style={{
                        background: on ? 'var(--brand-tint)' : 'var(--surface)',
                        boxShadow: on ? 'inset 0 0 0 2px var(--brand)' : 'inset 0 0 0 1.5px var(--hairline)',
                      }}
                    >
                      <span className="text-[15px] font-semibold text-[var(--ink)]">{opt.name}</span>
                      <span className="tnum text-[14px] font-bold"
                        style={{ color: opt.priceModifier ? 'var(--brand-deep)' : 'var(--ink-3)' }}>
                        {opt.priceModifier ? `+ ${formatEuro(opt.priceModifier)}` : t('included')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--ink-3)]">{t('kitchenNotes')}</p>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder={t('notesPh')}
              className="w-full resize-none rounded-[var(--r-input)] px-3.5 py-3 text-[14.5px] text-[var(--ink)] outline-none"
              style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1.5px var(--hairline)' }}
            />
          </div>
        </div>
      </div>

      {/* sticky add bar */}
      <div className="sticky bottom-0 flex items-center gap-3.5 border-t px-5 py-3"
        style={{ background: 'var(--raised)', borderColor: 'var(--hairline)' }}>
        <Qty value={qty} onChange={q => setQty(Math.max(1, q))} min={1} />
        <button onClick={handleAdd}
          className="flex h-[54px] flex-1 items-center justify-between rounded-2xl px-5 text-[16px] font-bold text-[var(--on-brand)] active:scale-[0.98]"
          style={{ background: 'var(--brand)', boxShadow: '0 8px 22px -8px var(--brand)' }}>
          <span>{t('add')}</span>
          <span className="tnum">{formatEuro(unit * qty)}</span>
        </button>
      </div>
    </Sheet>
  )
}

/* ───────────────── allergen filter sheet ───────────────── */
function FilterSheet({
  open, onClose, available, excluded, setExcluded,
}: {
  open: boolean; onClose: () => void; available: string[]
  excluded: Set<string>; setExcluded: (s: Set<string>) => void
}) {
  const { t, lang } = useI18n()
  const list = ALLERGENS.filter(a => available.includes(a.id))
  const toggle = (id: string) => {
    const next = new Set(excluded)
    next.has(id) ? next.delete(id) : next.add(id)
    setExcluded(next)
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('filterTitle')}
      sub={t('filterSub')} leadIcon={<Filter size={20} />}>
      <div className="grid grid-cols-2 gap-2.5 px-5 pb-[18px] pt-1">
        {list.map(a => {
          const on = excluded.has(a.id)
          return (
            <button key={a.id} onClick={() => toggle(a.id)}
              className="flex items-center gap-2.5 rounded-[14px] px-3.5 py-3 text-left transition-all active:scale-[0.98]"
              style={{
                background: on ? 'var(--ink)' : 'var(--surface)',
                color: on ? 'var(--surface)' : 'var(--ink)',
                boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--hairline)',
              }}>
              <span className="text-[18px]">{a.emoji}</span>
              <span className="flex-1 text-[13.5px] font-semibold">{trAllergen(a.id, lang, a.label)}</span>
              {on && <X size={15} />}
            </button>
          )
        })}
      </div>
      <div className="sticky bottom-0 flex gap-2.5 border-t px-5 py-3"
        style={{ background: 'var(--raised)', borderColor: 'var(--hairline)' }}>
        {excluded.size > 0 && (
          <button onClick={() => setExcluded(new Set())}
            className="h-[54px] rounded-2xl px-5 text-[16px] font-bold text-[var(--ink)]"
            style={{ boxShadow: 'inset 0 0 0 1.5px var(--hairline)' }}>{t('reset')}</button>
        )}
        <button onClick={onClose}
          className="h-[54px] flex-1 rounded-2xl text-[16px] font-bold text-[var(--on-brand)] active:scale-[0.98]"
          style={{ background: 'var(--brand)', boxShadow: '0 8px 22px -8px var(--brand)' }}>
          {excluded.size ? t('showDishes') : t('done')}
        </button>
      </div>
    </Sheet>
  )
}

/* ───────────────── menu view ───────────────── */
export function MenuView({ onGoCart, compact }: { onGoCart: () => void; compact?: boolean }) {
  const { t, lang, defaultLang } = useI18n()
  const restaurantId = useSessionStore(s => s.restaurantId)
  const items = useCartStore(s => s.items)
  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items])
  const total = useMemo(() => items.reduce((n, i) => n + i.unitPrice * i.quantity, 0), [items])
  const animTotal = useCountUp(total)

  const [menu, setMenu] = useState<PublicMenu | null>(null)
  const [features, setFeatures] = useState<{ restaurantName?: string; reservationsEnabled?: boolean; reviewUrl?: string } | null>(null)
  const [trMap, setTrMap] = useState<Record<string, ItemTranslation>>({})
  const [active, setActive] = useState<string | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [selected, setSelected] = useState<PublicItem | null>(null)
  const [itemOpen, setItemOpen] = useState(false)
  const [ind, setInd] = useState({ x: 16, w: 78 })

  const secRefs = useRef<Record<string, HTMLElement | null>>({})
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const lockUntil = useRef(0)

  useEffect(() => {
    if (!restaurantId) return
    api.get(`/customer/restaurant/${restaurantId}/menu`).then(r => {
      const m: PublicMenu = r.data.data
      setMenu(m)
      setActive(m.sections[0]?.id ?? null)
      setFeatures(r.data.features || null)
    }).catch(() => toast.error('Menu non disponibile al momento. Riprova.'))
  }, [restaurantId])

  // Traduzioni piatti: quando la lingua ≠ default, rifetch/merge per itemId (solo display).
  useEffect(() => {
    if (!restaurantId || !lang || lang === defaultLang) { setTrMap({}); return }
    let alive = true
    api.get(`/customer/menu-translations?restaurantId=${restaurantId}&lang=${encodeURIComponent(lang)}`).then(r => {
      if (!alive) return
      const rows: ItemTranslation[] = r.data.data ?? []
      const map: Record<string, ItemTranslation> = {}
      for (const t of rows) map[t.itemId] = t
      setTrMap(map)
    }).catch(() => { if (alive) setTrMap({}) })
    return () => { alive = false }
  }, [restaurantId, lang, defaultLang])

  // Applica le traduzioni (name/description) per itemId; l'id resta invariato → il
  // carrello/ordine usa sempre il nome canonico italiano dei dati originali.
  const localizedMenu = useMemo<PublicMenu | null>(() => {
    if (!menu) return null
    if (!lang || lang === defaultLang || Object.keys(trMap).length === 0) return menu
    return {
      ...menu,
      sections: menu.sections.map(s => ({
        ...s,
        items: s.items.map(it => {
          const tr = trMap[it.id]
          if (!tr) return it
          return { ...it, name: tr.name || it.name, description: tr.description ?? it.description }
        }),
      })),
    }
  }, [menu, lang, defaultLang, trMap])

  // Menu live (disponibilità/prezzi/nuovi piatti).
  useEffect(() => {
    if (!restaurantId) return
    joinMenu(restaurantId)
    const patchItem = (itemId: string, patch: Partial<PublicItem>) =>
      setMenu(m => m ? {
        ...m,
        sections: m.sections.map(s => ({
          ...s,
          items: s.items.map(it => it.id === itemId ? { ...it, ...patch } : it),
        })),
      } : m)
    const onAvail = ({ itemId, available }: { itemId: string; available: boolean }) => patchItem(itemId, { available })
    const onUpdated = () => api.get(`/customer/restaurant/${restaurantId}/menu`)
      .then(r => setMenu(r.data.data)).catch(() => {})
    socket.on('menu:item_availability', onAvail)
    socket.on('menu:updated', onUpdated)
    return () => { socket.off('menu:item_availability', onAvail); socket.off('menu:updated', onUpdated) }
  }, [restaurantId])

  const sections = useMemo(() => {
    if (!localizedMenu) return []
    return localizedMenu.sections
      .map(s => ({ ...s, items: s.items.filter(it => !it.allergens.some(a => excluded.has(a))) }))
      .filter(s => s.items.length)
  }, [localizedMenu, excluded])

  const availableAllergens = useMemo(
    () => Array.from(new Set(menu?.sections.flatMap(s => s.items.flatMap(i => i.allergens)) ?? [])),
    [menu],
  )

  const headerOffset = () =>
    parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64

  // scroll-spy su window (il body scrolla)
  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < lockUntil.current) return
      const probe = window.scrollY + headerOffset() + 64
      let cur = sections[0]?.id
      for (const s of sections) {
        const el = secRefs.current[s.id]
        if (el && el.offsetTop <= probe) cur = s.id
      }
      if (cur && cur !== active) setActive(cur)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sections, active])

  // muovi l'indicatore a pillola sotto la tab attiva + tienila in vista
  useEffect(() => {
    if (!active) return
    const tab = tabRefs.current[active]
    if (tab) {
      setInd({ x: tab.offsetLeft, w: tab.offsetWidth })
      tab.parentElement?.scrollTo({ left: tab.offsetLeft - 60, behavior: 'smooth' })
    }
  }, [active, sections])

  function goTo(id: string) {
    const el = secRefs.current[id]
    if (!el) return
    lockUntil.current = Date.now() + 650
    setActive(id)
    window.scrollTo({ top: el.offsetTop - headerOffset() - 56, behavior: 'smooth' })
  }

  function openItem(it: PublicItem) {
    if (!it.available) return
    setSelected(it)
    setItemOpen(true)
  }

  const reduce = useReducedMotion()

  return (
    <div className="relative">
      {/* sticky tabs + filtro */}
      <div className="sticky z-20 pt-1" style={{ top: 'var(--header-h)', background: 'linear-gradient(var(--surface) 72%, transparent)' }}>
        <div className="scrollbar-hide relative flex items-center gap-2 overflow-x-auto px-4 pb-2.5 pt-1.5">
          <motion.div aria-hidden className="absolute left-0 top-1.5 z-0 rounded-full"
            style={{ height: 35, background: 'var(--ink)' }}
            animate={{ x: ind.x, width: ind.w }} transition={SPRING} />
          {sections.map(s => {
            const on = active === s.id
            return (
              <button key={s.id} ref={el => { tabRefs.current[s.id] = el }} onClick={() => goTo(s.id)}
                className="relative z-[1] flex-none whitespace-nowrap rounded-full px-[15px] py-2 text-[14px] font-bold transition-colors active:scale-[0.97]"
                style={{ color: on ? 'var(--surface)' : 'var(--ink-3)' }}>
                {s.name}
              </button>
            )
          })}
          <button onClick={() => setFilterOpen(true)} aria-label={t('filterTitle')}
            className="relative z-[1] flex flex-none items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-bold active:scale-[0.97]"
            style={{
              background: excluded.size ? 'var(--brand)' : 'var(--raised)',
              color: excluded.size ? 'var(--on-brand)' : 'var(--ink-2)',
              boxShadow: 'var(--sh-1)',
            }}>
            <Filter size={16} />{excluded.size || ''}
          </button>
        </div>
      </div>

      {excluded.size > 0 && (
        <div className="mx-4 mb-1 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold"
          style={{ background: 'var(--brand-wash)', color: 'var(--brand-deep)' }}>
          <Info size={15} /> {t('hidingWith')} {Array.from(excluded).map(a => trAllergen(a, lang, a).toLowerCase()).join(', ')}.
        </div>
      )}

      {/* sezioni */}
      <div className="px-4 pb-2 pt-1">
        {sections.map((s, si) => (
          <section key={s.id} ref={el => { secRefs.current[s.id] = el }} style={{ paddingTop: si === 0 ? 6 : 22 }}>
            <h2 className="serif mb-3 pl-0.5 text-[27px] text-[var(--ink)]">{s.name}</h2>
            <div className="flex flex-col gap-3">
              {s.items.map((it, i) => (
                <motion.button
                  key={it.id} onClick={() => openItem(it)} disabled={!it.available}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ ...SPRING_SOFT, delay: Math.min(0.4, si * 0.05 + i * 0.06) }}
                  whileTap={it.available ? { scale: 0.97 } : undefined}
                  className="flex gap-3.5 rounded-[var(--r-card)] p-3 text-left"
                  style={{
                    background: 'var(--raised)', boxShadow: 'var(--sh-1)',
                    opacity: it.available ? 1 : 0.58, cursor: it.available ? 'pointer' : 'default',
                  }}>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[16px] font-bold text-[var(--ink)]">{it.name}</span>
                      {it.tags?.slice(0, 1).map(t => <Tag key={t}>{t}</Tag>)}
                    </div>
                    {it.description && (
                      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--ink-2)]">{it.description}</p>
                    )}
                    <div className="mt-auto flex items-center gap-2.5 pt-2">
                      <span className="tnum text-[15px] font-bold text-[var(--ink)]">{formatEuro(it.price)}</span>
                      <div className="flex gap-px">{it.allergens.slice(0, 5).map(a => <AllergenDot key={a} id={a} />)}</div>
                    </div>
                  </div>
                  <div className="relative flex-none">
                    <motion.div layoutId={reduce || !it.available ? undefined : `dish-${it.id}`}>
                      <Dish name={it.name} imageUrl={it.imageUrl} size={86} radius={14} />
                    </motion.div>
                    {!it.available ? (
                      <span className="absolute inset-0 grid place-items-center rounded-[14px] text-[11.5px] font-bold tracking-wide text-white"
                        style={{ background: 'rgba(42,31,26,.66)' }}>{t('soldOut')}</span>
                    ) : (
                      <span className="absolute -bottom-1.5 -right-1.5 grid h-[30px] w-[30px] place-items-center rounded-full text-[var(--on-brand)]"
                        style={{ background: 'var(--brand)', boxShadow: 'var(--sh-2)' }}>
                        <Plus size={17} strokeWidth={2.6} />
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        ))}
        {!menu && (
          <div className="space-y-3 pt-2">
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-[110px]" />)}
          </div>
        )}
        <div style={{ height: count > 0 ? 96 : 24 }} />
      </div>

      {/* floating cart bar */}
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            className="fixed inset-x-0 z-30 mx-auto max-w-lg px-4"
            style={{ bottom: compact ? 'calc(var(--safe-b) + 72px)' : 'calc(var(--safe-b) + 88px)' }}
            initial={{ y: 120, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 120, opacity: 0, scale: 0.95 }}
            transition={SPRING_SOFT}>
            <button onClick={onGoCart}
              className="flex h-[58px] w-full items-center gap-3 rounded-[18px] pl-4 pr-2.5 text-[var(--on-brand)] active:scale-[0.99]"
              style={{ background: 'var(--brand)', boxShadow: '0 14px 30px -8px var(--brand), 0 6px 16px rgba(42,31,26,.18)' }}>
              <motion.span key={count}
                className="grid h-[26px] min-w-[26px] place-items-center rounded-lg text-[14px] font-bold"
                style={{ background: 'rgba(255,255,255,.22)' }}
                initial={{ scale: 0.7 }} animate={{ scale: [1, 1.4, 1] }} transition={SPRING}>{count}</motion.span>
              <span className="flex-1 text-left text-[16px] font-bold">{t('viewCart')}</span>
              <span className="tnum rounded-xl px-3.5 py-2 text-[16px] font-bold" style={{ background: 'rgba(255,255,255,.16)' }}>
                {formatEuro(animTotal)}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {features && (features.reservationsEnabled || features.reviewUrl) && (
        <div className="mx-auto flex max-w-2xl flex-col gap-2.5 px-5 pb-28 pt-3">
          {features.reservationsEnabled && (
            <a href={`/prenota/${restaurantId}`} className="block rounded-2xl border border-[var(--hairline)] bg-[var(--sunken)] px-4 py-3.5 text-center text-[15px] font-bold text-[var(--ink)]">📅 Prenota un tavolo</a>
          )}
          {features.reviewUrl && (
            <a href={features.reviewUrl} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border border-[var(--hairline)] px-4 py-3.5 text-center text-[15px] font-semibold text-[var(--ink-2)]">⭐ Lascia una recensione</a>
          )}
        </div>
      )}

      <ItemSheet item={selected} open={itemOpen} onClose={() => setItemOpen(false)} />
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)}
        available={availableAllergens} excluded={excluded} setExcluded={setExcluded} />
    </div>
  )
}
