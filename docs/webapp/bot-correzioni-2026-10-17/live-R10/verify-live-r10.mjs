// R10 (18/10): i 2 vocali VERI di Manuel delle 16:03 e 16:05 UTC sul QA (stato di riferimento = QA attuale, rev 1822: Primi con 4 piatti,
// ragù in «Piatti di prova» a 10 visibile), solo TwiML, una sequenza per vocale (proposta e cronologia azzerate prima di ognuna).
// Adattata da live-R9/verify-live-r9.mjs. I MediaUrl sono quelli dei messaggi Twilio originali (Media SID letto da Twilio, sola lettura).
// R8 (18/10): i 3 messaggi di Manuel delle 12:56–12:58 sul QA (stato di riferimento = QA attuale, con Primi/la parmigiana), solo TwiML.
// Controllo in più: mai una risposta che dice «fatto» senza scrittura (claimNoWrite). Adattata da live-R72/verify-live-r72.mjs.
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
const savedBrainMem=await db`SELECT * FROM tako_owner_brain_memory WHERE restaurant_id=${QA}`,savedTurns=await db`SELECT * FROM tako_owner_brain_turns WHERE phone=${WA_PHONE}`
const linkCleanup=async()=>{await db`DELETE FROM tako_owner_brain_turns WHERE phone=${WA_PHONE}`;for(const t of savedTurns)await db`INSERT INTO tako_owner_brain_turns ${db(t)}`;await db`DELETE FROM tako_owner_brain_memory WHERE restaurant_id=${QA}`;for(const m of savedBrainMem)await db`INSERT INTO tako_owner_brain_memory ${db(m)}`}
const savedProposal=await db`SELECT * FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`,saved={};for(const k of KEYS)saved[k]=await db`SELECT response FROM tako_whatsapp_messages WHERE sid=${k+WA_PHONE}`
async function whatsapp(body,media){const form={AccountSid:tw.TWILIO_ACCOUNT_SID,From:WA_PHONE,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:media?'1':'0',MessageSid:(media?'MM':'SM')+randomBytes(16).toString('hex'),Body:media?'':body,TakoSyncTest:'1'};if(media){form.MediaUrl0=`https://api.twilio.com/2010-04-01/Accounts/${tw.TWILIO_ACCOUNT_SID}/Messages/${media[0]}/Media/${media[1]}`;form.MediaContentType0='audio/ogg'};const t0=performance.now();const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,form)},body:new URLSearchParams(form).toString()});const raw=await r.text();const text=raw.replace(/<\/Message><Message>/g,'\n').replace(/<[^>]+>/g,'').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();return{status:r.status,ms:Math.round(performance.now()-t0),text}}
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

const AI='assistente automatico'
const usage=async()=>Number((await db`SELECT coalesce(sum(prompt_tokens+completion_tokens),0)::int t FROM tako_whatsapp_ai_usage WHERE day>=current_date-1`)[0].t)
const errs=async()=>Number((await db`SELECT count(*)::int n FROM tako_whatsapp_errors`)[0].n)
const CAP=Number(process.argv[3]||15000),GAP=Number(process.argv[4]||800)
// [testo | {voice:[MM,ME],label}, controllo: 'nowrite' | 'write' | 'any', regex attesa facoltativa]
// R9: i 3 vocali VERI di Manuel (12:30–12:32 UTC), serviti come MediaUrl dei messaggi Twilio originali (lettura), trascritti dall'edge.
const mediaOf=async mm=>{const j=await (await fetch(`https://api.twilio.com/2010-04-01/Accounts/${tw.TWILIO_ACCOUNT_SID}/Messages/${mm}/Media.json`,{headers:{authorization:twAuth}})).json();const sid=j.media_list?.[0]?.sid;if(!sid)throw Error('media non trovato: stop');return [mm,sid]}
// [vocale, controllo, regex attesa, azzera prima]: 16:05 «Togli tutti i piatti dalla sezione altre proposte» → riepilogo dei piatti di
// «Piatti di prova» da confermare con OK (nessuna scrittura, mai «quale sezione» / «non esiste»); 16:03 «Nei primi aggiungi…» → nessuna scrittura.
const T=[[{voice:await mediaOf('MM0c7777039c363b4c73daa36745147936'),label:'[vocale 16:05] Togli tutti i piatti dalla sezione altre proposte'},'nowrite',/da confermare con OK/,true],
 [{voice:await mediaOf('MM0716f557a5889e278b056d5aeeb565e7'),label:'[vocale 16:03] Nei primi aggiungi pasta al pesto, pasta al ragù, pasta carbonara e riso giallo…'},'nowrite',null,true]]
