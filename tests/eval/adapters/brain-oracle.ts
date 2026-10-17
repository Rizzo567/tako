// Modello «ideale» per il bot NUOVO (cervello, perimetro N): risponde nello schema JSON strict del cervello vedendo TUTTO il
// contesto che il cervello gli manda (scheda ristoratore, cronologia, in sospeso, messaggio) e conoscendo le attese della
// conversazione, come currentOracle per il bot attuale. Non sceglie mai un piatto ambiguo, non inventa prezzi: i valori li
// prende dal messaggio (o, per i rimandi, dai messaggi recenti del titolare), il piatto dal messaggio o dal contesto.
// È un TETTO dell'architettura (contesto + validatore), non gpt-oss: i numeri «oracolo» non sono la resa del modello vero.
import {plainT} from '../judge.js'
import {spoken as spokenRaw} from './current-oracle.js'
import {withoutQuantities,relativeDelta} from '../../../apps/server/src/lib/twilio-menu-ai.js'
import {deixisReferents,mixedMessage} from '../../../apps/server/src/lib/owner-brain-plan.js'
import {DELETE_VERB} from '../../../apps/server/src/lib/twilio-menu-structure.js'
import {phoneticHits} from '../../../apps/server/src/lib/twilio-menu-phonetic.js'
import {politeCommand} from '../../../apps/server/src/lib/twilio-menu-nlu.js'
import {politeRequest} from '../../../apps/server/src/lib/owner-brain-r.js'
// Correzioni A (17/10): il modello ideale non legge le quantità come prezzi («quei due», «tutti e tre», «in una categoria»).
export const spoken=(t:string)=>spokenRaw(withoutQuantities(t))
import type {Change,Conversation} from '../types.js'

const GENERIC=new Set(['alla','allo','alle','della','dello','delle','con','pasta','pizza','piatto','casa'])
const stems=(name:string)=>plainT(name).split(' ').filter(w=>w.length>3&&!GENERIC.has(w))
const skel=(w:string)=>w.replace(/[aeiou]/g,'')
const wordHit=(w:string,msg:string[])=>msg.some(m=>m===w||(m.length>=6&&w.length>=6?m.slice(0,6)===w.slice(0,6):m.length>=4&&w.length>=4&&m.slice(0,5)===w.slice(0,5))||(skel(m).length>=3&&skel(m)===skel(w)))
export const hitStems=(name:string,msg:string)=>{const m=plainT(msg).split(' ');return stems(name).filter(w=>wordHit(w,m))}
const rivals=(dish:string,msg:string,names:string[])=>{const hit=hitStems(dish,msg),all=stems(dish);if(!hit.length||hit.length===all.length)return[];return names.filter(n=>n!==dish&&hit.every(w=>stems(n).some(x=>wordHit(w,[x])))&&hitStems(n,msg).length<=hit.length)}

