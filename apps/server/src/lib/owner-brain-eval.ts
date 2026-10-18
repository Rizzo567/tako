/** Adattatore del cervello per il banco di valutazione (agente E, Tako-bot-eval). Contratto definitivo: eval/CONTRATTO.md
 * (non ancora pubblicato al 17/10 fase 1) → interfaccia provvisoria: una conversazione = una sequenza di `turn()` su uno
 * stato menu in memoria. Nessun DB, nessun WhatsApp: simula il tratto di `turnFor` che conta per il giudice
 * (esclusioni, G6/oltre 3 azioni → proposta da confermare con OK, scrittura, rilettura, testo dai fatti).
 * path='fallback' = il cervello ha rinunciato (Groq giù, quota, JSON invalido): il runner deve passare il messaggio al bot
 * attuale, esattamente come farà il route. */
import {applyActions,effectiveMenuActions,proposalText,type MenuAction,type MenuRef,type SectionRef} from './twilio-menu-ai.js'
import {isExcluded} from './twilio-menu-clarify.js'
import {publicNames} from './owner-brain-sections.js'
import {planOwnerMessage,composeReply,type BrainCallOptions,type BrainUsage,type BrainDecision} from './owner-brain-plan.js'
import {buildBrainContext,type BrainTurn} from './owner-brain-context.js'
import {memoryBrainStore,consolidate,signalsFromTurn,memoryCommand,forget,memoryListText,reconcile,type BrainStore,type MemoryJudge} from './owner-brain-memory.js'

export const catalogOf=(w:any)=>({refs:w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>({id:i.id,name:i.name,price:i.price,available:i.available!==false,hidden:!!i.hidden,menu:m.name,section:s.name,sectionId:s.id,hasImage:!!i.imageUrl,featured:!!i.featured,tags:i.tags??[]} as MenuRef)))) as MenuRef[],
 sections:w.menus.flatMap((m:any)=>{const pub=publicNames(m);return m.sections.map((s:any)=>({id:s.id,name:s.name,menu:m.name,...(pub.get(s.id)?{pub:pub.get(s.id)}:{})} as SectionRef))}) as SectionRef[]})

export type EvalState={workspace:any,proposal:MenuAction[]|null,clarify:{question:string,itemIds:string[],actions?:MenuAction[],source?:string}|null}
export type EvalTurn={reply:string|null,state:EvalState,path:'brain'|'fallback'|'memory'|'confirm',written:MenuAction[],decision?:BrainDecision,reason?:string,usage?:BrainUsage,tokensEstimated:number,latencyMs:number}
export type EvalBotOptions={key:string,restaurantId?:string,restaurantName?:string,phone?:string,store?:BrainStore,judge?:MemoryJudge,call?:BrainCallOptions,timezone?:string}

const CONFIRM=/^(ok|okay|si|sì|conferma|confermo|va bene|vai|procedi)[.!]*$/i,CANCEL=/^(annulla|no|lascia stare|niente)[.!]*$/i

export function createBrainEvalBot(o:EvalBotOptions){
 const store=o.store??memoryBrainStore(),rid=o.restaurantId??'00000000-0000-4000-8000-000000000000',phone=o.phone??'+390000000000'
 async function turn(state:EvalState,message:string,now=Date.now()):Promise<EvalTurn>{
  const started=Date.now(),{refs,sections}=catalogOf(state.workspace)
  const finish=async(r:Omit<EvalTurn,'latencyMs'|'tokensEstimated'>&{tokensEstimated?:number})=>{if(r.reply!==null)await store.appendHistory(rid,phone,[{role:'owner',text:message,at:now},{role:'bot',text:r.reply,at:now+1}],now+1);return{tokensEstimated:0,...r,latencyMs:Date.now()-started}}
  const mem=memoryCommand(message)
  if(mem){const reply=mem.kind==='list'?memoryListText(await store.listMemory(rid),refs):(await forget(store,rid,mem.phrase))?'Ok, non lo ricordo più.':'Non avevo imparato quella parola.';return finish({reply,state,path:'memory',written:[]})}
  const t=message.trim()
  if(state.proposal&&CONFIRM.test(t))return finish(await write(state,state.proposal,refs,sections,'confirm'))
  if(state.proposal&&CANCEL.test(t))return finish({reply:'Ok, non ho cambiato nulla.',state:{...state,proposal:null},path:'confirm',written:[]})
  await reconcile(store,rid,refs)
  const memory=await store.listMemory(rid),history:BrainTurn[]=await store.readHistory(rid,phone,now)
  const decision=await planOwnerMessage({restaurantName:o.restaurantName,refs,sections,memory,history,message,now,pending:{proposal:state.proposal,clarify:state.clarify?{question:state.clarify.question,itemIds:state.clarify.itemIds,source:state.clarify.source}:null},pendingActions:state.proposal},o.key,o.call)
  if(decision.path==='fallback')return{reply:null,state,path:'fallback',written:[],reason:decision.reason,usage:decision.usage,tokensEstimated:decision.tokens?.total??0,latencyMs:Date.now()-started}
  const base={decision,usage:decision.usage,tokensEstimated:decision.tokens.total}
  if(decision.plan.type!=='change'){
   const clarify=decision.plan.type==='clarify'&&decision.plan.ids.length?{question:decision.replyDraft||'Quale piatto intendi?',itemIds:decision.plan.ids,actions:decision.plan.actions,source:message}:null
   return finish({...base,reply:composeReply(decision,refs,sections),state:{...state,clarify},path:'brain',written:[]})}
  let actions=decision.plan.actions.filter(a=>!isExcluded(a as any,decision.exclude))
  if(state.proposal)actions=[...state.proposal.filter(p=>!actions.some(a=>'id' in a&&'id' in p&&a.id===p.id&&a.kind===p.kind)),...actions]
  actions=effectiveMenuActions(actions,state.workspace)
  if(!actions.length)return finish({...base,reply:'Il menu è già così: non ho cambiato nulla.',state,path:'brain',written:[]})
  // G6 del route: prezzo implausibile (oltre 500 € o ≥8× l'attuale) o più di 3 azioni → riepilogo da confermare, mai online diretto.
  const implausible=actions.some(a=>(a.kind==='price'||a.kind==='create'||a.kind==='special')&&(a.price>500||(a.kind==='price'&&(()=>{const r=refs.find(x=>x.id===a.id);return !!r&&r.price>0&&a.price>=8*r.price})())))
  if(implausible||actions.length>3)return finish({...base,reply:proposalText(o.restaurantName??'Ristorante',actions,refs,sections),state:{...state,proposal:actions,clarify:null},path:'brain',written:[]})
  const done=await write(state,actions,refs,sections,'brain',decision)
  // Consolidamento della memoria dopo la risposta (nel route: in background, fuori dal percorso critico).
  const chosen=state.clarify?.itemIds.find(id=>done.written.some(a=>'id' in a&&a.id===id))??null
  await consolidate(store,rid,signalsFromTurn({message,clarifyIds:state.clarify?.itemIds,chosenId:chosen,applied:done.written.flatMap(a=>'id' in a?[{id:a.id}]:[]),aliasesUsed:decision.aliasesUsed}),{refs,sections,judge:o.judge,now})
  return finish({...base,...done})
 }
 async function write(state:EvalState,actions:MenuAction[],refs:MenuRef[],sections:SectionRef[],path:'brain'|'confirm',decision?:BrainDecision){
  const next=structuredClone(state.workspace);applyActions(next,actions,{timezone:o.timezone??'Europe/Rome'})
  const after=catalogOf(next).refs // «rilettura»: i fatti si scrivono dallo stato salvato, non dal piano
  const reply=composeReply({intent:'change',plan:{type:'change',actions},replyDraft:''},refs,sections,after)
  return{reply,state:{workspace:next,proposal:null,clarify:null},path,written:actions,decision}
 }
 return{turn,store,contextFor:(state:EvalState,message:string)=>{const {refs,sections}=catalogOf(state.workspace);return buildBrainContext({restaurantName:o.restaurantName,refs,sections,message})}}
}

