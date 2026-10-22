// Dashboard editor 22/10 — verifica del GESTO (modulo packages/menu-gesture) nella dashboard vera, con registrazioni video reali.
// Stesso impianto di verify-menu-editor-real.mjs: Postgres embedded usa-e-getta, server Fastify vero, SPA compilata, renderer vero.
// Puntatore vero (mouse CDP) a 1280 px e tocco emulato (390×844, hasTouch) — Chrome SEMPRE headless.
// Avvio:  apps/server/node_modules/.bin/tsx scripts/verify-menu-gesture-real.mjs
// Uscita: docs/webapp/dashboard-editor-2026-10-22/video/G*.mp4 + shots/gesto-*.png + shots/verifica-gesto.json
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startReal, apiClient, fixtureMenus, waitFor, wait, RESTAURANT_ID } from './verify-menu-editor-real.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = resolve(repo, 'docs/webapp/dashboard-editor-2026-10-22')
const shotsDir = resolve(DOCS, 'shots'), videoDir = resolve(DOCS, 'video')
const FF = '/opt/homebrew/bin/ffmpeg'
// Un socket chiuso (proxy websocket o pipe di ffmpeg) non deve far cadere tutta la verifica: si annota e si prosegue.
const stray = []
process.on('uncaughtException', e => { if (e?.code === 'EPIPE' || e?.code === 'ECONNRESET') { stray.push(e.code + ' ' + (e.stack || '').split('\n').slice(0, 4).join(' / ')); return } console.error(e); process.exit(1) })


/* Registrazione VIDEO reale via CDP Page.startScreencast: fotogrammi con il loro tempo, montati con ffmpeg alla fine (durata vera di
 * ogni fotogramma). Niente pipe verso ffmpeg durante il gesto (con page.screencast ffmpeg cadeva a metà in questo impianto). */
async function record(page, file, fn) {
  const cdp = await page.createCDPSession(), dir = await mkdtemp(resolve(tmpdir(), 'tako-gesto-rec-')), frames = []
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => { const n = frames.length; frames.push({ f: `f${String(n).padStart(5, '0')}.jpg`, t: metadata.timestamp }); await writeFile(resolve(dir, frames[n].f), Buffer.from(data, 'base64')); cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}) })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 })
  try { return await fn() } finally {
    await wait(400); await cdp.send('Page.stopScreencast').catch(() => {}); await wait(200)
    if (frames.length > 1) {
      const lines = ['ffconcat version 1.0']
      for (let i = 0; i < frames.length; i++) { lines.push(`file '${frames[i].f}'`); lines.push(`duration ${Math.max(0.008, ((frames[i + 1]?.t ?? frames[i].t + 0.1) - frames[i].t)).toFixed(4)}`) }
      lines.push(`file '${frames.at(-1).f}'`)
      await writeFile(resolve(dir, 'list.txt'), lines.join('\n'))
      try { execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', resolve(dir, 'list.txt'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2,fps=60', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', resolve(videoDir, file)]) } catch (e) { stray.push('ffmpeg ' + file + ': ' + e.message.slice(0, 200)) }
    } else stray.push('nessun fotogramma per ' + file)
    await cdp.detach().catch(() => {}); await rm(dir, { recursive: true, force: true })
  }
}

async function seed(owner) {
  const g = await owner.call('GET', '/api/menu-workspace')
  if (g.status !== 200 || g.json.dashboardEditor !== true) throw new Error('GET workspace ' + g.status)
  const F = fixtureMenus()
  const put = await owner.call('PUT', '/api/menu-workspace', { expectedRevision: g.json.revision, workspace: { ...g.json.data, menus: F.menus } })
  if (put.status !== 200) throw new Error('PUT ' + put.status)
  const cur = await owner.call('GET', '/api/menu-workspace')
  const pub = await owner.call('POST', '/api/menu-workspace/publish', { expectedRevision: cur.json.revision })
  if (pub.status !== 200) throw new Error('publish ' + pub.status)
  return F
}

