#!/usr/bin/env node
// Verifier di F3.3 — la parte del service worker che si può collaudare senza un telefono.
//
// Il collaudo vero (permesso, notifica ricevuta ad app chiusa, tap) resta a mano su
// iPhone e Android: la checklist è in scripts/test-push-e2e.md. Ma la LOGICA degli
// handler `push` e `notificationclick` è codice normale, e testarla a mano su un
// device è il modo più lento e meno affidabile di scoprire un refuso in un campo.
//
// Qui `sw.js` (l'artefatto BUILDATO, non il sorgente) viene eseguito in un contesto
// finto che simula ServiceWorkerGlobalScope, e si verificano le sei cose che decidono
// se una notifica è utile o dannosa:
//   1. payload valido        → showNotification con titolo, corpo, tag e data.url giusti
//   2. payload assente       → si mostra COMUNQUE qualcosa (Chrome revoca il permesso
//                              alle PWA che ricevono una push e non notificano nulla)
//   3. payload illeggibile   → nessuna eccezione, si degrada sul testo grezzo
//   4. tap con app aperta    → postMessage di rotta + focus, MAI un reload
//   5. tap con app chiusa    → openWindow sul deep-link
//   6. tap con una finestra ALTRUI aperta (es. /staff/) → openWindow, non focus
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const SW = join(root, 'apps', 'dashboard', 'public', 'owner', 'sw.js')

let failures = 0
function check(ok, label, extra = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failures++
}

/** Carica sw.js in un contesto finto e restituisce gli handler registrati + le spie. */
function loadServiceWorker(clients) {
  const listeners = {}
  const shown = []
  const opened = []
  const messaged = []
  const focused = []

  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn },
    skipWaiting: () => {},
    location: { origin: 'https://tako.example' },
    registration: {
      showNotification: (title, opts) => { shown.push({ title, ...opts }); return Promise.resolve() },
    },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve(clients.map((url, i) => ({
        url,
        focus: () => { focused.push(i); return Promise.resolve({ url }) },
        postMessage: (m) => { messaged.push({ i, m }) },
      }))),
      openWindow: (u) => { opened.push(u); return Promise.resolve(null) },
    },
  }

  const sandbox = {
    self,
    // Il resto del file usa queste: bastano stub inerti, non è la parte in prova.
    caches: { open: () => Promise.resolve({ add: () => Promise.resolve(), put: () => Promise.resolve() }), keys: () => Promise.resolve([]), match: () => Promise.resolve(undefined), delete: () => Promise.resolve(true) },
    fetch: () => Promise.reject(new Error('no network')),
    URL,
    Response: class { constructor(body, init) { this.body = body; Object.assign(this, init) } },
    console,
    Promise,
    setTimeout,
  }
  vm.createContext(sandbox)
  vm.runInContext(readFileSync(SW, 'utf8'), sandbox, { filename: 'sw.js' })
  return { listeners, shown, opened, messaged, focused }
}

/** Esegue un handler e attende la promise passata a waitUntil. */
async function fire(handler, event) {
  const pending = []
  await handler({ ...event, waitUntil: (p) => pending.push(p) })
  await Promise.all(pending)
}

console.log('\n▶ Handler `push` del service worker')
{
  const sw = loadServiceWorker([])
  check(typeof sw.listeners['push'] === 'function', 'il service worker registra un handler `push`')
  check(typeof sw.listeners['notificationclick'] === 'function', 'e un handler `notificationclick`')

  await fire(sw.listeners['push'], {
    data: { json: () => ({ title: 'Nuovo ordine', body: 'Tavolo 4 · € 32,00', url: '/owner/#ordini', tag: 'order', kind: 'order' }) },
  })
  const n = sw.shown[0] ?? {}
  check(n.title === 'Nuovo ordine', 'titolo dal payload', n.title)
  check(n.body === 'Tavolo 4 · € 32,00', 'corpo dal payload', n.body)
  check(n.tag === 'order' && n.renotify === true, 'tag + renotify: una riga sola, ma vibra ogni volta')
  check(n.data?.url === '/owner/#ordini', 'deep-link conservato in data.url', n.data?.url)
  check(typeof n.icon === 'string' && n.icon.startsWith('/owner/'), 'icona dentro lo scope /owner/', n.icon)
}

console.log('\n▶ Push senza payload e con payload illeggibile')
{
  const sw = loadServiceWorker([])
  await fire(sw.listeners['push'], { data: null })
  check(sw.shown.length === 1, 'push vuota → una notifica di ripiego (Chrome revoca il permesso a chi non notifica)')
  check(typeof sw.shown[0]?.title === 'string' && sw.shown[0].title.length > 0, 'la notifica di ripiego ha un titolo', sw.shown[0]?.title)

  const sw2 = loadServiceWorker([])
  await fire(sw2.listeners['push'], { data: { json: () => { throw new SyntaxError('non è JSON') }, text: () => 'testo grezzo' } })
  check(sw2.shown.length === 1, 'payload illeggibile → nessuna eccezione, una notifica comunque')
  check(sw2.shown[0]?.body === 'testo grezzo', 'si degrada sul testo grezzo', sw2.shown[0]?.body)
}

console.log('\n▶ Tap sulla notifica (`notificationclick`)')
{
  // App owner già aperta: rotta via postMessage + focus. Nessuna finestra nuova.
  const aperta = loadServiceWorker(['https://tako.example/owner/'])
  let closed = false
  await fire(aperta.listeners['notificationclick'], {
    notification: { close: () => { closed = true }, data: { url: '/owner/#sala' } },
  })
  check(closed, 'la notifica viene chiusa al tap')
  check(aperta.opened.length === 0, 'nessuna finestra nuova quando l’app è già aperta')
  check(aperta.messaged[0]?.m?.type === 'tako:navigate', 'la rotta arriva come messaggio', aperta.messaged[0]?.m?.type)
  check(aperta.messaged[0]?.m?.url === '/owner/#sala', 'con il deep-link giusto', aperta.messaged[0]?.m?.url)
  check(aperta.focused.length === 1, 'e la finestra esistente viene messa a fuoco')

  // Nessuna finestra: si apre il deep-link.
  const chiusa = loadServiceWorker([])
  await fire(chiusa.listeners['notificationclick'], {
    notification: { close: () => {}, data: { url: '/owner/#ordini' } },
  })
  check(chiusa.opened[0] === '/owner/#ordini', 'app chiusa → openWindow sul deep-link', chiusa.opened[0])

  // Una finestra della dashboard staff NON è l'app owner: aprirci dentro la sezione
  // ordini del telefono sarebbe sbagliato due volte (scope diverso, utente diverso).
  const altrui = loadServiceWorker(['https://tako.example/staff/index.html'])
  await fire(altrui.listeners['notificationclick'], {
    notification: { close: () => {}, data: { url: '/owner/#ordini' } },
  })
  check(altrui.messaged.length === 0 && altrui.opened[0] === '/owner/#ordini', 'una finestra /staff/ non viene dirottata')

  // Notifica senza data (payload di ripiego): si apre la home dell'app, non undefined.
  const senzaData = loadServiceWorker([])
  await fire(senzaData.listeners['notificationclick'], { notification: { close: () => {} } })
  check(senzaData.opened[0] === '/owner/', 'notifica senza data → /owner/', senzaData.opened[0])
}

console.log('')
if (failures) {
  console.error(`✗ service worker push: ${failures} controlli falliti`)
  process.exit(1)
}
console.log('✓ service worker push: tutti i controlli verdi')
