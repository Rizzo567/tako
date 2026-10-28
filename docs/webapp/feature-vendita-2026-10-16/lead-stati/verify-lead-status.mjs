// Verifica live degli automatismi «Prova attiva» e «Rifiutato» su un lead+locale PROVA di TEST («ZZ Test rimozione»).
// Crea il fixture con la connessione owner (Management API), lo usa con una sessione agenzia propria, poi lo cancella
// del tutto. Non tocca altri lead o locali. Nessun segreto nei file prodotti.
import fs from 'node:fs';import {createRequire} from 'node:module';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {client,login,base} from '../../../../scripts/translations/common.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..'),require=createRequire(resolve(repo,'package.json'))
const puppeteer=require('puppeteer-core'),chrome=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const tok=fs.readFileSync(process.env.HOME+'/.config/tako-webapp/supabase-onboarding.env','utf8').match(/SUPABASE_ACCESS_TOKEN=['"]?([^'"\n]+)/)[1]
const q=async query=>{const r=await fetch('https://api.supabase.com/v1/projects/tcfccmvpycivxuxkoqpw/database/query',{method:'POST',headers:{authorization:'Bearer '+tok,'content-type':'application/json'},body:JSON.stringify({query})});const t=await r.text();if(!r.ok)throw Error('SQL '+r.status+' '+t.slice(0,200));return JSON.parse(t)}
const LEAD='ZZTEST1',NAME='ZZ Test rimozione',rid=randomUUID(),token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex')
const lit=v=>"'"+String(v).replace(/'/g,"''")+"'"
const out={at:new Date().toISOString(),lead:LEAD,checks:[]};const check=(name,ok,detail)=>{out.checks.push({name,ok:!!ok,detail});console.log(ok?'PASS':'FAIL',name,detail===undefined?'':JSON.stringify(detail))}
const api=client();let browser
const req=async(path,opt={})=>{const r=await fetch(base+path,{...opt,headers:{Origin:base,Cookie:api.state.cookie,'Content-Type':'application/json',...opt.headers}});let body=null;try{body=await r.json()}catch{}return{status:r.status,body}}
const settingsQ=async()=>(await q(`select active,settings from restaurants where id=${lit(rid)}`))[0]
try{
 if((await q(`select count(*)::int n from tako_agency_leads where id=${lit(LEAD)}`))[0].n)throw Error('lead di test già presente')
 const draft={languages:['it'],defaultLanguage:'it',menus:[{id:randomUUID(),name:'Menu di prova',sections:[{id:randomUUID(),name:'Primi',items:[{id:randomUUID(),name:'Piatto di prova',price:10}]}]}]}
 const settings={takomenuTrial:true,trialLeadId:LEAD,customerOrderingEnabled:false,reservationsEnabled:false,tableServiceEnabled:false,takeawayEnabled:false,languages:['it'],defaultLanguage:'it'}
 await q(`begin;insert into restaurants(id,name,slug,settings) values(${lit(rid)},${lit(NAME)},'prova-zz-test-rimozione-zztest1',${lit(JSON.stringify(settings))}::jsonb);
 insert into menu_workspaces(restaurant_id,draft,revision) values(${lit(rid)},${lit(JSON.stringify(draft))}::jsonb,1);
 insert into tako_agency_leads(id,source_id,source,status,restaurant_id,demo_token_hash) values(${lit(LEAD)},${lit(LEAD)},${lit(JSON.stringify({nome:NAME,citta:'Test',regione:'Test',demoUrl:base+'/trial-menu/'+token,demoPrepared:true}))}::jsonb,'demo_ready',${lit(rid)},${lit(hash)});commit;`)
 await login(api)
 const preview=async()=>(await fetch(base+'/api/agency/leads/preview/'+token)).status
 const listed=async()=>((await req('/api/agency/restaurants')).body?.data??[]).find(r=>r.id===rid)
 check('fixture: link di prova 200, locale in lista come PROVA',await preview()===200&&(await listed())?.isTrial===true)
 check('switch al locale di test',(await req('/api/web-locations/switch',{method:'POST',body:JSON.stringify({restaurantId:rid})})).status===200)
 const ws=async()=>(await req('/api/menu-workspace/')).body
 let w=await ws();const p1=await req('/api/menu-workspace/publish',{method:'POST',body:JSON.stringify({expectedRevision:w.revision+1000})})
 check('PROVA: publish bloccato (403)',p1.status===403&&p1.body?.error?.code==='TRIAL_MENU_PRIVATE',p1.status)
 // 1) Prova attiva
 const lead=async()=>(await req('/api/agency/leads/'+LEAD)).body?.data
 let l=await lead();const t=await req('/api/agency/leads/'+LEAD,{method:'PATCH',body:JSON.stringify({revision:l.revision,status:'trial'})})
 const s1=await settingsQ();check('Prova attiva: stato salvato e takomenuTrial=false nella stessa richiesta',t.status===200&&t.body?.data?.status==='trial'&&s1.settings.takomenuTrial===false&&!!s1.settings.trialActivatedAt,{status:t.status,takomenuTrial:s1.settings.takomenuTrial})
 check('Prova attiva: in lista non più PROVA',(await listed())?.isTrial===false)
 w=await ws();const p2=await req('/api/menu-workspace/publish',{method:'POST',body:JSON.stringify({expectedRevision:w.revision})})
 check('Prova attiva: pubblicabile (publish 200)',p2.status===200&&!!p2.body?.publishedRevision,p2.status)
 check('Prova attiva: link di prova ancora 200',await preview()===200)
 // 2) Rifiutato dalla dashboard: riquadro, Rimuovi
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-first-run','--no-default-browser-check']})
 const page=await browser.newPage();await page.setViewport({width:1280,height:900})
 const errors=[];page.on('pageerror',e=>errors.push(String(e.message).slice(0,200)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200))})
 let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.dismiss()})
 await page.setCookie(...api.state.cookie.split('; ').filter(Boolean).map(c=>{const i=c.indexOf('=');return{name:c.slice(0,i),value:c.slice(i+1),domain:'takoitalia.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}}))
 await page.goto(base+'/staff/?view=leads',{waitUntil:'networkidle2',timeout:60000});await page.waitForSelector('.al-table tbody tr',{timeout:30000})
 await page.type('.al-search input',NAME);await new Promise(r=>setTimeout(r,500))
 await page.click('.al-table tbody tr .al-open');await page.waitForSelector('.al-detail',{timeout:15000})
 await page.waitForFunction(()=>!document.querySelector('.al-detail-body')?.textContent.includes('Caricamento attività'),{timeout:20000})
 await page.select('.al-detail form select','not_interested');await page.click('.al-detail form .al-primary')
 await page.waitForSelector('.al-remove-confirm',{timeout:5000})
 const box=await page.evaluate(()=>{const b=document.querySelector('.al-remove-confirm'),r=b.querySelector('.al-danger'),a=[...b.querySelectorAll('button')].find(x=>x.textContent==='Annulla');return{title:b.querySelector('h4')?.textContent,danger:r?.textContent,bg:getComputedStyle(r).backgroundColor,cancel:!!a,focus:document.activeElement?.textContent}})
 const notSaved=(await lead()).status==='trial'
 await page.screenshot({path:resolve(here,'01-riquadro-rimuovi.png')})
 check('riquadro nella pagina con titolo, Rimuovi rosso e Annulla; nessun confirm() del browser; nulla salvato prima della conferma',box.title===`Rimuovere ${NAME} da Takomenu?`&&box.danger==='Rimuovi'&&box.bg==='rgb(180, 35, 24)'&&box.cancel&&dialogs===0&&notSaved,box)
 await page.click('.al-remove-confirm .al-danger');await page.waitForFunction(()=>document.querySelector('.al-save-notice')?.textContent.includes('rimosso'),{timeout:20000})
 await page.screenshot({path:resolve(here,'02-dopo-rimozione.png')})
 const s2=await settingsQ(),lr=await req('/api/agency/leads/'+LEAD),l2=lr.body?.data
 check('Rifiutato: lead nel CRM con stato Rifiutato',l2?.status==='not_interested',{http:lr.status,status:l2?.status,me:(await req('/api/auth/me')).status})
 check('Rifiutato: locale disattivato e marcato, menu conservato',s2.active===false&&s2.settings.takomenuRemoved===true&&(await q(`select count(*)::int n from menu_workspaces where restaurant_id=${lit(rid)}`))[0].n===1,{active:s2.active})
 check('Rifiutato: link di prova 404',await preview()===404)
 check('Rifiutato: sparito dalla lista locali agenzia',!(await listed()))
 {const sw=await req('/api/web-locations/switch',{method:'POST',body:JSON.stringify({restaurantId:rid})});check('Rifiutato: switch al locale rifiutato (404)',sw.status===404,sw.status)}
 check('console pulita',errors.length===0,errors)
}catch(e){check('esecuzione',false,String(e.message).slice(0,200))}finally{
 if(browser)await browser.close()
 try{const lo=await req('/api/auth/logout',{method:'POST',body:'{}'});check('logout',(await req('/api/auth/me')).status===401,lo.status)}catch{}
 // Pulizia completa del fixture.
 try{await q(`begin;delete from tako_agency_lead_activities where lead_id=${lit(LEAD)};delete from tako_agency_leads where id=${lit(LEAD)};delete from web_session_locations where restaurant_id=${lit(rid)};delete from menu_item_translations where restaurant_id=${lit(rid)};delete from item_variants where item_id in (select id from menu_items where restaurant_id=${lit(rid)});delete from menu_items where restaurant_id=${lit(rid)};delete from menu_sections where menu_id in (select id from menus where restaurant_id=${lit(rid)});delete from menus where restaurant_id=${lit(rid)};delete from menu_workspace_versions where restaurant_id=${lit(rid)};delete from menu_workspaces where restaurant_id=${lit(rid)};delete from restaurants where id=${lit(rid)};commit;`)
  const left=(await q(`select (select count(*) from tako_agency_leads where id=${lit(LEAD)})+(select count(*) from restaurants where id=${lit(rid)}) n`))[0].n;check('pulizia: lead e locale di test cancellati',Number(left)===0)}catch(e){check('pulizia',false,String(e.message).slice(0,300))}
 fs.writeFileSync(resolve(here,'result.json'),JSON.stringify(out,null,1))
}
