// 22/10 sera — Testata telefono: «Pubblica» nella riga del logo, contenuti saliti, barra in basso senza «Assistente».
// Banco di verify-menu-editor-dashboard.mjs con shell:true (MobileHeader + BottomBar reali, API finta). Chrome headless.
// Uscita: docs/webapp/dashboard-editor-2026-10-22/header-og/*.png + esito.json
import {startHarness,frameOf,wait,waitFor} from './verify-menu-editor-dashboard.mjs'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(repo,'docs/webapp/dashboard-editor-2026-10-22/header-og')
await mkdir(OUT,{recursive:true});process.env.PATH='/opt/homebrew/bin:'+process.env.PATH
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const H=await startHarness({shell:true});const results=[];let fails=0
const check=(name,cond,detail='')=>{results.push({name,ok:!!cond,detail});if(!cond)fails++;console.log(cond?'✓':'✗',name,detail?JSON.stringify(detail):'')}
const {fixture}=await import('./verify-menu-editor-dashboard.mjs')
const fresh=()=>Object.assign(H.srv,{doc:fixture(),published:fixture(),revision:3,publishedRevision:3,fail:[],offline:false,flag:true,botConflicts:[]})
const shot=(page,name)=>page.screenshot({path:resolve(OUT,name+'.png')})
try{
 // Meta OG nell'HTML sorgente e nel build
 for(const f of ['apps/dashboard/public/staff/index.html','release/serverless/static/staff/index.html']){const h=await readFile(resolve(repo,f),'utf8')
  const need=['og:type','og:site_name','og:title','og:description','og:url','og:image"','og:image:width','og:image:height','og:image:type','og:image:alt','twitter:card','twitter:image"']
  const miss=need.filter(k=>!h.includes(k));check('meta OG in '+f,!miss.length&&h.includes('https://takoitalia.com/staff/assets/branding/takomenu-og-v2.jpg'),{miss})}
 for(const vp of [{name:'390',w:390,h:844,mobile:true},{name:'430',w:430,h:932,mobile:true},{name:'1280',mobile:false}]){
  fresh();const P=vp.name,page=await H.browser.newPage()
  if(vp.mobile)await page.emulate({viewport:{width:vp.w,height:vp.h,deviceScaleFactor:3,isMobile:true,hasTouch:true},userAgent:UA})
  else await page.setViewport({width:1280,height:900,deviceScaleFactor:1})
  await page.goto(H.base);await page.evaluate(()=>window.__mount());await page.waitForSelector('.mw-ed-stage')
  const f=await frameOf(page);await f.waitForSelector('[data-menu-edit-root] [data-edit-id]',{timeout:20000});await wait(1200)
  const ov=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));check(P+' niente scroll orizzontale',ov.sw<=ov.iw,ov)
  const pub=()=>page.$eval('.mw-ed-publish-btn',b=>{const cs=getComputedStyle(b);return {disabled:b.disabled,label:b.getAttribute('aria-label'),bg:cs.backgroundColor,inSlot:!!b.closest('#tako-mobile-header-slot')}})
  let p=await pub();check(P+' Pubblica grigio disattivato senza modifiche',p.disabled&&p.label==='Nessuna modifica da pubblicare',p)
  if(vp.mobile){
   const L=await page.evaluate(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),r:Math.round(r.right),cy:Math.round(r.top+r.height/2),h:Math.round(r.height)}}
    return {brand:R('.mobile-header-brand img'),pub:R('.mw-ed-publish-btn'),header:R('.mobile-header-shell'),sticky:!!document.querySelector('.mw-ed-sticky'),tabs:(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Piatti');if(!b)return null;const r=b.getBoundingClientRect();return {t:Math.round(r.top),b:Math.round(r.bottom)}})(),stage:R('.mw-ed-stage'),nav:R('.mobile-bottom-nav'),
     navLabels:[...document.querySelectorAll('.mobile-bottom-nav button')].map(b=>({t:b.textContent.trim(),w:Math.round(b.getBoundingClientRect().width)}))}})
   check(P+' Pubblica nello slot della testata',p.inSlot&&!L.sticky,{inSlot:p.inSlot,sticky:L.sticky})
   check(P+' Pubblica sulla riga del logo, a destra',L.pub&&L.brand&&Math.abs(L.pub.cy-L.brand.cy)<=6&&L.pub.l>L.brand.r&&L.pub.r<=vp.w,{pub:L.pub,brand:L.brand})
   check(P+' contenuti subito sotto la testata',L.stage&&L.header&&L.tabs?.t-L.header.b<40,{header:L.header,tabs:L.tabs,stage:L.stage})
   check(P+' riquadro scorre dietro la capsula',L.stage&&L.nav&&L.stage.b>=L.nav.b,{stage:L.stage,nav:L.nav})
   const G=await page.$eval('.mobile-bottom-nav',n=>{const cs=getComputedStyle(n),r=n.getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(innerWidth-r.right),h:Math.round(r.height),radius:cs.borderTopLeftRadius,bf:cs.backdropFilter||cs.webkitBackdropFilter,bg:cs.backgroundColor,pos:cs.position,on:[...n.querySelectorAll('.bb-tab')].map(b=>b.classList.contains('is-on'))}})
   check(P+' capsula vetro (staccata, arrotondata, sfocata, bassa)',G.pos==='absolute'&&G.l>=16&&G.l<=20&&G.r>=16&&G.h>=54&&G.h<=60&&parseFloat(G.radius)>=29&&/blur/.test(G.bf)&&/rgba\(255, 255, 255, 0\.6\)/.test(G.bg)&&G.on[0]===true,G)
   const last=await page.evaluate(async()=>{const f=document.querySelector('.mw-ed-frame'),w=f.contentWindow,d=f.contentDocument;w.scrollTo(0,d.documentElement.scrollHeight);await new Promise(r=>setTimeout(r,300));const items=[...d.querySelectorAll('[data-edit-kind="dish"]')],e=items[items.length-1],r=e.getBoundingClientRect(),b=f.getBoundingClientRect(),s=b.width/f.offsetWidth,nav=document.querySelector('.mobile-bottom-nav').getBoundingClientRect();const out={lastBottom:Math.round(b.top+r.bottom*s),navTop:Math.round(nav.top),pad:d.documentElement.style.paddingBottom};w.scrollTo(0,0);return out})
   check(P+' ultimo piatto raggiungibile sopra la capsula',last.lastBottom<=last.navTop&&parseFloat(last.pad)>0,last)
   const labels=L.navLabels.map(x=>x.t);check(P+' barra in basso: Menu + Account, niente Assistente',labels.join('|')==='Menu|Account'&&Math.abs(L.navLabels[0].w-L.navLabels[1].w)<=2,L.navLabels)
   await shot(page,'dopo-'+P+'-01-testata')
   // Tap su un piatto → matita
   const sel='[data-edit-kind="dish"]'
   const r=await f.$eval(sel,e=>{const b=e.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}});const fr=await page.$eval('.mw-ed-frame',e=>{const b=e.getBoundingClientRect();return {l:b.left,t:b.top,s:b.width/e.offsetWidth}})
   await page.touchscreen.tap(fr.l+r.x*fr.s,fr.t+r.y*fr.s);await wait(600)
   const vis=await f.evaluate(()=>{const fr=document.querySelector('.tako-edit-frame'),pe=document.querySelector('.tako-edit-pencil');return {frame:!!fr&&!fr.classList.contains('tako-edit-hidden'),pencil:!!pe&&!pe.classList.contains('tako-edit-hidden')}})
   check(P+' tap → riquadro + matita',vis.frame&&vis.pencil,vis);await shot(page,'dopo-'+P+'-02-tap-matita')
   const pp=await f.$eval('.tako-edit-pencil',e=>{const b=e.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})
   await page.touchscreen.tap(fr.l+pp.x*fr.s,fr.t+pp.y*fr.s);await page.waitForSelector('dialog.mw-bottom-sheet[open]',{timeout:6000});await wait(600)
   const input=await page.$('dialog.mw-bottom-sheet .mw-drawer-content input');await input.click({clickCount:3});await page.keyboard.type(' prova');await page.keyboard.press('Tab');await wait(300)
   await page.$eval('dialog.mw-bottom-sheet .mw-sheet-close, dialog.mw-bottom-sheet [aria-label^="Chiudi"]',b=>b.click()).catch(()=>{});await page.waitForFunction(()=>!document.querySelector('dialog.mw-bottom-sheet[open]'),{timeout:6000}).catch(()=>{})
   await waitFor(async()=>!(await pub()).disabled,8000,'Pubblica attivo').catch(()=>{})
   p=await pub();check(P+' Pubblica nero in testata dopo una modifica',!p.disabled&&p.inSlot&&/rgb\((10|0|1[0-9]), ?(10|0|1[0-9]), ?(10|0|1[0-9])\)/.test(p.bg),p)
   const ov2=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));check(P+' niente scroll orizzontale (dopo modifica)',ov2.sw<=ov2.iw,ov2)
   await shot(page,'dopo-'+P+'-03-pubblica-nero')
  }else{
   check(P+' desktop: Pubblica non spostato in testata',!p.inSlot,p);await shot(page,'dopo-'+P+'-01-desktop')
  }
  await page.close()
 }
}catch(e){fails++;console.error('ERRORE',e)}
finally{await writeFile(resolve(OUT,'esito.json'),JSON.stringify({at:new Date().toISOString(),fails,results,errors:H.errors},null,1));await H.close()}
console.log(fails?`ROSSO: ${fails}`:'TUTTO VERDE');process.exit(fails?1:0)
