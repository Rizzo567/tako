/** Aggiunta di un piatto dal bot WhatsApp del titolare, senza IA (16/10/2026).
 * Un messaggio che inizia con un verbo di aggiunta è SEMPRE un'aggiunta (mai un cambio prezzo):
 * «aggiungi tra piatti di prova il piatto pasta al ragù che costa 12 euro» → categoria, nome, prezzo.
 * Se manca qualcosa il bot fa UNA domanda e salva la bozza come proposta `create_draft` (10 minuti):
 * il messaggio successivo, testo o vocale, completa la bozza anche se riscritto per intero. */
import type {SectionRef} from './twilio-menu-ai.js'

export type CreateDraft={kind:'create_draft',name:string|null,price:number|null,sectionId:string|null}
export type CreateParse={name:string|null,price:number|null,sectionId:string|null,unknownSection:boolean}

const waNewFold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
const waNewNumbers:Record<string,number>={zero:0,uno:1,un:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,ventuno:21,ventidue:22,ventitre:23,ventiquattro:24,venticinque:25,trenta:30,trentacinque:35,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90,cento:100}
const waNewVerb=/^(?:(?:allora|ok|ciao|senti)\s+)?(?:aggiung\w*|inserisc\w*|inserire|(?:metti|mettiamo|crea|creiamo)\s+(?:un\s+)?nuov[oa]\s+piatt[oi]|(?:un\s+)?nuov[oa]\s+piatt[oi])\b/
/** Inizia con un verbo di aggiunta? */
export const startsWithCreate=(raw:string)=>waNewVerb.test(waNewFold(raw).replace(/[^a-z0-9]+/g,' ').trim())