const BAD=/quale sezione|non esiste una sezione|quali piatti/i
const CLAIM=/\b(?:aggiunt[oaie]|creat[oaie]|inserit[oaie]|spostat[oaie]|aggiornat[oaie]|fatto|ho (?:aggiunto|creato|inserito|spostato|aggiornato|messo))\b/i
const claimNoWrite=(text,wrote)=>!wrote&&text.replace(/^Sono l.*?persona\.\s*/s,'').split(/\n\n/)[0].split(/(?<=[.!?\n])\s*/).some(x=>!/\?\s*$/.test(x.trim())&&CLAIM.test(x)&&!/non ho|da confermare|serve il tuo/i.test(x))
const results=[];let stopped=null,prev=before.w.published
const u0=await usage(),e0=await errs()
try{
 await restoreMenu();await fresh()
 for(const [i,[t,check,re,reset]] of T.entries()){if(stopped)break
  if(reset&&i>0)await fresh()
  if(await usage()-u0+6000>CAP){stopped='tetto token raggiunto prima del turno '+(i+1);break}
  const label=typeof t==='string'?t:t.label,r=typeof t==='string'?await whatsapp(t):await whatsapp('',t.voice)
  await sleep(400);const s=await dbState(),got=changes(s.w.published),delta=JSON.stringify(got)!==JSON.stringify(changes(prev));prev=s.w.published
  const pend=(await db`SELECT count(*)::int n FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`)[0].n
  const ai=r.text.includes(AI),aiOk=true,checkOk=(check==='nowrite'?!delta:check==='write'?delta:true)&&!claimNoWrite(r.text,delta)&&!/^(?:Sono l.*?persona\.\s*)?Non ho cambiato nulla\.$/s.test(r.text.trim()),reOk=(re?re.test(r.text):true)&&!BAD.test(r.text)
  const row={turn:i+1,msg:label,status:r.status,ms:r.ms,reply:r.text.slice(0,500),published:got,wrote:delta,pending:pend,checkOk,aiOk,reOk,tokensSoFar:await usage()-u0}
  results.push(row);console.log(`${checkOk&&aiOk&&reOk?'OK  ':'KO  '}#${i+1} ${r.ms}ms wrote=${delta} pend=${pend} tok=${row.tokensSoFar} | ${label} ⏎ ${r.text.replace(/\s+/g,' ').slice(0,220)} | ${JSON.stringify(got)}`)
  if(r.status!==200){stopped='stato '+r.status;break}
  if(check==='nowrite'&&delta&&i>=8){stopped='scrittura su domanda (sicurezza): stop';break}
  await sleep(GAP)}
}finally{
 try{await restoreMenu();await linkCleanup()
  const outAfter=await outbound();console.log(outAfter===outBefore?'PASS nessun messaggio WhatsApp in uscita ('+outBefore+'→'+outAfter+')':'FAIL messaggi in uscita: '+(outAfter-outBefore))
  await db`DELETE FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`;for(const p of savedProposal)await db`INSERT INTO tako_whatsapp_proposals ${db(p)}`
  for(const k of KEYS){if(saved[k].length)await db`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${k+WA_PHONE},${saved[k][0].response}) ON CONFLICT(sid) DO UPDATE SET response=EXCLUDED.response`;else await db`DELETE FROM tako_whatsapp_messages WHERE sid=${k+WA_PHONE}`}
  const after=await dbState(),afterDigest=await digest(after,baseIds),diff=Object.keys(beforeDigest).filter(k=>beforeDigest[k]!==afterDigest[k])
  const extra=after.rows.filter(r=>!baseIds.has(r.id)).map(r=>({name:r.name,available:r.available,inMenu:items(after.w.published).some(i=>i.id===r.id)}))
  const restored=!diff.length&&extra.every(x=>!x.available&&!x.inMenu)
  let memo=hash(await db`SELECT * FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`)===hash(savedProposal);for(const k of KEYS)memo=memo&&hash(await db`SELECT response FROM tako_whatsapp_messages WHERE sid=${k+WA_PHONE}`)===hash(saved[k])
  const e1=await errs(),u1=await usage(),ms=results.map(r=>r.ms).sort((a,b)=>a-b)
  console.log(restored?'PASS QA ripristinato per hash':'FAIL ripristino '+diff.join(','),JSON.stringify(beforeDigest),JSON.stringify(afterDigest),'extra',extra.length,'memo',memo)
  console.log('errori',e0,'→',e1,'· token',u1-u0,'· p50',ms[Math.floor((ms.length-1)/2)],'ms',stopped||'')
  await writeFile(resolve(here,`result-r10-${new Date().toISOString().replace(/[:.]/g,'-')}.json`),JSON.stringify({at:new Date().toISOString(),results,stopped,twilio:{before:outBefore,after:outAfter},errors:{before:e0,after:e1},tokens:u1-u0,restore:{before:beforeDigest,after:afterDigest,ok:restored,extraRows:extra,memory:memo}},null,1))
 }catch(e){console.log('FAIL ripristino',e.message)}
 await api.call('/api/auth/logout',{method:'POST'}).catch(()=>{});await db.end()
}
