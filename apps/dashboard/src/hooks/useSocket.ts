'use client'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socket, connectSocket } from '@/lib/socket'
import { useAuthStore } from '@/lib/store'
import { toast } from '@/components/ui'
import { pushLiveNotif } from '@/lib/ui-bus'

// Hub real-time globale. Montato una volta nel layout del dashboard: tiene il
// socket connesso (con re-join automatico) e traduce OGNI evento del server in
// invalidazione dei React Query key giusti, così tutte le pagine (Ordini, KDS,
// Sala, Cassa, Menu, Inventario, Home) si aggiornano dal vivo senza refresh
// manuale — anche quelle che non hanno un proprio listener socket.
export function useSocket() {
  const restaurant = useAuthStore((s) => s.restaurant)
  const qc = useQueryClient()

  useEffect(() => {
    if (!restaurant?.id) return
    connectSocket(restaurant.id)

    const invalidate = (...keys: string[]) =>
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))

    // Ordini/conti/sala/home dipendono dallo stato degli ordini.
    const ordersTouched = () =>
      invalidate('active-orders-list', 'active-orders', 'open-bills', 'today-summary', 'rooms', 'stats', 'bills-today')

    // IMPORTANTE: l'hub usa onAny invece di on('evento'). Le singole pagine
    // (ordini/kds/sala) puliscono i propri listener con socket.off('evento') SENZA
    // handler, che rimuoverebbe TUTTI i listener di quell'evento — inclusi quelli
    // dell'hub sul socket condiviso, lasciando il dashboard "sordo" dopo una
    // navigazione. onAny non viene toccato da off('evento'): l'hub resta sempre vivo.
    const onAny = (event: string, payload: any) => {
      switch (event) {
        case 'order:new': {
          ordersTouched()
          const n = (payload?.items ?? []).reduce((s: number, i: any) => s + (i.quantity ?? 0), 0)
          pushLiveNotif({ title: `Nuovo ordine · Tavolo ${payload?.tableNumber ?? '?'}`, sub: `${n} piatti`, icon: 'orders', tone: 'brand' })
          break
        }
        case 'order:updated':
          ordersTouched(); break
        case 'table:updated':
          invalidate('rooms', 'tables-list', 'open-bills', 'stats'); break
        case 'menu:updated':
        case 'menu:item_availability':
          invalidate('menu-full', 'menus'); break
        case 'inventory:alert':
          invalidate('inventory', 'inventory-alerts')
          pushLiveNotif({ title: `Scorta bassa · ${payload?.name}`, sub: `${payload?.quantity} rimasti`, icon: 'alert', tone: 'wait' })
          toast(`Scorta bassa: ${payload?.name}`, { type: 'warn', icon: 'alert', sub: `${payload?.quantity} rimasti` })
          break
        case 'waiter:called': {
          const label = payload?.type === 'bill' ? 'Conto richiesto' : payload?.type === 'water' ? 'Acqua' : 'Aiuto'
          pushLiveNotif({ title: `Tavolo ${payload?.tableNumber} chiama`, sub: label, icon: 'bell', tone: 'info' })
          toast(`Tavolo ${payload?.tableNumber}: ${label}`, { type: 'info', icon: 'bell' })
          break
        }
      }
    }
    socket.onAny(onAny)
    return () => { socket.offAny(onAny) }
  }, [restaurant?.id, qc])

  return socket
}
