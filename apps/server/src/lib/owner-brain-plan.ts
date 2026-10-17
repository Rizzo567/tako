/** Cervello del bot titolare (17/10/2026, perimetro N) · UNA chiamata Groq JSON strict + validatore server.
 * Uscita del modello: {intent, actions[], read, item_refs, capability_ids, clarify, alias_used, reply_draft}.
 * Il server: riconverte i codici brevi in id, risolve «stesso prezzo di X» e «aumenta di N» rileggendo il menu,
 * passa tutto alle regole esistenti (validateMenuPlan: G9, piatti non nominati, prezzi detti, negazioni, completezza),
 * forza zero scritture sulle domande e produce un MenuPlan identico a quello del percorso attuale (turnFor lo applica,
 * G6 prezzi implausibili → conferma scritta). I fatti nella risposta li scrive il server DOPO la rilettura (composeReply).
 * Se Groq è giù, la quota è finita, il JSON non è valido o la chiamata è lenta → {path:'fallback'}: il route usa il
 * percorso deterministico attuale, invariato. */
import {chatModels,groqBase,retryAfterMs,GroqBusy,parseJson,validateMenuPlan,describeAction,readText,planText,plain,g9DishMentioned,type GroqOptions,type MenuRef,type SectionRef,type MenuAction,type MenuPlan} from './twilio-menu-ai.js'
import {negatedClauses,priceAlternatives,type Excluded} from './twilio-menu-clarify.js'
import {looksLikeQuestion,politeCommand} from './twilio-menu-nlu.js'
import {capabilities} from './twilio-menu-copy.js'
import {salesLlmActions} from './twilio-menu-sales.js'
import {buildBrainContext,type BrainContextInput,type BrainContext,type BrainMemoryEntry} from './owner-brain-context.js'

export const BRAIN_ACTIONS=['set_price','set_available','set_hidden','set_featured','set_description','add_tag','remove_tag','create_item','create_daily_special',...salesLlmActions] as const
const nullable=(type:string)=>({type:[type,'null']})
export const BRAIN_SCHEMA={name:'owner_brain_plan',strict:true,schema:{type:'object',additionalProperties:false,
 required:['intent','actions','read','item_refs','capability_ids','clarify','alias_used','reply_draft'],
 properties:{
  intent:{type:'string',enum:['change','read','clarify','capability','chat']},
  actions:{type:'array',items:{type:'object',additionalProperties:false,required:['action','item','section','price','price_ref','price_delta','value','tag','text','name','until'],properties:{
   action:{type:'string',enum:[...BRAIN_ACTIONS]},item:nullable('string'),section:nullable('string'),price:nullable('number'),price_ref:nullable('string'),price_delta:nullable('number'),value:nullable('boolean'),tag:nullable('string'),text:nullable('string'),name:nullable('string'),until:nullable('string')}}},
  read:{type:'string',enum:['items','unavailable','hidden','none']},
  item_refs:{type:'array',items:{type:'string'}},
  capability_ids:{type:'array',items:{type:'string'}},
  clarify:{type:'object',additionalProperties:false,required:['question','item_refs','missing'],properties:{question:nullable('string'),item_refs:{type:'array',items:{type:'string'}},missing:{type:'array',items:{type:'string',enum:['name','price','section']}}}},
  alias_used:{type:'array',items:{type:'object',additionalProperties:false,required:['phrase','item'],properties:{phrase:{type:'string'},item:{type:'string'}}}},
  reply_draft:{type:'string'}}}}

export type BrainUsage={model:string,prompt:number,completion:number,cached:number,latencyMs:number}
export type BrainCall={model:string,content:string,usage:BrainUsage}
export type BrainFetch=(url:string,init:RequestInit)=>Promise<Response>
export type BrainCallOptions=GroqOptions&{fetch?:BrainFetch,models?:string[]}
export class BrainUnavailable extends Error{constructor(readonly reason:'busy'|'invalid_json'|'http'|'timeout'|'no_key',detail=''){super('BRAIN_'+reason.toUpperCase()+(detail?': '+detail:''))}}

const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms))
/** Client Groq del cervello. Stessa politica di `withRateLimit` (twilio-menu-ai.ts, non esportata: la riuso qui per non toccare
 * il file in fase 1): 429 → modello di riserva o attesa entro il budget, poi BrainUnavailable('busy'); JSON non valido o
 * errore HTTP → modello successivo; finiti i modelli → BrainUnavailable. Budget stretto (default 8 s): oltre si va in riserva. */
