// Adattatore del bot NUOVO «che ragiona per primo» (perimetro N, fase 2): lo STESSO route vero dell'adattatore attuale con
// l'interruttore `settings.botBrain` acceso e le tabelle nuove del cervello emulate in memoria (CONTRATTO §2):
// cronologia `tako_owner_brain_turns`, memoria `tako_owner_brain_memory` e log `tako_owner_brain_memory_log`.
// Le query sono quelle di `sqlBrainStore` (apps/server/src/lib/owner-brain-memory.ts): se cambiano, cambia anche qui.
import type {BotUnderTest} from '../types.js'
import type {createRouteBot as CreateRouteBot} from '../route-harness.js'

type Turn={id:number,restaurant_id:string,phone:string,role:string,body:string,created_at:Date}
type Mem={id:string,restaurant_id:string,phone?:string,phrase:string,kind:string,item_id:string|null,meaning:string,state:string,confirmations:number,uses:number,last_used_at:Date|null,origin:string,created_at:Date,updated_at:Date}
export const brainTables={turns:[] as Turn[],memory:new Map<string,Mem>(),log:[] as any[],seq:0}
const iso=(v:unknown)=>new Date(String(v))

export function brainSql(text:string,p:any[]):any[]|undefined{
 const t=text.replace(/\s+/g,' ').trim(),T=brainTables
 if(!t.includes('tako_owner_brain_'))return undefined
 if(t.startsWith('SELECT role,body,created_at FROM tako_owner_brain_turns')){const since=iso(p[2]);return T.turns.filter(r=>r.restaurant_id===p[0]&&r.phone===p[1]&&r.created_at>since).sort((a,b)=>+b.created_at-+a.created_at||b.id-a.id).slice(0,Number(p[3])).map(r=>({...r}))}
 if(t.startsWith('INSERT INTO tako_owner_brain_turns')){T.turns.push({id:++T.seq,restaurant_id:p[0],phone:p[1],role:p[2],body:p[3],created_at:iso(p[4])});return[]}
 if(t.startsWith('DELETE FROM tako_owner_brain_turns')){const since=iso(p[1]),mine=T.turns.filter(r=>r.phone===p[0]).sort((a,b)=>+b.created_at-+a.created_at||b.id-a.id),keep=new Set(mine.slice(0,Number(p[3])).map(r=>r.id));T.turns=T.turns.filter(r=>r.phone!==p[0]||(r.created_at>since&&keep.has(r.id)));return[]}
 if(t.startsWith('SELECT id,restaurant_id,phrase,kind,item_id')){return [...T.memory.values()].filter(m=>m.restaurant_id===p[0]).sort((a,b)=>+b.updated_at-+a.updated_at).map(m=>({...m}))}
 if(t.startsWith('INSERT INTO tako_owner_brain_memory(')){const [id,restaurant_id,phrase,kind,item_id,meaning,state,confirmations,uses,last,origin]=p;const old=T.memory.get(id),now=new Date()
  T.memory.set(id,{id,restaurant_id,phrase,kind,item_id,meaning,state,confirmations:Number(confirmations),uses:Number(uses),last_used_at:last?iso(last):null,origin,created_at:old?.created_at??now,updated_at:now});return[]}
 if(t.startsWith('DELETE FROM tako_owner_brain_memory')){const m=T.memory.get(p[1]);if(m&&m.restaurant_id===p[0])T.memory.delete(p[1]);return[]}
 if(t.startsWith('INSERT INTO tako_owner_brain_memory_log')){T.log.push({restaurant_id:p[0],memory_id:p[1],phrase:p[2],op:p[3],item_id:p[4],detail:p[5]});return[]}
 return undefined}
export const resetBrainTables=()=>{brainTables.turns=[];brainTables.memory.clear();brainTables.log=[];brainTables.seq=0}

export function createNewBot(createRouteBot:typeof CreateRouteBot):BotUnderTest{
 const inner=createRouteBot({name:'nuovo',settings:{botBrain:true},extraSql:brainSql})
 // Lo stato delle tabelle nuove si azzera a ogni conversazione (le altre le azzera già run()).
 return{name:'nuovo',ready:true,async run(conv,menu,ctx){resetBrainTables();return inner.run(conv,menu,ctx)}}
}
