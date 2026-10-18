/** Cervello del bot titolare (17/10/2026, perimetro N) · UNA chiamata Groq JSON strict + validatore server.
 * Uscita del modello: {intent, actions[], read, item_refs, capability_ids, clarify, alias_used, reply_draft}.
 * Il server: riconverte i codici brevi in id, risolve «stesso prezzo di X» e «aumenta di N» rileggendo il menu,
 * passa tutto alle regole esistenti (validateMenuPlan: G9, piatti non nominati, prezzi detti, negazioni, completezza),
 * forza zero scritture sulle domande e produce un MenuPlan identico a quello del percorso attuale (turnFor lo applica,
 * G6 prezzi implausibili → conferma scritta). I fatti nella risposta li scrive il server DOPO la rilettura (composeReply).
 * Se Groq è giù, la quota è finita, il JSON non è valido o la chiamata è lenta → {path:'fallback'}: il route usa il
 * percorso deterministico attuale, invariato. */
import {chatModels,groqBase,withRateLimit,GroqBusy,parseJson,validateMenuPlan,describeAction,readText,planText,plain,g9DishMentioned,g9Prices,relativeDelta,type GroqOptions,type MenuRef,type SectionRef,type MenuAction,type MenuPlan} from './twilio-menu-ai.js'
import {negatedClauses,priceAlternatives,type Excluded} from './twilio-menu-clarify.js'
import {looksLikeQuestion,politeCommand,parseIntent,findDishes,foreignQualifier,diminutiveRivals} from './twilio-menu-nlu.js'
import {lostParts} from './twilio-menu-reading.js'
import {priceSanity} from './owner-brain-price-checks.js'
import {capabilities} from './twilio-menu-copy.js'
import type {Hold,HoldAsk} from './twilio-menu-hold.js'
import {salesLlmActions} from './twilio-menu-sales.js'
import {phoneticHits} from './twilio-menu-phonetic.js'
import {CONTROL_ACTIONS,politeRequest,isAffirmative,sameDishName,type ControlAction} from './owner-brain-r.js'
import {sameSection} from './twilio-menu-structure.js'
import {buildBrainContext,recentHistory,draftText,type BrainContextInput,type BrainContext,type BrainMemoryEntry,type BrainTurn} from './owner-brain-context.js'

export const BRAIN_ACTIONS=['restore','set_price','set_available','set_hidden','set_featured','set_description','add_tag','remove_tag','create_item','create_daily_special',...salesLlmActions,'delete_item','rename_item','move_item','create_section','rename_section',...CONTROL_ACTIONS] as const
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
  uncertain:{type:'array',items:{type:'object',additionalProperties:false,required:['phrase','candidates','action','value','price'],properties:{phrase:{type:'string'},candidates:{type:'array',items:{type:'string'}},action:{type:'string',enum:['none',...BRAIN_ACTIONS.filter(a=>!['restore','create_item','create_daily_special','delete_item','rename_item','move_item','create_section','rename_section',...CONTROL_ACTIONS].includes(a))]},value:nullable('boolean'),price:nullable('number')}}},
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

export type BrainInput=BrainContextInput&{pendingActions?:MenuAction[]|null,restorable?:Map<string,MenuAction[]>,exclude?:Excluded[],correction?:{previous:string,reason:string}|null,freshIds?:Set<string>}
export type BrainDecision={path:'brain',intent:'change'|'read'|'clarify'|'capability'|'chat',plan:MenuPlan,hold?:Hold,exclude:Excluded[],aliasesUsed:{phrase:string,itemId:string}[],replyDraft:string,notes:string[],usage:BrainUsage,tokens:BrainContext['tokens'],
 /** Fase R: strumenti di controllo scelti dal modello (li verifica il route), JSON del modello e bozza originale. */
 control?:ControlAction[],raw?:any,content?:string,draft?:string}
export type BrainFallback={path:'fallback',reason:string,usage?:BrainUsage,tokens?:BrainContext['tokens']}

const SAME_PRICE=/\b(puru|stess[oa]|stesso costo|come (?:il|la|lo|l|i|le|gli)\b|ugual\w*|identic[oa]|pari|idem|allineal\w*|allinea\w*|anche|pure)\b/
// Rimandi alla cronologia: pronomi, «anche/pure/uguale», correzioni, scelte («la seconda»).
const SWAP=/\b(intendevo|volevo dire|era (?:la|il|lo|l)|non (?:la|il|lo) .{0,20}(?:ma|era)|no(?:,)? (?:la|il|lo|l|i|le|gli)\b|scusa(?:,)? (?:la|il|lo|l|i|le|gli)\b|ho sbagliato)/
export const REFERS=/\b(fai|solo|anche|pure|puru|uguale|ugual\w*|idem|stess[oa]|mettil\w*|fall[aoie]\w*|portal\w*|toglil\w*|nascondil\w*|rimettil\w*|segnal\w*|quell[aoie]|quelli|quei|quegli|ambedue|quest[aoi]|no|scusa|anzi|invece|intendevo|volevo|sbagliato|errore|prim[oa]|second[oa]|terz[oa]|ultim[oa]|tutt\w*|entramb\w*|altr[oa])\b/
// 17/10 (correzioni A, v-deixis): rimandi a PIÙ piatti o per posizione nei messaggi recenti del titolare. «quei due», «entrambi»,
// «tutti e tre», «quelli», «mettili» → l'insieme dei piatti; «il primo», «l'ultimo» → uno solo; «tutti tranne X». Il validatore
// accetta un'azione senza nome solo se tocca ESATTAMENTE quei piatti; altrimenti chiede.
const DEIX_N:Record<string,number>={due:2,tre:3,quattro:4,'2':2,'3':3,'4':4}
const DEIX_PLURAL=/\b(?:quei|quegli|quelli|quelle|questi|queste|entramb\w*|tutti|tutte|ambedue)\b|\b(?:metti|nascondi|togli|rimetti|segna|porta|fa|cambia|alza|abbassa|aumenta|mostra|leva|lascia|toglie)(?:me)?li\b|\b(?:li|le) (?:metti|nascondi|togli|rimetti|segni|porti|cambi)\b/
const DEIX_ORD=/\b(?:il|la|l|lo|quest) ?(prim[oa]|second[oa]|terz[oa]|ultim[oa])\b(?! (?:piatt[oi] (?:del|della|di)|del pranzo|della cena))/
export function deixisReferents(msg:string,owners:string[],refs:MenuRef[],botList:string[]=[]):{kind:'set'|'one',ids:string[]}|null{
 const p=' '+plain(msg)+' ',ord=p.match(DEIX_ORD),ords=[...p.matchAll(new RegExp(DEIX_ORD.source,'g'))],except=p.match(/\btutt[ie] (?:tranne|eccetto|esclus[oaie]|meno) (.+)$/),plural=DEIX_PLURAL.test(p)
 if(!ord&&!plural&&!except)return null
 const posOf=(name:string,t:string)=>{const ws=plain(name).split(' ').filter(w=>w.length>=4);let best=Infinity;for(const w of ws.length?ws:plain(name).split(' ')){const i=t.search(new RegExp('\\b'+w.slice(0,5).replace(/[^a-z0-9]/g,'')));if(i>=0&&i<best)best=i}return best}
 const lists=owners.map(o=>{const t=' '+plain(o)+' ';return refs.filter(r=>g9DishMentioned(r.name,o,refs)).sort((a,b)=>posOf(a.name,t)-posOf(b.name,t)).map(r=>r.id)})
 // A7.9: l'elenco dell'ultima risposta del bot («Piatti nascosti: Gricia, Pasta al sugo») è il riferimento più recente.
 const lastMulti=botList.length?botList:[...lists].reverse().find(l=>l.length>0)
 const chrono:string[]=[];for(const l of lists)for(const id of l)if(!chrono.includes(id))chrono.push(id)
 // «il primo e l'ultimo», «il primo e il terzo»: più posizioni insieme.
 if(ords.length>=2){const seq=lastMulti&&lastMulti.length>=2?lastMulti:chrono,at=(w:string)=>/^prim/.test(w)?0:/^second/.test(w)?1:/^terz/.test(w)?2:seq.length-1;const ids=[...new Set(ords.map(m=>seq[at(m[1]!)]).filter((x):x is string=>!!x))];return{kind:'set',ids}}
 if(ord&&!plural){const seq=lastMulti&&lastMulti.length>=2?lastMulti:chrono,w=ord[1]!,i=/^prim/.test(w)?0:/^second/.test(w)?1:/^terz/.test(w)?2:seq.length-1;return{kind:'one',ids:seq[i]?[seq[i]!]:[]}}
 if(except){const named=refs.filter(r=>g9DishMentioned(r.name,except[1]!,refs)).map(r=>r.id);return{kind:'set',ids:(lastMulti&&lastMulti.length>=2?lastMulti:chrono).filter(id=>!named.includes(id))}}
 const nm=p.match(/\b(?:tutti|tutte|quei|quelle|questi|queste|i|le|gli|ambedue) (?:e )?(due|tre|quattro|2|3|4)\b/),n=nm?DEIX_N[nm[1]!]!:/\bentramb\w*|\bambedue\b/.test(p)?2:null
 if(lastMulti&&lastMulti.length>=(n??2))return{kind:'set',ids:n?lastMulti.slice(0,n):lastMulti}
 const back:string[]=[];for(const l of [...lists].reverse())for(const id of [...l].reverse())if(!back.includes(id))back.push(id)
 const want=n??2;if(back.length<want)return{kind:'set',ids:[]}
 const pick=back.slice(0,want);return{kind:'set',ids:chrono.filter(id=>pick.includes(id))}}
