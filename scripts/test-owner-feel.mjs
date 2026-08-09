#!/usr/bin/env node
// Verifier del "feel" dell'app owner (piano F8.1).
//
// Nasce da quattro frasi di Manuel dopo aver provato la build di F7.3 sul
// Simulatore, e ognuna qui dentro è diventata una misura:
//
//   1. «si può muovere tutta l'interfaccia a destra e sinistra»  → §1 e §2
//   2. «non arriva al limite della dynamic island»               → §3 e modo --shot
//   3. «gli elementi oltre l'isola non diventano sfocati»        → §4 (pixel veri)
//   4. «sembra una pagina web»                                   → §5
//
// Le prime quattro sezioni girano in Chrome headless sulla PWA servita; il modo
// `--shot` misura invece i PIXEL degli screenshot del Simulatore, dove vive
// l'unica prova che conta per il bordo dello schermo — Chrome non ha un'isola.
//
// Uso:
//   node scripts/test-owner-feel.mjs [http://localhost:4317]
//   node scripts/test-owner-feel.mjs --shot cima.png scrollato.png
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// sharp è dichiarato da apps/server: lo si risolve da lì invece di appuntare un
// percorso dentro .pnpm, che cambia a ogni bump di versione.
const requireFromServer = createRequire(join(ROOT, 'apps/server/package.json'))
const sharp = (await import(requireFromServer.resolve('sharp'))).default

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()

async function pixels(file) {
  const img = sharp(file)
  const { width, height } = await img.metadata()
  const data = await img.ensureAlpha().raw().toBuffer()
  return {
    width,
    height,
    at(x, y) {
      const i = (y * width + x) * 4
      return [data[i], data[i + 1], data[i + 2]]
    },
  }
}

/**
 * "Nitidezza" di una fascia orizzontale: somma dei salti di luminanza fra pixel
 * vicini. Un contenuto a fuoco ha bordi netti e quindi salti grandi; lo stesso
 * contenuto dietro una sfocatura li ha smussati. È la differenza fra "sfocato" e
 * "netto" espressa in un numero invece che a occhio.
 */
function edgeEnergy(px, y0, y1, x0 = 0, x1 = px.width) {
  let sum = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0 + 1; x < x1; x++) {
      const a = px.at(x - 1, y)
      const b = px.at(x, y)
      const la = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2]
      const lb = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]
      sum += Math.abs(lb - la)
      n++
    }
  }
  return n ? sum / n : 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Modo --shot: i pixel del Simulatore (bordo dello schermo e sfocatura vere)
