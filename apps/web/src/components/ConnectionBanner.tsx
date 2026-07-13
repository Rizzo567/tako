'use client'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { socket } from '@/lib/socket'
import { useI18n } from '@/lib/i18n'

// Banner discreto per la connessione LAN cliente ↔ Mac (socket.io). NON riguarda
// l'internet del Mac (evento `connectivity`): qui si tratta solo del link realtime
// verso il ristorante. Compare quando il socket cade, sparisce alla riconnessione.
export function ConnectionBanner() {
  const { t } = useI18n()
  const [lost, setLost] = useState(false)

  useEffect(() => {
    const onDisconnect = () => setLost(true)
    const onConnect = () => setLost(false)
    socket.on('disconnect', onDisconnect)
    socket.on('connect', onConnect)
    return () => {
      socket.off('disconnect', onDisconnect)
      socket.off('connect', onConnect)
    }
  }, [])

  return (
    <AnimatePresence>
      {lost && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
          style={{ top: 'calc(var(--safe-t) + 8px)' }}
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -24, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        >
          <div
            className="pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] font-bold text-white"
            style={{ background: 'rgba(42,31,26,.92)', boxShadow: '0 8px 24px rgba(42,31,26,.28)' }}
          >
            <motion.span
              className="h-2 w-2 rounded-full"
              style={{ background: '#F5B14C' }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
            {t('connLost')}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
