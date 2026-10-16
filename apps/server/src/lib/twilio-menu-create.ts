/** Aggiunta di un piatto dal bot WhatsApp del titolare, senza IA (16/10/2026).
 * Un messaggio che inizia con un verbo di aggiunta è SEMPRE un'aggiunta (mai un cambio prezzo):
 * «aggiungi tra piatti di prova il piatto pasta al ragù che costa 12 euro» → categoria, nome, prezzo.
 * Se manca qualcosa il bot fa UNA domanda e salva la bozza come proposta `create_draft` (10 minuti):
 * il messaggio successivo, testo o vocale, completa la bozza anche se riscritto per intero. */
import type {SectionRef,MenuRef,MenuAction} from './twilio-menu-ai.js'
import {findDishes} from './twilio-menu-nlu.js'

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
const waNewValue=(p:string)=>/^\d+(?:\.\d{1,2})?$/.test(p)?Number(p):p in waNewNumbers?waNewNumbers[p]!:null

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

export type CreateStep={kind:'none'}|{kind:'ask',draft:CreateDraft,text:string}|{kind:'exists',name:string,section:string}|{kind:'create',action:{kind:'create',sectionId:string,name:string,price:number,description:null}}
/** Decide se il messaggio è un'aggiunta (verbo iniziale) o la risposta a una domanda di aggiunta in attesa.
 * Con una bozza in attesa, un messaggio riconosciuto come altro comando (finito, nascondi…) non è una risposta;
 * un «cambio prezzo» sì (è il caso «… che costa 12 euro» del vocale). */
export function createStep(text:string,draft:CreateDraft|null,sections:SectionRef[],refs:{name:string,sectionId?:string|null}[],otherIntent:(t:string)=>{kind:string}|null):CreateStep{
 const verbFirst=startsWithCreate(text)
 if(verbFirst&&createCompound(text))return{kind:'none'}
 if(!verbFirst){if(!draft||waNewNotCreate.test(waNewFold(text).replace(/[^a-z0-9]+/g,' ')))return{kind:'none'};const other=otherIntent(text);if(other&&other.kind!=='price')return{kind:'none'}}
 const parsed=parseCreate(text,sections,verbFirst)!
 const bare=!parsed.sectionId?sections.find(s=>waNewFold(s.name).replace(/[^a-z0-9]+/g,' ').trim()===waNewFold(text).replace(/[^a-z0-9]+/g,' ').trim()):undefined
 const d=mergeDraft(draft??{kind:'create_draft',name:null,price:null,sectionId:null},bare?{name:null,price:null,sectionId:bare.id,unknownSection:false}:parsed)
 if(!draftComplete(d))return{kind:'ask',draft:d,text:createQuestion(d,sections,parsed.unknownSection&&!d.sectionId)}
 const wordsOf=(x:string)=>waNewFold(x).replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(w=>w&&!['il','la','lo','i','gli','le','di','al','alla','alle','ai','con','e'].includes(w)),mine=wordsOf(d.name)
 const twin=refs.find(r=>r.sectionId===d.sectionId&&(waNewFold(r.name).trim()===waNewFold(d.name).trim()||(mine.length>0&&mine.some(w=>w.length>=5&&!['pasta','pizza','spaghetti'].includes(w))&&mine.every(w=>wordsOf(r.name).includes(w)))))
 if(twin)return{kind:'exists',name:twin.name,section:sections.find(s=>s.id===d.sectionId)?.name??''}
 return{kind:'create',action:{kind:'create',sectionId:d.sectionId,name:d.name,price:d.price,description:null}}
}

/** Memoria dell'ultima modifica applicata (proposta `last`, 10 minuti): «anche la lasagna», «no scusa 14»,
 * «scusa no era la lasagna» (annulla la precedente e applica quella giusta, in una sola pubblicazione). */
export type LastApplied={kind:'last',actions:MenuAction[],undo:MenuAction[]}
export function undoFor(actions:MenuAction[],refs:MenuRef[]):MenuAction[]|null{const out:MenuAction[]=[]
 for(const a of actions){const r='id' in a?refs.find(x=>x.id===a.id):undefined;if(!r)return null
  if(a.kind==='price')out.push({kind:'price',id:r.id,price:r.price});else if(a.kind==='available')out.push({kind:'available',id:r.id,value:r.available!==false});else if(a.kind==='hidden')out.push({kind:'hidden',id:r.id,value:!!r.hidden});else if(a.kind==='featured')out.push({kind:'featured',id:r.id,value:!!(r as any).featured});else return null}
 return out}
export function followUp(text:string,last:LastApplied,refs:MenuRef[]):MenuAction[]|null{
 if(last.actions.length!==1)return null;const prev=last.actions[0]!;if(!('id' in prev))return null
 const t=waNewFold(text).replace(/(\d)[,.](\d)/g,'$1.$2').replace(/[^a-z0-9.]+/g,' ').trim()
 const also=t.match(/^(?:e )?anche (?:per )?(.+)$/)
 if(also&&!/\d/.test(also[1]!)){const hits=findDishes(also[1]!,refs).filter(r=>r.id!==prev.id);return hits.length===1?[{...prev,id:hits[0]!.id} as MenuAction]:null}
 if(!/^(?:no|scusa|scusami|anzi|ops|pardon|errore|sbagliato|mi sono sbagliat\w*|volevo dire)\b/.test(t))return null
 const rest=t.replace(/^(?:(?:no|scusa|scusami|anzi|ops|pardon|errore|sbagliato|mi sono sbagliat\w*|volevo dire|era|e|intendevo|il|la|lo|i|gli|le|non)\s+)+/,'')
 const n=rest.match(/^(\d+(?:\.\d{1,2})?)(?:\s*euro)?$/)
 if(n){if(prev.kind!=='price')return null;return[{kind:'price',id:prev.id,price:Number(n[1])}]}
 if(!rest||/\d/.test(rest))return null
 const hits=findDishes(rest,refs).filter(r=>r.id!==prev.id);if(hits.length!==1)return null
 return[...last.undo,{...prev,id:hits[0]!.id} as MenuAction]}
