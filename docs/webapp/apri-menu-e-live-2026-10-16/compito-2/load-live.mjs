// Carico Compito 2: N «telefoni» dietro lo stesso IP (questo Mac) agganciati al canale live del QA.
// Ogni telefono, al segnale, fa UNA rilettura del menu (prefetch=1) dopo il jitter del client (0,15–3,5 s, più al massimo 2 nuovi tentativi su 502/503/504), come la pagina vera.
// Si pubblicano K modifiche (prezzo) in 60 s sul QA via API owner; si contano le risposte 429. Ripristino del prezzo alla fine.
// Uso: node docs/webapp/apri-menu-e-live-2026-10-16/compito-2/load-live.mjs [N=30] [K=3]
import {readFile,writeFile} from 'node:fs/promises';import {homedir} from 'node:os';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url'
import {client,json} from '../../../../scripts/translations/common.mjs'
const here=dirname(fileURLToPath(import.meta.url)),N=Number(process.argv[2]||30),K=Number(process.argv[3]||3),QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
const src=await readFile(resolve(here,'../../../../apps/web/src/lib/public-menu-live.ts'),'utf8'),KEY=src.match(/PUBLISHABLE_KEY = '([^']+)'/)[1]
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),stats={joined:0,pushes:0,reads:0,status:{},readMs:[]}
const phones=Array.from({length:N},()=>{const ws=new WebSocket(`wss://tcfccmvpycivxuxkoqpw.supabase.co/realtime/v1/websocket?apikey=${encodeURIComponent(KEY)}&vsn=1.0.0`);let ref=0;const topic='realtime:menu-live:'+QA
 ws.onopen=()=>ws.send(JSON.stringify({topic,event:'phx_join',payload:{config:{broadcast:{self:false,ack:false},presence:{key:'',enabled:false},postgres_changes:[],private:true},access_token:KEY},ref:String(++ref),join_ref:'1'}))
 ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.event==='phx_reply'&&m.topic===topic&&m.payload.status==='ok')stats.joined++;if(m.event==='broadcast'&&m.payload?.event==='v'){stats.pushes++;(stats.ats??={})[m.payload.payload.at]=(stats.ats[m.payload.payload.at]||0)+1;await sleep(150+Math.random()*3350);for(let attempt=0;attempt<3;attempt++){const t=Date.now();const r=await fetch(`https://takoitalia.com/api/customer/restaurant/${QA}/menu?prefetch=1`);await r.arrayBuffer();stats.reads++;stats.status[r.status]=(stats.status[r.status]||0)+1;stats.readMs.push(Date.now()-t);if(r.ok||r.status===429||![502,503,504].includes(r.status))break;stats.retries=(stats.retries||0)+1;await sleep(1000+Math.random()*2000)}}}
 return ws})
await sleep(4000)
const q=JSON.parse(await readFile(homedir()+'/.config/tako-webapp/qa-login.json','utf8')),api=client();await api.call('/api/auth/login',json({email:q.email,password:q.password}))
const first=(await api.call('/api/menu-workspace')).data.menus[0].sections[0].items[0],original=first.price
async function setPrice(p){const r=await api.call('/api/menu-workspace');r.data.menus[0].sections[0].items[0].price=p;const s=await api.call('/api/menu-workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:r.revision,workspace:r.data})});await api.call('/api/menu-workspace/publish',json({expectedRevision:s.revision}))}
const started=Date.now();for(let k=0;k<K;k++){await setPrice(original+k+1);await sleep(Math.max(0,started+(k+1)*(60000/K)-Date.now()))}
await setPrice(original);await sleep(9000);await api.call('/api/auth/logout',{method:'POST'});for(const ws of phones)ws.close()
const s=[...stats.readMs].sort((a,b)=>a-b),result={at:new Date().toISOString(),phones:N,changesPerMinute:K,joined:stats.joined,pushesReceived:stats.pushes,ats:stats.ats,reads:stats.reads,retries:stats.retries||0,status:stats.status,readMsP50:s[Math.floor(s.length/2)],readMsP95:s[Math.ceil(s.length*.95)-1]}
console.log(JSON.stringify(result));await writeFile(resolve(here,'evidence',`load-${N}x${K}-${Date.now()}.json`),JSON.stringify(result,null,1));process.exit(0)
