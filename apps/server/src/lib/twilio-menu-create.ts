/** Aggiunta di un piatto dal bot WhatsApp del titolare, senza IA (16/10/2026).
 * Un messaggio che inizia con un verbo di aggiunta è SEMPRE un'aggiunta (mai un cambio prezzo):
 * «aggiungi tra piatti di prova il piatto pasta al ragù che costa 12 euro» → categoria, nome, prezzo.
 * Se manca qualcosa il bot fa UNA domanda e salva la bozza come proposta `create_draft` (10 minuti):
 * il messaggio successivo, testo o vocale, completa la bozza anche se riscritto per intero. */
import type {SectionRef,MenuRef,MenuAction} from './twilio-menu-ai.js'
import {findDishes} from './twilio-menu-nlu.js'
import {g9WordNumber} from './twilio-menu-ai.js'
import {resolveUntil} from './menu-sales.js'
import {categoryItems} from './twilio-menu-sales.js'

// 17/10 (correzioni A1/A3): `names` = «X e Y» che può essere due piatti (`split` null = da chiedere, true = due, false = uno solo),
// `prices` = prezzo per ciascuno; `sectionName` = categoria chiesta che nel menu non c'è (si chiede dove metterlo).
export type CreateDraft={kind:'create_draft',name:string|null,price:number|null,sectionId:string|null,names?:string[],split?:boolean|null,prices?:(number|null)[],sectionName?:string|null,newSection?:boolean}
export type CreateParse={name:string|null,price:number|null,sectionId:string|null,unknownSection:boolean,sectionName?:string|null,sectionNew?:boolean}

const waNewFold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
const waNewNumbers:Record<string,number>={zero:0,uno:1,un:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,ventuno:21,ventidue:22,ventitre:23,ventiquattro:24,venticinque:25,trenta:30,trentacinque:35,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90,cento:100}
const waNewVerb=/^(?:(?:allora|ok|ciao|senti|mi|ci|puoi|potresti|vorrei|voglio|vorremmo|dobbiamo|devo)\s+)*(?:aggiung\w*|aggiun\w*|aggin\w*|agiung\w*|inserisc\w*|inserire|(?:metti|mettiamo|crea|creiamo)\s+(?:nel\s+menu|(?:un[oa]?\s+)?nuov[oa]\s+\w+)|(?:un[oa]?\s+)?nuov[oa]\s+(?:piatt[oi]|pizz[ae]|dolc[ei]|antipast[oi]|prim[oi]|second[oi]|bibit[ae])\b)\b/
/** Inizia con un verbo di aggiunta? */
const waNewNotCreate=/\b(descrizion\w*|foto|immagin\w*|allergen\w*|del giorno|di oggi|in evidenza|etichett\w*|promo\w*|offert\w*)\b/
// Frase composta («… a 12 e la carbonara è finita», «… e tra i secondi …»): resta al percorso di sempre (IA con validatore).
const waNewCompound=/\b(e|poi|anche)\s+(tra|fra|nei|negli|nelle|nella|nel|in|aggiung\w*|metti\w*|togli\w*|nascond\w*|il|la|lo|i|gli|le)\b.*\b(\d|finit\w*|esaurit\w*|euro|costa)/
export const startsWithCreate=(raw:string)=>{const t=waNewFold(raw).replace(/[^a-z0-9]+/g,' ').trim();return waNewVerb.test(t)&&!waNewNotCreate.test(t)}
export const createCompound=(raw:string)=>{const t=waNewFold(raw).replace(/(\d)[,.](\d)/g,'$1.$2').replace(/[^a-z0-9.]+/g,' ').trim();const after=t.replace(/^.*?\d+(?:\.\d+)?( euro)?/,'');return waNewCompound.test(' '+after)||(t.match(/\d+(?:\.\d+)?\s*(?:euro)?/g)??[]).length>1&&/\b(e|poi)\b/.test(after)}

// `ap` = apostrofo dopo la parola («L'arrosto»): il nome del piatto lo conserva (QA 17/10).
type Tok={o:string,p:string,ap?:string}
const waNewTokens=(raw:string):Tok[]=>raw.replace(/€/g,' euro ').replace(/(\d)([,.])(\d)/g,(_a,x,sep,y)=>x+(sep===','?'\u0001':'\u0000')+y).split(/[^\p{L}\p{N}\u0000\u0001'’]+/u).flatMap(w=>{const parts=w.split(/(['’])/),out:{w:string,ap?:string}[]=[];for(let i=0;i<parts.length;i+=2)if(parts[i])out.push({w:parts[i]!,...(parts[i+1]?{ap:parts[i+1]}:{})});return out}).map(({w,ap})=>({o:w.replace('\u0000','.').replace('\u0001',','),p:waNewFold(w.replace(/[\u0000\u0001]/,'.')),...(ap?{ap}:{})}))
const waNewValue=(p:string)=>/^\d+(?:\.\d{1,2})?$/.test(p)?Number(p):p in waNewNumbers?waNewNumbers[p]!:(/^[a-z]{5,}$/.test(p)?g9WordNumber(p):null)

