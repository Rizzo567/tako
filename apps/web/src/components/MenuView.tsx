'use client'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Plus, Minus, Filter, Info, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { PublicMenu, PublicItem, PublicVariant } from '@tako/types'
import { api } from '@/lib/api'
import { joinMenu, socket } from '@/lib/socket'
import { useSessionStore, useCartStore } from '@/lib/store'
import { formatEuro } from '@/lib/utils'
import { menuItemPriceLabel } from '@/lib/menu-price'
import { SPRING, SPRING_SOFT, flyToCart, useCountUp } from '@/lib/motion'
import { useI18n, trTag, trAllergen } from '@/lib/i18n'
import { dishGradient } from './ui/Dish'
import { Sheet } from './ui/Sheet'
import { WorkspaceMenuRenderer, type MenuDesign } from './WorkspaceMenuRenderer'

type ItemTranslation = { itemId: string; name: string; description?: string | null }

// 12 allergeni del prototipo: emoji per i badge + label per il filtro.
const ALLERGENS: { id: string; emoji: string; label: string }[] = [
  { id: 'crostacei', emoji: '🦐', label: 'Crostacei' },
  { id: 'solfiti', emoji: '⚠️', label: 'Solfiti' },
  { id: 'frutta-a-guscio', emoji: '🌰', label: 'Frutta a guscio' },
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
  const { t } = useI18n()
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full p-1" style={{ background: 'var(--sunken)' }}>
      <button
        aria-label={t('decrease')} onClick={() => onChange(value - 1)}
        className="grid h-10 w-10 place-items-center rounded-full active:scale-90"
        style={{ background: 'var(--raised)', color: value <= min ? 'var(--ink-3)' : 'var(--ink)', boxShadow: 'var(--sh-1)' }}
      ><Minus size={18} /></button>
      <motion.span key={value} className="tnum min-w-[30px] text-center text-[18px] font-bold text-[var(--ink)]"
        initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={SPRING}>{value}</motion.span>
      <button
        aria-label={t('increase')} onClick={() => onChange(value + 1)}
        className="grid h-10 w-10 place-items-center rounded-full text-[var(--on-brand)] active:scale-90"
        style={{ background: 'var(--brand)', boxShadow: 'var(--sh-1)' }}
      ><Plus size={18} /></button>
    </div>
  )
}

