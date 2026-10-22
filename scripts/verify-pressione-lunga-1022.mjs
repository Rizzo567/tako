// 22/10 tarda sera — via il pulsante «Sposta»: il tremolio parte SOLO con la pressione lunga (~1 s) su piatto, Sottomenu o Menu;
// un tocco su zona vuota esce (e non seleziona nulla), uno scroll in tremolio no; «Modifica» e «Fine» restano.
// Banco di verify-menu-editor-dashboard.mjs (SPA vera, renderer + layer veri, API finta: nessuna scrittura reale).
// Chrome headless, iPhone 390×844 DPR 3, tocchi CDP reali con tremolio ±5 px. Uscita: docs/webapp/dashboard-editor-2026-10-22/pressione-1022/
import {startHarness,frameOf,wait,waitFor,U,fixture} from './verify-menu-editor-dashboard.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(repo,'docs/webapp/dashboard-editor-2026-10-22/pressione-1022')
await mkdir(OUT,{recursive:true});process.env.PATH='/opt/homebrew/bin:'+process.env.PATH
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const results=[];let fails=0
const check=(name,cond,detail='')=>{results.push({name,ok:!!cond,detail});if(!cond)fails++;console.log(cond?'✓':'✗',name,detail!==''?JSON.stringify(detail):'')}
const item=(n,name,extra={})=>({id:U(n),name,description:null,price:0,imageUrl:null,allergens:[],tags:[],additives:[],available:true,hidden:false,featured:false,displayMode:'normal',variants:[],translations:{},...extra})
const section=(n,name,items,extra={})=>({id:U(n),parentSectionId:null,name,description:null,active:true,translations:{},items,...extra})
const fx=()=>{const d=fixture()
 d.menus=[
  {id:U(1),name:'Menu del giorno',description:null,type:'lunch',active:true,translations:{},pricing:'fisso',included:'Acqua e caffè',
   formulas:[{id:'f-completo',name:'Completo',price:15,note:'Primo e secondo',sectionIds:[U(10),U(11)]},{id:'f-primo',name:'Solo primo',price:10,sectionIds:[U(10)]}],
   sections:[section(10,'Primi',[item(100,'Pasta al pomodoro',{description:'Pomodoro e basilico'}),item(101,'Risotto ai funghi'),item(102,'Lasagna'),item(103,'Gnocchi'),item(104,'Ravioli'),item(105,'Tortellini'),item(106,'Carbonara'),item(107,'Amatriciana')]),
    section(11,'Secondi',[item(110,'Pollo arrosto'),item(111,'Cotoletta')]),
    section(12,'Contorni',[item(120,'Patate al forno'),item(121,'Insalata mista')])]},
  {id:U(2),name:'Alla carta',description:null,type:'main',active:true,translations:{},sections:[
   section(20,'Pizze',[item(200,'Margherita',{price:7}),item(201,'Diavola',{price:8})])]}]
 return d}
const H=await startHarness({shell:true})
Object.assign(H.srv,{doc:fx(),published:fx(),revision:3,publishedRevision:3,fail:[],offline:false,flag:true,botConflicts:[]})
const menuOf=id=>H.srv.doc.menus.find(m=>m.id===id),sec=(m,id)=>menuOf(m).sections.find(s=>s.id===id)
const sleep=wait,errs=[]
const page=await H.browser.newPage()
page.on('pageerror',e=>errs.push(e.message))
await page.emulate({viewport:{width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true},userAgent:UA})
const cdp=await page.createCDPSession()
await page.goto(H.base);await page.evaluate(()=>window.__mount());await page.waitForSelector('.mw-ed-stage')
const f=await frameOf(page);await f.waitForSelector('[data-menu-edit-root] [data-edit-id]',{timeout:20000});await sleep(1200)
const rec=await page.screencast({path:resolve(OUT,'390-pressione-lunga.webm')}).catch(e=>{console.log('screencast non disponibile',e.message);return null})
const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,radiusX:8,radiusY:8,force:1}]})
const frameBox=()=>page.evaluate(()=>{const e=document.querySelector('iframe.mw-ed-frame');const r=e.getBoundingClientRect();return{l:r.left,t:r.top,b:r.bottom,r:r.right,s:r.width/e.clientWidth}})
async function at(sel){
 const fr=await frameBox()
 const r=await f.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}},sel)
 if(!r)throw new Error('assente: '+sel)
 return{x:fr.l+r.x*fr.s,y:fr.t+r.y*fr.s,w:r.w*fr.s,h:r.h*fr.s}}
