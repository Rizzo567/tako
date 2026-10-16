// Verifica live (edge v98) dell'aggiunta piatto dal bot titolare, senza IA. Numero finto +390000000099 collegato
// SOLO al QA «Tako · Verifica web» e scollegato alla fine; menu QA salvato e ripristinato per hash. Nessun segreto nei file.
import {readFile,writeFile} from 'node:fs/promises';import {createHash,createHmac,randomBytes} from 'node:crypto';import {parseEnv} from 'node:util';import {homedir} from 'node:os';import {createRequire} from 'node:module';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
import {client,json} from '../../../../scripts/translations/common.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..'),require=createRequire(resolve(repo,'package.json')),postgres=require('postgres')
const BASE='https://takoitalia.com',QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',WA_PHONE='whatsapp:+390000000099'
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16),sleep=ms=>new Promise(r=>setTimeout(r,ms))
const env=await loadLocalEnvironment(repo),dbUrl=new URL(env.DATABASE_URL);dbUrl.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(dbUrl.toString(),{max:2,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const qaLogin=JSON.parse(await readFile(homedir()+'/.config/tako-webapp/qa-login.json','utf8'))
const api=client();await api.call('/api/auth/login',json({email:qaLogin.email,password:qaLogin.password}))
const me=await api.call('/api/auth/me');if(me.data.restaurantId!==QA)throw Error('sessione non sul QA: stop')
const tw=parseEnv(await readFile(homedir()+'/.config/tako-webapp/twilio-menu.env','utf8'))
const sign=(u,form)=>createHmac('sha1',tw.TWILIO_AUTH_TOKEN).update(u+Object.keys(form).sort().map(k=>k+form[k]).join('')).digest('base64')
async function whatsapp(body){const form={AccountSid:tw.TWILIO_ACCOUNT_SID,From:WA_PHONE,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:'0',MessageSid:'SM'+randomBytes(16).toString('hex'),Body:body};const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,form)},body:new URLSearchParams(form).toString()});return{status:r.status,text:(await r.text()).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,400)}}
const out={at:new Date().toISOString(),turns:[],checks:[]};const check=(name,ok,detail='')=>{out.checks.push({name,ok:!!ok,detail});console.log(ok?'PASS':'FAIL',name,typeof detail==='string'?detail:JSON.stringify(detail))}
async function state(){return db.begin('read only',async tx=>{const [w]=await tx`SELECT draft,published,revision,published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`;const [r]=await tx`SELECT name,settings,active FROM restaurants WHERE id=${QA}`;const items=await tx`SELECT id,available FROM menu_items WHERE restaurant_id=${QA} ORDER BY id`;const menus=await tx`SELECT id,active FROM menus WHERE restaurant_id=${QA} ORDER BY id`;const sections=await tx`SELECT s.id FROM menu_sections s JOIN menus m ON m.id=s.menu_id WHERE m.restaurant_id=${QA} ORDER BY s.id`;return{w,r,items,menus,sections}})}
const publicHash=async()=>hash([await (await fetch(`${BASE}/api/customer/restaurant/${QA}/menu?prefetch=1`)).json(),await (await fetch(`${BASE}/api/customer/restaurant/${QA}/menu?prefetch=1&lang=en`)).json()])
const digest=async s=>({draft:hash(s.w.draft),published:hash(s.w.published),restaurant:hash(s.r),items:hash(s.items),menus:hash(s.menus),sections:hash(s.sections),public:await publicHash()})
const before=await state();if(before.w.revision!==before.w.published_revision)throw Error('QA con bozza non pubblicata: stop');const beforeDigest=await digest(before)
await writeFile(resolve(here,'qa-before.json'),JSON.stringify({revision:before.w.revision,digest:beforeDigest,draft:before.w.draft},null,1))
const allSections=before.w.draft.menus.flatMap(m=>m.sections),sec=allSections[0],existing=sec.items[0]
const items=async()=>{const [w]=await db`SELECT published FROM menu_workspaces WHERE restaurant_id=${QA}`;return w.published.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>({s:s.id,name:i.name,price:Number(i.price)}))))}
const say=async t=>{const r=await whatsapp(t);out.turns.push({in:t,status:r.status,out:r.text});console.log('>',t,'\n<',r.text);await sleep(800);return r}
let linked=false,parked=[]
try{
 if((await db`SELECT 1 FROM tako_whatsapp_links WHERE phone=${WA_PHONE}`).length)throw Error('numero finto già collegato: stop')
 // Il QA ammette un solo telefono: il collegamento esistente si mette da parte (riga identica) e si rimette alla fine.
 parked=await db`SELECT phone,restaurant_id,actor_id,created_at,activated_at FROM tako_whatsapp_links WHERE restaurant_id=${QA}`;if(parked.length)await db`DELETE FROM tako_whatsapp_links WHERE restaurant_id=${QA} AND phone=${parked[0].phone}`
 await db`INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at) VALUES(${WA_PHONE},${QA},${me.data.id},now())`;linked=true
 await db`DELETE FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`
 const multi=allSections.length>1;check(`QA con ${allSections.length} categorie («${sec.name}»)`,true)
 // 1) conversazione reale: domanda, poi vocale completo (con «… che costa 12 euro») come risposta
 const q1=await say('aggiungiamo un piatto');check('«aggiungiamo un piatto» → una domanda ('+(multi?'categoria':'una sola categoria: prezzo')+')',multi?/In quale categoria/.test(q1.text):/Quanto costa/.test(q1.text),q1.text)
 const a1=await say(`aggiungi tra ${sec.name.toLowerCase()} il piatto pasta al pesto che costa 12 euro`)
 check('risposta completa → piatto aggiunto e pubblicato (non «Non trovo»)',!/Non trovo/.test(a1.text)&&(await items()).some(i=>i.s===sec.id&&i.name==='Pasta al pesto'&&i.price===12),a1.text)
 // 2) piatto già presente: non duplica
 const dup=sec.items.find(i=>i.name)?.name;if(dup){const a=await say(`aggiungi ${dup.toLowerCase()} 12 euro`);check('piatto già presente → lo dice, nessun doppione',/è già in/.test(a.text)&&(await items()).filter(i=>i.name.toLowerCase()===dup.toLowerCase()).length===1,a.text)}
 // 3) «nuovo piatto: tiramisù 6 euro» e prezzo in lettere
 const a2=await say('nuovo piatto: tiramisù 6 euro');check(multi?'senza categoria → chiede in quale':'una sola categoria → Tiramisù 6 € aggiunto',multi?/In quale categoria/.test(a2.text):(await items()).some(i=>i.s===sec.id&&i.name==='Tiramisù'&&i.price===6),a2.text)
 const a3=await say(`aggiungi nei ${sec.name.toLowerCase()} panna cotta a cinque euro`);check('«a cinque euro» → Panna cotta 5 €',(await items()).some(i=>i.s===sec.id&&i.name==='Panna cotta'&&i.price===5),a3.text)
 // 4) regressione: cambio prezzo e esaurito restano deterministici
 const a4=await say(`prezzo ${existing.name} a ${Number(existing.price)+1}`);check('regressione «prezzo X a N» → cambio prezzo',(await items()).some(i=>i.name===existing.name&&i.price===Number(existing.price)+1),a4.text)
 const a5=await say(`la ${existing.name} è finita`);check('regressione «la X è finita» → non è un\'aggiunta',!/In quale categoria|Quanto costa|Come si chiama/.test(a5.text),a5.text)
}catch(e){check('esecuzione',false,String(e.message).slice(0,200))}finally{
 try{
  {await db`DELETE FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`;await db`DELETE FROM tako_whatsapp_links WHERE phone=${WA_PHONE}`}
  for(const p of parked)await db`INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,created_at,activated_at) VALUES(${p.phone},${p.restaurant_id},${p.actor_id},${p.created_at},${p.activated_at}) ON CONFLICT DO NOTHING`
  if(parked.length){const back=await db`SELECT phone,actor_id,created_at,activated_at FROM tako_whatsapp_links WHERE restaurant_id=${QA}`;check('collegamento esistente del QA rimesso identico',back.length===1&&back[0].phone===parked[0].phone&&String(back[0].actor_id)===String(parked[0].actor_id)&&+back[0].created_at===+parked[0].created_at&&+back[0].activated_at===+parked[0].activated_at)}
  for(const it of before.items){const now=(await db`SELECT available FROM menu_items WHERE id=${it.id}`)[0];if(now&&now.available!==it.available)await api.call(`/api/menus/items/${it.id}/availability`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({available:it.available})})}
  const cur=await api.call('/api/menu-workspace');const saved=await api.call('/api/menu-workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:cur.revision,workspace:before.w.draft})});await api.call('/api/menu-workspace/publish',json({expectedRevision:saved.revision}))
  const keepItems=before.items.map(x=>x.id),keepSections=before.sections.map(x=>x.id),keepMenus=before.menus.map(x=>x.id)
  await db.begin(async tx=>{await tx`DELETE FROM item_variants WHERE item_id IN (SELECT id FROM menu_items WHERE restaurant_id=${QA} AND NOT (id = ANY(${keepItems}::uuid[])))`;await tx`DELETE FROM menu_item_translations WHERE restaurant_id=${QA} AND NOT (item_id = ANY(${keepItems}::uuid[]))`;await tx`DELETE FROM menu_items WHERE restaurant_id=${QA} AND NOT (id = ANY(${keepItems}::uuid[]))`;await tx`DELETE FROM menu_sections WHERE menu_id IN (SELECT id FROM menus WHERE restaurant_id=${QA}) AND NOT (id = ANY(${keepSections}::uuid[]))`;await tx`DELETE FROM menus WHERE restaurant_id=${QA} AND NOT (id = ANY(${keepMenus}::uuid[]))`})
  await sleep(1500);const afterDigest=await digest(await state());out.restore={before:beforeDigest,after:afterDigest}
  check('QA ripristinato per hash',Object.keys(beforeDigest).every(k=>beforeDigest[k]===afterDigest[k]),Object.keys(beforeDigest).filter(k=>beforeDigest[k]!==afterDigest[k]).join(','))
  check('numero finto scollegato',!(await db`SELECT 1 FROM tako_whatsapp_links WHERE phone=${WA_PHONE}`).length)
 }catch(e){check('ripristino',false,e.message)}
 try{await api.call('/api/auth/logout',json({}))}catch{}
 await db.end();await writeFile(resolve(here,'result.json'),JSON.stringify(out,null,1))
}
