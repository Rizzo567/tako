// Ritocchi telefono 22/10 sera — verifica headless (emulazione iPhone vera: viewport mobile + DPR 3 + touch) sul banco
// di verify-menu-editor-dashboard.mjs (SPA vera, renderer vero + layer di modifica vero, API finta). Chrome sempre headless.
// Uscita: docs/webapp/dashboard-editor-2026-10-22/mobile-fix/*.png + esito.json
import {startHarness,frameOf,wait,waitFor} from './verify-menu-editor-dashboard.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(repo,'docs/webapp/dashboard-editor-2026-10-22/mobile-fix')
await mkdir(OUT,{recursive:true});process.env.PATH='/opt/homebrew/bin:'+process.env.PATH
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const H=await startHarness();const results=[];let fails=0
const check=(name,cond,detail='')=>{results.push({name,ok:!!cond,detail});if(!cond)fails++;console.log(cond?'✓':'✗',name,detail?JSON.stringify(detail):'')}
const fresh=()=>{const f=H.srv;const {fixture}=globalThis.__fx;Object.assign(f,{doc:fixture(),published:fixture(),revision:3,publishedRevision:3,fail:[],offline:false,flag:true,botConflicts:[]})}
globalThis.__fx=await import('./verify-menu-editor-dashboard.mjs')
async function open(vp){
 const page=await H.browser.newPage()
 if(vp.mobile)await page.emulate({viewport:{width:vp.w,height:vp.h,deviceScaleFactor:3,isMobile:true,hasTouch:true},userAgent:UA})
 else await page.setViewport({width:1280,height:900,deviceScaleFactor:1})
 const cdp=await page.createCDPSession();await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true}).catch(()=>{})
 await page.goto(H.base);await page.evaluate(()=>window.__mount());await page.waitForSelector('.mw-ed-stage')
 const f=await frameOf(page);await f.waitForSelector('[data-menu-edit-root] [data-edit-id]',{timeout:20000});await wait(900)
 return {page,f}
}
// Stato «pulito»: niente riquadro/matita, niente ghost, niente indicatore pieno, nessuna trasformazione/opacità residua.
const clean=f=>f.evaluate(()=>{const vis=el=>el&&!el.classList.contains('tako-edit-hidden')
 const bad=[...document.querySelectorAll('[data-edit-id]')].filter(e=>(e.style.transform&&e.style.transform!=='none')||e.style.opacity==='0').map(e=>e.textContent.trim().slice(0,30))
 return {frame:vis(document.querySelector('.tako-edit-frame')),pencil:vis(document.querySelector('.tako-edit-pencil')),ghosts:document.querySelectorAll('[data-menu-gesture-ghost]').length,indicator:document.querySelectorAll('[data-category-indicator]').length,bad}})
const isClean=c=>!c.frame&&!c.pencil&&!c.ghosts&&!c.indicator&&!c.bad.length
const hOverflow=page=>page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,ok:document.documentElement.scrollWidth<=innerWidth}))
// Punto della pagina che corrisponde al centro di un elemento dell'iframe (con la scala).
async function pagePoint(page,f,sel,scroll=true){const r=await f.$eval(sel,(e,scroll)=>{if(scroll)e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2,w:b.width,h:b.height}},scroll);await wait(250)
 const r2=await f.$eval(sel,e=>{const b=e.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2,w:b.width,h:b.height,l:b.left,t:b.top}})
 const fr=await page.$eval('.mw-ed-frame',e=>{const b=e.getBoundingClientRect();return {l:b.left,t:b.top,s:b.width/e.offsetWidth}})
 return {x:fr.l+r2.x*fr.s,y:fr.t+r2.y*fr.s,in:r2,scale:fr.s}}
