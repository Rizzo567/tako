/** Bot titolare (17/10/2026, QA WhatsApp): prezzi alternativi, clausole negate e risposte ai chiarimenti.
 * - «carbonara 13 o 14?», «13/14», «tra 13 e 14», «13 oppure 14 euro»: domanda sul prezzo, mai una scrittura;
 * - «non cambiare boh; metti …», «lascia stare X», «X no», «tranne X», «X resta com'è»: X è escluso dalle modifiche
 *   e non rende ambiguo il destinatario del resto;
 * - un nome di piatto da solo è una risposta (a «Quale piatto intendi?») o una domanda su quel piatto. */
import type {MenuRef} from './twilio-menu-ai.js'
import {findDishes,plainText,words,wordNumber,nearWord,preselect} from './twilio-menu-nlu.js'
import {categoryItems} from './twilio-menu-sales.js'

const fold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
const numberWord=(w:string):number|null=>{if(!/^[a-z]{3,}$/.test(w))return null;const n=wordNumber(w);return n===null||n===0?null:n}
// Un prezzo: cifre («13», «13,50»), parola («tredici») o parola con i centesimi («tredici e cinquanta», «tredici e mezzo»).
const NUM='(\\d+(?:[.,]\\d{1,2})?|[a-z]{3,}(?: e (?:mezz[oa]|[a-z]{3,}))?)'
const END='(?=[\\s,;.!?)]|$)'
const valueOf=(s:string):{v:number,label:string}|null=>{if(/^\d/.test(s)){const n=Number(s.replace(',','.'));return Number.isFinite(n)&&n>0&&n<=100000?{v:Math.round(n*100)/100,label:s}:null}
 const [a,,c]=s.split(' '),x=numberWord(a!);if(x===null)return null;if(!c)return{v:x,label:a!}
 const y=/^mezz[oa]$/.test(c)?50:numberWord(c);return y===null||y>=100?{v:x,label:a!}:{v:Math.round((x+y/100)*100)/100,label:s}}