const FEAT_OFF=/\b(?:togli\w*|lev\w*|rimuov\w*|lev[ai]) (?:\w+ ){0,2}evidenza\b|\bnon (?:piu |più )?in evidenza\b|\bdall evidenza\b|\bdalla evidenza\b/,FEAT_ON=/\b(?:mett\w*|metti\w*) (?:\w+ ){0,5}in evidenza\b|\bevidenzia\w*\b/
const HID_ON=/\b(?:nascond\w*|togli\w*|lev\w*)\b/,HID_OFF=/\b(?:rimett\w*|mostr\w*|fa\w* vedere|visibil\w*|ricompar\w*)\b/
const AV_OFF=/\b(?:finit\w*|esaurit\w*|fernut\w*|terminat\w*)\b/,AV_ON=/\b(?:tornat\w*|disponibil\w*|di nuovo|ce di nuovo)\b|(?<!\b(?:non|nun|un|piu) )\bc e\b(?! piu)/
/** Prezzi messi sul piatto sbagliato: la parte del messaggio che nomina il piatto ha dei numeri ma non quel prezzo. */
export function priceClauseProblem(actions:MenuAction[],message:string,refs:MenuRef[]):string[]{
 const parts=message.split(/(?<!\d)[,;\n]|[,;\n](?!\d)|\s+(?:e|ed|poi|invece)\s+(?=(?:il|la|lo|l|i|gli|le|un|una)\b)/iu).map(x=>x.trim()).filter(Boolean);if(parts.length<2)return[]
 const byId=new Map(refs.map(r=>[r.id,r])),out:string[]=[]
 // Un pezzo con un prezzo e senza piatto («…, anzi no a 13», «mettila a 15») rende l'attribuzione incerta: niente controllo.
 if(parts.some(x=>g9Prices(x).length&&!refs.some(r=>g9DishMentioned(r.name,x,refs))))return[]
 for(const a of actions){if(!('id' in a)||!(a.kind==='price'||(a.kind==='promo'&&a.price!==null)))continue;const r=byId.get(a.id);if(!r)continue
  const mine=parts.filter(x=>g9DishMentioned(r.name,x,refs));if(mine.length!==1)continue;const nums=[...g9Prices(mine[0]!),...g9Prices(mine[0]!,false)];if(!nums.length)continue
  // «carbonara 13 e l'amatriciana un euro in meno»: la differenza detta è rispetto al prezzo detto nell'altra parte.
  {const rd=relativeDelta(mine[0]!);if(rd)for(const o of parts)if(o!==mine[0])for(const v of g9Prices(o))nums.push(Math.round((v+rd.delta)*100)/100)}
  if(!nums.includes(Math.round((a.price as number)*100)/100))out.push(a.id)}
  return out}
/** Fase R (Y, rinomina + prezzo): il piatto della parte «rinomina la gricia in …» (un altro verbo, nessun numero) non prende il
 * prezzo detto nella parte di un altro piatto («…, la carbonara a 13»). */
export function priceOfOtherClause(actions:MenuAction[],message:string,refs:MenuRef[]):string[]{
 const parts=message.split(/(?<!\d)[,;\n]|[,;\n](?!\d)|\s+(?:e|ed|poi|invece)\s+(?=(?:il|la|lo|l|i|gli|le|un|una)\b)/iu).map(x=>x.trim()).filter(Boolean);if(parts.length<2)return[]
 const out:string[]=[],VERB=/\b(?:rinomin\w*|chiam\w*|spost\w*|elimin\w*|cancell\w*|nascond\w*|finit\w*|esaurit\w*|evidenza)\b/i
 for(const a of actions){if(a.kind!=='price')continue;const r=refs.find(x=>x.id===a.id);if(!r)continue;const mine=parts.filter(x=>g9DishMentioned(r.name,x,refs));if(mine.length!==1||g9Prices(mine[0]!).length||!VERB.test(mine[0]!))continue
  const others=parts.filter(x=>x!==mine[0]&&g9Prices(x).length);if(others.length&&others.every(x=>refs.some(o=>o.id!==r.id&&g9DishMentioned(o.name,x,refs))))out.push(a.id)}
 return out}
/** Azioni con il verso opposto a quello detto nel messaggio (solo quando il messaggio ha un verso solo). */
export function polarityProblem(actions:MenuAction[],msg:string,refs?:MenuRef[]):string[]{const m=' '+msg+' ',out:string[]=[]
 // Verso per parte: «è finita la gricia, la carbonara c'è» → la carbonara non può diventare finita.
 if(refs)for(const a of actions){if(!('id' in a)||a.kind!=='available')continue;const r=refs.find(x=>x.id===a.id);if(!r)continue;const part=msg.split(/ (?:e|ed|ma) | , /).find(x=>g9DishMentioned(r.name,x,refs));if(!part)continue;const on=AV_ON.test(' '+part+' ')&&!AV_OFF.test(' '+part+' '),off=AV_OFF.test(' '+part+' ')&&!AV_ON.test(' '+part+' ');if((on&&!a.value)||(off&&a.value))out.push(a.id)}
 // «non è finita», «nun è finita» (dialetto): una negazione del verbo vieta proprio quell'azione.
 const notFinished=/\b(?:non|nun|un|nu)\s+(?:e|sono|so|song|ee|era)?\s*(?:ancora\s+)?(?:finit|esaurit|fernut)\w*/.test(m)
 for(const a of actions)if(notFinished&&'id' in a&&a.kind==='available'&&!a.value)out.push(a.id)
 const fOff=FEAT_OFF.test(m),fOn=FEAT_ON.test(m)&&!fOff,hOn=HID_ON.test(m)&&!HID_OFF.test(m)&&!/evidenza|promo|offert|scont|etichett/.test(m),hOff=HID_OFF.test(m)&&!HID_ON.test(m),aOff=AV_OFF.test(m)&&!AV_ON.test(m),aOn=AV_ON.test(m)&&!AV_OFF.test(m)
 for(const a of actions){if(!('id' in a))continue
  if(a.kind==='featured'&&((fOff&&a.value)||(fOn&&!a.value)))out.push(a.id)
  if(a.kind==='hidden'&&((hOn&&!a.value)||(hOff&&a.value)))out.push(a.id)
  if(a.kind==='available'&&((aOff&&a.value)||(aOn&&!a.value)))out.push(a.id)}
 return [...new Set(out)]}
