// Gesto su tocco reale CDP (Chromium mobile emulato, iframe scalato 0,65): pressione con tremolio ±6 px, scroll, tap,
// pointercancel/scroll/mouse sintetici durante l'attesa, trascinamento e rilascio. Uso: node tests/web/gesture-touch/run.mjs
import { build } from 'esbuild'; import http from 'node:http'; import { readFileSync } from 'node:fs'; import { resolve, dirname } from 'node:path'; import { fileURLToPath } from 'node:url'; import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'
const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../../..')
const js = (await build({ entryPoints: [resolve(here, 'harness-entry.ts')], bundle: true, write: false, format: 'iife', target: 'es2020' })).outputFiles[0].text
const files = { '/outer.html': readFileSync(resolve(here, 'outer.html')), '/inner.html': readFileSync(resolve(here, 'inner.html')), '/edit.css': readFileSync(resolve(repo, 'apps/web/src/components/menu-edit/edit.css')), '/harness.js': js }
const server = http.createServer((q, r) => { const p = q.url.split('?')[0], b = files[p]; if (!b) { r.writeHead(404); return r.end() } r.writeHead(200, { 'content-type': p.endsWith('.css') ? 'text/css' : p.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(b) }).listen(0)
const port = server.address().port
const exe = process.env.CHROME || `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell`
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-first-run', '--window-size=390,700'] })
const results = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function fresh(q = '') {
  const page = await browser.newPage()
  await page.emulate({ viewport: { width: 390, height: 700, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })
  await page.goto(`http://127.0.0.1:${port}/outer.html${q}`); await page.waitForFunction(() => document.getElementById('f').contentWindow.__gesture)
  const frame = page.frames().find(f => f.url().includes('inner.html')), cdp = await page.createCDPSession()
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] })
  // centro di un elemento nell'iframe → coordinate della pagina esterna (scala 0,65)
  const at = async sel => frame.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: (r.left + r.width / 2) * .65, y: (r.top + r.height / 2) * .65 } }, sel)
  const log = () => frame.evaluate(() => window.__log)
  return { page, frame, touch, at, log, cdp }
}
async function hold(t, p, ms, tremor = 6) { await t.touch('touchStart', p.x, p.y); const t0 = Date.now(); let k = 0; while (Date.now() - t0 < ms) { await sleep(40); k++; await t.touch('touchMove', p.x + (k % 2 ? tremor : -tremor), p.y + (k % 3 ? tremor / 2 : -tremor)) } }
async function run(name, fn) { try { await fn(); results.push(['OK', name]) } catch (e) { results.push(['FAIL', name, e.message]) } }

