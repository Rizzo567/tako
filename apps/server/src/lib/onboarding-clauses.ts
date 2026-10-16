// Deterministic reading of a chat/menu text: prices (also in words), «da X a Y», relative changes, what each clause
// asks for a dish, and the coverage guardrail. Pure functions: no provider, no network.
// Invariant for chat messages: every clause with a price or an action verb ends up (a) applied with a value that is
// literally in the text, (b) a simple question, or (c) «non posso farlo da qui». Never a deduced value, never silence.
import type {OnboardingMenuRow,OnboardingRowIntent} from './onboarding-planner.js'
import {onboardingDishKey,mentionsOnboardingDish,sameOnboardingDish} from './onboarding-dish-name.js'
const includes=(source:string,value:string)=>source.toLocaleLowerCase('it').includes(value.toLocaleLowerCase('it'))
const italianPriceWords=new Map<string,number>(['zero','uno','due','tre','quattro','cinque','sei','sette','otto','nove','dieci','undici','dodici','tredici','quattordici','quindici','sedici','diciassette','diciotto','diciannove'].map((word,n)=>[word,n]))
for(const [base,word] of [[20,'venti'],[30,'trenta'],[40,'quaranta'],[50,'cinquanta'],[60,'sessanta'],[70,'settanta'],[80,'ottanta'],[90,'novanta']] as const){italianPriceWords.set(word,base);for(let n=1;n<10;n++){const unit=[...italianPriceWords].find(([,value])=>value===n)![0];italianPriceWords.set((n===1||n===8?word.slice(0,-1):word)+unit,base+n)}}
italianPriceWords.set('cento',100);italianPriceWords.set('un',1)
const words=[...italianPriceWords.keys()].sort((a,b)=>b.length-a.length).join('|')
/** «un euro e cinquanta», «dodici euro»: amounts written in words. */
export function wordAmounts(tail:string){const found:number[]=[];for(const match of tail.toLowerCase().matchAll(new RegExp(`(?<![\\p{L}])(${words})\\s+(?:euro|euri)(?:\\s+e\\s+(${words})(?:\\s+centesimi)?)?`,'gu'))){const n=italianPriceWords.get(match[1]!);if(n===undefined)continue;const cents=match[2]?italianPriceWords.get(match[2]):undefined;found.push(n+(cents===undefined?0:cents/100))}return found}
// A number followed by a unit is a size, not a price («0,33 l», «2 pezzi», «30 cm», «12 ore»).
const unit=/^\s*(?:l|lt|cl|ml|g|gr|kg|pz|pezzi|pezzo|cm|ore|h|min|minuti|°|%|x|persone|porzioni)(?![\p{L}])/iu
/** Digit amounts in a text, sizes excluded. */
export function digitAmounts(tail:string){const found:number[]=[];for(const m of tail.matchAll(/(?:^|[^\p{L}\d.,])(?:€\s*)?(\d{1,6}(?:[.,]\d{1,2})?)(?![\d.,])(?:\s*(?:€|euro|euri))?/gu)){const after=tail.slice(m.index!+m[0].length);if(!/(?:€|euro|euri)\s*$/i.test(m[0])&&unit.test(after))continue;found.push(Number(m[1]!.replace(',','.')))}return found}
export const onboardingAmounts=(tail:string)=>[...digitAmounts(tail),...wordAmounts(tail)]
const amountToken=`(\\d{1,6}(?:[.,]\\d{1,2})?|${words})`
const cur='\\s*(?:€|euro|euri)?'
const fromTo=new RegExp(`^[\\s,:]*(?:(?:passa|passare|va|portalo|portala)\\s+)?da\\s+(?:€\\s*)?${amountToken}${cur}\\s+a\\s+(?:€\\s*)?${amountToken}${cur}`,'iu')
const notButPrice=new RegExp(`^[\\s,:]*non\\s+(?:costa|è|e'|vale|fa)(?:\\s+più)?\\s+(?:€\\s*)?${amountToken}${cur}\\s*,?\\s+(?:ma|bensì)\\s+(?:€\\s*)?${amountToken}${cur}`,'iu')
const insteadOf=new RegExp(`^[\\s,:]*(?:costa|è|e'|va|a|adesso è|ora è)?\\s*(?:a\\s+)?(?:€\\s*)?${amountToken}${cur}\\s*,?\\s+(?:anziché|anzichè|invece di|al posto di|e non(?: più)?)\\s+(?:€\\s*)?${amountToken}${cur}`,'iu')
const amount=(token:string)=>/^\d/.test(token)?Number(token.replace(',','.')):italianPriceWords.get(token.toLowerCase())
/** «da 12 a 13 euro», «non costa 12 ma 13», «13 euro anziché 12» right after the dish: from → to. */
export function onboardingPriceChange(tail:string):{from:number;to:number}|null{
 const m=tail.match(fromTo)||tail.match(notButPrice);if(m){const from=amount(m[1]!),to=amount(m[2]!);return from===undefined||to===undefined?null:{from,to}}
 const r=tail.match(insteadOf);if(r){const to=amount(r[1]!),from=amount(r[2]!);return from===undefined||to===undefined?null:{from,to}}
 return null
}
// Relative changes: never an absolute price. Direction from the words; without a direction it is a question.
const relativeUp=/(?<![\p{L}])(?:alza\p{L}*|aument\p{L}*|rincar\p{L}*|sale|in\s+più|in\s+piu|aggiungi\s+(?:€\s*)?\d)/iu,relativeDown=/(?<![\p{L}])(?:abbass\p{L}*|diminui\p{L}*|riduc\p{L}*|ridurre|scende|sconto|in\s+meno|togli\p{L}*|lev[ai]\p{L}*)/iu
const relativeAmount=new RegExp(`(?<![\\p{L}])(?:di|per)\\s+(?:€\\s*)?${amountToken}${cur}|${amountToken}${cur}\\s+in\\s+(?:più|piu|meno)|(?<![\\p{L}])(?:togli|leva|aggiungi|sconto\\s+di)\\s+(?:€\\s*)?${amountToken}\\s*(?:€|euro|euri)`,'iu')
export function onboardingRelativePrice(clause:string):{delta:number}|{ambiguous:true}|null{
 const m=clause.match(relativeAmount);if(!m)return null
 const value=amount((m[1]||m[2]||m[3])!);if(value===undefined)return {ambiguous:true}
 const up=relativeUp.test(clause),down=relativeDown.test(clause)
 if(/(?<![\p{L}])(?:di|per)\s/iu.test(m[0])&&!up&&!down)return null // «Pizza di 30 cm», «menu per 2»: not a relative price
 return up===down?{ambiguous:true}:{delta:up?value:-value}
}
// Intent markers. keep: never creates/changes. change: update an existing dish. set: «metti/costa/va a/è» — update if it
// exists, otherwise add. add: create. remove/move/rename: their own operations. none: «non aggiungere» (nothing to do).
const W='(?<![\\p{L}])',E='(?![\\p{L}])'
const clitic='(?:lo|la|li|le)?'
const keepMarker=new RegExp(`${W}(?:mant(?:ie|e)n+(?:i|ere|ete|endo|iamo)${clitic}|tien[ie]${clitic}|tenete|tenere|teniamo|lascia(?:te|re|ndo)?${clitic}|conserva(?:te|re)?${clitic}|conferm(?:a|o|iamo|ate)${clitic}|non\\s+(?:cambia\\p{L}*|modific\\p{L}*|tocca\\p{L}*|aggiorna\\p{L}*|varia\\p{L}*|sposta\\p{L}*))${E}`,'giu')
const changeMarker=new RegExp(`${W}(?<!non\\s)(?:cambia(?:te|re)?${clitic}|camba|modifica(?:te|re)?${clitic}|correggi${clitic}|correggete|aggiorna(?:te|re)?${clitic}|porta(?:te|re)?${clitic}|porto|alza(?:te|re)?${clitic}|abbassa(?:te|re)?${clitic}|imposta${clitic}|passa|sale|scende|rimetti${clitic}|riporta${clitic}|ripristina${clitic})${E}`,'giu')
const setMarker=new RegExp(`${W}(?<!non\\s)(?:metti${clitic}|mettete|costa(?:no)?|diventa|va\\s+a|vanno\\s+a)${E}|prezzo\\s+(?:corretto|giusto|nuovo|aggiornato)|nuovo\\s+prezzo`,'giu')
const addMarker=new RegExp(`${W}(?<!non\\s)(?:aggiungi${clitic}|aggiungete|aggiungere|inserisci${clitic}|inserite|crea|create|creare)${E}`,'giu')
const removeMarker=new RegExp(`${W}(?<!non\\s)(?:elimin\\p{L}*|togli${clitic}|togliete|toglier\\p{L}*|cancell\\p{L}*|rimuov\\p{L}*|rimuovi${clitic}|lev[ai]${clitic}|levare)${E}`,'giu')
const moveMarker=new RegExp(`${W}(?<!non\\s)(?:sposta(?:te|re)?${clitic})${E}`,'giu')
const renameMarker=new RegExp(`${W}(?<!non\\s)(?:rinomin\\p{L}*|cambia(?:re)?\\s+(?:il\\s+)?nome)${E}`,'giu')
const noneMarker=new RegExp(`${W}non\\s+(?:aggiung\\p{L}*|inserir\\p{L}*|inserisc\\p{L}*|metter\\p{L}*|crear\\p{L}*)${E}`,'giu')
const keepAfter=new RegExp(`^\\s*(?:a\\s+\\S+\\s+(?:euro|€)\\s*)?(?:${W}(?:invariat[oaie]|rest(?:a|ano)|riman(?:e|gono)|va\\s+bene|vanno\\s+bene|com['’]\\s?è|così\\s+com['’]\\s?è)${E})`,'iu')
const setAfter=new RegExp(`^\\s*(?:adesso|ora|oggi|da\\s+oggi)?\\s*(?:è|e'|sarà|viene)${E}`,'iu')
// Clause boundaries. A comma between digits is a decimal separator («12,50»), not a boundary.
const boundary=/(?<!\d),|,(?!\d)|:|\s(?:ma|però|pero|tranne|eccetto|salvo|invece|mentre|e|ed|poi|anche)\s/giu
const exception=/^\s*(?:tranne|eccetto|salvo)\s/i
export function sentenceStart(source:string,at:number){let i=at-1;for(;i>=0;i--){const c=source[i]!;if(';!?\n'.includes(c))break;if(c==='.'&&!(/\d/.test(source[i-1]||'')&&/\d/.test(source[i+1]||'')))break}return i+1}
export function sentenceEnd(source:string,at:number){let i=at;for(;i<source.length;i++){const c=source[i]!;if(';!?\n'.includes(c))break;if(c==='.'&&!(/\d/.test(source[i-1]||'')&&/\d/.test(source[i+1]||'')))break}return i}
type Marker={i:number;intent:OnboardingRowIntent}
const markerKinds:[RegExp,OnboardingRowIntent][]=[[keepMarker,'keep'],[changeMarker,'change'],[setMarker,'set'],[addMarker,'add'],[removeMarker,'remove'],[moveMarker,'move'],[renameMarker,'rename'],[noneMarker,'none']]
const markersIn=(text:string):Marker[]=>markerKinds.flatMap(([re,intent])=>[...text.matchAll(re)].map(m=>({i:m.index!,intent}))).sort((a,b)=>a.i-b.i)
export type OnboardingClauseInfo={intent:OnboardingRowIntent|null;inherited:boolean;clause:string}
/** Intent for one dish occurrence, decided per clause: the verb of its own clause (before it, then after it), else the
 * last verb earlier in the sentence (inherited); «tranne X» after a negation is a change. */
