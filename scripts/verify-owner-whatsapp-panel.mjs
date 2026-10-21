// 21/10: QA visivo del pannello «WhatsApp del titolare» (due numeri). Componenti VERI della dashboard (kit, ScreenScroll, pannello),
// API finta in memoria che imita il server (limite 2, email per numero, errori con «field»). Chrome headless: nessuna finestra a schermo.
// Nessun DB, nessun login, nessun messaggio. Uscita: docs/webapp/due-numeri-2026-10-21/screenshot/*.png + verifica.json
import puppeteer from 'puppeteer-core'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,extname} from 'node:path'
import {createServer} from 'node:http'
import {transform} from 'esbuild'
import assert from 'node:assert/strict'

const root=resolve('apps/dashboard/public/staff'),out=resolve('docs/webapp/due-numeri-2026-10-21/screenshot');await mkdir(out,{recursive:true})
const files=['01-data.js','02-kit.js','04-screens-operative.js','13-menu-workspace.js']
const source=(await Promise.all(files.map(f=>readFile(resolve(root,'src',f),'utf8')))).join('\n')
// API finta: stessa forma delle risposte del server (GET/POST/DELETE /menu-workspace/whatsapp/owner).
const fake=`
window.__wa={sender:'+18382622788',numbers:[],calls:[]};
const __waState=()=>{const n=window.__wa.numbers,last=n.at(-1)||null;return{configured:true,sender:window.__wa.sender,max:2,numbers:n.map(x=>({...x})),phone:last?.phone??null,email:last?.email??null,status:last?.status??null,activatedAt:null}};
const __waNorm=v=>{let d=String(v||'').replace(/\\D/g,'');if(d.startsWith('0039'))d=d.slice(4);if(d.length===10&&d.startsWith('3'))d='39'+d;return /^39\\d{9,10}$/.test(d)?'+'+d:null};
const __waFail=(status,code,message,field)=>new Response(JSON.stringify({error:{code,message,...(field?{field}:{})}}),{status,headers:{'Content-Type':'application/json'}});
const __waOk=data=>new Response(JSON.stringify({data}),{status:200,headers:{'Content-Type':'application/json'}});
window.fetch=async(url,opt={})=>{const u=new URL(url,location.origin),m=opt.method||'GET';window.__wa.calls.push(m+' '+u.pathname+u.search);
 await new Promise(r=>setTimeout(r,60));
 if(u.pathname!=='/api/menu-workspace/whatsapp/owner')return __waFail(401,'UNAUTHORIZED','Non autorizzato');
 const W=window.__wa;if(m==='GET')return __waOk(__waState());
 if(m==='DELETE'){const p=__waNorm(u.searchParams.get('phone'));W.numbers=W.numbers.filter(x=>x.phone!==p);return __waOk(__waState())}
 const b=JSON.parse(opt.body||'{}'),phone=__waNorm(b.phone),email=String(b.email||'').trim().toLowerCase(),replace=b.replace?__waNorm(b.replace):null;
 if(!phone)return __waFail(400,'VALIDATION','Numero non valido: scrivi un cellulare italiano, ad esempio 333 123 4567.','phone');
 if(!/^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$/.test(email))return __waFail(400,'VALIDATION','Email non valida: scrivi l’email del titolare, ad esempio nome@gmail.com.','email');
 const others=W.numbers.filter(x=>x.phone!==phone&&x.phone!==replace);
 if(others.some(x=>x.email===email))return __waFail(409,'EMAIL_OTHER_NUMBER','Questa email è già dell’altro numero: ogni numero ha la sua email.','email');
 if(phone==='+393330000000'&&!b.move)return __waFail(409,'PHONE_IN_USE_MOVABLE','Questo numero è già collegato a Victoria Bar. Vuoi spostarlo su questo locale?','phone');
 const same=W.numbers.find(x=>x.phone===phone);if(same){same.email=email;return __waOk(__waState())}
 if(others.length>=2)return __waFail(409,'OWNER_PHONES_LIMIT','Al massimo due numeri per locale. Scollegane uno per aggiungerne un altro.','phone');
 const row={phone,email,status:'pending',activatedAt:null};const i=replace?W.numbers.findIndex(x=>x.phone===replace):-1;if(i>=0)W.numbers.splice(i,1,row);else W.numbers.push(row);
 return __waOk({...__waState(),replacedPhones:i>=0?[replace]:[]})};
`
const mount=`
const __mobile=innerWidth<720;
function __Harness(){return <div className={'screen app-live'+(__mobile?' mobile':'')} style={{width:'100%',minHeight:'100dvh',background:'var(--surface)'}}><ScreenScroll mobile={__mobile}><div className="mw"><PageHead mobile={__mobile} title="Menu" sub="Pubblicato"/><div className="mw-row" style={{marginBottom:16}}><Btn kind="soft" size="sm">← Altre azioni</Btn><Btn kind="ghost" size="sm">Chiudi pannello</Btn></div><MenuWhatsAppSetup/></div></ScreenScroll><Toaster mobile={__mobile}/></div>}
window.__mount=()=>ReactDOM.createRoot(document.getElementById('root')).render(<__Harness/>);
`
const compiled=(await transform(fake+source+'\n'+mount,{loader:'jsx',format:'iife'})).code
const css=['styles.css','src/sobrio.css','src/menu-workspace.css','src/tako-loading.css']
const html=`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${css.map(f=>`<link rel="stylesheet" href="/staff/${f}">`).join('')}<body><div id="root"></div><script src="/staff/lib/react.js"></script><script src="/staff/lib/react-dom.js"></script><script src="/fixture.js"></script></body></html>`
const types={'.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'}
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return}
 if(path==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled);return}
 if(!path.startsWith('/staff/')&&!path.startsWith('/assets/'))throw Error('404');const file=resolve(root,'.'+decodeURIComponent(path.startsWith('/staff/')?path.slice(6):path));if(!file.startsWith(root+'/'))throw Error('Invalid path')
 res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.statusCode=404;res.end()}})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const base=`http://127.0.0.1:${server.address().port}/`
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox','--hide-scrollbars']})
const A={phone:'+393347223384',email:'mario.rossi@gmail.com',status:'linked',activatedAt:'2026-10-20T10:00:00Z'},B={phone:'+393401234567',email:'giulia.bianchi@gmail.com',status:'pending',activatedAt:null}
const results=[],errors=[]
const viewports={desktop:{width:1280,height:900,deviceScaleFactor:1},mobile:{width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true}}
async function open(vp,numbers){const page=await browser.newPage();page.on('pageerror',e=>errors.push(vp+': '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push(vp+' console: '+m.text())});page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/')&&!r.url().endsWith('/favicon.ico'))errors.push(vp+' 404: '+r.url())})
 await page.setViewport(viewports[vp]);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
 await page.goto(base);await page.evaluate(n=>{window.__wa.numbers=n;window.__mount()},numbers)
 await page.waitForSelector('.mw-owa-head');await page.waitForFunction(()=>!document.querySelector('.mw-owa .tako-loading'))
 if(numbers.length)await page.waitForSelector('.mw-owa-qr-img img');return page}
