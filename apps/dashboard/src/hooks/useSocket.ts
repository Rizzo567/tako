'use client'
import { useEffect } from 'react'
import { socket, connectSocket } from '@/lib/socket'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'

export function useSocket() {
  const restaurant = useAuthStore((s) => s.restaurant)

  useEffect(() => {
    if (!restaurant?.id) return
    connectSocket(restaurant.id)

    socket.on('waiter:called', (data) => {
      toast(`🔔 Tavolo ${data.tableNumber}: ${data.type === 'bill' ? 'Conto richiesto' : data.type === 'water' ? 'Acqua' : 'Aiuto'}`, { duration: 8000 })
    })

    socket.on('inventory:alert', (data) => {
      toast.error(`⚠️ Scorta bassa: ${data.name} (${data.quantity} rimasti)`, { duration: 10000 })
    })

    return () => {
      socket.off('waiter:called')
      socket.off('inventory:alert')
    }
  }, [restaurant?.id])

  return socket
}
