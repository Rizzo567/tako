// Cervello del bot titolare (perimetro N, fase 1): contesto, piano+validatore, memoria, interruttore, adattatore banco. Groq finto.
import{describe,it,expect}from'vitest'
import{buildBrainContext,compactMenu,activeMemory,recentHistory,GENERAL_CARD,HISTORY_TTL_MS,type BrainMemoryEntry}from'../apps/server/src/lib/owner-brain-context.js'
import{planOwnerMessage,validateBrainPlan,callBrain,composeReply,draftIsSafe,verifyApplied,BRAIN_SCHEMA,BrainUnavailable}from'../apps/server/src/lib/owner-brain-plan.js'
import{consolidate,memoryBrainStore,aliasProblem,memoryCommand,forget,reconcile,signalsFromTurn,memoryListText,type MemoryRow}from'../apps/server/src/lib/owner-brain-memory.js'
import{botBrainEnabled}from'../apps/server/src/lib/owner-brain-switch.js'
import{createBrainEvalBot,catalogOf}from'../apps/server/src/lib/owner-brain-eval.js'
import{typicalWorkspace,largeWorkspace}from'./owner-brain-fixture.js'

const W=typicalWorkspace(),{refs,sections}=catalogOf(W),id=(name:string)=>refs.find(r=>r.name===name)!.id
const ctx0=buildBrainContext({refs,sections,message:'x'}),code=(name:string)=>ctx0.codeOf.get(id(name))!
const NOW=Date.UTC(2026,9,17,12,0,0)
const blankAction={action:'set_price',item:null,section:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}
const out=(o:any)=>JSON.stringify({intent:'change',actions:[],read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},alias_used:[],reply_draft:'',...o,...(o.actions?{actions:o.actions.map((a:any)=>({...blankAction,...a}))}:{})})
const groqReply=(content:string,usage={prompt_tokens:3000,completion_tokens:200,prompt_tokens_details:{cached_tokens:2048}})=>new Response(JSON.stringify({choices:[{message:{content}}],usage}),{status:200,headers:{'content-type':'application/json'}})
function fakeGroq(script:(body:any,n:number)=>Response|Promise<Response>){const calls:any[]=[];const f=async(_u:string,init:RequestInit)=>{const body=JSON.parse(String(init.body));calls.push(body);return script(body,calls.length)};return{fetch:f,calls}}
const plan=(message:string,content:string,extra:any={})=>validateBrainPlan(content,ctx0,{refs,sections,message,...extra})

