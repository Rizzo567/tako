#!/usr/bin/env node
// Verifier delle schermate di Wave 2 (piano §5 F4.1–F4.4).
//
// Misura la sola cosa che i goal di F4 esprimono in numeri: QUANTI TAP servono.
// Il conto non è stimato leggendo il codice — si contano i click veri sparati dal
// browser, con un listener in fase di cattura su `document`, e in parallelo si
// registra la chiamata HTTP che quel gesto ha prodotto. Un flusso che "sembra" da
// tre tap ma ne chiede quattro qui si vede subito.
//
// Tre regole ereditate dai verifier precedenti:
//   • l'API è STUBBATA (test-owner-shell.mjs, lezione 7 del diario F2): senza stub
//     il probe misurerebbe il database della macchina che lo esegue;
//   • il viewport è 390 px logici e va CONTROLLATO (Chrome headless mente sotto i
//     500 px: l'immagine viene ritagliata, `innerWidth` no);
//   • lo scroll orizzontale si misura in JS, mai a occhio, e non basta
//     `scrollWidth`: serve anche che nessun elemento sfondi il viewport.
//
// Uso: node scripts/test-owner-wave2.mjs [http://localhost:3001]
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

// Nomi deliberatamente lunghi: l'overflow, se c'è, salta fuori qui e non in sala.
const LONG_ITEM = 'Branzino di lenza in crosta di sale di Cervia con finocchietto'
const LONG_ING = 'Pomodorini datterini gialli di Pachino IGP in cassetta da 5 kg'

const STUBS = {
  '/api/system/info': { data: { version: '0.1.6', lanUrl: SERVER, remoteUrl: null } },
  '/api/tables/rooms': { data: [] },
  '/api/tables': { data: [] },
  '/api/tables/waiter-calls': { data: [] },
  '/api/orders/active': { data: [], meta: { nextBefore: null } },
  '/api/bills/open': { data: [] },
  '/api/bills/summary/today': { data: { revenue: 0, tips: 0, billsCount: 0, avgTicket: 0 } },
  '/api/inventory/stats': {
    data: {
      totalValue: 4210.75, itemCount: 2, lowCount: 1, outCount: 1,
      perItem: [
        { id: 'inv1', name: LONG_ING, unit: 'kg', quantity: 1.5, minQuantity: 4, value: 6, used30: 30, perDay: 1, daysLeft: 1.5 },
        { id: 'inv2', name: 'Olio EVO', unit: 'l', quantity: 0, minQuantity: 2, value: 0, used30: 12, perDay: 0.4, daysLeft: null },
      ],
    },
  },
  '/api/inventory/reorder': {
    data: {
      suppliers: [{ supplier: 'Ortofrutta della Valle Superiore', items: [
        { id: 'inv1', name: LONG_ING, unit: 'kg', quantity: 1.5, suggested: 6.5, estCost: 19.5 },
      ] }],
      itemCount: 1, estTotalCost: 19.5,
    },
  },
  '/api/menus': { data: [{ id: 'm1', name: 'Menu alla carta', type: 'main', active: true, position: 0 }] },
  // Stessa forma di GET /api/menus/:menuId (routes/menu.ts): il menu con dentro le
  // sezioni, e ogni sezione con dentro le sue voci.
  '/api/menus/m1': {
    data: {
      id: 'm1', name: 'Menu alla carta', type: 'main', active: true, position: 0,
      sections: [{
        id: 's1', name: 'Secondi di mare', position: 0, active: true,
        items: [
          { id: 'mi1', sectionId: 's1', name: LONG_ITEM, price: 24, available: true, imageUrl: null, position: 0, variants: [], translations: [] },
          { id: 'mi2', sectionId: 's1', name: 'Fritto misto dell\'Adriatico', price: 18, available: false, imageUrl: null, position: 1, variants: [], translations: [] },
        ],
      }],
    },
  },
  '/api/stats/dashboard': {
    data: {
      revenue: 8421.5, todayRevenue: 512, avgTicket: 46.3, totalCovers: 320, billsCount: 182,
      pendingOrdersCount: 0, dailyRevenue: [{ date: '2026-08-03', amount: 900 }, { date: '2026-08-04', amount: 1200 }],
      topItems: [{ name: LONG_ITEM, qty: 42, revenue: 1008 }],
      sessions: { totalScans: 0, conversionRate: 0, avgTimeToFirstOrderSec: null, scansPerHour: [] },
    },
  },
  '/api/insights/menu': {
    data: {
      items: [
        { menuItemId: 'mi1', name: LONG_ITEM, totalQty: 42, totalRevenue: 1008, avgPrice: 24, revenueShare: 12, velocityPerDay: 1.4, costPrice: 8, marginPercent: 66, isFeatured: false, quadrant: 'star' },
        { menuItemId: 'mi2', name: 'Fritto misto', totalQty: 4, totalRevenue: 72, avgPrice: 18, revenueShare: 1, velocityPerDay: 0.1, costPrice: 12, marginPercent: 33, isFeatured: false, quadrant: 'dog' },
      ],
      periodDays: 30, totalRevenue: 1080, medianQty: 23, medianMargin: 49,
    },
  },
}