type Tok={o:string,p:string}
const waNewTokens=(raw:string):Tok[]=>raw.replace(/€/g,' euro ').replace(/(\d)[,.](\d)/g,'$1\u0000$2').split(/[^\p{L}\p{N}\u0000']+/u).flatMap(w=>w.split("'")).filter(Boolean).map(w=>w.replace('\u0000','.')).map(o=>({o,p:waNewFold(o)}))
const waNewValue=(p:string)=>/^\d+(?:\.\d{1,2})?$/.test(p)?Number(p):p in waNewNumbers?waNewNumbers[p]!:null

/** Estrae categoria, prezzo e nome. `verbRequired=false` per la risposta a una domanda del bot. */
export function parseCreate(raw:string,sections:SectionRef[],verbRequired=true):CreateParse|null{
 if(verbRequired&&!startsWithCreate(raw))return null
 let t=waNewTokens(raw)
 // verbo e riempitivi iniziali
 const lead=new Set(['allora','ok','ciao','senti','aggiungi','aggiungiamo','aggiungere','aggiungo','aggiungete','inserisci','inseriamo','inserire','inserisco','metti','mettiamo','crea','creiamo','nuovo','nuova','un','una','uno','piatto','piatti'])
 // «piatto di verifica» è un nome: «piatto» si toglie solo se non segue «di/del/della…»
 const filler=(k:number)=>/^piatt[oi]$/.test(t[k]!.p)?!['di','del','della','dei','delle','dello','al','alla','alle','ai'].includes(t[k+1]?.p??''):true
 if(verbRequired){while(t.length&&lead.has(t[0]!.p)&&filler(0))t=t.slice(1)}
 // prezzo: «che costa N euro», «a N euro», «N euro», «N€», «prezzo N», N finale
 let price:number|null=null
 for(let i=0;i<t.length;i++){const v=waNewValue(t[i]!.p);if(v===null)continue
  const euro=t[i+1]?.p==='euro'||t[i+1]?.p==='euri',before=t[i-1]?.p,cue=before==='costa'||before==='costano'||before==='prezzo'||before==='a'||before==='di',last=i===t.length-1||(euro&&i+1===t.length-1)
  if(!euro&&!cue&&!last)continue
  if(['un','una','uno'].includes(t[i]!.p)&&!euro)continue
  price=v;let from=i,to=i+(euro?2:1)
  while(from>0&&['costa','costano','che','a','al','prezzo','di','viene','vengono','e'].includes(t[from-1]!.p))from--
  t=[...t.slice(0,from),...t.slice(to)];break}
 // categoria: «tra (i) X», «nella categoria X», «in/nei/nella X», tollerante a maiuscole e accenti
 let sectionId:string|null=null,unknownSection=false
 const preps=new Set(['tra','fra','in','nei','negli','nelle','nella','nel','nello','categoria','sezione'])
 const ordered=[...sections].sort((a,b)=>b.name.length-a.name.length)
 outer:for(let i=0;i<t.length;i++){if(!preps.has(t[i]!.p))continue
  let j=i+1;while(['i','gli','le','la','il','lo','categoria','sezione','della','dei'].includes(t[j]?.p??''))j++
  for(const s of ordered){const sp=waNewTokens(s.name).map(x=>x.p);if(!sp.length)continue;const variants=[sp,sp.map(w=>w.replace(/i$/,'o'))]
   if(variants.some(v=>v.every((w,k)=>t[j+k]?.p===w))){sectionId=s.id;let from=i;while(from>0&&['tra','fra','nella','nel'].includes(t[from-1]!.p))from--;t=[...t.slice(0,from),...t.slice(j+sp.length)];break outer}}
  if(['tra','fra','categoria','sezione'].includes(t[i]!.p)){unknownSection=true;t=t.slice(0,i);break}}
 if(!sectionId&&!unknownSection&&sections.length===1)sectionId=sections[0]!.id
 // nome: senza «il piatto», articoli iniziali e «che» finale
 const strip=new Set(['il','lo','la','l','un','una','uno','i','gli','le','piatto','che'])
 while(t.length&&strip.has(t[0]!.p)&&filler(0))t=t.slice(1)
 if(t[0]?.p==='chiamato'||(t[0]?.p==='si'&&t[1]?.p==='chiama'))t=t.slice(t[0]!.p==='si'?2:1)
 while(t.length&&['che','e','a','al','di','costa','con','nei','in','tra'].includes(t.at(-1)!.p))t=t.slice(0,-1)
 const words2=t.map(x=>x.o).join(' ').trim(),name=words2?words2.charAt(0).toLocaleUpperCase('it')+words2.slice(1):null
 return {name,price,sectionId,unknownSection}
}

/** Unisce la risposta alla bozza: i pezzi nuovi completano o sostituiscono quelli mancanti. */
export function mergeDraft(draft:CreateDraft,next:CreateParse):CreateDraft{return {kind:'create_draft',name:next.name??draft.name,price:next.price??draft.price,sectionId:next.sectionId??draft.sectionId}}

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
 if(!verbFirst){if(!draft)return{kind:'none'};const other=otherIntent(text);if(other&&other.kind!=='price')return{kind:'none'}}
 const parsed=parseCreate(text,sections,verbFirst)!
 const bare=!parsed.sectionId?sections.find(s=>waNewFold(s.name).replace(/[^a-z0-9]+/g,' ').trim()===waNewFold(text).replace(/[^a-z0-9]+/g,' ').trim()):undefined
 const d=mergeDraft(draft??{kind:'create_draft',name:null,price:null,sectionId:null},bare?{name:null,price:null,sectionId:bare.id,unknownSection:false}:parsed)
 if(!draftComplete(d))return{kind:'ask',draft:d,text:createQuestion(d,sections,parsed.unknownSection&&!d.sectionId)}
 const twin=refs.find(r=>r.sectionId===d.sectionId&&waNewFold(r.name).trim()===waNewFold(d.name).trim())
 if(twin)return{kind:'exists',name:twin.name,section:sections.find(s=>s.id===d.sectionId)?.name??''}
 return{kind:'create',action:{kind:'create',sectionId:d.sectionId,name:d.name,price:d.price,description:null}}
}