export async function callBrain(ctx:BrainContext,key:string,opts:BrainCallOptions={}):Promise<BrainCall>{
 if(!key)throw new BrainUnavailable('no_key')
 const models=opts.models??chatModels,doFetch=opts.fetch??((u,i)=>fetch(u,i)),sleep=opts.sleep??pause,deadline=Date.now()+(opts.budgetMs??8000)
 const blocked=new Map<string,number>(),failed=new Set<string>();let waited=false,limited=false,lastReason:BrainUnavailable['reason']='http',lastDetail=''
 for(;;){const now=Date.now(),model=models.find(m=>!failed.has(m)&&(blocked.get(m)??0)<=now)
  if(!model){const open=models.filter(m=>!failed.has(m));if(!open.length)throw new BrainUnavailable(limited?'busy':lastReason,lastDetail);const next=Math.min(...open.map(m=>blocked.get(m)??0));if(next>deadline)throw new BrainUnavailable('busy');await sleep(Math.max(0,next-now));continue}
  const started=Date.now()
  try{const response=await doFetch(groqBase()+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({model,temperature:0,max_completion_tokens:3000,reasoning_effort:'low',response_format:{type:'json_schema',json_schema:BRAIN_SCHEMA},messages:ctx.messages}),
    signal:AbortSignal.timeout(Math.max(1000,Math.min(opts.timeoutMs??8000,deadline-Date.now())))})
   if(response.status===429){limited=true;await response.body?.cancel();blocked.set(model,Date.now()+retryAfterMs(response.headers));await opts.meter?.({model,prompt:0,completion:0,limited:true});if(!waited){waited=true;await opts.onWait?.()}continue}
   if(!response.ok){const body=await response.text().catch(()=>'');failed.add(model);lastReason=/json_validate_failed|output_parse_failed/.test(body)?'invalid_json':'http';lastDetail=String(response.status);continue}
   const data=await response.json() as any,content=String(data?.choices?.[0]?.message?.content??'')
   const usage:BrainUsage={model,prompt:Number(data?.usage?.prompt_tokens)||0,completion:Number(data?.usage?.completion_tokens)||0,cached:Number(data?.usage?.prompt_tokens_details?.cached_tokens)||0,latencyMs:Date.now()-started}
   await opts.meter?.({model,prompt:usage.prompt,completion:usage.completion,limited:false})
   if(!parseJson(content)||typeof parseJson(content)!=='object'){failed.add(model);lastReason='invalid_json';continue}
   return{model,content,usage}
  }catch(error){failed.add(model);lastReason=(error as any)?.name==='TimeoutError'||(error as any)?.name==='AbortError'?'timeout':'http';lastDetail=String((error as any)?.message??'')}
 }
}

export type BrainInput=BrainContextInput&{pendingActions?:MenuAction[]|null}
export type BrainDecision={path:'brain',intent:'change'|'read'|'clarify'|'capability'|'chat',plan:MenuPlan,exclude:Excluded[],aliasesUsed:{phrase:string,itemId:string}[],replyDraft:string,notes:string[],usage:BrainUsage,tokens:BrainContext['tokens']}
export type BrainFallback={path:'fallback',reason:string,usage?:BrainUsage,tokens?:BrainContext['tokens']}

const SAME_PRICE=/\b(stess[oa] prezzo|stesso costo|come (?:il|la|lo|l|i|le|gli)\b|uguale a|identic[oa] a|pari a|allineal\w*|allinea\w*)/
const UP=/\b(aument\w*|alz\w*|sal\w*|piu)\b/,DOWN=/\b(abbass\w*|diminu\w*|scont\w*|scal\w*|meno|togli\w*)\b/

// Il modello capisce per primo, ma non può SCEGLIERE lui tra due piatti che il messaggio indica allo stesso modo
// («la tagliata a 21» con Tagliata di manzo e Tagliata di tonno): se un altro piatto spiega le parole del messaggio
// almeno quanto quello scelto, è un chiarimento (visto nello spike con gpt-oss-20b di riserva, 17/10).
const AMB_STOP=new Set(['della','dello','delle','degli','alla','alle','allo','agli','con','casa','nostro','nostra','piatto'])
const nameWords=(name:string)=>[...new Set(plain(name).split(' ').filter(w=>w.length>=4&&!AMB_STOP.has(w)))]
const sameRoot=(a:string,b:string)=>a===b||(a.length>=6&&b.length>=6&&a.slice(0,6)===b.slice(0,6)),wordHit=(w:string,msg:string[])=>msg.some(m=>sameRoot(m,w))
export function rivalDishes(id:string,message:string,refs:MenuRef[]):string[]{
 const msg=plain(message).split(' '),target=refs.find(r=>r.id===id);if(!target)return []
 if((' '+plain(message)+' ').includes(' '+plain(target.name)+' '))return []
 const mine=nameWords(target.name).filter(w=>wordHit(w,msg));if(!mine.length)return []
 return refs.filter(o=>o.id!==id&&mine.every(w=>nameWords(o.name).some(x=>sameRoot(x,w)))).map(o=>o.id)
}

