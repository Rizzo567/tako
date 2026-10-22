// Sostituzione del contenuto di UN menu con un menu intero (Feature 1). Funzione pura sul documento:
// - piatti già presenti (stesso nome o quasi, sameOnboardingDish) si aggiornano mantenendo id, nome e traduzioni;
// - piatti nuovi si creano; categorie nuove si creano;
// - i piatti del menu che non compaiono vengono ELIMINATI (22/10 notte, decisione Manuel: per i piatti «nascondere» non esiste più;
//   si torna indietro con «ripristina il menu di prima», che rimette la copia di sicurezza);
// - gli altri menu (Drinks, menu fisso…) non si toccano.
import {randomUUID} from 'node:crypto'
import {sameOnboardingDish,onboardingDishKey} from './onboarding-dish-name.js'
import {onboardingDisplayCase} from './onboarding-menu-merge.js'
import type {Workspace} from './menu-workspace-contract.js'
import type {FullMenuRow} from './menu-full-extract.js'

type Menu=Workspace['menus'][number];type Section=Menu['sections'][number];type Item=Section['items'][number]
export type ReplaceSummary={created:{name:string,price:number,section:string}[],updated:{name:string,from:number,to:number}[],kept:string[],hidden:string[],newTexts:string[],sections:{name:string,items:{name:string,price:number,description:string}[]}[]}

/** «Primi»/«Primo», «Dolci»/«Dolce»: same category. */
const sectionKey=(name:string)=>onboardingDishKey(name).split(' ').map(w=>w.length>4?w.replace(/[aeiou]$/,''):w).join(' ')
const implicit=(name:string)=>['menu','menu del giorno'].includes(onboardingDishKey(name))
const fallbackSection='Piatti'

function newItem(row:FullMenuRow):Item{return{id:randomUUID(),name:onboardingDisplayCase(row.name.trim()),description:row.description?.trim()||null,price:row.price,imageUrl:null,allergens:[],tags:[],additives:[],available:true,hidden:false,featured:false,displayMode:'normal',externalLink:null,priceDisplay:null,kitchenStation:null,prepTimeMinutes:10,costPrice:null,calories:null,variants:[],translations:{}} as Item}
function newSection(name:string):Section{return{id:randomUUID(),parentSectionId:null,name:onboardingDisplayCase(name.trim()),description:null,active:true,translations:{},items:[]} as Section}

/** Builds the new content of `menu` (sections, deep copy) from the confirmed rows; the input menu is not modified. */
export function buildMenuContent(menu:Menu,rows:FullMenuRow[]):{sections:Section[],summary:ReplaceSummary}{
 const sections:Section[]=structuredClone(menu.sections),summary:ReplaceSummary={created:[],updated:[],kept:[],hidden:[],newTexts:[],sections:[]}
 const all=sections.flatMap(s=>s.items.map(item=>({item,section:s}))),used=new Set<string>(),touched:Section[]=[],placed=new Map<string,Item[]>()
 const topLevel=()=>sections.filter(s=>!s.parentSectionId)
 const findSection=(name:string)=>topLevel().find(s=>sectionKey(s.name)===sectionKey(name))
 let lastExplicit:Section|null=null
 for(const row of rows){
  const match=all.find(x=>!used.has(x.item.id)&&sameOnboardingDish(x.item.name,row.name))
  let target:Section|undefined
  if(!implicit(row.section)){target=findSection(row.section);if(!target){target=newSection(row.section);sections.push(target);summary.newTexts.push(target.name)}lastExplicit=target}
  else target=lastExplicit??match?.section??(topLevel().length===1?topLevel()[0]:undefined)??findSection(fallbackSection)??(()=>{const s=newSection(fallbackSection);sections.push(s);summary.newTexts.push(s.name);return s})()
  target.active=true;if(!touched.includes(target))touched.push(target)
  let item:Item
  if(match){
   item=match.item;used.add(item.id)
   if(item.price!==row.price)summary.updated.push({name:item.name,from:item.price,to:row.price});else summary.kept.push(item.name)
   item.price=row.price;item.hidden=false;item.available=true
   const description=row.description?.trim();if(description&&description!==(item.description??'')){item.description=description;summary.newTexts.push(description)}
   if(match.section!==target)match.section.items=match.section.items.filter(i=>i.id!==item.id)
  }else{item=newItem(row);summary.created.push({name:item.name,price:item.price,section:target.name});summary.newTexts.push(item.name);if(item.description)summary.newTexts.push(item.description)}
  placed.set(target.id,[...(placed.get(target.id)??[]).filter(i=>i.id!==item.id),item])
 }
 // Dishes the owner listed come first, in the order said; the others are DELETED (summary.hidden = deleted names, field kept for callers).
 for(const section of sections){
  const first=placed.get(section.id)??[],firstIds=new Set(first.map(i=>i.id))
  const rest=section.items.filter(i=>!firstIds.has(i.id))
  for(const i of rest)if(!used.has(i.id))summary.hidden.push(i.name)
  section.items=[...first,...rest.filter(i=>used.has(i.id))]
 }
 const order=[...touched,...sections.filter(s=>!touched.includes(s))]
 summary.sections=touched.map(s=>({name:s.name,items:(placed.get(s.id)??[]).map(i=>({name:i.name,price:i.price,description:i.description??''}))}))
 return{sections:order,summary}
}

/** Replaces the content of the menu `menuId` in a copy of the workspace; every other menu is returned untouched. */
export function replaceMenuContent(workspace:Workspace,menuId:string,rows:FullMenuRow[]):{workspace:Workspace,summary:ReplaceSummary}{
 const next=structuredClone(workspace),menu=next.menus.find(m=>m.id===menuId);if(!menu)throw new Error('Menu missing')
 const built=buildMenuContent(menu,rows);menu.sections=built.sections
 return{workspace:next,summary:built.summary}
}

/** «Ripristina il menu di prima»: puts back ONLY that menu from the safety copy; later changes to other menus stay. */
export function restoreMenuFrom(workspace:Workspace,snapshot:Workspace,menuId:string):Workspace|null{
 const before=snapshot.menus.find(m=>m.id===menuId),index=workspace.menus.findIndex(m=>m.id===menuId);if(!before||index<0)return null
 const next=structuredClone(workspace);next.menus[index]={...next.menus[index]!,sections:structuredClone(before.sections)};return next
}
