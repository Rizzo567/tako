// Adattatore del motore Claude Haiku 5.5 (run 21/10/2026, perimetro B, PIANO bot-haiku §5 B): lo STESSO route vero del bot
// «nuovo» (cervello acceso) con `settings:{botBrain:true,botEngine:'haiku'}` e le tabelle del cervello emulate in memoria
// (brainSql di new-bot.ts). Le chiamate a api.anthropic.com le intercetta installNet → anthropic-cache.ts (record/replay/live/mock).
// La chiave vera NON entra nel processo: ANTHROPIC_API_KEY è un valore finto non vuoto e la cache, solo per le chiamate vere
// (record/live), mette la chiave letta dal file nell'header. GROQ_API_KEY resta impostata solo per Whisper (vocali): ogni
// richiesta Groq chat in questo giro è bloccata e contata (V4, net.groqChat).
// Memoria seminabile per fixture: alias `active` in tako_owner_brain_memory (es. «la sorrentina» = Pizza Sorrentina).
import type {BotUnderTest,EvalMenu} from '../types.js'
import type {createRouteBot as CreateRouteBot} from '../route-harness.js'
import {brainSql,brainTables,resetBrainTables} from './new-bot.js'

export type Alias={phrase:string,dish:string,kind?:'alias'|'asr'}
export type AnthropicBotOptions={model?:string,keyFile?:string,maxUsdPerRun?:number,
 /** Senza createRouteBot l'adattatore resta «non pronto» (compatibilità con eval-banco-vero.test.ts, TAKO_BV_BOT=anthropic). */
 createRouteBot?:typeof CreateRouteBot,tenant?:string,
 /** Alias attivi da seminare per chiave di fixture (conversazione.menu). */
 memory?:Record<string,Alias[]>}

const plainKey=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().slice(0,60)

/** Semina gli alias attivi: righe come le scrive sqlBrainStore (owner-brain-memory.ts). */
export function seedMemory(tenant:string,menu:EvalMenu,aliases:Alias[]){
 const items=menu.menus.flatMap(m=>m.sections.flatMap(s=>s.items)),now=new Date('2026-10-10T10:00:00Z');let n=0
 for(const a of aliases){const it=items.find(i=>i.name===a.dish);if(!it)throw new Error(`memoria: piatto «${a.dish}» non nel menu`)
  const id=`9eva1000-0000-4000-8000-${(++n).toString(16).padStart(12,'0')}`
  brainTables.memory.set(id,{id,restaurant_id:tenant,phrase:plainKey(a.phrase),kind:a.kind??'alias',item_id:it.id,meaning:it.name,state:'active',confirmations:2,uses:3,last_used_at:now,origin:'clarify',created_at:now,updated_at:now})}}

export function createAnthropicBot(opts:AnthropicBotOptions={}):BotUnderTest{
 const name=`anthropic-${opts.model??'haiku-5.5'}`
 if(!opts.createRouteBot)return{name,ready:false,async run(){throw new Error('adattatore Anthropic: serve createRouteBot (vedi eval-haiku.test.ts)')}}
 const tenant=opts.tenant??'26050ecd-2e55-4057-a4c5-bff2b449cd47'
 // Valore finto: in replay/mock nessuna richiesta esce; in record/live la cache sostituisce l'header con la chiave del file.
 process.env.ANTHROPIC_API_KEY='eval-anthropic-key'
 if(!process.env.GROQ_API_KEY)process.env.GROQ_API_KEY='eval-no-groq'
 delete process.env.TAKO_BOT_BRAIN_OFF
 const inner=opts.createRouteBot({name,settings:{botBrain:true,botEngine:'haiku'},extraSql:brainSql})
 return{name,ready:true,async run(conv,menu,ctx){resetBrainTables();const mem=opts.memory?.[conv.menu];if(mem?.length)seedMemory(tenant,menu,mem);return inner.run(conv,menu,ctx)}}
}
