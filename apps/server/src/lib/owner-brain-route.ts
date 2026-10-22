/** Cervello del bot titolare · collegamento al route WhatsApp (fase 2, 17/10/2026). Tutto dietro `settings.botBrain` + `TAKO_BOT_BRAIN_OFF`.
 * - `brainGate`: decide nel turno deterministico se il messaggio va al cervello (prima delle regole testuali) o resta com'è oggi;
 * - `brainPlan`: carica memoria, cronologia e operazione in sospeso e chiede il piano (riserva = null → percorso di oggi);
 * - `rememberTurn`: cronologia breve (≤10 scambi / 30 min) di OGNI turno, anche deterministico, così il turno dopo ha il contesto;
 * - `learnAfter`: consolidamento della memoria dopo la risposta, mai nel percorso critico. */
import {sql} from 'drizzle-orm'
import type {MenuRef,SectionRef,MenuAction,GroqOptions} from './twilio-menu-ai.js'
import {resolveChoice} from './twilio-menu-nlu.js'
import {allOptions} from './twilio-menu-clarify.js'
import {botBrainEnabled,type BotEngine} from './owner-brain-switch.js'
import {planOwnerMessage,REFERS,type BrainDecision} from './owner-brain-plan.js'
import {plain,g9DishMentioned} from './twilio-menu-ai.js'
import {sqlBrainStore,consolidate,signalsFromTurn,memoryCommand,forget,memoryListText,reconcile,groqMemoryJudge} from './owner-brain-memory.js'
import type {BrainTurn} from './owner-brain-context.js'

