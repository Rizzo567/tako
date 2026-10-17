// Misura del percorso via IA del bot, in locale (DB vero, Groq vero con la chiave del bot): menuTurn → {llm} → resolveTurn
// (chiamata Groq + turno pianificato che fa il commit sul QA). Nessun messaggio WhatsApp inviato (runJob non viene usato).
// Token contati dal meter; il runner ripristina il QA e si ferma se il conteggio supera il tetto.
import { db } from '../../../../../packages/db/src/index.js'
import { sql } from 'drizzle-orm'
import { menuTurn, resolveTurn } from '../../../../../apps/server/src/routes/twilio-menu.js'
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
class Rollback extends Error{}
export async function run(key:string,texts:string[],tokenCap:number){
 const [link]=await db.execute(sql`SELECT phone,actor_id FROM tako_whatsapp_links WHERE restaurant_id=${QA}`) as any[]
 const ctx={phone:String(link.phone),tenant:QA,actor:String(link.actor_id)}
 let tokens=0;const out:any[]=[]
 for(const text of texts){
  if(tokens>tokenCap){out.push({text,skipped:'tetto token'});continue}
  const t0=performance.now();let turn:any
  try{await db.transaction(async tx=>{turn=await menuTurn(tx as any,ctx,text);throw new Rollback()})}catch(e){if(!(e instanceof Rollback))throw e}
  const t1=performance.now();if(typeof turn==='string'||!turn?.llm){out.push({text,deterministic:true,reply:String(turn).slice(0,80)});continue}
  const [r0]=await db.execute(sql`SELECT published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`) as any[]
  let groqMs=0,used=0;const meter=(e:any)=>{used+=Number(e.prompt||0)+Number(e.completion||0)}
  const fetch0=globalThis.fetch;globalThis.fetch=(async(u:any,o:any)=>{const s=performance.now();try{return await fetch0(u,o)}finally{if(String(u).includes('groq'))groqMs+=performance.now()-s}}) as any
  let reply='';try{reply=await resolveTurn(ctx as any,text,turn,key,{meter})}finally{globalThis.fetch=fetch0}
  const t2=performance.now();tokens+=used
  const [r1]=await db.execute(sql`SELECT published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`) as any[]
  out.push({text,turnMs:Math.round(t1-t0),groqMs:Math.round(groqMs),afterGroqMs:Math.round(t2-t1-groqMs),totalMs:Math.round(t2-t0),tokens:used,committed:Number(r1.published_revision)>Number(r0.published_revision),reply:reply.slice(0,90)})
 }
 return {tokens,out}
}
