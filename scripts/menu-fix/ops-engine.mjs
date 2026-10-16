// Motore puro per le correzioni menu 2026-10-16 (formato: docs/webapp/menu-fix-2026-10-16/OPS-SCHEMA.md).
// applyOps(workspaceData, ops, opts) -> {workspace, errors, warnings, log, touched}
// Non muta l'input. Ogni op è atomica: se fallisce, il workspace torna com'era prima di quella op. Tocca solo i campi nominati dalle op; dopo l'applicazione verifica che tutto il resto sia identico
// e valida con lo zod workspaceSchema del contract (se node gira con --experimental-strip-types) + controlli replicati.
import {randomUUID as nodeUUID} from 'node:crypto'

let schema=null,schemaError=null
try{({workspaceSchema:schema}=await import('../../apps/server/src/lib/menu-workspace-contract.ts'))}catch(e){schemaError=String(e?.message||e).slice(0,200)}
export const zodAvailable=()=>!!schema
export const zodLoadError=()=>schemaError
// Normalizza come farebbe il server (default zod); serve per confrontare la rilettura.
export const parseWorkspace=w=>{if(!schema)throw Error('zod non disponibile');return schema.parse(w)}

export const ALLERGENS=['glutine','crostacei','uova','pesce','arachidi','soia','latte','frutta-a-guscio','sedano','senape','sesamo','solfiti','lupini','molluschi']
export const MENU_TYPES=['main','lunch','dinner','seasonal','event','drinks']
export const OP_TYPES=['deleteItem','updateItem','moveItem','createMenu','createSection','updateSection','moveSection','deleteSection','updateMenu','toVariants','copyItem']
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ITEM_SET=['name','description','price','priceDisplay','allergens','hidden']
const SECTION_SET=['name','description','parentSectionId','parentTemp']
const MENU_SET=['name','description']
const cents=n=>Math.round(n*100)/100
const isText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max
const nullableText=(v,max)=>v===null||(typeof v==='string'&&v.length<=max)
const isPrice=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100000

class OpError extends Error{}
const fail=m=>{throw new OpError(m)}