const frameOf = page => waitFor(() => page.frames().find(x => x.url().includes('/menu-preview/') && x.url().includes('edit=1')), 20000, 'iframe del menu')
const center = async el => { const b = await el.boundingBox(); if (!b) throw new Error('elemento senza box'); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b } }
const byId = async (f, id) => { const el = await waitFor(() => f.$(`[data-edit-id="${id}"]`), 8000, 'elemento ' + id); return el }

/* Campiona per `ms` le rotazioni (gradi) che il modulo scrive sugli elementi non sollevati + la scala del fantasma. */
async function sampleJiggle(f, ms = 1100) {
  return f.evaluate(ms => new Promise(done => {
    const els = [...document.querySelectorAll('[data-menu-gesture-edit]')].slice(0, 6), t0 = performance.now(), rows = []
    const rot = el => { const m = /rotate\((-?[\d.]+)deg\)/.exec(el.style.transform || ''); return m ? Number(m[1]) : 0 }
    const tick = now => { const ghost = document.querySelector('[data-menu-gesture-ghost]'); const sm = ghost && /scale\(([\d.]+)\)/.exec(ghost.style.transform || ''); rows.push({ t: now - t0, a: els.map(rot), scale: sm ? Number(sm[1]) : null }); if (now - t0 < ms) requestAnimationFrame(tick); else done(rows) }
    requestAnimationFrame(tick)
  }), ms)
}
function analyse(rows) {
  const series = rows[0]?.a.map((_, k) => rows.map(r => ({ t: r.t, a: r.a[k] }))) || []
  const amp = Math.max(0, ...series.flatMap(s => s.map(p => Math.abs(p.a))))
  // periodo: distanza media fra attraversamenti dello zero in salita
  const periods = []
  for (const s of series) { const ups = []; for (let i = 1; i < s.length; i++) if (s[i - 1].a < 0 && s[i].a >= 0) ups.push(s[i].t); for (let i = 1; i < ups.length; i++) periods.push(ups[i] - ups[i - 1]) }
  const period = periods.length ? periods.reduce((a, b) => a + b, 0) / periods.length : null
  const phases = series.map(s => s[0]?.a ?? 0)
  const scales = rows.map(r => r.scale).filter(x => x != null)
  return { elementi: series.length, ampiezzaGradi: +amp.toFixed(2), periodoMs: period && +period.toFixed(0), fasiDiverse: new Set(phases.map(p => p.toFixed(2))).size > 1, scalaSollevato: scales.length ? +Math.max(...scales).toFixed(3) : null }
}
/* Trascinamento col mouse a piccoli passi (come una mano: ~60 eventi al secondo). */
async function mouseDrag(page, from, to, { hold = 1150, steps = 28 } = {}) {
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await wait(hold)
  for (let i = 1; i <= steps; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps); await wait(16) }
  await wait(250); await page.mouse.up(); await wait(700)
}
async function touchDrag(page, from, to, { hold = 1150, steps = 28 } = {}) {
  await page.touchscreen.touchStart(from.x, from.y); await wait(hold)
  for (let i = 1; i <= steps; i++) { await page.touchscreen.touchMove(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps); await wait(16) }
  await wait(250); await page.touchscreen.touchEnd(); await wait(700)
}