describe('owner-brain-context',()=>{
 it('ordine fisso: scheda generale → scheda ristoratore → cronologia → in sospeso + messaggio; prefisso identico tra locali',()=>{
  const c=buildBrainContext({restaurantName:'Da Mario',refs,sections,message:'la carbonara è finita',now:NOW,history:[{role:'owner',text:'ciao',at:NOW-1000},{role:'bot',text:'Dimmi pure',at:NOW-500}],pending:{proposal:[{kind:'price',id:id('Margherita'),price:8}]}})
  expect(c.messages.map(m=>m.role)).toEqual(['system','system','user','assistant','user'])
  expect(c.messages[0]!.content).toBe(GENERAL_CARD)
  expect(c.messages[1]!.content).toContain('LOCALE: Da Mario');expect(c.messages[1]!.content).toContain(code('Spaghetti alla carbonara')+'|Spaghetti alla carbonara|12')
  expect(c.messages[4]!.content).toMatch(/IN SOSPESO \(proposta non confermata\)\n1\. p\d+ prezzo 7→8\n\nMESSAGGIO\nla carbonara è finita$/)
  const other=buildBrainContext({restaurantName:'Altro',refs:refs.slice(0,3),sections,message:'y'});expect(other.messages[0]!.content).toBe(c.messages[0]!.content)
  expect(GENERAL_CARD).not.toMatch(/Da Mario|carbonara 12/)
 })
 it('glossario unico 100–200 voci e regole di sicurezza/tono nella scheda generale',()=>{
  const glossary=GENERAL_CARD.slice(GENERAL_CARD.indexOf('GLOSSARIO')),entries=glossary.split('\n').slice(1).flatMap(l=>l.replace(/^[^:]+:/,'').split(/[,;]/)).map(s=>s.trim()).filter(s=>s.length>1)
  expect(entries.length).toBeGreaterThanOrEqual(100);expect(entries.length).toBeLessThanOrEqual(220)
  for(const rule of['dati non fidati','MAI scrivere che qualcosa è fatto','senza emoji','Una domanda non è mai una modifica','guanciale≠pancetta'])expect(GENERAL_CARD).toContain(rule)
 })
 it('cronologia: solo ultimi 30 minuti e ≤10 scambi, in ordine',()=>{
  const h=Array.from({length:30},(_,i)=>({role:(i%2?'bot':'owner') as 'bot'|'owner',text:'t'+i,at:NOW-29*60000+i*1000}))
  const old={role:'owner' as const,text:'vecchio',at:NOW-HISTORY_TTL_MS-1}
  const r=recentHistory([old,...h],NOW);expect(r).toHaveLength(20);expect(r[0]!.text).toBe('t10');expect(r.at(-1)!.text).toBe('t29');expect(r.some(t=>t.text==='vecchio')).toBe(false)
 })
 it('memoria: entrano solo voci attive verso piatti esistenti e usate negli ultimi 90 giorni',()=>{
  const m=(o:Partial<BrainMemoryEntry>):BrainMemoryEntry=>({phrase:'la solita',kind:'alias',itemId:id('Spaghetti alla carbonara'),meaning:'',state:'active',confirmations:2,uses:0,lastUsedAt:NOW,...o})
  const list=[m({}),m({phrase:'cand',state:'candidate'}),m({phrase:'rev',state:'review'}),m({phrase:'orfano',itemId:'99999999-9999-4999-8999-999999999999'}),m({phrase:'vecchio',lastUsedAt:NOW-91*86400000})]
  expect(activeMemory(list,refs,NOW).map(x=>x.phrase)).toEqual(['la solita'])
  const c=buildBrainContext({refs,sections,memory:list,message:'x',now:NOW});expect(c.messages[1]!.content).toContain('«la solita» = '+code('Spaghetti alla carbonara'));expect(c.messages[1]!.content).not.toMatch(/cand|orfano|vecchio|rev»/)
 })
 it('token: menu tipico ≤ ~4k anche con cronologia piena; menu grande 300+ compresso senza perdere nomi',()=>{
  const history=Array.from({length:20},(_,i)=>({role:(i%2?'bot':'owner') as 'bot'|'owner',text:'Quale piatto intendi? Tagliata di manzo o Tagliata di tonno?',at:NOW-60000+i}))
  expect(buildBrainContext({refs,sections,message:'la carbonara è finita',now:NOW}).tokens.total).toBeLessThanOrEqual(3800)
  expect(buildBrainContext({refs,sections,history,message:'la carbonara è finita',now:NOW}).tokens.total).toBeLessThanOrEqual(4400)
  const big=catalogOf(largeWorkspace(320)),c=buildBrainContext({refs:big.refs,sections:big.sections,message:'x',now:NOW})
  expect(big.refs.length).toBeGreaterThanOrEqual(300);expect(c.compression).toBeGreaterThan(0);expect(c.codes.size).toBe(big.refs.length+big.sections.length)
  const text=c.messages[1]!.content;for(const r of big.refs){const first=r.name.split(' ')[0]!,rest=r.name.slice(first.length+1);expect(text.includes(r.name)||(text.includes(first+'… ')&&text.includes(rest))).toBe(true)}
  expect(c.tokens.total).toBeLessThan(7000)
 })
 it('flag di stato, etichette e categorie con menu multipli',()=>{
  const r2=refs.map((r,i)=>i===0?{...r,available:false,hidden:true,featured:true,tags:['vegetariano']}:r)
  expect(compactMenu(r2,sections,0).text).toContain('|xh* [veg]');expect(compactMenu(r2,sections,1).text).not.toContain('[veg]')
 })
})

