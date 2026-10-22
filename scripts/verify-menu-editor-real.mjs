// Dashboard editor 22/10 — e2e contro il SERVER VERO (QA reale, nessuna API finta).
// Postgres embedded usa-e-getta (migrazioni vere, nessun DB remoto) + server Fastify vero (startServer di apps/server, TAKO_MODE=web,
// login vero con cookie) + SPA compilata (build-staff-web in cartella temporanea, servita dal server) + anteprima = renderer vero di
// apps/web compilato con esbuild, servita da un piccolo proxy che inoltra tutto il resto (/api, /staff, /socket.io) al server.
// Bot: applyBotChange importato direttamente (tsx) sullo stesso DB. Chrome SEMPRE headless.
// Avvio:  apps/server/node_modules/.bin/tsx scripts/verify-menu-editor-real.mjs
// Uscita: docs/webapp/dashboard-editor-2026-10-22/shots/verifica-reale.json + shots/reale-*.png + video/flusso-reale-desktop.webm
import puppeteer from 'puppeteer-core'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve, extname, join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { createServer, request as httpRequest } from 'node:http'
import { connect as netConnect, createServer as netServer } from 'node:net'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID, randomBytes } from 'node:crypto'
import { build } from 'esbuild'
import { buildStaffWeb } from './build-staff-web.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = resolve(repo, 'docs/webapp/dashboard-editor-2026-10-22')
const shotsDir = resolve(DOCS, 'shots'), videoDir = resolve(DOCS, 'video')
const serverRequire = createRequire(resolve(repo, 'apps/server/package.json'))
const dbRequire = createRequire(resolve(repo, 'packages/db/package.json'))
const EmbeddedPostgres = dbRequire('embedded-postgres').default
const postgres = dbRequire('postgres')
const { drizzle } = dbRequire('drizzle-orm/postgres-js')
const { migrate } = dbRequire('drizzle-orm/postgres-js/migrator')
const bcrypt = serverRequire('bcryptjs')

export const wait = ms => new Promise(r => setTimeout(r, ms))
async function freePort() { const s = netServer(); await new Promise((ok, ko) => { s.once('error', ko); s.listen(0, '127.0.0.1', ok) }); const p = s.address().port; await new Promise(ok => s.close(ok)); return p }
async function waitFor(fn, ms = 15000, label = 'condizione') { const end = Date.now() + ms; let last; for (;;) { try { const v = await fn(); if (v) return v } catch (e) { last = e } if (Date.now() > end) throw new Error('Tempo scaduto: ' + label + (last ? ' (' + last.message + ')' : '')); await wait(120) } }

// ── Fixture: locale finto modellato sul QA ───────────────────────────────────────────────────────────────────────────────
export const RESTAURANT_ID = '26050ecd-2e55-4057-a4c5-bff2b449cd47'
let n = 0
const id = () => { n++; return '0000' + String(n).padStart(4, '0') + '-0000-4000-8000-' + randomBytes(6).toString('hex') }
const dish = (name, price, extra = {}) => ({ id: id(), name, price, ...extra })
function fixtureMenus() {
  const M = { pranzo: id(), cena: id(), giorno: id() }
  const S = {}
  const sec = (key, name, items, extra = {}) => { S[key] = id(); return { id: S[key], name, items, ...extra } }
  const pranzo = [
    sec('antipasti', 'Antipasti', [dish('Bruschetta al pomodoro', 6, { description: 'Pane casereccio, pomodoro, basilico' }), dish('Tagliere misto', 14), dish('Burrata', 9), dish('Polpette al sugo', 8), dish('Supplì', 3.5)]),
    sec('primi', 'Primi', [dish('Carbonara', 12), dish('Amatriciana', 11)]),
    sec('pasta', 'Pasta fresca', [dish('Tagliatelle al ragù', 13), dish('Ravioli burro e salvia', 12), dish('Pappardelle al cinghiale', 15), dish('Gnocchi alla sorrentina', 11)]),
    sec('risotti', 'Risotti', [dish('Risotto ai funghi', 14), dish('Risotto alla milanese', 13), dish('Risotto al nero', 16, { hidden: true })]),
    sec('secondi', 'Secondi', [dish('Tagliata di manzo', 22), dish('Pollo alla diavola', 15)]),
    sec('mare', 'Di mare', [dish('Frittura di paranza', 18), dish('Orata al forno', 19), dish('Calamari alla griglia', 17)]),
    sec('terra', 'Di terra', [dish('Saltimbocca alla romana', 16), dish('Cotoletta', 15), dish('Salsiccia e friarielli', 13)]),
    sec('contorni', 'Contorni', [dish('Patate al forno', 4), dish('Insalata mista', 4), dish('Cicoria ripassata', 5)]),
    sec('dolci', 'Dolci', [dish('Tiramisù', 6), dish('Panna cotta', 5), dish('Torta della nonna', 5, { available: false })]),
  ]
  // Sezioni figlie (Sottomenu con Sezioni): Pasta fresca/Risotti sotto Primi, Di mare/Di terra sotto Secondi
  for (const [child, parent] of [['pasta', 'primi'], ['risotti', 'primi'], ['mare', 'secondi'], ['terra', 'secondi']]) pranzo.find(s => s.id === S[child]).parentSectionId = S[parent]
  const cena = [sec('pizze', 'Pizze', [dish('Margherita', 7), dish('Marinara', 6), dish('Diavola', 8), dish('Capricciosa', 9), dish('Quattro formaggi', 9), dish('Bufala', 10)]), sec('birre', 'Birre', [dish('Bionda alla spina', 5), dish('Rossa artigianale', 6), dish('Weiss', 6)])]
  const giorno = [sec('gprimi', 'Primi del giorno', [dish('Pasta e fagioli', 9), dish('Lasagna', 10)]), sec('gsecondi', 'Secondi del giorno', [dish('Arrosto di vitello', 12), dish('Baccalà in umido', 13)])]
  const menus = [
    { id: M.pranzo, name: 'Pranzo', type: 'lunch', sections: pranzo },
    { id: M.cena, name: 'Cena', type: 'dinner', sections: cena },
    { id: M.giorno, name: 'Menu del giorno', type: 'main', pricing: 'fisso', formulas: [{ id: id(), name: 'Primo + secondo', price: 16, note: 'Acqua e coperto inclusi', sectionIds: [S.gprimi, S.gsecondi] }], sections: giorno },
  ]
  return { menus, M, S }
}