function stubFor(pathname) {
  if (STUBS[pathname]) return STUBS[pathname]
  if (pathname.startsWith('/api/inventory/') && pathname.endsWith('/movements')) {
    return { data: { id: 'mv1', type: 'load', quantity: 1 } }
  }
  if (pathname.endsWith('/photo')) return { data: { id: 'mi1', imageUrl: '/uploads/r/x.jpg', styled: false } }
  if (pathname.startsWith('/api/menus/items/')) return { data: { id: 'mi1', available: false, price: 24, imageUrl: null } }
  if (pathname.startsWith('/api/')) return { data: [] }
  return null
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] })

/** Pagina con sessione finta, API stubbata e registro delle chiamate mutanti. */
async function newPage(width = 390) {
  const page = await browser.newPage()
  const calls = []
  await page.setViewport({ width, height: 860, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.evaluateOnNewDocument((session, origin) => {
    localStorage.setItem('tako.owner.session', JSON.stringify(session))
    localStorage.setItem('tako.owner.endpoints', JSON.stringify({ lan: origin, remote: null }))
    // Contatore di tap: fase di CATTURA sul document, così conta anche i click che
    // un handler più interno fermerebbe. È il numero che i goal di F4 vincolano.
    //
    // Solo eventi FIDATI (`isTrusted`): quelli che nascono da un dito o dal mouse
    // vero — che è ciò che puppeteer sintetizza via CDP. I click generati dal
    // codice (`input.click()` per aprire la fotocamera, per esempio) sono lavoro
    // dell'app, non gesti dell'utente: contarli farebbe sembrare da 4 tap un
    // flusso che il pollice risolve in 3.
    window.__taps = 0
    document.addEventListener('click', (e) => { if (e.isTrusted) window.__taps++ }, true)
  }, FAKE_SESSION, SERVER)

  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.pathname.startsWith('/socket.io')) return req.abort()
    // L'export non è JSON: si risponde CSV vero, così il client esercita il ramo
    // blob/Web Share invece di inciampare su un corpo che non sa leggere.
    if (url.pathname === '/api/stats/export') {
      return req.respond({
        status: 200,
        contentType: 'text/csv; charset=utf-8',
        body: 'Tako — export incassi\r\nTotale;1;2;10,00\r\n',
      })
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

// ─── F4.1 — un movimento di magazzino in ≤ 4 tap ──────────────────────────────
console.log('\n▶ F4.1 — movimento di magazzino (budget: 4 tap)')
{
  const { page, calls, taps } = await newPage()
  await tap(page, '.ow-bb-tab', { nth: 4 })            // 1. Altro
  await tap(page, '.ow-hub-tile[data-sub="magazzino"]') // 2. Magazzino
  await tap(page, '.ow-inv-row')                        // 3. la riga dell'articolo
  await tap(page, '.ow-move-foot .ow-btn')              // 4. Carico
  await new Promise((r) => setTimeout(r, 300))

  const n = await taps()
  const move = calls.find((c) => /\/api\/inventory\/[^/]+\/movements$/.test(c.path))
  check(`${n} tap ≤ 4`, n <= 4, `sequenza: Altro → Magazzino → riga → Carico`)
  check('il quarto tap REGISTRA il movimento', !!move, move ? `${move.method} ${move.path} ${JSON.stringify(move.body)}` : 'nessuna POST osservata')
  check('tipo e quantità corretti', move?.body?.type === 'load' && move?.body?.quantity > 0,
    move ? `type=${move.body?.type} quantity=${move.body?.quantity}` : '')
  check('il foglio si chiude dopo il movimento', (await page.$('.ow-sheet')) === null)
  await page.close()
}

// ─── F4.2 — «finito il branzino» in ≤ 3 tap ───────────────────────────────────
console.log('\n▶ F4.2 — segnare un piatto finito (budget: 3 tap)')
{
  const { page, calls, taps } = await newPage()
  await tap(page, '.ow-bb-tab', { nth: 4 })      // 1. Altro
  await tap(page, '.ow-hub-tile[data-sub="menu"]') // 2. Menu
  await tap(page, '.ow-avail[data-on="1"]')        // 3. la pastiglia della voce a menu
  await new Promise((r) => setTimeout(r, 300))

  const n = await taps()
  const patch = calls.find((c) => /\/api\/menus\/items\/[^/]+\/availability$/.test(c.path))
  check(`${n} tap ≤ 3`, n <= 3, 'sequenza: Altro → Menu → «A menu»')
  check('il terzo tap SCRIVE la disponibilità', !!patch,
    patch ? `${patch.method} ${patch.path} ${JSON.stringify(patch.body)}` : 'nessuna PATCH osservata')
  check('manda available:false (non un toggle cieco lato server)', patch?.body?.available === false)
  const label = await page.$eval('.ow-avail', (el) => el.textContent.trim())
  check('la riga dice subito «Finito»', label === 'Finito', `pastiglia: "${label}"`)
  check('nessun foglio si è aperto', (await page.$('.ow-sheet')) === null)
  await page.close()
}

// ─── F4.3 — la foto: fotocamera in ≤ 3 tap, e il ridimensionamento a 1600 px ──
console.log('\n▶ F4.3 — foto del piatto (budget: 3 tap per aprire la fotocamera)')
{
  const { page, calls, taps } = await newPage()
  await tap(page, '.ow-bb-tab', { nth: 4 })        // 1. Altro
  await tap(page, '.ow-hub-tile[data-sub="menu"]') // 2. Menu

  // Il terzo tap deve aprire il SELETTORE DI FILE (sul telefono: la fotocamera).
  // `waitForFileChooser` è l'unico modo di osservarlo: in headless il dialogo di
  // sistema non esiste, ma l'evento CDP che lo aprirebbe sì.
  const [chooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 8000 }),
    tap(page, '.ow-thumb'),                        // 3. la miniatura/fotocamera
  ])
  const n = await taps()
  check(`${n} tap ≤ 3 per aprire la fotocamera`, n <= 3, 'sequenza: Altro → Menu → miniatura')
  check('il selettore accetta un solo file', !chooser.isMultiple())
  await chooser.cancel()

  // Ora la foto vera. Un JPEG 3000×2000 (quello che esce da un telefono) viene
  // consegnato all'input come farebbe la fotocamera: se `resizeForUpload` non
  // lavorasse, il lato lungo resterebbe 3000 e sul filo passerebbero megabyte.
  const shot = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 3000; c.height = 2000
    const ctx = c.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 3000, 2000)
    grad.addColorStop(0, '#ED7159'); grad.addColorStop(1, '#2A1F1A')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 3000, 2000)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92))
    const file = new File([blob], 'piatto.jpg', { type: 'image/jpeg' })
    const dt = new DataTransfer()
    dt.items.add(file)
    const input = document.querySelector('input[type="file"]')
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return blob.size
  })
  await new Promise((r) => setTimeout(r, 1200))

  const post = calls.find((c) => /\/api\/menus\/items\/[^/]+\/photo$/.test(c.path))
  check('la foto parte verso la rotta nuova', !!post, post ? `${post.method} ${post.path}` : 'nessuna POST osservata')
  const msg = await page.$eval('.ow-warn-ok', (el) => el.textContent.trim()).catch(() => null)
  check('la foto è stata ridotta a 1600 px di lato lungo', !!msg && /1600×1067/.test(msg),
    msg ? `messaggio: "${msg}" · originale ${Math.round(shot / 1024)} KB a 3000×2000` : 'nessun esito mostrato')
  await page.close()
}

