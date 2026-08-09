#!/usr/bin/env node
// Verifier di F1.4 — selezione dell'endpoint LAN-first dell'app owner.
//
// Non basta che l'app "funzioni": deve funzionare VELOCE quando si è in sala. Quindi qui
// non si verifica solo che i dati arrivino, ma che quando la LAN risponde NON parta nessuna
// richiesta verso l'hostname remoto (è il risparmio di latenza il punto di tutto il piano).
//
// Tre scenari, con route interception:
//   1. LAN raggiungibile      → nessuna chiamata al remoto, badge "In sala"
//   2. LAN spenta             → tutte le chiamate vanno al remoto entro 2 s, badge "Da remoto"
//   3. LAN che ritorna        → al ritorno in foreground (visibilitychange) si torna in LAN
// Più due controlli sulle Exit del piano: su rete cellulare il probe LAN si salta del tutto,
// e con entrambi gli endpoint giù lo stato è 'offline' (sola lettura), mai una pagina bianca.
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

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] })

/**
 * Apre /owner/ con endpoint finti pre-seminati in localStorage e con l'interception attiva.
 * `world` è mutabile: i test cambiano lanUp/remoteUp a caldo per simulare la rete.
 */
async function openApp(world) {
  const page = await browser.newPage()
  await page.setViewport({ width: 500, height: 900 })

  // Gli endpoint si imparano da /api/system/info; qui li piantiamo direttamente così lo
  // scenario è deterministico e non dipende dalla rete reale della macchina di build.
  await page.evaluateOnNewDocument(
    (lan, remote, cellular) => {
      localStorage.setItem('tako.owner.endpoints', JSON.stringify({ lan, remote }))
      if (cellular) {
        Object.defineProperty(navigator, 'connection', { value: { type: 'cellular' }, configurable: true })
      }
    },
    LAN, REMOTE, !!world.cellular,
  )

  world.hits = []
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = req.url()
    const isLan = url.startsWith(LAN)
    const isRemote = url.startsWith(REMOTE)
    if (!isLan && !isRemote) return void req.continue() // asset dell'app: passano al server vero
    world.hits.push({ url, at: Date.now() })
    // LAN "appesa": la richiesta resta pendente per sempre. È il caso peggiore reale (WiFi
    // agganciato ma gateway morto, mDNS che non risolve) e l'unico che mette alla prova il
    // TIMEOUT del probe: una connessione rifiutata fallisce subito e non lo esercita.
    if (isLan && world.lanHang) return
    const up = isLan ? world.lanUp : world.remoteUp
    if (!up) return void req.abort('connectionfailed')
    // I due endpoint sono origini DIVERSE da quella che serve l'app: senza header CORS il
    // browser scarterebbe la risposta e il probe leggerebbe "irraggiungibile". È lo stesso
    // motivo per cui il server vero mette l'hostname del tunnel nella sua allowlist CORS.
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization,content-type',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    }
    if (req.method() === 'OPTIONS') {
      return void req.respond({ status: 204, headers: cors })
    }
    if (url.endsWith('/health')) {
      return void req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) })
    }
    if (url.includes('/api/system/info')) {
      return void req.respond({
        status: 200,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify({ data: { lanUrl: LAN, remoteUrl: REMOTE } }),
      })
    }
    return void req.respond({ status: 200, headers: cors, contentType: 'application/json', body: '{}' })
  })

  await page.goto(`${SERVER}/owner/index.html`, { waitUntil: 'domcontentloaded' })
  return page
}

const badge = (page) => page.$eval('.ow-badge', (el) => el.getAttribute('data-endpoint'))
const waitBadge = async (page, want, timeout = 6000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if ((await badge(page).catch(() => null)) === want) return Date.now() - t0
    await sleep(50)
  }
  return -1
}

// ── Scenario 1: LAN raggiungibile ────────────────────────────────────────────────────────
console.log('\n1. LAN raggiungibile')
{
  const world = { lanUp: true, remoteUp: true }
  const page = await openApp(world)
  const ms = await waitBadge(page, 'lan')
  check('endpoint selezionato = lan', ms >= 0, ms >= 0 ? `in ${ms} ms` : 'timeout')
  await sleep(1500) // dai tempo a un eventuale probe remoto di partire
  const remoteHits = world.hits.filter((h) => h.url.startsWith(REMOTE))
  check('NESSUNA richiesta verso l hostname remoto', remoteHits.length === 0, `${remoteHits.length} chiamate`)
  check('la LAN è stata sondata', world.hits.some((h) => h.url === `${LAN}/health`))
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
  const world = { lanUp: true, remoteUp: true, cellular: true }
  const page = await openApp(world)
  const ms = await waitBadge(page, 'remote', 4000)
  check('va direttamente sul remoto anche con la LAN "su"', ms >= 0, ms >= 0 ? `in ${ms} ms` : 'timeout')
  check('nessun probe verso la LAN', !world.hits.some((h) => h.url.startsWith(LAN)))
  await page.close()
}

// ── Entrambi giù ─────────────────────────────────────────────────────────────────────────
console.log('\n5. Entrambi gli endpoint giù → offline esplicito, mai pagina bianca')
{
  const world = { lanUp: false, remoteUp: false }
  const page = await openApp(world)
  const ms = await waitBadge(page, 'offline', 6000)
  check('stato offline mostrato', ms >= 0)
  const text = await page.$eval('.ow-badge', (el) => el.textContent?.trim() ?? '')
  check('con un motivo esplicito a schermo', text.length > 0, JSON.stringify(text))
  await page.close()
}

await browser.close()
console.log(`\n${failures === 0 ? '✓ tutti i controlli superati' : `✗ ${failures} controlli falliti`}`)
process.exit(failures === 0 ? 0 : 1)
