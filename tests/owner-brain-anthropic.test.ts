// Motore Haiku 5.5 del cervello (PIANO bot-haiku 21/10, perimetro T): client, interruttore, nessuna chiamata Groq. Solo fetch finto.
import{describe,it,expect,afterEach}from'vitest'
import{buildBrainContext}from'../apps/server/src/lib/owner-brain-context.js'
import{planOwnerMessage,BrainUnavailable}from'../apps/server/src/lib/owner-brain-plan.js'
import{callHaiku,haikuRequest,HAIKU_MODEL,ANTHROPIC_URL}from'../apps/server/src/lib/owner-brain-anthropic.js'
import{botEngineOf,engineKey,readBotEngine,readBotSettings,botEnginePatch}from'../apps/server/src/lib/owner-brain-switch.js'
import{catalogOf}from'../apps/server/src/lib/owner-brain-eval.js'
import{typicalWorkspace}from'./owner-brain-fixture.js'

const W=typicalWorkspace(),{refs,sections}=catalogOf(W),id=(name:string)=>refs.find(r=>r.name===name)!.id
const NOW=Date.UTC(2026,9,21,12,0,0)
const ctx=buildBrainContext({refs,sections,message:'la margherita è finita',now:NOW,history:[{role:'bot',text:'Dimmi pure',at:NOW-2000},{role:'owner',text:'ciao',at:NOW-1000}]})
const code=(name:string)=>ctx.codeOf.get(id(name))!
const blank={action:'set_price',item:null,section:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}
const plan=(o:any={})=>JSON.stringify({intent:'change',actions:[],read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:'',...o,...(o.actions?{actions:o.actions.map((a:any)=>({...blank,...a}))}:{})})
const anthropicReply=(text:string,o:{stop?:string,usage?:any,status?:number}={})=>new Response(JSON.stringify({id:'msg_1',type:'message',role:'assistant',model:HAIKU_MODEL,stop_reason:o.stop??'end_turn',
 content:[{type:'thinking',thinking:'ragiono',signature:'x'},{type:'text',text}],usage:o.usage??{input_tokens:400,output_tokens:120,cache_read_input_tokens:2500,cache_creation_input_tokens:0}}),{status:o.status??200,headers:{'content-type':'application/json'}})
function fake(script:(n:number,body:any,url:string)=>Response|Promise<Response>){const calls:{url:string,body:any,headers:any}[]=[]
 const f=async(url:string,init:RequestInit)=>{if(/api\.groq\.com|chat\/completions/.test(url))throw new Error('chiamata Groq vietata: '+url);const body=JSON.parse(String(init.body));calls.push({url,body,headers:init.headers});return script(calls.length,body,url)}
 return{fetch:f,calls}}
const ok=plan({actions:[{action:'set_available',item:code('Margherita'),value:false}]})

