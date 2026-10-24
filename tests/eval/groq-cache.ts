// Record/replay delle chiamate Groq del banco E. Cache su disco per hash della richiesta (modello + messaggi + parametri),
// così le riesecuzioni costano 0 token. Tetto token giornaliero configurabile, conteggio da `usage` della risposta vera.
// Modalità (TAKO_EVAL_GROQ): off = Groq giù (503, misura la riserva) · replay = solo cache, un'assenza vale come Groq giù (default)
// · record = cache, poi chiamata vera finché il tetto lo permette · oracle = modello ideale per messaggio dell'adattatore (0 token, solo bot attuale). La chiave non viene mai scritta su disco né stampata.
import {createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

export type GroqMode='off'|'replay'|'record'|'oracle'
export type GroqStats={calls:number,hits:number,misses:number,recorded:number,tokens:number,recordedMs:number,refused:number,rateLimited:number,oracle:number,byKey:Record<string,number>,last:any}
type Entry={model:string,status:number,body:any,usage:{prompt_tokens:number,completion_tokens:number,total_tokens:number},ms:number,recordedAt:string,conv?:string}
type Ledger={days:Record<string,{tokens:number,calls:number,key:string}>}

const realNow=()=>performance.timeOrigin+performance.now() // Date è finto nei test: il giorno del tetto è quello vero
const realDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(realNow())

export function requestHash(path:string,body:any){const b={path,model:body?.model,messages:body?.messages,response_format:body?.response_format,temperature:body?.temperature,reasoning_effort:body?.reasoning_effort,max_completion_tokens:body?.max_completion_tokens};return createHash('sha256').update(JSON.stringify(b)).digest('hex').slice(0,32)}

// Chiavi (17/10 sera, Manuel): prima groq-key-test.txt, al 429/quota groq-key-test-2.txt (account separati, ≤150k token/giorno
// ciascuna). La chiave del bot solo se non esiste nessuna chiave di test. Mai stampate né scritte.
// Opzione (19/10): TAKO_EVAL_GROQ_KEY_ENV=NOME[,NOME2] legge le chiavi da variabili d'ambiente (in ordine, la successiva al 429
// giornaliero) invece che da file; letta a ogni chiamata, mai stampata. Senza la variabile il comportamento è quello di prima.
function keyFiles():{file:string,kind:string,env?:string}[]{const names=process.env.TAKO_EVAL_GROQ_KEY_ENV?.split(',').map(s=>s.trim()).filter(Boolean)
 if(names?.length)return names.filter(n=>process.env[n]).map(n=>({file:'',kind:'env:'+n,env:n}))
 const env=process.env.TAKO_EVAL_GROQ_KEY_FILE,dir=join(homedir(),'.config/tako-webapp')
 const list=env?[env]:[join(dir,'groq-key-test.txt'),join(dir,'groq-key-test-2.txt')].filter(f=>existsSync(f));const files=list.length?list:[join(dir,'groq-key.txt')]
 for(const f of files)if(/traduzioni/i.test(f))throw new Error('La chiave traduzioni non si usa mai per i test')
 return files.map(f=>({file:f,kind:f.endsWith('groq-key-test.txt')?'test':f.endsWith('groq-key-test-2.txt')?'test-2':'bot'}))}

export function createGroq(opts:{mode?:GroqMode,cacheDir:string,ledgerFile:string,maxTokens?:number,realFetch:typeof fetch,oracle?:(conv:any,body:any)=>string|null}){
 const mode:GroqMode=opts.mode??((process.env.TAKO_EVAL_GROQ as GroqMode)||'replay'),maxTokens=opts.maxTokens??Number(process.env.TAKO_EVAL_GROQ_MAX_TOKENS||20000)
 const stats:GroqStats={calls:0,hits:0,misses:0,recorded:0,tokens:0,recordedMs:0,refused:0,rateLimited:0,oracle:0,byKey:{},last:null}
 mkdirSync(opts.cacheDir,{recursive:true})
 let conv='',convObj:any=null,stopped=false,lastReal=0,key:string|null=null,kind='',keyIndex=0,lastHeaders:any=null
 const win:Record<string,{t:number,n:number}[]>={}
 const perKey=Number(process.env.TAKO_EVAL_GROQ_MAX_TOKENS_PER_KEY||150000)
 const readLedger=():Ledger=>{try{return JSON.parse(readFileSync(opts.ledgerFile,'utf8'))}catch{return{days:{}}}}
 const spentToday=()=>readLedger().days[realDay()]?.tokens??0
 const spentKey=(k:string)=>(readLedger().days[realDay()+'|'+k]?.tokens??0)
 const charge=(tokens:number)=>{const l=readLedger(),d=realDay(),row=l.days[d]??{tokens:0,calls:0,key:kind};row.tokens+=tokens;row.calls++;row.key=kind;l.days[d]=row;const kr=l.days[d+'|'+kind]??{tokens:0,calls:0,key:kind};kr.tokens+=tokens;kr.calls++;l.days[d+'|'+kind]=kr;writeFileSync(opts.ledgerFile,JSON.stringify(l,null,1)+'\n')}
 const unavailable=()=>new Response(JSON.stringify({error:{message:'eval: Groq non disponibile (off/miss)'}}),{status:503,headers:{'Content-Type':'application/json'}})
 const ok=(e:Entry)=>new Response(JSON.stringify(e.body),{status:200,headers:{'Content-Type':'application/json'}})
 async function handle(url:string,init:any):Promise<{response:Response,hit:boolean,miss:boolean,tokens:number,ms:number}>{
  const path=new URL(url).pathname,body=JSON.parse(String(init?.body??'{}')),h=requestHash(path,body),file=join(opts.cacheDir,h+'.json')
  if(mode==='oracle'){const content=opts.oracle?.(convObj,body);if(content==null){stats.misses++;return{response:unavailable(),hit:false,miss:true,tokens:0,ms:0}}stats.calls++;stats.oracle++;return{response:ok({model:String(body.model),status:200,body:{choices:[{message:{content}}],usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0}},usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0},ms:0,recordedAt:''}),hit:false,miss:false,tokens:0,ms:0}}
  if(mode!=='off'&&existsSync(file)){const e=JSON.parse(readFileSync(file,'utf8')) as Entry;stats.calls++;stats.hits++;stats.recordedMs+=e.ms;return{response:ok(e),hit:true,miss:false,tokens:0,ms:e.ms}}
  // Senza cache: in replay/off è come Groq giù. In record si chiama davvero solo se resta tetto (stima prudente prima della chiamata).
  const estimate=Math.ceil(JSON.stringify(body.messages??'').length/3)+Number(process.env.TAKO_EVAL_GROQ_OUT_EST||800)
  if(mode!=='record'||stopped||spentToday()+estimate>maxTokens){stats.misses++;if(mode==='record')stats.refused++;return{response:unavailable(),hit:false,miss:true,tokens:0,ms:0}}
  const files=keyFiles()
  const pick=()=>{while(keyIndex<files.length&&spentKey(files[keyIndex]!.kind)+estimate>perKey)keyIndex++;if(keyIndex>=files.length)return false;kind=files[keyIndex]!.kind;const f=files[keyIndex]!;key=f.env?String(process.env[f.env]??'').trim():readFileSync(f.file,'utf8').trim();return true}
  if(!pick()){stats.misses++;stats.refused++;return{response:unavailable(),hit:false,miss:true,tokens:0,ms:0}}
  // R5.2 (18/10): limite al minuto (TPM, piano free 8k) rispettato PRIMA della chiamata con una finestra di 60 s per chiave;
  // 429 al minuto → attesa (retry-after) e stessa chiave; 429 giornaliero (TPD/RPD) → chiave successiva; finite le chiavi stop.
  // Il segnale di timeout del bot non passa alla chiamata vera (l'attesa qui non deve far scadere la richiesta).
  const tpm=Number(process.env.TAKO_EVAL_GROQ_TPM||7000),sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))
  const throttle=async()=>{for(;;){const now=realNow(),w=(win[kind]??=[]).filter(x=>now-x.t<60000);win[kind]=w;const used=w.reduce((a,x)=>a+x.n,0);if(!w.length||used+estimate<=tpm)return;await sleep(Math.max(500,w[0]!.t+60000-now+200))}}
  const {signal:_sig,...init2}=init??{}
  const call=async()=>{await throttle();const t=realNow();lastReal=t;const r=await opts.realFetch(url,{...init2,headers:{...(init?.headers??{}),Authorization:'Bearer '+key},signal:AbortSignal.timeout(90000)});return{r,ms:Math.round(realNow()-t)}}
  let {r:res,ms}=await call()
  for(let tries=0;res.status===429&&tries<6;tries++){stats.rateLimited++;const txt=await res.text().catch(()=>''),daily=/per day|\bTPD\b|\bRPD\b|daily/i.test(txt)
   lastHeaders={status:429,daily,retryAfter:res.headers.get('retry-after'),message:txt.slice(0,200)}
   if(daily){keyIndex++;if(!pick()){stopped=true;stats.misses++;return{response:unavailable(),hit:false,miss:true,tokens:0,ms}}}
   else{(win[kind]??=[]).push({t:realNow(),n:tpm});await sleep(Math.min(65000,Math.max(2000,Number(res.headers.get('retry-after')||20)*1000)))}
   ;({r:res,ms}=await call())}
  if(res.status===429){stopped=true;stats.misses++;return{response:unavailable(),hit:false,miss:true,tokens:0,ms}}
  lastHeaders={status:res.status,remainingTokensMin:res.headers.get('x-ratelimit-remaining-tokens'),remainingRequestsDay:res.headers.get('x-ratelimit-remaining-requests'),key:kind}
  const data=await res.json().catch(()=>null),usage={prompt_tokens:Number(data?.usage?.prompt_tokens)||0,completion_tokens:Number(data?.usage?.completion_tokens)||0,total_tokens:Number(data?.usage?.total_tokens)||0}
  if(!usage.total_tokens)usage.total_tokens=usage.prompt_tokens+usage.completion_tokens
  charge(usage.total_tokens);stats.tokens+=usage.total_tokens;stats.calls++;(win[kind]??=[]).push({t:realNow(),n:usage.total_tokens});stats.byKey[kind]=(stats.byKey[kind]??0)+usage.total_tokens;stats.last=lastHeaders
  if(!res.ok){stats.misses++;return{response:unavailable(),hit:false,miss:true,tokens:usage.total_tokens,ms}}
  const e:Entry={model:String(body.model),status:200,body:data,usage,ms,recordedAt:new Date(realNow()).toISOString(),conv};writeFileSync(file,JSON.stringify(e,null,1)+'\n');stats.recorded++;stats.recordedMs+=ms
  return{response:ok(e),hit:false,miss:false,tokens:usage.total_tokens,ms}}
 // Quota condivisa coi ristoranti veri (8k token/minuto sul piano free): in record si aspetta tra una conversazione e l'altra
 // (mai dentro una richiesta: il bot ha un tempo massimo per risposta e andrebbe in errore).
 const pace=async()=>{if(mode!=='record'||!lastReal)return;const wait=lastReal+Number(process.env.TAKO_EVAL_GROQ_PACE_MS||30000)-realNow();if(wait>0)await new Promise(r=>setTimeout(r,wait))}
 return{mode,maxTokens,stats,handle,spentToday,pace,setConversation:(c:{id:string})=>{conv=c.id;convObj=c}}
}
export type Groq=ReturnType<typeof createGroq>