// ─── F4.4 — Andamento: quadranti, periodo, export condivisibile ───────────────
console.log('\n▶ F4.4 — andamento ed export')
{
  const { page, taps } = await newPage()
  await tap(page, '.ow-bb-tab', { nth: 4 })
  await tap(page, '.ow-hub-tile[data-sub="andamento"]')
  check(`${await taps()} tap per arrivare all'andamento`, (await taps()) <= 2)

  // Il periodo va nella query, non ricalcolato dal client su dati di 7 giorni.
  const req7 = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => new URL(r.name).pathname + new URL(r.name).search).filter((p) => p.startsWith('/api/stats/dashboard')))
  check('la dashboard è chiesta CON un intervallo', req7.some((p) => /from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/.test(p)), req7.join(' · '))

  const quadranti = await page.$$eval('.ow-quad .ow-badge-pill', (els) => els.map((e) => e.textContent.trim()))
  check('i quadranti del menu engineering sono in italiano, non in gergo',
    quadranti.length >= 2 && !quadranti.some((q) => /star|plowhorse|puzzle|dog/i.test(q)), quadranti.join(' · '))

  const bars = await page.$$eval('.ow-bar', (els) => els.length)
  check('le barre sono i giorni tornati dal server', bars > 0, `${bars} barre`)

  // Cambio periodo: la richiesta deve ripartire con un intervallo di 30 giorni.
  await tap(page, '.ow-seg-scroll .ow-chip', { nth: 1 })
  await new Promise((r) => setTimeout(r, 400))
  const req30 = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => new URL(r.name).search).filter((s) => s.includes('days=30')))
  check('«30 giorni» ricarica davvero su 30 giorni', req30.length > 0)

  // Export: il click deve scaricare il CSV con il Bearer (non un <a href> nudo, che
  // dal tunnel prenderebbe 404 non portando l'header).
  let exportReq = null
  page.on('request', (r) => { if (r.url().includes('/api/stats/export')) exportReq = r })
  await tap(page, '.ow-card:last-child .ow-btn')
  await new Promise((r) => setTimeout(r, 600))
  check('l\'export parte verso /api/stats/export con il periodo', !!exportReq && /from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/.test(exportReq.url()),
    exportReq ? new URL(exportReq.url()).search : 'nessuna richiesta')
  check('e porta l\'header Authorization', !!exportReq?.headers()?.authorization?.startsWith('Bearer '))
  await page.close()
}

