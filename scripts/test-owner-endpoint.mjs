#!/usr/bin/env node
// Verifier di F1.4 — selezione dell'endpoint LAN-first dell'app owner.
//
// Non basta che l'app "funzioni": deve funzionare VELOCE quando si è in sala. Quindi qui
// non si verifica solo che i dati arrivino, ma che quando la LAN risponde NON parta nessuna
// richiesta verso l'hostname remoto (è il risparmio di latenza il punto di tutto il piano).
//
// Scenari, con route interception:
//   1. LAN raggiungibile      → nessuna chiamata al remoto, badge "In sala"
//   2. LAN spenta             → tutte le chiamate vanno al remoto entro 2 s, badge "Da remoto"
//   3. LAN che ritorna        → al ritorno in foreground (visibilitychange) si torna in LAN
//   6. Appliance raggiunta per IP → l'ORIGINE che serve la pagina vale come endpoint di sala
//   7. App aperta dal tunnel  → l'origine NON diventa "In sala" solo perché ha risposto
// Più due controlli sulle Exit del piano: su rete cellulare il probe LAN si salta del tutto,
// e con tutti gli endpoint giù lo stato è 'offline' (sola lettura), mai una pagina bianca.
//
// Il badge si legge dall'header della shell (`.ow-net[data-net]`), che esiste solo DENTRO
// la sessione: per questo ogni pagina parte con una sessione finta in localStorage e con
// l'API stubbata — altrimenti il primo 401 riporterebbe l'app alla schermata di
// collegamento e il badge sparirebbe a metà scenario.
//
// Uso:  node scripts/test-owner-endpoint.mjs [http://localhost:3001]
// Richiede l'appliance viva (serve /owner/) e Chrome di sistema (puppeteer-core).
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const SERVER = process.argv[2] ?? 'http://localhost:3001'
// Host FINTI: non devono esistere davvero, tutto il traffico verso di loro è intercettato.
const LAN = 'http://lan.tako.test'
const REMOTE = 'https://remote.tako.test'

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const FAKE_SESSION = {
  token: 'x'.repeat(64),
  deviceId: '00000000-0000-0000-0000-000000000000',
  expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
  user: { id: 'u', name: 'Owner di prova', email: 'o@test.local', role: 'owner' },
  restaurant: { id: 'r', name: 'Trattoria di Prova', slug: 'prova' },
}

/** Risposte minime perché la Sala renderizzi: se una schermata esplode, il badge sparisce. */
function stubFor(pathname, world) {
  if (pathname === '/api/system/info') {
    return { data: { version: 'test', lanUrl: world.endpoints.lan, remoteUrl: world.endpoints.remote } }
  }
  if (pathname === '/api/bills/summary/today') {
    return { data: { revenue: 0, tips: 0, billsCount: 0, avgTicket: 0 } }
  }
  if (pathname === '/api/orders/active') return { data: [], meta: { nextBefore: null } }
  if (pathname === '/api/inventory/stats') {
    return { data: { totalValue: 0, itemCount: 0, lowCount: 0, outCount: 0, perItem: [] } }
  }
  if (pathname === '/api/inventory/reorder') return { data: { suppliers: [], itemCount: 0, estTotalCost: 0 } }
  return { data: [] }
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] })

/**
 * Apre /owner/ con endpoint finti pre-seminati in localStorage e con l'interception attiva.
 * `world` è mutabile: i test cambiano lanUp/remoteUp a caldo per simulare la rete.
 *
 * Tre interruttori, uno per ciascun indirizzo che può rispondere al probe `/health`:
 *   `lanUp` (+ `lanHang`) per l'host LAN, `remoteUp` per il tunnel e `originUp` per
 *   l'origine da cui la pagina è servita. Quest'ultimo è SPENTO di default: negli
 *   scenari storici l'origine è un terzo indirizzo che nella realtà non esiste
 *   (coincide sempre con la LAN o col tunnel), e lasciarlo acceso falserebbe i ripieghi.
 */
