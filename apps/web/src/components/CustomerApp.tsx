'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { api } from '@/lib/api'
import { useSessionStore, useCartStore } from '@/lib/store'
import { SPRING, EASE_OUT } from '@/lib/motion'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { MenuView } from './MenuView'
import { CartView } from './CartView'
import { OrderTracking } from './OrderTracking'
import { AiChat } from './AiChat'
import { LanguageSheet } from './LanguageSheet'
import { WaiterSheet } from './WaiterSheet'
import { Sheet } from './ui/Sheet'

type View = 'menu' | 'tracking' | 'chat'

// Keyframe per le animazioni-al-click (WAAPI: affidabili, indipendenti dai re-render).
const KF_RING = [
  { transform: 'rotate(0deg)' }, { transform: 'rotate(-15deg)', offset: 0.15 }, { transform: 'rotate(12deg)', offset: 0.32 },
  { transform: 'rotate(-8deg)', offset: 0.5 }, { transform: 'rotate(5deg)', offset: 0.68 }, { transform: 'rotate(-2deg)', offset: 0.84 }, { transform: 'rotate(0deg)' },
]
const KF_HOP = [
  { transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-8px) scale(1.07)', offset: 0.4 },
  { transform: 'translateY(0) scale(.96)', offset: 0.72 }, { transform: 'translateY(0) scale(1)' },
]
const KF_WIGGLE = [
  { transform: 'rotate(0deg)' }, { transform: 'rotate(-8deg)', offset: 0.25 }, { transform: 'rotate(7deg)', offset: 0.5 },
  { transform: 'rotate(-3deg)', offset: 0.75 }, { transform: 'rotate(0deg)' },
]

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

