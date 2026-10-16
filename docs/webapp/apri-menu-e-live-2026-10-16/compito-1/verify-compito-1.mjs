// Verifier Compito 1 — «Apri menu» → pagina pubblica vera + «Torna all'editor» solo per staff agenzia.
// Uso: node docs/webapp/apri-menu-e-live-2026-10-16/compito-1/verify-compito-1.mjs [--local]
//  --local: pagina staff e pagina pubblica servite dai bundle in release/ (intercettazione), backend vero.
// Sessioni proprie (scripts/translations/common.mjs), logout alla fine. Nessuna scrittura sui locali.
import puppeteer from 'puppeteer-core';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {client,login,json} from '../../../../scripts/translations/common.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const out=resolve(dirname(fileURLToPath(import.meta.url)),'evidence');await mkdir(out,{recursive:true});
const LOCAL=process.argv.includes('--local'),BASE='https://takoitalia.com';
const links=JSON.parse(await readFile(resolve(repo,'docs/webapp/customer-links/links.json'),'utf8'));
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.json':'application/json','.ttf':'font/ttf'};
const exists=async f=>{try{return (await stat(f)).isFile()}catch{return false}};
const publicPaths=new Set(links.map(l=>'/'+l.slug));
async function localFile(url){
 const u=new URL(url);if(u.origin!==BASE)return null;const p=decodeURIComponent(u.pathname);
 if(p==='/staff/')return resolve(repo,'release/serverless/static/staff/index.html');
 if(p.startsWith('/staff/')){const f=resolve(repo,'release/serverless/static'+p);return await exists(f)?f:null}
 if(publicPaths.has(p)||/^\/r\/[a-f0-9-]{36}\/menu$/.test(p))return resolve(repo,'release/public-menus/index.html');
 if(p.startsWith('/takomenu-public/')){const f=resolve(repo,'release/public-menus'+p.slice('/takomenu-public'.length));return await exists(f)?f:null}
 return null;
}
async function preparePage(context,viewport){
 const page=await context.newPage();await page.setViewport(viewport);
 const log={agencyMe:[],chunks:[],errors:[]};
 page.on('pageerror',e=>log.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))log.errors.push(m.text())});
 page.on('response',r=>{const u=new URL(r.url());if(u.pathname==='/api/agency/me')log.agencyMe.push(r.status());if(/staff-return-.*\.js$/.test(u.pathname))log.chunks.push(u.pathname)});
 if(LOCAL){await page.setRequestInterception(true);page.on('request',async req=>{try{const f=await localFile(req.url());if(!f)return req.continue();return req.respond({status:200,headers:{'Content-Type':types[extname(f)]||'application/octet-stream','Cache-Control':'no-store'},body:await readFile(f)})}catch{try{req.continue()}catch{}}})}
 return {page,log};
}
const cookieOf=api=>{const c=api.state.cookie.split('; ').find(c=>c.startsWith('tako_session='));if(!c)throw Error('Sessione non creata');return {name:'tako_session',value:c.slice('tako_session='.length),domain:'takoitalia.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}};
const rect=(page,sel)=>page.$eval(sel,el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}}).catch(()=>null);
const overlap=(a,b)=>a&&b&&a.x<b.r&&b.x<a.r&&a.y<b.b&&b.y<a.b;
async function pillState(page){return page.evaluate(()=>{const el=document.getElementById('tako-staff-return');if(!el)return null;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,href:el.getAttribute('href'),x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right,vw:innerWidth,vh:innerHeight,visible:s.visibility!=='hidden'&&s.display!=='none'&&r.width>0}})}
async function coveredParts(page,pill){
 // Header (logo/lingue), striscia dei menu e controlli del menu: il pulsante non deve coprirli.
 const parts=await page.evaluate(()=>{const take=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right,label:el.getAttribute('aria-label')||el.tagName}};return [...document.querySelectorAll('[data-menu-sticky-header], #root nav, #root header button, #root [aria-label*="ingua" i], #root [aria-label*="anguage" i]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight}).map(take)});
 return parts.filter(p=>overlap(pill,p)).map(p=>p.label);
}
const results=[],stamp=new Date().toISOString();
const admin=client(),owner=client();let browser;
const check=(name,ok,detail={})=>{results.push({name,ok:!!ok,...detail});console.log((ok?'PASS ':'FAIL ')+name+(Object.keys(detail).length?' '+JSON.stringify(detail):''))};
try{
 await login(admin);
 const qa=JSON.parse(await readFile(homedir()+'/.config/tako-webapp/qa-login.json','utf8'));
 await owner.call('/api/auth/login',json({email:qa.email,password:qa.password}));
 browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run','--no-default-browser-check','--hide-scrollbars']});
 const viewports={desktop:{width:1280,height:900},mobile:{width:500,height:900,isMobile:true,hasTouch:true,deviceScaleFactor:2}};
 for(const [vname,viewport] of Object.entries(viewports)){
  // ── Scenario 1: admin agenzia ──
  {const ctx=await browser.createBrowserContext();await ctx.setCookie(cookieOf(admin));const {page,log}=await preparePage(ctx,viewport);
   await page.goto(BASE+'/staff/',{waitUntil:'domcontentloaded'});
   await page.waitForSelector('.agency-location button[aria-label^="Apri menu "]',{timeout:45000});
   const cards=await page.$$eval('.agency-location',els=>els.map(el=>el.getAttribute('aria-label')));
   const known=links.map(l=>l.name);const targetName=cards.filter(n=>known.includes(n))[Math.min(5,cards.length-1)]||cards[0];
   const target=links.find(l=>l.name===targetName);const expected=target?'/'+target.slug:null;
   let search='';
   if(vname==='desktop'){search=targetName.slice(0,4);const input=await page.$('.agency-toolbar input');if(input){await input.click({clickCount:3});await input.type(search);await page.waitForFunction(n=>[...document.querySelectorAll('.agency-location')].some(e=>e.getAttribute('aria-label')===n),{},targetName)}}
   const button=`.agency-location[aria-label="${targetName.replace(/"/g,'\\"')}"] button[aria-label^="Apri menu "]`;
   await page.$eval(button,el=>el.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,300));
   const scrollBefore=await page.evaluate(()=>document.querySelector('.screen-scroll')?.scrollTop||0);
   await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:30000}),page.click(button)]);
   const landed=new URL(page.url());
   check(`[${vname}] admin: Apri menu apre la pagina pubblica giusta`,expected&&landed.pathname===expected&&landed.origin===BASE,{target:targetName,expected,landed:landed.pathname});
   const shown=await page.waitForSelector('#tako-staff-return',{visible:true,timeout:20000}).then(()=>true).catch(()=>false);
   await new Promise(r=>setTimeout(r,2600)); // dopo l'ingresso del logo
   const pill=await pillState(page);
   check(`[${vname}] admin: pulsante «Torna all'editor» visibile`,shown&&pill?.visible&&/Torna all/.test(pill.text),{pill,agencyMe:log.agencyMe});
   const covered=pill?await coveredParts(page,pill):['nessun pulsante'];
   check(`[${vname}] admin: il pulsante non copre header, lingue, striscia menu`,pill&&!covered.length&&pill.x>=0&&pill.r<=pill.vw&&pill.b<=pill.vh,{covered});
   // a metà pagina il pulsante resta fuori dall'header sticky
   await page.screenshot({path:resolve(out,`${LOCAL?'local':'live'}-${vname}-admin-menu.png`)});
   await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight/2,behavior:'instant'}));await new Promise(r=>setTimeout(r,700));
   const pillMid=await pillState(page),coveredMid=pillMid?await coveredParts(page,pillMid):['nessun pulsante'],midY=await page.evaluate(()=>scrollY);
   check(`[${vname}] admin: anche scorrendo non copre header/striscia`,pillMid&&!coveredMid.length&&midY>200,{coveredMid,midY});
   await page.screenshot({path:resolve(out,`${LOCAL?'local':'live'}-${vname}-admin-menu-scroll.png`),captureBeyondViewport:false});
   await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await new Promise(r=>setTimeout(r,700));
   const pillEnd=await pillState(page),footer=await page.evaluate(()=>[...document.querySelectorAll('#root footer a, #root footer p, #root a[href*="privacy" i]')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right,t:el.textContent.trim().slice(0,30)}}).filter(r=>r.w>0&&r.h>0));
   const hidden=footer.filter(r=>overlap(pillEnd,r)).map(r=>r.t);
   check(`[${vname}] admin: in fondo alla pagina il pulsante non copre il piè di pagina`,pillEnd&&footer.length>0&&!hidden.length,{hidden,footer:footer.length});
   await page.screenshot({path:resolve(out,`${LOCAL?'local':'live'}-${vname}-admin-menu-end.png`),captureBeyondViewport:false});
   check(`[${vname}] admin: nessun errore in console sulla pagina del menu`,!log.errors.length,{errors:log.errors.slice(0,5)});
   await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:30000}),page.click('#tako-staff-return')]);
   await page.waitForSelector('.agency-location button[aria-label^="Apri menu "]',{timeout:45000});await new Promise(r=>setTimeout(r,800));
   const back=await page.evaluate(()=>({path:location.pathname,scroll:document.querySelector('.screen-scroll')?.scrollTop||0,search:document.querySelector('.agency-toolbar input')?.value??null,focused:document.activeElement?.getAttribute('aria-label')||''}));
   check(`[${vname}] admin: «Torna all'editor» riporta alla dashboard nel punto di partenza`,back.path==='/staff/'&&Math.abs(back.scroll-scrollBefore)<=48&&(vname!=='desktop'||back.search===search)&&back.focused==='Apri menu '+targetName,{scrollBefore,back,search});
   await page.screenshot({path:resolve(out,`${LOCAL?'local':'live'}-${vname}-admin-back.png`)});
   await ctx.close();
   results.push({scenario:'admin',viewport:vname,expected});
   // ── Scenario 2: anonimo, stesso URL anche con parametri ──
   for(const query of ['','?staff=1&from=staff&editor=1&agency=1&return=%2Fstaff%2F']){
    const actx=await browser.createBrowserContext();const {page:ap,log:al}=await preparePage(actx,viewport);
    await ap.goto(BASE+expected+query,{waitUntil:'load'});await new Promise(r=>setTimeout(r,4000));
    const anon=await pillState(ap);
    check(`[${vname}] anonimo${query?' con parametri':''}: nessun pulsante e nessuna richiesta staff`,!anon&&!al.agencyMe.length&&!al.chunks.length,{agencyMe:al.agencyMe,chunks:al.chunks});
    check(`[${vname}] anonimo${query?' con parametri':''}: nessun errore in console`,!al.errors.length,{errors:al.errors.slice(0,5)});
    await actx.close();
   }
   // anonimo con indizio falsificato a mano: il server dice no
   {const fctx=await browser.createBrowserContext();const {page:fp,log:fl}=await preparePage(fctx,viewport);
    await fp.evaluateOnNewDocument(()=>{try{sessionStorage.setItem('tako-staff-return',JSON.stringify({v:1,at:Date.now(),restaurantId:'x',search:'',filter:'all',scroll:0}))}catch{}});
    await fp.goto(BASE+expected,{waitUntil:'load'});await new Promise(r=>setTimeout(r,4500));
    const forged=await pillState(fp);
    check(`[${vname}] anonimo con indizio falsificato: server rifiuta, nessun pulsante`,!forged&&fl.agencyMe.length===1&&fl.agencyMe[0]===401,{agencyMe:fl.agencyMe});
    await fctx.close();}
   // ── Scenario 3: ristoratore (owner QA), anche con indizio presente ──
   for(const withHint of [false,true]){
    const octx=await browser.createBrowserContext();await octx.setCookie(cookieOf(owner));const {page:op,log:ol}=await preparePage(octx,viewport);
    if(withHint)await op.evaluateOnNewDocument(()=>{try{sessionStorage.setItem('tako-staff-return',JSON.stringify({v:1,at:Date.now(),restaurantId:'x',search:'',filter:'all',scroll:0}))}catch{}});
    await op.goto(BASE+expected,{waitUntil:'load'});await new Promise(r=>setTimeout(r,4500));
    const own=await pillState(op);
    check(`[${vname}] ristoratore${withHint?' con indizio':''}: nessun pulsante`,!own&&(withHint?ol.agencyMe.length===1&&ol.agencyMe[0]===200:ol.agencyMe.length===0),{agencyMe:ol.agencyMe});
    if(withHint)await op.screenshot({path:resolve(out,`${LOCAL?'local':'live'}-${vname}-owner.png`)});
    await octx.close();
   }
  }
 }
}catch(e){check('esecuzione',false,{error:String(e?.stack||e).slice(0,600)})}
finally{
 if(browser)await browser.close().catch(()=>{});
 for(const api of [admin,owner]){if(api.state.cookie.includes('tako_session='))await api.call('/api/auth/logout',{method:'POST'}).catch(()=>{})}
}
const checks=results.filter(r=>'ok' in r),pass=checks.filter(r=>r.ok).length;
await writeFile(resolve(out,`${LOCAL?'local':'live'}-result.json`),JSON.stringify({at:stamp,mode:LOCAL?'local-bundle':'live',pass,total:checks.length,results},null,1));
console.log(`\n${pass}/${checks.length} ${LOCAL?'(bundle locale)':'(live)'}`);process.exit(pass===checks.length&&checks.length>0?0:1);