/** Estrae categoria, prezzo e nome. `verbRequired=false` per la risposta a una domanda del bot. */
export function parseCreate(raw:string,sections:SectionRef[],verbRequired=true):CreateParse|null{
 if(verbRequired&&!startsWithCreate(raw))return null
 // Nome tra virgolette («Piatto test QA», "Pasta della nonna"): preso così com'è, il resto dà categoria e prezzo (QA 17/10).
 const quoted=raw.match(/[«“"]\s*([^«»“”"]{2,120}?)\s*[»”"]/),quotedName=quoted?quoted[1]!.replace(/\s+/g,' ').trim():null
 if(quoted)raw=raw.slice(0,quoted.index!)+' '+raw.slice(quoted.index!+quoted[0].length)
 let t=waNewTokens(raw)
 // 17/10 (A3.1): formule di cortesia mai nel nome («mi aggiungi per favore la pasta alla norma» → «Pasta alla norma»).
 t=t.filter((x,k,a)=>!(x.p==='per'&&COURTESY.has(a[k+1]?.p??''))&&!(COURTESY.has(x.p)&&a[k-1]?.p==='per')&&!['gentilmente','cortesemente'].includes(x.p))
 // verbo e riempitivi iniziali (anche le forme sentite nei vocali: «Inserisce il piatto…», «voglio che aggiunga…»)
 const lead=new Set(['allora','ok','ciao','senti','mi','ci','puoi','potresti','potete','riesci','ad','vorrei','voglio','vorremmo','dobbiamo','devo','devi','dovresti','fammi','che','tu','aggiungi','aggiungiamo','aggiungere','aggiungo','aggiungete','aggiunga','aggiungessi','aggiungimi','aggiungeresti','inserisci','inseriamo','inserire','inserisco','inserisce','inserite','inseriscimi','inserirei','metti','mettiamo','mettimi','metteresti','crea','creiamo','nuovo','nuova','un','una','uno','piatto','piatti','nel','menu'])
 if(verbRequired&&t.length&&!lead.has(t[0]!.p)&&/^(?:ag+i?u?n?g|inseri)/.test(t[0]!.p))t=t.slice(1)
 // «una nuova pizza: ortolana» → categoria Pizze
 let early:string|null=null
 for(let i=0;i+1<t.length&&!early;i++)if(['nuovo','nuova'].includes(t[i]!.p))for(const s2 of sections){const sp=waNewTokens(s2.name).map(x=>x.p);if(sp.length===1&&[sp[0],sp[0]!.replace(/i$/,'o'),sp[0]!.replace(/e$/,'a')].includes(t[i+1]!.p)){early=s2.id;let from=i;while(from>0&&['un','una','uno'].includes(t[from-1]!.p))from--;t=[...t.slice(0,from),...t.slice(i+2)];break}}
 if(early)t=t.filter((x,k)=>!(k===0&&['aggiungi','aggiungiamo','aggiungere','inserisci','metti','mettiamo'].includes(x.p)))
 // «piatto di verifica» è un nome: «piatto» si toglie solo se non segue «di/del/della…»
 const filler=(k:number)=>/^piatt[oi]$/.test(t[k]!.p)?!['di','del','della','dei','delle','dello','al','alla','alle','ai'].includes(t[k+1]?.p??''):true
 // «il piatto» introduttivo si toglie UNA volta sola: «il piatto Piatto test QA» → «Piatto test QA» (QA 17/10, caso 4).
 // «Piatto test QA» scritto con la maiuscola e senza articolo davanti è già il nome.
 let piattoGone=false,afterArticle=false
 const intro=(k:number)=>{if(!/^piatt[oi]$/.test(t[k]!.p))return true;if(piattoGone||(/^\p{Lu}/u.test(t[k]!.o)&&!afterArticle))return false;piattoGone=true;return true}
 if(verbRequired){while(t.length&&lead.has(t[0]!.p)&&filler(0)&&intro(0)){afterArticle=['un','una','uno','il'].includes(t[0]!.p);t=t.slice(1)}}
 if(!verbRequired){const fill=new Set(['si','chiama','chiamalo','chiamala','mettilo','mettila','mettili','mettiamolo','mettiamola','costa','costano','viene','prezzo','il','la','lo','ok','allora','e','poi'])
  while(t.length&&fill.has(t[0]!.p)&&!(t[0]!.p==='costa'&&false))t=t.slice(1)
  // «il piatto si chiama X», «il nome è X» (17/10).
  if(/^piatt[oi]$/.test(t[0]?.p??'')&&t[1]?.p==='si'&&t[2]?.p==='chiama')t=t.slice(3);else if(t[0]?.p==='nome'&&['e','è'].includes(t[1]?.p??''))t=t.slice(2)}
 // A7.3 (17/10, avversaria X): «al menu la burrata», «sul menu…», «nella lista…», «in carta…» in testa e code di cortesia,
 // di tempo o di posto in fondo («se puoi», «dai», «va bene?», «nel menu», «per stasera», «da domani», «subito», «grazie eh»)
 // non sono il nome del piatto.
 {const P=new Set(['al','sul','nel','nella','in','alla','nei','dentro']),W=new Set(['menu','carta','lista','listino','menù'])
  for(let k=0;k<3&&t.length>2;k++){if(P.has(t[0]!.p)&&W.has(t[1]!.p))t=t.slice(2);else if(t[0]!.p==='a'&&W.has(t[1]!.p))t=t.slice(2);else break}}
 t=stripTails(t)
 // prezzo: «che costa N euro», «a N euro», «N euro», «N€», «prezzo N», N finale
 let price:number|null=null
 for(let i=0;i<t.length;i++){const v=waNewValue(t[i]!.p);if(v===null)continue
  const euro=t[i+1]?.p==='euro'||t[i+1]?.p==='euri',before=t[i-1]?.p,cue=before==='costa'||before==='costano'||before==='prezzo'||before==='a'||before==='di',last=i===t.length-1||(euro&&i+1===t.length-1)
  const beforeSection=['tra','fra','nei','negli','nelle','nella','nel','in'].includes(t[i+1]?.p??'')&&/^\d/.test(t[i]!.p)&&i>0
  if(!euro&&!cue&&!last&&!beforeSection)continue
  if(['un','una','uno'].includes(t[i]!.p)&&!euro)continue
  price=v;let from=i,to=i+(euro?2:1)
  // Centesimi solo dalle forme esplicite («12 e 50», «dodici e cinquanta» in fondo o prima di euro/centesimi): «20 euro e uno»
  // non è 20,01 (A2.1, 17/10).
  if(t[to]?.p==='e'){const c=waNewValue(t[to+1]?.p??'');const after=t[to+2]?.p;if(c!==null&&c>=10&&c<100&&Number.isInteger(c)&&(after===undefined||['euro','centesimi','cent'].includes(after)||preps0.has(after))){price=v+c/100;to+=2;if(['euro','centesimi','cent'].includes(t[to]?.p??''))to++}}
  while(from>0&&['costa','costano','che','a','al','prezzo','di','viene','vengono','e'].includes(t[from-1]!.p))from--
  t=[...t.slice(0,from),...t.slice(to)];break}
 // categoria: «tra (i) X», «nella categoria X», «in/nei/nella X», tollerante a maiuscole e accenti
 let sectionId:string|null=early,unknownSection=false,sectionName:string|null=null,sectionNew=false
 const preps=new Set(['tra','fra','in','nei','negli','nelle','nella','nel','nello','ai','agli','alle','al','categoria','sezione','nuova','nuovo'])
 const ordered=[...sections].sort((a,b)=>b.name.length-a.name.length)
 outer:for(let i=0;i<t.length&&!sectionId;i++){if(!preps.has(t[i]!.p))continue
  let j=i+1;while(['i','gli','le','la','il','lo','categoria','sezione','della','dei'].includes(t[j]?.p??''))j++
  for(const s of ordered){const sp=waNewTokens(s.name).map(x=>x.p);if(!sp.length)continue;const variants=[sp,sp.map(w=>w.replace(/i$/,'o')),sp.map(w=>w.replace(/e$/,'a'))]
   if(variants.some(v=>v.every((w,k)=>t[j+k]?.p===w))){sectionId=s.id;let from=i;while(from>0&&['tra','fra','nella','nel','una','un','uno'].includes(t[from-1]!.p))from--;t=[...t.slice(0,from),...t.slice(j+sp.length)];break outer}}
  // 17/10 (A3.2): categoria che nel menu non c'è («nei primi pasti», «in una categoria nuova che si chiama speciali», «tra i
  // primi»): le sue parole escono dal nome e diventano la categoria richiesta; il nome del piatto resta.
  const u=unknownSectionAt(t,i);if(u){unknownSection=true;sectionName=u.name;sectionNew=u.explicit;t=[...t.slice(0,u.from),...t.slice(u.to)];break}
  if(['tra','fra','categoria','sezione'].includes(t[i]!.p)){unknownSection=true;t=t.slice(0,i);break}}
 if(!sectionId&&!unknownSection&&sections.length===1)sectionId=sections[0]!.id
 // nome: senza «il piatto», articoli iniziali e «che» finale
 const strip=new Set(['il','lo','la','l','un','una','uno','i','gli','le','piatto','che'])
 const article=/^(?:il|lo|la|l|un|una|uno|i|gli|le)$/
 afterArticle=false
 // Dopo la categoria un «piatto» senza articolo davanti fa parte del nome («nei piatti di prova piatto test qa»).
 // «un nuovo piatto: X» → X; «piatto Piatto della nonna» → il primo «piatto» è l'introduzione.
 const nuovoPiatto=()=>['nuovo','nuova'].includes(t[0]?.p??'')&&/^piatt[oi]$/.test(t[1]?.p??'')
 while(t.length&&(strip.has(t[0]!.p)||nuovoPiatto())&&filler(0)){if(nuovoPiatto()){t=t.slice(1);afterArticle=true;continue}if(piattoGone&&article.test(t[0]!.p)&&/^\p{Lu}/u.test(t[0]!.o))break;if(/^piatt[oi]$/.test(t[0]!.p)&&!afterArticle&&!piattoGone&&!/^piatt[oi]$/.test(t[1]?.p??''))break;if(!intro(0))break;afterArticle=article.test(t[0]!.p);t=t.slice(1)}
 if(t[0]?.p==='chiamato'||t[0]?.p==='chiamata'||(t[0]?.p==='si'&&t[1]?.p==='chiama'))t=t.slice(t[0]!.p==='si'?2:1)
 {const k=t.findIndex((x,i)=>i<=3&&(x.p==='chiamato'||x.p==='chiamata'||(['di','dal','col'].includes(x.p)&&t[i+1]?.p==='nome')));if(k>0)t=t.slice(k+(t[k]!.p.startsWith('chiamat')?1:2))}
 // «il piatto di nome X», «dal nome X», «che si chiama X»: l'introduzione non fa parte del nome.
 if(/^piatt[oi]$/.test(t[0]?.p??'')&&['di','dal','col','con'].includes(t[1]?.p??'')&&t[2]?.p==='nome')t=t.slice(3);else if(['di','dal','col'].includes(t[0]?.p??'')&&t[1]?.p==='nome')t=t.slice(2);else if(t[0]?.p==='che'&&t[1]?.p==='si'&&t[2]?.p==='chiama')t=t.slice(3)
 for(;;){const n=t.length;while(t.length&&['che','e','a','al','di','costa','con','nei','in','tra','grazie','mille','perfetto','ok','favore','piacere','cortesia'].includes(t.at(-1)!.p))t=t.slice(0,-1);if(t.length>=1&&t.at(-1)!.p==='per')t=t.slice(0,-1)
  // «lasagna a 20 euro e uno»: il resto «e uno» non è nome.
  if(t.length>=2&&['uno','una','un'].includes(t.at(-1)!.p)&&t.at(-2)!.p==='e')t=t.slice(0,-2);if(t.length===n)break}
 const words2=t.map((x,i)=>x.o+(i<t.length-1?x.ap??' ':'')).join('').trim()
 // «una bibita», «un piatto», «un dolce»: parola generica o nome della categoria → il nome manca e il bot lo chiede.
 const generic=(w:string)=>{const p=waNewFold(w).replace(/[^a-z0-9]+/g,' ').trim(),forms=(x:string)=>[x,x.replace(/i$/,'o'),x.replace(/e$/,'a'),x.replace(/i$/,'e')];return /^(?:piatt[oi]|bibit[ae]|bevand[ae]|dolc[ei]|prim[oi]|second[oi]|antipast[oi]|contorn[oi]|pizz[ae]|vin[oi]|cocktail|panin[oi]|cosa|roba|qualcosa)$/.test(p)||sections.some(s=>forms(waNewFold(s.name).replace(/[^a-z0-9]+/g,' ').trim()).includes(p))}
 const name=quotedName??(words2&&(piattoGone||!generic(words2))?words2.charAt(0).toLocaleUpperCase('it')+words2.slice(1):null)
 // A7.12 (M11): «aggiungi un dolce» → la categoria Dolci, si chiede solo il nome e il prezzo.
 if(!name&&words2&&!sectionId){const p0=waNewFold(words2).replace(/[^a-z0-9]+/g,' ').trim(),forms=(x:string)=>[x,x.replace(/i$/,'o'),x.replace(/e$/,'a'),x.replace(/i$/,'e')];const hit=sections.filter(s=>forms(waNewFold(s.name).replace(/[^a-z0-9]+/g,' ').trim()).includes(p0));if(hit.length===1)sectionId=hit[0]!.id}
 return {name,price,sectionId,unknownSection,...(sectionName?{sectionName}:{}),...(sectionName&&sectionNew?{sectionNew:true}:{})}
}

const COURTESY=new Set(['favore','piacere','cortesia'])
// Code da togliere dal fondo (in parole «piane»), dalla più lunga.
const TAILS=['ok grazie ciao','grazie mille','grazie eh','grazie','che ne dici','se puoi','se ce la fai','per favore','per piacere','per cortesia','va bene','va bene cosi','dai','ok','ciao','subito','adesso','ora','per stasera','per oggi','solo per oggi','solo oggi','da oggi','da domani','da stasera','da stasera in poi','da lunedi','nel menu','sul menu','nella carta','in carta','nel listino','al menu','nella lista','pure','anche','grazie ciao','perfetto'].map(x=>x.split(' ')).sort((a,b)=>b.length-a.length)
function stripTails(t:Tok[]):Tok[]{for(let guard=0;guard<6;guard++){
  // «… al menu del pranzo», «… nel menu di stasera»
  {const n=t.length;if(n>4&&['al','nel','sul','nella','in'].includes(t[n-4]!.p)&&['menu','carta','listino'].includes(t[n-3]!.p)&&['del','della','di','per'].includes(t[n-2]!.p)){t=t.slice(0,n-4);continue}}const hit=TAILS.find(w=>w.length<t.length&&w.every((x,k)=>t[t.length-w.length+k]!.p===x));if(!hit)break;t=t.slice(0,t.length-hit.length)}return t}
const preps0=new Set(['tra','fra','in','nei','negli','nelle','nella','nel'])
// Parole che indicano una categoria anche se nel menu non c'è (17/10, A3.2).
const CAT_WORDS=/^(?:prim[oi]|second[oi]|antipast[oi]|dolc[ei]|dessert|contorn[oi]|pizz[ae]|special[ei]|specialita|bibit[ae]|bevand[ae]|insalat[ae]|panin[oi]|fritt[oi]|frittur[ae]|vin[oi]|birr[ae]|cocktail|aperitiv[oi]|burger|hamburger|crud[oi]|grigliat[ae]|carn[ei]|pesc[ei]|zupp[ae]|focacc[ei]\w*|piadin[ae]|novita|proposte)$/
const SEC_NAME_STOP=new Set(['con','e','il','la','lo','i','gli','le','a','al','che','costa','dentro','prezzo','euro'])
/** Categoria richiesta che nel menu non c'è, a partire dalla preposizione in posizione i. null = nessuna. */
function unknownSectionAt(t:Tok[],i:number):{from:number,to:number,name:string,explicit:boolean}|null{
 const p=t[i]!.p;let k=i+1
 const skip=()=>{while(['i','gli','le','la','il','lo','l','una','un','uno','altra','altro','nuova','nuovo','della','dei'].includes(t[k]?.p??''))k++}
 skip();let named=false
 if(['categoria','sezione'].includes(t[k]?.p??'')||['categoria','sezione'].includes(p)){if(['categoria','sezione'].includes(t[k]?.p??''))k++;skip();named=true
  if(t[k]?.p==='che'&&t[k+1]?.p==='si'&&['chiama','chiamera'].includes(t[k+2]?.p??''))k+=3;else if(['chiamata','chiamato','detta'].includes(t[k]?.p??''))k++;else if(['di','dal','col'].includes(t[k]?.p??'')&&t[k+1]?.p==='nome')k+=2}
 else if(!['tra','fra','nei','negli','nelle','nella','nel','in'].includes(p)||!CAT_WORDS.test(t[k]?.p??''))return null
 const start=k;while(k<t.length&&k-start<3&&!SEC_NAME_STOP.has(t[k]!.p)&&!/^\d/.test(t[k]!.p)){k++;if(!named&&!['pasti','piatti','del','della','di','giorno','casa'].includes(t[k]?.p??''))break}
 if(k===start)return null
 let from=i;while(from>0&&['tra','fra','nella','nel','in','una','un','uno'].includes(t[from-1]!.p))from--
 const name=t.slice(start,k).map(x=>x.o).join(' ')
 // «in una categoria nuova che si chiama X», «in un'altra categoria X»: la categoria nuova è chiesta, non serve chiedere «la creo?».
 const explicit=t.slice(i,start).some(x=>['nuova','nuovo','altra','altro','chiama','chiamata','chiamato'].includes(x.p))
 return{from,to:k,name:name.charAt(0).toLocaleUpperCase('it')+name.slice(1),explicit}
}

/** Unisce la risposta alla bozza: i pezzi nuovi completano o sostituiscono quelli mancanti. */
export function mergeDraft(draft:CreateDraft,next:CreateParse):CreateDraft{const sectionId=next.sectionId??draft.sectionId,sectionName=sectionId?null:next.sectionName??draft.sectionName??null
 return {kind:'create_draft',name:draft.name??next.name,price:next.price??draft.price,sectionId,...(sectionName?{sectionName}:{}),...(sectionName&&(draft.newSection||next.sectionNew)?{newSection:true}:{}),...(draft.names?{names:draft.names,split:draft.split??null,prices:draft.prices??draft.names.map(()=>null)}:{})}}

const sectionList=(sections:SectionRef[])=>sections.slice(0,15).map(s=>s.name).join(', ')
const missingSection=(d:CreateDraft,unknownSection:boolean)=>d.sectionName?`Nel menu non c'è la categoria *${d.sectionName}*. `:unknownSection?"Quella categoria nel menu non c'è. ":''
/** Una sola domanda, nell'ordine: categoria (se più di una), prezzo, nome. */
export function createQuestion(d:CreateDraft,sections:SectionRef[],unknownSection=false){
 if(d.names?.length&&d.split!==false)return multiQuestion(d,sections)
 const piatto=d.name?`*${d.name}*`:'il piatto'
 // Fase B (17/10): una categoria che non c'è si può creare: si chiede «la creo?».
 if(!d.sectionId&&d.sectionName&&!d.newSection)return `Nel menu non c'è la categoria *${d.sectionName}*: la creo e ci metto ${piatto}? Rispondi *sì*, oppure dimmi in quale categoria metterlo. Categorie: ${sectionList(sections)}. Non ho ancora aggiunto nulla.`
 if(!d.sectionId&&!(d.sectionName&&d.newSection))return `${missingSection(d,unknownSection)}In quale categoria metto ${piatto}? Categorie: ${sectionList(sections)}.`
 if(d.price===null)return `Quanto costa ${piatto}?`
 return `Come si chiama il piatto da aggiungere in *${sections.find(s=>s.id===d.sectionId)?.name??''}* a ${d.price.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})} €?`
}
export const draftComplete=(d:CreateDraft):d is CreateDraft&{name:string,price:number,sectionId:string}=>!!d.name&&d.price!==null&&!!d.sectionId

type CreateAction={kind:'create',sectionId:string,name:string,price:number,description:null}
export type CreateStep={kind:'actions',actions:MenuAction[]}|{kind:'none'}|{kind:'unhide',id:string}|{kind:'ask',draft:CreateDraft,text:string}|{kind:'exists',name:string,section:string}|{kind:'create',action:CreateAction}|{kind:'createMany',actions:CreateAction[]}

// ===================== 17/10 (correzioni A1): «X e Y» = due piatti o un nome composto =====================
// Coppie che formano UN piatto (glossario di cucina): la «e» non separa due piatti. Più «pasta/riso/pane e …» in testa.
const PAIRS=new Set(['cacio e pepe','pasta e fagioli','pasta e ceci','pasta e patate','pasta e lenticchie','pasta e piselli','pasta e broccoli','pasta e zucca','pane e coperto','pane e panelle','panelle e crocche','aglio e olio','olio e peperoncino','olio e aceto','sale e pepe','burro e salvia','burro e alici','burro e parmigiano','salsiccia e friarielli','salsiccia e funghi','funghi e salsiccia','salsiccia e patate','prosciutto e melone','prosciutto e funghi','prosciutto e fichi','cozze e vongole','vongole e cozze','gamberi e zucchine','zucchine e gamberi','zucchine e gamberetti','pomodoro e mozzarella','mozzarella e pomodoro','pomodoro e basilico','pere e gorgonzola','pere e formaggio','ricotta e spinaci','spinaci e ricotta','speck e noci','speck e brie','noci e gorgonzola','gorgonzola e noci','zucca e salsiccia','riso e patate','riso e piselli','uova e pancetta','piselli e pancetta','pancetta e piselli','panna e prosciutto','prosciutto e panna','tonno e cipolla','tonno e cipolle','crudo e bufala','crudo e mozzarella','bresaola e rucola','rucola e grana','rucola e parmigiano','pomodorini e rucola','alici e pomodorini','latte e caffe','caffe e latte','pane e pomodoro','pane e olio','pane e salame','pane e burro','fagioli e cotiche','salsicce e fagioli','mare e monti','terra e mare','pesce e patatine','fish e chips','spaghetti e polpette','patate e cozze','limone e pepe','cipolla e patate','pollo e patate','carne e patate','mozzarella e alici','fiori e alici','zucchine e menta','melanzane e ricotta','pistacchio e mortadella','mortadella e pistacchio'])
// A7.4: una «e» seguita da un ingrediente o contorno («polpo e patate», «panna e fragole», «vongole e bottarga») è UN piatto.
const INGREDIENT=new Set(['patate','patatine','ceci','fagioli','lenticchie','piselli','fave','fragole','frutti','bottarga','funghi','porcini','salsiccia','zucchine','zucca','rucola','grana','parmigiano','pecorino','pomodoro','pomodorini','mozzarella','bufala','burrata','olive','capperi','cipolla','cipolle','peperoni','melanzane','noci','miele','cioccolato','crema','panna','limone','pistacchio','pistacchi','nocciole','mandorle','speck','prosciutto','pancetta','guanciale','tartufo','gamberi','gamberetti','vongole','cozze','salvia','burro','basilico','menta','asparagi','carciofi','spinaci','ricotta','gorgonzola','pere','mele','fichi','uvetta','pinoli','acciughe','alici','tonno','olio','aceto','pepe','peperoncino','aglio','verdure','insalata','friarielli','broccoli','cavolo','senape','maionese','ketchup','gelato','caramello','amarene','cannella','zenzero','mezzo','mezza','quarto','metro','litro','chilo','etto'])
const LEAD_ONE=new Set(['pasta','riso','pane','zuppa','minestra','crema','vellutata','risotto','insalata','tagliere','frittata'])
const STOP_WORD=new Set(['il','lo','la','l','i','gli','le','un','una','uno','di','del','della','al','alla','alle','ai','con','e','ed','a','in'])
const cap=(x:string)=>x.charAt(0).toLocaleUpperCase('it')+x.slice(1)
const foldW=(x:string)=>waNewFold(x).replace(/[^a-z0-9]+/g,'')
/** «Pasta al pesto e lasagna» → ['Pasta al pesto','Lasagna']; null se è un nome composto («pasta e fagioli», «cacio e pepe»). */
export function splitPair(name:string,refs:{name:string}[]=[]):string[]|null{
 const w=name.trim().split(/\s+/),p=w.map(foldW)
 if(refs.some(r=>waNewFold(r.name).replace(/[^a-z0-9]+/g,' ').trim()===p.join(' ')))return null
 const cuts=p.map((x,i)=>(x==='e'||x==='ed')&&i>0&&i<p.length-1?i:-1).filter(i=>i>0).filter(i=>!PAIRS.has(p[i-1]+' e '+p[i+1])&&!(i<=2&&LEAD_ONE.has(p[0]!)&&!w.slice(1,i).some(x=>/^(?:al|alla|allo|alle|ai|agli|con)$/i.test(x))))
 if(cuts.length!==1)return null
 const k=cuts[0]!,left=w.slice(0,k),right=w.slice(k+1);while(right.length>1&&STOP_WORD.has(foldW(right[0]!)))right.shift()
 const content=(xs:string[])=>xs.some(x=>foldW(x).length>=3&&!STOP_WORD.has(foldW(x))&&!/^\d/.test(x))
 if(right.length===1&&INGREDIENT.has(foldW(right[0]!)))return null
 if(left.length===1&&INGREDIENT.has(foldW(left[0]!)))return null
 if(!content(left)||!content(right))return null
 return [cap(left.join(' ')),cap(right.join(' '))]}

const bolds=(xs:string[])=>xs.length>1?xs.slice(0,-1).map(x=>`*${x}*`).join(', ')+' e *'+xs.at(-1)+'*':`*${xs[0]}*`
/** Domanda per una bozza con più nomi: prima «due piatti o uno?», poi i prezzi che mancano, poi la categoria. */
export function multiQuestion(d:CreateDraft,sections:SectionRef[]){
 const names=d.names??[],prices=d.prices??names.map(()=>null)
 if(d.split==null)return `${bolds(names)}: sono ${names.length===2?'due piatti':names.length+' piatti'} o uno solo?${prices.every(x=>x===null)?' Se sono separati dimmi anche quanto costa ciascuno.':''} Non ho ancora aggiunto nulla.`
 const without=names.filter((_,i)=>prices[i]==null)
 if(without.length===1)return `Quanto costa ${bolds(without)}? Non ho ancora aggiunto nulla.`
 if(without.length)return `Quanto costano ${bolds(without)}? Dimmi un prezzo per ciascuno. Non ho ancora aggiunto nulla.`
 return `${missingSection(d,false)}In quale categoria metto ${bolds(names)}? Categorie: ${sectionList(sections)}.`}

const TWO=/\b(?:due piatti|2 piatti|sono due|sono 2|separat\w*|distint\w*|divis\w*|piatti diversi|due diversi|due cose|sono piatti|tutti e due|entrambi)\b/
const ONE=/^(?:(?:no|si|ok|allora|guarda|e)\s+)*(?:e\s+)?(?:uno|uno solo|un solo piatto|un piatto solo|un piatto|un unico piatto|piatto unico|unico piatto|un piatto unico|e un piatto|e uno solo|e un piatto unico|tutto insieme|insieme|uno unico)(?:\s+(?:solo|unico))?(?:$|\s+(?:a|costa|da|di)\s+\S+(?:\s+euro)?$|\s+\d\S*(?:\s+euro)?$)/
const ORDS:[RegExp,number][]=[[/^(?:prim[oa]|1)$/,0],[/^(?:second[oa]|2)$/,1],[/^(?:terz[oa]|3)$/,2]]
/** Prezzi di una risposta per più piatti, con il piatto (o l'ordinale) a cui si riferiscono se detto. */
export function answerPrices(text:string,names:string[]):{value:number,idx:number|null}[]{
 const t=waNewTokens(text),keys=names.map(n=>waNewTokens(n).map(x=>x.p).filter(w=>w.length>=4&&!['pasta','piatto','pizza','spaghetti'].includes(w)))
 const out:{value:number,idx:number|null}[]=[];let cur:number|null=null
 for(let i=0;i<t.length;i++){const w=t[i]!.p
  const byName=keys.findIndex(k=>k.some(x=>x===w||(x.length>=5&&w.length>=5&&x.slice(0,5)===w.slice(0,5))))
  if(byName>=0){cur=byName;continue}
  const ord=ORDS.find(([re])=>re.test(w)&&['la','il','l','lo'].includes(t[i-1]?.p??''));if(ord){cur=ord[1];continue}
  if(['un','una','uno'].includes(w))continue
  if(w==='due'&&(['piatti','separati','diversi','distinti','cose'].includes(t[i+1]?.p??'')||['sono','e'].includes(t[i-1]?.p??'')))continue
  const v=waNewValue(w);if(v===null||v<=0)continue
  out.push({value:v,idx:cur});cur=null}
 return out}

function multiAnswer(text:string,draft:CreateDraft,sections:SectionRef[],refs:{id?:string,name:string,sectionId?:string|null}[]):CreateStep|null{
 const names=draft.names!,t=waNewFold(text).replace(/[^a-z0-9]+/g,' ').trim()
 let split=draft.split??null,sectionId=draft.sectionId;const prices=[...(draft.prices??names.map(()=>null))]
 if(TWO.test(t))split=true;else if(ONE.test(t))split=false
 const sec=parseCreate(text,sections,false),bareSec=sections.find(s=>{const n=waNewFold(s.name).replace(/[^a-z0-9]+/g,' ').trim();return [n,n.replace(/i$/,'o'),n.replace(/e$/,'a')].includes(t)})
 if(sec?.sectionId)sectionId=sec.sectionId;else if(bareSec)sectionId=bareSec.id
 const vals=answerPrices(text,names)
 if(split===false){const single:CreateDraft={kind:'create_draft',name:draft.name,price:draft.price??(vals.length===1?vals[0]!.value:null),sectionId,...(draft.sectionName&&!sectionId?{sectionName:draft.sectionName}:{})}
  if(vals.length>1)return{kind:'ask',draft:single,text:`*${draft.name}* è un piatto solo: quale prezzo metto, ${vals.map(v=>v.value.toLocaleString('it-IT')).join(' o ')} €? Non ho ancora aggiunto nulla.`}
  return finish(single,sections,refs)}
 // «8 tutti e due», «entrambi a 9», «stesso prezzo, 10»: un prezzo per tutti (A7.4, M6).
 if(vals.length===1&&/\b(?:tutti e due|tutte e due|entramb\w*|ciascun\w*|uguale|stesso prezzo|tutti a|tutte a|tutti e tre)\b/.test(t)){split=true;for(let i=0;i<prices.length;i++)if(prices[i]==null)prices[i]=vals[0]!.value;vals.length=0}
 if(vals.length>=2)split=true
 const named=vals.filter(v=>v.idx!==null),free=vals.filter(v=>v.idx===null)
 for(const v of named)prices[v.idx!]=v.value
 const empty=prices.map((x,i)=>x===null?i:-1).filter(i=>i>=0)
 if(free.length&&(free.length===empty.length||(split===true&&free.length<=empty.length&&named.length)))free.forEach((v,k)=>{if(empty[k]!==undefined)prices[empty[k]!]=v.value})
 else if(free.length===1&&split==null&&!named.length)return{kind:'ask',draft:{...draft,sectionId},text:`${bolds(names)}: un piatto solo a ${free[0]!.value.toLocaleString('it-IT')} € o ${names.length===2?'due piatti':names.length+' piatti'} separati? Non ho ancora aggiunto nulla.`}
 else if(free.length>empty.length)return{kind:'ask',draft:{...draft,split,sectionId},text:`Ho ${names.length} piatti (${bolds(names)}) e ${free.length} prezzi: ${multiQuestion({...draft,split:true,prices:names.map(()=>null)},sections).replace(/ Non ho ancora aggiunto nulla\.$/,'')} Non ho ancora aggiunto nulla.`}
 const nd:CreateDraft={...draft,split,prices,sectionId,...(sectionId?{sectionName:null}:{})}
 if(split===true&&prices.every(x=>x!==null)&&sectionId){const actions=names.map((n,i)=>({kind:'create' as const,sectionId:sectionId!,name:n,price:prices[i]!,description:null}))
  const fresh=actions.filter(a=>!refs.some(r=>r.sectionId===a.sectionId&&waNewFold(r.name).trim()===waNewFold(a.name).trim()))
  if(!fresh.length)return{kind:'exists',name:actions[0]!.name,section:sections.find(s=>s.id===sectionId)?.name??''}
  return{kind:'createMany',actions:fresh}}
 if(!vals.length&&split===(draft.split??null)&&sectionId===draft.sectionId)return null
 return{kind:'ask',draft:nd,text:multiQuestion(nd,sections)}}

/** Bozza con una categoria nuova accettata («sì creala») e il prezzo: categoria + piatto (o piatti) nella stessa pubblicazione. */
function newSectionStep(d:CreateDraft,_sections:SectionRef[]):CreateStep|null{
 if(!d.newSection||!d.sectionName||d.sectionId)return null
 const id=crypto.randomUUID(),names=d.names?.length&&d.split===true?d.names:d.name?[d.name]:[],prices=d.names?.length&&d.split===true?d.prices??[]:[d.price]
 if(!names.length||prices.length<names.length||prices.some(p=>p==null))return null
 return{kind:'actions',actions:[{kind:'create_section',newSectionId:id,name:d.sectionName,menuId:''},...names.map((n,i)=>({kind:'create',sectionId:id,name:n,price:prices[i]!,description:null}) as MenuAction)]}}
function finish(d:CreateDraft,sections:SectionRef[],refs:{id?:string,name:string,sectionId?:string|null}[],verbFirst=false,unknownSection=false):CreateStep{
 {const ns=newSectionStep(d,sections);if(ns)return ns}
 if(!draftComplete(d))return{kind:'ask',draft:d,text:createQuestion(d,sections,unknownSection&&!d.sectionId)}
 const wordsOf=(x:string)=>waNewFold(x).replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(w=>w&&!['il','la','lo','i','gli','le','di','al','alla','alle','ai','con','e'].includes(w)),mine=wordsOf(d.name)
 // Il nome detto in risposta a «Come si chiama?» è esplicito: solo un nome identico è un doppione («Birra» ≠ «Birra media»).
 const twin=refs.find(r=>r.sectionId===d.sectionId&&(waNewFold(r.name).trim()===waNewFold(d.name).trim()||(verbFirst&&mine.length>0&&mine.some(w=>w.length>=5&&!['pasta','pizza','spaghetti','piatto','piatti'].includes(w))&&mine.every(w=>wordsOf(r.name).includes(w)))))
 if(twin)return{kind:'exists',name:twin.name,section:sections.find(s=>s.id===d.sectionId)?.name??''}
 return{kind:'create',action:{kind:'create',sectionId:d.sectionId,name:d.name,price:d.price,description:null}}}

/** «aggiungi pasta al pesto e lasagna a 10 e 20»: due nomi e due prezzi nello stesso ordine. */
function pairedCreate(text:string,sections:SectionRef[],refs:{id?:string,name:string,sectionId?:string|null}[]):CreateStep|null{
 const m=text.replace(/€/g,' euro ').match(/^(.*?)\s+a\s+(\d+(?:[.,]\d{1,2})?)(?:\s*euro)?\s+e\s+(\d+(?:[.,]\d{1,2})?)(?:\s*euro)?\s*[.!]?\s*$/i);if(!m)return null
 const c=parseCreate(m[1]!,sections,true);if(!c?.name||c.price!==null)return null
 const names=splitPair(c.name,refs);if(!names||names.length!==2)return null
 const d:CreateDraft={kind:'create_draft',name:c.name,price:null,sectionId:c.sectionId,names,split:true,prices:[Number(m[2]!.replace(',','.')),Number(m[3]!.replace(',','.'))],...(c.sectionName?{sectionName:c.sectionName}:{})}
 return multiAnswer('',d,sections,refs)??{kind:'ask',draft:d,text:multiQuestion(d,sections)}}

const NAME_BAD=/\b(?:quanto|quanti|costa|costano|prezzo|euro|cosa|quale|quali|dimmi|finit\w*|esaurit\w*|nascond\w*|togli\w*|metti\w*|cambia\w*|annulla|aspetta|elimina\w*|cancella\w*)\b/
// Risposte di conferma: mai il nome di un piatto (A3.3, «sì creala» era diventato il piatto «Creala»).
const YES=/^(?:(?:si|ok|okay|va bene|vai|certo|esatto|giusto|perfetto|d accordo|confermo|procedi)\s*)+(?:(?:creala|crealo|creale|creali|crea|falla|fallo|fai|aggiungila|aggiungilo|aggiungi|mettila|mettilo|pure)\s*)*$|^(?:creala|crealo|crea|crea la categoria|fallo|falla)$/
/** Decide se il messaggio è un'aggiunta (verbo iniziale) o la risposta a una domanda di aggiunta in attesa.
 * Con una bozza in attesa, un messaggio riconosciuto come altro comando (finito, nascondi…) non è una risposta;
 * un «cambio prezzo» sì (è il caso «… che costa 12 euro» del vocale). */
export function createStep(text:string,draft:CreateDraft|null,sections:SectionRef[],refs:{id?:string,name:string,sectionId?:string|null,hidden?:boolean}[],otherIntent:(t:string)=>{kind:string}|null):CreateStep{
 const verbFirst=startsWithCreate(text)
 if(verbFirst&&createCompound(text))return pairedCreate(text,sections,refs)??{kind:'none'}
 const folded=waNewFold(text).replace(/[^a-z0-9]+/g,' ').trim()
 if(!verbFirst&&draft&&YES.test(folded)){if(draft.sectionName&&!draft.sectionId){const ok:CreateDraft={...draft,newSection:true};return newSectionStep(ok,sections)??{kind:'ask',draft:ok,text:createQuestion(ok,sections)}};return{kind:'ask',draft,text:createQuestion(draft,sections)}}
 // Bozza con due nomi («X e Y»): «sono due piatti», «uno solo», «10 e 20», «uno a 10 e uno a 20», «la prima 10 la seconda 20».
 if(!verbFirst&&draft?.names?.length&&draft.split!==false&&!waNewNotCreate.test(folded)){const m=multiAnswer(text,draft,sections,refs);if(m)return m}
 if(!verbFirst){if(!draft||waNewNotCreate.test(folded))return{kind:'none'};const other=otherIntent(text);if(other&&other.kind!=='price')return{kind:'none'}}
 // «boh», «non so» in risposta a «Come si chiama?»: non è un nome, la domanda resta.
 if(!verbFirst&&draft&&!draft.name&&/^(?:boh|bho|mah|non so|non lo so|boh non so|non saprei|vedi tu|decidi tu)$/.test(waNewFold(text).replace(/[^a-z ]+/g,' ').trim()))return{kind:'ask',draft,text:createQuestion(draft,sections)}
 // Una sola parte di una bozza con due prezzi detti per un piatto solo («uno a 10 e uno a 20» per la lasagna): si chiede.
 if(!verbFirst&&draft&&!draft.names?.length&&draft.price===null){const vals=answerPrices(text,draft.name?[draft.name]:[]);const distinct=[...new Set(vals.map(v=>v.value))]
  if(distinct.length>1&&!/^\s*\d+\s*(?:euro\s*)?e\s*\d{2}\s*(?:euro|centesimi)?\s*$/i.test(text.trim())&&!/\b\d+\s*[,.]\s*\d{1,2}\b/.test(text))return{kind:'ask',draft,text:`${draft.name?`*${draft.name}*`:'Il piatto'} è uno solo: quale prezzo metto, ${distinct.map(v=>v.toLocaleString('it-IT')).join(' o ')} €? Se sono più piatti, dimmi i nomi. Non ho ancora aggiunto nulla.`}}
 // «no, intendevo lasagna verde», «no scusa, si chiama X»: con la bozza in sospeso il nome detto nella correzione sostituisce
 // quello di prima (A1, 17/10: prima restava «Lasagna»). Un numero da solo («no scusa 14») resta un prezzo.
 const corr=!verbFirst&&draft&&!/\?/.test(text)?text.match(/^\s*(?:(?:no|anzi|scusa(?:mi)?|aspetta|ops|ho sbagliato)[\s,!.;:]+)+(?:(?:intendevo|volevo dire|volevo|si chiama|il nome è|il nome e|chiamal[oa]|era)\s+)?(.+)$/i):null
 if(corr){const c2=parseCreate(corr[1]!,sections,false);if(c2?.name&&!YES.test(waNewFold(c2.name).replace(/[^a-z0-9]+/g,' ').trim())&&!NAME_BAD.test(waNewFold(c2.name))){const base:CreateDraft={kind:'create_draft',name:c2.name,price:c2.price??draft!.price,sectionId:c2.sectionId??draft!.sectionId,...(draft!.sectionName&&!c2.sectionId?{sectionName:draft!.sectionName}:{})}
  const parts=base.price===null?splitPair(base.name!,refs):null;if(parts){const nd:CreateDraft={...base,names:parts,split:null,prices:parts.map(()=>null)};return{kind:'ask',draft:nd,text:multiQuestion(nd,sections)}}
  return finish(base,sections,refs)}}
 const parsed=parseCreate(text,sections,verbFirst)!
 // Una risposta senza verbo che sembra una domanda o un comando non è il nome del piatto (A1, 17/10: «aspetta, quanto costa la
 // parmigiana?» era diventato un piatto).
 if(!verbFirst&&draft&&!draft.name&&parsed.name&&(NAME_BAD.test(waNewFold(parsed.name))||/\?/.test(text)))return{kind:'none'}
 // «metti nel menu il nuovo burger»: se il piatto esiste ed è nascosto, va mostrato (non aggiunto un doppione).
 if(parsed.name){const same=refs.filter(r=>waNewFold(r.name).trim()===waNewFold(parsed.name!).trim());if(same.length===1&&same[0]!.id){if(same[0]!.hidden)return{kind:'unhide',id:same[0]!.id};if(!draft&&!parsed.sectionId)return{kind:'exists',name:same[0]!.name,section:sections.find(s=>s.id===same[0]!.sectionId)?.name??''}}}
 const bare=!parsed.sectionId?sections.find(s=>waNewFold(s.name).replace(/[^a-z0-9]+/g,' ').trim()===folded):undefined
 const d=mergeDraft(draft??{kind:'create_draft',name:null,price:null,sectionId:null},bare?{name:null,price:null,sectionId:bare.id,unknownSection:false}:parsed)
 // «aggiungi pasta al pesto e lasagna» senza prezzo: due piatti o uno solo? Mai una bozza unica in silenzio (A1.2).
 // A7.4: «aggiungi nei primi ravioli e tortellini a 12» (non è un nome composto) → due piatti a 12 ciascuno.
 if(verbFirst&&d.name&&d.price!==null&&!d.names&&d.sectionId){const parts=splitPair(d.name,refs);if(parts){const acts=parts.filter(n=>!refs.some(r=>r.sectionId===d.sectionId&&waNewFold(r.name).trim()===waNewFold(n).trim())).map(n=>({kind:'create' as const,sectionId:d.sectionId!,name:n,price:d.price!,description:null}));if(acts.length)return{kind:'createMany',actions:acts}}}
 if(d.name&&d.price===null&&!d.names){const parts=splitPair(d.name,refs);if(parts){const nd:CreateDraft={...d,names:parts,split:null,prices:parts.map(()=>null)};return{kind:'ask',draft:nd,text:multiQuestion(nd,sections)}}}
 return finish(d,sections,refs,verbFirst,parsed.unknownSection)
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
 const rest=lead[2]!.replace(/^(?:(?:il|la|lo|l|i|gli|le|per|quello|quella|dire)\s+)+/,'').replace(/^a\s+(?=\d)/,'').trim()
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
 const w=waNewFold(target).replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(x=>x&&!['il','la','lo','l','i','gli','le','un','una','uno'].includes(x))
 const variants=(s:string)=>{const p=waNewFold(s).replace(/[^a-z0-9]+/g,' ').trim();return[p,p.replace(/i$/,'o'),p.replace(/e$/,'a'),p.replace(/i$/,'e')]}
 // 17/10: «il primo del pranzo», «il dolce della cena»: la categoria dentro un menu.
 let menu:string|null=null;if(w.length===3&&['del','della','dello','di','a','al','alla','per'].includes(w[1]!)&&refs.some(r=>r.menu&&variants(r.menu).includes(w[2]!))){menu=w[2]!;w.splice(1,2)}
 if(w.length!==1)return null
 const word=w[0]!,items=refs.filter(r=>r.section&&variants(r.section).includes(word)&&(!menu||variants(r.menu).includes(menu)));return items.length>1?items:null}

/** Round 4: comandi su un gruppo («tutte le pizze sono finite», «nascondi tutti i dolci», «rimetti disponibili tutte le
 * pizze», «tutte le bibite sono finite tranne l'acqua»). Il gruppo è una categoria o un menu esistente (singolare o
 * plurale); la regola delle 3 modifiche e l'OK restano nel bot. null = non è un comando di gruppo. */
export function groupCommand(text:string,refs:MenuRef[]):MenuAction[]|null{
 const t=waNewFold(text).replace(/[^a-z0-9]+/g,' ').trim()
 let body=t,except:string|null=null;const tr=t.match(/^(.*?) (?:tranne|eccetto|escluso|esclusa|esclusi|escluse|a parte|fuorche) (.+)$/);if(tr){body=tr[1]!;except=tr[2]!}
 const G='(?:tutt[eio] )(?:(?:i|le|gli|il|la) )?(.+?)'
 let m:RegExpMatchArray|null,kind:'available'|'hidden'|'featured'|null=null,value=false,group=''
 if((m=body.match(new RegExp(`^${G} (?:sono |e )?(?:finit|esaurit)[oaie]$`)))||(m=body.match(/^(?:(?:i|le|gli) )?(.+?) (?:sono )?tutt[eio] (?:finit|esaurit)[oaie]$/))){kind='available';value=false;group=m[1]!}
 else if((m=body.match(new RegExp(`^(?:sono )?(?:finit|esaurit)[oaie] ${G}$`)))){kind='available';value=false;group=m[1]!}
 else if((m=body.match(new RegExp(`^(?:(?:rimetti|rendi|metti|segna) )?(?:di nuovo )?disponibil[ei] ${G}$`)))||(m=body.match(new RegExp(`^${G} (?:sono )?(?:di nuovo |tornat[ei] )?disponibil[ei]$`)))||(m=body.match(new RegExp(`^${G} sono tornat[ei]$`)))){kind='available';value=true;group=m[1]!}
 else if((m=body.match(new RegExp(`^nascondi ${G}$`)))){kind='hidden';value=true;group=m[1]!}
 else if((m=body.match(new RegExp(`^metti in evidenza ${G}$`)))||(m=body.match(new RegExp(`^${G} in evidenza$`)))){kind='featured';value=true;group=m[1]!}
 else if((m=body.match(new RegExp(`^(?:togli|leva) (?:dall evidenza|dalla evidenza) ${G}$`)))){kind='featured';value=false;group=m[1]!}
 else if((m=body.match(new RegExp(`^(?:mostra|rimetti(?: nel menu)?) ${G}$`)))){kind='hidden';value=false;group=m[1]!}
 if(!kind)return null
 const items=categoryItems(group,refs);if(!items.length)return null
 // Esclusioni: prima i nomi completi («pasta e fagioli» non si spezza sulla «e»), poi il resto parte per parte; tra più candidati
 // vince il nome esatto («la margherita» non toglie anche «Margherita con bufala»).
 const skip=new Set<string>();if(except){let rest=' '+except+' ';const plainName=(x:string)=>waNewFold(x).replace(/[^a-z0-9]+/g,' ').trim()
  for(const r of [...refs].sort((a,b)=>b.name.length-a.name.length)){const n=plainName(r.name);if(n.length>=3&&rest.includes(' '+n+' ')){skip.add(r.id);rest=rest.split(' '+n+' ').join(' , ')}}
  for(const part of rest.split(/ , | e | ed /).map(x=>x.replace(/^(?:l|il|la|lo|i|gli|le) /,'').trim()).filter(x=>x&&!/^(?:l|il|la|lo|i|gli|le|e)$/.test(x))){const hits=findDishes(part,refs),exact=hits.filter(r=>plainName(r.name)===part);for(const r of exact.length?exact:hits)skip.add(r.id)}}
 return items.filter(r=>!skip.has(r.id)).map(r=>({kind:kind!,id:r.id,value}) as MenuAction)
}
