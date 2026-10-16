// Destinazione «preset <menu> <giorno>» del menu intero (Feature 1) — interfaccia che la Feature 2 implementa.
// STUB della Feature 1: nessun locale ha i preset attivi, quindi il bot non propone mai l'opzione «preset» e,
// se il titolare la chiede («menu di lunedì: …»), lo dice e propone solo il menu attuale. Contratto in
// docs/webapp/feature-vendita-2026-10-16/contracts.md (sezione F1). La Feature 2 sostituisce menuPresetTarget.
import type {Workspace} from './menu-workspace-contract.js'
import {sql} from 'drizzle-orm'
export type Tx={execute:(query:any)=>Promise<any[]>}
export type MenuSections=Workspace['menus'][number]['sections']
/** weekday 0 = domenica … 6 = sabato; null = preset con nome libero («Venerdì pesce»). */
export type PresetDestination={kind:'preset',menuId:string,weekday:number|null,name:string}
export interface MenuPresetTarget{
 /** true se il menu (Pranzo, Cena, Menu…) di questo locale usa i preset: solo allora il bot propone «nel preset di un giorno». */
 enabled(tx:Tx,restaurantId:string,menuId:string):Promise<boolean>
 /** Salva (crea o sostituisce) il contenuto del preset dopo l'OK del titolare. `sections` è il contenuto completo del
  *  menu nel formato del documento (id dei piatti già riusati quando il nome coincide, così le traduzioni restano).
  *  Non pubblica nulla: se il preset è quello online oggi, la Feature 2 decide se ripubblicarlo. Restituisce l'etichetta
  *  da mostrare in chat («Pranzo · Lunedì»). */
 save(tx:Tx,input:{restaurantId:string,actorId:string,destination:PresetDestination,sections:MenuSections}):Promise<{label:string}>
}
// F2: implementazione reale su menu_day_presets. Giorni F1 0=domenica…6=sabato → ISO 1=lunedì…7=domenica.
const isoWeekday=(w:number)=>(w===0?7:w) as 1|2|3|4|5|6|7
export let menuPresetTarget:MenuPresetTarget={
 enabled:async(tx,restaurantId,menuId)=>{const {readDayPresetSettings}=await import('./menu-day-presets.js');return (await readDayPresetSettings(restaurantId,menuId,tx as never)).enabled},
 save:async(tx,{restaurantId,actorId,destination,sections})=>{
  const {saveDayPresetWith}=await import('./menu-day-presets.js')
  const preset=await saveDayPresetWith(tx as never,restaurantId,{menuId:destination.menuId,sections,actor:actorId,...(destination.weekday!==null&&destination.weekday!==undefined?{weekday:isoWeekday(destination.weekday)}:{name:destination.name})})
  const rows=await tx.execute(sql`SELECT draft->'menus' AS menus FROM menu_workspaces WHERE restaurant_id=${restaurantId}`)
  const menuName=((rows[0]?.menus??[]) as {id:string,name:string}[]).find(m=>m.id===destination.menuId)?.name??'Menu'
  return {label:`${menuName} · ${preset.name}`}
 },
}
/** Solo per i test e per l'aggancio della Feature 2. */
export function setMenuPresetTarget(next:MenuPresetTarget){const previous=menuPresetTarget;menuPresetTarget=next;return()=>{menuPresetTarget=previous}}
/** Aggancio opzionale per i comandi chat dei preset della Feature 2 («metti online il menu di martedì», «attiva automatico»,
 *  «cosa c'è lunedì a pranzo?»): chiamato dal bot prima del riconoscimento del menu intero; null = non è un comando preset. */
export type PresetChatCommand=(tx:Tx,ctx:{tenant:string,actor:string,phone:string},text:string)=>Promise<string|null>
export let presetChatCommand:PresetChatCommand=async()=>null
export function setPresetChatCommand(next:PresetChatCommand){const previous=presetChatCommand;presetChatCommand=next;return()=>{presetChatCommand=previous}}