// Negazioni in coda alla clausola che negatedClauses (twilio-menu-clarify.ts, perimetro Q) non copre ancora:
// «…, la carbonara lascia stare», «la carbonara lasciala com'è», «la carbonara non toccarla». Solo esclusioni, mai scritture.
const KEEP=/\b(lascia(?:la|lo|li|le)? (?:stare|com e|cosi|perdere)|non (?:toccar\w*|cambiar\w*)|resta(?:no)? com e|rimane com e|cosi com e|non si tocca)\b/
export function trailingNegations(message:string,refs:MenuRef[]):Excluded[]{
 const out:Excluded[]=[]
 for(const clause of message.split(/[,;.\n]|\b(?:e poi|invece|pero)\b/)){const c=plain(clause);if(!KEEP.test(c)||/\d/.test(c))continue
  for(const r of refs)if(g9DishMentioned(r.name,clause,refs)&&rivalDishes(r.id,clause,refs).length===0)out.push({id:r.id})}
 return out
}

/** Riconverte i codici e normalizza un'azione del modello nel formato del validatore attuale. */
function legacyAction(a:any,map:(v:unknown)=>string|null):any{
 const base:any={action:a.action,item_id:map(a.item)}
 switch(a.action){case 'set_price':return{...base,price:a.price}
  case 'set_available':return{...base,available:a.value}
  case 'set_hidden':return{...base,hidden:a.value}
  case 'set_featured':return{...base,featured:a.value}
  case 'set_description':return{...base,text:a.text}
  case 'add_tag':case 'remove_tag':return{...base,tag:a.tag}
  case 'create_item':return{action:a.action,section_id:map(a.section),name:a.name,price:a.price,description:a.text}
  case 'create_daily_special':return{action:a.action,name:a.name,price:a.price,description:a.text}
  case 'set_promo':return{...base,price:a.price,until:a.until}
  case 'remove_promo':return base
  default:return{...base,value:a.value}}
}

/** Validatore del cervello. Riusa le regole attuali e aggiunge: riferimenti di prezzo risolti dal menu vero, domande = zero
 * scritture, memoria attiva come «piatto nominato» (trustedIds), alias riportati solo verso piatti esistenti. */
