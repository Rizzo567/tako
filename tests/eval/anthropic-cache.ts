// Record/replay delle chiamate a Claude Haiku 5.5 (POST https://api.anthropic.com/v1/messages) per il banco del motore Haiku
// (run 21/10/2026, perimetro B; modello: groq-cache.ts). Cache su disco per hash del corpo JSON canonico (chiavi ordinate).
// Modalità (TAKO_BOT_LLM): replay = solo cache, un'assenza è un errore del caso «non misurato» (niente rete, costo 0, default)
// · record = cache, poi chiamata vera entro il tetto di spesa · live = sempre rete · mock = risposta finta valida dello schema
// del piano (verifica dell'infrastruttura senza rete né costo).
// La chiave (TAKO_EVAL_ANTHROPIC_KEY_FILE, default ~/.config/tako-webapp/anthropic-key.txt) si legge SOLO al momento di una
// chiamata vera e sostituisce l'header x-api-key che arriva dal client (nel processo di test ANTHROPIC_API_KEY è un valore finto):
// mai stampata, mai scritta nella cache, nel registro o nei log (si salvano solo corpo della richiesta senza header e risposta).
// Tetto per giro TAKO_EVAL_ANTHROPIC_MAX_USD (default 0,50): costo da `usage` (input 0,10 $/M, output 0,50 $/M, lettura cache
// 0,01 $/M, scrittura cache 0,125 $/M). Oltre il tetto le chiamate successive falliscono (caso «non misurato», non GRAVE).
// 429/529 in record/live: attesa (retry-after o 2 s) e nuovo tentativo, max 3; se persiste si restituisce al client la risposta
// vera dell'API (il client fa già il suo retry). Le risposte non 200 non si mettono in cache.
import {createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

export type AnthropicMode='record'|'replay'|'live'|'mock'
export const PRICE_PER_M={input:0.10,output:0.50,cacheRead:0.01,cacheWrite:0.125}
export type AnthUsage={input:number,output:number,cacheRead:number,cacheWrite:number}
type Entry={hash:string,status:number,request:any,body:any,usage:AnthUsage,ms:number,recordedAt:string,conv?:string}
export type CallLog={conv:string,hash:string,source:'hit'|'real'|'mock'|'miss'|'refused'|'error',status:number,ms:number,usage:AnthUsage,usd:number}
type LedgerRun={id:string,at:string,set:string,mode:AnthropicMode,calls:number,real:number,hits:number,misses:number,refused:number,rateLimited:number,tokens:AnthUsage,usd:number,usdEquivalent:number,finished:boolean}
type Ledger={runs:LedgerRun[],totalUsd:number}

const realNow=()=>performance.timeOrigin+performance.now() // Date è finto nei test: i tempi del registro sono quelli veri
const zero=():AnthUsage=>({input:0,output:0,cacheRead:0,cacheWrite:0})
export const usdOf=(u:AnthUsage)=>(u.input*PRICE_PER_M.input+u.output*PRICE_PER_M.output+u.cacheRead*PRICE_PER_M.cacheRead+u.cacheWrite*PRICE_PER_M.cacheWrite)/1e6
const usageOf=(data:any):AnthUsage=>{const u=data?.usage??{};return{input:Number(u.input_tokens)||0,output:Number(u.output_tokens)||0,cacheRead:Number(u.cache_read_input_tokens)||0,cacheWrite:Number(u.cache_creation_input_tokens)||0}}

/** JSON canonico: chiavi ordinate a ogni livello (gli array mantengono l'ordine). */
export function canonical(v:unknown):string{
 if(v===null||typeof v!=='object')return JSON.stringify(v)
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']'
 return '{'+Object.keys(v as object).sort().filter(k=>(v as any)[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical((v as any)[k])).join(',')+'}'}
export const requestHash=(body:unknown)=>createHash('sha256').update(canonical(body)).digest('hex')

/** Risposta finta valida dello schema BRAIN_SCHEMA (owner-brain-plan.ts): una domanda di chiarimento, nessuna azione. */
export function mockMessage(body:any){
 const plan={intent:'clarify',actions:[],read:'none',item_refs:[],capability_ids:[],clarify:{question:'Quale piatto intendi?',item_refs:[],missing:['name']},uncertain:[],alias_used:[],reply_draft:'Quale piatto intendi?'}
 const input=Math.ceil(JSON.stringify(body?.messages??'').length/4)
 return{id:'msg_eval_mock',type:'message',role:'assistant',model:String(body?.model??'claude-haiku-5-5'),content:[{type:'text',text:JSON.stringify(plan)}],stop_reason:'end_turn',stop_sequence:null,
  usage:{input_tokens:input,output_tokens:120,cache_read_input_tokens:Math.ceil(JSON.stringify(body?.system??'').length/4),cache_creation_input_tokens:0}}}

export function anthropicKeyFile(){return process.env.TAKO_EVAL_ANTHROPIC_KEY_FILE||join(homedir(),'.config/tako-webapp/anthropic-key.txt')}

export function createAnthropic(opts:{mode?:AnthropicMode,cacheDir:string,ledgerFile:string,realFetch:typeof fetch,maxUsd?:number,set?:string}){
 const mode:AnthropicMode=opts.mode??((process.env.TAKO_BOT_LLM as AnthropicMode)||'replay')
 if(!['record','replay','live','mock'].includes(mode))throw new Error('TAKO_BOT_LLM sconosciuto: '+mode)
 const maxUsd=opts.maxUsd??Number(process.env.TAKO_EVAL_ANTHROPIC_MAX_USD||0.5),set=opts.set??'banco'
 mkdirSync(opts.cacheDir,{recursive:true})
 const stats={calls:0,hits:0,real:0,mock:0,misses:0,refused:0,errors:0,rateLimited:0,usd:0,usdEquivalent:0,tokens:zero(),cacheHitCalls:0,latencies:[] as number[],log:[] as CallLog[]}
 const runId=new Date(realNow()).toISOString()+'-'+set+'-'+mode
 let conv='',key:string|null=null,stopped=false
 const readLedger=():Ledger=>{try{return JSON.parse(readFileSync(opts.ledgerFile,'utf8'))}catch{return{runs:[],totalUsd:0}}}
 /** Aggiorna la riga del giro nel registro cumulativo (dopo ogni chiamata vera e a fine giro). */
 const writeLedger=(finished=false)=>{const l=readLedger(),row:LedgerRun={id:runId,at:new Date(realNow()).toISOString(),set,mode,calls:stats.calls,real:stats.real,hits:stats.hits,misses:stats.misses,refused:stats.refused,rateLimited:stats.rateLimited,tokens:{...stats.tokens},usd:round(stats.usd),usdEquivalent:round(stats.usdEquivalent),finished}
  const i=l.runs.findIndex(r=>r.id===runId);if(i>=0)l.runs[i]=row;else l.runs.push(row);l.totalUsd=round(l.runs.reduce((a,r)=>a+r.usd,0))
  mkdirSync(join(opts.ledgerFile,'..'),{recursive:true});writeFileSync(opts.ledgerFile,JSON.stringify(l,null,1)+'\n')}
 const json=(status:number,body:unknown,headers:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}})
 // 400 non ritentato dal client (callHaiku): un'assenza in cache o il tetto superato non devono generare un secondo tentativo.
 const evalError=(type:string,message:string)=>json(400,{type:'error',error:{type,message}})
 const count=(c:CallLog)=>{stats.calls++;stats.log.push(c);if(c.source==='hit'||c.source==='real'||c.source==='mock'){for(const k of Object.keys(stats.tokens) as (keyof AnthUsage)[])stats.tokens[k]+=c.usage[k];if(c.usage.cacheRead>0)stats.cacheHitCalls++;stats.latencies.push(c.ms);stats.usdEquivalent+=usdOf(c.usage)}}
 type Out={response:Response,hit:boolean,miss:boolean,refused:boolean,tokens:number,ms:number}
 async function handle(url:string,init:any):Promise<Out>{
  const body=JSON.parse(String(init?.body??'{}')),hash=requestHash(body),file=join(opts.cacheDir,hash.slice(0,40)+'.json')
  if(mode==='mock'){const data=mockMessage(body),usage=usageOf(data);stats.mock++;count({conv,hash,source:'mock',status:200,ms:0,usage,usd:0});return{response:json(200,data),hit:false,miss:false,refused:false,tokens:usage.input+usage.output+usage.cacheRead+usage.cacheWrite,ms:0}}
  if(mode!=='live'&&existsSync(file)){const e=JSON.parse(readFileSync(file,'utf8')) as Entry;stats.hits++;count({conv,hash,source:'hit',status:e.status,ms:e.ms,usage:e.usage,usd:0})
   return{response:json(e.status,e.body),hit:true,miss:false,refused:false,tokens:e.usage.input+e.usage.output+e.usage.cacheRead+e.usage.cacheWrite,ms:e.ms}}
  if(mode==='replay'){stats.misses++;count({conv,hash,source:'miss',status:400,ms:0,usage:zero(),usd:0});return{response:evalError('eval_cache_miss','eval: risposta Haiku non in cache (replay)'),hit:false,miss:true,refused:false,tokens:0,ms:0}}
  // record/live: tetto di spesa (stima prudente prima della chiamata: input non in cache + output massimo).
  const estimate=usdOf({input:Math.ceil(String(init?.body??'').length/3.5),output:Number(body?.max_tokens)||3000,cacheRead:0,cacheWrite:0})
  if(stopped||stats.usd+estimate>maxUsd){stopped=true;stats.refused++;count({conv,hash,source:'refused',status:400,ms:0,usage:zero(),usd:0});return{response:evalError('eval_budget','eval: tetto di spesa del giro raggiunto'),hit:false,miss:false,refused:true,tokens:0,ms:0}}
  if(key===null){const f=anthropicKeyFile();if(!existsSync(f))throw new Error('eval: file della chiave Anthropic assente (TAKO_EVAL_ANTHROPIC_KEY_FILE)');key=readFileSync(f,'utf8').trim();if(!key)throw new Error('eval: file della chiave Anthropic vuoto')}
  const {signal:_s,headers:h0,...rest}=init??{}
  const headers:Record<string,string>={...Object.fromEntries(new Headers(h0??{}).entries()),'x-api-key':key}
  const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))
  const call=async()=>{const t=realNow();const r=await opts.realFetch(url,{...rest,headers,signal:AbortSignal.timeout(60000)});return{r,ms:Math.round(realNow()-t)}}
  let res:Response,ms:number
  try{({r:res,ms}=await call());for(let tries=0;(res.status===429||res.status===529)&&tries<3;tries++){stats.rateLimited++;await res.text().catch(()=>'');await sleep(Math.min(30000,Math.max(2000,Number(res.headers.get('retry-after')||2)*1000)));({r:res,ms}=await call())}}
  catch(e){stats.errors++;count({conv,hash,source:'error',status:0,ms:0,usage:zero(),usd:0});throw e}
  const text=await res.text(),data=(()=>{try{return JSON.parse(text)}catch{return null}})(),usage=usageOf(data),usd=usdOf(usage)
  stats.usd+=usd;stats.real++
  if(!res.ok){stats.errors++;count({conv,hash,source:'error',status:res.status,ms,usage,usd});writeLedger();return{response:new Response(text,{status:res.status,headers:{'Content-Type':'application/json',...(res.headers.get('retry-after')?{'retry-after':res.headers.get('retry-after')!}:{})}}),hit:false,miss:false,refused:false,tokens:0,ms}}
  count({conv,hash,source:'real',status:200,ms,usage,usd})
  const e:Entry={hash,status:200,request:body,body:data,usage,ms,recordedAt:new Date(realNow()).toISOString(),conv};writeFileSync(file,JSON.stringify(e,null,1)+'\n');writeLedger()
  return{response:json(200,data),hit:false,miss:false,refused:false,tokens:usage.input+usage.output+usage.cacheRead+usage.cacheWrite,ms}}
 return{mode,maxUsd,set,stats,handle,finish:()=>writeLedger(true),setConversation:(c:{id:string})=>{conv=c.id}}
}
const round=(x:number)=>Math.round(x*1e6)/1e6
export type Anthropic=ReturnType<typeof createAnthropic>
