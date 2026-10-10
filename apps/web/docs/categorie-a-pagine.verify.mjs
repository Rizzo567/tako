// Verifica headless delle categorie a pagine: API cliente mockate (nessuna scrittura), Chrome headless.
// Uso: node apps/web/docs/categorie-a-pagine.verify.mjs <origin Next isolato, es. http://127.0.0.1:5142> <cartella output>
// Le API cliente sono mockate (menu con 6 categorie + sottocategoria, 2 menu); nessuna scrittura arriva al server.
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const origin = process.argv[2] || 'http://127.0.0.1:5142';
const out = process.argv[3]; await mkdir(out, { recursive: true });
const rid = JSON.parse(await readFile(process.env.HOME + '/.config/tako-webapp/qa-login.json', 'utf8')).restaurantId;
const qaDesign = { font: 'sans', text: '#242628', links: [], layout: 'list', preset: 'tako', primary: '#ED7159', spacing: 16, fontSize: 16, background: '#f8f5ef', navigation: 'tabs', showImages: true, showPrices: true, borderWidth: 0, categoryGap: 24, borderRadius: 12, categoryText: '#ffffff', headerSticky: false, showAllergens: true, showFoodLegends: true, showDescriptions: true, categoryActiveText: '#ffffff', categoryBackground: '#242628', categoryActiveBackground: '#ed725b' };
const it = (id, name, price, extra = {}) => ({ id, name, price, available: true, description: 'Ingredienti freschi di stagione, preparati al momento.', allergens: ['glutine'], tags: [], additives: [], ...extra });
const dinner = { id: 'menu-cena', name: 'Cena', sections: [
  { id: 'spec', name: 'Specialità del giorno', items: [it('s1', 'Piatto esaurito', 18, { available: false })] },
  { id: 'ant', name: 'Antipasti', items: ['Bruschetta al pomodoro', 'Tagliere di salumi', 'Burrata e alici', 'Fiori di zucca fritti', 'Polpette al sugo', 'Carpaccio di manzo', 'Insalata di mare'].map((n, i) => it('a' + i, n, 8 + i)) },
  { id: 'piz', name: 'Pizze classiche', items: ['Margherita', 'Marinara', 'Diavola', 'Capricciosa', 'Quattro formaggi'].map((n, i) => it('z' + i, n, 7 + i)) },
  { id: 'pri', name: 'Primi', items: ['Carbonara', 'Amatriciana', 'Cacio e pepe', 'Gricia', 'Lasagna', 'Risotto ai funghi'].map((n, i) => it('p' + i, n, 11 + i)) },
  { id: 'pri-mare', name: 'Primi di mare', parentSectionId: 'pri', items: ['Spaghetti alle vongole', 'Linguine allo scoglio', 'Paccheri al ragù di pesce'].map((n, i) => it('pm' + i, n, 15 + i)) },
  { id: 'sec', name: 'Secondi', items: ['Tagliata di manzo', 'Saltimbocca', 'Branzino al forno', 'Pollo alla diavola'].map((n, i) => it('c' + i, n, 16 + i)) },
  { id: 'dol', name: 'Dolci', items: ['Tiramisù', 'Panna cotta', 'Cannolo'].map((n, i) => it('d' + i, n, 5 + i)) },
] };
const drinks = { id: 'menu-bere', name: 'Bevande', sections: [
  { id: 'vin', name: 'Vini', items: ['Chianti', 'Vermentino'].map((n, i) => it('v' + i, n, 20 + i)) },
  { id: 'bir', name: 'Birre', items: ['Bionda', 'Rossa'].map((n, i) => it('b' + i, n, 5 + i)) },
] };
const menuBody = menuId => JSON.stringify({ data: menuId === 'menu-bere' ? drinks : dinner, menus: [{ id: dinner.id, name: dinner.name }, { id: drinks.id, name: drinks.name }], design: qaDesign, foodTranslations: {}, foodCatalogs: { allergens: [{ id: 'glutine', label: 'Glutine', number: 1 }] }, languages: ['it', 'en'], defaultLanguage: 'it', features: { restaurantName: 'Trattoria di prova', customerOrderingEnabled: true } });
const restaurant = { id: rid, name: 'Trattoria di prova', primaryColor: '#ED7159', aiEnabled: false, logoUrl: null };
const previewDoc = JSON.stringify({ data: { schemaVersion: 1, languages: ['it'], defaultLanguage: 'it', design: qaDesign, menus: [dinner, drinks].map(m => ({ ...m, active: true, sections: m.sections.map(s => ({ ...s, active: true })) })) }, presentation: { restaurantName: 'Trattoria di prova', foodCatalogs: {} } });
const blocked = [];
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text'] });
const viewports = { desktop: { width: 1280, height: 860, deviceScaleFactor: 1 }, mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const report = { checks: [], console: {} };
const check = (name, ok, detail = '') => { report.checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
async function open(vp, path, { reduced = false } = {}) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulate({ viewport: viewports[vp], userAgent: vp === 'mobile' ? UA_MOBILE : await browser.userAgent() });
  if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errors = [];
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push('pageerror ' + e.message));
  p.on('response', res => { if (res.status() >= 400) errors.push(`HTTP ${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`); });
  await p.setRequestInterception(true);
  p.on('request', r => {
    const u = new URL(r.url());
    const json = body => r.respond({ status: 200, contentType: 'application/json', body });
    if (u.pathname === `/api/customer/restaurant/${rid}/menu`) return json(menuBody(u.searchParams.get('menuId')));
    if (u.pathname.startsWith('/api/customer/table/')) return json(JSON.stringify({ data: { restaurant, table: { id: 'tavolo-qa', number: 7 }, sessionId: null } }));
    if (u.pathname === `/api/customer/takeaway/${rid}/session`) return json(JSON.stringify({ data: { restaurant } }));
    if (u.pathname === '/api/menu-workspace') return json(previewDoc);
    if (r.method() !== 'GET' && r.method() !== 'HEAD' && r.method() !== 'OPTIONS' && !u.pathname.startsWith('/socket.io')) { blocked.push(`${r.method()} ${u.pathname}`); return r.respond({ status: 403, contentType: 'application/json', body: '{"error":"blocked by verifier"}' }); }
    if (u.pathname.startsWith('/socket.io')) return r.continue({ headers: { ...r.headers(), origin: 'http://localhost:5137' } }); // il dev isolato ha un'origine diversa da quella ammessa dall'API
    return r.continue();
  });
  await p.goto(origin + path, { waitUntil: 'networkidle2', timeout: 90000 });
  await p.waitForSelector('nav[aria-label="Categorie"] button', { timeout: 60000 });
  await new Promise(r => setTimeout(r, 600));
  return { p, ctx, errors };
}
const state = p => p.evaluate(() => {
  const list = document.querySelector('[data-category-page]');
  const pressed = [...document.querySelectorAll('nav[aria-label="Categorie"] button[aria-pressed="true"]')].map(b => b.textContent);
  const ind = document.querySelector('[data-category-indicator]');
  const pill = document.querySelector('nav[aria-label="Categorie"] button[aria-pressed="true"]');
  return { page: list?.dataset.categoryPage, sections: [...document.querySelectorAll('[data-category-page] section')].map(s => s.getAttribute('aria-label')), rows: document.querySelectorAll('[data-category-page] article').length, pressed, scrollY: Math.round(scrollY), url: location.search, indicatorBg: ind && getComputedStyle(ind).backgroundColor, pillColor: pill && getComputedStyle(pill).color, indicatorOverPill: !!(ind && pill && Math.abs(ind.getBoundingClientRect().left - pill.getBoundingClientRect().left) < 1 && Math.abs(ind.getBoundingClientRect().width - pill.getBoundingClientRect().width) < 1), opacity: list && getComputedStyle(list).opacity, transform: list && getComputedStyle(list).transform, html: (() => { const root = document.querySelector('nav[aria-label="Categorie"]').closest('.min-h-screen'); const re = /#ed7159|#ed725b|rgba?\(237, 11[34], 9[01]/i; return [root, ...root.querySelectorAll('*')].filter(e => { const c = getComputedStyle(e); return re.test(e.getAttribute('style') || '') || [c.color, c.backgroundColor, c.borderTopColor, c.borderBottomColor].some(v => re.test(v)); }).length; })() };
});
const click = (p, name) => p.evaluate(n => { const b = [...document.querySelectorAll('nav[aria-label="Categorie"] button')].find(x => x.textContent.trim() === n); b.click(); return !!b; }, name);
// Campionatore a frame reali: opacità/traslazione della lista e posizione dell'indicatore.
const startSampler = p => p.evaluate(() => { window.__samples = []; const t0 = document.timeline.currentTime, w0 = performance.now(); const tick = () => { const l = document.querySelector('[data-category-page]'), i = document.querySelector('[data-category-indicator]'); const m = new DOMMatrix(getComputedStyle(l).transform); window.__samples.push({ t: Math.round(document.timeline.currentTime - t0), page: l.dataset.categoryPage, o: +(+getComputedStyle(l).opacity).toFixed(2), x: +m.m41.toFixed(1), ix: i ? +new DOMMatrix(getComputedStyle(i).transform).m41.toFixed(1) : null, iw: i ? +i.getBoundingClientRect().width.toFixed(1) : null }); if (performance.now() - w0 < 900) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
async function record(p, vp, label, name, frames = 14, every = 45, slow = 0.1) {
  // Animazioni rallentate 10× solo per i fotogrammi: un fotogramma ogni 45 ms reali = 4,5 ms di animazione.
  const cdp = await p.createCDPSession(); await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: slow });
  await click(p, name);
  for (let i = 0; i < frames; i++) { await p.screenshot({ path: `${out}/${vp}-${label}-${String(i).padStart(2, '0')}.png` }); await new Promise(r => setTimeout(r, every * (i < 2 ? 1 : 3))); }
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 }); await new Promise(r => setTimeout(r, 400));
}
for (const vp of ['desktop', 'mobile']) {
  const { p, ctx, errors } = await open(vp, `/r/${rid}/menu`);
  let s = await state(p);
  check(`[${vp}] categoria iniziale = prima con piatti disponibili`, s.page === 'ant' && s.pressed[0] === 'Antipasti', JSON.stringify(s.pressed));
  check(`[${vp}] solo antipasti visibili`, s.sections.join() === 'Antipasti' && s.rows === 7, s.sections.join());
  check(`[${vp}] niente arancione Tako nel menu (default neutro)`, s.html === 0 && s.indicatorBg === 'rgb(29, 29, 31)', `${s.indicatorBg}, occorrenze arancio ${s.html}`);
  check(`[${vp}] indicatore sotto la pillola attiva`, s.indicatorOverPill);
  await p.screenshot({ path: `${out}/${vp}-0-iniziale.png` });
  // Scroll dentro gli antipasti, poi Primi: la pagina riparte sotto le pillole, mai in fondo alla sezione.
  const navTop = await p.evaluate(() => document.querySelector('nav[aria-label="Categorie"]').getBoundingClientRect().top + scrollY);
  await p.evaluate(y => scrollTo(0, y), Math.round(navTop - 40)); await new Promise(r => setTimeout(r, 200));
  const before = (await state(p)).scrollY;
  await startSampler(p); await click(p, 'Primi'); await new Promise(r => setTimeout(r, 800));
  const samples = await p.evaluate(() => window.__samples);
  s = await state(p);
  check(`[${vp}] Primi: solo Primi e sottocategoria`, s.sections.join() === 'Primi,Primi di mare' && s.rows === 9, s.sections.join());
  check(`[${vp}] Primi: scroll non salta alla sezione`, s.scrollY <= before + 1, `prima ${before}, dopo ${s.scrollY}, nav ${Math.round(navTop)}`);
  check(`[${vp}] Primi: ?cat=pri nell'URL`, s.url.includes('cat=pri'), s.url);
  check(`[${vp}] lista a riposo nitida (opacity 1, nessuna trasformazione)`, s.opacity === '1' && s.transform === 'none', `${s.opacity} ${s.transform}`);
  const exitEnd = samples.find(x => x.page === 'pri')?.t, settle = samples.find(x => x.page === 'pri' && x.o === 1 && x.x === 0 && samples.indexOf(x) > 0)?.t, minX = Math.min(...samples.filter(x => x.page === 'ant').map(x => x.x)), maxEnterX = Math.max(...samples.filter(x => x.page === 'pri').map(x => x.x));
  const indMoving = samples.filter(x => x.ix !== null); const indDone = indMoving.find((x, i) => i > 0 && x.ix === indMoving.at(-1).ix && x.iw === indMoving.at(-1).iw)?.t;
  check(`[${vp}] uscita verso sinistra, entrata da destra (Primi è più avanti)`, minX < 0 && maxEnterX > 0, `uscita min x ${minX}px, entrata max x ${maxEnterX}px`);
  check(`[${vp}] durata passaggio ~220–300 ms`, settle >= 200 && settle <= 340, `swap a ${exitEnd} ms, lista ferma a ${settle} ms, indicatore fermo a ${indDone} ms`);
  report[`samples-${vp}`] = samples;
  // Registrazione rallentata: Primi → Antipasti (indietro: entra da sinistra), poi di nuovo Primi.
  await record(p, vp, '1-primi-ad-antipasti', 'Antipasti');
  s = await state(p); check(`[${vp}] ritorno ad Antipasti`, s.page === 'ant' && s.pressed[0] === 'Antipasti');
  await record(p, vp, '2-antipasti-a-primi', 'Primi');
  // Indietro del browser: torna ad Antipasti senza ricaricare.
  await p.evaluate(() => { window.__noReload = 1; history.back(); }); await new Promise(r => setTimeout(r, 900));
  s = await state(p); const kept = await p.evaluate(() => window.__noReload === 1);
  check(`[${vp}] tasto indietro → categoria precedente senza ricaricare`, s.page === 'ant' && kept && !s.url.includes('cat=pri'), `${s.page} ${s.url} noReload=${kept}`);
  // Clic rapidi: Pizze, Secondi, Dolci in 80 ms → nessuna coda, si ferma su Dolci.
  await click(p, 'Pizze classiche'); await new Promise(r => setTimeout(r, 40)); await click(p, 'Secondi'); await new Promise(r => setTimeout(r, 40)); await click(p, 'Dolci');
  await new Promise(r => setTimeout(r, 450)); s = await state(p);
  check(`[${vp}] clic rapidi convergono sull'ultima categoria entro 450 ms`, s.page === 'dol' && s.opacity === '1' && s.transform === 'none' && s.indicatorOverPill, `${s.page} op ${s.opacity} ${s.transform}`);
  // Ricerca su tutto il menu; svuotandola si torna alla categoria scelta.
  await p.click('button[aria-label="Cerca nel menu"]'); await p.type('input[aria-label="Cerca piatti e categorie"]', 'carbonara'); await new Promise(r => setTimeout(r, 300));
  s = await state(p); check(`[${vp}] ricerca: risultati da tutte le categorie`, s.page === 'search' && s.sections.join() === 'Primi', s.sections.join());
  await p.type('input[aria-label="Cerca piatti e categorie"]', '', {}); await p.click('button[aria-label="Cancella ricerca"]'); await new Promise(r => setTimeout(r, 300));
  s = await state(p); check(`[${vp}] ricerca svuotata → torna a Dolci`, s.page === 'dol' && s.pressed[0] === 'Dolci', s.page);
  // Cambio menu → prima categoria del nuovo menu.
  await p.evaluate(() => [...document.querySelectorAll('nav[aria-label="Menu disponibili"] button')].find(b => b.textContent === 'Bevande').click());
  await p.waitForFunction(() => document.querySelector('[data-category-page]')?.dataset.categoryPage === 'vin', { timeout: 8000 }).catch(() => {});
  s = await state(p); check(`[${vp}] cambio menu → prima categoria`, s.page === 'vin' && s.pressed[0] === 'Vini' && !s.url.includes('cat='), `${s.page} ${s.url}`);
  // Cambio lingua: resta sulla categoria.
  await click(p, 'Birre'); await new Promise(r => setTimeout(r, 400));
  await p.select('select[aria-label="Lingua del menu"]', 'en'); await new Promise(r => setTimeout(r, 900));
  s = await state(p); check(`[${vp}] cambio lingua mantiene la categoria`, s.page === 'bir', `${s.page} ${s.url}`);
  report.console[`consultazione-${vp}`] = errors; await ctx.close();
  // Riduzione movimento: cambio istantaneo, nessuna animazione attiva.
  const r = await open(vp, `/r/${rid}/menu`, { reduced: true });
  const anims = await r.p.evaluate(() => { [...document.querySelectorAll('nav[aria-label="Categorie"] button')].find(b => b.textContent === 'Primi').click(); return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => res({ n: document.getAnimations().length, page: document.querySelector('[data-category-page]').dataset.categoryPage, tr: getComputedStyle(document.querySelector('[data-category-indicator]')).transitionDuration })))); });
  check(`[${vp}] prefers-reduced-motion → cambio istantaneo`, anims.n === 0 && anims.page === 'pri' && anims.tr === '0s', JSON.stringify(anims));
  await r.ctx.close();
}
// Altre superfici: tavolo (API mockata, sola lettura), asporto, anteprima editor.
for (const [name, path] of [['tavolo', `/r/${rid}/t/token-di-prova`], ['asporto', `/asporto/${rid}`], ['anteprima', `/menu-preview/menu-cena`]]) {
  try {
    const { p, ctx, errors } = await open('mobile', path);
    await click(p, 'Primi'); await new Promise(r => setTimeout(r, 600));
    const s = await state(p);
    check(`[${name}] pagina Primi e niente arancione nel menu`, s.page === 'pri' && s.sections.join() === 'Primi,Primi di mare', `${s.page} ${s.sections.join()} url=${s.url}`);
    if (name === 'anteprima') check('[anteprima] nessun ?cat= (iframe in sola lettura)', !s.url.includes('cat='), s.url);
    await p.screenshot({ path: `${out}/superficie-${name}.png` });
    report.console[name] = errors; await ctx.close();
  } catch (e) { check(`[${name}] apertura`, false, e.message); }
}
for (const [k, v] of Object.entries(report.console)) check(`console pulita: ${k}`, v.length === 0, v.slice(0, 3).join(' | '));
check('nessuna scrittura verso il server', blocked.length === 0, blocked.join(', '));
await browser.close();
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(`${report.checks.filter(c => c.ok).length}/${report.checks.length} PASS`);