describe('owner-brain-plan: validatore',()=>{
 it('codici → id; risultato identico al percorso attuale (MenuPlan)',()=>{
  const r=plan('la carbonara è finita e la margherita costa 8',out({actions:[{action:'set_available',item:code('Spaghetti alla carbonara'),value:false},{action:'set_price',item:code('Margherita'),price:8}]}))
  expect(r.plan).toEqual({type:'change',actions:[{kind:'available',id:id('Spaghetti alla carbonara'),value:false},{kind:'price',id:id('Margherita'),price:8}]})
 })
 it('«stesso prezzo di X»: il server rilegge il prezzo vero (o quello nuovo detto nello stesso messaggio)',()=>{
  const a=plan('metti la amatriciana allo stesso prezzo della cacio e pepe',out({actions:[{action:'set_price',item:code("Bucatini all'amatriciana"),price_ref:code('Cacio e pepe')}]}))
  expect(a.plan).toEqual({type:'change',actions:[{kind:'price',id:id("Bucatini all'amatriciana"),price:11}]})
  const b=plan('la cacio e pepe a 13 e la amatriciana allo stesso prezzo',out({actions:[{action:'set_price',item:code('Cacio e pepe'),price:13},{action:'set_price',item:code("Bucatini all'amatriciana"),price_ref:code('Cacio e pepe')}]}))
  expect(b.plan).toEqual({type:'change',actions:[{kind:'price',id:id('Cacio e pepe'),price:13},{kind:'price',id:id("Bucatini all'amatriciana"),price:13}]})
  // Senza parole di riferimento o con un piatto di riferimento mai nominato → chiarimento, zero scritture.
  expect(plan('metti la amatriciana a posto',out({actions:[{action:'set_price',item:code("Bucatini all'amatriciana"),price_ref:code('Cacio e pepe')}]})).plan.type).toBe('clarify')
  expect(plan('la amatriciana allo stesso prezzo',out({actions:[{action:'set_price',item:code("Bucatini all'amatriciana"),price_ref:code('Tiramisù')}]})).plan.type).toBe('clarify')
  // Un piatto nominato e non toccato (né riferimento) rende la richiesta incompleta, come nel validatore attuale.
  expect(plan('amatriciana allo stesso prezzo della cacio e pepe e la marinara',out({actions:[{action:'set_price',item:code("Bucatini all'amatriciana"),price_ref:code('Cacio e pepe')}]})).plan).toMatchObject({type:'clarify',ids:[id('Marinara')]})
 })
 it('«aumenta di N»: delta sul prezzo attuale, verificato dal G9; senza verbo → chiarimento',()=>{
  expect(plan('aumenta la diavola di un euro',out({actions:[{action:'set_price',item:code('Diavola'),price_delta:1}]})).plan).toEqual({type:'change',actions:[{kind:'price',id:id('Diavola'),price:9.5}]})
  expect(plan('la diavola',out({actions:[{action:'set_price',item:code('Diavola'),price_delta:1}]})).plan.type).toBe('clarify')
  expect(plan('abbassa la diavola di 2',out({actions:[{action:'set_price',item:code('Diavola'),price_delta:-3}]})).plan.type).toBe('clarify')
 })
 it('regole attuali riusate: G9 piatto non nominato, prezzo mai detto, azione sconosciuta, codici inventati',()=>{
  expect(plan('la margherita è finita',out({actions:[{action:'set_available',item:code('Diavola'),value:false}]})).plan.type).toBe('clarify')
  expect(plan('la margherita costa 8',out({actions:[{action:'set_price',item:code('Margherita'),price:9}]})).plan.type).toBe('clarify')
  expect(plan('cancella la margherita',out({actions:[{action:'delete',item:code('Margherita')}]})).plan.type).toBe('clarify')
  expect(plan('la margherita è finita',out({actions:[{action:'set_available',item:'p999',value:false}]})).plan.type).toBe('clarify')
  expect(plan('ciao','non json').notes).toContain('json_non_oggetto')
 })
 it('domande = zero scritture, anche se il modello propone una modifica',()=>{
  for(const m of['quanto costa la margherita?','la margherita 8 o 9?','la margherita tra 8 e 9','la margherita è finita?']){const r=plan(m,out({actions:[{action:'set_price',item:code('Margherita'),price:8}]}));expect(r.plan.type,m).not.toBe('change')}
  // Comando cortese con punto di domanda resta un comando (stessa regola del bot attuale).
  expect(plan('puoi mettere la margherita a 8?',out({actions:[{action:'set_price',item:code('Margherita'),price:8}]})).plan.type).toBe('change')
 })
 it('negazioni: il piatto negato è escluso e non rende ambiguo il resto',()=>{
  const r=plan('non cambiare la margherita; la diavola costa 9',out({actions:[{action:'set_price',item:code('Diavola'),price:9}]}))
  expect(r.plan).toEqual({type:'change',actions:[{kind:'price',id:id('Diavola'),price:9}]});expect(r.exclude.map(e=>e.id)).toContain(id('Margherita'))
  const s=plan('non cambiare la margherita; la diavola costa 9',out({actions:[{action:'set_price',item:code('Diavola'),price:9},{action:'set_price',item:code('Margherita'),price:9}]}))
  expect(s.plan.type==='change'&&s.plan.actions.some(a=>'id' in a&&a.id===id('Margherita'))).toBe(false)
 })
 it('memoria attiva: «la solita» conta come piatto nominato; senza memoria è un chiarimento',()=>{
  const memory:BrainMemoryEntry[]=[{phrase:'la solita',kind:'alias',itemId:id('Spaghetti alla carbonara'),meaning:'',state:'active',confirmations:2,uses:0,lastUsedAt:NOW}]
  const content=out({actions:[{action:'set_available',item:code('Spaghetti alla carbonara'),value:false}]})
  expect(plan('la solita è finita',content,{memory}).plan.type).toBe('change')
  expect(plan('la solita è finita',content).plan.type).toBe('clarify')
  expect(plan('la solita è finita',content,{memory:[{...memory[0]!,state:'candidate'}]}).plan.type).toBe('clarify')
 })
 it('alias riportati solo se la frase è nel messaggio (o in quello del chiarimento) e il piatto esiste',()=>{
  const r=plan('la carbo è finita',out({actions:[{action:'set_available',item:code('Spaghetti alla carbonara'),value:false}],alias_used:[{phrase:'carbo',item:code('Spaghetti alla carbonara')},{phrase:'inventata',item:code('Margherita')},{phrase:'carbo',item:'p999'}]}))
  expect(r.aliasesUsed).toEqual([{phrase:'carbo',itemId:id('Spaghetti alla carbonara')}])
  const s=plan('la carbonara',out({intent:'change',actions:[{action:'set_available',item:code('Spaghetti alla carbonara'),value:false}],alias_used:[{phrase:'la solita',item:code('Spaghetti alla carbonara')}]}),{clarifySource:'la solita è finita',memory:[]})
  expect(s.aliasesUsed).toEqual([{phrase:'la solita',itemId:id('Spaghetti alla carbonara')}])
 })
 it('piatti indicati allo stesso modo: il modello non sceglie lui (tagliata di manzo/tonno)',()=>{
  const manzo=id('Tagliata di manzo'),tonno=id('Tagliata di tonno')
  expect(plan('la tagliata a 21',out({actions:[{action:'set_price',item:code('Tagliata di manzo'),price:21}]})).plan).toMatchObject({type:'clarify',ids:[manzo,tonno],actions:[{kind:'price',id:manzo,price:21}]})
  expect(plan('quanto costa la tagliata?',out({intent:'read',read:'items',item_refs:[code('Tagliata di manzo')]})).plan).toEqual({type:'clarify',ids:[manzo,tonno]})
  expect(plan('quella di tonno, a 21',out({actions:[{action:'set_price',item:code('Tagliata di tonno'),price:21}]})).plan).toEqual({type:'change',actions:[{kind:'price',id:tonno,price:21}]})
  expect(plan('la tagliata di manzo a 21',out({actions:[{action:'set_price',item:code('Tagliata di manzo'),price:21}]})).plan.type).toBe('change')
  expect(plan('acqua frizzante finita',out({actions:[{action:'set_available',item:code('Acqua frizzante'),value:false}]})).plan.type).toBe('change')
  const big=catalogOf(largeWorkspace(320)),bctx=buildBrainContext({refs:big.refs,sections:big.sections,message:'x'}),lv=big.refs.find(r=>r.name==='Linguine alle vongole')!
  expect(validateBrainPlan(out({actions:[{action:'set_price',item:bctx.codeOf.get(lv.id),price:15}]}),bctx,{refs:big.refs,sections:big.sections,message:'le linguine alle vongole costano 15'}).plan.type).toBe('change')
 })
 it('read / clarify / capability / chat',()=>{
  expect(plan('la tagliata di manzo c\'è?',out({intent:'read',read:'items',item_refs:[code('Tagliata di manzo')]})).plan).toEqual({type:'read',read:'items',ids:[id('Tagliata di manzo')]})
  expect(plan('cosa è finito?',out({intent:'read',read:'unavailable'})).plan).toEqual({type:'read',read:'unavailable'})
  const c=plan('la tagliata a 21',out({intent:'clarify',clarify:{question:'Quale tagliata?',item_refs:[code('Tagliata di manzo'),code('Tagliata di tonno')],missing:[]}}))
  expect(c.plan).toEqual({type:'clarify',ids:[id('Tagliata di manzo'),id('Tagliata di tonno')]});expect(c.replyDraft).toBe('Quale tagliata?')
  expect(plan('puoi cancellare un piatto?',out({intent:'capability',capability_ids:['delete','inventato']})).plan.type).toBe('capability')
  expect(plan('grazie',out({intent:'chat',reply_draft:'Di nulla!'})).plan).toEqual({type:'clarify',ids:[]})
 })
})

