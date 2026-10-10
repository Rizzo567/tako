#!/usr/bin/env node
/** QA visiva del tema dell'interfaccia staff (Tako classico / Sobrio), headless e in sola lettura.
 *  Uso: node scripts/qa-tema-sobrio.mjs <outDir> [--ui classico|sobrio] [--only nome,nome]
 *  Schermate: home, impostazioni, menu, sala, cassa-modale (desktop 1440 + mobile 390 emulato).
 *  La modale «Nuovo conto» viene solo aperta: nessun invio. Tempo congelato e animazioni a 0
 *  come scripts/qa-screenshots.mjs, quindi due esecuzioni sono confrontabili pixel per pixel. */
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(repo + '/package.json');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2);
const out = resolve(args[0]); await mkdir(out, { recursive: true });
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ui = opt('--ui', 'sobrio');
const only = opt('--only', '') ? opt('--only', '').split(',') : null;
const qa = JSON.parse(await readFile(process.env.HOME + '/.config/tako-webapp/qa-login.json', 'utf8'));
const origin = 'http://localhost:5137';
const FIXED = Date.parse('2026-10-10T12:00:00Z');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });
const freeze = `(()=>{const F=${FIXED};const D=Date;class X extends D{constructor(...a){super(...(a.length?a:[F]))}static now(){return F}}window.Date=X;})();`;
const css = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}`;
const log = [];
const r0 = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: qa.email, password: qa.password }) });
if (r0.status !== 200) throw new Error('login ' + r0.status);
const cookies = r0.headers.getSetCookie().map(v => { const [nv] = v.split(';'); const i = nv.indexOf('='); return { name: nv.slice(0, i), value: nv.slice(i + 1), domain: 'localhost', path: '/', httpOnly: true }; });
const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') } })).json();
const userId = me?.data?.user?.id || me?.data?.id;
if (!userId) throw new Error('utente QA senza id');
const viewports = { desktop: { width: 1440, height: 900, deviceScaleFactor: 1 }, mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
async function page(vp, route) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulate({ viewport: viewports[vp], userAgent: vp === 'mobile' ? UA_MOBILE : (await browser.userAgent()) });
  await p.evaluateOnNewDocument(freeze);
  await p.evaluateOnNewDocument((route, key, ui) => { try { localStorage.setItem('tako-dash-route', route); localStorage.setItem(key, ui); } catch {} }, route, 'tako-dash-ui:' + userId, ui);
  await ctx.setCookie(...cookies);
  // sola lettura: qualunque scrittura verso l'API viene bloccata
  await p.setRequestInterception(true);
  p.on('request', rq => { if (rq.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(rq.method())) { log.push(`[${vp}] BLOCCATA ${rq.method()} ${rq.url()}`); rq.respond({ status: 403, contentType: 'application/json', body: '{"error":{"code":"QA_READ_ONLY","message":"QA in sola lettura"}}' }); } else rq.continue(); });
  p.on('pageerror', e => log.push(`[${vp}] pageerror ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') log.push(`[${vp}] console.error ${m.text().slice(0, 200)}`); });
  await p.goto(origin + '/staff/', { waitUntil: 'networkidle0' });
  return { p, ctx };
}
async function settle(p, ms = 2500) {
  await p.addStyleTag({ content: css }).catch(() => {});
  await p.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await new Promise(r => setTimeout(r, ms));
}
async function clickText(p, selector, text) {
  const ok = await p.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find(e => e.textContent.trim().startsWith(t)); if (el) { el.click(); return true; } return false; }, selector, text);
  if (!ok) log.push(`click non trovato ${selector} ${text}`);
  return ok;
}
const shots = {
  home: async vp => { const r = await page(vp, 'dashboard'); await settle(r.p, 3500); return r; },
  impostazioni: async vp => { const r = await page(vp, 'impostazioni'); await settle(r.p, 3000); return r; },
  menu: async vp => { const r = await page(vp, 'menu'); await settle(r.p, 3500); return r; },
  sala: async vp => { const r = await page(vp, 'sala'); await settle(r.p, 3500); return r; },
  'cassa-modale': async vp => { const r = await page(vp, 'cassa'); await settle(r.p, 3000); await clickText(r.p, 'button', 'Nuovo conto'); await settle(r.p, 1500); return r; },
};
for (const vp of ['desktop', 'mobile']) for (const [name, fn] of Object.entries(shots)) {
  if (only && !only.includes(name)) continue;
  const t0 = Date.now();
  try { const r = await fn(vp); await r.p.screenshot({ path: `${out}/${name}-${vp}.png` }); await r.ctx.close(); log.push(`${name}-${vp}: ok ${Date.now() - t0}ms`); }
  catch (e) { log.push(`${name}-${vp}: FAIL ${e.message}`); }
}
await browser.close();
await writeFile(`${out}/shoot-log.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