// Dopo il secondo numero non deve esserci un'unità che non è un prezzo («2 o 3 giorni», «1 o 2 porzioni»).
const notPrice=/^\s*(?:giorn\w*|or[ae]\b|settiman\w*|porzion\w*|person\w*|pezz\w*|minut\w*|mes[ei]\b|ann[oi]\b|litr\w*|cl\b|ml\b|kg\b|gr?\b|volt\w*|coperti|tavol\w*|piatt\w*|pizz\w*|bottigli\w*|bicchier\w*|calic\w*|portat\w*|fett\w*|anni\b|bimbi|bambini|ospiti|fogli\w*)/
// Prima di «20/10», «14-15»: una parola di data o di orario → non sono prezzi.
const dateWord=/(?:^|\s)(?:al|il|dal|del|entro|scade|scadenza|data|fino|giorno|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|dalle|alle|ore|orario|hour|valid[oaie]|per|ultim[eiao]|restano|rimangono|ne|bimbi|bambini|anni|eta|basta|ideale|tavolo|tavoli|coperti)\s*$/
export type PriceAlternatives={first:string,second:string,a:number,b:number}
/** Due prezzi alternativi nello stesso messaggio. I numeri dei nomi dei piatti («Pizza 4 formaggi») non contano. */
export function priceAlternatives(raw:string,refs:{name:string}[]=[]):PriceAlternatives|null{
 let t=' '+fold(raw).replace(/€/g,' euro ').replace(/[«»"“”?!()]/g,' ').replace(/\s+/g,' ')+' '
 for(const r of [...refs].sort((a,b)=>b.name.length-a.name.length)){const n=fold(r.name).replace(/\s+/g,' ').trim();if(/\d/.test(n)&&n.length>=3)t=t.split(n).join(' piatto ')}
 // «descrizione …: ideale per 2 o 3»: il testo di una descrizione non è mai un prezzo.
 if(/\bdescrizion\w*\b|\bscrivi\s*:/.test(t))return null
 const dishEnd=(before:string)=>refs.some(r=>{const n=fold(r.name).replace(/\s+/g,' ').trim();return n.length>=3&&before.trimEnd().endsWith(n)})
 const pick=(m:RegExpMatchArray,before:string):PriceAlternatives|null=>{const a=valueOf(m[1]!),b=valueOf(m[2]!);if(!a||!b||a.v===b.v)return null;if(dateWord.test(before)&&!dishEnd(before))return null;return{first:a.label,second:b.label,a:a.v,b:b.v}}
 const pair=/\s(\d+(?:[.,]\d{1,2})?)\s*[\/-]\s*(\d+(?:[.,]\d{1,2})?)(?=[\s,;.!?)]|$)/g
 for(const re of [new RegExp(`\\s${NUM}(?:\\s*(?:euro|eur|euri))?\\s+(?:o forse|o magari|o anche|o senno|o sennò|o al massimo|oppure|od|o)\\s+(?:a\\s+|al massimo\\s+)?${NUM}${END}`,'g'),new RegExp(`\\s(?:tra|fra)\\s+(?:i\\s+)?${NUM}(?:\\s*euro)?\\s+e\\s+(?:i\\s+)?${NUM}${END}`,'g'),pair])
  for(const m of t.matchAll(re)){const after=t.slice(m.index!+m[0].length);if(notPrice.test(after))continue
   const hit=pick(m,t.slice(0,m.index!));if(!hit)continue

   // Due numeri in lettere: prezzo se c'è una parola di prezzo o se sono numeri «da prezzo» (da cinque in su: «tredici o quattordici»).
   if(!/^\d/.test(m[1]!)&&!/^\d/.test(m[2]!)&&!/\b(?:euro|costa|costano|prezzo|metti\w*|porta\w*|fai|falla|fallo|cambia)\b/.test(t)&&Math.min(hit.a,hit.b)<5)continue
   return hit}
 return null}
// Parole che in una richiesta di prezzo non fanno parte del nome del piatto.
const priceTalk=/^(?:no|scusa|anzi|o|oppure|od|forse|magari|anche|tra|fra|euro|eur|euri|prezzo|metti\w*|porta\w*|port[oa]|fai|falla|fallo|facciamo|cambia\w*|imposta\w*|costa\w*|viene|vengono|lo|la|li|le|che|dici|decidi|tu|non|so|boh?|ok|allora|ciao|al|massimo|senno|sennò|mezz[oa]|cinquanta|virgola)$/
const dishWords=(c:string)=>plainText(c).replace(/[,.!?]/g,' ').split(' ').filter(w=>w&&!/^\d/.test(w)&&numberWord(w)===null&&!priceTalk.test(w)).join(' ')
/** Il piatto a cui si riferisce l'alternativa: il nome completo nel testo, altrimenti la parte di frase che la contiene. */
export function priceAlternativeDish(raw:string,refs:MenuRef[],alt:PriceAlternatives):{dish:MenuRef|null,many:boolean}{
 const text=' '+plainText(raw).replace(/[,.]/g,' ')+' ',full=refs.filter(r=>plainText(r.name).length>=3&&text.includes(' '+plainText(r.name).replace(/[,.]/g,' ').replace(/\s+/g,' ')+' '))
 const find=(c:string)=>{const d=dishWords(c);if(!d||!words(d).length)return[];const exact=refs.filter(r=>plainText(r.name)===plainText(d));return exact.length?exact:findDishes(d,refs)}
 const clauses=fold(raw).split(/[;\n]|(?<!\d),(?!\d)|\s+e\s+(?=\D)|\s+poi\s+/).map(c=>c.trim()).filter(Boolean),named=clauses.flatMap(c=>{const hits=find(c);return hits.length===1?[hits[0]!]:[]})
 const distinct=[...new Map([...full,...named].map(r=>[r.id,r])).values()],own=clauses.find(c=>c.includes(fold(alt.first))&&c.includes(fold(alt.second)))
 const target=own?find(own):[],dish=target.length===1?target[0]!:(distinct.length===1?distinct[0]!:null)
 return{dish,many:distinct.length>1}
}

// ---------------- Clausole negate ----------------
export type Excluded={id:string,kinds?:string[]}
export type Negation={rest:string,excluded:Excluded[],names:string[],strip:boolean}
const NEG_SEP=String.raw`(?:(?<!\d)[,;.](?!\d)|[!?()\n]|\s+(?:e|ed|ma|pero|invece|poi|mentre)\s+|$)`
// Parole che possono stare accanto a un nome di piatto senza farne parte.
const dishGlue=new Set(['il','lo','la','l','i','gli','le','di','da','del','dello','della','dei','degli','delle','al','allo','alla','ai','agli','alle','con','e','ed','in','a'])
const dishTokens=(s:string)=>plainText(s).replace(/[,.]/g,' ').split(' ').filter(w=>w&&!dishGlue.has(w))
/** Tutte le parole del testo appartengono al nome (o alla categoria) del piatto: «la cotoletta» sì, «un c'è più la cotoletta» no. */
const ownsAll=(text:string,r:MenuRef)=>{const own=dishTokens(r.name+' '+(r.section??''));return dishTokens(text).every(w=>own.some(n=>n===w||nearWord(w,n)||(n.length>=4&&w.length>=4&&(n.startsWith(w.slice(0,4))||w.startsWith(n.slice(0,4))))))}
const negFillers=/^(?:(?:allora|ciao|ok|okay|senti|scusa|anzi|e|ed|ma|pero|invece|quindi|poi|guarda|ah|eh|beh|no)\s+|[^a-z0-9'\s]+\s*)+/
/** Il bersaglio di una clausola negata: un piatto (nome completo prima, poi la corrispondenza normale) o una categoria. */
function targetOf(x:string,refs:MenuRef[]):MenuRef[]{
 const t=x.trim().replace(negFillers,'').replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno|del|della|dello|dei|degli|delle|di|[oa])\s+|l'\s*|'[oa]\s+)/,'').replace(/[^a-z0-9'\s]+$/,'').trim();if(!t||!words(t).length||actionish.test(plainText(t)))return[]
 if(/^(?:niente|nulla|altro|il resto|tutto il resto|tutto|nessun\w*)$/.test(t))return[]
 const exact=refs.filter(r=>fold(r.name).replace(/[^a-z0-9]+/g,' ').trim()===t.replace(/[^a-z0-9]+/g,' ').trim());if(exact.length)return exact
 const hits=findDishes(t,refs).filter(r=>ownsAll(t,r));if(hits.length)return hits
 const group=categoryItems(t,refs);return group.length&&dishTokens(t).length<=2?group:[]}
/** Nome completo di un piatto all'inizio di `s` (per non tagliare «pasta e fagioli» sulla «e»). */
function leadingDish(s:string,refs:MenuRef[]):string|null{
 const t=s.replace(/^(?:il|lo|la|i|gli|le)\s+|^l'\s?/,''),art=s.length-t.length
 for(const r of [...refs].sort((a,b)=>b.name.length-a.name.length)){const n=fold(r.name).replace(/[^a-z0-9]+/g,' ').trim();if(n.length>=3&&t.startsWith(n)&&!/^[a-z0-9]/.test(t.slice(n.length)))return s.slice(0,art+n.length)}
 return null}
const NEG_LOOK=String.raw`(?=\s*(?:[,;.\n!?)]|$|\s+(?:e|ed|ma|pero)\s))`
/** Trova le clausole negate. `strip` = il resto si può elaborare da solo (nessun pronome che rimanda al piatto negato).
 * «lascia stare X» in testa al messaggio resta al flusso di sempre (annulla X se era l'ultima modifica, round 3). */
export function negatedClauses(raw:string,refs:MenuRef[],opts:{keepLeadingLascia?:boolean}={}):Negation|null{
 // Testo piegato con la stessa lunghezza dell'originale: le posizioni valgono per entrambi.
 const original=raw.normalize('NFC').replace(/[’`´]/g,"'"),t=original.split('').map(ch=>fold(ch).length===1?fold(ch):ch.toLowerCase()).join('')
 type Hit={from:number,to:number,target:string,parts?:string[],kinds?:string[],keepText?:boolean,strong?:boolean}
 const hits:Hit[]=[]
 // Il bersaglio finisce al primo separatore o verbo; «boh e che ne sacc» (piatti uniti da «e»/«né») resta una sola negazione.
 const grab=(start:number):{x:string,parts:string[]}=>{const tail=t.slice(start);let x=leadingDish(tail,refs)
  if(!x){const m=tail.match(new RegExp(`^(.+?)${NEG_SEP}`));x=(m?m[1]!:tail).split(/\s+(?=(?:metti\w*|togli\w*|nascondi\w*|porta\w*|cambia\w*|aggiungi\w*|segna\w*|fai|falla|fallo|rimetti|mostra|e finit\w*|sono finit\w*)\b)/)[0]!;return{x,parts:[x]}}
  const parts=[x];for(;;){const more:RegExpMatchArray|null=tail.slice(x!.length).match(/^\s+(?:e|ed|ne)\s+/);if(!more)break;const next=tail.slice(x.length+more[0].length),d=leadingDish(next,refs);if(!d||!/^\s*(?:[,;.\n!?)]|$|\s+(?:e|ed|ma)\s)/.test(next.slice(d.length)))break;x=x+more[0]+d;parts.push(d)}
  return{x,parts}}
 const patterns:{re:RegExp,keepText?:boolean}[]=[
  {re:/(?<![a-z0-9'])(?:per favore\s+|pero\s+)?(?:non|nn|nun)\s+(?:mi\s+|me\s+)?(?:cambiare|cambiate|cambiarmi|cambiarlo|cambiarla|toccare|toccate|toccarmi|modificare|modificate|aggiornare|variare|cambia|tocca|modifica|nascondere|togliere|levare|segnare|mettere|cagna|cagnà|tucca|tuccà|tocca)\s+(?:(?:il|i)\s+prezz[oi]\s+(?:di|del|della|dello|dei|degli|delle|al|alla|allo|all'?|ai|alle)?\s*|(?:la\s+promo|le\s+promo|l'offerta|lo\s+sconto)\s+(?:a|al|alla|allo|ai|alle|di|del|della|dello|da|dal|dalla)\s+)?/g},
  {re:/(?:^|(?<=[,;.\n!?(]\s*)|(?<=\s(?:e|ma|pero)\s))(?:lascia|lasciate|lasciamo|lassa|lass)\s+(?:stare|star|sta|perdere|com'?\s?e|come e|cosi|invariat[oaie]|uguale|in pace)\s+/g},
  {re:/(?<=\s(?:e|ma|pero)\s)(?:lascia|lasciamo|lassa)\s+(?=(?:il|lo|la|i|gli|le)\s|l')/g},
  {re:/(?<![a-z0-9])senza\s+(?:toccare|cambiare|modificare)\s+/g},
  {re:/(?<![a-z0-9])(?:e\s+)?niente\s+(?:su|sul|sulla|sullo|sui|sulle|a|al|alla|allo|ai|alle|per|per il|per la)\s+/g},
  {re:/(?:^|(?<=[,;\s(]))(?:ma|pero)\s+non\s+(?:anche\s+)?/g},
  {re:/(?:^|(?<=[,;\s(]))(?:tranne|eccetto|escluso|esclusa|esclusi|escluse|fuorche)\s+/g,keepText:true}]
 for(const p of patterns)for(const m of t.matchAll(p.re)){const start=m.index!+m[0].length;if(opts.keepLeadingLascia&&m.index===0&&/^lascia (?:stare|perdere)\b/.test(m[0].trim()))continue
  const g=grab(start),x=g.x.trim();if(!x)continue;const kinds=/prezz/.test(m[0])?['price']:/promo|offerta|sconto/.test(m[0])?['promo']:null;hits.push({from:m.index!,to:start+g.x.length,target:x,parts:g.parts,strong:true,...(kinds?{kinds}:{}),...(p.keepText?{keepText:true}:{})})}
 // «X no», «X resta com'è / rimane così / resta 20», «X non si tocca», «X non la toccare», «X lasciala com'è», «X la lasciamo»: il piatto viene prima.
 const after=[new RegExp(String.raw`\s+(?:no|nn)(?=\s*(?:[,;.\n!?)]|$))`,'g'),
  new RegExp(String.raw`\s+(?:invece\s+|pero\s+|pure\s+|anche\s+)?(?:resta|rimane|restano|rimangono)\s+(?:com'?\s?e|come e|com'?\s?era|cosi|uguale|invariat[oaie]|a posto|come sta|(?:a\s+)?\d+(?:[.,]\d{1,2})?(?:\s*euro)?)${NEG_LOOK}`,'g'),
  new RegExp(String.raw`\s+non\s+si\s+(?:tocca|toccano|cambia|cambiano|modifica)${NEG_LOOK}`,'g'),
  new RegExp(String.raw`\s+non\s+(?:(?:la|lo|li|le|l')\s*(?:toccare|cambiare|modificare|toccate|cambiate)|(?:toccarl|cambiarl|modificarl)[aoie])${NEG_LOOK}`,'g'),
  new RegExp(String.raw`\s+nun\s+(?:'?[oa]\s*|l[oa]\s+)?(?:tucc|tocc|cagn)\w*${NEG_LOOK}`,'g'),
  new RegExp(String.raw`\s+(?:lasciala|lascialo|lasciali|lasciale|lassala|lassalo|lassali|lassale)\s+(?:stare|star|sta|perdere|com'?\s?e|come e|cosi|uguale|invariat[oaie]|in pace)${NEG_LOOK}`,'g'),
  new RegExp(String.raw`\s+(?:la|lo|li|le|l')\s*(?:lasciamo|lascio|lasci|lasciate)(?:\s+(?:cosi|stare|perdere|com'?\s?e|come sta|in pace|a\s+\d+(?:[.,]\d{1,2})?(?:\s*euro)?))?${NEG_LOOK}`,'g')]
 for(const re of after)for(const m of t.matchAll(re)){const head=t.slice(0,m.index!),cut=Math.max(head.search(/[^,;.\n!?(]*$/),0);let from=cut;const seg=head.slice(cut);const conj=seg.match(/^(.*\s)(?:e|ma|pero|anzi)\s+/);if(conj)from=cut+conj[1]!.length
  let x=t.slice(from,m.index!).trim().replace(/^(?:e|ma|pero|anzi)\s+/,'');if(!x)continue
  // «la carbonara a 13 e la lasagna no»: il bersaglio è solo l'ultima parte senza numeri.
  const lastPart=x.split(/\s+(?:e|ed)\s+(?=\D*$)/).at(-1)!;if(lastPart!==x&&!/\d/.test(lastPart))from+=x.length-lastPart.length,x=lastPart
  if(/\d/.test(x))continue
  hits.push({from:t.indexOf(x,from),to:m.index!+m[0].length,target:x,...(/(?:resta|rimane|restano|rimangono|lasciamo|lascio|lasci|lasciate)\s+(?:a\s+)?\d/.test(m[0])?{kinds:['price']}:{})})}
 if(!hits.length)return null
 const excluded:Excluded[]=[],names:string[]=[];let keep=false
 const used:Hit[]=[]
 for(const h of hits){const split=(h.parts??[]).length>1?h.parts!.map(x=>targetOf(x,refs)):[],found=split.length&&split.every(f=>f.length)?split.flat():targetOf(h.target,refs);if(!found.length)continue;used.push(h);if(h.keepText)keep=true
  for(const r of found)excluded.push({id:r.id,...(h.kinds?{kinds:h.kinds}:{})});names.push(...new Set(found.length>3?[h.target.replace(/^(?:il|lo|la|l|i|gli|le)\s+/,'')]:found.map(r=>r.name)))}
 if(!used.length)return null
 let rest=original;for(const h of [...used].filter(h=>!h.keepText).sort((a,b)=>b.from-a.from))rest=rest.slice(0,h.from)+' , '+rest.slice(h.to)
 rest=rest.replace(/\(\s*,?\s*\)/g,' ').replace(/\s+/g,' ').replace(/\s*([,;])\s*(?:[,;.!?]\s*)+/g,'$1 ').replace(/([,;])\s*(?:e|ed|ma|però|pero|poi|invece|anzi)\s+/gi,'$1 ').replace(/\s+(?:e|ed|ma|però|pero|poi|anzi)\s*([,;])/gi,'$1').replace(/^[\s,;.:!?]+|[\s,;:]+$/g,'').replace(/\s+(?:e|ed|ma|però|pero|poi|anzi)$/i,'').replace(/^(?:e|ed|ma|però|pero|poi|invece|allora|quindi)\s+/i,'').trim()
 // Un pronome nel resto («mettila in promo») rimanda al piatto negato: il testo resta intero, l'esclusione vale lo stesso.
 // Se il resto nomina un piatto prima del pronome («la lasagna mettila a 12») il pronome si riferisce a quello.
 // Esclusione del solo prezzo («non cambiare il prezzo di boh, è finito»): senza un piatto nel resto il soggetto è quello negato.
 const cl=rest.match(/\b(?:mettil[aoie]|fall[aoie]|portal[aoie]|toglil[aoie]|nascondil[aoie]|segnal[aoie]|cambial[aoie])\b/i),head0=cl?rest.slice(0,cl.index):'',clitic=!!cl&&!(words(head0).length&&findDishes(head0,refs).length)
 // Il resto nomina un piatto o un gruppo se almeno una parola distintiva è di un piatto o di una categoria, o se è un'aggiunta.
 const restNamesDish=!!words(rest).length&&(findDishes(rest,refs).length>0||preselect(rest,refs,1).length>0||words(rest).some(w=>w.length>=4&&categoryItems(w,refs).length>0)||/\b(?:aggiung\w*|inserisc\w*|nuov[oa])\b/.test(plainText(rest)))
 // «la carbonara resta così, ma è finita»: il resto senza piatto parla del piatto della clausola, che quindi non è negato.
 // Mai per una negazione esplicita («non cambiare boh, mettilo a 25»: boh resta escluso, anche se il resto lo contraddice).
 if(rest&&!restNamesDish&&!used.some(h=>h.kinds||h.keepText||h.strong)&&actionish.test(plainText(rest))&&!/^(?:ok|grazie|va bene|basta|niente)\b/.test(plainText(rest)))return null
 const orphan=used.some(h=>h.kinds)&&!restNamesDish
 return{rest,excluded,names:[...new Set(names)],strip:!keep&&!clitic&&!orphan}
}
export const isExcluded=(a:{kind:string,id?:string},ex:Excluded[])=>'id' in a&&!!a.id&&ex.some(e=>e.id===a.id&&(!e.kinds||e.kinds.includes(a.kind)))

/** «boh, mettiamo la carbonara a 13»: un intercalare in testa («boh», «mah», «beh») non è un piatto se il resto è un comando
 * su un altro piatto, anche quando nel menu c'è un piatto con quel nome. Restituisce il resto, o null. */
export function leadingInterjection(raw:string,refs:MenuRef[]):string|null{
 const m=raw.match(/^\s*(?:boh|bho|mah|beh|ehm|uhm|mh+)\s*[,.!…]+\s*(.+)$/i);if(!m)return null
 const rest=m[1]!.trim();return actionish.test(plainText(rest))&&words(rest).length&&(findDishes(rest,refs).length||preselect(rest,refs,1).length)?rest:null}

/** Con un riepilogo in attesa: «ok grazie» → «ok», «annulla, no anzi conferma» → «conferma» (l'ultima parola vale). */
export function confirmCleanup(raw:string):string{let t=raw.trim().replace(/\s*[,.!]*\s*(?:grazie(?: mille| tante)?|perfetto|ciao|dai)\s*[.!]*$/i,'');const m=t.match(/^(?:annulla|no)[\s,]+(?:no[\s,]+)?anzi[\s,]+(.+)$/i);if(m)t=m[1]!;return t.trim()}

// ---------------- Risposte brevi ----------------
export const actionish=/\b(costa|costano|euro|prezzo|metti\w*|porta\w*|cambia\w*|finit\w*|esaurit\w*|tornat\w*|disponibil\w*|nascond\w*|togli\w*|mostra|rimetti|evidenza|promo\w*|offert\w*|aggiung\w*|inserisc\w*|elimin\w*|cancell\w*|sposta\w*|foto|descrizione|scrivi|annulla|conferma|ok|si|no|grazie|piccant\w*|vegan\w*|ultime|porzion\w*|oggi|stasera|domani|non)\b/
/** Messaggio fatto solo di un nome di piatto («la carbonara», «Piatto di verifica», «quella al forno»). */
export function bareDish(raw:string,refs:MenuRef[]):MenuRef[]{
 const t=plainText(raw).replace(/[,.!?]+/g,' ').replace(/\s+/g,' ').trim().replace(/^(?:e |ma |allora |intendevo |volevo dire |dico |parlo de(?:l|lla|i|gli|lle) )+/,'').replace(/^(?:il|lo|la|l|i|gli|le|quello|quella|quelli|quelle)\s+/,'')
 if(!t)return[]
 // Nome completo esatto, anche con cifre («Acqua 0,5 l», «Pizza 4 formaggi»).
 const exact=refs.filter(r=>plainText(r.name).replace(/[,.!?]+/g,' ').replace(/\s+/g,' ').trim()===t);if(exact.length)return exact
 if(/\d/.test(t)||t.split(' ').length>7||actionish.test(t)||!words(t).length)return[]
 const hits=findDishes(t,refs);if(!hits.length)return[]
 // Tutte le parole del messaggio devono appartenere al nome o alla categoria del piatto trovato.
 return hits.filter(r=>ownsAll(t,r))
}
/** Risposta a «Quale piatto intendi?» che non è una delle opzioni ma ha la forma di una risposta (nome, numero, ordinale). */
export function looksLikeAnswer(raw:string,refs:MenuRef[]):string|null{
 const t=plainText(raw).replace(/[,.!?]+/g,' ').replace(/\s+/g,' ').trim()
 if(/^(?:il |la |l )?(?:numero )?\d{1,2}$|^(?:il |la |l )?(?:prim|second|terz|quart|quint)[oa]$/.test(t))return raw.trim()
 const dish=bareDish(raw,refs);return dish.length?dish[0]!.name:null
}
/** «tutti e due», «entrambi», «tutti»: la risposta vale per tutte le opzioni proposte (null se non è questa forma). */
export function allOptions(raw:string,count:number):boolean{const t=plainText(raw).replace(/[,.!?]+/g,' ').replace(/\s+/g,' ').trim().replace(/^(?:ok |si |allora )+/,'').replace(/ (?:grazie|per favore)$/,'')
 if(/^(?:tutti e due|tutte e due|tutti e 2|tutte e 2|entrambi|entrambe|ambedue|tutti e due quanti|tutt e due)$/.test(t))return count===2
 return /^(?:tutti|tutte|tutti quanti|tutte quante|tutti i piatti)$/.test(t)&&count>=2}
/** Risposta a «quale prezzo: 13 o 14?»: uno dei due valori, in cifre o in lettere, o «il primo/il secondo». */
export function pickPrice(raw:string,prices:number[]):number|null|'other'{
 const t=plainText(raw).replace(/(\d),(\d)/g,'$1.$2').replace(/[,!?]+/g,' ').replace(/\s+/g,' ').trim().replace(/\.$/,'')
 if(/^(?:il |la |l )?(?:prim[oa]|1)$/.test(t))return prices[0]??null;if(/^(?:il |la |l )?(?:second[oa]|2)$/.test(t)&&prices.length>1&&!prices.includes(2))return prices[1]??null
 const m=t.match(/^(?:(?:ok|si|no|scusa|anzi|va bene|allora|metti|mettilo|mettila|fai|fallo|falla|facciamo|a|il prezzo|prezzo)\s+)*(\d+(?:\.\d{1,2})?|[a-z]+(?: e (?:mezzo|cinquanta|\w+))?)(?:\s*euro)?(?:\s+(?:grazie(?: mille| tante)?|va bene|ok|perfetto|ciao|dai|allora))*$/)
 if(!m)return null
 let v:number|null=/^\d/.test(m[1]!)?Number(m[1]):null
 if(v===null){const [a,,b]=m[1]!.split(' ');const x=numberWord(a!);if(x===null)return null;v=x;if(b){const c=b==='mezzo'?50:numberWord(b);if(c===null||c>=100)return null;v=x+c/100}}
 // Un prezzo diverso dalle due opzioni («13,50» o «4» dopo «13 o 14?») non si applica: si ripete la domanda (scelta conservativa).
 v=Math.round(v*100)/100;return prices.includes(v)?v:'other'
}