// ── Infrastruttura ───────────────────────────────────────────────────────────────────────────────────────────────────────
export async function startReal() {
  const tmp = await mkdtemp(join(tmpdir(), 'tako-editor-real-'))
  const cleanups = []
  const close = async () => { for (const f of cleanups.reverse()) { try { await f() } catch (e) { console.error('chiusura:', e.message) } } await rm(tmp, { recursive: true, force: true }).catch(() => {}) }
  try {
    // 1. Postgres embedded
    const pgPort = await freePort()
    const pg = new EmbeddedPostgres({ databaseDir: join(tmp, 'pg'), port: pgPort, user: 'isolated_test', password: 'isolated_test', persistent: false, initdbFlags: ['--encoding=UTF8'], onLog: () => {} })
    await pg.initialise(); await pg.start(); cleanups.push(() => pg.stop())
    await pg.createDatabase('editor_real')
    const sql = postgres(`postgresql://isolated_test:isolated_test@127.0.0.1:${pgPort}/editor_real`, { max: 3, onnotice: () => {} })
    cleanups.push(() => sql.end({ timeout: 5 }))
    await migrate(drizzle(sql), { migrationsFolder: resolve(repo, 'packages/db/src/migrations') })
    // Tabelle che in produzione arrivano da scripts/serverless (come tests/day-presets/local-pg.ts): preset del giorno + avvisi al titolare.
    await sql.unsafe(`DO $$ BEGIN CREATE ROLE takomenu_runtime NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`)
    await sql.reserve().then(async c => { try { await c.unsafe(await readFile(resolve(repo, 'scripts/serverless/menu-day-presets.sql'), 'utf8')) } finally { c.release() } })
    // 2. Utenti con login vero (password generate qui, mai salvate)
    const ownerPassword = 'Qa-' + randomBytes(9).toString('base64url'), staffPassword = 'Qa-' + randomBytes(9).toString('base64url')
    await sql`insert into restaurants(id,name,slug,plan,settings) values (${RESTAURANT_ID},'Trattoria QA (finta)','qa-editor-reale','pro',${JSON.stringify({ dashboardEditor: true, timezone: 'Europe/Rome' })}::jsonb)`
    const [owner] = await sql`insert into users(restaurant_id,name,email,role,password_hash,email_verified) values (${RESTAURANT_ID},'Titolare QA','titolare@qa.isolated.test','owner',${await bcrypt.hash(ownerPassword, 4)},true) returning id`
    const [staff] = await sql`insert into users(restaurant_id,name,email,role,password_hash,email_verified) values (${RESTAURANT_ID},'Cameriere QA','cameriere@qa.isolated.test','dipendente',${await bcrypt.hash(staffPassword, 4)},true) returning id`
    // 3. SPA compilata + anteprima (renderer vero) in cartella temporanea
    const staffDir = join(tmp, 'staff'); await buildStaffWeb(staffDir)
    const prev = join(tmp, 'prev')
    await writeFile(join(tmp, 'entry.tsx'), `import {createRoot} from 'react-dom/client'\nimport {MenuPreview} from '@/components/MenuPreview'\ncreateRoot(document.getElementById('root')!).render(<MenuPreview menuId={location.pathname.split('/').pop()||''}/>)\n`)
    await build({ entryPoints: [join(tmp, 'entry.tsx')], bundle: true, outdir: join(prev, 'preview'), format: 'iife', jsx: 'automatic', loader: { '.module.css': 'local-css', '.css': 'css', '.png': 'dataurl', '.svg': 'dataurl', '.woff2': 'file', '.woff': 'file', '.ttf': 'file' }, external: ['/takomenu-public/*', '/assets/*', '/fonts/*'], alias: { '@': resolve(repo, 'apps/web/src'), '@tako/types': resolve(repo, 'packages/types/src/index.ts'), '@tako/menu-ops': resolve(repo, 'packages/menu-ops/src/index.ts') }, define: { 'process.env.NODE_ENV': '"production"' }, nodePaths: [resolve(repo, 'apps/web/node_modules'), resolve(repo, 'node_modules')], logLevel: 'silent' })
    execFileSync(resolve(repo, 'apps/web/node_modules/.bin/tailwindcss'), ['-c', 'tailwind.config.ts', '-i', 'src/app/globals.css', '-o', join(prev, 'preview/tw.css')], { cwd: resolve(repo, 'apps/web'), stdio: 'ignore' })
    const previewHtml = `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/preview/tw.css"><link rel="stylesheet" href="/preview/entry.css"><body><div id="root"></div><script src="/preview/entry.js"></script></body></html>`
    // 4. Server vero (stesso processo: applyBotChange usa lo stesso DB)
    const proxyPort = await freePort(), serverPort = await freePort()
    for (const k of Object.keys(process.env)) if (/^(GROQ|ANTHROPIC|OPENAI|TWILIO|SUPABASE|RESEND|DATABASE|UPLOADS|CLOUD|SENTRY|STRIPE|R2_|CF_|CLOUDFLARE)/.test(k)) delete process.env[k]
    Object.assign(process.env, {
      TAKO_MODE: 'web', NODE_ENV: 'development', WEB_ORIGIN: `http://127.0.0.1:${proxyPort}`, PORT: String(serverPort),
      // validateWebRuntime rifiuta 'localhost/127.0.0.1' (guardia per la produzione): 127.1 è lo stesso loopback scritto in un'altra forma.
      DATABASE_URL: `postgresql://isolated_test:isolated_test@127.1:${pgPort}/editor_real`,
      JWT_SECRET: 'qa-real-' + randomBytes(24).toString('hex'), UPLOADS_DIR: join(tmp, 'uploads'), UPLOADS_DRIVER: 'local', STAFF_DIR: staffDir,
      TAKO_MULTI_TENANT: '1', TAKO_EMAIL_VERIFICATION: '0', TAKO_DISABLE_REGISTRATION: '1',
    })
    const serverIndex = pathToFileURL(resolve(repo, 'apps/server/src/index.ts')).href
    const { startServer } = await import(serverIndex)
    await startServer()
    const upstream = `http://127.0.0.1:${serverPort}`
    await waitFor(async () => (await fetch(upstream + '/health')).ok, 20000, 'server /health')
    cleanups.push(async () => { const { closeServer } = globalThis.__takoQa || {}; if (closeServer) await closeServer() })
    // 5. Proxy: /menu-preview e /preview locali, il resto al server vero (anche websocket)
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' }
    const proxy = createServer(async (req, res) => {
      const path = new URL(req.url, 'http://x').pathname
      try {
        if (path.startsWith('/menu-preview/')) { res.setHeader('Content-Type', 'text/html'); return res.end(previewHtml) }
        if (path.startsWith('/preview/')) { const file = resolve(prev, '.' + path); if (!file.startsWith(prev + '/')) throw Error('x'); res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); return res.end(await readFile(file)) }
      } catch { res.statusCode = 404; return res.end() }
      const up = httpRequest(upstream + req.url, { method: req.method, headers: { ...req.headers, host: `127.0.0.1:${proxyPort}` } }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res) })
      up.on('error', () => { if (!res.headersSent) { res.statusCode = 502 } res.end() })
      req.pipe(up)
    })
    const sockets = new Set()
    proxy.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)) })
    proxy.on('upgrade', (req, socket, head) => {
      const up = netConnect(serverPort, '127.0.0.1', () => {
        up.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n'); if (head?.length) up.write(head); up.pipe(socket); socket.pipe(up)
      })
      sockets.add(up); up.on('close', () => sockets.delete(up)); up.on('error', () => socket.destroy()); socket.on('error', () => up.destroy())
    })
    await new Promise(r => proxy.listen(proxyPort, '127.0.0.1', r))
    cleanups.push(() => new Promise(r => { for (const s of sockets) s.destroy(); proxy.close(() => r()) }))
    const base = `http://127.0.0.1:${proxyPort}`
    // 6. Moduli del server per controlli e bot (stesse istanze del server: stesso pool DB)
    const bot = await import(pathToFileURL(resolve(repo, 'apps/server/src/lib/menu-workspace-bot.ts')).href)
    const contract = await import(pathToFileURL(resolve(repo, 'apps/server/src/lib/menu-workspace-contract.ts')).href)
    const menuOps = await import(pathToFileURL(resolve(repo, 'packages/menu-ops/src/index.ts')).href)
    // 7. Chrome headless
    const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox', '--hide-scrollbars', '--disable-gpu'] })
    cleanups.push(() => browser.close())
    return { tmp, sql, pg, base, upstream, browser, bot, contract, menuOps, owner: { id: owner.id, email: 'titolare@qa.isolated.test', password: ownerPassword }, staff: { id: staff.id, email: 'cameriere@qa.isolated.test', password: staffPassword }, close }
  } catch (e) { await close(); throw e }
}

