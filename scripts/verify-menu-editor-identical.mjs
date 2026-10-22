// Dashboard editor 22/10 (T4, CONTRATTO §4–5): la vista di modifica è IDENTICA alla pagina dei clienti?
//
// Uso: node scripts/verify-menu-editor-identical.mjs [--out <dir>]
//
// 1. Identico: pagina pubblica vera (DigitalMenu + proiezione pubblica vera del server) contro la superficie di modifica senza layer
//    (MenuEditSurface = renderer in modo `editing` + projectMenuForEdit), su 3 fixture (menu semplice, menu con Sezioni figlie,
//    menu a prezzo fisso) × 390 / 430 / 1280 px, per OGNI pillola. Atteso: 0 pixel diversi (confronto esatto, soglia 0).
//    1280 = viewport desktop normale. 390 e 430 = emulazione dispositivo (page.emulate: isMobile, hasTouch, deviceScaleFactor 2,
//    UA iPhone): Chrome headless sotto i 500 px di finestra «desktop» dà risultati falsi, l'emulazione mobile no.
// 2. Layer vero nell'iframe /menu-preview/<id>?edit=1 dentro una pagina genitore finta che parla il protocollo della SPA:
//    selezione con clic, tocco e tastiera, matita (≥ 44 px su touch), Esc e clic fuori, attenuati ed etichette, logica dati del
//    riordino chiamando `onDrop` dello stub (e la tastiera minima dello stub), fotografia provvisoria dell'ordine manuale.
//    Le animazioni del gesto NON si verificano qui (modulo dell'altro agente).
// Tutto locale: esbuild del codice vero, server HTTP su 127.0.0.1, Chrome headless (mai finestre), nessuna rete esterna, nessun DB.
// Esito: <out>/identical.json + screenshot in docs/webapp/dashboard-editor-2026-10-22/shots/. Uscita 1 se qualcosa è rosso.
import {build} from 'esbuild'
import puppeteer from 'puppeteer-core'
import {createServer} from 'node:http'
import {mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {resolve,join,extname} from 'node:path'
import {tmpdir} from 'node:os'
import {pathToFileURL} from 'node:url'

const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const root=resolve(new URL('..',import.meta.url).pathname)
const args=process.argv.slice(2),outArg=args.indexOf('--out')
const OUT=resolve(outArg>=0?args[outArg+1]:join(root,'docs/webapp/dashboard-editor-2026-10-22/shots'))
const RELEASE=resolve(root,'release/public-menus')
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const WIDTHS=[['390',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['430',{width:430,height:932,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['1280',{width:1280,height:900,deviceScaleFactor:1,isMobile:false,hasTouch:false}]]
const wait=ms=>new Promise(r=>setTimeout(r,ms))
const u=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const results={identical:[],layer:[],startedAt:new Date().toISOString()}
const check=(name,ok,detail)=>{results.layer.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});console.log(`${ok?'OK  ':'NO  '} ${name}${detail!==undefined?' '+JSON.stringify(detail).slice(0,200):''}`)}

// ---------- fixture (documenti workspace validi per lo schema) ----------
const dish=(n,name,extra={})=>({id:u(n),name,price:8+n%7,description:n%2?`Descrizione di ${name.toLowerCase()}`:null,allergens:n%3?[]:['glutine'],...extra})
const FIXTURES=[
 {key:'semplice',raw:{languages:['it'],defaultLanguage:'it',design:{primary:'#1e5baa'},menus:[{id:u(1),name:'Cena',type:'dinner',sections:[
  {id:u(10),name:'Antipasti',items:[dish(100,'Bruschetta'),dish(101,'Tagliere misto'),dish(102,'Fritto di paranza')]},
  {id:u(11),name:'Primi',items:[dish(110,'Carbonara'),dish(111,'Cacio e pepe')]},
  {id:u(12),name:'Dolci',items:[dish(120,'Tiramisù'),dish(121,'Panna cotta')]}]},
  {id:u(2),name:'Pranzo',type:'lunch',sections:[{id:u(20),name:'Piatti del giorno',items:[dish(200,'Lasagna')]}]}]}},
 {key:'sezioni-figlie',raw:{languages:['it'],defaultLanguage:'it',design:{},menus:[{id:u(3),name:'Menu',type:'main',sections:[
  {id:u(30),name:'Primi',items:[dish(300,'Gnocchi al ragù')]},
  {id:u(31),name:'Di terra',parentSectionId:u(30),items:[dish(310,'Pappardelle al cinghiale'),dish(311,'Tagliatelle ai funghi')]},
  {id:u(32),name:'Di mare',parentSectionId:u(30),items:[dish(320,'Spaghetti alle vongole'),dish(321,'Risotto alla pescatora')]},
  {id:u(33),name:'Secondi',items:[dish(330,'Tagliata di manzo'),dish(331,'Branzino al forno')]},
  {id:u(34),name:'Contorni',items:[dish(340,'Patate al forno')]}]}]},
  // Solo per le prove del layer (non visibili ai clienti): piatto nascosto, esaurito, Sezione figlia disattivata, Sezione vuota.
  extraForLayer:doc=>{const m=doc.menus[0];m.sections[0].items.push(dish(301,'Piatto segreto',{hidden:true}),dish(302,'Finito',{available:false}));m.sections.splice(3,0,{id:u(35),name:'Fuori carta',parentSectionId:u(30),active:false,items:[dish(350,'Tartufo')]},{id:u(36),name:'In arrivo',parentSectionId:u(30),items:[]});return doc}},
 {key:'prezzo-fisso',raw:{languages:['it'],defaultLanguage:'it',design:{},menus:[{id:u(4),name:'Pranzo di lavoro',type:'lunch',pricing:'fisso',included:'Acqua e caffè',formulas:[{id:u(48),name:'Primo + secondo',price:15,sectionIds:[u(40),u(41)]},{id:u(49),name:'Solo primo',price:10,note:'Con contorno',sectionIds:[u(40)]}],sections:[
  {id:u(40),name:'Primi',items:[dish(400,'Penne all\'arrabbiata'),dish(401,'Risotto allo zafferano')]},
  {id:u(41),name:'Secondi',items:[dish(410,'Pollo al limone'),dish(411,'Frittata')]},
  {id:u(42),name:'Dolci',items:[dish(420,'Crostata')]}]}]}},
]

async function serverLib(){
 const stub='export const db={};export const menuItems={};export const sql=()=>({});export const and=()=>({});export const eq=()=>({});export async function readWorkspace(){return null}'
 const outfile=join(tmpdir(),`tako-editor-identical-projection-${process.pid}.mjs`)
 await build({stdin:{contents:`export {publicMenuProjection,defaultPublicMenu} from './src/lib/published-menu.ts';export {publicWorkspace} from './src/lib/menu-workspace-schedule.ts';export {workspaceSchema} from './src/lib/menu-workspace-contract.ts'`,resolveDir:resolve(root,'apps/server'),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile,logLevel:'error',
  plugins:[{name:'stub-db',setup(b){b.onResolve({filter:/^(@tako\/db|drizzle-orm)$|menu-workspace-store\.js$/},a=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:stub,loader:'js'}))}}]})
 return import(pathToFileURL(outfile).href)
}

async function bundle(dir){
 const WEB=resolve(root,'apps/web/src/components')
 const entries={
  public:`import React from 'react';import {createRoot} from 'react-dom/client';import {DigitalMenu} from '${WEB}/DigitalMenu.tsx';createRoot(document.getElementById('root')).render(<DigitalMenu restaurantId={window.__restaurantId}/>)`,
  surface:`import React from 'react';import {createRoot} from 'react-dom/client';import {MenuEditSurface,editRendererProps} from '${WEB}/MenuPreview.tsx';const f=window.__fixture;function App(){const [menuId,setMenuId]=React.useState(f.menuId);return <MenuEditSurface props={editRendererProps(f.doc,menuId,f.presentation,setMenuId)}/>}createRoot(document.getElementById('root')).render(<App/>)`,
  preview:`import React from 'react';import {createRoot} from 'react-dom/client';import {MenuPreview} from '${WEB}/MenuPreview.tsx';createRoot(document.getElementById('root')).render(<MenuPreview menuId={decodeURIComponent(location.pathname.split('/').pop())}/>)`,
 }
 const src=join(dir,'src');await mkdir(src,{recursive:true})
 for(const [name,code] of Object.entries(entries))await writeFile(join(src,name+'.tsx'),code)
 await build({entryPoints:Object.keys(entries).map(n=>join(src,n+'.tsx')),outdir:join(dir,'out'),bundle:true,splitting:true,format:'esm',jsx:'automatic',loader:{'.ttf':'dataurl','.woff2':'dataurl'},alias:{'@':resolve(root,'apps/web/src')},nodePaths:[resolve(root,'apps/web/node_modules'),resolve(root,'node_modules')],define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_API_URL':'""'},external:['/takomenu-public/*','/uploads/*'],logLevel:'error'})
}

const TYPES={'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'}
async function main(){
 if(!existsSync(join(RELEASE,'index.html')))throw Error('Manca release/public-menus: esegui prima node scripts/build-public-menu-release.mjs docs/webapp/portfolio-rollout/public-manifest.json')
 await mkdir(OUT,{recursive:true})
 const lib=await serverLib()
 const css=(await readdir(join(RELEASE,'assets'))).filter(f=>/^index-.*\.css$/.test(f))
 const shellBody=(await readFile(join(RELEASE,'index.html'),'utf8')).match(/<body class="([^"]*)"/)?.[1]||''
 const dir=join(tmpdir(),`tako-editor-identical-${process.pid}`);await rm(dir,{recursive:true,force:true});await bundle(dir)
 const outCss=existsSync(join(dir,'out'))?(await readdir(join(dir,'out'))).filter(f=>f.endsWith('.css')):[]
 const page=(entry,head='')=>`<!doctype html><html lang="it"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/><meta name="theme-color" content="#1d1d1f"/>${css.map(f=>`<link rel="stylesheet" href="/takomenu-public/assets/${f}">`).join('')}${(entry==='preview'?outCss:outCss.filter(f=>f===entry+'.css')).map(f=>`<link rel="stylesheet" href="/__b/${f}">`).join('')}${head}</head><body class="${shellBody}"><div id="root"></div><script type="module" src="/__b/${entry}.js"></script></body></html>`
 let current=null
 const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://x'),p=url.pathname
  const send=(status,type,body)=>{res.statusCode=status;res.setHeader('Content-Type',type);res.setHeader('Cache-Control','no-store');res.end(body)}
  const m=p.match(/^\/api\/customer\/restaurant\/([^/]+)\/menu$/)
  if(m){const body=current.api(url.searchParams.get('menuId')||'',url.searchParams.get('lang')||'');return send(body?200:404,'application/json',JSON.stringify(body||{error:{code:'NOT_FOUND'}}))}
  if(p==='/api/menu-workspace/presentation')return send(200,'application/json',JSON.stringify({data:current.presentation}))
  if(p==='/api/menu-workspace')return send(200,'application/json',JSON.stringify({data:current.layerDoc,presentation:current.presentation}))
  if(p.startsWith('/api/')||p.startsWith('/socket.io'))return send(404,'text/plain','')
  if(p==='/__public.html')return send(200,'text/html',page('public',`<script>window.__restaurantId=${JSON.stringify(current.restaurantId)}</script>`))
  if(p==='/__surface.html')return send(200,'text/html',page('surface',`<script>window.__fixture=${JSON.stringify({doc:current.doc,menuId:current.menuId,presentation:current.presentation}).replace(/</g,'\\u003c')}</script>`))
  if(p.startsWith('/menu-preview/'))return send(200,'text/html',page('preview'))
  if(p==='/__parent.html')return send(200,'text/html',`<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe id="f" src="/menu-preview/${encodeURIComponent(current.menuId)}?edit=1"></iframe><script>
   window.__msgs=[];const f=document.getElementById('f');window.__state={v:1,type:'tako-menu-edit-state',document:${JSON.stringify(current.layerDoc).replace(/</g,'\\u003c')},menuId:${JSON.stringify(current.menuId)},selection:null,flash:[],disabled:false,editing:false}
   window.__send=over=>{Object.assign(window.__state,over||{});f.contentWindow.postMessage(window.__state,location.origin)};window.__exit=()=>f.contentWindow.postMessage({type:'tako-menu-edit-exit',v:1},location.origin)
   addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==f.contentWindow)return;window.__msgs.push(e.data);if(e.data?.type==='tako-menu-edit-ready')window.__send()})</script></body></html>`)
  if(p.startsWith('/__b/')){const file=join(dir,'out',p.slice(5));if(!file.startsWith(join(dir,'out'))||!existsSync(file))return send(404,'text/plain','');return send(200,TYPES[extname(file)]||'application/octet-stream',await readFile(file))}
  if(p.startsWith('/takomenu-public/')){const file=join(RELEASE,decodeURIComponent(p.slice('/takomenu-public/'.length)));if(!file.startsWith(RELEASE)||!existsSync(file))return send(404,'text/plain','');return send(200,TYPES[extname(file)]||'application/octet-stream',await readFile(file))}
  return send(404,'text/plain','')
 }catch(e){res.statusCode=500;res.end(String(e?.stack||e))}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`
 const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--hide-scrollbars','--font-render-hinting=none','--disable-lcd-text','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-gpu','--disable-gpu-rasterization'],protocolTimeout:60000})
 const setFixture=fx=>{
  const parsed=lib.workspaceSchema.parse(fx.raw),workspace=lib.publicWorkspace(parsed,new Date(),{ignoreSchedules:true}),restaurantId=u(999),def=lib.defaultPublicMenu(workspace.menus)
  const presentation={restaurantName:'Trattoria di prova',foodCatalogs:{allergens:[],traits:[],additives:[]}}
  const api=(menuId,lang)=>{const selected=menuId?workspace.menus.find(m=>m.id===menuId):def;if(!selected)return null;const language=lang||workspace.defaultLanguage
   return {data:lib.publicMenuProjection(selected,language,workspace.defaultLanguage),menus:workspace.menus.map(m=>({id:m.id,type:m.type,name:m.translations?.[language]?.name||m.name})),design:workspace.design,foodTranslations:workspace.foodTranslations,foodCatalogs:presentation.foodCatalogs,languages:workspace.languages,defaultLanguage:workspace.defaultLanguage,features:{restaurantName:presentation.restaurantName,reservationsEnabled:false,reviewUrl:'',customerOrderingEnabled:false,coverCharge:0}}}
  const layerDoc=fx.extraForLayer?lib.workspaceSchema.parse(fx.extraForLayer(structuredClone(fx.raw))):parsed
  current={key:fx.key,doc:parsed,layerDoc,api,restaurantId,menuId:def.id,presentation}
 }
 const compare=async(pg,a,b)=>pg.evaluate(async(x,y)=>{const load=src=>new Promise((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=ko;i.src=src});const [ia,ib]=await Promise.all([load(x),load(y)]);const w=Math.max(ia.width,ib.width),h=Math.max(ia.height,ib.height)
  const draw=img=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#ff00ff';g.fillRect(0,0,w,h);g.drawImage(img,0,0);return g.getImageData(0,0,w,h).data}
  const pa=draw(ia),pb=draw(ib);let changed=0,first=null;for(let i=0;i<pa.length;i+=4)if(pa[i]!==pb[i]||pa[i+1]!==pb[i+1]||pa[i+2]!==pb[i+2]||pa[i+3]!==pb[i+3]){changed++;if(!first)first=[(i/4)%w,Math.floor(i/4/w)]}
  return {sizeA:[ia.width,ia.height],sizeB:[ib.width,ib.height],changed,first}},'data:image/png;base64,'+a.toString('base64'),'data:image/png;base64,'+b.toString('base64'))
 const settle=async pg=>{await pg.evaluate(()=>document.fonts?.ready);await wait(350)}
 const open=async(pg,emu,path)=>{if(emu.isMobile)await pg.emulate({viewport:emu,userAgent:IPHONE});else await pg.setViewport(emu);await pg.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await pg.goto(base+path,{waitUntil:'networkidle0'});await pg.waitForSelector('[data-category-page]',{timeout:15000});await settle(pg)}
 try{
  // ---------- 1. identico ----------
  for(const fx of FIXTURES){setFixture(fx)
   for(const [label,emu] of WIDTHS){
    const pub=await browser.newPage(),edit=await browser.newPage(),cmp=await browser.newPage()
    try{
     await open(pub,emu,'/__public.html');await open(edit,emu,'/__surface.html')
     const pills=await pub.$$eval('[data-category]',els=>els.map(e=>e.getAttribute('data-category')))
     const editPills=await edit.$$eval('[data-category]',els=>els.map(e=>e.getAttribute('data-category')))
     if(JSON.stringify(pills)!==JSON.stringify(editPills))results.identical.push({fixture:fx.key,width:label,error:'pillole diverse',pills,editPills})
     for(let i=0;i<pills.length;i++){
      if(i>0){for(const pg of [pub,edit]){await pg.bringToFront();await pg.$eval(`[data-category="${pills[i]}"]`,e=>e.click());await settle(pg)}}
      await pub.bringToFront();const a=await pub.screenshot({fullPage:true});await edit.bringToFront();const b=await edit.screenshot({fullPage:true});await cmp.bringToFront()
      let r=await compare(cmp,a,b),retried=0
      // Rumore di rasterizzazione (antialias di un bordo, 1 px non ripetibile): si riscattano entrambe le pagine fino a 2 volte.
      // Una differenza vera di markup/stile si ripete sempre e resta rossa.
      while(r.changed&&retried<2){retried++;await wait(300);await pub.bringToFront();const a2=await pub.screenshot({fullPage:true});await edit.bringToFront();const b2=await edit.screenshot({fullPage:true});await cmp.bringToFront();r={...await compare(cmp,a2,b2),firstTry:r.changed}}
      const name=`identico-${fx.key}-${label}-p${i+1}`
      if(i===0||r.changed){await writeFile(join(OUT,name+'-pubblica.png'),a);await writeFile(join(OUT,name+'-modifica.png'),b)}
      results.identical.push({fixture:fx.key,width:label,pill:i+1,changedPixels:r.changed,size:[r.sizeA,r.sizeB],firstDiff:r.first,...(retried?{retried,firstTry:r.firstTry}:{})})
      console.log(`${r.changed?'NO  ':'OK  '} identico ${fx.key} ${label}px pillola ${i+1}/${pills.length}: ${r.changed} pixel diversi`)
     }
    }finally{await Promise.all([pub.close(),edit.close(),cmp.close()])}
   }
  }
  // ---------- 2. layer vero nell'iframe ----------
  setFixture(FIXTURES[1])
  const ids={root:u(30),child:u(31),child2:u(32),dish:u(300),hidden:u(301),sold:u(302),inactive:u(35),empty:u(36),moved:u(310)}
  for(const [label,emu] of [WIDTHS[2],WIDTHS[0]]){
   const pg=await browser.newPage()
   try{
    if(emu.isMobile)await pg.emulate({viewport:emu,userAgent:IPHONE});else await pg.setViewport(emu)
    await pg.goto(base+'/__parent.html',{waitUntil:'networkidle0'})
    await pg.waitForFunction(()=>document.getElementById('f').contentDocument?.querySelector('[data-edit-id]'),{timeout:15000})
    const frame=pg.frames().find(f=>f.url().includes('/menu-preview/'));await wait(300)
    const msgs=()=>pg.evaluate(()=>window.__msgs.slice()),last=async type=>(await msgs()).filter(m=>m.type===type).at(-1),clear=()=>pg.evaluate(()=>{window.__msgs.length=0})
    const ready=(await msgs()).some(m=>m.type==='tako-menu-edit-ready');check(`${label}: iframe ?edit=1 manda tako-menu-edit-ready v:1`,ready)
    const frameBox=()=>frame.evaluate(()=>{const f=document.querySelector('[data-edit-frame]'),p=document.querySelector('[data-edit-pencil]');const vis=e=>!!e&&!e.classList.contains('tako-edit-hidden');const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}};return {frame:vis(f)?r(f):null,pencil:vis(p)?r(p):null,label:p?.getAttribute('aria-label'),border:f?getComputedStyle(f).borderTopWidth+' '+getComputedStyle(f).borderTopColor:''}})
    const rectOf=sel=>frame.$eval(sel,e=>{e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})
    const iframeOffset=await pg.$eval('#f',e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y}})
    // attenuati ed etichette (nascosto, esaurito, Sezione figlia disattivata) + contenitore vuoto
    const states=await frame.evaluate(o=>{const get=id=>document.querySelector(`[data-edit-id="${id}"]`);const info=id=>{const e=get(id);return e?{state:e.getAttribute('data-edit-state'),opacity:getComputedStyle(e).opacity,label:e.querySelector('[data-edit-label]')?.textContent||null}:null};return {hidden:info(o.hidden),sold:info(o.sold),inactive:info(o.inactive),emptyGroup:!!document.querySelector(`[data-edit-group-id="items:${o.empty}"]`),lang:document.querySelector('[aria-label="Lingua del menu"]')?.getAttribute('aria-disabled')}},ids)
    check(`${label}: piatto nascosto attenuato con etichetta`,states.hidden?.state==='hidden'&&states.hidden.opacity==='0.45'&&states.hidden.label==='Nascosto · rendilo visibile dalla matita',states.hidden)
    check(`${label}: piatto esaurito con etichetta «Esaurito»`,states.sold?.state==='unavailable'&&states.sold.label==='Esaurito',states.sold)
    check(`${label}: Sezione disattivata attenuata con etichetta`,states.inactive?.state==='inactive'&&states.inactive.opacity==='0.45',states.inactive)
    check(`${label}: Sezione vuota con contenitore di rilascio`,states.emptyGroup)
    check(`${label}: selettore lingua spento`,states.lang==='true')
    await pg.screenshot({path:join(OUT,`layer-${label}-attenuati.png`)})
    // selezione con clic (o tocco su mobile) sul piatto
    await clear();const r=await rectOf(`[data-edit-id="${ids.dish}"]`);const at={x:iframeOffset.x+r.x+Math.min(40,r.w/2),y:iframeOffset.y+r.y+r.h/2}
    if(emu.hasTouch)await pg.touchscreen.tap(at.x,at.y);else await pg.mouse.click(at.x,at.y)
    await wait(250);let box=await frameBox(),sel=await last('tako-menu-edit-select')
    check(`${label}: ${emu.hasTouch?'tocco':'clic'} sul piatto → select {kind:item}`,sel?.kind==='item'&&sel?.id===ids.dish&&sel.v===1,sel)
    check(`${label}: riquadro 2 px nero attorno alla riga intera`,!!box.frame&&Math.abs(box.frame.w-(r.w+8))<2&&Math.abs(box.frame.h-(r.h+8))<2&&/^2px rgb\(10, 10, 10\)/.test(box.border),{frame:box.frame,row:r,border:box.border})
    check(`${label}: matita visibile${emu.hasTouch?' ≥ 44 px (touch)':''} con aria-label chiara`,!!box.pencil&&(!emu.hasTouch||(box.pencil.w>=44&&box.pencil.h>=44))&&/^Modifica piatto «/.test(box.label||''),{pencil:box.pencil,label:box.label})
    await pg.screenshot({path:join(OUT,`layer-${label}-selezione-piatto.png`)})
    await clear();const pr=box.pencil;const pat={x:iframeOffset.x+pr.x+pr.w/2,y:iframeOffset.y+pr.y+pr.h/2}
    if(emu.hasTouch)await pg.touchscreen.tap(pat.x,pat.y);else await pg.mouse.click(pat.x,pat.y)
    await wait(150);const op=await last('tako-menu-edit-open');check(`${label}: matita → open {kind:item,id}`,op?.kind==='item'&&op?.id===ids.dish,op)
    // Esc deseleziona
    await clear();await frame.focus(`[data-edit-id="${ids.dish}"]`);await pg.keyboard.press('Escape');await wait(150)
    sel=await last('tako-menu-edit-select');box=await frameBox();check(`${label}: Esc → select {kind:null}, riquadro nascosto`,sel&&sel.kind===null&&!box.frame,sel)
    // titolo del Sottomenu
    await clear();const t=await rectOf(`[data-edit-select="section:${ids.root}"]`);const tat={x:iframeOffset.x+t.x+t.w/2,y:iframeOffset.y+t.y+t.h/2}
    const hit=await frame.evaluate((x,y)=>{const e=document.elementFromPoint(x,y);return e?e.tagName+(e.getAttribute('data-edit-select')?'['+e.getAttribute('data-edit-select')+']':'')+' '+String(e.className).slice(0,40):null},t.x+t.w/2,t.y+t.h/2)
    if(emu.hasTouch)await pg.touchscreen.tap(tat.x,tat.y);else await pg.mouse.click(tat.x,tat.y)
    await wait(250);sel=await last('tako-menu-edit-select');box=await frameBox()
    check(`${label}: titolo del Sottomenu → select {kind:section}, riquadro sul titolo`,sel?.kind==='section'&&sel.id===ids.root&&!!box.frame&&Math.abs(box.frame.w-(t.w+8))<2,{sel,frame:box.frame,title:t,hit,msgs:(await msgs()).map(m=>m.type+':'+(m.kind??''))})
    check(`${label}: matita del Sottomenu dice «sottomenu»`,/^Modifica sottomenu/.test(box.label||''),box.label)
    // tastiera: Tab porta al prossimo elemento e lo seleziona, Invio = matita
    await clear();await pg.keyboard.press('Tab');await wait(150);sel=await last('tako-menu-edit-select')
    check(`${label}: Tab → selezione dell'elemento successivo`,!!sel&&!!sel.kind,sel)
    await clear();await frame.focus(`[data-edit-id="${ids.child2}"] h2`);await wait(100);await pg.keyboard.press('Enter');await wait(150)
    const op2=await last('tako-menu-edit-open');check(`${label}: tastiera Invio sul titolo della Sezione figlia → open {kind:section}`,op2?.kind==='section'&&op2.id===ids.child2,op2)
    box=await frameBox();check(`${label}: matita della Sezione figlia dice «sezione»`,/^Modifica sezione/.test(box.label||''),box.label)
    // clic fuori deseleziona
    await clear();const outside=await frame.evaluate(()=>{const b=document.querySelector('[data-menu-edit-root]').getBoundingClientRect();return {x:b.x+6,y:Math.round(innerHeight/2)}})
    if(emu.hasTouch)await pg.touchscreen.tap(iframeOffset.x+outside.x,iframeOffset.y+outside.y);else await pg.mouse.click(iframeOffset.x+outside.x,iframeOffset.y+outside.y)
    await wait(150);sel=await last('tako-menu-edit-select');check(`${label}: clic fuori → deseleziona`,sel&&sel.kind===null,{sel,outside})
    // flash dalla SPA
    await frame.evaluate(id=>{window.__flashSeen=false;const el=document.querySelector(`[data-edit-id="${id}"]`);new MutationObserver(()=>{if(el.hasAttribute('data-edit-flash'))window.__flashSeen=true}).observe(el,{attributes:true,attributeFilter:['data-edit-flash']})},ids.dish)
    await pg.evaluate(id=>window.__send({flash:[id]}),ids.dish);await wait(400)
    const flashed=await frame.evaluate(()=>window.__flashSeen);check(`${label}: flash della SPA → lampeggio dell'elemento`,flashed)
    await pg.evaluate(()=>window.__send({flash:[]}))
    if(label!=='1280'){await pg.close();continue}
    // logica dati del riordino: onDrop dello stub (Piatto in un'altra Sezione, in testa) → op move + DOM nell'ordine nuovo
    await clear()
    await frame.evaluate((o)=>window.__takoMenuGestureStub.drop({id:o.moved,kind:'dish',fromGroup:'items:'+o.child,toGroup:'items:'+o.child2,toIndex:0}),ids);await wait(300)
    const ops=await last('tako-menu-edit-ops'),order=await frame.evaluate(o=>Array.from(document.querySelectorAll(`[data-edit-group-id="items:${o.child2}"] > [data-edit-id]`)).map(e=>e.getAttribute('data-edit-id')),ids)
    check('1280: onDrop Piatto → tako-menu-edit-ops {move item, toParentId, at.beforeId}',ops?.v===1&&ops.ops?.[0]?.op==='move'&&ops.ops[0].kind==='item'&&ops.ops[0].toParentId===ids.child2&&ops.ops[0].at?.beforeId===u(320)&&typeof ops.seq==='number'&&!ops.provisional,ops)
    check('1280: dopo il rilascio ordine DOM = ordine del documento locale',order[0]===ids.moved&&order.length===3,order)
    // Sezione figlia riordinata nel suo Sottomenu
    await clear();await frame.evaluate(o=>window.__takoMenuGestureStub.drop({id:o.child2,kind:'section',fromGroup:'children:'+o.root,toGroup:'children:'+o.root,toIndex:0}),ids);await wait(300)
    const secOps=await last('tako-menu-edit-ops'),secOrder=await frame.evaluate(o=>Array.from(document.querySelectorAll(`[data-edit-group-id="children:${o.root}"] > [data-edit-id]`)).map(e=>e.getAttribute('data-edit-id')),ids)
    check('1280: onDrop Sezione → op move section dentro il Sottomenu, DOM riordinato',secOps?.ops?.[0]?.op==='move'&&secOps.ops[0].kind==='section'&&secOrder[0]===ids.child2,{ops:secOps?.ops,secOrder})
    // canDrop: un piatto non si posa fra le Sezioni
    await clear();await frame.evaluate(o=>window.__takoMenuGestureStub.drop({id:o.dish,kind:'dish',fromGroup:'items:'+o.root,toGroup:'children:'+o.root,toIndex:0}),ids);await wait(150)
    check('1280: piatto rilasciato fuori dal suo tipo di contenitore → nessuna op',!(await msgs()).some(m=>m.type==='tako-menu-edit-ops'))
    // tastiera minima dello stub: Spazio prende (tremolio, nessuna fotografia: CONTRATTO §2 rivisto), freccia giù, Spazio posa
    await clear();await frame.focus(`[data-edit-id="${u(330)}"]`).catch(()=>{})
    const pillRoot=await frame.evaluate(()=>document.querySelector('[data-edit-kind="dish"]')?.getAttribute('data-edit-id'))
    await frame.focus(`[data-edit-id="${pillRoot}"]`);await pg.keyboard.press('Space');await wait(200)
    const mode=await last('tako-menu-edit-mode'),prov=(await msgs()).find(m=>m.type==='tako-menu-edit-ops'&&m.provisional)
    check('1280: Spazio → tako-menu-edit-mode {editing:true}',mode?.editing===true,mode)
    check('1280: entrata nel tremolio con documento non manuale → nessuna op (niente fotografia provvisoria)',!prov&&!(await msgs()).some(m=>m.type==='tako-menu-edit-ops'),prov&&prov.ops.map(o=>o.op))
    const jiggle=await frame.evaluate(()=>!!document.querySelector('[data-edit-jiggle]')),emptyH=await frame.evaluate(o=>document.querySelector(`[data-edit-group-id="items:${o.empty}"]`)?.getBoundingClientRect().height,ids)
    check('1280: in modalità tremolio le aree di rilascio vuote sono visibili',jiggle&&emptyH>=50,{jiggle,emptyH})
    await pg.screenshot({path:join(OUT,'layer-1280-tremolio-aree-vuote.png')})
    await pg.keyboard.press('ArrowDown');await pg.keyboard.press('Space');await wait(300)
    const kOps=(await msgs()).filter(m=>m.type==='tako-menu-edit-ops'&&!m.provisional).at(-1)
    check('1280: tastiera stub (Spazio, ↓, Spazio) → op move del piatto, senza fotografia ordine manuale',kOps?.ops?.[0]?.op==='move'&&kOps.ops[0].id===pillRoot&&!kOps.ops.some(o=>o.op==='manualOrder'),kOps?.ops)
    await clear();await pg.evaluate(()=>window.__exit());await wait(150);const out=await last('tako-menu-edit-mode')
    check('1280: «Fine» della SPA (tako-menu-edit-exit) → mode {editing:false}',out?.editing===false,out)
    // la SPA rimanda un documento (es. scarta il provvisorio): la vista si riallinea
    await pg.evaluate(()=>window.__send({}));await wait(300)
    const back=await frame.evaluate(o=>Array.from(document.querySelectorAll(`[data-edit-group-id="items:${o.child2}"] > [data-edit-id]`)).map(e=>e.getAttribute('data-edit-id')),ids)
    check('1280: documento della SPA → la vista torna a quello (nessuna modifica locale residua)',back[0]===u(320),back)
    // rilascio di un Sottomenu su documento non manuale → fotografia + reorder nello stesso messaggio, op reali
    await clear()
    const pill=await frame.evaluate(()=>{const p=Array.from(document.querySelectorAll('[data-edit-kind="submenu"]'));const el=p[1]||p[0];return el?{id:el.getAttribute('data-edit-id'),group:el.getAttribute('data-edit-group'),count:p.length}:null})
    if(pill){await frame.evaluate(p=>window.__takoMenuGestureStub.drop({id:p.id,kind:'submenu',fromGroup:p.group,toGroup:p.group,toIndex:0}),pill);await wait(300)}
    const pOps=(await msgs()).filter(m=>m.type==='tako-menu-edit-ops')
    check('1280: rilascio Sottomenu su documento non manuale → un solo messaggio con manualOrder + reorder, non provvisorio',!!pill&&pOps.length===1&&!pOps[0].provisional&&pOps[0].ops.some(o=>o.op==='manualOrder'&&o.value===true)&&pOps[0].ops.some(o=>o.op==='reorder'),{pill,ops:pOps.map(m=>m.ops.map(o=>o.op))})
    await pg.evaluate(()=>window.__send({}));await wait(300)
    // messaggi da origine sbagliata ignorati
    const before=await frame.evaluate(()=>document.querySelectorAll('[data-edit-id]').length)
    await frame.evaluate(()=>window.postMessage({type:'tako-menu-edit-state',v:1,document:{schemaVersion:1,menus:[],design:{}},menuId:'x',selection:null,flash:[],disabled:false,editing:false},'*'));await wait(150)
    check('1280: messaggio non della finestra genitore ignorato',(await frame.evaluate(()=>document.querySelectorAll('[data-edit-id]').length))===before)
    await pg.close()
   }catch(e){check(`${label}: errore`,false,String(e?.stack||e).slice(0,400));await pg.close().catch(()=>{})}
  }
 }finally{await browser.close();server.close();await rm(dir,{recursive:true,force:true})}
 const pixelsOk=results.identical.length>0&&results.identical.every(r=>r.changedPixels===0&&!r.error),layerOk=results.layer.every(r=>r.ok)
 results.summary={identicalRuns:results.identical.length,identicalAllZero:pixelsOk,layerChecks:results.layer.length,layerFailed:results.layer.filter(r=>!r.ok).map(r=>r.name)}
 await writeFile(join(OUT,'identical.json'),JSON.stringify(results,null,1))
 console.log(JSON.stringify(results.summary,null,1))
 if(!pixelsOk||!layerOk)process.exitCode=1
}
await main()
