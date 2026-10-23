// 23/10 — matita a cerchio, menu a prezzo fisso su una pagina (niente pillole), testi del riquadro prezzi più grandi.
// lente e «+» in testata, niente «Avanzate». Banco di verify-menu-editor-dashboard.mjs (SPA vera, renderer + layer veri,
// API finta: nessuna scrittura reale). Chrome headless: iPhone 390×844 e 430×932 DPR 3 touch (tocchi CDP con tremolio) + 1280.
// Banco di verify-menu-editor-dashboard.mjs (SPA vera, renderer + layer veri, API finta). iPhone 390/430 DPR 3 touch CDP + 1280.
import {startHarness,frameOf,wait,waitFor,U,fixture} from './verify-menu-editor-dashboard.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(repo,'docs/webapp/dashboard-editor-2026-10-22/fisso-pagina-1023/editor')
await mkdir(OUT,{recursive:true});process.env.PATH='/opt/homebrew/bin:'+process.env.PATH
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const results=[];let fails=0
const check=(name,cond,detail='')=>{results.push({name,ok:!!cond,detail});if(!cond)fails++;console.log(cond?'✓':'✗',name,detail!==''?JSON.stringify(detail):'')}
const item=(n,name,extra={})=>({id:U(n),name,description:null,price:0,imageUrl:null,allergens:[],tags:[],additives:[],available:true,hidden:false,featured:false,displayMode:'normal',variants:[],translations:{},...extra})
const section=(n,name,items,extra={})=>({id:U(n),parentSectionId:null,name,description:null,active:true,translations:{},items,...extra})
const fx=()=>{const d=fixture()
 d.menus=[
  {id:U(1),name:'Menu del giorno',description:null,type:'lunch',active:true,translations:{},pricing:'fisso',included:'Acqua e caffè',
   formulas:[{id:'f-completo',name:'Completo',price:15,note:'Primo e secondo',sectionIds:[U(10),U(11)]},{id:'f-primo',name:'Solo primo',price:10,sectionIds:[U(10)]},{id:'f-secondo',name:'Solo secondo',price:11,sectionIds:[U(11)]}],
   sections:[section(10,'Primi',[item(100,'Pasta al pomodoro',{description:'Pomodoro e basilico'}),item(101,'Risotto ai funghi',{hidden:true}),item(102,'Lasagna')]),
    section(11,'Secondi',[item(110,'Pollo arrosto'),item(111,'Cotoletta')]),
    section(12,'Contorni',[item(120,'Patate al forno'),item(121,'Insalata mista')])]},
  {id:U(2),name:'Alla carta',description:null,type:'main',active:true,translations:{},sections:[
   section(20,'Pizze',[item(200,'Margherita',{price:7}),item(201,'Diavola',{price:8}),item(202,'Capricciosa',{price:9})]),
   section(21,'Antipasti',[item(210,'Bruschetta',{price:5}),item(211,'Tagliere',{price:12})])]}]
 return d}
const H=await startHarness({shell:true})
const reset=()=>Object.assign(H.srv,{doc:fx(),published:fx(),revision:3,publishedRevision:3,fail:[],offline:false,flag:true,botConflicts:[]})
const menuOf=id=>H.srv.doc.menus.find(m=>m.id===id),sec=(m,id)=>menuOf(m).sections.find(s=>s.id===id)
const sleep=wait

