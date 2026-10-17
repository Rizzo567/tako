// Modello «ideale» per il bot NUOVO (cervello, perimetro N): risponde nello schema JSON strict del cervello vedendo TUTTO il
// contesto che il cervello gli manda (scheda ristoratore, cronologia, in sospeso, messaggio) e conoscendo le attese della
// conversazione, come currentOracle per il bot attuale. Non sceglie mai un piatto ambiguo, non inventa prezzi: i valori li
// prende dal messaggio (o, per i rimandi, dai messaggi recenti del titolare), il piatto dal messaggio o dal contesto.
// È un TETTO dell'architettura (contesto + validatore), non gpt-oss: i numeri «oracolo» non sono la resa del modello vero.
import {plainT} from '../judge.js'
import {spoken} from './current-oracle.js'
import type {Change,Conversation} from '../types.js'

const GENERIC=new Set(['alla','allo','alle','della','dello','delle','con','pasta','pizza','piatto','casa'])
const stems=(name:string)=>plainT(name).split(' ').filter(w=>w.length>3&&!GENERIC.has(w))
const skel=(w:string)=>w.replace(/[aeiou]/g,'')
const wordHit=(w:string,msg:string[])=>msg.some(m=>m===w||(m.length>=6&&w.length>=6?m.slice(0,6)===w.slice(0,6):m.length>=4&&w.length>=4&&m.slice(0,5)===w.slice(0,5))||(skel(m).length>=3&&skel(m)===skel(w)))
const hitStems=(name:string,msg:string)=>{const m=plainT(msg).split(' ');return stems(name).filter(w=>wordHit(w,m))}
const rivals=(dish:string,msg:string,names:string[])=>{const hit=hitStems(dish,msg),all=stems(dish);if(!hit.length||hit.length===all.length)return[];return names.filter(n=>n!==dish&&hit.every(w=>stems(n).some(x=>wordHit(w,[x])))&&hitStems(n,msg).length<=hit.length)}