/* ───────────────── glass icon button (header) ───────────────── */
function GlassIconBtn({
  img, onClick, badge, text, label, idle, clickKf, imgOrigin, imgScale,
}: {
  img: string; onClick: () => void; badge?: number; text: string; label: string
  idle?: string; clickKf: Keyframe[]; imgOrigin: string; imgScale?: number
}) {
  return (
    <button
      aria-label={label}
      onClick={(e) => {
        const im = e.currentTarget.querySelector('img')
        if (im && im.animate) {
          try {
            const s = imgScale ?? 1
            const kf = clickKf.map((f) => ({ ...f, transform: `scale(${s}) ${f.transform as string}` }))
            im.animate(kf, { duration: 850, easing: 'ease-in-out' })
          } catch { /* noop */ }
        }
        onClick()
      }}
      className="flex flex-none flex-col items-center gap-0.5 active:scale-[0.94]"
      style={{ background: 'transparent', border: 'none', padding: 0 }}
    >
      <span className="relative grid h-[46px] w-[46px] place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img} alt="" className={idle}
          style={{
            width: 42, height: 42, objectFit: 'contain', display: 'block',
            transform: imgScale ? `scale(${imgScale})` : undefined, transformOrigin: imgOrigin,
            filter: 'drop-shadow(0 5px 7px rgba(42,31,26,.24))',
          }}
        />
        <AnimatePresence>
          {badge != null && badge > 0 && (
            <motion.span
              key={badge}
              className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-[5px] text-[11px] font-extrabold text-[var(--on-brand)]"
              style={{ background: 'var(--brand)', boxShadow: '0 0 0 2px var(--surface)' }}
              initial={{ scale: 0.4 }} animate={{ scale: [1, 1.5, 1] }} exit={{ scale: 0 }}
              transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {badge}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="text-[10.5px] font-bold leading-none text-[var(--ink-2)]">{text}</span>
    </button>
  )
}

/* ───────────────── header (glass, 3 icone 3D centrate) ───────────────── */
function Header({ count, compact, onCart, onWaiter, onLang }: {
  count: number; compact: boolean; onCart: () => void; onWaiter: () => void; onLang: () => void
}) {
  const { t } = useI18n()
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
    <header
      ref={ref}
      className="sticky top-0 z-30 overflow-hidden"
      style={{
        background: 'var(--surface)',
        maxHeight: compact ? 0 : 'calc(var(--safe-t) + 94px)',
        transition: 'max-height .45s var(--spring)',
      }}
    >
      <div
        className="flex items-center justify-center gap-9 px-3.5"
        style={{
          paddingTop: 'calc(var(--safe-t) + 8px)', paddingBottom: 12,
          transform: compact ? 'translateY(-84px)' : 'none', opacity: compact ? 0 : 1,
          transition: 'transform .45s var(--spring), opacity .3s ease',
        }}
      >
        <GlassIconBtn img="/tako/nav/m-bell.png" onClick={onWaiter} text={t('hdrWaiter')} label={t('callWaiter')} idle="anim-wiggle" clickKf={KF_RING} imgOrigin="50% 14%" />
        <span data-cart-anchor>
          <GlassIconBtn img="/tako/nav/m-bag.png" onClick={onCart} badge={count} text={t('hdrCart')} label={t('hdrCart')} clickKf={KF_HOP} imgOrigin="50% 85%" />
        </span>
        <GlassIconBtn img="/tako/nav/m-lang.png" onClick={onLang} text="Language" label={t('language')} clickKf={KF_WIGGLE} imgOrigin="50% 50%" imgScale={1.5} />
      </div>
    </header>
  )
}

/* ───────────────── bottom nav (glass, icone 3D, pillola layoutId) ───────────────── */
const NAV_IMG: Record<View, string> = { menu: '/tako/nav/m-menu.png', tracking: '/tako/nav/m-order.png', chat: '/tako/tako-phone.png' }
function BottomNav({ view, setView, aiEnabled, orderActive, compact }: {
  view: View; setView: (v: View) => void; aiEnabled: boolean; orderActive: boolean; compact: boolean
}) {
  const { t } = useI18n()
  const items: { id: View; label: string; dot?: boolean }[] = [
    { id: 'menu', label: t('navMenu') },
    { id: 'tracking', label: t('navOrder'), dot: orderActive },
    ...(aiEnabled ? [{ id: 'chat' as View, label: t('navAssistant') }] : []),
  ]
  const isz = compact ? 28 : 32

  return (
    <div className="fixed inset-x-0 z-40 mx-auto max-w-lg px-3.5" style={{ bottom: 'calc(var(--safe-b) + 14px)' }}>
      <nav
        className="flex"
        style={{
          padding: compact ? 4 : 6, borderRadius: compact ? 18 : 22,
          background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.55)',
          boxShadow: '0 12px 34px rgba(42,31,26,.22), inset 0 1px 0 rgba(255,255,255,.75)',
          transition: 'padding .42s var(--spring), border-radius .42s var(--spring)',
        }}
      >
        {items.map((it) => {
          const on = view === it.id
          return (
            <button
              key={it.id} onClick={() => setView(it.id)}
              className="relative z-[1] flex flex-1 flex-col items-center active:scale-[0.95]"
              style={{ gap: compact ? 0 : 3, padding: compact ? '6px 0' : '4px 0', color: on ? 'var(--brand)' : 'var(--ink-3)', transition: 'color .3s' }}
            >
              {on && (
                <motion.span
                  layoutId="navpill" aria-hidden
                  className="absolute inset-x-1 inset-y-0.5 -z-[1] rounded-[14px]"
                  style={{ background: 'var(--brand-tint)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <motion.span className="relative" animate={{ y: on ? -1 : 0, scale: on ? 1.08 : 1 }} transition={SPRING}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={NAV_IMG[it.id]} alt="" style={{ width: isz, height: isz, objectFit: 'contain', display: 'block', transition: 'width .42s var(--spring), height .42s var(--spring)', filter: 'drop-shadow(0 4px 5px rgba(42,31,26,.18))' }} />
                {it.dot && <span className="absolute -right-[3px] -top-0.5 h-[9px] w-[9px] rounded-full" style={{ background: 'var(--ok)', boxShadow: '0 0 0 2px var(--surface)' }} />}
              </motion.span>
              <span
                className="text-[10.5px] font-bold"
                style={{ overflow: 'hidden', maxHeight: compact ? 0 : 16, opacity: compact ? 0 : 1, transition: 'max-height .4s var(--spring), opacity .25s ease' }}
              >
                {it.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

/* ───────────────── shell ───────────────── */
function CustomerShell({ token }: { token: string }) {
  const { t } = useI18n()
  const { setSession, orderId, logoUrl } = useSessionStore()
  const count = useCartStore(s => s.items.reduce((n, i) => n + i.quantity, 0))
  const [view, setView] = useState<View>('menu')
  const [cartOpen, setCartOpen] = useState(false)
  const [waiterSheet, setWaiterSheet] = useState(false)
  const [langSheet, setLangSheet] = useState(false)
  const [compact, setCompact] = useState(false)
  const [sweep, setSweep] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    api.get(`/customer/table/${token}`)
      .then(r => {
        const { restaurant, table, sessionId } = r.data.data
        setSession({
          restaurantId: restaurant.id, tableId: table.id, tableNumber: table.number,
          restaurantName: restaurant.name, primaryColor: restaurant.primaryColor,
          aiEnabled: restaurant.aiEnabled, logoUrl: restaurant.logoUrl, sessionId: sessionId ?? null,
        })
        useCartStore.getState().ensureScope(`${restaurant.id}:${table.id}`)
        applyBrand(restaurant.primaryColor)
      })
      .catch(() => setError('Tavolo non trovato. Riprova a scansionare il QR.'))
      .finally(() => setLoading(false))
  }, [token, setSession])

  const aiEnabled = useSessionStore(s => s.aiEnabled)

  // Header/nav collapse on scroll down (la pagina scrolla il body).
  useEffect(() => { setCompact(false) }, [view])
  useEffect(() => {
    let prev = typeof window !== 'undefined' ? window.scrollY : 0
    let lastFlip = 0
    const onScroll = () => {
      const top = window.scrollY
      const dy = top - prev; prev = top
      if (top <= 16) { setCompact(false); return }
      if (Math.abs(dy) < 7) return
      const now = Date.now()
      if (now - lastFlip < 240) return
      lastFlip = now
      setCompact(dy > 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [view])

  // "Vedi carrello": pennellata diagonale brand poi apre il carrello (~370ms).
  function launchCart() {
    if (reduce) { setCartOpen(true); return }
    setSweep(true)
    setTimeout(() => setCartOpen(true), 370)
    setTimeout(() => setSweep(false), 780)
  }

  if (loading) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4" style={{ background: 'var(--surface)' }}>
      <div className="grid h-20 w-20 place-items-center" style={{ borderRadius: 'var(--r-card)', background: 'var(--raised)', boxShadow: 'var(--sh-2)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl || '/tako/tako-chef.png'} alt="" className="h-14 w-14 rounded-2xl object-contain" />
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
      <Header count={count} compact={compact} onCart={() => setCartOpen(true)} onWaiter={() => setWaiterSheet(true)} onLang={() => setLangSheet(true)} />

      <main style={{ paddingBottom: view === 'chat' ? 0 : 'calc(var(--safe-b) + 96px)' }}>
        <AnimatePresence mode="wait">
          <motion.div key={view}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.34, ease: EASE_OUT }}>
            {view === 'menu' && <MenuView onGoCart={launchCart} compact={compact} />}
            {view === 'tracking' && <OrderTracking onBack={() => setView('menu')} onOrderAgain={() => setView('menu')} />}
            {view === 'chat' && <AiChat onBack={() => setView('menu')} onOrderPlaced={() => setView('tracking')} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav view={view} setView={setView} aiEnabled={aiEnabled} orderActive={!!orderId} compact={compact} />

      {/* pennellata diagonale brand al lancio del carrello */}
      <AnimatePresence>
        {sweep && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[70]"
            style={{ background: 'var(--brand)' }}
            initial={{ clipPath: 'polygon(120% 0, 130% 0, 130% 100%, 120% 100%)' }}
            animate={{ clipPath: 'polygon(-30% 0, 130% 0, 130% 100%, -30% 100%)' }}
            exit={{ clipPath: 'polygon(-40% 0, -30% 0, -30% 100%, -40% 100%)' }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Cart bottom sheet */}
      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title={t('yourOrder')} leadIcon={<span className="text-[18px]">🛍️</span>} maxH="90%">
        <CartView onBack={() => setCartOpen(false)} onOrderPlaced={() => { setCartOpen(false); setView('tracking') }} />
      </Sheet>

      <WaiterSheet open={waiterSheet} onClose={() => setWaiterSheet(false)} />
      <LanguageSheet open={langSheet} onClose={() => setLangSheet(false)} />
    </div>
  )
}

/* ───────────────── customer app (i18n provider) ───────────────── */
export function CustomerApp({ restaurantId, token }: { restaurantId: string; token: string }) {
  return (
    <I18nProvider restaurantId={restaurantId}>
      <CustomerShell token={token} />
    </I18nProvider>
  )
}
