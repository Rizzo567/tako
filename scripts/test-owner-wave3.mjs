#!/usr/bin/env node
// Verifier delle schermate di Wave 3 (piano §5 F5.1–F5.3).
//
// Stesso impianto di `test-owner-wave2.mjs` — sessione finta, API stubbata, registro
// delle chiamate mutanti, contatore dei tap `isTrusted`, viewport controllato — con
// una differenza: qui una delle rotte NON risponde in JSON ma in `text/event-stream`,
// e la proprietà più importante da dimostrare è una NEGAZIONE.
//
// La domanda che questo file esiste per rispondere è: «può una mutation partire senza
// che un dito l'abbia confermata?». Un test che guarda solo il risultato non lo può
// dire. Qui si registra OGNI chiamata non-GET all'API e si verifica che, dopo una
// risposta del copilot piena di proposte, il registro sia ancora vuoto — e che si
// riempia di UNA riga sola nell'istante del tap sulla conferma.
//
// Uso: node scripts/test-owner-wave3.mjs [http://localhost:3001]
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const SERVER = process.argv[2] ?? 'http://localhost:3001'

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean)
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('Chrome non trovato. Imposta CHROME_PATH.')
  process.exit(1)
}

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const FAKE_SESSION = {
  token: 'x'.repeat(64),
  deviceId: '00000000-0000-0000-0000-000000000000',
  expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
  user: { id: 'u', name: 'Owner di prova', email: 'o@test.local', role: 'owner' },
  restaurant: { id: 'r', name: 'Trattoria di Prova', slug: 'prova' },
}

// Nomi lunghi come in Wave 2: se un testo sfonda il viewport, deve saltare fuori qui.
const LONG_DISH = 'Branzino di lenza in crosta di sale di Cervia con finocchietto'

/** Un evento SSE ben formato. */
const sse = (obj) => `data: ${JSON.stringify(obj)}\n\n`

/**
 * Corpo SSE completo di un turno che PROPONE una mutation. In mezzo c'è anche
 * l'heartbeat `: ping` che il server manda ogni 15 s: se il parser del client non lo
 * scartasse, il JSON.parse morirebbe proprio durante una risposta lunga.
 */
const STREAM_WITH_PENDING =
  sse({ type: 'token', text: 'Va bene, ' }) +
  ': ping\n\n' +
  sse({ type: 'token', text: 'lo tolgo dal menu.' }) +
  sse({
    type: 'done',
    message: 'Va bene, lo tolgo dal menu.',
    actions: [],
    pending: [{ name: 'set_item_availability', args: { itemName: LONG_DISH, available: false }, label: `Segna esaurito: "${LONG_DISH}"` }],
  })

const TODAY = new Date().toISOString().slice(0, 10)
const at = (hhmm) => new Date(`${TODAY}T${hhmm}:00`).toISOString()

