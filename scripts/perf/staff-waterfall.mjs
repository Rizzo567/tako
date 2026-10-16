import puppeteer from 'puppeteer-core'
import {sessionClient} from '../translations/common.mjs'
const api=await sessionClient()
const cookies=api.state.cookie.split(/;\s*/).filter(Boolean).map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),domain:'takoitalia.com',path:'/',secure:true}})
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
const p=await b.newPage();await p.setViewport({width:1280,height:860});await p.setCookie(...cookies)
await p.goto('https://takoitalia.com/staff/',{waitUntil:'networkidle0',timeout:90000})
const rows=await p.evaluate(()=>performance.getEntriesByType('resource').map(e=>({n:e.name.replace(location.origin,'').slice(0,90),start:Math.round(e.startTime),dur:Math.round(e.duration),kb:Math.round((e.transferSize||0)/1024),type:e.initiatorType})))
const nav=performance=await p.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {ttfb:Math.round(n.responseStart),dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd)}})
console.log(JSON.stringify(nav));for(const r of rows)console.log(String(r.start).padStart(5),String(r.dur).padStart(5),'ms',String(r.kb).padStart(5),'KB',r.type.padEnd(8),r.n)
await b.close()