// 17/10 (A4.4): messaggio misto, modifica + domanda («metti la parmigiana a 12 e dimmi quanto costa il tiramisù», «la parmigiana è
// finita, cosa altro è finito?», «cosa sai fare? intanto nascondi boh», «il tiramisù costa ancora 6? se sì mettilo a 7»).
// La modifica passa dai controlli sulla SUA parte; la domanda la risponde il server dopo aver salvato.
const MIX_CMD=/\b(?:metti\w*|mettil\w*|nascond\w*|togli\w*|toglil\w*|segna\w*|aggiung\w*|finit\w*|esaurit\w*|evidenza|cambia\w*|alza\w*|abbass\w*|aument\w*|rimetti\w*|porta\w*)\b|\b(?:a|costa) \d/
const MIX_ASK=/^(?:e\s+)?(?:dimmi|dammi|fammi sapere|quanto|quanti|quali|qual|cosa|cos|che cosa|che piatti|c e|ce|e ancora)\b/
export function mixedMessage(message:string):{command:string,question:string,conditional:boolean}|null{
 // A7.11: anche «…, e la gricia quanto la tengo?», «la tagliata è finita, il polpo c'è ancora?», «nascondi la bomba. quanti…?».
 const parts=message.split(/(?<=[?.!])\s+|(?<=\?)(?=\S)|,\s*(?:(?:e|ma|poi)\s+)?|\s+e\s+(?:poi\s+)?(?=dimmi\b|dammi\b|fammi sapere\b)/i).map(x=>x.trim()).filter(Boolean)
 if(parts.length<2)return null
 const q:string[]=[],c:string[]=[];for(const p of parts){const pl=plain(p);if(/\?\s*$/.test(p)||MIX_ASK.test(pl))q.push(p);else c.push(p)}
 if(!q.length||!c.length)return null
 const command=c.join(', ').replace(/^(?:intanto|poi|allora|e|ok)\s+/i,'').trim(),cp=plain(command)
 if(!MIX_CMD.test(cp)||looksLikeQuestion(command))return null
 return{command,question:q.join(' '),conditional:/^(?:e\s+)?se (?:si|e cosi|e vero|costa ancora|e ancora)\b/.test(cp)}}
const LEAVE=/\b(?:lascia\w* stare|lascia\w* perdere|lascial[oaie]\w*|non (?:lo |la |li |le )?(?:toccare|cambiare)|non toccarl\w*)\b/
const ORDINAL=/\b(prim[oa]|second[oa]|terz[oa]|quart[oa]|quint[oa]|ultim[oa]|[1-8]|tutt[ie]|entramb\w*|altr[oa])\b/
const UP=/\b(aument\w*|alz\w*|sal\w*|piu|rincar\w*)\b/,DOWN=/\b(abbass\w*|diminu\w*|scont\w*|scal\w*|meno|togli\w*|lev[ai]\w*|ridu[cr]\w*|cal[ai]\w*)\b/

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
const relativeNumbers=(message:string)=>{const out=new Set<number>(),p=plain(message);{const rd=relativeDelta(message);if(rd)out.add(Math.abs(rd.delta))}for(const m of p.matchAll(/\b(\w+)(?: euro)? (?:in|di) (?:meno|piu)\b/g)){const v=g9Prices('a '+m[1]!);for(const x of v)out.add(x)}return out}
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
  case 'create_item':return{action:a.action,section_id:map(a.section),section_name:map(a.section)?null:a.section,name:a.name,price:a.price,description:a.text}
  // Fase B (17/10): struttura del menu. Una categoria nuova si indica col suo nome in section (non ha un codice).
  case 'delete_item':return base
  case 'rename_item':return{...base,name:a.name}
  case 'move_item':return{...base,section_id:map(a.section),section_name:map(a.section)?null:a.section}
  case 'create_section':return{action:a.action,name:a.name??a.section}
  case 'rename_section':return{action:a.action,section_id:map(a.section),name:a.name}
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
/** Fase R: numeri già «letti» dalle azioni che non sono prezzi: «ne restano 3» con le ultime porzioni, «50 centesimi» di una
 * differenza di prezzo. Tolti solo dal testo che controlla le parti perse. */
const UNIT_DIGIT:Record<string,string>={due:'2',tre:'3',quattro:'4',cinque:'5',sei:'6',sette:'7',otto:'8',nove:'9',dieci:'10'}
function quantitiesRead(text:string,actions:MenuAction[],refs?:MenuRef[]){let t=text
 if(actions.some(a=>a.kind==='scarcity'))t=t.replace(/\b(?:ne\s+)?(?:restano|rimangono|rimasti|rimaste|ho|abbiamo|solo|ancora|ultim[eiao])\s+(?:solo\s+|ancora\s+)?\d+\b|\b\d+\s+(?:porzioni|pezzi)\b/gi,' ')
 if(relativeDelta(text))t=t.replace(/\b\d+\s*(?:centesimi|cent)\b/gi,' ')
 // R5.1: «la birra da 66 a 6» (il prezzo di prima detto per confronto), «0,4 l», «33 cl» (formato), «X, anzi Y» (la parte ritirata).
 t=t.replace(/\bda\s+\d+(?:[.,]\d+)?\s*(?:euro|eur|€)?\s+(?=a\s+\d)/gi,' ').replace(/\b\d+(?:[.,]\d+)?\s*(?:l|lt|litri?|cl|ml|gr?|kg)\b/gi,' ')
 t=t.replace(/^[^,;]*?,?\s*\banzi\b(?:\s+no)?\s*,?/i,' ')
 // R6.1 (M1): numeri che non sono prezzi: «siamo in 3», «tavolo 7», «40 coperti», «alle 13»; il numero in cifre dentro il nome di
 // un piatto («4 stagioni» = Quattro stagioni). (M2): parte ritirata senza «anzi» («…a 13, no lascia / annulla / cancella questa, …»),
 // piatto ritirato in fondo («…, la carbonara no»).
 t=t.replace(/\b(?:siamo|eravamo|saremo|sono)\s+(?:in\s+)?\d+\b/gi,' ').replace(/\b(?:tavol[oi]|camera)\s+(?:n\.?\s*|numero\s+)?\d+\b/gi,' ').replace(/\b\d+\s+(?:coperti|persone|ospiti|tavoli|clienti|prenotazioni|bambini|adulti)\b/gi,' ').replace(/\b(?:alle|dalle|verso le|ore)\s+\d{1,2}(?:[:.]\d{2})?\b/gi,' ')
 for(const r of refs??[]){const w=plain(r.name).split(' '),d=UNIT_DIGIT[w[0]!];if(d&&w.length>1)t=t.replace(new RegExp('\\b'+d+'\\s+'+w.slice(1).join('\\s+')+'\\b','gi'),r.name)}
 t=t.replace(/[^,;()]*\d[^,;()]*[,(]\s*(?:no\b[\s,]*)?(?:lascia\w*|annulla\w*|cancella\w*(?:\s+questa)?)\s*\)?\s*,?/gi,' ')
 for(const m of [...t.matchAll(/[,;.…]\s*(?:e\s+)?(?:no\s+)?(?:il|la|lo|l'|i|le|gli)?\s*([\p{L}' ]{3,40}?)\s+(?:no|niente)\s*$/giu)]){const name=plain(m[1]!);if(name.length<3)continue;t=t.split(/(?=[,;.…])/).filter(x=>!(' '+plain(x)+' ').includes(' '+name+' ')||x===m[0]).join('')}
 return t}
export function validateBrainPlan(raw:unknown,ctx:Pick<BrainContext,'codes'>,input:Parameters<typeof validateBrainPlanCore>[2]):ReturnType<typeof validateBrainPlanCore>{
 const d=validateBrainPlanCore(raw,ctx,input)
 // R6.1 (avversaria Z): prezzi compatibili col testo e col prezzo attuale (numeri spezzati, percentuali, verso del verbo).
 if(d.intent==='change'&&d.plan.type==='change'){const bad=priceSanity(dialectNumbers(input.message),d.plan.actions,input.refs);if(bad)return{...d,intent:'clarify',plan:{type:'clarify',ids:bad.ids.slice(0,5)} as MenuPlan,notes:[...d.notes,bad.note]}}
 // A8.0 (Y, parti perse): il piano deve usare i numeri detti e avere l'azione di ogni verbo esplicito del messaggio.
 if(d.intent==='change'&&d.plan.type==='change'&&!input.pendingActions?.length&&!d.plan.actions.some(a=>(a as any).fromRestore)&&!(input.clarifyIds?.length&&plain(input.message).split(' ').length<=3)){const mix=mixedMessage(input.message),lost=lostParts(quantitiesRead(mix?mix.command:input.message,d.plan.actions,input.refs),d.plan.actions,input.refs,input.sections)
  if(lost.length){
   // Le parti capite restano in sospeso (proposta `hold`) e si chiede della parte non letta, citandola: mai pubblicate a metà.
   const text=mix?mix.command:input.message,parts=text.split(/\s*[,;]\s*|\s+(?:e|ed|poi)\s+/).map(x=>x.trim()).filter(Boolean),fold0=(x:string)=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
   const bad=[...new Set(lost.map(w=>parts.find(p=>fold0(p).replace(/,/g,'.').includes(w))??w))].slice(0,3)
   return{...d,intent:'clarify',plan:{type:'clarify',ids:[]} as MenuPlan,hold:{kind:'hold',actions:d.plan.actions,asks:bad.map(w=>({type:'unknown' as const,word:w}))},notes:[...d.notes,'parte_persa:'+lost.slice(0,3).join(',')]}}}
 return d}
