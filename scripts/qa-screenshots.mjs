#!/usr/bin/env node
/** Headless visual QA of the running webapp (pnpm webapp), read-only on the QA tenant.
 *  Usage: node scripts/qa-screenshots.mjs <outDir>   → PNG desktop 1440 + mobile 390 (emulated).
 *  Time is frozen and animations are disabled so two runs are pixel-comparable
 *  (scripts/qa-screenshot-diff.mjs). Only GET pages plus the QA login: no save/publish. */
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(repo + '/package.json');
const puppeteer = require('puppeteer-core');
const out = resolve(process.argv[2]); await mkdir(out, { recursive: true });
const qa = JSON.parse(await readFile(process.env.HOME + '/.config/tako-webapp/qa-login.json', 'utf8'));
const origin = 'http://localhost:5137';
const FIXED = Date.parse('2026-10-10T12:00:00Z');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });
const freeze = `(()=>{const F=${FIXED};const D=Date;class X extends D{constructor(...a){super(...(a.length?a:[F]))}static now(){return F}}window.Date=X;})();`;
const css = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}`;
const log = [];
let cookies = null;
async function login() {
  const r = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: qa.email, password: qa.password }) });
  if (r.status !== 200) throw new Error('login ' + r.status);
  return r.headers.getSetCookie().map(v => { const [nv] = v.split(';'); const i = nv.indexOf('='); return { name: nv.slice(0, i), value: nv.slice(i + 1), domain: 'localhost', path: '/', httpOnly: true }; });
}
const viewports = { desktop: { width: 1440, height: 900, deviceScaleFactor: 1 }, mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
async function page(vp, { auth, route, setup } = {}) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulate({ viewport: viewports[vp], userAgent: vp === 'mobile' ? UA_MOBILE : (await browser.userAgent()) });
  await p.evaluateOnNewDocument(freeze);
  await p.evaluateOnNewDocument((route, setup) => { try { if (route) localStorage.setItem('tako-dash-route', route); } catch {} if (setup) window.__takoOpenMenuSetup = true; }, route || null, !!setup);
  if (auth) await ctx.setCookie(...cookies);
  p.on('pageerror', e => log.push(`[${vp}] pageerror ${e.message}`));
  return { p, ctx };
}
async function settle(p, ms = 2500) {
  await p.addStyleTag({ content: css }).catch(() => {});
  await p.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await new Promise(r => setTimeout(r, ms));
}
async function clickText(p, selector, text) {
  const ok = await p.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find(e => e.textContent.trim().startsWith(t)); if (el) { el.click(); return true; } return false; }, selector, text);
  if (!ok) log.push(`click not found ${selector} ${text}`);
  return ok;
}
async function shot(name, vp, fn) {
  const t0 = Date.now();
  try { const r = await fn(); await r.p.screenshot({ path: `${out}/${name}-${vp}.png`, fullPage: false }); await r.ctx.close(); log.push(`${name}-${vp}: ok ${Date.now() - t0}ms`); }
  catch (e) { log.push(`${name}-${vp}: FAIL ${e.message}`); }
}
cookies = await login();
const menuPath = `/r/${qa.restaurantId}/menu`;
for (const vp of ['desktop', 'mobile']) {
  await shot('staff-login', vp, async () => { const r = await page(vp); await r.p.goto(origin + '/staff/', { waitUntil: 'networkidle0' }); await settle(r.p); return r; });
  await shot('staff-home', vp, async () => { const r = await page(vp, { auth: true, route: 'dashboard' }); await r.p.goto(origin + '/staff/', { waitUntil: 'networkidle0' }); await settle(r.p, 3500); return r; });
  await shot('menu-contents', vp, async () => { const r = await page(vp, { auth: true, route: 'menu' }); await r.p.goto(origin + '/staff/', { waitUntil: 'networkidle0' }); await settle(r.p, 3500); return r; });
  await shot('menu-aspetto', vp, async () => { const r = await page(vp, { auth: true, route: 'menu' }); await r.p.goto(origin + '/staff/', { waitUntil: 'networkidle0' }); await settle(r.p, 3000); await clickText(r.p, '.mw-tab', 'Aspetto'); await settle(r.p, 4000); return r; });
  await shot('menu-pdf', vp, async () => { const r = await page(vp, { auth: true, route: 'menu' }); await r.p.goto(origin + '/staff/', { waitUntil: 'networkidle0' }); await settle(r.p, 3000); await clickText(r.p, '.mw-tab', 'PDF e QR'); await settle(r.p, 7000); return r; });
  await shot('onboarding', vp, async () => { const r = await page(vp, { auth: true, route: 'menu', setup: true }); await r.p.goto(origin + '/staff/', { waitUntil: 'networkidle0' }); await settle(r.p, 4000); return r; });
  await shot('customer-menu', vp, async () => { const r = await page(vp); await r.p.goto(origin + menuPath, { waitUntil: 'networkidle0' }); await settle(r.p, 3000); return r; });
  await shot('customer-asporto', vp, async () => { const r = await page(vp); await r.p.goto(origin + `/asporto/${qa.restaurantId}`, { waitUntil: 'networkidle0' }); await settle(r.p, 3000); return r; });
  await shot('customer-prenota', vp, async () => { const r = await page(vp); await r.p.goto(origin + `/prenota/${qa.restaurantId}`, { waitUntil: 'networkidle0' }); await settle(r.p, 3000); return r; });
}
await browser.close();
await writeFile(`${out}/shoot-log.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
