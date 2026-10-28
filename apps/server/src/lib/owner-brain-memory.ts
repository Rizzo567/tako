/** Cervello del bot titolare (17/10/2026, perimetro N) · memoria appresa per ristorante + cronologia breve.
 * Regole (PIANO, decisioni 4–5):
 * - si impara SOLO da segnali certi: risposta a un chiarimento, correzione, conferma di un riepilogo; l'uso coerente di un
 *   alias già noto conta come conferma debole; «annulla» subito dopo è un segnale negativo;
 * - consolidamento DOPO la risposta, fuori dal percorso critico; un passaggio LLM breve valuta «serve a capire meglio la
 *   prossima volta?» solo per le voci NUOVE che il G9 non riconoscerebbe già da solo (quota);
 * - candidato → attivo con 2 conferme o 3 usi coerenti; una correzione contraria → revisione (non si usa, non si cancella);
 * - un alias punta solo a un piatto esistente; collisioni con altri piatti/categorie bloccano la promozione;
 * - scrive solo il server; ogni modifica va nel log append-only (senza messaggi interi); «dimentica X» cancella;
 * - piatto eliminato → le sue voci si cancellano; piatto rinominato → un alias uguale al nuovo nome è inutile e si cancella.
 * Cronologia: solo testo minimo, ≤10 scambi e ≤30 minuti, poi cancellata (non è un registro). */
import {sql} from 'drizzle-orm'
import {plain,g9DishMentioned,chatModels,groqBase,parseJson,type MenuRef,type SectionRef} from './twilio-menu-ai.js'
import {HISTORY_MAX_EXCHANGES,HISTORY_TTL_MS,type BrainMemoryEntry,type BrainTurn} from './owner-brain-context.js'

export type MemoryOrigin='clarify'|'correction'|'summary'|'use'|'owner'
export type MemoryRow=BrainMemoryEntry&{id:string,restaurantId:string,origin:MemoryOrigin,createdAt:number,updatedAt:number}
export type MemoryLogOp='create'|'confirm'|'use'|'promote'|'review'|'forget'|'orphan'|'rename'|'reject'
export interface BrainStore{
 listMemory(restaurantId:string):Promise<MemoryRow[]>
 saveMemory(row:MemoryRow):Promise<void>
 deleteMemory(restaurantId:string,id:string):Promise<void>
 log(restaurantId:string,entry:{memoryId:string|null,phrase:string,op:MemoryLogOp,itemId:string|null,detail?:Record<string,unknown>}):Promise<void>
 readHistory(restaurantId:string,phone:string,now:number):Promise<BrainTurn[]>
 appendHistory(restaurantId:string,phone:string,turns:BrainTurn[],now:number):Promise<void>
}

export const PROMOTE_CONFIRMATIONS=2,PROMOTE_USES=3
export type MemorySignal=
 |{kind:'clarify_answer',phrase:string,itemId:string}          // bot: «Quale piatto intendi?» → titolare sceglie
 |{kind:'correction',phrase:string,wrongItemId:string|null,itemId:string} // «no, intendevo la amatriciana»
 |{kind:'summary_confirm',phrase:string,itemId:string}         // OK a un riepilogo che conteneva l'alias
 |{kind:'use',phrase:string,itemId:string}                     // alias usato in un'azione andata a buon fine
 |{kind:'undo',phrase:string,itemId:string}                    // «annulla» subito dopo un'azione con quell'alias
export type MemoryJudge=(q:{phrase:string,dish:string,menu:string[]})=>Promise<{useful:boolean,kind:'alias'|'asr'}|null>

const key=(s:string)=>plain(s).slice(0,60)
const STOP=new Set(['il','lo','la','i','gli','le','un','una','uno','di','del','della','e','a','al','alla','con','per','che','si','no','ok','sì','quello','quella','questo','questa','stesso','stessa','piatto','prezzo','euro','menu'])

