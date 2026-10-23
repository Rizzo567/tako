// 23/10 — istantanee pagine pubbliche (Victoria, Bim Bum Bar, L'Agorà) per confronto prima/dopo. Uso: node scripts/shoot-public-fisso-1023.mjs <prima|dopo>
import puppeteer from 'puppeteer-core'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),tag=process.argv[2]||'prima'
const OUT=resolve(repo,'docs/webapp/dashboard-editor-2026-10-22/fisso-pagina-1023',tag);await mkdir(OUT,{recursive:true})
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const SLUGS=['victoria-bar','bim-bum-bar','l-agora']
const VPS=[{w:390,h:844,m:true},{w:430,h:932,m:true},{w:1280,h:900,m:false}]
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox','--hide-scrollbars']})
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),info={}
try{for(const slug of SLUGS)for(const vp of VPS){
 const page=await browser.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message))
 await page.emulate({viewport:{width:vp.w,height:vp.h,deviceScaleFactor:vp.m?3:1,isMobile:vp.m,hasTouch:vp.m},userAgent:vp.m?UA:(await browser.userAgent())})
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
 await page.goto(`https://takoitalia.com/${slug}?t=${Date.now()}`,{waitUntil:'networkidle2',timeout:60000})
 await page.waitForSelector('[data-menu-row]',{timeout:30000});await sleep(2500)
 const menus=await page.$$eval('[data-menu-strip] button',b=>b.map(x=>x.textContent.trim()))
 for(let i=0;i<Math.max(1,menus.length);i++){
  if(menus.length){await page.evaluate(i=>document.querySelectorAll('[data-menu-strip] button')[i].click(),i);await sleep(2500);await page.evaluate(()=>window.scrollTo(0,0));await sleep(600)}
  const name=(menus[i]||'menu').toLowerCase().replace(/[^a-z0-9]+/g,'-')
  const meta=await page.evaluate(()=>({pills:[...document.querySelectorAll('[data-category]')].map(b=>b.textContent.trim()),sections:[...document.querySelectorAll('[data-category-page] section h2')].map(h=>h.textContent.trim()),box:!!document.querySelector('[data-fixed-price-box]'),hscroll:document.documentElement.scrollWidth>innerWidth,formula:[...document.querySelectorAll('[data-formula-row] span, [data-formula-note], [data-menu-included]')].slice(0,3).map(e=>getComputedStyle(e).fontSize)}))
  info[`${slug}/${vp.w}/${name}`]={...meta,errs}
  await page.screenshot({path:resolve(OUT,`${slug}-${vp.w}-${name}.png`),fullPage:true})
 }
 await page.close()}
}finally{await writeFile(resolve(OUT,'info.json'),JSON.stringify(info,null,1));await browser.close()}
console.log(JSON.stringify(info,null,1))