// ─────────────────────────────────────────────────────────────────────────────
if (process.argv[2] === '--shot') {
  const [top, scrolled] = process.argv.slice(3)
  if (!top) {
    console.error('uso: test-owner-feel.mjs --shot <cima.png> [<scrollato.png>]')
    process.exit(2)
  }

  console.log('\n▶ Bordo a bordo: nessuna banda sopra il contenuto (pixel del Simulatore)')
  const px = await pixels(top)
  const midX = Math.floor(px.width / 2)
  // Fuori dall'isola, non sotto: l'isola è nera per costruzione. A 1/8 e 7/8 della
  // larghezza si è ai suoi lati, dove deve esserci lo sfondo dell'app.
  const sideL = Math.floor(px.width / 8)
  const sideR = Math.floor((px.width * 7) / 8)
  const APP_BG = [0xF2, 0xEB, 0xE2]
  // Tolleranza stretta di proposito: la banda della build bocciata era #FBF8F4,
  // che dista 18 dal crema dell'app sul canale blu. Con una tolleranza larga
  // questo controllo sarebbe passato proprio sulla build da bocciare.
  const near = (c, ref, tol = 14) => c.every((v, i) => Math.abs(v - ref[i]) <= tol)
  const scale = Math.round(px.width / 402) || 3 // punti → pixel del dispositivo

  // 8pt sta SOPRA l'orologio e le icone di stato, 52pt sotto di esse e sopra il
  // titolo: due righe che in una build con la banda sarebbero del colore della
  // banda, e che qui devono essere già l'app.
  for (const y of [8 * scale, 52 * scale]) {
    for (const [label, x] of [['sinistra', sideL], ['destra', sideR]]) {
      const c = px.at(x, y)
      check(
        `y=${y}px (${y / scale}pt) a ${label}: sfondo app, non banda`,
        near(c, APP_BG),
        `${hex(...c)} (atteso ~#F2EBE2)`,
      )
    }
  }
  // Controprova che lo screenshot sia davvero di un telefono con l'isola (se no
  // tutti i controlli qui sopra sarebbero verdi per il motivo sbagliato).
  const black = px.at(midX, 25 * scale)
  check('al centro a 25pt c\'è l\'isola (nera): lo screenshot è quello giusto',
    black.every((v) => v < 40), hex(...black))

  // La banda si riconosce dalla CUCITURA, non dal colore: una riga in cui la
  // luminanza salta di colpo sui due margini dello schermo insieme. Il colore di
  // una banda può essere qualunque — il bordo netto che la separa dall'app no.
  // Si campionano solo i due margini esterni, 2-12pt e 390-400pt: dentro ci sono
  // l'orologio, le icone di stato, il titolo e il badge — tutta roba che salta di
  // luminanza per conto suo e che farebbe gridare alla banda su una build sana.
  // Il padding dell'header e del pannello è 14pt: quei margini sono sempre vuoti.
  const cols = []
  for (let x = 2 * scale; x < 12 * scale; x += 2) cols.push(x)
  for (let x = 390 * scale; x < 400 * scale; x += 2) cols.push(x)
  const rowMean = (y) => cols.reduce((s, x) => {
    const [r, g, b] = px.at(x, y)
    return s + 0.299 * r + 0.587 * g + 0.114 * b
  }, 0) / cols.length
  let seam = 0
  let seamY = 0
  for (let y = 2 * scale; y < 100 * scale; y++) {
    const d = Math.abs(rowMean(y) - rowMean(y - 1))
    if (d > seam) { seam = d; seamY = y }
  }
  check('nessuna cucitura orizzontale nei primi 100pt (niente banda sopra l\'app)',
    seam < 6, `salto massimo ${seam.toFixed(1)} a y=${seamY}px (${(seamY / scale).toFixed(0)}pt)`)

  if (scrolled) {
    console.log('\n▶ Sfocatura sotto l\'isola: la stessa fascia cambia quando si scorre')
    const px2 = await pixels(scrolled)
    // Fascia 95-112pt: sotto il titolo dell'header (che finisce a ~89pt) e ancora
    // dentro la coda della sfocatura (che muore a ~123pt). In cima alla lista lì
    // non c'è niente — il contenuto comincia a 113pt; scorrendo, ci passa sotto.
    const bandTop = Math.round(95 * scale)
    const bandBot = Math.round(112 * scale)
    const eTop = edgeEnergy(px, bandTop, bandBot)
    const eScr = edgeEnergy(px2, bandTop, bandBot)
    // Riferimento "a fuoco": la fascia PIÙ INCISA fra quelle che stanno sotto lo
    // scrim, nello stesso screenshot. Prendere una fascia fissa significherebbe
    // confrontare la sfocatura con qualunque cosa capiti lì — anche uno spazio
    // vuoto, che è poco inciso quanto una sfocatura e farebbe passare il test a
    // scrim spento.
    let eSharp = 0
    for (let y = 130; y < 400; y += 17) {
      eSharp = Math.max(eSharp, edgeEnergy(px2, Math.round(y * scale), Math.round((y + 17) * scale)))
    }
    check('la fascia sotto l\'isola cambia dopo lo scorrimento (il contenuto ci passa)',
      eScr > eTop + 0.2, `nitidezza ${eTop.toFixed(3)} → ${eScr.toFixed(3)}`)
    check('…e ci passa SFOCATA, non netta',
      eSharp > 0 && eScr < eSharp * 0.6,
      `fascia sotto l'isola ${eScr.toFixed(3)} vs contenuto a fuoco ${eSharp.toFixed(3)}`)
  }

  console.log(failures === 0 ? '\n✓ pixel del Simulatore: tutti i controlli verdi\n' : `\n✗ ${failures} controlli falliti\n`)
  process.exit(failures === 0 ? 0 : 1)
}

// ─────────────────────────────────────────────────────────────────────────────
// Modo normale: Chrome headless sulla PWA
// ─────────────────────────────────────────────────────────────────────────────
const puppeteer = (await import('puppeteer-core')).default
const SERVER = process.argv[2] ?? 'http://localhost:4317'

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

