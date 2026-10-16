import {randomUUID} from 'node:crypto'
import {workspaceSchema,type Workspace} from './menu-workspace-contract.js'
import type {OnboardingMenuRow} from './onboarding-planner.js'
import {sameOnboardingDish,onboardingAddVerbName} from './onboarding-dish-name.js'
const key=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()
const clean=(s:string)=>s.replace(/[*_~`<>]/g,'').slice(0,150)
/** Transcribed vocals arrive lower-case («menu pranzo»): new names get the same initial capital as typed text. */
export const onboardingDisplayCase=(s:string)=>s===s.toLocaleLowerCase('it')?s.charAt(0).toLocaleUpperCase('it')+s.slice(1):s
const euro=(n:number)=>(Number.isInteger(n)?String(n):n.toFixed(2).replace('.',','))+' €'
/** A price change on a dish that exists in more menus: one plain question, answered with the menu name. */
/** itemId '' = «In quale menu va X?»: the answer adds the new dish to that menu (add carries category/description). */
export type OnboardingChoice={name:string;price:number;options:{menu:string;itemId:string}[];add?:{section:string;description:string}}
export type OnboardingMergeResult={issues:string[];correctedNames:string[];resolvedNames:string[];changes:string[];choices:OnboardingChoice[];notes:string[]}
/** Exact normalized identity is scoped to a menu, before category fallback; never fuzzy matching.
 * «keep» rows never create or change anything; «change» rows update the existing dish (same id) when it is unique. */
export function mergeOnboardingRows(workspace:Workspace,rows:OnboardingMenuRow[],correction:boolean):OnboardingMergeResult{
 const issues:string[]=[],correctedNames:string[]=[],resolvedNames:string[]=[],changes:string[]=[],choices:OnboardingChoice[]=[],notes:string[]=[]
 const setPrice=(item:Workspace['menus'][number]['sections'][number]['items'][number],menuName:string,row:OnboardingMenuRow)=>{
  const before=item.price;item.price=row.price;const description=row.description||item.description;if(description!==item.description)item.translations={};item.description=description??null
  correctedNames.push(row.name);resolvedNames.push(row.name)
  if(before!==row.price)changes.push(`*${clean(item.name)}* (${clean(menuName)}) ${euro(before)} → ${euro(row.price)}`)
 }
 const fuzzy=(name:string)=>workspace.menus.flatMap(menu=>menu.sections.flatMap(section=>section.items.filter(item=>sameOnboardingDish(item.name,name)).map(item=>({menu,section,item}))))
 const ask=(row:OnboardingMenuRow,found:ReturnType<typeof fuzzy>)=>{
  const menus=[...new Set(found.map(f=>f.menu.name))]
  if(menus.length===found.length){issues.push(`Quale *${clean(found[0]!.item.name)}* vuoi a ${euro(row.price)}: ${menus.map(m=>'*'+clean(m)+'*').join(' o ')}?`);choices.push({name:found[0]!.item.name,price:row.price,options:found.map(f=>({menu:f.menu.name,itemId:f.item.id}))})}
  else issues.push(`*${clean(found[0]!.item.name)}* è presente in più categorie. Quale vuoi cambiare?`)
 }
 /** Update an existing dish (same id): unique → set the price; several → one plain question. */
 const update=(row:OnboardingMenuRow,found:ReturnType<typeof fuzzy>)=>{
  if(row.menu){const inMenu=found.filter(f=>key(f.menu.name)===key(row.menu!));if(inMenu.length)found=inMenu}
  if(found.length>1&&key(row.section)!=='menu'){const inSection=found.filter(f=>key(f.section.name)===key(row.section));if(inSection.length)found=inSection}
  if(found.length>1){if(found.every(f=>f.item.price===row.price))resolvedNames.push(row.name);else ask(row,found);return}
  setPrice(found[0]!.item,found[0]!.menu.name,row)
 }
 for(const raw of rows){
  // Name proposed without the copied verb: kept only if the rest is a dish of the draft (and the full name is not), or
  // the verb was «aggiungi»; otherwise the verb is part of a new dish name («Porta Nuova») and the clause is an add.
  let row:OnboardingMenuRow={...raw}
  if(raw.dishName&&raw.dishName!==raw.name){
   if(fuzzy(raw.dishName).length&&!fuzzy(raw.name).length||onboardingAddVerbName(raw.name))row={...raw,name:raw.dishName}
   else row={...raw,intent:raw.intentFull??'add'}
  }
  if(row.intent==='none')continue
  if(row.intent==='keep'){
   const kept=fuzzy(row.name)
   if(kept.length){resolvedNames.push(row.name)
    // «Mantieni il Burger a 13» while it is 12: never overwritten, and never «erano già così».
    if(row.citedPrice!==undefined&&kept.every(f=>f.item.price!==row.citedPrice))notes.push(`*${clean(kept[0]!.item.name)}* è a ${euro(kept[0]!.item.price)}, non a ${euro(row.citedPrice)}: l’ho lasciato così. Per cambiarlo scrivi «porta ${clean(kept[0]!.item.name)} a ${euro(row.citedPrice)}».`)
    continue}
   // «Mantieni il Burger a 12 euro, Tiramisu a 6 euro nel menu Pranzo»: a new dish that only inherits «mantieni» is asked, never dropped.
   if(row.intentInherited)issues.push(`Vuoi aggiungere *${clean(row.name)}* a ${euro(row.price)}? Scrivi «aggiungi ${clean(row.name)} a ${euro(row.price)}${row.menu?' nel menu '+clean(row.menu):''}».`)
   else notes.push(`*${clean(row.name)}* non è nella bozza: non l’ho aggiunto.`)
   continue
  }
  if(row.intent==='remove'||row.intent==='move'||row.intent==='rename'){
   let found=fuzzy(row.name);if(row.menu){const inMenu=found.filter(f=>key(f.menu.name)===key(row.menu!));if(inMenu.length)found=inMenu}
   if(!found.length){issues.push(`Non trovo *${clean(row.name)}* nella bozza: non ho cambiato nulla.`);continue}
   if(row.intent!=='remove'){notes.push(`Da qui non posso ${row.intent==='move'?'*spostare* un piatto in un altro menu':'*rinominare* un piatto'}: *${clean(found[0]!.item.name)}* resta com’è. Si fa dalla dashboard dopo l’attivazione.`);resolvedNames.push(row.name);continue}
   if(found.length>1){issues.push(`Quale *${clean(found[0]!.item.name)}* vuoi eliminare: ${[...new Set(found.map(f=>'*'+clean(f.menu.name)+'*'))].join(' o ')}?`);continue}
   const f=found[0]!;f.section.items=f.section.items.filter(item=>item.id!==f.item.id);resolvedNames.push(row.name);changes.push(`eliminato *${clean(f.item.name)}* (${clean(f.menu.name)})`);continue
  }
  if(row.intent==='delta'){
   let found=fuzzy(row.name);if(row.menu){const inMenu=found.filter(f=>key(f.menu.name)===key(row.menu!));if(inMenu.length)found=inMenu}
   const next=found.length===1?Math.round((found[0]!.item.price+(row.delta??0))*100)/100:NaN
   if(found.length!==1||!(next>0)){issues.push(`*${clean(row.name)}*: qual è il nuovo prezzo? Scrivi per esempio «porta ${clean(row.name)} a 14 euro».`);continue}
   setPrice(found[0]!.item,found[0]!.menu.name,{...row,price:next});continue
  }
  // «Aggiungi Pizza margherita da 8 a 9 euro» on a dish not in the draft: ask which price, never «non trovo».
  if(row.priceRange&&!fuzzy(row.name).length){issues.push(`*${clean(row.name)}*: qual è il prezzo? Ho letto ${euro(row.priceRange.from)} e ${euro(row.priceRange.to)}.`);continue}
  if(row.priceRange)row.intent='set'
  if(row.intent==='change'||row.intent==='set'){
   const found=fuzzy(row.name)
   if(found.length){update(row,found);continue}
   if(row.intent==='change'){issues.push(`Non trovo *${clean(row.name)}* nella bozza. Per aggiungerlo scrivi menu, categoria e prezzo.`);continue}
  }
  // Structural guardrail: a dish already in the draft in another menu, without a menu stated by the user for THIS
  // dish, is never created again — it resolves on the existing one (or asks). «mantieni/tieni/resta/confermo…» in any wording.
  const elsewhere=fuzzy(row.name).filter(f=>!row.menu||key(f.menu.name)!==key(row.menu))
  if(elsewhere.length&&(!row.menu||row.menuExplicit===false)&&!fuzzy(row.name).some(f=>row.menu&&key(f.menu.name)===key(row.menu))){
   const all=fuzzy(row.name)
   if(all.every(f=>f.item.price===row.price)){resolvedNames.push(row.name);continue}
   if(row.intent==='set'||correction){update(row,all);continue}
   if(all.length===1){issues.push(`*${clean(all[0]!.item.name)}* c’è già nel menu *${clean(all[0]!.menu.name)}* a ${euro(all[0]!.item.price)}. Vuoi portarlo a ${euro(row.price)}? Scrivi «porta ${clean(all[0]!.item.name)} a ${euro(row.price)}».`);continue}
   ask(row,all);continue
  }
  let menu=row.menu?workspace.menus.find(m=>key(m.name)===key(row.menu!)):workspace.menus.length===1?workspace.menus[0]:undefined
  if(!menu&&!row.menu&&workspace.menus.length>1){issues.push(`In quale *menu* va ${clean(row.name)}? ${workspace.menus.map(m=>'*'+clean(m.name)+'*').join(' o ')}`);choices.push({name:row.name,price:row.price,options:workspace.menus.map(m=>({menu:m.name,itemId:''})),add:{section:row.section,description:row.description}});continue}
  if(!menu){menu=workspaceSchema.parse({menus:[{id:randomUUID(),name:onboardingDisplayCase(row.menu||'Menu'),active:true}]}).menus[0]!;workspace.menus.push(menu)}
  const matches=menu.sections.flatMap(section=>section.items.filter(item=>key(item.name)===key(row.name)).map(item=>({section,item})))
  const specified=key(row.section)==='menu'?[]:matches.filter(match=>key(match.section.name)===key(row.section))
  const target=matches.length===1?matches[0]:specified.length===1?specified[0]:undefined
  if(matches.length&&!target){issues.push(`*${clean(row.name)}* è presente in più categorie di *${clean(menu.name)}*. Quale vuoi cambiare?`);continue}
  if(target){
   const old=target.item
   if(old.price!==row.price||!!row.description&&old.description!==row.description&&correction){
    if(correction||row.intent==='set')setPrice(old,menu.name,row)
    else issues.push(`*${clean(row.name)}*: trovo due prezzi, ${old.price} e ${row.price}. Qual è quello corretto?`)
   }else resolvedNames.push(row.name)
   continue
  }
  let section=menu.sections.find(s=>key(s.name)===key(row.section))
  if(!section){section=workspaceSchema.parse({menus:[{id:randomUUID(),name:'tmp',sections:[{id:randomUUID(),name:onboardingDisplayCase(row.section)}]}]}).menus[0]!.sections[0]!;menu.sections.push(section)}
  section.items.push(workspaceSchema.parse({menus:[{id:randomUUID(),name:'tmp',sections:[{id:randomUUID(),name:'tmp',items:[{id:randomUUID(),name:onboardingDisplayCase(row.name),price:row.price,description:row.description||null}]}]}]}).menus[0]!.sections[0]!.items[0]!)
  resolvedNames.push(row.name);changes.push(`aggiunto *${clean(onboardingDisplayCase(row.name))}* (${clean(menu.name)} · ${clean(section.name)}) a ${euro(row.price)}`)
 }
 return{issues,correctedNames,resolvedNames,changes,choices,notes}
}
