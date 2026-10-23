// 23/10 — Menu → Piatti: selettore «Telefono / PDF» + «Stampa». Banco di verify-menu-editor-dashboard.mjs (SPA vera, API finta, nessuna scrittura reale).
// 1280 + iPhone 390/430 (DPR 3, touch): pillola che scivola (transform campionato a metà), PDF pubblicato del Menu giusto al cambio di «Menu ▾»,
// Stampa visibile solo in PDF, riga su una linea senza scroll orizzontale, flusso «modifiche non pubblicate», ritorno all'editor, console pulita.
import {startHarness,wait,waitFor,U} from './verify-menu-editor-dashboard.mjs'
import {mkdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(repo,'docs/webapp/pdf-modello-2026-10-23/toggle');await mkdir(OUT,{recursive:true})
const results=[];let fails=0
const check=(name,cond,detail='')=>{results.push({name,ok:!!cond});if(!cond)fails++;console.log(cond?'✓':'✗',name,detail!==''?JSON.stringify(detail).slice(0,300):'')}
const H=await startHarness({shell:true})
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
async function open(w){
 const page=await H.open(w===1280?'desktop':'mobile')
 if(w!==1280){await page.emulate({viewport:{width:w,height:w===430?932:844,deviceScaleFactor:3,isMobile:true,hasTouch:true},userAgent:UA})}
 // Stampa senza dialoghi veri: share/print registrati.
 await page.evaluateOnNewDocument(()=>{window.__shared=[];navigator.canShare=()=>true;navigator.share=d=>{window.__shared.push({n:d.files?.length,type:d.files?.[0]?.type,name:d.files?.[0]?.name});return Promise.resolve()};window.open=(u)=>{(window.__opened=window.__opened||[]).push(u);return {}}})
 await page.reload();await page.evaluate(()=>window.__mount())
 await waitFor(()=>page.evaluate(()=>!!document.querySelector('.mw-view-switch')&&!!document.querySelector('.mw-ed-stage')),20000,'selettore')
 return page
}
const tx=page=>page.evaluate(()=>{const t=document.querySelector('.mw-view-switch .mw-tab-thumb');const m=getComputedStyle(t).transform;return m==='none'?0:new DOMMatrixReadOnly(m).m41})
const tap=(page,sel)=>page.evaluate(s=>document.querySelector(s).click(),sel)
const btnText=(page,text,scope='dialog[open]')=>page.evaluate((t,s)=>{const b=[...document.querySelectorAll(s+' button')].find(x=>x.textContent.trim()===t);if(!b)return false;b.click();return true},text,scope)
const printVis=page=>page.evaluate(()=>{const b=document.querySelector('.mw-print-btn'),c=getComputedStyle(b);return {op:+c.opacity,vis:c.visibility,inert:b.inert,disabled:b.disabled}})
const lastPdf=()=>H.srv.pdf.at(-1)
const printed=(page,mobile)=>page.evaluate(m=>m?window.__shared.length:document.querySelectorAll('iframe.mw-print-frame').length,mobile)
for(const w of [1280,390,430]){
 const tag=String(w),mobile=w!==1280
 Object.assign(H.srv,{revision:3,publishedRevision:3});H.srv.doc=JSON.parse(JSON.stringify(H.srv.published));H.srv.pdf.length=0
 let page
 try{
  page=await open(w)
  await wait(800)
  // Riga su una linea, a destra di Menu ▾ · Preset ▾, nessuno scroll orizzontale.
  const row=await page.evaluate(()=>{const bar=document.querySelector('.mw-studio-toolbar'),kids=[...bar.children].filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none');const r=e=>e.getBoundingClientRect();const pick=r(document.querySelector('.mw-menu-picker')),sw=r(document.querySelector('.mw-view-switch')),pr=r(document.querySelector('.mw-print-btn')),dp=document.querySelector('.mw-dp-btn');
   const mids=kids.map(k=>Math.round(r(k).top+r(k).height/2));return {mids,one:Math.max(...mids)-Math.min(...mids)<=2,right:sw.left>pick.right&&(!dp||sw.left>r(dp).right),inside:pr.right<=innerWidth-8,scroll:document.documentElement.scrollWidth<=innerWidth,labels:[...document.querySelectorAll('.mw-view-switch button')].map(b=>b.textContent)}})
  check(tag+' riga Menu ▾ · Preset ▾ · Telefono/PDF · Stampa su una linea',row.one&&row.right&&row.inside,row)
  check(tag+' nessuno scroll orizzontale',row.scroll)
  const p0=await printVis(page);check(tag+' Telefono (predefinito): Stampa nascosta e inerte',p0.op===0&&p0.vis==='hidden'&&p0.inert,p0)
  check(tag+' Telefono: editor visibile',await page.evaluate(()=>document.querySelector('.mw-ed-stage').getBoundingClientRect().height>200))
  // Pillola: campiona il transform a metà corsa.
  // Campioni ogni ~16 ms (timer: il rAF headless a DPR 3 è troppo rado) per 700 ms dopo il tocco: almeno uno a metà corsa (né inizio né fine) = scivola, non salta.
  const x0=await tx(page)
  const samples=await page.evaluate(()=>new Promise(done=>{const t=document.querySelector('.mw-view-switch .mw-tab-thumb'),out=[],t0=performance.now();document.querySelector('.mw-view-switch button[aria-label="PDF"]').click();const f=()=>{const m=getComputedStyle(t).transform;out.push([Math.round(performance.now()-t0),m==='none'?0:new DOMMatrixReadOnly(m).m41]);if(performance.now()-t0<700)setTimeout(f,16);else done(out)};setTimeout(f,0)}))
  const x1=samples.at(-1)[1],mid=samples.filter(([,x])=>x>x0+(x1-x0)*0.2&&x<x0+(x1-x0)*0.8)
  check(tag+' pillola scivola (transform campionato a metà corsa)',x1>x0+10&&mid.length>0,{x0,x1,mid:mid.slice(0,3),s:samples.slice(0,8)})
  await waitFor(()=>page.evaluate(()=>!!document.querySelector('.mw-pdf-view .mw-pdf-viewer canvas')),15000,'PDF visibile').catch(()=>{})
  const v=await page.evaluate(()=>({viewer:!!document.querySelector('.mw-pdf-view .mw-pdf-viewer canvas'),stageH:document.querySelector('.mw-ed-stage').getBoundingClientRect().height,note:!!document.querySelector('.mw-pdf-view-note')}))
  check(tag+' PDF: visualizzatore al centro, editor nascosto, nessuna nota (niente bozza)',v.viewer&&v.stageH===0&&!v.note,v)
  check(tag+' PDF del pubblicato del Menu selezionato (Menu pranzo)',lastPdf()?.preview===false&&lastPdf()?.menuIds?.[0]===U(1),lastPdf())
  await wait(250);const p1=await printVis(page);check(tag+' PDF: Stampa visibile e attiva',p1.op===1&&p1.vis==='visible'&&!p1.inert&&!p1.disabled,p1)
  await page.screenshot({path:resolve(OUT,tag+'-pdf.png')})
  // Cambio Menu ▾ → Menu cena.
  await tap(page,'.mw-menu-picker');await wait(250);await page.evaluate(()=>[...document.querySelectorAll('.mw-menu-options button')].find(b=>b.textContent==='Menu cena').click())
  await waitFor(()=>lastPdf()?.menuIds?.[0]===U(2),8000,'PDF menu cena').catch(()=>{})
  await waitFor(()=>page.evaluate(()=>!!document.querySelector('.mw-pdf-view .mw-pdf-viewer canvas')),10000,'viewer cena').catch(()=>{})
  check(tag+' cambio «Menu ▾» → PDF di «Menu cena»',lastPdf()?.menuIds?.[0]===U(2)&&lastPdf()?.preview===false&&await page.evaluate(()=>/Menu cena/.test(document.querySelector('.mw-menu-picker').textContent)))
  // Stampa senza bozza: subito.
  await tap(page,'.mw-print-btn');await wait(500)
  check(tag+(mobile?' Stampa → foglio di condivisione con il PDF (AirPrint)':' Stampa → iframe di stampa col PDF'),mobile?(await page.evaluate(()=>window.__shared[0]?.type))==='application/pdf':(await printed(page,false))===1)
  // Ritorno a Telefono: editor ancora montato.
  await tap(page,'.mw-view-switch button[aria-label="Telefono"]');await wait(450)
  const back=await page.evaluate(()=>({stageH:document.querySelector('.mw-ed-stage').getBoundingClientRect().height,pdf:!!document.querySelector('.mw-tab-panel:not(.mw-panel-ghost)>.mw-pdf-view'),frame:!!document.querySelector('.mw-ed-stage iframe')}))
  const p2=await printVis(page);check(tag+' ritorno a Telefono: editor visibile (iframe conservato), PDF tolto, Stampa nascosta',back.stageH>200&&!back.pdf&&back.frame&&p2.op===0,{...back,...p2})
  await page.screenshot({path:resolve(OUT,tag+'-telefono.png')})
  await page.close()
  // ── Modifiche non pubblicate ──
  H.srv.doc.menus[0].sections[0].items[0].name='Pasta al pomodoro '+tag;H.srv.revision++
  page=await open(w);await wait(600)
  await tap(page,'.mw-view-switch button[aria-label="PDF"]')
  await waitFor(()=>page.evaluate(()=>!!document.querySelector('.mw-pdf-view .mw-pdf-viewer canvas')),15000,'PDF').catch(()=>{})
  const note=await page.evaluate(()=>document.querySelector('.mw-pdf-view-note')?.textContent||'')
  check(tag+' bozza: riga «modifiche non pubblicate: il PDF mostra il menu online»',/modifiche non pubblicate: il PDF mostra il menu online/.test(note),note)
  check(tag+' bozza: il PDF mostrato è il pubblicato',lastPdf()?.preview===false&&lastPdf()?.publishedRevision===3)
  await page.screenshot({path:resolve(OUT,tag+'-bozza.png')})
  await tap(page,'.mw-print-btn');await wait(400)
  const dl=await page.evaluate(()=>[...document.querySelectorAll('dialog.mw-print-dialog[open] button')].map(b=>b.textContent.trim()))
  check(tag+' Stampa con bozza → dialogo Pubblica e stampa / Stampa com’è / Annulla',['Pubblica e stampa','Stampa com’è','Annulla'].every(t=>dl.includes(t)),dl)
  await page.screenshot({path:resolve(OUT,tag+'-dialogo.png')})
  await btnText(page,'Annulla');await wait(300)
  check(tag+' Annulla: nessuna stampa',(await printed(page,mobile))===0&&!(await page.$('dialog.mw-print-dialog[open]')))
  await tap(page,'.mw-print-btn');await wait(300);await btnText(page,'Stampa com’è');await wait(500)
  check(tag+' Stampa com’è → stampa il pubblicato',(await printed(page,mobile))===1)
  await tap(page,'.mw-print-btn');await wait(300);await btnText(page,'Pubblica e stampa')
  await page.waitForSelector('dialog.mw-ed-publish[open] .mw-diff',{timeout:8000}).catch(()=>{})
  await btnText(page,'Pubblica ora','dialog.mw-ed-publish[open]')
  await waitFor(()=>JSON.stringify(H.srv.doc)===JSON.stringify(H.srv.published),8000,'pubblicato').catch(()=>{})
  check(tag+' Pubblica e stampa → usa il Pubblica esistente (menu pubblicato)',JSON.stringify(H.srv.doc)===JSON.stringify(H.srv.published))
  await waitFor(()=>lastPdf()?.publishedRevision===H.srv.publishedRevision&&H.srv.publishedRevision>3,10000,'PDF nuovo').catch(()=>{})
  if(mobile){await page.waitForSelector('dialog.mw-print-dialog[open]',{timeout:8000}).catch(()=>{});const t=await page.evaluate(()=>document.querySelector('dialog.mw-print-dialog[open] h3')?.textContent||'');check(tag+' dopo Pubblica: «PDF aggiornato pronto» (nuovo tocco per il foglio iOS)',/PDF aggiornato pronto/.test(t),t);await btnText(page,'Stampa');await wait(400)}
  else await waitFor(()=>printed(page,false).then(n=>n===1),8000,'stampa').catch(()=>{})
  const shot=mobile?await page.evaluate(()=>window.__shared.length):await page.evaluate(()=>document.querySelectorAll('iframe.mw-print-frame').length)
  check(tag+' dopo Pubblica: stampa del PDF nuovo',lastPdf()?.publishedRevision===H.srv.publishedRevision&&(mobile?shot===2:shot===1),{last:lastPdf(),pub:H.srv.publishedRevision,shot})
  check(tag+' dopo Pubblica: riga bozza sparita',!(await page.$('.mw-pdf-view-note')))
  await page.close()
 }catch(e){check(tag+' eccezione',false,e.message);await page?.close().catch(()=>{})}
}
// Movimento ridotto: niente transizioni sulla pillola.
{const page=await open(1280);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);const t=await page.evaluate(()=>getComputedStyle(document.querySelector('.mw-view-switch .mw-tab-thumb')).transitionDuration);check('reduced motion: pillola senza transizione',/^0s/.test(t),t);await page.close()}
// Sotto 390 px: icone al posto del testo, sempre una riga.
{const page=await open(375);const r=await page.evaluate(()=>({label:getComputedStyle(document.querySelector('.mw-view-label')).display,svg:getComputedStyle(document.querySelector('.mw-view-switch svg')).display,scroll:document.documentElement.scrollWidth<=innerWidth}));check('375: icone al posto del testo, nessuno scroll',r.label==='none'&&r.svg==='block'&&r.scroll,r);await page.screenshot({path:resolve(OUT,'375-telefono.png')});await page.close()}
check('nessun errore console',H.errors.length===0,H.errors)
await H.close()
console.log(`${results.length-fails}/${results.length}`);process.exit(fails?1:0)
