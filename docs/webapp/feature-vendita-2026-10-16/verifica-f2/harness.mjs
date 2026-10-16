// Dashboard «Piatti» servita in locale con un finto backend in memoria (nessun DB, nessuna rete esterna).
// Compila i sorgenti reali della dashboard (stesso ordine dell'app) e monta ScreenMenuWorkspace con un adattatore finto.
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createServer} from 'node:http';
import {transform} from 'esbuild';
export const ROOT=resolve(import.meta.dirname,'../../../..');
const staff=resolve(ROOT,'apps/dashboard/public/staff');
const files=['01-data.js','02-kit.js','04-screens-operative.js','12-menu-images.js','12-menu-translations.js','14-menu-print.js','15-menu-gallery-history.js','17-menu-import-translate.js','13-menu-category-icons.js','13-menu-day-presets.js','13-menu-workspace.js'];
const tokens=JSON.parse(await readFile(resolve(ROOT,'apps/web/src/lib/menu-motion.tokens.json'),'utf8'));
const u=()=>crypto.randomUUID();
const item=(name,price,description='')=>({id:u(),name,description:description||null,price,available:true,hidden:false,allergens:[],tags:[],additives:[],variants:[],translations:{},displayMode:'normal'});
const sec=(name,items)=>({id:u(),name,active:true,parentSectionId:null,translations:{},items});
export function fixture(){
 const pranzo=u(),cena=u(),drinks=u();
 const doc={revision:4,publishedRevision:4,capabilities:['content','style','pdf'],defaultLanguage:'it',languages:['it','en'],translationSettings:{protectedNames:[],glossary:[]},foodTranslations:{},pdf:{format:'A4'},pdfPresets:[],design:{background:'#fafafa',text:'#222222',primary:'#ed7058',links:[]},menus:[
  {id:pranzo,name:'Pranzo',type:'lunch',active:true,translations:{},sections:[sec('Primi',[item('Carbonara',10,'Guanciale, uovo, pecorino'),item('Amatriciana',9,'Pomodoro e guanciale')]),sec('Secondi',[item('Tagliata',16,'Rucola e grana'),item('Polpette al sugo',11)]),sec('Dolci',[item('Tiramisù',5)])]},
  {id:cena,name:'Cena',type:'dinner',active:true,translations:{},sections:[sec('Antipasti',[item('Bruschetta',6)]),sec('Secondi',[item('Filetto',22)])]},
  {id:drinks,name:'Drinks',type:'drinks',active:true,translations:{},sections:[sec('Vini',[item('Rosso della casa',4)])]}]};
 // Cena ha già i preset (giorni con numeri di piatti diversi): Pranzo li può copiare.
 const days={1:[sec('Primi',[item('Pasta e ceci',9)])],2:[sec('Primi',[item('Gnocchi al pomodoro',10),item('Risotto ai funghi',12)]),sec('Secondi',[item('Saltimbocca',15),item('Pollo arrosto',13)]),sec('Dolci',[item('Panna cotta',5)])],3:[sec('Primi',[item('Lasagna',11),item('Minestrone',8)]),sec('Dolci',[item('Crostata',5)])],4:[sec('Primi',[item('Gnocchi',10)]),sec('Secondi',[item('Spezzatino',14)])],5:[sec('Pesce',[item('Frittura mista',16),item('Baccalà',15),item('Spaghetti alle vongole',14)])],6:[sec('Primi',[item('Pizza bianca',8)])],7:[]};
 const presets=Object.entries(days).map(([w,sections],i)=>({id:u(),menuId:cena,name:['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'][i],weekday:Number(w),position:Number(w),revision:1,updatedAt:'2026-10-15T10:00:00.000Z',sections}));
 return {doc,presets,settings:[{menuId:cena,enabled:true,autoPublish:true,autoFromDay:'2026-10-14',onlinePresetId:presets[3].id,onlineAt:'2026-10-15T04:00:00.000Z'}],notices:[],ids:{pranzo,cena,drinks}};
}
const boot=`
window.TakoMenuMotion=${JSON.stringify(tokens)};
const Q=window.__qa={state:${'__STATE__'},calls:[],latency:500,failNext:0};
const wait=()=>new Promise(r=>setTimeout(r,Q.latency));
const clone=v=>JSON.parse(JSON.stringify(v));
const fail=()=>{if(Q.failNext>0){Q.failNext--;throw Object.assign(new Error('Connessione assente: le modifiche sono ancora qui. Riprova.'),{status:503});}};
const strip=p=>{const {sections,...rest}=p;return {...rest,itemCount:sections.reduce((n,s)=>n+s.items.length,0)};};
const days=['','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const fresh=sections=>{const c=clone(sections);c.forEach(s=>{s.id=crypto.randomUUID();s.items.forEach(i=>i.id=crypto.randomUUID());});return c;};
const S=()=>Q.state;const setting=m=>{let s=S().settings.find(x=>x.menuId===m);if(!s){s={menuId:m,enabled:false,autoPublish:false,autoFromDay:null,onlinePresetId:null,onlineAt:null};S().settings.push(s);}return s;};
window.__qaAdapter={...window.TakoMenuWorkspaceContract,
 load:async()=>{Q.calls.push('load');return clone(S().doc);},
 save:async(doc,revision)=>{Q.calls.push('save');await wait();fail();if(revision!==S().doc.revision)throw Object.assign(new Error('Revision conflict'),{status:409});S().doc={...clone(doc),revision:revision+1,publishedRevision:S().doc.publishedRevision};return clone(S().doc);},
 publishDiff:async()=>({revision:S().doc.revision,added:[],removed:[],changed:[],details:[]}),
 publish:async revision=>{Q.calls.push('publish');await wait();S().doc.publishedRevision=revision;},
 listPresets:async()=>[],listAssets:async()=>({data:[],usage:{usedBytes:0,maxBytes:1}}),listVersions:async()=>[],listCatalogs:async()=>({allergens:[],traits:[],additives:[]}),getTranslationProvider:async()=>({configured:false}),downloadQr:async()=>new Blob(),
 listDayPresets:async()=>({serviceDay:{date:'2026-10-16',weekday:5},timezone:'Europe/Rome',settings:clone(S().settings),presets:S().presets.map(strip),notices:clone(S().notices)}),
 readDayPreset:async id=>{await wait();const p=S().presets.find(x=>x.id===id);if(!p)throw new Error('Preset non trovato');return {...strip(p),sections:clone(p.sections)};},
 activateDayPresets:async(menuId,source,from)=>{Q.calls.push('activate:'+source);await wait();fail();if(!S().presets.some(p=>p.menuId===menuId)){const menu=S().doc.menus.find(m=>m.id===menuId);for(let w=1;w<=7;w++){const other=S().presets.find(p=>p.menuId===from&&p.weekday===w);S().presets.push({id:crypto.randomUUID(),menuId,name:days[w],weekday:w,position:w,revision:1,updatedAt:new Date().toISOString(),sections:source==='current'?clone(menu.sections):source==='menu'?fresh(other?.sections||[]):[]});}}setting(menuId).enabled=true;return {};},
 setDayPresetSettings:async(menuId,patch)=>{Q.calls.push('settings:'+JSON.stringify(patch));await wait();fail();const s=setting(menuId);if(patch.enabled!==undefined){s.enabled=patch.enabled;if(!patch.enabled)s.autoPublish=false;}if(patch.autoPublish!==undefined){if(patch.autoPublish&&!s.enabled)throw new Error('Attiva prima i preset per questo menu');s.autoPublish=patch.autoPublish;s.autoFromDay='2026-10-17';}return clone(s);},
 createDayPreset:async(menuId,name,source,from)=>{Q.calls.push('create:'+source);await wait();fail();const menu=S().doc.menus.find(m=>m.id===menuId);const src=S().presets.find(p=>p.id===from);const p={id:crypto.randomUUID(),menuId,name,weekday:null,position:8+S().presets.length,revision:1,updatedAt:new Date().toISOString(),sections:source==='current'?clone(menu.sections):source==='preset'?clone(src.sections):[]};S().presets.push(p);return strip(p);},
 updateDayPreset:async(id,patch)=>{Q.calls.push('update');await wait();fail();const p=S().presets.find(x=>x.id===id);if(p.revision!==patch.expectedRevision)throw Object.assign(new Error('Il preset è cambiato: ricarica prima di salvare'),{status:409});if(patch.name)p.name=patch.name;if(patch.sections)p.sections=clone(patch.sections);p.revision++;p.updatedAt=new Date().toISOString();return {...strip(p),sections:clone(p.sections)};},
 deleteDayPreset:async id=>{Q.calls.push('delete');await wait();fail();S().presets=S().presets.filter(p=>p.id!==id);S().settings.forEach(s=>{if(s.onlinePresetId===id)s.onlinePresetId=null;});return {deleted:true};},
 publishDayPreset:async(id,revision)=>{Q.calls.push('publishPreset');await wait();fail();if(revision!==S().doc.revision)throw Object.assign(new Error('Il menu è cambiato: ricarica prima di pubblicare'),{status:409});const p=S().presets.find(x=>x.id===id);const m=S().doc.menus.find(x=>x.id===p.menuId);m.sections=clone(p.sections);S().doc.revision+=2;S().doc.publishedRevision=S().doc.revision;Object.assign(setting(p.menuId),{onlinePresetId:id,onlineAt:new Date(Date.now()+1000).toISOString()});return {revision:S().doc.revision};},
 markNoticeRead:async id=>{S().notices=S().notices.filter(n=>n.id!==id);return {read:true};},
};
window.__takoRole='owner';window.__takoRestaurantId='qa';
function QaApp(){return <><ScreenMenuWorkspace mobile={innerWidth<700} adapter={window.__qaAdapter}/><Toaster/></>;}
ReactDOM.createRoot(document.getElementById('root')).render(<QaApp/>);
`;
export async function startHarness(state){
 const source=(await Promise.all(files.map(f=>readFile(resolve(staff,'src',f),'utf8')))).join('\n');
 const compiled=(await transform(source+'\n'+boot.replace('__STATE__',()=>JSON.stringify(state)),{loader:'jsx',format:'iife'})).code;
 const css=['styles.css','src/sobrio.css','src/menu-workspace.css','src/daily-menu.css','src/menu-images.css','src/menu-translations.css','src/tako-loading.css'];
 const html=`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${css.map(f=>`<link rel="stylesheet" href="/${f}">`).join('')}<body><div id="root" style="min-height:100dvh"></div><script src="/lib/react.js"></script><script src="/lib/react-dom.js"></script><script src="/fixture.js"></script></body></html>`;
 const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}if(path==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled);return;}if(path.startsWith('/api/')||path.startsWith('/menu-preview/')){res.setHeader('Content-Type','text/html');res.end('<p style="font:13px system-ui;padding:16px">Anteprima isolata (QA)</p>');return;}const file=resolve(staff,'.'+decodeURIComponent(path));if(!file.startsWith(staff+'/'))throw new Error('path');const bytes=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
