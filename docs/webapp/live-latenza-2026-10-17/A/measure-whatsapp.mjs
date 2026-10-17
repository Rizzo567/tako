// Misura A — bot WhatsApp: webhook firmato → commit nel DB → risposta TwiML, solo comandi deterministici (nessuna chiamata Groq).
// Il QA ha già un numero collegato (uno per locale): si usa quello come mittente (mai stampato); la risposta torna solo nel TwiML, a WhatsApp non parte nulla.
// Proposta in attesa e memoria «last:» di quel numero salvate prima e rimesse com'erano alla fine. Scritture SOLO sul QA; ripristino verificato per hash.
// Uso: node …/measure-whatsapp.mjs [--rounds=5] [--tag=before]
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash,createHmac,randomBytes} from 'node:crypto';import {homedir} from 'node:os';import {parseEnv} from 'node:util';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module'
import {client,json} from '../../../../scripts/translations/common.mjs'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..'),require=createRequire(resolve(repo,'package.json')),postgres=require('postgres')
const arg=(k,d)=>{const a=process.argv.find(x=>x.startsWith(`--${k}=`));return a?a.split('=').slice(1).join('='):d}
const ROUNDS=Number(arg('rounds',5)),TAG=arg('tag','run'),TYPES=arg('types','price,soldout,hide').split(',')
const BASE='https://takoitalia.com',QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16)
const env=await loadLocalEnvironment(repo),dbUrl=new URL(env.DATABASE_URL);dbUrl.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(dbUrl.toString(),{max:2,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const tw=parseEnv(await readFile(homedir()+'/.config/tako-webapp/twilio-menu.env','utf8'))
const sign=(u,form)=>createHmac('sha1',tw.TWILIO_AUTH_TOKEN).update(u+Object.keys(form).sort().map(k=>k+form[k]).join('')).digest('base64')
const qaLogin=JSON.parse(await readFile(homedir()+'/.config/tako-webapp/qa-login.json','utf8'))
const api=client();await api.call('/api/auth/login',json({email:qaLogin.email,password:qaLogin.password}))
const me=await api.call('/api/auth/me');if(me.data.restaurantId!==QA)throw Error('sessione non sul QA: stop')
async function dbState(){return db.begin('read only',async tx=>{const [w]=await tx`SELECT draft,published,revision,published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`;const items=await tx`SELECT id,section_id,name,description,price,image_url,allergens,tags,available,featured,position,name_translations,description_translations FROM menu_items WHERE restaurant_id=${QA} ORDER BY id`;const menus=await tx`SELECT id,name,description,type,active,position FROM menus WHERE restaurant_id=${QA} ORDER BY id`;const sections=await tx`SELECT s.id,s.menu_id,s.name,s.description,s.active,s.position,s.name_translations FROM menu_sections s JOIN menus m ON m.id=s.menu_id WHERE m.restaurant_id=${QA} ORDER BY s.id`;const tr=await tx`SELECT item_id,lang,name,description FROM menu_item_translations WHERE restaurant_id=${QA} ORDER BY item_id,lang`;const vv=await tx`SELECT v.id,v.item_id,v.name,v.price_modifier,v.available FROM item_variants v JOIN menu_items i ON i.id=v.item_id WHERE i.restaurant_id=${QA} ORDER BY v.id`;return{w,items,menus,sections,tr,vv}})}
const publicHash=async()=>{const a=await (await fetch(`${BASE}/api/customer/restaurant/${QA}/menu?prefetch=1`)).json(),b=await (await fetch(`${BASE}/api/customer/restaurant/${QA}/menu?prefetch=1&lang=en`)).json();return hash([a,b])}
const digest=async s=>({draft:hash(s.w.draft),published:hash(s.w.published),items:hash(s.items),menus:hash(s.menus),sections:hash(s.sections),translations:hash(s.tr),variants:hash(s.vv),public:await publicHash()})
const before=await dbState();if(before.w.revision!==before.w.published_revision)throw Error('QA con bozza non pubblicata: stop')
const beforeDigest=await digest(before),out=resolve(here,'evidence');await mkdir(out,{recursive:true})
await writeFile(resolve(out,`${TAG}-wa-qa-before.json`),JSON.stringify({at:new Date().toISOString(),revision:before.w.revision,digest:beforeDigest,draft:before.w.draft},null,1))
async function waitCommit(rev,from,limit=20000){const end=performance.now()+limit;for(;performance.now()<end;){const [r]=await db`SELECT published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`;if(Number(r.published_revision)>rev)return Math.round(performance.now()-from);await sleep(15)}return null}
async function whatsapp(body){const [r0]=await db`SELECT published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`;const form={AccountSid:tw.TWILIO_ACCOUNT_SID,From:WA_PHONE,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:'0',MessageSid:'SM'+randomBytes(16).toString('hex'),Body:body};const t0=performance.now();const seen=waitCommit(Number(r0.published_revision),t0);const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,form)},body:new URLSearchParams(form).toString()});const text=(await r.text()).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();const tReply=Math.round(performance.now()-t0);return{tReply,tCommit:await seen,status:r.status,st:r.headers.get('server-timing')||'',text:text.slice(0,160)}}
const [qaLink]=await db`SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${QA}`;if(!qaLink)throw Error('QA senza numero collegato: stop');const WA_PHONE=String(qaLink.phone)
const savedProposal=await db`SELECT * FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`,savedLast=await db`SELECT response FROM tako_whatsapp_messages WHERE sid=${'last:'+WA_PHONE}`
const results=[],errors=[];let linked=true
const names=before.w.draft.menus[0].sections[0].items.map(i=>i.name),dishP=names.find(n=>/ragù/.test(n))||names[0],dishS=names.find(n=>n==='boh')||names[1],dishH=names.find(n=>/sacc/.test(n))||names[2]
const priceOf=n=>before.w.draft.menus[0].sections[0].items.find(i=>i.name===n).price
try{
 for(const type of TYPES)for(let i=0;i<ROUNDS;i++){
  try{let r,undo
   if(type==='price'){r=await whatsapp(`prezzo ${dishP} a ${priceOf(dishP)+1+i}`)}
   if(type==='soldout'){r=await whatsapp(`${dishS} esaurito`);undo=`disponibile ${dishS}`}
   if(type==='hide'){r=await whatsapp(`nascondi ${dishH}`);undo=`mostra ${dishH}`}
   results.push({type,i,...r});console.log(type,i,JSON.stringify(r))
   if(undo){await sleep(300);const u=await whatsapp(undo);console.log(' undo',u.tReply,u.tCommit,u.text.slice(0,60))}
  }catch(e){errors.push(type+i+': '+e.message);console.log('ERR',type,i,e.message)}
  await sleep(400)}
}finally{
 try{
  await db`DELETE FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`;for(const p of savedProposal)await db`INSERT INTO tako_whatsapp_proposals ${db(p)}`;if(savedLast.length)await db`UPDATE tako_whatsapp_messages SET response=${savedLast[0].response} WHERE sid=${'last:'+WA_PHONE}`;else await db`DELETE FROM tako_whatsapp_messages WHERE sid=${'last:'+WA_PHONE}`
  const cur=await api.call('/api/menu-workspace');const saved=await api.call('/api/menu-workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:cur.revision,workspace:before.w.draft})});await api.call('/api/menu-workspace/publish',json({expectedRevision:saved.revision}))
  for(const it of before.items){const now=(await db`SELECT available FROM menu_items WHERE id=${it.id}`)[0];if(now&&now.available!==it.available)await api.call(`/api/menus/items/${it.id}/availability`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({available:it.available})})}
  const afterDigest=await digest(await dbState()),diff=Object.keys(beforeDigest).filter(k=>beforeDigest[k]!==afterDigest[k])
  console.log(diff.length?'FAIL ripristino '+diff.join(','):'PASS QA ripristinato per hash');console.log('proposta/memoria del numero ripristinate',hash((await db`SELECT * FROM tako_whatsapp_proposals WHERE phone=${WA_PHONE}`))===hash(savedProposal)&&hash((await db`SELECT response FROM tako_whatsapp_messages WHERE sid=${'last:'+WA_PHONE}`))===hash(savedLast))
  const p50=(k,ty)=>{const v=results.filter(r=>r.type===ty&&r[k]!=null).map(r=>r[k]).sort((a,b)=>a-b);return v.length?v[Math.floor((v.length-1)/2)]:null}
  const summary=Object.fromEntries(TYPES.map(ty=>[ty,{tCommit:p50('tCommit',ty),tReply:p50('tReply',ty)}]));console.log(JSON.stringify(summary))
  await writeFile(resolve(out,`${TAG}-whatsapp-${new Date().toISOString().replace(/[:.]/g,'-')}.json`),JSON.stringify({tag:TAG,results,summary,errors,restore:{before:beforeDigest,after:afterDigest,ok:!diff.length}},null,1))
 }catch(e){console.log('FAIL ripristino',e.message)}
 await api.call('/api/auth/logout',{method:'POST'}).catch(()=>{});await db.end()
}