export function applyOps(workspaceData,ops,{randomUUID=nodeUUID,allergenIds=ALLERGENS,requireEvidence=true}={}){
 const before=workspaceData,w=structuredClone(workspaceData),errors=[],warnings=[],log=[],temps=new Map()
 const touched={items:new Set(),sections:new Set(),menus:new Set(),deletedItems:new Set(),deletedSections:new Set(),newSections:new Set(),newMenus:new Set(),newItems:new Set()}
 if(!w||!Array.isArray(w.menus))return {workspace:w,errors:[{index:-1,op:null,message:'workspace senza menus'}],warnings,log,touched}
 if(!Array.isArray(ops))return {workspace:w,errors:[{index:-1,op:null,message:'ops non è un array'}],warnings,log,touched}

 const findMenu=id=>w.menus.find(m=>m.id===id)||fail(`menu inesistente: ${id}`)
 const findSection=id=>{for(const m of w.menus){const i=m.sections.findIndex(s=>s.id===id);if(i>=0)return {menu:m,section:m.sections[i],index:i}}fail(`sezione inesistente: ${id}`)}
 const findItem=id=>{for(const m of w.menus)for(const s of m.sections){const i=s.items.findIndex(x=>x.id===id);if(i>=0)return {menu:m,section:s,item:s.items[i],index:i}}fail(`item inesistente: ${id}`)}
 const temp=(name,kind)=>{const t=temps.get(name);if(!t)fail(`temp sconosciuto: ${name}`);if(t.kind!==kind)fail(`temp ${name} è un ${t.kind}, non un ${kind}`);return t.id}
 const ref=(op,idKey,tempKey,kind)=>{const hasId=op[idKey]!=null,hasTemp=op[tempKey]!=null;if(hasId===hasTemp)fail(`serve esattamente uno tra ${idKey} e ${tempKey}`);return hasId?op[idKey]:temp(op[tempKey],kind)}
 const newTemp=(name,kind)=>{if(!isText(name,200))fail('temp mancante');if(temps.has(name))fail(`temp duplicato: ${name}`);const id=randomUUID();temps.set(name,{kind,id});return id}
 const insertAt=(arr,index,...values)=>{if(index==null){arr.push(...values);return arr.length-values.length}if(!Number.isInteger(index)||index<0||index>arr.length)fail(`index ${index} fuori range 0..${arr.length}`);arr.splice(index,0,...values);return index}
 const checkSetKeys=(set,allowed)=>{if(!set||typeof set!=='object'||Array.isArray(set))fail('set mancante');const keys=Object.keys(set);if(!keys.length)fail('set vuoto');const bad=keys.filter(k=>!allowed.includes(k));if(bad.length)fail(`campi non ammessi in set: ${bad.join(',')}`)}
 const childrenOf=(menu,id)=>menu.sections.filter(s=>s.parentSectionId===id)
 const itemLabel=(x)=>`${x.item.name} [${x.section.name}]`

 const handlers={
  deleteItem(op){const x=findItem(op.itemId);x.section.items.splice(x.index,1);touched.deletedItems.add(x.item.id);return `elimina "${itemLabel(x)}" (${x.item.price})`},
  updateItem(op){
   const x=findItem(op.itemId),set=op.set;checkSetKeys(set,ITEM_SET)
   if('name' in set&&!isText(set.name,300))fail('name non valido')
   if('description' in set&&!nullableText(set.description,4000))fail('description non valida')
   if('price' in set&&!isPrice(set.price))fail(`price non valido: ${set.price}`)
   if('priceDisplay' in set&&!nullableText(set.priceDisplay,200))fail('priceDisplay non valido')
   if('hidden' in set&&typeof set.hidden!=='boolean')fail('hidden deve essere boolean')
   if('allergens' in set){if(!Array.isArray(set.allergens))fail('allergens deve essere array');const bad=set.allergens.filter(a=>!allergenIds.includes(a));if(bad.length)fail(`allergeni sconosciuti: ${bad.join(',')}`);if(new Set(set.allergens).size!==set.allergens.length)fail('allergeni duplicati')}
   const changes=[];for(const k of Object.keys(set)){const v=Array.isArray(set[k])?[...set[k]]:set[k];changes.push(`${k}: ${JSON.stringify(x.item[k])} -> ${JSON.stringify(v)}`);x.item[k]=v}
   touched.items.add(x.item.id);return `aggiorna "${itemLabel(x)}": ${changes.join('; ')}`
  },
  moveItem(op){
   const x=findItem(op.itemId),toId=ref(op,'toSectionId','toSectionTemp','section'),to=findSection(toId)
   x.section.items.splice(x.index,1);insertAt(to.section.items,op.index,x.item)
   return `sposta "${x.item.name}" da [${x.section.name}] a [${to.section.name}]${op.index!=null?' @'+op.index:''}`
  },
  // Copia un piatto in un'altra sezione (anche di un altro menu): tutti i campi identici, id nuovo per il piatto e per ogni variante.
  copyItem(op){
   const x=findItem(op.itemId),toId=ref(op,'toSectionId','toSectionTemp','section'),to=findSection(toId)
   if(to.section.id===x.section.id)fail(`copia di "${x.item.name}" nella sua stessa sezione: sarebbe un doppione`)
   const copy=structuredClone(x.item);copy.id=randomUUID();copy.variants=(copy.variants||[]).map(v=>({...v,id:randomUUID()}))
   insertAt(to.section.items,op.index,copy);touched.newItems.add(copy.id)
   return `copia "${itemLabel(x)}" in [${to.menu.name} / ${to.section.name}]${op.index!=null?' @'+op.index:''} = ${copy.id}`
  },
  createMenu(op){
   if(!isText(op.name,300))fail('name non valido');if(!MENU_TYPES.includes(op.type))fail(`type non valido: ${op.type}`)
   const id=newTemp(op.temp,'menu'),menu={id,name:op.name,description:null,type:op.type,active:true,translations:{},sections:[]}
   insertAt(w.menus,op.index,menu);touched.newMenus.add(id);return `crea menu "${op.name}" (${op.type}) = ${op.temp}`
  },
  createSection(op){
   if(!isText(op.name,4000))fail('name non valido');if('description' in op&&!nullableText(op.description,4000))fail('description non valida')
   const menu=findMenu(ref(op,'menuId','menuTemp','menu'))
   let parent=null;if(op.parentSectionId!=null||op.parentTemp!=null){parent=ref(op,'parentSectionId','parentTemp','section');const p=menu.sections.find(s=>s.id===parent);if(!p)fail('la sezione padre non è nello stesso menu');if(p.parentSectionId)fail('la sezione padre è già figlia (max 1 livello)')}
   const id=newTemp(op.temp,'section'),section={id,parentSectionId:parent,name:op.name,description:op.description??null,active:true,translations:{},items:[]}
   let index=op.index;if(index==null&&parent){const kids=childrenOf(menu,parent),last=kids.length?kids.at(-1).id:parent;index=menu.sections.findIndex(s=>s.id===last)+1}
   insertAt(menu.sections,index,section);touched.newSections.add(id);return `crea sezione "${op.name}" in [${menu.name}]${parent?' figlia':''} = ${op.temp}`
  },
  updateSection(op){
   const x=findSection(op.sectionId),set=op.set;checkSetKeys(set,SECTION_SET)
   if('parentSectionId' in set&&'parentTemp' in set)fail('parentSectionId e parentTemp insieme')
   if('name' in set&&!isText(set.name,4000))fail('name non valido');if('description' in set&&!nullableText(set.description,4000))fail('description non valida')
   const changes=[]
   if('parentSectionId' in set||'parentTemp' in set){
    const parent='parentTemp' in set?temp(set.parentTemp,'section'):set.parentSectionId
    if(parent!==null){const p=x.menu.sections.find(s=>s.id===parent);if(!p)fail('la sezione padre non è nello stesso menu');if(p.parentSectionId)fail('la sezione padre è già figlia (max 1 livello)');if(parent===x.section.id)fail('una sezione non può essere padre di se stessa');if(childrenOf(x.menu,x.section.id).length)fail('la sezione ha figlie: non può diventare figlia')}
    changes.push(`parentSectionId: ${JSON.stringify(x.section.parentSectionId)} -> ${JSON.stringify(parent)}`);x.section.parentSectionId=parent
   }
   for(const k of ['name','description'])if(k in set){changes.push(`${k}: ${JSON.stringify(x.section[k])} -> ${JSON.stringify(set[k])}`);x.section[k]=set[k]}
   touched.sections.add(x.section.id);return `aggiorna sezione [${x.section.name}]: ${changes.join('; ')}`
  },
  moveSection(op){
   const x=findSection(op.sectionId),to=findMenu(ref(op,'toMenuId','toMenuTemp','menu'))
   if(x.section.parentSectionId&&to!==x.menu)fail('sezione figlia verso un altro menu: prima updateSection parentSectionId:null')
   const block=[x.section,...childrenOf(x.menu,x.section.id)],ids=new Set(block.map(s=>s.id))
   x.menu.sections=x.menu.sections.filter(s=>!ids.has(s.id));insertAt(to.sections,op.index,...block)
   return `sposta sezione [${x.section.name}] (+${block.length-1} figlie) da [${x.menu.name}] a [${to.name}]${op.index!=null?' @'+op.index:''}`
  },
  deleteSection(op){
   const x=findSection(op.sectionId);if(x.section.items.length)fail(`sezione [${x.section.name}] non vuota (${x.section.items.length} item)`);if(childrenOf(x.menu,x.section.id).length)fail(`sezione [${x.section.name}] ha figlie`)
   x.menu.sections.splice(x.index,1);touched.deletedSections.add(x.section.id);return `elimina sezione vuota [${x.section.name}]`
  },
  updateMenu(op){
   const m=findMenu(op.menuId),set=op.set;checkSetKeys(set,MENU_SET)
   if('name' in set&&!isText(set.name,300))fail('name non valido');if('description' in set&&!nullableText(set.description,4000))fail('description non valida')
   const changes=[];for(const k of Object.keys(set)){changes.push(`${k}: ${JSON.stringify(m[k])} -> ${JSON.stringify(set[k])}`);m[k]=set[k]}
   touched.menus.add(m.id);return `aggiorna menu [${m.name}]: ${changes.join('; ')}`
  },
  toVariants(op){
   const x=findItem(op.baseItemId);if((x.item.variants||[]).length)fail(`"${x.item.name}" ha già ${x.item.variants.length} varianti`)
   if(!Array.isArray(op.variants)||op.variants.length<2)fail('servono almeno 2 varianti')
   if(op.set!=null){checkSetKeys(op.set,['name']);if(!isText(op.set.name,300))fail('set.name non valido')}
   const from=new Set()
   for(const v of op.variants){if(!isText(v?.name,200))fail('nome variante non valido');if(!isPrice(v.price))fail(`prezzo variante non valido: ${v.price}`);if(v.fromItemId!=null){if(v.fromItemId===x.item.id)fail('fromItemId uguale alla base');if(from.has(v.fromItemId))fail(`fromItemId ripetuto: ${v.fromItemId}`);findItem(v.fromItemId);from.add(v.fromItemId)}}
   if(new Set(op.variants.map(v=>v.name.trim().toLowerCase())).size!==op.variants.length)fail('nomi varianti duplicati')
   const base=Math.min(...op.variants.map(v=>v.price)),oldPrice=x.item.price,oldName=x.item.name
   x.item.price=base;x.item.variants=op.variants.map(v=>({id:randomUUID(),name:v.name,priceModifier:cents(v.price-base),available:true}))
   if(op.set?.name)x.item.name=op.set.name
   const removed=[];for(const id of from){const y=findItem(id);y.section.items.splice(y.index,1);touched.deletedItems.add(id);removed.push(`"${y.item.name}" (${y.item.price})`)}
   touched.items.add(x.item.id)
   return `varianti su "${oldName}"${op.set?.name?` -> "${op.set.name}"`:''}: prezzo ${oldPrice} -> ${base}; ${op.variants.map(v=>`${v.name}=${v.price}`).join(', ')}${removed.length?`; eliminati ${removed.join(', ')}`:''}`
  },
 }

 ops.forEach((op,index)=>{
  const snapshot=structuredClone(w.menus),touchedSnapshot=Object.fromEntries(Object.entries(touched).map(([k,v])=>[k,new Set(v)]))
  try{
   if(!op||typeof op!=='object')fail('op non è un oggetto')
   if(!handlers[op.op])fail(`op sconosciuta: ${op.op}`)
   if(requireEvidence){if(!isText(op.reason,4000))fail('reason mancante');const e=op.evidence;if(!e||!['live','menusmart'].includes(e.source)||typeof e.quote!=='string')fail('evidence mancante o non valida ({source:"live"|"menusmart", ref, quote})')}
   log.push({index,op:op.op,ok:true,text:handlers[op.op](op)})
  }catch(e){if(!(e instanceof OpError))throw e;w.menus=snapshot;Object.assign(touched,touchedSnapshot);errors.push({index,op:op?.op??null,message:e.message});log.push({index,op:op?.op??null,ok:false,text:e.message})}
 })

 for(const m of structuralErrors(w))errors.push({index:-1,op:'validate',message:m})
 for(const m of untouchedChanges(before,w,touched))errors.push({index:-1,op:'integrity',message:m})
 if(schema){const r=schema.safeParse(w);if(!r.success)for(const i of r.error.issues.slice(0,20))errors.push({index:-1,op:'zod',message:`${i.path.join('.')}: ${i.message}`})}
 else warnings.push(`validazione zod non disponibile (${schemaError}); usati solo i controlli replicati`)
 return {workspace:w,errors,warnings,log,touched,temps:Object.fromEntries([...temps].map(([k,v])=>[k,v.id]))}
}