async function phone(width,height,tag,full){
 reset();const errs=[]
 const page=await H.browser.newPage()
 page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|favicon|ERR_|net::/.test(m.text()))errs.push(m.text())})
 page.on('dialog',d=>d.accept())
 await page.emulate({viewport:{width,height,deviceScaleFactor:3,isMobile:true,hasTouch:true},userAgent:UA})
 const cdp=await page.createCDPSession()
 await page.goto(H.base);await page.evaluate(()=>window.__mount());await page.waitForSelector('.mw-ed-stage')
 let f=await frameOf(page);await f.waitForSelector('[data-menu-edit-root] [data-edit-id]',{timeout:20000});await sleep(1200)
 const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,radiusX:8,radiusY:8,force:1}]})
 async function at(sel){
  const fr=await page.evaluate(()=>{const e=document.querySelector('iframe.mw-ed-frame');const r=e.getBoundingClientRect();return{l:r.left,t:r.top,s:r.width/e.clientWidth}})
  const r=await f.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}},sel)
  if(!r)throw new Error('assente: '+sel)
  return{x:fr.l+r.x*fr.s,y:fr.t+r.y*fr.s,w:r.w*fr.s,h:r.h*fr.s}}
 const box=sel=>page.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height}},sel)
 async function tap(p){await touch('touchStart',p.x,p.y);await sleep(70);await touch('touchEnd');await sleep(400)}
 const jiggle=()=>f.evaluate(()=>!!document.querySelector('[data-edit-jiggle]'))
 const fine=async()=>{const b=await page.evaluate(()=>{const b=[...document.querySelectorAll('.mw-swap-btn')].find(x=>x.textContent.includes('Fine'));if(!b)return null;const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}});if(b)await tap(b);await sleep(400);return !!b}
 // Pressione lunga col dito che trema, poi trascinamento; a metà: foto + misura del sollevato.
 async function longDrag(from,to,shot){
  await touch('touchStart',from.x,from.y);const t0=Date.now();let k=0;while(Date.now()-t0<1150){await sleep(40);k++;await touch('touchMove',from.x+(k%2?4:-4),from.y+(k%3?2:-4))}
  const steps=22;let mid=null
  for(let s=1;s<=steps;s++){const j=s%2?4:-4;await touch('touchMove',from.x+(to.x-from.x)*s/steps+j,from.y+(to.y-from.y)*s/steps+(s%3?2:-4));await sleep(32)
   if(s===Math.round(steps/2)){mid=await f.evaluate(()=>{const g=document.querySelector('[data-menu-gesture-ghost]');if(!g)return null;const c=getComputedStyle(g);const b=g.getBoundingClientRect();return{inside:b.left>=0&&b.right<=innerWidth,glass:g.hasAttribute('data-gesture-glass'),r:[c.borderTopLeftRadius,c.borderTopRightRadius,c.borderBottomLeftRadius,c.borderBottomRightRadius],bf:c.backdropFilter||c.webkitBackdropFilter,bg:c.backgroundImage,sh:c.boxShadow}});if(shot)await page.screenshot({path:resolve(OUT,shot)})}}
  await touch('touchMove',to.x,to.y);await sleep(90);await touch('touchEnd');await sleep(1000);return mid}
 const inv=await f.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tako-edit-inv'))||1)
 const rec=full?await page.screencast({path:resolve(OUT,`${tag}-fisso-una-pagina.webm`)}).catch(e=>{console.log('screencast non disponibile',e.message);return null}):null
 try{
  check(`${tag} nessuno scroll orizzontale`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth))
  // ── Prezzo fisso su UNA pagina
  const dom=await f.evaluate(()=>({box:!!document.querySelector('[data-fixed-price-box]'),pills:document.querySelectorAll('[data-category]').length,h2:[...document.querySelectorAll('[data-category-page] section h2')].map(h=>h.textContent.trim()),subs:[...document.querySelectorAll('[data-edit-kind="submenu"]')].map(e=>e.getAttribute('data-edit-group')),dishGroups:[...new Set([...document.querySelectorAll('[data-edit-kind="dish"]')].map(e=>e.getAttribute('data-edit-group')))].length,formula:document.querySelectorAll('[data-edit-id^="formula~"]').length,
   sizes:{name:getComputedStyle(document.querySelector('[data-formula-name]')).fontSize,price:getComputedStyle(document.querySelector('[data-formula-price]')).fontSize,note:getComputedStyle(document.querySelector('[data-formula-note]')).fontSize,inc:getComputedStyle(document.querySelector('[data-menu-included]')).fontSize},boxAbove:document.querySelector('[data-fixed-price-box]').getBoundingClientRect().bottom<=document.querySelector('[data-category-page] section').getBoundingClientRect().top}))
  check(`${tag} prezzo fisso: riquadro + Primi/Secondi/Contorni in sequenza, niente pillole`,dom.box&&dom.pills===0&&JSON.stringify(dom.h2)===JSON.stringify(['Primi','Secondi','Contorni'])&&dom.boxAbove&&dom.formula===0,dom)
  check(`${tag} Sottomenu trascinabili su/giù (gruppo pills:menu) e 3 gruppi di piatti`,dom.subs.length===3&&dom.subs.every(g=>g==='pills:'+U(1))&&dom.dishGroups===3,dom)
  check(`${tag} riquadro prezzi: nome 18 / prezzo 19 / note 15 px`,dom.sizes.name==='18px'&&dom.sizes.price==='19px'&&dom.sizes.note==='15px'&&dom.sizes.inc==='15px',dom.sizes)
  await page.screenshot({path:resolve(OUT,`${tag}-01-prezzo-fisso-una-pagina.png`)})
  // ── Matita a cerchio
  await f.evaluate(id=>document.querySelector(`[data-edit-id="${id}"]`).scrollIntoView({block:'center'}),U(101));await sleep(300)
  for(let t=0;t<3;t++){await tap(await at(`[data-edit-id="${U(101)}"] h3`));await sleep(300);if(await f.evaluate(()=>!document.querySelector('[data-edit-pencil]').classList.contains('tako-edit-hidden')))break}
  const pen=await f.evaluate(()=>{const p=document.querySelector('[data-edit-pencil]'),d=p.querySelector('.tako-edit-pencil-dot'),fr=document.querySelector('[data-edit-frame]').getBoundingClientRect(),r=p.getBoundingClientRect(),q=d.getBoundingClientRect();return{w:r.width,h:r.height,dw:q.width,dh:q.height,radius:getComputedStyle(d).borderRadius,text:p.textContent.trim(),label:p.getAttribute('aria-label'),cx:q.left+q.width/2,cy:q.top+q.height/2,fr:{r:fr.right,t:fr.top,l:fr.left}}})
  const sc=await page.evaluate(()=>{const e=document.querySelector('iframe.mw-ed-frame');return e.getBoundingClientRect().width/e.clientWidth})
  check(`${tag} matita: solo cerchio (~32–36 px visivi), tocco ≥44 px reali, senza testo, aria-label «Modifica …nome»`,pen.text===''&&pen.dw*sc>=31&&pen.dw*sc<=37&&Math.abs(pen.dw-pen.dh)<0.5&&pen.w*sc>=44&&pen.h*sc>=44&&/^Modifica .*Risotto ai funghi/.test(pen.label),{...pen,sc,visual:pen.dw*sc,touch:pen.w*sc})
  check(`${tag} matita in alto a destra del riquadro`,Math.abs(pen.cy-pen.fr.t)<pen.dh&&pen.cx>pen.fr.l+(pen.fr.r-pen.fr.l)*.7&&pen.cx<=pen.fr.r+2,pen)
  await page.screenshot({path:resolve(OUT,`${tag}-02-matita-cerchio.png`)})
  await sleep(450);await tap(await at('[data-edit-pencil]'));await sleep(900)
  const sheet=await page.evaluate(()=>{const d=document.querySelector('.mw-drawer,.mw-bottom-sheet,[role=dialog]');return d?d.textContent:''})
  check(`${tag} tocco sulla matita → si apre «Modifica piatto»`,/Risotto ai funghi|Modifica piatto|Esaurito/.test(sheet),sheet.slice(0,200))
  await page.screenshot({path:resolve(OUT,`${tag}-03-matita-aperta.png`)})
  await page.keyboard.press('Escape');await page.evaluate(()=>document.querySelector('.mw-sheet-close,[aria-label^="Chiudi"]')?.click());await sleep(700)
  // ── Piatto da Primi a Secondi (pressione lunga + trascinamento tra sezioni)
  await f.evaluate(id=>document.querySelector(`[data-edit-id="${id}"]`).scrollIntoView({block:'center'}),U(102));await sleep(300)
  const a=await at(`[data-edit-id="${U(102)}"] h3`),b=await at(`[data-edit-id="${U(110)}"]`)
  await longDrag(a,{x:a.x,y:b.y+b.h*.3},`${tag}-04-piatto-tra-sezioni.png`)
  await waitFor(()=>sec(U(1),U(11)).items.some(i=>i.id===U(102)),6000).catch(()=>{})
  check(`${tag} piatto Lasagna: Primi → Secondi`,sec(U(1),U(11)).items.some(i=>i.id===U(102))&&!sec(U(1),U(10)).items.some(i=>i.id===U(102)),{primi:sec(U(1),U(10)).items.map(i=>i.name),secondi:sec(U(1),U(11)).items.map(i=>i.name)})
  await fine()
  // ── Sezione Contorni su sopra Secondi (pressione lunga sul titolo, asse y)
  await f.evaluate(id=>document.querySelector(`[data-edit-select="section:${id}"]`).scrollIntoView({block:'center'}),U(11));await sleep(300)
  const order0=menuOf(U(1)).sections.map(s=>s.name)
  const c=await at(`[data-edit-select="section:${U(12)}"]`),dd=await at(`[data-edit-select="section:${U(11)}"]`)
  const smid=await longDrag(c,{x:c.x,y:dd.y-dd.h*.6},`${tag}-05-sezione-meta-trascinamento.png`)
  await waitFor(()=>JSON.stringify(menuOf(U(1)).sections.map(s=>s.name))!==JSON.stringify(order0),6000).catch(()=>{})
  const order1=menuOf(U(1)).sections.map(s=>s.name)
  check(`${tag} Sottomenu Contorni spostato su (prima di Secondi)`,order1.indexOf('Contorni')<order1.indexOf('Secondi'),{order0,order1,smid})
  await fine()
  const h2b=await f.evaluate(()=>[...document.querySelectorAll('[data-category-page] section h2')].map(h=>h.textContent.trim()))
  check(`${tag} la pagina segue il nuovo ordine`,JSON.stringify(h2b)===JSON.stringify(['Primi','Contorni','Secondi']),h2b)
  check(`${tag} «Fine» esce dal tremolio, nessun residuo`,!(await jiggle())&&await f.evaluate(()=>document.querySelectorAll('[data-menu-gesture-ghost]').length===0))
  check(`${tag} nessuno scroll orizzontale (dopo)`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  // ── Alla carta invariato: pillole come oggi
  await page.evaluate(()=>document.querySelector('.mw-menu-picker').click());await sleep(300)
  await page.evaluate(()=>[...document.querySelectorAll('.mw-menu-options button')].find(b=>b.textContent.includes('Alla carta')).click());await sleep(1500)
  f=await frameOf(page);await f.waitForSelector(`[data-edit-id="${U(20)}"]`,{timeout:8000})
  const carta=await f.evaluate(()=>({pills:[...document.querySelectorAll('[data-category]')].map(b=>b.textContent.trim()),box:!!document.querySelector('[data-fixed-price-box]'),h2:[...document.querySelectorAll('[data-category-page] section h2')].map(h=>h.textContent.trim())}))
  check(`${tag} Alla carta: pillole come prima, una pagina per pillola`,carta.pills.length===2&&!carta.box&&carta.h2.length===1,carta)
  await page.screenshot({path:resolve(OUT,`${tag}-06-alla-carta.png`)})
 }catch(e){check(`${tag} eccezione`,false,e.message)}
 if(rec)await rec.stop().catch(()=>{})
 check(`${tag} nessun errore console`,errs.length===0,errs)
 await page.close()
}

