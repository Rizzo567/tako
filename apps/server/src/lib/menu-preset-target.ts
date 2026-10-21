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
// 16/10 (sera): gestore reale dei comandi preset in chat, con le funzioni F2 già online.
// «metti online il menu di martedì» → riepilogo e conferma (OK/conferma, anche a voce) → publishDayPreset;
// «attiva/disattiva la pubblicazione automatica del pranzo» → setDayPresetAutoPublish; «cosa c'è lunedì a pranzo?» → lettura.
// null = non è un comando preset (nessuna query se il testo non corrisponde).
const pcPlain=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const pcDays:Record<string,1|2|3|4|5|6|7>={lunedi:1,martedi:2,mercoledi:3,giovedi:4,venerdi:5,sabato:6,domenica:7}
const pcDayRe='(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|oggi|domani)'
async function pcMenu(tx:Tx,tenant:string,hint:string|undefined,need:(menuId:string)=>Promise<boolean>):Promise<{id:string,name:string}|string>{
 const rows=await tx.execute(sql`SELECT draft->'menus' AS menus FROM menu_workspaces WHERE restaurant_id=${tenant}`),menus=((rows[0]?.menus??[]) as {id:string,name:string}[])
 if(hint){const h=pcPlain(hint).replace(/^(?:il|la|lo|l|del|della|di|al|a|per il|per)\s+/,''),hit=menus.filter(m=>pcPlain(m.name).includes(h)||h.includes(pcPlain(m.name)));if(hit.length===1)return hit[0]!;if(!hit.length)return `Non trovo il menu *${hint}*. Menu: ${menus.map(m=>m.name).join(', ')}.`}
 const ok:{id:string,name:string}[]=[];for(const m of menus)if(await need(m.id))ok.push(m)
 if(ok.length===1)return ok[0]!
 if(!ok.length)return 'I *preset* non sono attivi per nessun menu. Attivali dalla dashboard, nella scheda Piatti → «Preset».'
 return `Per quale menu? ${ok.map(m=>`*${m.name}*`).join(', ')}. Per esempio «… del ${ok[0]!.name.toLowerCase()}».`}
