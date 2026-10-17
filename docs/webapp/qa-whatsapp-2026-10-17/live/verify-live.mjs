// Verifica dal vivo dei 4 casi del collaudo WhatsApp (17/10) + 10 varianti, sul QA «Tako · Verifica web», via webhook firmato.
// Il QA ha collegato il numero vero di Manuel: si usa quello come mittente (mai stampato) e la risposta torna SOLO nel TwiML
// della richiesta. Tutte le sequenze sono deterministiche (tests/owner-bot-adversarial-round5-qa.test.ts lo verifica): se un turno
// tornasse vuoto (= lavoro passato all'IA, che risponderebbe via WhatsApp) la verifica si ferma subito.
// Prima di ogni sequenza: menu QA riportato allo stato iniziale, proposta e memoria «ultimo» del numero azzerate.
// Alla fine: menu, proposta in attesa e memoria «last:» rimessi com'erano, ripristino verificato per hash.
// Scritture SOLO sul QA. Sessione di login propria (qa-login.json). Uso: node …/verify-live.mjs
import {readFile,writeFile} from 'node:fs/promises';import {createHash,createHmac,randomBytes} from 'node:crypto';import {homedir} from 'node:os';import {parseEnv} from 'node:util';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module'
import {client,json} from '../../../../scripts/translations/common.mjs'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..'),require=createRequire(resolve(repo,'package.json')),postgres=require('postgres')
const BASE='https://takoitalia.com',QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16)
const env=await loadLocalEnvironment(repo),dbUrl=new URL(env.DATABASE_URL);dbUrl.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(dbUrl.toString(),{max:2,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const tw=parseEnv(await readFile(homedir()+'/.config/tako-webapp/twilio-menu.env','utf8'))
const sign=(u,form)=>createHmac('sha1',tw.TWILIO_AUTH_TOKEN).update(u+Object.keys(form).sort().map(k=>k+form[k]).join('')).digest('base64')
const qaLogin=JSON.parse(await readFile(homedir()+'/.config/tako-webapp/qa-login.json','utf8'))
const api=client();await api.call('/api/auth/login',json({email:qaLogin.email,password:qaLogin.password}))
const me=await api.call('/api/auth/me');if(me.data.restaurantId!==QA)throw Error('sessione non sul QA: stop')
const items=doc=>doc.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>({...i,section:s.name}))))
async function dbState(){return db.begin('read only',async tx=>{const [w]=await tx`SELECT draft,published,revision,published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`;const rows=await tx`SELECT id,section_id,name,description,price,image_url,allergens,tags,available,featured,position,name_translations,description_translations FROM menu_items WHERE restaurant_id=${QA} ORDER BY id`;const menus=await tx`SELECT id,name,description,type,active,position FROM menus WHERE restaurant_id=${QA} ORDER BY id`;const sections=await tx`SELECT s.id,s.menu_id,s.name,s.description,s.active,s.position,s.name_translations FROM menu_sections s JOIN menus m ON m.id=s.menu_id WHERE m.restaurant_id=${QA} ORDER BY s.id`;const tr=await tx`SELECT item_id,lang,name,description FROM menu_item_translations WHERE restaurant_id=${QA} ORDER BY item_id,lang`;return{w,rows,menus,sections,tr}})}
const publicHash=async()=>{const a=await (await fetch(`${BASE}/api/customer/restaurant/${QA}/menu?prefetch=1`)).json(),b=await (await fetch(`${BASE}/api/customer/restaurant/${QA}/menu?prefetch=1&lang=en`)).json();return hash([a,b])}
// Le righe di menu_items dei piatti nati durante la verifica restano come «non disponibili» dopo il ripristino (regola dello store per
// ogni piatto eliminato): il confronto le esclude e controlla a parte che siano spente e fuori dal menu.
const digest=async(s,keep)=>({draft:hash(s.w.draft),published:hash(s.w.published),items:hash(s.rows.filter(r=>keep.has(r.id))),menus:hash(s.menus),sections:hash(s.sections),translations:hash(s.tr.filter(r=>keep.has(r.item_id))),public:await publicHash()})
const before=await dbState();if(before.w.revision!==before.w.published_revision)throw Error('QA con bozza non pubblicata: stop')
const baseIds=new Set(before.rows.map(r=>r.id)),beforeDigest=await digest(before,baseIds)
const [qaLink]=await db`SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${QA}`;if(!qaLink)throw Error('QA senza numero collegato: stop');const WA_PHONE=String(qaLink.phone)
const savedProposal=await db`SELECT * FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`,savedLast=await db`SELECT response FROM tako_whatsapp_messages WHERE sid=${'last:'+WA_PHONE}`
async function whatsapp(body){const form={AccountSid:tw.TWILIO_ACCOUNT_SID,From:WA_PHONE,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:'0',MessageSid:'SM'+randomBytes(16).toString('hex'),Body:body};const t0=performance.now();const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,form)},body:new URLSearchParams(form).toString()});const raw=await r.text();const text=raw.replace(/<\/Message><Message>/g,'\n').replace(/<[^>]+>/g,'').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();return{status:r.status,ms:Math.round(performance.now()-t0),text}}
async function restoreMenu(){const cur=await dbState();if(hash(cur.w.draft)===hash(before.w.draft)&&hash(cur.w.published)===hash(before.w.published))return false
 const live=await api.call('/api/menu-workspace');const saved=await api.call('/api/menu-workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:live.revision??cur.w.revision,workspace:before.w.draft})});await api.call('/api/menu-workspace/publish',json({expectedRevision:saved.revision}))
 for(const it of before.rows){const now=(await db`SELECT available FROM menu_items WHERE id=${it.id}`)[0];if(now&&now.available!==it.available)await api.call(`/api/menus/items/${it.id}/availability`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({available:it.available})})}
 return true}
