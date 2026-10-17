/** Bot titolare (17/10/2026, vocale di Manuel): richieste multiple con UNA parte incerta, e «annulla» vero.
 *
 * Caso reale: «aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tojibo». «tojibo» non è un
 * piatto ma suona come «togli boh» (piatto esistente). Prima il bot chiedeva il prezzo di «Toibo» e perdeva le altre due
 * aggiunte; poi «no, togli bo» segnava boh *finito*. Ora:
 * - le parti chiare restano IN SOSPESO (proposta `hold`, 10 minuti), mai perse per colpa della parte incerta;
 * - la parte incerta diventa una sola domanda: «Intendi togliere boh?» (o il prezzo, se è davvero un piatto nuovo);
 * - la risposta («sì», «no, togli bo», «8 euro») completa TUTTA la richiesta in una sola pubblicazione.
 *
 * Regola (Manuel, 17/10): «togli/leva/levami/elimina/cancella/rimuovi X» = SEMPRE nascondere dal menu, mai «esaurito»;
 * «finito/esaurito/non c'è più/nun ce sta» = esaurito. Vale in testo e vocale, anche dentro richieste multiple e correzioni.
 */
import type {MenuRef,SectionRef,MenuAction} from './twilio-menu-ai.js'
import {describeAction,safe} from './twilio-menu-ai.js'
import {plainText,findDishes,parseIntent,removeVerbRe,wordNumber} from './twilio-menu-nlu.js'
import {startsWithCreate,createCompound,parseCreate} from './twilio-menu-create.js'
import {copy,fill} from './twilio-menu-copy.js'

export type HoldAsk={type:'remove',id:string,word:string}|{type:'price',name:string,sectionId:string}
export type Hold={kind:'hold',actions:MenuAction[],ask:HoldAsk}

const holdFold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
const holdFlat=(s:string)=>holdFold(s).replace(/[^a-z0-9]+/g,' ').trim()
/** Chiave fonetica senza spazi, come la sente Whisper: gli/gl → l, j/y → i, h muta, doppie scempie. «tojibo» → «toibo». */
export const squash=(s:string)=>holdFold(s).replace(/[^a-z]+/g,'').replace(/gli/g,'li').replace(/gl/g,'l').replace(/[jy]/g,'i').replace(/h/g,'').replace(/k/g,'c').replace(/(.)\1+/g,'$1')
// Verbi di rimozione come suonano attaccati al nome («togli bo» → «tolibo», «toji bo» → «toibo», «leva bo» → «levabo»).
const holdVerbKeys=['nascondi','eliminami','elimina','cancelami','cancela','rimuovimi','rimuovi','levami','levaci','leva','leve','tolimi','tolici','tolie','toli','tuoli','toi','togi','tui'].map(squash).sort((a,b)=>b.length-a.length)
const holdArticleKeys=['il','lo','la','le','li','i','l','un','una','del','dela','dalo','dal'].map(squash).sort((a,b)=>b.length-a.length)
const holdLev=(a:string,b:string)=>{const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=d[0]!;d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j]!;d[j]=Math.min(d[j]!+1,d[j-1]!+1,prev+(a[i-1]===b[j-1]?0:1));prev=t}}return d[b.length]!}
/** Una parola (o due) che non è un piatto ma suona come «togli <piatto esistente>». Restituisce il piatto, o null. */
/** «no, togli boh», «scusa, leva la lasagna»: l'intercalare davanti a un verbo di rimozione non rende composta la frase. */
export function stripLeadBeforeRemoval(text:string):string{const m=text.match(/^\s*(?:(?:no|scusa|anzi|ok|allora|si|sì|senti|ecco|ah|eh|ops)\s*[,.!…]+\s*)+(.+)$/i);return m&&removeVerbRe.test(holdFlat(m[1]!.split(/\s+/)[0]!))?m[1]!:text}
export function removalGuess(part:string,refs:MenuRef[]):MenuRef|null{
 const t=holdFlat(part).replace(/^(?:(?:e|ed|poi|e poi|anche|pure|ma)\s+)+/,'').trim();if(!t||t.split(' ').length>4||/\d/.test(t))return null
 // Un verbo vero («togli boh») non è un'ipotesi: è un comando chiaro, lo legge parseIntent.
 if(removeVerbRe.test(t))return null
 if(findDishes(t,refs).length)return null
 const k=squash(t),found=new Map<string,MenuRef>()
 for(const v of holdVerbKeys){if(!k.startsWith(v)||k.length<=v.length)continue;let rest=k.slice(v.length)
  const tries=[rest,...holdArticleKeys.filter(a=>rest.startsWith(a)&&rest.length>a.length+1).map(a=>rest.slice(a.length))]
  for(const r of refs){const n=squash(r.name);if(n.length<2)continue;if(tries.some(x=>x===n||(n.length>=5&&x.length>=5&&holdLev(x,n)<=1)))found.set(r.id,r)}
  if(found.size)break}
 return found.size===1?[...found.values()][0]!:null
}
// Separatori di una richiesta multipla (i decimali «6,50» non separano).
const HOLD_SEP=/\s*(?:(?<!\d),|,(?!\d)|;|\n)\s*|\s+(?:e poi|poi|ed|e)\s+/i
const holdPriceIn=(s:string)=>/\d|\b(?:euro|€)\b/i.test(s)
const holdChangeOf=(part:string,refs:MenuRef[]):MenuAction|null=>{const i=parseIntent(part);if(!i||!('target' in i)||i.kind==='ask')return null;const hits=findDishes(i.target,refs);if(hits.length!==1)return null;const id=hits[0]!.id
 return i.kind==='price'?{kind:'price',id,price:i.price}:i.kind==='description'?{kind:'description',id,text:i.text}:i.kind==='tag'?{kind:'tag',id,tag:i.tag,value:true}:{kind:i.kind,id,value:i.value} as MenuAction}
