import {Buffer} from 'node:buffer'
import {randomUUID} from 'node:crypto'
import {inspectStaticImage,STATIC_IMAGE_LIMITS} from './static-image-policy.js'
import {copy,line,capabilities,allowedTags,dailySectionName,fill} from './twilio-menu-copy.js'
import {menuSystemPrompt,dishSystemPrompt} from './twilio-menu-prompt.js'
import {isSalesAction,salesActionKey,salesActionChanged,applySalesAction,describeSalesAction,salesFromLlm,salesLlmActions,type SalesAction} from './twilio-menu-sales.js'
import {businessDate} from './menu-sales.js'
export type MenuRef={id:string,name:string,price:number,available:boolean,hidden:boolean,menu:string,section?:string,sectionId?:string,hasImage?:boolean,featured?:boolean,tags?:string[]}
export type SectionRef={id:string,name:string,menu:string}
export type MenuAction={kind:'price',id:string,price:number}|{kind:'available'|'hidden'|'featured',id:string,value:boolean}|{kind:'image',id:string,mediaUrl:string,mediaType:string,url?:string}|{kind:'description',id:string,text:string}|{kind:'tag',id:string,tag:string,value:boolean}|{kind:'create',sectionId:string,name:string,price:number,description:string|null}|{kind:'special',name:string,price:number,description:string|null}|SalesAction
export type MenuPlan={type:'change',actions:MenuAction[],remove?:number[]}|{type:'read',read:'items',ids:string[]}|{type:'read',read:'unavailable'|'hidden'}|{type:'clarify',ids:string[]}|{type:'missing',missing:('section'|'price'|'name')[],name:string|null,sectionIds:string[]}|{type:'exists',id:string}|{type:'verbatim'}|{type:'capability',ids:string[]}
export const groqBase=()=>process.env.GROQ_API_BASE||'https://api.groq.com/openai/v1'
export const twilioBase=()=>process.env.TWILIO_API_BASE||'https://api.twilio.com'
export const chatModels=['openai/gpt-oss-120b','openai/gpt-oss-20b']
export const euro=(n:number)=>n.toFixed(2).replace('.',',')+' €'
export const plain=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const verbatim=(text:string,message:string)=>{const t=plain(text);return !!t&&(' '+plain(message)+' ').includes(' '+t+' ')}
// Creazioni solo con richiesta esplicita nel messaggio: «la lasagna costa 12» non crea mai un piatto.
export const wantsCreate=(m:string)=>/\b(aggiung\w*|inserisc\w*|inserire|nuov[oa]|crea\w*)\b/.test(plain(m))||wantsSpecial(m)
export const wantsSpecial=(m:string)=>/\b(del giorno|di oggi)\b/.test(plain(m))
// Se il modello non indica una capacità valida, parole chiave fisse lato server scelgono l'alternativa giusta.
const hints:[RegExp,string][]=[[/allergen/,'allergens'],[/elimin|cancell|rimuov|toglier\w* per sempre/,'delete'],[/rinomin|cambi\w* (il )?nome/,'rename'],[/tutti i (prezzi|piatti)|tutto il menu|in blocco|percent/,'bulk'],[/grafic|color|font|impagin|logo|sfondo/,'graphics'],[/categori|sezion/,'categories'],[/tradu|ingles|lingu/,'translations'],[/\bfoto|immagin/,'photo'],[/vocal|audio/,'voice']]
export const capabilityHint=(m:string)=>{const text=plain(m),found=hints.filter(([r])=>r.test(text)).map(([,id])=>id);return found.length?found.slice(0,2):['other']}
const sectionMentioned=(m:string,sections:SectionRef[])=>{const text=' '+plain(m)+' ';return sections.some(s=>plain(s.name).split(' ').filter(w=>w.length>=4).some(w=>text.includes(' '+w.slice(0,Math.max(4,w.length-1)))))}
const clarify=(ids:string[]=[]):MenuPlan=>({type:'clarify',ids:[...new Set(ids)].slice(0,5)})
const cleanText=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max?v.trim().replace(/\s+/g,' '):null
const priceOf=(v:unknown)=>{const n=typeof v==='string'?Number(v.replace(',','.').replace(/[€\s]/g,'')):v;return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100000?Math.round(n*100)/100:null}
export function parseJson(raw:unknown):any{if(typeof raw!=='string')return raw;try{return JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g,''))}catch{return null}}

// G9 (16/10): il server non si fida dell'IA. Ogni azione deve riguardare un piatto nominato nel testo (match tollerante:
// una parola distintiva del nome, anche con un refuso), ogni prezzo deve comparire nel messaggio (cifre o lettere,
// o come differenza esplicita «aumenta di 1»), il nome di un piatto nuovo non contiene parole d'azione né la categoria.
const g9Generic=new Set(['pasta','pizza','pizze','spaghetti','piatto','piatti','della','dello','delle','alla','alle','allo','con','menu','misto','mista','casa','fritto','fritti','sugo','bianco','rosso','media','grande','piccola','piccolo'])
const g9Words:Record<string,number>={zero:0,uno:1,un:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,ventuno:21,ventidue:22,ventitre:23,ventiquattro:24,venticinque:25,trenta:30,trentacinque:35,quaranta:40,quarantacinque:45,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90,cento:100}
const g9Near=(a:string,b:string)=>{if(a===b)return true;if(Math.abs(a.length-b.length)>1||Math.min(a.length,b.length)<6)return false;let i=0,j=0,e=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++e>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}}return e+(a.length-i)+(b.length-j)<=1}
export function g9DishMentioned(name:string,message:string,refs:{name:string}[]=[]){const msg=plain(message).split(' '),words=plain(name).split(' ').filter(w=>w.length>=4&&!g9Generic.has(w)&&!/^\d/.test(w)),pool=words.length?words:plain(name).split(' ').filter(w=>w.length>=3)
 if(pool.some(w=>msg.some(m=>m===w||(w.length>=5&&m.length>=5&&m.slice(0,5)===w.slice(0,5))||g9Near(m,w))))return true
 // «gli spaghetti sono finiti»: una parola generica basta solo se nel menu c'è un solo piatto che la contiene.
 return plain(name).split(' ').some(w=>g9Generic.has(w)&&w.length>=5&&msg.includes(w)&&refs.filter(r=>plain(r.name).split(' ').includes(w)).length===1)}