const fill=async(page,sel,val)=>{await page.$eval(sel,e=>{e.focus();e.select()});await page.keyboard.press('Backspace');await page.type(sel,val)}
const clickText=(page,text)=>page.evaluate(t=>{const b=[...document.querySelectorAll('.mw-owa button')].find(x=>x.textContent.trim()===t||x.textContent.trim().endsWith(t));if(!b)throw Error('no button '+t);b.click()},text)
async function shot(page,name){await new Promise(r=>setTimeout(r,250));const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+0.5);assert.equal(overflow,false,name+': scroll orizzontale');
 const card=await page.$('.mw-owa');const box=await card.boundingBox();await page.screenshot({path:resolve(out,name+'.png'),clip:{x:0,y:0,width:page.viewport().width,height:Math.ceil(box.y+box.height+24)}});results.push(name)}
try{
 for(const vp of ['desktop','mobile']){
  let p=await open(vp,[]);assert.ok(await p.$('.mw-owa-form input[type=tel]'),'vuoto: form subito');assert.equal(await p.$('.mw-owa-qr'),null);await shot(p,vp+'-1-vuoto');await p.close()
  p=await open(vp,[A]);assert.equal(await p.$eval('.mw-owa-phone',e=>e.textContent),'+39 334 722 3384');assert.ok((await p.$eval('.mw-owa-head p',e=>e.textContent)).includes('+1 838 262 2788'));assert.equal(await p.$eval('.mw-owa-count',e=>e.textContent),'1 di 2');await shot(p,vp+'-2-un-numero-collegato')
  await clickText(p,'Aggiungi numero');await p.waitForSelector('.mw-owa-row.is-new .mw-owa-form');await shot(p,vp+'-4-aggiungi-aperto')
  await p.type('.mw-owa-row.is-new input[type=tel]','123');await p.type('.mw-owa-row.is-new input[type=email]','giulia.bianchi@gmail.com');await p.click('.mw-owa-row.is-new button[type=submit]')
  await p.waitForSelector('.mw-owa-row.is-new .mw-owa-error');assert.ok((await p.$eval('.mw-owa-row.is-new .mw-owa-error-phone',e=>e.textContent)).startsWith('Numero non valido'));await shot(p,vp+'-5-errore')
  // email dell'altro numero: errore sotto l'email
  await fill(p,'.mw-owa-row.is-new input[type=tel]','340 123 4567');await fill(p,'.mw-owa-row.is-new input[type=email]','mario.rossi@gmail.com');await p.click('.mw-owa-row.is-new button[type=submit]')
  await p.waitForSelector('.mw-owa-error-email');results.push(vp+': email dell’altro numero → errore sotto l’email')
  await fill(p,'.mw-owa-row.is-new input[type=email]','giulia.bianchi@gmail.com');await p.click('.mw-owa-row.is-new button[type=submit]')
  await p.waitForFunction(()=>document.querySelectorAll('.mw-owa-list li.mw-owa-row:not(.is-editing)').length===2);assert.equal(await p.$('.mw-owa-add'),null,'2 di 2: niente Aggiungi');results.push(vp+': aggiunta del secondo numero dal form');await p.close()
  p=await open(vp,[A,B]);assert.equal(await p.$eval('.mw-owa-count',e=>e.textContent),'2 di 2');assert.equal(await p.$('.mw-owa-add'),null);await shot(p,vp+'-3-collegato-e-in-attesa')
  await p.evaluate(()=>{const rows=document.querySelectorAll('.mw-owa-list li');[...rows[1].querySelectorAll('button')].find(b=>b.textContent==='Scollega').click()});await p.waitForSelector('.mw-owa-confirm');assert.equal(await p.evaluate(()=>document.activeElement?.textContent),'Annulla');await shot(p,vp+'-7-conferma-scollega')
  await p.evaluate(()=>[...document.querySelectorAll('.mw-owa-confirm button')].find(b=>b.textContent==='Scollega').click());await p.waitForFunction(()=>document.querySelectorAll('.mw-owa-list li').length===1);assert.ok(await p.$('.mw-owa-add'));results.push(vp+': scollega uno, l’altro resta');await p.close()
  p=await open(vp,[A,{...B,status:'linked'}]);await shot(p,vp+'-6-due-di-due')
  await p.evaluate(()=>document.querySelector('.mw-owa-list li [data-owa-edit]').click());await p.waitForSelector('li.is-editing .mw-owa-form');assert.equal(await p.$eval('li.is-editing input[type=tel]',e=>e.value),'+39 334 722 3384');await shot(p,vp+'-8-modifica')
  await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('li.is-editing'));assert.equal(await p.evaluate(()=>document.activeElement?.textContent),'Modifica');results.push(vp+': Esc chiude la modifica e rimette il focus su Modifica');await p.close()
 }
 assert.deepEqual(errors,[]);results.push('nessun errore nel browser')
 await writeFile(resolve(out,'verifica.json'),JSON.stringify({ambito:'componenti veri della dashboard, API finta in memoria, nessun DB/login/messaggio',viewport:viewports,risultati:results},null,2))
 console.log(JSON.stringify({ok:true,results},null,1))
}catch(e){console.error('ERRORI BROWSER',errors);throw e}finally{await browser.close();await new Promise(r=>server.close(r))}
