// Verifica SOLO LETTURA della pagina Lead/CRM agenzia su https://takoitalia.com/staff/?view=leads.
// Uso: taskpolicy -b node docs/webapp/feature-vendita-2026-10-16/verifica-lead/verifica-lead.mjs
// Sessione agenzia propria (login con common.mjs, NON salvata in session.txt), logout alla fine e verifica 401.
// Chrome headless (puppeteer-core, come gli altri verifier del repo); ogni POST/PUT/PATCH/DELETE verso /api/ viene bloccato.
// Nessun segreto/cookie nei file prodotti.
import {writeFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url'
import {client,login,base} from '../../../../scripts/translations/common.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..'),require=createRequire(resolve(repo,'package.json'))
const puppeteer=require('puppeteer-core'),chrome=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const result={at:new Date().toISOString(),url:base+'/staff/?view=leads',checks:{},consoleErrors:[],pageErrors:[],httpErrors:[],blockedWrites:[],logout:{}}
const shot=n=>resolve(here,n)
const api=client();await login(api)
let browser
try{
 const leads=(await api.call('/api/agency/leads')).data
 result.api={count:leads.length,byStatus:leads.reduce((m,l)=>(m[l.status]=(m[l.status]||0)+1,m),{}),withDemoUrl:leads.filter(l=>l.source?.demoUrl).length,withSito:leads.filter(l=>l.source?.sito).length}
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-first-run','--no-default-browser-check']})
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000})
 const cookies=api.state.cookie.split('; ').filter(Boolean).map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),domain:'takoitalia.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}})
 await page.setCookie(...cookies)
 await page.setRequestInterception(true)
 page.on('request',req=>{const u=new URL(req.url()),m=req.method();if(u.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(m)&&!/^\/api\/auth\/(login|logout)$/.test(u.pathname)){result.blockedWrites.push({method:m,path:u.pathname});return req.abort('blockedbyclient')}req.continue()})
 page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text().slice(0,300))})
 page.on('pageerror',e=>result.pageErrors.push(String(e.message).slice(0,300)))
 page.on('response',r=>{if(r.status()>=400)result.httpErrors.push({status:r.status(),url:r.url().replace(/[?#].*/,'')})})
 await page.goto(result.url,{waitUntil:'networkidle2',timeout:60000})
 await page.waitForSelector('.al-table tbody tr',{timeout:30000})
 const listInfo=()=>page.evaluate(()=>({rows:document.querySelectorAll('.al-table tbody tr').length,withStatus:[...document.querySelectorAll('.al-table tbody tr')].filter(tr=>tr.querySelector('.al-status')?.textContent.trim()).length,withOpen:document.querySelectorAll('.al-table tbody tr .al-open').length,counter:document.querySelector('.al-list-head [role=status]')?.textContent.trim(),metric:document.querySelector('.al-metrics strong')?.textContent.trim(),ids:[...document.querySelectorAll('.al-table tbody tr .al-meta')].map(e=>e.textContent.split(' · ')[0].trim())}))
 const list=await listInfo();await page.screenshot({path:shot('01-lista.png'),fullPage:false})
 const apiIds=new Set(leads.map(l=>l.id)),sameIds=list.ids.length===apiIds.size&&list.ids.every(i=>apiIds.has(i))
 result.checks.c1_load={ok:!result.pageErrors.length&&!result.consoleErrors.length&&!result.httpErrors.length,evidence:{consoleErrors:result.consoleErrors.length,pageErrors:result.pageErrors.length,httpErrors:result.httpErrors.length}}
 result.checks.c2_rows={ok:list.rows===leads.length&&list.withStatus===list.rows&&list.withOpen===list.rows&&sameIds,evidence:{uiRows:list.rows,apiCount:leads.length,rowsWithStatus:list.withStatus,rowsWithOpenButton:list.withOpen,sameIdsAsApi:sameIds,counter:list.counter,metricTotal:list.metric}}
 // 3a filtro stato: lo stato presente meno frequente (ma >0) e diverso dal totale
 const statuses=Object.entries(result.api.byStatus).sort((a,b)=>a[1]-b[1]),[pick,expected]=statuses.find(([,n])=>n<leads.length)||statuses[0]
 await page.select('.al-filterbar label:nth-of-type(2) select',pick);await new Promise(r=>setTimeout(r,400))
 const f=await listInfo();await page.screenshot({path:shot('02-filtro-stato.png')})
 const statusTexts=await page.$$eval('.al-table tbody tr .al-status',e=>[...new Set(e.map(x=>x.className))])
 await page.select('.al-filterbar label:nth-of-type(2) select','all')
 // 3b ricerca: città del primo lead
 const term=leads.find(l=>l.source?.citta)?.source.citta
 const expSearch=leads.filter(row=>{const s=row.source||{};return [s.nome,s.citta,s.regione,row.assignee,row.id].join(' ').toLocaleLowerCase().includes(term.toLocaleLowerCase())}).length
 await page.type('.al-filterbar input[type=search]',term);await new Promise(r=>setTimeout(r,400))
 const s=await listInfo();await page.screenshot({path:shot('03-ricerca.png')})
 // ricerca senza risultati
 await page.$eval('.al-filterbar input[type=search]',e=>e.select());await page.type('.al-filterbar input[type=search]','zzqq-nessuno');await new Promise(r=>setTimeout(r,300))
 const empty=await page.evaluate(()=>({rows:document.querySelectorAll('.al-table tbody tr').length,emptyText:document.querySelector('.al-empty h2')?.textContent}))
 await page.$eval('.al-filterbar input[type=search]',e=>e.select());await page.keyboard.press('Backspace');await new Promise(r=>setTimeout(r,300))
 const reset=await listInfo()
 result.checks.c3_filters={ok:f.rows===expected&&statusTexts.length===1&&statusTexts[0].includes('al-status-'+pick)&&s.rows===expSearch&&s.rows<leads.length&&empty.rows===0&&reset.rows===leads.length,evidence:{statusFilter:{status:pick,uiRows:f.rows,apiExpected:expected,classes:statusTexts,counter:f.counter},search:{term,uiRows:s.rows,apiExpected:expSearch,counter:s.counter},noMatch:empty,afterReset:reset.rows}}
 // 4 scheda: lead con demoUrl se c'è
 const target=leads.find(l=>l.source?.demoUrl&&l.source?.sito)||leads.find(l=>l.source?.demoUrl)||leads[0]
 await page.type('.al-filterbar input[type=search]',target.id);await new Promise(r=>setTimeout(r,300))
 await page.click('.al-table tbody tr .al-open');await page.waitForSelector('.al-detail',{timeout:15000})
 await page.waitForFunction(()=>!document.querySelector('.al-detail-body')?.textContent.includes('Caricamento attività'),{timeout:20000})
 const detailApi=await api.call('/api/agency/leads/'+encodeURIComponent(target.id)),dl=detailApi.data?.lead||detailApi.data
 const d=await page.evaluate(()=>{const p=document.querySelector('.al-detail');const sel=[...p.querySelectorAll('form')][0]?.querySelector('select');return {title:p.querySelector('#al-detail-title')?.textContent,eyebrow:p.querySelector('.al-eyebrow')?.textContent,links:[...p.querySelectorAll('.al-reference-links a')].map(a=>({text:a.textContent.trim(),host:(()=>{try{return new URL(a.href).host}catch{return a.href.slice(0,4)}})()})),error:p.querySelector('[role=alert]')?.textContent||null,statusSelect:sel?{exists:true,disabled:sel.disabled,value:sel.value,options:sel.options.length}:{exists:false},saveButton:(()=>{const b=p.querySelector('form .al-primary');return b?{text:b.textContent.trim(),disabled:b.disabled}:null})()}})
 await page.screenshot({path:shot('04-scheda-stato.png')})
 result.checks.c4_detail={ok:d.title===(dl?.source?.nome||target.id)&&!d.error&&d.links.length>0,evidence:{leadId:target.id,title:d.title,apiTitle:dl?.source?.nome,links:d.links,error:d.error,activitiesApi:(detailApi.data?.activities||[]).length}}
 result.checks.c5_statusControl={ok:d.statusSelect.exists&&!d.statusSelect.disabled&&d.statusSelect.value===dl?.status&&d.statusSelect.options===11,evidence:{...d.statusSelect,apiStatus:dl?.status,saveButton:d.saveButton,note:'stato NON modificato, nessun salvataggio cliccato'}}
 // chiusura scheda senza modifiche
 await page.keyboard.press('Escape');await new Promise(r=>setTimeout(r,500))
 result.closedCleanly=await page.evaluate(()=>!document.querySelector('.al-detail'))
 result.checks.c1_load.ok=!result.pageErrors.length&&!result.consoleErrors.length&&!result.httpErrors.length
 result.checks.c1_load.evidence={consoleErrors:result.consoleErrors.length,pageErrors:result.pageErrors.length,httpErrors:result.httpErrors.length}
 result.checks.noWritesAttempted={ok:result.blockedWrites.length===0,evidence:result.blockedWrites}
}finally{
 if(browser)await browser.close()
 const oldCookie=api.state.cookie
 try{await api.call('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});result.logout.called=true}catch(e){result.logout.error=String(e.message)}
 // il vecchio cookie (copia presa prima del logout) non deve più valere
 try{await client(oldCookie).call('/api/auth/me');result.logout.oldCookieStillValid=true}catch(e){result.logout.oldCookieStillValid=false;result.logout.meStatusAfter=e.status}
 result.checks.logout={ok:result.logout.called===true&&result.logout.oldCookieStillValid===false&&[401,403].includes(result.logout.meStatusAfter),evidence:result.logout}
}
await writeFile(resolve(here,'result.json'),JSON.stringify(result,null,1))
console.log(JSON.stringify(result.checks,null,1));console.log('blocked',result.blockedWrites,'logout',result.logout)
