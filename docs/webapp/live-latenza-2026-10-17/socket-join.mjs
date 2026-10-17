// Tempo dall'apertura della pagina pubblica del QA all'aggancio del canale live (phx_reply ok), headless, N aperture.
// Uso: node docs/webapp/live-latenza-2026-10-17/socket-join.mjs [N=5] [--local=<dir build>]  (con --local pagina e asset dalla build locale)
import {readFile,stat} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve,dirname,extname} from 'node:path';import {fileURLToPath} from 'node:url'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../..'),require=createRequire(resolve(repo,'package.json')),puppeteer=require('puppeteer-core')
const N=Number(process.argv.find(a=>/^\d+$/.test(a))||5),LOCAL=(process.argv.find(a=>a.startsWith('--local='))||'').slice(8),QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',BASE='https://takoitalia.com'
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'}
const exists=async f=>{try{return (await stat(f)).isFile()}catch{return false}}
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run','--mute-audio']}),out=[]
for(let i=0;i<N;i++){const ctx=await browser.createBrowserContext(),page=await ctx.newPage();await page.setViewport({width:500,height:900})
 if(LOCAL){await page.setRequestInterception(true);page.on('request',async req=>{const u=new URL(req.url());let f=null;if(u.origin===BASE&&u.pathname===`/r/${QA}/menu`)f=resolve(LOCAL,'index.html');else if(u.origin===BASE&&u.pathname.startsWith('/takomenu-public/')){const c=resolve(LOCAL,'.'+u.pathname.slice(16));if(await exists(c))f=c}if(!f)return req.continue();req.respond({status:200,headers:{'Content-Type':types[extname(f)]||'application/octet-stream'},body:await readFile(f)})})}
 const cdp=await page.createCDPSession();await cdp.send('Network.enable');let t0=0,menuAt=0,joinAt=0
 cdp.on('Network.webSocketFrameReceived',e=>{if(!joinAt&&/"phx_reply"/.test(e.response.payloadData)&&/menu-live/.test(e.response.payloadData)&&/"ok"/.test(e.response.payloadData))joinAt=Date.now()})
 cdp.on('Network.responseReceived',e=>{if(!menuAt&&/\/api\/customer\/restaurant\/.+\/menu/.test(e.response.url))menuAt=Date.now()})
 t0=Date.now();await page.goto(`${BASE}/r/${QA}/menu`,{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-item-id]',{timeout:30000});const shownAt=Date.now()
 for(let w=0;!joinAt&&w<10000;w+=50)await new Promise(r=>setTimeout(r,50))
 out.push({menuMs:menuAt-t0,shownMs:shownAt-t0,joinedMs:joinAt?joinAt-t0:null,joinAfterShownMs:joinAt?joinAt-shownAt:null});await ctx.close()}
await browser.close();const med=k=>{const s=out.map(o=>o[k]).filter(x=>x!=null).sort((a,b)=>a-b);return s[Math.floor(s.length/2)]}
console.log(JSON.stringify({local:!!LOCAL,runs:out,median:{menuMs:med('menuMs'),shownMs:med('shownMs'),joinedMs:med('joinedMs'),joinAfterShownMs:med('joinAfterShownMs')}}))
