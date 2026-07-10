'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Bell, ShoppingBag, Utensils, Clock, Sparkles, HandHelping, ReceiptText, GlassWater } from 'lucide-react'
import { api } from '@/lib/api'
import { useSessionStore, useCartStore } from '@/lib/store'
import { SPRING, SPRING_SHEET, EASE_OUT } from '@/lib/motion'
import { MenuView } from './MenuView'
import { CartView } from './CartView'
import { OrderTracking } from './OrderTracking'
import { AiChat } from './AiChat'

type View = 'menu' | 'tracking' | 'chat'

// Sets --brand and picks a readable text color (--on-brand) via WCAG relative luminance,
// so CTAs stay legible whatever brand color a restaurant chooses (incl. light yellows).
function applyBrand(color?: string | null) {
  if (!color) return
  const root = document.documentElement
  root.style.setProperty('--brand', color)
  const hex = color.trim().replace('#', '')
  if (hex.length !== 6) return
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  root.style.setProperty('--on-brand', L > 0.62 ? '#2A1F1A' : '#FFFFFF')
}

/* ───────────────── header ───────────────── */
function Header({ count, onCart, onWaiter }: { count: number; onCart: () => void; onWaiter: () => void }) {
  const { restaurantName, tableNumber, logoUrl } = useSessionStore()
  const ref = useRef<HTMLElement>(null)

  // Pubblica l'altezza reale dell'header come --header-h (le tab del menu ci si agganciano).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <header ref={ref}
      className="sticky top-0 z-40 flex items-center gap-3 px-3.5"
      style={{ paddingTop: 'calc(var(--safe-t) + 12px)', paddingBottom: 11, background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl || '/mascotte/tako-chef.png'} alt="" className="h-[38px] w-[38px] flex-none object-contain" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-bold leading-tight text-[var(--ink)]">{restaurantName}</p>
        <p className="mt-0.5 text-[12.5px] font-semibold text-[var(--ink-2)]">Tavolo <span className="tnum">{tableNumber}</span></p>
      </div>
      <button onClick={onWaiter} aria-label="Chiama cameriere"
        className="grid h-[42px] w-[42px] place-items-center rounded-full text-[var(--ink)] active:scale-90"
        style={{ background: 'var(--raised)', boxShadow: 'var(--sh-1)' }}>
        <Bell size={20} />
      </button>
      <button onClick={onCart} aria-label="Carrello" data-cart-anchor
        className="relative grid h-[42px] w-[42px] place-items-center rounded-full text-[var(--ink)] active:scale-90"
        style={{ background: 'var(--raised)', boxShadow: 'var(--sh-1)' }}>
        <ShoppingBag size={20} />
        <AnimatePresence>
          {count > 0 && (
            <motion.span key={count}
              className="absolute -right-1 -top-1 grid h-[19px] min-w-[19px] place-items-center rounded-full px-[5px] text-[11px] font-bold text-[var(--on-brand)]"
              style={{ background: 'var(--brand)', boxShadow: '0 0 0 2.5px var(--surface)' }}
              initial={{ scale: 0.4 }} animate={{ scale: [1, 1.5, 1] }} exit={{ scale: 0 }}
              transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}>
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </header>
  )
}

/* ───────────────── bottom nav ───────────────── */
function BottomNav({ view, setView, aiEnabled, orderActive }: {
  view: View; setView: (v: View) => void; aiEnabled: boolean; orderActive: boolean
}) {
  const items = [
    { id: 'menu' as View, Icon: Utensils, label: 'Menù', dot: false },
    { id: 'tracking' as View, Icon: Clock, label: 'Ordine', dot: orderActive },
    ...(aiEnabled ? [{ id: 'chat' as View, Icon: Sparkles, label: 'Assistente', dot: false }] : []),
  ]
  const n = items.length
  const idx = Math.max(0, items.findIndex(i => i.id === view))

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg"
      style={{ background: 'var(--raised)', borderTop: '1px solid var(--hairline)', padding: '8px 8px calc(var(--safe-b) + 8px)' }}>
      {/* pillola scorrevole */}
      <div aria-hidden className="pointer-events-none absolute left-2 right-2 top-2 z-0" style={{ height: 46 }}>
        <motion.div className="grid h-full place-items-center" style={{ width: `${100 / n}%` }}
          animate={{ x: `${idx * 100}%` }} transition={SPRING}>
          <span className="h-[42px] w-[66px] rounded-[14px]" style={{ background: 'var(--brand-tint)' }} />
        </motion.div>
      </div>
      {items.map(it => {
        const on = view === it.id
        return (
          <button key={it.id} onClick={() => setView(it.id)}
            className="relative z-[1] flex flex-1 flex-col items-center gap-1 py-[7px] transition-colors active:scale-95"
            style={{ color: on ? 'var(--brand)' : 'var(--ink-3)' }}>
            <motion.span className="relative" animate={{ y: on ? -1 : 0, scale: on ? 1.06 : 1 }} transition={SPRING}>
              <it.Icon size={23} strokeWidth={on ? 2.4 : 2} fill={on && it.id === 'chat' ? 'currentColor' : 'none'} />
              {it.dot && (
                <span className="absolute -right-[3px] -top-0.5 h-2 w-2 rounded-full"
                  style={{ background: 'var(--ok)', boxShadow: '0 0 0 2px var(--raised)' }} />
              )}
            </motion.span>
            <span className="text-[11px]" style={{ fontWeight: on ? 700 : 600 }}>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

/* ───────────────── customer app shell ───────────────── */
export function CustomerApp({ restaurantId, token }: { restaurantId: string; token: string }) {
  const { setSession, orderId, logoUrl } = useSessionStore()
  const count = useCartStore(s => s.items.reduce((n, i) => n + i.quantity, 0))
  const [view, setView] = useState<View>('menu')
  const [cartOpen, setCartOpen] = useState(false)
  const [waiterSheet, setWaiterSheet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get(`/customer/table/${token}`)
      .then(r => {
        const { restaurant, table, sessionId } = r.data.data
        setSession({
          restaurantId: restaurant.id,
          tableId: table.id,
          tableNumber: table.number,
          restaurantName: restaurant.name,
          primaryColor: restaurant.primaryColor,
          aiEnabled: restaurant.aiEnabled,
          logoUrl: restaurant.logoUrl,
          sessionId: sessionId ?? null,
        })
        // Scoping carrello: se cambia tavolo/ristorante o è scaduto, si azzera
        // (evita che riappaiano gli item del pranzo precedente).
        useCartStore.getState().ensureScope(`${restaurant.id}:${table.id}`)
        applyBrand(restaurant.primaryColor)
      })
      .catch(() => setError('Tavolo non trovato. Riprova a scansionare il QR.'))
      .finally(() => setLoading(false))
  }, [token, setSession])

  const aiEnabled = useSessionStore(s => s.aiEnabled)

  async function callWaiter(type: 'help' | 'bill' | 'water') {
    const { restaurantId, tableId, tableNumber } = useSessionStore.getState()
    try {
      await api.post('/customer/waiter-call', { restaurantId, tableId, tableNumber, type })
      setWaiterSheet(false)
      toast.success('Cameriere avvisato! 🔔')
    } catch {
      // Niente falso "fatto": se la chiamata fallisce, avvisa e lascia il foglio aperto.
      toast.error('Impossibile chiamare il cameriere. Riprova.')
    }
  }

  if (loading) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4" style={{ background: 'var(--surface)' }}>
      <div className="grid h-20 w-20 place-items-center" style={{ borderRadius: 'var(--r-card)', background: 'var(--raised)', boxShadow: 'var(--sh-2)' }}>
        {logoUrl
          ? <img src={logoUrl} alt="logo" className="h-14 w-14 rounded-2xl object-contain" />
          : <img src="/mascotte/tako-chef.png" alt="" className="h-14 w-14 object-contain" />}
      </div>
      <div className="h-1 w-8 animate-pulse rounded-full" style={{ background: 'var(--brand)' }} />
      <p className="text-sm font-semibold text-[var(--ink-3)]">Carico il menu...</p>
    </div>
  )

  if (error) return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
      <div>
        <h1 className="mb-2 font-serif text-2xl text-[var(--ink)]">Qualcosa non va</h1>
        <p className="font-semibold text-[var(--ink-2)]">{error}</p>
        <p className="mt-3 text-sm font-medium text-[var(--ink-3)]">Connettiti al Wi-Fi del locale se la pagina non carica.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-[100dvh]" style={{ background: 'var(--surface)' }}>
      <Header count={count} onCart={() => setCartOpen(true)} onWaiter={() => setWaiterSheet(true)} />

      <main style={{ paddingBottom: 'calc(var(--safe-b) + 72px)' }}>
        <AnimatePresence mode="wait">
          <motion.div key={view}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.34, ease: EASE_OUT }}>
            {view === 'menu' && <MenuView onGoCart={() => setCartOpen(true)} />}
            {view === 'tracking' && <OrderTracking onBack={() => setView('menu')} onOrderAgain={() => setView('menu')} />}
            {view === 'chat' && <AiChat onBack={() => setView('menu')} onOrderPlaced={() => setView('tracking')} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav view={view} setView={setView} aiEnabled={aiEnabled} orderActive={!!orderId} />

      {/* Cart bottom sheet overlay */}
      <AnimatePresence>
        {cartOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div className="absolute inset-0" style={{ background: 'rgba(30,20,16,.42)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }}
              onClick={() => setCartOpen(false)} />
            <motion.div className="relative mx-auto max-h-[88vh] w-full max-w-lg overflow-y-auto"
              style={{ background: 'var(--surface)', borderTopLeftRadius: 'var(--r-sheet)', borderTopRightRadius: 'var(--r-sheet)', boxShadow: 'var(--sh-sheet)' }}
              initial={{ y: '101%' }} animate={{ y: 0 }} exit={{ y: '101%' }} transition={SPRING_SHEET}>
              <CartView
                onBack={() => setCartOpen(false)}
                onOrderPlaced={() => { setCartOpen(false); setView('tracking') }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Waiter call bottom sheet */}
      <AnimatePresence>
        {waiterSheet && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div className="absolute inset-0" style={{ background: 'rgba(30,20,16,.5)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }}
              onClick={() => setWaiterSheet(false)} />
            <motion.div className="relative mx-auto w-full max-w-lg p-6 pb-10"
              style={{ background: 'var(--raised)', borderTopLeftRadius: 'var(--r-sheet)', borderTopRightRadius: 'var(--r-sheet)', boxShadow: 'var(--sh-sheet)', paddingBottom: 'calc(var(--safe-b) + 24px)' }}
              initial={{ y: '101%' }} animate={{ y: 0 }} exit={{ y: '101%' }} transition={SPRING_SHEET}>
              <div className="mx-auto mb-5 h-[5px] w-10 rounded-full" style={{ background: 'var(--hairline)' }} />
              <h3 className="mb-5 text-center font-serif text-xl text-[var(--ink)]">Chiama il cameriere</h3>
              <div className="space-y-3">
                {[
                  { type: 'help', Icon: HandHelping, label: 'Ho bisogno di aiuto' },
                  { type: 'bill', Icon: ReceiptText, label: 'Vorrei il conto' },
                  { type: 'water', Icon: GlassWater, label: 'Acqua, per favore' },
                ].map(({ type, Icon, label }) => (
                  <button key={type} onClick={() => callWaiter(type as 'help' | 'bill' | 'water')}
                    className="flex w-full items-center gap-4 p-4 text-lg font-semibold text-[var(--ink)] active:scale-[0.98]"
                    style={{ background: 'var(--sunken)', borderRadius: 'var(--r-card)' }}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--on-brand)]" style={{ background: 'var(--brand)' }}>
                      <Icon size={20} strokeWidth={2.2} />
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
