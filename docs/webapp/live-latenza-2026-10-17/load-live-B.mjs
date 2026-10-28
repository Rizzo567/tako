// Carico latenza live B (17/10/2026): N «telefoni» dietro lo stesso IP (questo Mac) agganciati al canale live del QA,
// con la STESSA regola del client nuovo (apps/web/src/lib/public-menu-live.ts):
//   segnale con delta (d)  → nessuna lettura subito; riconferma dopo 0,15–3,5 s;
//   segnale senza delta    → rilettura dopo 0–PUSH_JITTER_MS; su 502/503/504 al massimo 2 nuovi tentativi dopo 1–3 s; 429 = stop.
// Sul QA (API owner) si pubblicano K cambi di prezzo (delta) e K cambi strutturali (piatto aggiunto / tolto), uno ogni ~10 s.
// Misura: 429/5xx, letture, e per i cambi strutturali il tempo segnale → rilettura riuscita per telefono (= commit→schermo sotto carico).
// Ripristino: si tolgono solo i piatti creati qui (per id) e si rimette il prezzo originale.
// Le riletture portano ?live=<k> del segnale (lettura condivisa nel Worker); 'nolive' come 4° argomento le fa senza.
// Uso: TAKO_ENV_ROOT=<repo con .env.web> node docs/webapp/live-latenza-2026-10-17/load-live-B.mjs [N=30] [K=3] [jitterMs] [nolive]
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {homedir} from 'node:os';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module'
import {client,json} from '../../../scripts/translations/common.mjs'
import {loadLocalEnvironment} from '../../../scripts/start-webapp.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../..'),N=Number(process.argv[2]||30),K=Number(process.argv[3]||3),QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
const src=await readFile(resolve(repo,'apps/web/src/lib/public-menu-live.ts'),'utf8'),KEY=src.match(/PUBLISHABLE_KEY = '([^']+)'/)[1],JITTER=Number(process.argv[4]||src.match(/PUSH_JITTER_MS = (\d+)/)[1])
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),stats={live:{},joined:0,pushes:0,withDelta:0,reads:0,status:{},readMs:[],retries:0,structural:[]}
const LIVE=process.argv[5]!=='nolive'
async function read(kind,k){for(let attempt=0;attempt<3;attempt++){const t=Date.now();const r=await fetch(`https://takoitalia.com/api/customer/restaurant/${QA}/menu?prefetch=1${LIVE&&k?'&live='+k:''}`);await r.arrayBuffer();stats.reads++;stats.status[r.status]=(stats.status[r.status]||0)+1;const lv=r.headers.get('x-takomenu-live')||'none';stats.live[lv]=(stats.live[lv]||0)+1;stats.readMs.push(Date.now()-t);if(r.ok)return true;if(r.status===429||![502,503,504].includes(r.status))return false;stats.retries++;await sleep(1000+Math.random()*2000)}return false}
const phones=Array.from({length:N},()=>{const ws=new WebSocket(`wss://tcfccmvpycivxuxkoqpw.supabase.co/realtime/v1/websocket?apikey=${encodeURIComponent(KEY)}&vsn=1.0.0`),topic='realtime:menu-live:'+QA
 ws.onopen=()=>{ws.send(JSON.stringify({topic,event:'phx_join',payload:{config:{broadcast:{self:false,ack:false},presence:{key:'',enabled:false},postgres_changes:[],private:true},access_token:KEY},ref:'1',join_ref:'1'}));setInterval(()=>{try{ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:'h'}))}catch{}},25000).unref()}
 ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.event==='phx_reply'&&m.topic===topic&&m.payload.status==='ok')stats.joined++
  if(m.event!=='broadcast'||m.payload?.event!=='v')return
  stats.pushes++;const t0=Date.now(),d=m.payload.payload?.d,k=m.payload.payload?.k
  if(Array.isArray(d)){stats.withDelta++;await sleep(150+Math.random()*3350);await read('reconcile',k)}
  else{await sleep(Math.random()*JITTER);const ok=await read('push',k);stats.structural.push({ok,ms:Date.now()-t0})}}
 return ws})
await sleep(5000)
const env=await loadLocalEnvironment(process.env.TAKO_ENV_ROOT||repo);void env
const q=JSON.parse(await readFile(homedir()+'/.config/tako-webapp/qa-login.json','utf8')),api=client();await api.call('/api/auth/login',json({email:q.email,password:q.password}))
const created=new Set()
async function publish(mutate){for(let attempt=0;;attempt++){try{const r=await api.call('/api/menu-workspace');mutate(r.data);const s=await api.call('/api/menu-workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:r.revision,workspace:r.data})});await api.call('/api/menu-workspace/publish',json({expectedRevision:s.revision}));return}catch(e){if(attempt>=2)throw e;await sleep(1500)}}}
const first=(await api.call('/api/menu-workspace')).data.menus[0].sections[0].items[0],original=first.price,template=structuredClone(first)
const changes=[];for(let k=0;k<K;k++)changes.push(['delta',k],['struct',k])
const started=Date.now()
try{for(const [kind,k] of changes){
 if(kind==='delta')await publish(w=>{w.menus[0].sections[0].items[0].price=original+k+1})
 else{const id=randomUUID();created.add(id);await publish(w=>{w.menus[0].sections[0].items.push({...structuredClone(template),id,name:'Carico live '+k,translations:{}})})}
 await sleep(10000)}
}finally{
 await publish(w=>{w.menus[0].sections[0].items=w.menus[0].sections[0].items.filter(x=>!created.has(x.id));w.menus[0].sections[0].items[0].price=original})
 await sleep(9000);await api.call('/api/auth/logout',{method:'POST'});for(const ws of phones)ws.close()
 if(created.size){const require=createRequire(resolve(repo,'package.json')),postgres=require('postgres'),u=new URL(env.DATABASE_URL);u.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined;const db=postgres(u.toString(),{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}})
  await db`DELETE FROM menu_item_translations WHERE restaurant_id=${QA} AND item_id = ANY(${[...created]}::uuid[])`;await db`DELETE FROM menu_items WHERE restaurant_id=${QA} AND id = ANY(${[...created]}::uuid[])`;await db.end()}
}
const pct=(xs,p)=>{const s=[...xs].sort((a,b)=>a-b);return s.length?s[Math.min(s.length-1,Math.ceil(p*s.length)-1)]:null}
const st=stats.structural.filter(x=>x.ok).map(x=>x.ms)
const result={at:new Date().toISOString(),phones:N,liveCache:stats.live,coalescing:LIVE,changes:changes.length,jitterMs:JITTER,durationS:Math.round((Date.now()-started)/1000),joined:stats.joined,pushesReceived:stats.pushes,withDelta:stats.withDelta,reads:stats.reads,retries:stats.retries,status:stats.status,readMsP50:pct(stats.readMs,.5),readMsP95:pct(stats.readMs,.95),
 structural:{reads:stats.structural.length,failed:stats.structural.filter(x=>!x.ok).length,signalToReadP50:pct(st,.5),signalToReadP95:pct(st,.95),max:Math.max(0,...st)}}
console.log(JSON.stringify(result));await mkdir(resolve(here,'evidence'),{recursive:true});await writeFile(resolve(here,'evidence',`load-B-${N}x${changes.length}-j${JITTER}-${Date.now()}.json`),JSON.stringify(result,null,1));process.exit(0)
