'use client'
import { useEffect } from 'react'

// Registra il service worker (solo in contesto sicuro: localhost o HTTPS).
// Su LAN http puro il browser non espone serviceWorker → no-op silenzioso.
export function PWARegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {})
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
  }, [])
  return null
}
