// 21/10: QA visivo del Menu «a prezzo fisso» e dei PDF multipli nella dashboard (CONTRATTO docs/webapp/menu-prezzo-fisso-2026-10-21 §3, §7).
// Componenti VERI della dashboard (ScreenMenuWorkspace con l'adattatore vero), ruolo TITOLARE (owner), API finta in memoria che imita
// /api/menu-workspace e /api/menu-workspace/pdf-documents (§7). L'anteprima cliente è il renderer VERO di apps/web (MenuPreview) compilato
// con esbuild + Tailwind. Chrome headless: nessuna finestra. Nessun DB, nessun login, nessun deploy.
// Uscita: docs/webapp/menu-prezzo-fisso-2026-10-21/screenshot-dashboard/*.png + verifica.json
import puppeteer from 'puppeteer-core'
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises'
import {resolve,extname,join} from 'node:path'
import {tmpdir} from 'node:os'
import {createServer} from 'node:http'
import {execFileSync} from 'node:child_process'
import {transform,build} from 'esbuild'
import assert from 'node:assert/strict'

const repo=process.cwd(),root=resolve('apps/dashboard/public/staff'),out=resolve('docs/webapp/menu-prezzo-fisso-2026-10-21/screenshot-dashboard');await mkdir(out,{recursive:true})
// Sorgenti nello stesso ordine di index.html, senza la radice dell'app (login, socket, navigazione).
const index=await readFile(resolve(root,'index.html'),'utf8')
const files=[...index.matchAll(/type="text\/babel" src="src\/([^"]+)"/g)].map(m=>m[1]).filter(f=>!['07-app-root.js','12-login-gate.js','20-agency-dashboard.js','21-agency-leads.js'].includes(f))
const source=(await Promise.all(files.map(f=>readFile(resolve(root,'src',f),'utf8')))).join('\n')

