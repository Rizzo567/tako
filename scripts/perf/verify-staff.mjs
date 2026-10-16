// Misura ripetibile della dashboard staff (account agenzia, solo navigazione: nessun salvataggio).
// node scripts/perf/verify-staff.mjs [--json out.json]
import puppeteer from 'puppeteer-core'
import {writeFile} from 'node:fs/promises'
import {sessionClient,saveSession} from '../translations/common.mjs'
const out=process.argv.includes('--json')?process.argv[process.argv.indexOf('--json')+1]:null
const api=await sessionClient();await saveSession(api)
const cookies=api.state.cookie.split(/;\s*/).filter(Boolean).map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),domain:'takoitalia.com',path:'/',secure:true}})
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
const p=await b.newPage();await p.setViewport({width:1280,height:860});await p.setCookie(...cookies)
let calls=[],stepStart=0;const started=new Map();p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))started.set(r,Date.now())});p.on('requestfinished',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))calls.push({m:r.method(),path:u.pathname,status:r.response()?.status(),start:(started.get(r)||0)-stepStart,end:Date.now()-stepStart})})
const idle=()=>p.waitForNetworkIdle({idleTime:400,timeout:30000}).catch(()=>{})
const steps=[]
// Tempo del passo: fine dell'ultima chiamata API partita entro 2,5 s dal clic (prima ondata e chiamate a catena); il polling successivo non conta.
const step=async(name,action)=>{calls=[];stepStart=Date.now();await action();await new Promise(r=>setTimeout(r,6000));const wave=calls.filter(c=>c.start<=Number(process.env.WAVE_MS||2500));steps.push({name,ms:wave.length?Math.max(...wave.map(c=>c.end)):0,calls:wave.map(c=>`${c.m} ${c.path} ${c.status} ${c.end-c.start}ms`)})}
const clickText=(sel,text)=>p.evaluate((sel,text)=>{const el=[...document.querySelectorAll(sel)].find(e=>e.textContent.trim()===text);if(!el)throw Error('manca '+text);el.click()},sel,text)
await step('apertura dashboard',()=>p.goto('https://takoitalia.com/staff/',{waitUntil:'domcontentloaded',timeout:90000}))
await step('Apri menu (L\'Osterietta)',()=>p.evaluate(()=>{const card=[...document.querySelectorAll('h2,h3,strong,div')].find(e=>e.textContent.trim()==="L'Osterietta"&&e.children.length===0);let n=card;while(n&&!n.querySelector?.('button'))n=n.parentElement;[...n.querySelectorAll('button')].find(b=>b.textContent.trim()==='Apri menu').click()}))
for(const label of ['Report','Panoramica','Sala','Ordini','Prenotazioni','Menu','Locali'])await step(label,()=>clickText('nav[aria-label="Navigazione principale"] button, nav[aria-label="Navigazione principale"] a, aside button, aside a',label))
await b.close()
const total=steps.reduce((n,s)=>n+s.ms,0)
for(const s of steps)console.log(String(s.ms).padStart(6),'ms ',s.name.padEnd(28),s.calls.join(' · '))
console.log(JSON.stringify({totalMs:total,at:new Date().toISOString()}))
if(out)await writeFile(out,JSON.stringify({at:new Date().toISOString(),steps,totalMs:total},null,2))
