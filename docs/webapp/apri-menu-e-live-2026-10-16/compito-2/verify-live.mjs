// Verifier Compito 2 — menu pubblico che si aggiorna da solo.
// Uso: taskpolicy -b node docs/webapp/apri-menu-e-live-2026-10-16/compito-2/verify-live.mjs [opzioni]
//   --local=<dir>   pagina /r/<QA>/menu e /takomenu-public/* serviti dalla build in <dir> (intercettazione), backend vero
//   --rounds=10     giri per tipo        --paths=dashboard,whatsapp      --types=price,name,new,delete,category,menu,soldout
//   --wa-llm        anche i tipi WhatsApp che passano dall'AI (nome, piatto nuovo, categoria, menu): consumano quota Groq
// Scritture SOLO sul locale QA «Tako · Verifica web» 26050ecd… (stato salvato prima, ripristinato e confrontato dopo)
// e un collegamento WhatsApp di un numero finto (+39 000…77, non assegnabile) al QA, rimosso alla fine.
// Sessione propria (login owner QA, logout alla fine). Nessun segreto nei file prodotti.
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';import {parseEnv} from 'node:util';import {homedir} from 'node:os';import {createRequire} from 'node:module';import {resolve,dirname,extname} from 'node:path';import {fileURLToPath} from 'node:url'
import {client,json} from '../../../../scripts/translations/common.mjs'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..'),require=createRequire(resolve(repo,'package.json'))
const puppeteer=require('puppeteer-core'),postgres=require('postgres')
const arg=(k,d)=>{const a=process.argv.find(x=>x===`--${k}`||x.startsWith(`--${k}=`));return a===undefined?d:a.includes('=')?a.split('=').slice(1).join('='):true}
const LOCAL=arg('local',''),ROUNDS=Number(arg('rounds',10)),PATHS=String(arg('paths','dashboard')).split(','),TYPES=String(arg('types','price,name,new,delete,category,menu,soldout')).split(','),WA_LLM=!!arg('wa-llm',false),TAG=String(arg('tag',LOCAL?'local':'live'))
const BASE='https://takoitalia.com',QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',PAGE=`${BASE}/r/${QA}/menu`,WA_PHONE='whatsapp:+390000000077'
const out=resolve(here,'evidence');await mkdir(out,{recursive:true})
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16)
const env=await loadLocalEnvironment(repo),dbUrl=new URL(env.DATABASE_URL);dbUrl.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(dbUrl.toString(),{max:2,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const qaLogin=JSON.parse(await readFile(homedir()+'/.config/tako-webapp/qa-login.json','utf8'))
const api=client();await api.call('/api/auth/login',json({email:qaLogin.email,password:qaLogin.password}))
const me=await api.call('/api/auth/me');if(me.data.restaurantId!==QA)throw Error('la sessione non è sul locale QA: stop')
const report={tag:TAG,startedAt:new Date().toISOString(),mode:LOCAL?'bundle locale (intercettazione)':'live',rounds:ROUNDS,results:[],errors:[],checks:[]}
const check=(name,ok,detail='')=>{report.checks.push({name,ok:!!ok,detail});console.log(ok?'PASS':'FAIL',name,detail)}
// ---------- stato QA ----------
async function dbState(){return db.begin('read only',async tx=>{const [w]=await tx`SELECT draft,published,revision,published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`;const [r]=await tx`SELECT name,settings,active FROM restaurants WHERE id=${QA}`;const items=await tx`SELECT id,available FROM menu_items WHERE restaurant_id=${QA} ORDER BY id`;const menus=await tx`SELECT id,active FROM menus WHERE restaurant_id=${QA} ORDER BY id`;const sections=await tx`SELECT s.id FROM menu_sections s JOIN menus m ON m.id=s.menu_id WHERE m.restaurant_id=${QA} ORDER BY s.id`;return{w,r,items,menus,sections}})}
const publicHash=async()=>{const a=await (await fetch(`${BASE}/api/customer/restaurant/${QA}/menu?prefetch=1`)).json(),b=await (await fetch(`${BASE}/api/customer/restaurant/${QA}/menu?prefetch=1&lang=en`)).json();return hash([a,b])}
const before=await dbState();if(before.w.revision!==before.w.published_revision)throw Error('QA con bozza non pubblicata: stop')
const beforeDigest={draft:hash(before.w.draft),published:hash(before.w.published),restaurant:hash(before.r),items:hash(before.items),menus:hash(before.menus),sections:hash(before.sections),public:await publicHash()}
await writeFile(resolve(out,`${TAG}-qa-before.json`),JSON.stringify({at:new Date().toISOString(),revision:before.w.revision,digest:beforeDigest,draft:before.w.draft},null,1))
// ---------- scritture via API dashboard (owner QA) ----------
let current=null
async function readWs(){const r=await api.call('/api/menu-workspace');current={w:r.data,revision:r.revision};return current}
async function saveAndPublish(mutate){await readWs();const w=structuredClone(current.w);mutate(w);const t0=Date.now();const saved=await api.call('/api/menu-workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:current.revision,workspace:w})});const tPub=Date.now();await api.call('/api/menu-workspace/publish',json({expectedRevision:saved.revision}));const tDone=Date.now();return{t0,tPub,tDone}}
const itemTemplate=before.w.draft.menus[0].sections[0].items[0],sectionTemplate=before.w.draft.menus[0].sections[0],menuTemplate=before.w.draft.menus[0]
const item=(name,price)=>({...structuredClone(itemTemplate),id:randomUUID(),name,price,description:'Piatto di prova del verifier live',available:true,hidden:false,translations:{}})
const section=(name,items)=>({...structuredClone(sectionTemplate),id:randomUUID(),name,items,translations:{}})
const liveSection=w=>w.menus[0].sections.find(s=>s.id===sectionTemplate.id)
// Nomi che finiscono ciascuno in una macro-categoria diversa (la pillola mostra il nome della macro).
const CATS=[['Birre artigianali','Birre'],['Cocktail della casa','Cocktail'],['Formaggi misti','Formaggi'],['Pizze speciali','Pizze e pinse'],['Dolci della casa','Dolci e frutta'],['Primi piatti','Primi'],['Contorni di stagione','Contorni e insalate'],['Antipasti caldi','Antipasti e sfiziosità'],['Vini rossi','Vini e bollicine'],['Distillati','Distillati e liquori']]
// ---------- WhatsApp simulato firmato ----------
const tw=PATHS.includes('whatsapp')?parseEnv(await readFile(homedir()+'/.config/tako-webapp/twilio-menu.env','utf8')):null
const sign=(u,form)=>createHmac('sha1',tw.TWILIO_AUTH_TOKEN).update(u+Object.keys(form).sort().map(k=>k+form[k]).join('')).digest('base64')
async function whatsapp(body){const form={AccountSid:tw.TWILIO_ACCOUNT_SID,From:WA_PHONE,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:'0',MessageSid:'SM'+randomBytes(16).toString('hex'),Body:body};const t0=Date.now();const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,form)},body:new URLSearchParams(form).toString()});const text=(await r.text()).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();return{t0,tReply:Date.now(),status:r.status,text:text.slice(0,300)}}
// ---------- osservatore del commit nel DB (ogni 100 ms) ----------
let commitSeen=null
async function dbMark(){const [x]=await db`SELECT w.published_revision AS p,(SELECT md5(string_agg(id::text||available::text,',' ORDER BY id)) FROM menu_items WHERE restaurant_id=${QA}) AS a,(SELECT md5(name||settings::text) FROM restaurants WHERE id=${QA}) AS r FROM menu_workspaces w WHERE w.restaurant_id=${QA}`;return x.p+'|'+x.a+'|'+x.r}
function watchCommit(){let stop=false,last=null;const done=(async()=>{last=await dbMark();while(!stop){await sleep(100);const t=Date.now(),m=await dbMark();if(m!==last){last=m;commitSeen=commitSeen??t}}})();return{stop:async()=>{stop=true;await done}}}
// ---------- pagine ----------
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.json':'application/json','.ttf':'font/ttf'}
const exists=async f=>{try{return (await stat(f)).isFile()}catch{return false}}
async function localFile(url){const u=new URL(url);if(u.origin!==BASE)return null;const p=decodeURIComponent(u.pathname);if(p===`/r/${QA}/menu`)return resolve(LOCAL,'index.html');if(p.startsWith('/takomenu-public/')){const f=resolve(LOCAL,'.'+p.slice('/takomenu-public'.length));return await exists(f)?f:null}return null}
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run','--no-default-browser-check','--hide-scrollbars','--mute-audio']})
const pages=[]
async function openPage(name,{lang='',viewport={width:500,height:900,deviceScaleFactor:1},scroll=true,openLanguages=false}={}){
 const page=await (await browser.createBrowserContext()).newPage();await page.setViewport(viewport);const log={name,errors:[],menuReads:0,ws:0}
 page.on('pageerror',e=>log.errors.push('pageerror: '+e.message));page.on('console',m=>{if(['error','warn'].includes(m.type()))log.errors.push(m.type()+': '+m.text())})
 page.on('request',r=>{if(/\/api\/customer\/restaurant\/.+\/menu/.test(r.url()))log.menuReads++});page.on('requestfailed',r=>{if(!/realtime/.test(r.url()))log.errors.push('requestfailed: '+r.url())})
 const cdp=await page.createCDPSession();await cdp.send('Network.enable');cdp.on('Network.webSocketCreated',()=>log.ws++)
 if(LOCAL){await page.setRequestInterception(true);page.on('request',async req=>{try{const f=await localFile(req.url());if(!f)return req.continue();return req.respond({status:200,headers:{'Content-Type':types[extname(f)]||'application/octet-stream','Cache-Control':'no-store'},body:await readFile(f)})}catch{try{req.continue()}catch{}}})}
 await page.goto(PAGE+(lang?`?lang=${lang}`:''),{waitUntil:'networkidle0',timeout:60000});await page.waitForSelector('[data-item-id]',{timeout:30000})
 if(scroll)await page.evaluate(()=>{const rows=[...document.querySelectorAll('[data-item-id]')];const target=rows[Math.min(8,rows.length-1)];window.scrollTo({top:target.getBoundingClientRect().top+window.scrollY-420,behavior:'instant'})})
 if(openLanguages){await page.click('[aria-haspopup="menu"]');await sleep(400)}
 // Marcatori: nodo della lista (non deve essere rimontato) e comparsa di caricamenti (lampeggio).
 await page.evaluate(()=>{window.__list=document.querySelector('[data-category-page]');window.__flash=0;new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1&&/Caricamento/.test(n.textContent||''))window.__flash++}).observe(document.body,{subtree:true,childList:true})})
 await sleep(2500);pages.push({page,log,name,lang,openLanguages,scroll});return pages.at(-1)
}
// Stato prima del cambio: punto di lettura (primo piatto sotto l'header), scroll, categoria, pannello lingue.
const snap=p=>p.page.evaluate(()=>{const header=document.querySelector('[data-menu-sticky-header]')?.getBoundingClientRect().bottom||0;const row=[...document.querySelectorAll('[data-item-id]')].find(r=>r.getBoundingClientRect().top>=header+4);window.__anchor=row?{id:row.dataset.itemId,top:row.getBoundingClientRect().top}:null;return{scrollY:window.scrollY,anchor:window.__anchor,category:document.querySelector('[data-category][aria-pressed="true"]')?.dataset.category||null,languagesOpen:document.querySelector('[aria-haspopup="menu"]')?.getAttribute('aria-expanded')}})
async function waitChange(p,predicate,arg){const handle=await p.page.waitForFunction(predicate,{polling:'mutation',timeout:45000},arg);const t=await handle.jsonValue();await sleep(350);const after=await p.page.evaluate(()=>{const a=window.__anchor,el=a&&document.querySelector(`[data-item-id="${a.id}"]`);return{scrollY:window.scrollY,anchorDelta:el?el.getBoundingClientRect().top-a.top:null,sameList:document.querySelector('[data-category-page]')===window.__list,flash:window.__flash,category:document.querySelector('[data-category][aria-pressed="true"]')?.dataset.category||null,languagesOpen:document.querySelector('[aria-haspopup="menu"]')?.getAttribute('aria-expanded')}});return{t,after}}
const predicates={
 text:(a)=>{const el=document.querySelector(`[data-item-id="${a.id}"]`);return el&&el.textContent.includes(a.text)?Date.now():false},
 present:(a)=>document.querySelector(`[data-item-id="${a.id}"]`)?Date.now():false,
 presentName:(a)=>[...document.querySelectorAll('[data-item-id]')].some(e=>e.textContent.includes(a.text))?Date.now():false,
 absent:(a)=>document.querySelector(`[data-item-id="${a.id}"]`)?false:Date.now(),
 pill:(a)=>(a.id?document.querySelector(`[data-category="${a.id}"]`):[...document.querySelectorAll('[data-category]')].find(e=>e.textContent.includes(a.text)))?Date.now():false,
 menu:(a)=>[...document.querySelectorAll('[data-menu-strip] button')].some(e=>e.textContent.toLowerCase().includes(a.text.toLowerCase()))?Date.now():false}