// Punto vuoto nell'iframe (né piatto, né Sottomenu, né Menu, né controlli), visibile nella pagina e non coperto dalla SPA.
async function emptyPoint(){
 const fr=await frameBox()
 const cands=await f.evaluate(()=>{const out=[];for(let y=innerHeight*.25;y<innerHeight*.9;y+=12)for(const x of [innerWidth/2,24,innerWidth-24]){const bad=(x,y)=>{const e=document.elementFromPoint(x,y);return !e||!!e.closest('[data-edit-id],[data-edit-select],button,a,input,select,textarea,[data-edit-group-id]')};if([[0,0],[-16,0],[16,0],[0,-16],[0,16]].some(([dx,dy])=>x+dx<0||x+dx>=innerWidth||bad(x+dx,y+dy)))continue;out.push({x,y,tag:document.elementFromPoint(x,y).tagName})}return out})
 for(const c of cands){const p={x:fr.l+c.x*fr.s,y:fr.t+c.y*fr.s};const ok=await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName==='IFRAME',p);if(ok)return{...p,tag:c.tag}}
 return null}
async function tap(p){await touch('touchStart',p.x,p.y);await sleep(70);await touch('touchEnd');await sleep(400)}
async function press(p,ms=1150){await touch('touchStart',p.x,p.y);const t0=Date.now();let k=0;while(Date.now()-t0<ms){await sleep(40);k++;await touch('touchMove',p.x+(k%2?5:-5),p.y+(k%3?2.5:-5))}}
async function longDrag(from,to){await press(from);const steps=22;for(let s=1;s<=steps;s++){const j=s%2?5:-5;await touch('touchMove',from.x+(to.x-from.x)*s/steps+j,from.y+(to.y-from.y)*s/steps+(s%3?2.5:-5));await sleep(32)}await touch('touchMove',to.x,to.y);await sleep(90);await touch('touchEnd');await sleep(1000)}
const jiggle=()=>f.evaluate(()=>!!document.querySelector('[data-edit-jiggle]'))
const selUi=()=>f.evaluate(()=>{const v=e=>!!e&&!e.classList.contains('tako-edit-hidden');return{frame:v(document.querySelector('[data-edit-frame]')),pencil:v(document.querySelector('[data-edit-pencil]'))}})
const fine=async()=>{const b=await page.evaluate(()=>{const b=[...document.querySelectorAll('.mw-swap-btn')].find(x=>x.textContent.includes('Fine'));if(!b)return null;const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}});if(b)await tap(b);await sleep(400);return !!b}
try{
 // 1. Tap piatto (prezzo fisso) → «Modifica» sì, «Sposta» da nessuna parte
 await f.evaluate(()=>scrollTo(0,0));await sleep(200)
 await tap(await at(`[data-edit-id="${U(100)}"] h3`))
 const ui=await selUi()
 const sposta=await f.evaluate(()=>!!document.querySelector('[data-edit-move]')||[...document.querySelectorAll('button')].some(b=>/Sposta/.test(b.textContent)))||await page.evaluate(()=>[...document.querySelectorAll('button')].some(b=>b.offsetParent&&/^\s*Sposta\s*$/.test(b.textContent)))
 check('tap piatto → riquadro + «Modifica» visibili',ui.frame&&ui.pencil,ui)
 check('nessun «Sposta» (iframe e SPA)',!sposta)
 check('tap breve non attiva il tremolio',!(await jiggle()))
 await page.screenshot({path:resolve(OUT,'390-01-selezione-senza-sposta.png')})
 // 2. Pressione lunga su piatto (Menu a PREZZO FISSO) → tremolio + trascinamento
 const a=await at(`[data-edit-id="${U(100)}"] h3`),b=await at(`[data-edit-id="${U(102)}"]`)
 await longDrag(a,{x:a.x,y:b.y+b.h*.35})
 await waitFor(()=>sec(U(1),U(10)).items[2]?.id===U(100)||sec(U(1),U(10)).items[1]?.id===U(100),6000).catch(()=>{})
 const order=sec(U(1),U(10)).items.map(i=>i.name)
 check('PREZZO FISSO: pressione lunga 1 s (±5 px) sul piatto → tremolio e trascinamento → bozza aggiornata',order[0]!=='Pasta al pomodoro',order)
 check('in tremolio dopo il rilascio',await jiggle())
 check('in tremolio riquadro/«Modifica» nascosti',!(await selUi()).pencil)
 await page.screenshot({path:resolve(OUT,'390-02-tremolio.png')})
 // 3. Scroll in tremolio che parte da zona vuota → scorre, NON esce
 const e0=await emptyPoint()
 check('trovato punto vuoto nell\'iframe',!!e0,e0)
 if(e0){
  const y0=await f.evaluate(()=>scrollY)
  await touch('touchStart',e0.x,e0.y);for(let k=1;k<=10;k++){await touch('touchMove',e0.x+(k%2?2:-2),e0.y-k*18);await sleep(20)}await touch('touchEnd');await sleep(900)
  const y1=await f.evaluate(()=>scrollY)
  check('scroll in tremolio (da zona vuota) → resta in tremolio',await jiggle(),{y0,y1})
  check('scroll in tremolio → la pagina scorre',y1>y0+30,{y0,y1})
 }
 // 4. Tocco su zona vuota → esce, nessuna selezione
 await f.evaluate(()=>scrollTo(0,0));await sleep(400)
 check('ancora in tremolio prima del tocco vuoto',await jiggle())
 const e1=await emptyPoint()
 if(e1){await tap(e1);await sleep(300)}
 const after=await selUi()
 check('tocco su zona vuota → esce dal tremolio',!(await jiggle()),e1)
 check('tocco su zona vuota → nessuna selezione (riquadro e «Modifica» nascosti)',!after.frame&&!after.pencil,after)
 check('nessun residuo (ghost/opacità 0)',await f.evaluate(()=>document.querySelectorAll('[data-menu-gesture-ghost],[data-edit-id][style*="opacity: 0"]').length===0))
 await page.screenshot({path:resolve(OUT,'390-03-uscita-tocco-vuoto.png')})
 // 5. Pressione lunga sul Sottomenu (pillola) → tremolio + trascinamento
 await f.evaluate(()=>scrollTo(0,0));await sleep(300)
 const pills=await f.evaluate(()=>[...document.querySelectorAll('[data-edit-kind="submenu"]')].map(e=>e.getAttribute('data-edit-id')))
 const o0=menuOf(U(1)).sections.map(s=>s.name)
 const p0=await at(`[data-edit-id="${pills[0]}"]`),p1=await at(`[data-edit-id="${pills[pills.length-1]}"]`)
 await longDrag(p0,{x:p1.x+p1.w*.35,y:p1.y})
 await waitFor(()=>JSON.stringify(menuOf(U(1)).sections.map(s=>s.name))!==JSON.stringify(o0),6000).catch(()=>{})
 const o1=menuOf(U(1)).sections.map(s=>s.name)
 check('Sottomenu: pressione lunga → tremolio e trascinamento → ordine cambiato',JSON.stringify(o1)!==JSON.stringify(o0),{o0,o1})
 check('in tremolio dopo il Sottomenu',await jiggle())
 // 6. «Fine» resta come alternativa
 check('«Fine» trovato',await fine())
 check('«Fine» esce dal tremolio',!(await jiggle()))
 // 7. «Modifica» funziona
 await f.evaluate(id=>document.querySelector(`[data-edit-id="${id}"]`)?.scrollIntoView({block:'center'}),U(101));await sleep(300)
 for(let t=0;t<3;t++){await tap(await at(`[data-edit-id="${U(101)}"] h3`));await sleep(300);if((await selUi()).pencil)break}
 await sleep(400);await tap(await at('[data-edit-pencil]'));await sleep(900)
 const sheet=await page.evaluate(()=>{const d=document.querySelector('.mw-drawer,.mw-bottom-sheet,[role=dialog]');return d?d.textContent:''})
 check('«Modifica» apre la scheda del piatto',/Risotto/.test(sheet)||/Elimina piatto/.test(sheet),sheet.slice(0,160))
 await page.screenshot({path:resolve(OUT,'390-04-modifica.png')})
 check('nessun errore di pagina',errs.length===0,errs)
}catch(e){check('eccezione',false,e.message)}
if(rec)await rec.stop().catch(()=>{})
await writeFile(resolve(OUT,'esito.json'),JSON.stringify({fails,results},null,1))
await H.close?.();await H.browser?.close?.().catch(()=>{})
console.log(fails?`✗ ${fails} falliti`:'✓ tutto verde');process.exit(fails?1:0)