/** Sezione nominata nel messaggio di aggiunta, tolta dal testo: «nei piatti di prova», «tra i primi», «in Dolci». */
function holdCutSection(body:string,sections:SectionRef[]):{rest:string,sectionId:string}|null{
 for(const s of [...sections].sort((a,b)=>b.name.length-a.name.length)){const ws=holdFlat(s.name).split(' ').filter(Boolean);if(!ws.length)continue
  const name=ws.map(w=>w.length>3?w.slice(0,-1)+'[a-z]?':w).join('\\s+')
  const re=new RegExp(`(?:^|\\s)(?:tra|fra|nei|negli|nelle|nella|nel|nello|in|ai|agli|alle|al|alla)\\s+(?:(?:i|gli|le|la|il|lo|l)\\s+)?(?:categoria\\s+|sezione\\s+)?${name}(?=\\s|$|[:,;])\\s*[:,;]?`,'i')
  const f=holdFold(body),m=f.match(re);if(m){const from=m.index!,to=from+m[0].length;return{rest:(body.slice(0,from)+' '+body.slice(to)).replace(/\s+/g,' ').trim(),sectionId:s.id}}}
 return null}
const holdCreateVerb=/^\s*(?:(?:allora|ok|ciao|senti|mi|ci|puoi|potresti|vorrei|voglio)\s+)*(?:aggiung\w*|aggiun\w*|aggin\w*|agiung\w*|inserisc\w*|inserire|metti\w*\s+nel\s+menu)\s*[:,]?\s*/i
export type HoldStart={hold:Hold,text:string}|{actions:MenuAction[]}
/** Divide sui separatori senza spezzare i nomi dei piatti che li contengono («Pasta e fagioli»). */
function splitParts(text:string,refs:MenuRef[]):string[]{
 const names=[...new Set(refs.map(r=>r.name.replace(/\s+/g,' ').trim()).filter(n=>n.length>=3&&HOLD_SEP.test(' '+n+' ')))].sort((a,b)=>b.length-a.length),keep:string[]=[]
 let t=text;for(const n of names){const re=new RegExp(`(?<![\\p{L}\\d])${n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+')}(?![\\p{L}\\d])`,'giu');t=t.replace(re,m=>{keep.push(m);return '\u0002'+(keep.length-1)+'\u0002'})}
 return t.split(HOLD_SEP).map(x=>x.replace(/\u0002(\d+)\u0002/g,(_a,i)=>keep[Number(i)]!).trim()).filter(Boolean)}