// Solo diagnostica locale del banco (TAKO_BRAIN_DEBUG=<file>): mai attivo in produzione.
const dbg=(...a:unknown[])=>{void import('node:fs').then(fs=>fs.appendFileSync(String(process.env.TAKO_BRAIN_DEBUG),a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')+'\n')).catch(()=>{})}
type Exec={execute(q:ReturnType<typeof sql>):Promise<any>}
export {botBrainEnabled}

/** Il cervello prende il messaggio solo quando non c'è un flusso deterministico «con stato» da completare: nessuna proposta
 * (o solo una scelta «choose» che la regola attuale non sa risolvere: «sì la seconda»), nessuna foto/bozza/riepilogo/annulla. */
export function brainGate(o:{text:string,proposalKind:string|null,choiceOptions:MenuRef[]|null,undoish:boolean,freshHistory:boolean}):boolean{
 if(process.env.TAKO_BRAIN_DEBUG)dbg('GATE',JSON.stringify({...o,choiceOptions:o.choiceOptions?.length}))
 if(o.undoish)return false
 // Senza cronologia recente o senza rimandi a prima, il turno deterministico di oggi resta il primo (è già al 93–100% sui comandi
 // completi); il cervello prende i messaggi che hanno bisogno del contesto e tutti quelli che oggi andrebbero all'IA.
 if(!o.freshHistory||!(REFERS.test(plain(o.text))||plain(o.text).split(' ').length<=4))return false
 // Bozza di aggiunta in sospeso (17/10, A1.1): il route manda qui solo i messaggi che non la completano.
 if(!o.proposalKind||o.proposalKind==='create_draft')return true
 if(o.proposalKind!=='choose'||!o.choiceOptions)return false
 return !allOptions(o.text,o.choiceOptions.length)&&!resolveChoice(o.text,o.choiceOptions)
}

/** C'è almeno un turno negli ultimi 30 minuti? (tabelle assenti → no) */
/** fase 3 (memoria a breve): l'ultima risposta del bot con l'ora, per i pronomi risolti dal server prima del modello. */
export async function lastBotTurn(tx:Exec,tenant:string,phone:string,now=Date.now()):Promise<BrainTurn|null>{try{return lastBot(await sqlBrainStore(tx).readHistory(tenant,phone,now))??null}catch{return null}}
export async function hasFreshHistory(tx:Exec,tenant:string,phone:string,now=Date.now()){try{return (await sqlBrainStore(tx).readHistory(tenant,phone,now)).length>0}catch{return false}}

/** «dimentica X» / «cosa hai imparato?»: deterministico, sincrono (TwiML). null = non è un comando di memoria. */
export async function memoryTurn(tx:Exec,tenant:string,text:string,refs:MenuRef[]):Promise<string|null>{
 const cmd=memoryCommand(text);if(!cmd)return null
 const store=sqlBrainStore(tx)
 if(cmd.kind==='list')return memoryListText(await store.listMemory(tenant),refs)
 return (await forget(store,tenant,cmd.phrase))?`Ok, non ricordo più «${cmd.phrase}».`:`Non avevo imparato «${cmd.phrase}».`
}

const lastBot=(h:BrainTurn[])=>[...h].reverse().find(t=>t.role==='bot')
const ownerBefore=(h:BrainTurn[],at:number)=>[...h].reverse().find(t=>t.role==='owner'&&t.at<at)

/** 21/10 sera: sessione del menu del giorno nel contesto del modello (sottomenu del Menu: detti, restano com'erano, da dire). */
function sessionOf(ask:any,o:{sections:SectionRef[],menus?:{id:string,name:string,pricing?:'carta'|'fisso'}[]}):import('./owner-brain-context.js').BrainSession|null{
 const ss=ask?.session;if(!ss||typeof ss.menuName!=='string')return null
 const secs=o.sections.filter(x=>x.menu===ss.menuName),m=(o.menus??[]).find(x=>x.id===ss.menuId)
 return{menu:ss.menuName,carta:m?.pricing!=='fisso',sections:secs.map(x=>{const d=ss.done?.[x.id];return{id:x.id,name:x.name,state:Array.isArray(d)?'detto' as const:(ss.kept??[]).includes(x.id)?'uguale' as const:'manca' as const,names:Array.isArray(d)?d.map(String):[]}})}}
export type BrainRun={decision:BrainDecision,clarifyIds:string[]|null,recentIds?:string[],
 /** Fase R: testo recente del titolare (numeri ammessi nella bozza del modello). */
 ownerRecent?:string,lastBot?:string}
/** Piano del cervello per un turno. null = riserva (Groq giù, quota, JSON non valido, contesto impossibile). */
export async function brainPlan(db:Exec,o:{menus?:{id:string,name:string,sections:number,active?:boolean,pricing?:'carta'|'fisso',formulas?:{id:string,name:string,price:number}[],included?:string|null,secs?:{id:string,name:string,active:boolean,parent:string|null,items:number}[]}[],tenant:string,phone:string,restaurantName:string,text:string,refs:MenuRef[],sections:SectionRef[],pendingCommand:any,key:string,ai:GroqOptions,now?:number,exclude?:import('./twilio-menu-clarify.js').Excluded[],undo?:{at:number,items:{id:string,before:any}[]}|null,
 /** Fase R: annulla possibile (ultima pubblicazione ≤10 min) e auto-correzione. */
 undoInfo?:{minutes:number,names:string[]}|null,correction?:{previous:string,reason:string}|null,
 /** Fase R: «rimetti com'era X» fino a 60 minuti a menu invariato (stessa memoria `last:` del percorso di prima). */
 extraRestore?:{id:string,actions:MenuAction[]}[],freshIds?:Set<string>,voice?:boolean,
 /** PIANO bot-haiku: motore letto dal route (`readBotEngine`); assente = groq (comportamento storico). */
 engine?:BotEngine,
 /** Scadenza del turno (ms epoch): con haiku la chiamata non va oltre (auto-correzione inclusa ≤ 25 s). */
 deadline?:number,
 /** Cervello non disponibile (motivo): il route avvisa Manuel (`reportFailure`). */
 onDown?:(reason:string)=>void}):Promise<BrainRun|null>{
 const now=o.now??Date.now(),store=sqlBrainStore(db)
 let memory:Awaited<ReturnType<typeof store.listMemory>>=[],history:BrainTurn[]=[]
 try{await reconcile(store,o.tenant,o.refs);memory=await store.listMemory(o.tenant);history=await store.readHistory(o.tenant,o.phone,now)}catch{/* tabelle assenti → contesto senza memoria né cronologia */}
 const cmd=o.pendingCommand,choice=cmd?.kind==='choose'&&Array.isArray(cmd.options)?cmd.options.filter((id:unknown):id is string=>typeof id==='string'&&o.refs.some(r=>r.id===id)):null
 const ask=cmd?.kind==='brain_ask'?cmd:null
 const bot=lastBot(history),clarify=ask?{question:String(ask.question??'').slice(0,300),itemIds:(Array.isArray(ask.ids)?ask.ids:[]).filter((id:unknown):id is string=>typeof id==='string'&&o.refs.some(r=>r.id===id)),source:typeof ask.source==='string'?ask.source:undefined,...(Array.isArray(ask.twins)&&ask.twins.length?{twins:ask.twins.filter((t:any)=>t&&o.refs.some(r=>r.id===t.id)),actions:Array.isArray(ask.actions)?ask.actions:[]}:{})}:choice?.length?{question:(bot?.text??'Quale piatto intendi?').slice(0,300),itemIds:choice,source:bot?ownerBefore(history,bot.at)?.text:undefined}:null
 const proposal:MenuAction[]|null=cmd?.kind==='batch'&&Array.isArray(cmd.actions)?cmd.actions:null
 // Fase R: perché aspetta, parti incerte (hold) e domanda aperta del modello (brain_ask) nel contesto.
 const proposalWhy=proposal?(cmd.why??(proposal.some(a=>a.kind==='delete')?'delete':proposal.some(a=>a.kind==='create_section')?'section':'recap')):null
 const hold=cmd?.kind==='hold'&&Array.isArray(cmd.actions)?{actions:cmd.actions as MenuAction[],asks:(Array.isArray(cmd.asks)?cmd.asks:cmd.ask?[cmd.ask]:[]).map((q:any)=>({word:String(q.word??q.name??''),itemIds:(Array.isArray(q.options)?q.options:q.action?.id?[q.action.id]:q.id?[q.id]:[]).filter((id:unknown):id is string=>typeof id==='string'&&o.refs.some(r=>r.id===id))})),source:typeof cmd.source==='string'?cmd.source:undefined}:null

 // Bozza di aggiunta non finita (A1.1): nel contesto, e i suoi nomi/prezzi valgono come detti dal titolare per le creazioni.
 const draft=ask?.draft?{name:ask.draft.name??null,price:ask.draft.price??null,section:o.sections.find(s=>s.id===ask.draft.sectionId)?.name??null,sectionName:ask.draft.sectionName??null}:cmd?.kind==='create_draft'?{name:typeof cmd.name==='string'?cmd.name:null,names:Array.isArray(cmd.names)?cmd.names.filter((x:unknown):x is string=>typeof x==='string'):undefined,price:typeof cmd.price==='number'?cmd.price:null,prices:Array.isArray(cmd.prices)?cmd.prices:undefined,section:o.sections.find(s=>s.id===cmd.sectionId)?.name??null,sectionName:typeof cmd.sectionName==='string'?cmd.sectionName:null}:null
 // «no, intendevo X» / «rimettila com'era»: si può rimettere solo ciò che l'ultima pubblicazione da WhatsApp (10 minuti) ha cambiato.
 const restorable=new Map<string,MenuAction[]>();for(const e of o.extraRestore??[])if(e.actions.length)restorable.set(e.id,e.actions);if(o.undo&&now-o.undo.at<=RESTORE_WINDOW_MS)for(const it of o.undo.items){const r=o.refs.find(x=>x.id===it.id),b=it.before;if(!r||!b)continue;const back:MenuAction[]=[]
  if(typeof b.price==='number'&&Math.abs(b.price-r.price)>=0.005)back.push({kind:'price',id:r.id,price:b.price});if((b.available!==false)!==r.available)back.push({kind:'available',id:r.id,value:b.available!==false});if(!!b.hidden!==r.hidden)back.push({kind:'hidden',id:r.id,value:!!b.hidden});if(!!b.featured!==!!r.featured)back.push({kind:'featured',id:r.id,value:!!b.featured})
  if(back.length)restorable.set(r.id,back)}
 const decision=await planOwnerMessage({restorable,exclude:o.exclude,menus:o.menus,restaurantName:o.restaurantName,refs:o.refs,sections:o.sections,memory,history,freshIds:o.freshIds,pending:{proposal,clarify,draft,proposalWhy,hold,undo:o.undoInfo??null,session:sessionOf(ask,o)},voice:o.voice,pendingActions:proposalWhy==='recap'||proposalWhy==='price'?proposal:null,message:o.text,now,correction:o.correction??null},o.key,o.engine==='haiku'?{...o.ai,engine:'haiku',budgetMs:Math.max(0,Math.min(29_000,(o.deadline??Infinity)-Date.now()-300))}:{...o.ai,budgetMs:8000,timeoutMs:8000})
 if(process.env.TAKO_BRAIN_DEBUG)dbg('BRAIN',JSON.stringify({text:o.text,history:history.length,decision:decision.path==='brain'?{intent:decision.intent,plan:decision.plan,notes:decision.notes}:decision}))
 if(decision.path==='fallback'){console.warn(JSON.stringify({event:'owner_brain_fallback',engine:o.engine??'groq',reason:decision.reason}));try{o.onDown?.(decision.reason)}catch{};return null}
 // A4.5: i piatti di cui si stava parlando (ultimi messaggi del titolare e ultima risposta), per una domanda che li cita.
 const recentText=[...history.filter(t=>t.role==='owner').slice(-3).map(t=>t.text),bot?.text??''].join(' \n '),recentIds=history.length?o.refs.filter(r=>g9DishMentioned(r.name,recentText,o.refs)).map(r=>r.id).slice(0,3):[]
 return{decision,clarifyIds:choice?.length?choice:clarify?.itemIds?.length?clarify.itemIds:null,recentIds,ownerRecent:history.filter(t=>t.role==='owner').slice(-3).map(t=>t.text).join(' \n '),lastBot:bot?.text??''}
}

/** Cronologia breve: il messaggio del titolare (testo o trascrizione) e la risposta, solo se il cervello è acceso per il locale. */
export async function rememberTurn(db:Exec,tenant:string,phone:string,owner:string,bot:string,now=Date.now()){
 try{if(process.env.TAKO_BRAIN_DEBUG)dbg('REMEMBER',owner);if(!owner.trim()||!bot.trim())return;const rows=await db.execute(sql`SELECT settings FROM restaurants WHERE id=${tenant}`) as any[];if(!botBrainEnabled(rows?.[0]?.settings))return
  await sqlBrainStore(db).appendHistory(tenant,phone,[{role:'owner',text:owner,at:now-1},{role:'bot',text:bot,at:now}],now)}catch{/* la cronologia non deve mai rompere la risposta */}
}

/** Valori «com'era» degli ultimi 30 minuti (stessa finestra della cronologia), per «no, intendevo X» e «rimetti la carbonara
 * com'era» anche dopo altre modifiche. Chiave `brainundo:<telefono>` in tako_whatsapp_messages (come `undo:`, nessuna migrazione);
 * per ogni piatto vale il valore PRIMA della prima modifica nella finestra. */
export const RESTORE_WINDOW_MS=30*60*1000
type UndoLike={at:number,items:{id:string,before:any,sectionId?:string}[]}
export async function trackChange(db:Exec,phone:string,rec:UndoLike|null,now=Date.now()){
 if(!rec?.items?.length)return
 try{const key='brainundo:'+phone,rows=await db.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${key}`) as any[];let list:UndoLike[]=[];try{list=JSON.parse(String(rows?.[0]?.response??'[]'))}catch{}
  list=[...(Array.isArray(list)?list:[]).filter(e=>now-Number(e.at)<=RESTORE_WINDOW_MS),{at:rec.at??now,items:rec.items.map(i=>({id:i.id,before:i.before,...(i.sectionId?{sectionId:i.sectionId}:{})}))}].slice(-20)
  const text=JSON.stringify(list);await db.execute(sql`UPDATE tako_whatsapp_messages SET response=${text} WHERE sid=${key}`);await db.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${key},${text}) ON CONFLICT DO NOTHING`)}catch{}
}
export async function readRestorable(db:Exec,phone:string,now=Date.now()):Promise<UndoLike|null>{
 try{const rows=await db.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${'brainundo:'+phone}`) as any[];const list=JSON.parse(String(rows?.[0]?.response??'[]')) as UndoLike[]
  const items=new Map<string,any>();for(const e of (Array.isArray(list)?list:[]).filter(e=>now-Number(e.at)<=RESTORE_WINDOW_MS).sort((a,b)=>a.at-b.at))for(const i of e.items)if(!items.has(i.id))items.set(i.id,{before:i.before,sectionId:i.sectionId})
  return items.size?{at:now,items:[...items].map(([id,v])=>({id,before:v.before,...(v.sectionId?{sectionId:v.sectionId}:{})}))}:null}catch{return null}
}

/** Memoria appresa dopo una scrittura riuscita del cervello (in background). */
export async function learnAfter(db:Exec,o:{tenant:string,refs:MenuRef[],sections:SectionRef[],run:BrainRun,applied:boolean,key:string,meter?:GroqOptions['meter'],engine?:BotEngine}){
 try{const plan=o.run.decision.plan;if(!o.applied||plan.type!=='change'||!o.run.decision.aliasesUsed.length)return
  const applied=plan.actions.flatMap(a=>'id' in a&&typeof (a as any).id==='string'?[{id:(a as any).id as string}]:[])
  const chosen=o.run.clarifyIds?.find(id=>applied.some(a=>a.id===id))??null
  const signals=signalsFromTurn({message:'',clarifyIds:o.run.clarifyIds,chosenId:chosen,applied,aliasesUsed:o.run.decision.aliasesUsed})
  if(signals.length)await consolidate(sqlBrainStore(db),o.tenant,signals,{refs:o.refs,sections:o.sections,judge:o.key&&o.engine!=='haiku'?groqMemoryJudge(o.key,{meter:o.meter?e=>o.meter!({...e,limited:false}):undefined}):undefined})}catch{/* mai errori verso il titolare */}
}
