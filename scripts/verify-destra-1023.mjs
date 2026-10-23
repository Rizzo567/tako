// 23/10 — colonna destra su computer = «Anteprima mobile» (iPhone con la BOZZA, live), niente PDF; Menu ▾ / Preset ▾ larghi quanto il testo.
// Banco di verify-menu-editor-dashboard.mjs (SPA vera, renderer vero, API finta: nessuna scrittura reale). 1280, 1440, iPhone 390 DPR 3.
import {startHarness,wait,waitFor,U,fixture} from './verify-menu-editor-dashboard.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(repo,'docs/webapp/dashboard-editor-2026-10-22/destra-1023')
await mkdir(OUT,{recursive:true});process.env.PATH='/opt/homebrew/bin:'+process.env.PATH
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const results=[];let fails=0
const check=(name,cond,detail='')=>{results.push({name,ok:!!cond,detail});if(!cond)fails++;console.log(cond?'✓':'✗',name,detail!==''?JSON.stringify(detail):'')}
const H=await startHarness({shell:true})
const reset=(long)=>{const d=fixture();if(long)d.menus[0].name='Menu degustazione del fine settimana con abbinamento vini';Object.assign(H.srv,{doc:d,published:fixture(),revision:3,publishedRevision:3,fail:[],offline:false,flag:true,botConflicts:[]})}
const stageFrame=page=>waitFor(()=>page.frames().find(x=>x.url().includes('/menu-preview/')&&x.url().includes('edit=1')),15000,'iframe editor')
const phoneFrame=page=>waitFor(()=>page.frames().find(x=>x.url().includes('/menu-preview/')&&!x.url().includes('edit=1')),15000,'iframe anteprima mobile')
const toolbar=page=>page.evaluate(()=>{const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return{l:Math.round(b.left),r:Math.round(b.right),w:Math.round(b.width)}};const tb=document.querySelector('.mw-studio-toolbar'),mp=document.querySelector('.mw-menu-picker'),sp=mp?.querySelector('span'),dp=document.querySelector('.mw-dp-btn'),dl=dp?.querySelector('.mw-dp-label'),buttons=[...document.querySelectorAll('.mw-studio-toolbar .mw-studio-toolbuttons button')].filter(b=>b.offsetWidth);
 return{tb:r(tb),mp:r(mp),mpText:sp?.textContent,mpTextW:sp?Math.round(sp.scrollWidth):0,mpClipped:sp?sp.scrollWidth>sp.clientWidth+1:false,mpOverflow:sp?getComputedStyle(sp).textOverflow:'',dp:r(dp),dpText:dl?.textContent,dpTextW:dl?Math.round(dl.scrollWidth):0,lastRight:Math.max(r(mp)?.r||0,r(dp)?.r||0,...buttons.map(b=>Math.round(b.getBoundingClientRect().right))),sections:[...document.querySelectorAll('.mw-studio-sections>button')].map(b=>b.textContent)}})