async function desktop(){
 reset();const errs=[]
 const page=await H.browser.newPage()
 page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|favicon|ERR_|net::/.test(m.text()))errs.push(m.text())})
 page.on('dialog',d=>d.accept())
 await page.setViewport({width:1280,height:900,deviceScaleFactor:1})
 await page.goto(H.base);await page.evaluate(()=>window.__mount());await page.waitForSelector('.mw-ed-stage')
 const f=await frameOf(page);await f.waitForSelector('[data-menu-edit-root] [data-edit-id]',{timeout:20000});await sleep(1200)
 try{
  const dom=await f.evaluate(()=>({box:!!document.querySelector('[data-fixed-price-box]'),pills:document.querySelectorAll('[data-category]').length,h2:[...document.querySelectorAll('[data-category-page] section h2')].map(h=>h.textContent.trim())}))
  check('1280 prezzo fisso su una pagina',dom.box&&dom.pills===0&&dom.h2.length===3,dom)
  check('1280 nessuno scroll orizzontale',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await f.evaluate(id=>document.querySelector(`[data-edit-id="${id}"]`).click(),U(100));await sleep(500)
  const pen=await f.evaluate(()=>{const p=document.querySelector('[data-edit-pencil]');const r=p.getBoundingClientRect(),d=p.querySelector('.tako-edit-pencil-dot').getBoundingClientRect();return{hidden:p.classList.contains('tako-edit-hidden'),w:r.width,dw:d.width,text:p.textContent.trim()}})
  check('1280 matita a cerchio 32 px senza testo',!pen.hidden&&pen.text===''&&Math.round(pen.dw)===32,pen)
  await page.screenshot({path:resolve(OUT,'1280-01-prezzo-fisso-matita.png')})
  await f.evaluate(()=>document.querySelector('[data-edit-pencil]').click());await sleep(800)
  check('1280 click sulla matita → apre il pannello',await page.evaluate(()=>!!document.querySelector('.mw-drawer,.mw-bottom-sheet,[role=dialog],.mw-ed-popover')))
 }catch(e){check('1280 eccezione',false,e.message)}
 check('1280 nessun errore console',errs.length===0,errs)
 await page.close()
}

try{await phone(390,844,'390',true);await phone(430,932,'430',false);await desktop()}
finally{await writeFile(resolve(OUT,'esito.json'),JSON.stringify({fails,results},null,1));await H.close?.().catch(()=>{})}
console.log(fails?`✗ ${fails} falliti`:'✓ tutto verde');process.exit(fails?1:0)