/** Riconosce una richiesta multipla con UNA sola parte incerta e tutte le altre chiare → `hold` con una domanda.
 * Aggiunta con un comando chiaro dentro («aggiungi … la parmigiana a 10 e togli boh») → `actions`. null = flusso di sempre. */
export function holdFromMessage(text:string,sections:SectionRef[],refs:MenuRef[]):HoldStart|null{
 if(text.length>600)return null
 const clear:MenuAction[]=[];let ask:HoldAsk|null=null,uncertain=0,commands=0
 const guessAsk=(p:string,g:MenuRef):HoldAsk=>({type:'remove',id:g.id,word:p.replace(/^(?:e|ed|poi)\s+/i,'').replace(/[.!?]+$/,'').trim()})
 if(startsWithCreate(text)){
  // Aggiunta di più piatti: «aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tojibo».
  const body0=text.replace(holdCreateVerb,''),cut=holdCutSection(body0,sections),sectionId=cut?.sectionId??(sections.length===1?sections[0]!.id:null);if(!sectionId)return null
  const raw=splitParts(cut?cut.rest:body0,refs),parts:string[]=[];if(raw.length<2)return null
  // Nel messaggio di aggiunta un prezzo è sempre del piatto nuovo; contano come comandi solo finito/togli/… su piatti esistenti.
  const command=(p:string)=>{const c=holdChangeOf(p,refs);return c&&c.kind!=='price'?c:null}
  // Un pezzo senza prezzo e senza verbo seguito da altri si unisce al successivo («pasta e fagioli a 9»).
  for(let i=0;i<raw.length;i++){let p=raw[i]!;while(i+1<raw.length&&!holdPriceIn(p)&&!command(p)&&!removalGuess(p,refs))p=p+' e '+raw[++i]!;parts.push(p)}
  if(parts.length<2)return null
  for(const p of parts){const change=command(p);if(change){clear.push(change);commands++;continue}
   const guess=removalGuess(p,refs);if(guess){uncertain++;ask=guessAsk(p,guess);continue}
   const c=parseCreate(p,sections,false);if(!c||!c.name||/\b(?:euro|costa|costano|aggiung\w*|togli\w*|nascond\w*|finit\w*|esaurit\w*)\b/i.test(c.name)||c.name.length>80)return null
   const name=c.name;if(refs.some(r=>r.sectionId===sectionId&&holdFlat(r.name)===holdFlat(name)))return null
   if(c.price===null){uncertain++;ask={type:'price',name,sectionId};continue}
   clear.push({kind:'create',sectionId,name,price:c.price,description:null})}
  // Tutto chiaro: con un comando dentro l'aggiunta si applica qui (prima il nome diventava «Parmigiana e togli boh»),
  // altrimenti resta al flusso di sempre.
  if(!uncertain)return commands&&clear.length>commands?{actions:clear}:null
  if(!createCompound(text)&&!clear.some(a=>a.kind==='create'))return null
 }else{
  // Comandi su piatti esistenti: «la carbonara a 12 e tojibo», «boh finito, toglichenesacc», o «tojibo» da solo.
  const parts=splitParts(text,refs)
  for(const p of parts){const change=holdChangeOf(p,refs);if(change){clear.push(change);continue}
   // «Tojibo, e aggiungi nei piatti di prova la caprese a 9 euro»: l'aggiunta completa dopo la parte incerta.
   if(startsWithCreate(p.replace(/^(?:e|ed|poi|e poi)\s+/i,''))){const c=parseCreate(p.replace(/^(?:e|ed|poi|e poi)\s+/i,''),sections,true);if(c&&c.name&&c.price!==null&&c.sectionId&&!/\b(?:euro|costa|togli\w*|finit\w*)\b/i.test(c.name)&&!refs.some(r=>r.sectionId===c.sectionId&&holdFlat(r.name)===holdFlat(c.name!))){clear.push({kind:'create',sectionId:c.sectionId,name:c.name,price:c.price,description:null});continue}return null}
   // «togli boh e che ne sacc»: un nome da solo dopo un «togli» eredita il verbo.
   const prev=clear.at(-1),hits=prev&&prev.kind==='hidden'&&prev.value&&!/\d|\b(?:costa\w*|prezzo|euro|finit\w*|esaurit\w*|promo\w*|evidenza|metti\w*)\b/i.test(holdFlat(p))?findDishes(p,refs):[];if(hits.length===1){clear.push({kind:'hidden',id:hits[0]!.id,value:true});continue}
   const guess=removalGuess(p,refs);if(guess){uncertain++;ask=guessAsk(p,guess);continue}
   return null}
 }
 // Tutto chiaro su piatti esistenti con un «togli» dentro («togli boh e il piatto di verifica costa 14»): si applica qui, senza IA.
 if(!uncertain&&!startsWithCreate(text))return clear.length>1&&clear.some(a=>a.kind==='hidden'&&a.value)&&new Set(clear.map(a=>'id' in a?a.id:'')).size===clear.length?{actions:clear}:null
 if(uncertain!==1||!ask)return null
 if(!clear.length&&ask.type!=='remove')return null
 // Il piatto da togliere non deve essere già toccato da una parte chiara.
 if(ask.type==='remove'&&clear.some(a=>'id' in a&&a.id===(ask as any).id))return null
 const hold:Hold={kind:'hold',actions:clear,ask}
 return{hold,text:holdQuestion(hold,refs,sections)}
}
export function holdQuestion(hold:Hold,refs:MenuRef[],sections:SectionRef[]):string{
 const head=hold.actions.length?fill(copy.holdHead,{righe:hold.actions.map(a=>describeAction(a,refs,sections)).join('\n')})+'\n\n':''
 if(hold.ask.type==='remove'){const r=refs.find(x=>x.id===(hold.ask as any).id);return head+fill(copy.holdRemove,{parola:safe(hold.ask.word).slice(0,40),piatto:safe(r?.name??'?')})}
 return head+fill(copy.holdPrice,{piatto:safe(hold.ask.name)})}