const fresh=async()=>{await db`DELETE FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`;await db`DELETE FROM tako_whatsapp_messages WHERE sid=${'last:'+WA_PHONE}`}
// Differenze del pubblicato rispetto allo stato iniziale, nello stesso formato delle batterie.
function changes(doc){const a=new Map(items(before.w.published).map(i=>[i.id,i])),out=[]
 for(const x of items(doc)){const y=a.get(x.id);if(!y){out.push(`create|${x.name}|${x.price}|${x.section}`);continue}
  if(x.price!==y.price)out.push(`price|${y.name}|${x.price}`);if((x.available!==false)!==(y.available!==false))out.push(`available|${y.name}|${x.available!==false}`);if(!!x.hidden!==!!y.hidden)out.push(`hidden|${y.name}|${!!x.hidden}`)
  if((x.promo?.price??null)!==(y.promo?.price??null))out.push(`promo|${y.name}|${x.promo?.price??null}`);if(!!x.scarcity?.lastPortions!==!!y.scarcity?.lastPortions)out.push(`last|${y.name}|${!!x.scarcity?.lastPortions}`);if(x.name!==y.name)out.push(`rename|${y.name}|${x.name}`);if((x.description??'')!==(y.description??''))out.push(`description|${y.name}`)}
 for(const y of a.values())if(!items(doc).some(x=>x.id===y.id))out.push(`delete|${y.name}`);return out.sort()}
