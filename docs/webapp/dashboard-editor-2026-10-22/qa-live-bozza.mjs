// Batteria DAL VIVO «bozza + bot» sul ristorante QA (26050ecd…) — PIANO §8 punto 3. DA ESEGUIRE SOLO DOPO IL DEPLOY (edge
// operativo con applyBotChange + /api/menu-workspace/ops). Uso:
//   TAKO_QA_ORIGIN=https://<dashboard> node qa-live-bozza.mjs [tag]
// Stesso schema di docs/webapp/bot-haiku-2026-10-21/notte-1022/qa-live-batteria.mjs: webhook firmato con TakoSyncTest=1 dal numero
// collegato SOLO al QA (verificato), risposta solo nel TwiML, nessun WhatsApp inviato; letture del DB in sola lettura (qa-read);
// scritture SOLO dalle vie del prodotto (API della dashboard col login QA, bot). MAI SQL in scrittura. Lock condiviso QA.lock.
// Scenari: (a) op di bozza su A; (b) il bot cambia B → pubblicato solo B, bozza A+B; (c) A cancellato in bozza, il bot cambia C →
// pubblicato solo C, bozza senza A; (e) «annulla» del bot → C torna in pubblicato e bozza, bozza ancora pendente; (d) Pubblica da
// API → pubblicato = bozza; (f) ripristino del QA con PUT del documento iniziale + Pubblica (API), verifica «QA identico».
import fs from 'node:fs';import path from 'node:path';import {homedir} from 'node:os';import {parseEnv} from 'node:util';import {createHmac,randomBytes,randomUUID} from 'node:crypto';import {fileURLToPath} from 'node:url'
import {q} from '../bot-haiku-2026-10-21/qa-read.mjs'
const HERE=path.dirname(fileURLToPath(import.meta.url)),QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',cfg=path.join(homedir(),'.config/tako-webapp')
const TAG=process.argv[2]||new Date().toISOString().slice(0,16).replace(/[:T]/g,'-'),ORIGIN=process.env.TAKO_QA_ORIGIN
if(!ORIGIN)throw new Error('TAKO_QA_ORIGIN mancante (origine della dashboard): mi fermo')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

// ---------- bot: numero / firma (come qa-live-batteria) ----------
const phone=JSON.parse(fs.readFileSync(path.join(cfg,'owner-service-qa-backup.json'),'utf8'))?.link?.phone
const link=await q(`SELECT restaurant_id FROM tako_whatsapp_links WHERE phone='${phone.replace(/'/g,"''")}'`)
if(link.length!==1||link[0].restaurant_id!==QA)throw new Error('numero non collegato solo al QA: mi fermo')
const tw=parseEnv(fs.readFileSync(path.join(cfg,'twilio-menu.env'),'utf8'))
const sign=(u,form)=>createHmac('sha1',tw.TWILIO_AUTH_TOKEN).update(u+Object.keys(form).sort().map(k=>k+form[k]).join('')).digest('base64')
async function say(body){
 const form={AccountSid:tw.TWILIO_ACCOUNT_SID,From:phone,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:'0',MessageSid:'SM'+randomBytes(16).toString('hex'),Body:body,TakoSyncTest:'1'},t0=performance.now()
 let raw='';try{const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,form)},body:new URLSearchParams(form).toString(),signal:AbortSignal.timeout(90000)});raw=await r.text()}catch(e){raw='[ERRORE RETE '+e.message+']'}
 const reply=raw.replace(/<[^>]+>/g,' ').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()
 console.log('  bot>',body,`[${Math.round(performance.now()-t0)} ms]`,'\n      ',reply.slice(0,300));await sleep(2500);return reply
}

