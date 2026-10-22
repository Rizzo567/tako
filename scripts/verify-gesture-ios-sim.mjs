// 22/10 sera — Gesto «pressione lunga → sposta» su WebKit iOS VERO (Simulatore iPhone, Safari via safaridriver, tocchi
// W3C nativi). Banco di verify-menu-editor-dashboard.mjs con shell:true. Uso: DEVELOPER_DIR=… node scripts/verify-gesture-ios-sim.mjs <UDID>
import {startHarness,wait} from './verify-menu-editor-dashboard.mjs'
import {spawn} from 'node:child_process'
import {writeFile,mkdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(repo,'docs/webapp/dashboard-editor-2026-10-22/header-og')
await mkdir(OUT,{recursive:true})
const UDID=process.argv[2],PORT=4720+Math.floor(Math.random()*200)
const H=await startHarness({shell:true});const results=[];let fails=0
const check=(name,cond,detail='')=>{results.push({name,ok:!!cond,detail});if(!cond)fails++;console.log(cond?'✓':'✗',name,detail?JSON.stringify(detail):'')}
const drv=spawn('safaridriver',['-p',String(PORT)],{stdio:'ignore'});await wait(1500)
const W=async(method,path,body)=>{const r=await fetch(`http://127.0.0.1:${PORT}${path}`,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json();if(j.value?.error)throw new Error(path+': '+j.value.error+' '+j.value.message);return j.value}
let sid
const S=(m,p,b)=>W(m,`/session/${sid}${p}`,b)
const js=(fn,...args)=>S('POST','/execute/sync',{script:`return (${fn}).apply(null,arguments)`,args})
// Dito vero: tremolio di ±6 px reali durante la pressione (prima del fix annullava la pressione, soglia 8 px del documento ≈ 5 px reali).
const jitter=(x,y)=>[[6,0],[0,6],[-6,0],[0,-6],[5,5]].map(([dx,dy])=>({type:'pointerMove',duration:250,x:x+dx,y:y+dy}))
const touch=async(actions)=>{await S('POST','/actions',{actions:[{type:'pointer',id:'finger',parameters:{pointerType:'touch'},actions}]});await S('DELETE','/actions').catch(()=>{})}
const shot=async name=>{const b64=await S('GET','/screenshot');await writeFile(resolve(OUT,name+'.png'),Buffer.from(b64,'base64'))}
// Stato dentro l'iframe: ordine dei piatti, ghost, opacità originali, scroll.
const state=()=>js(()=>{const f=document.querySelector('.mw-ed-frame'),d=f.contentDocument,w=f.contentWindow
 return {dishes:[...d.querySelectorAll('[data-edit-kind="dish"]')].map(e=>e.textContent.trim().slice(0,18)),pills:[...d.querySelectorAll('[data-edit-kind="submenu"]')].map(e=>e.textContent.trim().slice(0,18)),ghosts:d.querySelectorAll('[data-menu-gesture-ghost]').length,hidden:[...d.querySelectorAll('[data-edit-id]')].filter(e=>e.style.opacity==='0').length,scrollY:Math.round(w.scrollY),log:(w.__glog||[]).slice(-30)}})
// Centro (coordinate della pagina) di un elemento dell'iframe, con la scala.
const point=(sel,n=0)=>js((sel,n)=>{const f=document.querySelector('.mw-ed-frame'),e=f.contentDocument.querySelectorAll(sel)[n],r=e.getBoundingClientRect(),b=f.getBoundingClientRect(),s=b.width/f.offsetWidth
 return {x:Math.round(b.left+(r.left+r.width/2)*s),y:Math.round(b.top+(r.top+r.height/2)*s),h:Math.round(r.height*s)}},sel,n)
try{
 const caps={browserName:'Safari',platformName:'iOS','safari:useSimulator':true,...(UDID?{'safari:deviceUDID':UDID}:{})}
 const s=await W('POST','/session',{capabilities:{alwaysMatch:caps}});sid=s.sessionId;console.log('sessione',s.capabilities?.browserVersion,s.capabilities?.platformName)
 await S('POST','/url',{url:H.base});await wait(1500);await js(()=>window.__mount());
 for(let k=0;k<60;k++){const ok=await js(()=>{const f=document.querySelector('.mw-ed-frame');return !!f?.contentDocument?.querySelector('[data-menu-edit-root] [data-edit-kind="dish"]')}).catch(()=>false);if(ok)break;await wait(500)}
 await wait(1500)
 // Diario eventi dentro l'iframe (per la diagnosi): pointer/touch/scroll/blur/resize.
 await js(()=>{const w=document.querySelector('.mw-ed-frame').contentWindow;w.__glog=[];const t0=performance.now();new w.MutationObserver(ms=>{for(const m of ms){for(const n of m.addedNodes)if(n.nodeType===1&&n.hasAttribute('data-menu-gesture-ghost'))w.__glog.push('GHOST+@'+Math.round(performance.now()-t0));for(const n of m.removedNodes)if(n.nodeType===1&&n.hasAttribute('data-menu-gesture-ghost'))w.__glog.push('GHOST-@'+Math.round(performance.now()-t0))}}).observe(w.document.body,{childList:true});for(const t of ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','scroll','blur','resize','lostpointercapture','contextmenu','selectstart'])w.addEventListener(t,e=>w.__glog.push(t+'@'+Math.round(performance.now()-t0)+(e.cancelable===false&&t==='touchstart'?'(nc)':'')),true)})
 await shot('ios-sim-00-ingresso')
 const before=await state();console.log('prima',before)
 const clearLog=()=>js(()=>{document.querySelector('.mw-ed-frame').contentWindow.__glog=[]})
 const lifted=log=>log.some(x=>x.startsWith('GHOST+'))
 let st
 // Porta Primi in vista: primi due piatti visibili nel riquadro.
 await js(()=>{const w=document.querySelector('.mw-ed-frame').contentWindow,e=w.document.querySelectorAll('[data-edit-kind="dish"]')[0];w.scrollTo(0,e.getBoundingClientRect().top+w.scrollY-120)});await wait(800);await clearLog()
 await shot('ios-sim-01-piatti-in-vista')
 // 2. Piatto: pressione 1,25 s → sollevato → trascinato sopra il primo → posato (un'unica sequenza di tocco nativa).
 const a=await point('[data-edit-kind="dish"]',1),b=await point('[data-edit-kind="dish"]',0)
 const vis=await js(()=>{const s=document.querySelector('.mw-ed-stage').getBoundingClientRect();return {t:s.top,b:s.bottom}});console.log('piatti',a,b,vis,await js((x,y)=>{const e=document.elementFromPoint(x,y);return {el:e&&(e.tagName+'.'+e.className).slice(0,60),vv:visualViewport&&{s:visualViewport.scale,w:visualViewport.width,h:visualViewport.height,ot:visualViewport.offsetTop},iw:innerWidth,ih:innerHeight}},a.x,a.y))
 await touch([{type:'pointerMove',duration:0,x:a.x,y:a.y},{type:'pointerDown',button:0},...jitter(a.x,a.y),{type:'pointerMove',duration:200,x:a.x,y:a.y-10},{type:'pointerMove',duration:500,x:b.x,y:b.y-8},{type:'pause',duration:300},{type:'pointerUp',button:0}]);await wait(1500)
 st=await state();check('piatto: sollevato con la pressione lunga',lifted(st.log),st.log)
 check('piatto: spostato e posato',st.dishes[0]===before.dishes[1]&&st.dishes[1]===before.dishes[0]&&!st.ghosts&&!st.hidden,{dishes:st.dishes.slice(0,3),ghosts:st.ghosts,hidden:st.hidden,log:st.log})
 await shot('ios-sim-02-piatto-posato')
 // 3. Sottomenu (pillola): pressione → sollevata → dopo la seconda → posata.
 await js(()=>document.querySelector('.mw-ed-frame').contentWindow.scrollTo(0,0));await wait(800);await clearLog()
 const pa=await point('[data-edit-kind="submenu"]',0),pb=await point('[data-edit-kind="submenu"]',1)
 const pills0=(await state()).pills
 await touch([{type:'pointerMove',duration:0,x:pa.x,y:pa.y},{type:'pointerDown',button:0},...jitter(pa.x,pa.y),{type:'pointerMove',duration:200,x:pa.x+10,y:pa.y},{type:'pointerMove',duration:500,x:pb.x+30,y:pb.y},{type:'pause',duration:300},{type:'pointerUp',button:0}]);await wait(1500)
 st=await state();check('sottomenu: sollevato con la pressione lunga',lifted(st.log),st.log)
 check('sottomenu: spostato e posato',st.pills.join('|')!==pills0.join('|')&&!st.ghosts&&!st.hidden,{prima:pills0,dopo:st.pills,ghosts:st.ghosts,hidden:st.hidden,log:st.log})
 await shot('ios-sim-03-sottomenu-posato')
 // 1. Scroll normale senza pressione lunga (dito sulle pillole, trascinato verso l'alto): il menu dentro il riquadro scorre.
 await js(()=>document.querySelector('.mw-ed-frame').contentWindow.scrollTo(0,0));await wait(600);await clearLog();let p=await point('[data-edit-kind="submenu"]',0)
 await touch([{type:'pointerMove',duration:0,x:p.x-60,y:p.y+20},{type:'pointerDown',button:0},{type:'pointerMove',duration:250,x:p.x-60,y:p.y-200},{type:'pointerUp',button:0}]);await wait(1200)
 st=await state();check('scroll normale senza pressione lunga (nessun sollevamento)',st.scrollY>20&&!lifted(st.log)&&!st.ghosts,{scrollY:st.scrollY,log:st.log})
 check('ops inviate al banco',H.srv.calls.some(c=>c.p.endsWith('/ops')),H.srv.calls.map(c=>c.p).slice(-5))
}catch(e){fails++;console.error('ERRORE',e.message)}
finally{if(sid)await W('DELETE',`/session/${sid}`).catch(()=>{});drv.kill();await writeFile(resolve(OUT,'esito-ios-sim.json'),JSON.stringify({at:new Date().toISOString(),fails,results},null,1));await H.close()}
console.log(fails?`ROSSO: ${fails}`:'TUTTO VERDE');process.exit(fails?1:0)