async function pcWeekday(tx:Tx,tenant:string,word:string){const F2=await import('./menu-day-presets.js');if(word in pcDays)return pcDays[word]!;const r=await tx.execute(sql`SELECT settings FROM restaurants WHERE id=${tenant}`),d=F2.serviceDay(new Date(),F2.restaurantTimezone(r[0]?.settings));return (word==='domani'?d.weekday%7+1:d.weekday) as 1|2|3|4|5|6|7}
export let presetChatCommand:PresetChatCommand=async(tx,ctx,text)=>{
 const t=pcPlain(text);let m:RegExpMatchArray|null
 const confirm=/^(?:(?:ok|okay|si|conferma|confermo|va|bene|procedi|pubblica)\s*)+$/.test(t)
 const publishRe=new RegExp(`^(?:metti|mettiamo|manda|pubblica|porta|carica)(?: online)? (?:il )?(?:menu|preset) (?:di |del )?${pcDayRe}(?: (?:a |per |del |al |per il |di )?(.+?))?(?: online)?$`)
 const autoRe=/^(attiva|accendi|disattiva|spegni|togli|ferma)(?: la| il)? (?:pubblicazione |menu )?(?:automatica|automatico|in automatico)(?: (?:per giorno|dei preset))?(?: (?:del|della|per il|per la|per|di|al) (.+))?$/
 const readRe=new RegExp(`^(?:cosa|che cosa|che) c e (?:nel menu (?:di )?)?${pcDayRe}(?: (?:a|per il|per|al|nel|del) (.+))?$`)
 if(!confirm&&!publishRe.test(t)&&!autoRe.test(t)&&!readRe.test(t))return null
 const F2=await import('./menu-day-presets.js')
 if(confirm){const p=(await tx.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND expires_at>now()`))[0]?.command as any;if(p?.kind!=='preset_publish')return null
  await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`)
  try{await F2.publishDayPreset(ctx.tenant,{presetId:p.presetId,mode:'manual',actor:ctx.actor},tx as never)}catch(e){return `*Non ho pubblicato nulla.* ${e instanceof Error?e.message:'Errore'}`}
  return `*Confermato.* Il preset *${p.label}* è online.`}
 const enabled=async(menuId:string)=>(await F2.readDayPresetSettings(ctx.tenant,menuId,tx as never)).enabled
 if((m=t.match(publishRe))){const weekday=await pcWeekday(tx,ctx.tenant,m[1]!),menu=await pcMenu(tx,ctx.tenant,m[2],async id=>await enabled(id)&&!!(await F2.readDayPreset(ctx.tenant,{menuId:id,weekday},tx as never)));if(typeof menu==='string')return menu
  const preset=await F2.readDayPreset(ctx.tenant,{menuId:menu.id,weekday},tx as never);if(!preset)return `Il *${menu.name}* non ha un preset per *${F2.WEEKDAY_NAMES[weekday]}*. Crealo dalla dashboard, scheda Piatti → «Preset».`
  if(!preset.itemCount)return `Il preset *${preset.name}* del ${menu.name} è vuoto: non lo metto online.`
  const label=`${preset.name} · ${menu.name}`,rev=(await tx.execute(sql`SELECT revision FROM menu_workspaces WHERE restaurant_id=${ctx.tenant}`))[0]?.revision
  await tx.execute(sql`INSERT INTO tako_whatsapp_proposals(phone,restaurant_id,actor_id,revision,command,expires_at) VALUES(${ctx.phone},${ctx.tenant},${ctx.actor},${Number(rev??0)},${JSON.stringify({kind:'preset_publish',presetId:preset.id,label})}::jsonb,now()+interval '10 minutes') ON CONFLICT(phone) DO UPDATE SET restaurant_id=EXCLUDED.restaurant_id,actor_id=EXCLUDED.actor_id,revision=EXCLUDED.revision,command=EXCLUDED.command,expires_at=EXCLUDED.expires_at`)
  return `Metto online il preset *${label}* (${preset.itemCount} piatti) al posto del ${menu.name} attuale.\n\nScrivi *OK* (o «conferma») per pubblicare, *ANNULLA* per lasciare tutto com'è.`}
 if((m=t.match(autoRe))){const on=/^(attiva|accendi)$/.test(m[1]!),menu=await pcMenu(tx,ctx.tenant,m[2],enabled);if(typeof menu==='string')return menu
  try{await F2.setDayPresetAutoPublish(ctx.tenant,menu.id,on,{connection:tx as never})}catch(e){return e instanceof Error?e.message:'Non riesco a cambiare la pubblicazione automatica.'}
  return on?`*Confermato.* Pubblicazione automatica *attiva* per il ${menu.name}: dal prossimo cambio giornata (06:00) ogni giorno va online il suo preset.`:`*Confermato.* Pubblicazione automatica *spenta* per il ${menu.name}. Il menu online resta quello attuale.`}
 // notte 22/10 (n-domanda-oggi): «cosa c'è oggi nel menu del pranzo?» senza un preset da leggere non è una domanda sui preset: risponde il
 // bot con il menu di adesso (prima «Non trovo il menu…» / «non ha un preset» a chi i preset non li usa).
 if((m=t.match(readRe))){const weekday=await pcWeekday(tx,ctx.tenant,m[1]!),menu=await pcMenu(tx,ctx.tenant,m[2],enabled);if(typeof menu==='string')return null
  const preset=await F2.readDayPreset(ctx.tenant,{menuId:menu.id,weekday},tx as never);if(!preset||!preset.sections)return null
  const lines=preset.sections.flatMap(s=>s.items.length?[`*${s.name}*`,...s.items.map(i=>`- ${i.name}: ${Number(i.price).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})} €`)]:[])
  return lines.length?`*${F2.WEEKDAY_NAMES[weekday]}* · ${menu.name} (preset «${preset.name}»):\n\n${lines.join('\n')}`.slice(0,1500):`Il preset *${preset.name}* del ${menu.name} è vuoto.`}
 return null}
export function setPresetChatCommand(next:PresetChatCommand){const previous=presetChatCommand;presetChatCommand=next;return()=>{presetChatCommand=previous}}