const STUBS = {
  '/api/system/info': { data: { version: '0.1.6', lanUrl: SERVER, remoteUrl: null } },
  '/api/tables/rooms': { data: [{ id: 'room1', name: 'Sala', active: true, position: 0 }] },
  '/api/tables': {
    data: [
      { id: 'tb1', number: 'T1', seats: 4, status: 'free', roomId: 'room1', posX: 20, posY: 20 },
      { id: 'tb2', number: 'T2', seats: 2, status: 'free', roomId: 'room1', posX: 60, posY: 20 },
    ],
  },
  '/api/tables/waiter-calls': { data: [] },
  '/api/orders/active': { data: [], meta: { nextBefore: null } },
  '/api/bills/open': { data: [] },
  '/api/bills/summary/today': { data: { revenue: 0, tips: 0, billsCount: 0, avgTicket: 0 } },
  '/api/inventory/stats': { data: { totalValue: 0, itemCount: 0, lowCount: 0, outCount: 0, perItem: [] } },
  '/api/inventory/reorder': { data: { suppliers: [], itemCount: 0, estTotalCost: 0 } },
  '/api/menus': { data: [] },
  '/api/ai/owner/execute': { data: { ok: true, summary: `"${LONG_DISH}" ora è esaurito.` } },
  '/api/ai/owner/chat': {
    data: {
      message: 'Rispondo senza streaming.',
      actions: [],
      pending: [{ name: 'set_item_availability', args: { itemName: LONG_DISH, available: false }, label: `Segna esaurito: "${LONG_DISH}"` }],
    },
  },
  '/api/reservations': {
    data: [
      { id: 'rs1', customerName: 'Famiglia Bianchi', customerPhone: '+39 333 1234567', partySize: 4, startsAt: at('20:00'), durationMin: 90, status: 'confirmed', tableId: 'tb1', tableNumber: 'T1', notes: 'Seggiolone' },
      { id: 'rs2', customerName: 'Rossi', customerPhone: '+39 333 7654321', partySize: 2, startsAt: at('21:30'), durationMin: 90, status: 'requested', tableId: null, tableNumber: null, notes: null },
    ],
  },
  '/api/staff': {
    data: [
      { id: 'u', name: 'Owner di prova', email: 'o@test.local', role: 'owner', active: true, phone: null },
      { id: 'u2', name: 'Giulia Cameriera', email: 'g@test.local', role: 'dipendente', active: true, phone: null },
      { id: 'u3', name: 'Marco Sospeso', email: 'm@test.local', role: 'cassiere', active: false, phone: null },
    ],
  },
  '/api/shifts/active': {
    data: [{ id: 'sh1', userId: 'u2', userName: 'Giulia Cameriera', userRole: 'dipendente', startsAt: at('18:00'), endsAt: null, role: 'Sala', notes: null }],
  },
}

function stubFor(pathname) {
  if (STUBS[pathname]) return STUBS[pathname]
  if (pathname.startsWith('/api/shifts/clock-')) return { data: { id: 'sh9', userId: 'u2', startsAt: new Date().toISOString(), endsAt: null } }
  if (/^\/api\/reservations\/[^/]+/.test(pathname)) return { data: { id: 'rs1', status: 'seated', tableId: 'tb1' } }
  if (/^\/api\/staff\/[^/]+$/.test(pathname)) return { data: { id: 'u2', name: 'Giulia Cameriera', role: 'dipendente', active: false } }
  if (pathname.startsWith('/api/')) return { data: [] }
  return null
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] })

/**
 * Pagina con sessione finta, API stubbata e registro delle chiamate mutanti.
 * `stream` decide cosa risponde `/ai/owner/chat/stream`: un corpo SSE, oppure uno
 * status di errore per esercitare il ripiego non-streaming.
 */