export type HoldAnswer={actions:MenuAction[],note?:string,rest?:string}|'cancel'|null
const yes=/^(?:(?:si|sii|esatto|giusto|certo|certamente|ok|okay|confermo|conferma|va bene|proprio|appunto|perfetto|bravo|quello|quella|esattamente|sicuro|dai|vai|procedi|pubblica)\s*)+(?:(?:toglil[oa]|leval[oa]|nascondil[oa]|grazie|proprio|quello|quella|quello li|pure|tutto)\s*)*$/
const no=/^(?:no|nono|no no|no grazie|non toglierl[oa]|non lo togliere|non la togliere|lascial[oa](?: stare| perdere| com e)?|no lascial[oa](?: stare)?|no lascia stare|no non toglierl[oa]|no quello no|no resta|resta|no non quello|(?:no )?non (?:l[oaie] |l )?(?:aggiunger\w*|metter\w*|toglier\w*|toccar\w*|inserir\w*|cambiar\w*)(?: (?:quello|quella|pure|piu|niente|nulla|ancora))?|(?:no )?non (?:aggiungerl|metterl|toglierl|toccarl|inserirl)[oaie]|(?:no )?non serve|(?:no )?lascia perdere (?:quello|quella|quest\w+))$/
const holdCancelWords=/^(?:annulla(?: tutto)?|lascia (?:stare|perdere)(?: tutto)?|non fare niente|niente|lascia perdere tutto|stop|annulla annulla)$/
/** Risposta alla domanda della proposta `hold`. null = non è una risposta (comando nuovo o altro). */
export function holdAnswer(text:string,hold:Hold,refs:MenuRef[]):HoldAnswer{
 const t=holdFlat(text).replace(/\b(?:per favore|grazie mille|grazie)\b/g,' ').replace(/\s+/g,' ').trim();if(!t)return null
 if(holdCancelWords.test(t))return 'cancel'
 const lead=t.replace(/^(?:(?:no|scusa|anzi|si|ok|allora|intendevo|volevo dire|dicevo|ho detto|era|cioe|esatto)\s+)+/,'').trim()
 // «no, togli bo», «sì togli boh», «togli il boh», «toglibo»: il verbo di rimozione su un piatto esistente.
 const removal=():MenuRef|null=>{if(!lead)return null;const i=parseIntent(lead);if(i&&i.kind==='hidden'&&i.value){const hits=findDishes(i.target,refs);if(hits.length===1)return hits[0]!;if(hits.length>1&&hold.ask.type==='remove'){const want=(hold.ask as any).id;return hits.find(h=>h.id===want)??null}}
  return removalGuess(lead,refs)}
 const asked=hold.ask.type==='remove'?refs.find(r=>r.id===(hold.ask as any).id)??null:null
 if(hold.ask.type==='remove'){if(!asked)return null
  if(yes.test(t)||/^(?:si |ok )?(?:toglil[oa]|leval[oa]|nascondil[oa]|eliminal[oa]|cancellal[oa]|rimuovil[oa])(?: pure| dal menu)?$/.test(t))return{actions:[...hold.actions,{kind:'hidden',id:asked.id,value:true}]}
  // «sì e la tagliata costa 20», «sì, poi la carbonara è finita»: il sì vale per la domanda, il resto è un comando in più.
  {const m=text.match(/^\s*(?:sì|si|ok|okay|esatto|certo|va bene|giusto)\s*[,;.!]*\s*(?:(?:e|poi|però|pero|ed|anche)\s+)?(.+)$/i);if(m&&/^(?:si|ok|okay|esatto|certo|va bene|giusto)\b/.test(t)&&holdFlat(m[1]!).split(' ').length>=2&&!yes.test(holdFlat(m[1]!)))return{actions:[...hold.actions,{kind:'hidden',id:asked.id,value:true}],rest:m[1]!.trim()}}
  if(no.test(t))return{actions:[...hold.actions],note:fill(copy.holdNotTouched,{piatto:safe(asked.name)})}
  const r=removal();if(r)return{actions:[...hold.actions,{kind:'hidden',id:r.id,value:true}]}
  return null}
 // Prezzo del piatto nuovo: «8», «8 euro», «otto», «a 8,50».
 const m=t.replace(/(\d) (\d{1,2})$/,'$1.$2').match(/^(?:(?:si|ok|allora|costa|fa|viene|a|al|prezzo|il prezzo e|mettilo a|mettila a|sono|fai)\s+)*(\d+(?:[.,]\d{1,2})?|[a-z]+)(?:\s+(?:euro|eur|euri))?$/)
 if(m){const v=/^\d/.test(m[1]!)?Number(m[1]!.replace(',','.')):wordNumber(m[1]!);if(v!==null&&Number.isFinite(v)&&v>0&&v<=500){const ask=hold.ask as Extract<HoldAsk,{type:'price'}>;return{actions:[...hold.actions,{kind:'create',sectionId:ask.sectionId,name:ask.name,price:Math.round(v*100)/100,description:null}]}}}
 // «no, togli bo»: la parola incerta era un «togli», non un piatto nuovo.
 const r=removal();if(r)return{actions:[...hold.actions,{kind:'hidden',id:r.id,value:true}],note:fill(copy.holdNotTouched,{piatto:safe((hold.ask as any).name)}).replace('Non ho toccato','Non ho aggiunto')}
 if(no.test(t))return{actions:[...hold.actions],note:fill(copy.holdNotTouched,{piatto:safe((hold.ask as any).name)}).replace('Non ho toccato','Non ho aggiunto')}
 return null
}

