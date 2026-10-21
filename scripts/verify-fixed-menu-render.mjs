// Menu «a prezzo fisso» (21/10): prove visive prima/dopo della pagina pubblica con il renderer VERO.
//
// Uso:
//   node scripts/verify-fixed-menu-render.mjs <workspace.json> <outdir> [menuName...]
//       Documento workspace (come menu_workspaces.published o il dry-run della migrazione) → pagina pubblica locale:
//       DigitalMenu + WorkspaceMenuRenderer veri (bundle esbuild di apps/web), proiezione pubblica vera
//       (publicWorkspace + publicMenuProjection di apps/server), CSS e font della pagina live. Nessuna scrittura remota.
//   node scripts/verify-fixed-menu-render.mjs --url <urlPaginaPubblica> <outdir> [menuName...]
//       Stessa cattura sulla pagina live (es. https://takoitalia.com/victoria-bar): il «prima», o il «dopo» a deploy fatto.
//   node scripts/verify-fixed-menu-render.mjs --compare <dirPrima> <dirDopo> [diffDir]
//       Confronta struttura (structure-*.json) e pixel dei PNG con lo stesso nome; scrive compare.json e i PNG di differenza.
//
// Per ogni Menu indicato (nome del Menu nella barra dei menu; senza nomi = tutti) e per ogni pillola di categoria salva
//   <menu>-<desktop|mobile>-<n>-<pillola>.png (pagina intera, 1280 e 375 px) e structure-<menu>-<viewport>.json.
// Movimento ridotto attivo e ora del telefono fissata (--hour, default 13) per catture ripetibili.
import {build} from 'esbuild'
import puppeteer from 'puppeteer-core'
import {createServer} from 'node:http'
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import {pathToFileURL} from 'node:url'

const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const LIVE='https://takoitalia.com'
const STRIP='nav[aria-label="Menu disponibili"] button'
const VIEWPORTS=[['desktop',1280,900],['mobile',375,812]]
const args=process.argv.slice(2)
const flag=(name,fallback)=>{const i=args.indexOf(name);if(i<0)return fallback;const v=args[i+1];args.splice(i,2);return v}
const hour=Number(flag('--hour','13'))
const slug=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'x'
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim()
const wait=ms=>new Promise(r=>setTimeout(r,ms))
const root=resolve(new URL('..',import.meta.url).pathname)

if(args[0]==='--compare'){await compare(resolve(args[1]),resolve(args[2]),resolve(args[3]||join(args[2],'diff')));process.exit(0)}
if(args[0]==='--url'){const [,url,out,...names]=args;await capture({url,out:resolve(out),names});process.exit(0)}
if(args.length<2){console.error('Uso: node scripts/verify-fixed-menu-render.mjs <workspace.json> <outdir> [menuName...] | --url <url> <outdir> [menuName...] | --compare <a> <b> [diff]');process.exit(2)}
{const [file,out,...names]=args;await local({file:resolve(file),out:resolve(out),names})}

/** Proiezione pubblica vera, compilata per Node con i moduli di database sostituiti da stub (servono solo le funzioni pure). */
async function serverLib(){
 const stub='export const db={};export const menuItems={};export const sql=()=>({});export const and=()=>({});export const eq=()=>({});export async function readWorkspace(){return null}'
 const outfile=join(tmpdir(),`tako-fixed-menu-projection-${process.pid}.mjs`)
 await build({stdin:{contents:`export {publicMenuProjection,defaultPublicMenu} from './src/lib/published-menu.ts';export {publicWorkspace} from './src/lib/menu-workspace-schedule.ts';export {workspaceSchema} from './src/lib/menu-workspace-contract.ts'`,resolveDir:resolve(root,'apps/server'),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile,logLevel:'error',
  plugins:[{name:'stub-db',setup(b){b.onResolve({filter:/^(@tako\/db|drizzle-orm)$|menu-workspace-store\.js$/},a=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:stub,loader:'js'}))}}]})
 return import(pathToFileURL(outfile).href)
}

