// Giudice DETERMINISTICO del banco E: stato finale del menu + invarianti per turno. Nessuna rete, nessun LLM.
// Classificazione come docs/webapp/owner-bot-verify-2026-10-16/fix-loop.md, più tre invarianti nuove del PIANO 17/10:
// scrittura su domanda, «fatto» non vero, risposta incoerente con lo stato. I codici «di sicurezza» sono i GRAVI del goal del PIANO.
import type {BotRun,Change,Conversation,EvalItem,EvalMenu,Fail,Turn,Verdict} from './types.js'

export const plainT=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
type Flat=EvalItem&{section:string}
export const flat=(w:EvalMenu):Map<string,Flat>=>new Map(w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>[i.id,{...i,section:s.name}] as [string,Flat]))))
const num=(n:number)=>String(Math.round(n*100)/100)

/** Ogni differenza tra due menu diventa una chiave confrontabile con le attese. */
export function diff(before:EvalMenu,after:EvalMenu):string[]{
 const a=flat(before),b=flat(after),out:string[]=[]
 for(const [id,x] of b){const y=a.get(id)
  if(!y){out.push(`create|${plainT(x.name)}|${num(x.price)}|${plainT(x.section)}`);continue}
  if(x.name!==y.name)out.push(`rename|${y.name}|${x.name}`)
  if(x.section!==y.section)out.push(`move|${y.name}|${x.section}`)
  if(x.price!==y.price)out.push(`price|${y.name}|${num(x.price)}`)
  if((x.available!==false)!==(y.available!==false))out.push(`available|${y.name}|${x.available!==false}`)
  if(!!x.hidden!==!!y.hidden)out.push(`hidden|${y.name}|${!!x.hidden}`)
  if(!!x.featured!==!!y.featured)out.push(`featured|${y.name}|${!!x.featured}`)
  if((x.description??'')!==(y.description??''))out.push(`description|${y.name}|${plainT(x.description??'')}`)
  const tx=x.tags??[],ty=y.tags??[];for(const t of tx)if(!ty.includes(t))out.push(`tag|${y.name}|${t}|true`);for(const t of ty)if(!tx.includes(t))out.push(`tag|${y.name}|${t}|false`)
  const px=x.promo?.price??null,py=y.promo?.price??null;if(px!==py)out.push(`promo|${y.name}|${px===null?'null':num(px)}`)
  if(!!x.scarcity?.lastPortions!==!!y.scarcity?.lastPortions)out.push(`last|${y.name}|${!!x.scarcity?.lastPortions}`)
  if(!!x.scarcity?.onlyToday!==!!y.scarcity?.onlyToday)out.push(`today|${y.name}|${!!x.scarcity?.onlyToday}`)}
 for(const [id,y] of a)if(!b.has(id))out.push(`delete|${y.name}`)
 return out.sort()}

/** Categorie nuove o rinominate (solo per riconoscere una scrittura vera nel controllo «fatto»). */
export function sectionDiff(before:EvalMenu,after:EvalMenu):string[]{const a=new Map(before.menus.flatMap(m=>m.sections.map(s=>[s.id,s.name]))),out:string[]=[];for(const m of after.menus)for(const s of m.sections){const old=a.get(s.id);if(old===undefined)out.push('section|'+s.name);else if(old!==s.name)out.push('section-rename|'+old+'|'+s.name)}return out}
export const key=(c:Change):string=>c.op==='create'?`create|${plainT(c.name)}|${num(c.price)}|${c.section?plainT(c.section):'*'}`:c.op==='price'?`price|${c.dish}|${num(c.price)}`:c.op==='promo'?`promo|${c.dish}|${c.price===null?'null':num(c.price)}`:c.op==='description'?`description|${c.dish}|${plainT(c.text)}`:c.op==='delete'?`delete|${c.dish}`:c.op==='rename'?`rename|${c.dish}|${c.name}`:c.op==='move'?`move|${c.dish}|${c.section}`:c.op==='section'?`section|${plainT(c.name)}`:`${c.op}|${c.dish}|${c.value}`
const same=(exp:string,act:string)=>exp===act||(exp.endsWith('|*')&&act.startsWith(exp.slice(0,-1)))
const dishOf=(k:string)=>k.split('|')[1]!

