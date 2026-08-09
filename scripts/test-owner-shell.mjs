#!/usr/bin/env node
// Verifier del guscio dell'app owner (piano F2.2).
//
// Due misure, entrambe fatte dal browser e MAI a occhio:
//
//  1. TTI su Fast 3G (1.6 Mbit/s, 562 ms di latenza — lo stesso preset di DevTools):
//     si misura quando l'app è davvero utilizzabile, cioè quando la barra inferiore
//     con le 5 sezioni è nel DOM e il main thread è tornato libero. Budget: 2 s.
//  2. Nessuno scroll orizzontale a 390 e 430 px logici. Si misura con
//     document.body.scrollWidth <= window.innerWidth: gli screenshot di Chrome
//     headless MENTONO sotto i 500 px (il viewport minimo reale è ~500 px e
//     l'immagine viene solo ritagliata), quindi l'occhio qui non è ammesso.
//
// Uso: node scripts/test-owner-shell.mjs [http://localhost:3001]
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const SERVER = process.argv[2] ?? 'http://localhost:3001'
const TTI_BUDGET_MS = 2000

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

// Sessione finta: l'app deve mostrare il GUSCIO (5 sezioni), non la schermata di
// collegamento. Il token non deve essere valido — le chiamate API possono anche
// fallire: qui si misura il guscio, non i dati.
const FAKE_SESSION = {
  token: 'x'.repeat(64),
  deviceId: '00000000-0000-0000-0000-000000000000',
  expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
  user: { id: 'u', name: 'Owner di prova', email: 'o@test.local', role: 'owner' },
  restaurant: { id: 'r', name: 'Trattoria di Prova', slug: 'prova' },
}

// Dati finti serviti al posto dell'API. Il probe deve misurare il GUSCIO, non lo stato
// del database della macchina che lo esegue: senza stub servirebbe un ristorante
// seminato, e il risultato dipenderebbe da quanti tavoli ha oggi.
// I contenuti sono deliberatamente LUNGHI (nomi di piatti chilometrici, numeri di
// tavolo strani): l'overflow orizzontale, se c'è, salta fuori qui e non in sala.
const LONG = 'Tagliatelle al ragù di cinghiale con scaglie di pecorino stagionato'
const STUBS = {
  '/api/system/info': { data: { version: '0.1.6', lanUrl: SERVER, remoteUrl: null } },
  '/api/tables/rooms': { data: [
    { id: 'r1', name: 'Sala interna con veranda affacciata sul giardino', position: 0, tables: [{ id: 't1' }] },
    { id: 'r2', name: 'Dehors', position: 1, tables: [{ id: 't9' }] },
  ] },
  '/api/tables': { data: [
    { id: 't1', number: '1', seats: 4, roomId: 'r1', status: 'occupied', posX: 20, posY: 20 },
    { id: 't2', number: '2', seats: 2, roomId: 'r1', status: 'free', posX: 70, posY: 30 },
    { id: 't9', number: 'Dehors-12', seats: 8, roomId: 'r2', status: 'waiting', posX: null, posY: null },
  ] },
  '/api/tables/waiter-calls': { data: [
    { id: 'c1', tableId: 't1', tableNumber: 'Dehors-12', type: 'bill', createdAt: new Date().toISOString() },
  ] },
  '/api/orders/active': {
    data: [{
      id: 'o1', restaurantId: 'r', tableId: 't1', tableNumber: 'Dehors-12', type: 'table',
      status: 'preparing', total: 128.5, createdAt: new Date().toISOString(),
      items: [{ id: 'i1', name: LONG, quantity: 2, unitPrice: 18 }],
    }],
    meta: { nextBefore: null },
  },
  '/api/bills/open': { data: [
    { id: 'b1', tableId: 't1', tableNumber: 'Dehors-12', covers: 8, subtotal: 128.5, discount: 0, tip: 0, total: 128.5, status: 'open', createdAt: new Date().toISOString() },
  ] },
  '/api/bills/summary/today': { data: { revenue: 1234.56, tips: 78.9, billsCount: 27, avgTicket: 45.72 } },
  '/api/stats/dashboard': { data: { revenue: 1, todayRevenue: 1, avgTicket: 1, totalCovers: 120, billsCount: 27, pendingOrdersCount: 3, dailyRevenue: [], topItems: [{ name: LONG, qty: 12, revenue: 216 }], sessions: {} } },
}

function stubFor(pathname) {
  if (STUBS[pathname]) return STUBS[pathname]
  if (pathname.startsWith('/api/orders/table/')) return { data: [] }
  if (pathname.startsWith('/api/bills/')) return { data: { id: 'b1', tableNumber: 'Dehors-12', covers: 8, subtotal: 128.5, discount: 0, tip: 0, total: 128.5, status: 'open', createdAt: new Date().toISOString(), payments: [] } }
  if (pathname.startsWith('/api/')) return { data: [] }
  return null
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] })