export type Cat={code:Map<string,string>,price:Map<string,number>,sections:Map<string,string>,sectionOf:Map<string,string>}
export function catalog(card:string):Cat{const code=new Map<string,string>(),price=new Map<string,number>(),sections=new Map<string,string>(),sectionOf=new Map<string,string>();let sec=''
 for(const line of card.split('\n')){const s=line.match(/^# (c\d+) (.+?)(?: \(.+\))?$/);if(s){sections.set(s[2]!,s[1]!);sec=s[2]!;continue}
  const p=line.match(/^(p\d+)\|([^|]+)\|([\d.]+)/);if(p){code.set(p[2]!,p[1]!);price.set(p[2]!,Number(p[3]));sectionOf.set(p[2]!,sec)}}
 return{code,price,sections,sectionOf}}

const secCodeOf=(cat:Cat,n:string)=>cat.sections.get(n)??[...cat.sections].find(([k])=>plainT(k)===plainT(n))?.[1]??null
const blank={action:'set_price',item:null,section:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}
const withSections=(acts:any[])=>{const fresh=[...new Set(acts.filter(a=>(a.action==='create_item'||a.action==='move_item')&&typeof a.section==='string'&&!/^c\d+$/.test(a.section)).map(a=>a.section))];return[...fresh.map(n=>({action:'create_section',name:n})),...acts]}
const out=(o:any)=>JSON.stringify({intent:'change',read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:'',...o,actions:withSections(o.actions??[]).map((a:any)=>({...blank,...a}))})
const QUESTION=/\?|^(?:quanto|quanti|cosa|che|quali|qual|com e|ce |c e )\b/
const SAME=/\b(ugual\w*|stess[oa]|idem|anche|pure|come)\b/
const CORRECT=/\b(no|scusa|intendevo|volevo|sbagliato|anzi|era|invece|ho detto)\b/
const ORD:[RegExp,number][]=[[/\b(prim[oa]|1)\b/,0],[/\b(second[oa]|2)\b/,1],[/\b(terz[oa]|3)\b/,2],[/\b(quart[oa]|4)\b/,3]]

// Una categoria nuova si usa solo se il messaggio la nomina (il modello letterale non anticipa le richieste dopo).
let literal=(_n:string)=>true
// Fase R: la categoria di un piatto nuovo vale solo se detta (o se il menu ne ha una sola): altrimenti il modello ideale chiede.
let secSaid=(_n:string)=>true
// Fase R: attese finali + intermedie possono avere lo stesso piatto due volte (11 poi «anzi 12»): uno solo, quello col prezzo detto.
const oneByName=<T extends {name:string,price:number}>(cs:T[],said:number[])=>{const m=new Map<string,T>();for(const c of cs){const k=plainT(c.name),o=m.get(k);if(!o||(!said.includes(o.price)&&said.includes(c.price)))m.set(k,c)}return[...m.values()]}
let sectionAnswer:string|null=null
export const setSectionAnswer=(x:string|null)=>{sectionAnswer=x}
const otherSection=(p:string,secs:string[])=>[...p.matchAll(/\b(?:nei|negli|nelle|tra i|tra gli|tra le|fra i|fra gli|fra le|categoria|sezione)\s+([a-z]+)/g)].some(m=>m[1]!.length>=3&&!['che','si','nuova','nuovo','piu','di'].includes(m[1]!)&&!secs.some(x=>plainT(x).split(' ')[0]!.slice(0,5)===m[1]!.slice(0,5)))
// A7.7: con una differenza detta il modello ideale manda price_delta, mai il numero come prezzo.
let relDelta:number|null=null
function act(c:Change,cat:Cat,price:number|null,ref:string|null):any{const item=c.op==='create'?null:cat.code.get(c.dish)??null
 const secCode=(n:string)=>cat.sections.get(n)??[...cat.sections].find(([k])=>plainT(k)===plainT(n))?.[1]??null
 switch(c.op){case 'create':return{action:'create_item',section:c.section&&secSaid(c.section)?secCode(c.section)??(literal(c.section)?c.section:null):null,name:c.name,price:c.price}
  // Fase B (17/10): struttura del menu; una categoria che non c'è va per nome (il server la crea con create_section).
  case 'delete':return{action:'delete_item',item}
  case 'rename':return{action:'rename_item',item,name:c.name}
  case 'move':return{action:'move_item',item,section:secCode(c.section)??c.section}
  case 'price':return relDelta!==null?{action:'set_price',item,price:null,price_delta:relDelta}:price!==null?{action:'set_price',item,price}:ref?{action:'set_price',item,price_ref:ref}:null
  case 'available':return{action:'set_available',item,value:c.value}
  case 'hidden':return{action:'set_hidden',item,value:c.value}
  case 'featured':return{action:'set_featured',item,value:c.value}
  case 'last':return{action:'set_last_portions',item,value:c.value}
  case 'promo':return c.price===null?{action:'remove_promo',item}:{action:'set_promo',item,price:c.price}
  case 'description':return{action:'set_description',item,text:c.text}}}

/** Risposta JSON del modello ideale alla richiesta del cervello, o null se la richiesta non è del cervello. */
export function brainOracleBase(conv:Conversation|null,body:any):string|null{
 const fmt=body?.response_format?.json_schema?.name
 if(fmt==='memory_judge')return JSON.stringify({useful:true,kind:'alias'})
 if(fmt!=='owner_brain_plan')return null
 if(!conv)return out({intent:'clarify'})
 const msgs=body.messages as {role:string,content:string}[],cat=catalog(msgs[1]!.content),last=msgs.at(-1)!.content
 const msg=(last.split('\nMESSAGGIO\n')[1]??last.replace(/^MESSAGGIO\n/,'')).trim(),p=plainT(msg),pAll=p
 const hist=msgs.slice(2,-1),owners=hist.filter(m=>m.role==='user').map(m=>m.content),bot=[...hist].reverse().find(m=>m.role==='assistant')?.content??''

 // Fase R: dopo una rinomina il menu ha il nome nuovo, le attese sono scritte col nome vecchio: il modello ideale le collega.
 const ren0=new Map([...conv.changes,...(conv.interim??[])].flatMap(c=>c.op==='rename'&&cat.code.has(c.name)&&!cat.code.has(c.dish)?[[c.dish,c.name] as const]:[]))
 const names=[...cat.code.keys()],expected=[...conv.changes,...(conv.interim??[])].map(c=>c.op!=='create'&&c.op!=='section'&&c.op!=='rename'&&ren0.has((c as any).dish)?{...c,dish:ren0.get((c as any).dish)!} as Change:c)
 literal=(n:string)=>(' '+p+' ').includes(' '+plainT(n)+' ');secSaid=(n:string)=>plainT(n).split(' ').filter(w=>w.length>=4).some(w=>new RegExp(`\\b(?:un|una|uno|chiama|chiamata|chiamato|nome|nuova)\\s+${w.slice(0,4)}`).test(p))||!!sectionAnswer&&plainT(n).slice(0,5)===sectionAnswer.slice(0,5)||cat.sections.size===1&&!otherSection(p,[...cat.sections.keys()])||plainT(n).split(' ').filter(w=>w.length>=4).some(w=>new RegExp(`\\b(?:nei|negli|nelle|nel|nella|tra|fra|in|categoria|sezione|ai|agli|alle)\\s+(?:i\\s+|gli\\s+|le\\s+|la\\s+|il\\s+|l\\s+)?${w.slice(0,5)}`).test(p));relDelta=relativeDelta(msg)?.delta??null
 // Struttura (fase B): categorie, spostamenti, anche dei piatti appena creati che ora vanno altrove.
 // A8 (Y, M3): anche senza «sposta» («metti la carbonara nei secondi a 14») se il messaggio nomina la categoria di arrivo attesa;
 // con lo spostamento il modello ideale fa anche le altre modifiche dette sui piatti del messaggio (prezzo detto, nascondi…).
 const moveHere=expected.some(e=>e.op==='move'&&cat.code.has(e.dish)&&p.split(' ').some(w=>w.length>3&&plainT(e.section).split(' ').some(x=>x.slice(0,5)===w.slice(0,5)))&&hitStems(e.dish,msg).length>0)
 if(/\b(categori\w*|sezion\w*|spost\w*)\b/.test(p)||moveHere){const acts:any[]=[],nums=spoken(msg)
  for(const e of expected){if(e.op==='price'||e.op==='hidden'||e.op==='available'||e.op==='featured'){const mentioned=hitStems(e.dish,msg).length>0||(/\b\w+(?:la|lo|li|le)\b/.test(p)&&expected.some(m=>m.op==='move'&&m.dish===e.dish));if(mentioned&&(e.op!=='price'||nums.includes((e as any).price))){const a=act(e,cat,e.op==='price'?(e as any).price:null,null);if(a)acts.push(a)}}}
  for(const e of expected){if(e.op==='move'&&cat.code.has(e.dish))acts.push(act(e,cat,null,null))
   else if(e.op==='create'&&e.section){const have=names.find(n=>plainT(n)===plainT(e.name));if(have&&cat.sectionOf.get(have)&&plainT(cat.sectionOf.get(have)!)!==plainT(e.section))acts.push({action:'move_item',item:cat.code.get(have),section:secCodeOf(cat,e.section)??e.section});else if(!have&&p.includes(plainT(e.name).split(' ').slice(-1)[0]!))acts.push(act(e,cat,null,null))}}
  if(acts.length)return out({actions:acts})}
 // «a uno in meno»: quel numero è una differenza, non un prezzo.
 const rel=(t:string)=>new Set([...plainT(t).matchAll(/\b(\w+)(?: euro)? (?:in|di) (?:meno|piu)\b/g)].flatMap(m=>spoken(m[1]!)))
 const said=spoken(msg).filter(x=>!rel(msg).has(x)),ownSaid=owners.slice(-3).flatMap(o=>spoken(o).filter(x=>!rel(o).has(x)))
 // Il verso si legge nella parte del messaggio che nomina il piatto («è finita la gricia, la carbonara c'è»).
 const valueFor=(op:string,fallback:boolean,p:string=pAll)=>op==='available'?(/\b(tornat\w*|di nuovo|ce sta ancora|disponibil\w*|rimett\w*|c e)\b/.test(p)&&!/\b(finit\w*|esaurit\w*|fernut\w*|non c e)\b/.test(p)?true:/\b(finit\w*|esaurit\w*|fernut\w*|non c e piu|nun ce sta)\b/.test(p)?false:fallback)
  :op==='hidden'?(/\b(rimett\w*|mostra\w*|fallo vedere)\b/.test(p)?false:/\b(nascond\w*|togli\w*|lev\w*)\b/.test(p)?true:fallback):op==='featured'?(/\btogli\w* (l )?evidenza\b|non in evidenza/.test(p)?false:fallback):fallback
 // Candidati aperti: dal blocco IN SOSPESO o dall'elenco dell'ultima risposta del bot.
 const pend=last.match(/candidati ((?:p\d+,?)+)/)?.[1]?.split(',')??[]
 // Le opzioni sono quelle di una DOMANDA (blocco IN SOSPESO o risposta del bot con «?»), non l'elenco di un «Confermato» (correzioni A).
 const listed=pend.length?pend.map(c=>names.find(n=>cat.code.get(n)===c)!).filter(Boolean):[...bot.matchAll(/\*([^*]+)\*/g)].map(m=>m[1]!.replace(/\s*\(.*\)$/,'')).filter(n=>cat.code.has(n)&&/\?/.test(bot))
 const sourceMsg=last.match(/sul messaggio «([^»]+)»/)?.[1]??owners.at(-1)??''
 // Il piatto che spiega più parole vince: «spritz aperol» non nomina lo Spritz Campari, «cornetti integrali» non il Cornetto.
 const covered=(n:string,t:string)=>{const h=hitStems(n,t);return names.some(o=>o!==n&&hitStems(o,t).length>h.length&&h.every(w=>hitStems(o,t).includes(w)))}
 // Nomi storpiati dalla trascrizione (A5): il modello ideale li riconosce a suono, il server decide se chiedere.
 const pseudo=names.map(n=>({id:n,name:n,price:cat.price.get(n)??0,available:true,hidden:false,menu:''}))
 const byEar=(t:string)=>{const h=phoneticHits(t,pseudo as any);return[...h.strong,...h.weak].filter(n=>!names.some(o=>o!==n&&plainT(t).includes(plainT(o))&&plainT(o).includes(plainT(n))))}
 const mentionedIn=(t:string)=>names.filter(n=>hitStems(n,t).length>0&&!rivalsOf(n,t).length&&!covered(n,t)).concat(names.filter(n=>plainT(t).includes(plainT(n)))).concat(byEar(t).filter(n=>!covered(n,t)))
 const rivalsOf=(n:string,t:string)=>rivals(n,t,names)
 const here=[...new Set(mentionedIn(msg))]
 const lastOwnerDishes=(()=>{for(const o of [...owners].reverse()){const d=[...new Set(mentionedIn(o))];if(d.length)return d}return[] as string[]})()
 // Misto (correzioni A): modifica + domanda → le azioni della parte di modifica e la lettura per la domanda.
 {const mixed=mixedMessage(msg);if(mixed){const inCmd=[...new Set(mentionedIn(mixed.command))],targets=inCmd.length?inCmd:[...new Set(mentionedIn(mixed.question))],sp=spoken(mixed.command),acts:any[]=[]
  for(const n of targets){const e=expected.find(c=>c.op!=='create'&&c.dish===n);if(!e)continue;const a=act(e,cat,e.op==='price'?(sp.includes((e as any).price)?(e as any).price:null):null,null);if(a)acts.push(a)}
  if(acts.length){const qp=plainT(mixed.question);return out({intent:'change',actions:acts,read:/finit|esaurit/.test(qp)?'unavailable':/nascost/.test(qp)?'hidden':'items',item_refs:[...new Set(mentionedIn(mixed.question))].map(n=>cat.code.get(n)!)})}}}
 // Domanda: mai scrivere. «che nesac costa 16» non è una domanda: «che» è l'inizio del nome Che ne sacc.
 const dishLead=!/\?/.test(msg)&&/^che\b/.test(p)&&names.some(n=>/^che\b/.test(plainT(n)))
 if(((QUESTION.test(p)&&!dishLead)||/\?/.test(msg))&&!politeCommand(msg)&&!politeRequest(msg)){const ids=(here.length?here:lastOwnerDishes).map(n=>cat.code.get(n)!);return out({intent:ids.length?'read':'capability',read:ids.length?'items':'none',item_refs:ids,capability_ids:ids.length?[]:['all']})}
 if(/^(grazie|ok grazie|perfetto|ciao|buongiorno)\b/.test(p))return out({intent:'chat',reply_draft:'Di nulla.'})
 // Scelta tra opzioni mostrate: ordinale, «tutti e due», o il nome di una delle opzioni.
 if(listed.length>1){const all=/\b(tutt[ie]|entramb\w*)\b/.test(p),ord=ORD.find(([re])=>re.test(p)),byName=listed.filter(n=>hitStems(n,msg).length>0),other=/\b(altr[oa])\b/.test(p)
  const negated=listed.filter(n=>new RegExp(`\\b${plainT(n).split(' ').slice(-1)[0]}\\b[^,]*\\bno\\b`).test(p))
  const chosen=all?listed:ord?[listed[ord[1]]!].filter(Boolean):other&&negated.length?listed.filter(n=>!negated.includes(n)):byName.length===1?byName:[]
  if(chosen.length){const src=plainT(sourceMsg),srcPrice=spoken(sourceMsg)[0]??null
   const srcAll=spoken(sourceMsg),acts=chosen.map(n=>{const e=expected.find(c=>c.op!=='create'&&c.dish===n);if(e)return act(e,cat,e.op==='price'?(srcAll.includes((e as any).price)?(e as any).price:srcPrice):null,null)
    return srcPrice!==null?{action:'set_price',item:cat.code.get(n),price:srcPrice}:/finit|esaurit/.test(src)?{action:'set_available',item:cat.code.get(n),value:false}:/nascond|togli|lev/.test(src)?{action:'set_hidden',item:cat.code.get(n),value:true}:null}).filter(Boolean)
   if(acts.length)return out({actions:acts})}}
 // Creazioni prima di tutto (correzioni A 17/10): «aggiungi pasta al pesto a 15» non è una parola generica «pasta» da chiarire.
 // Insieme alle creazioni, le altre attese sui piatti nominati con il loro prezzo detto («aggiungi pasta al ragù a 10» = prezzo).
 {const creates=oneByName(expected.filter((c):c is Extract<Change,{op:'create'}>=>c.op==='create'&&p.includes(plainT(c.name).split(' ').slice(-1)[0]!)),said)
  if(creates.length&&/aggiung|inseri|nuov/.test(p)){const miss=creates.flatMap(c=>[...(!c.section||!secSaid(c.section)?['section']:[]),...(!said.includes(c.price)?['price']:[])]);if(miss.length)return out({intent:'clarify',clarify:{question:null,item_refs:[],missing:[...new Set(miss)]}})
   const more=here.flatMap(n=>expected.filter(c=>c.op==='price'&&c.dish===n&&said.includes((c as any).price)).map(c=>act(c,cat,(c as any).price,null)))
   // «aggiungi pasta al ragù a 12» con la pasta al ragù già a 12: il modello letterale la mette tra le creazioni (il server la riconosce).
   for(const n of here)if(!expected.some(c=>c.op!=='create'&&c.dish===n)&&!creates.some(c=>plainT(c.name)!==plainT(n)&&plainT(c.name).includes(plainT(n)))){const m=p.match(new RegExp(plainT(n)+' (?:a )?(\\d+)'));if(m)more.push({action:'create_item',section:[...cat.sections.values()][0]??null,name:n,price:Number(m[1])})}
   return out({actions:[...creates.map(c=>act(c,cat,null,null)),...more]})}}
 // Piatti ambigui nel messaggio → chiarimento con l'azione capita.
 const amb=names.filter(n=>hitStems(n,msg).length>0&&rivalsOf(n,msg).length>0&&!here.includes(n))
 const relevantHere=here.filter(n=>expected.some(c=>c.op!=='create'&&c.dish===n))
 const sectionHit=[...cat.sections.keys()].find(s=>plainT(s).split(' ').some(w=>w.length>3&&p.split(' ').some(x=>x.slice(0,4)===w.slice(0,4))))
 // Parola generica («la pasta», «la pizza») che indica più piatti del menu: il modello ideale chiede quale.
 const generic=!here.length&&!amb.length?[...GENERIC].find(g=>p.split(' ').includes(g)&&names.filter(n=>plainT(n).split(' ').includes(g)).length>=1):undefined
 if(!relevantHere.length&&(amb.length||generic||(!here.length&&sectionHit&&!lastOwnerDishes.length))){const pool=amb.length?[...new Set(amb.flatMap(n=>[n,...rivalsOf(n,msg)]))]:generic?names.filter(n=>plainT(n).split(' ').includes(generic)):names.filter(n=>cat.sectionOf.get(n)===sectionHit)
  const price=said[0]??null,promo=/\b(promo\w*|offert\w*)\b/.test(p),a=price!==null?{action:promo?'set_promo':'set_price',item:cat.code.get(pool[0]!),price}:/finit|esaurit|fernut/.test(p)?{action:'set_available',item:cat.code.get(pool[0]!),value:false}:/nascond|togli|lev/.test(p)?{action:'set_hidden',item:cat.code.get(pool[0]!),value:true}:null
  return out({intent:'clarify',clarify:{question:'Quale intendi?',item_refs:pool.slice(0,8).map(n=>cat.code.get(n)!),missing:[]},actions:a?[a]:[]})}
 // Creazioni come currentOracle.
 const creates=oneByName(expected.filter((c):c is Extract<Change,{op:'create'}>=>c.op==='create'&&p.includes(plainT(c.name).split(' ').slice(-1)[0]!)),said)
 if(creates.length&&/aggiung|inseri|nuov/.test(p)){const miss=creates.flatMap(c=>[...(!c.section||!secSaid(c.section)?['section']:[]),...(!said.includes(c.price)?['price']:[])]);if(miss.length)return out({intent:'clarify',clarify:{question:null,item_refs:[],missing:[...new Set(miss)]}});return out({actions:creates.map(c=>act(c,cat,null,null))})}
 const botLabel=[...bot.matchAll(/\*([^*\n]{2,80})\*\s*:/g)].map(m=>m[1]!).find(n=>cat.code.has(n))
 const ctxDish=botLabel&&!/\?/.test(bot)?botLabel:lastOwnerDishes.find(n=>expected.some(c=>c.op!=='create'&&c.dish===n))??lastOwnerDishes[0]
 const actions:any[]=[]
 // Correzione verso un altro piatto: «no, intendevo l'amatriciana» → rimetti il piatto di prima + stessa azione sul nuovo.
 if(CORRECT.test(p)&&relevantHere.length&&ctxDish&&!here.includes(ctxDish)&&!conv.changes.some(c=>c.op!=='create'&&c.dish===ctxDish))actions.push({action:'restore',item:cat.code.get(ctxDish)})
 // «torna come prima la lasagna», «rimetti la carbonara com'era»: ripristino del piatto nominato.
 // «la parmigiana e il tiramisù a 10 e 20»: tanti prezzi quanti piatti → in ordine, anche quello che non cambia (correzioni A).
 {const nums=[...msg.replace(/(\d),(\d)/g,'$1.$2').matchAll(/\d+(?:\.\d{1,2})?/g)].map(m=>Number(m[0]));const pw=plainT(msg).split(' '),pos=(n:string)=>{const st=stems(n).length?stems(n):plainT(n).split(' ');let best=1e9;for(const w of st){const i=pw.findIndex(m=>wordHit(w,[m]));if(i>=0&&i<best)best=i}return best},order=[...new Set(here)].sort((a,b)=>pos(a)-pos(b))
  if(!actions.length&&here.length>=2&&nums.length===here.length&&!/\b(promo\w*|offert\w*|scont\w*)\b/.test(p)&&order.every((n,i)=>cat.price.get(n)===nums[i]||[...conv.changes,...(conv.interim??[])].some(c=>c.op==='price'&&c.dish===n&&c.price===nums[i])))order.forEach((n,i)=>actions.push({action:'set_price',item:cat.code.get(n),price:nums[i]}))}
 const exceptAll=/\btutt[ie] (?:tranne|eccetto|esclus\w*|meno)\b/.test(p)
 const back=/\b(torna\w* come prima|com era|come prima|com eri)\b/.test(p)?here:[];for(const n of back)actions.push({action:'restore',item:cat.code.get(n)})
 if(!back.length&&!exceptAll)for(const n of relevantHere){for(const e of expected.filter(c=>c.op!=='create'&&c.dish===n)){const price=e.op==='price'?(said.find(x=>x===(e as any).price)??said[0]??(CORRECT.test(p)&&!SAME.test(p)?ownSaid[0]??null:null)):null
   const ref=e.op==='price'&&price===null&&SAME.test(p)&&ctxDish&&ctxDish!==n?cat.code.get(ctxDish)!:null
   if(e.op==='price'&&price===null&&!ref)continue
   if(e.op==='price'&&price!==null&&!said.includes(price)&&!ownSaid.includes(price))continue
   const a=act(e,cat,price,ref),cl=msg.split(/[,;]|\s+e\s+/).find(x=>hitStems(n,x).length>0);if(a&&'value' in a&&typeof a.value==='boolean')a.value=valueFor(e.op,a.value,cl?plainT(cl):pAll);if(a&&!actions.some(x=>x.item===a.item&&x.action===a.action))actions.push(a);break}}
 // Risposta a una domanda del bot sulla richiesta di prima («hai scritto due prezzi: 9 o 9,50?» → «9»): la richiesta intera.
 if(!actions.length&&!here.length&&said.length&&/\?|riscrivimi|due prezzi/i.test(bot)){const prevD=lastOwnerDishes,prevSaid=spoken(owners.at(-1)??'')
  for(const n of prevD){const e=conv.changes.find(c=>c.op==='price'&&c.dish===n) as any;if(!e)continue;const v=said.includes(e.price)?e.price:prevSaid.includes(e.price)?e.price:null;if(v!==null)actions.push({action:'set_price',item:cat.code.get(n),price:v})}}
 // Rimandi a più piatti o per posizione («quei due», «entrambi», «tutti e tre», «il primo», «tutti tranne boh»): il modello ideale
 // li risolve sui messaggi recenti del titolare (correzioni A, 17/10) e applica l'azione detta a ciascuno.
 if(!actions.length&&(!relevantHere.length||exceptAll)){const botList=/(?:^|\s)[-•]\s+\S/.test(bot)&&!/\?/.test(bot)?names.filter(n=>bot.includes(n)).sort((a,b)=>bot.indexOf(a)-bot.indexOf(b)):[],deix=deixisReferents(msg,owners.slice(-3),names.map(n=>({id:n,name:n,price:cat.price.get(n)??0,available:true,hidden:false,menu:''})),botList)
  if(deix?.ids.length){const verb=DELETE_VERB.test(p)?'delete':/evidenza/.test(p)?'featured':/\b(nascond\w*|togli\w*|lev\w*|rimett\w*|mostra\w*)\b/.test(p)?'hidden':/finit|esaurit|tornat|disponibil/.test(p)?'available':said.length?'price':null
   for(const n of deix.ids){const e=expected.find(c=>c.op!=='create'&&c.dish===n&&c.op===verb)??(verb==='price'&&said.length?{op:'price',dish:n,price:said.at(-1)!} as Change:null);if(!e)continue
    const a=act(e,cat,e.op==='price'?(said.includes((e as any).price)?(e as any).price:said.at(-1)!):null,null);if(a&&'value' in a&&typeof a.value==='boolean')a.value=valueFor(e.op,a.value);if(a)actions.push(a)}}}
 // Nessun piatto nel messaggio: rimando al piatto del contesto («mettila a 13», «no scusa 14», «rimettila com'era»).
 if(!actions.length&&!here.length&&ctxDish){const e=expected.filter(c=>c.op!=='create'&&c.dish===ctxDish)
  if(/\b(rimett\w*|com era|come prima|annull\w*|torna\w*)\b/.test(p)&&!e.some(c=>conv.changes.includes(c)))actions.push({action:'restore',item:cat.code.get(ctxDish)})
  else if(relDelta!==null)actions.push({action:'set_price',item:cat.code.get(ctxDish),price:null,price_delta:relDelta})
  else if(said.length){actions.push({action:'set_price',item:cat.code.get(ctxDish),price:said[0]})
   // «anzi no, a 19, e mettila in evidenza»: anche le altre azioni dette sul piatto del contesto.
   const verb=/evidenza/.test(p)?'featured':/\b(nascond\w*)\b/.test(p)?'hidden':/finit|esaurit/.test(p)?'available':null;const more=verb?expected.find(c=>c.op===verb&&(c as any).dish===ctxDish):null;if(more){const a=act(more,cat,null,null);if(a)actions.push(a)}}
  else{const verb=DELETE_VERB.test(p)?'delete':/evidenza/.test(p)?'featured':/\b(nascond\w*|togli\w*|lev\w*)\b/.test(p)?'hidden':/finit|esaurit/.test(p)?'available':null
   // «toglilo» subito dopo «in evidenza»: il modello ideale toglie l'evidenza appena messa (A7.9).
   if(/^(?:no\s+)?(?:togli\w*|levalo|levala)$/.test(p)&&/evidenza/.test(bot)){actions.push({action:'set_featured',item:cat.code.get(ctxDish),value:false})}
   const fin=actions.length?null:conv.changes.find(c=>c.op!=='create'&&c.dish===ctxDish&&(verb?c.op===verb:c.op!=='price'));if(fin&&fin.op!=='price'){const a=act(fin,cat,null,null);if(a)actions.push(a)}}}
 // Richiesta multipla con piatti ambigui accanto a parti chiare: le chiare in actions, ogni ambigua in uncertain.
 const residual=here.reduce((t,h)=>plainT(t).replace(plainT(h),' '),msg)
 const uncertain:any[]=[];if(actions.length){const seen=new Set<string>(here);for(const n of amb){if(seen.has(n)||!hitStems(n,residual).length)continue;const pool=[n,...rivalsOf(n,msg)];pool.forEach(x=>seen.add(x))
   const e=expected.find(c=>c.op!=='create'&&pool.includes(c.dish)),phrase=msg.split(/,|\se\s/).find(x=>hitStems(n,x).length>0)?.trim()??n
   const a=e?act(e,cat,e.op==='price'?(e as any).price:null,null):null
   uncertain.push({phrase,candidates:pool.map(x=>cat.code.get(x)),action:a?.action??'none',value:a&&'value' in a?a.value:null,price:a&&typeof a.price==='number'?a.price:null})}}
 // Comando esplicito su un piatto nominato senza attese (correzioni A): il modello ideale fa quello che dice il verbo.
 if(!actions.length&&here.length===1&&!said.length&&!/\b(?:non|nun|un|nu)\s+(?:\w+\s+)?(?:finit|esaurit|fernut|nascond|togli|lev|rimett)/.test(p)){const n=here[0]!,code=cat.code.get(n),a=/\b(rimett\w*|mostra\w*|fallo vedere)\b/.test(p)?{action:'set_hidden',item:code,value:false}:/\b(nascond\w*|togli\w*|lev\w*)\b/.test(p)&&!/evidenza|promo/.test(p)?{action:'set_hidden',item:code,value:true}:/\b(finit\w*|esaurit\w*)\b/.test(p)?{action:'set_available',item:code,value:false}:/\b(tornat\w*|di nuovo disponibil\w*)\b/.test(p)?{action:'set_available',item:code,value:true}:null;if(a)actions.push(a)}
 return actions.length?out({actions,uncertain}):out({intent:'clarify'})}

// Fase R: il modello ideale con gli strumenti nuovi (conferma, scarta, annulla) e la bozza della risposta.
export {brainOracle} from './brain-oracle-r.js'