const FAKE_SESSION = {
  token: 'x'.repeat(64),
  deviceId: '00000000-0000-0000-0000-000000000000',
  expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
  user: { id: 'u', name: 'Owner di prova', email: 'o@test.local', role: 'owner' },
  restaurant: { id: 'r', name: 'Trattoria di Prova', slug: 'prova' },
}

// Lista lunga e a forte contrasto: serve del contenuto DA sfocare sotto lo scrim,
// altrimenti la misura della sfocatura guarderebbe uno sfondo piatto e direbbe sì.
const LONG_ORDERS = Array.from({ length: 14 }, (_, i) => ({
  id: `o${i}`, restaurantId: 'r', tableId: `t${i}`, tableNumber: `${i + 1}`, type: 'table',
  status: 'preparing', total: 40 + i, createdAt: new Date().toISOString(),
  items: [{ id: `i${i}`, name: 'Tagliatelle al ragù di cinghiale', quantity: 2, unitPrice: 18 }],
}))

const STUBS = {
  '/api/system/info': { data: { version: '0.1.6', lanUrl: SERVER, remoteUrl: null } },
  '/api/orders/active': { data: LONG_ORDERS, meta: { nextBefore: null } },
}
const stubFor = (p) => STUBS[p] ?? (p.startsWith('/api/') ? { data: [] } : null)

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] })

