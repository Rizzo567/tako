// Misura ripetibile del menu pubblico (solo GET anonimi). Uso: node scripts/perf/verify-public-menu.mjs [base] [slug] [--json out.json]
import puppeteer from 'puppeteer-core'
import {writeFile} from 'node:fs/promises'
const args=process.argv.slice(2),base=args[0]&&!args[0].startsWith('--')?args[0]:'https://takoitalia.com',slug=args[1]&&!args[1].startsWith('--')?args[1]:'panuzza'
const out=args.includes('--json')?args[args.indexOf('--json')+1]:null,N=Number(process.env.PERF_RUNS||8)
const pct=(xs,p)=>{const s=[...xs].sort((a,b)=>a-b);return Math.round(s[Math.min(s.length-1,Math.floor(p*(s.length-1)+.5))])}
const timed=async url=>{const t=performance.now(),r=await fetch(url,{headers:{'user-agent':'takomenu-perf'}});const body=await r.arrayBuffer();return {ms:performance.now()-t,status:r.status,bytes:body.byteLength,timing:r.headers.get('server-timing')||'',cache:r.headers.get('cache-control')||'',body}}
const html=await (await fetch(`${base}/${slug}`)).text()
const asset=html.match(/src="([^"]+\/assets\/index-[^"]+\.js)"/)?.[1]
const assetHead=asset?await timed(new URL(asset,base).href):null
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run','--mute-audio']})
const result={base,slug,at:new Date().toISOString(),runs:N,api:{},browser:[],assetCacheControl:assetHead?.cache||null}
try{
 // Id ristorante e menu dal primo caricamento reale.
 const probe=await browser.newPage();let restaurantId='';probe.on('request',r=>{const m=r.url().match(/\/api\/customer\/restaurant\/([^/]+)\/menu/);if(m)restaurantId=m[1]});await probe.goto(`${base}/${slug}`,{waitUntil:'networkidle0',timeout:60000});await probe.close()
 const api=`${base}/api/customer/restaurant/${restaurantId}/menu`,first=JSON.parse(Buffer.from((await timed(api)).body).toString()),menus=first.menus.map(m=>m.id)
 const cases={default:api,switchMenu:`${api}?menuId=${menus[menus.length>1?1:0]}`,lang:`${api}?lang=en`}
 for(const [name,url] of Object.entries(cases)){const xs=[],reads=[];for(let i=0;i<N;i++){const r=await timed(url);xs.push(r.ms);const d=r.timing.match(/read;dur=([\d.]+)/);if(d)reads.push(Number(d[1]))}result.api[name]={p50:pct(xs,.5),p95:pct(xs,.95),readP50:reads.length?pct(reads,.5):null}}
 for(let run=0;run<3;run++){
  const ctx=await browser.createBrowserContext(),page=await ctx.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:2})
  // Telefono in inglese: l'inglese è la lingua «del dispositivo», il tedesco una lingua qualsiasi.
  await page.evaluateOnNewDocument(()=>{Object.defineProperty(navigator,'language',{get:()=>'en-GB'})})
  const t0=Date.now();await page.goto(`${base}/${slug}`,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForSelector('[data-menu-row]',{timeout:60000});const firstContent=Date.now()-t0
  await page.waitForNetworkIdle({idleTime:800,timeout:30000}).catch(()=>{})
  // Tempo dal tocco al menu nuovo a schermo (aria-current segue i dati mostrati).
  const tap=async index=>page.evaluate(async i=>{const tabs=[...document.querySelectorAll('[data-menu-strip] button')];const target=tabs[i];if(!target||target.getAttribute('aria-current')==='page')return null;const t=performance.now();target.click();await new Promise(r=>{const check=()=>target.getAttribute('aria-current')==='page'?r():requestAnimationFrame(check);check()});return performance.now()-t},index)
  const count=await page.$$eval('[data-menu-strip] button',b=>b.length),current=await page.$$eval('[data-menu-strip] button',b=>b.findIndex(x=>x.getAttribute('aria-current')==='page'))
  const other=(current+1)%count,switchNew=count>1?await tap(other):null,switchBack=count>1?await tap(current):null
  const pickLanguage=code=>page.evaluate(async code=>{document.querySelector('button[aria-haspopup=menu]').click();await new Promise(r=>setTimeout(r,350));const option=[...document.querySelectorAll('[role=menuitemradio]')].find(b=>b.lang===code);const s=performance.now();option.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await new Promise(r=>setTimeout(r,90));option.click();await new Promise(r=>{const c=()=>document.documentElement.lang===code?r():requestAnimationFrame(c);c()});return performance.now()-s},code)
  await new Promise(r=>setTimeout(r,2500))
  const lang=await pickLanguage('en'),langOther=await pickLanguage('de')
  result.browser.push({firstContent,switchNew:switchNew&&Math.round(switchNew),switchBack:switchBack&&Math.round(switchBack),lang:Math.round(lang),langOther:Math.round(langOther)})
  await ctx.close()
 }
}finally{await browser.close()}
const med=key=>{const xs=result.browser.map(r=>r[key]).filter(v=>v!=null);return xs.length?pct(xs,.5):null}
result.summary={firstContentMs:med('firstContent'),switchNewMs:med('switchNew'),switchBackMs:med('switchBack'),langDeviceMs:med('lang'),langOtherMs:med('langOther'),apiP95:Math.max(...Object.values(result.api).map(a=>a.p95)),immutableAssets:/immutable/.test(result.assetCacheControl||'')}
console.log(JSON.stringify(result.summary),'\n',JSON.stringify(result.api))
if(out)await writeFile(out,JSON.stringify(result,null,2))
