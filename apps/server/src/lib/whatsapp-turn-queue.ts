/** 23/10/2026 (chat di Luisa, Victoria Bar): «E inserisci» arrivato mentre il «Si» era in lavorazione ha fatto girare DUE turni insieme
 * sullo stesso numero → proposta in sospeso letta vecchia, domande doppie, conferma persa. Da qui i messaggi di UN numero si lavorano in
 * fila: il webhook (sotto il lock del telefono) mette un biglietto con l'ora del DB; il lavoro di un messaggio parte solo quando non c'è
 * più un biglietto PRIMA del suo (finito o scaduto). I biglietti stanno in tako_whatsapp_messages (chiave `turn:<telefono>:<ms>:<sid>`),
 * come le altre chiavi di servizio del bot (undo:, last:, ai:): nessuna tabella nuova. Un lavoro bloccato non ferma la fila per sempre:
 * il biglietto scade dopo TURN_STALE_MS e nessun lavoro aspetta più di 20 s (meglio due turni insieme che un bot fermo). Modulo senza stato: ogni funzione riceve `execute`. */
import {sql} from 'drizzle-orm'

type Exec={execute:(q:any)=>Promise<any>}
export const TURN_STALE_MS=90_000
const prefix=(phone:string)=>'turn:'+phone+':'
const at=(key:string,phone:string)=>Number(key.slice(prefix(phone).length).split(':')[0])

/** Biglietto del messaggio `sid`: da chiamare nella transazione del webhook che tiene il lock del telefono (ordine = ordine d'arrivo). */
export async function enqueueTurn(tx:Exec,phone:string,sid:string):Promise<string>{
 let t=String(Date.now()).padStart(15,'0')
 try{const r=await tx.execute(sql`SELECT lpad(((extract(epoch from clock_timestamp())*1000)::bigint)::text,15,'0') AS t`);const v=(r as any[])?.[0]?.t;if(typeof v==='string'&&/^\d{15}$/.test(v))t=v}catch{/* ora locale */}
 const key=prefix(phone)+t+':'+sid
 await tx.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${key},${'turn'}) ON CONFLICT DO NOTHING`)
 return key}

/** Biglietti del telefono, in ordine. */
async function tickets(db:Exec,phone:string):Promise<string[]>{
 // starts_with, non un intervallo: con la collation del DB «~» non ordina dopo cifre e lettere (bug v178: nessun biglietto trovato)
 const rows=await db.execute(sql`SELECT sid FROM tako_whatsapp_messages WHERE starts_with(sid,${prefix(phone)})`) as any[]
 return (rows??[]).map(r=>String(r.sid)).filter(k=>k.startsWith(prefix(phone))).sort()}

/** Biglietti che precedono quello del messaggio `sid` e non sono scaduti. `mine` = il biglietto del messaggio (null se manca). */
export function ahead(keys:string[],phone:string,sid:string,now:number):{mine:string|null,before:string[],stale:string[]}{
 const mine=keys.find(k=>k.endsWith(':'+sid))??null,stale:string[]=[],before:string[]=[]
 for(const k of keys){if(k===mine)continue;const t=at(k,phone);if(!Number.isFinite(t)||now-t>TURN_STALE_MS){stale.push(k);continue}if(mine&&k<mine)before.push(k)}
 return{mine,before,stale}}

/** Aspetta il proprio turno (al massimo `maxWaitMs`). Restituisce il biglietto da liberare a lavoro finito e quanto si è atteso. */
export async function waitTurn(db:Exec,phone:string,sid:string,o:{maxWaitMs:number,pollMs?:number,isExpired?:()=>boolean,now?:()=>number}):Promise<{key:string|null,waitedMs:number}>{
 const start=Date.now(),now=o.now??(()=>Date.now()),poll=o.pollMs??400
 for(;;){let st:ReturnType<typeof ahead>
  try{st=ahead(await tickets(db,phone),phone,sid,now())}catch{return{key:null,waitedMs:Date.now()-start}}
  for(const k of st.stale)await db.execute(sql`DELETE FROM tako_whatsapp_messages WHERE sid=${k}`).catch(()=>{})
  if(!st.mine||!st.before.length||o.isExpired?.()||Date.now()-start>=o.maxWaitMs)return{key:st.mine,waitedMs:Date.now()-start}
  await new Promise(r=>setTimeout(r,poll))}}

export async function releaseTurn(db:Exec,key:string|null){if(key)await db.execute(sql`DELETE FROM tako_whatsapp_messages WHERE sid=${key}`).catch(()=>{})}
