// Menu intero da messaggio o vocale (Feature 1): parti deterministiche del flusso nel bot titolare.
// Riconoscimento (menu intero o modifica singola), destinazione (quale menu, al posto o preset), testi del riepilogo,
// correzioni sulla bozza («la carbonara è 11», «togli la tagliata»). Nessuna chiamata al modello qui.
import type {Workspace} from './menu-workspace-contract.js'
import type {MenuRef} from './twilio-menu-ai.js'
import {euro,safe} from './twilio-menu-ai.js'
import {fullMenuCopy,fill} from './twilio-menu-copy.js'
import {normalizeSpokenPrices,spokenNumber} from './menu-spoken-prices.js'
import {mentionsOnboardingDish,sameOnboardingDish,onboardingDishKey} from './onboarding-dish-name.js'
import {onboardingAmounts} from './onboarding-clauses.js'
import {operationalDay,weekdayLabel} from './menu-operational-day.js'
import type {FullMenuRow,FullMenuMissing} from './menu-full-extract.js'
import type {PresetDestination} from './menu-preset-target.js'
import type {ReplaceSummary} from './menu-replace.js'

type Menu=Workspace['menus'][number]
export type Destination={kind:'replace',menuId:string}|PresetDestination
export type PartialDestination={menuId?:string,mode?:'replace'|'preset',weekday?:number|null}
export type FullMenuProposal={kind:'fullmenu',stage:'doubt'|'replay'|'where'|'confirm',text:string,voice?:boolean,answer?:string,partial?:PartialDestination,destination?:Destination,rows?:FullMenuRow[],missing?:FullMenuMissing[],issues?:string[],requiresTypedOk?:true,asked?:number}

const plain=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const weekdays:[RegExp,number][]=[[/\blunedi\b/,1],[/\bmartedi\b/,2],[/\bmercoledi\b/,3],[/\bgiovedi\b/,4],[/\bvenerdi\b/,5],[/\bsabato\b/,6],[/\bdomenica\b/,0]]

