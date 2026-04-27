'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useSessionStore } from '@/lib/store'
import { MenuView } from './MenuView'
import { CartView } from './CartView'
import { OrderTracking } from './OrderTracking'
import { AiChat } from './AiChat'

type View = 'menu' | 'cart' | 'tracking' | 'chat'

export function CustomerApp({ restaurantId, token }: { restaurantId: string; token: string }) {
  const { setSession, orderId } = useSessionStore()
  const [view, setView] = useState<View>('menu')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get(`/customer/table/${token}`)
      .then(r => {
        const { restaurant, table } = r.data.data
        setSession({
          restaurantId: restaurant.id,
          tableId: table.id,
          tableNumber: table.number,
          restaurantName: restaurant.name,
          primaryColor: restaurant.primaryColor,
          aiEnabled: restaurant.aiEnabled,
        })
        document.documentElement.style.setProperty('--brand', restaurant.primaryColor)
      })
      .catch(() => setError('Tavolo non trovato. Riprova a scansionare il QR.'))
      .finally(() => setLoading(false))
  }, [token, setSession])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-coral border-t-transparent animate-spin mx-auto mb-4" />
        <p className="font-display font-black text-ink/60">Carico menu...</p>
      </div>
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
      {view === 'menu' && <MenuView onGoCart={() => setView('cart')} onGoChat={() => setView('chat')} />}
      {view === 'cart' && <CartView onBack={() => setView('menu')} onOrderPlaced={(id) => { setView('tracking') }} />}
      {view === 'tracking' && <OrderTracking onBack={() => setView('menu')} />}
      {view === 'chat' && <AiChat onBack={() => setView('menu')} />}
    </div>
  )
}
