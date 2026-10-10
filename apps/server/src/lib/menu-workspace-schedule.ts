import type { Schedule, Workspace } from './menu-workspace-contract.js'
export function scheduledVisible(schedule: Schedule | undefined, now = new Date()): boolean {
 if(!schedule?.enabled) return true
 const parts = new Intl.DateTimeFormat('en-CA',{timeZone:schedule.timezone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now)
 const p=Object.fromEntries(parts.map(v=>[v.type,v.value])); const date=`${p.year}-${p.month}-${p.day}`
 if((schedule.from && date<schedule.from)||(schedule.until && date>schedule.until))return false
 const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday!); const minute=Number(p.hour)*60+Number(p.minute)
 const minutes=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3))
 return schedule.windows.some(w=>{const a=minutes(w.start),b=minutes(w.end); return a===b?w.weekdays.includes(day):a<b?w.weekdays.includes(day)&&minute>=a&&minute<b:(w.weekdays.includes(day)&&minute>=a)||(w.weekdays.includes((day+6)%7)&&minute<b)})
}
export function publicWorkspace(workspace:Workspace, now=new Date()):Workspace {
 const result=structuredClone(workspace)
 result.menus=result.menus.filter(m=>m.active&&scheduledVisible(m.schedule,now)).map(m=>{m.sections=m.sections.filter(s=>s.active&&scheduledVisible(s.schedule,now)&&(!s.parentSectionId||m.sections.some(p=>p.id===s.parentSectionId&&p.active&&scheduledVisible(p.schedule,now)))).map(s=>{s.items=s.items.filter(i=>i.available&&scheduledVisible(i.schedule,now)).map(i=>({...i,costPrice:null,kitchenStation:null,prepTimeMinutes:0})); return s}); return m})
 return result
}
export function workspaceDiff(before:Workspace,after:Workspace){
 type Entry={type:string;label:string;value:Record<string,unknown>}
 const flatten=(w:Workspace)=>{const rows=new Map<string,Entry>();for(const [mp,m]of w.menus.entries()){const {sections,...menu}=m;rows.set(m.id,{type:'menu',label:m.name,value:{...menu,position:mp}});for(const [sp,s]of sections.entries()){const {items,...section}=s;rows.set(s.id,{type:'section',label:s.name,value:{...section,menuId:m.id,position:sp}});for(const [ip,i]of items.entries()){const {variants,...item}=i;rows.set(i.id,{type:'item',label:i.name,value:{...item,sectionId:s.id,position:ip}});for(const [vp,v]of variants.entries())rows.set(v.id,{type:'variant',label:v.name,value:{...v,itemId:i.id,position:vp}})}}}rows.set('design',{type:'design',label:'Aspetto',value:w.design});rows.set('pdf',{type:'pdf',label:'Configurazione PDF',value:w.pdf});rows.set('languages',{type:'languages',label:'Lingue',value:{languages:w.languages,defaultLanguage:w.defaultLanguage,foodTranslations:w.foodTranslations}});for(const p of w.pdfPresets)rows.set(p.id,{type:'pdfPreset',label:p.name,value:p});return rows}
 const a=flatten(before),b=flatten(after);const added=[...b.keys()].filter(k=>!a.has(k)),removed=[...a.keys()].filter(k=>!b.has(k)),changed=[...b.keys()].filter(k=>a.has(k)&&JSON.stringify(a.get(k)!.value)!==JSON.stringify(b.get(k)!.value))
 const fieldLabels:Record<string,string>={name:'Nome',description:'Descrizione',price:'Prezzo',priceModifier:'Modificatore prezzo',available:'Disponibile',active:'Attivo',imageUrl:'Immagine',sectionId:'Categoria',menuId:'Menu',parentSectionId:'Categoria superiore',position:'Posizione',allergens:'Allergeni',tags:'Caratteristiche',additives:'Additivi',schedule:'Calendario',translations:'Traduzioni',languages:'Lingue',defaultLanguage:'Lingua originale',foodTranslations:'Traduzioni alimentari',format:'Formato',columns:'Colonne',font:'Font',background:'Sfondo',primary:'Colore principale',layout:'Layout'}
 const details=[...added,...removed,...changed].map(id=>{const old=a.get(id),next=b.get(id);const keys=new Set([...Object.keys(old?.value??{}),...Object.keys(next?.value??{})]);return {id,type:next?.type??old!.type,label:next?.label??old!.label,action:added.includes(id)?'added':removed.includes(id)?'removed':'changed',before:old?.value??null,after:next?.value??null,fields:[...keys].filter(field=>JSON.stringify(old?.value[field])!==JSON.stringify(next?.value[field])).map(field=>({field,label:fieldLabels[field]??field,before:old?.value[field]??null,after:next?.value[field]??null}))}})
 return {added,removed,changed,details}
}
