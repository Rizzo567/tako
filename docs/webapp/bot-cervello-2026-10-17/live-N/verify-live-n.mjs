// Verifica dal vivo del perimetro N (cervello, 17/10): adattata da live-Q/verify-live-q.mjs.
// DIFFERENZA CHIAVE: ogni richiesta porta il campo firmato TakoSyncTest=1: sul QA l'edge risponde anche ai turni dell'IA SOLO nel
// TwiML (nessun invio REST, nessun avviso). Prima e dopo: controllo su Twilio che nessun messaggio sia partito verso il numero.
// Verifica dal vivo del perimetro Q (17/10): caso vocale di Manuel (testo trascritto) + 10 varianti, «togli» = nascosto, annulla vero
// (anche con modifica dalla dashboard nel mezzo) e riga «assistente automatico» una sola volta, sul QA «Tako · Verifica web», via webhook firmato.
// Il QA ha collegato il numero vero di Manuel: si usa quello come mittente (mai stampato) e la risposta torna SOLO nel TwiML
// della richiesta. Tutte le sequenze sono deterministiche (tests/owner-bot-adversarial-round5-qa.test.ts lo verifica): se un turno
// tornasse vuoto (= lavoro passato all'IA, che risponderebbe via WhatsApp) la verifica si ferma subito.
// Prima di ogni sequenza: menu QA riportato allo stato iniziale, proposta e memorie «last:», «undo:», «ai:» del numero azzerate.
// Alla fine: menu, proposta in attesa e memorie «last:», «undo:», «ai:» rimesse com'erano, ripristino verificato per hash.
// Scritture SOLO sul QA. Sessione di login propria (qa-login.json). Uso: node …/verify-live.mjs
import {readFile,writeFile} from 'node:fs/promises';import {Buffer} from 'node:buffer';import {createHash,createHmac,randomBytes} from 'node:crypto';import {homedir} from 'node:os';import {parseEnv} from 'node:util';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module'
import {client,json} from '../../../../scripts/translations/common.mjs'
const KEYS=['last:','undo:','ai:','brainundo:']
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
const [qaLink]=await db`SELECT phone,actor_id FROM tako_whatsapp_links WHERE restaurant_id=${QA} ORDER BY created_at DESC LIMIT 1`;if(!qaLink)throw Error('QA senza numero collegato: stop')
const WA_PHONE=String(qaLink.phone) // numero collegato al QA (mai stampato): con TakoSyncTest=1 le risposte tornano SOLO nel TwiML
const [st0]=await db`SELECT settings FROM restaurants WHERE id=${QA}`;if(st0?.settings?.botBrain!==true)throw Error('cervello non acceso sul QA: stop')
// Twilio: nessun messaggio deve partire verso il numero durante la prova (controllo prima/dopo sui messaggi in uscita).
const twAuth='Basic '+Buffer.from(tw.TWILIO_ACCOUNT_SID+':'+tw.TWILIO_AUTH_TOKEN).toString('base64'),startedAt=new Date(Date.now()-60000)
async function outbound(){const u=`https://api.twilio.com/2010-04-01/Accounts/${tw.TWILIO_ACCOUNT_SID}/Messages.json?To=${encodeURIComponent(WA_PHONE)}&DateSent%3E=${startedAt.toISOString().slice(0,10)}&PageSize=200`;const j=await (await fetch(u,{headers:{authorization:twAuth}})).json();if(!Array.isArray(j.messages))throw Error('Twilio: lettura messaggi fallita: stop');return j.messages.filter(m=>new Date(m.date_created)>=startedAt).length}
const outBefore=await outbound()
const linkCleanup=async()=>{await db`DELETE FROM tako_owner_brain_turns WHERE phone=${WA_PHONE}`;await db`DELETE FROM tako_owner_brain_memory WHERE restaurant_id=${QA}`}
const savedProposal=await db`SELECT * FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`,saved={};for(const k of KEYS)saved[k]=await db`SELECT response FROM tako_whatsapp_messages WHERE sid=${k+WA_PHONE}`
async function whatsapp(body){const form={AccountSid:tw.TWILIO_ACCOUNT_SID,From:WA_PHONE,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:'0',MessageSid:'SM'+randomBytes(16).toString('hex'),Body:body,TakoSyncTest:'1'};const t0=performance.now();const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,form)},body:new URLSearchParams(form).toString()});const raw=await r.text();const text=raw.replace(/<\/Message><Message>/g,'\n').replace(/<[^>]+>/g,'').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();return{status:r.status,ms:Math.round(performance.now()-t0),text}}
async function restoreMenu(){const cur=await dbState();if(hash(cur.w.draft)===hash(before.w.draft)&&hash(cur.w.published)===hash(before.w.published))return false
 const live=await api.call('/api/menu-workspace');const saved=await api.call('/api/menu-workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:live.revision??cur.w.revision,workspace:before.w.draft})});await api.call('/api/menu-workspace/publish',json({expectedRevision:saved.revision}))
 for(const it of before.rows){const now=(await db`SELECT available FROM menu_items WHERE id=${it.id}`)[0];if(now&&now.available!==it.available)await api.call(`/api/menus/items/${it.id}/availability`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({available:it.available})})}
 return true}