describe('callHaiku: richiesta',()=>{
 it('POST /v1/messages con header giusti, output_config json_schema + effort low, niente temperature/top_p/tool_choice/prefill',async()=>{
  const g=fake(()=>anthropicReply(ok));const r=await callHaiku(ctx,'chiave-finta',{fetch:g.fetch})
  expect(g.calls).toHaveLength(1);const {url,body,headers}=g.calls[0]!
  expect(url).toBe(ANTHROPIC_URL);expect(headers).toMatchObject({'x-api-key':'chiave-finta','anthropic-version':'2023-06-01','content-type':'application/json'})
  expect(body.model).toBe('claude-haiku-5-5');expect(body.max_tokens).toBe(3000)
  expect(body.output_config.effort).toBe('low');expect(body.output_config.format.type).toBe('json_schema');expect(body.output_config.format.schema.required).toContain('actions')
  for(const k of ['temperature','top_p','tool_choice','tools','thinking','response_format'])expect(body).not.toHaveProperty(k)
  // system: 2 blocchi con cache_control (regole fisse + menu del locale); messaggi alternati, primo e ultimo dell'utente.
  expect(body.system).toHaveLength(2);expect(body.system.every((b:any)=>b.type==='text'&&b.cache_control?.type==='ephemeral')).toBe(true)
  expect(body.system[1].text).toContain('Margherita')
  expect(body.messages[0].role).toBe('user');expect(body.messages.at(-1).role).toBe('user');expect(body.messages.at(-1).content).toContain('la margherita è finita')
  for(let i=1;i<body.messages.length;i++)expect(body.messages[i].role).not.toBe(body.messages[i-1].role)
  // risposta: solo i blocchi text (il thinking si salta), usage con la cache
  expect(JSON.parse(r.content).actions[0].item).toBe(code('Margherita'))
  expect(r.usage).toMatchObject({model:HAIKU_MODEL,prompt:2900,completion:120,cached:2500})
 })
 it('messaggi consecutivi con lo stesso ruolo si uniscono; thinking disattivabile solo su richiesta',()=>{
  const c={...ctx,messages:[{role:'system' as const,content:'A'},{role:'user' as const,content:'u1'},{role:'user' as const,content:'u2'},{role:'assistant' as const,content:'a1'},{role:'assistant' as const,content:'a2'},{role:'user' as const,content:'u3'}]}
  const b=haikuRequest(c,{thinking:'disabled'});expect(b.messages).toEqual([{role:'user',content:'u1\n\nu2'},{role:'assistant',content:'a1\n\na2'},{role:'user',content:'u3'}]);expect(b.system).toHaveLength(1);expect((b as any).thinking).toEqual({type:'disabled'})
 })
 it('meter: conta col modello claude-haiku-5-5',async()=>{
  const seen:any[]=[];const g=fake(()=>anthropicReply(ok));await callHaiku(ctx,'k',{fetch:g.fetch,meter:e=>{seen.push(e)}})
  expect(seen).toEqual([{model:'claude-haiku-5-5',prompt:2900,completion:120,limited:false}])
 })
})

describe('callHaiku: errori e retry',()=>{
 const sleep=async()=>{}
 it('429 → un nuovo tentativo → ok',async()=>{
  const g=fake(n=>n===1?new Response('{"type":"error"}',{status:429}):anthropicReply(ok));const r=await callHaiku(ctx,'k',{fetch:g.fetch,sleep,retryDelayMs:1})
  expect(g.calls).toHaveLength(2);expect(r.model).toBe(HAIKU_MODEL)
 })
 it('529 sovraccarico → retry; 500 due volte → BrainUnavailable(http)',async()=>{
  const g1=fake(n=>n===1?new Response('',{status:529}):anthropicReply(ok));await callHaiku(ctx,'k',{fetch:g1.fetch,sleep,retryDelayMs:1});expect(g1.calls).toHaveLength(2)
  const g=fake(()=>new Response('',{status:500}));const e=await callHaiku(ctx,'k',{fetch:g.fetch,sleep,retryDelayMs:1}).catch(x=>x)
  expect(e).toBeInstanceOf(BrainUnavailable);expect(e.reason).toBe('http');expect(g.calls).toHaveLength(2)
 })
 it('400/401/403: nessun retry',async()=>{
  for(const status of [400,401,403]){const g=fake(()=>new Response('{}',{status}));const e=await callHaiku(ctx,'k',{fetch:g.fetch,sleep,retryDelayMs:1}).catch(x=>x);expect(e.reason).toBe('http');expect(g.calls).toHaveLength(1)}
 })
 it('errore di rete → retry → ok',async()=>{
  let n=0;const f=async(u:string,i:RequestInit)=>{if(++n===1)throw new TypeError('fetch failed');return anthropicReply(ok)};const r=await callHaiku(ctx,'k',{fetch:f,sleep,retryDelayMs:1});expect(n).toBe(2);expect(r.content).toBe(ok)
 })
 it('refusal, max_tokens e JSON non valido → BrainUnavailable senza retry',async()=>{
  for(const [reply,reason] of [[anthropicReply('',{stop:'refusal'}),'refusal'],[anthropicReply('{"intent":',{stop:'max_tokens'}),'max_tokens'],[anthropicReply('non è json'),'invalid_json']] as const){
   const g=fake(()=>reply.clone());const e=await callHaiku(ctx,'k',{fetch:g.fetch,sleep,retryDelayMs:1}).catch(x=>x);expect(e).toBeInstanceOf(BrainUnavailable);expect(e.reason).toBe(reason);expect(g.calls).toHaveLength(1)}
 })
 it('lentezza: un solo tentativo (mai rifatto per timeout) → BrainUnavailable(timeout) (21/10)',async()=>{
  let n=0;const hang=(_u:string,i:RequestInit)=>{n++;return new Promise<Response>((_r,rej)=>{i.signal!.addEventListener('abort',()=>rej(i.signal!.reason))})}
  const e=await callHaiku(ctx,'k',{fetch:hang,sleep,retryDelayMs:1,timeoutMs:30,budgetMs:5000}).catch(x=>x);expect(e).toBeInstanceOf(BrainUnavailable);expect(e.reason).toBe('timeout');expect(n).toBe(1)
 })
 it('il tentativo usa tutto il budget del turno (niente tetto fisso di 10 s)',async()=>{
  let used=0;const slow=(_u:string,i:RequestInit)=>new Promise<Response>((res,rej)=>{const t0=Date.now();const h=setTimeout(()=>{used=Date.now()-t0;res(anthropicReply(ok))},120);i.signal!.addEventListener('abort',()=>{clearTimeout(h);rej(i.signal!.reason)})})
  const r=await callHaiku(ctx,'k',{fetch:slow,sleep,budgetMs:5000});expect(r.content).toBeTruthy();expect(used).toBeGreaterThanOrEqual(100)
 })
 it('budget del turno finito: nessuna chiamata',async()=>{
  const g=fake(()=>anthropicReply(ok));const e=await callHaiku(ctx,'k',{fetch:g.fetch,budgetMs:0}).catch(x=>x);expect(e.reason).toBe('timeout');expect(g.calls).toHaveLength(0)
 })
 it('chiave assente → no_key',async()=>{expect((await callHaiku(ctx,'').catch(x=>x)).reason).toBe('no_key')})
 it('fetch di default = globalThis.fetch letto a ogni chiamata (stub del banco)',async()=>{
  const orig=globalThis.fetch;let hit='';(globalThis as any).fetch=async(u:string)=>{hit=u;return anthropicReply(ok)}
  try{await callHaiku(ctx,'k');expect(hit).toBe(ANTHROPIC_URL)}finally{globalThis.fetch=orig}
 })
})