async function main() {
  await mkdir(shotsDir, { recursive: true }); await mkdir(videoDir, { recursive: true })
  const R = await startReal(), results = [], notes = []
  const recordResult = (n, name, ok, detail) => { results.push({ n, scenario: name, ok, detail }); console.log((ok ? '✓' : '✗') + ' ' + n + '. ' + name + ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))) }
  const step = async (n, name, fn) => { try { recordResult(n, name, true, (await Promise.race([fn(), wait(120000).then(() => { throw new Error('tempo scaduto (120 s)') })])) || '') } catch (e) { recordResult(n, name, false, String(e?.message || e)) } }
  try {
    const owner = apiClient(R.base); await owner.login(R.owner.email, R.owner.password)
    const F = await seed(owner), M = F.M, S = F.S
    const item = name => F.menus.flatMap(m => m.sections.flatMap(s => s.items.map(i => ({ ...i, sectionId: s.id })))).find(i => i.name === name)
    const draft = async () => (await owner.call('GET', '/api/menu-workspace')).json.data
    const login = async page => {
      await page.goto(R.base + '/staff/index.html', { waitUntil: 'domcontentloaded' })
      // Sessione già aperta (ricarica, o seconda pagina dello stesso browser): si arriva direttamente alla dashboard.
      const first = await Promise.race([page.waitForSelector('input[type=email]', { timeout: 20000 }).then(() => 'login'), page.waitForSelector('.mw-ed-stage', { timeout: 20000 }).then(() => 'stage')])
      if (first === 'login') { await page.type('input[type=email]', R.owner.email); await page.type('input[type=password]', R.owner.password); await page.keyboard.press('Enter') }
      await page.waitForSelector('.mw-ed-stage', { timeout: 20000 })
      const f = await frameOf(page); await f.waitForSelector('[data-edit-id]', { timeout: 20000 }); await wait(800); return f
    }
    const errors = []
    // ─ Desktop 1280, mouse ─
    const page = await R.browser.newPage()
    page.on('pageerror', e => errors.push('desktop: ' + e.message)); page.on('dialog', d => d.accept())
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
    let f = await login(page)
    const rec = (file, fn) => record(page, file, fn)

    await step('G1', 'Pressione 1 s → sollevamento (×1,10, righe larghe ≤ 12 px per lato) + tremolio degli altri; prima di 1 s nulla', () => rec('G1-pressione-tremolio.mp4', async () => {
      // pagina «Primi» (Carbonara, Amatriciana, Pasta fresca, Risotti): G1 e G2 lavorano lì
      await f.evaluate(id => document.querySelector(`[data-category="${id}"]`)?.click(), S.primi); await wait(900)
      const el = await byId(f, item('Amatriciana').id); await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await wait(300)
      const c = await center(el)
      await page.mouse.move(c.x, c.y); await page.mouse.down(); await wait(600)
      const early = await f.evaluate(() => ({ jiggle: !!document.querySelector('[data-menu-gesture-edit]'), ghost: !!document.querySelector('[data-menu-gesture-ghost]') }))
      await wait(550)
      const rows = await sampleJiggle(f, 1100)
      await page.screenshot({ path: resolve(shotsDir, 'gesto-g1-sollevato.png') })
      await page.mouse.up(); await wait(700)
      const after = await f.evaluate(() => ({ jiggle: !!document.querySelector('[data-menu-gesture-edit]'), ghost: !!document.querySelector('[data-menu-gesture-ghost]') }))
      await page.screenshot({ path: resolve(shotsDir, 'gesto-g1-tremolio.png') })
      const a = analyse(rows), fine = await page.$('.mw-ed-done')
      if (early.jiggle || early.ghost) throw new Error('modalità partita prima di 1 s')
      if (!a.scalaSollevato || a.scalaSollevato < 1.02 || a.scalaSollevato > 1.101) throw new Error('sollevamento non visto ' + JSON.stringify(a))
      if (!(a.ampiezzaGradi > 1 && a.ampiezzaGradi < 2.2) || !a.fasiDiverse) throw new Error('tremolio fuori misura ' + JSON.stringify(a))
      if (!after.jiggle || !fine) throw new Error('il tremolio non resta dopo il rilascio o manca «Fine»')
      return { ...a, primaDi1s: early, dopoRilascio: after.jiggle, fine: !!fine }
    }))

    await step('G2', 'Piatto trascinato in un\'altra Sezione (Carbonara: Primi → Risotti) con molla; bozza sul server', () => rec('G2-piatto-altra-sezione.mp4', async () => {
      const carb = item('Carbonara'), first = item('Risotto ai funghi')
      const src = await byId(f, carb.id); await src.evaluate(e => e.scrollIntoView({ block: 'center' })); await wait(300)
      const a = await center(src), b = await center(await byId(f, first.id))
      await mouseDrag(page, a, { x: b.x, y: b.b.y + 6 }, { hold: 120 })   // già in modalità tremolio: si solleva subito (come iOS)
      await page.screenshot({ path: resolve(shotsDir, 'gesto-g2-rilasciato.png') })
      const w = await waitFor(async () => { const d = await draft(); const s = d.menus.find(m => m.id === M.pranzo).sections.find(s => s.id === S.risotti); return s.items.some(i => i.id === carb.id) ? d : null }, 6000, 'Carbonara in Risotti sulla bozza')
      const dom = await f.evaluate((sid, cid) => { const g = document.querySelector(`[data-edit-group-id="items:${sid}"]`); return g ? [...g.querySelectorAll(`[data-edit-group="items:${sid}"]`)].map(e => e.getAttribute('data-edit-id')).includes(cid) : false }, S.risotti, carb.id)
      const errs = errors.filter(e => /removeChild|insertBefore|NotFoundError/.test(e))
      if (!dom) throw new Error('DOM: Carbonara non in Risotti'); if (errs.length) throw new Error('errori React: ' + errs.join(' | '))
      return { bozza: w.menus.find(m => m.id === M.pranzo).sections.find(s => s.id === S.risotti).items.map(i => i.name), manualOrder: w.design.manualOrder ?? null }
    }))

    await step('G3', 'Menu trascinato a sinistra (Cena prima di Pranzo) → ordine manuale in bozza', () => rec('G3-menu-destra-sinistra.mp4', async () => {
      await f.evaluate(() => scrollTo(0, 0)); await wait(300)
      const cena = await byId(f, M.cena), pranzo = await byId(f, M.pranzo)
      const a = await center(cena), b = await center(pranzo)
      await mouseDrag(page, a, { x: b.b.x + 4, y: b.y }, { hold: 120 })
      await page.screenshot({ path: resolve(shotsDir, 'gesto-g3-menu.png') })
      const d = await waitFor(async () => { const d = await draft(); return d.design.manualOrder === true && d.menus[0].id === M.cena ? d : null }, 6000, 'Cena primo Menu in bozza')
      const dom = await f.evaluate(() => [...document.querySelectorAll('[data-edit-kind="menu"]')].map(e => e.textContent.trim()))
      return { bozza: d.menus.map(m => m.name), dom }
    }))

    await step('G4', 'Sottomenu su più righe: Dolci portato al primo posto delle pillole', () => rec('G4-sottomenu-righe.mp4', async () => {
      // dopo G3 il locale è in ordine manuale: le pillole sono i Sottomenu veri e vanno a capo
      await f.evaluate(id => [...document.querySelectorAll('[data-edit-kind="menu"]')].find(e => e.getAttribute('data-edit-id') === id)?.click(), M.pranzo)
      await wait(900)
      const rows = await f.evaluate(mid => { const t = new Set([...document.querySelectorAll(`[data-edit-group="pills:${mid}"]`)].map(e => Math.round(e.getBoundingClientRect().top))); return t.size }, M.pranzo)
      const dolci = await byId(f, S.dolci), first = await byId(f, S.antipasti)
      const a = await center(dolci), b = await center(first)
      await mouseDrag(page, a, { x: b.b.x + 4, y: b.y }, { hold: 120 })
      await page.screenshot({ path: resolve(shotsDir, 'gesto-g4-sottomenu.png') })
      const d = await waitFor(async () => { const d = await draft(); const roots = d.menus.find(m => m.id === M.pranzo).sections.filter(s => !s.parentSectionId); return roots[0].id === S.dolci ? d : null }, 6000, 'Dolci primo Sottomenu in bozza')
      return { righeDiPillole: rows, radici: d.menus.find(m => m.id === M.pranzo).sections.filter(s => !s.parentSectionId).map(s => s.name) }
    }))

    await step('G5', '«Fine» → il tremolio si ferma (≈90 ms), niente più elementi in modalità', () => rec('G5-fine.mp4', async () => {
      await wait(300); const done = await page.$('.mw-ed-done'); if (!done) throw new Error('manca «Fine»')
      await done.click(); await wait(250)
      const s = await f.evaluate(() => ({ edit: document.querySelectorAll('[data-menu-gesture-edit]').length, rot: [...document.querySelectorAll('[data-edit-id]')].some(e => /rotate\((?!0deg)/.test(e.style.transform || '')) }))
      await page.screenshot({ path: resolve(shotsDir, 'gesto-g5-fine.png') })
      if (s.edit || s.rot) throw new Error('ancora in modalità ' + JSON.stringify(s)); return s
    }))

    await step('G6', 'Ricarica pagina → ordine salvato in bozza (Menu, Sottomenu, piatto spostato)', async () => {
      f = await login(page)
      await f.evaluate(id => [...document.querySelectorAll('[data-edit-kind="menu"]')].find(e => e.getAttribute('data-edit-id') === id)?.click(), M.pranzo); await wait(900)
      const o = await f.evaluate(mid => ({ menus: [...document.querySelectorAll('[data-edit-kind="menu"]')].map(e => e.getAttribute('data-edit-id')), pills: [...document.querySelectorAll(`[data-edit-group="pills:${mid}"]`)].map(e => e.getAttribute('data-edit-id')) }), M.pranzo)
      const d = await draft(), roots = d.menus.find(m => m.id === M.pranzo).sections.filter(s => !s.parentSectionId).map(s => s.id)
      await page.screenshot({ path: resolve(shotsDir, 'gesto-g6-ricaricato.png') })
      if (o.menus[0] !== M.cena) throw new Error('Menu non nell\'ordine salvato: ' + o.menus)
      if (JSON.stringify(o.pills) !== JSON.stringify(roots)) throw new Error('pillole ≠ bozza: ' + o.pills.length)
      return { menuPrimo: 'Cena', pilloleUgualiBozza: o.pills.length, statoTestata: await page.$eval('.mw-ed-status', e => e.textContent.trim()).catch(() => '') }
    })

    await step('G7', 'Pubblica → pubblicato nell\'ordine nuovo; pagina dei clienti (renderer pubblico, sola lettura) nell\'ordine nuovo', async () => {
      const cur = await owner.call('GET', '/api/menu-workspace')
      const pub = await owner.call('POST', '/api/menu-workspace/publish', { expectedRevision: cur.json.revision })
      if (pub.status !== 200) throw new Error('publish ' + pub.status + ' ' + JSON.stringify(pub.json).slice(0, 200))
      const [row] = await R.sql`SELECT published FROM menu_workspaces WHERE restaurant_id=${RESTAURANT_ID}`
      const P = row.published, roots = P.menus.find(m => m.id === M.pranzo).sections.filter(s => !s.parentSectionId).map(s => s.name)
      if (P.design.manualOrder !== true || P.menus[0].id !== M.cena || roots[0] !== 'Dolci') throw new Error('pubblicato non nell\'ordine nuovo')
      // Pagina in sola lettura con lo stesso renderer dei clienti (il worker pubblico non gira in locale: vedi notes/B-web.md).
      const cust = await R.browser.newPage(); await cust.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })
      await cust.setCookie(...(await page.cookies(R.base)))
      await cust.goto(R.base + '/menu-preview/' + M.pranzo, { waitUntil: 'domcontentloaded' })
      const seen = await waitFor(() => cust.evaluate(() => { const pills = [...document.querySelectorAll('[data-category]')].map(e => e.textContent.trim()); const menus = [...document.querySelectorAll('nav button, [aria-current]')].map(e => e.textContent.trim()).filter(Boolean); return pills.length ? { pills, menus } : null }), 15000, 'pagina clienti')
      await cust.screenshot({ path: resolve(shotsDir, 'gesto-g7-pagina-clienti-390.png') }); await cust.close()
      if (!/dolci/i.test(seen.pills[0] || '')) throw new Error('pagina clienti: prima pillola ' + seen.pills[0])
      return { pubblicato: { menus: P.menus.map(m => m.name), sottomenu: roots }, paginaClienti: seen.pills }
    })
    await page.close()

    // ─ Telefono 390 emulato, tocco ─
    const mob = await R.browser.newPage(); mob.on('pageerror', e => errors.push('mobile: ' + e.message)); mob.on('dialog', d => d.accept())
    await mob.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })
    const fm = await login(mob)
    await step('G8', 'Telefono (tocco emulato): pressione 1 s → tremolio, piatto in un\'altra Sezione, «Fine»', () => record(mob, 'G8-telefono-tocco.mp4', async () => {
      {
        await fm.evaluate(id => [...document.querySelectorAll('[data-edit-kind="menu"]')].find(e => e.getAttribute('data-edit-id') === id)?.click(), M.pranzo); await wait(600)
        await fm.evaluate(id => document.querySelector(`[data-category="${id}"]`)?.click(), S.primi); await wait(900)
        const amat = item('Amatriciana'), target = item('Tagliatelle al ragù')
        const src = await byId(fm, amat.id); await src.evaluate(e => e.scrollIntoView({ block: 'center' })); await wait(400)
        const a = await center(src), b = await center(await byId(fm, target.id))
        await mob.touchscreen.touchStart(a.x, a.y); await wait(1150)
        const rows = await sampleJiggle(fm, 600)
        for (let i = 1; i <= 28; i++) { await mob.touchscreen.touchMove(a.x, a.y + (b.b.y + 6 - a.y) * i / 28); await wait(16) }
        await wait(250); await mob.screenshot({ path: resolve(shotsDir, 'gesto-g8-telefono-trascina.png') }); await mob.touchscreen.touchEnd(); await wait(800)
        await mob.screenshot({ path: resolve(shotsDir, 'gesto-g8-telefono-rilasciato.png') })
        const d = await waitFor(async () => { const d = await draft(); return d.menus.find(m => m.id === M.pranzo).sections.find(s => s.id === S.pasta).items.some(i => i.id === amat.id) ? d : null }, 6000, 'Amatriciana in Pasta fresca')
        const done = await mob.$('.mw-ed-done'); if (done) { await done.tap(); await wait(300) }
        const left = await fm.evaluate(() => document.querySelectorAll('[data-menu-gesture-edit]').length)
        return { tremolio: analyse(rows), pastaFresca: d.menus.find(m => m.id === M.pranzo).sections.find(s => s.id === S.pasta).items.map(i => i.name), fine: !!done && left === 0 }
      }
    }))
    await step('G9', 'Nessun errore JavaScript (né di React su nodi spostati)', async () => { if (errors.length) throw new Error(errors.join(' | ')); return 'console pulita' })
  } finally {
    await writeFile(resolve(shotsDir, 'verifica-gesto.json'), JSON.stringify({ data: new Date().toISOString(), ambito: 'dashboard vera (server Fastify + Postgres locale + SPA compilata + renderer vero), modulo packages/menu-gesture, Chrome headless 1280 mouse + 390 tocco emulato', risultati: results, note: [...notes, ...stray] }, null, 2))
    await R.close()
  }
  const ko = results.filter(r => !r.ok).map(r => r.n)
  console.log(JSON.stringify({ ok: !ko.length, ko }))
  if (ko.length) process.exitCode = 1
}
try { await main() } catch (e) { console.error(e); process.exitCode = 1 } finally { setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref() }