const euro=n=>n.toFixed(2).replace('.',',')
// ---------- preparazione: 16 piatti nella prima categoria del QA (quella mostrata all'apertura) ----------
const fixtureNames=Array.from({length:16},(_,i)=>`Piatto live ${String.fromCharCode(65+i)}`)
await saveAndPublish(w=>{liveSection(w).items.push(...fixtureNames.map((n,i)=>item(n,10+i)))})
await readWs();const fixture=Object.fromEntries(liveSection(current.w).items.map(i=>[i.name,i.id]))
const P1=await openPage('it-scroll'),P2=await openPage('en-lingue-aperte',{lang:'en',scroll:false,openLanguages:true}),P3=await openPage('it-desktop',{viewport:{width:1280,height:900,deviceScaleFactor:1}})
check('pagine aperte con socket live',pages.every(p=>p.log.ws>=1),pages.map(p=>p.name+':ws='+p.log.ws).join(' '))
// ---------- giri ----------
let waLinked=false
async function round(path,type,i){
 await readWs();const before=await Promise.all(pages.map(snap));let spec,predicate,act,cleanup=null
 const pick=n=>fixture[fixtureNames[n]]
 if(type==='price'){const id=pick(3+(i%3)),price=20+i+0.5;spec={id,text:euro(price)};predicate=predicates.text
  act=path==='dashboard'?()=>saveAndPublish(w=>{liveSection(w).items.find(x=>x.id===id).price=price}):()=>whatsapp(`prezzo ${fixtureNames[3+(i%3)]} a ${euro(price)}`)}
 else if(type==='name'){const id=pick(6),name=`Piatto live G v${i+1}`;spec={id,text:name};predicate=predicates.text
  act=path==='dashboard'?()=>saveAndPublish(w=>{liveSection(w).items.find(x=>x.id===id).name=name}):()=>whatsapp(`Nel menu ${menuTemplate.name}, categoria ${sectionTemplate.name}, cambia il nome del piatto «${(liveSection(current.w).items.find(x=>x.id===id)).name}» in «${name}». Non cambiare altro.`)}
 else if(type==='new'){const name=`Nuovo live ${path[0]}${i+1}`;spec={text:name};predicate=predicates.presentName
  act=path==='dashboard'?()=>saveAndPublish(w=>{liveSection(w).items.unshift(item(name,7))}):()=>whatsapp(`Nel menu ${menuTemplate.name}, categoria ${sectionTemplate.name}, aggiungi ${name} a 7 euro.`)}
 else if(type==='delete'){
  if(path==='dashboard'){await readWs();const victim=liveSection(current.w).items.find(x=>x.name.startsWith('Nuovo live d'))||liveSection(current.w).items.at(-1);spec={id:victim.id};predicate=predicates.absent;act=()=>saveAndPublish(w=>{const s=liveSection(w);s.items=s.items.filter(x=>x.id!==victim.id)})}
  else{const n=fixtureNames[9+(i%2)],id=fixture[n];spec={id};predicate=predicates.absent;act=async()=>{const r=await whatsapp(`nascondi ${n}`);return r}}}
 else if(type==='category'){const [name,pill]=CATS[i%CATS.length];spec={text:pill};predicate=predicates.pill;cleanup=w=>{w.menus[0].sections=w.menus[0].sections.filter(s=>s.name!==name)}
  const added=section(name,[item(`Piatto ${name.toLowerCase()}`,6)]);if(path==='dashboard')spec.id=added.id
  act=path==='dashboard'?()=>saveAndPublish(w=>{w.menus[0].sections.push(added)}):()=>whatsapp(`Nel menu ${menuTemplate.name} aggiungi la categoria ${name} con il piatto Piatto ${name.toLowerCase()} a 6 euro.`)}
 else if(type==='menu'){const name=`Menu live ${path[0]}${i+1}`;spec={text:name};predicate=predicates.menu;cleanup=w=>{w.menus=w.menus.filter(m=>m.name!==name)}
  act=path==='dashboard'?()=>saveAndPublish(w=>{w.menus.push({...structuredClone(menuTemplate),id:randomUUID(),name,translations:{},sections:[section('Primi',[item(`Pasta ${name}`,8)])]})}):()=>whatsapp(`Crea un nuovo menu chiamato ${name} con la categoria Primi e il piatto Pasta ${name} a 8 euro.`)}
 else if(type==='soldout'){const n=fixtureNames[12+(i%2)],id=fixture[n];spec={id};predicate=predicates.absent
  act=path==='dashboard'?async()=>{const t0=Date.now();await api.call(`/api/menus/items/${id}/availability`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({available:false})});return{t0,tPub:t0,tDone:Date.now()}}:()=>whatsapp(`esaurito ${n}`)}
 commitSeen=null;const watcher=watchCommit();await sleep(150)
 const waits=pages.map(p=>waitChange(p,predicate,spec).catch(async e=>({error:e.message,dom:await p.page.evaluate(()=>[...document.querySelectorAll('[data-item-id]')].slice(0,6).map(x=>x.textContent.slice(0,40)).join(' | ')+' || pills: '+[...document.querySelectorAll('[data-category]')].map(x=>x.textContent).join(',')).catch(()=>'')})))
 const t=await act();const seen=await Promise.all(waits);await watcher.stop()
 const row={path,type,i,t0:t.t0,api:path==='dashboard'?{saveMs:t.tPub-t.t0,publishMs:t.tDone-t.tPub}:{webhookMs:t.tReply-t.t0,status:t.status,reply:t.text},commitAt:commitSeen,pages:seen.map((s,k)=>s.error?{page:pages[k].name,error:s.error,dom:s.dom}:{page:pages[k].name,totalMs:s.t-t.t0,fromPublishMs:path==='dashboard'?s.t-t.tPub:undefined,botMs:commitSeen?commitSeen-t.t0:null,liveMs:commitSeen?s.t-commitSeen:null,before:before[k],after:s.after})}
 report.results.push(row);const p1=row.pages[0];console.log(path,type,i+1,p1.error?'ERRORE '+p1.error:`totale ${p1.totalMs} ms · bot/commit ${p1.botMs} ms · live ${p1.liveMs} ms · anchorΔ ${p1.after.anchorDelta?.toFixed?.(1)} · lista stessa ${p1.after.sameList}`)
 // Ripristini immediati per i tipi che tolgono un piatto della fixture.
 if(type==='soldout'){if(path==='dashboard')await api.call(`/api/menus/items/${spec.id}/availability`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({available:true})});else await whatsapp(`disponibile ${fixtureNames[12+(i%2)]}`);await Promise.all(pages.map(p=>p.page.waitForFunction(predicates.present,{polling:'mutation',timeout:45000},{id:spec.id}).catch(()=>{})))}
 if(type==='delete'&&path==='whatsapp'){await whatsapp(`mostra ${fixtureNames[9+(i%2)]}`);await Promise.all(pages.map(p=>p.page.waitForFunction(predicates.present,{polling:'mutation',timeout:45000},{id:spec.id}).catch(()=>{})))}
 // Categoria e menu aggiunti si tolgono subito (non misurato): la striscia e le pillole restano quelle di partenza.
 if(cleanup){await saveAndPublish(cleanup);await sleep(2500)}
 await sleep(1500)
}
try{
 if(PATHS.includes('whatsapp')){const [link]=await db`SELECT 1 FROM tako_whatsapp_links WHERE phone=${WA_PHONE}`;if(link)throw Error('numero finto già collegato: stop');await db`INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at) VALUES(${WA_PHONE},${QA},${me.data.id},now())`;waLinked=true}
 for(const path of PATHS)for(const type of TYPES){
  if(path==='whatsapp'&&['name','new','category','menu'].includes(type)&&!WA_LLM){report.results.push({path,type,skipped:'richiede AI (Groq): eseguire con --wa-llm'});continue}
  // Il tipo «delete» da dashboard toglie i piatti aggiunti dal tipo «new»: se «new» non gira, prima se ne aggiunge uno non misurato.
  for(let i=0;i<ROUNDS;i++){if(type==='delete'&&path==='dashboard'&&!TYPES.includes('new'))await saveAndPublish(w=>{liveSection(w).items.unshift(item(`Nuovo live d-extra${i}`,7))}).then(()=>sleep(3000));try{await round(path,type,i)}catch(e){report.errors.push(`${path}/${type}/${i}: ${e.message}`);console.log('errore',path,type,i,e.message);await sleep(3000)}}
 }
}finally{
 // ---------- ripristino QA ----------
 try{
  if(waLinked){await db`DELETE FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`;await db`DELETE FROM tako_whatsapp_links WHERE phone=${WA_PHONE}`}
  for(const it of before.items){const now=(await db`SELECT available FROM menu_items WHERE id=${it.id}`)[0];if(now&&now.available!==it.available)await api.call(`/api/menus/items/${it.id}/availability`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({available:it.available})})}
  await saveAndPublish(w=>{for(const k of Object.keys(w))delete w[k];Object.assign(w,structuredClone(before.w.draft))})
  // Righe create dai giri (piatti, categorie, menu ritirati dalla pubblicazione): solo del QA, per id non presenti prima.
  const keepItems=before.items.map(x=>x.id),keepSections=before.sections.map(x=>x.id),keepMenus=before.menus.map(x=>x.id)
  await db.begin(async tx=>{await tx`DELETE FROM item_variants WHERE item_id IN (SELECT id FROM menu_items WHERE restaurant_id=${QA} AND NOT (id = ANY(${keepItems}::uuid[])))`;await tx`DELETE FROM menu_item_translations WHERE restaurant_id=${QA} AND NOT (item_id = ANY(${keepItems}::uuid[]))`;await tx`DELETE FROM menu_items WHERE restaurant_id=${QA} AND NOT (id = ANY(${keepItems}::uuid[]))`;await tx`DELETE FROM menu_sections WHERE menu_id IN (SELECT id FROM menus WHERE restaurant_id=${QA}) AND NOT (id = ANY(${keepSections}::uuid[]))`;await tx`DELETE FROM menus WHERE restaurant_id=${QA} AND NOT (id = ANY(${keepMenus}::uuid[]))`})
  const after=await dbState();const afterDigest={draft:hash(after.w.draft),published:hash(after.w.published),restaurant:hash(after.r),items:hash(after.items),menus:hash(after.menus),sections:hash(after.sections),public:await publicHash()}
  report.restore={before:beforeDigest,after:afterDigest,revisionBefore:before.w.revision,revisionAfter:after.w.revision}
  check('QA ripristinato identico (bozza, pubblicato, locale, piatti, categorie, menu, risposta pubblica it+en)',Object.keys(beforeDigest).every(k=>beforeDigest[k]===afterDigest[k]),JSON.stringify(Object.keys(beforeDigest).filter(k=>beforeDigest[k]!==afterDigest[k])))
  check('collegamento WhatsApp finto rimosso',!(await db`SELECT 1 FROM tako_whatsapp_links WHERE phone=${WA_PHONE}`).length)
 }catch(e){report.errors.push('ripristino: '+e.message);check('QA ripristinato',false,e.message)}
 for(const p of pages)report[`console_${p.name}`]=p.log.errors
 check('console pulita (nessun errore/avviso) su tutte le pagine',pages.every(p=>!p.log.errors.length),pages.map(p=>p.name+':'+p.log.errors.length).join(' '))
 await browser.close();try{await api.call('/api/auth/logout',{method:'POST'})}catch{};await db.end()
}
// ---------- sintesi ----------
const q=(xs,p)=>{if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.ceil(p*s.length)-1)]}
report.summary=[];for(const path of PATHS)for(const type of TYPES){const rows=report.results.filter(r=>r.path===path&&r.type===type&&r.pages);if(!rows.length)continue;const ok=rows.flatMap(r=>r.pages.filter(p=>!p.error));const all=rows.flatMap(r=>r.pages)
 const v=k=>ok.map(p=>p[k]).filter(x=>typeof x==='number')
 const sum={path,type,giri:rows.length,misure:ok.length,mancate:all.length-ok.length,total:{p50:q(v('totalMs'),.5),p95:q(v('totalMs'),.95),max:Math.max(...v('totalMs'))},bot:{p50:q(v('botMs'),.5),p95:q(v('botMs'),.95)},live:{p50:q(v('liveMs'),.5),p95:q(v('liveMs'),.95),max:Math.max(...v('liveMs'))},fromPublish:path==='dashboard'?{p50:q(v('fromPublishMs'),.5),p95:q(v('fromPublishMs'),.95)}:undefined,
  // Punto di lettura: conta solo per chi ha scorso la pagina; chi è in cima resta in cima (scrollY 0) e vede il cambio.
  maxAnchorDelta:Math.max(0,...ok.map(p=>p.before.scrollY>0?Math.abs(p.after.anchorDelta??0):Math.abs(p.after.scrollY))),listaRimontata:ok.filter(p=>!p.after.sameList).length,lampeggi:Math.max(0,...ok.map(p=>p.after.flash)),categoriaCambiata:ok.filter(p=>p.after.category!==p.before.category).length,linguePannelloChiuso:ok.filter(p=>p.before.languagesOpen==='true'&&p.after.languagesOpen!=='true').length}
 report.summary.push(sum)}