/** Comandi chiari su piatti esistenti, senza IA («la tagliata costa 20», «togli boh e che ne sacc»). null = non tutti chiari. */
export function clearChanges(text:string,refs:MenuRef[]):MenuAction[]|null{const out:MenuAction[]=[]
 for(const p of splitParts(text,refs)){const c=holdChangeOf(p,refs);if(c){out.push(c);continue}const prev=out.at(-1),hits=prev&&prev.kind==='hidden'&&prev.value?findDishes(p,refs):[];if(hits.length===1&&!/\d/.test(p)){out.push({kind:'hidden',id:hits[0]!.id,value:true});continue}return null}
 return out.length?out:null}
// ---------------- Annulla vero (10 minuti) ----------------
export type UndoItem={id:string,sectionId:string,before:any|null,after:any|null}
export type UndoRecord={kind:'undo',at:number,items:UndoItem[]}
export const undoWindowMs=10*60*1000
const holdCanon=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v??null):Array.isArray(v)?'['+v.map(holdCanon).join(',')+']':'{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+holdCanon(v[k])).join(',')+'}'
const holdItemsOf=(w:any)=>new Map<string,{item:any,sectionId:string}>(w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>[i.id,{item:i,sectionId:s.id}]))))
const holdSectionShape=(w:any)=>holdCanon(w.menus.map((m:any)=>m.sections.map((s:any)=>({...s,items:undefined}))))
/** Le voci cambiate da una pubblicazione WhatsApp (prima/dopo). null se cambia altro oltre ai piatti (sezioni, design). */
export function undoRecordFor(before:any,after:any,now=Date.now()):UndoRecord|null{
 if(holdCanon({...before,menus:undefined})!==holdCanon({...after,menus:undefined})||holdSectionShape(before)!==holdSectionShape(after))return null
 const a=holdItemsOf(before),b=holdItemsOf(after),items:UndoItem[]=[]
 for(const [id,x] of b){const y=a.get(id);if(!y)items.push({id,sectionId:x.sectionId,before:null,after:structuredClone(x.item)});else if(holdCanon(y.item)!==holdCanon(x.item)||y.sectionId!==x.sectionId)items.push({id,sectionId:x.sectionId,before:structuredClone(y.item),after:structuredClone(x.item)})}
 for(const [id,y] of a)if(!b.has(id))return null
 return items.length&&items.length<=60?{kind:'undo',at:now,items}:null}