export function g9Prices(message:string):number[]{const out:number[]=[];for(const m of plain(message).matchAll(/\b(\d+) centesimi\b/g))out.push(Number(m[1])/100);const t=message.replace(/(\d)\s*,\s*(\d{1,2})(?!\d)/g,'$1.$2');for(const m of t.matchAll(/\d+(?:\.\d{1,2})?/g))out.push(Number(m[0]))
 const w=plain(message).split(' ');for(let i=0;i<w.length;i++){let a=g9Words[w[i]!];if(a===undefined)continue;if(g9Words[w[i+1]!]!==undefined&&a>=20&&g9Words[w[i+1]!]!<10){a+=g9Words[w[i+1]!]!}out.push(a);const k=w[i+1]==='euro'?i+2:i+1;if(w[k]==='e'){const c=g9Words[w[k+1]!]??(/^\d+$/.test(w[k+1]??'')?Number(w[k+1]):undefined);if(c!==undefined)out.push(a+c/100)}}
 const ints=out.filter(Number.isInteger);for(const x of ints)for(const y of ints)if(y>=10&&y<100)out.push(x+y/100);return out.map(x=>Math.round(x*100)/100)}
const g9Said=(price:number,message:string,current?:number)=>{const said=g9Prices(message);if(said.includes(Math.round(price*100)/100))return true;if(current!==undefined&&/\b(aument\w*|alz\w*|sal\w*|abbass\w*|diminu\w*|scont\w*|togli\w*|meno|piu)\b/.test(plain(message)))return said.some(d=>Math.abs(Math.abs(price-current)-d)<0.005);return false}
const g9ActionName=/\b(aggiung\w*|inserisc\w*|costa|costano|euro|prezzo|il piatto|tra i|tra le|tra gli|nei|nelle|negli|metti\w*|che costa|cambia|finit\w*|esaurit\w*|nascondi|togli)\b/
export function validateMenuPlan(raw:unknown,refs:MenuRef[],opts:{sections?:SectionRef[],message?:string,checkCompleteness?:boolean,trustedIds?:Set<string>}={}):MenuPlan{
 const data=parseJson(raw),sections=opts.sections??[],message=opts.message??'';if(!data||typeof data!=='object'||Array.isArray(data))return clarify()
 const byId=new Map(refs.map(r=>[r.id,r])),sectionIds=new Set(sections.map(s=>s.id)),known=(ids:unknown)=>Array.isArray(ids)?ids.filter((id):id is string=>typeof id==='string'&&byId.has(id)):[]
 if(data.intent==='capability'){const ids=Array.isArray(data.capability_ids)?data.capability_ids.filter((id:unknown):id is string=>typeof id==='string'&&(id==='all'||capabilities.some(c=>c.id===id))):[];const chosen=ids.length?[...new Set(ids)].slice(0,4) as string[]:[];return{type:'capability',ids:chosen.length&&!chosen.every(id=>id==='other')?chosen:capabilityHint(message)}}
 if(data.intent==='read'){if(data.read==='unavailable'||data.read==='hidden')return{type:'read',read:data.read};const ids=known(data.item_ids);return ids.length&&ids.length===(data.item_ids as unknown[]).length&&ids.length<=10?{type:'read',read:'items',ids:[...new Set(ids)]}:clarify(ids)}
 if(data.intent==='clarify'&&Array.isArray(data.missing)&&data.missing.length&&wantsCreate(message)){const name=cleanText(data.name,300),named=name&&verbatim(name,message)?name:null,missing=[...data.missing.filter((m:unknown)=>m==='section'||m==='price'||(m==='name'&&!named)),...(!wantsSpecial(message)&&sections.length&&!sectionMentioned(message,sections)?['section']:[]),...(/\d/.test(message)?[]:['price'])];if(missing.length)return{type:'missing',missing:[...new Set(missing)] as ('section'|'price'|'name')[],name:named,sectionIds:Array.isArray(data.section_ids)?data.section_ids.filter((id:unknown):id is string=>typeof id==='string'&&sectionIds.has(id)).slice(0,6):[]}}
 if(data.intent!=='change'&&wantsCreate(message)&&!wantsSpecial(message)&&!known(data.item_ids).length){const missing=[...(sections.length&&!sectionMentioned(message,sections)?['section' as const]:[]),...(/\d/.test(message)?[]:['price' as const])];if(missing.length)return{type:'missing',missing,name:null,sectionIds:[]}}
 if(data.intent!=='change'||!Array.isArray(data.actions)||!data.actions.length||data.actions.length>200)return clarify(known(data.item_ids))
 data.actions=data.actions.map((a:any)=>a&&typeof a==='object'&&!a.action&&Object.keys(a).length===1&&a[Object.keys(a)[0]!]&&typeof a[Object.keys(a)[0]!]==='object'?{action:Object.keys(a)[0],...a[Object.keys(a)[0]!]}:a)
 const actions:MenuAction[]=[],seen=new Set<string>(),valid=known(data.actions.map((a:any)=>a?.item_id));let created=0
 for(const a of data.actions){if(!a||typeof a!=='object')return clarify(valid)
  if(a.action==='create_item'||a.action==='create_daily_special'){if(++created>200||!(a.action==='create_item'?wantsCreate(message):wantsSpecial(message)))return clarify(valid);const name=cleanText(a.name,300),price=priceOf(a.price),description=a.description==null||a.description===''?null:cleanText(a.description,4000)
   if(a.action==='create_item'&&(typeof a.section_id!=='string'||!sectionIds.has(a.section_id)))return{type:'missing',missing:['section'],name:name&&verbatim(name,message)?name:null,sectionIds:[]}
   if(!name||price===null||(a.description!=null&&a.description!==''&&!description))return{type:'missing',missing:[...(!name?['name' as const]:[]),...(price===null?['price' as const]:[])],name:name&&verbatim(name,message)?name:null,sectionIds:[]}
   if(!verbatim(name,message)||(description&&!verbatim(description,message)))return{type:'verbatim'};if(g9ActionName.test(plain(name))||(a.action==='create_item'&&(' '+plain(name)+' ').includes(' '+plain(sections.find(x=>x.id===a.section_id)?.name??'\u0000')+' '))||!g9Said(price,message))return clarify(valid);const extra=description&&!plain(description).includes(plain(name))?description:null
   if(a.action==='create_item'){const twin=refs.find(r=>r.sectionId===a.section_id&&plain(r.name)===plain(name));if(twin)return{type:'exists',id:twin.id};actions.push({kind:'create',sectionId:a.section_id,name,price,description:extra})}else actions.push({kind:'special',name,price,description:extra});continue}
  if(typeof a.item_id!=='string'||!byId.has(a.item_id))return clarify(valid);if(!opts.trustedIds?.has(a.item_id)&&!g9DishMentioned(byId.get(a.item_id)!.name,message,refs))return clarify(valid);const key=a.item_id+a.action+(a.tag??'');if(seen.has(key))return clarify(valid);seen.add(key)
  if(a.action==='set_price'){const price=priceOf(a.price);if(price===null||!g9Said(price,message,byId.get(a.item_id)!.price))return clarify(valid);actions.push({kind:'price',id:a.item_id,price})}
  else if(a.action==='set_available'&&typeof a.available==='boolean')actions.push({kind:'available',id:a.item_id,value:a.available})
  else if(a.action==='set_hidden'&&typeof a.hidden==='boolean')actions.push({kind:'hidden',id:a.item_id,value:a.hidden})
  else if(a.action==='set_featured'&&typeof a.featured==='boolean')actions.push({kind:'featured',id:a.item_id,value:a.featured})
  else if((a.action==='add_tag'||a.action==='remove_tag')&&typeof a.tag==='string'&&a.tag in allowedTags)actions.push({kind:'tag',id:a.item_id,tag:a.tag,value:a.action==='add_tag'})
  else if(salesLlmActions.includes(a.action)){const sale=salesFromLlm(a,message);if(!sale||(sale.kind==='promo'&&sale.price!==null&&!g9Said(sale.price,message,byId.get(a.item_id)!.price)))return clarify(valid);actions.push(sale)}
  else if(a.action==='set_description'){const text=cleanText(a.text,4000);if(!text)return clarify(valid);if(!verbatim(text,message))return{type:'verbatim'};actions.push({kind:'description',id:a.item_id,text})}
  else return clarify(valid)}
 // Full, unambiguous names explicitly present in a request must never disappear from its plan.
 // An omitted/negated/unsupported clause leads to clarification of the whole request, never partial publication.
 const normalizedMessage=' '+plain(message)+' ',changedIds=new Set(actions.flatMap(a=>'id' in a?[a.id]:[]));
 const named=refs.filter(r=>plain(r.name).length>=3&&normalizedMessage.includes(' '+plain(r.name)+' ')&&refs.filter(x=>plain(x.name)===plain(r.name)).length===1);
 if(opts.checkCompleteness!==false&&named.some(r=>!changedIds.has(r.id))&&!actions.some(a=>a.kind==='create'||a.kind==='special'))return clarify(named.map(r=>r.id));
 return{type:'change',actions}
}
export const safe=(s:string)=>s.replace(/[*_~]/g,c=>c==='*'?'✱':c==='_'?' ':'-').trim()
export function itemLabel(ref:MenuRef,refs:MenuRef[]){const name=safe(ref.name);return refs.filter(r=>r.name.toLowerCase()===ref.name.toLowerCase()).length>1?`${name} (${safe(ref.menu)})`:name}
const short=(s:string,n=160)=>s.length>n?s.slice(0,n-1)+'…':s
export function describeAction(a:MenuAction,refs:MenuRef[],sections:SectionRef[]=[]){
 if(a.kind==='create'){const section=sections.find(s=>s.id===a.sectionId);return fill(line.create,{piatto:safe(a.name),categoria:section?safe(section.name):'?',prezzo:euro(a.price),descrizione:a.description?fill(line.newDescription,{testo:short(a.description)}):''})}
 if(a.kind==='special')return fill(line.special,{piatto:safe(a.name),prezzo:euro(a.price),descrizione:a.description?fill(line.newDescription,{testo:short(a.description)}):''})
 const ref=refs.find(r=>r.id===a.id)!,piatto=itemLabel(ref,refs)
 if(isSalesAction(a))return describeSalesAction(a,piatto,ref.price)
 if(a.kind==='price')return fill(line.price,{piatto,prima:euro(ref.price),dopo:euro(a.price)})
 if(a.kind==='available')return fill(a.value?line.available:line.unavailable,{piatto})
 if(a.kind==='hidden')return fill(a.value?line.hide:line.show,{piatto})
 if(a.kind==='featured')return fill(a.value?line.featured:line.unfeatured,{piatto})
 if(a.kind==='image')return fill(line.photo,{piatto,sostituisce:ref.hasImage?copy.photoReplaces:''})
 if(a.kind==='description')return fill(line.description,{piatto,testo:short(a.text,300)})
 if(a.kind==='tag')return fill(a.value?line.tagAdd:line.tagRemove,{piatto,etichetta:allowedTags[a.tag]!});return piatto
}
/** Canonical field identity lets corrections replace a value without dropping the rest of a pending batch. */
export const actionKey=(a:MenuAction)=>isSalesAction(a)?salesActionKey(a):a.kind==='create'?`create:${a.sectionId}:${plain(a.name)}`:a.kind==='special'?`special:${plain(a.name)}`:`${a.id}:${a.kind}:${a.kind==='tag'?a.tag:''}`
export function mergeMenuActions(previous:MenuAction[],delta:MenuAction[],remove:number[]=[]){
 const replacementKeys=new Set(delta.map(actionKey)),retained=previous.filter((a,i)=>!remove.includes(i+1)||replacementKeys.has(actionKey(a))),byKey=new Map(retained.map(a=>[actionKey(a),a]));for(const a of delta)byKey.set(actionKey(a),a);return [...byKey.values()]
}
/** Count actual field changes, not repeated instructions or values already in the published menu. */
export function effectiveMenuActions(actions:MenuAction[],workspace:any):MenuAction[]{
 const items=new Map<string,any>(workspace.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>[i.id,i]))));
 return mergeMenuActions([],actions).filter(a=>{if(a.kind==='create'||a.kind==='special'||a.kind==='image')return true;const item=items.get(a.id);if(!item)throw new Error('Item missing');if(isSalesAction(a))return salesActionChanged(a,item);if(a.kind==='price')return item.price!==a.price;if(a.kind==='description')return (item.description??'')!==a.text;if(a.kind==='tag')return (item.tags??[]).includes(a.tag)!==a.value;return (a.kind==='available'?item.available!==false:!!item[a.kind])!==a.value})
}
export const appliedMenuText=(actions:MenuAction[],refs:MenuRef[],sections:SectionRef[]=[])=>'*Confermato.* Ho aggiornato il menu.\n\n'+actions.map(a=>describeAction(a,refs,sections)).join('\n')
/** Explicit requests to keep the published price cancel only that pending price row. */
export function pendingPriceRestores(message:string,pending:MenuAction[],refs:MenuRef[]){
 const indices:number[]=[];for(const clause of message.split(/[.!?;\n]+/)){const text=' '+plain(clause)+' ';if(!/\b(lascia|lasciamo|mantieni|tieni|non cambiare|non modificare)\b/.test(text)||!/\bprezzo\b/.test(text)||!/\b(com e|come e|invariato|uguale|originale|attuale)\b/.test(text))continue;
  const matches=refs.filter(r=>text.includes(' '+plain(r.name)+' '));if(matches.length!==1)continue;pending.forEach((a,i)=>{if(a.kind==='price'&&a.id===matches[0]!.id)indices.push(i+1)})
 }return [...new Set(indices)]
}
export function validatePendingMenuPlan(raw:unknown,refs:MenuRef[],sections:SectionRef[],message:string,pending:MenuAction[]):MenuPlan{
 const data=parseJson(raw);if(data?.intent!=='change')return validateMenuPlan(raw,refs,{sections,message});
 const invalid=():MenuPlan=>({type:'clarify',ids:[]}),remove=data.remove_indices??[],updates=data.update_indices??[];
 if(!Array.isArray(remove)||remove.some((i:unknown)=>!Number.isInteger(i)||Number(i)<1||Number(i)>pending.length)||!Array.isArray(updates)||updates.length>200||!Array.isArray(data.actions))return invalid();
 const patched:MenuAction[]=[],seen=new Set<number>(),text=' '+plain(message)+' ',created=pending.filter(a=>a.kind==='create'||a.kind==='special');
 const ordinal=['prim','second','terz','quart','quint','sest','settim','ottav','non','decim'];
 for(const update of updates){
  if(!update||typeof update!=='object'||!Number.isInteger(update.index)||seen.has(update.index)||Object.keys(update).some(k=>!['index','price','description','section_id'].includes(k)))return invalid();
  const previous=pending[update.index-1];if(!previous)return invalid();seen.add(update.index);
  const creation=previous.kind==='create'||previous.kind==='special',targetName=creation?previous.name:'id' in previous?refs.find(r=>r.id===previous.id)?.name:null;if(!targetName)return invalid();
  const named=text.includes(' '+plain(targetName)+' ')&&(creation?created.filter(a=>'name' in a&&plain(a.name)===plain(targetName)).length===1:refs.filter(r=>plain(r.name)===plain(targetName)).length===1);
  const numberRef=new RegExp('\\b(?:riga|numero|modifica|voce) '+update.index+'\\b').test(text),ordinalRef=ordinal[update.index-1]&&new RegExp('\\b'+ordinal[update.index-1]+'[oa]\\b').test(text);
  const single=creation&&created.length===1&&/\b(piatto nuovo|nuovo piatto|quello nuovo|quel piatto|piatto del giorno)\b/.test(text);
  if(!named&&!numberRef&&!ordinalRef&&!single)return invalid();
  const next={...previous};let changed=false;
  if('price' in update){const price=priceOf(update.price);if(price===null||!('price' in next))return invalid();next.price=price;changed=true}
  if('description' in update){const description=cleanText(update.description,4000);if(!description||!verbatim(description,message))return invalid();if('description' in next)next.description=description;else if(next.kind==='description')next.text=description;else return invalid();changed=true}
  if('section_id' in update){const section=sections.find(s=>s.id===update.section_id);if(next.kind!=='create'||!section||!sectionMentioned(message,[section]))return invalid();next.sectionId=section.id;changed=true}
  if(!changed)return invalid();patched.push(next);remove.push(update.index)
 }
 const restore=pendingPriceRestores(message,pending,refs),restoreKeys=new Set(restore.map(i=>actionKey(pending[i-1]!)));remove.push(...restore);
 if(!data.actions.length)return remove.length?{type:'change',actions:patched,remove:[...new Set(remove)] as number[]}:invalid();
 const plan=validateMenuPlan(data,refs,{sections,message,checkCompleteness:false,trustedIds:new Set(pending.flatMap(a=>'id' in a?[a.id]:[]))});return plan.type==='change'?{...plan,actions:[...plan.actions,...patched].filter(a=>!restoreKeys.has(actionKey(a))),remove:[...new Set(remove)] as number[]}:plan
}
export function proposalText(restaurant:string,actions:MenuAction[],refs:MenuRef[],sections:SectionRef[]=[]){
 return fill(copy.proposal,{locale:restaurant,righe:actions.map((a,i)=>(i+1)+'. '+describeAction(a,refs,sections)).join('\n')})
}
export function readText(plan:Extract<MenuPlan,{type:'read'}>,refs:MenuRef[]){
 if(plan.read==='items')return plan.ids.map(id=>{const r=refs.find(x=>x.id===id)!;return fill(line.read,{piatto:itemLabel(r,refs),prezzo:euro(r.price),stato:r.available?'disponibile':'finito',extra:(r.hidden?' · nascosto':'')+(r.featured?' · in evidenza':'')})}).join('\n')
 const list=refs.filter(r=>plan.read==='hidden'?r.hidden:!r.available).map(r=>'- '+itemLabel(r,refs));if(!list.length)return copy.readNone[plan.read]
 return fill(copy.readList[plan.read],{n:list.length,elenco:list.slice(0,40).join('\n')+(list.length>40?'\n…':'')})
}
/** A clear dish with two alternative amounts needs a price question, not another dish lookup. */
export function priceChoiceText(message:string,refs:MenuRef[]):string|null{
 const text=message.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(),normalized=' '+plain(message)+' ';
 if(/[?]|\bquanto\b/.test(text)||!/\b(metti\w*|porta\w*|fai|costa\w*|prezzo)\b/.test(text))return null;
 const amount='(?:\\d+(?:[.,]\\d{1,2})?|zero|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti|trenta|quaranta|cinquanta|sessanta|settanta|ottanta|novanta|cento)',alternatives=text.match(new RegExp('\\b('+amount+')\\s*(?:euro|euri|€)?\\s+(?:oppure|o)\\s+('+amount+')\\b'));
 if(!alternatives)return null;const named=refs.filter(r=>normalized.includes(' '+plain(r.name)+' '));if(named.length!==1)return null;
 return fill(copy.choosePrice,{piatto:itemLabel(named[0]!,refs),primo:alternatives[1]!,secondo:alternatives[2]!})
}
export function clarifyText(ids:string[],refs:MenuRef[]){const names=ids.map(id=>refs.find(r=>r.id===id)).filter(Boolean).map(r=>'*'+itemLabel(r!,refs)+'*');return names.length?fill(copy.whichDish,{opzioni:names.join(', ')}):copy.notUnderstood}
export function capabilityText(ids:string[]){if(!ids.length||ids.includes('all')||ids.length>2)return copy.help;return ids.map(id=>capabilities.find(c=>c.id===id)??capabilities.find(c=>c.id==='other')!).map(c=>c.can?fill(copy.capabilityYes,{testo:c.text,esempio:c.example!}):fill(copy.capabilityNo,{testo:c.text,alternativa:c.alternative!})).join('\n\n')}
export function planText(plan:Exclude<MenuPlan,{type:'change'}>,refs:MenuRef[],sections:SectionRef[]=[]){
 if(plan.type==='read')return readText(plan,refs);if(plan.type==='clarify')return clarifyText(plan.ids,refs);if(plan.type==='capability')return capabilityText(plan.ids);if(plan.type==='verbatim')return copy.notVerbatim
 if(plan.type==='exists'){const r=refs.find(x=>x.id===plan.id)!;return fill(copy.alreadyExists,{piatto:safe(r.name),categoria:safe(r.section??r.menu)})}
 const wanted=plan.missing.map(m=>m==='section'?'la categoria':m==='price'?'il prezzo':'il nome'),suggested=plan.sectionIds.map(id=>sections.find(s=>s.id===id)!),listed=sections.slice(0,15)
 return fill(copy.createMissing,{piatto:plan.name?'*'+safe(plan.name)+'*':'il piatto',mancante:wanted.length>1?wanted.slice(0,-1).join(', ')+' e '+wanted.at(-1):wanted[0]!,categorie:plan.missing.includes('section')&&listed.length?fill(copy.createCategories,{categorie:listed.map(s=>s.name).join(', ')}):'',categoria:(suggested[0]??listed[0])?.name.toLowerCase()??'i primi',nomeEsempio:plan.name??'pasta al ragù'})
}
export function welcomeText(restaurant:string,refs:MenuRef[],sections:SectionRef[]){
 const good=refs.filter(r=>r.available&&!r.hidden&&r.price>0&&r.name.length<=30&&!/[«»"*]/.test(r.name)),first=good[0],second=good.find(r=>r!==first&&plain(r.name)!==plain(first?.name??'')),primi=sections.find(s=>plain(s.name).startsWith('primi')),section=sections.find(s=>s.name.length<=25&&plain(s.name)!==plain(dailySectionName))
 return fill(copy.welcome,{locale:restaurant,esempioPrezzo:first?`«${first.name} costa ${Math.round(first.price)+1}»`:copy.welcomeExamples.price,esempioFinito:second?`«esaurito ${second.name}»`:copy.welcomeExamples.finished,esempioNuovo:primi||!section?copy.welcomeExamples.create:`«aggiungi in ${section.name}: pasta al ragù, 12 €»`})
}
export function localDate(timezone:string,now=new Date()){let zone='Europe/Rome';try{new Intl.DateTimeFormat('en',{timeZone:timezone});zone=timezone}catch{}const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(v=>[v.type,v.value]));return{zone,date:`${p.year}-${p.month}-${p.day}`}}
// Applica azioni già validate a un workspace (da ri-validare con workspaceSchema prima di salvare). Restituisce i nomi toccati.
export function applyActions(w:any,actions:MenuAction[],opts:{uploads?:Map<string,string>,timezone?:string,now?:Date}={}){
 const items=new Map<string,any>(w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>[i.id,i])))),names:string[]=[]
 for(const a of actions){
  if(a.kind==='create'){const section=w.menus.flatMap((m:any)=>m.sections).find((s:any)=>s.id===a.sectionId);if(!section)throw new Error('Section missing');section.items.push({id:randomUUID(),name:a.name,price:a.price,description:a.description});names.push(a.name);continue}
  if(a.kind==='special'){const {zone,date}=localDate(opts.timezone??'Europe/Rome',opts.now),schedule={timezone:zone,enabled:true,windows:[{weekdays:[0,1,2,3,4,5,6],start:'00:00',end:'00:00'}],from:date,until:date}
   const menu=w.menus.find((m:any)=>m.active!==false&&(m.type??'main')==='main')??w.menus.find((m:any)=>m.active!==false);if(!menu)throw new Error('Menu missing')
   let section=menu.sections.find((s:any)=>!s.parentSectionId&&plain(s.name)===plain(dailySectionName));if(!section){section={id:randomUUID(),name:dailySectionName,items:[]};menu.sections.unshift(section)}
   section.active=true;section.schedule=schedule;section.items.push({id:randomUUID(),name:a.name,price:a.price,description:a.description,schedule});names.push(a.name);continue}
  const item=items.get(a.id);if(!item)throw new Error('Item missing');if(!names.includes(item.name))names.push(item.name)
  if(a.kind==='price')item.price=a.price;else if(a.kind==='available')item.available=a.value;else if(a.kind==='hidden')item.hidden=a.value;else if(a.kind==='featured')item.featured=a.value
  else if(a.kind==='description')item.description=a.text;else if(a.kind==='image'){const url=opts.uploads?.get(a.id);if(!url)throw new Error('Upload missing');item.imageUrl=url}
  else if(isSalesAction(a))applySalesAction(item,a,businessDate(opts.timezone,opts.now))
  else if(a.kind==='tag'){const tags:string[]=item.tags??[];item.tags=a.value?(tags.includes(a.tag)?tags:[...tags,a.tag]):tags.filter(t=>t!==a.tag)}
 }
 return names
}
export class GroqBusy extends Error{constructor(){super('GROQ_RATE_LIMITED')}}
export type UsageEvent={model:string,prompt:number,completion:number,limited:boolean,audioSeconds?:number}
export type GroqOptions={meter?:(e:UsageEvent)=>unknown,onWait?:()=>unknown,budgetMs?:number,timeoutMs?:number,sleep?:(ms:number)=>Promise<unknown>}
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms))
export function retryAfterMs(headers:Headers){const direct=Number(headers.get('retry-after'));if(Number.isFinite(direct)&&direct>0)return direct*1000;const reset=headers.get('x-ratelimit-reset-tokens')||headers.get('x-ratelimit-reset-requests')||'';const m=reset.match(/^(?:(\d+)m)?(?:([\d.]+)s)?$/);return m&&reset?Math.ceil((Number(m[1]||0)*60+Number(m[2]||0))*1000):10000}
// Limiti Groq (429): una sola notifica di attesa, poi riprova rispettando retry-after; usa il modello di riserva appena libero; oltre il budget → GroqBusy.
async function withRateLimit<T>(models:string[],call:(model:string)=>Promise<Response>,read:(model:string,response:Response)=>Promise<T>,opts:GroqOptions):Promise<T>{
 const deadline=Date.now()+(opts.budgetMs??60000),blocked=new Map<string,number>(),failed=new Set<string>(),sleep=opts.sleep??pause;let waited=false,limited=false,last:unknown
 for(;;){const now=Date.now(),model=models.find(m=>!failed.has(m)&&(blocked.get(m)??0)<=now)
  if(!model){const open=models.filter(m=>!failed.has(m));if(!open.length)throw limited?new GroqBusy():last;const next=Math.min(...open.map(m=>blocked.get(m)??0));if(next>deadline)throw new GroqBusy();await sleep(Math.max(0,next-now));continue}
  try{const response=await call(model)
   if(response.status===429){limited=true;await response.body?.cancel();blocked.set(model,Date.now()+retryAfterMs(response.headers));await opts.meter?.({model,prompt:0,completion:0,limited:true});if(!waited){waited=true;await opts.onWait?.()}continue}
   if(!response.ok){await response.body?.cancel();throw new Error('Groq '+response.status)}
   return await read(model,response)}catch(error){failed.add(model);last=error}
 }
}
async function groqJson(prompt:string,user:string,key:string,opts:GroqOptions={}){
 return withRateLimit(chatModels,model=>fetch(groqBase()+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:0,max_completion_tokens:16000,response_format:{type:'json_object'},reasoning_effort:'low',messages:[{role:'system',content:prompt},{role:'user',content:user}]}),signal:AbortSignal.timeout(opts.timeoutMs??20000)}),
  async(model,response)=>{const data=await response.json() as any,usage={prompt:Number(data?.usage?.prompt_tokens)||0,completion:Number(data?.usage?.completion_tokens)||0};await opts.meter?.({model,...usage,limited:false});return{model,content:String(data?.choices?.[0]?.message?.content??''),usage}},opts)
}
// Codici brevi al posto degli UUID: meno token per richiesta; il server li riconverte e poi valida come sempre.
function compactCatalog(refs:MenuRef[],sections:SectionRef[]){const codes=new Map<string,string>()
 sections.forEach((s,i)=>codes.set('c'+(i+1),s.id));refs.slice(0,1500).forEach((r,i)=>codes.set('p'+(i+1),r.id))
 const text=(sections.length?'CATEGORIE\n'+sections.slice(0,300).map((s,i)=>JSON.stringify(['c'+(i+1),s.name,s.menu])).join('\n')+'\n\n':'')+'PIATTI\n'+refs.slice(0,1500).map((r,i)=>JSON.stringify(['p'+(i+1),r.name,r.price,+r.available,+r.hidden,+!!r.featured,r.tags??[],r.section??''])).join('\n')
 return{text,expand:(content:string)=>{const data=parseJson(content);if(!data||typeof data!=='object')return content;const map=(v:unknown)=>typeof v==='string'||typeof v==='number'?codes.get(String(v).trim().toLowerCase())??String(v):v
  const walk=(o:any)=>{if(Array.isArray(o))return o.forEach(walk);if(!o||typeof o!=='object')return;for(const k of Object.keys(o)){if(k==='item_id'||k==='section_id')o[k]=map(o[k]);else if((k==='item_ids'||k==='section_ids')&&Array.isArray(o[k]))o[k]=o[k].map(map);else walk(o[k])}};walk(data);return JSON.stringify(data)}}
}
async function groqCatalog(prompt:string,label:string,text:string,refs:MenuRef[],sections:SectionRef[],key:string,opts:GroqOptions){const catalog=compactCatalog(refs,sections),result=await groqJson(prompt,catalog.text+'\n\n'+label+'\n'+text,key,opts);return{model:result.model,usage:result.usage,content:catalog.expand(result.content)}}
// refs e sections qui sono già la preselezione: l'IA vede solo i candidati.
export const groqMenuPlan=(text:string,refs:MenuRef[],key:string,sections:SectionRef[]=[],opts:GroqOptions={})=>groqCatalog(menuSystemPrompt,'MESSAGGIO',text,refs,sections,key,opts)
export const groqPendingMenuPlan=(text:string,refs:MenuRef[],key:string,sections:SectionRef[],pending:MenuAction[],opts:GroqOptions={})=>groqCatalog(menuSystemPrompt+`\nESISTE UNA PROPOSTA NON PUBBLICATA. Il messaggio modifica quella proposta. Schema ESATTO: {\"intent\":\"change\",\"actions\":[nuoveAzioni],\"remove_indices\":[numeriRigheDaTogliere],\"update_indices\":[]}. Tutti i campi sono allo stesso livello. Restituisci SOLO le nuove azioni/correzioni in actions e remove_indices con i numeri delle sole righe che l'utente chiede esplicitamente di togliere. Le altre righe sono mantenute automaticamente dal server: non ripeterle. Per correggere un piatto NUOVO già nel riepilogo usa update_indices:[{index:numeroRiga,price:13,description:paroleEsatte?,section_id:idCategoria?}]. Ometti i campi non modificati; non cambiare il nome. Il riferimento deve essere un numero/nome univoco; «quel piatto nuovo fallo13» è univoco solo se c'è un solo piatto nuovo. Usa update_indices anche per correzioni alla descrizione/categoria del nuovo piatto. Nelle azioni nuove non ripetere quella creazione. IMPORTANTE: «Lascia il prezzo di X com'è / invariato / non cambiare il prezzo di X» significa togliere la variazione proposta per X: aggiungi la sua riga a remove_indices. «Mantieni le altre modifiche» mantiene tutte le altre righe: NON clarify. Esempio quattro righe Pasta14, Pizza16, Dolce7, Acqua3; messaggio «Pasta falla15, non14. Lascia il prezzo Acqua com'è. Mantieni le altre modifiche.» => actions:[set_price Pasta15],remove_indices:[4]. I numeri in lettere sono normali prezzi: quindici=15; «non quattordici» corregge il precedente14, non è una seconda modifica. Correzione prezzo: nuova set_price per stesso piatto; cancellazione di una riga: remove_indices. Se un riferimento ordinale/nome è ambiguo, clarify e nessuna azione. Per togliere tutte le modifiche usa tutti i numeri esplicitamente. Non trasformare una domanda in modifica.`, 'PROPOSTA DA MODIFICARE (numeri stabili)\n'+pending.map((a,i)=>JSON.stringify({index:i+1,description:describeAction(a,refs,sections)})).join('\n')+'\nMESSAGGIO',text,refs,sections,key,opts)
export const groqDishPick=(name:string,refs:MenuRef[],key:string,sections:SectionRef[]=[],opts:GroqOptions={})=>groqCatalog(dishSystemPrompt,'NOME INDICATO',name.slice(0,300),refs,sections,key,opts)
export function validateDishPick(raw:unknown,refs:MenuRef[]):{type:'dish',id:string}|{type:'clarify',ids:string[]}{
 const data=parseJson(raw),ids=new Set(refs.map(r=>r.id));if(data?.intent==='dish'&&typeof data.item_id==='string'&&ids.has(data.item_id))return{type:'dish',id:data.item_id}
 return{type:'clarify',ids:Array.isArray(data?.item_ids)?[...new Set(data.item_ids.filter((id:unknown):id is string=>typeof id==='string'&&ids.has(id)))].slice(0,5) as string[]:[]}
}
export const dishMatches=(name:string,refs:MenuRef[])=>{const key=plain(name);return key?refs.filter(r=>plain(r.name)===key):[]}
export async function downloadTwilioMedia(url:string,accountSid:string,token:string,maxBytes=10*1024*1024,timeoutMs=10000){
 if(!url.startsWith(`${twilioBase()}/2010-04-01/Accounts/${accountSid}/`))throw new Error('Media URL not allowed')
 const response=await fetch(url,{headers:{Authorization:'Basic '+Buffer.from(accountSid+':'+token).toString('base64')},redirect:'follow',signal:AbortSignal.timeout(timeoutMs)});if(!response.ok||!response.body)throw new Error('Media '+response.status)
 if(Number(response.headers.get('content-length')||0)>maxBytes)throw new Error('Media too large');const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('Media too large')}chunks.push(value)}
 return{bytes:Buffer.concat(chunks),type:(response.headers.get('content-type')||'audio/ogg').split(';')[0]!.trim()}
}
export async function transcribeAudio(bytes:Uint8Array,type:string,key:string,opts:GroqOptions={}){
 const ext=/mpeg|mp3/.test(type)?'mp3':/mp4|m4a|aac/.test(type)?'m4a':/wav/.test(type)?'wav':/webm/.test(type)?'webm':'ogg'
 return withRateLimit(['whisper-large-v3-turbo'],model=>{const body=new FormData();body.append('file',new Blob([bytes],{type}),'vocale.'+ext);body.append('model',model);body.append('language','it');body.append('temperature','0');body.append('prompt','CONFERMA, ANNULLA, prezzo, euro, esaurito, disponibile, nascondi, mostra');body.append('response_format','verbose_json');return fetch(groqBase()+'/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+key},body,signal:AbortSignal.timeout(opts.timeoutMs??20000)})},
  async(model,response)=>{const data=await response.json() as any;await opts.meter?.({model,prompt:0,completion:0,limited:false,audioSeconds:Math.max(Number(data?.duration)||0,10)});return String(data?.text??'').trim()},opts)
}
export function splitWhatsAppText(text:string,max=1400){const parts:string[]=[];let rest=text;while(rest.length>max){const boundary=rest.lastIndexOf('\n',max),end=boundary>max/2?boundary:max;parts.push(rest.slice(0,end));rest=rest.slice(end).replace(/^\n/,'')}if(rest)parts.push(rest);return parts}
export async function sendWhatsApp(accountSid:string,token:string,from:string,to:string,text:string){
 const parts=splitWhatsAppText(text);if(parts.length>1){let last:{sid?:string,status?:string}={};for(const part of parts)last=await sendWhatsApp(accountSid,token,from,to,part);return last}
 const response=await fetch(`${twilioBase()}/2010-04-01/Accounts/${accountSid}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(accountSid+':'+token).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({From:from,To:to,Body:text}).toString(),signal:AbortSignal.timeout(10000)})
 if(!response.ok){let code='';try{code=String((await response.json() as any)?.code??'')}catch{}throw new Error('Twilio send '+response.status+(code?' '+code:''))}
 let data:any=null;try{data=await response.json()}catch{}
 return{sid:typeof data?.sid==='string'?data.sid as string:undefined,status:typeof data?.status==='string'?data.status as string:undefined}
}
export function photoProblem(bytes:Uint8Array,type:string){if(/heic|heif/i.test(type))return copy.photoHeic;try{const info=inspectStaticImage(bytes,downscaleSourcePixels);return info.width*info.height>STATIC_IMAGE_LIMITS.pixels&&info.format!=='jpeg'?copy.photoTooBig:null}catch(error){const code=error instanceof Error?error.message:'';return code==='INPUT_PIXEL_LIMIT'?copy.photoTooBig:code==='INPUT_BYTE_LIMIT'?copy.photoBytes:code==='ANIMATION_NOT_SUPPORTED'?copy.photoAnimated:copy.photoInvalid}}
export const downscaleSourcePixels=50_000_000
