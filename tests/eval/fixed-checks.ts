// Controlli del set PREZZO FISSO (motore Haiku, 21/10/2026; CONTRATTO docs/webapp/menu-prezzo-fisso-2026-10-21/CONTRATTO.md §1 §4).
// Ogni caso porta le OPERAZIONI attese per turno (FixedOp); da qui un ORACOLO calcola lo stato atteso del menu dopo ogni turno
// (formule, pricing, piatti visibili per sottomenu) e le attese `changes` del giudice condiviso. Il runner (eval-haiku.test.ts)
// confronta il menu PUBBLICATO dopo ogni turno con l'oracolo.
// Codici (GRAVE): formula-sbagliata (sicurezza: formula/pricing cambiati in modo diverso dall'atteso, anche prezzo non detto o
// formula tolta senza conferma) · formula-non-applicata · prezzo-piatto-in-menu-fisso (sicurezza: prezzo scritto su un piatto di un
// menu fisso, o piatto nuovo con prezzo ≠ 0) · piatto-eliminato-in-sostituzione (sicurezza) · sostituzione-incompleta (nel
// sottomenu sostituito i visibili non sono esattamente quelli detti, o un piatto omonimo ricreato con id nuovo) ·
// visibili-non-richiesti (sicurezza: piatto visibile in un sottomenu non toccato, es. creato nel Menu sbagliato) ·
// chiede-prezzo-in-menu-fisso. Elenco di sicurezza: FIXED_SECURITY (aggiunto a SECURITY nel runner).
import {isQuestion} from './judge.js'
import {nk} from './struct-checks.js'
import type {Change,Conversation,EvalItem,EvalMenu,Fail,Verdict} from './types.js'

/** Operazione attesa in un turno. `rep.names`: nomi detti; «detto=Nome esistente» se il nome detto è parziale (es. «cotoletta=Cotoletta alla milanese»). */
export type FixedOp=
 |{k:'fp',menu:string,name:string,price:number} // prezzo di una formula esistente
 |{k:'fn',menu:string,name:string,price:number} // formula nuova
 |{k:'fd',menu:string,name:string} // formula tolta
 |{k:'pricing',menu:string,v:'carta'|'fisso'}
 |{k:'rep',menu:string,section:string,names:string[]} // sostituzione giornaliera
 |{k:'ci',menu:string,section:string,name:string,price:number} // piatto nuovo
 |{k:'ip',menu:string,dish:string,price:number} // prezzo di un piatto (alla carta)
 |{k:'undo'} // annulla l'ultima modifica: torna allo stato di prima del turno precedente
export type FixedSpec={
 /** Stato atteso: [iniziale, dopo turno 1, …] (oracolo). */
 oracle:EvalMenu[]
 /** Turni (da 1) in cui una domanda senza nessuna scrittura vale come esito giusto (vocali sporchi, conferme). */
 orAsk:number[]
 /** Turni con una sostituzione: id dei sottomenu sostituiti (dal turno in poi restano «bersaglio»). */
 repTurns:Record<number,string[]>
 /** Mai chiedere il prezzo di un piatto in tutta la conversazione. */
 noPriceAsk:boolean
}
export type FixedCase=Conversation&{fixed?:FixedSpec}
export const FIXED_SECURITY=['formula-sbagliata','prezzo-piatto-in-menu-fisso','piatto-eliminato-in-sostituzione','visibili-non-richiesti']

type AnyMenu=EvalMenu['menus'][number]&{pricing?:string,formulas?:{id:string,name:string,price:number,note?:string|null}[],included?:string|null}
const menuBy=(w:EvalMenu,name:string)=>{const m=w.menus.find(x=>nk(x.name)===nk(name));if(!m)throw new Error('oracolo: Menu «'+name+'» assente');return m as AnyMenu}
const secBy=(m:AnyMenu,name:string)=>{const s=m.sections.find(x=>nk(x.name)===nk(name));if(!s)throw new Error(`oracolo: sottomenu «${name}» assente in «${m.name}»`);return s}
const cap=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1)
let seq=0
/** Applica le operazioni attese (copia). I piatti nuovi hanno id «oracolo-…»: il controllo li riconosce per nome. */
export function applyOps(prev:EvalMenu,ops:FixedOp[],history:EvalMenu[]):EvalMenu{
 let w=structuredClone(prev)
 for(const op of ops){
  if(op.k==='undo'){w=structuredClone(history.at(-2)??history[0]!);continue}
  if(op.k==='ip'){const it=menuBy(w,op.menu).sections.flatMap(s=>s.items).find(i=>i.name===op.dish);if(!it)throw new Error('oracolo: piatto '+op.dish);it.price=op.price;continue}
  const m=menuBy(w,op.menu)
  if(op.k==='fp'){const f=(m.formulas??[]).find(x=>nk(x.name)===nk(op.name));if(!f)throw new Error('oracolo: formula '+op.name);f.price=op.price}
  else if(op.k==='fn')m.formulas=[...(m.formulas??[]),{id:'oracolo-f'+(++seq),name:op.name,price:op.price,note:null}]
  else if(op.k==='fd')m.formulas=(m.formulas??[]).filter(x=>nk(x.name)!==nk(op.name))
  else if(op.k==='pricing')m.pricing=op.v
  else if(op.k==='ci')secBy(m,op.section).items.push({id:'oracolo-i'+(++seq),name:op.name,price:op.price})
  else if(op.k==='rep'){const s=secBy(m,op.section),keep=new Set<string>()
   for(const raw of op.names){const [said,real]=raw.split('=') as [string,string|undefined],it=s.items.find(i=>nk(i.name)===nk(real??said))
    if(it){it.hidden=false;keep.add(it.id)}else{const id='oracolo-i'+(++seq);s.items.push({id,name:cap(said.trim()),price:0});keep.add(id)}}
   for(const i of s.items)if(!keep.has(i.id))i.hidden=true}}
 return w}

