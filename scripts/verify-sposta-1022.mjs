// 22/10 notte — pulsante «Sposta» + piatti che si spostano (bug isControl su <button aria-disabled>). Banco di
// verify-menu-editor-dashboard.mjs (SPA vera, renderer + layer veri, API finta: nessuna scrittura reale). Chrome headless,
// iPhone emulato 390 DPR 3, tocchi CDP reali con tremolio ±5 px. Uscita: docs/webapp/dashboard-editor-2026-10-22/sposta-1022/
import {startHarness,frameOf,wait,waitFor,U} from './verify-menu-editor-dashboard.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(repo,'docs/webapp/dashboard-editor-2026-10-22/sposta-1022')
await mkdir(OUT,{recursive:true});process.env.PATH='/opt/homebrew/bin:'+process.env.PATH
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const {fixture}=await import('./verify-menu-editor-dashboard.mjs')
const H=await startHarness({shell:true});const results=[];let fails=0
const check=(name,cond,detail='')=>{results.push({name,ok:!!cond,detail});if(!cond)fails++;console.log(cond?'✓':'✗',name,detail?JSON.stringify(detail):'')}
const PHOTO='https://takoitalia.com/icon-192.png'
const fx=()=>{const d=fixture();for(const s of d.menus[0].sections)for(const i of s.items)i.imageUrl=PHOTO;return d}
Object.assign(H.srv,{doc:fx(),published:fx(),revision:3,publishedRevision:3,fail:[],offline:false,flag:true,botConflicts:[]})
const page=await H.browser.newPage()
await page.emulate({viewport:{width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true},userAgent:UA})
const cdp=await page.createCDPSession()
await page.goto(H.base);await page.evaluate(()=>window.__mount());await page.waitForSelector('.mw-ed-stage')
const f=await frameOf(page);await f.waitForSelector('[data-menu-edit-root] [data-edit-id]',{timeout:20000});await wait(1200)
const rec=await page.screencast({path:resolve(OUT,'390-sposta.webm')}).catch(e=>{console.log('screencast non disponibile',e.message);return null})
const sleep=wait
const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,radiusX:8,radiusY:8,force:1}]})
// Centro di un elemento dell'iframe → coordinate della pagina (l'iframe è rimpicciolito dalla SPA).
async function at(sel,inFrame=true){
  if(!inFrame)return page.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}},sel)
  const fr=await page.evaluate(()=>{const e=document.querySelector('iframe[src*="/menu-preview/"]')||[...document.querySelectorAll('iframe')].find(i=>i.contentWindow?.location.pathname.includes('/menu-preview/'));const r=e.getBoundingClientRect();return{l:r.left,t:r.top,s:r.width/e.clientWidth}})
  const r=await f.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}},sel)
  if(!r)throw new Error('assente: '+sel)
  return{x:fr.l+r.x*fr.s,y:fr.t+r.y*fr.s,w:r.w*fr.s,h:r.h*fr.s}
}
async function scrollInto(sel){await f.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center'}),sel);await sleep(250)}
async function tap(p){await touch('touchStart',p.x,p.y);await sleep(70);await touch('touchEnd');await sleep(350)}
async function drag(from,to,steps=20){await touch('touchStart',from.x,from.y);await sleep(60);for(let k=1;k<=steps;k++){const j=k%2?5:-5;await touch('touchMove',from.x+(to.x-from.x)*k/steps+j,from.y+(to.y-from.y)*k/steps+(k%3?2.5:-5));await sleep(30)}await touch('touchMove',to.x,to.y);await sleep(80);await touch('touchEnd');await sleep(900)}
const jiggle=()=>f.evaluate(()=>!!document.querySelector('[data-edit-jiggle]'))
const sec=id=>H.srv.doc.menus[0].sections.find(s=>s.id===id)
const fine=async()=>{const b=await page.evaluate(()=>{const b=[...document.querySelectorAll('.mw-swap-btn')].find(x=>x.textContent.includes('Fine'));if(!b)return null;const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}});if(b)await tap(b);return !!b}
try{
  { const pid=await f.evaluate(()=>[...document.querySelectorAll('[data-edit-kind="submenu"]')].find(x=>x.textContent.includes('Secondi'))?.getAttribute('data-edit-id'))
    await tap(await at(`[data-edit-id="${pid}"]`));await sleep(500)
    const on=await f.evaluate(id=>document.querySelector(`[data-edit-id="${id}"]`).getAttribute('aria-pressed'),pid)
    console.log('info (preesistente, fuori perimetro): tocco CDP su pillola fuori dal tremolio cambia pagina?',on)
    const first=await f.evaluate(()=>document.querySelector('[data-edit-kind="submenu"]').getAttribute('data-edit-id'));await f.evaluate(id=>document.querySelector(`[data-edit-id="${id}"]`).click(),first);await sleep(600) }
  // 1. Tap piatto → Modifica a destra, Sposta a sinistra, ≥ 44 px reali
  const dishSel=`[data-edit-id="${U(100)}"]`;await scrollInto(dishSel)
  check('piatto con foto nel DOM',await f.evaluate(s=>!!document.querySelector(s+' img'),dishSel))
  await tap(await at(dishSel+' h3'))
  const ui=await f.evaluate(()=>{const R=e=>{if(!e||e.classList.contains('tako-edit-hidden'))return null;const r=e.getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,h:r.height,w:r.width}};return{pen:R(document.querySelector('[data-edit-pencil]')),move:R(document.querySelector('[data-edit-move]')),frame:R(document.querySelector('[data-edit-frame]')),txt:document.querySelector('[data-edit-move]')?.textContent}})
  const sc=(await at(dishSel)).w/(await f.evaluate(s=>document.querySelector(s).getBoundingClientRect().width,dishSel))
  check('tap piatto → «Modifica» (dx) e «Sposta» (sx) visibili',ui.pen&&ui.move&&ui.move.r<=ui.pen.l&&ui.txt==='Sposta'&&ui.move.l<ui.frame.l+40,ui)
  check('«Sposta» ≥ 44 px reali',ui.move&&ui.move.h*sc>=43.5,{h:ui.move&&ui.move.h*sc})
  await page.screenshot({path:resolve(OUT,'390-01-sposta-visibile.png')})
  // 2. Sposta → tremolio, Fine visibile
  await tap(await at('[data-edit-move]'))
  check('«Sposta» → tremolio senza pressione lunga',await jiggle())
  check('«Fine» nella SPA',await page.evaluate(()=>[...document.querySelectorAll('.mw-swap-btn')].some(x=>x.textContent.includes('Fine'))))
  await page.screenshot({path:resolve(OUT,'390-02-tremolio.png')})
  // 3. Piatto nella stessa Sezione (Pasta → dopo Lasagna)
  const a=await at(`[data-edit-id="${U(100)}"] h3`),b=await at(`[data-edit-id="${U(102)}"]`)
  await drag(a,{x:a.x,y:b.y+b.h*.3})
  await waitFor(()=>sec(U(10)).items.at(-1).id===U(100),6000,'piatto in fondo alla Sezione').catch(()=>{})
  check('PIATTO trascinato nella stessa Sezione → bozza aggiornata',sec(U(10)).items.at(-1).id===U(100),sec(U(10)).items.map(i=>i.name))
  check('ancora in tremolio dopo il rilascio',await jiggle())
  // 4. Piatto in un'altra Sezione (Lasagna → Contorni)
  // Le pillole sono pagine: si va su «Secondi» (fuori dal tremolio un tocco cambia pagina), poi di nuovo Sposta dal piatto.
  await fine();await sleep(400)
  const pill=await f.evaluate(()=>{const e=[...document.querySelectorAll('[data-edit-kind="submenu"]')].find(x=>x.textContent.includes('Secondi'));return e?.getAttribute('data-edit-id')})
  await f.evaluate(id=>document.querySelector(`[data-edit-id="${id}"]`).click(),pill);await sleep(700)
  await scrollInto(`[data-edit-id="${U(130)}"]`);await tap(await at(`[data-edit-id="${U(110)}"] h3`));await tap(await at('[data-edit-move]'))
  check('«Sposta» di nuovo → tremolio',await jiggle())
  const c=await at(`[data-edit-id="${U(111)}"] h3`),d=await at(`[data-edit-id="${U(130)}"]`)
  await drag(c,{x:c.x,y:d.y+d.h*.3},26)
  await waitFor(()=>sec(U(13)).items.some(i=>i.id===U(111)),6000,'piatto in altra Sezione').catch(()=>{})
  check('PIATTO trascinato in un\'altra Sezione → bozza aggiornata',sec(U(13)).items.some(i=>i.id===U(111))&&!sec(U(11)).items.some(i=>i.id===U(111)),{secondi:sec(U(11)).items.map(i=>i.name),diMare:sec(U(13)).items.map(i=>i.name)})
  await page.screenshot({path:resolve(OUT,'390-03-piatti-spostati.png')})
  // 5. Sottomenu (pillola)
  await f.evaluate(()=>scrollTo(0,0));await sleep(300)
  const pills=await f.evaluate(()=>[...document.querySelectorAll('[data-edit-kind="submenu"]')].map(e=>e.getAttribute('data-edit-id')))
  const order0=H.srv.doc.menus.find(m=>m.id===U(1)).sections.filter(s=>!s.parentSectionId).map(s=>s.name)
  if(pills.length>=2){const p0=await at(`[data-edit-id="${pills[0]}"]`),p1=await at(`[data-edit-id="${pills[pills.length-1]}"]`);await drag(p0,{x:p1.x+p1.w*.3,y:p1.y})
    await waitFor(()=>JSON.stringify(H.srv.doc.menus.find(m=>m.id===U(1)).sections.filter(s=>!s.parentSectionId).map(s=>s.name))!==JSON.stringify(order0),6000,'pillola').catch(()=>{})}
  const order1=H.srv.doc.menus.find(m=>m.id===U(1)).sections.filter(s=>!s.parentSectionId).map(s=>s.name)
  check('Sottomenu trascinato col solo movimento → ordine cambiato',JSON.stringify(order1)!==JSON.stringify(order0),{pills:pills.length,order0,order1})
  // 6. Menu
  const menus=await f.evaluate(()=>[...document.querySelectorAll('[data-edit-kind="menu"]')].map(e=>e.getAttribute('data-edit-id')))
  const m0=H.srv.doc.menus.map(m=>m.name)
  if(menus.length>=2){const p0=await at(`[data-edit-id="${menus[0]}"]`),p1=await at(`[data-edit-id="${menus[1]}"]`);await drag(p0,{x:p1.x+p1.w*.35,y:p1.y})
    await waitFor(()=>JSON.stringify(H.srv.doc.menus.map(m=>m.name))!==JSON.stringify(m0),6000,'menu').catch(()=>{})}
  check('Menu trascinato col solo movimento → ordine cambiato',JSON.stringify(H.srv.doc.menus.map(m=>m.name))!==JSON.stringify(m0),{menus:menus.length,m0,m1:H.srv.doc.menus.map(m=>m.name)})
  // 7. Fine
  check('«Fine» trovato',await fine());await sleep(400)
  check('«Fine» esce dal tremolio',!(await jiggle()))
  check('nessun residuo (ghost/opacità 0)',await f.evaluate(()=>document.querySelectorAll('[data-menu-gesture-ghost],[data-edit-id][style*="opacity: 0"]').length===0))
  // 8. Scroll normale fuori dal tremolio (parte su un piatto)
  const y0=await f.evaluate(()=>scrollY),s0=await at(`[data-edit-id="${U(110)}"]`).catch(()=>at('[data-edit-id]'))
  await touch('touchStart',s0.x,s0.y);for(let k=1;k<=8;k++){await touch('touchMove',s0.x,s0.y-k*25);await sleep(16)}await touch('touchEnd');await sleep(1200)
  const y1=await f.evaluate(()=>scrollY)
  check('scroll normale fuori dal tremolio: scorre, nessun tremolio',y1>y0+40&&!(await jiggle()),{y0,y1})
  // 9. Pressione lunga ancora valida
  const lp=await at(`[data-edit-id="${U(110)}"] h3`).catch(()=>at('[data-edit-kind="dish"] h3'))
  await touch('touchStart',lp.x,lp.y);const t0=Date.now();let k=0;while(Date.now()-t0<1200){await sleep(40);k++;await touch('touchMove',lp.x+(k%2?5:-5),lp.y+(k%3?2.5:-5))}
  check('pressione lunga 1 s con tremolio ±5 px → solleva (piatto)',await f.evaluate(()=>!!document.querySelector('[data-menu-gesture-ghost]'))&&await jiggle())
  await touch('touchEnd');await sleep(1200);await fine();await sleep(400)
  check('Fine dopo pressione lunga',!(await jiggle()))
  await page.screenshot({path:resolve(OUT,'390-04-fine.png')})
}catch(e){check('eccezione',false,e.message)}
if(rec)await rec.stop().catch(()=>{})
await writeFile(resolve(OUT,'esito.json'),JSON.stringify({fails,results},null,1))
await H.close?.();await H.browser?.close?.().catch(()=>{})
console.log(fails?`✗ ${fails} falliti`:'✓ tutto verde');process.exit(fails?1:0)