/* ───────────────── item detail sheet ───────────────── */
function ItemSheet({ item, open, onClose, canOrder = true, design }: { item: PublicItem | null; open: boolean; onClose: () => void; canOrder?: boolean; design?: MenuDesign }) {
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
  const mode=(item as PublicItem & {displayMode?:string}).displayMode==='centered'?'centered':(item as PublicItem & {displayMode?:string}).displayMode==='link'?'link':'standard';
  const menuFont=(font?:string)=>font==='serif'?'var(--font-serif)':font==='mono'?'monospace':font&&['poppins','staatliches','amaranth','italiana'].includes(font)?`var(--font-${font})`:undefined;
  const part=(key:string):CSSProperties=>{const value=design?.[mode]?.[key];return value?{fontSize:value.fontSize,color:value.color,fontWeight:value.bold?700:400,fontStyle:value.italic?'italic':'normal',textAlign:value.align,fontFamily:menuFont(value.font),textDecoration:value.underline?'underline':'none'}:{};};
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
      <div className="pb-[18px]" style={{fontFamily:menuFont(design?.font),color:design?.text}}>
        {/* hero (shared-element: cresce dalla tile lista via layoutId) */}
        {design?.showImages!==false&&item.imageUrl&&<div className="px-5">
          <motion.div
            ref={heroRef}
            layoutId={reduce ? undefined : `dish-${item.id}`}
            className="relative grid h-[188px] w-full place-items-center overflow-hidden"
            style={{ width:design?.imageWidth?Math.min(design.imageWidth,600):undefined,height:design?.imageHeight||188,maxWidth:'100%',borderRadius: design?.imageRadius??(design?.imageShape==='circle'?'50%':design?.imageShape==='square'?0:20), background: item.imageUrl ? 'var(--sunken)' : dishGradient(item.name) }}
          >
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="h-full w-full object-cover object-center" />
            ) : (
              <span className="serif" style={{ fontSize: 90, color: 'rgba(255,255,255,.9)', lineHeight: 1 }}>
                {(item.name.trim()[0] || '·').toUpperCase()}
              </span>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="absolute left-3 top-3 flex gap-1.5">
                {item.tags.map(t => <Tag key={t}>{t}</Tag>)}
              </div>
            )}
          </motion.div>
        </div>}

        <div className="px-5 pt-[18px]">
          <h3 className="text-[23px] font-bold text-[var(--ink)]" style={part('name')}>{item.name}</h3>
          {design?.showDescriptions!==false&&item.description && (
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--ink-2)]" style={part('description')}>{item.description}</p>
          )}

          {design?.showPrices!==false&&menuItemPriceLabel(item,formatEuro)&&<p className="mt-3 font-bold" style={part('price')}>{menuItemPriceLabel(item,formatEuro)}</p>}
          {design?.showImages===false&&item.tags?.length>0&&<div className="mt-2 flex flex-wrap gap-2">{item.tags.map(tag=><Tag key={tag}>{tag}</Tag>)}</div>}
          {design?.showAllergens!==false&&item.allergens.length > 0 && (
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

      {/* sticky add bar — nascosta se gli ordini dal telefono sono disattivati */}
      {canOrder ? (
        <div className="sticky bottom-0 flex items-center gap-3.5 border-t px-5 py-3"
          style={{ background: 'var(--raised)', borderColor: 'var(--hairline)' }}>
          <Qty value={qty} onChange={q => setQty(Math.max(1, q))} min={1} />
          <button onClick={handleAdd}
            className="flex h-[54px] flex-1 items-center justify-between rounded-2xl px-5 text-[16px] font-bold text-[var(--on-brand)] active:scale-[0.98]"
            style={{ background: design?.primary||'var(--brand)', boxShadow: '0 8px 22px -8px var(--brand)' }}>
            <span>{t('add')}</span>
            <span className="tnum">{formatEuro(unit * qty)}</span>
          </button>
        </div>
      ) : (
        <div className="sticky bottom-0 border-t px-5 py-3.5 text-center text-[13px] font-semibold text-[var(--ink-2)]"
          style={{ background: 'var(--raised)', borderColor: 'var(--hairline)' }}>
          {t('orderingOff')}
        </div>
      )}
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
    if (next.has(id)) next.delete(id); else next.add(id)
    setExcluded(next)
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('filterTitle')}
      sub={t('filterSub')} leadIcon={<Filter size={20} />}>
      <div className="grid grid-cols-2 gap-2.5 px-5 pb-[18px] pt-1">
        {list.map(a => {
          const on = excluded.has(a.id)
          return (
            <button key={a.id} onClick={() => toggle(a.id)} aria-pressed={on}
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
export function MenuView({ onGoCart, compact, serviceActions }: { onGoCart: () => void; compact?: boolean; serviceActions?: ReactNode }) {
  const { t, lang, defaultLang, languages, setLang } = useI18n()
  const restaurantId = useSessionStore(s => s.restaurantId)
  const sessionLogo = useSessionStore(s => s.logoUrl)
  const items = useCartStore(s => s.items)
  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items])
  const total = useMemo(() => items.reduce((n, i) => n + i.unitPrice * i.quantity, 0), [items])
  const animTotal = useCountUp(total)

  const orderingEnabled = useSessionStore(s => s.orderingEnabled)
  const setSession = useSessionStore(s => s.setSession)

  const [menuChoices,setMenuChoices]=useState<{id:string;name:string}[]>([]);
  const [menuId,setMenuId]=useState('');
  const [food,setFood]=useState<any>({});
  const [design,setDesign]=useState<MenuDesign|null>(null);
  const rendererDesign = useMemo(() => ({ ...(design || {}), ...(!design?.logoUrl && sessionLogo ? { logoUrl: sessionLogo } : {}) }), [design, sessionLogo])
  const [menu, setMenu] = useState<PublicMenu | null>(null)
  const [menuError, setMenuError] = useState(false)
  const [features, setFeatures] = useState<{ restaurantName?: string; reservationsEnabled?: boolean; reviewUrl?: string; customerOrderingEnabled?: boolean; coverCharge?: number } | null>(null)
  const [trMap, setTrMap] = useState<Record<string, ItemTranslation>>({})
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [selected, setSelected] = useState<PublicItem | null>(null)
  const [itemOpen, setItemOpen] = useState(false)

  const [menuLoading, setMenuLoading] = useState(false)
  const loadSequence = useRef(0)

  const loadMenu = useCallback(() => {
    if (!restaurantId) return
    const sequence = ++loadSequence.current
    setMenuError(false)
    setMenuLoading(true)
    api.get(`/customer/restaurant/${restaurantId}/menu?menuId=${encodeURIComponent(menuId)}&lang=${encodeURIComponent(lang)}`).then(r => {
      if (sequence !== loadSequence.current) return
      const m: PublicMenu = r.data.data
      setMenu(m)
      setFood({labels:r.data.foodTranslations?.[lang],catalogs:r.data.foodCatalogs});setMenuChoices(r.data.menus?.length ? r.data.menus : [{id:m.id,name:m.name}]);setDesign(r.data.design||null)
      setFeatures(r.data.features || null)
      // Propaga i flag al session store: usati anche fuori da MenuView (es. icona carrello
      // nell'header, coperto nel carrello). Default sicuri se non specificati.
      setSession({
        orderingEnabled: r.data.features?.customerOrderingEnabled !== false,
        reservationsEnabled: r.data.features?.reservationsEnabled === true,
        coverCharge: Number(r.data.features?.coverCharge) || 0,
      })
    }).catch(() => { if (sequence === loadSequence.current) setMenuError(true) }).finally(() => { if (sequence === loadSequence.current) setMenuLoading(false) })
  }, [restaurantId, setSession, menuId, lang])

  useEffect(() => { loadMenu(); return () => { loadSequence.current++ } }, [loadMenu])

  // Traduzioni piatti: quando la lingua ≠ default, rifetch/merge per itemId (solo display).
  useEffect(() => {
    if (design || !restaurantId || !lang || lang === defaultLang) { setTrMap({}); return }
    let alive = true
    api.get(`/customer/menu-translations?restaurantId=${restaurantId}&lang=${encodeURIComponent(lang)}`).then(r => {
      if (!alive) return
      const rows: ItemTranslation[] = r.data.data ?? []
      const map: Record<string, ItemTranslation> = {}
      for (const t of rows) map[t.itemId] = t
      setTrMap(map)
    }).catch(() => { if (alive) setTrMap({}) })
    return () => { alive = false }
  }, [restaurantId, lang, defaultLang, design])

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
    const onUpdated = loadMenu
    socket.on('menu:item_availability', onAvail)
    socket.on('menu:updated', onUpdated)
    return () => { socket.off('menu:item_availability', onAvail); socket.off('menu:updated', onUpdated) }
  }, [restaurantId,loadMenu])

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

  // Piatti totali nel menu (pre-filtro): distingue "menu vuoto" da "filtri troppo stretti".
  const totalItems = useMemo(
    () => menu?.sections.reduce((n, s) => n + s.items.length, 0) ?? 0,
    [menu],
  )

  function openItem(it: PublicItem) {
    if (!it.available) return
    setSelected(it)
    setItemOpen(true)
  }

  // Errore di caricamento menu (nessun dato) → schermata d'errore con "Riprova",
  // invece di uno skeleton che resta all'infinito.
  if (menuError && !menu) return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center gap-3 p-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/tako/tako-cloche.png" alt="" className="anim-float w-[140px]" style={{ filter: 'drop-shadow(0 16px 26px rgba(217,83,58,.18))' }} />
      <h3 className="text-[20px] font-bold text-[var(--ink)]">{t('errorTitle')}</h3>
      <p className="mb-2 text-[14px] text-[var(--ink-2)]">{t('menuError')}</p>
      <button onClick={loadMenu}
        className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-bold text-[var(--on-brand)] active:scale-95"
        style={{ background: 'var(--brand)', boxShadow: '0 8px 22px -8px var(--brand)' }}>
        {t('retry')}
      </button>
    </div>
  )

  return (
    <div className="relative">
      {menuError && menu && <div role="alert" className="mx-4 my-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
        <span>{t('menuError')}</span>
        <button onClick={loadMenu} className="min-h-10 rounded-lg px-3 font-bold underline">{t('retry')}</button>
      </div>}
      {excluded.size > 0 && (
        <div className="mx-4 mb-1 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold"
          style={{ background: 'var(--brand-wash)', color: 'var(--brand-deep)' }}>
          <Info size={15} /> {t('hidingWith')} {Array.from(excluded).map(a => trAllergen(a, lang, a).toLowerCase()).join(', ')}.
        </div>
      )}

      {!orderingEnabled && (
        <div className="mx-4 mb-1 mt-1 flex items-center gap-2 rounded-xl px-3.5 py-3 text-[13px] font-semibold"
          style={{ background: 'var(--sunken)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>
          <Info size={16} className="flex-none" /> {t('orderingOff')}
        </div>
      )}

      {/* sezioni */}
      <div className="pb-2">
        {localizedMenu && <WorkspaceMenuRenderer
          menu={{ ...localizedMenu, sections }}
          design={rendererDesign}
          onOpen={openItem}
          foodLabels={food.labels}
          foodCatalogs={food.catalogs}
          menus={menuChoices}
          onSelectMenu={setMenuId}
          languages={languages}
          language={lang}
          onSelectLanguage={setLang}
          restaurantName={features?.restaurantName}
          loading={menuLoading}
          emptyState={
          <div className="flex min-h-[46vh] flex-col items-center justify-center gap-3 px-8 py-10 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tako/tako-pasta.png" alt="" className="anim-float w-[130px]" style={{ filter: 'drop-shadow(0 16px 26px rgba(217,83,58,.18))' }} />
            <h3 className="text-[19px] font-bold text-[var(--ink)]">
              {totalItems > 0 && excluded.size > 0 ? t('menuNoFilter') : t('menuEmpty')}
            </h3>
            {totalItems > 0 && excluded.size > 0 && (
              <button onClick={() => setExcluded(new Set())}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-bold text-[var(--on-brand)] active:scale-95"
                style={{ background: 'var(--brand)', boxShadow: '0 8px 22px -8px var(--brand)' }}>
                {t('reset')}
              </button>
            )}
          </div>
          }
          toolbar={<>
            {serviceActions}
            <button onClick={() => setFilterOpen(true)}
              aria-label={`${t('filterTitle')}${excluded.size ? ` (${excluded.size})` : ''}`}
              aria-haspopup="dialog" aria-expanded={filterOpen}
              className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl px-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: excluded.size ? design?.primary || 'var(--brand)' : 'rgba(255,255,255,.14)', color: 'inherit', border: '1px solid currentColor' }}>
              <Filter size={18} aria-hidden="true" />
              {excluded.size > 0 && <span>{excluded.size}</span>}
            </button>
          </>}
        />}
        {!menu && !menuError && (
          <div className="space-y-3 pt-2">
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-[110px]" />)}
          </div>
        )}
        <div style={{ height: count > 0 ? 96 : 24 }} />
      </div>

      {/* floating cart bar */}
      <AnimatePresence>
        {orderingEnabled && count > 0 && (
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
            <a href={`/prenota/${restaurantId}`} className="block rounded-2xl border border-[var(--hairline)] bg-[var(--sunken)] px-4 py-3.5 text-center text-[15px] font-bold text-[var(--ink)]">📅 {t('btnReserve')}</a>
          )}
          {features.reviewUrl && (
            <a href={features.reviewUrl} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border border-[var(--hairline)] px-4 py-3.5 text-center text-[15px] font-semibold text-[var(--ink-2)]">⭐ {t('leaveReview')}</a>
          )}
        </div>
      )}

      <ItemSheet item={selected} open={itemOpen} onClose={() => setItemOpen(false)} canOrder={orderingEnabled} design={design||undefined} />
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)}
        available={availableAllergens} excluded={excluded} setExcluded={setExcluded} />
    </div>
  )
}