function validateBrainPlanCore(raw:unknown,ctx:Pick<BrainContext,'codes'>,input:{freshIds?:Set<string>,refs:MenuRef[],sections:SectionRef[],message:string,memory?:BrainMemoryEntry[],pendingActions?:MenuAction[]|null,clarifySource?:string|null,clarifyIds?:string[]|null,history?:BrainTurn[],restorable?:Map<string,MenuAction[]>,now?:number,exclude?:Excluded[],draftText?:string,twinIds?:string[]}):Omit<BrainDecision,'path'|'usage'|'tokens'>{
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
 // A5 (17/10): nomi storpiati dalla trascrizione. Suono forte e unico («kenesac» = Che ne sacc) → il piatto vale come nominato;
 // suono debole («Bu» ≈ boh) → l'azione diventa una domanda «Intendi *boh*?», mai una scrittura diretta.
 const sound=phoneticHits(message,refs)
 for(const id of sound.strong)if(!g9DishMentioned(byId.get(id)!.name,message,refs))trusted.add(id)
 // Fase R: «sì» a una domanda su UN solo candidato («intendi boh?») → quel piatto vale come nominato.
 if((input.clarifyIds??[]).length===1&&byId.has(input.clarifyIds![0]!)&&isAffirmative(input.message))trusted.add(input.clarifyIds![0]!)
 // R9: risposta alla domanda «c'è già X: lo aggiorno o ne creo un altro?» → i piatti con lo stesso nome sono nominati (dalla richiesta originale).
 for(const id of input.twinIds??[])if(byId.has(id))trusted.add(id)
 // Fase R: «bò»/«bo» = «boh» (solo accento o h muta): è il nome, non un suono incerto.
 for(const id of sound.weak){const ph=sound.phrase.get(id);if(ph&&plain(ph).replace(/h/g,'')===plain(byId.get(id)!.name).replace(/h/g,''))trusted.add(id)}
 const weakIds=new Set(sound.weak.filter(id=>!trusted.has(id)&&!g9DishMentioned(byId.get(id)!.name,message,refs)))
 // Fase R: «sono tornati tutti i dolci», «nascondi tutte le pizze»: la categoria nominata per intero nomina i suoi piatti.
 // R9: anche nella richiesta originale legata alla TUA domanda aperta («metti i primi tutti a 11» → «si»).
 for(const m of (msg+(source?' \n '+source:'')).matchAll(/\btutt[ieoa] (?:i |le |gli )?(\w+)|\b(?:i|le|gli) (\w+) tutt[ieoa]\b/g)){const secs=sections.filter(s=>sameSection(s.name,(m[1]??m[2])!));if(secs.length===1)for(const r of refs)if(r.sectionId===secs[0]!.id)trusted.add(r.id)}
 const trustedHas=(id:string)=>trusted.has(id)
 const reply=typeof data.reply_draft==='string'?data.reply_draft.slice(0,600):''
 // «no, la parmigiana no»: il «no,» in testa non è una clausola (stessa normalizzazione del percorso di prima).
 // «la gricia no, lasciala a 11»: un valore detto per il piatto «negato» è una correzione, non un'esclusione.
 const neg0=negatedClauses(message.replace(/^\s*no\s*[,;.!]\s*(?=.+\bno\s*[.!]?\s*$)/i,''),refs),neg=neg0&&/\b(?:lascial[aoie]|tienil[aoie]|mettil[aoie]|rimettil[aoie])\s+a\s+\d/i.test(message)?null:neg0,exclude:Excluded[]=[...(neg?.excluded??[]),...(input.exclude??[]).filter(e=>!neg?.excluded.some(x=>x.id===e.id))]
 // Domande → zero scritture, qualunque cosa dica il modello («la carbonara 13 o 14?», «quanto costa la carbonara?»).
 // Messaggio misto (A4.4): la parte di domanda non blocca la modifica detta nell'altra parte.
 const mix=mixedMessage(message)
 // «Che ne sacc costa 16», «che nesac costa 16»: il nome del piatto che inizia con «che» non fa del messaggio una domanda.
 const dishLead=!/\?/.test(message)&&/^(?:che|come|quando|cosa)\b/.test(msg)&&(refs.some(r=>msg.startsWith(plain(r.name)+' '))||sound.strong.some(id=>msg.startsWith((sound.phrase.get(id)??'\u0000')+' ')))
 // «…a 13, ok?», «…, va bene?» in coda a un comando non fanno del messaggio una domanda.
  const qText=message.trim().split(/\s+/).length>=4?message.replace(/[,\s]+(?:ok|okay|va bene|d['’ ]?accordo|grazie|perfetto|si|sì)\s*[?!.]*\s*$/i,''):message
  // Prezzi alternativi («la coda a 17 o 18») segnati dal modello come parte incerta: le parti chiare restano, si chiede.
  const altQ=!!priceAlternatives(message,refs)&&!(Array.isArray(data.uncertain)&&data.uncertain.length>0&&Array.isArray(data.actions))
  const question=!mix&&!dishLead&&((looksLikeQuestion(qText)&&!politeCommand(qText)&&!politeRequest(qText)&&!(altQ===false&&!!priceAlternatives(message,refs)&&!/\?\s*$/.test(message)))||altQ)
 // Misto con azioni: anche se il modello lo legge come domanda/chiacchiera/capacità, la parte di modifica si valida come change.
 const mixAsChange=!!mix&&Array.isArray(data.actions)&&data.actions.length>0&&['read','capability','chat'].includes(intent)
 if(mix?.conditional){const qp=plain(mix.question),m=qp.match(/\bcosta(?:no)? (?:ancora |sempre )?(\w+)/),n=m?g9Prices('a '+m[1]!)[0]:undefined,d=refs.find(r=>g9DishMentioned(r.name,mix.question,refs))
  if(d&&n!==undefined&&Math.abs(d.price-n)>=0.005)return{intent:'read',plan:{type:'read',read:'items',ids:[d.id]},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'condizione_falsa']}}
 if(intent==='chat'&&!mixAsChange)return{intent,plan:{type:'clarify',ids:[]},exclude,aliasesUsed,replyDraft:reply,notes}
 if(intent==='capability'&&!mixAsChange)return{intent,plan:validateMenuPlan({intent:'capability',capability_ids:(Array.isArray(data.capability_ids)?data.capability_ids:[]).filter((c:unknown)=>c==='all'||capabilities.some(x=>x.id===c))},refs,{sections,message}),exclude,aliasesUsed,replyDraft:reply,notes}
 // «il supplì è finito» letto come domanda («cosa è finito?»): non è una domanda → si chiede quale piatto, con l'azione capita.
 if(intent==='read'&&!mixAsChange&&(data.read==='unavailable'||data.read==='hidden')&&!looksLikeQuestion(message)&&/\b(finit\w*|esaurit\w*|nascond\w*|togli\w*|fernut\w*)\b/.test(msg)){const i=parseIntent(message),opts2=[...new Set([...refIds(data.clarify?.item_refs),...refIds(data.item_refs),...(i&&'target' in i?findDishes((i as any).target,refs).map(r=>r.id):[])])].slice(0,8)
  const act=i&&(i.kind==='available'||i.kind==='hidden')&&opts2.length?{kind:i.kind,id:opts2[0]!,value:(i as any).value} as MenuAction:null
  return{intent:'clarify',plan:opts2.length>1&&act?{type:'clarify',ids:opts2,actions:[act]}:{type:'clarify',ids:opts2},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'lettura_non_domanda']}}
 if(intent==='read'&&!mixAsChange){const ids=refIds(data.item_refs);if(data.read==='unavailable'||data.read==='hidden')return{intent,plan:{type:'read',read:data.read},exclude,aliasesUsed,replyDraft:reply,notes};const rivals=ids.flatMap(id=>trustedHas(id)?[]:rivalDishes(id,message,refs).filter(r=>!ids.includes(r)))
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
  // Fase R: piatto chiaro ma valore da chiedere («la coda a 17 o 18»): la domanda porta il candidato (la risposta «17» lo usa).
  if(cands.length>=1){asks.push({type:'choose',word,options:cands,template:null});continue}
  asks.push({type:'unknown',word})}
 // Contesto (fase 2): un messaggio che rimanda a prima («mettila a 13», «e la gricia uguale», «no scusa 14», «sì la seconda»)
 // può riferirsi a piatti nominati nella cronologia (ultimi messaggi del titolare + ultima risposta del bot) e a prezzi detti
 // DAL TITOLARE nella cronologia. Mai prezzi presi dalle risposte del bot; mai creazioni dal contesto.
 const history=input.history??[],owners=history.filter(t=>t.role==='owner').slice(-3).map(t=>dialectNumbers(t.text)),lastBotText=[...history].reverse().find(t=>t.role==='bot')?.text??''
 const hasCreate=actions.some((a:any)=>a?.action==='create_item'||a?.action==='create_daily_special')
const lastBotTurn=[...history].reverse().find(t=>t.role==='bot'),staleQuestion=!!lastBotTurn&&BOT_QUESTION.test(lastBotTurn.text)&&(input.now??Date.now())-lastBotTurn.at>PENDING_MS
 // Una domanda del bot vale 10 minuti (come le proposte in sospeso): dopo, la risposta breve non la completa più.
 // Fase R: con una domanda aperta del bot (candidati in sospeso) la risposta usa sempre il contesto («la nonna e la media»).
 const compar0=/^(?:e|ed|anche|pure)\b/.test(msg)&&!!relativeDelta(message)
 const ctxOK=!hasCreate&&history.length>0&&!staleQuestion&&(REFERS.test(msg)||msg.split(' ').length<=4||!!input.clarifyIds?.length||compar0)
 const dishText=ctxOK?[message,...owners,lastBotText].join(' \n '):hasCreate&&input.draftText?message+' \n '+input.draftText:message,priceText=ctxOK?[message,...owners].join(' \n '):message
 const botLabels=[...lastBotText.matchAll(/\*([^*\n]{2,80})\*\s*:/g)].map(m=>plain(m[1]!))
 const mentioned=(id:string)=>trusted.has(id)||g9DishMentioned(byId.get(id)!.name,dishText,refs)
 // Prezzo ricavato: «aumenta di 1» (delta sul prezzo attuale) e «stesso prezzo di X» (valore riletto dal menu).
 const explicit=new Map<string,number>();for(const a of actions)if(a?.action==='set_price'&&typeof a.price==='number'){const id=map(a.item);if(id)explicit.set(id,a.price)}
 const legacy:any[]=[],derived:{id:string,actions:MenuAction[],refId?:string}[]=[],deltaIds=new Set<string>()
 const no=(note:string,ids:(string|null)[]=[])=>({intent:'clarify' as const,plan:{type:'clarify' as const,ids:ids.filter((x):x is string=>!!x&&byId.has(x))},exclude,aliasesUsed,replyDraft:'',notes:[...notes,note]})
 for(const a of actions){if(!a||typeof a!=='object'||!BRAIN_ACTIONS.includes(a.action))return no('azione_sconosciuta',actions.map((x:any)=>map(x?.item)))
  const id=map(a.item)
  if(a.action==='restore'){if(!id||!byId.has(id)||!mentioned(id))return no('ripristino_non_valido',[id]);const back=input.restorable?.get(id);if(!back?.length)return no('ripristino_impossibile',[id]);derived.push({id,actions:back.map(b=>({...b,fromRestore:true}) as unknown as MenuAction)});continue}
  if(a.action==='set_price'&&a.price==null&&typeof a.price_delta==='number'&&id&&byId.has(id)){const d=a.price_delta,dir=d>0?UP:DOWN;if((!dir.test(msg)&&!(d>0?/\+\s*\d/:/(?:^|[\s(])-\s*\d/).test(message))||/\b(?:a|costa|prezzo|fallo|mettil\w*)\s*[-–]\s*\d/i.test(message))return no('delta_senza_verbo',[id]) /* «a -1» è un prezzo negativo, non una differenza (R5.1) */;legacy.push({action:'set_price',item_id:id,price:Math.round((byId.get(id)!.price+d)*100)/100});deltaIds.add(id);continue}
  if(a.action==='set_price'&&a.price==null&&typeof a.price_ref==='string'){const refId=map(a.price_ref)
   // Il piatto di riferimento è nominato in questo messaggio, oppure è proprio quello dell'ultima risposta del bot («*Carbonara*: …»).
   const labelled=refId?botLabels.includes(plain(byId.get(refId)?.name??'')):false
   if(!id||!refId||!byId.has(id)||!byId.has(refId)||refId===id||!SAME_PRICE.test(msg)||!(g9DishMentioned(byId.get(refId)!.name,message,refs)||trusted.has(refId)||(ctxOK&&labelled)))return no('riferimento_prezzo_non_valido',[id,refId])
   derived.push({id,actions:[{kind:'price',id,price:explicit.get(refId)??byId.get(refId)!.price}],refId});continue}
  legacy.push(legacyAction(a,map))}
 // R5.1 (nota 64): niente più ripristino automatico deciso dal server su «scusa/intendevo X»: col cervello unico il «rimetti com'era»
 // lo decide il modello (restore); il server non indovina («scusa, la lasagna è finita» NON è una correzione della carbonara).
 const opts={sections,message,exclude:[...exclude,...candCovered.map(id=>({id}))],trustedIds:trusted.size||weakIds.size?new Set([...trusted,...weakIds]):undefined}
 const withHold=(d:Omit<BrainDecision,'path'|'usage'|'tokens'>):Omit<BrainDecision,'path'|'usage'|'tokens'>=>{if(!asks.length)return d
  if(d.plan.type!=='change'&&!(d.plan.type==='clarify'&&!d.plan.ids.length))return d
  const clear=d.plan.type==='change'?d.plan.actions:[];if(asks.length<2&&!clear.length)return d
  return{...d,intent:'clarify',plan:{type:'clarify',ids:[]},hold:{kind:'hold',actions:clear,asks},notes:[...d.notes,'parti_incerte']}}
 const guard=(plan:MenuPlan):Omit<BrainDecision,'path'|'usage'|'tokens'>=>{if(plan.type!=='change')return{intent:'clarify',plan,exclude,aliasesUsed,replyDraft:'',notes}
  const ids=[...new Set(plan.actions.flatMap(a=>'id' in a&&typeof (a as any).id==='string'?[(a as any).id as string]:[]))],rivals=ids.flatMap(id=>trustedHas(id)?[]:rivalDishes(id,message,refs).filter(r=>!ids.includes(r)))
  // Piatti indicati in modo ambiguo o coperti da un altro: le azioni chiare restano, per ognuna ambigua una domanda «quale?»
  // con l'azione già capita (proposta hold o scelta), mai una scelta del modello e mai la richiesta intera persa.
  const dim=(id:string)=>{const t=byId.get(id)!;return message.split(/[,;]|\s+e\s+/).filter(x=>g9DishMentioned(t.name,x,refs)).flatMap(x=>diminutiveRivals(x,t,refs).map(o=>o.id))}
   const openSet=new Set(input.clarifyIds??[]),inOpen=(x:string)=>!openSet.size||!openSet.has(id0)||openSet.has(x);let id0=''
   const doubt=new Map<string,string[]>();for(const id of ids){if(trustedHas(id))continue;id0=id;const r=[...rivalDishes(id,message,refs),...dominatedBy(id,message,refs),...dim(id)].filter(x=>x!==id&&inOpen(x));if(r.length)doubt.set(id,[id,...new Set(r)])}
  if(doubt.size){const clear=plan.actions.filter(a=>!('id' in a)||!doubt.has((a as any).id)),amb=plan.actions.filter(a=>'id' in a&&doubt.has((a as any).id))
   const asks2:HoldAsk[]=amb.map(a=>{const {id,...template}=a as any;return{type:'choose' as const,word:refs.find(r=>r.id===id)?.name??'',options:doubt.get(id)!.slice(0,8),template}})
   if(!clear.length&&asks2.length===1)return{intent:'clarify',plan:{type:'clarify',ids:asks2[0]!.type==='choose'?asks2[0]!.options:[],actions:[amb[0]!]},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_ambiguo']}
   return{intent:'clarify',plan:{type:'clarify',ids:[]},hold:{kind:'hold',actions:clear,asks:[...asks2,...asks]},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_ambiguo']}}
  // 17/10 (correzioni A): in una richiesta con più piatti e prezzi («carbonara 13, lasagna 12») ogni prezzo deve stare nella parte
  // che nomina quel piatto: un modello che scambia i prezzi tra i piatti non scrive.
  {const swapped=[...priceClauseProblem(plan.actions.filter(a=>!derived.some(d=>d.id===('id' in a?a.id:''))),message,refs),...priceOfOtherClause(plan.actions.filter(a=>!derived.some(d=>d.id===('id' in a?a.id:''))),message,refs)];if(swapped.length)return{intent:'clarify',plan:{type:'clarify',ids:swapped.slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'prezzo_di_un_altro_piatto']}}
  // 17/10 (correzioni A): il valore deve avere il verso detto («togli l'evidenza» → mai in evidenza; «finito» → mai disponibile).
  {const restored=new Set(derived.filter(d=>!d.refId).map(d=>d.id)),bad=polarityProblem(plan.actions.filter(a=>!('id' in a)||!restored.has(a.id)),msg,refs);if(bad.length)return{intent:'clarify',plan:{type:'clarify',ids:bad.slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'valore_contrario']}}
  // Il nome nuovo di una rinomina («rinomina il pollo in Pollo alla diavola») non è un qualificatore del piatto.
  {const fq=plan.actions.reduce((m,a)=>a.kind==='rename'?m.replace(new RegExp(a.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),' '):m,message),foreign=plan.actions.filter(a=>'id' in a&&!derived.some(d=>d.id===(a as any).id)).map(a=>refs.find(r=>r.id===(a as any).id)).filter((r):r is MenuRef=>!!r&&foreignQualifier(fq,r,refs));if(foreign.length)return{intent:'clarify',plan:{type:'clarify',ids:[]},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_diverso']}}
  const rel=relativeNumbers(message);if(plan.actions.some(a=>(a.kind==='price'||(a.kind==='promo'&&a.price!==null))&&rel.has(Math.round((a.price as number)*100)/100)&&!deltaIds.has(a.id)))return{intent:'clarify',plan:{type:'clarify',ids:ids.slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'differenza_come_prezzo']}
  // Rimando senza nome («mettila a 13», «no scusa 14»): vale solo per il piatto (unico) del messaggio precedente del titolare
  // o per quelli dell'ultima risposta del bot; con due piatti prima, o un altro argomento in mezzo, si chiede.
  if(ctxOK){const prevOwner=owners.at(-1)??'',pd=refs.filter(r=>g9DishMentioned(r.name,prevOwner,refs)).map(r=>r.id),bd=refs.filter(r=>g9DishMentioned(r.name,lastBotText,refs)).map(r=>r.id)
   const bare=ids.filter(id=>!trustedHas(id)&&!g9DishMentioned(byId.get(id)!.name,message,refs)&&!derived.some(d=>d.refId===id))
   // Un prezzo senza piatto («no scusa 14») corregge solo un prezzo detto nel messaggio precedente, mai un «finito».
   // Fase R: «anche la lasagna» → «no scusa 14»: il prezzo cambiato l'ha scritto il server nell'ultima risposta (riga «X: prezzo da»).
   const botChanged=(id:string)=>{const r=byId.get(id);return !!r&&plain(lastBotText).includes(plain(r.name)+' prezzo da')}
   const priceBare=(id:string)=>plan.actions.some(a=>'id' in a&&a.id===id&&(a.kind==='price'||a.kind==='promo'))&&!g9Prices(prevOwner).length&&!looksLikeQuestion(prevOwner)&&!botChanged(id)
   // Risposta a una domanda del bot sulla richiesta di prima: quella richiesta (anche con più piatti) torna valida per intero.
   const answering=BOT_QUESTION.test(lastBotText)
   const botList=/(?:^|\s)[-•]\s+\S/.test(lastBotText)&&!/\?/.test(lastBotText)?refs.filter(r=>g9DishMentioned(r.name,lastBotText,refs)).sort((a,b)=>lastBotText.indexOf(a.name)-lastBotText.indexOf(b.name)).map(r=>r.id):[]
   const deix=answering||(input.clarifyIds??[]).length>1?null:deixisReferents(message,owners,refs,botList)
   const deixBad=deix?(bare.length&&(bare.some(id=>!deix.ids.includes(id))||(deix.kind==='set'&&deix.ids.some(id=>!ids.includes(id)))||!deix.ids.length)):false
   const bad=deix?(deixBad?bare:[]).concat(bare.filter(priceBare)):bare.filter(id=>!(pd.includes(id)||bd.includes(id))||(pd.length>1&&!bd.includes(id)&&!ORDINAL.test(msg)&&!answering)||priceBare(id))
   // «anche gli altri due»: gli «altri» non sono i piatti di cui si parlava (mai lo stesso piatto di prima).
   if(/\b(?:gli altri|le altre|l altro|l altra|altri due|altre due|altri tre)\b/.test(msg)){const again=bare.filter(id=>pd.includes(id));if(again.length)bad.push(...again)}
   if(bad.length)return{intent:'clarify',plan:{type:'clarify',ids:[...new Set([...pd,...bad])].filter(id=>byId.has(id)).slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'rimando_incerto']}}
  // Scelta aperta tra più piatti: «sì», «ok», «vai» non scelgono. Serve il nome, un ordinale o «tutti e due».
  // R9: la domanda sui piatti con lo stesso nome sceglie tra aggiornare e creare, non tra piatti: non serve un nome.
  const open=(input.twinIds?.length?[]:(input.clarifyIds??[])).filter(id=>byId.has(id))
  if(open.length>1&&ids.some(id=>open.includes(id))&&!ids.every(id=>!open.includes(id)||trustedHas(id)||g9DishMentioned(byId.get(id)!.name,message,refs))&&!ORDINAL.test(msg))return{intent:'clarify',plan:{type:'clarify',ids:open.slice(0,5)},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'scelta_non_detta']}
  return{intent:'change',plan,exclude,aliasesUsed,replyDraft:'',notes}}
 // Con contesto o azioni derivate: le azioni «normali» passano dal validatore attuale sul testo con il contesto; i prezzi devono
 // comparire nel messaggio o in un messaggio recente del titolare; completezza ricontrollata sul solo messaggio.
 // Fase R: «no, nei primi» subito dopo uno spostamento corregge lo spostamento (il verbo era nel messaggio di prima).
 const moveFix=/^(?:no|anzi|scusa)\b/.test(msg)&&/\b(?:nei|negli|nelle|nella|nel|tra|fra|in)\s/.test(msg)&&/\b(?:spost\w*|mett\w*)\b/.test(plain(owners.at(-1)??''))
 const base=legacy.length?validateMenuPlan({intent:'change',actions:legacy},refs,{...opts,message:dishText,checkCompleteness:false,verbText:message+(moveFix?' (sposta)':''),implicitSections:true,freshIds:input.freshIds}):{type:'change',actions:[]} as MenuPlan
 if(base.type!=='change')return{intent:'clarify',plan:base,exclude,aliasesUsed,replyDraft:'',notes}
 if(ctxOK){const said=g9Prices(priceText),inMsg=g9Prices(message),prevOwner=owners.at(-1)??''
  // Un prezzo preso dal contesto (non detto in QUESTO messaggio) vale solo se è il prezzo attuale di un piatto del messaggio
  // precedente («e la gricia uguale» = stesso prezzo della carbonara appena cambiata), mai un numero sparso («sei e cinquanta» → 50).
  const ctxPrices=new Set(refs.filter(r=>g9DishMentioned(r.name,prevOwner,refs)||g9DishMentioned(r.name,lastBotText,refs)).map(r=>Math.round(r.price*100)/100))
  // Dopo una domanda del bot (≤10 minuti) la risposta completa la richiesta di prima: valgono anche i prezzi di quel messaggio.
  // R9: con una TUA domanda aperta valgono anche i prezzi della richiesta originale legata alla domanda (detti dal titolare).
  const afterQuestion=[...(BOT_QUESTION.test(lastBotText)?g9Prices(prevOwner):[]),...(input.clarifySource?g9Prices(dialectNumbers(input.clarifySource)):[])]
  // 17/10 (A2.3): un prezzo del contesto vale solo con un rimando esplicito («uguale», «anche», «no, il tiramisù»), mai in un
  // messaggio che dice di lasciare stare («no, il caviale lascialo stare» era diventato il caviale a 10 €).
  const ctxPriceOK=(SAME_PRICE.test(msg)||SWAP.test(msg))&&!LEAVE.test(msg)
  const refPlusOK=(v:number)=>{const rd=relativeDelta(message);return !!rd&&refs.some(r=>new RegExp('\\b(?:come|ugual\\w*|stess\\w* prezzo d\\w*)\\s+(?:(?:a|al|alla|allo|il|la|lo|l|del|della)\\s+)*'+plain(r.name).split(' ')[0]!+'\\b').test(msg)&&Math.abs(r.price+rd.delta-v)<0.005)}
  // «metti la carbonara a 13» → «e la gricia a uno in meno» = 12: la differenza è rispetto al prezzo appena scritto (riga del bot).
  const rdc=relativeDelta(message),botNew=[...lastBotText.replace(/\*/g,'').matchAll(/prezzo da [\d.,]+\s*€ a ([\d.,]+)\s*€/g)].map(m=>Number(m[1]!.replace(/\./g,'').replace(',','.'))),compar=!!rdc&&/^(?:e|ed|anche|pure)\b/.test(msg)
  for(const a of base.actions)if((a.kind==='price'||(a.kind==='promo'&&a.price!==null))&&!deltaIds.has(a.id)){const v=Math.round((a.price as number)*100)/100;if(!inMsg.includes(v)&&!afterQuestion.includes(v)&&!(ctxPriceOK&&said.includes(v)&&ctxPrices.has(v))&&!(compar&&botNew.some(b=>Math.abs(b+rdc!.delta-v)<0.005))&&!refPlusOK(v))return no('prezzo_non_detto',[a.id])}
  // Comparativo con una differenza applicata al prezzo attuale dell'altro piatto: ambiguo, si chiede (o si scrive il prezzo esplicito).
  if(compar&&botNew.length&&deltaIds.size)return no('differenza_come_prezzo',[...deltaIds])}
  // «la gricia come la carbonara più 1»: la differenza è rispetto al piatto di riferimento, non al prezzo attuale.
  {const rdr=relativeDelta(message),refR=rdr?refs.find(r=>new RegExp('\\b(?:come|ugual\\w*|stess\\w* prezzo d\\w*)\\s+(?:(?:a|al|alla|allo|il|la|lo|l|del|della)\\s+)*'+plain(r.name).split(' ')[0]!+'\\b').test(msg)):undefined
   if(refR){if([...deltaIds].some(id=>id!==refR.id))return no('differenza_come_prezzo',[...deltaIds])
    for(const a of base.actions)if(a.kind==='price'&&a.id!==refR.id&&Math.abs(a.price-(refR.price+rdr!.delta))>=0.005&&!g9Prices(message).includes(Math.round(a.price*100)/100))return no('prezzo_non_detto',[a.id])}}
 const out:MenuAction[]=[...base.actions]
 for(const d of derived){if(!mentioned(d.id))return no('piatto_non_nominato',[d.id])
  for(const x of d.actions){if(out.some(a=>'id' in a&&a.id===d.id&&a.kind===x.kind))return no('azione_doppia',[d.id]);out.push(x)}
  notes.push(d.refId?'prezzo_da_riferimento':'ripristino')}
 // A7.10 (G12): una correzione («anzi no, mettila in evidenza», «no scusa, è finita la gricia, la carbonara c'è», «…la carbonara
 // lasciala stare») rimette com'era quello che l'ultima modifica aveva cambiato e che il messaggio non ripete.
 if(input.restorable?.size&&/^(?:anzi(?:\s+no)?|no(?:\s+scusa|\s+aspetta)?|scusa(?:\s+no)?|ho sbagliato|lascia\w* (?:stare|perdere))\b/.test(msg)){
  const add=(id:string,back:MenuAction[])=>{if(out.some(a=>a.kind==='delete'&&a.id===id))return;const kinds=new Set(out.filter(a=>'id' in a&&a.id===id).map(a=>a.kind)),extra=back.filter(b=>!kinds.has(b.kind)).map(b=>({...b,fromRestore:true}) as unknown as MenuAction);if(extra.length){out.push(...extra);derived.push({id,actions:extra})}}
  for(const id of new Set(out.flatMap(a=>'id' in a&&!(a as any).fromRestore?[a.id]:[])))if(input.restorable.get(id))add(id,input.restorable.get(id)!)
  for(const r of refs){if(out.some(a=>'id' in a&&a.id===r.id))continue;const back=input.restorable.get(r.id);if(!back)continue
   const part=message.split(/[,;]|\s+e\s+/).find(x=>g9DishMentioned(r.name,x,refs))??'';if(/\b(?:lascia\w*\s+stare|lascia\w*\s+perdere|c[’'\s]?è|c e|resta|rimane|va bene com era|com era)\b|\bno\s*$/i.test(part))add(r.id,back)}}
 for(const a of [...out])if('id' in a&&weakIds.has(a.id)){out.splice(out.indexOf(a),1);asks.push({type:'confirm',word:(sound.phrase.get(a.id)??byId.get(a.id)!.name).slice(0,60),action:a})}
 // A4.3: «aggiungi pasta al ragù a 12» con la pasta al ragù già a 12: non è un piatto «nominato senza azione».
 const twinIds=refs.filter(r=>legacy.some((a:any)=>a?.action==='create_item'&&typeof a.name==='string'&&sameDishName(a.name,r.name)&&!out.some(o=>'id' in o&&o.id===r.id))).map(r=>r.id)
 const covered=new Set([...weakIds,...twinIds,...out.flatMap(a=>'id' in a?[a.id]:[]),...derived.flatMap(d=>d.refId?[d.refId,d.id]:[d.id]),...exclude.map(e=>e.id),...candCovered]),padded=' '+(mix?plain(mix.command):msg)+' '
 // Misto: se la parte di modifica nomina dei piatti, le azioni stanno solo su quelli (mai sul piatto della domanda).
 if(mix){const inCmd=refs.filter(r=>g9DishMentioned(r.name,mix.command,refs)).map(r=>r.id);if(inCmd.length){const off=out.filter(a=>'id' in a&&!inCmd.includes(a.id)&&!derived.some(d=>d.id===a.id)).map(a=>(a as any).id as string);if(off.length)return no('azione_sul_piatto_della_domanda',off)}}
 // Completezza (come il validatore attuale): un piatto nominato per intero e non toccato rende la richiesta incompleta. Non conta
 // il nome contenuto nel nome di un piatto toccato («caffè» dentro «caffè macchiato»). Con un riepilogo in sospeso non si controlla.
 const touched=refs.filter(r=>covered.has(r.id)&&padded.includes(' '+plain(r.name)+' ')).map(r=>' '+plain(r.name)+' ')
 // Fase R: un piatto esistente il cui nome è dentro il nome di un piatto NUOVO («pasta e fagioli alla napoletana») non manca.
 const createdNames=out.flatMap(a=>a.kind==='create'||a.kind==='special'||a.kind==='rename'?[' '+plain(a.name)+' ']:[]);for(const r of refs)if(createdNames.some(n=>n.includes(' '+plain(r.name)+' ')))covered.add(r.id)
 // R5.1: «sposta la birra nel caffè», «rinomina la categoria caffè»: il piatto che si chiama come la categoria toccata dal piano non manca.
 {const tgt=new Set(out.flatMap(a=>(a.kind==='move'||a.kind==='create'||a.kind==='rename_section')&&typeof (a as any).sectionId==='string'?[(a as any).sectionId as string]:[])),names=sections.filter(x=>tgt.has(x.id)).map(x=>plain(x.name));for(const r of refs)if(names.some(n=>n===plain(r.name)||n.replace(/i$/,'o')===plain(r.name)||n.replace(/e$/,'a')===plain(r.name)))covered.add(r.id)}
 const missed=input.pendingActions?.length?[]:refs.filter(r=>!covered.has(r.id)&&plain(r.name).length>=3&&padded.includes(' '+plain(r.name)+' ')&&refs.filter(x=>plain(x.name)===plain(r.name)).length===1&&!touched.some(t=>t!==' '+plain(r.name)+' '&&t.includes(' '+plain(r.name)+' ')))
 // A7.12 (vocali): un piatto nominato in una parte che dice di lasciarlo («l'amatriciana lasciala com'è», «la carbonara la
 // tengo a dodici», «no il tiramisù c'è») non manca: è detto che resta com'è. «boh» detto come intercalare («boh fai tu», «e poi…
 // boh…») non è il piatto Boh se in quella parte non c'è nessun'azione.
 const KEEP=/\b(?:lascia\w*|lasci|tengo|teniamo|resta|rimane|c[’'\s]?è|c e|com era|come prima|uguale|non (?:la |lo |li |le )?(?:tocc\w*|cambi\w*))\b/i,FILLER=new Set(['boh','bho','mah','beh','bo','eh','ecco','niente'])
 const clauses=message.split(/[,;.!?…]+|\s+e\s+/)
 const ACTV=/\d|\b(?:finit\w*|esaurit\w*|nascond\w*|togli\w*|rimett\w*|evidenza|prezzo|costa|elimin\w*|cancell\w*|rinomin\w*|spost\w*|mett\w*|port\w*)\b/i
 const openIds=new Set(input.clarifyIds??[]),shortAnswer=openIds.size>0&&msg.split(' ').length<=5
 const said=missed.filter(r=>{if(shortAnswer&&!openIds.has(r.id))return false
  // «metti il tiramisù a 6 come la panna cotta»: il piatto di riferimento non manca (se il prezzo detto è il suo).
  if(out.every(a=>a.kind!=='price'||Math.abs(a.price-r.price)<0.005)&&new RegExp('\\b(?:come|ugual\\w*|stess\\w* prezzo d\\w*|pari)\\s+(?:(?:a|al|alla|allo|il|la|lo|l|del|della)\\s+)*'+plain(r.name).split(' ')[0]!+'\\b').test(msg))return false
 const idx=clauses.map((x,i)=>(' '+plain(x)+' ').includes(' '+plain(r.name)+' ')?i:-1).filter(i=>i>=0),parts=idx.map(i=>clauses[i]!);if(!parts.length)return true
  // «la bomba... no aspetta, le bombette»: il piatto detto e subito ritirato non manca.
  if(idx.every(i=>!ACTV.test(clauses[i]!)&&/^\s*(?:no\s+aspetta|no\s+scusa|anzi|cioe|cioè|no\s+no|aspetta)\b/i.test(clauses[i+1]??'')))return false
  // R6.1 (M2): «la carbonara a 13, no lascia / annulla / cancella questa, …», «(no, lasciala)»: la parte ritirata subito dopo non manca.
  if(idx.every(i=>/^\s*\(?\s*(?:no\b[\s(]*)?(?:lascia\w*|annulla\w*|cancella\w*|niente)\b/i.test(clauses[i+1]??'')||/^\s*\(?\s*no\s*$/i.test(clauses[i+1]??'')&&/^\s*(?:lascia\w*|annulla\w*)/i.test(clauses[i+2]??'')))return false
  // «…, la carbonara no», «il babà... no il babà niente»: l'ultima parte che nomina il piatto lo ritira.
  if(/(?:\bno|\bniente)\s*$/i.test(plain(parts.at(-1)!))&&!/\d/.test(parts.at(-1)!))return false
  // «la tagliata, quella di tonno non quella normale»: il nome è dentro quello di un piatto toccato e la sua parte non ha azioni.
  if(parts.every(x=>!ACTV.test(x))&&refs.some(o=>covered.has(o.id)&&o.id!==r.id&&(' '+plain(o.name)+' ').includes(' '+plain(r.name)+' ')))return false
  if([parts.at(-1)!].every(x=>(KEEP.test(x)||KEEP.test(plain(x)))&&!/\d/.test(x.replace(KEEP,''))&&!/\b(?:finit\w*|esaurit\w*|nascond\w*|evidenza|mett\w*\s+a)\b/i.test(x)))return false
  if(FILLER.has(plain(r.name))&&parts.every(x=>!/\d|\b(?:finit\w*|esaurit\w*|nascond\w*|togli\w*|rimett\w*|evidenza|prezzo|costa|elimin\w*|cancell\w*|rinomin\w*|spost\w*)\b/i.test(x)))return false
  return true})
 if(said.length)return{intent:'clarify',plan:{type:'clarify',ids:said.map(r=>r.id).slice(0,5),actions:out},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'piatto_nominato_senza_azione']}
 if(!out.length&&asks.length===1&&asks[0]!.type==='confirm')return{intent:'clarify',plan:{type:'clarify',ids:[]},hold:{kind:'hold',actions:[],asks},exclude,aliasesUsed,replyDraft:'',notes:[...notes,'nome_a_suono']}
 if(!out.length)return asks.length>=2?withHold({intent:'clarify',plan:{type:'clarify',ids:[]},exclude,aliasesUsed,replyDraft:'',notes}):no('nessuna_azione')
 const res0=withHold(guard({type:'change',actions:out})),res=twinIds.length&&res0.plan.type==='change'&&!mix?{...res0,plan:{...res0.plan,after:{type:'read' as const,read:'items' as const,ids:twinIds.slice(0,6)}},notes:[...res0.notes,'gia_nel_menu']}:res0
 if(mix&&res.plan.type==='change'){const qp=plain(mix.question),ask=/\b(cosa|cos|quali|quale|che)\b/.test(qp)
  const after=data.read==='unavailable'||data.read==='hidden'?{type:'read' as const,read:data.read as 'unavailable'|'hidden'}:ask&&/\b(finit\w*|esaurit\w*)\b/.test(qp)?{type:'read' as const,read:'unavailable' as const}:ask&&/\bnascost\w*\b/.test(qp)?{type:'read' as const,read:'hidden' as const}:/\b(sai fare|puoi fare|cosa fai)\b/.test(qp)?{type:'capability' as const,ids:['all']}:(()=>{const changed=new Set(res.plan.type==='change'?res.plan.actions.flatMap(a=>'id' in a?[a.id]:[]):[]),ids=[...new Set([...refIds(data.item_refs),...refs.filter(r=>g9DishMentioned(r.name,mix.question,refs)).map(r=>r.id)])].filter(id=>!changed.has(id)).slice(0,6);return ids.length?{type:'read' as const,read:'items' as const,ids}:undefined})()
  if(after)return{...res,plan:{...res.plan,after},notes:[...res.notes,'misto']}}
 return res
}

/** Pianifica un messaggio del titolare: contesto → una chiamata → validatore. Mai eccezioni verso il route: o una decisione, o la riserva. */
export async function planOwnerMessage(input:BrainInput,key:string,opts:BrainCallOptions={}):Promise<BrainDecision|BrainFallback>{
 let ctx:BrainContext
 try{ctx=buildBrainContext(input)}catch(error){return{path:'fallback',reason:'contesto: '+String((error as any)?.message??error)}}
 if(input.refs.length>1500||input.message.length>30000)return{path:'fallback',reason:'troppo_grande',tokens:ctx.tokens}
 // Fase R (R2.3): auto-correzione. Il piano rifiutato e il motivo tornano al modello una volta sola.
 if(input.correction)ctx={...ctx,messages:[...ctx.messages,{role:'assistant',content:input.correction.previous.slice(0,4000)},{role:'user',content:CORRECTION_HEAD+input.correction.reason+'. Rifai il JSON: correggi il piano se il messaggio lo permette, altrimenti intent=clarify con la domanda per il titolare in reply_draft.'}]}
 let call:BrainCall
 try{call=await callBrain(ctx,key,opts)}catch(error){return{path:'fallback',reason:error instanceof BrainUnavailable?error.reason:error instanceof GroqBusy?'busy':'errore',tokens:ctx.tokens}}
 if(process.env.TAKO_BRAIN_DEBUG)void import('node:fs').then(fs=>fs.appendFileSync(String(process.env.TAKO_BRAIN_DEBUG),'RAW '+call.content+'\n')).catch(()=>{})
 // Strumenti di controllo (confirm_pending, cancel_pending, undo_last): fuori dal validatore delle azioni, li verifica il route.
 const parsed=parseJson(call.content),control:ControlAction[]=parsed&&Array.isArray(parsed.actions)?[...new Set<ControlAction>(parsed.actions.filter((a:any)=>a&&CONTROL_ACTIONS.includes(a.action)).map((a:any)=>a.action as ControlAction))]:[]
 const rest=control.length&&parsed?JSON.stringify({...parsed,actions:parsed.actions.filter((a:any)=>!a||!CONTROL_ACTIONS.includes(a.action))}):call.content
 const decision=validateBrainPlan(rest,ctx,{refs:input.refs,sections:input.sections,message:input.message,memory:input.memory,pendingActions:input.pendingActions,clarifySource:input.pending?.clarify?.source??input.pending?.hold?.source,clarifyIds:input.pending?.clarify?.itemIds??(input.pending?.hold?[...new Set(input.pending.hold.asks.flatMap(q=>q.itemIds))]:undefined),history:recentHistory(input.history??[],input.now),restorable:input.restorable,now:input.now,exclude:input.exclude,freshIds:input.freshIds,draftText:[draftText(input.pending?.draft),input.pending?.clarify?.source??input.pending?.hold?.source??''].filter(Boolean).join(' \n '),twinIds:input.pending?.clarify?.twins?.map(t=>t.id)})
 if(decision.notes.includes('json_non_oggetto'))return{path:'fallback',reason:'invalid_json',usage:call.usage,tokens:ctx.tokens}
 return{path:'brain',...decision,usage:call.usage,tokens:ctx.tokens,control,raw:parsed,content:call.content,draft:typeof parsed?.reply_draft==='string'?parsed.reply_draft:''}
}
export const CORRECTION_HEAD='IL SERVER HA RIFIUTATO IL PIANO: '

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

