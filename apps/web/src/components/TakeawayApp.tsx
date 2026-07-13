'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Utensils, Clock, Sparkles, PackageCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { useSessionStore, useCartStore } from '@/lib/store'
import { SPRING, EASE_OUT } from '@/lib/motion'
import { MenuView } from './MenuView'
import { CartView } from './CartView'
import { OrderTracking } from './OrderTracking'
import { AiChat } from './AiChat'
import { ConnectionBanner } from './ConnectionBanner'
import { Sheet } from './ui/Sheet'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { useOrderReadyNotifier } from '@/lib/useOrderReadyNotifier'

// ─────────────────── PWA ASPORTO / ORDINE-AHEAD (senza tavolo) ───────────────────
// Flusso separato dal tavolo: apre una sessione 'takeaway' (cookie tako_table scoped
// al solo ristorante) e riusa MenuView/CartView/OrderTracking/AiChat. Lato server gli
// ordini nascono con type='takeaway' e tableId null (derivato dal kind della sessione,
// non dal client). NON tocca MenuView.

type View = 'menu' | 'tracking' | 'chat'

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

function Header({ count, onCart, showCart = true }: { count: number; onCart: () => void; showCart?: boolean }) {
  const { restaurantName, logoUrl } = useSessionStore()
  const { t } = useI18n()
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-3.5"
      style={{ paddingTop: 'calc(var(--safe-t) + 12px)', paddingBottom: 11, background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl || '/mascotte/tako-chef.png'} alt="" className="h-[38px] w-[38px] flex-none object-contain" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-bold leading-tight text-[var(--ink)]">{restaurantName}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-2)]"><PackageCheck size={13} /> {t('takeawayLabel')}</p>
      </div>
      {showCart && (
        <button onClick={onCart} aria-label={t('hdrCart')} data-cart-anchor
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
      )}
    </header>
  )
}

function BottomNav({ view, setView, aiEnabled, orderActive }: { view: View; setView: (v: View) => void; aiEnabled: boolean; orderActive: boolean }) {
  const { t } = useI18n()
  const items = [
    { id: 'menu' as View, Icon: Utensils, label: t('navMenu'), dot: false },
    { id: 'tracking' as View, Icon: Clock, label: t('navOrder'), dot: orderActive },
    ...(aiEnabled ? [{ id: 'chat' as View, Icon: Sparkles, label: t('navAssistant'), dot: false }] : []),
  ]
  const n = items.length
  const idx = Math.max(0, items.findIndex(i => i.id === view))
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg"
      style={{ background: 'var(--raised)', borderTop: '1px solid var(--hairline)', padding: '8px 8px calc(var(--safe-b) + 8px)' }}>
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
              {it.dot && (<span className="absolute -right-[3px] -top-0.5 h-2 w-2 rounded-full" style={{ background: 'var(--ok)', boxShadow: '0 0 0 2px var(--raised)' }} />)}
            </motion.span>
            <span className="text-[11px]" style={{ fontWeight: on ? 700 : 600 }}>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function TakeawayShell({ restaurantId }: { restaurantId: string }) {
  const { t } = useI18n()
  const { setSession, orderId, logoUrl } = useSessionStore()
  const count = useCartStore(s => s.items.reduce((n, i) => n + i.quantity, 0))
  const [view, setView] = useState<View>('menu')
  const [cartOpen, setCartOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  // Chiave d'errore (localizzata al render): il cambio lingua non ri-scatena la sessione.
  const [errorKey, setErrorKey] = useState<'takeawayClosed' | 'takeawayNotFound' | null>(null)
  // Notifica "ordine pronto" a livello di shell (asporto): arriva anche su menu/chat.
  useOrderReadyNotifier()

  useEffect(() => {
    api.post(`/customer/takeaway/${restaurantId}/session`, {})
      .then(r => {
        const { restaurant } = r.data.data
        setSession({
          restaurantId: restaurant.id,
          tableId: null,
          tableNumber: null,
          restaurantName: restaurant.name,
          primaryColor: restaurant.primaryColor,
          aiEnabled: restaurant.aiEnabled,
          logoUrl: restaurant.logoUrl,
          sessionId: null,
        })
        // Scope carrello dedicato all'asporto (separato dal carrello al tavolo).
        useCartStore.getState().ensureScope(`${restaurant.id}:takeaway`)
        applyBrand(restaurant.primaryColor)
      })
      .catch((e) => setErrorKey(e?.response?.status === 403 ? 'takeawayClosed' : 'takeawayNotFound'))
      .finally(() => setLoading(false))
  }, [restaurantId, setSession])

  const aiEnabled = useSessionStore(s => s.aiEnabled)
  const orderingEnabled = useSessionStore(s => s.orderingEnabled)

  if (loading) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4" style={{ background: 'var(--surface)' }}>
      <div className="grid h-20 w-20 place-items-center" style={{ borderRadius: 'var(--r-card)', background: 'var(--raised)', boxShadow: 'var(--sh-2)' }}>
        <img src={logoUrl || '/mascotte/tako-chef.png'} alt="" className="h-14 w-14 object-contain" />
      </div>
      <div className="h-1 w-8 animate-pulse rounded-full" style={{ background: 'var(--brand)' }} />
      <p className="text-sm font-semibold text-[var(--ink-3)]">{t('takeawayLoading')}</p>
    </div>
  )

  if (errorKey) return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
      <div>
        <h1 className="mb-2 font-serif text-2xl text-[var(--ink)]">{t('takeawayErrTitle')}</h1>
        <p className="font-semibold text-[var(--ink-2)]">{t(errorKey)}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-[100dvh]" style={{ background: 'var(--surface)' }}>
      <ConnectionBanner />
      <Header count={count} onCart={() => setCartOpen(true)} showCart={orderingEnabled} />
      <main style={{ paddingBottom: 'calc(var(--safe-b) + 72px)' }}>
        <AnimatePresence mode="wait">
          <motion.div key={view}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.34, ease: EASE_OUT }}>
            {view === 'menu' && <MenuView onGoCart={() => setCartOpen(true)} />}
            {view === 'tracking' && <OrderTracking onBack={() => setView('menu')} onOrderAgain={() => setView('menu')} />}
            {view === 'chat' && <AiChat onOrderPlaced={() => setView('tracking')} onViewCart={() => setCartOpen(true)} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav view={view} setView={setView} aiEnabled={aiEnabled} orderActive={!!orderId} />

      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title={t('yourOrder')} leadIcon={<span className="text-[18px]">🛍️</span>} maxH="90%">
        <CartView
          onBack={() => setCartOpen(false)}
          onOrderPlaced={() => { setCartOpen(false); setView('tracking') }}
        />
      </Sheet>
    </div>
  )
}

export function TakeawayApp({ restaurantId }: { restaurantId: string }) {
  return (
    <I18nProvider restaurantId={restaurantId}>
      <TakeawayShell restaurantId={restaurantId} />
    </I18nProvider>
  )
}
