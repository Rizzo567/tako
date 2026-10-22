// 22/10 notte — barra vetro a tutta larghezza, riga unica, Avanzate senza salti, pillola delle voci che scivola,
// pillole Sottomenu intere nell'editor. Banco di verify-menu-editor-dashboard.mjs (shell:true, API finta). Chrome headless.
// Uscita: docs/webapp/dashboard-editor-2026-10-22/motion-1022/*.png|*.webm + esito.json
import {startHarness,frameOf,wait} from './verify-menu-editor-dashboard.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(repo,'docs/webapp/dashboard-editor-2026-10-22/motion-1022')
await mkdir(OUT,{recursive:true});process.env.PATH='/opt/homebrew/bin:'+process.env.PATH
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const H=await startHarness({shell:true});const results=[];let fails=0
const check=(name,cond,detail='')=>{results.push({name,ok:!!cond,detail});if(!cond)fails++;console.log(cond?'✓':'✗',name,detail?JSON.stringify(detail):'')}
const {fixture}=await import('./verify-menu-editor-dashboard.mjs')
const fresh=()=>Object.assign(H.srv,{doc:fixture(),published:fixture(),revision:3,publishedRevision:3,fail:[],offline:false,flag:true,botConflicts:[]})
const shot=(page,name)=>page.screenshot({path:resolve(OUT,name+'.png')})
const rects=page=>page.evaluate(()=>{const R=e=>{if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left*10)/10,Math.round(r.top*10)/10,Math.round(r.width*10)/10,Math.round(r.height*10)/10]}
 return {picker:R(document.querySelector('.mw-studio-toolbar .mw-universal-search')),preset:R(document.querySelector('.mw-studio-toolbar .mw-dp-btn')),buttons:[...document.querySelectorAll('.mw-studio-toolbuttons>button')].map(R),slot:R(document.querySelector('.mw-swap-slot')),tabs:R(document.querySelector('.mw-studio-sections'))}})
