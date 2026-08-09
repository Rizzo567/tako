// Service worker dell'app owner — scope /owner/.
// Modellato su apps/dashboard/public/sw.js, con la stessa regola non negoziabile:
// API, socket e qualunque richiesta non-GET NON passano MAI dalla cache. I dati del
// ristorante (ordini, conti, tavoli) sono live: servirne una copia stantia sarebbe
// peggio di non servirli affatto. La cache copre SOLO il guscio statico.
const CACHE = 'tako-owner-v3'
const SHELL = [
  '/owner/',
  '/owner/index.html',
  '/owner/app.js',
  '/owner/app.css',
  '/owner/manifest.webmanifest',
  '/owner/icons/icon-192.png',
  '/owner/icons/icon-512.png',
  // I due woff2 dell'identità Tako: scaricati una volta, poi mai più (nemmeno da remoto).
  '/owner/fonts/dm-sans.woff2',
  '/owner/fonts/nunito.woff2',
]

self.addEventListener('install', (e) => {
  // addAll è atomico: se un solo file manca fallisce tutto. Precachiamo uno per uno
  // best-effort così una risorsa assente non lascia l'app senza service worker.
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Bypass totale: dati dinamici e scritture vanno sempre in rete.
  if (
    e.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/uploads')
  ) return

  // Navigazione: network-first (HTML sempre fresco), fallback sulla copia in cache.
  // Se non c'è nessuna copia, una schermata offline esplicita — mai una pagina bianca.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(async () => {
        const cached = (await caches.match(e.request)) || (await caches.match('/owner/index.html'))
        if (cached) return cached
        return new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="5"><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#F2EBE2;color:#2A1F1A"><div style="text-align:center;padding:24px"><h2 style="margin:0 0 8px">Tako non raggiungibile</h2><p style="color:#6B5A50;margin:0">Appliance offline. Riprovo automaticamente…</p></div></body>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )
      }),
    )
    return
  }

  // Guscio statico dell'app owner: cache-first, con refresh in background.
  if (url.pathname.startsWith('/owner/')) {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        const net = fetch(e.request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {})
            }
            return res
          })
          .catch(() => hit)
        return hit || net
      }),
    )
  }
})

// ─────────────────────────────── NOTIFICHE PUSH (F3.3) ───────────────────────────────
// Il payload che arriva è quello scritto da apps/server/src/lib/push.ts:
//   { title, body, url, tag, kind }
// `url` è il deep-link: '/owner/#ordini', '/owner/#sala', '/owner/#altro'.

const FALLBACK = { title: 'Tako', body: 'Novità in sala.', url: '/owner/', tag: 'tako' }

self.addEventListener('push', (e) => {
  let d = FALLBACK
  try {
    // Un push senza payload esiste (alcuni push service lo consegnano vuoto dopo un
    // riavvio del telefono): mostrare comunque QUALCOSA è obbligatorio, non facoltativo.
    // Su Chrome/Android una push ricevuta senza `showNotification` costa alla PWA la
    // revoca del permesso dopo poche volte.
    d = e.data ? { ...FALLBACK, ...e.data.json() } : FALLBACK
  } catch {
    d = { ...FALLBACK, body: (e.data && e.data.text()) || FALLBACK.body }
  }

  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    // `tag` + `renotify`: cinque ordini in due minuti lasciano UNA riga in centro
    // notifiche (non cinque), ma il telefono vibra a ogni evento. Senza `renotify`
    // il secondo ordine sostituirebbe il primo in silenzio.
    tag: d.tag,
    renotify: true,
    icon: '/owner/icons/icon-192.png',
    badge: '/owner/icons/icon-192.png',
    data: { url: d.url },
    // Ignorato da iOS, rispettato da Android: due colpi brevi, non un trillo lungo.
    vibrate: [40, 30, 40],
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = (e.notification.data && e.notification.data.url) || '/owner/'

  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of open) {
      let path = ''
      try { path = new URL(c.url).pathname } catch { path = '' }
      if (!path.startsWith('/owner/')) continue
      // L'app è già aperta: NON ricaricarla. Un reload butterebbe via lo stato (la
      // sezione, il conto a metà, la lista già scorsa) proprio mentre il ristoratore
      // sta rispondendo a una chiamata. Si manda la rotta e si mette a fuoco.
      try { c.postMessage({ type: 'tako:navigate', url: target }) } catch { /* client morente */ }
      if ('focus' in c) return c.focus()
    }
    return self.clients.openWindow(target)
  })())
})