// ---------- riconoscimento ----------
const headerRe=/\bmen[uù]\s+(?:di|del|per|della)\s+(?:oggi|domani|stasera|stamattina|questa sera|lunedi|lunedì|martedi|martedì|mercoledi|mercoledì|giovedi|giovedì|venerdi|venerdì|sabato|domenica|pranzo|cena|giorno|settimana)\b|^\s*(?:ecco\s+)?(?:il\s+)?(?:nuovo\s+)?men[uù]\s*(?:[:.,\n]|completo|intero|nuovo)|\bmen[uù]\s+(?:a\s+)?(?:pranzo|cena)\s*[:.,\n]|\b(?:pranzo|cena)\s+(?:di\s+)?(?:oggi|domani|stasera|lunedi|lunedì|martedi|martedì|mercoledi|mercoledì|giovedi|giovedì|venerdi|venerdì|sabato|domenica)\b|\b(?:oggi|stasera)\s+abbiamo\b|\b(?:tutto\s+il|l['’]intero)\s+men[uù]\s*[:.,\n]/i
const headingRe=/(?:^|[\s.;,\n])(antipasti|antipasto|primi|primo|secondi|secondo|contorni|contorno|dolci|dolce|dessert|pizze|insalate|fritti|zuppe|panini)\s*[:,\n]/gi
const editRe=/\b(?:cambia\w*|porta\w*|alza\w*|abbassa\w*|aumenta\w*|diminuisci|togli\w*|nascondi\w*|rimetti\w*|finit[oaie]|esaurit[oaie]|non c e piu|elimina\w*|cancella\w*|sposta\w*|rinomina\w*|aggiungi\w*|inserisci\w*|metti\w*|evidenza|descrizione|foto|etichetta)\b/
/** Prices in the text (digits, or spoken numbers right after a word), units excluded. */
export function priceCount(text:string){
 const n=normalizeSpokenPrices(text);let count=0
 for(const m of n.matchAll(/(?<![\d.,])(\d{1,4})(?:[.,]\d{1,2})?(?!\d)(?![.,]\d)\s*(€|euro|euri|g\b|gr\b|kg\b|cl\b|ml\b|l\b|cm\b|pezzi\b|persone\b|ore\b|minuti\b)?/gi))if(!m[2]||/€|euro|euri/i.test(m[2]))count++
 for(const w of plain(n).split(' '))if(spokenNumber(w)!==null&&!['un','una','uno'].includes(w))count++
 return count
}
/** «full» = menu intero, «doubt» = una sola domanda, null = flusso delle modifiche come prima. */
export function fullMenuSignal(text:string,refs:MenuRef[]):'full'|'doubt'|null{
 const prices=priceCount(text);if(prices<2)return null
 const flat=text.normalize('NFD').replace(/[̀-ͯ]/g,''),header=headerRe.test(flat),headings=new Set([...flat.matchAll(headingRe)].map(m=>plain(m[1]!))).size,edit=editRe.test(plain(text))
 const known=refs.filter(r=>r.name.length>=3&&mentionsOnboardingDish(text,r.name)).length,unknownShare=Math.max(0,prices-known)/prices
 if(!edit&&((header&&prices>=2)||(headings>=2&&prices>=3)||(prices>=6&&unknownShare>=0.5)))return 'full'
 if(header&&edit&&prices>=3)return 'doubt'
 if(!edit&&prices>=4&&unknownShare>=0.5)return 'doubt'
 return null
}

// ---------- destinazione ----------
const drinksRe=/\b(drink|drinks|bevand\w*|vini|vino|cocktail|bar|cantina|birre)\b/
export const isDrinksMenu=(m:Menu)=>m.type==='drinks'||drinksRe.test(plain(m.name))
/** Menus a full menu can go to: active, not Drinks (unless they are the only ones). */
export function contentMenus(w:Workspace){const active=w.menus.filter(m=>m.active!==false),content=active.filter(m=>!isDrinksMenu(m));return content.length?content:active}
const genericName=(name:string)=>['menu','il menu','menu principale'].includes(plain(name))
function menuMentioned(text:string,w:Workspace):Menu[]{
 const t=' '+plain(text)+' ',out:Menu[]=[]
 for(const m of w.menus.filter(x=>x.active!==false)){
  const byType=m.type==='lunch'&&/ pranzo /.test(t)||m.type==='dinner'&&/ cena /.test(t)
  const name=plain(m.name).replace(/^menu\s+/,''),byName=!genericName(m.name)&&name.length>=3&&t.includes(' '+name+' ')
  if(byType||byName)out.push(m)
 }
 return out
}
/** Reads destination words from a message or an answer and merges them into what is already known. */
export function readDestination(text:string,w:Workspace,known:PartialDestination={},opts:{timezone?:string,now?:Date}={}):PartialDestination{
 const t=' '+plain(text)+' ',out:PartialDestination={...known}
 const named=menuMentioned(text,w);if(named.length===1)out.menuId=named[0]!.id
 const day=weekdays.find(([re])=>re.test(t))?.[1]
 if(day!==undefined){out.mode='preset';out.weekday=day}
 else if(/ domani /.test(t)){out.mode='preset';out.weekday=operationalDay(opts.timezone,opts.now,1).weekday}
 else if(/ (oggi|stasera|stamattina|al posto|attuale|adesso|subito|sostituisci|sostituiscilo|quello di adesso|online) /.test(t))out.mode='replace'
 return out
}
export type DestinationNeed={menus:Menu[],askMenu:boolean,askMode:boolean,presetOff:boolean}
/** Final destination, or what to ask (only the options the restaurant really has). */
export function resolveDestination(partial:PartialDestination,w:Workspace,presetsEnabled:Set<string>):{destination:Destination}|{need:DestinationNeed}{
 const menus=contentMenus(w),menu=partial.menuId?w.menus.find(m=>m.id===partial.menuId):menus.length===1?menus[0]:undefined
 const anyPreset=(menu?[menu]:menus).some(m=>presetsEnabled.has(m.id)),presetOff=partial.mode==='preset'&&!(menu?presetsEnabled.has(menu.id):anyPreset)
 const mode=presetOff?undefined:partial.mode??(anyPreset?undefined:'replace')
 if(menu&&mode==='replace')return{destination:{kind:'replace',menuId:menu.id}}
 if(menu&&mode==='preset'&&partial.weekday!==undefined)return{destination:{kind:'preset',menuId:menu.id,weekday:partial.weekday??null,name:partial.weekday===null||partial.weekday===undefined?'Preset':weekdayLabel(partial.weekday)}}
 return{need:{menus,askMenu:!menu,askMode:!mode||mode==='preset'&&partial.weekday===undefined,presetOff}}
}
const orList=(names:string[])=>names.length>1?names.slice(0,-1).map(n=>'*'+safe(n)+'*').join(', ')+' o *'+safe(names.at(-1)!)+'*':'*'+safe(names[0]??'Menu')+'*'
export function whereQuestion(need:DestinationNeed,presetsAvailable:boolean){
 const parts:string[]=[];if(need.presetOff)parts.push(fullMenuCopy.presetOff)
 if(need.askMenu)parts.push(fill(fullMenuCopy.whereMenu,{opzioni:orList(need.menus.map(m=>m.name))}))
 if(need.askMode&&presetsAvailable)parts.push(fullMenuCopy.whereMode)
 if(!presetsAvailable&&need.askMenu)parts.push(fullMenuCopy.whereReplaceOnly)
 if(!parts.length||need.presetOff&&!need.askMenu)parts.push(fill(fullMenuCopy.whereConfirmReplace,{menu:orList(need.menus.map(m=>m.name))}))
 return fill(fullMenuCopy.where,{domanda:parts.join('\n')})
}
/** An answer to the «Dove lo metto?» question (otherwise the message is something else and the question is dropped). */
export function isDestinationAnswer(text:string,w:Workspace){
 const t=' '+plain(text)+' ';if(t.trim().split(' ').length>8)return false
 return menuMentioned(text,w).length>0||weekdays.some(([re])=>re.test(t))||/ (oggi|domani|stasera|al posto|attuale|adesso|sostituisci|sostituiscilo|si|preset|giorno|online) /.test(t)
}

// ---------- testi ----------
export function destinationLabel(d:Destination,w:Workspace){const m=w.menus.find(x=>x.id===d.menuId);const name=safe(m?.name??'Menu');return d.kind==='replace'?fill(fullMenuCopy.destReplace,{menu:name}):fill(fullMenuCopy.destPreset,{menu:name,preset:safe(d.name)})}
export function rowsBySection(rows:FullMenuRow[]){const out:{section:string,rows:FullMenuRow[]}[]=[];for(const r of rows){const key=onboardingDishKey(r.section);let g=out.find(x=>onboardingDishKey(x.section)===key);if(!g){g={section:r.section,rows:[]};out.push(g)}g.rows.push(r)}return out}
const cap=(s:string)=>s.charAt(0).toLocaleUpperCase('it')+s.slice(1)
export function menuListing(rows:FullMenuRow[]){return rowsBySection(rows).map(g=>`*${safe(cap(g.section==='Menu'?fullMenuCopy.noSection:g.section))}*\n`+g.rows.map(r=>`- ${safe(cap(r.name))}: ${euro(r.price)}${r.description?` (${safe(r.description).slice(0,120)})`:''}`).join('\n')).join('\n\n')}
export function fullMenuSummary(input:{restaurant:string,destination:Destination,workspace:Workspace,rows:FullMenuRow[],missing:FullMenuMissing[],issues:string[],voice?:boolean,diff?:ReplaceSummary|null}){
 const {destination:d,workspace:w,rows,missing}=input,parts:string[]=[]
 parts.push(fill(fullMenuCopy.head,{locale:safe(input.restaurant),destinazione:destinationLabel(d,w),origine:input.voice?fullMenuCopy.fromVoice:fullMenuCopy.fromText}))
 parts.push(menuListing(rows))
 if(missing.length)parts.push(fill(fullMenuCopy.missing,{piatti:missing.map(m=>'*'+safe(cap(m.name))+'*'+(m.reason==='prices'?fullMenuCopy.twoPrices:'')).join(', '),esempio:plain(missing[0]!.name)}))
 if(input.issues.length)parts.push(fullMenuCopy.check+'\n'+input.issues.slice(0,5).map(i=>'- '+i.replace(/\n/g,' ')).join('\n'))
 if(d.kind==='replace'&&input.diff){const x=input.diff,hidden=x.hidden.length?fill(fullMenuCopy.hiddenList,{piatti:x.hidden.slice(0,12).map(n=>safe(n)).join(', ')+(x.hidden.length>12?'…':'')}):''
  parts.push(fill(fullMenuCopy.changes,{nuovi:x.created.length,aggiornati:x.updated.length,nascosti:x.hidden.length,elenco:hidden}))
  const others=w.menus.filter(m=>m.id!==d.menuId&&m.active!==false).map(m=>safe(m.name));if(others.length)parts.push(fill(fullMenuCopy.others,{menu:others.join(', ')}))}
 if(d.kind==='preset')parts.push(fill(fullMenuCopy.presetNote,{preset:safe(d.name)}))
 const first=rows[0];parts.push(fill(fullMenuCopy.confirm,{esempio:first?`${articled(first.name)} è ${String(Math.round(first.price)+1)}`:'la carbonara è 11'}))
 return parts.join('\n\n')
}
const articled=(name:string)=>{const n=plain(name);return /^[aeiou]/.test(n)?"l'"+n:(/[ei]$/.test(n.split(' ')[0]!)?'i ':'la ')+n}

// ---------- correzioni sulla bozza ----------
export type CorrectionResult={rows:FullMenuRow[],missing:FullMenuMissing[],done:string[],failed:string[]}
const removeRe=/^(?:togli\w*|elimina\w*|rimuovi\w*|leva\w*|cancella\w*|senza|niente)\s+(?:anche\s+)?(?:(?:il|lo|la|i|gli|le)\s+|l['’]\s*)?(.+)$/i
const addRe=/^(?:aggiungi\w*|metti(?:ci)?\s+anche|e\s+anche|anche)\s+(?:(?:il|lo|la|i|gli|le)\s+|l['’]\s*)?(.+?)\s+(?:a\s+)?(\d{1,4}(?:,\d{2})?)\s*(?:€|euro|euri)?(?:\s+(?:tra|nei|nelle|negli|nel|nella|in)\s+(?:i\s+|le\s+|gli\s+)?(.+))?$/i
/** Deterministic corrections only; anything not understood is reported and changes nothing. */
export function applyCorrections(text:string,rows:FullMenuRow[],missing:FullMenuMissing[]):CorrectionResult{
 const out:CorrectionResult={rows:rows.map(r=>({...r})),missing:missing.map(m=>({...m})),done:[],failed:[]}
 const clauses=normalizeSpokenPrices(text).split(/[;\n]|(?<!\d)[.,]|[.,](?!\d)|\s+e\s+(?=(?:togli|elimina|aggiungi|il|lo|la|i|gli|le)\b)/i).map(c=>c.trim()).filter(Boolean)
 for(const clause of clauses){
  const mentioned=(name:string)=>mentionsOnboardingDish(clause,name)
  const rm=clause.match(removeRe)
  if(rm){const target=out.rows.find(r=>sameOnboardingDish(r.name,rm[1]!.trim())||mentioned(r.name))??null,miss=out.missing.find(m=>sameOnboardingDish(m.name,rm[1]!.trim())||mentioned(m.name))
   if(target){out.rows=out.rows.filter(r=>r!==target);out.done.push(fill(fullMenuCopy.fixRemoved,{piatto:safe(cap(target.name))}));continue}
   if(miss){out.missing=out.missing.filter(m=>m!==miss);out.done.push(fill(fullMenuCopy.fixRemoved,{piatto:safe(cap(miss.name))}));continue}
   out.failed.push(clause);continue}
  // The longest dish name mentioned wins («panna cotta» over «panna»); exactly one amount after it.
  const named=[...out.rows.map(r=>({kind:'row' as const,name:r.name,ref:r})),...out.missing.map(m=>({kind:'missing' as const,name:m.name,ref:m}))].filter(x=>mentioned(x.name)).sort((a,b)=>b.name.length-a.name.length)
  const amounts=onboardingAmounts(clause)
  if(named.length&&amounts.length===1&&amounts[0]!>0&&!/^(?:aggiungi|anche|e anche)/i.test(clause)){const hit=named[0]!,price=amounts[0]!
   if(hit.kind==='row'){const r=hit.ref as FullMenuRow;out.done.push(fill(fullMenuCopy.fixPrice,{piatto:safe(cap(r.name)),prima:euro(r.price),dopo:euro(price)}));r.price=price}
   else{const m=hit.ref as FullMenuMissing;out.missing=out.missing.filter(x=>x!==m);out.rows.push({section:m.section??out.rows.at(-1)?.section??'Menu',name:m.name,price,description:'',evidence:clause});out.done.push(fill(fullMenuCopy.fixAdded,{piatto:safe(cap(m.name)),prezzo:euro(price)}))}
   continue}
  const add=clause.match(addRe)
  if(add){const name=add[1]!.trim(),price=Number(add[2]!.replace(',','.')),wanted=add[3]?.trim(),section=wanted?(out.rows.find(r=>onboardingDishKey(r.section).startsWith(onboardingDishKey(wanted).slice(0,5)))?.section??cap(wanted)):(out.rows.at(-1)?.section??'Menu')
   if(price>0&&name.length>=2&&!out.rows.some(r=>sameOnboardingDish(r.name,name))){out.rows.push({section,name,price,description:'',evidence:clause});out.done.push(fill(fullMenuCopy.fixAdded,{piatto:safe(cap(name)),prezzo:euro(price)}));continue}}
  out.failed.push(clause)
 }
 return out
}