async function openApp(world) {
  world.hits = []
  world.endpoints = world.endpoints ?? { lan: LAN, remote: REMOTE }
  const from = world.serveFrom ?? SERVER

  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 860, isMobile: true, hasTouch: true })

  // Gli endpoint si imparano da /api/system/info; qui li piantiamo direttamente così lo
  // scenario è deterministico e non dipende dalla rete reale della macchina di build.
  await page.evaluateOnNewDocument(
    (session, endpoints, cellular) => {
      localStorage.setItem('tako.owner.session', JSON.stringify(session))
      localStorage.setItem('tako.owner.endpoints', JSON.stringify(endpoints))
      localStorage.setItem('tako.owner.section', 'sala')
      localStorage.removeItem('tako.owner.lastEndpointKind')
      if (cellular) {
        Object.defineProperty(navigator, 'connection', { value: { type: 'cellular' }, configurable: true })
      }
    },
    FAKE_SESSION, world.endpoints, !!world.cellular,
  )

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  }

  await page.setRequestInterception(true)
  page.on('request', async (req) => {
    let u
    try { u = new URL(req.url()) } catch { return void req.continue() }
    const origin = u.origin

    // `/health` È il probe: qui si decide chi risponde e chi no.
    if (u.pathname === '/health') {
      world.hits.push({ url: req.url(), origin, at: Date.now() })
      if (origin === LAN) {
        // LAN "appesa": la richiesta resta pendente per sempre. È il caso peggiore reale
        // (WiFi agganciato ma gateway morto, mDNS che non risolve) e l'unico che mette alla
        // prova il TIMEOUT del probe: una connessione rifiutata fallisce subito.
        if (world.lanHang) return
        if (!world.lanUp) return void req.abort('connectionfailed')
      } else if (origin === REMOTE) {
        if (!world.remoteUp) return void req.abort('connectionfailed')
      } else if (!world.originUp) {
        return void req.abort('connectionfailed')
      }
      return void req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) })
    }

    if (u.pathname.startsWith('/socket.io')) return void req.abort()

    // API: sempre stubbata, su qualunque origine. Serve anche a dire DOVE sta parlando
    // l'app: l'origine delle chiamate /api è la prova di quale endpoint è stato scelto.
    if (u.pathname.startsWith('/api/')) {
      world.hits.push({ url: req.url(), origin, at: Date.now() })
      if (req.method() === 'OPTIONS') return void req.respond({ status: 204, headers: cors })
      return void req.respond({
        status: 200,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify(stubFor(u.pathname, world)),
      })
    }

    // Scenario 7: la pagina arriva da un'origine che non è il server di test. Gli asset
    // si prendono comunque dall'appliance vera e si riconsegnano sotto l'origine finta.
    if (world.serveFrom && origin === world.serveFrom) {
      try {
        const res = await fetch(`${SERVER}${u.pathname}`, { headers: { 'accept-encoding': 'identity' } })
        const body = Buffer.from(await res.arrayBuffer())
        return void req.respond({
          status: res.status,
          contentType: res.headers.get('content-type') ?? 'application/octet-stream',
          body,
        })
      } catch {
        return void req.abort('failed')
      }
    }

    return void req.continue() // asset dell'app: passano al server vero
  })

  await page.goto(`${from}/owner/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ow-net', { timeout: 20000 })
  return page
}

const badge = (page) => page.$eval('.ow-net', (el) => el.getAttribute('data-net'))
const waitBadge = async (page, want, timeout = 6000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if ((await badge(page).catch(() => null)) === want) return Date.now() - t0
    await sleep(50)
  }
  return -1
}
const hitsOn = (world, origin) => world.hits.filter((h) => h.origin === origin)

// ── Scenario 1: LAN raggiungibile ────────────────────────────────────────────────────────
console.log('\n1. LAN raggiungibile')
{
  const world = { lanUp: true, remoteUp: true, originUp: true }
  const page = await openApp(world)
  const ms = await waitBadge(page, 'lan')
  check('endpoint selezionato = lan', ms >= 0, ms >= 0 ? `in ${ms} ms` : 'timeout')
  await sleep(1500) // dai tempo a un eventuale probe remoto di partire
  const remoteHits = hitsOn(world, REMOTE)
  check('NESSUNA richiesta verso l hostname remoto', remoteHits.length === 0, `${remoteHits.length} chiamate`)
  check('la LAN è stata sondata', world.hits.some((h) => h.url === `${LAN}/health`))
  check('e l app parla con la LAN', hitsOn(world, LAN).some((h) => h.url.includes('/api/')))
  await page.close()
}

// ── Scenario 2: LAN spenta ───────────────────────────────────────────────────────────────
console.log('\n2. LAN spenta → ripiego sul tunnel')
{
  const world = { lanUp: false, remoteUp: true }
  const page = await openApp(world)
  const ms = await waitBadge(page, 'remote', 4000)
  check('endpoint selezionato = remote', ms >= 0, ms >= 0 ? `in ${ms} ms` : 'timeout')
  check('ripiego entro 2 s', ms >= 0 && ms < 2000, `${ms} ms`)
  check('il remoto è stato sondato', world.hits.some((h) => h.url === `${REMOTE}/health`))
  await page.close()
}

// ── Scenario 2 bis: LAN appesa (il caso che esercita davvero il timeout) ─────────────────
console.log('\n2 bis. LAN appesa → si ripiega per TIMEOUT, non per errore')
{
  const world = { lanUp: true, lanHang: true, remoteUp: true }
  const page = await openApp(world)
  const ms = await waitBadge(page, 'remote', 6000)
  check('endpoint selezionato = remote', ms >= 0, ms >= 0 ? `in ${ms} ms` : 'timeout')
  // Il probe LAN deve scadere a ~1200 ms: non prima (falso negativo su una LAN lenta) e
  // non molto dopo (il ristoratore aspetterebbe fuori dal locale).
  check('scaduto dopo il budget di 1200 ms', ms >= 1100, `${ms} ms`)
  check('e comunque entro 2 s', ms >= 0 && ms < 2000, `${ms} ms`)
  await page.close()
}

// ── Scenario 3: la LAN ritorna ───────────────────────────────────────────────────────────
console.log('\n3. La LAN ritorna → si torna in sala da soli')
{
  const world = { lanUp: false, remoteUp: true }
  const page = await openApp(world)
  const t = await waitBadge(page, 'remote', 4000)
  check('si parte da remote', t >= 0)

  world.lanUp = true
  const before = world.hits.length
  // Simula il ritorno in foreground: è l'evento su cui l'app ri-prova la LAN.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const ms = await waitBadge(page, 'lan', 4000)
  check('rientro automatico in lan', ms >= 0, ms >= 0 ? `in ${ms} ms` : 'timeout')
  check('il rientro ha ri-sondato la LAN', world.hits.slice(before).some((h) => h.url === `${LAN}/health`))
  await page.close()
}

// ── Exit del piano: rete cellulare ───────────────────────────────────────────────────────
console.log('\n4. Rete cellulare → il probe LAN si salta del tutto (Exit F1.4)')
{
  const world = { lanUp: true, remoteUp: true, originUp: true, cellular: true }
  const page = await openApp(world)
  const ms = await waitBadge(page, 'remote', 4000)
  check('va direttamente sul remoto anche con la LAN "su"', ms >= 0, ms >= 0 ? `in ${ms} ms` : 'timeout')
  check('nessun probe verso la LAN', !world.hits.some((h) => h.url.startsWith(LAN)))
  // L'origine è un indirizzo di rete locale quanto la LAN: su cellulare non risponderebbe
  // mai, e sondarla costerebbe un altro timeout prima di arrivare al tunnel.
  check('e nessun probe verso l origine', !world.hits.some((h) => h.url === `${SERVER}/health`))
  await page.close()
}

// ── Tutti giù ────────────────────────────────────────────────────────────────────────────
console.log('\n5. Nessun endpoint raggiungibile → offline esplicito, mai pagina bianca')
{
  const world = { lanUp: false, remoteUp: false, originUp: false }
  const page = await openApp(world)
  const ms = await waitBadge(page, 'offline', 6000)
  check('stato offline mostrato', ms >= 0)
  const text = await page.$eval('.ow-net', (el) => el.textContent?.trim() ?? '')
  check('con un motivo esplicito a schermo', text.length > 0, JSON.stringify(text))
  await page.close()
}

// ── Scenario 6: appliance raggiunta per IP ───────────────────────────────────────────────
// Il caso vero: mDNS che non passa (WiFi ospiti, isolation, Android), il ristoratore apre
// l'app all'IP dell'appliance. `tako.local` — imparato da /api/system/info — non risponde,
// ma la pagina è arrivata: dire "Non raggiungibile" mentre la si sta guardando è il bug.
console.log('\n6. Appliance raggiunta per IP → l origine che serve la pagina vale come sala')
{
  const world = { lanUp: false, remoteUp: false, originUp: true, endpoints: { lan: LAN, remote: null } }
  const page = await openApp(world)
  const ms = await waitBadge(page, 'lan', 6000)
  check('badge "In sala", non "Non raggiungibile"', ms >= 0, ms >= 0 ? `in ${ms} ms` : 'timeout')
  check('tako.local è stato provato PRIMA', world.hits.some((h) => h.url === `${LAN}/health`))
  check('poi è stata sondata l origine', world.hits.some((h) => h.url === `${SERVER}/health`))
  await sleep(400)
  check('e l app parla con l origine', hitsOn(world, SERVER).some((h) => h.url.includes('/api/')))
  const text = await page.$eval('.ow-net', (el) => el.textContent?.trim() ?? '')
  check('il testo del badge dice In sala', text === 'In sala', JSON.stringify(text))
  await page.close()
}

// ── Scenario 6 bis: l'origine È l'host del tunnel ────────────────────────────────────────
console.log('\n6 bis. L origine è l host remoto → resta "Da remoto"')
{
  const world = { lanUp: false, remoteUp: false, originUp: true, endpoints: { lan: LAN, remote: SERVER } }
  const page = await openApp(world)
  const ms = await waitBadge(page, 'remote', 6000)
  check('badge "Da remoto" anche se l origine risponde', ms >= 0, ms >= 0 ? `in ${ms} ms` : 'timeout')
  check('mai passato per "In sala"', (await badge(page)) === 'remote')
  await page.close()
}

// ── Scenario 7: app aperta dal tunnel senza endpoint memorizzati ─────────────────────────
// Primo avvio con la pagina servita dall'hostname pubblico: l'unico indirizzo noto è
// l'origine. Deve funzionare, ma NON deve dichiarare "In sala" — il verde abilita azioni
// che si fanno stando nel locale.
console.log('\n7. Aperta dal tunnel, endpoint non ancora imparati → online ma "Da remoto"')
{
  const world = {
    lanUp: false, remoteUp: true, originUp: true,
    endpoints: { lan: null, remote: null },
    serveFrom: REMOTE,
  }
  const page = await openApp(world)
  const ms = await waitBadge(page, 'remote', 6000)
  check('endpoint selezionato = remote', ms >= 0, ms >= 0 ? `in ${ms} ms` : 'timeout')
  check('l origine pubblica non viene scambiata per la sala', (await badge(page)) !== 'lan')
  await page.close()
}

await browser.close()
console.log(`\n${failures === 0 ? '✓ tutti i controlli superati' : `✗ ${failures} controlli falliti`}`)
process.exit(failures === 0 ? 0 : 1)
