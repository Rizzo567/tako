import {db} from '@tako/db'
import {sql} from 'drizzle-orm'
import {Buffer} from 'node:buffer'
import {sendWhatsApp,twilioBase} from './twilio-menu-ai.js'
import {alertCopy,fill} from './twilio-menu-copy.js'
import {phoneTail} from './whatsapp-phone.js'
// Guasti del bot WhatsApp: ogni errore va in tako_whatsapp_errors (i log edge non sono leggibili);
// un avviso WhatsApp a Manuel al massimo una volta all'ora, con claim atomico su tako_whatsapp_alerts.
export const alertPhone=process.env.TAKO_WHATSAPP_ALERT_PHONE||''
/** Un messaggio di un numero collegato è rimasto senza risposta: avviso subito (se l'ora è libera). */
export const unansweredKinds=new Set(['job_timeout','job_failed','webhook_error','send_failed','test_fault'])
/** Errori che non contano per la regola «≥3 in 10 minuti» (l'avviso stesso non deve generare avvisi). */
const selfKinds=['alert_send_failed','alert_undelivered','alert_failed']
export type FailureKind='job_timeout'|'job_failed'|'webhook_error'|'send_failed'|'test_fault'|'menusmart_forward'|'usage_record_failed'|'alert_send_failed'|'alert_undelivered'|'alert_failed'
export type Failure={kind:FailureKind,tenant?:string|null,phone?:string|null,detail?:string}
const burstThreshold=3 // in 10 minuti; finestra avvisi: 1 ora (nelle query)
const clean=(s:string|undefined)=>(s??'').replace(/whatsapp:\+?\d+/g,'whatsapp:…').replace(/\+?\d{9,15}/g,'…').slice(0,160)
const credentials=()=>({accountSid:process.env.TWILIO_ACCOUNT_SID||'',token:process.env.TWILIO_AUTH_TOKEN||'',from:process.env.TWILIO_WHATSAPP_NUMBER||''})
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms))
export const romeTime=(now=new Date())=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(now)
async function insertError(f:Failure,alerted=false){const rows=await db.execute(sql`INSERT INTO tako_whatsapp_errors(kind,restaurant_id,phone_tail,detail,alerted) VALUES(${f.kind},${f.tenant??null},${f.phone?phoneTail(f.phone):null},${clean(f.detail)||null},${alerted}) RETURNING id`);return rows[0]?.id as string|number|undefined}
/** Registra un guasto e, se serve, avvisa Manuel. Non lancia mai: un errore qui finisce solo nel log. */
export async function reportFailure(f:Failure,opts:{pollMs?:number[]}={}):Promise<{recorded:boolean,alerted:boolean}>{
 let recorded=false
 try{
  const id=await insertError(f);recorded=true;console.error(JSON.stringify({event:'whatsapp_failure',kind:f.kind}))
  if(!alertPhone||selfKinds.includes(f.kind))return{recorded,alerted:false}
  let reason=unansweredKinds.has(f.kind)?f.kind:''
  if(!reason){const rows=await db.execute(sql`SELECT count(*)::int AS n FROM tako_whatsapp_errors WHERE created_at>now()-interval '10 minutes' AND kind NOT IN ('alert_send_failed','alert_undelivered','alert_failed')`),n=Number(rows[0]?.n??0);if(n>=burstThreshold)reason='burst:'+n}
  if(!reason)return{recorded,alerted:false}
  const claimed=await db.execute(sql`INSERT INTO tako_whatsapp_alerts(channel,last_sent_at) VALUES('guasti',now()) ON CONFLICT(channel) DO UPDATE SET last_sent_at=now() WHERE tako_whatsapp_alerts.last_sent_at<=now()-interval '1 hour' RETURNING channel`)
  if(!claimed.length)return{recorded,alerted:false}
  if(id!==undefined)await db.execute(sql`UPDATE tako_whatsapp_errors SET alerted=true WHERE id=${id}`)
  const place=f.tenant?String((await db.execute(sql`SELECT name FROM restaurants WHERE id=${f.tenant}`))[0]?.name??alertCopy.unknownPlace):alertCopy.unknownPlace
  const [kind,n]=reason.split(':'),cosa=fill(alertCopy.kinds[kind!]??alertCopy.kinds.job_failed!,{n:n??''})
  const text=fill(f.kind==='test_fault'?alertCopy.test:alertCopy.alert,{cosa,locale:place,ora:romeTime()})
  const {accountSid,token,from}=credentials()
  let sent:{sid?:string,status?:string}
  try{sent=await sendWhatsApp(accountSid,token,from,alertPhone,text)}catch(error){await insertError({kind:'alert_send_failed',tenant:f.tenant,detail:error instanceof Error?error.message:'Error'});return{recorded,alerted:false}}
  // WhatsApp fuori dalla finestra delle 24 h (63016) fallisce DOPO l'accettazione: controllo lo stato poche volte, senza reinviare.
  if(sent.sid)for(const ms of opts.pollMs??[3000,5000,8000]){await wait(ms);const status=await messageStatus(accountSid,token,sent.sid).catch(()=>null);if(!status)break
   if(status.status==='failed'||status.status==='undelivered'){await insertError({kind:'alert_undelivered',tenant:f.tenant,detail:`Twilio ${status.status} ${status.errorCode??''}${String(status.errorCode)==='63016'?' (fuori dalla finestra di 24 h)':''}`.trim()});return{recorded,alerted:false}}
   if(!['queued','accepted','sending','scheduled'].includes(status.status))break}
  return{recorded,alerted:true}
 }catch(error){try{console.error(JSON.stringify({event:'whatsapp_failure_report_failed',kind:f.kind,error:error instanceof Error?error.message.slice(0,80):'Error'}))}catch{}return{recorded,alerted:false}}
}
async function messageStatus(accountSid:string,token:string,sid:string){
 if(!/^(SM|MM)[a-f0-9]{32}$/i.test(sid))return null
 const response=await fetch(`${twilioBase()}/2010-04-01/Accounts/${accountSid}/Messages/${sid}.json`,{headers:{Authorization:'Basic '+Buffer.from(accountSid+':'+token).toString('base64')},signal:AbortSignal.timeout(8000)})
 if(!response.ok)return null;const data=await response.json() as any;return{status:String(data?.status??''),errorCode:data?.error_code??null}
}
/** In background sull'edge (waitUntil), altrimenti attende: la risposta a Twilio non aspetta l'avviso. */
export function inBackground(work:Promise<unknown>){const runtime=(globalThis as any).EdgeRuntime;if(typeof runtime?.waitUntil==='function'){runtime.waitUntil(work);return Promise.resolve()}return work.then(()=>{},()=>{})}
