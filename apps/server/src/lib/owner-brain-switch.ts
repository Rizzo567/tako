/** Interruttore del cervello per ristorante (PIANO, decisione 8): `restaurants.settings.botBrain === true`, default SPENTO.
 * `TAKO_BOT_BRAIN_OFF=1` lo spegne ovunque (interruttore di emergenza senza toccare i dati).
 * Motore del cervello (PIANO bot-haiku §1.5, 21/10/2026): `settings.botEngine ∈ {'haiku','groq'}` → se assente o sconosciuto env
 * `TAKO_BOT_ENGINE_DEFAULT` → se assente anche quella `'haiku'`. Lettore unico: `readBotSettings` (cervello + motore, una query). */
import {sql} from 'drizzle-orm'
type Exec={execute(q:ReturnType<typeof sql>):Promise<any>}
export type BotEngine='haiku'|'groq'
const ENGINES:readonly BotEngine[]=['haiku','groq']
const isEngine=(v:unknown):v is BotEngine=>typeof v==='string'&&(ENGINES as readonly string[]).includes(v)

/** Cervello acceso? (decisione Manuel 21/10: Haiku per tutti, bot vecchio spento per i titolari)
 * `TAKO_BOT_BRAIN_OFF=1` → spento ovunque · `settings.botBrain` true/false → vale quello del locale ·
 * altrimenti acceso SOLO se l'env `TAKO_BOT_ENGINE_DEFAULT` dice esplicitamente `haiku` e il locale non ha `botEngine='groq'`
 * (senza env, come nei test e negli strumenti locali, resta spento come prima). */
export const botBrainEnabled=(settings:unknown,env:Record<string,string|undefined>=process.env)=>{
 if(env.TAKO_BOT_BRAIN_OFF==='1')return false
 const own=settings&&typeof settings==='object'?(settings as any).botBrain:undefined
 if(own===true||own===false)return own
 return String(env.TAKO_BOT_ENGINE_DEFAULT??'').trim().toLowerCase()==='haiku'&&botEngineOf(settings,env)==='haiku'}
export function botEngineOf(settings:unknown,env:Record<string,string|undefined>=process.env):BotEngine{
 const own=settings&&typeof settings==='object'?(settings as any).botEngine:undefined
 if(isEngine(own))return own
 const def=String(env.TAKO_BOT_ENGINE_DEFAULT??'').trim().toLowerCase()
 return isEngine(def)?def:'haiku'
}
/** Chiave del motore: haiku → ANTHROPIC_API_KEY, groq → GROQ_API_KEY. (Whisper resta sempre su GROQ_API_KEY, fuori di qui.) */
export const engineKey=(engine:BotEngine,env:Record<string,string|undefined>=process.env)=>(engine==='haiku'?env.ANTHROPIC_API_KEY:env.GROQ_API_KEY)??''

/** Una sola lettura di `settings` per turno: cervello acceso? con quale motore? Errore DB → cervello spento, motore di default. */
export async function readBotSettings(tx:Exec,restaurantId:string):Promise<{brain:boolean,engine:BotEngine}>{
 try{const rows=await tx.execute(sql`SELECT settings FROM restaurants WHERE id=${restaurantId}`) as any[];const s=rows?.[0]?.settings;return{brain:botBrainEnabled(s),engine:botEngineOf(s)}}catch{return{brain:false,engine:botEngineOf(null)}}
}
export async function readBotBrain(tx:Exec,restaurantId:string){return (await readBotSettings(tx,restaurantId)).brain}
export async function readBotEngine(tx:Exec,restaurantId:string):Promise<BotEngine>{return (await readBotSettings(tx,restaurantId)).engine}
/** Patch additiva per accendere/spegnere (solo QA in fase 1; per i clienti al lancio, decisione Manuel 17/10). */
export const botBrainPatch=(on:boolean)=>sql`UPDATE restaurants SET settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{botBrain}',${on?'true':'false'}::jsonb,true)`
/** Patch additiva del motore (da completare con `WHERE id=…` da chi la usa, come `botBrainPatch`). */
export const botEnginePatch=(engine:BotEngine)=>sql`UPDATE restaurants SET settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{botEngine}',to_jsonb(${engine}::text),true)`
