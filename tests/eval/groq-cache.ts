// Record/replay delle chiamate Groq del banco E. Cache su disco per hash della richiesta (modello + messaggi + parametri),
// così le riesecuzioni costano 0 token. Tetto token giornaliero configurabile, conteggio da `usage` della risposta vera.
// Modalità (TAKO_EVAL_GROQ): off = Groq giù (503, misura la riserva) · replay = solo cache, un'assenza vale come Groq giù (default)
// · record = cache, poi chiamata vera finché il tetto lo permette · oracle = modello ideale per messaggio dell'adattatore (0 token, solo bot attuale). La chiave non viene mai scritta su disco né stampata.
import {createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

export type GroqMode='off'|'replay'|'record'|'oracle'
export type GroqStats={calls:number,hits:number,misses:number,recorded:number,tokens:number,recordedMs:number,refused:number,rateLimited:number,oracle:number}
type Entry={model:string,status:number,body:any,usage:{prompt_tokens:number,completion_tokens:number,total_tokens:number},ms:number,recordedAt:string,conv?:string}
type Ledger={days:Record<string,{tokens:number,calls:number,key:string}>}

const realNow=()=>performance.timeOrigin+performance.now() // Date è finto nei test: il giorno del tetto è quello vero
const realDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(realNow())

export function requestHash(path:string,body:any){const b={path,model:body?.model,messages:body?.messages,response_format:body?.response_format,temperature:body?.temperature,reasoning_effort:body?.reasoning_effort,max_completion_tokens:body?.max_completion_tokens};return createHash('sha256').update(JSON.stringify(b)).digest('hex').slice(0,32)}

function keyFile(){const env=process.env.TAKO_EVAL_GROQ_KEY_FILE,dir=join(homedir(),'.config/tako-webapp'),test=join(dir,'groq-key-test.txt')
 const file=env||(existsSync(test)?test:join(dir,'groq-key.txt'));if(/traduzioni/i.test(file))throw new Error('La chiave traduzioni non si usa mai per i test')
 return{file,kind:file.endsWith('groq-key-test.txt')?'test':'bot'}}

export function createGroq(opts:{mode?:GroqMode,cacheDir:string,ledgerFile:string,maxTokens?:number,realFetch:typeof fetch,oracle?:(conv:any,body:any)=>string|null}){
 const mode:GroqMode=opts.mode??((process.env.TAKO_EVAL_GROQ as GroqMode)||'replay'),maxTokens=opts.maxTokens??Number(process.env.TAKO_EVAL_GROQ_MAX_TOKENS||20000)
 const stats:GroqStats={calls:0,hits:0,misses:0,recorded:0,tokens:0,recordedMs:0,refused:0,rateLimited:0,oracle:0}
 mkdirSync(opts.cacheDir,{recursive:true})
 let conv='',convObj:any=null,stopped=false,lastReal=0,key:string|null=null,kind=''
 const readLedger=():Ledger=>{try{return JSON.parse(readFileSync(opts.ledgerFile,'utf8'))}catch{return{days:{}}}}
 const spentToday=()=>readLedger().days[realDay()]?.tokens??0
 const charge=(tokens:number)=>{const l=readLedger(),d=realDay(),row=l.days[d]??{tokens:0,calls:0,key:kind};row.tokens+=tokens;row.calls++;row.key=kind;l.days[d]=row;writeFileSync(opts.ledgerFile,JSON.stringify(l,null,1)+'\n')}
 const unavailable=()=>new Response(JSON.stringify({error:{message:'eval: Groq non disponibile (off/miss)'}}),{status:503,headers:{'Content-Type':'application/json'}})
 const ok=(e:Entry)=>new Response(JSON.stringify(e.body),{status:200,headers:{'Content-Type':'application/json'}})
 async function handle(url:string,init:any):Promise<{response:Response,hit:boolean,miss:boolean,tokens:number,ms:number}>{
  const path=new URL(url).pathname,body=JSON.parse(String(init?.body??'{}')),h=requestHash(path,body),file=join(opts.cacheDir,h+'.json')
  if(mode==='oracle'){const content=opts.oracle?.(convObj,body);if(content==null){stats.misses++;return{response:unavailable(),hit:false,miss:true,tokens:0,ms:0}}stats.calls++;stats.oracle++;return{response:ok({model:String(body.model),status:200,body:{choices:[{message:{content}}],usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0}},usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0},ms:0,recordedAt:''}),hit:false,miss:false,tokens:0,ms:0}}
  if(mode!=='off'&&existsSync(file)){const e=JSON.parse(readFileSync(file,'utf8')) as Entry;stats.calls++;stats.hits++;stats.recordedMs+=e.ms;return{response:ok(e),hit:true,miss:false,tokens:0,ms:e.ms}}
  // Senza cache: in replay/off è come Groq giù. In record si chiama davvero solo se resta tetto (stima prudente prima della chiamata).
  const estimate=Math.ceil(JSON.stringify(body.messages??'').length/3)+1200
  if(mode!=='record'||stopped||spentToday()+estimate>maxTokens){stats.misses++;if(mode==='record')stats.refused++;return{response:unavailable(),hit:false,miss:true,tokens:0,ms:0}}
  if(key===null){const k=keyFile();kind=k.kind;key=readFileSync(k.file,'utf8').trim()}
  const t0=realNow();lastReal=t0;const res=await opts.realFetch(url,{...init,headers:{...(init?.headers??{}),Authorization:'Bearer '+key}}),ms=Math.round(realNow()-t0)
  if(res.status===429){stats.rateLimited++;stopped=true;stats.misses++;return{response:unavailable(),hit:false,miss:true,tokens:0,ms}}
  const data=await res.json().catch(()=>null),usage={prompt_tokens:Number(data?.usage?.prompt_tokens)||0,completion_tokens:Number(data?.usage?.completion_tokens)||0,total_tokens:Number(data?.usage?.total_tokens)||0}
  if(!usage.total_tokens)usage.total_tokens=usage.prompt_tokens+usage.completion_tokens
  charge(usage.total_tokens);stats.tokens+=usage.total_tokens;stats.calls++
  if(!res.ok){stats.misses++;return{response:unavailable(),hit:false,miss:true,tokens:usage.total_tokens,ms}}
  const e:Entry={model:String(body.model),status:200,body:data,usage,ms,recordedAt:new Date(realNow()).toISOString(),conv};writeFileSync(file,JSON.stringify(e,null,1)+'\n');stats.recorded++;stats.recordedMs+=ms
  return{response:ok(e),hit:false,miss:false,tokens:usage.total_tokens,ms}}
 // Quota condivisa coi ristoranti veri (8k token/minuto sul piano free): in record si aspetta tra una conversazione e l'altra
 // (mai dentro una richiesta: il bot ha un tempo massimo per risposta e andrebbe in errore).
 const pace=async()=>{if(mode!=='record'||!lastReal)return;const wait=lastReal+Number(process.env.TAKO_EVAL_GROQ_PACE_MS||30000)-realNow();if(wait>0)await new Promise(r=>setTimeout(r,wait))}
 return{mode,maxTokens,stats,handle,spentToday,pace,setConversation:(c:{id:string})=>{conv=c.id;convObj=c}}
}
export type Groq=ReturnType<typeof createGroq>
