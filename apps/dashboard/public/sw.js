// Service worker minimale per installabilità PWA + cache shell statica.
// Le API/socket NON sono cacheate: vanno sempre in rete (dati live in locale).
const CACHE = 'tako-dash-v2'
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
  // Network-first per la navigazione (HTML sempre fresco). Fallback offline SOLO se
  // esiste una copia in cache: mai rispondere con `undefined` (= pagina bianca quando
  // il server è giù e la precache è vuota). Senza fallback valido, lascia che il
  // browser mostri il suo errore di rete — recuperabile con un reload, non un muro bianco.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(async () => {
        const cached = (await caches.match(e.request)) || (await caches.match('/staff/index.html')) || (await caches.match('/dashboard'))
        if (cached) return cached
        return new Response(
          '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="3"><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#FBF8F4;color:#2A1F1A"><div style="text-align:center"><h2>Tako non raggiungibile</h2><p>Server offline. Riprovo automaticamente…</p></div></body>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )
      }),
    )
    return
  }
  // Cache-first per asset statici (icone, immagini).
  if (url.pathname.startsWith('/icons') || url.pathname.startsWith('/takos')) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)))
  }
})