// Anteprima cliente vera (apps/web): MenuPreview → WorkspaceMenuRenderer.
const tmp=await mkdtemp(join(tmpdir(),'tako-fixed-preview-'))
await writeFile(join(tmp,'entry.tsx'),`import {createRoot} from 'react-dom/client'\nimport {MenuPreview} from '@/components/MenuPreview'\ncreateRoot(document.getElementById('root')!).render(<MenuPreview menuId={location.pathname.split('/').pop()||''}/>)\n`)
await build({entryPoints:[join(tmp,'entry.tsx')],bundle:true,outdir:join(tmp,'preview'),format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css','.png':'dataurl','.svg':'dataurl','.woff2':'file','.woff':'file','.ttf':'file'},external:['/takomenu-public/*','/assets/*','/fonts/*'],alias:{'@':resolve(repo,'apps/web/src'),'@tako/types':resolve(repo,'packages/types/src/index.ts')},define:{'process.env.NODE_ENV':'"production"'},nodePaths:[resolve(repo,'apps/web/node_modules'),resolve(repo,'node_modules')],logLevel:'error'})
execFileSync(resolve(repo,'apps/web/node_modules/.bin/tailwindcss'),['-c','tailwind.config.ts','-i','src/app/globals.css','-o',join(tmp,'preview/tw.css')],{cwd:resolve(repo,'apps/web'),stdio:'ignore'})

const U=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const item=(n,name,price,extra={})=>({id:U(n),name,description:null,price,imageUrl:null,allergens:[],tags:[],additives:[],available:true,hidden:false,featured:false,displayMode:'normal',variants:[],translations:{},...extra})
const section=(n,name,items)=>({id:U(n),parentSectionId:null,name,description:null,active:true,translations:{},items})
const pdf={format:'A4',orientation:'portrait',columns:1,margin:36,fontSize:11,showCover:false,showImages:false,showPrices:true,showDescriptions:true,showAllergens:true,showPageNumbers:true,showQr:true,footer:'',font:'sans',alignment:'left',categoryPageBreak:false,background:'#ffffff',textColor:'#242628',headingColor:'#ed725b',nameBold:true,descriptionItalic:false,headingFontSize:18,showLogo:true,logoShape:'rounded',showFoodLegends:true,showMenuName:true,showDate:false,includeUnavailable:false,translationPolicy:'fallback',translationNamesPolicy:'all',verticalCentered:false,backgroundImageUrl:null,backgroundOpacity:1,backgroundSize:'cover',logoBackground:null}
const design={preset:'tako',font:'sans',layout:'list',background:'#f8f5ef',text:'#242628',primary:'#ed725b',categoryBackground:'#242628',categoryText:'#ffffff',fontSize:16,spacing:16,imageShape:'rounded',showImages:true,showPrices:true,showDescriptions:true,showAllergens:true,headerTitle:'Trattoria Prova',headerDescription:'',logoUrl:null,coverUrl:null,links:[],navigation:'tabs',standard:{},centered:{},link:{}}
const fixture={schemaVersion:1,languages:['it'],defaultLanguage:'it',translationSettings:{protectedNames:[],glossary:[]},foodTranslations:{},design,pdf,pdfPresets:[],menus:[
 {id:U(1),name:'Menu pranzo',description:null,type:'lunch',active:true,translations:{},sections:[
  section(10,'Primi',[item(100,'Pasta al pomodoro',9,{description:'Pomodoro fresco e basilico',allergens:['glutine']}),item(101,'Risotto ai funghi',12,{description:'Porcini',hidden:true}),item(102,'Lasagna',11,{allergens:['latte','glutine']})]),
  section(11,'Secondi',[item(110,'Pollo arrosto',14),item(111,'Cotoletta',15,{allergens:['glutine','uova']})]),
  section(12,'Contorni',[item(120,'Patate al forno',4),item(121,'Insalata mista',4)])]},
 {id:U(2),name:'Menu cena',description:null,type:'dinner',active:true,translations:{},sections:[section(20,'Pizze',[item(200,'Margherita',7),item(201,'Diavola',8)])]}]}

// API finta: stesse forme del server (workspace + documenti PDF §7). Stato per pagina (window.__srv).
const fake=`
window.__takoRole='owner';window.__takoRestaurantId='r-prova';window.__takoUser={restaurantName:'Trattoria Prova'};
window.__srv={doc:${JSON.stringify(fixture)},revision:1,published:1,documents:[],calls:[],tokenSeq:0};
const __json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const __pdfBytes=()=>{const o=['%PDF-1.4\\n'],x=[];const add=s=>{x.push(o.join('').length);o.push(s)};add('1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\\n');add('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\\n');add('3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\\n');const start=o.join('').length;o.push('xref\\n0 4\\n0000000000 65535 f \\n'+x.map(n=>String(n).padStart(10,'0')+' 00000 n \\n').join('')+'trailer<</Size 4/Root 1 0 R>>\\nstartxref\\n'+start+'\\n%%EOF');return new Blob([o.join('')],{type:'application/pdf'})};
const __uuid=()=>crypto.randomUUID();
const __defaultDoc=()=>({name:'PDF predefinito',menuIds:window.__srv.doc.menus.filter(m=>m.active!==false).map(m=>m.id)});
window.fetch=async(url,opt={})=>{const u=new URL(url,location.origin),m=opt.method||'GET',S=window.__srv,p=u.pathname;S.calls.push(m+' '+p);await new Promise(r=>setTimeout(r,40));
 const body=opt.body&&typeof opt.body==='string'?JSON.parse(opt.body):null;
 if(p==='/api/menu-workspace'&&m==='GET')return __json({data:S.doc,revision:S.revision,publishedRevision:S.published});
 if(p==='/api/menu-workspace'&&m==='PUT'){if(body.expectedRevision!==S.revision)return __json({error:{message:'Conflitto'}},409);S.doc=body.workspace;S.revision++;return __json({data:S.doc,revision:S.revision})}
 if(p==='/api/menu-workspace/versions')return __json({data:[{id:'v'+S.revision,revision:S.revision,createdAt:new Date().toISOString()}]});
 if(p==='/api/menu-workspace/qr')return fetch('/staff/assets/takos/arancione/logo-chef.png');
 if(p==='/api/menu-workspace/pdf')return new Response(__pdfBytes());
 if(['/api/menu-workspace/catalogs','/api/menu-workspace/presets','/api/menu-workspace/assets'].includes(p))return __json({data:[]});
 if(p==='/api/menu-workspace/pdf-documents'&&m==='GET')return __json({data:{documents:S.documents,default:__defaultDoc()}});
 if(p==='/api/menu-workspace/pdf-documents'&&m==='PUT'){const prev=new Map(S.documents.map(d=>[d.id,d]));S.lastPut=body;S.documents=body.documents.map(d=>({id:d.id||__uuid(),name:d.name,menuIds:d.menuIds,...(d.config?{config:d.config}:{}),shareToken:prev.get(d.id)?.shareToken??null,updatedAt:new Date().toISOString()}));return __json({data:{documents:S.documents,default:__defaultDoc()}})}
 const link=p.match(/^\\/api\\/menu-workspace\\/pdf-documents\\/([^/]+)\\/(link|pdf)$/);
 if(link){const d=S.documents.find(x=>x.id===link[1]);if(!d)return __json({error:{message:'PDF non trovato'}},404);
  if(link[2]==='pdf')return new Response(__pdfBytes());
  if(m==='POST'){d.shareToken='tk'+(++S.tokenSeq)+'a8f3c91d2b7e4f60a1c5d9e8b3f27a6c';return __json({data:d})}
  if(m==='DELETE'){d.shareToken=null;return __json({data:d})}}
 return __json({error:{message:'Non previsto: '+m+' '+p}},404)};
`
const mount=`
const __mobile=innerWidth<720;
function __Harness(){return <div className={'screen app-live'+(__mobile?' mobile':'')} style={{width:'100%',height:'100dvh',display:'flex',flexDirection:'column',background:'var(--surface)'}}><ScreenMenuWorkspace mobile={__mobile}/><Toaster mobile={__mobile}/></div>}
window.__mount=()=>ReactDOM.createRoot(document.getElementById('root')).render(<__Harness/>);
`
const compiled=(await transform(fake+source+'\n'+mount,{loader:'jsx',format:'iife'})).code
const css=[...index.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1])
const html=`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${css.map(f=>`<link rel="stylesheet" href="/staff/${f}">`).join('')}<body style="margin:0"><div id="root"></div><script src="/staff/lib/react.js"></script><script src="/staff/lib/react-dom.js"></script><script src="/fixture.js"></script></body></html>`
const previewHtml=`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/preview/tw.css"><link rel="stylesheet" href="/preview/entry.css"><body><div id="root"></div><script src="/preview/entry.js"></script></body></html>`
const types={'.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.mjs':'text/javascript'}
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return}
 if(path==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled);return}
 if(path.startsWith('/menu-preview/')){res.setHeader('Content-Type','text/html');res.end(previewHtml);return}
 if(path==='/api/menu-workspace/presentation'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{restaurantName:'Trattoria Prova'}}));return}
 if(path.startsWith('/preview/')){const file=join(tmp,path);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));return}
 const rel=path.startsWith('/staff/')?path.slice(6):path;const file=resolve(root,'.'+decodeURIComponent(rel));if(!file.startsWith(root+'/'))throw Error('Invalid path')
 res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.statusCode=404;res.end()}})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const base=`http://127.0.0.1:${server.address().port}/`
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox','--hide-scrollbars']})
await browser.defaultBrowserContext().overridePermissions(new URL(base).origin,['clipboard-read','clipboard-write','clipboard-sanitized-write'])
const viewports={desktop:{width:1280,height:900,deviceScaleFactor:1},mobile:{width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true}}
const results=[],errors=[],shots=[]
const wait=ms=>new Promise(r=>setTimeout(r,ms))
async function open(vp){const page=await browser.newPage();page.on('pageerror',e=>errors.push(vp+': '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|favicon/.test(m.text()))errors.push(vp+' console: '+m.text())})
 await page.setViewport(viewports[vp]);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
 await page.goto(base);await page.evaluate(()=>window.__mount());await page.waitForSelector('.mw-catalog-list');await wait(300);return page}
const click=async(page,text,scope='body')=>{const ok=await page.evaluate((t,s)=>{const el=[...document.querySelectorAll(s+' button, '+s+' [role=radio]')].find(b=>b.offsetParent!==null&&(b.textContent.trim()===t||b.getAttribute('aria-label')===t));if(!el)return false;el.scrollIntoView({block:'center'});el.focus();el.click();return true},text,scope);assert.ok(ok,'pulsante non trovato: '+text);await wait(250)}
const type=async(page,sel,val)=>{await page.$eval(sel,e=>{e.scrollIntoView({block:'center'});e.focus();e.select?.()});await page.keyboard.down('Meta');await page.keyboard.press('KeyA');await page.keyboard.up('Meta');await page.keyboard.press('Backspace');await page.type(sel,val);await wait(80)}
async function shot(page,vp,name,label,sel){await wait(250);const overflow=await page.evaluate(()=>{const w=innerWidth;return [...document.querySelectorAll('body *')].some(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>w+1&&getComputedStyle(e).position!=='fixed'&&!e.closest('.mw-phone,iframe,.mw-glass-preview,.mw-right-glass')})||document.documentElement.scrollWidth>w+0.5});assert.equal(overflow,false,vp+' '+name+': scroll orizzontale')
 if(sel)await page.$eval(sel,e=>e.scrollIntoView({block:'start'}));await wait(150);const file=vp+'-'+name+'.png';await page.screenshot({path:resolve(out,file)});shots.push({file,vp,label});results.push(vp+': '+label)}
const prices=page=>page.evaluate(()=>window.__srv.doc.menus[0].sections.flatMap(s=>s.items.map(i=>[i.name,i.price])))
const activeText=page=>page.evaluate(()=>(document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent||'').trim())

try{
 for(const vp of ['desktop','mobile']){
  // ── Menu a prezzo fisso ──
  let p=await open(vp);const before=await prices(p)
  await click(p,'Altre azioni');await click(p,'Impostazioni menu');await page_wait(p,'.mw-pricing-choice')
  assert.equal(await p.$eval('.mw-pricing-choice [aria-checked=true]',e=>e.textContent),'Alla carta')
  await shot(p,vp,'01-scelta-carta-fisso','Impostazioni menu: scelta «Alla carta / Prezzo fisso»','.mw-pricing')
  // tastiera: freccia sulla scelta → Prezzo fisso, il focus segue
  await p.focus('.mw-pricing-choice [aria-checked=true]');await p.keyboard.press('ArrowRight');await wait(300)
  assert.equal(await p.evaluate(()=>window.__srv&&document.querySelector('.mw-pricing-choice [aria-checked=true]').textContent),'Prezzo fisso');assert.equal(await activeText(p),'Prezzo fisso');results.push(vp+': freccia sulla scelta passa a Prezzo fisso e porta il focus')
  await shot(p,vp,'02-riga-prezzi-conservati','Prezzo fisso scelto: riga «I prezzi dei piatti restano salvati»','.mw-pricing')
  await click(p,'Chiudi pannello');await p.waitForSelector('.mw-fixed')
  assert.ok(await p.$('.mw-fixed-empty [data-fixed-add]'));await shot(p,vp,'03-stato-vuoto','Menu fisso senza opzioni: invito ad aggiungere la prima','.mw-fixed')
  // piatti senza prezzo
  await p.evaluate(()=>document.querySelectorAll('.mw-category-toggle[aria-expanded=false]').forEach(b=>b.click()));await wait(300)
  assert.equal(await p.$('.mw-daily-price'),null,'nessun campo prezzo sulle righe');await shot(p,vp,'04-piatti-senza-prezzo','Elenco piatti del menu fisso: nessun prezzo','.mw-catalog-list')
  // opzioni
  await click(p,'Aggiungi la prima opzione di prezzo');assert.equal(await p.evaluate(()=>document.activeElement?.dataset.f),'name','focus sul nome della nuova opzione')
  await type(p,'.mw-fixed-row:nth-child(1) input[data-f=name]','Completo');await type(p,'.mw-fixed-row:nth-child(1) .mw-fixed-price input','13');await p.keyboard.press('Enter');await type(p,'.mw-fixed-row:nth-child(1) input[data-f=note]','Primo, secondo e contorno')
  await click(p,'Aggiungi opzione');await type(p,'.mw-fixed-row:nth-child(2) input[data-f=name]','Solo primo');await type(p,'.mw-fixed-row:nth-child(2) .mw-fixed-price input','9');await p.keyboard.press('Enter');await click(p,'Primi','.mw-fixed-row:nth-child(2)')
  await click(p,'Aggiungi opzione');await type(p,'.mw-fixed-row:nth-child(3) input[data-f=name]','Solo secondo');await type(p,'.mw-fixed-row:nth-child(3) .mw-fixed-price input','10,50');await p.keyboard.press('Enter');await click(p,'Secondi','.mw-fixed-row:nth-child(3)');await click(p,'Contorni','.mw-fixed-row:nth-child(3)')
  await type(p,'.mw-fixed-included input','¼ di vino oppure ½ l d’acqua + caffè')
  await shot(p,vp,'05-opzioni-compilate','Tre opzioni con nome, prezzo, nota e Sottomenu compresi','.mw-fixed')
  await shot(p,vp,'06-compreso','Campo «Compreso» compilato','.mw-fixed-included')
  await click(p,'Sposta giù Completo');assert.equal(await activeText(p),'Sposta giù Completo','focus resta sul pulsante spostato')
  await shot(p,vp,'07-riordino','Riordino: «Completo» spostato dopo «Solo primo»','.mw-fixed')
  // stato salvato in bozza: formato del contratto
  await p.evaluate(()=>{});
  // Sostituisci i piatti (Primi)
  await click(p,'Modifica categoria Primi');await click(p,'Sostituisci i piatti');await p.waitForSelector('.mw-replace textarea');assert.equal(await p.evaluate(()=>document.activeElement?.tagName),'TEXTAREA')
  await p.type('.mw-replace textarea','Risotto ai funghi\nPasta al pomodoro\nGnocchi al pesto');await shot(p,vp,'08-sostituisci-incolla','Sostituisci i piatti: lista incollata','.mw-replace')
  await click(p,'Controlla (3)');await p.waitForSelector('.mw-replace-summary');await shot(p,vp,'09-sostituisci-riepilogo','Riepilogo: restano 2 (uno torna visibile), nuovo 1, nascosto 1','.mw-replace')
  await click(p,'Conferma');await p.waitForSelector('.mw-replace:not(.is-open)');results.push(vp+': conferma applica nella bozza')
  // salva la bozza e verifica il formato salvato
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.offsetParent&&/^Salva/.test(x.textContent.trim())&&!x.disabled&&x.closest('.mw-drawer,.mw-context-inspector,dialog,.mw-inspector,[role=dialog]'));b?.click()});await wait(600)
  if(await p.evaluate(()=>window.__srv.revision===1)){await click(p,'Altre azioni');await click(p,'Salva bozza');await wait(500)}
  const saved=await p.evaluate(()=>window.__srv.doc.menus[0])
  assert.equal(saved.pricing,'fisso');assert.deepEqual(saved.formulas.map(f=>[f.name,f.price,f.note,f.sectionIds||null]),[['Solo primo',9,null,[U(10)]],['Completo',13,'Primo, secondo e contorno',null],['Solo secondo',10.5,null,[U(11),U(12)]]]);assert.equal(saved.included,'¼ di vino oppure ½ l d’acqua + caffè')
  assert.deepEqual(saved.sections[0].items.map(i=>[i.name,i.price,!!i.hidden]),[['Risotto ai funghi',12,false],['Pasta al pomodoro',9,false],['Gnocchi al pesto',0,false],['Lasagna',11,true]])
  assert.equal(saved.sections[0].items[1].description,'Pomodoro fresco e basilico');results.push(vp+': salvato nel formato del contratto (pricing, formulas con sectionIds, included; piatti nascosti, prezzi intatti)')
  await shot(p,vp,'10-dopo-sostituzione','Dopo la sostituzione: Lasagna nascosta, Gnocchi nuovo senza prezzo','#mw-section-'+U(10))
  // chiudi il riquadro categoria se aperto
  await p.keyboard.press('Escape');await wait(300)
  // anteprima cliente (renderer vero)
  await click(p,'Anteprima cliente');await p.waitForSelector('dialog.mw-glass-preview iframe');const frame=await (await p.$('dialog.mw-glass-preview iframe')).contentFrame();await frame.waitForFunction(()=>document.body.innerText.includes('Primi'),{timeout:15000}).catch(()=>{});await wait(800)
  await shot(p,vp,'11-anteprima-cliente','Anteprima cliente (renderer vero di apps/web)')
  await p.keyboard.press('Escape');await wait(300);assert.equal(await p.$('dialog.mw-glass-preview'),null);assert.equal(await activeText(p),'Anteprima cliente','Esc chiude e rende il focus');results.push(vp+': Esc chiude l’anteprima e rende il focus')
  // torna alla carta: prezzi tornano
  await click(p,'Alla carta','.mw-fixed');await wait(300);assert.equal(await p.$('.mw-fixed'),null);assert.ok(await p.$('.mw-daily-price'))
  const priceShown=await p.$$eval('.mw-daily-price input',els=>els.map(e=>e.value));assert.ok(priceShown.includes('14')&&priceShown.includes('15'),'prezzi di nuovo visibili');await shot(p,vp,'12-tornato-alla-carta','Rimesso «Alla carta»: i prezzi dei piatti tornano','.mw-catalog-list')
  const back=await p.evaluate(()=>{});results.push(vp+': carta↔fisso conserva i prezzi')
  // nuovo menu già a prezzo fisso
  await p.click('[aria-label="Aggiungi categoria o piatto"]');await wait(300);await click(p,'Menu','.mw-create-kind');await type(p,'input[aria-label="Nome menu"]','Menu degustazione');await click(p,'Prezzo fisso','.mw-pricing-choice')
  await shot(p,vp,'13-nuovo-menu-fisso','Nuovo menu: scelto «Prezzo fisso» alla creazione')
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.offsetParent&&x.textContent.trim()==='Salva'&&!x.disabled);b.click()});await wait(800)
  const created=await p.evaluate(()=>window.__srv.doc.menus.find(m=>m.name==='Menu degustazione'));assert.equal(created?.pricing,'fisso');assert.deepEqual(created.formulas,[])
  await p.keyboard.press('Escape');await wait(300);await p.waitForSelector('.mw-fixed-empty');await shot(p,vp,'14-nuovo-menu-fisso-vuoto','Menu nuovo a prezzo fisso: stato vuoto','.mw-fixed')
  {const now=Object.fromEntries(await prices(p));for(const [n,v] of before)assert.equal(now[n],v,'prezzo di '+n+' intatto');results.push(vp+': tutti i prezzi originali intatti dopo fisso→carta e sostituzione')}await p.close()

  // ── PDF multipli (Condividi) ──
  p=await open(vp);await click(p,'Condividi');await p.waitForSelector('.mw-pdfdoc-row.is-default')
  assert.equal(await p.$eval('.mw-pdfdoc-row.is-default small',e=>e.textContent),'Predefinito · Menu pranzo, Menu cena');await shot(p,vp,'20-pdf-predefinito','PDF: nessun documento salvato → «PDF predefinito»','.mw-pdfdoc')
  await click(p,'Nuovo PDF');await p.waitForSelector('.mw-pdfdoc-editor');assert.equal(await p.evaluate(()=>document.activeElement?.placeholder),'Menu pranzo')
  await shot(p,vp,'21-pdf-nuovo','Nuovo PDF: nome, menu inclusi, grafica','.mw-pdfdoc')
  await p.keyboard.press('Escape');await wait(300);assert.equal(await p.$('.mw-pdfdoc-editor'),null);assert.equal(await activeText(p),'Nuovo PDF');results.push(vp+': Esc chiude l’editor PDF e rende il focus a «Nuovo PDF»')
  await click(p,'Nuovo PDF');await type(p,'.mw-pdfdoc-editor input[maxlength="80"]','Pranzo e cena');await click(p,'Sposta giù Menu pranzo')
  assert.deepEqual(await p.$$eval('.mw-pdfdoc-menu.is-on',els=>els.map(e=>e.textContent.replace(/[↑↓]/g,'').trim())),['Menu cena','Menu pranzo'])
  await shot(p,vp,'22-pdf-scelta-ordine-menu','Menu inclusi e loro ordine (Cena prima di Pranzo)','.mw-pdfdoc-menus')
  await click(p,'Grafica propria');await p.waitForSelector('.mw-pdfdoc-config');await shot(p,vp,'23-pdf-grafica','Grafica propria: controlli del PDF esistenti','.mw-pdfdoc-look')
  await p.$eval('.mw-pdfdoc-config select',s=>{s.value='A5';s.dispatchEvent(new Event('change',{bubbles:true}))}).catch(()=>{})
  await click(p,'Salva','.mw-pdfdoc-editor');await p.waitForSelector('.mw-pdfdoc-row[data-pdfdoc]')
  const put=await p.evaluate(()=>window.__srv.lastPut);assert.equal(put.documents.length,1);assert.equal('id' in put.documents[0],false);assert.equal(put.documents[0].name,'Pranzo e cena');assert.deepEqual(put.documents[0].menuIds,[U(2),U(1)]);assert.equal(typeof put.documents[0].config,'object');results.push(vp+': PUT {documents:[{name,menuIds,config}]} senza id per il nuovo')
  await shot(p,vp,'24-pdf-lista','Lista dei PDF salvati','.mw-pdfdoc')
  // secondo documento, poi rinomina
  await click(p,'Nuovo PDF');await type(p,'.mw-pdfdoc-editor input[maxlength="80"]','Solo pranzo');await p.evaluate(()=>[...document.querySelectorAll('.mw-pdfdoc-menu.is-on input')].find(i=>i.closest('li').textContent.includes('Menu cena')).click());await click(p,'Salva','.mw-pdfdoc-editor');await wait(300)
  await p.evaluate(()=>{const row=[...document.querySelectorAll('.mw-pdfdoc-row')].find(r=>r.textContent.includes('Solo pranzo'));[...row.querySelectorAll('button')].find(b=>b.textContent==='Modifica').click()});await wait(250);await type(p,'.mw-pdfdoc-editor input[maxlength="80"]','Pranzo del giorno');await click(p,'Salva','.mw-pdfdoc-editor');await wait(300)
  assert.deepEqual(await p.evaluate(()=>window.__srv.documents.map(d=>d.name)),['Pranzo e cena','Pranzo del giorno']);results.push(vp+': crea e rinomina')
  // elimina
  await p.evaluate(()=>{const row=[...document.querySelectorAll('.mw-pdfdoc-row')].find(r=>r.textContent.includes('Pranzo del giorno'));[...row.querySelectorAll('button')].find(b=>b.textContent==='Modifica').click()});await wait(250);await click(p,'Elimina','.mw-pdfdoc-editor')
  await shot(p,vp,'25-pdf-elimina-conferma','Conferma eliminazione di un PDF','.mw-pdfdoc');await click(p,'Elimina','.mw-pdfdoc-confirm');await wait(300);assert.deepEqual(await p.evaluate(()=>window.__srv.documents.map(d=>d.name)),['Pranzo e cena']);results.push(vp+': elimina con conferma')
  // scarica
  await click(p,'Scarica','.mw-pdfdoc-row[data-pdfdoc]');await wait(300);assert.ok((await p.evaluate(()=>window.__srv.calls)).some(c=>/^GET \/api\/menu-workspace\/pdf-documents\/[^/]+\/pdf$/.test(c)));results.push(vp+': Scarica usa GET …/:id/pdf')
  // link fisso
  await click(p,'Link fisso');await p.waitForSelector('.mw-pdfdoc-link');await shot(p,vp,'26-link-da-creare','Link fisso: spiegazione + «Crea link fisso»','.mw-pdfdoc')
  await click(p,'Crea link fisso');await p.waitForSelector('.mw-pdfdoc-url input');assert.match(await p.$eval('.mw-pdfdoc-url input',e=>e.value),/\/api\/public\/menu-pdf\/tk1/);await shot(p,vp,'27-link-creato','Link fisso creato','.mw-pdfdoc')
  await p.bringToFront();await click(p,'Copia');await p.waitForFunction(()=>[...document.querySelectorAll('.mw-pdfdoc-url button')].some(b=>b.textContent==='Copiato'),{timeout:4000});assert.match(await p.evaluate(()=>navigator.clipboard.readText()),/menu-pdf\/tk1/);await shot(p,vp,'28-link-copiato','Link copiato negli appunti','.mw-pdfdoc')
  await click(p,'Rigenera');await shot(p,vp,'29-link-rigenera-conferma','Rigenera: conferma (il vecchio link smette di funzionare)','.mw-pdfdoc')
  await p.keyboard.press('Escape');await wait(200);assert.equal(await p.$('.mw-pdfdoc-confirm'),null);await click(p,'Rigenera');await click(p,'Crea link nuovo','.mw-pdfdoc-confirm');await p.waitForFunction(()=>document.querySelector('.mw-pdfdoc-url input')?.value.includes('tk2'));results.push(vp+': rigenera → token nuovo')
  await click(p,'Revoca');await click(p,'Revoca','.mw-pdfdoc-confirm');await p.waitForFunction(()=>!document.querySelector('.mw-pdfdoc-url'));assert.equal(await p.evaluate(()=>window.__srv.documents[0].shareToken),null)
  await shot(p,vp,'30-link-revocato','Link revocato: si può crearne uno nuovo','.mw-pdfdoc')
  await p.keyboard.press('Escape');await wait(200);assert.equal(await p.$('.mw-pdfdoc-link'),null);assert.equal(await activeText(p),'Link fisso');results.push(vp+': Esc chiude il link fisso e rende il focus')
  // PDF anche nella scheda PDF (desktop)
  if(vp==='desktop'){await click(p,'PDF','.mw-tabs');await p.waitForSelector('.mw--pdf .mw-pdfdoc');await shot(p,vp,'31-pdf-scheda-pdf','Pannello «I tuoi PDF» anche nella scheda PDF','.mw-pdfdoc')}
  await p.close()
 }
 assert.deepEqual(errors,[]);results.push('nessun errore nel browser')
 const lines=['# Screenshot dashboard — Menu a prezzo fisso e PDF multipli (21/10/2026)','','Generati da `node scripts/verify-fixed-menu-dashboard.mjs`: componenti veri della dashboard, ruolo **titolare (owner)**, API finta in memoria con le forme del CONTRATTO §7, anteprima cliente = renderer vero di `apps/web` compilato. Chrome headless, 1280×900 e 375×812, reduced motion.','','| File | Viewport | Stato |','|---|---|---|',...shots.map(s=>`| [${s.file}](${s.file}) | ${s.vp==='desktop'?'1280':'375'} | ${s.label} |`),'','## Verifiche automatiche','',...results.map(r=>'- '+r),'']
 await writeFile(resolve(out,'INDICE.md'),lines.join('\n'))
 await writeFile(resolve(out,'verifica.json'),JSON.stringify({ambito:'componenti veri della dashboard, ruolo owner, API finta in memoria, nessun DB/login/deploy',viewport:viewports,risultati:results,screenshot:shots},null,2))
 console.log(JSON.stringify({ok:true,shots:shots.length,results},null,1))
}catch(e){console.error('ERRORI BROWSER',errors);throw e}finally{await browser.close();await new Promise(r=>server.close(r))}
async function page_wait(p,sel){await p.waitForSelector(sel,{timeout:5000})}