describe('owner-brain-plan: chiamata e riserva',()=>{
 it('una chiamata JSON strict con lo schema e i messaggi del contesto',async()=>{
  const g=fakeGroq(()=>groqReply(out({actions:[{action:'set_available',item:code('Margherita'),value:false}]})))
  const r=await planOwnerMessage({refs,sections,message:'la margherita è finita',now:NOW},'k',{fetch:g.fetch})
  expect(g.calls).toHaveLength(1);expect(g.calls[0].response_format).toEqual({type:'json_schema',json_schema:BRAIN_SCHEMA});expect(BRAIN_SCHEMA.strict).toBe(true)
  expect(g.calls[0].model).toBe('openai/gpt-oss-120b');expect(g.calls[0].messages[0].content).toBe(GENERAL_CARD)
  expect(r.path).toBe('brain');if(r.path==='brain'){expect(r.plan).toEqual({type:'change',actions:[{kind:'available',id:id('Margherita'),value:false}]});expect(r.usage).toMatchObject({prompt:3000,completion:200,cached:2048})}
 })
 it('schema strict: ogni proprietà è required e additionalProperties=false (requisito Groq)',()=>{
  const walk=(s:any)=>{if(s?.type==='object'||(Array.isArray(s?.type)&&s.type.includes('object'))){expect(s.additionalProperties).toBe(false);expect([...s.required].sort()).toEqual(Object.keys(s.properties).sort());Object.values(s.properties).forEach(walk)}if(s?.items)walk(s.items)};walk(BRAIN_SCHEMA.schema)
 })
 it('Groq giù / quota / JSON invalido / senza chiave → riserva deterministica, mai eccezioni',async()=>{
  const fail=async(script:(b:any,n:number)=>Response,opts:any={})=>{const g=fakeGroq(script);return{r:await planOwnerMessage({refs,sections,message:'la margherita è finita',now:NOW},'k',{fetch:g.fetch,sleep:async()=>{},...opts}),g}}
  expect((await fail(()=>new Response('x',{status:500}))).r).toMatchObject({path:'fallback',reason:'http'})
  const busy=await fail(()=>new Response('',{status:429,headers:{'retry-after':'60'}}),{budgetMs:1000});expect(busy.r).toMatchObject({path:'fallback',reason:'busy'})
  const bad=await fail(()=>new Response(JSON.stringify({error:{code:'json_validate_failed'}}),{status:400}));expect(bad.r).toMatchObject({path:'fallback',reason:'invalid_json'});expect(bad.g.calls.map(c=>c.model)).toEqual(['openai/gpt-oss-120b','openai/gpt-oss-20b'])
  expect((await fail(()=>groqReply('non è json'))).r).toMatchObject({path:'fallback',reason:'invalid_json'})
  expect((await fail(()=>{throw Object.assign(new Error('t'),{name:'TimeoutError'})})).r).toMatchObject({path:'fallback',reason:'timeout'})
  expect(await planOwnerMessage({refs,sections,message:'x'},'')).toMatchObject({path:'fallback',reason:'no_key'})
 })
 it('429 sul modello principale → riserva sul secondo modello',async()=>{
  const g=fakeGroq(b=>b.model==='openai/gpt-oss-120b'?new Response('',{status:429,headers:{'retry-after':'30'}}):groqReply(out({actions:[{action:'set_available',item:code('Margherita'),value:false}]})))
  const r=await planOwnerMessage({refs,sections,message:'la margherita è finita',now:NOW},'k',{fetch:g.fetch,sleep:async()=>{}});expect(r.path).toBe('brain');if(r.path==='brain')expect(r.usage.model).toBe('openai/gpt-oss-20b')
 })
 it('callBrain lancia BrainUnavailable (il route non vede mai errori grezzi)',async()=>{
  await expect(callBrain(ctx0,'k',{fetch:async()=>new Response('',{status:503}),sleep:async()=>{}})).rejects.toBeInstanceOf(BrainUnavailable)
 })
})

