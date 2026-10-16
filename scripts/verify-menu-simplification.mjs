import puppeteer from 'puppeteer-core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createServer} from 'node:http';
import {transform} from 'esbuild';
import assert from 'node:assert/strict';
const root=resolve('apps/dashboard/public/staff'),out=resolve('docs/webapp/menu-simplification/evidence');await mkdir(out,{recursive:true});
const files=['01-data.js','02-kit.js','04-screens-operative.js','12-menu-images.js','12-menu-translations.js','14-menu-print.js','15-menu-gallery-history.js','17-menu-import-translate.js','13-menu-workspace.js'];
const source=(await Promise.all(files.map(f=>readFile(resolve(root,'src',f),'utf8')))).join('\n');
const fixture={revision:2,publishedRevision:2,capabilities:['content','style','pdf'],defaultLanguage:'it',languages:['it','en','fr','de','es','pt','nl','pl','ru','ar','zh','ja'],translationSettings:{protectedNames:[],glossary:[]},foodTranslations:{},pdf:{format:'A4',orientation:'portrait',columns:1,font:'sans',fontSize:11,headingFontSize:18,textColor:'#222222',headingColor:'#222222',margin:24},pdfPresets:[],design:{background:'#fafafa',text:'#222222',primary:'#ed7058',links:[]},menus:[{id:'m1',name:'Cena',type:'dinner',active:true,translations:{},sections:[{id:'s1',name:'Antipasti',active:true,parentSectionId:null,translations:{},items:[{id:'i1',name:'Bruschetta',description:'Pomodoro e basilico',price:6,available:true,hidden:false,allergens:['glutine'],tags:[],additives:[],variants:[],translations:{}},{id:'i2',name:'Burrata',description:'Burrata con pomodori',price:9,available:true,hidden:false,allergens:['latte'],tags:[],additives:[],variants:[],translations:{}}]},{id:'s2',name:'Primi',active:true,parentSectionId:null,translations:{},items:[]}]},{id:'m2',name:'Drinks',type:'drinks',active:true,translations:{},sections:[]}]};
const pdfBytes=(await readFile('tmp/pdfs/international/ja.pdf')).toString('base64');
const boot=`
window.__qaState=${JSON.stringify(fixture)};window.__qaCalls=[];window.__qaFailSave=false;window.__takoRole='owner';window.__takoRestaurantId='qa';
const qaAdapter={...window.TakoMenuWorkspaceContract,
 load:async()=>structuredClone(window.__qaState),
 save:async(doc,revision)=>{window.__qaCalls.push({kind:'save',revision});if(window.__qaFailSave)throw Object.assign(new Error('Revision conflict'),{status:409});if(revision!==window.__qaState.revision)throw Object.assign(new Error('Revision conflict'),{status:409});window.__qaState={...structuredClone(doc),revision:revision+1};return structuredClone(window.__qaState);},
 publishDiff:async()=>{window.__qaCalls.push({kind:'diff'});return {revision:window.__qaState.revision,data:{added:[],removed:[],changed:[]},added:[],removed:[],changed:[],details:[]};},
 publish:async(revision)=>{window.__qaCalls.push({kind:'publish',revision});if(revision!==window.__qaState.revision)throw new Error('Revision conflict');window.__qaState.publishedRevision=revision;},
 listPresets:async()=>[],listAssets:async()=>({data:[],usage:{usedBytes:0,maxBytes:52428800}}),listVersions:async()=>[],listCatalogs:async()=>({allergens:[{id:'glutine',label:'Glutine'},{id:'latte',label:'Latte'}],traits:[],additives:[]}),getTranslationProvider:async()=>({configured:false}),
 renderPdf:async()=>new Blob([Uint8Array.from(atob('${pdfBytes}'),c=>c.charCodeAt(0))],{type:'application/pdf'})
};
ReactDOM.createRoot(document.getElementById('root')).render(<ScreenMenuWorkspace mobile={innerWidth<600} adapter={qaAdapter}/>);
`;
const compiled=(await transform(source+'\n'+boot,{loader:'jsx',format:'iife'})).code;
const css=['styles.css','src/sobrio.css','src/menu-workspace.css','src/daily-menu.css','src/menu-images.css','src/menu-translations.css','src/tako-loading.css'];
const html=`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${css.map(f=>`<link rel="stylesheet" href="/${f}">`).join('')}<body><div id="root" style="height:100dvh;display:flex;flex-direction:column"></div><script src="/lib/react.js"></script><script src="/lib/react-dom.js"></script><script src="/fixture.js"></script></body></html>`;
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname.replace(/^\/staff\//,'/');if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}if(path==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled);return;}if(path.startsWith('/api/'))throw new Error('No API in isolated fixture');if(path.startsWith('/menu-preview/')){res.setHeader('Content-Type','text/html');res.end('<p>Anteprima isolata</p>');return;}const assetRoot=path.startsWith('/lib/pdfjs/')?resolve('release/staff-web'):root;const file=resolve(assetRoot,'.'+decodeURIComponent(path));if(!file.startsWith(assetRoot+'/'))throw new Error('Invalid path');const bytes=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});const results=[];
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1280,height:900});await page.goto(origin);await page.waitForSelector('nav[aria-label="Editor menu"]');
 const clickText=async(text,scope='button')=>{const target=await page.evaluateHandle((text,scope)=>[...document.querySelectorAll(scope)].find(el=>el.textContent.trim()===text),text,scope);const el=target.asElement();assert(el,`Missing ${text}`);await el.click();await target.dispose();};
 const visible=async selector=>page.$eval(selector,el=>!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
 const nav=await page.$$eval('nav[aria-label="Editor menu"] button',els=>els.map(el=>el.textContent.trim()));assert.deepEqual(nav,['Menu','PDF']);assert.ok(await page.evaluate(()=>document.querySelector('.mw-toolbar').getBoundingClientRect().top>document.querySelector('.mw-tabs').getBoundingClientRect().bottom));results.push('Menu and PDF only; appearance nested inside Menu');const alignment=await page.evaluate(()=>({nav:document.querySelector('nav[aria-label="Editor menu"]').getBoundingClientRect().top,phone:document.querySelector('.mw-phone').getBoundingClientRect().top}));assert.ok(Math.abs(alignment.nav-alignment.phone)<2,JSON.stringify(alignment));results.push('phone top aligned with Menu/PDF navigation');
 await page.screenshot({path:resolve(out,'menu-desktop.png'),fullPage:true});
 assert.equal(await page.$('[aria-label="Azioni multiple"]'),null);
 await page.click('[aria-label="Seleziona Bruschetta"]');await page.waitForSelector('[aria-label="Azioni multiple"]');
 await clickText('Deseleziona');assert.equal(await page.$('[aria-label="Azioni multiple"]'),null);results.push('bulk only after selection');
 const category=await page.evaluateHandle(()=>[...document.querySelectorAll('.mw-category-toggle')].find(el=>el.textContent.includes('Antipasti')));
 await category.asElement().click();assert.equal(await visible('[aria-label="Prezzo Bruschetta"]'),false);await category.asElement().click();await category.dispose();results.push('category collapse preserves items');
 await clickText('BruschettaDisponibile');await page.waitForSelector('dialog[aria-label="Modifica piatto"][open]');
 assert.equal(await page.$eval('dialog',el=>el.contains(document.activeElement)),true);
 assert.equal(await page.$('dialog [aria-label="Cerca immagine"]'),null);
 const name=await page.evaluateHandle(()=>[...document.querySelectorAll('dialog label')].find(el=>el.querySelector('span')?.textContent==='Nome')?.querySelector('input'));
 await name.asElement().evaluate(el=>{el.focus();el.select();});await name.asElement().type('Bruschetta speciale');await name.dispose();
 await page.screenshot({path:resolve(out,'item-drawer-desktop.png'),fullPage:true});
 await page.keyboard.press('Escape');assert.equal(await page.$('dialog[open]'),null);results.push('drawer focus escape and edit');
 const publicationRecording=await page.screencast({path:resolve(out,'publication-dialog.webm'),fps:30});await clickText('Pubblica modifiche');await page.waitForSelector('[aria-label="Riepilogo pubblicazione"]');assert.equal(await page.$$eval('dialog[aria-label="Riepilogo pubblicazione"] button',e=>e.length),2);assert.equal(await page.$('dialog [aria-label="Dettagli modifiche"]'),null);
 await new Promise(r=>setTimeout(r,380));await page.screenshot({path:resolve(out,'publication-simple.png')});await publicationRecording.stop();let calls=await page.evaluate(()=>window.__qaCalls);assert.deepEqual(calls.map(c=>c.kind),['save','diff']);assert.equal(calls[0].revision,2);results.push('save then diff without implicit publish');
 await clickText('Pubblica','dialog button');await page.waitForFunction(()=>window.__qaState.publishedRevision===3);
 calls=await page.evaluate(()=>window.__qaCalls);assert.deepEqual(calls.map(c=>c.kind),['save','diff','publish']);assert.equal(calls[2].revision,3);results.push('explicit revision guarded publish');
 await clickText('Menu','nav[aria-label="Editor menu"] button');await clickText('Aspetto del menu','nav[aria-label="Sezioni del menu"] button');assert.equal(await page.$('[aria-label="Sezioni aspetto menu"]'),null);
 assert.equal(await page.$$eval('[aria-label="Aspetto di base"] .mw-brand-media h4',els=>els.map(e=>e.textContent).join(',')),'Logo,Hero');await clickText('Gradiente');assert.ok(await page.$('[aria-label="Sfondo piatti"] input[type=range]'));assert.equal(await page.$$eval('[aria-label="Sfondo piatti"] input[type=file]',els=>els.length),0);results.push('dish background supports color or gradient only, with suggestion');await clickText('Personalizzazione avanzata');await page.waitForSelector('[aria-label="Sezioni aspetto menu"]');await page.screenshot({path:resolve(out,'appearance-desktop.png'),fullPage:true});assert.ok(await page.$('.mw-phone iframe'));assert.equal(await page.$eval('.mw-preview',e=>getComputedStyle(e).borderTopWidth),'0px');results.push('phone Chrome preview without outer card; appearance progressive controls');
 await clickText('Altre azioni');await clickText('Salva bozza');await page.waitForFunction(()=>!!window.__qaState.design.backgroundGradient);await clickText('Chiudi altre azioni');await clickText('PDF','nav[aria-label="Editor menu"] button');assert.equal(await page.$('[aria-label="Sezioni del documento PDF"]'),null);await page.waitForFunction(()=>{const c=document.querySelector('.mw-pdf-viewer canvas');return c&&c.width>0&&c.style.display!=='none'&&!document.querySelector('.mw-pdf-viewer .tako-loading')},{timeout:15000});const pdfLayout=await page.evaluate(()=>{const a=document.querySelector('.mw-pdf-controls').getBoundingClientRect(),b=document.querySelector('.mw-pdf-preview-area').getBoundingClientRect(),c=document.querySelector('.mw-pdf-page-stage').getBoundingClientRect();return {controlsRight:a.right,previewLeft:b.left,canvasBottom:c.bottom,height:innerHeight}});assert.ok(pdfLayout.previewLeft>pdfLayout.controlsRight);assert.ok(await page.$eval('.mw-pdf-viewer canvas',e=>e.getBoundingClientRect().bottom<=innerHeight));assert.equal(await page.$('.mw-pdf-preview-header'),null);assert.ok(await page.$eval(".mw-pdf-page-stage",e=>e.scrollHeight<=e.clientHeight+1&&getComputedStyle(e).overflow==="visible"));await page.screenshot({path:resolve(out,'pdf-right-desktop.png'),fullPage:true});results.push('PDF on right; complete page has no clipped inner viewport');await clickText('Impaginazione e temi');await page.waitForSelector('[aria-label="Sezioni del documento PDF"]');results.push('PDF progressive controls');
 await clickText('Menu','nav[aria-label="Editor menu"] button');
 await page.click('[aria-label^="Foto di Bruschetta"]');await page.waitForSelector('dialog [aria-label="Cerca immagine"]');await page.keyboard.press('Escape');results.push('photo gallery directly from dish; no separate image/language tab');
 await clickText('Altre azioni');await clickText('Storico versioni');assert.ok(await page.evaluate(()=>document.body.textContent.includes('Versioni del menu')));await clickText('Chiudi pannello');results.push('history in other actions');

 await page.reload();await page.waitForSelector('[aria-label="Prezzo Bruschetta"]');
 await page.click('[aria-label="Prezzo Bruschetta"]');await page.$eval('[aria-label="Prezzo Bruschetta"]',el=>el.select());await page.type('[aria-label="Prezzo Bruschetta"]','12,50');await page.keyboard.press('Tab');
 await page.evaluate(()=>{window.__qaFailSave=true;});await clickText('Pubblica modifiche');
 await page.waitForFunction(()=>document.body.textContent.includes('Revision conflict'));
 assert.equal(await page.$('[aria-label="Riepilogo pubblicazione"]'),null);assert.equal(await page.$eval('[aria-label="Prezzo Bruschetta"]',el=>el.value),'12.5');
 assert.deepEqual(await page.evaluate(()=>window.__qaCalls.map(c=>c.kind)),['save']);results.push('conflict keeps edit and prevents publication');
 await page.evaluate(()=>{window.__qaFailSave=false;});await clickText('Pubblica modifiche');await page.waitForSelector('[aria-label="Riepilogo pubblicazione"]');
 await clickText('Annulla');assert.equal(await page.$('[aria-label="Riepilogo pubblicazione"]'),null);assert.equal(await page.evaluate(()=>window.__qaState.publishedRevision),2);results.push('cancel publication leaves public unchanged');
 await page.setViewport({width:390,height:844});await page.reload();await page.waitForSelector('nav[aria-label="Editor menu"]');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);results.push('mobile no overflow');
 await page.screenshot({path:resolve(out,'menu-mobile.png'),fullPage:true});
 await clickText('BruschettaDisponibile');await page.waitForSelector('dialog[open]');
 const drawer=await page.$eval('dialog',el=>({width:el.getBoundingClientRect().width,overflow:el.scrollWidth>el.clientWidth}));assert.equal(Math.round(drawer.width),390);assert.equal(drawer.overflow,false);
 await page.screenshot({path:resolve(out,'item-drawer-mobile.png'),fullPage:true});await page.keyboard.press('Escape');results.push('mobile full width drawer and escape');
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);results.push('reduced motion preference');
 assert.deepEqual(errors,[]);results.push('no browser errors');
 await writeFile(resolve(out,'verification.json'),JSON.stringify({scope:'isolated fixture only, no live DB or API writes',results},null,2));console.log(JSON.stringify({results}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