async function liveShell(){
 // Stessi fogli di stile e classi del body della pagina live (Tailwind + font); i moduli CSS del renderer vengono dal bundle.
 try{const html=await (await fetch(LIVE+'/victoria-bar')).text();const links=[...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]).filter(h=>!/WorkspaceMenuRenderer/.test(h));const body=html.match(/<body class="([^"]*)"/)?.[1]||'';if(links.length)return {links,body}}catch{}
 const assets=resolve(root,'release/serverless/static/assets');const css=existsSync(assets)?(await readdir(assets)).filter(n=>/^index-.*\.css$/.test(n)):[]
 return {links:css.map(n=>'/__release/'+n),body:'font-body antialiased max-w-lg mx-auto min-h-[100dvh] bg-[var(--surface-base)] text-[var(--text-primary)]'}
}

async function local({file,out,names}){
 await mkdir(out,{recursive:true})
 const lib=await serverLib()
 const raw=JSON.parse(await readFile(file,'utf8'))
 const parsed=lib.workspaceSchema.safeParse(raw.published??raw)
 if(!parsed.success)console.warn('Attenzione: documento non valido per lo schema, uso i dati grezzi:',parsed.error.issues.slice(0,5).map(i=>i.path.join('.')+' '+i.message).join('; '))
 const workspace=lib.publicWorkspace(parsed.success?parsed.data:(raw.published??raw),new Date(),{ignoreSchedules:true})
 const restaurantId=raw.restaurantId||'00000000-0000-4000-8000-000000000000'
 const api=(menuId,lang)=>{const selected=menuId?workspace.menus.find(m=>m.id===menuId):lib.defaultPublicMenu(workspace.menus);if(!selected)return null;const language=lang||workspace.defaultLanguage
  return {data:lib.publicMenuProjection(selected,language,workspace.defaultLanguage),menus:workspace.menus.map(m=>({id:m.id,type:m.type,name:m.translations?.[language]?.name||m.name})),design:workspace.design,foodTranslations:workspace.foodTranslations,foodCatalogs:{allergens:[],traits:[],additives:[]},languages:workspace.languages,defaultLanguage:workspace.defaultLanguage,features:{restaurantName:raw.restaurantName||'Ristorante',reservationsEnabled:false,reviewUrl:'',customerOrderingEnabled:false,coverCharge:0}}}
 const bundleDir=join(tmpdir(),`tako-fixed-menu-bundle-${process.pid}`);await mkdir(bundleDir,{recursive:true})
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {DigitalMenu} from './src/components/DigitalMenu';createRoot(document.getElementById('root')).render(<DigitalMenu restaurantId=${JSON.stringify(restaurantId)}/>)`
 await build({stdin:{contents:entry,loader:'tsx',resolveDir:resolve(root,'apps/web')},bundle:true,loader:{'.ttf':'dataurl','.woff2':'dataurl'},outfile:join(bundleDir,'app.js'),format:'iife',jsx:'automatic',alias:{'@':resolve(root,'apps/web/src')},nodePaths:[resolve(root,'apps/web/node_modules'),resolve(root,'node_modules')],define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_API_URL':'""'},external:['/takomenu-public/*','/uploads/*'],logLevel:'error'})
 const shell=await liveShell(),hasCss=existsSync(join(bundleDir,'app.css'))
 const html=`<!doctype html><html lang="it"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/>${shell.links.map(h=>`<link rel="stylesheet" href="${h}">`).join('')}${hasCss?'<link rel="stylesheet" href="/__app.css">':''}</head><body class="${shell.body}"><div id="root"></div><script src="/__app.js"></script></body></html>`
 const cache=new Map()
 const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://x');const p=u.pathname
  const m=p.match(/^\/api\/customer\/restaurant\/([^/]+)\/menu$/)
  if(m){const body=api(u.searchParams.get('menuId')||'',u.searchParams.get('lang')||'');res.statusCode=body?200:404;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body||{error:{code:'NOT_FOUND'}}));return}
  if(p==='/__app.js'||p==='/__app.css'){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(join(bundleDir,p.slice(3))));return}
  if(p.startsWith('/__release/')){res.setHeader('Content-Type','text/css');res.end(await readFile(resolve(root,'release/serverless/static/assets',p.slice(11))));return}
  if(p.startsWith('/takomenu-public/')||p.startsWith('/uploads/')){if(!cache.has(p)){const r=await fetch(LIVE+p);cache.set(p,{type:r.headers.get('content-type')||'application/octet-stream',status:r.status,body:Buffer.from(await r.arrayBuffer())})}const c=cache.get(p);res.statusCode=c.status;res.setHeader('Content-Type',c.type);res.end(c.body);return}
  if(p.startsWith('/api/')||p.startsWith('/socket.io')){res.statusCode=404;res.end();return}
  res.setHeader('Content-Type','text/html');res.end(html)}catch(e){res.statusCode=500;res.end(String(e))}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 try{await capture({url:`http://127.0.0.1:${server.address().port}/menu`,out,names})}finally{server.close()}
}