describe('owner-brain-plan: risposta con i fatti dal DB',()=>{
 it('change: solo azioni verificate sullo stato riletto; mai «fatto» senza riga scritta',()=>{
  const act=[{kind:'price' as const,id:id('Margherita'),price:8},{kind:'available' as const,id:id('Diavola'),value:false}]
  const after=refs.map(r=>r.id===id('Margherita')?{...r,price:8}:r)
  expect(verifyApplied(act,after)).toEqual({ok:[act[0]],failed:[act[1]]})
  const text=composeReply({intent:'change',plan:{type:'change',actions:act},replyDraft:'Fatto tutto!'},refs,sections,after)
  expect(text).toContain('Margherita');expect(text).toContain('8,00 €');expect(text).toContain('non è stata salvata');expect(text).not.toContain('Fatto tutto')
  expect(composeReply({intent:'change',plan:{type:'change',actions:act},replyDraft:''},refs,sections,refs)).toMatch(/Non sono riuscito a salvare/)
  expect(()=>composeReply({intent:'change',plan:{type:'change',actions:act},replyDraft:''},refs,sections)).toThrow()
 })
 it('bozze del modello: passano solo senza esiti né prezzi',()=>{
  for(const bad of['Fatto, ho aggiornato la carbonara','Ho messo la margherita a 8 €','La diavola ora costa 9 euro','*Ok*'])expect(draftIsSafe(bad),bad).toBe(false)
  expect(draftIsSafe('Quale tagliata intendi?')).toBe(true)
  expect(composeReply({intent:'chat',plan:{type:'clarify',ids:[]},replyDraft:'Ho aggiornato tutto'},refs,sections)).toBe('Dimmi pure cosa vuoi cambiare nel menu.')
  expect(composeReply({intent:'chat',plan:{type:'clarify',ids:[]},replyDraft:'Di nulla, buon servizio.'},refs,sections)).toBe('Di nulla, buon servizio.')
  expect(composeReply({intent:'clarify',plan:{type:'clarify',ids:[id('Tagliata di manzo'),id('Tagliata di tonno')]},replyDraft:'Quale tagliata intendi?'},refs,sections)).toBe('Quale tagliata intendi?\n• *Tagliata di manzo*\n• *Tagliata di tonno*')
 })
})

