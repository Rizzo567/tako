// Dopo un deploy di tako-operational-candidate: aspetta che la versione nuova risponda davvero, PRIMA di dare il via
// alle prove dal vivo o di dire «online». Misurato il 21/10 su v140: deploy finito alle 20:59:03 UTC, primo avvio di v140
// alle 21:00:14 → per ~70 s la funzione non serviva nessuna richiesta (le richieste restano appese nel router Supabase:
// il cron con timeout 55 s è passato, un webhook Twilio con timeout 15 s verrebbe perso). L'avvio del nostro codice invece
// costa ~0,1 s (modulo) + ~0,3 s (createApp): non è lì il tempo.
//
// Sicuro: una sola GET su /health SENZA intestazioni del gateway → il nostro codice risponde 403 GATEWAY_REQUIRED prima di
// avviare l'app (nessun DB, nessun Twilio, nessun segreto nella richiesta). Il token Management serve solo, in lettura, per
// leggere la versione attiva e (facoltativo) i log «booted» della versione nuova. Mai stampato.
//
// node scripts/serverless/wait-edge-ready.mjs [--version=N] [--max-s=240] [--no-logs]
// Uscita 0 + {"ready":true,...} quando 2 risposte di fila arrivano dal codice in < 3 s (e, se possibile, i log mostrano
// un avvio della versione attesa); uscita 1 + {"ready":false,...} oltre --max-s.
import {readFile} from 'node:fs/promises';import {parseEnv} from 'node:util';import {homedir} from 'node:os'
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')).map(([k,v])=>[k,v??'1']))
const slug='tako-operational-candidate',maxMs=Number(args['max-s']||240)*1000,started=Date.now()
const token=parseEnv(await readFile(homedir()+'/.config/tako-webapp/supabase-management.env','utf8')).SUPABASE_ACCESS_TOKEN
const config=parseEnv(await readFile(new URL('../../.env.web',import.meta.url),'utf8')),base=new URL(config.SUPABASE_URL),ref=base.hostname.split('.')[0]
if(!token||!/^[a-z0-9]{20}$/.test(ref))throw new Error('Configurazione Management mancante')
const api=(path)=>fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)}).then(async r=>{if(!r.ok)throw new Error('Management HTTP '+r.status);return r.json()})
const meta=await api('functions/'+slug),version=Number(args.version||meta.version)
if(args.version&&Number(meta.version)!==version){console.log(JSON.stringify({ready:false,reason:'versione attiva diversa',active:meta.version,expected:version}));process.exit(1)}
const probes=[];let fast=0
while(Date.now()-started<maxMs&&fast<2){
 const t0=Date.now();let status=0,code=''
 try{const r=await fetch(`${base.origin}/functions/v1/${slug}/health`,{signal:AbortSignal.timeout(Math.max(5000,maxMs-(t0-started)))});status=r.status;code=(await r.json().catch(()=>({})))?.error?.code||''}catch(error){code=error instanceof Error?error.name:'Error'}
 const ms=Date.now()-t0,ours=status===403&&code==='GATEWAY_REQUIRED';probes.push({atS:Math.round((t0-started)/1000),ms,status,code})
 fast=ours&&ms<3000?fast+1:0
 if(fast<2)await new Promise(r=>setTimeout(r,ours?1000:3000))
}
const ready=fast>=2,firstAnswerMs=probes.length?probes[0].ms:null
// Conferma dai log (ingestione con qualche secondo di ritardo): un avvio «booted» della versione attesa dopo l'inizio.
let versionBooted=null
if(ready&&!args['no-logs']){const since=new Date(started-120000).toISOString()
 for(let i=0;i<12&&!versionBooted;i++){
  try{const u=new URLSearchParams({sql:`select count() n from logs where source='function_logs' and log_attributes['version']='${version}' and event_message like 'booted%'`,iso_timestamp_start:since,iso_timestamp_end:new Date(Date.now()+60000).toISOString()})
   const j=await api('analytics/endpoints/logs?'+u);versionBooted=Number(j?.result?.[0]?.n||0)>0?true:null}catch{versionBooted=null}
  if(!versionBooted)await new Promise(r=>setTimeout(r,5000))}
 if(!versionBooted)versionBooted=false}
console.log(JSON.stringify({ready,version,waitedMs:Date.now()-started,firstAnswerMs,versionBooted,probes:probes.slice(-6)}))
process.exitCode=ready?0:1