async function capture({url,out,names}){
 await mkdir(out,{recursive:true})
 const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--hide-scrollbars']})
 const report=[]
 try{for(const [vp,width,height] of VIEWPORTS){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});page.on('requestfailed',r=>errors.push('request: '+r.url()))
  await page.evaluateOnNewDocument(h=>{Date.prototype.getHours=function(){return h}},hour)
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
  await page.setViewport({width,height,deviceScaleFactor:1,isMobile:vp==='mobile',hasTouch:vp==='mobile'})
  await page.goto(url,{waitUntil:'networkidle0',timeout:60000});await page.waitForSelector('[data-category-page]',{timeout:30000}).catch(async e=>{await page.screenshot({path:join(out,`error-${vp}.png`)});throw new Error(`Pagina non pronta (${vp}): ${errors.join(' | ')||e.message} — ${(await page.evaluate(()=>document.body.innerText)).slice(0,300)}`)})
  const menuButtons=await page.$$eval(STRIP,els=>els.map(e=>e.textContent.trim()))
  const wanted=names.length?names:menuButtons
  for(const name of wanted){
   const target=menuButtons.find(b=>norm(b)===norm(name))??menuButtons.find(b=>norm(b).includes(norm(name)))
   if(!target){report.push({viewport:vp,menu:name,error:'Menu non trovato nella barra',menus:menuButtons});continue}
   await page.evaluate((sel,t)=>[...document.querySelectorAll(sel)].find(b=>b.textContent.trim()===t).click(),STRIP,target)
   await wait(400);await page.waitForSelector('[data-category-page]');await page.waitForNetworkIdle({idleTime:300,timeout:15000}).catch(()=>{});await settle(page)
   const pills=await page.$$eval('[data-category]',els=>els.map(e=>({id:e.getAttribute('data-category'),name:e.textContent.trim()})))
   const pages=[]
   for(const [i,pill] of (pills.length?pills:[{id:null,name:'menu'}]).entries()){
    if(pill.id){await page.click(`[data-category="${pill.id}"]`);await settle(page)}
    await page.evaluate(()=>window.scrollTo(0,0));await wait(150)
    const file=`${slug(name)}-${vp}-${i+1}-${slug(pill.name)}.png`
    await page.screenshot({path:join(out,file),fullPage:true})
    pages.push({pill:pill.name,file,...await page.evaluate(structure)})
   }
   const result={viewport:vp,menu:target,menus:menuButtons,pills:pills.map(p=>p.name),pages,errors:[...errors]}
   await writeFile(join(out,`structure-${slug(name)}-${vp}.json`),JSON.stringify(result,null,1))
   report.push({viewport:vp,menu:target,pills:result.pills,files:pages.map(p=>p.file)})
  }
  await page.close()
 }}finally{await browser.close()}
 await writeFile(join(out,'capture.json'),JSON.stringify({url,hour,at:new Date().toISOString(),report},null,1))
 console.log(JSON.stringify(report,null,1))
}
async function settle(page){await wait(250);await page.evaluate(async()=>{await document.fonts?.ready;const imgs=[...document.images].filter(i=>!i.complete);await Promise.race([Promise.all(imgs.map(i=>new Promise(r=>{i.onload=i.onerror=r}))),new Promise(r=>setTimeout(r,4000))])});await wait(200)}
/** Struttura visibile della pagina di categoria: titoli, note, righe (nome, prezzo, descrizione), riquadro opzioni. */
function structure(){
 const text=e=>e?e.textContent.replace(/\s+/g,' ').trim():null
 const list=document.querySelector('[data-category-page]')
 const sections=list?[...list.querySelectorAll(':scope > section')].map(s=>({title:text(s.querySelector(':scope > h2')),note:text(s.querySelector(':scope > p')),rows:[...s.querySelectorAll('article[data-menu-row]')].map(a=>{const h=a.querySelector('h3'),row=h?.parentElement;const price=row?[...row.children].filter(c=>c!==h&&c.textContent.trim()).map(text).join(' '):'';return {name:text(h),price:price||null,description:text(a.querySelector('h3 ~ p, p.mt-2'))}})})):[]
 return {menuNote:text(document.querySelector('[data-menu-note]')),fixedBox:text(document.querySelector('[data-fixed-price-box]')),sections,height:document.documentElement.scrollHeight}
}

