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
 const localize=(entity:any)=>({...entity,name:entity.translations?.[language]?.name||entity.name,description:entity.translations?.[language]?.description||entity.description})
 const visible=(entity:any)=>entity.active!==false&&(!instant||previewScheduledVisible(entity.schedule,instant))
 const menuVisible=visible(menu)
 const sections=(instant&&!menuVisible?[]:menu.sections.filter((s:any)=>visible(s)&&(!s.parentSectionId||menu.sections.some((parent:any)=>parent.id===s.parentSectionId&&visible(parent))))).map((s:any)=>{
  if(typeof s.id!=='string'||typeof s.name!=='string'||!Array.isArray(s.items)||s.items.length>2000)throw Error('Categoria non valida')
  return {...localize(s),items:s.items.filter((i:any)=>!instant||(i.available!==false&&previewScheduledVisible(i.schedule,instant))).map((i:any)=>{
   if(typeof i.id!=='string'||typeof i.name!=='string'||!Number.isFinite(i.price)||!Array.isArray(i.allergens)||!Array.isArray(i.tags))throw Error('Piatto non valido')
   const translated=localize(i);return {...translated,description:translated.description||undefined,imageUrl:i.imageUrl||undefined,available:i.available!==false}
  })}
 })
 return {menu:{id:menu.id,name:localize(menu).name,sections},design:doc.design,foodLabels:doc.foodTranslations?.[language||doc.defaultLanguage],menuVisible}
}
