// Registra e verifica il prototipo Preset. Uso: node record-preset.mjs <variant a|b> <viewport desktop|mobile> <mode pointer|reduced|keyboard>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
const require = createRequire('/Users/manuel/Projects/Tako/Tako/package.json');
const puppeteer = require('puppeteer-core');

const [variant = 'a', vp = 'desktop', mode = 'pointer'] = process.argv.slice(2);
const DIR = '/Users/manuel/Projects/Tako/Tako/docs/webapp/feature-vendita-2026-10-16/prototipo-preset';
const OUT = path.join(DIR, 'video');
const name = `variante-${variant}-${vp}-${mode}`;
const mobile = vp === 'mobile';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => { const f = path.join(DIR, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/variante-${variant}.html` + (mode === 'keyboard' ? '?fail=1' : '');
const checks = [];
const check = (label, ok, detail) => { checks.push({ label, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb']
});
let recorder;
try {
  const page = await browser.newPage();
  await page.setViewport(mobile ? { width: 500, height: 900, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { width: 1280, height: 800, deviceScaleFactor: 1 });
  if (mode === 'reduced') await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text() + (m.location()?.url || ''))) errors.push(m.text() + ' ' + (m.location()?.url || '')); });
  // Solo per la registrazione: un cerchio mostra dove avviene il tap/click; traccia per frame della lista.
  await page.evaluateOnNewDocument(() => {
    window.__trace = [];
    addEventListener('DOMContentLoaded', () => {
      const c = document.createElement('div');
      c.style.cssText = 'position:fixed;z-index:99999;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:2px solid #2563eb;background:#2563eb22;pointer-events:none;opacity:0';
      document.body.appendChild(c);
      const at = e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; };
      addEventListener('pointermove', e => { at(e); c.style.opacity = .7; }, true);
      addEventListener('pointerdown', e => { at(e); c.style.opacity = 1; c.animate([{ transform: 'scale(.6)' }, { transform: 'scale(1)' }], 200); }, true);
      const lw = () => document.querySelector('.pp-list-wrap');
      // prova del retargeting: valore corrente al tap vs primo keyframe della nuova CSSTransition
      window.__retarget = [];
      let before = null;
      addEventListener('click', e => { const el = lw(); before = el && e.target.closest('#pp-preset,.pp-chip') ? new DOMMatrix(getComputedStyle(el).transform).f : null; }, true);
      addEventListener('click', () => { // bolla su window: dopo l'handler del prototipo, lettura sincrona
        const el = lw(); if (before === null || !el) return;
        getComputedStyle(el).transform; // forza lo style recalc che crea la transizione
        const t = el.getAnimations().find(a => a.transitionProperty === 'transform');
        if (!t) { window.__retarget.push({ before: +before.toFixed(1), start: null }); return; }
        const k = t.effect.getKeyframes();
        window.__retarget.push({ before: +before.toFixed(1), start: +new DOMMatrix(k[0].transform).f.toFixed(1), end: +new DOMMatrix(k[k.length - 1].transform).f.toFixed(1), ms: t.effect.getTiming().duration, delay: t.effect.getTiming().delay });
      });
      // campionamento a 8ms indipendente dai fotogrammi del compositor headless
      setInterval(() => { const el = lw(); if (el) { const m = new DOMMatrix(getComputedStyle(el).transform); window.__trace.push([Math.round(performance.now()), +m.f.toFixed(2)]); } }, 8);
    });
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await sleep(300);
  fs.mkdirSync(OUT, { recursive: true });
  recorder = await page.screencast({ path: path.join(OUT, name + '.webm'), fps: 30, quality: 20, ffmpegPath: '/opt/homebrew/bin/ffmpeg' });
  await sleep(500);

  const box = async sel => { const el = await page.waitForSelector(sel, { visible: true }); return el.boundingBox(); };
  const tap = async sel => {
    const b = await box(sel), x = b.x + b.width / 2, y = b.y + b.height / 2;
    if (mobile) await page.touchscreen.tap(x, y);
    else { await page.mouse.move(x, y, { steps: 8 }); await page.mouse.click(x, y); }
  };
  const quick = async sel => { const b = await box(sel), x = b.x + b.width / 2, y = b.y + b.height / 2; if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
  const tapAt = async (x, y) => { if (mobile) await page.touchscreen.tap(x, y); else { await page.mouse.move(x, y, { steps: 8 }); await page.mouse.click(x, y); } };
  const st = () => page.evaluate(() => {
    const b = document.getElementById('pp-preset'), lw = document.querySelector('.pp-list-wrap');
    return {
      label: b.querySelector('.pp-label').textContent, expanded: b.getAttribute('aria-expanded'), hidden: b.hidden,
      ty: +new DOMMatrix(getComputedStyle(lw).transform).f.toFixed(1), trayH: parseFloat(getComputedStyle(document.getElementById('pp-stage')).getPropertyValue('--tray-h')),
      current: document.querySelector('.pp-chip[aria-current=true]')?.dataset.id, firstDish: document.querySelector('.pp-item-text strong')?.textContent || null,
      empty: !!document.querySelector('.pp-empty'), focus: document.activeElement?.id || document.activeElement?.dataset?.id || document.activeElement?.tagName,
      chipOpacity: document.querySelector('.pp-chip[data-id="mar"]') ? +getComputedStyle(document.querySelector('.pp-chip[data-id="mar"]')).opacity : null, dialog: document.getElementById('pp-dialog').open,
      dlgError: document.getElementById('pp-dlg-error').textContent, status: document.getElementById('pp-status').textContent,
      todayTag: document.querySelector('.pp-chip[data-id="ven"] .pp-chip-tag')?.textContent, onlineTag: document.querySelector('.pp-chip[data-id="gio"] .pp-chip-tag')?.textContent
    };
  });
  const SETTLE = 700;

  // Controlli statici iniziali
  const geo = await page.evaluate(() => {
    const r = s => document.querySelector(s).getBoundingClientRect();
    const p = r('#pp-preset'), m = r('#pp-picker'), s = r('.mw-studio-toolbuttons');
    return { presetX: Math.round(p.x), pickerRight: Math.round(m.right), toolsX: Math.round(s.x), presetRight: Math.round(p.right), docW: document.documentElement.scrollWidth, vw: innerWidth };
  });
  check('nessuno scroll orizzontale', geo.docW <= geo.vw, geo);
  check(`posizione Preset variante ${variant}`, variant === 'a' ? geo.presetX - geo.pickerRight <= 10 : geo.toolsX - geo.presetRight <= 10, geo);

  if (mode === 'pointer' || mode === 'reduced') {
    // 1. Apertura
    await tap('#pp-preset');
    if (mode === 'reduced') { await sleep(40); const s = await st(); check('reduced: lista già a fine corsa dopo 40ms', Math.abs(s.ty - (s.trayH + 12)) < 1, s); }
    await sleep(SETTLE);
    let s = await st();
    check('apertura: aria-expanded true e lista scesa di tray-h+12', s.expanded === 'true' && Math.abs(s.ty - (s.trayH + 12)) < 1, s);
    check('segni oggi (Ven) e online (Gio)', /oggi/.test(s.todayTag || '') && /online/.test(s.onlineTag || ''), { today: s.todayTag, online: s.onlineTag });
    // 2. Scelta Lunedì
    await tap('.pp-chip[data-id="lun"]');
    if (mode === 'reduced') { await sleep(40); const r = await st(); check('reduced: lista già risalita dopo 40ms', Math.abs(r.ty) < 1, r); }
    await sleep(SETTLE);
    s = await st();
    check('scelta Lunedì: etichetta «Lunedì», chiuso, lista di lunedì', s.label === 'Lunedì' && s.expanded === 'false' && s.ty === 0 && s.firstDish === 'Pasta e fagioli', s);
    // 3. Riapertura + Esc
    await tap('#pp-preset'); await sleep(SETTLE);
    await page.keyboard.press('Escape'); await sleep(SETTLE);
    s = await st();
    check('Esc chiude senza cambiare', s.label === 'Lunedì' && s.expanded === 'false' && s.ty === 0, s);
    // 4. Riapertura + tap fuori
    await tap('#pp-preset'); await sleep(SETTLE);
    const nb = await box('.mw-studio-sections');
    await tapAt(Math.max(8, nb.x - 24), nb.y + nb.height / 2); await sleep(SETTLE);
    s = await st();
    check('tap fuori chiude senza cambiare', s.label === 'Lunedì' && s.expanded === 'false', s);
    if (mode === 'pointer') {
      // 5. Retargeting: apri, richiudi a 120ms, riapri a 100ms
      await page.evaluate(() => { window.__trace.length = 0; window.__marks = []; });
      await quick('#pp-preset'); await sleep(90);
      await quick('#pp-preset'); await sleep(110);
      await quick('#pp-preset'); await sleep(SETTLE);
      // tap rapidi sui chip: Mar e, mentre la lista risale, riapri e scegli Mer
      await quick('.pp-chip[data-id="mar"]'); await sleep(220);
      await quick('#pp-preset'); await sleep(150);
      await quick('.pp-chip[data-id="mer"]'); await sleep(SETTLE);
      const tr = await page.evaluate(() => window.__trace.slice());
      const ys = tr.map(x => x[1]), range = Math.max(...ys) - Math.min(...ys);
      let maxV = 0; const reversals = [];
      for (let i = 1; i < tr.length; i++) { const d = Math.abs(ys[i] - ys[i - 1]), dt = Math.max(1, tr[i][0] - tr[i - 1][0]); maxV = Math.max(maxV, d / dt); }
      for (let i = 1; i < tr.length - 1; i++) { const a = ys[i] - ys[i - 1], b = ys[i + 1] - ys[i]; if (a * b < 0 && ys[i] > range * 0.1 && ys[i] < range * 0.9) reversals.push(ys[i]); }
      const vMax = (1 / 0.22) * range / 340; // pendenza iniziale di cubic-bezier(.22,1,.36,1) su surface 340ms
      s = await st();
      check('tap rapidi: stato finale = ultimo gesto (Mercoledì)', s.label === 'Mercoledì' && s.firstDish === 'Gnocchi al pomodoro' && s.expanded === 'false', s);
      const rt = await page.evaluate(() => window.__retarget.slice());
      const full = Math.max(...ys);
      const mid = rt.filter(r => r.start !== null && r.before > 0.5 && r.before < full - 0.5);
      check('retargeting: ogni tap a metà corsa riparte dal valore corrente (|start-before| < 2px)', mid.length >= 1 && mid.every(r => Math.abs(r.start - r.before) < 2), { midFlight: mid, taps: rt.length });
      check('tempi della lista solo da token (surface 340, ritardo 0 o 60)', rt.filter(r => r.start !== null).every(r => r.ms <= 340 && (r.delay === 0 || r.delay === 60)), rt.map(r => [r.ms, r.delay]));
      fs.writeFileSync(path.join(OUT, name + '-trace.json'), JSON.stringify(tr));
    }
    // 6. Modifica non salvata → Salva o scarta (Salva)
    const inp = '.mw-daily-price input';
    await tap(inp);
    await page.evaluate(s => document.querySelector(s).select(), inp);
    await page.keyboard.type('12,50', { delay: 60 });
    await sleep(300);
    await tap('#pp-preset'); await sleep(SETTLE);
    await tap('.pp-chip[data-id="gio"]'); await sleep(SETTLE);
    s = await st();
    check('modifiche non salvate: dialogo aperto, preset non cambiato', s.dialog && s.label !== 'Giovedì', s);
    await tap('#pp-dlg-save'); await sleep(250);
    const pend = await page.evaluate(() => document.getElementById('pp-dlg-save').getAttribute('aria-busy'));
    check('Salva: stato pending reale (aria-busy) prima del risultato', pend === 'true', pend);
    await page.waitForFunction(() => !document.getElementById('pp-dialog').open && !document.getElementById('pp-dialog').getAnimations().length && document.querySelector('.pp-label').textContent === 'Giovedì', { timeout: 8000 }).catch(() => {});
    await sleep(500);
    s = await st();
    check('Salva: dopo il risultato passa a Giovedì', !s.dialog && s.label === 'Giovedì' && s.firstDish === 'Carbonara', s);
    // 7. Scarta → Menu attuale
    await tap(inp);
    await page.evaluate(s => document.querySelector(s).select(), inp);
    await page.keyboard.type('99', { delay: 60 }); await sleep(300);
    await tap('#pp-preset'); await sleep(SETTLE);
    await tap('.pp-chip[data-id="attuale"]'); await sleep(SETTLE);
    await tap('#pp-dlg-discard'); await sleep(SETTLE + 200);
    s = await st();
    check('Scarta: Menu attuale, etichetta «Preset», bozza buttata', !s.dialog && s.label === 'Preset' && s.status === '', s);
    // 8. Domenica vuota
    await tap('#pp-preset'); await sleep(SETTLE);
    await tap('.pp-chip[data-id="dom"]'); await sleep(SETTLE);
    s = await st();
    check('preset vuoto: stato vuoto esplicito', s.empty && s.label === 'Domenica', s);
    // 9. + Nuovo
    await tap('#pp-preset'); await sleep(SETTLE);
    await tap('.pp-chip[data-id="__new"]'); await sleep(SETTLE + 300);
    s = await st();
    check('+ Nuovo: crea e seleziona «Nuovo preset»', s.label === 'Nuovo preset' && s.firstDish === 'Carbonara', s);
    // 10. Drinks (menu unico): niente pulsante Preset
    await tap('#pp-picker'); await sleep(400);
    await tap('[data-menu="drinks"]'); await sleep(SETTLE);
    s = await st();
    check('Drinks menu unico: pulsante Preset nascosto', s.hidden === true, s);
    await tap('#pp-picker'); await sleep(400);
    await tap('[data-menu="pranzo"]'); await sleep(SETTLE);
    s = await st();
    check('ritorno a Pranzo: Preset visibile e vista conservata', !s.hidden && s.label === 'Nuovo preset', s);
  }

  if (mode === 'keyboard') {
    const k = async (key, n = 1, gap = 260) => { for (let i = 0; i < n; i++) { await page.keyboard.press(key); await sleep(gap); } };
    // Tab fino al pulsante Preset
    for (let i = 0; i < 12; i++) { await k('Tab', 1, 180); if ((await st()).focus === 'pp-preset') break; }
    let s = await st();
    check('Tab raggiunge Preset con focus visibile', s.focus === 'pp-preset', s.focus);
    await k('Enter', 1, SETTLE);
    s = await st();
    check('Invio apre e porta il focus sul chip corrente', s.expanded === 'true' && s.focus === 'attuale', s);
    await k('Home'); await k('ArrowRight'); // Mar
    s = await st();
    check('frecce spostano il focus (Home → Lun, → Mar)', s.focus === 'mar', s.focus);
    await k('Enter', 1, SETTLE);
    s = await st();
    check('Invio sceglie Martedì, focus torna al pulsante', s.label === 'Martedì' && s.expanded === 'false' && s.focus === 'pp-preset', s);
    await k('ArrowDown', 1, SETTLE);
    s = await st();
    check('Freccia giù apre, focus su Martedì', s.expanded === 'true' && s.focus === 'mar', s);
    await k('ArrowRight', 2);
    await k('Escape', 1, SETTLE);
    s = await st();
    check('Esc chiude senza cambiare, focus al pulsante', s.label === 'Martedì' && s.expanded === 'false' && s.focus === 'pp-preset', s);
    await k('Enter', 1, SETTLE);
    await k('Tab', 1, SETTLE);
    s = await st();
    check('Tab fuori dal vassoio lo chiude', s.expanded === 'false', s);
    // modifica prezzo via tastiera
    await page.focus('.mw-daily-price input');
    await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
    await page.keyboard.type('13,00', { delay: 70 }); await sleep(300);
    await page.focus('#pp-preset'); await sleep(200);
    await k('Enter', 1, SETTLE);
    await k('ArrowRight', 1); // Mer
    await k('Enter', 1, SETTLE);
    s = await st();
    check('dialogo «Salva o scarta» aperto da tastiera, focus su Salva', s.dialog && s.focus === 'pp-dlg-save', s);
    await k('Escape', 1, SETTLE);
    s = await st();
    check('Esc nel dialogo = Annulla: bozza conservata, focus al chip', !s.dialog && /non salvate/.test(s.status) && s.label === 'Martedì' && s.focus === 'mer', s);
    await k('Enter', 1, SETTLE);
    await k('Enter', 1, 300); // Salva (fallisce: ?fail=1)
    await sleep(1100);
    s = await st();
    check('errore di salvataggio: messaggio, dialogo aperto, dati conservati', s.dialog && /Connessione/.test(s.dlgError) && /non salvate/.test(s.status), s);
    await page.focus('#pp-dlg-save');
    await k('Enter', 1, 300);
    await sleep(1400);
    s = await st();
    check('Riprova Salva: successo, passa a Mercoledì', !s.dialog && s.label === 'Mercoledì' && s.status === '', s);
  }

  await sleep(500);
  check('nessun errore JS in pagina', errors.length === 0, errors);
} finally {
  if (recorder) await recorder.stop().catch(() => {});
  await browser.close();
  server.close();
}
const webm = path.join(OUT, name + '.webm');
if (fs.existsSync(webm)) {
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-v', 'error', '-y', '-i', webm, '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, name + '.mp4')]);
  fs.unlinkSync(webm);
}
fs.writeFileSync(path.join(OUT, name + '-checks.json'), JSON.stringify(checks, null, 1));
const failed = checks.filter(c => !c.ok).length;
console.log(`\n${name}: ${checks.length - failed}/${checks.length} PASS`);
process.exit(failed ? 1 : 0);