async function openApp(width = 390, { safeTop = 59, safeBottom = 34 } = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width, height: 860, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.evaluateOnNewDocument((session, origin, st, sb) => {
    localStorage.setItem('tako.owner.session', JSON.stringify(session))
    localStorage.setItem('tako.owner.endpoints', JSON.stringify({ lan: origin, remote: null }))
    localStorage.setItem('tako.owner.section', 'ordini')
    // Chrome non ha safe area: si iniettano le stesse che il guscio nativo scrive
    // nella pagina su iPhone (apps/app/app/index.tsx → insetsJs). Senza, si
    // misurerebbe un telefono senza isola, cioè non il caso in questione.
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--safe-top', `${st}px`)
      document.documentElement.style.setProperty('--safe-bottom', `${sb}px`)
    })
  }, FAKE_SESSION, SERVER, safeTop, safeBottom)

  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = new URL(req.url())
    const body = url.pathname.startsWith('/api/') ? stubFor(url.pathname) : null
    if (body) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname.startsWith('/socket.io')) return req.abort()
    return req.continue()
  })

  await page.goto(`${SERVER}/owner/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('.ow-bb-tab').length === 5, { timeout: 20000 })
  return page
}

// ─── 1. Il documento non ha nulla da scorrere ─────────────────────────────────
console.log('\n▶ Il documento non scorre: né in orizzontale né in verticale')
for (const width of [390, 430]) {
  const page = await openApp(width)
  const m = await page.evaluate(() => {
    const de = document.documentElement
    return {
      inner: window.innerWidth, innerH: window.innerHeight,
      sw: de.scrollWidth, sh: de.scrollHeight,
      bodyPos: getComputedStyle(document.body).position,
      htmlOverflow: getComputedStyle(de).overflow,
      overscroll: getComputedStyle(document.body).overscrollBehaviorX,
    }
  })
  check(`${width}px · scrollWidth ${m.sw} = innerWidth ${m.inner}`, m.sw <= m.inner)
  check(`${width}px · scrollHeight ${m.sh} = innerHeight ${m.innerH}`, m.sh <= m.innerH,
    m.sh > m.innerH ? 'il documento può scorrere: la WebView si lascerà trascinare' : '')
  check(`${width}px · body position: fixed`, m.bodyPos === 'fixed', m.bodyPos)
  check(`${width}px · overscroll-behavior none sul documento`, m.overscroll === 'none', m.overscroll)
  await page.close()
}

// ─── 2. Scorre un solo pannello, e non si trascina dietro la pagina ───────────
console.log('\n▶ Scorre solo il pannello interno')
{
  const page = await openApp()
  const m = await page.evaluate(() => {
    const s = document.querySelector('.ow-scroll')
    const seg = document.querySelector('.ow-seg-scroll')
    // Ogni elemento che può scorrere in orizzontale: deve essercene al massimo uno
    // (la striscia delle sale), e mai il contenitore principale.
    const hScrollers = [...document.querySelectorAll('*')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX))
      .map((el) => el.className || el.tagName)
    return {
      scrollOverscroll: s ? getComputedStyle(s).overscrollBehaviorY : null,
      scrollOverflowX: s ? getComputedStyle(s).overflowX : null,
      segTouch: seg ? getComputedStyle(seg).touchAction : '(nessuna striscia in questa sezione)',
      htmlTouch: getComputedStyle(document.documentElement).touchAction,
      hScrollers,
    }
  })
  check('.ow-scroll: overscroll-behavior contain', m.scrollOverscroll === 'contain', m.scrollOverscroll)
  check('.ow-scroll: overflow-x hidden', m.scrollOverflowX === 'hidden', m.scrollOverflowX)
  check('html: touch-action manipulation (niente doppio-tap per ingrandire)',
    m.htmlTouch === 'manipulation', m.htmlTouch)
  check('nessun contenitore scorre in orizzontale fuori dalla striscia delle sale',
    m.hScrollers.every((c) => String(c).includes('ow-seg-scroll')),
    m.hScrollers.join(', ') || 'nessuno')
  await page.close()
}

// ─── 3. Le safe area arrivano davvero al layout ───────────────────────────────
console.log('\n▶ Safe area: l\'header nasce sotto l\'isola, non sotto una banda')
{
  const page = await openApp(390, { safeTop: 59, safeBottom: 34 })
  const m = await page.evaluate(() => {
    const h = document.querySelector('.ow-header')
    const s = document.querySelector('.ow-scroll')
    const bb = document.querySelector('.ow-bb')
    const title = document.querySelector('.ow-header h1')
    return {
      headerTop: h.getBoundingClientRect().top,
      headerPadTop: parseFloat(getComputedStyle(h).paddingTop),
      headerPos: getComputedStyle(h).position,
      titleTop: title.getBoundingClientRect().top,
      scrollTop: s.getBoundingClientRect().top,
      scrollPadTop: parseFloat(getComputedStyle(s).paddingTop),
      bbBottom: window.innerHeight - bb.getBoundingClientRect().bottom,
    }
  })
  // Il riquadro dell'header parte da 0 — è appoggiato al bordo dello schermo —
  // ma il TITOLO parte sotto l'isola: è la differenza fra "edge-to-edge" e
  // "illeggibile".
  check('il riquadro dell\'header tocca il bordo (top = 0)', m.headerTop === 0, `${m.headerTop}px`)
  check('l\'header è fuori dal flusso (position absolute)', m.headerPos === 'absolute', m.headerPos)
  check('il titolo sta sotto l\'isola (≥ 59px)', m.titleTop >= 59, `${m.titleTop.toFixed(0)}px`)
  check('il pannello che scorre parte dal bordo (top = 0)', m.scrollTop === 0, `${m.scrollTop}px`)
  check('…ma il suo contenuto no: padding-top = safe-top + 54', m.scrollPadTop === 113, `${m.scrollPadTop}px`)
  check('la barra inferiore sta sopra l\'home indicator (≥ 34px)', m.bbBottom >= 34, `${m.bbBottom.toFixed(0)}px`)
  await page.close()
}

// ─── 4. La sfocatura c'è davvero — misurata sui pixel, non sul CSS ────────────
console.log('\n▶ Sfocatura scroll-under (pixel, non computed style)')
{
  const page = await openApp()
  const styles = await page.evaluate(() => {
    const g = (sel, pseudo) => getComputedStyle(document.querySelector(sel), pseudo)
    const before = g('.ow-header', '::before')
    const after = g('.ow-header', '::after')
    const bb = g('.ow-bb')
    return {
      beforeFilter: before.backdropFilter || before.webkitBackdropFilter,
      afterFilter: after.backdropFilter || after.webkitBackdropFilter,
      beforeMask: before.maskImage || before.webkitMaskImage,
      afterMask: after.maskImage || after.webkitMaskImage,
      bbFilter: bb.backdropFilter || bb.webkitBackdropFilter,
    }
  })
  check('header ::before ha una sfocatura', /blur\(/.test(styles.beforeFilter), styles.beforeFilter)
  check('header ::after ha una sfocatura più forte', /blur\(/.test(styles.afterFilter), styles.afterFilter)
  check('…e sono entrambe mascherate a sfumare (sfocatura progressiva)',
    /gradient/.test(styles.beforeMask) && /gradient/.test(styles.afterMask))
  check('la barra inferiore resta di vetro', /blur\(/.test(styles.bbFilter), styles.bbFilter)

  // La prova vera: si scorre la lista sotto lo scrim e si misura quanto è incisa
  // la fascia coperta, prima con lo scrim e poi senza. Se lo scrim non sfocasse
  // nulla, i due numeri sarebbero uguali.
  await page.evaluate(() => { document.querySelector('.ow-scroll').scrollTop = 260 })
  await new Promise((r) => setTimeout(r, 350))
  const band = { x: 0, y: 60, width: 390, height: 46 } // sotto l'isola, dentro lo scrim
  const withScrim = await page.screenshot({ clip: band })
  // Si spegne SOLO la sfocatura, non l'header: se si nascondesse tutto, il confronto
  // misurerebbe anche la sparizione del titolo e direbbe verde per il motivo
  // sbagliato. Restano il testo e la velatura; cambia solo il `backdrop-filter`.
  await page.evaluate(() => {
    const s = document.createElement('style')
    s.textContent = '.ow-header::before,.ow-header::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}'
    document.head.appendChild(s)
  })
  await new Promise((r) => setTimeout(r, 250))
  const withoutScrim = await page.screenshot({ clip: band })

  const eOn = edgeEnergy(await pixels(withScrim), 2, 90)
  const eOff = edgeEnergy(await pixels(withoutScrim), 2, 90)
  check('il contenuto sotto lo scrim è meno inciso che senza scrim',
    eOn < eOff * 0.75,
    `nitidezza con scrim ${eOn.toFixed(3)} · senza scrim ${eOff.toFixed(3)}`)
  await page.close()
}

// ─── 5. Feel: niente evidenziazioni, niente lente, niente zoom ────────────────
console.log('\n▶ Feel da app, non da pagina')
{
  const page = await openApp()
  const m = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el)
    const meta = document.querySelector('meta[name=viewport]')?.content ?? ''
    const theme = document.querySelector('meta[name=theme-color]')?.content ?? ''
    const num = document.querySelector('.num') || document.querySelector('.mono')
    return {
      meta,
      theme,
      tapHighlight: cs(document.documentElement).webkitTapHighlightColor,
      bodySelect: cs(document.body).webkitUserSelect || cs(document.body).userSelect,
      dataSelect: num ? (cs(num).webkitUserSelect || cs(num).userSelect) : null,
    }
  })
  // `-webkit-touch-callout` esiste solo in WebKit: Chrome non lo espone in
  // getComputedStyle E lo butta via in fase di parsing, quindi non compare nemmeno
  // nel CSSOM. Va letto dal foglio COME SPEDITO — che è la forma in cui iOS lo
  // leggerà. Cercarlo nel CSSOM darebbe rosso su un file corretto.
  const cssText = await (await fetch(`${SERVER}/owner/app.css`)).text()
  m.calloutRule = /-webkit-touch-callout:\s*none/.test(cssText)
  for (const token of ['width=device-width', 'initial-scale=1', 'maximum-scale=1', 'user-scalable=no', 'viewport-fit=cover']) {
    check(`meta viewport contiene ${token}`, m.meta.includes(token), m.meta)
  }
  check('tap-highlight trasparente', /rgba\(0, 0, 0, 0\)|transparent/.test(m.tapHighlight), m.tapHighlight)
  check('il telaio non è selezionabile', m.bodySelect === 'none', m.bodySelect)
  check('…ma i DATI sì (.num / .mono)', m.dataSelect === 'text', String(m.dataSelect))
  check('niente menù contestuale sul telaio (-webkit-touch-callout: none nel foglio)', m.calloutRule)
  check('theme-color è lo sfondo dell\'app, non l\'arancio', m.theme.toUpperCase() === '#F2EBE2', m.theme)
  await page.close()
}

await browser.close()
console.log(failures === 0 ? '\n✓ feel dell\'app owner: tutti i controlli verdi\n' : `\n✗ ${failures} controlli falliti\n`)
process.exit(failures === 0 ? 0 : 1)