async function newPage({ width = 390, stream = STREAM_WITH_PENDING, streamStatus = 200 } = {}) {
  const page = await browser.newPage()
  const calls = []
  await page.setViewport({ width, height: 860, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.evaluateOnNewDocument((session, origin) => {
    localStorage.setItem('tako.owner.session', JSON.stringify(session))
    localStorage.setItem('tako.owner.endpoints', JSON.stringify({ lan: origin, remote: null }))
    // La conversazione del copilot è persistita: senza pulirla, il probe erediterebbe
    // la chat del giro precedente e la schermata non partirebbe mai vuota.
    localStorage.removeItem('tako.owner.copilot')
    window.__taps = 0
    document.addEventListener('click', (e) => { if (e.isTrusted) window.__taps++ }, true)
  }, FAKE_SESSION, SERVER)

  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.pathname.startsWith('/socket.io')) return req.abort()
    if (url.pathname === '/api/ai/owner/chat/stream') {
      calls.push({ method: req.method(), path: url.pathname, body: JSON.parse(req.postData() ?? 'null') })
      if (streamStatus !== 200) {
        return req.respond({ status: streamStatus, contentType: 'application/json', body: JSON.stringify({ error: { code: 'AI_ERROR', message: 'no' } }) })
      }
      return req.respond({ status: 200, contentType: 'text/event-stream', body: stream })
    }
    if (url.pathname.startsWith('/api/')) {
      if (req.method() !== 'GET') {
        let body = null
        try { body = JSON.parse(req.postData() ?? 'null') } catch { body = req.postData() ?? null }
        calls.push({ method: req.method(), path: url.pathname + url.search, body })
      }
      const stub = stubFor(url.pathname)
      if (stub) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(stub) })
    }
    return req.continue()
  })

  await page.goto(`${SERVER}/owner/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('.ow-bb-tab').length === 5, { timeout: 20000 })
  await page.evaluate(() => { window.__taps = 0 })
  return { page, calls, taps: () => page.evaluate(() => window.__taps) }
}

/** Un tap vero: `page.click` sposta il mouse e preme, non chiama l'handler a mano. */
async function tap(page, selector, { nth = 0 } = {}) {
  await page.waitForSelector(selector, { timeout: 8000 })
  const handles = await page.$$(selector)
  if (!handles[nth]) throw new Error(`selettore senza elemento #${nth}: ${selector}`)
  await handles[nth].click()
  await new Promise((r) => setTimeout(r, 220))
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Nessun elemento sfonda il viewport, e il body non scorre in orizzontale. */
async function overflow(page) {
  return page.evaluate(() => {
    const inScroller = (el) => !!el.closest('.ow-seg-scroll')
    const over = [...document.querySelectorAll('*')]
      .filter((el) => !inScroller(el) && el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className || '(nessuna classe)'}`)
    return { inner: window.innerWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth, over }
  })
}

/** Apre una sotto-schermata dell'hub partendo dalla barra inferiore. */
async function openSub(page, sub) {
  await tap(page, '.ow-bb-tab', { nth: 4 })
  await tap(page, `.ow-hub-tile[data-sub="${sub}"]`)
}

const mutations = (calls) => calls.filter((c) => c.method !== 'GET' && !c.path.endsWith('/chat/stream') && !c.path.endsWith('/ai/owner/chat'))

// ─── F5.1 — il copilot propone, il dito conferma ──────────────────────────────
console.log('\n▶ F5.1 — copilot: nessuna mutation senza tap esplicito')
{
  const { page, calls, taps } = await newPage()
  await openSub(page, 'copilot')
  check(`${await taps()} tap per arrivare all'assistente`, (await taps()) <= 2, 'Altro → Assistente')

  // Le domande pronte sono il percorso più corto: un tap manda il messaggio.
  await tap(page, '.ow-cop-sugg .ow-chip')
  await wait(600)

  const text = await page.$eval('.ow-cop-msg[data-role="assistant"] .ow-cop-text', (el) => el.textContent.trim()).catch(() => null)
  check('i token dello stream sono stati montati nella bolla', text === 'Va bene, lo tolgo dal menu.', `testo: "${text}"`)
  check("l'heartbeat ': ping' non ha rotto il parser", text === 'Va bene, lo tolgo dal menu.')

  const label = await page.$eval('.ow-cop-pending-label', (el) => el.textContent.trim()).catch(() => null)
  check('la card di conferma è comparsa con l\'etichetta umana', !!label && label.includes('Segna esaurito'), label ?? 'nessuna card')

  // IL controllo di F5.1: fin qui NON deve essere partita nessuna azione.
  check('nessuna mutation è partita da sola', mutations(calls).length === 0,
    mutations(calls).map((c) => `${c.method} ${c.path}`).join(' · ') || 'registro vuoto')

  // Ora il tap esplicito.
  await tap(page, '.ow-cop-confirm')
  await wait(500)
  const execs = calls.filter((c) => c.path === '/api/ai/owner/execute')
  check('il tap di conferma esegue, una volta sola', execs.length === 1, `${execs.length} chiamate`)
  check('e manda nome e argomenti della proposta, non altro',
    execs[0]?.body?.name === 'set_item_availability' && execs[0]?.body?.args?.available === false,
    execs[0] ? JSON.stringify(execs[0].body) : '')
  const out = await page.$eval('.ow-cop-pending-out', (el) => el.textContent.trim()).catch(() => null)
  check('la card mostra l\'esito e non si può ripremere', !!out && (await page.$('.ow-cop-confirm')) === null, out ?? '')
  await page.close()
}

console.log('\n▶ F5.1 — «Annulla» non esegue niente')
{
  const { page, calls } = await newPage()
  await openSub(page, 'copilot')
  await tap(page, '.ow-cop-sugg .ow-chip')
  await wait(600)
  await tap(page, '.ow-cop-cancel')
  await wait(400)
  check('nessuna chiamata a /execute dopo l\'annullamento', calls.every((c) => c.path !== '/api/ai/owner/execute'))
  check('la card è chiusa', (await page.$('.ow-cop-confirm')) === null)
  await page.close()
}

console.log('\n▶ F5.1 — SSE non disponibile: ripiego sul non-streaming (Exit del piano)')
{
  const { page, calls } = await newPage({ streamStatus: 500 })
  await openSub(page, 'copilot')
  await tap(page, '.ow-cop-sugg .ow-chip')
  await wait(900)

  const fell = calls.some((c) => c.path === '/api/ai/owner/chat')
  check('il client ripiega su POST /ai/owner/chat', fell, calls.map((c) => c.path).join(' · '))
  const text = await page.$eval('.ow-cop-msg[data-role="assistant"] .ow-cop-text', (el) => el.textContent.trim()).catch(() => null)
  check('la risposta arriva comunque', text === 'Rispondo senza streaming.', `testo: "${text}"`)
  check('e la card di conferma resta esplicita anche nel ripiego', (await page.$('.ow-cop-confirm')) !== null)
  check('nessuna mutation automatica nemmeno qui', mutations(calls).length === 0)
  await page.close()
}

// ─── Layout: hub allargato e schermate di Wave 3 a 390 e 430 px ───────────────
console.log('\n▶ Zero scroll orizzontale sulle schermate di Wave 3')
for (const width of [390, 430]) {
  const { page } = await newPage({ width })
  const inner = await page.evaluate(() => window.innerWidth)
  check(`${width}px · viewport applicato (innerWidth ${inner})`, inner === width, inner !== width ? 'le misure sotto non valgono' : '')

  await tap(page, '.ow-bb-tab', { nth: 4 })
  {
    const m = await overflow(page)
    check(`${width}px · hub Altro: ${m.body} <= ${m.inner}`, m.body <= m.inner && m.doc <= m.inner && m.over.length === 0,
      m.over.length ? `sfora: ${m.over.join(', ')}` : '')
    // Le tessere dell'hub restano tutte raggiungibili senza scorrere: è la proprietà
    // su cui poggiano i budget di tap di Wave 2, e Wave 3 ne aggiunge altre tre.
    const below = await page.$$eval('.ow-hub-tile', (els, h) => els.filter((e) => e.getBoundingClientRect().bottom > h).length, 860)
    check(`${width}px · tutte le tessere dell'hub sono sopra la piega`, below === 0, `${below} fuori schermo`)
  }

  for (const sub of ['copilot']) {
    await tap(page, `.ow-hub-tile[data-sub="${sub}"]`)
    await wait(200)
    const m = await overflow(page)
    check(`${width}px · ${sub}: ${m.body} <= ${m.inner}`, m.body <= m.inner && m.doc <= m.inner && m.over.length === 0,
      m.over.length ? `sfora: ${m.over.join(', ')}` : '')
    await tap(page, '.ow-back')
  }
  await page.close()
}

await browser.close()
console.log(failures === 0 ? '\n✓ Wave 3: tutti i controlli verdi\n' : `\n✗ ${failures} controlli falliti\n`)
process.exit(failures === 0 ? 0 : 1)
