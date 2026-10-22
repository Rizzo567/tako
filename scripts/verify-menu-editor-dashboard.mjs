// Dashboard editor 22/10 (T6/T8/T9) — QA della voce Piatti col flag dashboardEditor.
// Componenti VERI della SPA (ScreenMenuWorkspace + 13-menu-editor*.js), menu-ops vera (lib/menu-ops.js), anteprima = renderer VERO di
// apps/web (MenuPreview) compilato con esbuild. API finta nel server Node (stato condiviso fra pagine, latenza e guasti iniettabili,
// stesse forme di CONTRATTO §3; le op si applicano con la stessa applyOps). Ruolo titolare. Chrome SEMPRE headless.
// Se il layer di modifica dell'iframe (altro perimetro) non c'è ancora, i messaggi dell'iframe (§4) sono simulati dal frame stesso.
// Uscita: docs/webapp/dashboard-editor-2026-10-22/shots/*.png, video/*.webm, shots/verifica-dashboard.json
import puppeteer from 'puppeteer-core'
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises'
import {resolve,extname,join,dirname} from 'node:path'
import {createRequire} from 'node:module'
import {tmpdir} from 'node:os'
import {createServer} from 'node:http'
import {execFileSync} from 'node:child_process'
import {runInNewContext} from 'node:vm'
import {fileURLToPath} from 'node:url'
import {transform,build} from 'esbuild'
import assert from 'node:assert/strict'
import {buildMenuOpsLib} from './build-staff-web.mjs'

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(repo,'apps/dashboard/public/staff')
const pdfjsDir=dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))
export const DOCS=resolve(repo,'docs/webapp/dashboard-editor-2026-10-22')
export const U=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const item=(n,name,price,extra={})=>({id:U(n),name,description:null,price,imageUrl:null,allergens:[],tags:[],additives:[],available:true,hidden:false,featured:false,displayMode:'normal',variants:[],translations:{},...extra})
const section=(n,name,items,extra={})=>({id:U(n),parentSectionId:null,name,description:null,active:true,translations:{},items,...extra})
const pdf={format:'A4',orientation:'portrait',columns:1,margin:36,fontSize:11,showCover:false,showImages:false,showPrices:true,showDescriptions:true,showAllergens:true,showPageNumbers:true,showQr:true,footer:'',font:'sans',alignment:'left',categoryPageBreak:false,background:'#ffffff',textColor:'#242628',headingColor:'#242628',nameBold:true,descriptionItalic:false,headingFontSize:18,showLogo:true,logoShape:'rounded',showFoodLegends:true,showMenuName:true,showDate:false,includeUnavailable:false,translationPolicy:'fallback',translationNamesPolicy:'all',verticalCentered:false,backgroundImageUrl:null,backgroundOpacity:1,backgroundSize:'cover',logoBackground:null}
const design={preset:'tako',font:'sans',layout:'list',background:'#f8f5ef',text:'#242628',primary:'#242628',categoryBackground:'#242628',categoryText:'#ffffff',fontSize:16,spacing:16,imageShape:'rounded',showImages:true,showPrices:true,showDescriptions:true,showAllergens:true,headerTitle:'Trattoria Prova',headerDescription:'',logoUrl:null,coverUrl:null,links:[],navigation:'tabs',standard:{},centered:{},link:{}}
export const fixture=()=>({schemaVersion:1,languages:['it'],defaultLanguage:'it',translationSettings:{protectedNames:[],glossary:[]},foodTranslations:{},design,pdf,pdfPresets:[],menus:[
 {id:U(1),name:'Menu pranzo',description:null,type:'lunch',active:true,translations:{},sections:[
  section(10,'Primi',[item(100,'Pasta al pomodoro',9,{description:'Pomodoro fresco e basilico'}),item(101,'Risotto ai funghi',12,{hidden:true}),item(102,'Lasagna',11)]),
  section(11,'Secondi',[item(110,'Pollo arrosto',14),item(111,'Cotoletta',15)]),
  section(13,'Di mare',[item(130,'Frittura',16)],{parentSectionId:U(11)}),
  section(12,'Contorni',[item(120,'Patate al forno',4),item(121,'Insalata mista',4)])]},
 {id:U(2),name:'Menu cena',description:null,type:'dinner',active:true,translations:{},sections:[section(20,'Pizze',[item(200,'Margherita',7),item(201,'Diavola',8)])]}]})
