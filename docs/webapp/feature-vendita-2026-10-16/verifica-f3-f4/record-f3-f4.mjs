// Verifica headless F3 (prezzo promo) + F4 (scarsità): menu pubblico, PDF e drawer «Modifica piatto», con dati finti.
// Nessun DB, nessuna rete esterna, nessuna finestra: Chrome headless di /Applications, un solo browser alla volta.
// I dati pubblici passano dal codice VERO del server (workspaceSchema → publicWorkspace → publicMenuProjection, renderWorkspacePdf)
// con orologio finto: «adesso» = venerdì 16/10/2026 19:00 Roma, «dopo» = lunedì 19/10/2026 07:00 Roma.
// Uso: node docs/webapp/feature-vendita-2026-10-16/verifica-f3-f4/record-f3-f4.mjs
import { createRequire } from 'node:module'
import { build, transform } from 'esbuild'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../../../..')
const require = createRequire(resolve(repo, 'package.json')), puppeteer = require('puppeteer-core')
const out = resolve(here, 'video'), work = resolve(process.env.TMPDIR || '/tmp', 'tako-f3f4-' + process.pid)
await mkdir(out, { recursive: true }); await mkdir(work, { recursive: true })
const checks = []; const check = (scenario, label, ok, detail) => { checks.push({ scenario, label, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + scenario + ' · ' + label + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')) }
const sleep = ms => new Promise(r => setTimeout(r, ms))

// 1) Dati e PDF dal codice reale del server (stub solo per @tako/db: nessuna connessione).
const dbStub = { name: 'db-stub', setup(b) { b.onResolve({ filter: /^@tako\/db$/ }, () => ({ path: 'db', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'const t={};export const db=t,menus=t,menuSections=t,menuItems=t,itemVariants=t,menuItemTranslations=t,restaurants=t', loader: 'js' })) } }
const dataEntry = `
import {workspaceSchema} from './apps/server/src/lib/menu-workspace-contract.ts'
import {publicWorkspace} from './apps/server/src/lib/menu-workspace-schedule.ts'
import {publicMenuProjection} from './apps/server/src/lib/published-menu.ts'
import {renderWorkspacePdf} from './apps/server/src/lib/menu-workspace-pdf.ts'
import {writeFileSync} from 'node:fs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const w=workspaceSchema.parse({languages:['it','en'],menus:[{id:id(1),name:'Cena',sections:[
 {id:id(2),name:'Primi',items:[
  {id:id(10),name:'Spaghetti alla carbonara',description:'Guanciale, pecorino, uovo',price:12,promo:{price:9,until:'2026-10-18'},scarcity:{lastPortions:true},translations:{en:{name:'Spaghetti carbonara',description:'Guanciale, pecorino, egg'}}},
  {id:id(11),name:'Amatriciana',description:'Pomodoro e guanciale',price:10},
  {id:id(12),name:'Risotto ai funghi',price:14,promo:{price:11}},
 ]},
 {id:id(3),name:'Dolci',items:[
  {id:id(20),name:'Tiramisù',description:'Della casa',price:6,scarcity:{onlyToday:'2026-10-16'}},
  {id:id(21),name:'Panna cotta',price:5,promo:{price:5.5}},
 ]}]}],design:{},pdf:{showQr:false}})
const now=new Date('2026-10-16T17:00:00Z'),later=new Date('2026-10-19T05:00:00Z')
const project=(at,lang)=>publicMenuProjection(publicWorkspace(w,at,{ignoreSchedules:true,timezone:'Europe/Rome'}).menus[0],lang,'it')
writeFileSync(process.argv[2]+'/fixtures.json',JSON.stringify({now:{it:project(now,'it'),en:project(now,'en')},later:{it:project(later,'it')}}))
for(const [name,at,lang] of [['now',now,'it'],['now-en',now,'en'],['later',later,'it']])writeFileSync(process.argv[2]+'/menu-'+name+'.pdf',await renderWorkspacePdf(w,[id(1)],lang,'Verifica promo',id(99),undefined,{timezone:'Europe/Rome',now:at}))
`
const dataBundle = resolve(repo, 'apps/server/node_modules/.cache/f3f4-data-' + process.pid + '.mjs')
await build({ stdin: { contents: dataEntry, loader: 'ts', resolveDir: repo }, bundle: true, platform: 'node', format: 'esm', outfile: dataBundle, plugins: [dbStub], packages: 'external', logLevel: 'error' })
// Il bundle sta in apps/server/node_modules/.cache: risolve le dipendenze del server e '../../assets/fonts' come il sorgente.
try { execFileSync(process.execPath, [dataBundle, work], { cwd: resolve(repo, 'apps/server'), stdio: 'inherit' }) } finally { await rm(dataBundle, { force: true }) }
const fixtures = JSON.parse(await readFile(resolve(work, 'fixtures.json'), 'utf8'))

// 2) CSS Tailwind del menu pubblico, generato dal sorgente di questo ramo.
execFileSync(resolve(repo, 'apps/web/node_modules/.bin/tailwindcss'), ['-c', 'tailwind.config.ts', '-i', 'src/app/globals.css', '-o', resolve(work, 'tw.css')], { cwd: resolve(repo, 'apps/web'), stdio: 'ignore' })

// 3) Fixture pagina pubblica: il renderer vero con i dati proiettati dal server.
const publicEntry = `import React from 'react';import {createRoot} from 'react-dom/client';import {WorkspaceMenuRenderer} from './src/components/WorkspaceMenuRenderer';
const q=new URLSearchParams(location.search),data=window.__F[q.get('t')||'now'][q.get('lang')||'it'];
createRoot(document.getElementById('root')).render(<WorkspaceMenuRenderer menu={data} design={{showPrices:true,showDescriptions:true,showImages:false,background:'#f8f5ef',text:'#242628',primary:'#242628'}} foodCatalogs={{allergens:[],traits:[],additives:[]}} restaurantName="Locale di prova" menus={[{id:data.id,name:'CENA'}]} languages={['it','en']} language={q.get('lang')||'it'} onSelectLanguage={()=>{}} readOnly/>)`
await build({ stdin: { contents: publicEntry, loader: 'tsx', resolveDir: resolve(repo, 'apps/web') }, bundle: true, outfile: resolve(work, 'public.js'), external: ['/takomenu-public/*'], format: 'iife', jsx: 'automatic', loader: { '.ttf': 'dataurl', '.woff2': 'dataurl' }, alias: { '@': resolve(repo, 'apps/web/src') }, nodePaths: [resolve(repo, 'apps/web/node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' })

// 4) Fixture drawer: 13-menu-sales.js com'è (stessi globali dello SPA staff) dentro una riga + ispettore minimi.
const salesSource = await readFile(resolve(repo, 'apps/dashboard/public/staff/src/13-menu-sales.js'), 'utf8')
const drawerEntry = `import React,{useState,useEffect,useRef} from 'react';import {createRoot} from 'react-dom/client';
${salesSource}
const start={id:'d1',name:'Spaghetti alla carbonara',description:'Guanciale, pecorino, uovo',price:12,available:true};
function Harness(){const [item,setItem]=useState(start);window.__item=item;
 const updateItem=(key,value)=>setItem(i=>({...i,[key]:value}));
 return <div className="mw-harness"><div className="mw-row mw-item mw-daily-item mw-catalog-item" data-row><div className="mw-daily-name"><strong>{item.name}</strong><span className="mw-catalog-description">{item.description}</span>{item.available===false&&<small>Esaurito</small>}<MenuWorkspaceSalesMarks item={item}/></div><span className="mw-harness-price">{mwSalesEuro(Number(item.price))}</span></div>
 <section className="mw-inline-inspector" aria-label="Modifica piatto"><div className="mw-drawer-heading"><h3>Modifica piatto</h3></div><div className="mw-fields"><label className="mw-field"><span>Nome</span><input value={item.name} readOnly/></label><label className="mw-field"><span>Prezzo</span><input type="number" value={item.price} onChange={e=>updateItem('price',e.target.value===''?'':Number(e.target.value))}/></label></div>
 <MenuWorkspaceSales item={item} onChange={updateItem}/><label className="mw-check"><input type="checkbox" checked={item.available===false} onChange={e=>setItem(i=>{const next={...i,available:!e.target.checked};if(!next.available&&next.scarcity){next.scarcity={...next.scarcity,lastPortions:false};if(!next.scarcity.onlyToday)delete next.scarcity}return next})}/>Esaurito (come il salvataggio sul server)</label></section></div>}
createRoot(document.getElementById('root')).render(<Harness/>)`
await build({ stdin: { contents: drawerEntry, loader: 'jsx', resolveDir: resolve(repo, 'apps/web') }, bundle: true, outfile: resolve(work, 'drawer.js'), format: 'iife', jsx: 'automatic', nodePaths: [resolve(repo, 'apps/web/node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' })
// lo stesso file deve compilare anche nel bundle staff vero (un solo scope lessicale)
await transform(salesSource, { loader: 'jsx' })

// 5) Server locale.
const staff = resolve(repo, 'apps/dashboard/public/staff'), pdfjs = resolve(repo, 'node_modules/pdfjs-dist/legacy/build')
const types = { '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.pdf': 'application/pdf', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }
const send = async (res, file) => { if (!existsSync(file)) { res.writeHead(404); return res.end() } res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file)) }
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0])
  if (path === '/public.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/w/tw.css"><link rel="stylesheet" href="/w/public.css"><style>:root{--font-body:Arial,sans-serif;--font-display:Arial,sans-serif}</style><div id="root"></div><script>window.__F=${JSON.stringify(fixtures)}</script><script src="/w/public.js"></script>`) }
  if (path === '/drawer.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/staff/styles.css"><link rel="stylesheet" href="/staff/src/menu-workspace.css"><link rel="stylesheet" href="/staff/src/sobrio.css"><link rel="stylesheet" href="/staff/src/menu-sales.css"><style>body{margin:0;background:var(--bg,#f6f5f2);font-family:system-ui,sans-serif}.mw-harness{max-width:560px;margin:24px auto;padding:0 16px;display:grid;gap:16px}.mw-harness .mw-row{display:flex;justify-content:space-between;align-items:center;background:#fff;border-radius:16px;padding:14px 16px}.mw-inline-inspector{background:#fff;border-radius:16px;padding:16px}.mw-harness input{height:40px;border:1px solid #ddd;border-radius:12px;padding:0 12px;font-size:15px}</style><div id="root"></div><script src="/w/drawer.js"></script>`) }
  if (path === '/pdf.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(`<body style="margin:0;background:#888"><canvas id="c"></canvas><script type="module">import * as pdfjs from '/pdfjs/pdf.mjs';pdfjs.GlobalWorkerOptions.workerSrc='/pdfjs/pdf.worker.mjs';const name=new URLSearchParams(location.search).get('f');const pdf=await pdfjs.getDocument({url:'/w/'+name}).promise;const page=await pdf.getPage(1);const v=page.getViewport({scale:1.6});const c=document.getElementById('c');c.width=v.width;c.height=v.height;await page.render({canvasContext:c.getContext('2d'),viewport:v}).promise;document.body.dataset.ready='1'</script>`) }
  if (path.startsWith('/w/')) return send(res, resolve(work, path.slice(3)))
  if (path.startsWith('/staff/')) return send(res, resolve(staff, path.slice(7)))
  if (path.startsWith('/pdfjs/')) return send(res, resolve(pdfjs, path.slice(7)))
  res.writeHead(404); res.end()
})
await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb'] })
const viewports = { desktop: { width: 1280, height: 800, deviceScaleFactor: 1 }, mobile: { width: 500, height: 900, deviceScaleFactor: 1, isMobile: true, hasTouch: true } }
async function scenario(name, vp, run, { reduced = false } = {}) {
  const page = await browser.newPage(); const errors = []
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/404|favicon|Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.setViewport(viewports[vp]); if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  const recorder = await page.screencast({ path: resolve(out, name + '.webm'), ffmpegPath: '/opt/homebrew/bin/ffmpeg' })
  try { await run(page, (l, ok, d) => check(name, l, ok, d)) } catch (e) { check(name, 'scenario completato', false, String(e).slice(0, 300)) } finally { await sleep(400); await recorder.stop(); check(name, 'nessun errore in pagina', errors.length === 0, errors.slice(0, 3)); await page.close() }
}
const text = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.trim()))

try {
  for (const vp of ['desktop', 'mobile']) await scenario(`pubblico-${vp}`, vp, async (page, ok) => {
    await page.goto(origin + '/public.html?t=now&lang=it', { waitUntil: 'networkidle0' }); await sleep(900)
    const row = 'article[data-item-id="00000000-0000-4000-8000-000000000010"]'
    ok('prezzo pieno barrato 12,00 €', (await page.$eval(row + ' s[data-full-price]', e => [e.textContent, getComputedStyle(e).textDecorationLine])).join('|').match(/12,00.*line-through/))
    ok('promo accanto 9,00 €', (await page.$eval(row + ' [data-promo-price]', e => e.textContent)).includes('9,00'))
    ok('etichette Promo + Ultime porzioni', (await text(page, row + ' [data-sales-tags] span')).join('|') === 'Promo|Ultime porzioni')
    const openDolci = async () => { if (await page.$('article[data-item-id="00000000-0000-4000-8000-000000000020"]')) return; const b = await page.evaluateHandle(() => [...document.querySelectorAll('button,a')].find(e => /^(dolci|desserts)/i.test(e.textContent.trim()))); if (b.asElement()) { await b.asElement().click(); await sleep(700) } }
    await page.screenshot({ path: resolve(out, `pubblico-${vp}-adesso-primi.png`) })
    await openDolci()
    ok('Tiramisù: Solo oggi', (await text(page, 'article[data-item-id="00000000-0000-4000-8000-000000000020"] [data-sales-tags] span')).join('|') === 'Solo oggi')
    ok('promo non valida (5,50 su 5,00) non mostrata', (await page.$('article[data-item-id="00000000-0000-4000-8000-000000000021"]')) !== null && (await page.$('article[data-item-id="00000000-0000-4000-8000-000000000021"] [data-promo-price]')) === null)
    ok('etichette ferme: nessuna animazione/transizione', await page.$$eval('[data-sales-tags] span', els => els.every(e => e.getAnimations().length === 0 && getComputedStyle(e).animationName === 'none')))
    ok('etichette sobrie: colore del testo, non arancione', await page.$$eval('[data-sales-tags] span', els => els.every(e => !/rgb\(237, 114, 91\)/.test(getComputedStyle(e).color))))
    await page.screenshot({ path: resolve(out, `pubblico-${vp}-adesso-dolci.png`) })
    await page.goto(origin + '/public.html?t=now&lang=en', { waitUntil: 'networkidle0' }); await sleep(700)
    ok('inglese: Offer · Last portions', (await text(page, '[data-sales-tags] span')).join('|').startsWith('Offer|Last portions'))
    await openDolci(); ok('inglese: Today only', (await text(page, '[data-sales-tags] span')).includes('Today only'))
    await page.goto(origin + '/public.html?t=later&lang=it', { waitUntil: 'networkidle0' }); await sleep(700)
    ok('lunedì 07:00: promo «fino a domenica» sparita', (await page.$('article[data-item-id="00000000-0000-4000-8000-000000000010"] [data-promo-price]')) === null)
    ok('lunedì 07:00: Ultime porzioni resta, promo senza fine resta', (await text(page, '[data-sales-tags] span')).join('|') === 'Ultime porzioni|Promo')
    await page.screenshot({ path: resolve(out, `pubblico-${vp}-lunedi.png`) })
    await openDolci(); ok('lunedì 07:00: Solo oggi sparito', !(await text(page, '[data-sales-tags] span')).includes('Solo oggi') && (await page.$('article[data-item-id="00000000-0000-4000-8000-000000000020"]')) !== null)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok('nessuno scroll orizzontale', overflow <= 0, overflow)
  })

  for (const [name, f] of [['pdf-adesso', 'menu-now.pdf'], ['pdf-adesso-en', 'menu-now-en.pdf'], ['pdf-lunedi', 'menu-later.pdf']]) await scenario(name, 'desktop', async (page, ok) => {
    await page.goto(origin + '/pdf.html?f=' + f); await page.waitForSelector('body[data-ready="1"]', { timeout: 20000 }); await sleep(300)
    const canvas = await page.$('#c'); await canvas.screenshot({ path: resolve(out, name + '.png') }); ok('pagina 1 renderizzata', true)
  })

  for (const [name, vp, mode] of [['drawer-desktop', 'desktop', 'pointer'], ['drawer-mobile', 'mobile', 'touch'], ['drawer-reduced', 'desktop', 'reduced'], ['drawer-keyboard', 'desktop', 'keyboard']]) await scenario(name, vp, async (page, ok) => {
    await page.goto(origin + '/drawer.html', { waitUntil: 'networkidle0' }); await sleep(400)
    const promo = 'input[placeholder="Nessuna promo"]', tap = async sel => { if (mode === 'touch') await page.tap(sel); else await page.click(sel) }
    if (mode === 'keyboard') { await page.focus(promo) } else await tap(promo)
    await page.keyboard.type('13', { delay: 60 }); await sleep(250)
    const invalidState = [await page.$eval(promo, e => e.getAttribute('aria-invalid')), await page.$eval('.mw-sales-note', e => e.className + ' ' + e.textContent)]
    ok('13 su 12: errore visibile, aria-invalid', invalidState[0] === 'true' && invalidState[1].includes('is-visible') && invalidState[1].includes('più basso del prezzo pieno'), invalidState)
    ok('13 su 12: niente promo nel documento', await page.evaluate(() => window.__item.promo === undefined))
    const noteTransition = await page.$eval('.mw-sales-note', e => getComputedStyle(e).transitionDuration)
    ok(mode === 'reduced' ? 'reduced motion: nessuna transizione' : 'nota con token micro 140ms', mode === 'reduced' ? noteTransition === '0s' : noteTransition === '0.14s', noteTransition)
    // input rapidi: cancella e riscrive senza attese
    for (let i = 0; i < 2; i++) await page.keyboard.press('Backspace')
    await page.keyboard.type('9', { delay: 15 }); await sleep(200)
    ok('9 su 12: promo salvata', await page.evaluate(() => JSON.stringify(window.__item.promo)) === '{"price":9,"until":null}')
    ok('segno «Promo 9,00 €» sulla riga', (await text(page, '.mw-sales-mark')).join('|').includes('Promo 9,00'))
    await page.$eval('input[type=date]', e => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(e, '2099-10-18'); e.dispatchEvent(new Event('input', { bubbles: true })) }); await sleep(200)
    ok('fine promo salvata', await page.evaluate(() => window.__item.promo?.until) === '2099-10-18')
    const boxes = await page.$$('.mw-sales input[type=checkbox]')
    if (mode === 'keyboard') { await boxes[0].focus(); await page.keyboard.press('Space'); await page.keyboard.press('Tab'); await page.keyboard.press('Space') } else { await (mode === 'touch' ? boxes[0].tap() : boxes[0].click()); await (mode === 'touch' ? boxes[1].tap() : boxes[1].click()) }
    await sleep(250)
    ok('Ultime porzioni + Solo oggi nel documento', await page.evaluate(() => window.__item.scarcity?.lastPortions === true && typeof window.__item.scarcity?.onlyToday === 'string'))
    ok('segni sulla riga', (await text(page, '.mw-sales-mark')).join('|').endsWith('Ultime porzioni|Solo oggi'))
    if (mode === 'keyboard') ok('focus visibile sul controllo', await page.evaluate(() => document.activeElement?.matches('input[type=checkbox]') && getComputedStyle(document.activeElement).outlineStyle !== 'none'))
    ok('aree tocco ≥ 44px', await page.$$eval('.mw-sales .mw-check', els => els.every(e => e.getBoundingClientRect().height >= 44)))
    // passaggio a esaurito
    const sold = await page.$('.mw-inline-inspector > .mw-check input'); await (mode === 'touch' ? sold.tap() : sold.click()); await sleep(250)
    ok('esaurito: Ultime porzioni tolta, interruttore disattivato', await page.evaluate(() => !window.__item.scarcity?.lastPortions) && await page.$eval('.mw-sales input[type=checkbox]', e => e.disabled && !e.checked))
    await page.screenshot({ path: resolve(out, name + '.png') })
    // togliere la promo svuotando il campo
    await page.click(promo, { clickCount: 3 }); await page.keyboard.press('Backspace'); await sleep(200)
    ok('campo vuoto: promo tolta', await page.evaluate(() => window.__item.promo === undefined))
  }, { reduced: mode === 'reduced' })
} finally {
  await browser.close(); server.close(); await rm(work, { recursive: true, force: true })
  await writeFile(resolve(out, 'checks.json'), JSON.stringify(checks, null, 1))
  const failed = checks.filter(c => !c.ok); console.log(`\n${checks.length - failed.length}/${checks.length} PASS`); if (failed.length) process.exitCode = 1
}