export function validateBrainPlan(raw:unknown,ctx:Pick<BrainContext,'codes'>,input:{refs:MenuRef[],sections:SectionRef[],message:string,memory?:BrainMemoryEntry[],pendingActions?:MenuAction[]|null,clarifySource?:string|null,clarifyIds?:string[]|null}):Omit<BrainDecision,'path'|'usage'|'tokens'>{
 const data=parseJson(raw),{refs,sections,message}=input,byId=new Map(refs.map(r=>[r.id,r])),notes:string[]=[]
 const map=(v:unknown)=>typeof v==='string'?ctx.codes.get(v.trim().toLowerCase())??null:null
 const empty={type:'clarify',ids:[]} as MenuPlan
 if(!data||typeof data!=='object'||Array.isArray(data))return{intent:'clarify',plan:empty,exclude:[],aliasesUsed:[],replyDraft:'',notes:['json_non_oggetto']}
 const intent=(['change','read','clarify','capability','chat'].includes(data.intent)?data.intent:'clarify') as BrainDecision['intent']
 const refIds=(list:unknown)=>Array.isArray(list)?[...new Set(list.map(map).filter((id):id is string=>!!id&&byId.has(id)))]:[]
 const msg=plain(message),source=plain(input.clarifySource??''),inText=(k:string,t:string)=>(' '+t+' ').includes(' '+k+' ')
 const mentionedPhrase=(p:string)=>{const k=plain(p);return k.length>=3&&inText(k,msg)},reportedPhrase=(p:string)=>{const k=plain(p);return k.length>=3&&(inText(k,msg)||(!!source&&inText(k,source)))}
 // Alias riportati dal modello: solo verso piatti esistenti e solo se la frase è davvero nel messaggio (o in quello che aveva
 // causato il chiarimento aperto, per imparare «la solita» = carbonara).
 const aliasesUsed=(Array.isArray(data.alias_used)?data.alias_used:[]).flatMap((a:any)=>{const id=map(a?.item);return id&&byId.has(id)&&typeof a.phrase==='string'&&reportedPhrase(a.phrase)?[{phrase:plain(a.phrase).slice(0,60),itemId:id}]:[]}).slice(0,10)
 // Memoria attiva presente nel messaggio → quei piatti contano come «nominati» per il G9.
 const trusted=new Set((input.memory??[]).filter(m=>m.state==='active'&&m.itemId&&byId.has(m.itemId)&&mentionedPhrase(m.phrase)).map(m=>m.itemId!))
 const trustedHas=(id:string)=>trusted.has(id)
 const reply=typeof data.reply_draft==='string'?data.reply_draft.slice(0,600):''
 const neg=negatedClauses(message,refs),exclude:Excluded[]=[...(neg?.excluded??[]),...trailingNegations(message,refs).filter(e=>!neg?.excluded.some(x=>x.id===e.id&&!x.kinds))]
 // Domande → zero scritture, qualunque cosa dica il modello («la carbonara 13 o 14?», «quanto costa la carbonara?»).
 const question=(looksLikeQuestion(message)&&!politeCommand(message))||!!priceAlternatives(message,refs)
 if(intent==='chat')return{intent,plan:{type:'clarify',ids:[]},exclude,aliasesUsed,replyDraft:reply,notes}
 if(intent==='capability')return{intent,plan:validateMenuPlan({intent:'capability',capability_ids:(Array.isArray(data.capability_ids)?data.capability_ids:[]).filter((c:unknown)=>c==='all'||capabilities.some(x=>x.id===c))},refs,{sections,message}),exclude,aliasesUsed,replyDraft:reply,notes}
 if(intent==='read'){const ids=refIds(data.item_refs);if(data.read==='unavailable'||data.read==='hidden')return{intent,plan:{type:'read',read:data.read},exclude,aliasesUsed,replyDraft:reply,notes};const rivals=ids.flatMap(id=>trustedHas(id)?[]:rivalDishes(id,message,refs).filter(r=>!ids.includes(r)))
  if(rivals.length)return{intent:'clarify',plan:{type:'clarify',ids:[...new Set([...ids,...rivals])].slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_ambiguo']}
  return{intent,plan:ids.length?{type:'read',read:'items',ids:ids.slice(0,10)}:{type:'clarify',ids:[]},exclude,aliasesUsed,replyDraft:reply,notes}}
 if(intent==='clarify'){const ids=refIds(data.clarify?.item_refs?.length?data.clarify.item_refs:data.item_refs),missing=Array.isArray(data.clarify?.missing)?data.clarify.missing:[]
  const plan=missing.length?validateMenuPlan({intent:'clarify',missing,name:null,section_ids:[]},refs,{sections,message}):{type:'clarify',ids:ids.slice(0,5)} as MenuPlan
  return{intent,plan,exclude,aliasesUsed,replyDraft:typeof data.clarify?.question==='string'?data.clarify.question.slice(0,300):reply,notes}}
 // change
 const actions=Array.isArray(data.actions)?data.actions.slice(0,201):[]
 if(question){const ids=refIds([...actions.map((a:any)=>a?.item),...(Array.isArray(data.item_refs)?data.item_refs:[])]);notes.push('domanda_zero_scritture');return{intent:'read',plan:ids.length?{type:'read',read:'items',ids:ids.slice(0,10)}:{type:'clarify',ids:[]},exclude,aliasesUsed,replyDraft:'',notes}}
 // Prezzo ricavato: «aumenta di 1» (delta sul prezzo attuale) e «stesso prezzo di X» (valore riletto dal menu).
 const explicit=new Map<string,number>();for(const a of actions)if(a?.action==='set_price'&&typeof a.price==='number'){const id=map(a.item);if(id)explicit.set(id,a.price)}
 const legacy:any[]=[],derived:{action:any,id:string,price:number,refId:string}[]=[]
 for(const a of actions){if(!a||typeof a!=='object'||!BRAIN_ACTIONS.includes(a.action))return{intent:'clarify',plan:{type:'clarify',ids:refIds(actions.map((x:any)=>x?.item))},exclude,aliasesUsed,replyDraft:'',notes:['azione_sconosciuta']}
  const id=map(a.item)
  if(a.action==='set_price'&&a.price==null&&typeof a.price_delta==='number'&&id&&byId.has(id)){const d=a.price_delta,dir=d>0?UP:DOWN;if(!dir.test(msg)){notes.push('delta_senza_verbo');return{intent:'clarify',plan:{type:'clarify',ids:[id]},exclude,aliasesUsed,replyDraft:'',notes}}legacy.push({action:'set_price',item_id:id,price:Math.round((byId.get(id)!.price+d)*100)/100});continue}
  if(a.action==='set_price'&&a.price==null&&typeof a.price_ref==='string'){const refId=map(a.price_ref);if(!id||!refId||!byId.has(id)||!byId.has(refId)||refId===id||!SAME_PRICE.test(msg)||!g9DishMentioned(byId.get(refId)!.name,message,refs)){notes.push('riferimento_prezzo_non_valido');return{intent:'clarify',plan:{type:'clarify',ids:[id,refId].filter((x):x is string=>!!x&&byId.has(x))},exclude,aliasesUsed,replyDraft:'',notes}}
   derived.push({action:a,id,price:explicit.get(refId)??byId.get(refId)!.price,refId});continue}
  legacy.push(legacyAction(a,map))}
 const opts={sections,message,exclude,trustedIds:trusted.size?trusted:undefined}
 const guard=(plan:MenuPlan):Omit<BrainDecision,'path'|'usage'|'tokens'>=>{if(plan.type!=='change')return{intent:'clarify',plan,exclude,aliasesUsed,replyDraft:'',notes}
  const ids=[...new Set(plan.actions.flatMap(a=>'id' in a&&typeof (a as any).id==='string'?[(a as any).id as string]:[]))],rivals=ids.flatMap(id=>trustedHas(id)?[]:rivalDishes(id,message,refs).filter(r=>!ids.includes(r)))
  if(rivals.length)return{intent:'clarify',plan:{type:'clarify',ids:[...new Set([...ids,...rivals])].slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_ambiguo']}
  return{intent:'change',plan,exclude,aliasesUsed,replyDraft:'',notes}}
 if(!derived.length)return guard(input.pendingActions?.length?validateMenuPlan({intent:'change',actions:legacy},refs,{...opts,checkCompleteness:false}):validateMenuPlan({intent:'change',actions:legacy},refs,opts))
 // Con prezzi derivati: le azioni «normali» passano dal validatore attuale; quelle derivate le verifico qui (piatto nominato,
 // prezzo riletto) e poi rifaccio il controllo di completezza contando come coperti i piatti usati come riferimento.
 const base=legacy.length?validateMenuPlan({intent:'change',actions:legacy},refs,{...opts,checkCompleteness:false}):{type:'change',actions:[]} as MenuPlan
 if(base.type!=='change')return{intent:'clarify',plan:base,exclude,aliasesUsed,replyDraft:'',notes}
 const out:MenuAction[]=[...base.actions]
 for(const d of derived){if(!trusted.has(d.id)&&!g9DishMentioned(byId.get(d.id)!.name,message,refs))return{intent:'clarify',plan:{type:'clarify',ids:[d.id]},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_non_nominato']}
  if(out.some(a=>'id' in a&&a.id===d.id&&a.kind==='price'))return{intent:'clarify',plan:{type:'clarify',ids:[d.id]},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'prezzo_doppio']}
  out.push({kind:'price',id:d.id,price:d.price});notes.push('prezzo_da_riferimento')}
 const covered=new Set([...out.flatMap(a=>'id' in a?[a.id]:[]),...derived.map(d=>d.refId),...exclude.map(e=>e.id)]),padded=' '+msg+' '
 const missed=refs.filter(r=>!covered.has(r.id)&&plain(r.name).length>=3&&padded.includes(' '+plain(r.name)+' ')&&refs.filter(x=>plain(x.name)===plain(r.name)).length===1)
 if(missed.length)return{intent:'clarify',plan:{type:'clarify',ids:missed.map(r=>r.id).slice(0,5),actions:out},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_nominato_senza_azione']}
 return guard({type:'change',actions:out})
}

/** Pianifica un messaggio del titolare: contesto → una chiamata → validatore. Mai eccezioni verso il route: o una decisione, o la riserva. */
export async function planOwnerMessage(input:BrainInput,key:string,opts:BrainCallOptions={}):Promise<BrainDecision|BrainFallback>{
 let ctx:BrainContext
 try{ctx=buildBrainContext(input)}catch(error){return{path:'fallback',reason:'contesto: '+String((error as any)?.message??error)}}
 if(input.refs.length>1500||input.message.length>30000)return{path:'fallback',reason:'troppo_grande',tokens:ctx.tokens}
 let call:BrainCall
 try{call=await callBrain(ctx,key,opts)}catch(error){return{path:'fallback',reason:error instanceof BrainUnavailable?error.reason:error instanceof GroqBusy?'busy':'errore',tokens:ctx.tokens}}
 const decision=validateBrainPlan(call.content,ctx,{refs:input.refs,sections:input.sections,message:input.message,memory:input.memory,pendingActions:input.pendingActions,clarifySource:input.pending?.clarify?.source,clarifyIds:input.pending?.clarify?.itemIds})
 if(decision.notes.includes('json_non_oggetto'))return{path:'fallback',reason:'invalid_json',usage:call.usage,tokens:ctx.tokens}
 return{path:'brain',...decision,usage:call.usage,tokens:ctx.tokens}
}

// Parole d'esito: una bozza del modello che le contiene non arriva mai al titolare (il «fatto» lo scrive solo il server).
const OUTCOME=/\b(fatto|fatta|aggiornat\w*|modificat\w*|cambiat\w*|nascost\w*|salvat\w*|pubblicat\w*|impostat\w*|messo|messa|tolto|tolta|rimess\w*|segnat\w*|esaurit\w*|ho (?:messo|tolto|cambiato|aggiornato|nascosto|segnato|aggiunto|creato|impostato))\b|€|\b\d+(?:[.,]\d{1,2})?\s*(?:euro|eur)\b/
export const draftIsSafe=(s:string)=>!!s.trim()&&s.length<=400&&!OUTCOME.test(plain(s)+' '+s)&&!/[*_~`]/.test(s)

/** Verifica sullo stato RILETTO dal DB che ogni azione sia davvero lì. */
export function verifyApplied(actions:MenuAction[],after:MenuRef[]):{ok:MenuAction[],failed:MenuAction[]}{
 const byId=new Map(after.map(r=>[r.id,r])),ok:MenuAction[]=[],failed:MenuAction[]=[]
 for(const a of actions){const r='id' in a&&typeof (a as any).id==='string'?byId.get((a as any).id):undefined
  const good=a.kind==='price'?!!r&&Math.abs(r.price-a.price)<0.005:a.kind==='available'?!!r&&r.available===a.value:a.kind==='hidden'?!!r&&r.hidden===a.value:a.kind==='featured'?!!r&&!!r.featured===a.value:a.kind==='tag'?!!r&&(r.tags??[]).includes(a.tag)===a.value:a.kind==='create'?after.some(x=>x.sectionId===a.sectionId&&plain(x.name)===plain(a.name)&&Math.abs(x.price-a.price)<0.005):true
  ;(good?ok:failed).push(a)}
 return{ok,failed}
}

/** Testo finale. change: SOLO fatti verificati sul menu riletto (prezzi da→a dal server). Altri intenti: template del server,
 * con la bozza del modello solo per chiarimenti/chiacchiera e solo se non contiene esiti o prezzi. */
export function composeReply(decision:Pick<BrainDecision,'intent'|'plan'|'replyDraft'>,before:MenuRef[],sections:SectionRef[],after?:MenuRef[]):string{
 const {plan}=decision
 if(plan.type==='change'){if(!after)throw new Error('composeReply: change senza rilettura del DB')
  const {ok,failed}=verifyApplied(plan.actions,after)
  if(!ok.length)return 'Non sono riuscito a salvare la modifica. Il menu non è cambiato. Riprova tra poco.'
  return '*Confermato.* Ho aggiornato il menu.\n\n'+ok.map(a=>describeAction(a,before,sections)).join('\n')+(failed.length?'\n\nQuesta parte non è stata salvata: '+failed.map(a=>describeAction(a,before,sections)).join('; '):'')}
 if(plan.type==='read')return readText(plan,after??before)
 if(decision.intent==='chat')return draftIsSafe(decision.replyDraft)?decision.replyDraft.trim():'Dimmi pure cosa vuoi cambiare nel menu.'
 if(plan.type==='clarify'&&decision.replyDraft&&draftIsSafe(decision.replyDraft)&&plan.ids.length){const names=plan.ids.map(id=>before.find(r=>r.id===id)?.name).filter(Boolean);return decision.replyDraft.trim()+(names.length?'\n'+names.map(n=>'- *'+n+'*').join('\n'):'')}
 return planText(plan,before,sections)
}

