// E2E simulato firmato del fix 16/10 sul candidato deployato. Numero QA finto +390000000099, bozza QA nuova.
// Scritture: SOLO il collegamento agenzia del numero QA (rimosso alla fine) e i messaggi del bot sulla bozza QA
// (annullata alla fine). Snapshot di Victoria e dei locali clienti in transazioni read-only prima e dopo.
// Nessuna credenziale o token nei file prodotti. Uso: node docs/webapp/whatsapp-fix-2026-10-16/e2e.mjs
import {readFile,writeFile} from 'node:fs/promises';import {createHash,createHmac,randomBytes} from 'node:crypto';import {parseEnv} from 'node:util';import {homedir} from 'node:os';import {createRequire} from 'node:module'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
const postgres=createRequire(new URL('../../../../package.json',import.meta.url).pathname)('postgres')
const root=new URL('../../../../',import.meta.url).pathname,out=new URL('./',import.meta.url).pathname,env=await loadLocalEnvironment(root)
const tw=parseEnv(await readFile(homedir()+'/.config/tako-webapp/twilio-menu.env','utf8'))
const url=new URL(env.DATABASE_URL);url.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(url.toString(),{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const QA='whatsapp:+390000000099',AGENCY_PHONE='whatsapp:'+(process.env.TAKO_E2E_AGENCY_PHONE||''),VICTORIA='528e263c-634e-4695-9632-6c5cc6a3302f'
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
const redact=s=>String(s||'').replace(/https:\/\/takoitalia\.com\/(onboarding-(?:preview|claim)|api\/onboarding\/owner-qr)\/[a-f0-9]{64}/g,'https://takoitalia.com/$1/[private-token]')
const sign=(u,form)=>createHmac('sha1',tw.TWILIO_AUTH_TOKEN).update(u+Object.keys(form).sort().map(k=>k+form[k]).join('')).digest('base64')
const phrases=[
 'Crea locale Verifica Avversaria Quattro. Nel menu Pranzo, categoria Panini, Burger classico a 12 euro. Nel menu Cena, categoria Panini, Burger classico a 12 euro. Non pubblicare.',
 'Porta il Burger classico a 15 euro.',
 'Aggiungi Sorbetto a 4 euro, categoria Dolci.',
 'Cena',
 'Mostrami il riepilogo dei menu e dei piatti.']
const set='adv3'

async function snapshot(){return db.begin('read only',async tx=>{
 const rows=await tx`SELECT r.id,r.name,w.revision,w.published_revision,w.draft,w.published FROM restaurants r LEFT JOIN menu_workspaces w ON w.restaurant_id=r.id ORDER BY r.id`
 const restaurants=Object.fromEntries(rows.map(r=>[r.id,{name:r.name,revision:r.revision,publishedRevision:r.published_revision,draftHash:hash(r.draft),publishedHash:hash(r.published)}]))
 const ownerLink=await tx`SELECT phone,restaurant_id FROM tako_whatsapp_links WHERE restaurant_id=${VICTORIA} ORDER BY phone`
 return{restaurantCount:rows.length,restaurants,victoria:restaurants[VICTORIA],ownerLink:ownerLink.map(l=>({phoneTail:String(l.phone).slice(-3),restaurant:l.restaurant_id}))}})}
async function session(actor){return(await db.begin('read only',tx=>tx`SELECT id,state,revision,data,restaurant_id,expires_at FROM tako_onboarding_sessions WHERE actor_id=${actor} AND phone=${QA} AND state IN('collecting','review') AND expires_at>now() ORDER BY created_at DESC LIMIT 1`))[0]}
async function twilioSince(since){const api=new URL(`https://api.twilio.com/2010-04-01/Accounts/${tw.TWILIO_ACCOUNT_SID}/Messages.json`);api.searchParams.set('To',QA);api.searchParams.set('PageSize','50');const r=await fetch(api,{headers:{Authorization:'Basic '+Buffer.from(tw.TWILIO_ACCOUNT_SID+':'+tw.TWILIO_AUTH_TOKEN).toString('base64')}});if(!r.ok)return{error:r.status};const j=await r.json();return(j.messages||[]).filter(m=>new Date(m.date_created)>=since).sort((a,b)=>new Date(a.date_created)-new Date(b.date_created)).map(m=>({status:m.status,errorCode:m.error_code,body:redact(m.body)}))}
async function webhook(body){const form={AccountSid:tw.TWILIO_ACCOUNT_SID,From:QA,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:'0',MessageSid:'SM'+randomBytes(16).toString('hex'),Body:body}
 const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,form)},body:new URLSearchParams(form).toString()});return{sid:form.MessageSid,status:r.status,twiml:redact((await r.text()).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}}
