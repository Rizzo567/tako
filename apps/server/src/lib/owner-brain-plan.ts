/** Cervello del bot titolare (17/10/2026, perimetro N) · UNA chiamata Groq JSON strict + validatore server.
 * Uscita del modello: {intent, actions[], read, item_refs, capability_ids, clarify, alias_used, reply_draft}.
 * Il server: riconverte i codici brevi in id, risolve «stesso prezzo di X» e «aumenta di N» rileggendo il menu,
 * passa tutto alle regole esistenti (validateMenuPlan: G9, piatti non nominati, prezzi detti, negazioni, completezza),
 * forza zero scritture sulle domande e produce un MenuPlan identico a quello del percorso attuale (turnFor lo applica,
 * G6 prezzi implausibili → conferma scritta). I fatti nella risposta li scrive il server DOPO la rilettura (composeReply).
 * Se Groq è giù, la quota è finita, il JSON non è valido o la chiamata è lenta → {path:'fallback'}: il route usa il
 * percorso deterministico attuale, invariato. */
import {chatModels,groqBase,withRateLimit,GroqBusy,parseJson,validateMenuPlan,describeAction,readText,planText,plain,g9DishMentioned,g9Prices,type GroqOptions,type MenuRef,type SectionRef,type MenuAction,type MenuPlan} from './twilio-menu-ai.js'
import {negatedClauses,priceAlternatives,type Excluded} from './twilio-menu-clarify.js'
import {looksLikeQuestion,politeCommand,parseIntent,findDishes} from './twilio-menu-nlu.js'
import {capabilities} from './twilio-menu-copy.js'
import type {Hold,HoldAsk} from './twilio-menu-hold.js'
import {salesLlmActions} from './twilio-menu-sales.js'
import {buildBrainContext,recentHistory,draftText,type BrainContextInput,type BrainContext,type BrainMemoryEntry,type BrainTurn} from './owner-brain-context.js'

export const BRAIN_ACTIONS=['restore','set_price','set_available','set_hidden','set_featured','set_description','add_tag','remove_tag','create_item','create_daily_special',...salesLlmActions] as const
const nullable=(type:string)=>({type:[type,'null']})
export const BRAIN_SCHEMA={name:'owner_brain_plan',strict:true,schema:{type:'object',additionalProperties:false,
 required:['intent','actions','read','item_refs','capability_ids','clarify','uncertain','alias_used','reply_draft'],
 properties:{
  intent:{type:'string',enum:['change','read','clarify','capability','chat']},
  actions:{type:'array',items:{type:'object',additionalProperties:false,required:['action','item','section','price','price_ref','price_delta','value','tag','text','name','until'],properties:{
   action:{type:'string',enum:[...BRAIN_ACTIONS]},item:nullable('string'),section:nullable('string'),price:nullable('number'),price_ref:nullable('string'),price_delta:nullable('number'),value:nullable('boolean'),tag:nullable('string'),text:nullable('string'),name:nullable('string'),until:nullable('string')}}},
  read:{type:'string',enum:['items','unavailable','hidden','none']},
  item_refs:{type:'array',items:{type:'string'}},
  capability_ids:{type:'array',items:{type:'string'}},
  clarify:{type:'object',additionalProperties:false,required:['question','item_refs','missing'],properties:{question:nullable('string'),item_refs:{type:'array',items:{type:'string'}},missing:{type:'array',items:{type:'string',enum:['name','price','section']}}}},
  uncertain:{type:'array',items:{type:'object',additionalProperties:false,required:['phrase','candidates','action','value','price'],properties:{phrase:{type:'string'},candidates:{type:'array',items:{type:'string'}},action:{type:'string',enum:['none',...BRAIN_ACTIONS.filter(a=>a!=='restore'&&a!=='create_item'&&a!=='create_daily_special')]},value:nullable('boolean'),price:nullable('number')}}},
  alias_used:{type:'array',items:{type:'object',additionalProperties:false,required:['phrase','item'],properties:{phrase:{type:'string'},item:{type:'string'}}}},
  reply_draft:{type:'string'}}}}

export type BrainUsage={model:string,prompt:number,completion:number,cached:number,latencyMs:number}
export type BrainCall={model:string,content:string,usage:BrainUsage}
export type BrainFetch=(url:string,init:RequestInit)=>Promise<Response>
export type BrainCallOptions=GroqOptions&{fetch?:BrainFetch,models?:string[]}
export class BrainUnavailable extends Error{constructor(readonly reason:'busy'|'invalid_json'|'http'|'timeout'|'no_key',detail=''){super('BRAIN_'+reason.toUpperCase()+(detail?': '+detail:''))}}

/** Client Groq del cervello: stesso `withRateLimit` del bot (twilio-menu-ai.ts) — 429 → modello di riserva o attesa entro il
 * budget, errore o JSON non valido → modello successivo. Budget stretto (default 8 s): oltre si va in riserva deterministica. */