type Cat={code:Map<string,string>,price:Map<string,number>,sections:Map<string,string>,sectionOf:Map<string,string>}
function catalog(card:string):Cat{const code=new Map<string,string>(),price=new Map<string,number>(),sections=new Map<string,string>(),sectionOf=new Map<string,string>();let sec=''
 for(const line of card.split('\n')){const s=line.match(/^# (c\d+) (.+?)(?: \(.+\))?$/);if(s){sections.set(s[2]!,s[1]!);sec=s[2]!;continue}
  const p=line.match(/^(p\d+)\|([^|]+)\|([\d.]+)/);if(p){code.set(p[2]!,p[1]!);price.set(p[2]!,Number(p[3]));sectionOf.set(p[2]!,sec)}}
 return{code,price,sections,sectionOf}}

const blank={action:'set_price',item:null,section:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}
const out=(o:any)=>JSON.stringify({intent:'change',read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:'',...o,actions:(o.actions??[]).map((a:any)=>({...blank,...a}))})
const QUESTION=/\?|^(?:quanto|quanti|cosa|che|quali|qual|com e|ce |c e )\b/
const SAME=/\b(ugual\w*|stess[oa]|idem|anche|pure|come)\b/
const CORRECT=/\b(no|scusa|intendevo|volevo|sbagliato|anzi|era|invece|ho detto)\b/
const ORD:[RegExp,number][]=[[/\b(prim[oa]|1)\b/,0],[/\b(second[oa]|2)\b/,1],[/\b(terz[oa]|3)\b/,2],[/\b(quart[oa]|4)\b/,3]]

function act(c:Change,cat:Cat,price:number|null,ref:string|null):any{const item=c.op==='create'?null:cat.code.get(c.dish)??null
 switch(c.op){case 'create':return{action:'create_item',section:c.section?cat.sections.get(c.section)??null:null,name:c.name,price:c.price}
  case 'price':return price!==null?{action:'set_price',item,price}:ref?{action:'set_price',item,price_ref:ref}:null
  case 'available':return{action:'set_available',item,value:c.value}
  case 'hidden':return{action:'set_hidden',item,value:c.value}
  case 'featured':return{action:'set_featured',item,value:c.value}
  case 'last':return{action:'set_last_portions',item,value:c.value}
  case 'promo':return c.price===null?{action:'remove_promo',item}:{action:'set_promo',item,price:c.price}
  case 'description':return{action:'set_description',item,text:c.text}}}

/** Risposta JSON del modello ideale alla richiesta del cervello, o null se la richiesta non è del cervello. */
export function brainOracle(conv:Conversation|null,body:any):string|null{
 const fmt=body?.response_format?.json_schema?.name
 if(fmt==='memory_judge')return JSON.stringify({useful:true,kind:'alias'})
 if(fmt!=='owner_brain_plan')return null
 if(!conv)return out({intent:'clarify'})
 const msgs=body.messages as {role:string,content:string}[],cat=catalog(msgs[1]!.content),last=msgs.at(-1)!.content
 const msg=(last.split('\nMESSAGGIO\n')[1]??last.replace(/^MESSAGGIO\n/,'')).trim(),p=plainT(msg)
 const hist=msgs.slice(2,-1),owners=hist.filter(m=>m.role==='user').map(m=>m.content),bot=[...hist].reverse().find(m=>m.role==='assistant')?.content??''
 const names=[...cat.code.keys()],expected=[...conv.changes,...(conv.interim??[])]
 // «a uno in meno»: quel numero è una differenza, non un prezzo.
 const rel=(t:string)=>new Set([...plainT(t).matchAll(/\b(\w+)(?: euro)? (?:in|di) (?:meno|piu)\b/g)].flatMap(m=>spoken(m[1]!)))
 const said=spoken(msg).filter(x=>!rel(msg).has(x)),ownSaid=owners.slice(-3).flatMap(o=>spoken(o).filter(x=>!rel(o).has(x)))
 const valueFor=(op:string,fallback:boolean)=>op==='available'?(/\b(tornat\w*|di nuovo|ce sta ancora|disponibil\w*|rimett\w*|c e)\b/.test(p)&&!/\b(finit\w*|esaurit\w*|fernut\w*|non c e)\b/.test(p)?true:/\b(finit\w*|esaurit\w*|fernut\w*|non c e piu|nun ce sta)\b/.test(p)?false:fallback)
  :op==='hidden'?(/\b(rimett\w*|mostra\w*|fallo vedere)\b/.test(p)?false:/\b(nascond\w*|togli\w*|lev\w*)\b/.test(p)?true:fallback):op==='featured'?(/\btogli\w* (l )?evidenza\b|non in evidenza/.test(p)?false:fallback):fallback
 // Candidati aperti: dal blocco IN SOSPESO o dall'elenco dell'ultima risposta del bot.
 const pend=last.match(/candidati ((?:p\d+,?)+)/)?.[1]?.split(',')??[]
 const listed=pend.length?pend.map(c=>names.find(n=>cat.code.get(n)===c)!).filter(Boolean):[...bot.matchAll(/\*([^*]+)\*/g)].map(m=>m[1]!.replace(/\s*\(.*\)$/,'')).filter(n=>cat.code.has(n))
 const sourceMsg=last.match(/sul messaggio «([^»]+)»/)?.[1]??owners.at(-1)??''
 // Il piatto che spiega più parole vince: «spritz aperol» non nomina lo Spritz Campari, «cornetti integrali» non il Cornetto.
 const covered=(n:string,t:string)=>{const h=hitStems(n,t);return names.some(o=>o!==n&&hitStems(o,t).length>h.length&&h.every(w=>hitStems(o,t).includes(w)))}
 const mentionedIn=(t:string)=>names.filter(n=>hitStems(n,t).length>0&&!rivalsOf(n,t).length&&!covered(n,t)).concat(names.filter(n=>plainT(t).includes(plainT(n))))
 const rivalsOf=(n:string,t:string)=>rivals(n,t,names)
 const here=[...new Set(mentionedIn(msg))]
 const lastOwnerDishes=(()=>{for(const o of [...owners].reverse()){const d=[...new Set(mentionedIn(o))];if(d.length)return d}return[] as string[]})()
 // Domanda: mai scrivere.
 if(QUESTION.test(p)||/\?/.test(msg)){const ids=(here.length?here:lastOwnerDishes).map(n=>cat.code.get(n)!);return out({intent:ids.length?'read':'capability',read:ids.length?'items':'none',item_refs:ids,capability_ids:ids.length?[]:['all']})}
 if(/^(grazie|ok grazie|perfetto|ciao|buongiorno)\b/.test(p))return out({intent:'chat',reply_draft:'Di nulla.'})
 // Scelta tra opzioni mostrate: ordinale, «tutti e due», o il nome di una delle opzioni.
 if(listed.length>1){const all=/\b(tutt[ie]|entramb\w*)\b/.test(p),ord=ORD.find(([re])=>re.test(p)),byName=listed.filter(n=>hitStems(n,msg).length>0),other=/\b(altr[oa])\b/.test(p)
  const negated=listed.filter(n=>new RegExp(`\\b${plainT(n).split(' ').slice(-1)[0]}\\b[^,]*\\bno\\b`).test(p))
  const chosen=all?listed:ord?[listed[ord[1]]!].filter(Boolean):byName.length===1?byName:other&&negated.length?listed.filter(n=>!negated.includes(n)):[]
  if(chosen.length){const src=plainT(sourceMsg),srcPrice=spoken(sourceMsg)[0]??null
   const srcAll=spoken(sourceMsg),acts=chosen.map(n=>{const e=expected.find(c=>c.op!=='create'&&c.dish===n);if(e)return act(e,cat,e.op==='price'?(srcAll.includes((e as any).price)?(e as any).price:srcPrice):null,null)
    return srcPrice!==null?{action:'set_price',item:cat.code.get(n),price:srcPrice}:/finit|esaurit/.test(src)?{action:'set_available',item:cat.code.get(n),value:false}:/nascond|togli|lev/.test(src)?{action:'set_hidden',item:cat.code.get(n),value:true}:null}).filter(Boolean)
   if(acts.length)return out({actions:acts})}}
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
 const creates=expected.filter((c):c is Extract<Change,{op:'create'}>=>c.op==='create'&&p.includes(plainT(c.name).split(' ').slice(-1)[0]!))
 if(creates.length&&/aggiung|inserisc|nuov/.test(p)){const miss=creates.flatMap(c=>[...(!c.section?['section']:[]),...(!said.includes(c.price)?['price']:[])]);if(miss.length)return out({intent:'clarify',clarify:{question:null,item_refs:[],missing:[...new Set(miss)]}});return out({actions:creates.map(c=>act(c,cat,null,null))})}
 const botLabel=[...bot.matchAll(/\*([^*\n]{2,80})\*\s*:/g)].map(m=>m[1]!).find(n=>cat.code.has(n))
 const ctxDish=botLabel&&!/\?/.test(bot)?botLabel:lastOwnerDishes.find(n=>expected.some(c=>c.op!=='create'&&c.dish===n))??lastOwnerDishes[0]
 const actions:any[]=[]
 // Correzione verso un altro piatto: «no, intendevo l'amatriciana» → rimetti il piatto di prima + stessa azione sul nuovo.
 if(CORRECT.test(p)&&relevantHere.length&&ctxDish&&!here.includes(ctxDish)&&!conv.changes.some(c=>c.op!=='create'&&c.dish===ctxDish))actions.push({action:'restore',item:cat.code.get(ctxDish)})
 // «torna come prima la lasagna», «rimetti la carbonara com'era»: ripristino del piatto nominato.
 const back=/\b(torna\w* come prima|com era|come prima|com eri)\b/.test(p)?here:[];for(const n of back)actions.push({action:'restore',item:cat.code.get(n)})
 if(!back.length)for(const n of relevantHere){for(const e of expected.filter(c=>c.op!=='create'&&c.dish===n)){const price=e.op==='price'?(said.find(x=>x===(e as any).price)??said[0]??(CORRECT.test(p)&&!SAME.test(p)?ownSaid[0]??null:null)):null
   const ref=e.op==='price'&&price===null&&SAME.test(p)&&ctxDish&&ctxDish!==n?cat.code.get(ctxDish)!:null
   if(e.op==='price'&&price===null&&!ref)continue
   if(e.op==='price'&&price!==null&&!said.includes(price)&&!ownSaid.includes(price))continue
   const a=act(e,cat,price,ref);if(a&&'value' in a&&typeof a.value==='boolean')a.value=valueFor(e.op,a.value);if(a&&!actions.some(x=>x.item===a.item&&x.action===a.action))actions.push(a);break}}
 // Risposta a una domanda del bot sulla richiesta di prima («hai scritto due prezzi: 9 o 9,50?» → «9»): la richiesta intera.
 if(!actions.length&&!here.length&&said.length&&/\?|riscrivimi|due prezzi/i.test(bot)){const prevD=lastOwnerDishes,prevSaid=spoken(owners.at(-1)??'')
  for(const n of prevD){const e=conv.changes.find(c=>c.op==='price'&&c.dish===n) as any;if(!e)continue;const v=said.includes(e.price)?e.price:prevSaid.includes(e.price)?e.price:null;if(v!==null)actions.push({action:'set_price',item:cat.code.get(n),price:v})}}
 // Nessun piatto nel messaggio: rimando al piatto del contesto («mettila a 13», «no scusa 14», «rimettila com'era»).
 if(!actions.length&&!here.length&&ctxDish){const e=expected.filter(c=>c.op!=='create'&&c.dish===ctxDish)
  if(/\b(rimett\w*|com era|come prima|annull\w*|torna\w*)\b/.test(p)&&!e.some(c=>conv.changes.includes(c)))actions.push({action:'restore',item:cat.code.get(ctxDish)})
  else if(said.length)actions.push({action:'set_price',item:cat.code.get(ctxDish),price:said[0]})
  else{const fin=conv.changes.find(c=>c.op!=='create'&&c.dish===ctxDish);if(fin&&fin.op!=='price'){const a=act(fin,cat,null,null);if(a)actions.push(a)}}}
 // Richiesta multipla con piatti ambigui accanto a parti chiare: le chiare in actions, ogni ambigua in uncertain.
 const residual=here.reduce((t,h)=>plainT(t).replace(plainT(h),' '),msg)
 const uncertain:any[]=[];if(actions.length){const seen=new Set<string>(here);for(const n of amb){if(seen.has(n)||!hitStems(n,residual).length)continue;const pool=[n,...rivalsOf(n,msg)];pool.forEach(x=>seen.add(x))
   const e=expected.find(c=>c.op!=='create'&&pool.includes(c.dish)),phrase=msg.split(/,|\se\s/).find(x=>hitStems(n,x).length>0)?.trim()??n
   const a=e?act(e,cat,e.op==='price'?(e as any).price:null,null):null
   uncertain.push({phrase,candidates:pool.map(x=>cat.code.get(x)),action:a?.action??'none',value:a&&'value' in a?a.value:null,price:a&&typeof a.price==='number'?a.price:null})}}
 return actions.length?out({actions,uncertain}):out({intent:'clarify'})}