describe('planOwnerMessage con engine haiku',()=>{
 it('chiama Anthropic e mai Groq; il piano passa dal validatore',async()=>{
  const g=fake(()=>anthropicReply(ok));const r=await planOwnerMessage({refs,sections,message:'la margherita è finita',now:NOW},'k',{engine:'haiku',fetch:g.fetch})
  expect(g.calls.map(c=>c.url)).toEqual([ANTHROPIC_URL]);expect(r.path).toBe('brain');if(r.path==='brain'){expect(r.plan).toEqual({type:'change',actions:[{kind:'available',id:id('Margherita'),value:false}]});expect(r.usage.model).toBe(HAIKU_MODEL)}
 })
 it('Haiku giù → riserva col motivo (il route risponde brainDown), nessuna chiamata Groq',async()=>{
  const g=fake(()=>new Response('',{status:503}));const r=await planOwnerMessage({refs,sections,message:'la margherita è finita',now:NOW},'k',{engine:'haiku',fetch:g.fetch,sleep:async()=>{},retryDelayMs:1})
  expect(r).toMatchObject({path:'fallback',reason:'http'});expect(g.calls.every(c=>c.url===ANTHROPIC_URL)).toBe(true)
  const r2=await planOwnerMessage({refs,sections,message:'x',now:NOW},'k',{engine:'haiku',fetch:fake(()=>anthropicReply('',{stop:'refusal'})).fetch});expect(r2).toMatchObject({path:'fallback',reason:'refusal'})
 })
 it('auto-correzione: il piano rifiutato torna come assistant e la richiesta finisce con un messaggio utente',async()=>{
  const g=fake(()=>anthropicReply(ok));await planOwnerMessage({refs,sections,message:'la margherita è finita',now:NOW,correction:{previous:'{"intent":"change"}',reason:'piatto non nominato'}},'k',{engine:'haiku',fetch:g.fetch})
  const msgs=g.calls[0]!.body.messages;expect(msgs.at(-2).role).toBe('assistant');expect(msgs.at(-1).role).toBe('user');expect(msgs.at(-1).content).toContain('piatto non nominato')
 })
})

