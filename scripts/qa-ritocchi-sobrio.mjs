#!/usr/bin/env node
/** QA dei ritocchi del 10/10 (tema Sobrio unico, sidebar, Team in Impostazioni, onboarding menu).
 *  Uso: node scripts/qa-ritocchi-sobrio.mjs <outDir> [--only nome,nome]
 *  Headless, desktop 1440 + telefono 390 emulato. Nessuna scrittura sul Supabase remoto:
 *  ogni richiesta /api non GET è mockata (upload logo/sfondo, colori dal sito, anteprima import)
 *  o bloccata con 403. Per ogni schermata:
 *   - screenshot PNG;
 *   - controllo arancione: campiona color/background/bordi/fill/stroke calcolati degli elementi
 *     visibili e segnala quelli con tonalità 5°–35° e saturazione > 40 % (escluso il logo
 *     [data-tako-logo] e i campioni dei colori del cliente nell'onboarding);
 *   - errori di pagina / console e presenza del testo «Errore interno».
 *  Esce con codice 1 se un controllo fallisce. */
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(repo + '/package.json');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2);
const out = resolve(args[0] || 'qa-ritocchi'); await mkdir(out, { recursive: true });
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const only = opt('--only', '') ? opt('--only', '').split(',') : null;
const qa = JSON.parse(await readFile(process.env.HOME + '/.config/tako-webapp/qa-login.json', 'utf8'));
const origin = 'http://localhost:5137';
const FIXED = Date.parse('2026-10-10T12:00:00Z');
const freeze = `(()=>{const F=${FIXED};const D=Date;class X extends D{constructor(...a){super(...(a.length?a:[F]))}static now(){return F}}window.Date=X;})();`;
const css = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}`;
const r0 = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: qa.email, password: qa.password }) });
if (r0.status !== 200) throw new Error('login ' + r0.status);
const cookies = r0.headers.getSetCookie().map(v => { const [nv] = v.split(';'); const i = nv.indexOf('='); return { name: nv.slice(0, i), value: nv.slice(i + 1), domain: 'localhost', path: '/', httpOnly: true }; });
const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
// documento corrente (GET) per costruire una risposta d'importazione verosimile
const ws = await (await fetch(origin + '/api/menu-workspace', { headers: { Cookie: cookieHeader } })).json();
const importedWorkspace = JSON.parse(JSON.stringify(ws.data));
const firstMenu = importedWorkspace.menus[0];
if (firstMenu) firstMenu.sections.push({ id: '00000000-0000-4000-8000-0000000000a1', name: 'ANTIPASTI', description: null, parentSectionId: null, active: true, translations: {}, items: [
  { id: '00000000-0000-4000-8000-0000000000b1', name: 'Bruschetta', description: 'Pomodoro e basilico', price: 6, available: true, displayMode: 'normal', variants: [], translations: {}, allergens: [], tags: [], additives: [] },
  { id: '00000000-0000-4000-8000-0000000000b2', name: 'Burrata', description: 'Con pomodorini', price: 9.5, available: true, displayMode: 'normal', variants: [], translations: {}, allergens: [], tags: [], additives: [] }] });
const logoPath = resolve(repo, 'apps/dashboard/public/staff/assets/takos/blu/logo.png');
const bgPath = resolve(repo, 'apps/dashboard/public/staff/assets/takos/verde/piatto.png');
const siteLogo = 'data:image/png;base64,' + (await readFile(resolve(repo, 'apps/dashboard/public/staff/assets/takos/verde/logo.png'))).toString('base64');

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });
const viewports = { desktop: { width: 1440, height: 900, deviceScaleFactor: 1 }, mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const results = []; const failures = [];
let uploads = 0;

async function page(vp, route, { setup = false } = {}) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulate({ viewport: viewports[vp], userAgent: vp === 'mobile' ? UA_MOBILE : (await browser.userAgent()) });
  await p.evaluateOnNewDocument(freeze);
  await p.evaluateOnNewDocument((route, setup) => { try { localStorage.setItem('tako-dash-route', route); } catch {} if (setup) window.__takoOpenMenuSetup = true; }, route, setup);
  await ctx.setCookie(...cookies);
  const errors = [];
  await p.setRequestInterception(true);
  p.on('request', rq => {
    const url = rq.url(), method = rq.method();
    // /pdf è un rendering in sola lettura (nessuna scrittura nel DB): passa
    if (!url.includes('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(method) || url.endsWith('/api/menu-workspace/pdf')) return rq.continue();
    const json = (status, body) => rq.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.endsWith('/api/menu-workspace/assets') && method === 'POST') {
      uploads++;
      const url2 = uploads % 2 ? '/staff/assets/takos/blu/logo.png' : '/staff/assets/takos/verde/piatto.png';
      return setTimeout(() => json(201, { data: { id: '00000000-0000-4000-8000-00000000000' + (uploads % 10), url: url2, name: 'mock.png', bytes: 1000, mime: 'image/png' } }), 300);
    }
    if (url.endsWith('/api/menu-workspace/brand-from-site')) return setTimeout(() => json(200, { data: { url: 'https://trattoria.example/', themeColor: '#1f4d3a', colors: ['#1f4d3a', '#c9a227', '#2b2b2b', '#f4efe6'], background: '#f4efe6', text: '#2b2b2b', logo: { dataUrl: siteLogo, source: 'apple-touch-icon', url: 'https://trattoria.example/apple-touch-icon.png' }, suggested: { primary: '#1f4d3a', background: '#f4efe6', text: '#2b2b2b' } } }), 400);
    if (url.endsWith('/api/menu-workspace/import/preview')) return setTimeout(() => json(200, { data: { workspace: importedWorkspace, importedCount: 2, warnings: ['Riga 5: prezzo non riconosciuto, controlla «Tagliere»'] } }), 400);
    errors.push(`BLOCCATA ${method} ${url}`);
    return json(403, { error: { code: 'QA_READ_ONLY', message: 'QA in sola lettura' } });
  });
  p.on('pageerror', e => errors.push(`pageerror ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errors.push(`console.error ${m.text().slice(0, 160)} ${m.location()?.url || ''}`); });
  p.on('response', r => { if (r.status() >= 400 && !r.url().includes('/api/menu-workspace/brand-from-site')) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await p.goto(origin + '/staff/', { waitUntil: 'networkidle0' });
  return { p, ctx, errors };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function settle(p, ms = 1500) {
  await p.addStyleTag({ content: css }).catch(() => {});
  await p.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await wait(ms);
}
async function clickText(p, selector, text) {
  const ok = await p.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find(e => e.textContent.trim().startsWith(t) && e.offsetParent !== null); if (el) { el.click(); return true; } return false; }, selector, text);
  if (!ok) throw new Error(`clic non trovato: ${selector} «${text}»`);
}
/* colori calcolati di ogni elemento visibile; arancione = H 5–35°, S > 40 % */
async function orangeScan(p) {
  return p.evaluate(() => {
    const EXCLUDE = '[data-tako-logo], .mw-swatches, .mw-proposal, .mw-sample, .mw-found, .mw-drop-media, .mw-library-item img';
    const parse = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
    const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min; if (!d) return { h: 0, s: 0, l }; const s = d / (1 - Math.abs(2 * l - 1)); let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return { h, s, l }; };
    const bad = []; let sampled = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest(EXCLUDE)) continue;
      const rect = el.getBoundingClientRect(); if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const props = [['background-color', cs.backgroundColor]];
      if (el.childNodes && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) props.push(['color', cs.color]);
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none') props.push(['border-' + side.toLowerCase(), cs['border' + side + 'Color']]);
      if (el instanceof SVGElement) { if (cs.fill && cs.fill !== 'none') props.push(['fill', cs.fill]); if (cs.stroke && cs.stroke !== 'none') props.push(['stroke', cs.stroke]); }
      for (const [prop, value] of props) {
        const c = parse(value); if (!c || c.a < 0.1) continue; sampled++;
        const { h, s } = hsl(c);
        if (h >= 5 && h <= 35 && s > 0.4) bad.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} «${(el.textContent || '').trim().slice(0, 30)}» ${prop} ${value}`);
      }
    }
    return { sampled, bad: [...new Set(bad)].slice(0, 20) };
  });
}
async function shot(name, vp, fn) {
  if (only && !only.includes(name)) return;
  const t0 = Date.now(); let r;
  try {
    r = await fn(vp);
    await r.p.screenshot({ path: `${out}/${name}-${vp}.png` });
    const scan = await orangeScan(r.p);
    const internal = await r.p.evaluate(() => document.body.innerText.includes('Errore interno'));
    const errs = r.errors.filter(e => !/^HTTP 4\d\d .*\/api\/menu-workspace\/brand-from-site/.test(e));
    const ok = !scan.bad.length && !internal && !errs.length;
    results.push({ name: `${name}-${vp}`, ok, ms: Date.now() - t0, sampled: scan.sampled, orange: scan.bad, internal, errors: errs });
    if (!ok) failures.push(`${name}-${vp}`);
  } catch (e) { results.push({ name: `${name}-${vp}`, ok: false, error: e.message, errors: r?.errors }); failures.push(`${name}-${vp}`); }
  finally { await r?.ctx.close().catch(() => {}); }
}
const shots = {
  panoramica: async vp => { const r = await page(vp, 'dashboard'); await settle(r.p, 2500); return r; },
  sidebar: async vp => { const r = await page(vp, 'dashboard'); await settle(r.p, 2000);
    if (vp === 'mobile') { await clickText(r.p, 'button', 'Altro'); await settle(r.p, 900); }
    else { await r.p.evaluate(() => [...document.querySelectorAll('aside button')].at(-1).click()); await settle(r.p, 600); }
    return r; },
  impostazioni: async vp => { const r = await page(vp, 'impostazioni'); await settle(r.p, 2500); return r; },
  team: async vp => { const r = await page(vp, 'staff'); await settle(r.p, 2500); return r; },
  turni: async vp => { const r = await page(vp, 'turni'); await settle(r.p, 2500); return r; },
  'onboarding-1-vuoto': async vp => { const r = await page(vp, 'menu', { setup: true }); await settle(r.p, 3000); return r; },
  'onboarding-1-logo-colori': async vp => {
    const r = await page(vp, 'menu', { setup: true }); await settle(r.p, 3000);
    const input = await r.p.$('.mw-drop.logo input[type=file]'); await input.uploadFile(logoPath); await wait(1500);
    // sfondo: trascinamento vero (DataTransfer con File) sul riquadro
    const bytes = (await readFile(bgPath)).toString('base64');
    await r.p.evaluate(async b64 => { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const file = new File([bin], 'sfondo.png', { type: 'image/png' }); const dt = new DataTransfer(); dt.items.add(file); const zone = document.querySelector('.mw-drop.background'); zone.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, bytes);
    await wait(1500); await settle(r.p, 500);
    const state = await r.p.evaluate(() => ({ logo: !!document.querySelector('.mw-drop.logo img'), bg: !!document.querySelector('.mw-drop.background img'), proposal: document.querySelector('.mw-proposal')?.innerText || '' }));
    if (!state.logo || !state.bg || !state.proposal.includes('Dal logo')) throw new Error('upload/estrazione dal logo non riusciti: ' + JSON.stringify(state));
    await r.p.evaluate(() => document.querySelector('.mw-proposal')?.scrollIntoView({ block: 'center' })); await wait(200);
    return r; },
  'onboarding-1-sito': async vp => {
    const r = await page(vp, 'menu', { setup: true }); await settle(r.p, 3000);
    await r.p.type('.mw-site input', 'trattoria.example'); await clickText(r.p, '.mw-site button', 'Analizza'); await wait(1500); await settle(r.p, 400);
    const txt = await r.p.evaluate(() => document.querySelector('.mw-proposal')?.innerText || '');
    if (!txt.includes('trattoria.example')) throw new Error('proposta dal sito assente');
    await clickText(r.p, '.mw-proposal button', 'Usa questi colori'); await wait(300);
    const colors = await r.p.evaluate(() => [...document.querySelectorAll('.mw-swatch-text input')].map(i => i.value));
    if (colors.join() !== '#1f4d3a,#f4efe6,#2b2b2b') throw new Error('colori non applicati: ' + colors);
    await r.p.evaluate(() => document.querySelector('.mw-proposal')?.scrollIntoView({ block: 'center' })); await wait(200);
    return r; },
  'onboarding-2-menu': async vp => { const r = await page(vp, 'menu', { setup: true }); await settle(r.p, 3000); await clickText(r.p, '.mw-setup button', 'Continua'); await settle(r.p, 600); await r.p.type('.mw-setup textarea', '# ANTIPASTI\nBruschetta — 6,00 €\nPomodoro e basilico\nBurrata — 9,50 €'); await settle(r.p, 300); return r; },
  'onboarding-3-anteprima': async vp => { const r = await page(vp, 'menu', { setup: true }); await settle(r.p, 3000); await clickText(r.p, '.mw-setup button', 'Continua'); await settle(r.p, 400); await r.p.type('.mw-setup textarea', '# ANTIPASTI\nBruschetta — 6,00 €'); await clickText(r.p, '.mw-setup button', 'Genera anteprima'); await wait(1200); await settle(r.p, 2500);
    if (!(await r.p.evaluate(() => document.querySelector('.mw-result')?.innerText || '')).includes('2 piatti')) throw new Error('anteprima import assente'); return r; },
  'menu-contenuti': async vp => { const r = await page(vp, 'menu'); await settle(r.p, 3000); return r; },
  'menu-aspetto': async vp => { const r = await page(vp, 'menu'); await settle(r.p, 2500); await clickText(r.p, '.mw-tab', 'Aspetto'); await settle(r.p, 3000); return r; },
  'menu-lingue': async vp => { const r = await page(vp, 'menu'); await settle(r.p, 2500); await clickText(r.p, '.mw-tab', 'Lingue'); await settle(r.p, 2000); return r; },
  'menu-pdf': async vp => { const r = await page(vp, 'menu'); await settle(r.p, 2500); await clickText(r.p, '.mw-tab', 'PDF e QR'); await settle(r.p, 6000); return r; },
  'menu-versioni': async vp => { const r = await page(vp, 'menu'); await settle(r.p, 2500); await clickText(r.p, '.mw-tab', 'Versioni'); await settle(r.p, 1500); await clickText(r.p, 'button', 'Carica storico'); await settle(r.p, 2000); return r; },
};
for (const vp of ['desktop', 'mobile']) for (const [name, fn] of Object.entries(shots)) await shot(name, vp, fn);
await browser.close();
await writeFile(`${out}/qa-ritocchi.json`, JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.sampled ? ` (${r.sampled} colori)` : ''}${r.error ? ' — ' + r.error : ''}${r.orange?.length ? '\n     arancione: ' + r.orange.join('\n                ') : ''}${r.internal ? '\n     «Errore interno» presente' : ''}${r.errors?.length ? '\n     errori: ' + r.errors.join('\n             ') : ''}`);
console.log(failures.length ? `\n${failures.length} schermate con problemi` : '\nTutte le schermate ok');
process.exit(failures.length ? 1 : 0);