const items=(w:EvalMenu)=>new Map(w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>[i.id,{i,s:s.name}] as const))))
/** Attese del giudice condiviso (per nome) dalla differenza iniziale → finale dell'oracolo. */
export function changesOf(a:EvalMenu,b:EvalMenu):Change[]{const A=items(a),out:Change[]=[]
 for(const [id,{i,s}] of items(b)){const p=A.get(id)
  if(!p){out.push({op:'create',name:i.name,price:i.price,section:s});continue}
  if(p.i.price!==i.price)out.push({op:'price',dish:p.i.name,price:i.price})
  if(!!p.i.hidden!==!!i.hidden)out.push({op:'hidden',dish:p.i.name,value:!!i.hidden})}
 return out}

const fKey=(m:AnyMenu|undefined)=>m?[m.pricing??'carta',...(m.formulas??[]).map(f=>nk(f.name)+'='+Math.round(f.price*100)/100).sort()].join(' · '):'—'
const PRICE_ASK=/\bprezz|\bquanto (?:cost|viene|lo|la|li|le|vuoi)|\ba quanto\b|\bcosto\b|\beuro\b.*\?/i

/** `menus` = menu pubblicato [iniziale, dopo turno 1, …]. */
export function fixedChecks(c:FixedCase,v:Verdict,menus:EvalMenu[]):Fail[]{
 const spec=c.fixed;if(!spec)return[]
 const f:Fail[]=[],seen=new Set<string>(),add=(code:string,why:string)=>{const k=code+'|'+why;if(seen.has(k))return;seen.add(k);f.push({sev:'GRAVE',code,why})}
 const init=menus[0]!,initIds=new Set(items(init).keys()),hasRep=Object.keys(spec.repTurns).length>0,targets=new Set<string>()
 for(let n=1;n<menus.length&&n<spec.oracle.length;n++){
  const A=menus[n]!,P=menus[n-1]!,O=spec.oracle[n]!,r=v.replies[n-1]??''
  for(const id of spec.repTurns[n]??[])targets.add(id)
  // chiede il prezzo di un piatto (in qualsiasi turno) dove non si deve mai
  if(spec.noPriceAsk&&isQuestion(r)&&PRICE_ASK.test(r))add('chiede-prezzo-in-menu-fisso',`turno ${n}: «${r.replace(/\s+/g,' ').slice(0,100)}»`)
  const same=JSON.stringify(A.menus)===JSON.stringify(P.menus)
  if(spec.orAsk.includes(n)&&same&&isQuestion(r))continue
  // formule e pricing
  for(const om of O.menus as AnyMenu[]){const am=A.menus.find(x=>x.id===om.id) as AnyMenu|undefined,pm=P.menus.find(x=>x.id===om.id) as AnyMenu|undefined
   const ka=fKey(am),ko=fKey(om),kp=fKey(pm);if(ka===ko)continue
   if(ka===kp)add('formula-non-applicata',`turno ${n}: «${om.name}» resta ${ka}, atteso ${ko}`);else add('formula-sbagliata',`turno ${n}: «${om.name}» è ${ka}, atteso ${ko}`)}
  // prezzi dei piatti nei menu fissi
  const PI=items(P)
  for(const m of A.menus as AnyMenu[]){if(m.pricing!=='fisso')continue
   for(const s of m.sections)for(const i of s.items){const p=PI.get(i.id)?.i
    if(p&&p.price!==i.price)add('prezzo-piatto-in-menu-fisso',`turno ${n}: «${i.name}» (${m.name}) da ${p.price} a ${i.price} €`)
    else if(!p&&i.price!==0)add('prezzo-piatto-in-menu-fisso',`turno ${n}: piatto nuovo «${i.name}» (${m.name}) a ${i.price} € invece che senza prezzo`)}}
  // piatti eliminati durante una sostituzione (mai: si nascondono)
  if(hasRep){const AI=items(A);for(const [id,{i}] of PI)if(!AI.has(id)&&initIds.has(id))add('piatto-eliminato-in-sostituzione',`turno ${n}: eliminato «${i.name}»`)}
  // piatti visibili per sottomenu
  for(const om of O.menus)for(const os of om.sections){const as=A.menus.find(x=>x.id===om.id)?.sections.find(x=>x.id===os.id);if(!as)continue
   const vis=(xs:EvalItem[])=>xs.filter(i=>!i.hidden),exp=vis(os.items),got=vis(as.items),isT=targets.has(os.id),where=`«${om.name} > ${os.name}»`
   const used=new Set<string>(),missing:string[]=[]
   for(const e of exp){const byId=e.id.startsWith('oracolo-')?undefined:got.find(g=>g.id===e.id)
    const hit=byId??(e.id.startsWith('oracolo-')?got.find(g=>!initIds.has(g.id)&&!used.has(g.id)&&nk(g.name)===nk(e.name)):undefined)
    if(hit){used.add(hit.id);continue}
    const twin=got.find(g=>!used.has(g.id)&&nk(g.name)===nk(e.name))
    if(twin){used.add(twin.id);missing.push(`«${e.name}» ricreato con un id nuovo (persi i dati del piatto)`)}else missing.push(`manca «${e.name}»`)}
   const extra=got.filter(g=>!used.has(g.id)).map(g=>`«${g.name}» visibile ma non detto`)
   if(isT){if(missing.length||extra.length)add('sostituzione-incompleta',`turno ${n}: ${where}: ${[...missing,...extra].join('; ')}`)}
   else if(extra.length)add('visibili-non-richiesti',`turno ${n}: ${where}: ${extra.join('; ')}`)}}
 return f}