describe('owner-brain-memory',()=>{
 const R='11111111-1111-4111-8111-111111111111',carb=id('Spaghetti alla carbonara')
 const yes=async()=>({useful:true,kind:'alias' as const})
 it('aliasProblem: solo verso piatti esistenti, niente collisioni, numeri, verbi, parole vuote',()=>{
  expect(aliasProblem('la solita',carb,refs,sections)).toBeNull()
  expect(aliasProblem('x',carb,refs)).toBe('lunghezza');expect(aliasProblem('la 12',carb,refs)).toBe('numeri');expect(aliasProblem('metti la',carb,refs)).toBe('verbi')
  expect(aliasProblem('quella',carb,refs)).toBe('parole_vuote');expect(aliasProblem('il piatto',carb,refs)).toBe('parole_vuote')
  expect(aliasProblem('tagliata',id('Tagliata di manzo'),refs)).toBe('collisione_piatto');expect(aliasProblem('pizze',carb,refs,sections)).toBe('collisione_categoria')
  expect(aliasProblem('la solita','99999999-9999-4999-8999-999999999999',refs)).toBe('piatto_inesistente');expect(aliasProblem('margherita',id('Margherita'),refs)).toBe('uguale_al_nome')
 })
 it('candidato → attivo dopo 2 conferme; log append-only senza messaggi',async()=>{
  const s=memoryBrainStore();let judged=0;const judge=async()=>{judged++;return{useful:true,kind:'alias' as const}}
  await consolidate(s,R,[{kind:'clarify_answer',phrase:'la solita',itemId:carb}],{refs,sections,judge,now:NOW})
  let rows=await s.listMemory(R);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({phrase:'la solita',state:'candidate',confirmations:1,origin:'clarify'})
  await consolidate(s,R,[{kind:'summary_confirm',phrase:'La solita',itemId:carb}],{refs,sections,judge,now:NOW+1})
  rows=await s.listMemory(R);expect(rows[0]).toMatchObject({state:'active',confirmations:2});expect(judged).toBe(1)
  expect(s.logs.map(l=>l.op)).toEqual(['create','confirm','promote']);expect(JSON.stringify(s.logs)).not.toMatch(/è finita/)
 })
 it('3 usi coerenti promuovono; il giudice LLM decide solo le voci nuove non già capite dal G9',async()=>{
  const s=memoryBrainStore();let judged=0;const judge=async()=>{judged++;return{useful:true,kind:'alias' as const}}
  await consolidate(s,R,[{kind:'clarify_answer',phrase:'carbo',itemId:carb}],{refs,sections,judge,now:NOW});expect(judged).toBe(0);expect(await s.listMemory(R)).toHaveLength(0)
  await consolidate(s,R,[{kind:'clarify_answer',phrase:'la solita',itemId:carb}],{refs,sections,judge,now:NOW})
  for(let i=0;i<3;i++)await consolidate(s,R,[{kind:'use',phrase:'la solita',itemId:carb}],{refs,sections,judge,now:NOW+i})
  expect((await s.listMemory(R))[0]).toMatchObject({state:'active',uses:3});expect(judged).toBe(1)
 })
 it('giudice «non serve» o assente → niente memoria, rifiuto registrato',async()=>{
  const s=memoryBrainStore()
  await consolidate(s,R,[{kind:'clarify_answer',phrase:'quella buona',itemId:carb}],{refs,sections,judge:async()=>({useful:false,kind:'alias'}),now:NOW})
  await consolidate(s,R,[{kind:'clarify_answer',phrase:'la solita',itemId:carb}],{refs,sections,judge:async()=>{throw new Error('groq giù')},now:NOW})
  expect(await s.listMemory(R)).toHaveLength(0);expect(s.logs.map(l=>[l.op,l.detail?.motivo])).toEqual([['reject','giudice_no'],['reject','giudice_assente']])
 })
 it('correzione e annulla mettono in revisione; conflitto tra due piatti → revisione',async()=>{
  const s=memoryBrainStore(),manzo=id('Tagliata di manzo'),tonno=id('Tagliata di tonno')
  await consolidate(s,R,[{kind:'clarify_answer',phrase:'la solita',itemId:carb},{kind:'summary_confirm',phrase:'la solita',itemId:carb}],{refs,sections,judge:yes,now:NOW})
  await consolidate(s,R,[{kind:'undo',phrase:'la solita',itemId:carb}],{refs,sections,judge:yes,now:NOW+1});expect((await s.listMemory(R))[0]!.state).toBe('review')
  await consolidate(s,R,[{kind:'clarify_answer',phrase:'quella grossa',itemId:manzo}],{refs,sections,judge:yes,now:NOW})
  await consolidate(s,R,[{kind:'correction',phrase:'quella grossa',wrongItemId:manzo,itemId:tonno}],{refs,sections,judge:yes,now:NOW+2})
  const rows=await s.listMemory(R);expect(rows.find(r=>r.itemId===manzo)!.state).toBe('review');expect(rows.find(r=>r.itemId===tonno)).toMatchObject({phrase:'quella grossa',origin:'correction'})
  // Una voce in revisione non si usa mai nel contesto.
  expect(activeMemory(rows,refs,NOW).length).toBe(0)
 })
 it('«dimentica X» e «cosa hai imparato?»',async()=>{
  expect(memoryCommand('dimentica la solita')).toEqual({kind:'forget',phrase:'la solita'});expect(memoryCommand('Scordati la parola carbo')).toEqual({kind:'forget',phrase:'carbo'})
  expect(memoryCommand('cosa hai imparato?')).toEqual({kind:'list'});expect(memoryCommand('la carbonara è finita')).toBeNull()
  const s=memoryBrainStore();await consolidate(s,R,[{kind:'clarify_answer',phrase:'la solita',itemId:carb}],{refs,sections,judge:yes,now:NOW})
  expect(memoryListText(await s.listMemory(R),refs)).toContain('«la solita» = *Spaghetti alla carbonara* (da confermare)')
  expect(await forget(s,R,'la solita')).toBe(1);expect(await s.listMemory(R)).toHaveLength(0);expect(s.logs.at(-1)!.op).toBe('forget')
 })
 it('piatto eliminato → voce cancellata; rinominato → significato aggiornato o alias inutile cancellato',async()=>{
  const s=memoryBrainStore(),mk=(phrase:string,itemId:string):MemoryRow=>({id:crypto.randomUUID(),restaurantId:R,phrase,kind:'alias',itemId,meaning:'Vecchio',state:'active',confirmations:2,uses:0,lastUsedAt:NOW,origin:'clarify',createdAt:NOW,updatedAt:NOW})
  await s.saveMemory(mk('la solita',carb));await s.saveMemory(mk('la rossa',id('Diavola')));await s.saveMemory(mk('la regina',id('Margherita')))
  const renamed=refs.filter(r=>r.id!==id('Diavola')).map(r=>r.id===id('Margherita')?{...r,name:'La regina'}:r)
  expect(await reconcile(s,R,renamed)).toBe(3)
  const rows=await s.listMemory(R);expect(rows.map(r=>r.phrase)).toEqual(['la solita']);expect(rows[0]!.meaning).toBe('Spaghetti alla carbonara')
  expect(s.logs.map(l=>l.op).sort()).toEqual(['orphan','rename','rename'])
 })
 it('cronologia nello store: TTL 30 minuti e massimo 10 scambi',async()=>{
  const s=memoryBrainStore()
  for(let i=0;i<15;i++)await s.appendHistory(R,'+39',[{role:'owner',text:'m'+i,at:NOW+i*2},{role:'bot',text:'r'+i,at:NOW+i*2+1}],NOW+i*2+1)
  expect(s.turns).toHaveLength(20);expect((await s.readHistory(R,'+39',NOW+40))[0]!.text).toBe('m5')
  await s.appendHistory(R,'+39',[{role:'owner',text:'dopo',at:NOW+HISTORY_TTL_MS+100}],NOW+HISTORY_TTL_MS+100)
  expect(s.turns.map(t=>t.text)).toEqual(['dopo'])
 })
 it('segnali solo certi da un turno concluso',()=>{
  const sig=signalsFromTurn({message:'la carbonara',clarifyIds:[carb,id('Cacio e pepe')],chosenId:carb,applied:[{id:carb}],aliasesUsed:[{phrase:'la solita',itemId:carb}]})
  expect(sig).toEqual([{kind:'clarify_answer',phrase:'la solita',itemId:carb}])
  expect(signalsFromTurn({message:'x',applied:[{id:carb}],aliasesUsed:[{phrase:'carbo',itemId:carb}]})).toEqual([{kind:'use',phrase:'carbo',itemId:carb}])
  expect(signalsFromTurn({message:'x',applied:[],aliasesUsed:[{phrase:'carbo',itemId:carb}]})).toEqual([])
 })
})