/** Una frase può diventare alias? Deterministico: lunghezza, niente numeri/verbi, niente collisioni con altri piatti o categorie. */
export function aliasProblem(phrase:string,itemId:string,refs:MenuRef[],sections:SectionRef[]=[]):string|null{
 const k=key(phrase),dish=refs.find(r=>r.id===itemId)
 if(!dish)return 'piatto_inesistente'
 if(k.length<3||k.split(' ').length>5)return 'lunghezza'
 if(/\d/.test(k))return 'numeri'
 if(k.split(' ').every(w=>STOP.has(w)))return 'parole_vuote'
 if(/\b(metti|togli|cambia|aument\w*|abbass\w*|finit\w*|esaurit\w*|nascondi|costa|aggiung\w*)\b/.test(k))return 'verbi'
 if(plain(dish.name)===k)return 'uguale_al_nome'
 if(refs.some(r=>r.id!==itemId&&(plain(r.name)===k||(' '+plain(r.name)+' ').includes(' '+k+' '))))return 'collisione_piatto'
 if(sections.some(s=>plain(s.name)===k))return 'collisione_categoria'
 return null
}
/** Il G9 riconosce già la frase come quel piatto? Allora la memoria non serve (e non si spende quota). */
export const alreadyUnderstood=(phrase:string,itemId:string,refs:MenuRef[])=>{const dish=refs.find(r=>r.id===itemId);return !!dish&&g9DishMentioned(dish.name,phrase,refs)}

const fresh=(restaurantId:string,phrase:string,itemId:string,kind:'alias'|'asr',origin:MemoryOrigin,now:number,dishName:string):MemoryRow=>({id:crypto.randomUUID(),restaurantId,phrase:key(phrase),kind,itemId,meaning:dishName,state:'candidate',confirmations:0,uses:0,lastUsedAt:null,origin,createdAt:now,updatedAt:now})
const promoteIfReady=(row:MemoryRow)=>row.state==='candidate'&&(row.confirmations>=PROMOTE_CONFIRMATIONS||row.uses>=PROMOTE_USES)

/** Consolidamento dopo la risposta. Restituisce le operazioni fatte (per test e audit). Mai eccezioni verso il chiamante. */
export async function consolidate(store:BrainStore,restaurantId:string,signals:MemorySignal[],ctx:{refs:MenuRef[],sections?:SectionRef[],judge?:MemoryJudge,now?:number}):Promise<{op:MemoryLogOp,phrase:string,itemId:string|null}[]>{
 const now=ctx.now??Date.now(),done:{op:MemoryLogOp,phrase:string,itemId:string|null}[]=[]
 try{
  const rows=await store.listMemory(restaurantId)
  const record=async(row:MemoryRow,op:MemoryLogOp,detail?:Record<string,unknown>)=>{row.updatedAt=now;await store.saveMemory(row);await store.log(restaurantId,{memoryId:row.id,phrase:row.phrase,op,itemId:row.itemId,detail});done.push({op,phrase:row.phrase,itemId:row.itemId})}
  for(const s of signals){const phrase=key(s.phrase);if(!phrase)continue
   const same=rows.find(r=>r.phrase===phrase&&r.itemId===s.itemId&&r.kind!=='habit')
   if(s.kind==='undo'||s.kind==='correction'){
    // Segnale negativo: l'alias che puntava al piatto sbagliato va in revisione (non si usa più finché il titolare non decide).
    const wrongId=s.kind==='undo'?s.itemId:s.wrongItemId
    for(const r of rows.filter(r=>r.phrase===phrase&&r.itemId===wrongId&&r.state!=='review')){r.state='review';await record(r,'review',{via:s.kind})}
    if(s.kind==='undo')continue}
   if(s.kind==='use'){if(same&&same.state!=='review'){same.uses++;same.lastUsedAt=now;await record(same,'use');if(promoteIfReady(same)){same.state='active';await record(same,'promote')}}continue}
   // Segnali forti: clarify_answer, correction (verso il piatto giusto), summary_confirm.
   if(same){if(same.state==='review'){continue}same.confirmations++;same.lastUsedAt=now;await record(same,'confirm',{via:s.kind});if(promoteIfReady(same)){same.state='active';await record(same,'promote')}continue}
   const problem=aliasProblem(phrase,s.itemId,ctx.refs,ctx.sections??[])
   if(problem){if(problem!=='uguale_al_nome')await store.log(restaurantId,{memoryId:null,phrase,op:'reject',itemId:s.itemId,detail:{motivo:problem}});done.push({op:'reject',phrase,itemId:s.itemId});continue}
   if(alreadyUnderstood(phrase,s.itemId,ctx.refs)){done.push({op:'reject',phrase,itemId:s.itemId});continue}
   // Un'altra voce con la stessa frase verso un altro piatto: conflitto → niente promozione automatica, revisione.
   const clash=rows.find(r=>r.phrase===phrase&&r.itemId!==s.itemId&&r.state!=='review')
   if(clash){clash.state='review';await record(clash,'review',{via:'conflitto'})}
   const dish=ctx.refs.find(r=>r.id===s.itemId)!
   let kind:'alias'|'asr'='alias'
   if(ctx.judge){const verdict=await ctx.judge({phrase,dish:dish.name,menu:ctx.refs.map(r=>r.name)}).catch(()=>null);if(!verdict||!verdict.useful){await store.log(restaurantId,{memoryId:null,phrase,op:'reject',itemId:s.itemId,detail:{motivo:verdict?'giudice_no':'giudice_assente'}});done.push({op:'reject',phrase,itemId:s.itemId});continue}kind=verdict.kind}
   const row=fresh(restaurantId,phrase,s.itemId,kind,s.kind==='clarify_answer'?'clarify':s.kind==='correction'?'correction':'summary',now,dish.name)
   row.confirmations=1;row.lastUsedAt=now;if(clash)row.state='review';rows.push(row);await record(row,'create',{via:s.kind})}
 }catch{/* la memoria non deve mai rompere la risposta */}
 return done
}

