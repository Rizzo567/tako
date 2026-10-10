#!/usr/bin/env node
/** Verifica del movimento del tema Sobrio, headless. Nessuna scrittura reale: ogni richiesta
 *  /api non-GET è intercettata e mockata (conto, comanda, annullamento) o bloccata.
 *  Uso: node scripts/qa-tema-sobrio-motion.mjs <outDir> [--frames] [--only scenario,scenario]
 *  Scrive <outDir>/motion.json (sonda per fotogramma: rettangolo e colore del contenitore,
 *  opacità/sfocatura del contenuto) e, con --frames, i fotogrammi dello screencast CDP. */
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(repo + '/package.json');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2);
const out = resolve(args[0]); await mkdir(out, { recursive: true });
const withFrames = args.includes('--frames');
const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const qa = JSON.parse(await readFile(process.env.HOME + '/.config/tako-webapp/qa-login.json', 'utf8'));
const origin = 'http://localhost:5137';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const r0 = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: qa.email, password: qa.password }) });
if (r0.status !== 200) throw new Error('login ' + r0.status);
const cookies = r0.headers.getSetCookie().map(v => { const [nv] = v.split(';'); const i = nv.indexOf('='); return { name: nv.slice(0, i), value: nv.slice(i + 1), domain: 'localhost', path: '/', httpOnly: true }; });
const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') } })).json();
const userId = me?.data?.user?.id || me?.data?.id;
const results = {}; const log = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* sonda: un campione per requestAnimationFrame */
const PROBE = () => {
  window.__probe = []; window.__marks = [];
  document.addEventListener('pointerdown', e => window.__marks.push({ t: performance.now(), ev: 'pointerdown', txt: (e.target.closest('button') || e.target).textContent.trim().slice(0, 40) }), true);
  document.addEventListener('click', e => window.__marks.push({ t: performance.now(), ev: 'click', txt: (e.target.closest('button') || e.target).textContent.trim().slice(0, 40) }), true);
  const rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left * 10) / 10, Math.round(r.top * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; };
  const loop = () => {
    const ov = document.querySelector('[data-sb-overlay]');
    const shell = ov && ov.querySelector('.sb-morph-shell');
    const wrap = ov && ov.querySelector('[role=dialog]');
    const pageShell = document.querySelector('.sb-page') && document.querySelector('.sb-page').parentElement.querySelector(':scope > .sb-morph-shell');
    const page = document.querySelector('.sb-page');
    const card = document.querySelector('[data-sb-quick]');
    const s = { t: performance.now() };
    if (shell && shell.style.display !== 'none') { const cs = getComputedStyle(shell); s.shell = rect(shell); s.bg = cs.backgroundColor; s.r = parseFloat(cs.borderTopLeftRadius); }
    if (wrap) { const cs = getComputedStyle(wrap); s.op = +cs.opacity; s.blur = cs.filter; s.clip = wrap.style.clipPath ? 1 : 0; s.panel = rect(wrap.firstElementChild); }
    if (card) s.card = rect(card);
    if (pageShell && pageShell.style.display !== 'none') { const cs = getComputedStyle(pageShell); s.pshell = rect(pageShell); s.pbg = cs.backgroundColor; s.pz = cs.zIndex; }
    if (page) { s.pop = +getComputedStyle(page).opacity; s.pclip = page.style.clipPath ? 1 : 0; }
    window.__probe.push(s);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};

