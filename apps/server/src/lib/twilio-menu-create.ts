/** Aggiunta di un piatto dal bot WhatsApp del titolare, senza IA (16/10/2026).
 * Un messaggio che inizia con un verbo di aggiunta è SEMPRE un'aggiunta (mai un cambio prezzo):
 * «aggiungi tra piatti di prova il piatto pasta al ragù che costa 12 euro» → categoria, nome, prezzo.
 * Se manca qualcosa il bot fa UNA domanda e salva la bozza come proposta `create_draft` (10 minuti):
 * il messaggio successivo, testo o vocale, completa la bozza anche se riscritto per intero. */
import type {SectionRef,MenuRef,MenuAction} from './twilio-menu-ai.js'
import {findDishes} from './twilio-menu-nlu.js'
import {g9WordNumber} from './twilio-menu-ai.js'
import {resolveUntil} from './menu-sales.js'

export type CreateDraft={kind:'create_draft',name:string|null,price:number|null,sectionId:string|null}
export type CreateParse={name:string|null,price:number|null,sectionId:string|null,unknownSection:boolean}

const waNewFold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
const waNewNumbers:Record<string,number>={zero:0,uno:1,un:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,ventuno:21,ventidue:22,ventitre:23,ventiquattro:24,venticinque:25,trenta:30,trentacinque:35,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90,cento:100}
const waNewVerb=/^(?:(?:allora|ok|ciao|senti|mi|ci|puoi|potresti|vorrei|voglio|vorremmo|dobbiamo|devo)\s+)*(?:aggiung\w*|aggiun\w*|aggin\w*|agiung\w*|inserisc\w*|inserire|(?:metti|mettiamo|crea|creiamo)\s+(?:nel\s+menu|(?:un[oa]?\s+)?nuov[oa]\s+\w+)|(?:un[oa]?\s+)?nuov[oa]\s+(?:piatt[oi]|pizz[ae]|dolc[ei]|antipast[oi]|prim[oi]|second[oi]|bibit[ae])\b)\b/
/** Inizia con un verbo di aggiunta? */
const waNewNotCreate=/\b(descrizion\w*|foto|immagin\w*|allergen\w*|del giorno|di oggi|in evidenza|etichett\w*|promo\w*|offert\w*)\b/
// Frase composta («… a 12 e la carbonara è finita», «… e tra i secondi …»): resta al percorso di sempre (IA con validatore).
const waNewCompound=/\b(e|poi|anche)\s+(tra|fra|nei|negli|nelle|nella|nel|in|aggiung\w*|metti\w*|togli\w*|nascond\w*|il|la|lo|i|gli|le)\b.*\b(\d|finit\w*|esaurit\w*|euro|costa)/
export const startsWithCreate=(raw:string)=>{const t=waNewFold(raw).replace(/[^a-z0-9]+/g,' ').trim();return waNewVerb.test(t)&&!waNewNotCreate.test(t)}
export const createCompound=(raw:string)=>{const t=waNewFold(raw).replace(/(\d)[,.](\d)/g,'$1.$2').replace(/[^a-z0-9.]+/g,' ').trim();const after=t.replace(/^.*?\d+(?:\.\d+)?( euro)?/,'');return waNewCompound.test(' '+after)||(t.match(/\d+(?:\.\d+)?\s*(?:euro)?/g)??[]).length>1&&/\b(e|poi)\b/.test(after)}