/** «dimentica X» / «cosa hai imparato?» — deterministico, non passa dal modello. */
export function memoryCommand(text:string):{kind:'forget',phrase:string}|{kind:'list'}|null{
 const t=plain(text)
 if(/^(cosa|che cosa|che) (hai imparato|ricordi|sai di me)\b|^(mostra|fammi vedere) (la )?memoria\b/.test(t))return{kind:'list'}
 const m=t.match(/^(?:dimentica|dimenticati|scordati|cancella dalla memoria|non ricordare piu)\s+(?:che\s+)?(.+)$/);if(m){const phrase=m[1]!.replace(/^(la parola|il nome|l alias)\s+/,'').trim();return phrase.length>=2?{kind:'forget',phrase}:null}
 return null
}
export async function forget(store:BrainStore,restaurantId:string,phrase:string):Promise<number>{
 const k=key(phrase),rows=await store.listMemory(restaurantId),hit=rows.filter(r=>r.phrase===k||(k.length>=4&&r.phrase.includes(k)))
 for(const r of hit){await store.deleteMemory(restaurantId,r.id);await store.log(restaurantId,{memoryId:r.id,phrase:r.phrase,op:'forget',itemId:r.itemId})}
 return hit.length
}
export function memoryListText(rows:MemoryRow[],refs:MenuRef[]){
 const live=rows.filter(r=>r.state!=='review'&&r.itemId&&refs.some(x=>x.id===r.itemId))
 if(!live.length)return 'Non ho ancora imparato nessun nome particolare.'
 return 'Ecco come chiami i tuoi piatti:\n'+live.slice(0,30).map(r=>'- «'+r.phrase+'» = *'+refs.find(x=>x.id===r.itemId)!.name+'*'+(r.state==='candidate'?' (da confermare)':'')).join('\n')+'\n\nPer cancellarne uno scrivi «dimentica» e la parola.'
}
/** Riallinea la memoria al menu attuale: piatto eliminato → voci cancellate; rinominato → alias uguale al nuovo nome cancellato. */
export async function reconcile(store:BrainStore,restaurantId:string,refs:MenuRef[]):Promise<number>{
 const rows=await store.listMemory(restaurantId),byId=new Map(refs.map(r=>[r.id,r]));let n=0
 for(const r of rows){if(!r.itemId)continue;const dish=byId.get(r.itemId)
  if(!dish){await store.deleteMemory(restaurantId,r.id);await store.log(restaurantId,{memoryId:r.id,phrase:r.phrase,op:'orphan',itemId:r.itemId});n++;continue}
  if(plain(dish.name)===r.phrase){await store.deleteMemory(restaurantId,r.id);await store.log(restaurantId,{memoryId:r.id,phrase:r.phrase,op:'rename',itemId:r.itemId,detail:{motivo:'alias_uguale_al_nome'}});n++;continue}
  if(r.meaning!==dish.name){r.meaning=dish.name;r.updatedAt=Date.now();await store.saveMemory(r);await store.log(restaurantId,{memoryId:r.id,phrase:r.phrase,op:'rename',itemId:r.itemId});n++}}
 return n
}

/** Estrae i segnali certi da un turno concluso. `prev` = turno precedente del bot (chiarimento aperto), `applied` = azioni
 * davvero salvate (dopo la rilettura), `aliasesUsed` = alias riportati dal modello e validati. */