async function compare(a,b,diffDir){
 await mkdir(diffDir,{recursive:true})
 const filesA=(await readdir(a)),filesB=new Set(await readdir(b))
 const result={structure:[],pixels:[]}
 for(const f of filesA.filter(f=>/^structure-.*\.json$/.test(f))){
  if(!filesB.has(f)){result.structure.push({file:f,missing:'dopo'});continue}
  const A=JSON.parse(await readFile(join(a,f),'utf8')),B=JSON.parse(await readFile(join(b,f),'utf8'))
  const strip=x=>({menus:x.menus,pills:x.pills,pages:x.pages.map(({file,height,...p})=>p)})
  const sa=JSON.stringify(strip(A)),sb=JSON.stringify(strip(B))
  const diffs=[];const walk=(x,y,path)=>{if(JSON.stringify(x)===JSON.stringify(y))return;if(x&&y&&typeof x==='object'&&typeof y==='object'){for(const k of new Set([...Object.keys(x),...Object.keys(y)]))walk(x[k],y[k],path+'.'+k);return}diffs.push({path,prima:x,dopo:y})}
  walk(strip(A),strip(B),'')
  result.structure.push({file:f,identical:sa===sb,diffs:diffs.slice(0,40),heights:A.pages.map((p,i)=>[p.height,B.pages[i]?.height])})
 }
 const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox']})
 try{const page=await browser.newPage()
  for(const f of filesA.filter(f=>f.endsWith('.png')&&filesB.has(f))){
   const [da,db]=await Promise.all([readFile(join(a,f)),readFile(join(b,f))])
   const r=await page.evaluate(async(x,y)=>{const load=src=>new Promise((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=ko;i.src=src});const [ia,ib]=await Promise.all([load(x),load(y)]);const w=Math.max(ia.width,ib.width),h=Math.max(ia.height,ib.height)
    const draw=img=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#ff00ff';g.fillRect(0,0,w,h);g.drawImage(img,0,0);return g.getImageData(0,0,w,h)}
    const pa=draw(ia),pb=draw(ib),out=document.createElement('canvas');out.width=w;out.height=h;const go=out.getContext('2d'),od=go.createImageData(w,h);let changed=0
    for(let i=0;i<pa.data.length;i+=4){const d=Math.max(Math.abs(pa.data[i]-pb.data[i]),Math.abs(pa.data[i+1]-pb.data[i+1]),Math.abs(pa.data[i+2]-pb.data[i+2]));if(d>32){changed++;od.data[i]=255;od.data[i+1]=0;od.data[i+2]=0;od.data[i+3]=255}else{const v=(pa.data[i]+pa.data[i+1]+pa.data[i+2])/3;od.data[i]=od.data[i+1]=od.data[i+2]=255-(255-v)*.25;od.data[i+3]=255}}
    go.putImageData(od,0,0);return {sizeA:[ia.width,ia.height],sizeB:[ib.width,ib.height],changed,ratio:changed/(w*h),diff:changed?out.toDataURL('image/png'):null}},'data:image/png;base64,'+da.toString('base64'),'data:image/png;base64,'+db.toString('base64'))
   if(r.diff)await writeFile(join(diffDir,'diff-'+f),Buffer.from(r.diff.split(',')[1],'base64'))
   result.pixels.push({file:f,sizePrima:r.sizeA,sizeDopo:r.sizeB,changedPixels:r.changed,ratio:Number(r.ratio.toFixed(5))})
  }
  for(const f of filesA.filter(f=>f.endsWith('.png')&&!filesB.has(f)))result.pixels.push({file:f,missing:'dopo'})
 }finally{await browser.close()}
 await writeFile(join(diffDir,'compare.json'),JSON.stringify(result,null,1))
 console.log(JSON.stringify({structure:result.structure.map(s=>({file:s.file,identical:s.identical,missing:s.missing,diffs:s.diffs?.length})),pixels:result.pixels.map(p=>({file:p.file,changed:p.changedPixels,ratio:p.ratio,size:[p.sizePrima,p.sizeDopo],missing:p.missing}))},null,1))
}