describe('interruttore del motore',()=>{
 const saved={...process.env};afterEach(()=>{process.env={...saved}})
 it('settings.botEngine → env TAKO_BOT_ENGINE_DEFAULT → haiku',()=>{
  expect(botEngineOf({botEngine:'groq'},{})).toBe('groq');expect(botEngineOf({botEngine:'haiku'},{TAKO_BOT_ENGINE_DEFAULT:'groq'})).toBe('haiku')
  expect(botEngineOf({botEngine:'sonnet'},{TAKO_BOT_ENGINE_DEFAULT:'groq'})).toBe('groq')
  expect(botEngineOf({},{TAKO_BOT_ENGINE_DEFAULT:'groq'})).toBe('groq');expect(botEngineOf(null,{TAKO_BOT_ENGINE_DEFAULT:' GROQ '})).toBe('groq')
  expect(botEngineOf(null,{})).toBe('haiku');expect(botEngineOf({botEngine:42},{TAKO_BOT_ENGINE_DEFAULT:'boh'})).toBe('haiku')
 })
 it('engineKey: haiku → ANTHROPIC_API_KEY, groq → GROQ_API_KEY',()=>{
  const env={ANTHROPIC_API_KEY:'a',GROQ_API_KEY:'g'};expect(engineKey('haiku',env)).toBe('a');expect(engineKey('groq',env)).toBe('g');expect(engineKey('haiku',{GROQ_API_KEY:'g'})).toBe('')
 })
 it('readBotEngine/readBotSettings: una query; errore DB → cervello spento e motore di default',async()=>{
  let q=0;const tx={execute:async()=>{q++;return [{settings:{botBrain:true,botEngine:'groq'}}]}}
  expect(await readBotSettings(tx as any,'r')).toEqual({brain:true,engine:'groq'});expect(q).toBe(1)
  delete process.env.TAKO_BOT_ENGINE_DEFAULT;expect(await readBotEngine({execute:async()=>{throw new Error('db')}} as any,'r')).toBe('haiku')
  process.env.TAKO_BOT_ENGINE_DEFAULT='groq';expect(await readBotSettings({execute:async()=>[{settings:{botBrain:true}}]} as any,'r')).toEqual({brain:true,engine:'groq'})
 })
 it('botEnginePatch scrive settings.botEngine',()=>{
  const q=botEnginePatch('haiku') as any,text=JSON.stringify(q.queryChunks??q);expect(text).toContain('botEngine');expect(text).toContain('haiku')
 })
})

describe('T4b: correzioni dalla prova playground (validatore del server)',()=>{
 it('(1) prezzo uguale all\'attuale / già esaurito → nessuna scrittura, si dice com\'è già',async()=>{
  const {noopFacts}=await import('../apps/server/src/lib/owner-brain-r.js')
  const coca=refs.find(r=>r.name==='Coca Cola')!,carbo=refs.find(r=>r.name==='Spaghetti alla carbonara')!
  const acts=[{kind:'price',id:coca.id,price:coca.price},{kind:'available',id:carbo.id,value:true}] as any[]
  expect(noopFacts(acts,[],refs)).toBe('*Coca Cola* è già a *3,50 €*.\n*Spaghetti alla carbonara* è già disponibile.')
  const change={kind:'price',id:carbo.id,price:13} as any;expect(noopFacts([acts[0],change],[change],refs)).toBe('*Coca Cola* è già a *3,50 €*.')
  expect(noopFacts([change],[change],refs)).toBe('')
 })
 it('(3) intero sottomenu o menu nascosto piatto per piatto → riconosciuto, conferma con riepilogo',async()=>{
  const {wholeGroup,wholeGroupText}=await import('../apps/server/src/lib/owner-brain-r.js')
  const dolci=refs.filter(r=>sections.find(s=>s.id===r.sectionId)?.name==='Dolci')
  const w=wholeGroup(dolci.map(r=>({kind:'hidden',id:r.id,value:true})) as any,refs,sections)
  expect(w).toEqual({kind:'hidden',label:'tutto il sottomenu Dolci',count:dolci.length})
  expect(wholeGroupText(w!)).toBe('Nascondo *tutto il sottomenu Dolci* ('+dolci.length+' piatti)? Rispondi *sì*. Non ho ancora cambiato nulla.')
  // un piatto già nascosto conta come coperto
  const refs2=refs.map(r=>r.id===dolci[0]!.id?{...r,hidden:true}:r);expect(wholeGroup(dolci.slice(1).map(r=>({kind:'hidden',id:r.id,value:true})) as any,refs2,sections)?.count).toBe(dolci.length-1)
  // menu intero (multi-menu): «nascondi tutta la cena»
  const cena=refs.slice(0,4).map(r=>({...r,menu:'Cena'})),pranzo=refs.slice(4,8).map(r=>({...r,menu:'Pranzo'}))
  expect(wholeGroup(cena.map(r=>({kind:'hidden',id:r.id,value:true})) as any,[...cena,...pranzo],[])?.label).toBe('tutto il Menu Cena')
  // parte del sottomenu, azioni miste o meno di 3: niente
  expect(wholeGroup(dolci.slice(0,2).map(r=>({kind:'hidden',id:r.id,value:true})) as any,refs,sections)).toBeNull()
  expect(wholeGroup([...dolci.map(r=>({kind:'hidden',id:r.id,value:true})),{kind:'price',id:dolci[0]!.id,price:9}] as any,refs,sections)).toBeNull()
  expect(wholeGroup(dolci.map(r=>({kind:'delete',id:r.id})) as any,refs,sections)?.kind).toBe('delete')
 })
})