await run('pressione 1 s con tremolio ±6 px sul piatto (bottone disattivato + immagine) → si solleva; trascina in altra Sezione → onDrop', async () => {
  const t = await fresh(), p = await t.at('[data-edit-id="s1-d1"] h3')
  await hold(t, p, 1150)
  let l = await t.log(); assert.ok(l.some(e => e[0] === 'mode' && e[1] === true), 'nessun sollevamento: ' + JSON.stringify(l.filter(e => e[0] === 'dbg').slice(-3)))
  assert.ok(await t.frame.evaluate(() => !!document.querySelector('[data-menu-gesture-ghost]')), 'ghost assente')
  const target = await t.at('[data-edit-id="s2-d2"]')
  for (let k = 1; k <= 20; k++) { await t.touch('touchMove', p.x, p.y + (target.y - p.y) * k / 20); await sleep(25) }
  await t.touch('touchEnd'); await sleep(100)
  l = await t.log(); const drop = l.find(e => e[0] === 'drop'); assert.ok(drop, 'nessun onDrop'); assert.equal(drop[1].toGroup, 'items:s2'); assert.equal(drop[1].fromGroup, 'items:s1')
  await sleep(1300); assert.equal(await t.frame.evaluate(() => document.querySelectorAll('[data-menu-gesture-ghost]').length), 0, 'ghost rimasto')
  await t.page.close()
})
await run('pressione sul Sottomenu (pillola) con tremolio → si solleva', async () => {
  const t = await fresh(), p = await t.at('[data-edit-id="p2"]')
  await hold(t, p, 1150); const l = await t.log(); await t.touch('touchEnd')
  assert.ok(l.some(e => e[0] === 'mode' && e[1] === true), JSON.stringify(l.slice(-3))); await t.page.close()
})
await run('scorrimento veloce che parte su un piatto → scorre, nessun sollevamento', async () => {
  const t = await fresh(), p = await t.at('[data-edit-id="s1-d3"]')
  await t.touch('touchStart', p.x, p.y); for (let k = 1; k <= 8; k++) { await t.touch('touchMove', p.x, p.y - k * 30); await sleep(16) } await t.touch('touchEnd'); await sleep(1200)
  const l = await t.log(), y = await t.frame.evaluate(() => scrollY)
  assert.ok(!l.some(e => e[0] === 'mode'), 'sollevato durante lo scroll'); assert.ok(y > 50, 'non ha scorso: scrollY=' + y); await t.page.close()
})
await run('tocco breve → onTap, nessun sollevamento', async () => {
  const t = await fresh(), p = await t.at('[data-edit-id="s1-d0"]')
  await t.touch('touchStart', p.x, p.y); await sleep(80); await t.touch('touchEnd'); await sleep(1200)
  const l = await t.log(); assert.ok(l.some(e => e[0] === 'tap' && e[1] === 's1-d0')); assert.ok(!l.some(e => e[0] === 'mode')); await t.page.close()
})
await run('durante l\'attesa: pointercancel, scroll, mousedown/click, resize di sola altezza sintetici → si solleva comunque', async () => {
  const t = await fresh(), p = await t.at('[data-edit-id="s2-d1"]')
  await t.touch('touchStart', p.x, p.y); await sleep(200)
  await t.frame.evaluate(() => { const el = document.querySelector('[data-edit-id="s2-d1"] h3'); el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerType: 'touch', pointerId: 2, isPrimary: true })); window.scrollBy(0, 3); document.dispatchEvent(new Event('scroll')); el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); window.dispatchEvent(new Event('resize')) })
  await sleep(950); const l = await t.log(); await t.touch('touchEnd')
  assert.ok(l.some(e => e[0] === 'mode' && e[1] === true), JSON.stringify(l.filter(e => e[0] === 'dbg'))); await t.page.close()
})
const touch2 = (t, type, pts) => t.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(q => ({ radiusX: 8, radiusY: 8, force: 1, ...q })) })
await run('enterEditMode («Sposta») → tremolio senza pressione; dito fermo non solleva; 8 px reali → sollevato SUBITO; piatto in stessa Sezione e in altra Sezione → onDrop', async () => {
  const t = await fresh()
  await t.frame.evaluate(() => window.__gesture.enterEditMode()); await sleep(100)
  let l = await t.log(); assert.deepEqual(l.filter(e => e[0] === 'mode').map(e => e[1]), [true])
  const p = await t.at('[data-edit-id="s1-d1"] h3'); await t.touch('touchStart', p.x, p.y); await sleep(250)
  assert.equal(await t.frame.evaluate(() => !!document.querySelector('[data-menu-gesture-ghost]')), false, 'sollevato senza movimento')
  const t0 = Date.now(); await t.touch('touchMove', p.x, p.y + 8)
  assert.ok(await t.frame.evaluate(() => !!document.querySelector('[data-menu-gesture-ghost]')), 'non sollevato dopo 8 px'); assert.ok(Date.now() - t0 < 300)
  const q = await t.at('[data-edit-id="s1-d4"]')
  for (let k = 1; k <= 12; k++) { await t.touch('touchMove', p.x, p.y + 8 + (q.y - p.y) * k / 12); await sleep(25) }
  await t.touch('touchEnd'); await sleep(150)
  l = await t.log(); let drop = l.filter(e => e[0] === 'drop').pop(); assert.ok(drop, 'nessun onDrop stessa Sezione'); assert.equal(drop[1].toGroup, 'items:s1'); assert.equal(drop[1].kind, 'dish')
  await sleep(1000)
  const a = await t.at('[data-edit-id="s2-d0"] h3'), b = await t.at('[data-edit-id="s3-d1"]')
  await t.touch('touchStart', a.x, a.y); await sleep(40)
  for (let k = 1; k <= 24; k++) { await t.touch('touchMove', a.x, a.y + (b.y - a.y) * k / 24); await sleep(25) }
  await t.touch('touchEnd'); await sleep(150)
  l = await t.log(); drop = l.filter(e => e[0] === 'drop').pop(); assert.equal(drop[1].id, 's2-d0'); assert.equal(drop[1].toGroup, 'items:s3')
  await sleep(1000); assert.deepEqual((await t.log()).filter(e => e[0] === 'mode').map(e => e[1]), [true], 'uscito dal tremolio')
  await t.page.close()
})
await run('tremolio: Sottomenu (pillola) si sposta col solo movimento', async () => {
  const t = await fresh(); await t.frame.evaluate(() => window.__gesture.enterEditMode()); await sleep(80)
  const p = await t.at('[data-edit-id="p0"]'), q = await t.at('[data-edit-id="p2"]')
  await t.touch('touchStart', p.x, p.y); for (let k = 1; k <= 12; k++) { await t.touch('touchMove', p.x + (q.x - p.x + 10) * k / 12, p.y); await sleep(25) } await t.touch('touchEnd'); await sleep(150)
  const drop = (await t.log()).find(e => e[0] === 'drop'); assert.ok(drop, 'nessun drop pillola'); assert.equal(drop[1].kind, 'submenu'); await t.page.close()
})
await run('tremolio: due dita sopra i piatti scorrono la pagina senza sollevare; un dito che scorre su zona vuota non esce; tocco su zona vuota esce', async () => {
  const t = await fresh(); await t.frame.evaluate(() => window.__gesture.enterEditMode()); await sleep(80)
  await t.frame.evaluate(() => { window.__ev = []; for (const k of ['touchstart','touchmove']) document.addEventListener(k, e => window.__ev.push(k + e.touches.length + (e.defaultPrevented ? 'P' : '')), true) })
  const p = await t.at('[data-edit-id="s1-d3"]'), y0 = await t.frame.evaluate(() => scrollY)
  await touch2(t, 'touchStart', [{ x: p.x - 40, y: p.y, id: 1 }]); await sleep(30); await touch2(t, 'touchStart', [{ x: p.x - 40, y: p.y, id: 1 }, { x: p.x + 40, y: p.y, id: 2 }])
  for (let k = 1; k <= 8; k++) { await touch2(t, 'touchMove', [{ x: p.x - 40, y: p.y - k * 15, id: 1 }, { x: p.x + 40, y: p.y - k * 15, id: 2 }]); await sleep(20) }
  await touch2(t, 'touchEnd', []); await sleep(150)
  const y1 = await t.frame.evaluate(() => scrollY); assert.ok(y1 > y0 + 50, `due dita non scorrono: ${y0}→${y1} ` + JSON.stringify(await t.frame.evaluate(() => window.__ev.slice(0, 12))))
  let l = await t.log(); assert.ok(!l.some(e => e[0] === 'drop')); assert.equal(await t.frame.evaluate(() => document.querySelectorAll('[data-menu-gesture-ghost]').length), 0)
  const h = await t.at('[data-edit-select="section:s2"]')
  await t.touch('touchStart', h.x, h.y); for (let k = 1; k <= 6; k++) { await t.touch('touchMove', h.x, h.y - k * 20); await sleep(16) } await t.touch('touchEnd'); await sleep(200)
  l = await t.log(); assert.deepEqual(l.filter(e => e[0] === 'mode').map(e => e[1]), [true], 'scroll su zona vuota è uscito')
  const h2 = await t.at('[data-edit-select="section:s2"]'); await t.touch('touchStart', h2.x, h2.y); await sleep(60); await t.touch('touchEnd'); await sleep(200)
  l = await t.log(); assert.deepEqual(l.filter(e => e[0] === 'mode').map(e => e[1]), [true, false])
  assert.equal(await t.frame.evaluate(() => document.querySelectorAll('[data-menu-gesture-ghost],[style*="opacity: 0"]').length), 0); await t.page.close()
})
await run('pressione lunga resta come scorciatoia; poi exitEditMode (Fine) ripulisce', async () => {
  const t = await fresh(), p = await t.at('[data-edit-id="s1-d1"]')
  await hold(t, p, 1150, 2); await t.touch('touchEnd'); await sleep(1300)
  await t.frame.evaluate(() => window.__gesture.exitEditMode()); await sleep(200)
  const l = await t.log(); assert.deepEqual(l.filter(e => e[0] === 'mode').map(e => e[1]), [true, false])
  assert.equal(await t.frame.evaluate(() => document.querySelectorAll('[data-menu-gesture-ghost],[style*="opacity: 0"]').length), 0); await t.page.close()
})
await run('?gesturedebug=1 sulla pagina padre → pannello diagnosi nell\'iframe; senza parametro assente', async () => {
  const t = await fresh('?gesturedebug=1'), p = await t.at('[data-edit-id="s1-d1"]'); await hold(t, p, 300); await t.touch('touchEnd'); await sleep(100)
  const txt = await t.frame.evaluate(() => document.querySelector('[data-gesture-debug]')?.textContent || '')
  assert.ok(/touchstart/.test(txt) && /pressione annullata: tap|pending/.test(txt), txt.slice(0, 300))
  await t.page.screenshot({ path: process.env.SHOT || '/dev/null' })
  await t.page.close(); const u = await fresh(); assert.equal(await u.frame.evaluate(() => !!document.querySelector('[data-gesture-debug]')), false); await u.page.close()
})
await browser.close(); server.close()
for (const r of results) console.log(r.join(' · '))
process.exit(results.every(r => r[0] === 'OK') ? 0 : 1)