for(const s of report.summary){console.log(JSON.stringify(s));check(`${s.path}/${s.type}: ${s.giri} giri, p95 totale ≤ 10 s`,s.mancate===0&&s.giri>=Math.min(ROUNDS,10)&&s.total.p95<=10000,`p50 ${s.total.p50} p95 ${s.total.p95} (bot p95 ${s.bot.p95}, live p95 ${s.live.p95})`);check(`${s.path}/${s.type}: punto di lettura invariato (±1 px), lista non rimontata, nessun lampeggio, categoria e pannello lingue mantenuti`,s.maxAnchorDelta<=1&&!s.listaRimontata&&!s.lampeggi&&!s.categoriaCambiata&&!s.linguePannelloChiuso,JSON.stringify({maxAnchorDelta:s.maxAnchorDelta,rim:s.listaRimontata,lamp:s.lampeggi,cat:s.categoriaCambiata,lingue:s.linguePannelloChiuso}))}
report.menuReads=Object.fromEntries(pages.map(p=>[p.name,p.log.menuReads]))
const pass=report.checks.filter(c=>c.ok).length;report.pass=pass;report.total=report.checks.length
await writeFile(resolve(out,`${TAG}-result-${new Date().toISOString().replace(/[:.]/g,'-')}.json`),JSON.stringify(report,null,1))
console.log(`\n${pass}/${report.checks.length} ${TAG}`);process.exit(pass===report.checks.length?0:1)
