// 23/10 — «Modello PDF» nella matita del Menu + nota nella scheda PDF. Banco di verify-menu-editor-dashboard.mjs (SPA vera, API finta).
// 1280 e iPhone 390: sezione presente, carica (POST /assets intercettato) → op set menu.paper con zona, miniatura, Rimuovi → paper null;
// scheda PDF con modello: nota, niente «Impaginazione e temi». Nessuna scrittura reale.
import {startHarness,wait,waitFor,U} from './verify-menu-editor-dashboard.mjs'
import {mkdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(repo,'docs/webapp/pdf-modello-2026-10-23/verify');await mkdir(OUT,{recursive:true})
const TEMPLATE=process.argv[2]||'/Users/manuel/Documents/brain/output/takomenu-pdf-template-2026-10-23/victoria-template-menu-cena.png'
const results=[];let fails=0
const check=(name,cond,detail='')=>{results.push({name,ok:!!cond});if(!cond)fails++;console.log(cond?'✓':'✗',name,detail!==''?JSON.stringify(detail).slice(0,300):'')}
const H=await startHarness({shell:true})
const paperOps=()=>H.srv.calls.filter(c=>c.p==='/api/menu-workspace/ops').flatMap(c=>c.b.ops).filter(o=>o.kind==='menu'&&'paper' in (o.fields||{}))
for(const vp of ['desktop','mobile']){
 const page=await H.open(vp);const tag=vp==='mobile'?'390':'1280'
 try{
  await page.setRequestInterception(true)
  page.on('request',r=>{if(r.url().endsWith('/api/menu-workspace/assets')&&r.method()==='POST')return r.respond({status:201,contentType:'application/json',body:JSON.stringify({data:{id:'a1',url:'/uploads/r-prova/modelloProva0001.jpg',name:'modello.jpg',bytes:1000,mime:'image/jpeg'}})});if(r.url().includes('/uploads/r-prova/'))return r.respond({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')});r.continue()})
  await waitFor(()=>page.evaluate(()=>!!document.querySelector('.mw-ed-head button[aria-label^="Cerca"]')),20000,'editor pronto')
  await page.evaluate(()=>document.querySelector('.mw-ed-head button[aria-label^="Cerca"]').click());await wait(300)
  await page.type('.mw-universal-search input','Prezzo fisso');await wait(300);await page.keyboard.press('Enter');await wait(900)
  const box=()=>page.evaluate(()=>{const s=document.querySelector('.mw-ed-popover .mw-paper,.mw-drawer .mw-paper');return s?{text:s.textContent,img:!!s.querySelector('img'),buttons:[...s.querySelectorAll('button')].map(b=>b.textContent)}:null})
  const b0=await box();check(tag+' matita del Menu: sezione «Modello PDF» con «Carica modello»',b0&&/Modello PDF/.test(b0.text)&&b0.buttons.includes('Carica modello'),b0)
  const input=await page.$('.mw-paper input[type=file]');await input.uploadFile(TEMPLATE)
  await waitFor(()=>paperOps().length>0,15000,'op paper').catch(()=>{})
  const op=paperOps().at(-1);check(tag+' caricamento → op set menu.paper (url + zona vuota misurata)',op&&op.id===U(1)&&op.fields.paper?.templateUrl==='/uploads/r-prova/modelloProva0001.jpg'&&op.fields.paper.area&&op.fields.paper.area.top>.15&&op.fields.paper.area.top<.22&&op.fields.paper.area.bottom>.95,op?.fields)
  const up=H.srv.calls.length;await wait(600)
  const b1=await box();check(tag+' dopo il caricamento: miniatura, «Sostituisci» e «Rimuovi»',b1&&b1.img&&b1.buttons.includes('Sostituisci')&&b1.buttons.includes('Rimuovi'),b1)
  await page.screenshot({path:resolve(OUT,tag+'-matita-modello.png')})
  await page.evaluate(()=>[...document.querySelectorAll('.mw-paper button')].find(b=>b.textContent==='Rimuovi').click());await wait(800)
  check(tag+' «Rimuovi» → op paper null',paperOps().at(-1)?.fields.paper===null)
  check(tag+' bozza finale senza modello',H.srv.doc.menus[0].paper===null)
  // Scheda PDF col modello
  H.srv.doc.menus[0].paper={templateUrl:'/uploads/r-prova/modelloProva0001.jpg'};H.srv.revision++
  await page.close()
  const p2=await H.open(vp);await waitFor(()=>p2.evaluate(()=>[...document.querySelectorAll('.mw-studio-sections button')].some(b=>b.textContent==='PDF')),20000,'schede')
  await p2.evaluate(()=>[...document.querySelectorAll('.mw-studio-sections button')].find(b=>b.textContent==='PDF').click());await wait(1200)
  const pdfTab=await p2.evaluate(()=>{const e=document.querySelector('.mw-pdf-editor');return e?{text:e.textContent,impag:[...e.querySelectorAll('button')].some(b=>/Impaginazione e temi/.test(b.textContent)),align:!!e.querySelector('select[aria-label="Allineamento testi PDF"]')}:null})
  check(tag+' scheda PDF con modello: nota «Modello PDF», niente impaginazione/allineamento',pdfTab&&/Modello PDF/.test(pdfTab.text)&&!pdfTab.impag&&!pdfTab.align,pdfTab&&{impag:pdfTab.impag,align:pdfTab.align})
  check(tag+' anteprima PDF chiesta per il Menu col modello',H.srv.pdf.some(x=>x.menuIds?.[0]===U(1)))
  await p2.screenshot({path:resolve(OUT,tag+'-scheda-pdf.png')});await p2.close()
  H.srv.doc.menus[0].paper=null;H.srv.calls.length=0
 }catch(e){check(tag+' eccezione',false,e.message)}
}
check('nessun errore console',H.errors.length===0,H.errors)
await H.close()
console.log(`${results.length-fails}/${results.length}`);process.exit(fails?1:0)