type Tok={o:string,p:string}
const waNewTokens=(raw:string):Tok[]=>raw.replace(/€/g,' euro ').replace(/(\d)[,.](\d)/g,'$1\u0000$2').split(/[^\p{L}\p{N}\u0000']+/u).flatMap(w=>w.split("'")).filter(Boolean).map(w=>w.replace('\u0000','.')).map(o=>({o,p:waNewFold(o)}))
const waNewValue=(p:string)=>/^\d+(?:\.\d{1,2})?$/.test(p)?Number(p):p in waNewNumbers?waNewNumbers[p]!:(/^[a-z]{5,}$/.test(p)?g9WordNumber(p):null)

/** Estrae categoria, prezzo e nome. `verbRequired=false` per la risposta a una domanda del bot. */
export function parseCreate(raw:string,sections:SectionRef[],verbRequired=true):CreateParse|null{
 if(verbRequired&&!startsWithCreate(raw))return null
 let t=waNewTokens(raw)
 // verbo e riempitivi iniziali
 const lead=new Set(['allora','ok','ciao','senti','mi','ci','puoi','potresti','vorrei','voglio','vorremmo','dobbiamo','devo','aggiungi','aggiungiamo','aggiungere','aggiungo','aggiungete','inserisci','inseriamo','inserire','inserisco','metti','mettiamo','crea','creiamo','nuovo','nuova','un','una','uno','piatto','piatti','nel','menu'])
 if(verbRequired&&t.length&&!lead.has(t[0]!.p)&&/^ag+i?u?n?g/.test(t[0]!.p))t=t.slice(1)
 // «una nuova pizza: ortolana» → categoria Pizze
 let early:string|null=null
 for(let i=0;i+1<t.length&&!early;i++)if(['nuovo','nuova'].includes(t[i]!.p))for(const s2 of sections){const sp=waNewTokens(s2.name).map(x=>x.p);if(sp.length===1&&[sp[0],sp[0]!.replace(/i$/,'o'),sp[0]!.replace(/e$/,'a')].includes(t[i+1]!.p)){early=s2.id;let from=i;while(from>0&&['un','una','uno'].includes(t[from-1]!.p))from--;t=[...t.slice(0,from),...t.slice(i+2)];break}}
 if(early)t=t.filter((x,k)=>!(k===0&&['aggiungi','aggiungiamo','aggiungere','inserisci','metti','mettiamo'].includes(x.p)))
 // «piatto di verifica» è un nome: «piatto» si toglie solo se non segue «di/del/della…»
 const filler=(k:number)=>/^piatt[oi]$/.test(t[k]!.p)?!['di','del','della','dei','delle','dello','al','alla','alle','ai'].includes(t[k+1]?.p??''):true
 if(verbRequired){while(t.length&&lead.has(t[0]!.p)&&filler(0))t=t.slice(1)}
 if(!verbRequired){const fill=new Set(['si','chiama','chiamalo','chiamala','mettilo','mettila','mettili','mettiamolo','mettiamola','costa','costano','viene','prezzo','il','la','lo','ok','allora','e','poi'])
  while(t.length&&fill.has(t[0]!.p)&&!(t[0]!.p==='costa'&&false))t=t.slice(1)}
 // prezzo: «che costa N euro», «a N euro», «N euro», «N€», «prezzo N», N finale
 let price:number|null=null
 for(let i=0;i<t.length;i++){const v=waNewValue(t[i]!.p);if(v===null)continue
  const euro=t[i+1]?.p==='euro'||t[i+1]?.p==='euri',before=t[i-1]?.p,cue=before==='costa'||before==='costano'||before==='prezzo'||before==='a'||before==='di',last=i===t.length-1||(euro&&i+1===t.length-1)
  if(!euro&&!cue&&!last)continue
  if(['un','una','uno'].includes(t[i]!.p)&&!euro)continue
  price=v;let from=i,to=i+(euro?2:1)
  if(t[to]?.p==='e'){const c=waNewValue(t[to+1]?.p??'');if(c!==null&&c<100&&Number.isInteger(c)){price=v+c/100;to+=2}}
  while(from>0&&['costa','costano','che','a','al','prezzo','di','viene','vengono','e'].includes(t[from-1]!.p))from--
  t=[...t.slice(0,from),...t.slice(to)];break}
 // categoria: «tra (i) X», «nella categoria X», «in/nei/nella X», tollerante a maiuscole e accenti
 let sectionId:string|null=early,unknownSection=false
 const preps=new Set(['tra','fra','in','nei','negli','nelle','nella','nel','nello','ai','agli','alle','al','categoria','sezione','nuova','nuovo'])
 const ordered=[...sections].sort((a,b)=>b.name.length-a.name.length)
 outer:for(let i=0;i<t.length&&!sectionId;i++){if(!preps.has(t[i]!.p))continue
  let j=i+1;while(['i','gli','le','la','il','lo','categoria','sezione','della','dei'].includes(t[j]?.p??''))j++
  for(const s of ordered){const sp=waNewTokens(s.name).map(x=>x.p);if(!sp.length)continue;const variants=[sp,sp.map(w=>w.replace(/i$/,'o')),sp.map(w=>w.replace(/e$/,'a'))]
   if(variants.some(v=>v.every((w,k)=>t[j+k]?.p===w))){sectionId=s.id;let from=i;while(from>0&&['tra','fra','nella','nel','una','un','uno'].includes(t[from-1]!.p))from--;t=[...t.slice(0,from),...t.slice(j+sp.length)];break outer}}
  if(['tra','fra','categoria','sezione'].includes(t[i]!.p)){unknownSection=true;t=t.slice(0,i);break}}
 if(!sectionId&&!unknownSection&&sections.length===1)sectionId=sections[0]!.id
 // nome: senza «il piatto», articoli iniziali e «che» finale
 const strip=new Set(['il','lo','la','l','un','una','uno','i','gli','le','piatto','che'])
 while(t.length&&strip.has(t[0]!.p)&&filler(0))t=t.slice(1)
 if(t[0]?.p==='chiamato'||(t[0]?.p==='si'&&t[1]?.p==='chiama'))t=t.slice(t[0]!.p==='si'?2:1)
 for(;;){const n=t.length;while(t.length&&['che','e','a','al','di','costa','con','nei','in','tra','grazie','mille','perfetto','ok','favore','piacere','cortesia'].includes(t.at(-1)!.p))t=t.slice(0,-1);if(t.length>=1&&t.at(-1)!.p==='per')t=t.slice(0,-1);if(t.length===n)break}
 const words2=t.map(x=>x.o).join(' ').trim(),name=words2?words2.charAt(0).toLocaleUpperCase('it')+words2.slice(1):null
 return {name,price,sectionId,unknownSection}
}

/** Unisce la risposta alla bozza: i pezzi nuovi completano o sostituiscono quelli mancanti. */
export function mergeDraft(draft:CreateDraft,next:CreateParse):CreateDraft{return {kind:'create_draft',name:draft.name??next.name,price:next.price??draft.price,sectionId:next.sectionId??draft.sectionId}}

/** Una sola domanda, nell'ordine: categoria (se più di una), prezzo, nome. */
export function createQuestion(d:CreateDraft,sections:SectionRef[],unknownSection=false){
 const piatto=d.name?`*${d.name}*`:'il piatto',list=sections.slice(0,15).map(s=>s.name).join(', ')
 if(!d.sectionId)return `${unknownSection?'Non trovo quella categoria. ':''}In quale categoria metto ${piatto}? Categorie: ${list}.`
 if(d.price===null)return `Quanto costa ${piatto}? Scrivimi il prezzo, per esempio «12 euro».`
 return `Come si chiama il piatto da aggiungere in *${sections.find(s=>s.id===d.sectionId)?.name??''}* a ${d.price.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})} €?`
}
export const draftComplete=(d:CreateDraft):d is CreateDraft&{name:string,price:number,sectionId:string}=>!!d.name&&d.price!==null&&!!d.sectionId

export type CreateStep={kind:'none'}|{kind:'unhide',id:string}|{kind:'ask',draft:CreateDraft,text:string}|{kind:'exists',name:string,section:string}|{kind:'create',action:{kind:'create',sectionId:string,name:string,price:number,description:null}}
/** Decide se il messaggio è un'aggiunta (verbo iniziale) o la risposta a una domanda di aggiunta in attesa.
 * Con una bozza in attesa, un messaggio riconosciuto come altro comando (finito, nascondi…) non è una risposta;
 * un «cambio prezzo» sì (è il caso «… che costa 12 euro» del vocale). */
export function createStep(text:string,draft:CreateDraft|null,sections:SectionRef[],refs:{id?:string,name:string,sectionId?:string|null,hidden?:boolean}[],otherIntent:(t:string)=>{kind:string}|null):CreateStep{
 const verbFirst=startsWithCreate(text)
 if(verbFirst&&createCompound(text))return{kind:'none'}
 if(!verbFirst){if(!draft||waNewNotCreate.test(waNewFold(text).replace(/[^a-z0-9]+/g,' ')))return{kind:'none'};const other=otherIntent(text);if(other&&other.kind!=='price')return{kind:'none'}}
 const parsed=parseCreate(text,sections,verbFirst)!
 // «metti nel menu il nuovo burger»: se il piatto esiste ed è nascosto, va mostrato (non aggiunto un doppione).
 if(parsed.name){const same=refs.filter(r=>waNewFold(r.name).trim()===waNewFold(parsed.name!).trim());if(same.length===1&&same[0]!.id){if(same[0]!.hidden)return{kind:'unhide',id:same[0]!.id};if(!draft&&!parsed.sectionId)return{kind:'exists',name:same[0]!.name,section:sections.find(s=>s.id===same[0]!.sectionId)?.name??''}}}
 const bare=!parsed.sectionId?sections.find(s=>waNewFold(s.name).replace(/[^a-z0-9]+/g,' ').trim()===waNewFold(text).replace(/[^a-z0-9]+/g,' ').trim()):undefined
 const d=mergeDraft(draft??{kind:'create_draft',name:null,price:null,sectionId:null},bare?{name:null,price:null,sectionId:bare.id,unknownSection:false}:parsed)
 if(!draftComplete(d))return{kind:'ask',draft:d,text:createQuestion(d,sections,parsed.unknownSection&&!d.sectionId)}
 const wordsOf=(x:string)=>waNewFold(x).replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(w=>w&&!['il','la','lo','i','gli','le','di','al','alla','alle','ai','con','e'].includes(w)),mine=wordsOf(d.name)
 const twin=refs.find(r=>r.sectionId===d.sectionId&&(waNewFold(r.name).trim()===waNewFold(d.name).trim()||(mine.length>0&&mine.some(w=>w.length>=5&&!['pasta','pizza','spaghetti'].includes(w))&&mine.every(w=>wordsOf(r.name).includes(w)))))
 if(twin)return{kind:'exists',name:twin.name,section:sections.find(s=>s.id===d.sectionId)?.name??''}
 return{kind:'create',action:{kind:'create',sectionId:d.sectionId,name:d.name,price:d.price,description:null}}
}

/** Memoria dell'ultima modifica applicata (`last:<telefono>`, 10 minuti). Dopo «scusa/no/anzi» o «anche» il resto deve
 * essere SOLO un nome di piatto (eventualmente con un prezzo): se contiene un verbo o una parola d'azione è un comando
 * nuovo e segue il flusso normale (round 2, 16/10).
 * - «anche la lasagna» / «scusa, anche la lasagna»: stessa modifica su un altro piatto, senza annullare la prima;
 * - «anche la cotoletta a 12» dopo una promo: promo a 12 (mai il prezzo pieno); dopo un prezzo: prezzo;
 * - «no scusa 14»: corregge il valore della modifica appena fatta (prezzo o promo);
 * - «scusa no era la lasagna»: annulla la modifica precedente e la applica al piatto giusto, in una sola pubblicazione;
 * - «no aspetta, lascia stare», «annulla l'ultima»: annulla l'ultima modifica. */
export type LastApplied={kind:'last',actions:MenuAction[],undo:MenuAction[]}
type WaItem={price:number,tags?:string[],available?:boolean,hidden?:boolean,featured?:boolean,promo?:{price:number,until?:string|null}|null,scarcity?:{lastPortions?:boolean,onlyToday?:string|null}|null}
export function undoFor(actions:MenuAction[],itemOf:(id:string)=>WaItem|undefined):MenuAction[]|null{const out:MenuAction[]=[]
 for(const a of actions){const r='id' in a?itemOf(a.id):undefined;if(!r||!('id' in a))return null
  if(a.kind==='price')out.push({kind:'price',id:a.id,price:r.price});else if(a.kind==='available')out.push({kind:'available',id:a.id,value:r.available!==false});else if(a.kind==='hidden')out.push({kind:'hidden',id:a.id,value:!!r.hidden});else if(a.kind==='featured')out.push({kind:'featured',id:a.id,value:!!r.featured})
  else if(a.kind==='promo')out.push({kind:'promo',id:a.id,price:r.promo?.price??null,until:r.promo?.until??null} as MenuAction)
  else if(a.kind==='tag')out.push({kind:'tag',id:a.id,tag:a.tag,value:(r.tags??[]).includes(a.tag)})
  else if(a.kind==='scarcity'){const label=(a as any).label;out.push({kind:'scarcity',id:a.id,label,value:label==='lastPortions'?!!r.scarcity?.lastPortions:!!r.scarcity?.onlyToday} as MenuAction)}else return null}
 return out}
const waNewAction=/\b(finit\w*|esaurit\w*|evidenza|nascond\w*|togli\w*|leva|mostra|rimetti|costa|costano|prezzo|metti\w*|porta\w*|promo\w*|offert\w*|disponibil\w*|tornat\w*|aggiung\w*|scriv\w*|ultime|porzion\w*|oggi|piccant\w*|vegan\w*|vegetarian\w*|cambia|chiama\w*|sposta\w*|foto|descrizione)\b/
const waNewRevert=/^(?:(?:no|scusa|aspetta|anzi|ok)\s+)*(?:aspetta\s+)?(?:lascia stare|lascia perdere|annulla l ultima(?: modifica)?|annulla (?:quello|questo|quella|questa)|torna come prima|torna com era|rimetti come prima|annulla la modifica(?: di prima)?)(?:\s+(?:il prezzo (?:del|della|dello|dei|delle|di)\s+|l etichetta (?:del|della|di)\s+)?(.+))?$/
/** undefined = non è un annullamento; '' = annullamento senza piatto; altrimenti il piatto nominato. */
export function revertTarget(text:string):string|undefined{const t=waNewFold(text).replace(/[^a-z0-9]+/g,' ').trim(),m=t.match(waNewRevert);if(!m)return undefined;if(m[1]&&waNewAction.test(m[1]))return undefined;return (m[1]??'').replace(/^(?:il|la|lo|l|i|gli|le)\s+/,'').trim()}
export function followUp(text:string,last:LastApplied,refs:MenuRef[],ageMs=0,today?:string):MenuAction[]|{reply:string}|null{
 const t=waNewFold(text).replace(/(\d)[,.](\d)/g,'$1.$2').replace(/[^a-z0-9.]+/g,' ').trim()
 const revert=revertTarget(text)
 if(revert!==undefined){
  if(!revert){if(ageMs>600000||!last.undo.length)return{reply:'Non c\'è un\'ultima modifica recente da annullare. Dimmi cosa vuoi cambiare.'};return last.undo}
  const ids=new Set(findDishes(revert,refs).map(r=>r.id)),undo=last.undo.filter(a=>'id' in a&&ids.has(a.id))
  if(!undo.length)return{reply:`Non ho una modifica recente su *${revert}* da annullare. Dimmi cosa vuoi, per esempio «${revert} è di nuovo disponibile».`}
  return undo}
 if(ageMs>600000)return null
 if(last.actions.length!==1)return null;const prev=last.actions[0]!;if(!('id' in prev))return null
 const lead=t.match(/^((?:(?:no|scusa|scusami|anzi|ops|pardon|aspetta|ancora|errore|sbagliato|volevo dire|intendevo|e|anche|pure|era|non)\s+)+)(.*)$/)
 if(!lead)return null
 const words=lead[1]!.trim().split(/\s+/),also=words.includes('anche')||words.includes('pure'),correction=words.some(w=>['no','scusa','scusami','anzi','ops','pardon','errore','sbagliato','volevo','intendevo','era'].includes(w))
 const rest=lead[2]!.replace(/^(?:(?:il|la|lo|l|i|gli|le|per|quello|quella|dire)\s+)+/,'').trim()
 // «no scusa fino a sabato» dopo una promo: cambia solo la scadenza.
 if(prev.kind==='promo'&&today&&/^(?:fino|sino|entro|solo|per)\b/.test(rest)){const until=resolveUntil(rest,today);return until?[{...prev,until} as MenuAction]:{reply:'Non ho capito *fino a quando* vale la promo. Scrivi per esempio «fino a domenica» o «fino al 20/10». Non ho cambiato nulla.'}}
 if(waNewAction.test(rest))return null
 const n=rest.match(/^(?:(.*?)\s+)?(?:a\s+)?(\d+(?:\.\d{1,2})?)(?:\s*euro)?$/),name=(n?n[1]??'':rest).trim(),value=n?Number(n[2]):null
 const priced=(id:string)=>prev.kind==='price'&&value!==null?{kind:'price',id,price:value} as MenuAction:prev.kind==='promo'&&value!==null?{...prev,id,price:value} as MenuAction:value===null?{...prev,id} as MenuAction:null
 if(!name){if(!correction||value===null)return null;return prev.kind==='price'||prev.kind==='promo'?[priced(prev.id)!]:null}
 const hits=findDishes(name,refs).filter(r=>r.id!==prev.id);if(hits.length!==1)return null
 const next=priced(hits[0]!.id);if(!next)return null
 // «anche la cotoletta a 12» dopo una promo: mai il prezzo pieno; si chiede conferma della promo.
 if(also&&prev.kind==='promo'&&value!==null){const nm=hits[0]!.name;return{reply:`Vuoi mettere *${nm}* in *promo* a *${value.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})} €*? Scrivimi «${nm.toLowerCase()} in promo a ${value}». Non ho cambiato nulla.`}}
 if(also)return[next]
 if(correction)return[...last.undo,next]
 return null}

/** «la pizza», «il dolce»: il bersaglio è solo il nome (singolare o plurale) di una categoria con più piatti → i suoi piatti. */
export function categoryWordItems(target:string,refs:MenuRef[]):MenuRef[]|null{
 const w=waNewFold(target).replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(x=>x&&!['il','la','lo','l','i','gli','le','un','una','uno'].includes(x));if(w.length!==1)return null
 const word=w[0]!,variants=(s:string)=>{const p=waNewFold(s).replace(/[^a-z0-9]+/g,' ').trim();return[p,p.replace(/i$/,'o'),p.replace(/e$/,'a'),p.replace(/i$/,'e')]}
 const items=refs.filter(r=>r.section&&variants(r.section).includes(word));return items.length>1?items:null}