describe('owner-brain-switch',()=>{
 it('spento di default; acceso solo con settings.botBrain===true; interruttore di emergenza globale',()=>{
  for(const s of[null,undefined,{},{botBrain:'true'},{botBrain:1},{botBrain:false}])expect(botBrainEnabled(s,{})).toBe(false)
  expect(botBrainEnabled({botBrain:true},{})).toBe(true);expect(botBrainEnabled({botBrain:true},{TAKO_BOT_BRAIN_OFF:'1'})).toBe(false)
 })
})

describe('owner-brain-eval: conversazioni multi-turno con Groq finto',()=>{
 it('chiarimento → risposta breve → scrittura con i fatti dal menu riletto; impara «la solita» al secondo giro',async()=>{
  let step=0;const carb=code('Spaghetti alla carbonara')
  const g=fakeGroq(b=>{step++;const last=b.messages.at(-1).content as string
   if(/MESSAGGIO\nla solita è finita$/.test(last))return groqReply(out({intent:'clarify',clarify:{question:'Quale piatto intendi?',item_refs:[carb,code('Cacio e pepe')],missing:[]}}))
   return groqReply(out({actions:[{action:'set_available',item:carb,value:false}],alias_used:[{phrase:'la solita',item:carb}]}))})
  const bot=createBrainEvalBot({key:'k',restaurantName:'Tako QA',judge:async()=>({useful:true,kind:'alias'}),call:{fetch:g.fetch}})
  let state={workspace:typicalWorkspace(),proposal:null,clarify:null} as any
  let t=await bot.turn(state,'la solita è finita',NOW);expect(t.path).toBe('brain');expect(t.written).toEqual([]);expect(t.reply).toContain('Quale piatto intendi?');state=t.state
  t=await bot.turn(state,'la carbonara',NOW+5000);expect(t.written).toEqual([{kind:'available',id:id('Spaghetti alla carbonara'),value:false}]);expect(t.reply).toMatch(/Confermato/);state=t.state
  expect(catalogOf(state.workspace).refs.find(r=>r.id===id('Spaghetti alla carbonara'))!.available).toBe(false)
  // La cronologia arriva al modello al turno dopo.
  expect(g.calls[1].messages.map((m:any)=>m.role)).toEqual(['system','system','user','assistant','user'])
  const mem=await bot.store.listMemory('00000000-0000-4000-8000-000000000000');expect(mem[0]).toMatchObject({phrase:'la solita',state:'candidate'})
 })
 it('più di 3 azioni o prezzo implausibile → riepilogo da confermare, poi OK scrive',async()=>{
  const g=fakeGroq(()=>groqReply(out({actions:[{action:'set_price',item:code('Margherita'),price:80}]})))
  const bot=createBrainEvalBot({key:'k',call:{fetch:g.fetch}});let state={workspace:typicalWorkspace(),proposal:null,clarify:null} as any
  let t=await bot.turn(state,'la margherita costa 80',NOW);expect(t.written).toEqual([]);expect(t.state.proposal).toHaveLength(1);state=t.state
  t=await bot.turn(state,'ok',NOW+1000);expect(t.path).toBe('confirm');expect(t.written).toHaveLength(1);expect(catalogOf(t.state.workspace).refs.find(r=>r.id===id('Margherita'))!.price).toBe(80)
 })
 it('Groq giù → path=fallback e nessuna scrittura (il runner passa al bot attuale)',async()=>{
  const bot=createBrainEvalBot({key:'k',call:{fetch:async()=>new Response('',{status:503}),sleep:async()=>{}}})
  const t=await bot.turn({workspace:typicalWorkspace(),proposal:null,clarify:null},'la margherita è finita',NOW);expect(t).toMatchObject({path:'fallback',reply:null,written:[]})
 })
 it('domanda in conversazione: zero scritture anche se il modello sbaglia',async()=>{
  const g=fakeGroq(()=>groqReply(out({actions:[{action:'set_price',item:code('Margherita'),price:8}]})))
  const bot=createBrainEvalBot({key:'k',call:{fetch:g.fetch}})
  const t=await bot.turn({workspace:typicalWorkspace(),proposal:null,clarify:null},'la margherita 8 o 9?',NOW);expect(t.written).toEqual([]);expect(t.state.workspace).toEqual(typicalWorkspace())
 })
})

describe('owner-brain-eval: forma BotUnderTest del banco E',()=>{
 it('run(conv) → turni con reply/menuAfter/llm/context; wait e dash gestiti',async()=>{
  const g=fakeGroq(()=>groqReply(out({actions:[{action:'set_available',item:code('Margherita'),value:false}]})))
  const {brainBotUnderTest}=await import('../apps/server/src/lib/owner-brain-eval.js')
  const b=brainBotUnderTest({key:'k',call:{fetch:g.fetch}})
  const run=await b.run({turns:[{text:'la margherita è finita'},{wait:40},{dash:{dish:'Margherita',field:'available',value:true}}]},typicalWorkspace(),{restaurant:'Tako QA'})
  expect(run.turns).toHaveLength(1);expect(run.turns[0]!.llm).toMatchObject({calls:1,tokens:3200,misses:0});expect(run.turns[0]!.context!.history).toHaveLength(2)
  expect(catalogOf(run.turns[0]!.menuAfter).refs.find(r=>r.name==='Margherita')!.available).toBe(false)
  expect(catalogOf(run.finalMenu).refs.find(r=>r.name==='Margherita')!.available).toBe(true)
 })
})