export async function callBrain(ctx:BrainContext,key:string,opts:BrainCallOptions={}):Promise<BrainCall>{
 if(!key)throw new BrainUnavailable('no_key')
 const doFetch=opts.fetch??((u,i)=>fetch(u,i));let lastStatus=0,timedOut=false,started=0
 try{return await withRateLimit(opts.models??chatModels,model=>{started=Date.now();return doFetch(groqBase()+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({model,temperature:0,max_completion_tokens:3000,reasoning_effort:'low',response_format:{type:'json_schema',json_schema:BRAIN_SCHEMA},messages:ctx.messages}),
    signal:AbortSignal.timeout(opts.timeoutMs??8000)}).then(r=>{lastStatus=r.status;return r},e=>{timedOut=(e as any)?.name==='TimeoutError'||(e as any)?.name==='AbortError';throw e})},
   async(model,response)=>{const data=await response.json() as any,content=String(data?.choices?.[0]?.message?.content??'')
    const usage:BrainUsage={model,prompt:Number(data?.usage?.prompt_tokens)||0,completion:Number(data?.usage?.completion_tokens)||0,cached:Number(data?.usage?.prompt_tokens_details?.cached_tokens)||0,latencyMs:Date.now()-started}
    await opts.meter?.({model,prompt:usage.prompt,completion:usage.completion,limited:false})
    const parsed=parseJson(content);if(!parsed||typeof parsed!=='object'){lastStatus=-1;throw new Error('brain: JSON non valido')}
    return{model,content,usage}},{...opts,budgetMs:opts.budgetMs??8000})}
 catch(error){if(error instanceof GroqBusy)throw new BrainUnavailable('busy');throw new BrainUnavailable(timedOut?'timeout':lastStatus===400||lastStatus===-1?'invalid_json':'http',String(lastStatus))}
}

export type BrainInput=BrainContextInput&{pendingActions?:MenuAction[]|null,restorable?:Map<string,MenuAction[]>,exclude?:Excluded[]}
export type BrainDecision={path:'brain',intent:'change'|'read'|'clarify'|'capability'|'chat',plan:MenuPlan,hold?:Hold,exclude:Excluded[],aliasesUsed:{phrase:string,itemId:string}[],replyDraft:string,notes:string[],usage:BrainUsage,tokens:BrainContext['tokens']}
export type BrainFallback={path:'fallback',reason:string,usage?:BrainUsage,tokens?:BrainContext['tokens']}

const SAME_PRICE=/\b(puru|stess[oa]|stesso costo|come (?:il|la|lo|l|i|le|gli)\b|ugual\w*|identic[oa]|pari|idem|allineal\w*|allinea\w*|anche|pure)\b/
// Rimandi alla cronologia: pronomi, «anche/pure/uguale», correzioni, scelte («la seconda»).
const SWAP=/\b(intendevo|volevo dire|era (?:la|il|lo|l)|non (?:la|il|lo) .{0,20}(?:ma|era)|no(?:,)? (?:la|il|lo|l|i|le|gli)\b|scusa(?:,)? (?:la|il|lo|l|i|le|gli)\b|ho sbagliato)/
export const REFERS=/\b(fai|solo|anche|pure|puru|uguale|ugual\w*|idem|stess[oa]|mettil\w*|fall[aoie]\w*|portal\w*|toglil\w*|nascondil\w*|rimettil\w*|segnal\w*|quell[aoie]|quelli|quest[aoi]|no|scusa|anzi|invece|intendevo|volevo|sbagliato|errore|prim[oa]|second[oa]|terz[oa]|ultim[oa]|tutt\w*|entramb\w*|altr[oa])\b/
// 17/10 (correzioni A, v-deixis): rimandi a PIÙ piatti o per posizione nei messaggi recenti del titolare. «quei due», «entrambi»,
// «tutti e tre», «quelli», «mettili» → l'insieme dei piatti; «il primo», «l'ultimo» → uno solo; «tutti tranne X». Il validatore
// accetta un'azione senza nome solo se tocca ESATTAMENTE quei piatti; altrimenti chiede.
const DEIX_N:Record<string,number>={due:2,tre:3,quattro:4,'2':2,'3':3,'4':4}
const DEIX_PLURAL=/\b(?:quei|quegli|quelli|quelle|questi|queste|entramb\w*|tutti|tutte|ambedue)\b|\b(?:metti|nascondi|togli|rimetti|segna|porta|fa|cambia|alza|abbassa|aumenta|mostra|leva|lascia|toglie)(?:me)?li\b|\b(?:li|le) (?:metti|nascondi|togli|rimetti|segni|porti|cambi)\b/
const DEIX_ORD=/\b(?:il|la|l|lo|quest) ?(prim[oa]|second[oa]|terz[oa]|ultim[oa])\b(?! (?:piatt[oi] (?:del|della|di)|del pranzo|della cena))/
export function deixisReferents(msg:string,owners:string[],refs:MenuRef[]):{kind:'set'|'one',ids:string[]}|null{
 const p=' '+plain(msg)+' ',ord=p.match(DEIX_ORD),except=p.match(/\btutt[ie] (?:tranne|eccetto|esclus[oaie]|meno) (.+)$/),plural=DEIX_PLURAL.test(p)
 if(!ord&&!plural&&!except)return null
 const posOf=(name:string,t:string)=>{const ws=plain(name).split(' ').filter(w=>w.length>=4);let best=Infinity;for(const w of ws.length?ws:plain(name).split(' ')){const i=t.search(new RegExp('\\b'+w.slice(0,5).replace(/[^a-z0-9]/g,'')));if(i>=0&&i<best)best=i}return best}
 const lists=owners.map(o=>{const t=' '+plain(o)+' ';return refs.filter(r=>g9DishMentioned(r.name,o,refs)).sort((a,b)=>posOf(a.name,t)-posOf(b.name,t)).map(r=>r.id)})
 const lastMulti=[...lists].reverse().find(l=>l.length>0)
 const chrono:string[]=[];for(const l of lists)for(const id of l)if(!chrono.includes(id))chrono.push(id)
 if(ord&&!plural){const seq=lastMulti&&lastMulti.length>=2?lastMulti:chrono,w=ord[1]!,i=/^prim/.test(w)?0:/^second/.test(w)?1:/^terz/.test(w)?2:seq.length-1;return{kind:'one',ids:seq[i]?[seq[i]!]:[]}}
 if(except){const named=refs.filter(r=>g9DishMentioned(r.name,except[1]!,refs)).map(r=>r.id);return{kind:'set',ids:(lastMulti&&lastMulti.length>=2?lastMulti:chrono).filter(id=>!named.includes(id))}}
 const nm=p.match(/\b(?:tutti|tutte|quei|quelle|questi|queste|i|le|gli|ambedue) (?:e )?(due|tre|quattro|2|3|4)\b/),n=nm?DEIX_N[nm[1]!]!:/\bentramb\w*|\bambedue\b/.test(p)?2:null
 if(lastMulti&&lastMulti.length>=(n??2))return{kind:'set',ids:n?lastMulti.slice(0,n):lastMulti}
 const back:string[]=[];for(const l of [...lists].reverse())for(const id of [...l].reverse())if(!back.includes(id))back.push(id)
 const want=n??2;if(back.length<want)return{kind:'set',ids:[]}
 const pick=back.slice(0,want);return{kind:'set',ids:chrono.filter(id=>pick.includes(id))}}