async function newPage({ vp = 'desktop', route = 'dashboard', reduced = false, api = 'ok', apiDelay = 900 } = {}) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  if (vp === 'mobile') await p.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  else await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.evaluateOnNewDocument((route) => { try { localStorage.setItem('tako-dash-route', route); } catch {} }, route);
  await ctx.setCookie(...cookies);
  const writes = [];
  await p.setRequestInterception(true);
  p.on('request', rq => {
    const u = new URL(rq.url()); const m = rq.method();
    if (!u.pathname.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(m)) return rq.continue();
    writes.push({ m, path: u.pathname, body: rq.postData() || null, t: Date.now() });
    const reply = (status, data) => setTimeout(() => rq.respond({ status, contentType: 'application/json', body: JSON.stringify(status < 300 ? { data } : { error: { code: 'MOCK', message: data } }) }).catch(() => {}), apiDelay);
    if (api === 'network') return setTimeout(() => rq.abort('failed').catch(() => {}), apiDelay);
    if (m === 'POST' && u.pathname === '/api/bills') { const b = JSON.parse(rq.postData() || '{}'); return reply(201, { id: 'mock-bill', tableNumber: b.tableNumber, covers: b.covers, createdAt: new Date().toISOString(), status: 'open' }); }
    if (m === 'POST' && u.pathname === '/api/orders') return reply(201, { id: 'mock-order-1', status: 'pending' });
    if (m === 'PATCH' && /\/api\/orders\/mock-order-1\/cancel$/.test(u.pathname)) return reply(200, { id: 'mock-order-1', status: 'cancelled' });
    log.push(`BLOCCATA ${m} ${u.pathname}`);
    rq.respond({ status: 403, contentType: 'application/json', body: '{"error":{"code":"QA_READ_ONLY","message":"QA in sola lettura"}}' });
  });
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console ' + m.text().slice(0, 200)); });
  await p.goto(origin + '/staff/', { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts && document.fonts.ready);
  await sleep(1200);
  await p.evaluate(PROBE);
  let frames = null, cdp = null;
  if (withFrames) {
    cdp = await p.createCDPSession(); frames = [];
    cdp.on('Page.screencastFrame', async f => { frames.push({ ts: f.metadata.timestamp, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
  }
  return { p, ctx, writes, errors, frames, cdp };
}
async function rec(P, on) { if (P.cdp) { if (on) await P.cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 }); else await P.cdp.send('Page.stopScreencast'); } }
async function btn(p, text, scope = 'button') {
  const h = await p.evaluateHandle((t, s) => [...document.querySelectorAll(s)].find(e => e.textContent.trim().startsWith(t) && e.offsetParent !== null), text, scope);
  const el = h.asElement(); if (!el) throw new Error('pulsante non trovato: ' + text); return el;
}
async function clickEl(p, el) { const b = await el.boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await sleep(120); await p.mouse.down(); await sleep(85); await p.mouse.up(); }
async function probe(p) { return p.evaluate(() => ({ origin: performance.timeOrigin, probe: window.__probe.splice(0), marks: window.__marks.splice(0) })); }
async function saveFrames(P, name) {
  if (!P.frames) return;
  const dir = `${out}/frames-${name}`; await mkdir(dir, { recursive: true });
  const t0 = P.frames[0]?.ts || 0;
  await writeFile(`${dir}/index.json`, JSON.stringify(P.frames.map((f, i) => ({ i, t: Math.round((f.ts - t0) * 1000), wall: f.ts * 1000 }))));
  await Promise.all(P.frames.map((f, i) => writeFile(`${dir}/f${String(i).padStart(3, '0')}.png`, Buffer.from(f.data, 'base64'))));
  P.frames.length = 0;
}
const state = (p) => p.evaluate(() => ({
  overlay: !!document.querySelector('[data-sb-overlay]'),
  quick: document.querySelector('[data-sb-quick]')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) || null,
  alert: document.querySelector('[data-sb-quick] [role=alert]')?.textContent || null,
  active: (document.activeElement && (document.activeElement.textContent || document.activeElement.getAttribute('aria-label') || document.activeElement.tagName)).trim().slice(0, 40),
  triggerOpacity: [...document.querySelectorAll('[data-morph-id]')].map(b => [b.dataset.morphId, b.style.opacity || '1']),
}));

const scenarios = {
  /* 1. Nuovo conto: apertura, invio (API mock 900 ms), successo, Fatto → chiusura nel pulsante */
  async conto() {
    const P = await newPage(); const { p } = P; const R = {};
    await rec(P, true);
    await clickEl(p, await btn(p, 'Nuovo conto')); await sleep(900);
    R.open = await probe(p); R.afterOpen = await state(p);
    await clickEl(p, await p.$('[data-sb-quick] [role=radio]')); await sleep(250);
    await clickEl(p, await btn(p, 'Apri conto')); await sleep(150);
    R.sending = await state(p);
    await sleep(1600); R.success = await probe(p); R.afterSuccess = await state(p);
    await clickEl(p, await btn(p, 'Fatto', '[data-sb-quick] button')); await sleep(900);
    R.close = await probe(p); R.afterClose = await state(p);
    await rec(P, false); await saveFrames(P, 'conto');
    R.writes = P.writes; R.errors = P.errors; await P.ctx.close(); return R;
  },
  /* 2. Modale generico (Cassa › Nuovo conto): apertura dal pulsante, Esc, focus di ritorno */
  async modale() {
    const P = await newPage({ route: 'cassa' }); const { p } = P; const R = {};
    await rec(P, true);
    await clickEl(p, await btn(p, 'Nuovo conto')); await sleep(800);
    R.open = await probe(p); R.afterOpen = await state(p);
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    R.focusAfterTabs = await p.evaluate(() => !!document.activeElement.closest('[data-sb-overlay]'));
    await p.keyboard.press('Escape'); await sleep(900);
    R.close = await probe(p); R.afterClose = await state(p);
    await rec(P, false); await saveFrames(P, 'modale');
    R.writes = P.writes; R.errors = P.errors; await P.ctx.close(); return R;
  },
  /* 3. Retargeting: chiusura a metà apertura, poi riapertura a metà chiusura */
  async retarget() {
    const P = await newPage(); const { p } = P; const R = {};
    const b = await btn(p, 'Nuovo conto');
    await clickEl(p, b); await sleep(60);
    await p.keyboard.press('Escape'); await sleep(110);
    await clickEl(p, b); await sleep(900);
    R.probe = await probe(p); R.after = await state(p);
    R.errors = P.errors; await P.ctx.close(); return R;
  },
  /* 4. Comanda: successo, annulla (API reale di annullamento mockata), di nuovo invio, Esc */
  async comanda() {
    const P = await newPage(); const { p } = P; const R = {};
    await clickEl(p, await btn(p, 'Comanda')); await sleep(800);
    await clickEl(p, await p.$('[data-sb-quick] [role=radio]')); await sleep(150);
    const add = await p.$('[data-sb-quick] [aria-label^="Aggiungi "]');
    if (!add) { R.skip = 'menu senza piatti disponibili'; await P.ctx.close(); return R; }
    await clickEl(p, add); await sleep(200);
    await clickEl(p, await p.$('[data-sb-quick] [aria-label^="Più "]')); await sleep(200);
    R.beforeSend = await state(p);
    // doppio clic rapido sull'invio: deve partire una sola richiesta
    const send = await btn(p, 'Invia in cucina', '[data-sb-quick] button');
    const bb = await send.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await sleep(200); R.sending = await state(p);
    await sleep(1500); R.success = await state(p);
    await clickEl(p, await btn(p, 'Annulla', '[data-sb-quick] button')); await sleep(1500); R.afterUndo = await state(p);
    await p.keyboard.press('Escape'); await sleep(900); R.afterEsc = await state(p);
    R.writes = P.writes; R.errors = P.errors; await P.ctx.close(); return R;
  },
  /* 5. Comanda con errore di rete: messaggio, nessuna card di successo */
  async errore() {
    const P = await newPage({ api: 'network', apiDelay: 400 }); const { p } = P; const R = {};
    await clickEl(p, await btn(p, 'Comanda')); await sleep(800);
    await clickEl(p, await p.$('[data-sb-quick] [role=radio]')); await sleep(150);
    const add = await p.$('[data-sb-quick] [aria-label^="Aggiungi "]'); if (!add) { R.skip = 'menu vuoto'; await P.ctx.close(); return R; }
    await clickEl(p, add); await sleep(200);
    await clickEl(p, await btn(p, 'Invia in cucina', '[data-sb-quick] button')); await sleep(1200);
    R.after = await state(p);
    // anche Nuovo conto con errore
    await p.keyboard.press('Escape'); await sleep(800);
    await clickEl(p, await btn(p, 'Nuovo conto')); await sleep(800);
    await clickEl(p, await p.$('[data-sb-quick] [role=radio]')); await sleep(150);
    await clickEl(p, await btn(p, 'Apri conto')); await sleep(1200);
    R.afterConto = await state(p);
    R.writes = P.writes; R.errors = P.errors; await P.ctx.close(); return R;
  },
  /* 6. Pulsante → pagina (Sala live) e ritorno con «Panoramica» */
  async pagina() {
    const P = await newPage(); const { p } = P; const R = {};
    await rec(P, true);
    await clickEl(p, await btn(p, 'Sala live')); await sleep(900);
    R.fwd = await probe(p); R.afterFwd = await state(p);
    R.route = await p.evaluate(() => localStorage.getItem('tako-dash-route'));
    await clickEl(p, await p.$('[aria-label="Torna alla Panoramica"]')); await sleep(900);
    R.back = await probe(p); R.afterBack = await state(p);
    await rec(P, false); await saveFrames(P, 'pagina');
    R.errors = P.errors; await P.ctx.close(); return R;
  },
  /* 7. Ridotto movimento: dissolvenza breve, niente guscio */
  async ridotto() {
    const P = await newPage({ reduced: true }); const { p } = P; const R = {};
    await clickEl(p, await btn(p, 'Nuovo conto')); await sleep(500);
    R.open = await probe(p); await p.keyboard.press('Escape'); await sleep(400); R.close = await probe(p); R.after = await state(p);
    R.errors = P.errors; await P.ctx.close(); return R;
  },
  /* 8. Telefono (390, emulazione touch): apertura e chiusura di Nuovo conto */
  async mobile() {
    const P = await newPage({ vp: 'mobile' }); const { p } = P; const R = {};
    const b = await btn(p, 'Nuovo conto'); await b.scrollIntoView(); await sleep(300);
    const bb = await b.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(900);
    R.open = await probe(p); R.afterOpen = await state(p);
    await p.touchscreen.tap(195, 24); await sleep(900);
    R.close = await probe(p); R.after = await state(p);
    R.errors = P.errors; await P.ctx.close(); return R;
  },
};
for (const [name, fn] of Object.entries(scenarios)) {
  if (onlyArg && !onlyArg.includes(name)) continue;
  try { results[name] = await fn(); log.push(`${name}: ok`); } catch (e) { results[name] = { fail: e.message }; log.push(`${name}: FAIL ${e.message}`); }
}
await browser.close();
await writeFile(`${out}/motion.json`, JSON.stringify(results, null, 1));
await writeFile(`${out}/log.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
