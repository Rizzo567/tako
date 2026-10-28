// Harness locale: esegue menuTurn / publish in una transazione sul QA e la ANNULLA (rollback): conta query e tempo. Nessun commit.
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../../../../../packages/db/src/schema/index.js'
import { menuTurn } from '../../../../../apps/server/src/routes/twilio-menu.js'
import { mutateWorkspace, readWorkspace } from '../../../../../apps/server/src/lib/menu-workspace-store.js'
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
class Rollback extends Error{}
export async function run(url:string,ca:string|undefined,mode:string,text:string){
 let count=0;const log:string[]=[]
 const client=postgres(url,{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{},debug:(_c,q)=>{count++;log.push(q.replace(/\s+/g,' ').slice(0,90))}})
 const db=drizzle(client,{schema})
 const [link]=await client`SELECT phone,actor_id FROM tako_whatsapp_links WHERE restaurant_id=${QA}`
 count=0;log.length=0
 const s=performance.now();let result:unknown
 try{await db.transaction(async tx=>{
  if(mode==='turn')result=await menuTurn(tx as any,{phone:String(link!.phone),tenant:QA,actor:String(link!.actor_id)},text)
  if(mode==='publish'){const row=await readWorkspace(QA,tx);result=(await mutateWorkspace(QA,String(link!.actor_id),row!.revision,row!.draft,true,'Pubblicazione',tx as any)).revision}
  throw new Rollback()})}catch(e){if(!(e instanceof Rollback))throw e}
 const ms=Math.round(performance.now()-s);await client.end()
 return {ms,queries:count,result:typeof result==='string'?result.slice(0,100):result,log}
}