// ── API (login vero, cookie di sessione) ───────────────────────────────────────────────────────────────────────────────
export function apiClient(base) {
  let cookie = ''
  const call = async (method, path, body, extra = {}) => {
    const res = await fetch(base + path, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...(method !== 'GET' ? { origin: base } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined })
    const text = await res.text(); let json = null; try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, headers: res.headers }
  }
  return {
    call,
    async login(email, password) { const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ email, password }) }); if (r.status !== 200) throw new Error('login ' + r.status + ' ' + await r.text()); cookie = (r.headers.getSetCookie?.() || [r.headers.get('set-cookie')]).map(c => c.split(';')[0]).join('; '); return r.json() },
  }
}

export { fixtureMenus, waitFor }

/* Seme tramite le rotte vere: GET (crea il workspace), PUT del documento completo, Pubblica. */
async function seed(R, owner) {
  const g = await owner.call('GET', '/api/menu-workspace')
  if (g.status !== 200 || g.json.dashboardEditor !== true) throw new Error('GET workspace ' + g.status)
  const F = fixtureMenus()
  const doc = { ...g.json.data, menus: F.menus }
  const put = await owner.call('PUT', '/api/menu-workspace', { expectedRevision: g.json.revision, workspace: doc })
  if (put.status !== 200) throw new Error('PUT ' + put.status + ' ' + JSON.stringify(put.json).slice(0, 400))
  const cur = await owner.call('GET', '/api/menu-workspace')
  const pub = await owner.call('POST', '/api/menu-workspace/publish', { expectedRevision: cur.json.revision })
  if (pub.status !== 200) throw new Error('publish ' + pub.status + ' ' + JSON.stringify(pub.json).slice(0, 400))
  const row = await R.sql`SELECT revision,published_revision,(draft IS DISTINCT FROM published) AS pending FROM menu_workspaces WHERE restaurant_id=${RESTAURANT_ID}`
  F.dishCount = F.menus.reduce((a, m) => a + m.sections.reduce((b, s) => b + s.items.length, 0), 0)
  console.log('seme:', F.dishCount, 'piatti, riga', row[0])
  return F
}

async function loginPage(R, vp = 'desktop') {
  const page = await R.browser.newPage()
  page.__errors = []
  page.on('pageerror', e => page.__errors.push(vp + ': ' + e.message))
  page.on('console', m => { if (m.type() === 'error') page.__errors.push(vp + ' console: ' + m.text()) })
  page.on('dialog', d => d.accept())
  if (vp === 'mobile') await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })
  else await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
  const cdp = await page.createCDPSession(); await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {})
  await page.goto(R.base + '/staff/index.html', { waitUntil: 'domcontentloaded' })
  return page
}

