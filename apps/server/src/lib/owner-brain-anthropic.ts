/** Cervello del bot titolare · client Claude Haiku 5.5 (21/10/2026, perimetro T del PIANO bot-haiku).
 * Stessa firma e stesso ritorno di `callBrain` (Groq): il resto del cervello (validatore, auto-correzione, scrittura, risposta dai
 * fatti) non cambia. Chiamata via `fetch` su /v1/messages (niente SDK: bundle edge Deno), output strutturato con lo schema JSON
 * del piano (`output_config.format`), effort basso. Vietati (400 su Haiku 5.5): temperature, top_p, prefill, tool_choice.
 * Errori → `BrainUnavailable(reason)`: il route risponde «non disponibile» e avvisa Manuel. Mai Groq, mai percorso a regole.
 * Modulo puro (niente Buffer, niente node:*): gira anche nell'edge. */
import {BRAIN_SCHEMA,BrainUnavailable,type BrainCall,type BrainCallOptions,type BrainUsage} from './owner-brain-plan.js'
import type {BrainContext} from './owner-brain-context.js'
import {parseJson} from './twilio-menu-ai.js'

export const HAIKU_MODEL='claude-haiku-5-5'
export const ANTHROPIC_URL='https://api.anthropic.com/v1/messages'
export const ANTHROPIC_VERSION='2023-06-01'
export const HAIKU_TIMEOUT_MS=10_000
export const HAIKU_MAX_TOKENS=3000
export type HaikuOptions=BrainCallOptions&{effort?:'low'|'medium',maxTokens?:number,retryDelayMs?:number,
 /** Leva di latenza da misurare prima di usarla: `thinking:{type:'disabled'}` (ammesso a effort ≤ high). Default: thinking adattivo. */
 thinking?:'disabled'}

type Block={type:'text',text:string,cache_control?:{type:'ephemeral'}}
type Msg={role:'user'|'assistant',content:string}

/** Corpo della richiesta. Esportato per i test e per l'hash del banco (record/replay). */
export function haikuRequest(ctx:BrainContext,opts:HaikuOptions={}){
 const systemTexts=ctx.messages.filter(m=>m.role==='system').map(m=>m.content).filter(s=>s.trim())
 // Massimo 2 punti di cache sul system (regole fisse + menu del locale); oltre, i blocchi si uniscono all'ultimo.
 const sys=systemTexts.length>2?[systemTexts[0]!,systemTexts.slice(1).join('\n\n')]:systemTexts
 const system:Block[]=sys.map(text=>({type:'text',text,cache_control:{type:'ephemeral'}}))
 const messages:Msg[]=[]
 for(const m of ctx.messages){if(m.role==='system')continue;const role=m.role==='assistant'?'assistant':'user',last=messages[messages.length-1]
  if(last&&last.role===role)last.content+='\n\n'+m.content;else messages.push({role,content:m.content})}
 // L'API vuole il primo messaggio dell'utente e l'ultimo dell'utente (niente prefill dell'assistente).
 if(messages[0]?.role==='assistant')messages.unshift({role:'user',content:'(cronologia della conversazione)'})
 if(!messages.length||messages[messages.length-1]!.role!=='user')messages.push({role:'user',content:'Rispondi col JSON dello schema.'})
 return{model:HAIKU_MODEL,max_tokens:opts.maxTokens??HAIKU_MAX_TOKENS,
  output_config:{effort:opts.effort??'low',format:{type:'json_schema',schema:BRAIN_SCHEMA.schema}},
  ...(opts.thinking==='disabled'?{thinking:{type:'disabled'}}:{}),
  system,messages}
}

const RETRY_STATUS=(s:number)=>s===429||s===529||s>=500
class Attempt extends Error{constructor(readonly reason:BrainUnavailable['reason'],readonly retry:boolean,detail=''){super(detail||reason)}}

