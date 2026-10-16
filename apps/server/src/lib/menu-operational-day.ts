// Giornata operativa del locale (decisione 16/10): cambia alle 06:00 nel fuso del locale, ripiego Europe/Rome.
// Chi scrive alle 01:30 di martedì sta ancora lavorando sul lunedì: «oggi» = lunedì, «domani» = martedì.
export const operationalDayStartHour=6
export const defaultMenuTimezone='Europe/Rome'
export function validTimezone(timezone:unknown):string{if(typeof timezone==='string'&&timezone){try{new Intl.DateTimeFormat('en',{timeZone:timezone});return timezone}catch{}}return defaultMenuTimezone}
/** weekday: 0 = domenica … 6 = sabato (come Date.getDay e MenuWorkspaceSchedule.windows.weekdays). */
export function operationalDay(timezone:unknown,now=new Date(),offsetDays=0):{zone:string,date:string,weekday:number}{
 const zone=validTimezone(timezone),p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(v=>[v.type,v.value]))
 const day=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)))
 day.setUTCDate(day.getUTCDate()+(Number(p.hour)<operationalDayStartHour?-1:0)+offsetDays)
 return{zone,date:day.toISOString().slice(0,10),weekday:day.getUTCDay()}
}
export const weekdayNames=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato']
export const weekdayLabel=(weekday:number)=>{const n=weekdayNames[weekday]??'';return n.charAt(0).toUpperCase()+n.slice(1)}