const clone=v=>JSON.parse(JSON.stringify(v))
const pdfBytes=()=>{const o=['%PDF-1.4\n'],x=[];const add=s=>{x.push(o.join('').length);o.push(s)};add('1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n');add('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n');add('3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n');const start=o.join('').length;o.push('xref\n0 4\n0000000000 65535 f \n'+x.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer<</Size 4/Root 1 0 R>>\nstartxref\n'+start+'\n%%EOF');return Buffer.from(o.join(''))}

/* Avvia: bundle SPA + anteprima vera + server con API finta. Restituisce {base, srv, browser, close, open(vp)}. */
export async function startHarness({flag=true}={}){
 const opsLib=await buildMenuOpsLib();const ctx={};ctx.window=ctx;runInNewContext(opsLib+';window.TakoMenuOps=TakoMenuOps;',ctx);const Ops=ctx.TakoMenuOps
 const index=await readFile(resolve(root,'index.html'),'utf8')
 const files=[...index.matchAll(/type="text\/babel" src="src\/([^"]+)"/g)].map(m=>m[1]).filter(f=>!['07-app-root.js','12-login-gate.js','20-agency-dashboard.js','21-agency-leads.js'].includes(f))
 const source=(await Promise.all(files.map(f=>readFile(resolve(root,'src',f),'utf8')))).join('\n')
 const globals=`window.__takoRole='owner';window.__takoRestaurantId='r-prova';window.__takoUser={restaurantName:'Trattoria Prova'};\n`
 const mount=`const __mobile=innerWidth<720;function __Harness(){return <div className={'screen app-live'+(__mobile?' mobile':'')} style={{width:'100%',height:'100dvh',display:'flex',flexDirection:'column',background:'var(--surface)'}}><ScreenMenuWorkspace mobile={__mobile}/><Toaster mobile={__mobile}/></div>}\nwindow.__mount=()=>ReactDOM.createRoot(document.getElementById('root')).render(<__Harness/>);\n`
 const compiled=(await transform(globals+source+'\n'+mount,{loader:'jsx',format:'iife'})).code
 const tmp=await mkdtemp(join(tmpdir(),'tako-editor-preview-'))
 await writeFile(join(tmp,'entry.tsx'),`import {createRoot} from 'react-dom/client'\nimport {MenuPreview} from '@/components/MenuPreview'\ncreateRoot(document.getElementById('root')!).render(<MenuPreview menuId={location.pathname.split('/').pop()||''}/>)\n`)
 await build({entryPoints:[join(tmp,'entry.tsx')],bundle:true,outdir:join(tmp,'preview'),format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css','.png':'dataurl','.svg':'dataurl','.woff2':'file','.woff':'file','.ttf':'file'},external:['/takomenu-public/*','/assets/*','/fonts/*'],alias:{'@':resolve(repo,'apps/web/src'),'@tako/types':resolve(repo,'packages/types/src/index.ts'),'@tako/menu-ops':resolve(repo,'packages/menu-ops/src/index.ts')},define:{'process.env.NODE_ENV':'"production"'},nodePaths:[resolve(repo,'apps/web/node_modules'),resolve(repo,'node_modules')],logLevel:'error'})
 execFileSync(resolve(repo,'apps/web/node_modules/.bin/tailwindcss'),['-c','tailwind.config.ts','-i','src/app/globals.css','-o',join(tmp,'preview/tw.css')],{cwd:resolve(repo,'apps/web'),stdio:'ignore'})
 const css=[...index.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1])
 const html=`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${css.map(f=>`<link rel="stylesheet" href="/staff/${f}">`).join('')}<body style="margin:0"><div id="root"></div><script src="/staff/lib/react.js"></script><script src="/staff/lib/react-dom.js"></script><script src="/staff/lib/menu-ops.js"></script><script src="/fixture.js"></script></body></html>`
 const previewHtml=`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/preview/tw.css"><link rel="stylesheet" href="/preview/entry.css"><body><div id="root"></div><script src="/preview/entry.js"></script></body></html>`
 const types={'.wasm':'application/wasm','.bcmap':'application/octet-stream','.pfb':'application/octet-stream','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.mjs':'text/javascript'}
 // ── API finta (stato condiviso) ──
 const srv={doc:fixture(),published:fixture(),revision:3,publishedRevision:3,flag,latency:40,fail:[],offline:false,calls:[],label:'Pubblicazione',labelAt:new Date().toISOString(),pdf:[]}
 const pending=()=>JSON.stringify(srv.doc)!==JSON.stringify(srv.published)
 const body=()=>({data:srv.doc,revision:srv.revision,publishedRevision:srv.publishedRevision,pending:pending(),dashboardEditor:srv.flag,presentation:{restaurantName:'Trattoria Prova'}})
 const items=d=>new Map(d.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>[i.id,i]))))
 const diff=()=>{const a=items(srv.published),b=items(srv.doc),details=[];b.forEach((v,k)=>{const p=a.get(k);if(!p)details.push({id:k,action:'added',label:v.name,fields:[]});else if(JSON.stringify(p)!==JSON.stringify(v))details.push({id:k,action:'changed',label:v.name,fields:Object.keys(v).filter(f=>JSON.stringify(v[f])!==JSON.stringify(p[f])).map(f=>({field:f,label:f,before:p[f],after:v[f]}))});});a.forEach((v,k)=>{if(!b.has(k))details.push({id:k,action:'removed',label:v.name,fields:[]})});
  const sect=d=>JSON.stringify(d.menus.map(m=>[m.id,m.name,m.active,m.sections.map(s=>[s.id,s.name,s.active,s.parentSectionId,s.items.map(i=>i.id)])]));if(!details.length&&(sect(srv.doc)!==sect(srv.published)||JSON.stringify(srv.doc.design)!==JSON.stringify(srv.published.design)))details.push({id:'struttura',action:'changed',label:'Ordine e struttura del menu',fields:[]});
  return {revision:srv.revision,details,added:details.filter(d=>d.action==='added'),removed:details.filter(d=>d.action==='removed'),changed:details.filter(d=>d.action==='changed')}}
 srv.bot=(id,fields,label='WhatsApp: modifica')=>{for(const d of [srv.doc,srv.published]){const r=Ops.applyOps(d,[{op:'set',kind:'item',id,fields}]);Object.assign(d,r.workspace)}srv.revision+=2;srv.publishedRevision=srv.revision;srv.label=label;srv.labelAt=new Date().toISOString()}
 srv.applyOps=ops=>{const r=Ops.applyOps(srv.doc,ops);const changed=JSON.stringify(r.workspace)!==JSON.stringify(srv.doc);srv.doc=JSON.parse(JSON.stringify(r.workspace));if(changed)srv.revision++;return r.results}
 const json=(res,data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}
 const readBody=req=>new Promise(r=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{r(b?JSON.parse(b):null)}catch{r(null)}})})
 const failFor=p=>{const i=srv.fail.findIndex(f=>p.endsWith(f.path));if(i<0)return null;const f=srv.fail[i];if(--f.count<=0)srv.fail.splice(i,1);return f}
 async function api(req,res,p){const m=req.method,b=m==='GET'?null:await readBody(req);srv.calls.push({m,p,b,at:Date.now()})
  await new Promise(r=>setTimeout(r,srv.latency))
  if(srv.offline&&p!=='/api/menu-workspace/presentation'){req.socket.destroy();return}
  const f=failFor(p);if(f)return json(res,{error:{message:'Guasto iniettato'},currentRevision:srv.revision},f.status)
  if(p==='/api/menu-workspace'&&m==='GET')return json(res,body())
  if(p==='/api/menu-workspace'&&m==='PUT'){if(b.expectedRevision!==srv.revision)return json(res,{error:{message:'Il menu è cambiato'}},409);srv.doc=b.workspace;srv.revision++;return json(res,{data:srv.doc,revision:srv.revision})}
  if(p==='/api/menu-workspace/status')return json(res,{revision:srv.revision,publishedRevision:srv.publishedRevision,pending:pending(),lastLabel:srv.label,lastAt:srv.labelAt})
  if(p==='/api/menu-workspace/ops'){const results=srv.applyOps(b.ops);return json(res,{revision:srv.revision,publishedRevision:srv.publishedRevision,pending:pending(),results,seq:b.seq})}
  if(p==='/api/menu-workspace/publish/diff')return json(res,{data:{...diff(),botConflicts:srv.botConflicts||[]}})
  if(p==='/api/menu-workspace/publish'){srv.lastPublish=b;if(b.expectedRevision!==srv.revision)return json(res,{error:{message:'Il menu è cambiato'},currentRevision:srv.revision},409);if(srv.botConflicts?.length&&b.confirmBotConflicts!==true)return json(res,{error:{code:'BOT_CONFLICTS',message:'Da WhatsApp sono state fatte modifiche che non sono in questa bozza'},currentRevision:srv.revision,conflicts:srv.botConflicts},409);srv.botConflicts=[];srv.published=clone(srv.doc);srv.revision++;srv.publishedRevision=srv.revision;srv.label='Pubblicazione';return json(res,{data:{revision:srv.revision}})}
  if(p==='/api/menu-workspace/discard'){if(b.expectedRevision!==srv.revision)return json(res,{error:{message:'Il menu è cambiato'},currentRevision:srv.revision},409);srv.botConflicts=[];srv.doc=clone(srv.published);srv.revision++;srv.label='Bozza scartata';return json(res,body())}
  if(p==='/api/menu-workspace/versions')return json(res,{data:[{id:'v'+srv.revision,revision:srv.revision,label:srv.label,createdAt:srv.labelAt}]})
  if(p==='/api/menu-workspace/pdf'){srv.pdf.push({preview:b?.preview,menuIds:b?.menuIds,publishedRevision:srv.publishedRevision});res.setHeader('Content-Type','application/pdf');res.end(pdfBytes());return}
  if(p==='/api/menu-workspace/presentation')return json(res,{data:{restaurantName:'Trattoria Prova'}})
  if(['/api/menu-workspace/catalogs','/api/menu-workspace/presets','/api/menu-workspace/assets'].includes(p))return json(res,{data:[]})
  if(p==='/api/menu-workspace/pdf-documents')return json(res,{data:{documents:[],default:{name:'PDF predefinito',menuIds:[]}}})
  return json(res,{error:{message:'Non previsto: '+m+' '+p}},404)}
 const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname
  if(path.startsWith('/api/'))return await api(req,res,path)
  if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return}
  if(path==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled);return}
  if(path==='/staff/lib/menu-ops.js'){res.setHeader('Content-Type','text/javascript');res.end(opsLib);return}
  if(path.startsWith('/menu-preview/')){res.setHeader('Content-Type','text/html');res.end(previewHtml);return}
  const pj=path.match(/^(?:\/staff)?\/lib\/pdfjs\/(.+)$/);if(pj){const rel=decodeURIComponent(pj[1]),file=/^pdf(\.worker)?\.mjs$/.test(rel)?resolve(pdfjsDir,'legacy/build',rel):resolve(pdfjsDir,rel);if(!file.startsWith(pdfjsDir+'/'))throw Error('x');res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));return}
  if(path.startsWith('/preview/')){const file=join(tmp,path);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));return}
  const rel=path.startsWith('/staff/')?path.slice(6):path;const file=resolve(root,'.'+decodeURIComponent(rel));if(!file.startsWith(root+'/'))throw Error('x')
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{if(!res.headersSent){res.statusCode=404;res.end()}}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const base=`http://127.0.0.1:${server.address().port}/`
 const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox','--hide-scrollbars']})
 const errors=[]
 async function open(vp='desktop'){const page=await browser.newPage();page.on('pageerror',e=>errors.push(vp+': '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|favicon|ERR_|net::/.test(m.text()))errors.push(vp+' console: '+m.text())})
  page.on('dialog',d=>d.accept())
  if(vp==='mobile')await page.emulate({viewport:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'})
  else await page.setViewport({width:1280,height:900,deviceScaleFactor:1})
  // Due schede insieme (T7): ogni pagina si comporta da scheda visibile e con fuoco (poller e animazioni attivi).
  const cdp=await page.createCDPSession();await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true}).catch(()=>{})
  await page.goto(base);await page.evaluate(()=>window.__mount());return page}
 const close=async()=>{await browser.close().catch(()=>{});await new Promise(r=>server.close(r));await rm(tmp,{recursive:true,force:true})}
 return {base,srv,browser,open,close,errors,Ops}
}

/* ── Aiuti per pilotare la pagina ── */
export const wait=ms=>new Promise(r=>setTimeout(r,ms))
export async function frameOf(page){for(let i=0;i<100;i++){const f=page.frames().find(x=>x.url().includes('/menu-preview/'));if(f)return f;await wait(100)}throw new Error('iframe del menu assente')}
/* Registra nel frame ciò che la SPA gli manda (documento e stato). */
export async function tapFrame(page){const f=await frameOf(page);await f.waitForFunction(()=>document.readyState==='complete',{polling:100});await f.evaluate(()=>{if(window.__tap)return;window.__tap=true;window.__got=[];addEventListener('message',e=>{if(e.data&&typeof e.data.type==='string'){window.__got.push(e.data.type);if(e.data.document)window.__last=e.data;if(e.data.type==='tako-menu-edit-exit')window.__exit=(window.__exit||0)+1;}})});return f}
/* Messaggio dall'iframe alla SPA (come farebbe il layer di modifica §4). */
export async function fromFrame(page,msg){const f=await frameOf(page);await f.evaluate(m=>parent.postMessage({v:1,...m},location.origin),msg);await wait(60)}
export async function frameDoc(page){const f=await frameOf(page);return f.evaluate(()=>window.__last?.document||null)}
export async function waitFor(fn,ms=15000,label='condizione'){const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw new Error('Tempo scaduto: '+label);await wait(100)}}
export const strip=d=>{if(!d)return d;const {revision,publishedRevision,capabilities,pending,dashboardEditor,...x}=d;return x}

async function main(){
 const shotsDir=resolve(DOCS,'shots'),videoDir=resolve(DOCS,'video');await mkdir(shotsDir,{recursive:true});await mkdir(videoDir,{recursive:true})
 process.env.PATH='/opt/homebrew/bin:'+process.env.PATH
 const H=await startHarness();const {srv}=H;const results=[],shots=[]
 const ok=(name,detail='')=>{results.push({scenario:name,ok:true,detail});console.log('✓',name)}
 const shot=async(page,vp,name,label)=>{await wait(300);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+0.5);assert.equal(overflow,false,vp+' '+name+': scroll orizzontale');const file=vp+'-'+name+'.png';await page.screenshot({path:resolve(shotsDir,file)});shots.push({file,vp,label})}
 const sheetGone=page=>page.waitForFunction(()=>!document.querySelector('.mw-create-kind'),{timeout:6000}).catch(async e=>{await page.screenshot({path:resolve(DOCS,'shots/debug-sheet.png')});throw e});
 const click=async(page,text)=>{const done=await page.evaluate(t=>{const el=[...document.querySelectorAll('button,[role=radio]')].find(b=>b.offsetParent!==null&&!b.disabled&&(b.textContent.trim()===t||b.getAttribute('aria-label')===t));if(!el)return false;el.scrollIntoView({block:'center'});el.click();return true},text);assert.ok(done,'pulsante non trovato: '+text);await wait(250)}
 const typeIn=async(page,sel,val)=>{await page.$eval(sel,e=>{e.focus();e.select?.()});await page.keyboard.press('Backspace');await page.type(sel,val);await wait(60)}
 const status=page=>page.$eval('.mw-ed-status',e=>e.textContent).catch(()=>'')
 const settled=async(page)=>{await waitFor(async()=>{const d=await frameDoc(page);return d&&JSON.stringify(strip(d))===JSON.stringify(srv.doc)},15000,'vista = server')}
 try{
  for(const vp of ['desktop','mobile']){
   Object.assign(srv,{doc:fixture(),published:fixture(),revision:3,publishedRevision:3,fail:[],offline:false,flag:true,botConflicts:[]});srv.pdf=[]
   const page=await H.open(vp);let recorder=null
   if(vp==='desktop')recorder=await page.screencast({path:resolve(videoDir,'flusso-dashboard-desktop.webm'),ffmpegPath:'/opt/homebrew/bin/ffmpeg'})
   await page.waitForSelector('.mw-ed-stage');await tapFrame(page);await fromFrame(page,{type:'tako-menu-edit-ready'});await waitFor(()=>frameDoc(page),15000,'documento nell\'iframe')
   assert.equal(await page.$('.mw-catalog-list'),null,'la vecchia lista non è al centro');assert.match(await status(page),/Pubblicato/)
   if(vp==='desktop'){await page.waitForSelector('.mw-ed-pdf .mw-pdf-viewer',{timeout:15000});assert.ok(srv.pdf.some(x=>x.preview===false),'PDF del pubblicato (preview:false)')}
   await shot(page,vp,'01-apri','Apri Piatti: menu vero al centro'+(vp==='desktop'?', PDF pubblicato a destra':', pagina intera'));ok(vp+': apri')
   // Seleziona + matita (messaggi del layer simulati)
   await fromFrame(page,{type:'tako-menu-edit-ready'});await fromFrame(page,{type:'tako-menu-edit-select',kind:'item',id:U(100)})
   await waitFor(()=>(page.frames().find(x=>x.url().includes('/menu-preview/'))).evaluate(()=>window.__last?.type==='tako-menu-edit-state'&&window.__last.selection?.id),5000,'stato con selezione')
   await fromFrame(page,{type:'tako-menu-edit-open',kind:'item',id:U(100)})
   const panelSel=vp==='desktop'?'.mw-ed-popover':'dialog.mw-drawer[open]';await page.waitForSelector(panelSel)
   await shot(page,vp,'02-matita','Matita sul piatto: '+(vp==='desktop'?'pop-over ancorato':'foglio dal basso'));ok(vp+': seleziona + matita')
   await typeIn(page,panelSel+' .mw-ed-form input',vp+' Pasta fresca');await page.keyboard.press('Enter')
   await waitFor(()=>items0()[0].name===vp+' Pasta fresca',5000,'nome sul server');function items0(){return srv.doc.menus[0].sections[0].items}
   await waitFor(async()=>/Modifiche non pubblicate/.test(await status(page)),5000,'stato non pubblicato')
   await page.$eval(panelSel+' .mw-ed-visibility input[type=checkbox]',e=>e.click());await waitFor(()=>items0()[0].hidden===true,5000,'nascosto subito')
   await shot(page,vp,'03-campo-salvato','Campo confermato con Invio → op set, stato «Modifiche non pubblicate»');ok(vp+': modifica campi (Invio, casella) senza «Salva»')
   await page.keyboard.press('Escape');await wait(400);if(vp==='mobile'&&await page.$('dialog.mw-drawer[open]'))await page.$eval('dialog.mw-drawer[open] .mw-sheet-close',e=>e.click());await wait(500)
   // «+» a 4 scelte
   await click(page,'Aggiungi sottomenu o piatto');await page.waitForSelector('.mw-create-kind')
   const kinds=await page.$$eval('.mw-create-kind button',b=>b.map(x=>x.textContent.trim()));assert.deepEqual(kinds,['Menu','Sottomenu','Sezione','Piatto'])
   await shot(page,vp,'04-piu-4-scelte','«+» con Menu / Sottomenu / Sezione / Piatto, genitore preselezionato')
   await typeIn(page,'input[aria-label="Nome piatto"]','Tiramisù');await click(page,'Salva')
   await waitFor(()=>srv.doc.menus[0].sections[0].items.some(i=>i.name==='Tiramisù'),5000,'piatto creato')
   const created=srv.doc.menus[0].sections[0].items.find(i=>i.name==='Tiramisù');assert.equal(created.sectionId,undefined)
   assert.equal(srv.doc.design.manualOrder,undefined,'creare un Piatto non fotografa l’ordine (CONTRATTO §2 rivisto)')
   await waitFor(()=>page.frames().find(x=>x.url().includes('/menu-preview/')).evaluate(id=>window.__last?.selection?.id===id&&window.__last.flash?.includes(id),created.id),5000,'nuovo piatto selezionato e lampeggiante')
   await sheetGone(page);await click(page,'Aggiungi sottomenu o piatto');await page.waitForSelector('.mw-create-kind');await click(page,'Sottomenu');await typeIn(page,'input[aria-label="Nome del sottomenu"]','Dolci');await click(page,'Salva')
   await waitFor(()=>srv.doc.menus[0].sections.some(s=>s.name==='Dolci'&&s.active===false),5000,'sottomenu nascosto creato');await sheetGone(page)
   // Creare un Sottomenu dal «+» fotografa l'ordine visto (vista tako-menu-edit-view del layer vero) → ordine manuale
   assert.equal(srv.doc.design.manualOrder,true,'Sottomenu creato → ordine manuale')
   await click(page,'Aggiungi sottomenu o piatto');await page.waitForSelector('.mw-create-kind');await click(page,'Sezione');await typeIn(page,'input[aria-label="Nome della sezione"]','Al cucchiaio');await click(page,'Salva')
   await waitFor(()=>srv.doc.menus[0].sections.some(s=>s.name==='Al cucchiaio'&&s.parentSectionId),5000,'sezione figlia creata');await sheetGone(page)
   ok(vp+': «+» a 4 scelte, op create, compare subito, selezionato, Menu/Sottomenu nascosti')
   // Gesto: modalità tremolio, op provvisorie, rilascio, «Fine»
   await fromFrame(page,{type:'tako-menu-edit-mode',editing:true});await page.waitForSelector('.mw-ed-done')
   const menuId=U(1),order=srv.doc.menus[0].sections.map(s=>s.id)
   await fromFrame(page,{type:'tako-menu-edit-ops',provisional:true,seq:1,ops:[{op:'manualOrder',value:true},{op:'reorder',kind:'section',parentId:menuId,ids:order}]})
   const beforeProv=JSON.stringify(srv.doc);await wait(700);assert.equal(JSON.stringify(srv.doc),beforeProv,'provvisorie mai inviate da sole')
   await shot(page,vp,'05-tremolio-fine','Modalità tremolio: «Fine» in alto a destra')
   await fromFrame(page,{type:'tako-menu-edit-ops',seq:2,ops:[{op:'move',kind:'item',id:U(110),toParentId:U(12),at:{beforeId:U(120)}}]})
   await waitFor(()=>srv.doc.design.manualOrder===true&&srv.doc.menus[0].sections.find(s=>s.id===U(12)).items[0].id===U(110),5000,'snapshot + rilascio sul server')
   await click(page,'Fine');await waitFor(()=>page.frames().find(x=>x.url().includes('/menu-preview/')).evaluate(()=>window.__exit>0),3000,'tako-menu-edit-exit')
   await fromFrame(page,{type:'tako-menu-edit-mode',editing:false});await settled(page);ok(vp+': gesto (provvisorie davanti al primo rilascio, «Fine» → exit)')
   // Fine senza rilasci: le provvisorie si annullano
   const before=JSON.stringify(srv.doc);await fromFrame(page,{type:'tako-menu-edit-mode',editing:true});await fromFrame(page,{type:'tako-menu-edit-ops',provisional:true,seq:3,ops:[{op:'reorder',kind:'section',parentId:menuId,ids:[...order].reverse()}]})
   await fromFrame(page,{type:'tako-menu-edit-mode',editing:false});await wait(700);assert.equal(JSON.stringify(srv.doc),before);await settled(page);ok(vp+': «Fine» senza rilasci annulla le provvisorie')
   // Pubblica
   const pdfBefore=srv.pdf.length;await click(page,'Pubblica');await page.waitForSelector('dialog.mw-ed-publish[open] .mw-diff')
   await shot(page,vp,'06-pubblica','Pubblica: elenco differenze, «Pubblica ora», «Scarta le modifiche»')
   await click(page,'Pubblica ora');await waitFor(()=>JSON.stringify(srv.doc)===JSON.stringify(srv.published),5000,'pubblicato');await waitFor(async()=>/^Pubblicato/.test(await status(page)),5000,'stato Pubblicato')
   if(vp==='desktop')await waitFor(()=>srv.pdf.length>pdfBefore&&srv.pdf.at(-1).publishedRevision===srv.publishedRevision,8000,'PDF rigenerato dopo Pubblica')
   ok(vp+': Pubblica (coda vuota, riquadro, PDF aggiornato)')
   // Scarta
   await fromFrame(page,{type:'tako-menu-edit-ops',seq:4,ops:[{op:'set',kind:'item',id:U(102),fields:{price:99}}]});await waitFor(()=>srv.doc.menus[0].sections[0].items.some(i=>i.price===99),5000,'bozza')
   await click(page,'Pubblica');await page.waitForSelector('dialog.mw-ed-publish[open] .mw-diff');await click(page,'Scarta le modifiche')
   await waitFor(()=>JSON.stringify(srv.doc)===JSON.stringify(srv.published),5000,'scartato');await settled(page);ok(vp+': Scarta le modifiche')
   // Conflitti bot al Pubblica: riquadro aperto senza conflitti, il bot ne crea uno → «Pubblica ora» = 409 BOT_CONFLICTS → avviso + «Pubblica comunque»
   await fromFrame(page,{type:'tako-menu-edit-ops',seq:41,ops:[{op:'set',kind:'item',id:U(102),fields:{price:98}}]});await waitFor(()=>srv.doc.menus[0].sections[0].items.some(i=>i.price===98),5000,'bozza conflitti')
   await click(page,'Pubblica');await page.waitForSelector('dialog.mw-ed-publish[open] .mw-diff');assert.equal(await page.$('.mw-ed-bot-conflicts'),null,'nessun avviso senza conflitti')
   srv.botConflicts=[{kind:'item',id:U(130),name:'Frittura',reason:'missing'}]
   await click(page,'Pubblica ora');await page.waitForSelector('dialog.mw-ed-publish[open] .mw-ed-bot-conflicts',{timeout:8000})
   const warn=await page.$eval('.mw-ed-bot-conflicts',e=>e.textContent);assert.match(warn,/Da WhatsApp sono state fatte modifiche che non sono in questa bozza: Frittura\. Se pubblichi, ai clienti tornerà la versione della bozza\./);assert.doesNotMatch(warn,/categori/i)
   assert.notEqual(JSON.stringify(srv.doc),JSON.stringify(srv.published),'409: niente pubblicato');assert.equal(await page.$eval('dialog.mw-ed-publish .mw-publish-error',e=>e.textContent).catch(()=>''),'','nessun «il menu è cambiato»')
   const btns=await page.$$eval('dialog.mw-ed-publish .mw-publish-actions button',b=>b.map(x=>x.textContent.trim()));assert.ok(btns.includes('Pubblica comunque')&&btns.includes('Annulla')&&!btns.includes('Pubblica ora'),'scelte: '+btns)
   await shot(page,vp,'06b-conflitti-bot','Pubblica con modifiche da WhatsApp non in bozza: avviso Sobrio, «Pubblica comunque» / «Annulla»')
   await click(page,'Pubblica comunque');await waitFor(()=>JSON.stringify(srv.doc)===JSON.stringify(srv.published),5000,'pubblicato comunque');assert.equal(srv.lastPublish.confirmBotConflicts,true);assert.deepEqual(srv.botConflicts,[])
   await waitFor(async()=>/^Pubblicato/.test(await status(page)),5000,'stato Pubblicato dopo conferma');await settled(page);ok(vp+': conflitti bot → 409, avviso, «Pubblica comunque» con conferma')
   // Notifica WhatsApp
   srv.bot(U(111),{price:17},'WhatsApp: prezzo Cotoletta')
   await page.waitForFunction(()=>/Aggiornato da WhatsApp/.test(document.querySelector('.mw-live-toast-text')?.textContent||''),{timeout:15000})
   await waitFor(()=>page.frames().find(x=>x.url().includes('/menu-preview/')).evaluate(id=>window.__last?.flash?.includes(id),U(111)),3000,'lampeggio piatto del bot')
   await shot(page,vp,'07-whatsapp','Notifica «Aggiornato da WhatsApp: Cotoletta» + lampeggio');ok(vp+': notifica WhatsApp')
   // Errori: 404 → pillola + ricarica; offline → pillola + ripresa
   srv.fail.push({path:'/ops',status:404,count:1});await fromFrame(page,{type:'tako-menu-edit-ops',seq:5,ops:[{op:'set',kind:'item',id:U(120),fields:{price:5}}]})
   await page.waitForFunction(()=>/Modifica non applicata/.test(document.querySelector('.mw-live-toast-text')?.textContent||''),{timeout:8000});await settled(page)
   srv.offline=true;await fromFrame(page,{type:'tako-menu-edit-ops',seq:6,ops:[{op:'set',kind:'item',id:U(121),fields:{price:6}}]})
   await page.waitForFunction(()=>/Non salvato, riprovo/.test(document.querySelector('.mw-live-toast-text')?.textContent||''),{timeout:8000})
   await shot(page,vp,'08-offline','Rete assente: «Non salvato, riprovo», la modifica resta in coda')
   srv.offline=false;await waitFor(()=>srv.doc.menus[0].sections.find(s=>s.id===U(12)).items.some(i=>i.price===6),20000,'ripresa dopo offline');await settled(page);ok(vp+': errori 404 e offline')
   // Avanzate: vecchia lista con tutte le funzioni; ritorno
   await click(page,'Avanzate');await page.waitForSelector('.mw-catalog-list');await shot(page,vp,'09-avanzate','«Avanzate»: la lista di prima con selezione multipla, preset, prezzo fisso, ricerca')
   await click(page,'← Torna al menu');await page.waitForSelector('.mw-ed-stage');ok(vp+': Avanzate e ritorno')
   if(recorder)await recorder.stop()
   await page.close()
  }
  // Flag spento: schermata di oggi
  Object.assign(srv,{doc:fixture(),published:fixture(),revision:3,publishedRevision:3,flag:false})
  const off=await H.open('desktop');await off.waitForSelector('.mw-catalog-list');assert.equal(await off.$('.mw-ed-stage'),null);assert.equal(await off.$('.mw-ed-advanced'),null)
  assert.deepEqual(await off.$$eval('.mw-create-kind button',b=>b.length).catch(()=>0),0);await shot(off,'desktop','10-flag-spento','Flag spento: schermata Menu di oggi');ok('flag spento: schermata di oggi');await off.close()
  assert.deepEqual(H.errors,[]);ok('nessun errore nel browser')
  await writeFile(resolve(shotsDir,'verifica-dashboard.json'),JSON.stringify({ambito:'SPA vera + renderer vero + API finta (Node), ruolo owner, Chrome headless; messaggi del layer iframe simulati',risultati:results,screenshot:shots,video:['video/flusso-dashboard-desktop.webm']},null,1))
  console.log(JSON.stringify({ok:true,scenari:results.length,shots:shots.length},null,1))
 }catch(e){console.error('ERRORI BROWSER',H.errors);results.push({scenario:'ERRORE',ok:false,detail:String(e&&e.stack||e)});await writeFile(resolve(shotsDir,'verifica-dashboard.json'),JSON.stringify({risultati:results},null,1)).catch(()=>{});process.exitCode=1;console.error(e)}
 finally{await H.close()}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main()