// ── Aiuti di pagina ──────────────────────────────────────────────────────────────────────────────────────────────────────
const frameOf = async page => waitFor(() => page.frames().find(x => x.url().includes('/menu-preview/')), 20000, 'iframe del menu')
const TAP = () => { if (window.__tap) return; window.__tap = true; addEventListener('message', e => { if (e.data && typeof e.data.type === 'string' && e.data.document) window.__last = e.data }) }
/* Registra nel frame ciò che la SPA gli manda (documento e stato), come fa verify-menu-editor-dashboard. */
async function tapFrame(page) { const f = await frameOf(page); await f.waitForFunction(() => document.readyState === 'complete', { polling: 100 }); await f.evaluate(() => { if (window.__tap) return; window.__tap = true; addEventListener('message', e => { if (e.data && typeof e.data.type === 'string' && e.data.document) window.__last = e.data }) }); return f }
const frameDoc = async page => (await frameOf(page)).evaluate(() => window.__last?.document || null)
const fromFrame = async (page, msg) => { const f = await frameOf(page); await f.evaluate(m => parent.postMessage({ v: 1, ...m }, location.origin), msg); await wait(80) }
const status = page => page.$eval('.mw-ed-status', e => e.textContent.trim()).catch(() => '')
const strip = d => { if (!d) return d; const { revision, publishedRevision, capabilities, pending, dashboardEditor, ...x } = d; return x }
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x)
const findItem = (w, iid) => { for (const m of w.menus) for (const s of m.sections) { const i = s.items.find(x => x.id === iid); if (i) return { ...i, sectionId: s.id, menuId: m.id } } return null }
const findSection = (w, sid) => { for (const m of w.menus) { const s = m.sections.find(x => x.id === sid); if (s) return { ...s, menuId: m.id } } return null }
async function row(R) { const [r] = await R.sql`SELECT draft,published,revision,published_revision,(draft IS DISTINCT FROM published) AS pending FROM menu_workspaces WHERE restaurant_id=${RESTAURANT_ID}`; return r }
async function clickText(page, text, root = 'button,[role=radio]') {
  const done = await page.evaluate((t, sel) => { const el = [...document.querySelectorAll(sel)].find(b => b.offsetParent !== null && !b.disabled && (b.textContent.trim() === t || b.getAttribute('aria-label') === t)); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true }, text, root)
  if (!done) throw new Error('pulsante non trovato: ' + text); await wait(250)
}
async function typeIn(page, sel, val) { await page.$eval(sel, e => { e.focus(); e.select?.() }); await page.keyboard.press('Backspace'); await page.type(sel, val); await wait(60) }
async function frameClick(page, selector, { tap = false } = {}) {
  const f = await frameOf(page); const el = await waitFor(() => f.$(selector), 8000, 'elemento nel frame ' + selector)
  await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await wait(150)
  if (tap) await el.tap(); else await el.click(); await wait(250); return el
}
async function selectionState(page) { const f = await frameOf(page); return f.evaluate(() => { const p = document.querySelector('[data-edit-pencil]'); const sel = document.querySelector('[data-edit-selected],[aria-selected=true][data-edit-id],.tako-edit-selected'); return { pencil: p && !p.classList.contains('tako-edit-hidden') ? p.getAttribute('aria-label') : null, selected: sel?.getAttribute('data-edit-id') || null, last: window.__last?.selection || null } }) }