/* ---------- Forma del banco E (tests/eval/types.ts in Tako-bot-eval: BotUnderTest/BotRun/TurnResult) ----------
 * Tipi strutturali copiati, nessun import dal worktree di E. Strada definitiva (CONTRATTO §2 di E): route vero con
 * settings.botBrain=true dopo l'integrazione (fase 2); questo adattatore serve a misurare il cervello DA SOLO già ora.
 * `fallback` (facoltativo) riceve i turni in cui il cervello rinuncia: il runner può passarli al bot attuale. */
export type EvalBenchTurn={text:string,q?:boolean}|{voice:string,q?:boolean}|{wait:number}|{dash:{dish:string,field:'price'|'available'|'hidden'|'featured',value:unknown}}
export type EvalBenchResult={reply:string,menuAfter:any,latencyMs:number,llm:{calls:number,tokens:number,misses:number,recordedMs:number},context?:{history:{role:'owner'|'bot',text:string,at:string}[],pending?:unknown,memory?:unknown,promptTokens?:number},path?:EvalTurn['path'],reason?:string}
export function brainBotUnderTest(o:Omit<EvalBotOptions,'store'>&{name?:string,startTime?:number,fallback?:(menu:any,text:string)=>Promise<{reply:string,menuAfter:any}|null>}){
 return{name:o.name??'cervello',ready:true,async run(conv:{turns:EvalBenchTurn[]},menu:any,ctx:{restaurant:string}){
  const bot=createBrainEvalBot({...o,restaurantName:ctx.restaurant});let state:EvalState={workspace:structuredClone(menu),proposal:null,clarify:null},now=o.startTime??Date.UTC(2026,9,16,10,0,0)
  const turns:EvalBenchResult[]=[]
  for(const t of conv.turns){
   if('wait' in t){now+=t.wait*60000;continue}
   if('dash' in t){for(const m of state.workspace.menus)for(const s of m.sections)for(const i of s.items)if(i.name===t.dash.dish)i[t.dash.field]=t.dash.value;continue}
   const text='text' in t?t.text:t.voice;now+=20000
   const r=await bot.turn(state,text,now);let reply=r.reply??'',menuAfter=r.state.workspace
   if(r.path==='fallback'&&o.fallback){const f=await o.fallback(state.workspace,text);if(f){reply=f.reply;menuAfter=f.menuAfter;r.state={workspace:f.menuAfter,proposal:null,clarify:null}}}
   state=r.state
   const history=await bot.store.readHistory('00000000-0000-4000-8000-000000000000','+390000000000',now)
   turns.push({reply,menuAfter:structuredClone(menuAfter),latencyMs:r.latencyMs,llm:{calls:r.usage?1:0,tokens:(r.usage?.prompt??0)+(r.usage?.completion??0),misses:r.path==='fallback'?1:0,recordedMs:r.usage?.latencyMs??0},
    context:{history:history.map(h=>({role:h.role,text:h.text,at:new Date(h.at).toISOString()})),pending:{proposal:state.proposal,clarify:state.clarify},memory:await bot.store.listMemory('00000000-0000-4000-8000-000000000000'),promptTokens:r.usage?.prompt??r.tokensEstimated},path:r.path,reason:r.reason})}
  return{turns,finalMenu:state.workspace,pending:{proposal:state.proposal,clarify:state.clarify}}}}
}
