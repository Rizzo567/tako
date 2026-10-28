// Runner unico del benchmark. Stesso system prompt (eval/prompt.md), stesso input, output JSON {"ops":[...]}.
// Uso: node --experimental-strip-types run.ts <provider> <model> [--sample N] [--tpm 5000] [--max-tokens-total 100000]
// provider: groq | gemini | deepseek | moonshot | zai | dashscope | minimax | openrouter | together
// Le chiavi si leggono da env o da ~/.config/tako-webapp; non vengono mai stampate.
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {homedir} from 'node:os'
const here=new URL('.',import.meta.url)
const [provider,model,...rest]=process.argv.slice(2)
const arg=(k:string,d:number)=>{const i=rest.indexOf(k);return i>=0?Number(rest[i+1]):d}
const SAMPLE=arg('--sample',0),TPM=arg('--tpm',5000),MAXTOT=arg('--max-tokens-total',1e9)
const system=readFileSync(new URL('eval/prompt.md',here),'utf8')
let cases=readFileSync(new URL('eval/cases.jsonl',here),'utf8').trim().split('\n').map(l=>JSON.parse(l))
if(SAMPLE){ // campione stratificato deterministico: stessa scelta per tutti i modelli
 const by:Record<string,any[]>={};for(const c of cases)(by[c.difficolta]??=[]).push(c)
 const per=Math.ceil(SAMPLE/3),pick:any[]=[]
 for(const d of ['facile','medio','difficile']){const a=by[d]??[];const step=a.length/Math.min(per,a.length);for(let i=0;i<Math.min(per,a.length);i++)pick.push(a[Math.floor(i*step)])}
 cases=pick.slice(0,SAMPLE)}