async function settle(sid,maxMs=170000){const start=Date.now();for(;;){const rows=await db.begin('read only',tx=>tx`SELECT sid,status,payload->'diagnostic' AS diagnostic FROM tako_onboarding_inbox_jobs WHERE phone=${QA} AND (sid=${sid} OR status IN('pending','running'))`);const own=rows.find(r=>r.sid===sid);if(own&&['done','failed'].includes(own.status)&&!rows.some(r=>r.sid!==sid&&r.status==='running'))return{status:own.status,diagnostic:own.diagnostic,waitedMs:Date.now()-start};if(Date.now()-start>maxMs)return{status:own?.status||'missing',timeout:true,waitedMs:Date.now()-start};await sleep(3000)}}
const dishes=w=>(w?.menus||[]).flatMap(m=>(m.sections||[]).flatMap(s=>(s.items||[]).map(i=>({menu:m.name,section:s.name,name:i.name,price:i.price,id:i.id}))))
const started=new Date(),report={set,startedAt:started.toISOString(),steps:[]}
try{
 const agency=await db`SELECT actor_id FROM tako_onboarding_agency_links WHERE phone=${AGENCY_PHONE}`;if(!agency.length)throw Error('agency phone not paired');const actor=agency[0].actor_id
 const existing=await db`SELECT actor_id FROM tako_onboarding_agency_links WHERE phone=${QA}`;if(existing.length&&existing[0].actor_id!==actor)throw Error('QA phone linked to another actor')
 if(await session(actor))throw Error('an open QA draft already exists on the QA phone: stop')
 report.before=await snapshot()
 await db`INSERT INTO tako_onboarding_agency_links(phone,actor_id) VALUES(${QA},${actor}) ON CONFLICT(phone) DO NOTHING`;report.qaLinkCreated=!existing.length
 let burgerId=null
 for(const [index,text] of phrases.entries()){
  if(index)await sleep(Number(process.env.E2E_GAP_MS||25000)) // Groq free tier: 8000 tokens/minute
  const sentAt=new Date(Date.now()-2000),hook=await webhook(text),done=await settle(hook.sid),s=await session(actor);await sleep(4000)
  const items=dishes(s?.data?.workspace);if(index===0)burgerId=items.find(i=>i.name==='Burger classico')?.id??null
  report.steps.push({n:index+1,text,webhook:{status:hook.status,ack:hook.twiml},job:done,replies:await twilioSince(sentAt),revision:s?.revision,items,unresolved:s?.data?.unresolved,design:s?.data?.workspace?.design&&{background:s.data.workspace.design.background,primary:s.data.workspace.design.primary,text:s.data.workspace.design.text,font:s.data.workspace.design.font}})
  console.log(JSON.stringify({n:index+1,job:done.status,items:items.map(i=>`${i.menu}/${i.section}/${i.name}/${i.price}`),unresolved:s?.data?.unresolved?.length}))
 }
 report.pass=null
 report.errors=await db.begin('read only',tx=>tx`SELECT kind,detail,alerted,created_at FROM tako_whatsapp_errors WHERE created_at>=${started} ORDER BY id`)
 report.technicalCopy=report.steps.flatMap(s=>s.replies).filter(r=>/Fonte \d|VERIFICATO/.test(r.body)).length
 // Cleanup: cancel the QA draft through the bot, then unpair the QA phone.
 const cancel=await webhook('ANNULLA ONBOARDING');report.cleanup={cancel:await settle(cancel.sid),openDraftAfter:!!(await session(actor))}
}finally{
 try{await db`DELETE FROM tako_onboarding_agency_links WHERE phone=${QA}`;report.qaLinkRemoved=(await db`SELECT 1 FROM tako_onboarding_agency_links WHERE phone=${QA}`).length===0}catch(e){report.qaLinkRemoved=false}
 try{report.after=await snapshot();if(report.before){const changed=Object.keys(report.before.restaurants).filter(id=>JSON.stringify(report.before.restaurants[id])!==JSON.stringify(report.after.restaurants[id]));report.restaurantsChanged=changed;report.restaurantsAdded=Object.keys(report.after.restaurants).filter(id=>!report.before.restaurants[id]);report.victoriaUnchanged=JSON.stringify(report.before.victoria)===JSON.stringify(report.after.victoria)&&JSON.stringify(report.before.ownerLink)===JSON.stringify(report.after.ownerLink)}
  const baseline=JSON.parse(await readFile(out+'../../whatsapp-morning-qa-2026-10-16/baseline.json','utf8'));report.victoriaMatchesMorningBaseline=report.after.victoria?.revision===baseline.victoria.revision&&report.after.victoria?.publishedRevision===baseline.victoria.publishedRevision&&report.after.victoria?.draftHash===baseline.victoria.draftHash&&report.after.victoria?.publishedHash===baseline.victoria.publishedHash
  delete report.before.restaurants;delete report.after.restaurants}catch(e){report.snapshotError=String(e?.message||e).slice(0,200)}
 report.finishedAt=new Date().toISOString();await writeFile(out+'e2e-result-'+set+'-'+report.startedAt.replace(/[:.]/g,'-')+'.json',JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify({pass:report.pass,actual:report.actual,errors:report.errors?.map(e=>e.kind),victoriaUnchanged:report.victoriaUnchanged,victoriaMatchesMorningBaseline:report.victoriaMatchesMorningBaseline,restaurantsChanged:report.restaurantsChanged,restaurantsAdded:report.restaurantsAdded,qaLinkRemoved:report.qaLinkRemoved,cleanup:report.cleanup,technicalCopy:report.technicalCopy}))
 await db.end()}
