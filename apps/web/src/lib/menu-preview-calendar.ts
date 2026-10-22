/** Pure, read-only projection of draft schedules at an explicit UTC instant. */
export function previewScheduledVisible(schedule:any,now:Date):boolean {
 if(!schedule?.enabled)return true
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:schedule.timezone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now)
 const p=Object.fromEntries(parts.map(v=>[v.type,v.value])),date=`${p.year}-${p.month}-${p.day}`
 if((schedule.from&&date<schedule.from)||(schedule.until&&date>schedule.until))return false
 const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday),minute=Number(p.hour)*60+Number(p.minute)
 const minutes=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3))
 return schedule.windows.some((w:any)=>{const a=minutes(w.start),b=minutes(w.end);return a===b?w.weekdays.includes(day):a<b?w.weekdays.includes(day)&&minute>=a&&minute<b:(w.weekdays.includes(day)&&minute>=a)||(w.weekdays.includes((day+6)%7)&&minute<b)})
}
export function projectMenuPreview(doc:any,menuId:string,language:string,instant?:Date) {
 if(!doc||doc.schemaVersion!==1||!Array.isArray(doc.menus)||!doc.design||doc.menus.length>100)throw Error('Bozza non valida')
 const menu=doc.menus.find((m:any)=>m.id===menuId)
 if(!menu||typeof menu.name!=='string'||!Array.isArray(menu.sections)||menu.sections.length>500)throw Error('Menu non presente nella bozza')
 const localize=(entity:any)=>({...entity,sourceName:entity.name,name:entity.translations?.[language]?.name||entity.name,description:entity.translations?.[language]?.description||entity.description})
 const visible=(entity:any)=>entity.active!==false&&(!instant||previewScheduledVisible(entity.schedule,instant))
 const menuVisible=visible(menu)
 const sections=(instant&&!menuVisible?[]:menu.sections.filter((s:any)=>visible(s)&&(!s.parentSectionId||menu.sections.some((parent:any)=>parent.id===s.parentSectionId&&visible(parent))))).map((s:any)=>{
  if(typeof s.id!=='string'||typeof s.name!=='string'||!Array.isArray(s.items)||s.items.length>2000)throw Error('Categoria non valida')
  return {...localize(s),items:s.items.filter((i:any)=>!i.hidden&&i.available!==false&&(!instant||previewScheduledVisible(i.schedule,instant))).map((i:any)=>{
   if(typeof i.id!=='string'||typeof i.name!=='string'||!Number.isFinite(i.price)||!Array.isArray(i.allergens)||!Array.isArray(i.tags))throw Error('Piatto non valido')
   const translated=localize(i);return {...translated,description:translated.description||undefined,imageUrl:i.imageUrl||undefined,available:i.available!==false,...previewSales(i,instant??new Date())}
  })}
 })
 // Menu a prezzo fisso (21/10): l'anteprima della dashboard mostra opzioni e «Compreso» come la pagina pubblica.
 const fixed=menu.pricing==='fisso',secIds=new Set(sections.map((x:any)=>x.id)),lang=language||doc.defaultLanguage
 const fixedFields=fixed?{pricing:'fisso',formulas:(Array.isArray(menu.formulas)?menu.formulas:[]).filter((f:any)=>f&&typeof f.name==='string'&&f.name.trim()).map((f:any)=>({id:f.id,name:f.translations?.[lang]?.name||f.name,price:Number(f.price),...(f.translations?.[lang]?.description||f.note?{note:f.translations?.[lang]?.description||f.note}:{}),...(Array.isArray(f.sectionIds)?{sectionIds:f.sectionIds.filter((id:string)=>secIds.has(id))}:{})})),...((menu.translations?.[lang]?.included||menu.included)?{included:menu.translations?.[lang]?.included||menu.included}:{})}:{}
 return {menu:{id:menu.id,name:localize(menu).name,description:(typeof localize(menu).description==='string'&&localize(menu).description.trim())||undefined,sections,...fixedFields},design:doc.design,foodLabels:doc.foodTranslations?.[language||doc.defaultLanguage],menuVisible}
}
/** Stati che la vista di modifica mostra attenuati con etichetta (dashboard editor 22/10, PIANO D7). */
export type EditFlags={hidden:boolean;unavailable:boolean;inactive:boolean;scheduledOff:boolean}
/**
 * Vista di modifica (dashboard editor 22/10): stessa proiezione dell'anteprima ma NON toglie nulla. Tiene piatti nascosti/esauriti,
 * Sottomenu/Sezioni/Menu disattivati e contenuti fuori orario, ciascuno con `edit:{hidden,unavailable,inactive,scheduledOff}`.
 * Sempre nella lingua originale. Una Sezione figlia eredita disattivato/fuori orario dal suo Sottomenu (la pagina pubblica la toglie).
 * Menu a prezzo fisso: stessi campi dell'anteprima (il renderer ne ricava la vista per opzione).
 */
