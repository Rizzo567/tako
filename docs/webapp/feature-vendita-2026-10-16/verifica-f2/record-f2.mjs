// Registrazione reale (Chrome headless, puppeteer-core) dei Preset integrati nella dashboard «Piatti».
// Uso: node record-f2.mjs <desktop|mobile> <pointer|reduced|keyboard> [cartella-uscita]
// Dashboard vera (sorgenti apps/dashboard) con finto backend in memoria (harness.mjs): nessun DB, nessuna rete esterna.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {startHarness,fixture,ROOT} from './harness.mjs';
const puppeteer=createRequire(ROOT+'/package.json')('puppeteer-core');
const [vp='desktop',mode='pointer',outArg]=process.argv.slice(2);
const OUT=outArg||path.join(import.meta.dirname,'video');
const name=`f2-${vp}-${mode}`,mobile=vp==='mobile';
const checks=[];const check=(label,ok,detail)=>{checks.push({label,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+label+(detail!==undefined?'  '+JSON.stringify(detail):''));};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const state=fixture();
const h=await startHarness(state);
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run','--no-default-browser-check','--disable-extensions','--hide-scrollbars','--mute-audio','--force-color-profile=srgb']});
let recorder;
try{
 const page=await browser.newPage();
 await page.setViewport(mobile?{width:500,height:900,deviceScaleFactor:1,isMobile:true,hasTouch:true}:{width:1280,height:860,deviceScaleFactor:1});
 if(mode==='reduced')await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/404|Failed to load resource/.test(m.text()))errors.push(m.text());});
 // Solo per il video: cerchio sul punto del tocco; campionamento a 8ms di posizione e altezza della lista.
 await page.evaluateOnNewDocument(()=>{window.__trace=[];addEventListener('DOMContentLoaded',()=>{const c=document.createElement('div');c.style.cssText='position:fixed;z-index:99999;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:2px solid #2563eb;background:#2563eb22;pointer-events:none;opacity:0';document.body.appendChild(c);const at=e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px';};addEventListener('pointermove',e=>{at(e);c.style.opacity=.7;},true);addEventListener('pointerdown',e=>{at(e);c.style.opacity=1;},true);setInterval(()=>{const w=document.querySelector('.mw-dp-list-wrap'),f=document.querySelector('.mw-dp-list-frame');if(w)window.__trace.push([Math.round(performance.now()),+new DOMMatrix(getComputedStyle(w).transform).f.toFixed(2),f?+f.getBoundingClientRect().height.toFixed(1):0]);if(window.__trace.length>20000)window.__trace.splice(0,10000);},8);});});
 await page.goto(h.origin,{waitUntil:'load'});await page.waitForSelector('.mw-dp-btn',{timeout:20000});await sleep(600);
 fs.mkdirSync(OUT,{recursive:true});
 recorder=await page.screencast({path:path.join(OUT,name+'.webm'),fps:30,quality:20,ffmpegPath:'/opt/homebrew/bin/ffmpeg'});await sleep(500);
 const box=async sel=>{const el=await page.waitForSelector(sel,{visible:true,timeout:8000});await el.evaluate(e=>e.scrollIntoView({block:'center'}));await sleep(mode==='reduced'?50:250);return el.boundingBox();};
 const tapXY=async(x,y)=>{if(mobile)await page.touchscreen.tap(x,y);else{await page.mouse.move(x,y,{steps:8});await page.mouse.click(x,y);}};
 const tap=async sel=>{const b=await box(sel);await tapXY(b.x+b.width/2,b.y+b.height/2);};
 const quick=async sel=>{const el=await page.$(sel);const b=await el.boundingBox();if(mobile)await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);else await page.mouse.click(b.x+b.width/2,b.y+b.height/2);};
 const byText=async(text,scope='button')=>{const handle=await page.waitForFunction((t,s)=>[...document.querySelectorAll(s)].find(e=>e.offsetParent&&e.textContent.replace(/\s+/g,' ').trim().startsWith(t)),{timeout:8000},text,scope);return handle.asElement();};
 const tapText=async(text,scope)=>{const el=await byText(text,scope);await el.evaluate(e=>e.scrollIntoView({block:'center'}));await sleep(mode==='reduced'?50:250);const b=await el.boundingBox();await tapXY(b.x+b.width/2,b.y+b.height/2);};
 const st=()=>page.evaluate(()=>{const b=document.querySelector('.mw-dp-btn'),w=document.querySelector('.mw-dp-list-wrap');return {expanded:b?.getAttribute('aria-expanded'),label:b?.querySelector('.mw-dp-label')?.textContent,y:w?+new DOMMatrix(getComputedStyle(w).transform).f.toFixed(1):null,dishes:[...document.querySelectorAll('.mw-catalog-section .mw-category-toggle .mw-catalog-category-name')].map(e=>e.textContent),counts:[...document.querySelectorAll('.mw-catalog-section .mw-category-toggle small')].map(e=>+e.textContent),current:document.querySelector('.mw-dp-chip[aria-current=true]')?.textContent,focus:document.activeElement?.className+'|'+(document.activeElement?.textContent||'').trim().slice(0,30)};});
 const typeInto=async(sel,value)=>{await page.waitForSelector(sel,{visible:true});await page.$eval(sel,e=>{e.scrollIntoView({block:'center'});e.focus();e.select();});await page.keyboard.type(String(value));};
 const qa=()=>page.evaluate(()=>window.__qa);
 const menuOf=(s,id)=>s.state.doc.menus.find(m=>m.id===id);
 const settle=()=>sleep(mode==='reduced'?120:900);

 if(mode!=='keyboard'){
  // 1. Pulsante spento → pannello «Attiva i preset per Pranzo» (M06: lista scende, poi il contenuto).
  check('barra variante A: [Menu] [Preset] … [cerca] [+]',await page.evaluate(()=>{const t=document.querySelector('.mw-studio-toolbar');const r=s=>t.querySelector(s).getBoundingClientRect();return r('.mw-menu-picker').right<=r('.mw-dp-btn').left&&r('.mw-dp-btn').right<r('.mw-studio-toolbuttons').left-20;}));
  check('Preset spento finché non si attiva',(await page.$eval('.mw-dp-btn',b=>b.className)).includes('is-off'));
  const t0=Date.now();await tap('.mw-dp-btn');
  if(mode==='reduced'){await sleep(40);const s=await st();check('reduced motion: lista già a fine corsa dopo 40ms',s.y>50,s);}
  await settle();let s=await st();
  check('apertura: aria-expanded=true e lista scesa sotto il vassoio',s.expanded==='true'&&s.y>50,s);
  check('pannello «Attiva i preset per Pranzo» con tre scelte',await page.evaluate(()=>{const t=document.querySelector('.mw-dp-activate-title')?.textContent;const o=[...document.querySelectorAll('.mw-dp-option strong')].map(e=>e.textContent);return t==='Attiva i preset per Pranzo'&&o.length===3&&o.some(x=>x.startsWith('Copia i giorni da Cena'));}));
  await tapText('Copia i giorni da Cena','.mw-dp-option');await sleep(80);
  check('attesa reale: aria-busy durante la richiesta (M05)',await page.evaluate(()=>!!document.querySelector('.mw-dp-option[aria-busy=true]')));
  await page.waitForSelector('.mw-dp-chip',{visible:true});await settle();
  const chips=await page.$$eval('.mw-dp-chip',c=>c.map(x=>x.querySelector('[aria-hidden=true]')?.textContent||x.textContent));
  check('chip Lun–Dom, + Nuovo, Menu attuale',JSON.stringify(chips.slice(0,7))===JSON.stringify(['Lun','Mar','Mer','Gio','Ven','Sab','Dom'])&&chips.length===9,chips);
  check('segno «oggi» su Venerdì',await page.evaluate(()=>[...document.querySelectorAll('.mw-dp-chip')].find(c=>c.textContent.startsWith('Ven'))?.querySelector('.mw-dp-chip-tag')?.textContent.includes('oggi')));
  // 2. Lunedì: i chip escono, il pulsante diventa «Lunedì», la lista risale con il contenuto del preset; l'altezza converge.
  const before=(await st()).counts;
  await page.evaluate(()=>{window.__trace.length=0;});
  await tapText('Lun','.mw-dp-chip');await sleep(mode==='reduced'?200:1300);s=await st();
  const tr=await page.evaluate(()=>window.__trace.slice());
  check('scelta Lunedì: vassoio chiuso, etichetta «Lunedì», contenuto del preset',s.expanded==='false'&&s.label==='Lunedì'&&JSON.stringify(s.dishes)==='["Primi"]'&&s.y===0,{s,before});
  const hs=[...new Set(tr.map(t=>t[2]).filter(Boolean))];
  if(mode==='reduced')check('reduced motion: altezza cambiata senza valori intermedi',hs.length<=2,hs.slice(0,6));
  else check('altezza della lista animata (valori intermedi tra vecchia e nuova)',hs.length>4,{n:hs.length,first:hs[0],last:hs.at(-1)});
  check('barra del preset con stato e azioni',await page.evaluate(()=>!!document.querySelector('.mw-dp-bar')&&[...document.querySelectorAll('.mw-dp-bar button')].map(b=>b.textContent).join('|').includes('Pubblica questo preset adesso')));
  // 3. Tocchi rapidi: aprire e richiudere a metà corsa riparte dal valore corrente (nessun salto, nessuna coda).
  if(mode!=='reduced'){
   await box('.mw-dp-btn');
   await page.evaluate(()=>{window.__retarget=[];let before=null;const w=()=>document.querySelector('.mw-dp-list-wrap');addEventListener('click',e=>{before=e.target.closest('.mw-dp-btn')?new DOMMatrix(getComputedStyle(w()).transform).f:null;},true);addEventListener('click',()=>{if(before===null)return;getComputedStyle(w()).transform;const t=w().getAnimations().find(a=>a.transitionProperty==='transform');const k=t?.effect.getKeyframes();window.__retarget.push({before:+before.toFixed(1),start:k?+new DOMMatrix(k[0].transform).f.toFixed(1):null,end:k?+new DOMMatrix(k[k.length-1].transform).f.toFixed(1):null});before=null;});});
   await quick('.mw-dp-btn');await page.waitForFunction(()=>{const w=document.querySelector('.mw-dp-list-wrap');const y=new DOMMatrix(getComputedStyle(w).transform).f;return y>20&&y<120;},{timeout:3000,polling:'raf'}).catch(()=>{});await quick('.mw-dp-btn');await sleep(30);
   const rt=await page.evaluate(()=>window.__retarget);await sleep(700);
   const last=rt.at(-1);
   check('tocchi rapidi: la chiusura riparte dal valore corrente (primo keyframe = valore al tocco), nessun lock',rt.length>=2&&last&&last.before>0&&Math.abs(last.start-last.before)<2&&last.end===0,rt);
   s=await st();check('dopo i tocchi rapidi: chiuso e fermo',s.expanded==='false'&&s.y===0,s);
  }
  // 4. Modifica non salvata + cambio preset ⇒ «Salva o scarta»; Salva scrive il preset, poi cambia giorno.
  await tap('.mw-catalog-section .mw-category-toggle');await sleep(400);
  const priceSel='input[aria-label="Prezzo Pasta e ceci"]';await page.waitForSelector(priceSel,{visible:true});
  await typeInto(priceSel,'9.5');await page.keyboard.press('Tab');await sleep(300);
  await tap('.mw-dp-btn');await settle();await tapText('Mar','.mw-dp-chip');
  await page.waitForSelector('dialog.mw-dp-dialog[open]',{visible:true});await sleep(500);
  check('cambio con modifiche aperte: dialogo «Salva o scarta» con focus su Salva',await page.evaluate(()=>document.activeElement?.textContent==='Salva'&&document.querySelector('#mw-dp-dlg-title').textContent==='Salvare le modifiche a «Lunedì»?'));
  await tapText('Salva','dialog.mw-dp-dialog button');await sleep(100);
  check('Salva: attesa reale (aria-busy)',await page.evaluate(()=>!!document.querySelector('dialog.mw-dp-dialog [aria-busy=true]')));
  await sleep(700);const dlgErr=await page.evaluate(()=>document.querySelector('dialog.mw-dp-dialog [role=alert]')?.textContent||'');if(dlgErr)check('dialogo senza errori',false,dlgErr);
  await page.waitForFunction(()=>!document.querySelector('dialog.mw-dp-dialog'),{timeout:8000});await sleep(1300);
  let q=await qa();s=await st();
  const mon=q.state.presets.find(p=>p.menuId===state.ids.pranzo&&p.weekday===1);
  check('preset Lunedì salvato (prezzo 9,5) e documento del menu intatto',mon.sections[0].items[0].price===9.5&&q.calls.includes('update')&&!q.calls.includes('save')&&menuOf(q,state.ids.pranzo).sections.length===3,{price:mon.sections[0].items[0].price,calls:q.calls.slice(-6)});
  check('poi si apre Martedì',s.label==='Martedì'&&s.counts.reduce((a,b)=>a+b,0)===5,s);
  // 5. «Pubblica questo preset adesso» → OK → online.
  await tapText('Pubblica questo preset adesso','.mw-dp-bar button');
  await page.waitForSelector('dialog.mw-publish-dialog[open]',{visible:true});await sleep(500);
  check('dialogo di pubblicazione del preset',await page.$eval('#mw-publish-title',e=>e.textContent)==='Mettere online «Martedì»?');
  await tapText('Pubblica','dialog.mw-publish-dialog button');await page.waitForFunction(()=>!document.querySelector('dialog.mw-publish-dialog'),{timeout:8000});await sleep(1200);
  q=await qa();
  check('Martedì online: il menu pubblico è il preset, segno «online» sulla barra',JSON.stringify(menuOf(q,state.ids.pranzo).sections.map(x=>x.name))==='["Primi","Secondi","Dolci"]'&&menuOf(q,state.ids.pranzo).sections[0].items[0].name==='Gnocchi al pomodoro'&&await page.evaluate(()=>document.querySelector('.mw-dp-bar-title')?.textContent.includes('online')),menuOf(q,state.ids.pranzo).sections[0].items.map(i=>i.name));
  // 6. Modifica del preset di oggi già online: salva ⇒ il pubblico non cambia finché non c'è l'OK; poi «Aggiorna online».
  await tap('.mw-catalog-section .mw-category-toggle');await sleep(400);
  const g='input[aria-label="Prezzo Gnocchi al pomodoro"]';await typeInto(g,'11');await page.keyboard.press('Tab');await sleep(200);
  await tapText('Pubblica preset','button');await page.waitForSelector('dialog.mw-publish-dialog[open]',{visible:true});await sleep(400);
  q=await qa();check('preset online modificato e salvato: pubblico ancora a 10 prima dell’OK',menuOf(q,state.ids.pranzo).sections[0].items[0].price===10&&q.state.presets.find(p=>p.menuId===state.ids.pranzo&&p.weekday===2).sections[0].items[0].price===11);
  await tapText('Pubblica','dialog.mw-publish-dialog button');await page.waitForFunction(()=>!document.querySelector('dialog.mw-publish-dialog'),{timeout:8000});await sleep(1000);
  q=await qa();check('dopo l’OK il pubblico mostra 11',menuOf(q,state.ids.pranzo).sections[0].items[0].price===11);
  // 7. Rinomina.
  await tapText('Rinomina','.mw-dp-bar button');const r='input[aria-label="Nuovo nome del preset"]';await page.waitForSelector(r);await typeInto(r,'Martedì gnocchi');await tapText('Salva nome','.mw-dp-bar button');await sleep(1500);
  s=await st();check('rinomina: etichetta e preset aggiornati',s.label==='Martedì gnocchi'&&(await qa()).state.presets.some(p=>p.name==='Martedì gnocchi'),s.label);
  // 8. + Nuovo (copia di Venerdì) e poi Elimina con conferma.
  await tap('.mw-dp-btn');await settle();await tapText('+ Nuovo','.mw-dp-chip');await page.waitForSelector('.mw-dp-create input');await sleep(300);
  await page.type('.mw-dp-create input','Venerdì pesce');const fri=(await qa()).state.presets.find(p=>p.menuId===state.ids.pranzo&&p.weekday===5);await page.select('.mw-dp-create select','preset:'+fri.id);await sleep(200);
  await tapText('Crea preset','.mw-dp-create button');await sleep(2000);
  s=await st();check('nuovo preset con nome libero, copia di Venerdì, aperto',s.label==='Venerdì pesce'&&s.counts.join()==='3',s);
  await tapText('Elimina','.mw-dp-bar button');await page.waitForSelector('dialog.mw-dp-dialog[open]');await sleep(500);
  check('elimina chiede conferma',await page.$eval('#mw-dp-dlg-title',e=>e.textContent)==='Eliminare «Venerdì pesce»?');
  await tapText('Elimina','dialog.mw-dp-dialog button');await page.waitForFunction(()=>!document.querySelector('dialog.mw-dp-dialog'),{timeout:8000});await sleep(1300);
  s=await st();q=await qa();check('eliminato: si torna al menu attuale',s.label==='Preset'&&!q.state.presets.some(p=>p.name==='Venerdì pesce'),s);
  // 9. Interruttore «Pubblica in automatico» (M08) e chip «Menu attuale».
  await tap('.mw-dp-btn');await settle();await tap('.mw-dp-switch');await sleep(80);
  check('interruttore: cambia al gesto',await page.$eval('.mw-dp-switch',b=>b.getAttribute('aria-checked'))==='true');
  await sleep(900);q=await qa();check('interruttore salvato sul server',q.state.settings.find(x=>x.menuId===state.ids.pranzo).autoPublish===true);
  // 10. Esc chiude senza cambiare, focus al pulsante; tocco fuori chiude.
  await page.keyboard.press('Escape');await settle();s=await st();
  check('Esc: chiude, nessun cambio, focus sul pulsante',s.expanded==='false'&&s.label==='Preset'&&s.focus.startsWith('mw-dp-btn'),s);
  await tap('.mw-dp-btn');await settle();await tapXY(mobile?250:640,mobile?860:830);await settle();s=await st();
  check('tocco fuori: chiude',s.expanded==='false',s);
  // 11. Drinks: niente Preset. Ritorno a Pranzo: ricompare.
  await tap('.mw-menu-picker');await sleep(400);await tapText('Drinks','.mw-menu-options button');await settle();
  check('Drinks: pulsante Preset assente',!(await page.$('.mw-dp-btn')));
  await tap('.mw-menu-picker');await sleep(400);await tapText('Pranzo','.mw-menu-options button');await settle();
  check('Pranzo: pulsante Preset di nuovo presente',!!(await page.$('.mw-dp-btn')));
  // 12. Impostazioni menu: torna al menu unico senza perdere i preset, poi riattiva.
  const count=(await qa()).state.presets.filter(p=>p.menuId===state.ids.pranzo).length;
  await tapText('Altre azioni');await sleep(500);await tapText('Impostazioni menu','.mw-action-grid button');await page.waitForSelector('.mw-dp-settings');await sleep(400);
  await tapText('Preset attivi','.mw-dp-settings .mw-dp-switch');await sleep(1500);q=await qa();
  check('menu unico: preset spenti ma tutti salvati',q.state.settings.find(x=>x.menuId===state.ids.pranzo).enabled===false&&q.state.presets.filter(p=>p.menuId===state.ids.pranzo).length===count,{count});
  await tap('.mw-dp-btn');await settle();
  check('riattivazione proposta con i preset salvati',(await page.$eval('.mw-dp-option strong',e=>e.textContent))===`Riattiva i ${count} preset salvati`);
  await tap('.mw-dp-option');await sleep(1500);q=await qa();
  check('riattivati senza perdite',q.state.settings.find(x=>x.menuId===state.ids.pranzo).enabled===true&&q.state.presets.filter(p=>p.menuId===state.ids.pranzo).length===count&&!!(await page.$('.mw-dp-chip')));
  await page.keyboard.press('Escape');await settle();
 } else {
  // Tastiera: Tab fino a Preset, Freccia giù apre con focus sul chip corrente, frecce, Invio, Esc; errore + riprova nel dialogo.
  await page.evaluate(()=>{window.__qa.latency=300;});
  await page.focus('.mw-menu-picker');await page.keyboard.press('Tab');let s=await st();
  check('Tab porta al pulsante Preset (focus visibile)',s.focus.startsWith('mw-dp-btn')&&await page.$eval('.mw-dp-btn',b=>getComputedStyle(b).outlineStyle!=='none'),s.focus);
  await page.keyboard.press('Enter');await settle();
  check('Invio apre il pannello di attivazione',(await st()).expanded==='true');
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.waitForSelector('.mw-dp-chip',{visible:true});await settle();
  await page.keyboard.press('Escape');await settle();s=await st();
  check('Esc chiude e riporta il focus al pulsante',s.expanded==='false'&&s.focus.startsWith('mw-dp-btn'),s);
  await page.keyboard.press('ArrowDown');await settle();s=await st();
  check('Freccia giù apre con il focus sul chip corrente (Menu attuale)',s.expanded==='true'&&s.focus.includes('Menu attuale'),s);
  await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');s=await st();
  check('frecce e Home spostano il focus tra i chip (roving tabindex)',s.focus.includes('Mer'),s.focus);
  await page.keyboard.press('Enter');await sleep(1300);s=await st();
  check('Invio sceglie Mercoledì: aria-current e etichetta',s.label==='Mercoledì'&&s.expanded==='false',s);
  await page.keyboard.press('Enter');await settle();
  check('riaperto: aria-current sul giorno scelto',(await st()).current?.startsWith('Mer'));
  // Modifica, poi cambio con errore di rete al primo Salva: dati conservati, riprova riesce.
  await page.keyboard.press('Escape');await settle();
  await page.evaluate(()=>document.querySelector('.mw-catalog-section .mw-category-toggle').click());await sleep(300);
  const p='input[aria-label="Prezzo Lasagna"]';await page.focus(p);await page.keyboard.down('Meta');await page.keyboard.press('a');await page.keyboard.up('Meta');await page.keyboard.type('12');
  await page.focus('.mw-dp-btn');await page.keyboard.press('ArrowDown');await settle();await page.keyboard.press('End');await page.keyboard.press('Enter');
  await page.waitForSelector('dialog.mw-dp-dialog[open]');await sleep(400);
  await page.evaluate(()=>{window.__qa.failNext=1;});await page.keyboard.press('Enter');await sleep(900);
  check('errore al salvataggio: messaggio role=alert, dialogo aperto, dati conservati',await page.evaluate(()=>!!document.querySelector('dialog.mw-dp-dialog[open] [role=alert]'))&&await page.$eval(p,e=>e.value).then(v=>v.includes('12')));
  await page.evaluate(()=>document.querySelector('dialog.mw-dp-dialog [data-autofocus]').focus());await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('dialog.mw-dp-dialog'),{timeout:8000});await sleep(1300);
  const q=await qa();s=await st();
  check('riprova: salvato e poi «Menu attuale»',q.state.presets.find(x=>x.menuId===state.ids.pranzo&&x.weekday===3).sections[0].items[0].price===12&&s.label==='Preset',{s});
  // Esc nel dialogo = Annulla; Tab fuori dal vassoio lo chiude.
  await page.focus('.mw-dp-btn');await page.keyboard.press('ArrowDown');await settle();
  for(let i=0;i<14;i++){await page.keyboard.press('Tab');if(!(await page.evaluate(()=>document.activeElement?.closest?.('.mw-dp-tray'))))break;}
  await settle();check('Tab fuori dal vassoio lo chiude',(await st()).expanded==='false');
  check('aree tocco ≥44px (chip, interruttore, pulsanti)',await page.evaluate(()=>[...document.querySelectorAll('.mw-dp-chip,.mw-dp-switch,.mw-dp-pill')].every(e=>{const r=e.getBoundingClientRect();return !r.width||r.height>=44;})));
 }
 check('nessuno scroll orizzontale',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 check('nessun errore JavaScript',errors.length===0,errors.slice(0,5));
 await sleep(400);
}finally{
 try{await recorder?.stop();}catch{}
 await browser.close();await h.close();
 fs.writeFileSync(path.join(OUT,name+'-checks.json'),JSON.stringify({name,checks,passed:checks.filter(c=>c.ok).length,total:checks.length},null,1));
 console.log(`${checks.filter(c=>c.ok).length}/${checks.length} PASS`);
}