const clickText=(page,sel,text)=>page.evaluate((s,t)=>{const b=[...document.querySelectorAll(s)].find(x=>x.textContent.trim()===t);b.click()},sel,text)
const thumbX=page=>page.$eval('.mw-tab-thumb',t=>{const m=new DOMMatrix(getComputedStyle(t).transform);return Math.round(m.m41*10)/10})
const activeX=page=>page.$eval('.mw-studio-sections button.active',b=>b.offsetLeft)
try{
 for(const vp of [{name:'390',w:390,h:844,mobile:true},{name:'430',w:430,h:932,mobile:true},{name:'1280',mobile:false}]){
  fresh();const P=vp.name,page=await H.browser.newPage()
  if(vp.mobile)await page.emulate({viewport:{width:vp.w,height:vp.h,deviceScaleFactor:3,isMobile:true,hasTouch:true},userAgent:UA})
  else await page.setViewport({width:1280,height:900,deviceScaleFactor:1})
  await page.goto(H.base);await page.evaluate(()=>window.__mount());await page.waitForSelector('.mw-ed-stage')
  const f=await frameOf(page);await f.waitForSelector('[data-menu-edit-root] [data-edit-id]',{timeout:20000});await wait(1200)
  const ov=()=>page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,ssw:document.querySelector('.screen-scroll')?.scrollWidth,scw:document.querySelector('.screen-scroll')?.clientWidth}))
  let o=await ov();check(P+' niente scroll orizzontale',o.sw<=o.iw&&o.ssw<=o.scw,o)
  await shot(page,P+'-01-editor')
  if(vp.mobile){const g=await page.evaluate(()=>({hdrB:Math.round(document.querySelector('.mobile-header-shell').getBoundingClientRect().bottom),tabsT:Math.round(document.querySelector('.mw-studio-sections').getBoundingClientRect().top)}));check(P+' voci vicine alla testata (≤ 12 px)',g.tabsT-g.hdrB<=12,g)}
  // Riga unica
  const row=await page.evaluate(()=>{const t=document.querySelector('.mw-studio-toolbar'),kids=[t.querySelector('.mw-universal-search'),t.querySelector('.mw-dp-btn'),...t.querySelectorAll('.mw-studio-toolbuttons>button'),t.querySelector('.mw-swap-btn')].filter(Boolean)
   const r=kids.map(k=>k.getBoundingClientRect());return {n:kids.length,tops:r.map(x=>Math.round(x.top)),hs:r.map(x=>Math.round(x.height)),right:Math.round(Math.max(...r.map(x=>x.right))),left:Math.round(Math.min(...r.map(x=>x.left))),label:t.querySelector('.mw-menu-picker span')?.textContent,ell:getComputedStyle(t.querySelector('.mw-menu-picker span')).textOverflow}})
  check(P+' riga unica (Menu, Preset, lente, +, Avanzate)',row.n>=4&&Math.max(...row.tops)-Math.min(...row.tops)<=3&&row.right<=(vp.w||1280)&&row.left>=0,row)
  if(vp.mobile)check(P+' riga compatta (altezza ≤ 36, select con ellissi)',Math.max(...row.hs)<=36&&row.ell==='ellipsis',row)
  // Avanzate: posizioni invariate, larghezza animata, testo che cambia
  const before=await rects(page),w0=await page.$eval('.mw-swap-btn',b=>b.getBoundingClientRect().width)
  const rec=vp.name==='390'?await page.screencast({path:resolve(OUT,P+'-avanzate-e-voci.webm')}).catch(e=>{console.log('screencast non disponibile',e.message);return null}):null
  await wait(300)
  await page.click('.mw-swap-btn');await wait(110)
  const mid=await page.evaluate(()=>{const b=document.querySelector('.mw-swap-btn');return {w:b.getBoundingClientRect().width,texts:[...b.querySelectorAll('.mw-swap-text')].map(s=>[s.textContent,getComputedStyle(s).opacity])}})
  await wait(600)
  const after=await rects(page),w1=await page.$eval('.mw-swap-btn',b=>b.getBoundingClientRect().width),lab=await page.$eval('.mw-swap-btn',b=>b.textContent.trim())
  check(P+' Avanzate → «Torna al menu»',lab==='Torna al menu'&&!!(await page.$('.mw-catalog-list')),{lab})
  check(P+' Avanzate: larghezza animata (a metà fra prima e dopo)',mid.w>Math.min(w0,w1)+1&&mid.w<Math.max(w0,w1)-1,{w0,mid,w1})
  check(P+' Avanzate: dissolvenza del testo (due scritte a metà)',mid.texts.length===2,mid.texts)
  check(P+' Avanzate: altri elementi fermi (rettangoli identici)',JSON.stringify({...before,tabs:0})===JSON.stringify({...after,tabs:0}),{before,after})
  const ghost=await page.evaluate(()=>document.querySelectorAll('.mw-panel-ghost').length);check(P+' nessuna copia residua dopo la dissolvenza',ghost===0,{ghost})
  await shot(page,P+'-02-avanzate')
  await page.click('.mw-swap-btn');await wait(150);await page.click('.mw-swap-btn');await wait(150);await page.click('.mw-swap-btn');await wait(700)
  const back=await rects(page),lab2=await page.$eval('.mw-swap-btn',b=>b.textContent.trim())
  check(P+' clic rapidi ×3 ritargettano (fine su «Avanzate», editor, elementi fermi)',lab2==='Avanzate'&&!!(await page.$('.mw-ed-stage'))&&JSON.stringify({...before,tabs:0})===JSON.stringify({...back,tabs:0}),{lab2})
  // Voci: pillola che scivola
  const x0=await thumbX(page);await clickText(page,'.mw-studio-sections button','Aspetto');await wait(120)
  const xm=await thumbX(page);await wait(450);const x1=await thumbX(page),ax=await activeX(page)
  check(P+' voci: pillola scivola (a metà fra le due voci) e arriva su Aspetto',xm>x0+1&&xm<x1-1&&Math.abs(x1-ax)<=1,{x0,xm,x1,ax})
  const panelOp=await page.$eval('.mw-tab-panel',p=>getComputedStyle(p).opacity);check(P+' contenuto nuovo a riposo opaco',panelOp==='1',{panelOp})
  await clickText(page,'.mw-studio-sections button','Condividi');await wait(60);await clickText(page,'.mw-studio-sections button',vp.mobile?'PDF':'Piatti');await wait(80)
  const xr=await thumbX(page);await wait(500);const xe=await thumbX(page),axe=await activeX(page)
  check(P+' voci: clic rapidi ritargettano senza code',Math.abs(xe-axe)<=1&&Math.abs(xr-xe)>1,{xr,xe,axe})
  await shot(page,P+'-03-voce')
  await clickText(page,'.mw-studio-sections button','Piatti');await wait(900)
  if(rec)await rec.stop()
  const toolbarOpen=await page.$eval('.mw-toolbar-wrap',w=>({open:w.dataset.open,h:Math.round(w.getBoundingClientRect().height)}));check(P+' riga strumenti riaperta su Piatti',toolbarOpen.open==='1'&&toolbarOpen.h>=34,toolbarOpen)
  o=await ov();check(P+' niente scroll orizzontale (dopo i cambi)',o.sw<=o.iw&&o.ssw<=o.scw,o)
  // Pillole Sottomenu nell'editor
  await page.waitForSelector('.mw-ed-stage');const f2=await frameOf(page);await f2.waitForSelector('[data-edit-kind="submenu"]',{timeout:20000});await wait(800)
  const pills=()=>f2.evaluate(()=>{const h=document.querySelector('[data-menu-sticky-header]'),bd=h?.querySelector('[data-menu-header-backdrop]'),hb=h.getBoundingClientRect().bottom,bb=bd?bd.getBoundingClientRect().bottom:0,after=getComputedStyle(h,'::after').display
   const ps=[...document.querySelectorAll('[data-edit-kind="submenu"]')].map(p=>{const r=p.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+4);return {top:Math.round(r.top),hit:!!hit&&(hit===p||p.contains(hit))}});return {hb:Math.round(hb),bb:Math.round(bb),after,ps}})
  let pl=await pills();check(P+' pillole Sottomenu intere all\'apertura (sotto la testata, niente sfondo/sfumatura sopra)',pl.ps.length>0&&pl.ps.every(p=>p.hit&&p.top>=pl.hb)&&pl.bb<=pl.hb+1&&pl.after==='none',pl)
  await f2.evaluate(()=>window.scrollTo(0,400));await wait(300);await f2.evaluate(()=>window.scrollTo(0,0));await wait(300)
  pl=await pills();check(P+' pillole Sottomenu intere dopo scorrimento',pl.ps.every(p=>p.hit&&p.top>=pl.hb),pl)
  if(vp.mobile){
   const G=await page.$eval('.mobile-bottom-nav',n=>{const cs=getComputedStyle(n),r=n.getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(innerWidth-r.right),b:Math.round(innerHeight-r.bottom),h:Math.round(r.height),tl:cs.borderTopLeftRadius,bl:cs.borderBottomLeftRadius,bf:cs.backdropFilter||cs.webkitBackdropFilter,labels:[...n.querySelectorAll('button')].map(b=>b.textContent.trim()),items:[...n.querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().top-r.top))}})
   check(P+' barra: lastra a tutta larghezza, angoli alti 22–28, bassi dritti, bottom 0, vetro',G.l===0&&G.r===0&&G.b===0&&parseFloat(G.tl)>=22&&parseFloat(G.tl)<=28&&parseFloat(G.bl)===0&&/blur\(2[0-4]px\)/.test(G.bf),G)
   check(P+' barra: Menu + Account (niente Lead/Assistente), voci in alto',G.labels.join('|')==='Menu|Account'&&G.items.every(t=>t<=8),G)
   const st=await page.evaluate(()=>{const s=document.querySelector('.mw-ed-stage').getBoundingClientRect(),n=document.querySelector('.mobile-bottom-nav').getBoundingClientRect(),h=document.querySelector('.mobile-header-shell').getBoundingClientRect(),t=document.querySelector('.mw-studio-sections').getBoundingClientRect();return {stageB:Math.round(s.bottom),navT:Math.round(n.top),hdrB:Math.round(h.bottom),tabsT:Math.round(t.top),hdrH:Math.round(h.height)}})
   check(P+' riquadro scorre dietro la lastra',st.stageB>st.navT,st)
   await shot(page,P+'-04-barra-pillole')
   // Reduced motion: cambi immediati
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
   await clickText(page,'.mw-studio-sections button','Aspetto');await wait(30);const rx=await thumbX(page),rax=await activeX(page)
   await page.click('.mw-studio-sections button');await wait(300)
   check(P+' reduced motion: pillola subito sulla voce, niente copie in dissolvenza',Math.abs(rx-rax)<=1&&(await page.evaluate(()=>document.querySelectorAll('.mw-panel-ghost').length))===0,{rx,rax})
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}])
   // Tastiera: Tab arriva al pulsante Avanzate, Invio lo attiva, il fuoco resta sul pulsante
   await page.focus('.mw-swap-btn');await page.keyboard.press('Enter');await wait(500)
   const kf=await page.evaluate(()=>({focus:document.activeElement?.classList.contains('mw-swap-btn'),lab:document.querySelector('.mw-swap-btn').textContent.trim()}))
   check(P+' tastiera: Invio su Avanzate, fuoco resta sul pulsante',kf.focus&&kf.lab==='Torna al menu',kf)
  }else{await shot(page,P+'-04-desktop')}
  await page.close()
 }
 check('errori console',H.errors.length===0,H.errors.slice(0,5))
}catch(e){check('esecuzione',false,String(e.stack||e))}
finally{await writeFile(resolve(OUT,'esito.json'),JSON.stringify({fails,results},null,1));await H.close?.();await H.browser.close().catch(()=>{})}
console.log(fails?`✗ ${fails} controlli rossi`:'TUTTO VERDE');process.exit(fails?1:0)