export function projectMenuForEdit(doc:any,menuId:string,instant:Date=new Date()) {
 if(!doc||doc.schemaVersion!==1||!Array.isArray(doc.menus)||!doc.design||doc.menus.length>100)throw Error('Bozza non valida')
 const menu=doc.menus.find((m:any)=>m.id===menuId)
 if(!menu||typeof menu.name!=='string'||!Array.isArray(menu.sections)||menu.sections.length>500)throw Error('Menu non presente nella bozza')
 const off=(entity:any)=>!previewScheduledVisible(entity?.schedule,instant)
 const byId=new Map<string,any>(menu.sections.map((s:any)=>[s.id,s]))
 const sections=menu.sections.map((s:any)=>{
  if(typeof s.id!=='string'||typeof s.name!=='string'||!Array.isArray(s.items)||s.items.length>2000)throw Error('Sezione non valida')
  const parent=s.parentSectionId?byId.get(s.parentSectionId):undefined
  const edit:EditFlags={hidden:false,unavailable:false,inactive:s.active===false||parent?.active===false,scheduledOff:off(s)||(!!parent&&off(parent))}
  return {...s,sourceName:s.name,description:s.description,edit,...(s.items.length===0?{empty:true}:{}),items:s.items.map((i:any)=>{
   if(typeof i.id!=='string'||typeof i.name!=='string'||!Number.isFinite(i.price)||!Array.isArray(i.allergens)||!Array.isArray(i.tags))throw Error('Piatto non valido')
   return {...i,sourceName:i.name,description:i.description||undefined,imageUrl:i.imageUrl||undefined,available:i.available!==false,...previewSales(i,instant),edit:{hidden:!!i.hidden,unavailable:i.available===false,inactive:false,scheduledOff:off(i)} as EditFlags}
  })}
 })
 const fixed=menu.pricing==='fisso',secIds=new Set(sections.map((x:any)=>x.id)),lang=doc.defaultLanguage
 const fixedFields=fixed?{pricing:'fisso',formulas:(Array.isArray(menu.formulas)?menu.formulas:[]).filter((f:any)=>f&&typeof f.name==='string'&&f.name.trim()).map((f:any)=>({id:f.id,name:f.name,price:Number(f.price),...(f.note?{note:f.note}:{}),...(Array.isArray(f.sectionIds)?{sectionIds:f.sectionIds.filter((id:string)=>secIds.has(id))}:{})})),...(menu.included?{included:menu.included}:{})}:{}
 const menuEdit:EditFlags={hidden:false,unavailable:false,inactive:menu.active===false,scheduledOff:off(menu)}
 const empty=!sections.some((s:any)=>s.items.length>0)
 return {menu:{id:menu.id,name:menu.name,description:(typeof menu.description==='string'&&menu.description.trim())||undefined,sections,...fixedFields,...(empty?{empty:true}:{}),edit:menuEdit},design:doc.design,foodLabels:doc.foodTranslations?.[lang],menuVisible:!menuEdit.inactive&&!menuEdit.scheduledOff,
  /** Barra dei Menu della vista di modifica: tutti, anche disattivati, con il loro stato. */
  menus:doc.menus.map((m:any)=>({id:m.id,type:m.type,name:m.name,edit:{hidden:false,unavailable:false,inactive:m.active===false,scheduledOff:off(m)} as EditFlags}))}
}
/** F3+F4 anteprima: stessa regola del server (giornata alle 06:00, Europe/Rome): solo promo/etichette valide adesso. */
export function previewSales(item:any,now:Date,zone='Europe/Rome'):{promoPrice?:number,lastPortions?:true,onlyToday?:true}{
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(v=>[v.type,v.value]))
 let today=`${p.year}-${p.month}-${p.day}`;if(Number(p.hour)<6){const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);today=d.toISOString().slice(0,10)}
 const promo=Number(item?.promo?.price),full=Number(item?.price),out:{promoPrice?:number,lastPortions?:true,onlyToday?:true}={}
 if(promo>0&&full>0&&promo<full&&(!item.promo.until||today<=item.promo.until))out.promoPrice=promo
 if(item?.scarcity?.lastPortions&&item.available!==false)out.lastPortions=true
 if(item?.scarcity?.onlyToday&&item.scarcity.onlyToday===today)out.onlyToday=true
 return out
}