// ─── Layout delle sotto-schermate a 390 e 430 px ──────────────────────────────
console.log('\n▶ Zero scroll orizzontale sulle schermate di Wave 2')
for (const width of [390, 430]) {
  const { page } = await newPage(width)
  const inner = await page.evaluate(() => window.innerWidth)
  check(`${width}px · viewport applicato (innerWidth ${inner})`, inner === width,
    inner !== width ? 'le misure sotto non valgono' : '')

  await tap(page, '.ow-bb-tab', { nth: 4 })
  {
    const m = await overflow(page)
    check(`${width}px · hub Altro: ${m.body} <= ${m.inner}`, m.body <= m.inner && m.doc <= m.inner && m.over.length === 0,
      m.over.length ? `sfora: ${m.over.join(', ')}` : '')
  }

  for (const sub of ['magazzino', 'menu', 'andamento']) {
    await tap(page, `.ow-hub-tile[data-sub="${sub}"]`)
    const m = await overflow(page)
    check(`${width}px · ${sub}: ${m.body} <= ${m.inner}`, m.body <= m.inner && m.doc <= m.inner && m.over.length === 0,
      m.over.length ? `sfora: ${m.over.join(', ')}` : '')
    // Anche il foglio aperto deve stare nel viewport: è lì che vivono i tasti larghi.
    if (sub === 'magazzino') {
      await tap(page, '.ow-inv-row')
      const s = await overflow(page)
      check(`${width}px · foglio movimento: ${s.body} <= ${s.inner}`, s.body <= s.inner && s.over.length === 0,
        s.over.length ? `sfora: ${s.over.join(', ')}` : '')
      await tap(page, '.ow-sheet-head .ow-icon-btn')
    }
    await tap(page, '.ow-back')
  }
  await page.close()
}

// ─── Il tasto indietro riporta all'hub, non fuori dall'app ────────────────────
console.log('\n▶ Navigazione: indietro dalle sotto-schermate')
{
  const { page } = await newPage()
  await tap(page, '.ow-bb-tab', { nth: 4 })
  await tap(page, '.ow-hub-tile[data-sub="magazzino"]')
  check('sono in Magazzino', (await page.$('.ow-inv-row')) !== null)
  await page.goBack()
  await new Promise((r) => setTimeout(r, 350))
  check('il "indietro" del telefono torna all\'hub', (await page.$('.ow-hub-tile')) !== null && (await page.$('.ow-inv-row')) === null)
  await page.close()
}

await browser.close()
console.log(failures === 0 ? '\n✓ Wave 2: tutti i controlli verdi\n' : `\n✗ ${failures} controlli falliti\n`)
process.exit(failures === 0 ? 0 : 1)
