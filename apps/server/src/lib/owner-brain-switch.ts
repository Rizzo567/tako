/** Interruttore del cervello per ristorante (PIANO, decisione 8): `restaurants.settings.botBrain === true`, default SPENTO.
 * `TAKO_BOT_BRAIN_OFF=1` lo spegne ovunque (interruttore di emergenza senza toccare i dati). */
import {sql} from 'drizzle-orm'
export const botBrainEnabled=(settings:unknown,env:Record<string,string|undefined>=process.env)=>env.TAKO_BOT_BRAIN_OFF!=='1'&&!!settings&&typeof settings==='object'&&(settings as any).botBrain===true
export async function readBotBrain(tx:{execute(q:ReturnType<typeof sql>):Promise<any>},restaurantId:string){
 try{const rows=await tx.execute(sql`SELECT settings FROM restaurants WHERE id=${restaurantId}`) as any[];return botBrainEnabled(rows?.[0]?.settings)}catch{return false}
}
/** Patch additiva per accendere/spegnere (solo QA in fase 1; per i clienti al lancio, decisione Manuel 17/10). */
export const botBrainPatch=(on:boolean)=>sql`UPDATE restaurants SET settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{botBrain}',${on?'true':'false'}::jsonb,true)`
