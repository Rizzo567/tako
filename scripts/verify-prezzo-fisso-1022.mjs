// 22/10 sera — editor Piatti: menu a PREZZO FISSO trascinabile, piatto sollevato in vetro, niente «nascosto» per i piatti,
// lente e «+» in testata, niente «Avanzate». Banco di verify-menu-editor-dashboard.mjs (SPA vera, renderer + layer veri,
// API finta: nessuna scrittura reale). Chrome headless: iPhone 390×844 e 430×932 DPR 3 touch (tocchi CDP con tremolio) + 1280.
// Uscita: docs/webapp/dashboard-editor-2026-10-22/fisso-1022/
import {startHarness,frameOf,wait,waitFor,U,fixture} from './verify-menu-editor-dashboard.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(repo,'docs/webapp/dashboard-editor-2026-10-22/fisso-1022')
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
 const rec=full?await page.screencast({path:resolve(OUT,`${tag}-trascina-prezzo-fisso.webm`)}).catch(e=>{console.log('screencast non disponibile',e.message);return null}):null
 try{
  // ── Testata: logo · lente · + · Pubblica sulla stessa riga, niente sovrapposizioni, niente overflow
  const brand=await box('.mobile-header-brand [role=img]'),tools=await page.evaluate(()=>[...document.querySelectorAll('.mobile-header-slot .mw-hdr-tools button')].map(b=>{const r=b.getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,w:r.width,h:r.height,label:b.getAttribute('aria-label')}}))
  const pub=await box('.mobile-header-slot .mw-ed-publish-btn')
  check(`${tag} testata: lente e «+» (36 px) a sinistra di Pubblica`,tools.length===2&&tools.every(t=>Math.round(t.w)===36&&Math.round(t.h)===36)&&pub&&tools[1].r<=pub.l+0.5&&/Cerca/.test(tools[0].label)&&/Aggiungi/.test(tools[1].label),{tools,pub})
  check(`${tag} testata: stessa riga del logo, nessuna sovrapposizione, dentro lo schermo`,brand&&pub&&tools.length===2&&brand.r<=tools[0].l+0.5&&pub.r<=width+0.5&&Math.abs((tools[0].t+tools[0].h/2)-(brand.t+brand.h/2))<6,{brand,pub,width})
  // ── Riga sotto: solo Menu ▾ e Preset ▾ (niente lente/+/Avanzate), nome del Menu intero
  const row=await page.evaluate(()=>{const t=document.querySelector('.mw-studio-toolbar');const pick=t?.querySelector('.mw-menu-picker span');return{buttons:[...t.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.getAttribute('aria-label')||b.textContent.trim()),name:pick?.textContent,full:pick?pick.scrollWidth<=pick.clientWidth+1:false}})
  check(`${tag} riga: Menu ▾ (+ Preset ▾) senza lente/+/Avanzate`,!row.buttons.some(b=>/Cerca|Aggiungi|Avanzate/.test(b))&&row.buttons.some(b=>/Menu selezionato/.test(b)),row)
  check(`${tag} nome del Menu intero («${row.name}»)`,row.full&&row.name==='Menu del giorno',row)
  check(`${tag} niente «Avanzate»/«Torna al menu» nella pagina`,await page.evaluate(()=>![...document.querySelectorAll('button')].some(b=>b.offsetParent&&/^(Avanzate|Torna al menu)$/.test(b.textContent.trim()))))
  check(`${tag} nessuno scroll orizzontale`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth&&[...document.querySelectorAll('.screen-scroll')].every(e=>e.scrollWidth<=e.clientWidth+1)))
  await page.screenshot({path:resolve(OUT,`${tag}-01-testata.png`)})
  // ── Menu a prezzo fisso: struttura vera trascinabile
  const dom=await f.evaluate(()=>({box:!!document.querySelector('[data-fixed-price-box]'),formulaIds:document.querySelectorAll('[data-edit-id^="formula~"],[data-edit-select*="formula~"],[data-edit-group-id*="formula~"]').length,dishes:[...document.querySelectorAll('[data-edit-kind="dish"]')].map(e=>e.getAttribute('data-edit-group')),pills:[...document.querySelectorAll('[data-edit-kind="submenu"]')].map(e=>e.textContent.trim()),groups:[...document.querySelectorAll('[data-edit-group-id]')].map(e=>e.getAttribute('data-edit-group-id'))}))
  check(`${tag} prezzo fisso: riquadro opzioni + piatti/Sottomenu col DOM trascinabile (niente formula~)`,dom.box&&dom.formulaIds===0&&dom.dishes.length>=3&&dom.dishes.every(g=>g&&g.startsWith('items:'))&&dom.pills.length===3&&dom.groups.some(g=>g.startsWith('items:')),dom)
  const hiddenDish=await f.evaluate(id=>{const e=document.querySelector(`[data-edit-id="${id}"]`);return e?{op:getComputedStyle(e).opacity,label:e.querySelector('[data-edit-label]')?.textContent||'',text:e.textContent}:null},U(101))
  check(`${tag} piatto ancora hidden:true → attenuato, nessuna etichetta «Nascosto»`,hiddenDish&&+hiddenDish.op<0.6&&!/Nascost/i.test(hiddenDish.text),hiddenDish)
  // 1. PIATTO con pressione lunga (prezzo fisso): Pasta → dopo Lasagna
  await f.evaluate(()=>scrollTo(0,0));await sleep(200)
  const a=await at(`[data-edit-id="${U(100)}"] h3`),b=await at(`[data-edit-id="${U(102)}"]`)
  const mid=await longDrag(a,{x:a.x,y:b.y+b.h*.35},`${tag}-02-piatto-vetro-meta-trascinamento.png`)
  await waitFor(()=>sec(U(1),U(10)).items.at(-1).id===U(100),6000).catch(()=>{})
  check(`${tag} PREZZO FISSO: piatto trascinato (pressione lunga) → onDrop + bozza aggiornata`,sec(U(1),U(10)).items.at(-1).id===U(100),sec(U(1),U(10)).items.map(i=>i.name))
  const want=Math.round(20*inv)
  check(`${tag} piatto sollevato = vetro: 4 angoli ~20 px reali, blur+saturate, ombra`,mid&&mid.glass&&mid.inside&&mid.r.every(r=>Math.abs(parseFloat(r)-want)<=2)&&/blur/.test(mid.bf)&&/saturate/.test(mid.bf)&&/rgba/.test(mid.sh),{mid,inv,want})
  check(`${tag} in tremolio dopo il rilascio`,await jiggle())
  // 2. PIATTO in un'altra Sezione/Sottomenu (pagina Secondi) con «Sposta» già attivo
  await fine()
  const pid=U(11);await f.evaluate(id=>document.querySelector(`[data-edit-id="${id}"]`).click(),pid);await sleep(700)
  await f.evaluate(id=>document.querySelector(`[data-edit-id="${id}"]`).scrollIntoView({block:'center'}),U(110));await sleep(300)
  for(let t=0;t<3;t++){await tap(await at(`[data-edit-id="${U(110)}"] h3`));await sleep(300);if(await f.evaluate(()=>!document.querySelector('[data-edit-move]').classList.contains('tako-edit-hidden')))break}
  await tap(await at('[data-edit-move]'))
  check(`${tag} «Sposta» nel prezzo fisso → tremolio`,await jiggle(),await f.evaluate(()=>({sel:!document.querySelector('[data-edit-move]').classList.contains('tako-edit-hidden'),y:scrollY})))
  const c=await at(`[data-edit-id="${U(110)}"] h3`),d=await at(`[data-edit-id="${U(111)}"]`)
  await longDrag(c,{x:c.x,y:d.y+d.h*.4})
  await waitFor(()=>sec(U(1),U(11)).items.at(-1).id===U(110),6000).catch(()=>{})
  check(`${tag} PREZZO FISSO: piatto trascinato con «Sposta» → bozza aggiornata`,sec(U(1),U(11)).items.at(-1).id===U(110),sec(U(1),U(11)).items.map(i=>i.name))
  // 3. SOTTOMENU (pillola) nel prezzo fisso, sollevato NON in vetro (resta com'era)
  await f.evaluate(()=>scrollTo(0,0));await sleep(300)
  const pills=await f.evaluate(()=>[...document.querySelectorAll('[data-edit-kind="submenu"]')].map(e=>e.getAttribute('data-edit-id')))
  const order0=menuOf(U(1)).sections.map(s=>s.name)
  const p0=await at(`[data-edit-id="${pills[0]}"]`),p1=await at(`[data-edit-id="${pills[pills.length-1]}"]`)
  const pmid=await longDrag(p0,{x:p1.x+p1.w*.35,y:p1.y},`${tag}-03-sottomenu-meta-trascinamento.png`)
  await waitFor(()=>JSON.stringify(menuOf(U(1)).sections.map(s=>s.name))!==JSON.stringify(order0),6000).catch(()=>{})
  const order1=menuOf(U(1)).sections.map(s=>s.name)
  check(`${tag} PREZZO FISSO: Sottomenu trascinato → ordine cambiato`,JSON.stringify(order1)!==JSON.stringify(order0),{order0,order1})
  check(`${tag} Sottomenu sollevato resta com'era (non vetro)`,pmid&&!pmid.glass,pmid)
  await fine()
  check(`${tag} «Fine» esce dal tremolio, nessun residuo`,!(await jiggle())&&await f.evaluate(()=>document.querySelectorAll('[data-menu-gesture-ghost]').length===0))
  if(full){
   // 4. Carta: Menu «Alla carta» dal selettore, piatto e Sottomenu
   await page.evaluate(()=>document.querySelector('.mw-menu-picker').click());await sleep(300)
   await page.evaluate(()=>[...document.querySelectorAll('.mw-menu-options button')].find(b=>b.textContent.includes('Alla carta')).click());await sleep(1500)
   f=await frameOf(page);await f.waitForSelector(`[data-edit-id="${U(20)}"]`,{timeout:8000});await f.evaluate(id=>document.querySelector(`[data-edit-id="${id}"]`).click(),U(20));await sleep(700)
   await f.waitForSelector(`[data-edit-id="${U(200)}"]`,{timeout:8000})
   check(`${tag} nome «Alla carta» intero nel selettore`,await page.evaluate(()=>{const s=document.querySelector('.mw-menu-picker span');return s.textContent==='Alla carta'&&s.scrollWidth<=s.clientWidth+1}))
   const e=await at(`[data-edit-id="${U(200)}"] h3`),g=await at(`[data-edit-id="${U(202)}"]`)
   await longDrag(e,{x:e.x,y:g.y+g.h*.35})
   await waitFor(()=>sec(U(2),U(20)).items.at(-1).id===U(200),6000).catch(()=>{})
   check(`${tag} CARTA: piatto trascinato → bozza aggiornata`,sec(U(2),U(20)).items.at(-1).id===U(200),sec(U(2),U(20)).items.map(i=>i.name))
   await f.evaluate(()=>scrollTo(0,0));await sleep(300)
   const cp=await f.evaluate(()=>[...document.querySelectorAll('[data-edit-kind="submenu"]')].map(e=>e.getAttribute('data-edit-id')))
   const o0=menuOf(U(2)).sections.map(s=>s.name)
   if(cp.length>=2){const q0=await at(`[data-edit-id="${cp[0]}"]`),q1=await at(`[data-edit-id="${cp[1]}"]`);await longDrag(q0,{x:q1.x+q1.w*.35,y:q1.y})}
   await waitFor(()=>JSON.stringify(menuOf(U(2)).sections.map(s=>s.name))!==JSON.stringify(o0),6000).catch(()=>{})
   check(`${tag} CARTA: Sottomenu trascinato → ordine cambiato`,JSON.stringify(menuOf(U(2)).sections.map(s=>s.name))!==JSON.stringify(o0),{o0,o1:menuOf(U(2)).sections.map(s=>s.name),pills:cp.length})
   await fine()
   // 5. Matita del piatto: niente «Nascosto», Esaurito resta, Elimina c'è
   await f.evaluate(id=>document.querySelector(`[data-edit-id="${id}"]`).scrollIntoView({block:'center'}),U(201));await sleep(300)
   for(let t=0;t<3;t++){await tap(await at(`[data-edit-id="${U(201)}"] h3`));await sleep(300);if(await f.evaluate(()=>!document.querySelector('[data-edit-pencil]').classList.contains('tako-edit-hidden')))break}
   await tap(await at('[data-edit-pencil]'));await sleep(900)
   const sheet=await page.evaluate(()=>{const d=document.querySelector('.mw-drawer,.mw-bottom-sheet,[role=dialog]');return d?d.textContent:''})
   check(`${tag} «Modifica piatto»: nessun controllo «nascondi», «Esaurito» ed «Elimina piatto» presenti`,sheet&&!/Nascost|Nascondi/i.test(sheet)&&/Esaurito/.test(sheet)&&/Elimina piatto/.test(sheet),sheet.slice(0,300))
   await page.screenshot({path:resolve(OUT,`${tag}-04-modifica-piatto.png`)})
   await page.keyboard.press('Escape');await page.evaluate(()=>document.querySelector('.mw-sheet-close,[aria-label^="Chiudi"]')?.click());await sleep(600)
   // 6. Lente e «+» dalla testata
   await page.evaluate(()=>document.querySelector('.mobile-header-slot .mw-hdr-tools button[aria-label^="Cerca"]').click());await sleep(500)
   check(`${tag} lente in testata → campo di ricerca`,await page.evaluate(()=>!!document.querySelector('.mw-universal-search input')))
   await page.evaluate(()=>document.querySelector('.mobile-header-slot .mw-hdr-tools button[aria-label^="Cerca"]').click());await sleep(400)
   await page.evaluate(()=>document.querySelector('.mobile-header-slot .mw-hdr-tools button[aria-label^="Aggiungi"]').click());await sleep(700)
   check(`${tag} «+» in testata → riquadro Aggiungi`,await page.evaluate(()=>/Piatto|Sottomenu/.test(document.querySelector('.mw-create-sheet,.mw-bottom-sheet,[role=dialog]')?.textContent||'')))
   await page.screenshot({path:resolve(OUT,`${tag}-05-aggiungi.png`)})
  }
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
  const head=await page.evaluate(()=>{const h=document.querySelector('.mw-ed-head');if(!h)return null;const bs=[...h.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,label:b.getAttribute('aria-label')||b.textContent.trim()}});return bs})
  check('1280 testata: lente, «+», Pubblica in alto a destra (stessa riga)',head&&head.length===3&&/Cerca/.test(head[0].label)&&/Aggiungi/.test(head[1].label)&&head[1].r<=head[2].l&&head[2].r>900&&Math.abs(head[0].t-head[2].t)<8,head)
  check('1280 niente «Avanzate»',await page.evaluate(()=>![...document.querySelectorAll('button')].some(b=>b.offsetParent&&/^(Avanzate|Torna al menu)$/.test(b.textContent.trim()))))
  check('1280 nome del Menu intero',await page.evaluate(()=>{const s=document.querySelector('.mw-menu-picker span');return s.textContent==='Menu del giorno'&&s.scrollWidth<=s.clientWidth+1}))
  check('1280 nessuno scroll orizzontale',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  // Trascinamento col mouse nel prezzo fisso
  const fr=await page.evaluate(()=>{const r=document.querySelector('iframe.mw-ed-frame').getBoundingClientRect();return{l:r.left,t:r.top}})
  const pt=async s=>{const r=await f.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,h:r.height}},s);return{x:fr.l+r.x,y:fr.t+r.y,h:r.h}}
  const a=await pt(`[data-edit-id="${U(100)}"] h3`),b=await pt(`[data-edit-id="${U(102)}"]`)
  await page.mouse.move(a.x,a.y);await page.mouse.down();await sleep(1200)
  for(let s=1;s<=20;s++){await page.mouse.move(a.x+(s%2?3:-3),a.y+(b.y+b.h*.35-a.y)*s/20);await sleep(30);if(s===10)await page.screenshot({path:resolve(OUT,'1280-01-piatto-vetro.png')})}
  await page.mouse.up();await sleep(1000)
  await waitFor(()=>sec(U(1),U(10)).items.at(-1).id===U(100),6000).catch(()=>{})
  check('1280 PREZZO FISSO: piatto trascinato col mouse → bozza aggiornata',sec(U(1),U(10)).items.at(-1).id===U(100),sec(U(1),U(10)).items.map(i=>i.name))
  // Matita del Menu: prezzo fisso, descrizione, tipo
  await f.evaluate(()=>scrollTo(0,0));await sleep(200)
  await page.evaluate(()=>document.querySelector('.mw-ed-head button[aria-label^="Cerca"]').click());await sleep(300)
  await page.type('.mw-universal-search input','Prezzo fisso');await sleep(300);await page.keyboard.press('Enter');await sleep(900)
  const pop=await page.evaluate(()=>{const d=document.querySelector('.mw-ed-popover,.mw-drawer');return d?d.textContent+' '+[...d.querySelectorAll('input')].map(i=>i.value).join(' '):''})
  check('1280 ricerca «Prezzo fisso» → matita del Menu con opzioni, descrizione e tipo',/Modifica menu/.test(pop)&&/Completo/.test(pop)&&/Descrizione del menu/.test(pop)&&/Tipo di menu/.test(pop),pop.slice(0,240))
  await page.screenshot({path:resolve(OUT,'1280-02-matita-menu.png')})
 }catch(e){check('1280 eccezione',false,e.message)}
 check('1280 nessun errore console',errs.length===0,errs)
 await page.close()
}

try{await phone(390,844,'390',true);await phone(430,932,'430',false);await desktop()}
finally{await writeFile(resolve(OUT,'esito.json'),JSON.stringify({fails,results},null,1));await H.close?.().catch(()=>{})}
console.log(fails?`✗ ${fails} falliti`:'✓ tutto verde');process.exit(fails?1:0)