async function newPage(width, { stub = false } = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width, height: 860, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.evaluateOnNewDocument((session, origin) => {
    localStorage.setItem('tako.owner.session', JSON.stringify(session))
    // Endpoint già noti: nessun probe verso host inesistenti a rallentare l'avvio.
    localStorage.setItem('tako.owner.endpoints', JSON.stringify({ lan: origin, remote: null }))
  }, FAKE_SESSION, SERVER)

  if (stub) {
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const url = new URL(req.url())
      const body = url.pathname.startsWith('/api/') ? stubFor(url.pathname) : null
      if (body) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
      // Il socket non deve nemmeno provarci: qui si misura il layout, non il realtime.
      if (url.pathname.startsWith('/socket.io')) return req.abort()
      return req.continue()
    })
  }
  return page
}

// ─── 1. TTI su Fast 3G ────────────────────────────────────────────────────────
console.log('\n▶ TTI su Fast 3G (budget 2 s)')
{
  const page = await newPage(390)
  const client = await page.createCDPSession()
  await client.send('Network.enable')
  // Preset "Fast 3G" di Chrome DevTools.
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 562.5,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })

  const t0 = Date.now()
  // La navigazione NON si aspetta: il cronometro deve fermarsi quando l'app è
  // utilizzabile, non quando l'ultima risorsa (font, icone) ha finito di scaricare.
  const nav = page.goto(`${SERVER}/owner/`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  // "Utilizzabile" = le 5 sezioni della barra inferiore sono nel DOM.
  await page.waitForFunction(() => document.querySelectorAll('.ow-bb-tab').length === 5, { timeout: 30000 })
  const tti = Date.now() - t0
  await nav

  const tabs = await page.$$eval('.ow-bb-tab', (els) => els.map((e) => e.textContent.trim()))
  const dcl = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    return nav ? Math.round(nav.domContentLoadedEventEnd) : null
  })
  const transferred = await page.evaluate(() => Math.round(
    performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0) / 1024,
  ))

  check(`TTI ${tti} ms < ${TTI_BUDGET_MS} ms`, tti < TTI_BUDGET_MS, `DCL ${dcl} ms · ${transferred} KB sul filo`)
  check('cinque sezioni', tabs.length === 5, tabs.join(' · '))
  await page.close()
}

// ─── 2. Nessuno scroll orizzontale ────────────────────────────────────────────
console.log('\n▶ Zero scroll orizzontale (misurato in JS, non a occhio)')
for (const width of [390, 430]) {
  const page = await newPage(width, { stub: true })
  await page.goto(`${SERVER}/owner/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('.ow-bb-tab').length === 5, { timeout: 20000 })

  for (const section of ['sala', 'ordini', 'cassa', 'oggi', 'altro']) {
    await page.evaluate((s) => {
      const tabs = [...document.querySelectorAll('.ow-bb-tab')]
      const order = ['sala', 'ordini', 'cassa', 'oggi', 'altro']
      tabs[order.indexOf(s)].click()
    }, section)
    await new Promise((r) => setTimeout(r, 400))

    const m = await page.evaluate(() => {
      // innerWidth è la larghezza LOGICA reale del viewport emulato: è questa che
      // conta, non la dimensione dello screenshot.
      // Elementi che sfondano il viewport. Si escludono quelli dentro una striscia
      // che scorre di suo (la barra delle sale): lì sfondare è il comportamento
      // voluto, e il body non scorre comunque.
      const inScroller = (el) => !!el.closest('.ow-seg-scroll')
      const over = [...document.querySelectorAll('*')]
        .filter((el) => !inScroller(el) && el.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}.${el.className || '(nessuna classe)'}`)
      return {
        inner: window.innerWidth,
        bodyScroll: document.body.scrollWidth,
        docScroll: document.documentElement.scrollWidth,
        over,
      }
    })

    // Il body non deve scorrere in orizzontale E nessun elemento deve sfondare il
    // viewport: senza la seconda condizione un testo lungo verrebbe semplicemente
    // TAGLIATO da overflow-x: hidden, e il test direbbe "tutto ok" mentre sullo
    // schermo manca mezza parola.
    check(
      `${width}px · ${section}: scrollWidth ${m.bodyScroll} <= innerWidth ${m.inner}`,
      m.bodyScroll <= m.inner && m.docScroll <= m.inner && m.over.length === 0,
      m.over.length ? `sfora: ${m.over.join(', ')}` : '',
    )
  }
  await page.close()
}

// ─── 3. Il viewport emulato è quello richiesto (anti-trappola headless) ───────
console.log('\n▶ Controllo del viewport (Chrome headless ha un minimo ~500px)')
{
  const page = await newPage(390)
  await page.goto(`${SERVER}/owner/`, { waitUntil: 'domcontentloaded' })
  const inner = await page.evaluate(() => window.innerWidth)
  check(`window.innerWidth = ${inner} (atteso 390)`, inner === 390,
    inner !== 390 ? 'il viewport non è stato applicato: le misure sopra non valgono' : '')
  await page.close()
}

await browser.close()
console.log(failures === 0 ? '\n✓ guscio owner: tutti i controlli verdi\n' : `\n✗ ${failures} controlli falliti\n`)
process.exit(failures === 0 ? 0 : 1)