// Controlli chiave replicati dal contract: uuid validi e unici, gerarchia sezioni max 1 livello nello stesso menu, nomi, prezzi, varianti.
export function structuralErrors(w){
 const out=[],ids=new Set(),add=(id,what)=>{if(typeof id!=='string'||!UUID.test(id))out.push(`${what}: id non uuid ${id}`);else if(ids.has(id))out.push(`${what}: id duplicato ${id}`);ids.add(id)}
 for(const p of w.pdfPresets||[])add(p.id,'pdfPreset')
 for(const m of w.menus){
  add(m.id,'menu');if(!isText(m.name,300))out.push(`menu ${m.id}: nome vuoto`);if(m.type!=null&&!MENU_TYPES.includes(m.type))out.push(`menu ${m.id}: type ${m.type}`)
  const secs=new Map(m.sections.map(s=>[s.id,s]))
  for(const s of m.sections){
   add(s.id,'sezione');if(!isText(s.name,4000))out.push(`sezione ${s.id}: nome vuoto`)
   if(s.parentSectionId){const p=secs.get(s.parentSectionId);if(!p||p.parentSectionId||p.id===s.id)out.push(`sezione ${s.name}: gerarchia non valida`)}
   for(const i of s.items){add(i.id,'item');if(!isText(i.name,300))out.push(`item ${i.id}: nome vuoto`);if(!isPrice(i.price))out.push(`item ${i.name}: prezzo ${i.price}`);for(const v of i.variants||[]){add(v.id,'variante');if(typeof v.priceModifier!=='number'||!Number.isFinite(v.priceModifier))out.push(`variante ${v.name}: priceModifier`);if(isPrice(i.price)&&i.price+v.priceModifier<0)out.push(`variante ${v.name} di ${i.name}: prezzo finale negativo`)}}
  }
 }
 const n=w.menus.reduce((c,m)=>c+m.sections.reduce((k,s)=>k+s.items.length,0),0);if(n>5000)out.push('oltre 5000 item')
 return out
}