const FEAT_OFF=/\b(?:togli\w*|lev\w*|rimuov\w*|lev[ai]) (?:\w+ ){0,2}evidenza\b|\bnon (?:piu |più )?in evidenza\b|\bdall evidenza\b|\bdalla evidenza\b/,FEAT_ON=/\b(?:mett\w*|metti\w*) (?:\w+ ){0,5}in evidenza\b|\bevidenzia\w*\b/
const HID_ON=/\b(?:nascond\w*|togli\w*|lev\w*)\b/,HID_OFF=/\b(?:rimett\w*|mostr\w*|fa\w* vedere|visibil\w*|ricompar\w*)\b/
const AV_OFF=/\b(?:finit\w*|esaurit\w*|fernut\w*|terminat\w*)\b/,AV_ON=/\b(?:tornat\w*|disponibil\w*|di nuovo|ce di nuovo)\b/
/** Azioni con il verso opposto a quello detto nel messaggio (solo quando il messaggio ha un verso solo). */
export function polarityProblem(actions:MenuAction[],msg:string):string[]{const m=' '+msg+' ',out:string[]=[]
 const fOff=FEAT_OFF.test(m),fOn=FEAT_ON.test(m)&&!fOff,hOn=HID_ON.test(m)&&!HID_OFF.test(m)&&!/evidenza|promo|offert|scont|etichett/.test(m),hOff=HID_OFF.test(m)&&!HID_ON.test(m),aOff=AV_OFF.test(m)&&!AV_ON.test(m),aOn=AV_ON.test(m)&&!AV_OFF.test(m)
 for(const a of actions){if(!('id' in a))continue
  if(a.kind==='featured'&&((fOff&&a.value)||(fOn&&!a.value)))out.push(a.id)
  if(a.kind==='hidden'&&((hOn&&!a.value)||(hOff&&a.value)))out.push(a.id)
  if(a.kind==='available'&&((aOff&&a.value)||(aOn&&!a.value)))out.push(a.id)}
 return [...new Set(out)]}
const LEAVE=/\b(?:lascia\w* stare|lascia\w* perdere|lascial[oaie]\w*|non (?:lo |la |li |le )?(?:toccare|cambiare)|non toccarl\w*)\b/
const ORDINAL=/\b(prim[oa]|second[oa]|terz[oa]|quart[oa]|quint[oa]|ultim[oa]|[1-8]|tutt[ie]|entramb\w*|altr[oa])\b/
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