const fileKey=(f:string)=>{const p=`${homedir()}/.config/tako-webapp/${f}`;return existsSync(p)?readFileSync(p,'utf8').trim():undefined}
const P:Record<string,{url:string;key?:string;json:any}>={
 groq:{url:'https://api.groq.com/openai/v1/chat/completions',key:process.env.GROQ_API_KEY||fileKey('groq-key.txt'),json:{type:'json_object'}},
 deepseek:{url:'https://api.deepseek.com/chat/completions',key:process.env.DEEPSEEK_API_KEY,json:{type:'json_object'}},
 moonshot:{url:'https://api.moonshot.ai/v1/chat/completions',key:process.env.MOONSHOT_API_KEY,json:{type:'json_object'}},
 zai:{url:'https://api.z.ai/api/paas/v4/chat/completions',key:process.env.ZAI_API_KEY,json:{type:'json_object'}},
 dashscope:{url:process.env.DASHSCOPE_BASE_URL?`${process.env.DASHSCOPE_BASE_URL}/chat/completions`:'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',key:process.env.DASHSCOPE_API_KEY,json:{type:'json_object'}},
 minimax:{url:'https://api.minimax.io/v1/chat/completions',key:process.env.MINIMAX_API_KEY,json:undefined},
 openrouter:{url:'https://openrouter.ai/api/v1/chat/completions',key:process.env.OPENROUTER_API_KEY,json:{type:'json_object'}},
 together:{url:'https://api.together.xyz/v1/chat/completions',key:process.env.TOGETHER_API_KEY,json:{type:'json_object'}},
 gemini:{url:`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,key:process.env.GEMINI_API_KEY,json:undefined},
}
const cfg=P[provider];if(!cfg)throw Error('provider sconosciuto');if(!cfg.key){console.error(`DA ESEGUIRE: manca la chiave per ${provider}`);process.exit(2)}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))
const win:{t:number;tok:number}[]=[];let total=0
const opSchema={type:'object',properties:{ops:{type:'array',items:{type:'object',properties:{op:{type:'string',enum:['add','set_price','delta_price','keep','remove','move','rename','info_locale','ask','unsupported','none']},piatto:{type:'string'},menu:{type:'string'},categoria:{type:'string'},prezzo:{type:'number'},delta:{type:'number'},nuovo_nome:{type:'string'},campo:{type:'string'},valore:{type:'string'},citazione:{type:'string'}},required:['op']}}},required:['ops']}
async function call(input:string){
 let jsonFail=0
 for(let attempt=0;attempt<6;attempt++){
  const t0=performance.now();let r:Response
  if(provider==='gemini'){
   r=await fetch(cfg.url,{method:'POST',headers:{'x-goog-api-key':cfg.key!,'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:input}]}],generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:opSchema}})})
  }else{
   r=await fetch(cfg.url,{method:'POST',headers:{Authorization:`Bearer ${cfg.key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:0,...(cfg.json?{response_format:cfg.json}:{}),max_completion_tokens:4000,messages:[{role:'system',content:system},{role:'user',content:input}]})})
  }
  const ms=performance.now()-t0
  if(r.status===429||r.status>=500){const ra=Number(r.headers.get('retry-after'))||Math.min(60,5*2**attempt);await r.text();console.error(`  HTTP ${r.status}, attendo ${ra}s`);await sleep(ra*1000+250);continue}
  const j:any=await r.json()
  if(!r.ok&&j?.error?.code==='json_validate_failed'&&!jsonFail){jsonFail=1;continue}
  if(!r.ok)return{ms,jsonFail,error:`HTTP ${r.status} ${j?.error?.code||j?.error?.status||''}`.trim(),text:'',tin:0,tout:0}
  if(provider==='gemini'){const u=j.usageMetadata||{};return{ms,text:j.candidates?.[0]?.content?.parts?.map((p:any)=>p.text).join('')||'',tin:u.promptTokenCount||0,tout:(u.candidatesTokenCount||0)+(u.thoughtsTokenCount||0)}}
  return{ms,jsonFail,text:j.choices?.[0]?.message?.content||'',tin:j.usage?.prompt_tokens||0,tout:j.usage?.completion_tokens||0,reasoning:j.usage?.completion_tokens_details?.reasoning_tokens}
 }
 return{ms:0,error:'retry esauriti',text:'',tin:0,tout:0}
}
const out:any[]=[];const started=new Date().toISOString()
for(const c of cases){
 if(total>MAXTOT){console.error(`stop: budget token ${MAXTOT} raggiunto`);break}
 // throttling: resta sotto TPM nella finestra di 60 s (la chiave è condivisa con il bot online)
 const est=1500;for(;;){const now=Date.now();while(win.length&&now-win[0].t>60000)win.shift();const used=win.reduce((a,b)=>a+b.tok,0);if(used+est<=TPM)break;await sleep(1000)}
 const input=JSON.stringify({stato:c.stato,domanda_aperta:c.domanda_aperta,messaggio:c.messaggio})
 const res:any=await call(input);win.push({t:Date.now(),tok:res.tin+res.tout});total+=res.tin+res.tout
 let parsed:any=null,valid=false
 try{const t=res.text.replace(/^```(?:json)?\s*|\s*```$/g,'');parsed=JSON.parse(t);valid=Array.isArray(parsed?.ops)}catch{}
 out.push({id:c.id,ms:Math.round(res.ms),jsonFail:res.jsonFail||0,tin:res.tin,tout:res.tout,reasoning:res.reasoning,error:res.error,valid,ops:valid?parsed.ops:null,raw:valid?undefined:String(res.text).slice(0,500)})
 console.error(`${c.id} ${valid?'ok':'NON VALIDO'} ${Math.round(res.ms)}ms ${res.tin}/${res.tout}`)
}
const name=`${provider}__${model.replace(/[\/:]/g,'_')}`
writeFileSync(new URL(`results/raw-${name}.json`,here),JSON.stringify({provider,model,started,finished:new Date().toISOString(),sample:SAMPLE||'tutti',tpm:TPM,totalTokens:total,results:out},null,1))
console.error(`fatto ${out.length} casi, ${total} token`)
