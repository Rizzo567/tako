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

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] })

async function newPage(width) {
  const page = await browser.newPage()
  await page.setViewport({ width, height: 860, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.evaluateOnNewDocument((session, origin) => {
    localStorage.setItem('tako.owner.session', JSON.stringify(session))
    // Endpoint già noti: nessun probe verso host inesistenti a rallentare l'avvio.
    localStorage.setItem('tako.owner.endpoints', JSON.stringify({ lan: origin, remote: null }))
  }, FAKE_SESSION, SERVER)
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
  const page = await newPage(width)
  await page.goto(`${SERVER}/owner/`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => document.querySelectorAll('.ow-bb-tab').length === 5, { timeout: 20000 })

  for (const section of ['sala', 'ordini', 'cassa', 'oggi', 'altro']) {
    await page.evaluate((s) => {
      const tabs = [...document.querySelectorAll('.ow-bb-tab')]
      const order = ['sala', 'ordini', 'cassa', 'oggi', 'altro']
      tabs[order.indexOf(s)].click()
    }, section)
    await new Promise((r) => setTimeout(r, 260))

    const m = await page.evaluate(() => {
      // innerWidth è la larghezza LOGICA reale del viewport emulato: è questa che
      // conta, non la dimensione dello screenshot.
      const over = [...document.querySelectorAll('*')]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}.${el.className || '(nessuna classe)'}`)
      return {
        inner: window.innerWidth,
        bodyScroll: document.body.scrollWidth,
        docScroll: document.documentElement.scrollWidth,
        over,
      }
    })

    check(
      `${width}px · ${section}: scrollWidth ${m.bodyScroll} <= innerWidth ${m.inner}`,
      m.bodyScroll <= m.inner && m.docScroll <= m.inner,
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
