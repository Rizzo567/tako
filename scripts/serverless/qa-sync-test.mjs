// Prova sincrona sul locale QA dopo il deploy Haiku (PIANO §8.4, 21/10/2026). Webhook Twilio firmato con TakoSyncTest=1:
// sul QA l'edge risponde a TUTTO (anche ai turni del cervello) solo nel TwiML della richiesta, mai via REST, senza avvisi
// (routes/twilio-menu.ts, ramo «Verifica dal vivo sincrona»). Stesso schema di docs/webapp/bot-correzioni-2026-10-17/live-R10/verify-live-r10b.mjs.
//
//   node scripts/serverless/qa-sync-test.mjs [--dry-run] [--gap-ms=3000]
//
// Mittente: il numero di Manuel letto da ~/.config/tako-webapp/owner-service-qa-backup.json (mai stampato), che DEVE essere già
// collegato al QA (qa-deploy-sql.mjs link). Lo script si ferma se il numero non è collegato al QA o se il QA non ha botEngine=haiku.
// Piatti: letti dal menu del QA (sola lettura, Management API) → i messaggi usano nomi veri del QA.
// SCRIVE sul menu del QA (prezzi, esaurito, piatto nuovo/eliminato): è il locale di prova. Hash del QA prima/dopo nel risultato.
// Controlli automatici per turno: risposta non vuota, niente «non disponibile» (brainDown), niente «categori», niente emoji.
// Il giudizio GRAVE/OK sui contenuti resta al coordinatore (colonna «atteso»). Risultato: ~/.config/tako-webapp/rollback-edge-20261021/.
import fs from 'node:fs'
import path from 'node:path'
import {homedir} from 'node:os'
import {parseEnv} from 'node:util'
import {createHmac,randomBytes,createHash} from 'node:crypto'
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
const dry=process.argv.includes('--dry-run'),gap=Number(process.argv.find(a=>a.startsWith('--gap-ms='))?.slice(9)||3000)
const cfg=path.join(homedir(),'.config/tako-webapp'),outDir=path.join(cfg,'rollback-edge-20261021')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const token=()=>fs.readFileSync(path.join(cfg,'supabase-management.env'),'utf8').match(/SUPABASE_ACCESS_TOKEN=['"]?([^'"\n]+)/)?.[1]
async function q(query){
 const r=await fetch('https://api.supabase.com/v1/projects/tcfccmvpycivxuxkoqpw/database/query',{method:'POST',headers:{authorization:'Bearer '+token(),'content-type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(30000)})
 const t=await r.text();if(!r.ok)throw new Error('SQL '+r.status+' '+t.slice(0,200));return JSON.parse(t)
}
const phone=JSON.parse(fs.readFileSync(path.join(cfg,'owner-service-qa-backup.json'),'utf8'))?.link?.phone
if(!/^whatsapp:\+39\d{9,10}$/.test(phone||'')||!phone.endsWith('0927'))throw new Error('numero di Manuel non valido nel backup')
const lit=v=>`'${String(v).replace(/'/g,"''")}'`
const euro=n=>{const v=Number(n);return Number.isInteger(v)?String(v):v.toFixed(2).replace('.',',')} // menu_items.price = numeric(10,2) in euro

// Piatti veri del QA (visibili, con prezzo), sezioni (sottomenu = sezioni senza genitore).
let dishes=[{name:'Carbonara',price:12},{name:'Amatriciana',price:11},{name:'Tiramisù',price:6},{name:'Coca Cola',price:3}],sub='Primi'
if(!dry){
 const link=await q(`SELECT restaurant_id FROM tako_whatsapp_links WHERE phone=${lit(phone)}`)
 if(link.length!==1||link[0].restaurant_id!==QA)throw new Error('il numero di Manuel non è collegato (solo) al QA: esegui prima qa-deploy-sql.mjs link')
 const st=await q(`SELECT settings->>'botEngine' AS engine, settings->>'botBrain' AS brain FROM restaurants WHERE id='${QA}'`)
 if(st[0]?.engine!=='haiku'||st[0]?.brain!=='true')throw new Error('QA senza botEngine=haiku o botBrain=true: stop')
 const rows=await q(`SELECT i.name, i.price FROM menu_items i WHERE i.restaurant_id='${QA}' AND i.available=true AND i.price>0 ORDER BY i.position, i.id LIMIT 4`)
 if(rows.length<4)throw new Error('QA con meno di 4 piatti visibili: scegli i piatti a mano')
 dishes=rows.map(r=>({name:String(r.name),price:Number(r.price)}))
 const secs=await q(`SELECT s.name FROM menu_sections s JOIN menus m ON m.id=s.menu_id WHERE m.restaurant_id='${QA}' AND s.active=true ORDER BY s.position LIMIT 1`)
 if(secs[0]?.name)sub=String(secs[0].name)
}
const [A,B,C,D]=dishes
// PIANO §8.4: prezzo, esaurito, piatto nuovo, domanda, elimina+sì, annulla, 4 modifiche+OK, «categoria», vocale simulato, «cosa sai fare?».
const steps=[
 {msg:`${A.name} a ${euro(A.price+1)}`,expect:`prezzo di ${A.name} → ${euro(A.price+1)} €, scritto, risposta dai fatti`},
 {msg:`${B.name} è finito`,expect:`${B.name} esaurito/nascosto, scritto`},
 {msg:'aggiungi Piatto test QA a 9 euro',expect:'piatto nuovo «Piatto test QA» a 9 € (nome letterale), scritto o una domanda sul sottomenu'},
 {msg:`quanto costa ${A.name}?`,expect:`risponde ${euro(A.price+1)} €, nessuna scrittura`},
 {msg:'elimina Piatto test QA',expect:'chiede il sì, nessuna scrittura'},
 {msg:'sì',expect:'Piatto test QA eliminato'},
 {msg:'annulla',expect:'annulla l’ultima modifica (ripristina Piatto test QA) o dice cosa ha annullato'},
 {msg:`${A.name} a ${euro(A.price)}, ${B.name} a ${euro(B.price)}, ${C.name} a ${euro(C.price+1)} e ${D.name} a ${euro(D.price+1)}`,expect:'riepilogo delle 4 modifiche + «Rispondi OK», nessuna scrittura'},
 {msg:'ok',expect:'applica le 4 modifiche'},
 {msg:`cosa c'è nella categoria ${sub}?`,expect:`elenca il sottomenu ${sub}, la risposta non dice «categoria»`},
 {msg:`eh allora senti eh la… la ${C.name.toLowerCase()} mettila a… ${euro(C.price)}`,expect:`vocale simulato: prezzo ${C.name} → ${euro(C.price)} € o una sola domanda sul piatto giusto`},
 {msg:'Ciao, cosa sai fare?',expect:'elenco capacità, nessuna scrittura, nessuna emoji'},
]
if(dry){for(const [i,s] of steps.entries())console.log(`${i+1}. ${s.msg}  →  ${s.expect}`);process.exit(0)}

const tw=parseEnv(fs.readFileSync(path.join(cfg,'twilio-menu.env'),'utf8'))
const sign=(u,form)=>createHmac('sha1',tw.TWILIO_AUTH_TOKEN).update(u+Object.keys(form).sort().map(k=>k+form[k]).join('')).digest('base64')
async function whatsapp(body){
 const form={AccountSid:tw.TWILIO_ACCOUNT_SID,From:phone,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:'0',MessageSid:'SM'+randomBytes(16).toString('hex'),Body:body,TakoSyncTest:'1'}
 const t0=performance.now()
 const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,form)},body:new URLSearchParams(form).toString(),signal:AbortSignal.timeout(90000)})
 const raw=await r.text()
 const text=raw.replace(/<\/Message><Message>/g,'\n').replace(/<[^>]+>/g,'').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim()
 return {status:r.status,ms:Math.round(performance.now()-t0),text}
}
const qaHash=async()=>{const [w]=await q(`SELECT md5(coalesce(draft::text,'')||coalesce(published::text,'')) AS h, revision FROM menu_workspaces WHERE restaurant_id='${QA}'`);return w}
const before=await qaHash(),results=[]
for(const [i,s] of steps.entries()){
 const r=await whatsapp(s.msg)
 const checks={empty:!r.text,brainDown:/non disponibile|riprova tra/i.test(r.text),categori:/categori/i.test(r.text),emoji:/\p{Extended_Pictographic}/u.test(r.text),http:r.status!==200}
 results.push({n:i+1,msg:s.msg,expect:s.expect,status:r.status,ms:r.ms,reply:r.text,flags:Object.keys(checks).filter(k=>checks[k])})
 console.log(`${i+1}. [${r.ms} ms]${results.at(-1).flags.length?' FLAG '+results.at(-1).flags.join(','):''} ${s.msg}\n   → ${r.text.replace(/\n+/g,' ⏎ ').slice(0,300)}`)
 await sleep(gap)
}
const after=await qaHash()
const ms=results.map(r=>r.ms).sort((a,b)=>a-b),pct=p=>ms[Math.min(ms.length-1,Math.floor(p*ms.length))]
const summary={at:new Date().toISOString(),phone:'whatsapp:+39…'+phone.slice(-4),qaBefore:before,qaAfter:after,p50:pct(0.5),p95:pct(0.95),flagged:results.filter(r=>r.flags.length).map(r=>r.n),results}
fs.mkdirSync(outDir,{recursive:true,mode:0o700})
const file=path.join(outDir,`sync-test-${summary.at.replace(/[:.]/g,'-')}.json`)
fs.writeFileSync(file,JSON.stringify(summary,null,1),{mode:0o600})
console.log(JSON.stringify({file,p50:summary.p50,p95:summary.p95,flagged:summary.flagged,qaRevision:[before?.revision,after?.revision],sha:createHash('sha256').update(JSON.stringify(results)).digest('hex').slice(0,12)}))