// Le stesse sequenze e attese di tests/owner-bot-adversarial-round5-qa.test.ts (QA_LIVE).
const S=[
 ['caso1',['piatto di verifica 13 o 14?'],[],/13,50.*13.*14/s],
 ['caso1-risposta',['piatto di verifica 13 o 14?','14'],['price|Piatto di verifica|14']],
 ['caso2',['metti il piatto di verifica a 14','non cambiare boh; metti il piatto di verifica a tredici euro e cinquanta'],[],/14,00 € a \*13,50/],
 ['caso2-variante',['non cambiare boh; metti il piatto di verifica a dodici euro e cinquanta'],['price|Piatto di verifica|12.5']],
 ['caso3',['il piatto costa 15','Piatto di verifica'],['price|Piatto di verifica|15']],
 ['caso4',['aggiungi nella categoria Piatti di prova il piatto Piatto test QA a 9 euro'],['create|Piatto test QA|9|Piatti di prova']],
 ['v01',['boh 21 o 22','22'],['price|boh|22']],
 ['v02',['metti la pasta al ragù a 13 oppure 14 euro'],[],/quale prezzo/i],
 ['v03',['pasta al ragù tra 13 e 14 euro','la seconda'],['price|pasta al ragù|14']],
 ['v04',['che ne sacc a 21, boh no'],['price|Che ne sacc|21']],
 ['v05',['lascia stare boh, pasta al ragù a 13'],['price|pasta al ragù|13']],
 ['v06',['non toccare che ne sacc; boh è finito'],['available|boh|false','last|boh|false']],
 ['v07',['Piatto di verifica'],[],/13,50/],
 ['v08',['il piatto di verifica costa 13 o 14 euro?'],[],/quale prezzo/i],
 ['v09',['il piatto costa 15','boh'],[],/non è tra/i],
 ['v10',['13 o 14?'],[],/quale prezzo/i]]
const results=[];let stopped=null
try{
 for(const [id,turns,expected,reply] of S){if(stopped)break
  await restoreMenu();await fresh();const replies=[]
  for(const t of turns){const r=await whatsapp(t);replies.push(r);if(r.status!==200||!r.text){stopped=`${id}: risposta vuota o stato ${r.status} a «${t}» (passato all'IA?): mi fermo`;break}await sleep(500)}
  await sleep(300);const s=await dbState(),got=changes(s.w.published),exp=[...expected].sort()
  const ok=JSON.stringify(got)===JSON.stringify(exp)&&(!reply||reply.test(replies.at(-1)?.text??''))&&!stopped
  results.push({id,turns,replies:replies.map(r=>({ms:r.ms,text:r.text.slice(0,300)})),expected:exp,got,pass:ok});console.log(ok?'PASS':'FAIL',id,JSON.stringify(got),'|',replies.map(r=>r.text.replace(/\s+/g,' ').slice(0,110)).join(' ⏎ '))}
}finally{
 try{await restoreMenu()
  await db`DELETE FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`;for(const p of savedProposal)await db`INSERT INTO tako_whatsapp_proposals ${db(p)}`;if(savedLast.length){await db`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${'last:'+WA_PHONE},${savedLast[0].response}) ON CONFLICT(sid) DO UPDATE SET response=EXCLUDED.response`}else await db`DELETE FROM tako_whatsapp_messages WHERE sid=${'last:'+WA_PHONE}`
  const after=await dbState(),afterDigest=await digest(after,baseIds),diff=Object.keys(beforeDigest).filter(k=>beforeDigest[k]!==afterDigest[k])
  const extra=after.rows.filter(r=>!baseIds.has(r.id)).map(r=>({name:r.name,available:r.available,inMenu:items(after.w.published).some(i=>i.id===r.id)}))
  const restored=!diff.length&&extra.every(x=>!x.available&&!x.inMenu)
  const memo=hash(await db`SELECT * FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`)===hash(savedProposal)&&hash(await db`SELECT response FROM tako_whatsapp_messages WHERE sid=${'last:'+WA_PHONE}`)===hash(savedLast)
  console.log(restored?'PASS QA ripristinato per hash':'FAIL ripristino '+diff.join(','),'· righe nuove spente',JSON.stringify(extra),'· proposta/memoria del numero ripristinate',memo)
  const pass=results.filter(r=>r.pass).length;console.log(`${pass}/${results.length} sequenze PASS${stopped?' — '+stopped:''}`)
  await writeFile(resolve(here,`result-${new Date().toISOString().replace(/[:.]/g,'-')}.json`),JSON.stringify({at:new Date().toISOString(),results,stopped,restore:{before:beforeDigest,after:afterDigest,ok:restored,extraRows:extra,memory:memo}},null,1))
 }catch(e){console.log('FAIL ripristino',e.message)}
 await api.call('/api/auth/logout',{method:'POST'}).catch(()=>{});await db.end()
}
