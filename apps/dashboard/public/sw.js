// Service worker minimale per installabilità PWA + cache shell statica.
// Le API/socket NON sono cacheate: vanno sempre in rete (dati live in locale).
const CACHE = 'tako-dash-v1'
const PRECACHE = ['/dashboard', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // Mai cacheare API, socket, dati dinamici: sempre rete.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io') || e.request.method !== 'GET') return
  // Network-first per la navigazione (HTML sempre fresco), fallback cache offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/dashboard')))
    return
  }
  // Cache-first per asset statici (icone, immagini).
  if (url.pathname.startsWith('/icons') || url.pathname.startsWith('/takos')) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)))
  }
})