// Un piatto «coperto» da un altro: tutte le parole che il messaggio ha in comune con lui le ha anche un altro piatto, che in più
// ne prende altre («spritz aperol» → Spritz Campari è coperto da Spritz Aperol; «cornetti integrali» → Cornetto). Il modello
// che agisce sul piatto coperto ha frainteso.
export function dominatedBy(id:string,message:string,refs:MenuRef[]):string[]{
 const msg=plain(message).split(' '),target=refs.find(r=>r.id===id);if(!target)return []
 if((' '+plain(message)+' ').includes(' '+plain(target.name)+' '))return []
 const hits=(r:MenuRef)=>nameWords(r.name).filter(w=>wordHit(w,msg)),mine=hits(target);if(!mine.length)return []
 return refs.filter(o=>{if(o.id===id)return false;const theirs=hits(o);return theirs.length>mine.length&&mine.every(w=>theirs.some(x=>sameRoot(x,w)))}).map(o=>o.id)
}
// «la gricia a uno in meno», «due di più»: quel numero è una differenza, mai il prezzo.
const relativeNumbers=(message:string)=>{const out=new Set<number>(),p=plain(message);for(const m of p.matchAll(/\b(\w+)(?: euro)? (?:in|di) (?:meno|piu)\b/g)){const v=g9Prices('a '+m[1]!);for(const x of v)out.add(x)}return out}
const BOT_QUESTION=/\?|\brispondi\b|\bquale\b|\bintendi\b|scrivi il|riscrivimi|due prezzi/i
export const PENDING_MS=10*60*1000

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
// Numeri detti in dialetto (siciliano/napoletano/romanesco) → italiano, solo per i controlli del server («a ottu» = 8, «cincu» = 5).
const DIALECT_NUM:Record<string,string>={unu:'uno',dui:'due',tri:'tre',quattru:'quattro',cincu:'cinque',cinche:'cinque',seie:'sei',setti:'sette',ottu:'otto',novi:'nove',deci:'dieci',unnici:'undici',dudici:'dodici',tririci:'tredici',quattordici:'quattordici',quinnici:'quindici',sidici:'sedici',diciassetti:'diciassette',diciottu:'diciotto',diciannovi:'diciannove',vinti:'venti',trenta:'trenta',euri:'euro',euru:'euro',menzu:'mezzo',menza:'mezza'}
export const dialectNumbers=(s:string)=>s.replace(/\b[\p{L}]+\b/gu,w=>DIALECT_NUM[w.toLowerCase()]??w)
export function validateBrainPlan(raw:unknown,ctx:Pick<BrainContext,'codes'>,input:{refs:MenuRef[],sections:SectionRef[],message:string,memory?:BrainMemoryEntry[],pendingActions?:MenuAction[]|null,clarifySource?:string|null,clarifyIds?:string[]|null,history?:BrainTurn[],restorable?:Map<string,MenuAction[]>,now?:number,exclude?:Excluded[],draftText?:string}):Omit<BrainDecision,'path'|'usage'|'tokens'>{
 const data=parseJson(raw),{refs,sections}=input,message=dialectNumbers(input.message),byId=new Map(refs.map(r=>[r.id,r])),notes:string[]=[]
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
 const neg=negatedClauses(message,refs),exclude:Excluded[]=[...(neg?.excluded??[]),...(input.exclude??[]).filter(e=>!neg?.excluded.some(x=>x.id===e.id))]
 // Domande → zero scritture, qualunque cosa dica il modello («la carbonara 13 o 14?», «quanto costa la carbonara?»).
 const question=(looksLikeQuestion(message)&&!politeCommand(message))||!!priceAlternatives(message,refs)
 if(intent==='chat')return{intent,plan:{type:'clarify',ids:[]},exclude,aliasesUsed,replyDraft:reply,notes}
 if(intent==='capability')return{intent,plan:validateMenuPlan({intent:'capability',capability_ids:(Array.isArray(data.capability_ids)?data.capability_ids:[]).filter((c:unknown)=>c==='all'||capabilities.some(x=>x.id===c))},refs,{sections,message}),exclude,aliasesUsed,replyDraft:reply,notes}
 // «il supplì è finito» letto come domanda («cosa è finito?»): non è una domanda → si chiede quale piatto, con l'azione capita.
 if(intent==='read'&&(data.read==='unavailable'||data.read==='hidden')&&!looksLikeQuestion(message)&&/\b(finit\w*|esaurit\w*|nascond\w*|togli\w*|fernut\w*)\b/.test(msg)){const i=parseIntent(message),opts2=[...new Set([...refIds(data.clarify?.item_refs),...refIds(data.item_refs),...(i&&'target' in i?findDishes((i as any).target,refs).map(r=>r.id):[])])].slice(0,8)
  const act=i&&(i.kind==='available'||i.kind==='hidden')&&opts2.length?{kind:i.kind,id:opts2[0]!,value:(i as any).value} as MenuAction:null
  return{intent:'clarify',plan:opts2.length>1&&act?{type:'clarify',ids:opts2,actions:[act]}:{type:'clarify',ids:opts2},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'lettura_non_domanda']}}
 if(intent==='read'){const ids=refIds(data.item_refs);if(data.read==='unavailable'||data.read==='hidden')return{intent,plan:{type:'read',read:data.read},exclude,aliasesUsed,replyDraft:reply,notes};const rivals=ids.flatMap(id=>trustedHas(id)?[]:rivalDishes(id,message,refs).filter(r=>!ids.includes(r)))
  if(rivals.length)return{intent:'clarify',plan:{type:'clarify',ids:[...new Set([...ids,...rivals])].slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_ambiguo']}
  return{intent,plan:ids.length?{type:'read',read:'items',ids:ids.slice(0,10)}:{type:'clarify',ids:[]},exclude,aliasesUsed,replyDraft:reply,notes}}
 // «e pure la gricia», «anche la gricia» subito dopo una modifica di prezzo confermata: il modello a volte chiede il prezzo;
 // è la stessa modifica (stesso prezzo del piatto appena cambiato). Si riscrive come price_ref e passa dai controlli normali.
 if(intent==='clarify'&&Array.isArray(data.clarify?.missing)&&data.clarify.missing.includes('price')&&/\b(anche|pure|puru|ugual\w*|idem|stess[oa])\b/.test(msg)){
  const hist=recentHistory(input.history??[],input.now),bot=[...hist].reverse().find(t=>t.role==='bot'),lab=bot&&!BOT_QUESTION.test(bot.text)?[...bot.text.matchAll(/\*([^*\n]{2,80})\*\s*:\s*prezzo da/g)].map(m=>plain(m[1]!)):[]
  const ids0=refIds(data.clarify?.item_refs),codeOf=new Map([...ctx.codes].map(([c,id])=>[id,c])),w=refs.find(r=>lab.length===1&&plain(r.name)===lab[0])
  if(w&&ids0.length===1&&ids0[0]!==w.id){data.intent='change';data.actions=[{action:'set_price',item:codeOf.get(ids0[0]!),price:null,price_ref:codeOf.get(w.id),price_delta:null}];return validateBrainPlan(JSON.stringify(data),ctx,input)}}
 if(intent==='clarify'){const ids=refIds(data.clarify?.item_refs?.length?data.clarify.item_refs:data.item_refs),missing=Array.isArray(data.clarify?.missing)?data.clarify.missing:[]
  let plan=missing.length?validateMenuPlan({intent:'clarify',missing,name:null,section_ids:[]},refs,{sections,message}):{type:'clarify',ids:ids.slice(0,8)} as MenuPlan
  // Chiarimento con l'azione già capita (QA 17/10 caso 3): un'azione sola, sul primo candidato, con i valori detti nel messaggio.
  // Il route la tiene in sospeso come scelta («choose»): «2», «quello classico», «sì la seconda» la completano.
  const acts=Array.isArray(data.actions)?data.actions:[]
  // Un solo candidato con l'azione capita («la pasta costa 12» → Pasta e fagioli?): domanda di conferma sì/no (hold «confirm»).
  if(plan.type==='clarify'&&ids.length===1&&acts.length===1&&BRAIN_ACTIONS.includes(acts[0]?.action)&&acts[0].action!=='restore'&&!question){const a=acts[0],id=ids[0]!
   const v=validateMenuPlan({intent:'change',actions:[legacyAction(a,x=>x===a.item?id:map(x))]},refs,{sections,message,exclude,trustedIds:new Set([id]),checkCompleteness:false})
   if(v.type==='change'&&v.actions.length===1)return{intent:'clarify',plan:{type:'clarify',ids:[]},hold:{kind:'hold',actions:[],asks:[{type:'confirm',word:message.slice(0,60),action:v.actions[0]!}]},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'conferma']}}
  if(plan.type==='clarify'&&ids.length>1&&acts.length===1&&BRAIN_ACTIONS.includes(acts[0]?.action)&&acts[0].action!=='restore'&&!question){const a=acts[0],id=map(a.item)??ids[0]!
   if(ids.includes(id)&&!(a.action==='set_price'&&a.price==null)){const v=validateMenuPlan({intent:'change',actions:[legacyAction(a,x=>x===a.item?id:map(x))]},refs,{sections,message,exclude,trustedIds:new Set(ids),checkCompleteness:false})
    if(v.type==='change'&&v.actions.length===1)plan={type:'clarify',ids:ids.slice(0,8),actions:v.actions}}}
  return{intent,plan,exclude,aliasesUsed,replyDraft:typeof data.clarify?.question==='string'?data.clarify.question.slice(0,300):reply,notes}}
 // change
 const actions=Array.isArray(data.actions)?data.actions.slice(0,201):[]
 if(question){const ids=refIds([...actions.map((a:any)=>a?.item),...(Array.isArray(data.item_refs)?data.item_refs:[])]);notes.push('domanda_zero_scritture');return{intent:'read',plan:ids.length?{type:'read',read:'items',ids:ids.slice(0,10)}:{type:'clarify',ids:[]},exclude,aliasesUsed,replyDraft:'',notes}}
 // Parti incerte (Manuel 17/10 sera): le parti chiare restano in sospeso e per ogni parte incerta c'è una domanda.
 const unc=(Array.isArray(data.uncertain)?data.uncertain:[]).filter((u:any)=>u&&typeof u.phrase==='string'&&u.phrase.trim()&&inText(plain(u.phrase),msg)).slice(0,6)
 const asks:HoldAsk[]=[],candCovered:string[]=[]
 const clearIds=new Set(actions.map((a:any)=>map(a?.item)).filter(Boolean) as string[]),negIds=new Set(exclude.map(e=>e.id))
 for(const u of unc){const all=refIds(u.candidates),cands=all.filter(id=>!clearIds.has(id)&&!negIds.has(id)).slice(0,8)
  // Candidati già toccati da una parte chiara o negati: quell'ambiguità non c'è più (resta solo se rimangono ≥2 piatti o nessuno era indicato).
  if(all.length&&cands.length<(all.length>=2?2:1))continue
  candCovered.push(...cands);const word=String(u.phrase).trim().slice(0,60)
  const tmpl=(id:string):MenuAction|null=>{if(u.action==='none')return null;const v=validateMenuPlan({intent:'change',actions:[legacyAction({...u,item:'x',price:u.price},x=>x==='x'?id:map(x))]},refs,{sections,message,exclude,trustedIds:new Set([id]),checkCompleteness:false});return v.type==='change'&&v.actions.length===1?v.actions[0]!:null}
  if(cands.length>=2){const a=tmpl(cands[0]!);if(a){const {id:_i,...template}=a as any;asks.push({type:'choose',word,options:cands,template});continue}}
  if(cands.length===1){const a=tmpl(cands[0]!);if(a){asks.push({type:'confirm',word,action:a});continue}}
  asks.push({type:'unknown',word})}
 // Contesto (fase 2): un messaggio che rimanda a prima («mettila a 13», «e la gricia uguale», «no scusa 14», «sì la seconda»)
 // può riferirsi a piatti nominati nella cronologia (ultimi messaggi del titolare + ultima risposta del bot) e a prezzi detti
 // DAL TITOLARE nella cronologia. Mai prezzi presi dalle risposte del bot; mai creazioni dal contesto.
 const history=input.history??[],owners=history.filter(t=>t.role==='owner').slice(-3).map(t=>dialectNumbers(t.text)),lastBotText=[...history].reverse().find(t=>t.role==='bot')?.text??''
 const hasCreate=actions.some((a:any)=>a?.action==='create_item'||a?.action==='create_daily_special')
const lastBotTurn=[...history].reverse().find(t=>t.role==='bot'),staleQuestion=!!lastBotTurn&&BOT_QUESTION.test(lastBotTurn.text)&&(input.now??Date.now())-lastBotTurn.at>PENDING_MS
 // Una domanda del bot vale 10 minuti (come le proposte in sospeso): dopo, la risposta breve non la completa più.
 const ctxOK=!hasCreate&&history.length>0&&!staleQuestion&&(REFERS.test(msg)||msg.split(' ').length<=4)
 const dishText=ctxOK?[message,...owners,lastBotText].join(' \n '):hasCreate&&input.draftText?message+' \n '+input.draftText:message,priceText=ctxOK?[message,...owners].join(' \n '):message
 const botLabels=[...lastBotText.matchAll(/\*([^*\n]{2,80})\*\s*:/g)].map(m=>plain(m[1]!))
 const mentioned=(id:string)=>trusted.has(id)||g9DishMentioned(byId.get(id)!.name,dishText,refs)
 // Prezzo ricavato: «aumenta di 1» (delta sul prezzo attuale) e «stesso prezzo di X» (valore riletto dal menu).
 const explicit=new Map<string,number>();for(const a of actions)if(a?.action==='set_price'&&typeof a.price==='number'){const id=map(a.item);if(id)explicit.set(id,a.price)}
 const legacy:any[]=[],derived:{id:string,actions:MenuAction[],refId?:string}[]=[],deltaIds=new Set<string>()
 const no=(note:string,ids:(string|null)[]=[])=>({intent:'clarify' as const,plan:{type:'clarify' as const,ids:ids.filter((x):x is string=>!!x&&byId.has(x))},exclude,aliasesUsed,replyDraft:'',notes:[...notes,note]})
 for(const a of actions){if(!a||typeof a!=='object'||!BRAIN_ACTIONS.includes(a.action))return no('azione_sconosciuta',actions.map((x:any)=>map(x?.item)))
  const id=map(a.item)
  if(a.action==='restore'){if(!id||!byId.has(id)||!mentioned(id))return no('ripristino_non_valido',[id]);const back=input.restorable?.get(id);if(!back?.length)return no('ripristino_impossibile',[id]);derived.push({id,actions:back});continue}
  if(a.action==='set_price'&&a.price==null&&typeof a.price_delta==='number'&&id&&byId.has(id)){const d=a.price_delta,dir=d>0?UP:DOWN;if(!dir.test(msg))return no('delta_senza_verbo',[id]);legacy.push({action:'set_price',item_id:id,price:Math.round((byId.get(id)!.price+d)*100)/100});deltaIds.add(id);continue}
  if(a.action==='set_price'&&a.price==null&&typeof a.price_ref==='string'){const refId=map(a.price_ref)
   // Il piatto di riferimento è nominato in questo messaggio, oppure è proprio quello dell'ultima risposta del bot («*Carbonara*: …»).
   const labelled=refId?botLabels.includes(plain(byId.get(refId)?.name??'')):false
   if(!id||!refId||!byId.has(id)||!byId.has(refId)||refId===id||!SAME_PRICE.test(msg)||!(g9DishMentioned(byId.get(refId)!.name,message,refs)||trusted.has(refId)||(ctxOK&&labelled)))return no('riferimento_prezzo_non_valido',[id,refId])
   derived.push({id,actions:[{kind:'price',id,price:explicit.get(refId)??byId.get(refId)!.price}],refId});continue}
  legacy.push(legacyAction(a,map))}
 // «no, intendevo l'amatriciana» dopo «la carbonara costa 13»: se il modello sposta l'azione sul piatto giusto ma dimentica di
 // rimettere quello sbagliato, il server lo rimette com'era (solo se è l'unico piatto del messaggio precedente e si può ripristinare).
 if(ctxOK&&SWAP.test(msg)){const prev=refs.filter(r=>g9DishMentioned(r.name,owners.at(-1)??'',refs)).map(r=>r.id)
  if(prev.length===1){const w=prev[0]!,acted=[...legacy.map((a:any)=>a.item_id),...derived.map(d=>d.id)];const named=refs.filter(r=>r.id!==w&&g9DishMentioned(r.name,message,refs)).map(r=>r.id)
   if(!acted.includes(w)&&!g9DishMentioned(byId.get(w)!.name,message,refs)&&named.some(id=>acted.includes(id))&&input.restorable?.get(w)?.length){derived.push({id:w,actions:input.restorable.get(w)!});notes.push('ripristino_automatico')}}}
 const opts={sections,message,exclude:[...exclude,...candCovered.map(id=>({id}))],trustedIds:trusted.size?trusted:undefined}
 const withHold=(d:Omit<BrainDecision,'path'|'usage'|'tokens'>):Omit<BrainDecision,'path'|'usage'|'tokens'>=>{if(!asks.length)return d
  if(d.plan.type!=='change'&&!(d.plan.type==='clarify'&&!d.plan.ids.length))return d
  const clear=d.plan.type==='change'?d.plan.actions:[];if(asks.length<2&&!clear.length)return d
  return{...d,intent:'clarify',plan:{type:'clarify',ids:[]},hold:{kind:'hold',actions:clear,asks},notes:[...d.notes,'parti_incerte']}}
 const guard=(plan:MenuPlan):Omit<BrainDecision,'path'|'usage'|'tokens'>=>{if(plan.type!=='change')return{intent:'clarify',plan,exclude,aliasesUsed,replyDraft:'',notes}
  const ids=[...new Set(plan.actions.flatMap(a=>'id' in a&&typeof (a as any).id==='string'?[(a as any).id as string]:[]))],rivals=ids.flatMap(id=>trustedHas(id)?[]:rivalDishes(id,message,refs).filter(r=>!ids.includes(r)))
  // Piatti indicati in modo ambiguo o coperti da un altro: le azioni chiare restano, per ognuna ambigua una domanda «quale?»
  // con l'azione già capita (proposta hold o scelta), mai una scelta del modello e mai la richiesta intera persa.
  const doubt=new Map<string,string[]>();for(const id of ids){if(trustedHas(id))continue;const r=[...rivalDishes(id,message,refs),...dominatedBy(id,message,refs)].filter(x=>x!==id);if(r.length)doubt.set(id,[id,...new Set(r)])}
  if(doubt.size){const clear=plan.actions.filter(a=>!('id' in a)||!doubt.has((a as any).id)),amb=plan.actions.filter(a=>'id' in a&&doubt.has((a as any).id))
   const asks2:HoldAsk[]=amb.map(a=>{const {id,...template}=a as any;return{type:'choose' as const,word:refs.find(r=>r.id===id)?.name??'',options:doubt.get(id)!.slice(0,8),template}})
   if(!clear.length&&asks2.length===1)return{intent:'clarify',plan:{type:'clarify',ids:asks2[0]!.type==='choose'?asks2[0]!.options:[],actions:[amb[0]!]},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_ambiguo']}
   return{intent:'clarify',plan:{type:'clarify',ids:[]},hold:{kind:'hold',actions:clear,asks:[...asks2,...asks]},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_ambiguo']}}
  // 17/10 (correzioni A): il valore deve avere il verso detto («togli l'evidenza» → mai in evidenza; «finito» → mai disponibile).
  {const restored=new Set(derived.filter(d=>!d.refId).map(d=>d.id)),bad=polarityProblem(plan.actions.filter(a=>!('id' in a)||!restored.has(a.id)),msg);if(bad.length)return{intent:'clarify',plan:{type:'clarify',ids:bad.slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'valore_contrario']}}
  const rel=relativeNumbers(message);if(plan.actions.some(a=>(a.kind==='price'||(a.kind==='promo'&&a.price!==null))&&rel.has(Math.round((a.price as number)*100)/100)&&!deltaIds.has(a.id)))return{intent:'clarify',plan:{type:'clarify',ids:ids.slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'differenza_come_prezzo']}
  // Rimando senza nome («mettila a 13», «no scusa 14»): vale solo per il piatto (unico) del messaggio precedente del titolare
  // o per quelli dell'ultima risposta del bot; con due piatti prima, o un altro argomento in mezzo, si chiede.
  if(ctxOK){const prevOwner=owners.at(-1)??'',pd=refs.filter(r=>g9DishMentioned(r.name,prevOwner,refs)).map(r=>r.id),bd=refs.filter(r=>g9DishMentioned(r.name,lastBotText,refs)).map(r=>r.id)
   const bare=ids.filter(id=>!trustedHas(id)&&!g9DishMentioned(byId.get(id)!.name,message,refs)&&!derived.some(d=>d.refId===id))
   // Un prezzo senza piatto («no scusa 14») corregge solo un prezzo detto nel messaggio precedente, mai un «finito».
   const priceBare=(id:string)=>plan.actions.some(a=>'id' in a&&a.id===id&&(a.kind==='price'||a.kind==='promo'))&&!g9Prices(prevOwner).length&&!looksLikeQuestion(prevOwner)
   // Risposta a una domanda del bot sulla richiesta di prima: quella richiesta (anche con più piatti) torna valida per intero.
   const answering=BOT_QUESTION.test(lastBotText)
   const deix=answering||(input.clarifyIds??[]).length>1?null:deixisReferents(message,owners,refs)
   const deixBad=deix?(bare.length&&(bare.some(id=>!deix.ids.includes(id))||(deix.kind==='set'&&deix.ids.some(id=>!ids.includes(id)))||!deix.ids.length)):false
   const bad=deix?(deixBad?bare:[]).concat(bare.filter(priceBare)):bare.filter(id=>!(pd.includes(id)||bd.includes(id))||(pd.length>1&&!bd.includes(id)&&!ORDINAL.test(msg)&&!answering)||priceBare(id))
   if(bad.length)return{intent:'clarify',plan:{type:'clarify',ids:[...new Set([...pd,...bad])].filter(id=>byId.has(id)).slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'rimando_incerto']}}
  // Scelta aperta tra più piatti: «sì», «ok», «vai» non scelgono. Serve il nome, un ordinale o «tutti e due».
  const open=(input.clarifyIds??[]).filter(id=>byId.has(id))
  if(open.length>1&&ids.some(id=>open.includes(id))&&!ids.every(id=>!open.includes(id)||trustedHas(id)||g9DishMentioned(byId.get(id)!.name,message,refs))&&!ORDINAL.test(msg))return{intent:'clarify',plan:{type:'clarify',ids:open.slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'scelta_non_detta']}
  return{intent:'change',plan,exclude,aliasesUsed,replyDraft:'',notes}}
 // Con contesto o azioni derivate: le azioni «normali» passano dal validatore attuale sul testo con il contesto; i prezzi devono
 // comparire nel messaggio o in un messaggio recente del titolare; completezza ricontrollata sul solo messaggio.
 const base=legacy.length?validateMenuPlan({intent:'change',actions:legacy},refs,{...opts,message:dishText,checkCompleteness:false}):{type:'change',actions:[]} as MenuPlan
 if(base.type!=='change')return{intent:'clarify',plan:base,exclude,aliasesUsed,replyDraft:'',notes}
 if(ctxOK){const said=g9Prices(priceText),inMsg=g9Prices(message),prevOwner=owners.at(-1)??''
  // Un prezzo preso dal contesto (non detto in QUESTO messaggio) vale solo se è il prezzo attuale di un piatto del messaggio
  // precedente («e la gricia uguale» = stesso prezzo della carbonara appena cambiata), mai un numero sparso («sei e cinquanta» → 50).
  const ctxPrices=new Set(refs.filter(r=>g9DishMentioned(r.name,prevOwner,refs)||g9DishMentioned(r.name,lastBotText,refs)).map(r=>Math.round(r.price*100)/100))
  // Dopo una domanda del bot (≤10 minuti) la risposta completa la richiesta di prima: valgono anche i prezzi di quel messaggio.
  const afterQuestion=BOT_QUESTION.test(lastBotText)?g9Prices(prevOwner):[]
  // 17/10 (A2.3): un prezzo del contesto vale solo con un rimando esplicito («uguale», «anche», «no, il tiramisù»), mai in un
  // messaggio che dice di lasciare stare («no, il caviale lascialo stare» era diventato il caviale a 10 €).
  const ctxPriceOK=(SAME_PRICE.test(msg)||SWAP.test(msg))&&!LEAVE.test(msg)
  for(const a of base.actions)if((a.kind==='price'||(a.kind==='promo'&&a.price!==null))&&!deltaIds.has(a.id)){const v=Math.round((a.price as number)*100)/100;if(!inMsg.includes(v)&&!afterQuestion.includes(v)&&!(ctxPriceOK&&said.includes(v)&&ctxPrices.has(v)))return no('prezzo_non_detto',[a.id])}}
 const out:MenuAction[]=[...base.actions]
 for(const d of derived){if(!mentioned(d.id))return no('piatto_non_nominato',[d.id])
  for(const x of d.actions){if(out.some(a=>'id' in a&&a.id===d.id&&a.kind===x.kind))return no('azione_doppia',[d.id]);out.push(x)}
  notes.push(d.refId?'prezzo_da_riferimento':'ripristino')}
 const covered=new Set([...out.flatMap(a=>'id' in a?[a.id]:[]),...derived.flatMap(d=>d.refId?[d.refId,d.id]:[d.id]),...exclude.map(e=>e.id)]),padded=' '+msg+' '
 // Completezza (come il validatore attuale): un piatto nominato per intero e non toccato rende la richiesta incompleta. Non conta
 // il nome contenuto nel nome di un piatto toccato («caffè» dentro «caffè macchiato»). Con un riepilogo in sospeso non si controlla.
 const touched=refs.filter(r=>covered.has(r.id)&&padded.includes(' '+plain(r.name)+' ')).map(r=>' '+plain(r.name)+' ')
 const missed=input.pendingActions?.length?[]:refs.filter(r=>!covered.has(r.id)&&plain(r.name).length>=3&&padded.includes(' '+plain(r.name)+' ')&&refs.filter(x=>plain(x.name)===plain(r.name)).length===1&&!touched.some(t=>t!==' '+plain(r.name)+' '&&t.includes(' '+plain(r.name)+' ')))
 if(missed.length)return{intent:'clarify',plan:{type:'clarify',ids:missed.map(r=>r.id).slice(0,5),actions:out},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_nominato_senza_azione']}
 if(!out.length)return asks.length>=2?withHold({intent:'clarify',plan:{type:'clarify',ids:[]},exclude,aliasesUsed,replyDraft:'',notes}):no('nessuna_azione')
 return withHold(guard({type:'change',actions:out}))
}

/** Pianifica un messaggio del titolare: contesto → una chiamata → validatore. Mai eccezioni verso il route: o una decisione, o la riserva. */
export async function planOwnerMessage(input:BrainInput,key:string,opts:BrainCallOptions={}):Promise<BrainDecision|BrainFallback>{
 let ctx:BrainContext
 try{ctx=buildBrainContext(input)}catch(error){return{path:'fallback',reason:'contesto: '+String((error as any)?.message??error)}}
 if(input.refs.length>1500||input.message.length>30000)return{path:'fallback',reason:'troppo_grande',tokens:ctx.tokens}
 let call:BrainCall
 try{call=await callBrain(ctx,key,opts)}catch(error){return{path:'fallback',reason:error instanceof BrainUnavailable?error.reason:error instanceof GroqBusy?'busy':'errore',tokens:ctx.tokens}}
 if(process.env.TAKO_BRAIN_DEBUG)void import('node:fs').then(fs=>fs.appendFileSync(String(process.env.TAKO_BRAIN_DEBUG),'RAW '+call.content+'\n')).catch(()=>{})
 const decision=validateBrainPlan(call.content,ctx,{refs:input.refs,sections:input.sections,message:input.message,memory:input.memory,pendingActions:input.pendingActions,clarifySource:input.pending?.clarify?.source,clarifyIds:input.pending?.clarify?.itemIds,history:recentHistory(input.history??[],input.now),restorable:input.restorable,now:input.now,exclude:input.exclude,draftText:draftText(input.pending?.draft)})
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