/* ── Scenari ── */
async function scenarios(R, F, owner) {
  const results = [], shots = [], pdfLog = [], notes = []
  const record = (n, name, ok, detail = '') => { results.push({ n, scenario: name, ok, detail }); console.log((ok ? '✓' : '✗') + ' ' + n + '. ' + name + (detail ? ' — ' + detail : '')) }
  const shot = async (page, file, label) => { await wait(300); await page.screenshot({ path: resolve(shotsDir, file) }); shots.push({ file, label }) }
  const step = async (n, name, fn) => { try { const d = await fn(); record(n, name, true, d || '') } catch (e) { record(n, name, false, String(e && e.message || e)); for (const p of R.browser ? await R.browser.pages() : []) { try { await p.screenshot({ path: resolve(shotsDir, `reale-ko-${n}-${(await p.evaluate(() => innerWidth))}.png`) }) } catch {} } } }
  const M = F.M, S = F.S
  const itemByName = (w, name) => w.menus.flatMap(m => m.sections.flatMap(s => s.items.map(i => ({ ...i, sectionId: s.id, menuId: m.id })))).find(i => i.name === name)
  const docNow = async () => (await owner.call('GET', '/api/menu-workspace')).json
  const pubNow = async () => (await row(R)).published

  // ─ Desktop ─
  const page = await R.browser.newPage()
  page.__errors = []; page.on('pageerror', e => page.__errors.push('desktop: ' + e.message)); page.on('console', m => { if (m.type() === 'error') page.__errors.push('desktop console: ' + m.text()) }); page.on('dialog', d => d.accept())
  page.on('response', r => { const u = new URL(r.url()); if (u.pathname === '/api/menu-workspace/pdf') pdfLog.push({ status: r.status(), at: Date.now(), type: r.headers()['content-type'] }); if (r.status() >= 400) notes.push(r.status() + ' ' + r.request().method() + ' ' + u.pathname) })
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
  const cdp = await page.createCDPSession(); await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {})
  await page.evaluateOnNewDocument(TAP)
  const recorder = await page.screencast({ path: resolve(videoDir, 'flusso-reale-desktop.webm'), ffmpegPath: '/opt/homebrew/bin/ffmpeg' })
  const priceDish = itemByName(F, 'Burrata'), botDish = itemByName(F, 'Cotoletta')

  await step(1, 'Login titolare → Piatti: menu al centro, PDF del pubblicato a destra, «Pubblicato»', async () => {
    await page.goto(R.base + '/staff/index.html', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[type=email]', { timeout: 20000 })
    await page.type('input[type=email]', R.owner.email); await page.type('input[type=password]', R.owner.password); await page.keyboard.press('Enter')
    await page.waitForSelector('.mw-ed-stage', { timeout: 20000 })
    await tapFrame(page)
    if (await page.$('.mw-catalog-list')) throw new Error('vecchia lista al centro')
    await waitFor(() => frameDoc(page), 15000, 'documento nell\'iframe')
    const f = await frameOf(page); await f.waitForSelector(`[data-edit-id="${priceDish.id}"]`, { timeout: 15000 })
    await waitFor(async () => /^Pubblicato/.test(await status(page)), 8000, 'stato Pubblicato')
    const pdfOk = await page.waitForSelector('.mw-ed-pdf .mw-pdf-viewer canvas, .mw-ed-pdf .mw-pdf-viewer', { timeout: 20000 }).then(() => true).catch(() => false)
    const pdfServer = pdfLog.find(x => x.status === 200 && /pdf/.test(x.type || ''))
    await shot(page, 'reale-desktop-01-apri.png', 'Login vero → Piatti: menu vero al centro, PDF pubblicato a destra, «Pubblicato»')
    if (!pdfOk || !pdfServer) throw new Error('PDF non mostrato (risposte /pdf: ' + JSON.stringify(pdfLog) + ')')
    return `stato «${await status(page)}», PDF dal server ${pdfServer.status} ${pdfServer.type}, ${F.dishCount} piatti nel fixture`
  })

  await step(2, 'Tocco piatto → riquadro + matita → prezzo nel pannello → bozza ≠ pubblicato sul server', async () => {
    await frameClick(page, `[data-edit-id="${priceDish.id}"]`)
    const st = await waitFor(async () => { const x = await selectionState(page); return x.pencil && x.last?.id === priceDish.id ? x : null }, 6000, 'selezione + matita')
    await shot(page, 'reale-desktop-02-selezione.png', 'Tocco su «Burrata»: riquadro e matita')
    await frameClick(page, '[data-edit-pencil]')
    await page.waitForSelector('.mw-ed-popover [data-ed-price="1"]', { timeout: 6000 })
    await typeIn(page, '.mw-ed-popover [data-ed-price="1"]', '11,50'); await page.keyboard.press('Enter')
    await waitFor(async () => /Modifiche non pubblicate/.test(await status(page)), 8000, 'stato «Modifiche non pubblicate»')
    await shot(page, 'reale-desktop-03-prezzo.png', 'Prezzo cambiato nel pop-over → «Modifiche non pubblicate»')
    const g = await docNow(), pub = await pubNow()
    const d = findItem(g.data, priceDish.id).price, p = findItem(pub, priceDish.id).price
    if (d !== 11.5 || p !== 9 || g.pending !== true) throw new Error(`bozza ${d}, pubblicato ${p}, pending ${g.pending}`)
    await page.keyboard.press('Escape'); await wait(300)
    return `matita «${st.pencil}»; GET /api/menu-workspace: bozza ${d}, pubblicato ${p}, pending=${g.pending}`
  })

  let newDishId = null, newSubId = null
  await step(3, '«+» → Piatto in una Sezione figlia e «+» → Sottomenu (nascosto): compaiono, server coerente', async () => {
    // Pagina «Primi» (Sottomenu con Sezioni figlie), selezione su un piatto di «Pasta fresca» → genitore preselezionato
    await frameClick(page, `[data-edit-kind="submenu"][data-edit-id="${S.primi}"]`)
    const tag = itemByName(F, 'Tagliatelle al ragù'); await frameClick(page, `[data-edit-id="${tag.id}"]`)
    await waitFor(async () => (await selectionState(page)).last?.id === tag.id, 5000, 'selezione Tagliatelle')
    await clickText(page, 'Aggiungi sottomenu o piatto'); await page.waitForSelector('.mw-create-kind')
    const kinds = await page.$$eval('.mw-create-kind button', b => b.map(x => x.textContent.trim()))
    await clickText(page, 'Piatto').catch(() => {})
    await typeIn(page, 'input[aria-label="Nome piatto"]', 'Fettuccine QA'); await shot(page, 'reale-desktop-04-piu-piatto.png', '«+» → Piatto con genitore preselezionato'); await clickText(page, 'Salva')
    const created = await waitFor(async () => itemByName((await docNow()).data, 'Fettuccine QA'), 8000, 'piatto creato sul server')
    newDishId = created.id
    await page.waitForFunction(() => !document.querySelector('.mw-create-kind'), { timeout: 6000 }).catch(() => {})
    await clickText(page, 'Aggiungi sottomenu o piatto'); await page.waitForSelector('.mw-create-kind'); await clickText(page, 'Sottomenu')
    await typeIn(page, 'input[aria-label="Nome del sottomenu"]', 'Specialità QA'); await clickText(page, 'Salva')
    const sub = await waitFor(async () => (await docNow()).data.menus.flatMap(m => m.sections.map(s => ({ ...s, menuId: m.id }))).find(s => s.name === 'Specialità QA'), 8000, 'sottomenu creato sul server')
    newSubId = sub.id
    await page.waitForFunction(() => !document.querySelector('.mw-create-kind'), { timeout: 6000 }).catch(() => {})
    const f = await frameOf(page)
    const inDom = await waitFor(() => f.evaluate((a, b) => { const d = document.querySelector(`[data-edit-id="${a}"],[data-edit-select="item:${a}"]`); const s = document.querySelector(`[data-edit-id="${b}"],[data-edit-select="section:${b}"]`); return d && s ? { dish: true, subState: s.getAttribute('data-edit-state') || s.closest('[data-edit-state]')?.getAttribute('data-edit-state') || null, dishState: d.getAttribute('data-edit-state') } : null }, newDishId, newSubId), 8000, 'piatto e sottomenu nel DOM dell\'iframe').catch(e => ({ error: e.message }))
    await shot(page, 'reale-desktop-05-creati.png', 'Piatto «Fettuccine QA» e Sottomenu «Specialità QA» creati')
    const pub = await pubNow()
    const problems = []
    if (created.sectionId !== S.pasta) problems.push('piatto creato in ' + (findSection(F, created.sectionId)?.name || created.sectionId) + ' invece di «Pasta fresca»')
    if (sub.active !== false) problems.push('Sottomenu non nascosto (active=' + sub.active + ')')
    if (sub.parentSectionId) problems.push('Sottomenu con genitore')
    if (findItem(pub, newDishId) || findSection(pub, newSubId)) problems.push('creati finiti nel pubblicato')
    if (inDom.error) problems.push('DOM iframe: ' + inDom.error)
    else if (!['hidden', 'inactive'].includes(inDom.subState)) problems.push('Sottomenu nel DOM senza stato attenuato (' + inDom.subState + ')')
    if (problems.length) throw new Error(problems.join('; '))
    return `scelte «+»: ${kinds.join('/')}; piatto in «Pasta fresca» (hidden=${created.hidden}), Sottomenu nascosto; DOM ${JSON.stringify(inDom)}; pubblicato intatto`
  })

  await step(4, 'Rilascio simulato: move piatto in altra Sezione + reorder Sottomenu con fotografia dell’ordine nel rilascio del Sottomenu → DOM == SPA == server, manualOrder', async () => {
    const f = await frameOf(page)
    const base = strip(await frameDoc(page))
    const menuOrder = await f.evaluate(() => [...document.querySelectorAll('[data-edit-kind="menu"]')].map(e => e.getAttribute('data-edit-id')))
    const roots = base.menus.find(m => m.id === M.pranzo).sections.filter(s => !s.parentSectionId).map(s => s.id)
    const snapshot = R.menuOps.manualOrderSnapshot(base, { menuOrder, sectionOrder: { [M.pranzo]: roots } })
    if (!snapshot.some(o => o.op === 'manualOrder' || o.fields?.manualOrder === true || o.kind === 'design')) notes.push('snapshot senza op manualOrder esplicita: ' + JSON.stringify(snapshot.map(o => o.op + ':' + (o.kind || ''))))
    await fromFrame(page, { type: 'tako-menu-edit-mode', editing: true }); await page.waitForSelector('.mw-ed-done', { timeout: 4000 })
    // Protocollo dopo la revisione (22/10): niente op provvisorie; la fotografia viaggia insieme al primo rilascio di un Sottomenu,
    // e solo se il documento non è già manuale (lo scenario 3 crea un Sottomenu, che lo rende già manuale).
    const alreadyManual = base.design?.manualOrder === true
    if (!alreadyManual && (await docNow()).data.design.manualOrder !== undefined) throw new Error('ordine manuale scritto prima del rilascio')
    const snapOps = alreadyManual ? [] : snapshot
    const afterSnap = R.menuOps.applyOps(base, snapOps).workspace
    const carbonara = itemByName(F, 'Carbonara'), firstRisotto = itemByName(F, 'Risotto ai funghi')
    const move = { op: 'move', kind: 'item', id: carbonara.id, toParentId: S.risotti, at: { beforeId: firstRisotto.id } }
    const afterMove = R.menuOps.applyOps(afterSnap, [move]).workspace
    const reorder = R.menuOps.dropToOps(afterMove, { id: S.dolci, kind: 'submenu', fromGroup: 'pills:' + M.pranzo, toGroup: 'pills:' + M.pranzo, toIndex: 0 })
    await fromFrame(page, { type: 'tako-menu-edit-ops', seq: 102, ops: [move] })
    await fromFrame(page, { type: 'tako-menu-edit-ops', seq: 103, ops: [...snapOps, ...reorder] })
    await shot(page, 'reale-desktop-06-tremolio.png', 'Modalità tremolio, «Fine» in testata, rilascio applicato')
    await clickText(page, 'Fine'); await fromFrame(page, { type: 'tako-menu-edit-mode', editing: false })
    const g = await waitFor(async () => { const x = await docNow(); return x.data.design.manualOrder === true && x.data.menus.find(m => m.id === M.pranzo).sections.find(s => !s.parentSectionId)?.id === S.dolci ? x : null }, 10000, 'bozza del server con manualOrder e Dolci in testa')
    await waitFor(async () => canon(strip(await frameDoc(page))) === canon(g.data), 10000, 'documento SPA == bozza server')
    const expected = R.menuOps.applyOps(afterMove, reorder).workspace
    const serverRoots = g.data.menus.find(m => m.id === M.pranzo).sections.filter(s => !s.parentSectionId).map(s => s.id)
    const expectedRoots = expected.menus.find(m => m.id === M.pranzo).sections.filter(s => !s.parentSectionId).map(s => s.id)
    await wait(600)
    const domPills = await f.evaluate(mid => [...document.querySelectorAll(`[data-edit-group="pills:${mid}"]`)].map(e => e.getAttribute('data-edit-id')), M.pranzo)
    // Pagina «Primi»: ordine dei piatti di «Risotti» nel DOM
    await frameClick(page, `[data-edit-kind="submenu"][data-edit-id="${S.primi}"]`)
    await page.keyboard.press('Escape')
    const domRisotti = await waitFor(() => f.evaluate(sid => { const c = document.querySelector(`[data-edit-group-id="items:${sid}"]`); return c ? [...c.querySelectorAll(`[data-edit-group="items:${sid}"]`)].map(e => e.getAttribute('data-edit-id')) : null }, S.risotti), 6000, 'contenitore Risotti nel DOM')
    const serverRisotti = g.data.menus.find(m => m.id === M.pranzo).sections.find(s => s.id === S.risotti).items.map(i => i.id)
    const spaDoc = strip(await frameDoc(page))
    const spaRoots = spaDoc.menus.find(m => m.id === M.pranzo).sections.filter(s => !s.parentSectionId).map(s => s.id)
    const pub = await pubNow()
    await shot(page, 'reale-desktop-07-ordine.png', 'Dopo il rilascio: Dolci primo Sottomenu, Carbonara dentro Risotti')
    const problems = []
    if (canon(serverRoots) !== canon(expectedRoots)) problems.push('radici server ≠ attese')
    if (canon(domPills) !== canon(serverRoots)) problems.push('pillole DOM ' + domPills.map(x => findSection(F, x)?.name || x).join(',') + ' ≠ server ' + serverRoots.map(x => findSection(F, x)?.name || x).join(','))
    if (canon(spaRoots) !== canon(serverRoots)) problems.push('SPA ≠ server (radici)')
    if (canon(domRisotti) !== canon(serverRisotti)) problems.push('piatti Risotti DOM ≠ server')
    if (serverRisotti[0] !== carbonara.id) problems.push('Carbonara non in testa a Risotti')
    if (pub.design.manualOrder !== undefined) problems.push('manualOrder finito nel pubblicato')
    if (problems.length) throw new Error(problems.join('; '))
    return `pillole DOM = SPA = server (${serverRoots.map(x => findSection(g.data, x)?.name).join(' › ')}); Risotti: ${serverRisotti.map(x => findItem(g.data, x)?.name).join(', ')}; design.manualOrder=true solo in bozza`
  })

  await step(5, 'Bot WhatsApp con bozza pendente (applyBotChange): pubblicato solo bot, bozza entrambe, notifica ≤ 6 s', async () => {
    const before = await row(R)
    const view = await R.bot.readBotWorkspace(RESTAURANT_ID)
    const next = structuredClone(R.contract.workspaceSchema.parse(view.draft))
    for (const m of next.menus) for (const s of m.sections) for (const i of s.items) if (i.id === botDish.id) i.price = 17
    const t0 = Date.now()
    const res = await R.bot.applyBotChange(RESTAURANT_ID, R.owner.id, ['WhatsApp: aggiornamento automatico', 'WhatsApp: pubblicazione automatica'], { expectedPublishedRevision: view.revision, next: R.contract.workspaceSchema.parse(next) })
    const after = await row(R)
    const problems = []
    if (findItem(after.published, botDish.id).price !== 17) problems.push('pubblicato senza la modifica del bot')
    if (findItem(after.published, priceDish.id).price !== 9) problems.push('pubblicato con la modifica della bozza (Burrata ' + findItem(after.published, priceDish.id).price + ')')
    if (after.published.design.manualOrder !== undefined) problems.push('ordine manuale della bozza finito nel pubblicato')
    if (findItem(after.draft, botDish.id).price !== 17) problems.push('bozza senza la modifica del bot')
    if (findItem(after.draft, priceDish.id).price !== 11.5) problems.push('bozza ha perso il prezzo della dashboard')
    if (after.draft.design.manualOrder !== true || !findItem(after.draft, newDishId)) problems.push('bozza ha perso ordine manuale o piatto creato')
    if (findItem(after.published, newDishId) || findSection(after.published, newSubId)) problems.push('piatto/Sottomenu creati in bozza finiti nel pubblicato')
    const carb = itemByName(F, 'Carbonara')
    if (findItem(after.published, carb.id).sectionId !== S.primi) problems.push('spostamento della bozza finito nel pubblicato')
    if (findItem(after.draft, carb.id).sectionId !== S.risotti) problems.push('bozza ha perso lo spostamento di Carbonara')
    if (!after.pending) problems.push('bozza non più pendente')
    const toast = await page.waitForFunction(() => /Aggiornato da WhatsApp/.test(document.querySelector('.mw-live-toast-text')?.textContent || ''), { timeout: 6500 }).then(() => Date.now() - t0).catch(() => null)
    if (toast == null) problems.push('nessuna notifica «Aggiornato da WhatsApp» entro 6,5 s')
    await shot(page, 'reale-desktop-08-whatsapp.png', 'Bot WhatsApp con bozza pendente: notifica, bozza conservata')
    await waitFor(async () => { const d = strip(await frameDoc(page)); return d && findItem(d, botDish.id)?.price === 17 && findItem(d, priceDish.id)?.price === 11.5 }, 8000, 'SPA con bozza + modifica del bot').catch(e => problems.push(e.message))
    if (!/Modifiche non pubblicate/.test(await status(page))) problems.push('stato dashboard «' + await status(page) + '»')
    if (problems.length) throw new Error(problems.join('; '))
    return `revisioni ${before.revision}/${before.published_revision} → ${after.revision}/${after.published_revision} (partial=${res.partial}); notifica dopo ${toast} ms; stato «${await status(page)}»`
  })

  await step(6, '«Pubblica» → riepilogo → «Pubblica ora»: pubblicato == bozza, «Pubblicato», PDF rigenerato', async () => {
    const pdfBefore = pdfLog.length
    await clickText(page, 'Pubblica'); await page.waitForSelector('dialog.mw-ed-publish[open] .mw-diff', { timeout: 8000 })
    const diffText = await page.$eval('dialog.mw-ed-publish[open] .mw-diff', e => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 300))
    await shot(page, 'reale-desktop-09-pubblica.png', 'Riepilogo Pubblica dal server vero')
    await clickText(page, 'Pubblica ora')
    await waitFor(async () => !(await row(R)).pending, 10000, 'bozza == pubblicato sul server')
    await waitFor(async () => /^Pubblicato/.test(await status(page)), 8000, 'stato Pubblicato')
    const r = await row(R)
    if (findItem(r.published, priceDish.id).price !== 11.5 || r.published.design.manualOrder !== true) throw new Error('pubblicato senza le modifiche della bozza')
    const regenerated = await waitFor(() => pdfLog.slice(pdfBefore).find(x => x.status === 200), 12000, 'PDF rigenerato').catch(() => null)
    await wait(800); await shot(page, 'reale-desktop-10-pubblicato.png', 'Pubblicato: stato e PDF aggiornato')
    if (!regenerated) throw new Error('PDF non rigenerato dopo Pubblica (risposte: ' + JSON.stringify(pdfLog.slice(pdfBefore)) + ')')
    return `riepilogo: «${diffText.slice(0, 140)}…»; revisione ${r.revision}=${r.published_revision}; PDF rigenerato (${regenerated.status})`
  })

  await step(7, '«Scarta le modifiche» dopo una nuova modifica → bozza == pubblicato', async () => {
    const tira = itemByName(F, 'Tiramisù')
    await fromFrame(page, { type: 'tako-menu-edit-ops', seq: 104, ops: [{ op: 'set', kind: 'item', id: tira.id, fields: { price: 7.5 } }] })
    await waitFor(async () => (await row(R)).pending, 8000, 'bozza pendente')
    await waitFor(async () => /Modifiche non pubblicate/.test(await status(page)), 8000, 'stato non pubblicato')
    await clickText(page, 'Pubblica'); await page.waitForSelector('dialog.mw-ed-publish[open] .mw-diff', { timeout: 8000 }); await clickText(page, 'Scarta le modifiche')
    await waitFor(async () => !(await row(R)).pending, 10000, 'scartato sul server')
    await waitFor(async () => /^Pubblicato/.test(await status(page)), 8000, 'stato Pubblicato')
    const r = await row(R); await waitFor(async () => canon(strip(await frameDoc(page))) === canon((await docNow()).data), 8000, 'SPA == server')
    if (findItem(r.draft, tira.id).price !== 6) throw new Error('prezzo non tornato a 6')
    const [v] = await R.sql`SELECT count(*)::int n FROM menu_workspace_versions WHERE restaurant_id=${RESTAURANT_ID} AND label='Bozza scartata'`
    await shot(page, 'reale-desktop-11-scartato.png', 'Scarta le modifiche → Pubblicato')
    return `bozza == pubblicato, Tiramisù 6; versioni «Bozza scartata»: ${v.n}`
  })
  await recorder.stop().catch(e => notes.push('screencast: ' + e.message))
  const desktopErrors = page.__errors.filter(e => !/Failed to load resource/.test(e))
  await page.close()

  await step(8, 'Flag spento → schermata «Menu di oggi» (vecchia lista), nessun errore console', async () => {
    await R.sql`UPDATE restaurants SET settings = settings || '{"dashboardEditor":false}'::jsonb WHERE id=${RESTAURANT_ID}`
    const off = await R.browser.newPage(); const errs = []
    off.on('pageerror', e => errs.push(e.message)); off.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
    await off.setViewport({ width: 1280, height: 900 }); await off.goto(R.base + '/staff/index.html', { waitUntil: 'domcontentloaded' })
    await off.waitForSelector('.mw-catalog-list', { timeout: 20000 }); await wait(1500)
    const stage = await off.$('.mw-ed-stage'), adv = await off.$('.mw-ed-advanced')
    await shot(off, 'reale-desktop-12-flag-spento.png', 'Flag spento: schermata Menu di oggi'); await off.close()
    await R.sql`UPDATE restaurants SET settings = settings || '{"dashboardEditor":true}'::jsonb WHERE id=${RESTAURANT_ID}`
    const real = errs.filter(e => !/Failed to load resource/.test(e))
    if (stage || adv) throw new Error('editor visibile con flag spento')
    if (real.length) throw new Error('errori console: ' + real.join(' | '))
    return 'lista di oggi, nessun .mw-ed-*; console pulita' + (errs.length ? ` (solo risorse: ${errs.length})` : '')
  })

  await step(9, 'Mobile 390: apri, seleziona, matita = foglio dal basso, Pubblica in testata', async () => {
    const m = await R.browser.newPage(); const errs = []; m.on('pageerror', e => errs.push(e.message)); m.on('dialog', d => d.accept())
    await m.evaluateOnNewDocument(TAP); await m.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })
    await m.goto(R.base + '/staff/index.html', { waitUntil: 'domcontentloaded' })
    await m.waitForSelector('.mw-ed-stage', { timeout: 20000 }); await tapFrame(m); await waitFor(() => frameDoc(m), 15000, 'documento nell\'iframe')
    await shot(m, 'reale-mobile-01-apri.png', 'Telefono 390: menu vero a pagina intera')
    const dishM = itemByName(F, 'Bruschetta al pomodoro')
    await frameClick(m, `[data-edit-kind="submenu"][data-edit-id="${S.antipasti}"]`, { tap: true }).catch(() => {})
    await frameClick(m, `[data-edit-id="${dishM.id}"]`, { tap: true })
    await waitFor(async () => { const x = await selectionState(m); return x.pencil && x.last?.id === dishM.id }, 6000, 'selezione + matita (tocco)')
    await shot(m, 'reale-mobile-02-selezione.png', 'Tocco: riquadro + matita')
    await frameClick(m, '[data-edit-pencil]', { tap: true })
    await m.waitForSelector('dialog.mw-drawer[open]', { timeout: 6000 })
    const sheet = await m.$eval('dialog.mw-drawer[open]', e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight } })
    await shot(m, 'reale-mobile-03-foglio.png', 'Matita: foglio dal basso')
    await typeIn(m, 'dialog.mw-drawer[open] [data-ed-price="1"]', '6,50'); await m.keyboard.press('Enter')
    await waitFor(async () => findItem((await docNow()).data, dishM.id).price === 6.5, 8000, 'prezzo dal telefono sul server')
    await m.$eval('dialog.mw-drawer[open] .mw-sheet-close', e => e.click()).catch(() => m.keyboard.press('Escape')); await wait(600)
    const scrolled = await m.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.offsetParent !== null && x.textContent.trim() === 'Pubblica'); const r = b?.getBoundingClientRect(); return r ? Math.round(r.top) : null })
    await m.evaluate(() => { scrollTo(0, 0); for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0 }); await wait(300)
    const head = await m.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.offsetParent !== null && x.textContent.trim() === 'Pubblica'); if (!b) return null; const r = b.getBoundingClientRect(); return { top: Math.round(r.top), disabled: b.disabled } })
    await shot(m, 'reale-mobile-04-pubblica.png', 'Pubblica in testata (telefono)')
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth + 0.5)
    await m.close()
    const problems = []
    if (!head || head.top < 0 || head.top > 160) problems.push('«Pubblica» non in testata (' + JSON.stringify(head) + ')')
    if (sheet.bottom < sheet.h - 2 || sheet.top < 40) problems.push('foglio non ancorato in basso ' + JSON.stringify(sheet))
    if (overflow) problems.push('scroll orizzontale')
    if (errs.length) problems.push('errori: ' + errs.join(' | '))
    if (problems.length) throw new Error(problems.join('; '))
    if (scrolled != null && scrolled < 0) notes.push(`mobile: con il menu scorso «Pubblica» esce dallo schermo (y=${scrolled}): la testata non resta fissa`)
    return `foglio ${JSON.stringify(sheet)}, Pubblica in testata a y=${head.top} (a pagina scorsa y=${scrolled}); prezzo salvato dal telefono (6,5)`
  })

  await step(10, 'Ruolo cameriere (dipendente): rotte /ops, /status, /discard, /publish → 403', async () => {
    const staff = apiClient(R.base); await staff.login(R.staff.email, R.staff.password)
    const before = await row(R)
    const codes = {
      ops: (await staff.call('POST', '/api/menu-workspace/ops', { ops: [{ op: 'set', kind: 'item', id: priceDish.id, fields: { price: 1 } }], clientId: 'qa', seq: 1 })).status,
      status: (await staff.call('GET', '/api/menu-workspace/status')).status,
      discard: (await staff.call('POST', '/api/menu-workspace/discard', { expectedRevision: before.revision })).status,
      publish: (await staff.call('POST', '/api/menu-workspace/publish', { expectedRevision: before.revision })).status,
      workspace: (await staff.call('GET', '/api/menu-workspace')).status,
    }
    const after = await row(R)
    if (Object.values(codes).some(c => c !== 403)) throw new Error('codici ' + JSON.stringify(codes))
    if (after.revision !== before.revision) throw new Error('scrittura avvenuta')
    return JSON.stringify(codes)
  })

  if (desktopErrors.length) record(11, 'Errori nel browser (desktop)', false, desktopErrors.slice(0, 8).join(' | '))
  else record(11, 'Nessun errore JavaScript nel browser (desktop)', true)
  const out = { ambito: 'Server Fastify VERO (startServer, TAKO_MODE=web, login vero) + Postgres embedded isolato (migrazioni vere + menu-day-presets.sql) + SPA compilata + renderer vero (esbuild) via proxy locale; bot = applyBotChange sullo stesso DB; Chrome headless 1280 e 390 emulato', data: new Date().toISOString(), locale: RESTAURANT_ID + ' (finto)', piatti: F.dishCount, risultati: results, risposteHttpErrore: [...new Set(notes)], screenshot: shots, video: ['video/flusso-reale-desktop.webm'] }
  await writeFile(resolve(shotsDir, 'verifica-reale.json'), JSON.stringify(out, null, 1))
  const ko = results.filter(r => !r.ok)
  console.log(JSON.stringify({ ok: !ko.length, scenari: results.length, ko: ko.map(r => r.n) }))
  if (ko.length) process.exitCode = 1
}

async function main() {
  await mkdir(shotsDir, { recursive: true }); await mkdir(videoDir, { recursive: true })
  const R = await startReal()
  try {
    const owner = apiClient(R.base); await owner.login(R.owner.email, R.owner.password)
    const F = await seed(R, owner)
    await scenarios(R, F, owner)
  } finally { await R.close() }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { await main() } catch (e) { console.error(e); process.exitCode = 1 } finally { setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref() } }
