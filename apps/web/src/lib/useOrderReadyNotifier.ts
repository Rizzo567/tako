'use client'
import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { socket, joinTable, joinOrder } from '@/lib/socket'
import { useSessionStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'

// Notifica "ordine pronto" a livello di SHELL: vive finché c'è un orderId attivo, anche
// mentre il cliente sfoglia il menu o la chat (OrderTracking è smontato su altri tab, quindi
// da solo non riceveva mai l'evento). Centralizzata qui per non duplicare toast/Notification:
// OrderTracking rende solo lo stato, la notifica la fa questo hook. Il ref (per orderId) evita
// doppie notifiche sullo stesso ordine.
export function useOrderReadyNotifier(): void {
  const { orderId, tableId } = useSessionStore()
  const { t } = useI18n()
  const notifiedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!orderId) return
    if (tableId) joinTable(tableId)
    else joinOrder(orderId)
    const onUpdated = ({ orderId: oid, status }: { orderId: string; status: string }) => {
      if (oid !== orderId) return
      if ((status === 'ready' || status === 'pronto') && notifiedFor.current !== orderId) {
        notifiedFor.current = orderId
        toast.success(t('toastOrderReady'))
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(t('notifReadyTitle'), { body: t('notifReadyBody') })
        }
      }
    }
    socket.on('order:updated', onUpdated)
    return () => { socket.off('order:updated', onUpdated) }
  }, [orderId, tableId, t])
}