const stable=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(key=>[key,x[key]])):x)
export const canonical=stable
const without=(o,...keys)=>{const c={...o};for(const k of keys)delete c[k];return c}

// Verifica che tutto ciò che nessuna op ha nominato sia byte-identico (a meno della posizione).
export function untouchedChanges(before,after,touched){
 const out=[]
 if(stable(without(before,'menus'))!==stable(without(after,'menus')))out.push('campi del workspace fuori da menus modificati')
 const idx=w=>{const menus=new Map(),sections=new Map(),items=new Map();for(const m of w.menus){menus.set(m.id,m);for(const s of m.sections){sections.set(s.id,s);for(const i of s.items)items.set(i.id,i)}}return {menus,sections,items}}
 const a=idx(before),b=idx(after)
 for(const [id,i] of a.items){const j=b.items.get(id);if(!j){if(!touched.deletedItems.has(id))out.push(`item sparito senza op: ${i.name}`);continue}if(!touched.items.has(id)&&stable(i)!==stable(j))out.push(`item modificato senza op: ${i.name}`)}
 for(const [id,j] of b.items)if(!a.items.has(id)&&!touched.newItems?.has(id))out.push(`item comparso dal nulla: ${j.name}`)
 for(const [id,s] of a.sections){const t=b.sections.get(id);if(!t){if(!touched.deletedSections.has(id))out.push(`sezione sparita senza op: ${s.name}`);continue}if(!touched.sections.has(id)&&stable(without(s,'items'))!==stable(without(t,'items')))out.push(`sezione modificata senza op: ${s.name}`)}
 for(const [id,t] of b.sections)if(!a.sections.has(id)&&!touched.newSections.has(id))out.push(`sezione comparsa dal nulla: ${t.name}`)
 for(const [id,m] of a.menus){const n=b.menus.get(id);if(!n){out.push(`menu sparito: ${m.name}`);continue}if(!touched.menus.has(id)&&stable(without(m,'sections'))!==stable(without(n,'sections')))out.push(`menu modificato senza op: ${m.name}`)}
 for(const [id,n] of b.menus)if(!a.menus.has(id)&&!touched.newMenus.has(id))out.push(`menu comparso dal nulla: ${n.name}`)
 return out
}

