// Sonda della dashboard staff con l'account agenzia (solo letture). node scripts/perf/staff-probe.mjs <out-dir>
import puppeteer from 'puppeteer-core'
import {sessionClient,saveSession} from '../translations/common.mjs'
const out=process.argv[2]||'/tmp'
const api=await sessionClient();await api.call('/api/auth/me').catch(()=>{});await saveSession(api)
const cookies=api.state.cookie.split(/;\s*/).filter(Boolean).map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),domain:'takoitalia.com',path:'/',secure:true}})
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
const p=await b.newPage();await p.setViewport({width:1280,height:860});await p.setCookie(...cookies)
const calls=[];p.on('requestfinished',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/')){const t=r.response()?.timing();calls.push({path:u.pathname+u.search,ms:t?Math.round(t.receiveHeadersEnd-t.sendStart):null,status:r.response()?.status(),at:Date.now()})}})
const t0=Date.now();await p.goto('https://takoitalia.com/staff/',{waitUntil:'networkidle0',timeout:90000});const loadMs=Date.now()-t0
await new Promise(r=>setTimeout(r,1500))
const nav=await p.evaluate(()=>[...document.querySelectorAll('nav[aria-label="Navigazione principale"] button, nav[aria-label="Navigazione principale"] a')].map(b=>b.textContent.trim()).filter(Boolean))
await p.screenshot({path:out+'/staff-home.png'})
console.log(JSON.stringify({loadMs,nav,calls:calls.map(c=>({path:c.path,ms:c.ms,status:c.status,t:c.at-t0}))},null,1))
await b.close()