export function signalsFromTurn(t:{message:string,clarifyIds?:string[]|null,chosenId?:string|null,applied:{id:string}[],aliasesUsed:{phrase:string,itemId:string}[],undoOf?:{phrase:string,itemId:string}[],correction?:{phrase:string,wrongItemId:string|null,itemId:string}|null,confirmedSummary?:{phrase:string,itemId:string}[]}):MemorySignal[]{
 const out:MemorySignal[]=[],appliedIds=new Set(t.applied.map(a=>a.id))
 // Risposta a «Quale piatto intendi?»: la frase che aveva generato il dubbio = alias del piatto scelto.
 if(t.clarifyIds?.length&&t.chosenId&&t.clarifyIds.includes(t.chosenId))for(const a of t.aliasesUsed)if(a.itemId===t.chosenId)out.push({kind:'clarify_answer',phrase:a.phrase,itemId:a.itemId})
 if(t.correction)out.push({kind:'correction',...t.correction})
 for(const s of t.confirmedSummary??[])out.push({kind:'summary_confirm',...s})
 for(const a of t.aliasesUsed)if(appliedIds.has(a.itemId)&&!out.some(o=>o.phrase===a.phrase))out.push({kind:'use',phrase:a.phrase,itemId:a.itemId})
 for(const u of t.undoOf??[])out.push({kind:'undo',...u})
 return out
}

/** Giudice LLM (piccolo, strict) «serve a capire meglio la prossima volta?». Criteri: la frase è un modo stabile con cui il
 * titolare chiama QUEL piatto (soprannome, abbreviazione, dialetto, trascrizione vocale ricorrente); NON un aggettivo,
 * una quantità, un'azione, un pezzo di frase occasionale, né un termine che potrebbe indicare altri piatti del menu. */
export function groqMemoryJudge(key:string,opts:{fetch?:(u:string,i:RequestInit)=>Promise<Response>,timeoutMs?:number,meter?:(e:{model:string,prompt:number,completion:number})=>unknown}={}):MemoryJudge{
 const schema={name:'memory_judge',strict:true,schema:{type:'object',additionalProperties:false,required:['useful','kind'],properties:{useful:{type:'boolean'},kind:{type:'string',enum:['alias','asr','none']}}}}
 return async q=>{const doFetch=opts.fetch??((u,i)=>fetch(u,i))
  const system='Valuti se ricordare una parola usata da un ristoratore per un suo piatto serve a capirlo meglio la prossima volta. useful=true solo se è un modo stabile di chiamare QUEL piatto (soprannome, abbreviazione, dialetto: kind=alias; trascrizione vocale sbagliata ricorrente: kind=asr). useful=false (kind=none) se è un aggettivo, una quantità, un\'azione, un frammento occasionale o se può indicare anche un altro piatto del menu. Solo JSON.'
  const user=JSON.stringify({parola:q.phrase,piatto:q.dish,altri_piatti:q.menu.filter(n=>n!==q.dish).slice(0,80)})
  const r=await doFetch(groqBase()+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:chatModels[0],temperature:0,max_completion_tokens:400,reasoning_effort:'low',response_format:{type:'json_schema',json_schema:schema},messages:[{role:'system',content:system},{role:'user',content:user}]}),signal:AbortSignal.timeout(opts.timeoutMs??6000)})
  if(!r.ok){await r.body?.cancel();return null}
  const data=await r.json() as any,v=parseJson(String(data?.choices?.[0]?.message?.content??''));await opts.meter?.({model:chatModels[0]!,prompt:Number(data?.usage?.prompt_tokens)||0,completion:Number(data?.usage?.completion_tokens)||0})
  return v&&typeof v.useful==='boolean'?{useful:v.useful&&v.kind!=='none',kind:v.kind==='asr'?'asr':'alias'}:null}
}