describe('T3: menu intero su Haiku (stesso estrattore, nessuna chiamata Groq)',()=>{
 it('extractFullMenu con haikuFullMenuFetcher: richiesta tradotta in /v1/messages, righe verificate come prima',async()=>{
  const {extractFullMenu,haikuFullMenuFetcher}=await import('../apps/server/src/lib/menu-full-extract.js')
  const text='menu di oggi: primi carbonara 10, amatriciana 9; secondi tagliata 16'
  const rows=[{section:'primi',name:'carbonara',price:10,description:'',evidence:'carbonara 10'},{section:'primi',name:'amatriciana',price:9,description:'',evidence:'amatriciana 9'},{section:'secondi',name:'tagliata',price:16,description:'',evidence:'tagliata 16'}]
  const g=fake((_n,body)=>anthropicReply('```json\n'+JSON.stringify({rows})+'\n```',{usage:{input_tokens:900,output_tokens:200}}))
  const out=await extractFullMenu(text,'chiave-anthropic',haikuFullMenuFetcher(()=>g.fetch as any))
  expect(g.calls.length).toBeGreaterThanOrEqual(1);expect(g.calls.every(c=>c.url===ANTHROPIC_URL)).toBe(true)
  const b=g.calls[0]!.body;expect(b.model).toBe(HAIKU_MODEL);expect(b.output_config.effort).toBe('low');for(const k of ['temperature','response_format','max_completion_tokens'])expect(b).not.toHaveProperty(k)
  expect(g.calls[0]!.headers['x-api-key']).toBe('chiave-anthropic');expect(b.messages[0].role).toBe('user');expect(b.messages[0].content).toContain('carbonara 10')
  expect(out.rows.map(r=>[r.name.toLowerCase(),r.price])).toEqual([['carbonara',10],['amatriciana',9],['tagliata',16]])
 })
 it('429/529 → OnboardingBusy (copy.busy), rifiuto → errore del servizio',async()=>{
  const {extractFullMenu,haikuFullMenuFetcher}=await import('../apps/server/src/lib/menu-full-extract.js')
  const prev=process.env.TAKO_ONBOARDING_BUSY_WAIT_MS;process.env.TAKO_ONBOARDING_BUSY_WAIT_MS='0'
  try{const busy=await extractFullMenu('primi carbonara 10','k',haikuFullMenuFetcher(()=>fake(()=>new Response('',{status:529})).fetch as any)).catch(e=>e);expect(busy?.name).toBe('OnboardingBusy')
   const refused=await extractFullMenu('primi carbonara 10','k',haikuFullMenuFetcher(()=>fake(()=>anthropicReply('',{stop:'refusal'})).fetch as any)).catch(e=>e);expect(refused).toBeInstanceOf(Error);expect(refused?.name).not.toBe('OnboardingBusy')}
  finally{if(prev===undefined)delete process.env.TAKO_ONBOARDING_BUSY_WAIT_MS;else process.env.TAKO_ONBOARDING_BUSY_WAIT_MS=prev}
 })
})