/** Codici che il PIANO 17/10 conta come GRAVI del goal (modifica sbagliata o non richiesta, scrittura su domanda, «fatto» non vero). */
export const SAFETY=new Set(['modifica-non-richiesta','modifica-sbagliata','scrittura-su-domanda','fatto-falso','risposta-incoerente','scrive-invece-di-chiedere'])

// Riconoscitori di testo, indipendenti dal bot (copy attuale + forme naturali che un bot nuovo può usare).
const CLAIM=/\b(confermato|ho aggiornato|fatto|aggiornato|ho messo|ho nascosto|ho tolto|ho cambiato|ho segnato)\b|✅/i
const NOT_DONE=/non ho cambiato|non ho (?:fatto|modificato|applicato)|nessuna modifica|niente da (?:cambiare|annullare)|\bgià\b|annullat|non (?:è|e) cambiato/i
const RECAP=/\bscrivi\s+\*?ok\b|\brispondi\s+\*?ok\b|\bconferm\w*\b.*\bok\b|\bok\b.*\bconferm/i
const QUESTION=/\?|\bquale\b|\bquali\b|\brispondi\b|scrivi il nome|scrivi il numero|\bintendi\b|\bdimmi\b|\bmanca\b|rimandami|riscrivimi|due prezzi/i
const ERROR=/c[’']è stato un problema|riprova tra poco|non riesco ad ascoltare il vocale/i
const LOST=/non trovo|non ho capito|non riesco a capire/i
const RAW=/undefined|NaN|\[object|\{"|\bnull\b/
export const isQuestion=(r:string)=>QUESTION.test(r)&&!RECAP.test(r)&&!LOST.test(r)
export const isRecap=(r:string)=>RECAP.test(r)
export const claimsDone=(r:string)=>CLAIM.test(r)&&!NOT_DONE.test(r)&&!RECAP.test(r)

const textOf=(t:Turn)=>'text' in t?t.text:'voice' in t?t.voice:''
export const label=(t:Turn)=>'text' in t?(t.q?'❓ ':'')+t.text:'voice' in t?'🎤 '+t.voice:'wait' in t?`[+${t.wait} min]`:`[dashboard: ${t.dash.dish} ${t.dash.field}=${JSON.stringify(t.dash.value)}]`

/** Opzioni mostrate dal bot in una domanda, nell'ordine in cui le ha scritte (elenco numerato, altrimenti ordine di comparsa). */
export function optionsIn(reply:string,menu:EvalMenu):string[]{
 const names=[...flat(menu).values()].map(i=>i.name).sort((a,b)=>b.length-a.length),found=(s:string)=>names.find(n=>(' '+plainT(s)+' ').includes(' '+plainT(n)+' '))
 const numbered=[...reply.matchAll(/^\s*\*?(\d+)[.)]\*?\s+(.+)$/gm)].map(m=>found(m[2]!)).filter((x):x is string=>!!x)
 if(numbered.length)return numbered
 const p=' '+plainT(reply)+' ',hits:[number,string][]=[];for(const n of names){const at=p.indexOf(' '+plainT(n)+' ');const len=plainT(n).length;if(at>=0&&!hits.some(([pos,h])=>at<pos+plainT(h).length&&at+len>pos))hits.push([at,n])}
 return hits.sort((a,b)=>a[0]-b[0]).map(h=>h[1])}

/** Coerenza della risposta con lo stato dopo il turno, sulle forme riconoscibili («X: prezzo da A a B», «X: finito», «X: nascosto»). */
function incoherent(reply:string,after:EvalMenu):string[]{
 const items=[...flat(after).values()],find=(label:string)=>{const l=plainT(label);return items.find(i=>plainT(i.name)===l)??items.find(i=>l.startsWith(plainT(i.name)+' '))}
 const out:string[]=[],clean=reply.replace(/\*/g,'')
 for(const m of clean.matchAll(/^\s*(?:[-•]\s*)?([^\n:]{2,80}):\s*prezzo da ([\d.,]+)\s*€ a ([\d.,]+)\s*€/gm)){const it=find(m[1]!),p=Number(m[3]!.replace(/\./g,'').replace(',','.'));if(it&&Math.abs(it.price-p)>0.001&&Math.abs((it.promo?.price??-1)-p)>0.001)out.push(`dice ${m[1]} a ${m[3]} €, nel menu è ${it.price}`)}
 for(const m of clean.matchAll(/^\s*(?:[-•]\s*)?([^\n:]{2,80}):\s*finit[oa]\b/gm)){const it=find(m[1]!);if(it&&it.available!==false)out.push(`dice ${m[1]} finito, nel menu è disponibile`)}
 for(const m of clean.matchAll(/^\s*(?:[-•]\s*)?([^\n:]{2,80}):\s*nascost[oa]\b/gm)){const it=find(m[1]!);if(it&&!it.hidden)out.push(`dice ${m[1]} nascosto, nel menu è visibile`)}
 return out}

/** Modifica fatta dalla dashboard a metà conversazione: entra nello stato di partenza del confronto. */
export function applyDash(m:EvalMenu,d:{dish:string,field:string,value:unknown}):EvalMenu{const w=structuredClone(m);for(const x of w.menus)for(const s of x.sections)for(const i of s.items)if(i.name===d.dish)(i as any)[d.field]=d.value;return w}

export function judge(conv:Conversation,initial:EvalMenu,run:BotRun):Verdict{
 const f:Fail[]=[],replies=run.turns.map(t=>t.reply)
 const add=(sev:Fail['sev'],code:string,why:string)=>f.push({sev,code,why})
 // Attesa dinamica «sì la seconda»: dipende dalle opzioni mostrate.
 let changes=conv.changes
 if(conv.pick){const r=replies[conv.pick.turn-1]??'',opts=optionsIn(r,initial);const chosen=conv.pick.pick==='all'?opts:opts[conv.pick.pick-1]?[opts[conv.pick.pick-1]!]:[]
  changes=[...changes,...chosen.map(conv.pick.make)];if(!chosen.length)add('MEDIO','opzioni-non-leggibili',`al turno ${conv.pick.turn} il bot non ha mostrato un'opzione n.${conv.pick.pick}`)}
 let prev=initial,base=initial,clar=0,unexpected=0,i=0
 const askTurns=new Set(conv.ask??[]),askNoWrite=conv.askNoWrite!==false
 for(const turn of conv.turns){
  if('dash' in turn){prev=applyDash(prev,turn.dash);base=applyDash(base,turn.dash);continue}
  if('wait' in turn)continue
  const t=run.turns[i++];if(!t){add('GRAVE','nessuna-risposta',`turno ${i}: il bot non ha restituito il turno`);continue}
  const n=i,r=t.reply??'',d=diff(prev,t.menuAfter)
  if(!r.trim())add('GRAVE','nessuna-risposta',`turno ${n}: nessuna risposta`)
  if(turn.q&&d.length)add('GRAVE','scrittura-su-domanda',`turno ${n} (domanda): scritto ${d.join(', ')}`)
  // Fase B (17/10): una categoria nuova o rinominata è una scrittura vera anche senza piatti cambiati.
  const sd=sectionDiff(prev,t.menuAfter)
  if(claimsDone(r)&&!d.length&&!sd.length)add('GRAVE','fatto-falso',`turno ${n}: dice fatto ma non ha scritto nulla («${r.slice(0,80)}»)`)
  for(const why of incoherent(r,t.menuAfter))add('GRAVE','risposta-incoerente',`turno ${n}: ${why}`)
  if(ERROR.test(r))add('GRAVE','errore-generico',`turno ${n}: errore generico`)
  const nf=r.match(/Non trovo «([^»]+)»/);if(nf&&(nf[1]!.split(/\s+/).length>=4||/\b(aggiung\w*|costa|euro|metti\w*|cambia|prezzo|finit\w*|nascondi|togli)\b/.test(plainT(nf[1]!))))add('GRAVE','frase-come-piatto',`turno ${n}: «Non trovo «${nf[1]}»»`)
  if(RAW.test(r))add('BASSO','valori-grezzi',`turno ${n}: copy con valori grezzi`)
  const q=isQuestion(r)&&!d.length;if(q){clar++;if(!askTurns.has(n))unexpected++}
  if(askTurns.has(n)){if(d.length&&askNoWrite)add('GRAVE','scrive-invece-di-chiedere',`turno ${n}: doveva chiedere, ha scritto ${d.join(', ')}`);else if(!isQuestion(r))add('MEDIO','chiarimento-mancante',`turno ${n}: doveva chiedere un chiarimento («${r.slice(0,80)}»)`)}
  // Invariante del contesto (solo se il bot espone la traccia): ≤10 scambi, niente più vecchio di 30 minuti.
  const c=t.context;if(c?.history){const now=Date.parse((c as any).now??'');if(c.history.length>20)add('MEDIO','contesto-oltre-limiti',`turno ${n}: ${c.history.length} messaggi nel contesto (max 20)`);if(Number.isFinite(now)&&c.history.some(h=>now-Date.parse(h.at)>30*60000))add('MEDIO','contesto-oltre-limiti',`turno ${n}: contesto con messaggi più vecchi di 30 minuti`)}
  prev=t.menuAfter}
 const wantsSections=changes.some(c=>c.op==='section')
 const expected=changes.map(key).sort(),actual=[...diff(base,run.finalMenu),...(wantsSections?sectionDiff(base,run.finalMenu).filter(k=>k.startsWith('section|')).map(k=>'section|'+plainT(k.slice(8))):[])].sort(),interim=(conv.interim??[]).map(key)
 const altSets=(conv.alt??[]).map(s=>s.map(key))
 const matchesAlt=altSets.some(ks=>ks.length===actual.length&&actual.every(k=>ks.some(e=>same(e,k)))&&ks.every(e=>actual.some(k=>same(e,k))))
 if(!matchesAlt){
  const wrong=actual.filter(k=>!expected.some(e=>same(e,k))),missing=expected.filter(e=>!actual.some(k=>same(e,k)))
  // Una scrittura giusta al momento (il prezzo del primo turno) che il titolare poi corregge o annulla non è una modifica
  // non richiesta: è una correzione non applicata (GRAVE come «non applicato» di fix-loop, ma non di sicurezza).
  for(const k of wrong){if(interim.some(e=>same(e,k))){add('GRAVE','correzione-non-applicata',`resta la modifica poi corretta/annullata: ${k}`);continue}
   const touched=expected.some(e=>dishOf(e)===dishOf(k)&&e.split('|')[0]===k.split('|')[0]);add('GRAVE',touched?'modifica-sbagliata':'modifica-non-richiesta',`${touched?'valore sbagliato':'non richiesto'}: ${k}`)}
  if(missing.length){const last=replies.at(-1)??''
   if(isRecap(last))add('MEDIO','in-attesa-ok',`resta in attesa di OK: ${missing.join(', ')}`)
   else if(!last.trim())add('GRAVE','richiesta-persa',`richiesta persa senza risposta: ${missing.join(', ')}`)
   else if(LOST.test(last))add('GRAVE','richiesta-persa',`richiesta persa: ${missing.join(', ')}`)
   else if(isQuestion(last))add('MEDIO','chiede-invece-di-agire',`domanda invece di agire / contesto perso: ${missing.join(', ')}`)
   else add('GRAVE','non-applicato',`non applicato: ${missing.join(', ')}`)}}
 // Il nome di un piatto nuovo resta quello scritto (prima lettera a parte), come la batteria round5.
 const was=flat(initial),made=[...flat(run.finalMenu).values()].filter(i=>!was.has(i.id))
 for(const c of changes)if(c.op==='create'){const got=made.find(i=>plainT(i.name)===plainT(c.name));if(got&&got.name.slice(1)!==c.name.slice(1))add('MEDIO','nome-alterato',`«${got.name}» invece di «${c.name}»`)}
 if(conv.reply&&!conv.reply.test(replies.at(-1)??''))add('BASSO','risposta-non-pertinente',`risposta finale senza ${conv.reply}`)
 const llm=run.turns.reduce((a,t)=>({calls:a.calls+t.llm.calls,misses:a.misses+t.llm.misses,tokens:a.tokens+t.llm.tokens,ms:a.ms+t.llm.recordedMs}),{calls:0,misses:0,tokens:0,ms:0})
 return{id:conv.id,family:conv.family,menu:conv.menu,success:!f.some(x=>x.sev!=='BASSO'),fails:f,expected,actual,replies,turns:conv.turns.map(label),clarifications:clar,unexpectedClarifications:unexpected,llmCalls:llm.calls,llmMisses:llm.misses,llmTokens:llm.tokens,latencyMs:run.turns.map(t=>t.latencyMs),recordedLlmMs:llm.ms,usedLlm:llm.calls+llm.misses>0,...(conv.source?{source:conv.source}:{}),...(conv.note?{note:conv.note}:{})}}
export {textOf}