/* ---------- Store ---------- */
type Exec={execute(q:ReturnType<typeof sql>):Promise<any>}
const ms=(v:unknown)=>v==null?null:new Date(v as any).getTime()
/** Store SQL (tabelle in docs/webapp/bot-cervello-2026-10-17/sql/up.sql). */
export function sqlBrainStore(tx:Exec):BrainStore{
 return{
  async listMemory(restaurantId){const rows=await tx.execute(sql`SELECT id,restaurant_id,phrase,kind,item_id,meaning,state,confirmations,uses,last_used_at,origin,created_at,updated_at FROM tako_owner_brain_memory WHERE restaurant_id=${restaurantId} ORDER BY updated_at DESC LIMIT 500`) as any[]
   return (rows??[]).map(r=>({id:String(r.id),restaurantId:String(r.restaurant_id),phrase:String(r.phrase),kind:r.kind,itemId:r.item_id?String(r.item_id):null,meaning:String(r.meaning??''),state:r.state,confirmations:Number(r.confirmations)||0,uses:Number(r.uses)||0,lastUsedAt:ms(r.last_used_at),origin:r.origin,createdAt:ms(r.created_at)!,updatedAt:ms(r.updated_at)!}))},
  async saveMemory(m){const last=m.lastUsedAt===null?null:new Date(m.lastUsedAt).toISOString()
   await tx.execute(sql`INSERT INTO tako_owner_brain_memory(id,restaurant_id,phrase,kind,item_id,meaning,state,confirmations,uses,last_used_at,origin) VALUES(${m.id},${m.restaurantId},${m.phrase},${m.kind},${m.itemId},${m.meaning},${m.state},${m.confirmations},${m.uses},${last},${m.origin})
    ON CONFLICT(id) DO UPDATE SET meaning=excluded.meaning,state=excluded.state,confirmations=excluded.confirmations,uses=excluded.uses,last_used_at=excluded.last_used_at,updated_at=now()`)},
  async deleteMemory(restaurantId,id){await tx.execute(sql`DELETE FROM tako_owner_brain_memory WHERE restaurant_id=${restaurantId} AND id=${id}`)},
  async log(restaurantId,e){await tx.execute(sql`INSERT INTO tako_owner_brain_memory_log(restaurant_id,memory_id,phrase,op,item_id,detail) VALUES(${restaurantId},${e.memoryId},${e.phrase},${e.op},${e.itemId},${JSON.stringify(e.detail??{})}::jsonb)`)},
  async readHistory(restaurantId,phone,now){const since=new Date(now-HISTORY_TTL_MS).toISOString()
   const rows=await tx.execute(sql`SELECT role,body,created_at FROM tako_owner_brain_turns WHERE restaurant_id=${restaurantId} AND phone=${phone} AND created_at>${since} ORDER BY created_at DESC,id DESC LIMIT ${HISTORY_MAX_EXCHANGES*2}`) as any[]
   return (rows??[]).map(r=>({role:r.role==='bot'?'bot':'owner',text:String(r.body),at:ms(r.created_at)!})).reverse() as BrainTurn[]},
  async appendHistory(restaurantId,phone,turns,now){const since=new Date(now-HISTORY_TTL_MS).toISOString()
   for(const t of turns)await tx.execute(sql`INSERT INTO tako_owner_brain_turns(restaurant_id,phone,role,body,created_at) VALUES(${restaurantId},${phone},${t.role},${t.text.slice(0,500)},${new Date(t.at).toISOString()})`)
   // TTL e tetto: tutto ciò che è più vecchio di 30 minuti o oltre i 10 scambi si cancella subito.
   await tx.execute(sql`DELETE FROM tako_owner_brain_turns WHERE phone=${phone} AND (created_at<=${since} OR id NOT IN (SELECT id FROM tako_owner_brain_turns WHERE phone=${phone} ORDER BY created_at DESC,id DESC LIMIT ${HISTORY_MAX_EXCHANGES*2}))`)}
 }
}
/** Store in memoria (test, banco di valutazione). */
export function memoryBrainStore(){
 const memory=new Map<string,MemoryRow>(),logs:{restaurantId:string,memoryId:string|null,phrase:string,op:MemoryLogOp,itemId:string|null,detail?:Record<string,unknown>}[]=[],turns:(BrainTurn&{restaurantId:string,phone:string})[]=[]
 const store:BrainStore&{memory:typeof memory,logs:typeof logs,turns:typeof turns}={memory,logs,turns,
  async listMemory(r){return [...memory.values()].filter(m=>m.restaurantId===r).map(m=>({...m}))},
  async saveMemory(m){memory.set(m.id,{...m})},
  async deleteMemory(r,id){const m=memory.get(id);if(m?.restaurantId===r)memory.delete(id)},
  async log(r,e){logs.push({restaurantId:r,...e})},
  async readHistory(r,p,now){return turns.filter(t=>t.restaurantId===r&&t.phone===p&&now-t.at<HISTORY_TTL_MS).slice(-HISTORY_MAX_EXCHANGES*2).map(({role,text,at})=>({role,text,at}))},
  async appendHistory(r,p,list,now){for(const t of list)turns.push({...t,text:t.text.slice(0,500),restaurantId:r,phone:p});const keep=turns.filter(t=>!(t.phone===p&&now-t.at>=HISTORY_TTL_MS));const mine=keep.filter(t=>t.phone===p),drop=new Set(mine.slice(0,Math.max(0,mine.length-HISTORY_MAX_EXCHANGES*2)));turns.splice(0,turns.length,...keep.filter(t=>!drop.has(t)))}}
 return store
}