const shot=(page,name)=>page.screenshot({path:resolve(OUT,name+'.png')})
try{
 for(const vp of [{name:'390',w:390,h:844,mobile:true},{name:'430',w:430,h:932,mobile:true},{name:'1280',mobile:false}]){
  fresh();const {page,f}=await open(vp),P=vp.name
  // 1. Nessuna selezione all'ingresso
  let c=await clean(f);check(P+' ingresso pulito',isClean(c),c)
  check(P+' niente scroll orizzontale (ingresso)',(await hOverflow(page)).ok,await hOverflow(page))
  // 4. Pubblica grigio e disattivato senza modifiche, senza scritta di stato
  const pub=()=>page.$eval('.mw-ed-publish-btn',b=>{const r=b.getBoundingClientRect(),cs=getComputedStyle(b);return {disabled:b.disabled,label:b.getAttribute('aria-label'),bg:cs.backgroundColor,w:Math.round(r.width),status:!!document.querySelector('.mw-ed-status')}})
  let p=await pub();check(P+' Pubblica grigio disattivato',p.disabled&&p.label==='Nessuna modifica da pubblicare'&&!p.status&&p.w<140,p)
  if(vp.mobile){
   // 2. Riquadro fisso, pagina ferma, menu rimpicciolito e scorrevole dentro
   const lay=await page.evaluate(()=>{const s=document.querySelector('.screen-scroll'),st=document.querySelector('.mw-ed-stage').getBoundingClientRect(),fr=document.querySelector('.mw-ed-frame');return {pageScroll:s.scrollHeight-s.clientHeight,overflowY:getComputedStyle(s).overflowY,stageBottom:Math.round(st.bottom),scrollerBottom:Math.round(s.getBoundingClientRect().bottom),ih:innerHeight,scale:fr.getBoundingClientRect().width/fr.offsetWidth}})
   const inner=await f.evaluate(()=>({iw:innerWidth,sh:document.documentElement.scrollHeight,ih:innerHeight}))
   check(P+' pagina dashboard non scorre',lay.pageScroll<=1||lay.overflowY==='hidden',lay)
   check(P+' riquadro dentro lo schermo',lay.stageBottom<=lay.scrollerBottom+1&&lay.stageBottom<=lay.ih,lay)
   check(P+' menu rimpicciolito (600 px logici)',inner.iw===600&&lay.scale>0.6&&lay.scale<0.75,{...inner,scale:lay.scale})
   check(P+' menu scorre dentro il riquadro',inner.sh>inner.ih+50,inner)
   await f.evaluate(()=>scrollTo(0,400));await wait(200);const y=await f.evaluate(()=>({y:scrollY,max:document.documentElement.scrollHeight-innerHeight}));const ps=await page.$eval('.screen-scroll',s=>s.scrollTop);check(P+' scroll interno ok, pagina ferma',y.y>=Math.min(400,y.max)-1&&y.y>0&&ps===0,{...y,ps});await f.evaluate(()=>scrollTo(0,0));await wait(200)
   await shot(page,'dopo-'+P+'-01-ingresso')
   // Tap su un piatto → riquadro + matita sul punto giusto
   const sel='[data-edit-kind="dish"]'
   let pt=await pagePoint(page,f,sel);await page.touchscreen.tap(pt.x,pt.y);await wait(500)
   const sf=await f.evaluate(s=>{const fr=document.querySelector('.tako-edit-frame'),pe=document.querySelector('.tako-edit-pencil'),t=document.querySelector(s).getBoundingClientRect(),a=fr.getBoundingClientRect(),pb=pe.getBoundingClientRect();return {vis:!fr.classList.contains('tako-edit-hidden'),dx:Math.abs(a.left+4-t.left),dy:Math.abs(a.top+4-t.top),dw:Math.abs(a.width-8-t.width),pencilH:pb.height,pencilNearTop:Math.abs(pb.top+pb.height/2-(t.top-4))<8}},sel)
   check(P+' tap → riquadro sul piatto',sf.vis&&sf.dx<2&&sf.dy<2&&sf.dw<2,sf)
   check(P+' matita a misura di dito (≥ 44 px reali)',sf.pencilH*pt.scale>=43&&sf.pencilNearTop,{realH:sf.pencilH*pt.scale})
   await shot(page,'dopo-'+P+'-02-tap-matita')
   // Matita → foglio «Modifica piatto»: niente scroll orizzontale
   const pp=await f.$eval('.tako-edit-pencil',e=>{const b=e.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}});const fr=await page.$eval('.mw-ed-frame',e=>{const b=e.getBoundingClientRect();return {l:b.left,t:b.top,s:b.width/e.offsetWidth}})
   await page.touchscreen.tap(fr.l+pp.x*fr.s,fr.t+pp.y*fr.s);await page.waitForSelector('dialog.mw-bottom-sheet[open]',{timeout:6000});await wait(700)
   const sh=await page.evaluate(()=>{const d=document.querySelector('dialog.mw-bottom-sheet[open]'),c=d.querySelector('.mw-drawer-content'),wide=[...d.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+0.5||r.left<-0.5)}).map(e=>e.className||e.tagName).slice(0,5);return {title:d.querySelector('h3')?.textContent,cSW:c.scrollWidth,cCW:c.clientWidth,dSW:d.scrollWidth,dCW:d.clientWidth,ox:getComputedStyle(c).overflowX,wide,doc:document.documentElement.scrollWidth<=innerWidth}})
   check(P+' foglio senza scroll orizzontale',sh.cSW<=sh.cCW&&sh.dSW<=sh.dCW&&sh.ox==='hidden'&&!sh.wide.length&&sh.doc,sh)
   await page.$eval('dialog.mw-bottom-sheet .mw-drawer-content',c=>c.scrollTo(0,c.scrollHeight));await wait(200);await shot(page,'dopo-'+P+'-03-foglio-fondo');await page.$eval('dialog.mw-bottom-sheet .mw-drawer-content',c=>c.scrollTo(0,0))
   // Una modifica (solo banco locale = QA finto) → Pubblica nero e cliccabile
   const input=await page.$('dialog.mw-bottom-sheet .mw-drawer-content input');await input.click({clickCount:3});await page.keyboard.type(' prova');await page.keyboard.press('Tab');await wait(300)
   await page.$eval('dialog.mw-bottom-sheet .mw-sheet-close, dialog.mw-bottom-sheet [aria-label^="Chiudi"]',b=>b.click()).catch(()=>{});await page.waitForFunction(()=>!document.querySelector('dialog.mw-bottom-sheet[open]'),{timeout:6000}).catch(()=>{})
   await waitFor(async()=>!(await pub()).disabled,8000,'Pubblica attivo').catch(()=>{})
   p=await pub();check(P+' Pubblica nero dopo una modifica',!p.disabled&&p.label==='Pubblica le modifiche'&&/rgb\((10|0|1[0-9]), ?(10|0|1[0-9]), ?(10|0|1[0-9])\)/.test(p.bg),p)
   await shot(page,'dopo-'+P+'-04-pubblica-nero')
   // Pressione lunga 1 s + trascinamento (con la scala): il secondo piatto va prima del primo
   for(let k=0;k<5&&await page.$('dialog[open]');k++){await page.keyboard.press('Escape');await wait(500)}
   const openDlg=!!(await page.$('dialog[open]'));if(openDlg)console.log('dialog ancora aperto');await f.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));await wait(200)
   await f.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await wait(1200);const ids=await f.$$eval('[data-edit-kind="dish"]',els=>els.map(e=>e.getAttribute('data-edit-id')))
   const a=await pagePoint(page,f,`[data-edit-id="${ids[1]}"]`,false),b=await pagePoint(page,f,`[data-edit-id="${ids[0]}"]`,false)
   const callsBefore=H.srv.calls.filter(x=>x.p.endsWith('/ops')).length
   console.log('al punto:',await page.evaluate((x,y)=>{const e=document.elementFromPoint(x,y);return e.tagName+'.'+e.className},a.x,a.y),a);
   await page.touchscreen.touchStart(a.x,a.y);await wait(1150)
   const lifted=await f.evaluate(()=>document.querySelectorAll('[data-menu-gesture-ghost]').length);
   for(let i=1;i<=12;i++){await page.touchscreen.touchMove(a.x,a.y+(b.y-a.y-b.in.h*b.scale*0.9)*i/12);await wait(30)}
   await wait(150);const ghostPos=await f.evaluate(()=>{const g=document.querySelector('[data-menu-gesture-ghost]');if(!g)return null;const r=g.getBoundingClientRect();return {cy:r.top+r.height/2}})
   const fingerY=(await page.$eval('.mw-ed-frame',e=>{const r=e.getBoundingClientRect();return {t:r.top,s:r.width/e.offsetWidth}}))
   await shot(page,'dopo-'+P+'-05-trascina');await page.touchscreen.touchEnd();await wait(1400)
   const fy=(b.y-b.in.h*b.scale*0.9-fingerY.t)/fingerY.s
   check(P+' pressione lunga solleva (ghost)',lifted===1,{lifted})
   check(P+' ghost segue il dito con la scala',ghostPos&&Math.abs(ghostPos.cy-fy)<b.in.h,{ghostPos,fingerInFrame:fy})
   const order=await f.$$eval('[data-edit-kind="dish"]',els=>els.map(e=>e.getAttribute('data-edit-id')))
   const opsAfter=H.srv.calls.filter(x=>x.p.endsWith('/ops')).length
   check(P+' rilascio: ordine cambiato e op inviata',order.indexOf(ids[1])<order.indexOf(ids[0])&&opsAfter>callsBefore,{opsAfter,callsBefore})
   c=await f.evaluate(()=>({ghosts:document.querySelectorAll('[data-menu-gesture-ghost]').length,hidden:[...document.querySelectorAll('[data-edit-id]')].filter(e=>e.style.opacity==='0').length}));check(P+' dopo il rilascio niente ghost/opacità residue',!c.ghosts&&!c.hidden,c)
   // «Fine» → niente selezionato
   const fine=await page.$('button.mw-ed-done');if(fine){await fine.tap();await wait(900)}
   c=await clean(f);check(P+' dopo «Fine» pulito',!!fine&&isClean(c),{fine:!!fine,...c})
   await shot(page,'dopo-'+P+'-06-dopo-fine')
   // Cambio Menu → niente selezionato
   const dish=await pagePoint(page,f,'[data-edit-kind="dish"]');await page.touchscreen.tap(dish.x,dish.y);await wait(400)
   await page.$eval('.mw-menu-picker',b=>b.click());await wait(200);await page.evaluate(()=>{const o=[...document.querySelectorAll('.mw-menu-options button')].find(b=>b.getAttribute('aria-current')!=='true');o?.click()});await wait(1500)
   const f2=await frameOf(page);c=await clean(f2);check(P+' dopo cambio Menu pulito',isClean(c),c)
   await shot(page,'dopo-'+P+'-07-cambio-menu')
   // «Avanzate» → «Torna al menu» intero
   await page.evaluate(()=>[...document.querySelectorAll('button.mw-ed-advanced')].find(b=>/Avanzate/.test(b.textContent))?.click());await wait(900)
   const back=await page.evaluate(()=>{const b=[...document.querySelectorAll('button.mw-ed-advanced')].find(b=>/Torna al menu/.test(b.textContent));if(!b)return null;const r=b.getBoundingClientRect();return {left:r.left,right:r.right,iw:innerWidth,sw:document.documentElement.scrollWidth,ssw:document.querySelector('.screen-scroll').scrollWidth,scw:document.querySelector('.screen-scroll').clientWidth}})
   check(P+' «Torna al menu» intero, niente scroll orizzontale',back&&back.right<=back.iw&&back.left>=0&&back.sw<=back.iw&&back.ssw<=back.scw,back)
   await shot(page,'dopo-'+P+'-08-torna-al-menu')
  }else{
   const lay=await page.evaluate(()=>{const st=document.querySelector('.mw-ed-stage'),fr=document.querySelector('.mw-ed-frame');return {fit:st.classList.contains('is-fit'),transform:fr.style.transform||'',w:fr.getBoundingClientRect().width,sw:st.clientWidth}})
   check(P+' desktop invariato (niente scala)',!lay.fit&&!lay.transform&&Math.abs(lay.w-lay.sw)<1,lay)
   await shot(page,'dopo-1280-01-ingresso')
   const pt=await pagePoint(page,f,'[data-edit-kind="dish"]');await page.mouse.click(pt.x,pt.y);await wait(400)
   const sf=await f.evaluate(()=>!document.querySelector('.tako-edit-frame').classList.contains('tako-edit-hidden'));check(P+' clic → riquadro',sf)
   await page.mouse.click(5,5);await wait(200)
  }
  await page.close()
 }
}catch(e){fails++;results.push({name:'eccezione',ok:false,detail:String(e.stack||e)});console.error(e)}
finally{await writeFile(resolve(OUT,'esito.json'),JSON.stringify({at:new Date().toISOString(),fails,results,errors:H.errors},null,1));await H.close()}
console.log(fails?`ROSSI: ${fails}`:'TUTTO VERDE');process.exit(fails?1:0)
