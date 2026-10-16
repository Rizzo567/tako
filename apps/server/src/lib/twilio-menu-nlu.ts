// Comprensione deterministica lato server: riconosce le frasi comuni e preseleziona i piatti senza chiamare l'IA.
import type {MenuRef,SectionRef} from './twilio-menu-ai.js'
import {capabilities,helpWords} from './twilio-menu-copy.js'
import {parseMenuCommand} from './twilio-menu-command.js'
export const plainText=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/€/g,' euro ').replace(/[^a-z0-9,.]+/g,' ').replace(/\s+/g,' ').trim()
const stop=new Set('il lo la i gli le l un uno una di da del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle con col coi sul sulla e ed o a in per tra fra che mi ci si ti oggi niente piu non c e sono costa costano euro eur prezzo metti mettila mettilo mettili mettile porta portala portalo cambia imposta finito finita finiti finite esaurito esaurita esauriti esaurite tornato tornata tornati tornate disponibile disponibili nascondi togli rimetti mostra menu evidenza piatto piatti scrivi quanto cosa ancora adesso ora stasera domani grazie ciao per favore perfavore anche pure'.split(' '))
export const stem=(w:string)=>w.length>4?w.replace(/[aeiou]+$/,''):w
const lev=(a:string,b:string)=>{if(Math.abs(a.length-b.length)>1)return 2;const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=d[0]!;d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j]!;d[j]=Math.min(d[j]!+1,d[j-1]!+1,prev+(a[i-1]===b[j-1]?0:1));prev=t}}return d[b.length]!}
export const sameWord=(a:string,b:string)=>a===b||stem(a)===stem(b)||(a.length>=5&&b.length>=5&&(lev(a,b)<=1||a.startsWith(b)||b.startsWith(a)))
export const words=(s:string)=>plainText(s).replace(/[,.]/g,' ').split(' ').filter(w=>w.length>=2&&!stop.has(w)&&!/^\d+$/.test(w))
const nameWords=(s:string)=>plainText(s).replace(/[,.]/g,' ').split(' ').filter(w=>w.length>=2&&!['il','lo','la','i','gli','le','di','da','del','della','dei','delle','al','alla','alle','ai','agli','con','e','o','a','in','con','allo','dello'].includes(w))
// Piatti che contengono tutte le parole della richiesta (nome o categoria, almeno una nel nome). Un nome coperto per intero vince.
export function matchDishes(query:string,refs:MenuRef[],same:(a:string,b:string)=>boolean=sameWord):MenuRef[]{
 const q=words(query);if(!q.length)return[]
 const hits=refs.filter(r=>{const name=nameWords(r.name),section=nameWords(r.section??'');return q.every(w=>name.some(n=>same(w,n))||section.some(n=>same(w,n)))&&q.some(w=>name.some(n=>same(w,n)))})
 const exact=hits.filter(r=>nameWords(r.name).every(n=>q.some(w=>same(w,n))));if(!exact.length)return hits
 // Nome generico di una parola («Margherita»): anche i piatti che lo contengono per intero («Mezzo metro Margherita») restano in gioco.
 const wider=exact.length===1&&nameWords(exact[0]!.name).length<=1?hits.filter(r=>r!==exact[0]&&nameWords(exact[0]!.name).every(n=>nameWords(r.name).some(m=>sameWord(n,m)))):[];return[...exact,...wider]
}
// Chiave fonetica dell'italiano scritto o dettato: gli/li/j → i, ch/c dura/q/k → k, gh → g, h muta, z/x → s, y → i, doppie scempie, desinenza vocalica tolta.
export const soundKey=(w:string)=>{const k=w.replace(/gli/g,'li').replace(/li(?=[aeou])/g,'i').replace(/j/g,'i').replace(/ch/g,'k').replace(/gh/g,'g').replace(/c(?=[aouk]|$)/g,'k').replace(/q/g,'k').replace(/h/g,'').replace(/[zx]/g,'s').replace(/y/g,'i').replace(/w/g,'v').replace(/(.)\1+/g,'$1');return k.length>3?k.replace(/[aeiou]+$/,''):k}
// Distanza di edit con lo scambio di due lettere vicine contato come un solo errore («merigna» → «meringa»).
const swaps=(a:string,b:string)=>{const d=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){const c=a[i-1]===b[j-1]?0:1;d[i]![j]=Math.min(d[i-1]![j]!+1,d[i]![j-1]!+1,d[i-1]![j-1]!+c);if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i]![j]=Math.min(d[i]![j]!,d[i-2]![j-2]!+1)}return d[a.length]![b.length]!}
// Parola simile per il ripiego: parole di almeno 5 lettere, stesso inizio fonetico (2 lettere, 1 per chiavi lunghe), lunghezze quasi uguali.
// Errori ammessi sulla chiave: 0 fino a 4 lettere («pan»: pane ≠ panna ≠ penne; «orar» ≠ «orat»), 1 fino a 6 («rufol»→«rukol»), 2 oltre («margarit»→«margerit»).
export const nearWord=(a:string,b:string)=>{if(sameWord(a,b))return true;if(a.length<5||b.length<4)return false;const ka=soundKey(a),kb=soundKey(b);if(ka===kb)return ka.length>=4;const n=Math.min(ka.length,kb.length),max=n<=4?0:n<=6?1:2,head=n>=7?1:2;return max>0&&ka.slice(0,head)===kb.slice(0,head)&&Math.abs(ka.length-kb.length)<=1&&swaps(ka,kb)<=max}
// Ripiego senza IA quando il match normale non trova niente: stessa regola (tutte le parole, nome coperto per intero vince), parole tolleranti a errori di battitura e dettatura.
export function fuzzyDishes(query:string,refs:MenuRef[]):MenuRef[]{return matchDishes(query,refs,nearWord)}
export function findDishes(query:string,refs:MenuRef[]):MenuRef[]{const hits=matchDishes(query,refs);return hits.length?hits:fuzzyDishes(query,refs)}
// Preselezione per l'IA: piatti con almeno una parola in comune, ordinati per numero di parole nel nome.
export function preselect(text:string,refs:MenuRef[],max=12):MenuRef[]{
 const q=words(text);if(!q.length)return[]
 return refs.map(r=>{const name=nameWords(r.name),section=nameWords(r.section??'');return{r,score:q.reduce((s,w)=>s+(name.some(n=>sameWord(w,n))?2:section.some(n=>sameWord(w,n))?0.5:0),0)}}).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score).slice(0,max).map(x=>x.r)
}
export type Intent={kind:'price',target:string,price:number}|{kind:'available'|'hidden'|'featured',target:string,value:boolean}|{kind:'description',target:string,text:string}|{kind:'tag',target:string,tag:string}|{kind:'read',read:'unavailable'|'hidden'}|{kind:'ask',target:string}|{kind:'capability',ids:string[]}
const num='(\\d+(?:[.,]\\d{1,2})?)'
const amount=(s:string)=>{const n=Number(s.replace(',','.'));return Number.isFinite(n)&&n>=0&&n<=100000?Math.round(n*100)/100:null}
const capabilityWords:[RegExp,string][]=[[/allergen/,'allergens'],[/\b(elimin|cancell|rimuov|cancel)\w*/,'delete'],[/rinomin|\bcambi\w* (il |i )?nom/,'rename'],[/tutti i (prezzi|piatti)|tutto il menu|in blocco|per ?cento|%/,'bulk'],[/grafic|\bcolor|\bfont\b|impagin|\blogo\b|sfondo/,'graphics'],[/categori|sezion/,'categories'],[/tradu|ingles|lingu/,'translations'],[/\bfoto|immagin/,'photo'],[/vocal|audio/,'voice']]
// Richiesta di aiuto in qualunque forma («dimmi un po' tutto quello che sai fare», «mi spieghi come funzioni», «cosa sa fare»), mai se la frase contiene già un'azione sul menu.
export function isHelpRequest(raw:string){
 const t=' '+plainText(raw).replace(/[,.]/g,' ').replace(/\s+/g,' ').trim()+' '
 if(/\d|\b(ignora|costa|costano|finit\w*|esaurit\w*|tornat\w*|nascondi|togli|rimetti|evidenza|aggiungi|prezzo|scrivi)\b/.test(t))return false
 return /\b(cosa|che cosa|che|cos|quali cose)\b( \w+){0,4} (sai|sa|sapete|puoi|puo|potete|posso|riesci|fai|fa|fate)( \w+){0,2} (fare|fai|chiederti|chiederle|chiedere|domandarti|gestire|cambiare|farmi)\b/.test(t)
  ||/\b(che|cosa) (fai|fa|sai fare|puoi fare)\s*$/.test(t)
  ||/\bcome (funzion\w*|si usa|ti uso|usarti|ti si usa|lavori|ti devo scrivere|ti scrivo)\b/.test(t)
  ||/\b(aiut\w*|help|istruzion\w*|comand\w*|funzion(i|alita)|menu comandi|guida|tutorial|spiegami|mi spieghi|spiegazion\w*)\b/.test(t)
}
export function capabilityFromText(raw:string):string[]|null{
 const t=plainText(raw).replace(/[,.]/g,' ').replace(/\s+/g,' ').trim();if(/tutti i (prezzi|piatti)|tutto il menu|in blocco|per ?cento|%/.test(t+raw))return['bulk'];if(helpWords.includes(t)||isHelpRequest(raw))return['all']
 const question=/\?\s*$/.test(raw)||/^(puoi|potresti|sai|posso|riesci|si puo|e possibile|come (faccio|si fa)|si possono)\b/.test(t),imperative=/^(elimina|cancella|rimuovi|rinomina) \w+/.test(t)
 if(/tutti i (prezzi|piatti)|tutto il menu|in blocco|per ?cento|%/.test(t+raw))return['bulk'];if(!question&&!imperative)return null;const ids=capabilityWords.filter(([r])=>r.test(t)).map(([,id])=>id);return ids.length?[...new Set(ids)].slice(0,2):null
}
// Frasi comuni con un solo piatto: niente IA. Le frasi composte («… e …») restano all'IA.
export function parseIntent(raw:string):Intent|null{
 const original=raw.trim(),t=plainText(raw).replace(/(?<!\d)[,.]|[,.](?!\d)/g,' ').replace(/\s+/g,' ').trim()
 if(/^(cosa|che cosa|quali piatti|quali|che piatti) (e|sono|ci sono|risultano) (gia )?(finit|esaurit)\w*/.test(t)||/^(cosa|che cosa) (manca|non c e)/.test(t))return{kind:'read',read:'unavailable'}
 if(/^(cosa|che cosa|quali piatti|quali) (e|sono) nascost\w*/.test(t))return{kind:'read',read:'hidden'}
 const description=original.match(/^(?:nella|nel|nello|nei|negli|nelle|per (?:la|il|lo|i|gli|le)|alla|al|allo)\s+(.+?)\s+scrivi\s*:\s*(.+)$/i);if(description)return{kind:'description',target:description[1]!,text:description[2]!.trim()}
 let m:RegExpMatchArray|null
 if((m=t.match(/^quanto (?:costa|costano|viene|vengono) (.+)$/)))return{kind:'ask',target:m[1]!}
 if((t.match(/\b(costa|costano|finit\w*|esaurit\w*|tornat\w*|nascondi|togli|rimetti|evidenza|mettil\w*|portal\w*|disponibil\w*|niente)\b/g)||[]).length>=2&&!/^oggi niente [a-z ]+ (finit|esaurit)\w*$/.test(t))return null
 if((m=t.match(new RegExp(`^(?:prezzo |(?:metti|porta|cambia|imposta)(?: il prezzo (?:di|del|della|dei|delle))? )(.+?) (?:a|=) ${num}(?: euro)?$`)))||(m=t.match(new RegExp(`^(.+?) (?:costa|costano|viene|vengono|(?:mettil|portal)[aeio](?: a)?|a) ${num}(?: euro)?$`)))){const price=amount(m[2]!);return price===null?null:{kind:'price',target:m[1]!,price}}
 if((m=t.match(/^(?:e |sono )?(?:finit|esaurit)[oaie] (.+)$/))||(m=t.match(/^(.+?) (?:e|sono) (?:gia )?(?:finit|esaurit)[oaie]$/))||(m=t.match(/^oggi niente (.+?)(?: (?:e )?(?:finit|esaurit)[oaie])?$/))||(m=t.match(/^(?:non c e piu|non ce piu|non abbiamo piu) (.+)$/))||(m=t.match(/^(.+?) non (?:c e|ce) piu$/))||(m=t.match(/^(?:esaurito|finito) (.+)$/)))return{kind:'available',target:m[1]!,value:false}
 if((m=t.match(/^(.+?) (?:e|sono) (?:tornat[oaie]|di nuovo disponibil[ei]|disponibil[ei]|ritornat[oaie])$/))||(m=t.match(/^(?:e |sono )?(?:tornat[oaie]|ritornat[oaie]) (.+)$/))||(m=t.match(/^(?:disponibile|rendi disponibile|di nuovo disponibile) (.+)$/)))return{kind:'available',target:m[1]!,value:true}
 if((m=t.match(/^(?:togli|leva) (?:dall evidenza|dalla evidenza|dai piatti in evidenza) (.+)$/)))return{kind:'featured',target:m[1]!,value:false}
 if((m=t.match(/^metti in evidenza (.+)$/))||(m=t.match(/^(.+?) in evidenza$/)))return{kind:'featured',target:m[1]!,value:true}
 if((m=t.match(/^(?:nascondi|togli|leva)(?: dal menu)? (.+?)(?: dal menu)?$/)))return{kind:'hidden',target:m[1]!,value:true}
 if((m=t.match(/^(?:rimetti|mostra)(?: nel menu)? (.+?)(?: nel menu)?$/)))return{kind:'hidden',target:m[1]!,value:false}
 if((m=t.match(/^(.+?) (?:e|sono) (piccant|vegetarian|vegan|biologic|surgelat)[oaie]$/)))return{kind:'tag',target:m[1]!,tag:{piccant:'piccante',vegetarian:'vegetariano',vegan:'vegano',biologic:'biologico',surgelat:'surgelato'}[m[2]!]!}
 return null
}
const ordinals:[RegExp,number][]=[[/^(1|uno|il primo|la prima|primo|prima|l primo)$/,0],[/^(2|due|il secondo|la seconda|secondo|seconda)$/,1],[/^(3|tre|il terzo|la terza|terzo|terza)$/,2],[/^(4|quattro|il quarto|la quarta|quarto|quarta)$/,3],[/^(5|cinque|il quinto|la quinta|quinto|quinta)$/,4],[/^(6|sei|il sesto|la sesta)$/,5],[/^(7|sette|il settimo|la settima)$/,6],[/^(8|otto|l ottavo|l ottava)$/,7]]
// Risposta a «Quale intendi?»: numero, ordinale o nome tra le opzioni proposte.
export function resolveChoice(raw:string,options:MenuRef[]):MenuRef|null{
 const t=plainText(raw).replace(/[.,!?]+/g,' ').replace(/\s+/g,' ').trim().replace(/^(il|la|lo|i|gli|le|l|quello|quella|quelli|quelle|numero)\s+/,'').trim()
 for(const [r,i] of ordinals)if(r.test(t)||r.test(plainText(raw).replace(/[.,!?]+/g,'').trim()))return options[i]??null
 const hits=findDishes(raw,options);return hits.length===1?hits[0]!:null
}
export const wantsCreateText=(m:string)=>/\b(aggiung\w*|inserisc\w*|inserire|nuov[oa]|crea\w*)\b/.test(plainText(m))
export const wantsSpecialText=(m:string)=>/\b(del giorno|di oggi)\b/.test(plainText(m))
export const looksLikeQuestion=(m:string)=>/\?\s*$/.test(m)||/^(puoi|potresti|sai|posso|riesci|come|cosa|che|quali|quanto|quando|si puo|e possibile)\b/.test(plainText(m))
export const capabilityIds=capabilities.map(c=>c.id)
export const sectionsFor=(sections:SectionRef[])=>sections.slice(0,60)
// Candidati per l'IA: prima i piatti riconosciuti frase per frase («X è finita e Y mettila a 25»), altrimenti la preselezione larga.
export function candidatesFor(text:string,refs:MenuRef[],max=12):MenuRef[]{
 const found=new Map<string,MenuRef>();let unresolved=false
 for(const clause of plainText(text).split(/\s(?:e|poi|invece|mentre)\s|[;,]\s?(?!\d)/).map(c=>c.trim()).filter(Boolean)){if(!words(clause).length)continue;const hits=findDishes(clause,refs);if(!hits.length||hits.length>4){unresolved=true;continue}for(const r of hits)found.set(r.id,r)}
 return found.size&&!unresolved?[...found.values()].slice(0,max):[...new Map([...found.values(),...preselect(text,refs,max)].map(r=>[r.id,r])).values()].slice(0,max)
}
export const isThanks=(raw:string)=>/^(ok |okay |perfetto |benissimo |ottimo |va bene )?(grazie|grazie mille|grazie tante|ti ringrazio)( mille| tante| ciao)?$/.test(plainText(raw).replace(/[,.!]/g,' ').replace(/\s+/g,' ').trim())
type ChangeIntent=Exclude<Intent,{kind:'read'}|{kind:'ask'}|{kind:'capability'}>
// Frasi composte risolte senza IA quando ogni pezzo è un comando chiaro su un solo piatto: «le vongole sono finite e la tagliata coi porcini mettila a 25».
export function compoundIntents(raw:string,refs:MenuRef[]):{intent:ChangeIntent,ref:MenuRef}[]|null{
 const t=plainText(raw).replace(/(?<!\d)[,.]|[,.](?!\d)/g,' e ').replace(/\s+/g,' ').replace(/( e)+ /g,' e ').trim()
 const one=(part:string,previous?:ChangeIntent):{intent:ChangeIntent,ref:MenuRef}|null=>{let intent=parseIntent(part) as Intent|null;if(!intent&&previous?.kind==='price'){const m=part.match(/^(.+?) (?:a )?(\d+(?:[.,]\d{1,2})?)(?: euro)?$/);const price=m?Number(m[2]!.replace(',','.')):NaN;if(m&&price>=0&&price<=100000)intent={kind:'price',target:m[1]!,price:Math.round(price*100)/100}}
  if(!intent||!('target' in intent)||intent.kind==='ask')return null;const hits=findDishes(intent.target,refs);return hits.length===1?{intent:intent as ChangeIntent,ref:hits[0]!}:null}
 const walk=(rest:string,previous:ChangeIntent|undefined,depth:number):{intent:ChangeIntent,ref:MenuRef}[]|null=>{if(depth>5)return null;const whole=depth>0?one(rest,previous):null;if(whole)return[whole]
  for(const m of rest.matchAll(/ e /g)){const left=one(rest.slice(0,m.index),previous);if(!left)continue;const right=walk(rest.slice(m.index!+3),left.intent,depth+1);if(right)return[left,...right]}return null}
 return / e /.test(t)?walk(t,undefined,0):null
}
// Separatori di frase composta («e», virgola, «;», a capo). Quelli che fanno parte del nome di un piatto del menu
// («Pasta e fagioli», «Piatto live E») non rendono composta la frase: «prezzo Pasta e fagioli a 9» è un comando semplice.
const compoundSeparator=/(?<!\d),(?!\d)|[;\n]|\s+e\s+/i
// Lowercase only: accents are kept, «è» (verb) must never become the separator «e».
const lowerPlain=(s:string)=>s.normalize('NFC').toLowerCase()
export function maskDishNames(raw:string,refs:MenuRef[]){
 let t=lowerPlain(raw)
 const names=[...new Set(refs.map(r=>lowerPlain(r.name).replace(/\s+/g,' ').trim()).filter(n=>n&&compoundSeparator.test(n)))].sort((a,b)=>b.length-a.length)
 for(const n of names)t=t.replace(new RegExp(`(?<![\\p{L}\\d])${n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+')}(?![\\p{L}\\d])`,'giu'),' piatto ')
 return t
}
const completePart=(part:string)=>!!parseMenuCommand(part)||!!parseIntent(part)||/^\s*\S.*?\s(?:a|=)\s*(?:€\s*)?\d+(?:[.,]\d{1,2})?\s*(?:€|euro)?\s*$/i.test(part)
/** Frase da trattare come composta: c'è un separatore che non appartiene a un nome di piatto e, se l'intero messaggio è
 * già un comando semplice, ogni pezzo è a sua volta un comando completo («prezzo Burger a 12 e Tiramisu a 6»). */
export function isCompoundMessage(raw:string,refs:MenuRef[]){
 const masked=maskDishNames(raw,refs);if(!compoundSeparator.test(masked))return false
 if(!parseMenuCommand(raw))return true
 const parts=masked.split(new RegExp(compoundSeparator.source,'gi')).map(x=>x.trim()).filter(Boolean)
 return parts.length>1&&parts.every(completePart)
}
