import {readFile,access} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {transform} from 'esbuild';
import puppeteer from 'puppeteer-core';
const root=fileURLToPath(new URL('../../apps/dashboard/public/staff/src/',import.meta.url));
const chrome=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let exists=true;try{await access(chrome)}catch{exists=false}
test('agency CRM persists edits, retains conflict drafts and fits mobile', {skip:!exists}, async()=>{
const source=await readFile(root+'21-agency-leads.js','utf8');const compiled=await transform(source,{loader:'jsx',target:'es2020'});
const css=await readFile(root+'agency-leads.css','utf8');
const row={id:'TK001',revision:1,source:{nome:'Locale QA',citta:'Roma',regione:'Lazio',priorita:'A',evidenza_frequenza:'Menu diverso ogni giorno',demoUrl:'https://example.com/demo'},status:'new',notes:'',assignee:'',callCount:0,messageCount:0};
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setContent(`<html><head><style>:root{--ink:#191a17;--ink-2:#565952;--ink-3:#777b72;--hairline:#e5e6df;--surface:#fff}body{margin:0;font-family:Arial}button{font:inherit}.scroll{padding:24px}*{box-sizing:border-box}${css}</style></head><body><div id="root"></div></body></html>`);
await page.addScriptTag({path:root+'../lib/react.js'});await page.addScriptTag({path:root+'../lib/react-dom.js'});
await page.addScriptTag({content:`const {useState,useRef,useEffect}=React; const ScreenScroll=({children})=>React.createElement('main',{className:'scroll'},children);const Btn=({children,...props})=>React.createElement('button',props,children);let item=${JSON.stringify(row)};window.requests=[];const TakoAPI={get:async p=>p==='/agency/leads'?[item]:({...item,activities:[]}),patch:async(p,b)=>{window.requests.push({p,b});if(window.failSave)throw Object.assign(Error('conflitto'),{status:409});item={...item,...b,revision:item.revision+1};return item},post:async(p,b)=>{window.requests.push({p,b});item={...item,revision:item.revision+1,callCount:item.callCount+1};return {...item,activity:{id:'a1',type:b.type,outcome:b.outcome,text:b.text,createdAt:new Date().toISOString()}}}};${compiled.code}\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(ScreenAgencyLeads,{mobile:false}));`});
await page.waitForSelector('.al-open');await page.click('.al-open');await page.waitForSelector('.al-detail');await page.waitForFunction(()=>!document.querySelector('.al-detail-body').textContent.includes('Caricamento attività'));

const inputs=await page.$$('.al-detail input');await inputs[0].type('Ale');await page.click('.al-detail .al-primary');await page.waitForFunction(()=>document.body.textContent.includes('Modifiche salvate.'));
await page.evaluate(()=>window.failSave=true);await inputs[0].type(' QA');await page.click('.al-detail .al-primary');await page.waitForFunction(()=>document.body.textContent.includes('Un collaboratore ha aggiornato'));const draft=await inputs[0].evaluate(e=>e.value);if(draft!=='Ale QA')throw Error('Conflict lost draft');
await page.setViewport({width:390,height:844});await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));assert.equal(await page.$eval('.al-detail',e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('Mobile overflow');if(errors.length)throw Error(errors.join(';'));assert.equal(await page.evaluate(()=>requests.length),2);
assert.deepEqual(await page.evaluate(()=>requests[0].b.assignee),'Ale');
}finally{await browser.close()}
});