export const isUndoRequest=(text:string)=>/^(?:(?:no|scusa|aspetta|anzi|ok|allora|ops|ehm|senti)\s+)*(?:annulla(?: tutto| l ultima(?: modifica| cosa)?| la modifica(?: di prima)?| le modifiche(?: di prima)?| quello che hai fatto| quello| questo| la richiesta)?|torna(?:re)? indietro|torna (?:come|com) (?:prima|era)|torna com era|rimetti(?: tutto)? (?:come prima|com era|come era|come stava|come stavano)|rimettilo com era|rimettila com era|ripristina (?:come prima|com era)|disfa(?: tutto)?|undo)(?:\s+(?:per favore|grazie|dai))?$/.test(holdFlat(text))
/** Ripristina le voci se nessuna è cambiata dopo (dashboard o altro). Muta `w`. */
export function applyUndo(w:any,rec:UndoRecord):{ok:true,restored:string[],removed:string[]}|{ok:false,changed:string[]}{
 const now=holdItemsOf(w),changed:string[]=[]
 for(const it of rec.items){const cur=now.get(it.id);if(!cur||holdCanon(cur.item)!==holdCanon(it.after))changed.push(String((cur?.item??it.after??it.before)?.name??'?'))}
 if(changed.length)return{ok:false,changed:[...new Set(changed)]}
 const restored:string[]=[],removed:string[]=[]
 for(const it of rec.items){const sec=w.menus.flatMap((m:any)=>m.sections).find((s:any)=>s.items.some((i:any)=>i.id===it.id));if(!sec)continue;const k=sec.items.findIndex((i:any)=>i.id===it.id)
  if(it.before===null){sec.items.splice(k,1);removed.push(String(it.after?.name??''))}else{sec.items[k]=structuredClone(it.before);restored.push(String(it.before.name??''))}}
 return{ok:true,restored,removed}}
export function undoText(r:{restored:string[],removed:string[]}){return fill(copy.undoDone,{righe:[...r.restored.map(n=>fill(copy.undoRestored,{piatto:safe(n)})),...r.removed.map(n=>fill(copy.undoRemoved,{piatto:safe(n)}))].join('\n')})}
export const plainOf=plainText
