// Verifica di equivalenza: per ogni scenario applica la stessa modifica al QA con il percorso VECCHIO (legacy-store = c5693fa)
// e con quello NUOVO (delta), ciascuno in una transazione ANNULLATA (rollback, nessun commit, nessun segnale live),
// e confronta per hash lo stato risultante delle tabelle del menu, del workspace e dello storico. Solo QA.
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createHash } from 'node:crypto'
let seq=0;const randomUUID=()=>'eeeeeeee-0000-4000-8000-'+String(++seq).padStart(12,'0')
import * as schema from '../../../../../packages/db/src/schema/index.js'
import * as fresh from '../../../../../apps/server/src/lib/menu-workspace-store.js'
import * as legacy from './legacy-store.js'
import { workspaceSchema } from '../../../../../apps/server/src/lib/menu-workspace-contract.js'
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
class Rollback extends Error{}
const h=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16)
type W=any
async function state(tx:any,base:number){
 const q=(s:string)=>tx.execute(schema.menus&&{getSQL:()=>({} as any)} as any) // placeholder (non usato)
 void q
 const run=(text:string)=>tx.session.client.unsafe(text,[QA])
 const menus=await run(`SELECT id,restaurant_id,name,description,type,active,position FROM menus WHERE restaurant_id=$1 ORDER BY id`)
 const sections=await run(`SELECT s.id,s.menu_id,s.name,s.description,s.active,s.position,s.name_translations FROM menu_sections s JOIN menus m ON m.id=s.menu_id WHERE m.restaurant_id=$1 ORDER BY s.id`)
 const items=await run(`SELECT id,section_id,restaurant_id,name,description,price::text,image_url,allergens,tags,available,featured,position,kitchen_station,prep_time_minutes,cost_price::text,calories,name_translations,description_translations FROM menu_items WHERE restaurant_id=$1 ORDER BY id`)
 const variants=await run(`SELECT v.id,v.item_id,v.name,v.price_modifier::text,v.available FROM item_variants v JOIN menu_items i ON i.id=v.item_id WHERE i.restaurant_id=$1 ORDER BY v.id`)
 const translations=await run(`SELECT restaurant_id,item_id,lang,name,description FROM menu_item_translations WHERE restaurant_id=$1 ORDER BY item_id,lang`)
 const ws=await run(`SELECT draft,published,revision,published_revision FROM menu_workspaces WHERE restaurant_id=$1`)
 const versions=await tx.session.client.unsafe(`SELECT revision,label,snapshot,created_by FROM menu_workspace_versions WHERE restaurant_id=$1 AND revision>$2 ORDER BY revision`,[QA,base])
 return {menus:h(menus),sections:h(sections),items:h(items),variants:h(variants),translations:h(translations),ws:h(ws),versions:h(versions),n:{menus:menus.length,items:items.length,translations:translations.length,variants:variants.length,versions:versions.length}}
}
export async function run(url:string,ca:string|undefined){
 let count=0
 const client=postgres(url,{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{},debug:()=>{count++}})
 const db=drizzle(client,{schema})
 const [link]=await client`SELECT actor_id FROM tako_whatsapp_links WHERE restaurant_id=${QA}`
 const actor=String(link!.actor_id)
 const [row]=await client`SELECT draft,published,revision,published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`
 const base=Number(row!.revision),draft=workspaceSchema.parse(row!.draft)
 const tpl=draft.menus[0]!.sections[0]!.items[0]!
 const big=(w:W)=>{const s0=w.menus[0].sections[0];for(let c=0;c<12;c++){w.menus[0].sections.push({...structuredClone(s0),id:randomUUID(),name:'Cat grande '+c,translations:{en:{name:'Big cat '+c},de:{name:'Gross '+c}},items:Array.from({length:25},(_,k)=>({...structuredClone(tpl),id:randomUUID(),name:`Piatto ${c}-${k}`,price:5+k/4,translations:{en:{name:`Dish ${c}-${k}`,description:'d'},de:{name:`Gericht ${c}-${k}`}},variants:k%5===0?[{id:randomUUID(),name:'Grande',priceModifier:2,available:true}]:[]}))})}}
 const scenarios:[string,(w:W)=>void,boolean?][]= [
  ['nessuna modifica',w=>{}],
  ['prezzo',w=>{w.menus[0].sections[0].items[0].price+=1.1}],
  ['nome',w=>{w.menus[0].sections[0].items[0].name+=' X'}],
  ['piatto nuovo',w=>{w.menus[0].sections[0].items.push({...structuredClone(tpl),id:randomUUID(),name:'Nuovo eq',translations:{}})}],
  ['piatto eliminato',w=>{w.menus[0].sections[0].items.pop()}],
  ['categoria nuova',w=>{w.menus[0].sections.push({...structuredClone(draft.menus[0]!.sections[0]),id:randomUUID(),name:'Cat eq',translations:{en:{name:'Cat en'}},items:[{...structuredClone(tpl),id:randomUUID(),name:'Piatto cat',translations:{en:{name:'Dish'}}}]})}],
  ['categoria eliminata',w=>{w.menus[0].sections.push({...structuredClone(draft.menus[0]!.sections[0]),id:randomUUID(),name:'Cat tmp',items:[]});w.menus[0].sections.shift()}],
  ['esaurito',w=>{const i=w.menus[0].sections[0].items[1];i.available=!i.available}],
  ['nascosto',w=>{w.menus[0].sections[0].items[2].hidden=true}],
  ['menu nuovo',w=>{w.menus.push({...structuredClone(draft.menus[0]),id:randomUUID(),name:'Menu eq',sections:[{...structuredClone(draft.menus[0]!.sections[0]),id:randomUUID(),items:[{...structuredClone(tpl),id:randomUUID(),name:'P menu eq'}]}]})}],
  ['menu disattivato',w=>{w.menus[0].active=false}],
  ['traduzioni cambiate',w=>{const i=w.menus[0].sections[0].items[0];i.translations={...i.translations,en:{name:'Changed EN',description:'desc en'},fr:{name:'FR'}};const j=w.menus[0].sections[0].items[1];j.translations={}}],
  ['varianti',w=>{const i=w.menus[0].sections[0].items[0];i.variants=[{id:randomUUID(),name:'Media',priceModifier:1.5,available:true},{id:randomUUID(),name:'Grande',priceModifier:3,available:false}]}],
  ['ordine e spostamento',w=>{const s=w.menus[0].sections[0];s.items.reverse();w.menus[0].sections.push({...structuredClone(draft.menus[0]!.sections[0]),id:randomUUID(),name:'Dest',items:[s.items.pop()]})}],
  ['campi vari',w=>{const i=w.menus[0].sections[0].items[0];i.featured=!i.featured;i.allergens=['glutine','latte'];i.tags=['vegano'];i.imageUrl=null;i.description='Nuova descrizione';i.prepTimeMinutes=0;i.costPrice=2.25;i.calories=500;i.kitchenStation='forno'}],
  ['menu grande (300 piatti, 3 lingue)',big],
 ]
 const results:any[]=[]
 for(const [name,mutate] of scenarios){
  const out:any={name}
  for(const [label,store] of [['old',legacy],['new',fresh]] as const){
   count=0;const t0=performance.now();let st:any,err:string|null=null
   // pre-passaggio comune: un esaurito «dal vivo» (PATCH) diverso dal pubblicato, per provare l'unione della disponibilità
   try{await db.transaction(async tx=>{
    const c0=count,s0=performance.now()
    const [cur]=await (tx as any).session.client.unsafe(`SELECT draft,revision FROM menu_workspaces WHERE restaurant_id=$1 FOR UPDATE`,[QA]);const draft=workspaceSchema.parse(cur.draft),base=Number(cur.revision)
    const live=draft.menus[0]!.sections[0]!.items[3];if(live)await (tx as any).session.client.unsafe(`UPDATE menu_items SET available=NOT available WHERE id=$1`,[live.id])
    seq=0;const w=structuredClone(draft) as W;mutate(w);const parsed=workspaceSchema.parse(w)
    const s1=performance.now(),c1=count
    const saved=await store.mutateWorkspace(QA,actor,base,parsed,false,'Salvataggio',tx as any)
    const s2=performance.now(),c2=count
    await store.mutateWorkspace(QA,actor,saved.revision,parsed,true,'Pubblicazione',tx as any)
    out[label+'SaveMs']=Math.round(s2-s1);out[label+'SaveQ']=c2-c1;out[label+'PubMs']=Math.round(performance.now()-s2);out[label+'PubQ']=count-c2
    void c0;void s0
    st=await state(tx,base);st.base=undefined
    throw new Rollback()})}catch(e){if(!(e instanceof Rollback))err=(e as Error).message.slice(0,160)}
   out[label]=err?{err}:st;void t0
  }
  out.equal=JSON.stringify(out.old)===JSON.stringify(out.new)
  results.push(out)
 }
 // errori: PROVA bloccata e conflitto di revisione → stessa eccezione
 for(const [label,store] of [['old',legacy],['new',fresh]] as const){
  try{await db.transaction(async tx=>{await (tx as any).session.client.unsafe(`UPDATE restaurants SET settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{takomenuTrial}','true') WHERE id=$1`,[QA]);try{await store.mutateWorkspace(QA,actor,base,draft,true,'P',tx as any);results.push({name:'prova bloccata '+label,err:'nessun errore'})}catch(e){results.push({name:'prova bloccata '+label,err:(e as Error).constructor.name})};throw new Rollback()})}catch(e){if(!(e instanceof Rollback))throw e}
  try{await db.transaction(async tx=>{try{await store.mutateWorkspace(QA,actor,base-1,draft,false,'S',tx as any)}catch(e){results.push({name:'conflitto '+label,err:(e as Error).constructor.name})};throw new Rollback()})}catch(e){if(!(e instanceof Rollback))throw e}
 }
 const [after]=await client`SELECT revision FROM menu_workspaces WHERE restaurant_id=${QA}`
 await client.end()
 return {base,revisionAfter:Number(after!.revision),results}
}