const fresh=async()=>{await db`DELETE FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`;for(const k of KEYS)await db`DELETE FROM tako_whatsapp_messages WHERE sid=${k+WA_PHONE}`;await db`DELETE FROM tako_owner_brain_turns WHERE phone=${WA_PHONE}`}
// Modifica dalla dashboard nel mezzo di una sequenza (stessa sessione di login del QA): prezzo di un piatto, poi pubblica.
async function dashboard(name,price){const live=await api.call('/api/menu-workspace'),doc=structuredClone(live.data);let hit=0;for(const m of doc.menus)for(const s of m.sections)for(const i of s.items)if(i.name===name){i.price=price;hit++}if(hit!==1)throw Error('dashboard: piatto non trovato '+name)
 const rev=live.revision;const saved=await api.call('/api/menu-workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:rev,workspace:doc})});await api.call('/api/menu-workspace/publish',json({expectedRevision:saved.revision}))}
// Differenze del pubblicato rispetto allo stato iniziale, nello stesso formato delle batterie.
function changes(doc){const a=new Map(items(before.w.published).map(i=>[i.id,i])),out=[]
 for(const x of items(doc)){const y=a.get(x.id);if(!y){out.push(`create|${x.name}|${x.price}|${x.section}`);continue}
  if(x.price!==y.price)out.push(`price|${y.name}|${x.price}`);if((x.available!==false)!==(y.available!==false))out.push(`available|${y.name}|${x.available!==false}`);if(!!x.hidden!==!!y.hidden)out.push(`hidden|${y.name}|${!!x.hidden}`)
  if((x.promo?.price??null)!==(y.promo?.price??null))out.push(`promo|${y.name}|${x.promo?.price??null}`);if(!!x.scarcity?.lastPortions!==!!y.scarcity?.lastPortions)out.push(`last|${y.name}|${!!x.scarcity?.lastPortions}`);if(x.name!==y.name)out.push(`rename|${y.name}|${x.name}`);if((x.description??'')!==(y.description??''))out.push(`description|${y.name}`)}
 for(const y of a.values())if(!items(doc).some(x=>x.id===y.id))out.push(`delete|${y.name}`);return out.sort()}
const AI='Sono l’*assistente automatico* di Takomenu'
const M='aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tojibo'
// [id, turni, modifiche attese (null = dinamica), risposte attese {turno: regex}]
const S=[
 ['tojibo',[M,'no, togli bo'],['hidden|boh|true'],{0:/togliere boh/,1:/Confermato/}],
 ['anche-stesso-prezzo',['il piatto di verifica a 14','fallo anche con la parmigiana e mettila allo stesso prezzo'],['price|Piatto di verifica|14','price|la parmigiana|14'],{1:/Confermato/}],
 ['rimettila',['il piatto di verifica a 14',"rimettila com'era"],[],{1:/Annullato|com.era|tornat/i}],
 ['si-la-seconda',['il piatto a 15','sì la seconda'],null,{0:/\?/}]]
// Prima di partire: le sequenze devono restare senza IA anche sul menu di adesso (stesso controllo del banco round6-qa).
{const snap=JSON.parse(await readFile(resolve(here,'../live-Q/qa-workspace-1017.json'),'utf8')).published;if(hash(snap)!==hash(before.w.published))throw Error('il menu del QA non è più quello dell\'istantanea provata in round6-qa: rifai il banco prima, mi fermo')}
const results=[];let stopped=null
try{
 for(const [id,turns,expected,want] of S){if(stopped)break
  await restoreMenu();await fresh();const replies=[]
  for(const t of turns){if(typeof t==='object'){await dashboard(t.dash[0],t.dash[1]);replies.push({ms:0,text:'[dashboard]'});continue}
   const r=await whatsapp(t);replies.push(r);if(r.status!==200||!r.text){stopped=`${id}: risposta vuota o stato ${r.status} a «${t}» (passato all'IA?): mi fermo`;break}await sleep(500)}
  await sleep(300);const s=await dbState(),got=changes(s.w.published);let exp=expected?[...expected].sort():null
  if(!exp){const opts=[...(replies[0]?.text??'').matchAll(/\d\.\s*\*([^*]+)\*/g)].map(m=>m[1]);exp=opts[1]?[`price|${opts[1]}|15`]:['?']}
  const texts=replies.filter(r=>r.text!=='[dashboard]').map(r=>r.text),aiOnce=texts.slice(1).every(t=>!t.includes(AI))
  const wantOk=Object.entries(want).every(([i,re])=>re.test(replies[Number(i)]?.text??''))
  const ok=JSON.stringify(got)===JSON.stringify(exp)&&wantOk&&aiOnce&&!stopped
  results.push({id,turns,replies:replies.map(r=>({ms:r.ms,text:r.text.slice(0,400)})),expected:exp,got,aiOnce,wantOk,pass:ok});console.log(ok?'PASS':'FAIL',id,JSON.stringify(got),aiOnce?'':'[riga AI!]',wantOk?'':'[risposta!]','|',replies.map(r=>r.text.replace(AI,'[AI]').replace(/\s+/g,' ').slice(0,130)).join(' ⏎ '))}
}finally{
 try{await restoreMenu();await linkCleanup()
  const outAfter=await outbound();console.log(outAfter===outBefore?'PASS nessun messaggio WhatsApp in uscita durante la prova':'FAIL messaggi in uscita: '+(outAfter-outBefore))
  await db`DELETE FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`;for(const p of savedProposal)await db`INSERT INTO tako_whatsapp_proposals ${db(p)}`
  for(const k of KEYS){if(saved[k].length)await db`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${k+WA_PHONE},${saved[k][0].response}) ON CONFLICT(sid) DO UPDATE SET response=EXCLUDED.response`;else await db`DELETE FROM tako_whatsapp_messages WHERE sid=${k+WA_PHONE}`}
  const after=await dbState(),afterDigest=await digest(after,baseIds),diff=Object.keys(beforeDigest).filter(k=>beforeDigest[k]!==afterDigest[k])
  const extra=after.rows.filter(r=>!baseIds.has(r.id)).map(r=>({name:r.name,available:r.available,inMenu:items(after.w.published).some(i=>i.id===r.id)}))
  const restored=!diff.length&&extra.every(x=>!x.available&&!x.inMenu)
  let memo=hash(await db`SELECT * FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`)===hash(savedProposal);for(const k of KEYS)memo=memo&&hash(await db`SELECT response FROM tako_whatsapp_messages WHERE sid=${k+WA_PHONE}`)===hash(saved[k])
  console.log(restored?'PASS QA ripristinato per hash':'FAIL ripristino '+diff.join(','),'· righe nuove spente',extra.length,'· proposta/memorie del numero ripristinate',memo)
  const pass=results.filter(r=>r.pass).length;console.log(`${pass}/${results.length} sequenze PASS${stopped?' — '+stopped:''}`)
  await writeFile(resolve(here,`result-n-${new Date().toISOString().replace(/[:.]/g,'-')}.json`),JSON.stringify({at:new Date().toISOString(),results,stopped,restore:{before:beforeDigest,after:afterDigest,ok:restored,extraRows:extra,memory:memo}},null,1))
 }catch(e){console.log('FAIL ripristino',e.message)}
 await api.call('/api/auth/logout',{method:'POST'}).catch(()=>{});await db.end()
}