// Riassunto leggibile prima -> dopo (nomi, prezzi, posizioni, struttura).
export function diffWorkspaces(before,after){
 const flat=w=>{const items=new Map(),sections=new Map(),menus=new Map();for(const m of w.menus){menus.set(m.id,m);for(const s of m.sections){sections.set(s.id,{...s,menu:m.name,menuId:m.id});for(const i of s.items)items.set(i.id,{...i,section:s.name,sectionId:s.id,menu:m.name})}}return {items,sections,menus}}
 const a=flat(before),b=flat(after),d={removedItems:[],addedItems:[],changedItems:[],movedItems:[],menus:[],sections:[]}
 const priceOf=i=>i.variants?.length?`${i.price} [${i.variants.map(v=>`${v.name}:${cents(i.price+v.priceModifier)}`).join(', ')}]`:i.priceDisplay?`${i.price} ("${i.priceDisplay}")`:String(i.price)
 for(const [id,i] of a.items){const j=b.items.get(id);if(!j){d.removedItems.push({id,name:i.name,price:priceOf(i),section:i.section,menu:i.menu});continue}
  const c={};if(i.name!==j.name)c.name=[i.name,j.name];if(priceOf(i)!==priceOf(j))c.price=[priceOf(i),priceOf(j)];if((i.description??null)!==(j.description??null))c.description=[i.description??null,j.description??null];if(stable(i.allergens??[])!==stable(j.allergens??[]))c.allergens=[i.allergens??[],j.allergens??[]];if(!!i.hidden!==!!j.hidden)c.hidden=[!!i.hidden,!!j.hidden]
  if(Object.keys(c).length)d.changedItems.push({id,item:j.name,section:j.section,changes:c})
  if(i.sectionId!==j.sectionId)d.movedItems.push({id,name:j.name,from:`${i.menu} / ${i.section}`,to:`${j.menu} / ${j.section}`})}
 for(const [id,j] of b.items)if(!a.items.has(id))d.addedItems.push({id,name:j.name,price:priceOf(j),section:j.section,menu:j.menu})
 for(const [id,m] of b.menus){const o=a.menus.get(id);if(!o)d.menus.push({id,change:'creato',menu:m.name,changes:{type:[null,m.type]}});else{const c={};if(o.name!==m.name)c.name=[o.name,m.name];if((o.description??null)!==(m.description??null))c.description=[o.description??null,m.description??null];if(Object.keys(c).length)d.menus.push({id,change:'aggiornato',menu:m.name,changes:c})}}
 for(const [id,s] of b.sections){const o=a.sections.get(id),pn=(f,x)=>x.parentSectionId?f.sections.get(x.parentSectionId)?.name??x.parentSectionId:null
  if(!o){d.sections.push({id,change:'creata',section:s.name,changes:{menu:[null,s.menu],parent:[null,pn(b,s)]}});continue}
  const c={};if(o.name!==s.name)c.name=[o.name,s.name];if((o.description??null)!==(s.description??null))c.description=[o.description??null,s.description??null];if(o.parentSectionId!==s.parentSectionId)c.parent=[pn(a,o),pn(b,s)];if(o.menuId!==s.menuId)c.menu=[o.menu,s.menu]
  if(Object.keys(c).length)d.sections.push({id,change:'aggiornata',section:s.name,changes:c})}
 for(const [id,s] of a.sections)if(!b.sections.has(id))d.sections.push({id,change:'eliminata',section:s.name,changes:{menu:[s.menu,null]}})
 const order=w=>w.menus.map(m=>m.name+': '+m.sections.map(s=>(s.parentSectionId?'  ↳':'')+s.name).join(' | '))
 d.orderBefore=order(before);d.orderAfter=order(after)
 return d
}

export const countOps=ops=>ops.reduce((c,o)=>(c[o?.op]=(c[o?.op]||0)+1,c),{})