// ---------- dashboard: login QA (file di credenziali, mai stampato) ----------
const cred=JSON.parse(fs.readFileSync(path.join(cfg,'qa-login.json'),'utf8'));let cookie=''
async function login(){const r=await fetch(ORIGIN+'/api/auth/login',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({email:cred.email,password:cred.password})});if(r.status!==200)throw new Error('login '+r.status);cookie=r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')}
async function api(method,p,body){const r=await fetch(ORIGIN+p,{method,headers:{Origin:ORIGIN,Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const text=await r.text();let json=null;try{json=JSON.parse(text)}catch{}if(!r.ok)throw new Error(`${method} ${p} → ${r.status} ${text.slice(0,200)}`);return json}
const clientId='qa-live-bozza-'+randomUUID();let seq=0
const ops=list=>api('POST','/api/menu-workspace/ops',{ops:list,clientId,seq:++seq})

// ---------- lettura (sola lettura) ----------
async function row(){const [w]=await q(`SELECT revision,published_revision,draft,published FROM menu_workspaces WHERE restaurant_id='${QA}'`);return w}
const items=w=>{const out=new Map();for(const m of w.menus||[])for(const s of m.sections||[])for(const i of s.items||[])out.set(i.id,{...i,section:s.name,menu:m.name});return out}
const canon=v=>v===null||typeof v!=='object'?JSON.stringify(v??null):Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}'
const same=(a,b)=>canon(a)===canon(b)
const eur=n=>String(n).replace('.',',')

// ---------- lock ----------
const LOCK=path.join(HERE,'../bot-haiku-2026-10-21/notte-1022/QA.lock');{const t0=Date.now();while(fs.existsSync(LOCK)){if(Date.now()-t0>15*60e3)throw new Error('QA.lock occupato da oltre 15 min');console.log('lock occupato, aspetto…');await sleep(10000)}}
fs.writeFileSync(LOCK,`qa-live-bozza ${process.pid} ${new Date().toISOString()}\n`);const unlock=()=>{try{fs.unlinkSync(LOCK)}catch{}};process.on('exit',unlock);process.on('SIGINT',()=>{unlock();process.exit(130)})

const results=[];const check=(id,ok,detail)=>{results.push({id,ok:!!ok,detail});console.log(ok?'  OK ':'  KO ',id,detail??'')}
await login()
const START=await row()
fs.writeFileSync(path.join(HERE,`qa-live-bozza-start-${TAG}.json`),JSON.stringify(START))
if(!same(START.draft,START.published))throw new Error('il QA ha già una bozza pendente: mi fermo (serve un QA pulito)')
// tre piatti visibili con prezzo > 0 e nome unico nel menu, presi dal pubblicato
const all=[...items(START.published).values()],uniq=all.filter(i=>!i.hidden&&i.available!==false&&Number(i.price)>0&&all.filter(x=>x.name.toLowerCase()===i.name.toLowerCase()).length===1)
if(uniq.length<3)throw new Error('servono 3 piatti visibili con nome unico nel QA')
const [A,Bd,Cd]=uniq
console.log('A =',A.name,'· B =',Bd.name,'· C =',Cd.name)
let fatal=null
try{
 // (a) op di bozza su A
 const a=await ops([{op:'set',kind:'item',id:A.id,fields:{price:Number(A.price)+1}}])
 let r=await row()
 check('a-bozza-scritta',a?.pending===true&&items(r.draft).get(A.id).price===Number(A.price)+1&&items(r.published).get(A.id).price===Number(A.price),'pending='+a?.pending)
 // (b) il bot cambia B
 const bReply=await say(`${Bd.name} a ${eur(Number(Bd.price)+2)} euro`)
 r=await row()
 check('b-pubblicato-solo-B',items(r.published).get(Bd.id).price===Number(Bd.price)+2&&items(r.published).get(A.id).price===Number(A.price),bReply.slice(0,120))
 check('b-bozza-A+B',items(r.draft).get(Bd.id).price===Number(Bd.price)+2&&items(r.draft).get(A.id).price===Number(A.price)+1)
 check('b-niente-dashboardPending',!/modifiche in attesa nella dashboard/i.test(bReply),bReply.slice(0,120))
 // (c) A cancellato in bozza, il bot cambia C
 await ops([{op:'remove',kind:'item',id:A.id}])
 const cReply=await say(`${Cd.name} a ${eur(Number(Cd.price)+3)} euro`)
 r=await row()
 check('c-pubblicato-solo-C',items(r.published).get(Cd.id).price===Number(Cd.price)+3&&items(r.published).has(A.id)&&items(r.published).get(A.id).price===Number(A.price),cReply.slice(0,120))
 check('c-bozza-senza-A',!items(r.draft).has(A.id)&&items(r.draft).get(Cd.id).price===Number(Cd.price)+3&&items(r.draft).get(Bd.id).price===Number(Bd.price)+2)
 // (e) «annulla» del bot: C torna com'era in entrambi, la bozza resta pendente
 const eReply=await say('annulla')
 r=await row()
 check('e-annulla-C',items(r.published).get(Cd.id).price===Number(Cd.price)&&items(r.draft).get(Cd.id).price===Number(Cd.price),eReply.slice(0,120))
 check('e-bozza-ancora-pendente',!same(r.draft,r.published)&&!items(r.draft).has(A.id))
 // (d) Pubblica da API: pubblicato = bozza
 const st=await api('GET','/api/menu-workspace/status')
 await api('POST','/api/menu-workspace/publish',{expectedRevision:st.revision})
 r=await row()
 check('d-pubblica-tutto',same(r.draft,r.published)&&!items(r.published).has(A.id))
}catch(e){fatal=String(e?.message??e);console.log('  !! errore:',fatal)}
// (f) ripristino con le vie del prodotto: documento iniziale in bozza (PUT) + Pubblica; verifica «QA identico»
let restored=false
for(let round=1;round<=2&&!restored;round++){
 try{const st=await api('GET','/api/menu-workspace/status');const put=await api('PUT','/api/menu-workspace',{expectedRevision:st.revision,workspace:START.published})
  const rev=Number(put?.revision??(await api('GET','/api/menu-workspace/status')).revision)
  await api('POST','/api/menu-workspace/publish',{expectedRevision:rev})}catch(e){console.log('  !! ripristino giro',round,':',e.message)}
 const r=await row();restored=same(r.published,START.published)&&same(r.draft,START.published)
}
check('f-QA-identico',restored)
const out={tag:TAG,at:new Date().toISOString(),fatal,restored,ok:results.filter(x=>x.ok).length,total:results.length,results}
fs.writeFileSync(path.join(HERE,`qa-live-bozza-${TAG}.json`),JSON.stringify(out,null,1))
console.log(`\n== ${out.ok}/${out.total} OK${fatal?' — ERRORE: '+fatal:''} — QA ${restored?'IDENTICO':'NON identico: fermarsi e ripristinare a mano dalla dashboard (Storico versioni)'}`)
unlock()
if(!restored)process.exitCode=2