export function onboardingIntentAt(source:string,nameAt:number,nameEnd:number):OnboardingClauseInfo{
 const start=sentenceStart(source,nameAt),end=sentenceEnd(source,nameEnd),before=source.slice(start,nameAt)
 const cuts=[...before.matchAll(boundary)],cut=cuts.at(-1),clauseStart=cut?cut.index!+cut[0].length:0,clausePrefix=before.slice(clauseStart)
 const afterText=source.slice(nameEnd,end),nextCut=[...afterText.matchAll(boundary)].find(m=>m[0].trim()!==':')?.index??afterText.length,clauseSuffix=afterText.slice(0,nextCut)
 const clause=(clausePrefix+source.slice(nameAt,nameEnd)+clauseSuffix).trim()
 const local=markersIn(clausePrefix).at(-1)?.intent
 if(local)return{intent:local,inherited:false,clause}
 if(keepAfter.test(clauseSuffix))return{intent:'keep',inherited:false,clause}
 if(setAfter.test(clauseSuffix))return{intent:'set',inherited:false,clause}
 const after=markersIn(clauseSuffix)[0]?.intent
 if(after)return{intent:after,inherited:false,clause}
 const inherited=markersIn(before.slice(0,clauseStart)).at(-1)?.intent??null
 if(inherited==='keep'&&cut&&exception.test(cut[0]+' '))return{intent:'set',inherited:false,clause}
 return{intent:inherited,inherited:!!inherited,clause}
}
function occurrences(source:string,evidence:string,name:string){
 const out:{nameAt:number;nameEnd:number;at:number}[]=[],lower=source.toLocaleLowerCase('it'),needle=evidence.toLocaleLowerCase('it'),dish=name.toLocaleLowerCase('it')
 for(let at=lower.indexOf(needle);at>=0&&out.length<20;at=lower.indexOf(needle,at+1)){const offset=needle.indexOf(dish),nameAt=at+Math.max(0,offset);out.push({at,nameAt,nameEnd:offset>=0?nameAt+dish.length:at+needle.length})}
 return out
}
/** Intent of the clause that mentions the dish; if the same citation appears more than once, keep only when all are keep. */
export function onboardingClauseInfo(source:string,evidence:string,name:string):OnboardingClauseInfo{
 const infos=occurrences(source,evidence,name).map(o=>onboardingIntentAt(source,o.nameAt,o.nameEnd))
 if(!infos.length)return{intent:null,inherited:false,clause:evidence}
 if(infos.every(i=>i.intent==='keep'))return infos[0]!
 return infos.find(i=>i.intent&&i.intent!=='keep')??infos[0]!
}
export const onboardingClauseIntent=(source:string,evidence:string,name:string)=>onboardingClauseInfo(source,evidence,name).intent
/** The user named the menu for THIS dish: in the sentence of any occurrence, or as a short heading line above it. */
export function onboardingMenuExplicit(source:string,evidence:string,menu:string){
 const lower=source.toLocaleLowerCase('it'),needle=evidence.toLocaleLowerCase('it')
 for(let at=lower.indexOf(needle);at>=0;at=lower.indexOf(needle,at+1)){
  const sentence=source.slice(sentenceStart(source,at),sentenceEnd(source,at+evidence.length));if(new RegExp(`(?<![\\p{L}])${menu.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![\\p{L}])`,'iu').test(sentence))return true
  const lines=source.slice(0,at).split(/\r?\n/).slice(0,-1).reverse().slice(0,200)
  if(lines.some(line=>line.trim().length<=60&&!/\d/.test(line)&&includes(line,menu)))return true
 }
 return false
}
const pricePattern=new RegExp(`(?:\\d{1,6}(?:[.,]\\d{1,2})?\\s*(?:€|euro|euri)|€\\s*\\d|(?<![\\p{L}])(?:${words})\\s+(?:euro|euri))`,'iu')
// Information about the place, not dishes: no question, no value («Il coperto costa 2 euro», «consegna gratis sopra 20 euro»).
const placeInfo=/(?<![\p{L}])(?:coperto|consegna|spedizione|servizio|asporto|ordine\s+minimo|minimo|sopra|oltre|sotto|meno\s+di|più\s+di|piu\s+di|fino\s+a|a\s+persona|per\s+tutti|mancia)(?![\p{L}])/iu
const actionVerb=new RegExp(`${W}(?<!non\\s)(?:aggiungi|aggiungere|inserisci|metti|cambia|camba|porta|alza|abbassa|aggiorna|correggi|modifica|imposta|rimetti|riporta|elimin\\p{L}*|togli|cancell\\p{L}*|rimuovi|sposta|rinomin\\p{L}*)${E}`,'iu')
type Clause={text:string;start:number;sentence:string}
/** Clauses of a chat message (with offsets), decimal commas kept. */
export function onboardingClauses(text:string):Clause[]{
 const out:Clause[]=[];let start=0
 for(let i=0;i<=text.length;i++){if(i===text.length||sentenceEnd(text,i)===i){const sentence=text.slice(start,i),base=start;start=i+1;if(!sentence.trim())continue
  let from=0;for(const m of [...sentence.matchAll(boundary),{index:sentence.length,0:''} as any]){const raw=sentence.slice(from,m.index),lead=raw.length-raw.trimStart().length;if(raw.trim())out.push({text:raw.trim(),start:base+from+lead,sentence});from=m.index+m[0].length}}}
 return out
}
const hasPrice=(clause:string)=>pricePattern.test(clause)||(/(?:€|euro|euri)/i.test(clause)&&!!onboardingPriceChange(clause.replace(/^.*?(?=\sda\s)/i,'')))
/** Clauses of a chat message that state a price. */
export const onboardingPriceClauses=(text:string)=>onboardingClauses(text).filter(c=>hasPrice(c.text)).map(c=>c.text)
// Unambiguous absolute price right after the dish: «X a 13 euro», «X a €11», «X che va a 11 euro», «X da 12 a 13 euro».
const strictTail=new RegExp(`^\\s*(?:che\\s+)?(?:(?:lo|la|li|le)\\s+)?(?:(?:va|vanno|porto|porti|metti(?:lo|la)?|mettilo|mettila|portalo|portala|costa|passa|diventa|è|adesso\\s+è|ora\\s+è)\\s+)?(?:a\\s+)?(?:€\\s*)?(\\d{1,6}(?:[.,]\\d{1,2})?|${words})\\s*(?:€|euro|euri)?\\s*(?:(?:nel|al|del|per\\s+il)\\s+(?:menu\\s+)?\\p{L}+\\s*)?$`,'iu')
const quote=(s:string)=>s.replace(/[*_~`<>]/g,'').slice(0,140)
/** Guardrail for chat messages, per dish mention: a mention the model did not return becomes a row only when the value
 * is unambiguous (unique dish already in the draft + «a N euro» / «da X a Y» right after it); a relative change, a new
 * dish or any doubt becomes a question. Clauses about the place are ignored without questions. */
export function onboardingUncoveredClauses(text:string,rows:OnboardingMenuRow[],existing:string[],menus:string[]):{rows:OnboardingMenuRow[];issues:string[]}{
 const extra:OnboardingMenuRow[]=[],issues:string[]=[],names=[...new Set([...existing,...rows.map(r=>r.name)])]
 menus=[...new Set([...menus,...rows.flatMap(r=>r.menu?[r.menu]:[])])]
 // Menus named in the sentence: known ones, and any «menu X» written by the user (a menu that does not exist yet).
 const menuOf=(sentence:string)=>[...new Set([...menus.filter(m=>new RegExp(`(?<![\\p{L}])${m.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![\\p{L}])`,'iu').test(sentence)),...[...sentence.matchAll(/(?<![\p{L}])men[uù]\s+(\p{L}{3,})/giu)].map(m=>m[1]!).filter(w=>!/^(?:di|del|della|dei|per|con|e)$/i.test(w))].map(m=>menus.find(k=>onboardingDishKey(k)===onboardingDishKey(m))??m))]
 for(const clause of onboardingClauses(text)){
  const priced=hasPrice(clause.text),acted=actionVerb.test(clause.text);if(!priced&&!acted)continue
  if(!priced)continue // action without price (elimina/sposta/rinomina…) is handled on the whole message
  // Dish mentions in the clause, longest names first, without overlaps.
  const lower=clause.text.toLocaleLowerCase('it'),found:{name:string;at:number;end:number}[]=[]
  for(const name of [...names].sort((a,b)=>b.length-a.length)){const at=lower.indexOf(name.toLocaleLowerCase('it'));if(at<0){if(mentionsOnboardingDish(clause.text,name)&&!found.some(f=>sameOnboardingDish(f.name,name)))found.push({name,at:-1,end:-1});continue}if(!found.some(f=>f.at>=0&&at<f.end&&at+name.length>f.at))found.push({name,at,end:at+name.length})}
  found.sort((a,b)=>a.at-b.at)
  const sentenceMenus=menuOf(clause.sentence)
  const covered=(name:string)=>rows.some(r=>sameOnboardingDish(r.name,name)&&(!r.menu||!sentenceMenus.length||sentenceMenus.some(m=>onboardingDishKey(m)===onboardingDishKey(r.menu!))))
  if(!found.length){
   if(rows.some(r=>includes(clause.text,r.evidence)||includes(r.evidence,clause.text)))continue
   if(placeInfo.test(clause.text))continue // about the place (coperto, consegna…): not a dish, no question
   issues.push(`Non ho capito questa parte: «${quote(clause.text)}». Puoi riscriverla con piatto, menu e prezzo?`);continue
  }
  for(const [index,mention] of found.entries()){
   if(covered(mention.name))continue
   const isExisting=existing.some(e=>sameOnboardingDish(e,mention.name)),unique=existing.filter(e=>sameOnboardingDish(e,mention.name)).length===1
   const next=found[index+1],tail=mention.at>=0?clause.text.slice(mention.end,next&&next.at>mention.at?next.at:clause.text.length):''
   const relative=onboardingRelativePrice(clause.text),change=mention.at>=0&&/(?:€|euro|euri)/i.test(tail)?onboardingPriceChange(tail):null,strict=tail.match(strictTail)
   if(isExisting&&unique&&!relative&&(change||strict)){
    const value=change?change.to:amount(strict![1]!);const at=clause.start+mention.at
    const info=onboardingIntentAt(text,at,at+mention.name.length),menu=sentenceMenus.length===1?sentenceMenus[0]:undefined
    if(value!==undefined&&value>0){extra.push({name:mention.name,price:value,section:'Menu',description:'',evidence:clause.text,...(menu?{menu,menuEvidence:menu,menuExplicit:true}:{}),...(info.intent==='keep'?{citedPrice:value}:{}),intent:info.intent==='keep'?'keep':info.intent==='change'||change?'change':'set',...(change?{oldPrice:change.from}:{})});continue}
   }
   const where=sentenceMenus.length===1?` (menu *${sentenceMenus[0]}*)`:''
   issues.push(relative?`*${quote(mention.name)}*: qual è il nuovo prezzo? Scrivi per esempio «porta ${quote(mention.name)} a 14 euro».`:`Non ho capito questa parte: «${quote(clause.text)}»${where}. Puoi riscriverla con piatto, menu e prezzo?`)
  }
 }
 return{rows:extra,issues}
}
/** Requests without a price that the onboarding chat must not ignore: remove (applied), move and rename (explained). */
export function onboardingNonPriceRequests(text:string,existing:string[]):{remove:string[];move:string[];rename:string[]}{
 const out={remove:[] as string[],move:[] as string[],rename:[] as string[]}
 for(const clause of onboardingClauses(text)){
  if(hasPrice(clause.text))continue
  const kind=markersIn(clause.text).filter(m=>['remove','move','rename'].includes(m.intent)).at(-1)?.intent as 'remove'|'move'|'rename'|undefined;if(!kind)continue
  const dish=[...existing].sort((a,b)=>b.length-a.length).find(name=>mentionsOnboardingDish(clause.text,name));if(dish)out[kind].push(dish)
 }
 return out
}
