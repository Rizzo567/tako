'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useSessionStore } from '@/lib/store'
import { MenuView } from './MenuView'
import { CartView } from './CartView'
import { OrderTracking } from './OrderTracking'
import { AiChat } from './AiChat'

type View = 'menu' | 'tracking' | 'chat'

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
        document.documentElement.style.setProperty('--brand', restaurant.primaryColor)
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream gap-4">
      <div
        className="w-20 h-20 rounded-3xl bg-white border-2 border-ink/10 grid place-items-center"
        style={{ boxShadow: '4px 4px 0 rgba(42,31,26,0.1)' }}
      >
        {logoUrl
          ? <img src={logoUrl} alt="logo" className="w-14 h-14 object-contain rounded-2xl" />
          : <span className="font-display font-black text-3xl text-coral">T</span>
        }
      </div>
      <div>
        <div className="w-8 h-1 bg-coral rounded-full mx-auto animate-pulse" />
      </div>
      <p className="font-display font-black text-ink/40 text-sm">Carico menu...</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-6 text-center">
      <div>
        <p className="text-6xl mb-4">🐙</p>
        <h1 className="font-display font-black text-2xl mb-2">Oops!</h1>
        <p className="text-ink/60 font-semibold">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream pb-24">
      {/* Main views */}
      {view === 'menu' && (
        <MenuView onGoCart={() => setCartOpen(true)} onGoChat={() => setView('chat')} onWaiterCall={() => setWaiterSheet(true)} />
      )}
      {view === 'tracking' && <OrderTracking onBack={() => setView('menu')} onOrderAgain={() => setView('menu')} />}
      {view === 'chat' && <AiChat onBack={() => setView('menu')} />}

      {/* Cart bottom sheet overlay */}
      <div
        className={`fixed inset-0 z-40 flex items-end transition-opacity duration-300 ${cartOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ backgroundColor: cartOpen ? 'rgba(42,31,26,0.4)' : 'transparent' }}
        onClick={() => setCartOpen(false)}
      >
        <div
          className={`bg-cream rounded-t-3xl max-h-[88vh] overflow-y-auto w-full max-w-lg mx-auto transition-transform duration-300 ${cartOpen ? 'translate-y-0' : 'translate-y-full'}`}
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
          onClick={() => setWaiterSheet(false)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-display font-black text-xl mb-5 text-center">Chiama cameriere</h3>
            <div className="space-y-3">
              {[
                { type: 'help', emoji: '👋', label: 'Ho bisogno di aiuto' },
                { type: 'bill', emoji: '🧾', label: 'Vorrei il conto' },
                { type: 'water', emoji: '💧', label: 'Acqua, per favore' },
              ].map(({ type, emoji, label }) => (
                <button
                  key={type}
                  onClick={() => callWaiter(type as 'help' | 'bill' | 'water')}
                  className="w-full bg-cream border-2 border-ink/15 rounded-2xl p-4 flex items-center gap-4 font-display font-black text-lg active:scale-95 transition-transform"
                >
                  <span className="text-3xl">{emoji}</span>
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