async function desktop(width){
 reset(false);const errs=[],tag=String(width)
 const page=await H.browser.newPage()
 page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|favicon|ERR_|net::/.test(m.text()))errs.push(m.text())})
 page.on('dialog',d=>d.accept())
 await page.setViewport({width,height:900,deviceScaleFactor:1})
 const cdp=await page.createCDPSession();await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true}).catch(()=>{})
 await page.goto(H.base);await page.evaluate(()=>window.__mount());await page.waitForSelector('.mw-ed-stage')
 try{
  const f=await stageFrame(page);await f.waitForSelector('[data-menu-edit-root] [data-edit-id]',{timeout:20000})
  const pf=await phoneFrame(page);await pf.waitForFunction(()=>document.body.textContent.includes('Pasta al pomodoro'),{timeout:20000});await wait(900)
  const right=await page.evaluate(()=>{const a=document.querySelector('aside.mw-right-glass');const ph=a?.querySelector('.mw-right-phone');const b=ph?.querySelector('.mw-phone')?.getBoundingClientRect();return{exists:!!a,title:ph?.querySelector('.mw-row strong')?.textContent,phone:!!ph?.querySelector('.mw-phone iframe'),pdf:!!a?.querySelector('.mw-ed-pdf,.mw-right-pdf canvas,.mw-pdf-viewer'),pdfText:/PDF/.test(a?.innerText||''),tabs:!!a?.querySelector('.mw-tabs'),menuWord:[...(a?.querySelectorAll('button')||[])].map(x=>x.textContent),phoneW:b?Math.round(b.width):0,phoneH:b?Math.round(b.height):0}})
  check(`${tag} colonna destra: iPhone con titolo «Anteprima mobile»`,right.exists&&right.title==='Anteprima mobile'&&right.phone&&right.phoneW>250,right)
  check(`${tag} colonna destra: nessun PDF, niente selettore «Menu/PDF»`,!right.pdf&&!right.pdfText&&!right.tabs&&right.menuWord.length===0,right)
  check(`${tag} PDF pubblicato non richiesto`,!H.srv.pdf.some(p=>p.preview===false),H.srv.pdf)
  await page.screenshot({path:resolve(OUT,`${tag}-01-anteprima-mobile.png`)})
  // Bozza live: modifica solo la bozza lato server (pubblicato invariato) → l'iPhone la mostra.
  H.srv.applyOps([{op:'set',kind:'item',id:U(100),fields:{name:'Pasta bozza nuova'}}])
  const live=await pf.waitForFunction(()=>document.body.textContent.includes('Pasta bozza nuova'),{timeout:20000}).then(()=>true,()=>false)
  check(`${tag} l’iPhone mostra la BOZZA aggiornata live (non il pubblicato)`,live&&!JSON.stringify(H.srv.published).includes('Pasta bozza nuova'))
  const badge=await page.evaluate(()=>document.querySelector('.mw-right-phone .mw-row')?.innerText)
  check(`${tag} etichetta «Da pubblicare» accanto al titolo`,/Da pubblicare/.test(badge||''),badge)
  await page.screenshot({path:resolve(OUT,`${tag}-02-bozza-live.png`)})
  const t=await toolbar(page)
  check(`${tag} Menu ▾ largo quanto il nome (+ freccia)`,t.mp&&!t.mpClipped&&t.mp.w<=t.mpTextW+60&&t.mp.w>=t.mpTextW+16,t)
  check(`${tag} Preset ▾ largo quanto il testo`,!t.dp||(t.dp.w<=t.dpTextW+60&&t.dp.w>=t.dpTextW+16),t)
  check(`${tag} spazio libero a destra della riga`,t.tb&&t.tb.r-t.lastRight>=Math.min(200,t.tb.w*.3),{free:t.tb.r-t.lastRight,...t})
  check(`${tag} voci Piatti/Aspetto/Condividi/PDF`,JSON.stringify(t.sections)===JSON.stringify(['Piatti','Aspetto','Condividi','PDF']),t.sections)
  check(`${tag} editor invariato (iframe con menu modificabile)`,await f.evaluate(()=>document.querySelectorAll('[data-edit-id]').length>5))
  check(`${tag} nessuno scroll orizzontale`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth))
  // Aspetto: anche qui la colonna è «Anteprima mobile».
  await page.evaluate(()=>[...document.querySelectorAll('.mw-studio-sections>button')].find(b=>b.textContent==='Aspetto').click());await wait(1200)
  const asp=await page.evaluate(()=>{const a=document.querySelector('aside.mw-right-glass');return{title:a?.querySelector('.mw-right-phone .mw-row strong')?.textContent,tabs:!!a?.querySelector('.mw-tabs')}})
  check(`${tag} Aspetto: colonna destra «Anteprima mobile», senza «Menu/PDF»`,asp.title==='Anteprima mobile'&&!asp.tabs,asp)
  await page.screenshot({path:resolve(OUT,`${tag}-03-aspetto.png`)})
  // Scheda PDF (unico posto del PDF su computer).
  await page.evaluate(()=>[...document.querySelectorAll('.mw-studio-sections>button')].find(b=>b.textContent==='PDF').click());await wait(2500)
  const pdfTab=await page.evaluate(()=>{const h=document.querySelector('.mw-right-pdf');return{visible:!!h&&getComputedStyle(h).display!=='none'&&h.getBoundingClientRect().height>100,phone:!!document.querySelector('aside .mw-right-phone')}})
  check(`${tag} scheda PDF: anteprima PDF a destra`,pdfTab.visible&&!pdfTab.phone,pdfTab)
  await page.screenshot({path:resolve(OUT,`${tag}-04-scheda-pdf.png`)})
 }catch(e){check(`${tag} eccezione`,false,e.message)}
 check(`${tag} nessun errore console`,errs.length===0,errs)
 await page.close()
}

async function phone(long){
 reset(long);const errs=[],tag='390'+(long?'-nome-lungo':'')
 const page=await H.browser.newPage()
 page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|favicon|ERR_|net::/.test(m.text()))errs.push(m.text())})
 page.on('dialog',d=>d.accept())
 await page.emulate({viewport:{width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true},userAgent:UA})
 await page.goto(H.base);await page.evaluate(()=>window.__mount());await page.waitForSelector('.mw-ed-stage')
 try{
  const f=await stageFrame(page);await f.waitForSelector('[data-menu-edit-root] [data-edit-id]',{timeout:20000});await wait(1200)
  check(`${tag} niente colonna destra né secondo iframe`,await page.evaluate(()=>!document.querySelector('aside.mw-right-glass')&&document.querySelectorAll('iframe').length===1))
  const t=await toolbar(page)
  if(long)check(`${tag} Menu ▾ con nome lungo: tetto + ellissi, riga non sfora`,t.mp.w<=t.tb.w*.53+1&&t.mpClipped&&t.mpOverflow==='ellipsis'&&t.lastRight<=t.tb.r,t)
  else check(`${tag} Menu ▾ largo quanto il nome (+ freccia)`,!t.mpClipped&&t.mp.w<=t.mpTextW+50&&t.mp.w>=t.mpTextW+12,t)
  check(`${tag} Preset ▾ largo quanto il testo`,!t.dp||(t.dp.w<=t.dpTextW+50&&!long?t.dp.w>=t.dpTextW+12:true),t)
  if(!long)check(`${tag} spazio libero a destra della riga`,t.tb.r-t.lastRight>=80,{free:t.tb.r-t.lastRight,...t})
  check(`${tag} editor invariato`,await f.evaluate(()=>document.querySelectorAll('[data-edit-id]').length>5))
  check(`${tag} nessuno scroll orizzontale`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth))
  await page.screenshot({path:resolve(OUT,`${tag}-01-riga-menu-preset.png`)})
 }catch(e){check(`${tag} eccezione`,false,e.message)}
 check(`${tag} nessun errore console`,errs.length===0,errs)
 await page.close()
}
try{await desktop(1280);await desktop(1440);await phone(false);await phone(true)}
finally{await writeFile(resolve(OUT,'esito.json'),JSON.stringify({fails,results},null,1));await H.close?.().catch(()=>{})}
console.log(fails?`✗ ${fails} falliti`:'✓ tutto verde');process.exit(fails?1:0)
