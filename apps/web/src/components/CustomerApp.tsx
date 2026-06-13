'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { HandHelping, ReceiptText, GlassWater } from 'lucide-react'
import { api } from '@/lib/api'
import { useSessionStore } from '@/lib/store'
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
  root.style.setProperty('--on-brand', L > 0.5 ? '#2A1F1A' : '#FFFFFF')
}

export function CustomerApp({ restaurantId, token }: { restaurantId: string; token: string }) {
  const { setSession, orderId, logoUrl } = useSessionStore()
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
        applyBrand(restaurant.primaryColor)
      })
      .catch(() => setError('Tavolo non trovato. Riprova a scansionare il QR.'))
      .finally(() => setLoading(false))
  }, [token, setSession])

  async function callWaiter(type: 'help' | 'bill' | 'water') {
    const { restaurantId, tableId, tableNumber } = useSessionStore.getState()
    await api.post('/customer/waiter-call', { restaurantId, tableId, tableNumber, type })
    setWaiterSheet(false)
    toast.success('Cameriere avvisato! 🔔')
  }

  if (loading) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[var(--surface-base)]">
      <div
        className="grid h-20 w-20 place-items-center bg-[var(--surface-raised)]"
        style={{ borderRadius: 'var(--r-card)', boxShadow: 'var(--elev-2)' }}
      >
        {logoUrl
          ? <img src={logoUrl} alt="logo" className="h-14 w-14 rounded-2xl object-contain" />
          : <span className="font-serif text-3xl" style={{ color: 'var(--brand)' }}>T</span>
        }
      </div>
      <div className="h-1 w-8 animate-pulse rounded-full" style={{ background: 'var(--brand)' }} />
      <p className="text-sm font-semibold text-[var(--text-tertiary)]">Carico il menu...</p>
    </div>
  )

  if (error) return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
      <div>
        <h1 className="mb-2 font-serif text-2xl text-[var(--text-primary)]">Qualcosa non va</h1>
        <p className="font-semibold text-[var(--text-secondary)]">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-[var(--surface-base)] pb-24">
      {/* Main views */}
      {view === 'menu' && (
        <MenuView onGoCart={() => setCartOpen(true)} onGoChat={() => setView('chat')} onWaiterCall={() => setWaiterSheet(true)} />
      )}
      {view === 'tracking' && <OrderTracking onBack={() => setView('menu')} onOrderAgain={() => setView('menu')} />}
      {view === 'chat' && <AiChat onBack={() => setView('menu')} onOrderPlaced={() => setView('tracking')} />}

      {/* Cart bottom sheet overlay */}
      <div
        className={`fixed inset-0 z-40 flex items-end transition-opacity duration-300 ${cartOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ backgroundColor: cartOpen ? 'rgba(42,31,26,0.4)' : 'transparent' }}
        onClick={() => setCartOpen(false)}
      >
        <div
          className={`max-h-[88vh] w-full max-w-lg mx-auto overflow-y-auto bg-[var(--surface-base)] transition-transform duration-300 ${cartOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ borderTopLeftRadius: 'var(--r-sheet)', borderTopRightRadius: 'var(--r-sheet)', boxShadow: 'var(--elev-3)' }}
          onClick={e => e.stopPropagation()}
        >
          <CartView
            onBack={() => setCartOpen(false)}
            onOrderPlaced={(_id) => {
              setCartOpen(false)
              setView('tracking')
            }}
          />
        </div>
      </div>

      {/* Waiter call bottom sheet */}
      {waiterSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(42,31,26,0.55)' }}
          onClick={() => setWaiterSheet(false)}
        >
          <div
            className="w-full max-w-lg mx-auto bg-[var(--surface-raised)] p-6 pb-10 safe-bottom"
            style={{ borderTopLeftRadius: 'var(--r-sheet)', borderTopRightRadius: 'var(--r-sheet)', boxShadow: 'var(--elev-3)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ background: 'var(--border-default)' }} />
            <h3 className="mb-5 text-center font-serif text-xl text-[var(--text-primary)]">Chiama il cameriere</h3>
            <div className="space-y-3">
              {[
                { type: 'help', Icon: HandHelping, label: 'Ho bisogno di aiuto' },
                { type: 'bill', Icon: ReceiptText, label: 'Vorrei il conto' },
                { type: 'water', Icon: GlassWater, label: 'Acqua, per favore' },
              ].map(({ type, Icon, label }) => (
                <button
                  key={type}
                  onClick={() => callWaiter(type as 'help' | 'bill' | 'water')}
                  className="flex w-full items-center gap-4 bg-[var(--surface-sunken)] p-4 text-lg font-semibold text-[var(--text-primary)] transition-transform active:scale-[0.98]"
                  style={{ borderRadius: 'var(--r-card)' }}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--on-brand)]" style={{ background: 'var(--brand)' }}>
                    <Icon size={20} strokeWidth={2.2} />
                  </span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