/** Una chiamata PLAN a Haiku. Il tentativo usa il budget rimasto (`budgetMs`); 1 nuovo tentativo dopo 1 s su 429/529/5xx/rete (mai per lentezza), nessuno su 4xx.
 * `opts.budgetMs` = tempo massimo TOTALE (tentativi compresi) che il turno concede a questa chiamata. */
export async function callHaiku(ctx:BrainContext,key:string,opts:HaikuOptions={}):Promise<BrainCall>{
 if(!key)throw new BrainUnavailable('no_key')
 const body=JSON.stringify(haikuRequest(ctx,opts)),deadline=Date.now()+(opts.budgetMs??2*(opts.timeoutMs??HAIKU_TIMEOUT_MS)+(opts.retryDelayMs??1000))
 const sleep=opts.sleep??((ms:number)=>new Promise(r=>setTimeout(r,ms)))
 const once=async():Promise<BrainCall>=>{
  // Il fetch si risolve a ogni chiamata (non al caricamento del modulo): così test e banco possono sostituire globalThis.fetch.
  const doFetch=opts.fetch??((u:string,i:RequestInit)=>globalThis.fetch(u,i))
  const left=deadline-Date.now();if(left<=200)throw new Attempt('timeout',false,'budget')
  const started=Date.now();let response:Response
  try{response=await doFetch(ANTHROPIC_URL,{method:'POST',headers:{'x-api-key':key,'anthropic-version':ANTHROPIC_VERSION,'content-type':'application/json'},body,signal:AbortSignal.timeout(Math.min(opts.timeoutMs??left,left))})}
  // 21/10 pomeriggio (timeout sul QA con 5 richieste): la lentezza NON si ritenta (rifare la stessa chiamata lunga non serve e brucia il
  // budget); si ritentano solo rete, 5xx e 429. Il tentativo usa tutto il budget rimasto del turno (niente tetto fisso di 10 s).
  catch(e){const n=(e as any)?.name;const slow=n==='TimeoutError'||n==='AbortError';throw new Attempt(slow?'timeout':'http',!slow,slow?'timeout':'rete')}
  if(!response.ok){await response.text().catch(()=>'');if(RETRY_STATUS(response.status))throw new Attempt(response.status===429||response.status===529?'busy':'http',true,String(response.status));throw new Attempt('http',false,String(response.status))}
  let data:any;try{data=await response.json()}catch{throw new Attempt('invalid_json',false,'corpo')}
  const u=data?.usage??{},cacheRead=Number(u.cache_read_input_tokens)||0,cacheWrite=Number(u.cache_creation_input_tokens)||0
  const usage:BrainUsage={model:HAIKU_MODEL,prompt:(Number(u.input_tokens)||0)+cacheRead+cacheWrite,completion:Number(u.output_tokens)||0,cached:cacheRead,latencyMs:Date.now()-started}
  await Promise.resolve(opts.meter?.({model:HAIKU_MODEL,prompt:usage.prompt,completion:usage.completion,limited:false})).catch(()=>{})
  if(data?.stop_reason==='refusal')throw new Attempt('refusal',false)
  if(data?.stop_reason==='max_tokens')throw new Attempt('max_tokens',false)
  const content=(Array.isArray(data?.content)?data.content:[]).filter((b:any)=>b?.type==='text'&&typeof b.text==='string').map((b:any)=>b.text).join('')
  const parsed=parseJson(content);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Attempt('invalid_json',false)
  return{model:HAIKU_MODEL,content,usage}}
 let last:Attempt|null=null
 for(let attempt=0;attempt<2;attempt++){
  try{return await once()}catch(e){
   last=e instanceof Attempt?e:new Attempt('http',false,String((e as any)?.message??e).slice(0,80))
   if(!last.retry||attempt===1)break
   const wait=opts.retryDelayMs??1000;if(deadline-Date.now()<=wait+500)break
   await sleep(wait)}}
 throw new BrainUnavailable(last!.reason,last!.message===last!.reason?'':last!.message)
}
