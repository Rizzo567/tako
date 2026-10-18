// Oracolo della FASE R (17/10/2026 notte, «un solo cervello»): col cervello acceso OGNI messaggio arriva al modello, quindi il
// modello ideale di brain-oracle.ts (che conosce le attese della conversazione) impara gli strumenti nuovi e scrive la bozza:
//  - proposta IN SOSPESO + conferma pura → confirm_pending; + «no / annulla / lascia stare» → cancel_pending;
//  - parti incerte IN SOSPESO: «no» → confirm_pending (pubblica le chiare), «annulla» → cancel_pending, risposte →
//    confirm_pending + le azioni nuove;
//  - domanda aperta / aggiunta non finita: la risposta completa la richiesta di prima (letta insieme al messaggio d'origine);
//  - ULTIMA PUBBLICAZIONE annullabile + «annulla», «anzi no», «torna indietro» da soli → undo_last;
//  - rifiuto del server (auto-correzione) → una domanda: il modello ideale non insiste;
//  - reply_draft sempre: «Fatto.» per le modifiche, la domanda per i chiarimenti, «Elimino X dal menu? Rispondi sì.».
// È un TETTO dell'architettura (instradamento + contesto + strumenti + validatore), NON la resa di gpt-oss.
import {appendFileSync} from 'node:fs'
import {brainOracleBase,catalog,hitStems,spoken,setSectionAnswer} from './brain-oracle.js'
import {plainT} from '../judge.js'
import {spokenDecimals,spokenCents} from '../../../apps/server/src/lib/twilio-menu-nlu.js'
import {g9WordNumber,relativeDelta} from '../../../apps/server/src/lib/twilio-menu-ai.js'
import {DELETE_VERB} from '../../../apps/server/src/lib/twilio-menu-structure.js'
import {EXPLICIT_SECTION} from '../../../apps/server/src/lib/owner-brain-r.js'
import type {Change,Conversation} from '../types.js'

const oneSpecial=<T extends {price:number}>(cs:T[],said:number[])=>cs.find(c=>said.includes(c.price))??cs[0]
const blank={action:'set_price',item:null,section:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}
const ctl=(action:string)=>({...blank,action})
const YES=new Set(['si','ok','okay','okey','conferma','confermo','confermato','certo','esatto','vai','procedi','va','bene','pubblica','pubblicalo','pubblicala','elimina','eliminalo','eliminala','eliminali','cancella','cancellalo','cancellala','cancellali','crea','creala','crealo','perfetto','pure','dai','grazie','fallo','tutto','d','accordo','cosi','benissimo','ottimo','procediamo','sì'])
const yes=(p:string)=>!!p&&p.split(' ').every(w=>YES.has(w))&&!/^(?:grazie|pure|dai|tutto)$/.test(p)
const NO=/^(?:(?:no|ah|allora|aspetta|scusa)\s+)*(?:no|annulla|annulla tutto|lascia stare|lascia perdere|niente|no grazie|non farlo|non pubblicare|no lascia stare|no lascia perdere|non eliminarlo|non eliminarla|non cancellarlo|non cancellarla|tienilo|tienila|no tienilo|no tienila|non crearla|no non crearla)$/
const UNDO_ALONE=/^(?:(?:no|scusa|aspetta|anzi|ops|ah)\s+)*(?:lascia stare|lascia perdere|rimettil[oaie] com era|rimettil[oaie] come prima|lascial[aoie](?: stare| com era| cosi)?|annulla(?: tutto| l ultima(?: modifica)?| la modifica| quello che hai fatto)?|annullala|annullalo|torna indietro|tornare indietro|rimetti come prima|torna come prima|rimetti com era|anzi no|no aspetta|ho sbagliato(?: annulla)?|lascia stare ho sbagliato|era giusto prima|il prezzo di prima era giusto|lascia com era|annulla per favore)$/

const out=(o:any)=>{if(process.env.TAKO_ORACLE_DUMP)appendFileSync(process.env.TAKO_ORACLE_DUMP!,'OUT@'+(new Error().stack??'').split('\n')[2]+'\n');return out0(o)},out0=(o:any)=>JSON.stringify({intent:'change',read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:'',...o,actions:(o.actions??[]).map((a:any)=>({...blank,...a}))})
const nameOf=(cat:ReturnType<typeof catalog>,code:string|null|undefined)=>[...cat.code].find(([,c])=>c===code)?.[0]

/** Bozza del modello ideale sul piano già deciso. */
function withDraft(d:any,cat:ReturnType<typeof catalog>,p:string,sectionNames:string[]):any{
 if(typeof d.reply_draft==='string'&&d.reply_draft.trim())return d
 const acts=(d.actions??[]).filter((a:any)=>!['confirm_pending','cancel_pending','undo_last'].includes(a.action))
 if(d.intent==='clarify'){const miss:string[]=d.clarify?.missing??[],cr=acts.find((a:any)=>a.action==='create_item'),ids:string[]=d.clarify?.item_refs??[]
  d.reply_draft=miss.length?(miss.includes('price')?`Quanto costa ${cr?.name??'il piatto nuovo'}?`:'')+(miss.includes('section')?` In quale categoria lo metto?`:'')+(miss.includes('name')?' Come si chiama il piatto?':''):ids.length>1?'Quale intendi?':ids.length===1?`Intendi ${nameOf(cat,ids[0])}? Dimmi cosa cambiare.`:'Non sono sicuro di aver capito: cosa vuoi cambiare?'
  d.reply_draft=d.reply_draft.trim();return d}
 if(d.uncertain?.length){d.reply_draft=d.uncertain.map((u:any)=>`Per «${u.phrase}» cosa intendi?`).join(' ');return d}
 if(d.intent==='read')return d
 if(d.intent==='capability'){d.reply_draft='Posso cambiare prezzi e disponibilità, nascondere o mettere in evidenza i piatti, aggiungerne di nuovi, eliminarli, spostarli e rinominarli, e gestire le categorie.';return d}
 if(d.intent==='chat'){d.reply_draft=d.reply_draft||'Dimmi pure cosa vuoi cambiare nel menu.';return d}
 const dels=acts.filter((a:any)=>a.action==='delete_item').map((a:any)=>'*'+(nameOf(cat,a.item)??'il piatto')+'*')
 if(dels.length){d.reply_draft=`Elimino ${dels.length>1?dels.slice(0,-1).join(', ')+' e '+dels.at(-1):dels[0]} dal menu? Rispondi sì.`;return d}
 const newSec=acts.find((a:any)=>a.action==='create_section')
 if(newSec&&!EXPLICIT_SECTION.test(p)&&!sectionNames.some(n=>plainT(n)===plainT(String(newSec.name??'')))){d.reply_draft=`Nel menu non c'è la categoria ${newSec.name}: la creo? Rispondi sì.`;return d}
 d.reply_draft=acts.length>3?'Rispondi OK per pubblicare.':'Fatto.';return d}

export function brainOracle(conv:Conversation|null,body:any):string|null{
 const fmt=body?.response_format?.json_schema?.name
 if(fmt!=='owner_brain_plan'||!conv)return brainOracleBase(conv,body)
 const msgs=body.messages as {role:string,content:string}[],last=String(msgs.at(-1)?.content??'')
 const cat=catalog(msgs[1]!.content),sectionNames=[...cat.sections.keys()]
 // Rifiuto del server: il modello ideale non insiste, chiede (con i piatti del piano rifiutato come candidati).
 if(last.startsWith('IL SERVER HA RIFIUTATO IL PIANO: ')){let prev:any={};try{prev=JSON.parse(msgs.at(-2)?.content??'{}')}catch{}
  const ids=[...new Set([...(prev.actions??[]).map((a:any)=>a?.item).filter((x:unknown)=>typeof x==='string'&&/^p\d+$/.test(x)),...(prev.clarify?.item_refs??[])])] as string[]
  const listed=(last.match(/piatti possibili: ([^\n]+?)\. Rifai/)?.[1]??'').split(', ').map(n=>cat.code.get(n)).filter((c):c is string=>!!c)
  if(listed.length>1){ids.splice(0,ids.length,...listed)}
  // Più parti incerte (la sua «uncertain» + l'ambiguità trovata dal server): una domanda per ciascuna, le parti chiare restano.
  if(listed.length>1&&(prev.uncertain??[]).length){const orig=(String(msgs.at(-3)?.content??'').split('\nMESSAGGIO\n').pop()??'').replace(/^MESSAGGIO\n/,''),amb0=(prev.actions??[]).filter((a:any)=>listed.includes(a?.item)),clear=(prev.actions??[]).filter((a:any)=>!listed.includes(a?.item))
   const unc=[...prev.uncertain,...amb0.map((a:any)=>{const n=nameOf(cat,a.item)??'',w=plainT(n).split(' ')[0]!.slice(0,4);return{phrase:orig.split(/,|\s+e\s+/).find(x=>plainT(x).includes(w))?.trim()??n,candidates:listed.filter(c=>plainT(nameOf(cat,c)??'').split(' ').some(x=>x.slice(0,4)===w)),action:a.action,value:a.value??null,price:typeof a.price==='number'?a.price:null}})]
   return out({intent:'change',actions:clear,uncertain:unc,reply_draft:unc.map((u:any)=>`Per «${u.phrase}» quale intendi?`).join(' ')})}
  const amb=(/ambiguo|candidati|possibili/.test(last))&&ids.length>1
  if(/a suono/.test(last)&&ids.length===1){const act=(prev.actions??[]).find((x:any)=>x?.item===ids[0]);return out({intent:'clarify',clarify:{question:null,item_refs:ids,missing:[]},actions:act?[act]:[],reply_draft:`Intendi ${nameOf(cat,ids[0])}? Rispondi sì o no.`})}
  return out({intent:'clarify',clarify:{question:null,item_refs:amb?ids:[],missing:[]},reply_draft:amb?'Quale intendi?':/conferma|sì|ok/i.test(last)&&/proposta/.test(last)?'Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.':'Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?'})}
 if(process.env.TAKO_ORACLE_DUMP)(globalThis as any).require?.('fs');if(process.env.TAKO_ORACLE_DUMP)import('node:fs').then(fs=>fs.appendFileSync(process.env.TAKO_ORACLE_DUMP!,'---\n'+last.slice(-900)+'\n'))
 const [head,tail]=last.includes('\nMESSAGGIO\n')?last.split('\nMESSAGGIO\n') as [string,string]:['',last.replace(/^MESSAGGIO\n/,'')]
 // Il modello ideale capisce i decimali detti a voce («dodici virgola cinque», «7 euro 90»): li legge come il server
 // li leggeva prima di R (spokenDecimals/spokenCents). Il validatore resta sul testo vero.
 const hmute=new Map([...cat.code.keys()].filter(n=>/h/.test(plainT(n))&&!plainT(n).includes(' ')).map(n=>[plainT(n).replace(/h/g,''),n] as const))
 // R5.1: storpiature di Whisper che si leggono uguali («kenesac» = «Che ne sacc»): chiave fonetica senza spazi, c/ch/k uguali.
 const phon=(t:string)=>plainT(t).replace(/\s+/g,'').replace(/ch/g,'k').replace(/c/g,'k').replace(/(.)\1+/g,'$1'),pmap=new Map([...cat.code.keys()].filter(n=>plainT(n).includes(' ')&&phon(n).length>=6).map(n=>[phon(n),n] as const))
 const raw0=(tail??'').trim().replace(/[\p{L}]+/gu,w=>hmute.get(plainT(w))??(w.length>=6?pmap.get(phon(w)):undefined)??w),msg0=spokenCents(spokenDecimals(raw0)).replace(/\b([a-zà]{3,})\b/gi,w=>{const l=w.toLowerCase();if(['una','uno','zero'].includes(l))return w;if([...cat.code.keys()].some(n=>plainT(n).split(' ').includes(l)))return w;const n=g9WordNumber(l);return n!==null&&n>=2?String(n):w}),msg=msg0.trim().split(/\s+/).length>=4?msg0.replace(/[,\s]+(?:ok|okay|va bene|d['’ ]?accordo|grazie|perfetto|si|sì)\s*[?!.]*\s*$/i,''):msg0,p=plainT(msg)
 if(msg!==(tail??'').trim())body={...body,messages:[...msgs.slice(0,-1),{role:'user',content:(head?head+'\nMESSAGGIO\n':'MESSAGGIO\n')+msg}]}
 const proposal=/IN SOSPESO \(proposta non confermata/.test(head),hold=/IN SOSPESO \(parti chiare non pubblicate/.test(head)
 const ask=/IN SOSPESO \(tua domanda aperta\)/.test(head)||/IN SOSPESO \(aggiunta di un piatto non finita/.test(head),undo=/ULTIMA PUBBLICAZIONE \(annullabile/.test(head)
 if(proposal){if(yes(p))return out({actions:[ctl('confirm_pending')],reply_draft:'Fatto.'});if(NO.test(p))return out({actions:[ctl('cancel_pending')],reply_draft:'Va bene, lascio il menu com’è.'})}
 if(proposal&&/riepilogo|prezzo insolito/.test(head)&&!/\bsolo\b/.test(p)&&/\b(no|lascia\w* stare|lascia\w* perdere|tranne|non (?:lo |la )?(?:toccare|nascondere|cambiare))\b/.test(p)&&[...cat.code.keys()].some(n=>hitStems(n,msg).length>0&&head.includes(cat.code.get(n)+' ')))return out({intent:'change',actions:[],reply_draft:'Va bene, lo tolgo dal riepilogo. Rispondi OK per pubblicare il resto.'})
 // Risposte alle domande delle parti incerte («la nonna e la piccola», «A sì, B la seconda»): per ogni domanda il candidato
 // che il messaggio distingue, con l'azione capita (prezzo dalla frase della domanda).
 if(hold&&!/^(?:no|annulla)\b/.test(p)){const asks=[...head.matchAll(/«([^»]+)» candidati ((?:p\d+,?)+)/g)].map(m=>({word:m[1]!,ids:m[2]!.split(',').filter(Boolean)})),acts:any[]=[],own=(n:string,ns:string[])=>plainT(n).split(' ').filter(w=>w.length>=3&&!['alla','allo','della','dello','con','del'].includes(w)&&!ns.every(o=>plainT(o).split(' ').includes(w)))
  const ords=[...p.matchAll(/\b(prim[oa]|second[oa]|terz[oa])\b/g)].map(m=>/^prim/.test(m[1]!)?0:/^second/.test(m[1]!)?1:2)
  asks.forEach((q,qi)=>{const ns=q.ids.map(c=>nameOf(cat,c)).filter((n):n is string=>!!n),hit=ns.filter(n=>own(n,ns).some(w=>p.split(' ').some(x=>x.length>=3&&x.slice(0,5)===w.slice(0,5)))),pick=hit.length===1?hit[0]:ords.length===asks.length?ns[ords[qi]!]:ords.length===1&&asks.length===1?ns[ords[0]!]:undefined
   const pk=pick??(ns.length===1?ns[0]:undefined);if(!pk)return;const e=[...conv.changes,...(conv.interim??[])].find(c=>c.op!=='create'&&(c as any).dish===pk),pr=spoken(q.word)[0]
   if(e&&e.op==='price')acts.push({action:'set_price',item:cat.code.get(pk),price:(e as any).price});else if(pr!==undefined)acts.push({action:'set_price',item:cat.code.get(pk),price:pr});else if(e&&(e.op==='hidden'||e.op==='available'||e.op==='featured'))acts.push({action:'set_'+e.op,item:cat.code.get(pk),value:(e as any).value})})
  if(acts.length)return out({actions:[ctl('confirm_pending'),...acts],reply_draft:'Fatto.'})}
 // «no, il caviale lascialo stare»: pubblica le parti chiare (il server toglie il caviale negato).
 if(hold&&/^no\b.*\blascial[oaie] (?:stare|perdere)$/.test(p))return out({actions:[ctl('confirm_pending')],reply_draft:'Fatto.'})
 if(hold){if(/^(?:no|no grazie|no no|no lascia stare|lascia stare|solo quelle|pubblica il resto)$/.test(p))return out({actions:[ctl('confirm_pending')],reply_draft:'Fatto.'});if(/^(?:annulla|annulla tutto|non pubblicare niente|niente)$/.test(p))return out({actions:[ctl('cancel_pending')],reply_draft:'Va bene, non pubblico niente.'})}
 if(!proposal&&!hold&&undo&&UNDO_ALONE.test(p))return out({actions:[ctl('undo_last')],reply_draft:'Ho annullato l’ultima modifica.'})
 // «annulla il tiramisù» quando l'ultima pubblicazione è proprio quella del tiramisù: è l'annullamento.
 {const u=head.match(/ULTIMA PUBBLICAZIONE \(annullabile[^)]*\): ([^\n]+)/)?.[1];if(!proposal&&!hold&&u&&/^(?:annulla|annullala|annullalo)\b/.test(p)){const said=[...cat.code.keys()].filter(n=>(' '+p+' ').includes(' '+plainT(n)+' ')),rest=p.replace(/^(?:annulla\w*)\s+(?:(?:il|la|lo|le|li|gli|i|l)\s+)?/,'');if(said.length&&said.every(n=>plainT(u).includes(plainT(n)))||!said.length&&rest.length>=3&&plainT(u).includes(rest))return out({actions:[ctl('undo_last')],reply_draft:'Ho annullato l’ultima modifica.'})}}
 // «la seconda no» dopo «nascondi la diavola e la margherita»: si rimette com'era quel piatto.
 {const m=p.match(/^(?:no\s+)?(?:la|il|l)\s+(prim|second|terz)\w*\s+no$/),prev=[...msgs.slice(2,-1)].reverse().find(x=>x.role==='user')?.content??''
  if(m){const pp=plainT(prev),list=[...cat.code.keys()].filter(n=>pp.includes(plainT(n))).sort((a,b)=>pp.indexOf(plainT(a))-pp.indexOf(plainT(b))),k=m[1]==='prim'?0:m[1]==='second'?1:2;if(list[k])return out({actions:[{action:'restore',item:cat.code.get(list[k]!)}],reply_draft:'Fatto.'})}}
 // «elimina tutti i dolci», «sono tornati tutti i dolci»: i piatti della categoria nominata.
 {const m=p.match(/\btutt[ieoa] (?:i |le |gli )?(\w+)/),sec=m?sectionNames.find(n=>plainT(n)===m[1]||plainT(n).slice(0,5)===m[1]!.slice(0,5)):undefined
  if(sec&&!proposal){const items=[...cat.code.keys()].filter(n=>cat.sectionOf.get(n)===sec),verb:any=DELETE_VERB.test(p)?{action:'delete_item'}:/\b(tornat\w*|disponibil\w*)\b/.test(p)?{action:'set_available',value:true}:/\b(finit\w*|esaurit\w*)\b/.test(p)?{action:'set_available',value:false}:/\b(nascond\w*|togli\w*)\b/.test(p)?{action:'set_hidden',value:true}:/\b(rimett\w*|mostra\w*)\b/.test(p)?{action:'set_hidden',value:false}:null
   if(items.length&&verb)return JSON.stringify(withDraft(JSON.parse(out({actions:items.map(n=>({...verb,item:cat.code.get(n)}))})),cat,p,sectionNames))}}
 // «quei due mettili negli antipasti», «spostali negli speciali»: i piatti dei messaggi di prima nella categoria detta.
 {const m=p.match(/\b(?:quei|quelli|entramb\w*|tutti|mettil[ie]|spostal[ie]|portal[ie])\b.*\b(?:nei|negli|nelle|nella|nel|tra i|tra le|in)\s+(\w+)/),sec=m?sectionNames.find(n=>plainT(n).slice(0,5)===m[1]!.slice(0,5)):undefined
  if(sec&&!/\b(categori\w*)\b/.test(p)&&!/\b(?:sposta|metti|porta)\s*l['’]/i.test(msg)){const owners=msgs.slice(2,-1).filter(x=>x.role==='user').map(x=>plainT(x.content.split('\nMESSAGGIO\n').pop()!)).slice(-3),items=[...new Set(owners.flatMap(o=>[...cat.code.keys()].filter(n=>(' '+o+' ').includes(' '+plainT(n)+' '))))].filter(n=>cat.sectionOf.get(n)!==sec)
   if(items.length>=2)return JSON.stringify(withDraft(JSON.parse(out({actions:items.map(n=>({action:'move_item',item:cat.code.get(n),section:cat.sections.get(sec)}))})),cat,p,sectionNames))}}
 // Due prezzi alternativi («metti la coda a 17 o 18»): il modello ideale chiede quale, le altre parti restano chiare.
 {const alt=msg.match(/(\d+(?:[.,]\d+)?)\s*(?:euro\s*)?(?:o|oppure|\/)\s*(\d+(?:[.,]\d+)?)/)??msg.match(/\btra\s+(\d+(?:[.,]\d+)?)\s+e\s+(\d+(?:[.,]\d+)?)/)
  if(alt&&!proposal&&!hold){const clauses=msg.split(/,|;|\s+e\s+(?=(?:il|la|lo|l|i|gli|le|metti)\b)/),ac=clauses.find(c=>c.includes(alt[0]))??msg,names=[...cat.code.keys()],dish=names.filter(n=>hitStems(n,ac).length>0||(' '+plainT(ac)+' ').includes(' '+plainT(n)+' ')).sort((a,b)=>hitStems(b,ac).length-hitStems(a,ac).length)[0]
   if(dish){const rest=msg.replace(ac,' '),d0=plainT(rest).split(' ').filter(w=>w.length>2).length>1?JSON.parse(brainOracleBase(conv,{...body,messages:[...msgs.slice(0,-1),{role:'user',content:(head?head+'\nMESSAGGIO\n':'MESSAGGIO\n')+rest}]})!):null,clear=d0?.intent==='change'?(d0.actions??[]).filter((a:any)=>a.item!==cat.code.get(dish)):[]
    const q=`Per ${dish} vuoi ${alt[1]} o ${alt[2]}?`
    if(clear.length)return out({intent:'change',actions:clear,uncertain:[{phrase:ac.trim(),candidates:[cat.code.get(dish)],action:'set_price',value:null,price:null}],reply_draft:q})
    return out({intent:'clarify',clarify:{question:null,item_refs:[cat.code.get(dish)],missing:[]},actions:[],reply_draft:q})}
   if(!dish&&!names.some(n=>hitStems(n,msg).length>0))return out({intent:'clarify',clarify:{question:null,item_refs:[],missing:[]},actions:[],reply_draft:`Per quale piatto vuoi ${alt[1]} o ${alt[2]}?`})}}
 // «e la gricia a uno in meno» dopo «metti la carbonara a 13»: il modello ideale scrive il prezzo (12), non la differenza.
 {const lastBot=[...msgs.slice(2,-1)].reverse().find(x=>x.role==='assistant')?.content??'',m=lastBot.replace(/\*/g,'').match(/prezzo da [\d.,]+\s*€ a ([\d.,]+)\s*€/),rd=/^(?:e|ed|anche|pure)\b/.test(p)?relativeDelta(msg):null
  if(m&&rd){const v=Number(m[1]!.replace(/\./g,'').replace(',','.'))+rd.delta,n=[...cat.code.keys()].find(x=>hitStems(x,msg).length>0||(' '+p+' ').includes(' '+plainT(x)+' '));if(n&&v>0)return out({actions:[{action:'set_price',item:cat.code.get(n),price:Math.round(v*100)/100}],reply_draft:'Fatto.'})}}
 // R5.1: «da domani costa 13,50»: il bot non programma le modifiche → chiede se cambiarlo adesso (azione capita in sospeso).
 if(!proposal&&!hold&&/\bda (?:domani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|stasera|la prossima settimana)\b/.test(p)){const n=[...cat.code.keys()].find(x=>(' '+p+' ').includes(' '+plainT(x)+' ')),v=[...new Set(spoken(msg))]
  if(n&&v.length>=1)return out({intent:'clarify',clarify:{question:null,item_refs:[cat.code.get(n)],missing:[]},actions:[{action:'set_price',item:cat.code.get(n),price:v.at(-1)}],reply_draft:`Non posso programmare le modifiche per domani: cambio ${n} adesso?`})}
 // R5.1: differenza detta («la tagliata 2 euro in meno», «abbassa di 50 cent la birra»): price_delta sul piatto nominato.
 if(!proposal&&!hold){const rd=relativeDelta(msg),ns=[...cat.code.keys()].filter(x=>(' '+p+' ').includes(' '+plainT(x)+' ')).filter((x,_,a)=>!a.some(y=>y!==x&&plainT(y).includes(plainT(x))))
  if(rd&&ns.length===1&&!/^(?:e|ed|anche|pure)\b/.test(p)&&!/\b(come|uguale|stesso)\b/.test(p))return out({actions:[{action:'set_price',item:cat.code.get(ns[0]!),price:null,price_delta:rd.delta}],reply_draft:'Fatto.'})}
 // R5.1: dialetto del glossario della scheda («un c'è cchiù» = finito, «nun è fernuta, ce sta ancora» = disponibile).
 {const names=[...cat.code.keys()].filter(n=>(' '+p+' ').includes(' '+plainT(n)+' '));if(names.length===1&&!proposal&&!hold&&!/^(?:no|anzi|scusa)\b/.test(p)){const yes=/\b(?:nun|non|un) e fernut\w*|ce sta ancora|ce sta n ata vota|e tornat\w*/.test(p),no=!yes&&/\b(?:un|nun) c e cchiu|nun ce sta cchiu|nun ce n e|e fernut\w*|s e fernut\w*|l e finid\w*|la xe finia/.test(p)
  if(yes||no)return out({actions:[{action:'set_available',item:cat.code.get(names[0]!),value:yes}],reply_draft:'Fatto.'})}}
 // R5.1: pronome sul piatto dell'ultimo scambio («mettila in evidenza», «mettila uguale alla carbonara»).
 {const m=p.match(/^(?:e\s+|ora\s+|poi\s+)?(?:mettil[aoie]|mettimel[aoie]|fall[aoie]|portal[aoie])\s+(in evidenza|(?:uguale|come|allo stesso prezzo)\s+(?:a|al|alla|allo|ai|alle|della|del|di)?\s*(.+))$/)
  if(m){const hist=[...msgs.slice(2,-1)].reverse(),said=(t:string)=>[...cat.code.keys()].filter(x=>t.includes('*'+x+'*')||(' '+plainT(t)+' ').includes(' '+plainT(x)+' ')),ref=m[2]?[...cat.code.keys()].find(x=>(' '+plainT(m[2]!)+' ').includes(' '+plainT(x)+' ')||hitStems(x,m[2]!).length>0):undefined
   let target:string|undefined;for(const h of hist){const c=said(h.content.split('\nMESSAGGIO\n').pop()!).filter(x=>x!==ref);if(c.length===1){target=c[0];break}if(c.length>1)break}
   if(target&&m[1]==='in evidenza')return out({actions:[{action:'set_featured',item:cat.code.get(target),value:true}],reply_draft:'Fatto.'})
   if(target&&ref)return out({actions:[{action:'set_price',item:cat.code.get(target),price:null,price_ref:cat.code.get(ref)}],reply_draft:'Fatto.'})}}
 // «no, mettilo in una categoria nuova, speciali», «spostalo nei dolci»: il piatto dell'ultima risposta / dell'ultimo messaggio.
 {const m=p.match(/^(?:no\s+)?(?:mettil[oa]|spostal[oa]|portal[oa])\s+(?:in|nei|negli|nelle|nella|nel|tra i|tra le)\s+(?:una\s+)?(?:categoria\s+)?(?:nuova\s+)?(?:che si chiama\s+)?(\w+(?: \w+)?)$/),lb=[...msgs.slice(2,-1)].reverse().find(x=>x.role==='assistant')?.content??''
  if(m){const n=[...cat.code.keys()].find(x=>lb.includes('*'+x+'*'));if(n){const ex=sectionNames.find(s=>plainT(s).slice(0,5)===m[1]!.slice(0,5)),nm=ex??(m[1]!.charAt(0).toUpperCase()+m[1]!.slice(1));return JSON.stringify(withDraft(JSON.parse(out({actions:[...(ex?[]:[{action:'create_section',name:nm}]),{action:'move_item',item:cat.code.get(n),section:ex?cat.sections.get(ex):nm}]})),cat,p,sectionNames))}}}
 // «togli l'evidenza», «togli la promo» subito dopo averla messa: sul piatto dell'ultimo messaggio.
 {const m=p.match(/^(?:no\s+)?togli\s+(?:l\s+|la\s+)?(evidenza|promo|offerta)$/),prev=[...msgs.slice(2,-1)].reverse().find(x=>x.role==='user')?.content??'',pp=plainT(prev),n=[...cat.code.keys()].find(x=>pp.includes(plainT(x)))
  if(m&&n)return out({actions:[m[1]==='evidenza'?{action:'set_featured',item:cat.code.get(n),value:false}:{action:'remove_promo',item:cat.code.get(n)}],reply_draft:'Fatto.'})}
 // «rimettila» dopo averla nascosta: torna visibile (non «in evidenza»).
 if(/^(?:e\s+)?rimettil[aoie]$/.test(p)){const prev=[...msgs.slice(2,-1)].reverse().find(x=>x.role==='user'&&/nascond/.test(plainT(x.content)))?.content??'',pp=plainT(prev),n=[...cat.code.keys()].find(x=>pp.includes(plainT(x)));if(n&&/nascond/.test(pp))return out({actions:[{action:'set_hidden',item:cat.code.get(n),value:false}],reply_draft:'Fatto.'})}
 // «no, nei primi» subito dopo uno spostamento: gli stessi piatti nell'altra categoria.
 {const m=p.match(/^(?:no|anzi|scusa)\s+(?:no\s+)?(?:mettil[oaie]\s+|spostal[oaie]\s+)?(?:nei|negli|nelle|nella|nel|tra i|tra le|in)\s+(\w+)$/),prev=[...msgs.slice(2,-1)].reverse().find(x=>x.role==='user')?.content??'',pp=plainT(prev)
  if(m&&/\b(spost\w*|mett\w*)\b/.test(pp)){const sec=sectionNames.find(n=>plainT(n).slice(0,5)===m[1]!.slice(0,5)),items=[...cat.code.keys()].filter(n=>pp.includes(plainT(n)));if(sec&&items.length)return out({actions:items.map(n=>({action:'move_item',item:cat.code.get(n),section:cat.sections.get(sec)})),reply_draft:'Fatto.'})}}
 // Categorie (fase B): rinomina e crea dette in modo esplicito.
 if(/\b(categori\w*|sezion\w*)\b/.test(p)){const exp:Change[]=[...conv.changes,...(conv.interim??[])],old=sectionNames.filter(n=>(' '+p+' ').includes(' '+plainT(n)+' '))
  {const pairs=[...p.matchAll(/\bcategoria (\w+) in (\w+)/g)].map(m=>[sectionNames.find(n=>plainT(n)===m[1]),m[2]] as const).filter(([a])=>!!a);if(/\brinomin\w*\b/.test(p)&&pairs.length>1){const exp:Change[]=[...conv.changes,...(conv.interim??[])];return JSON.stringify(withDraft(JSON.parse(out({actions:pairs.map(([a,b])=>({action:'rename_section',section:cat.sections.get(a!),name:exp.find((c):c is Extract<Change,{op:'move'}>=>c.op==='move'&&plainT(c.section)===b)?.section??b.charAt(0).toUpperCase()+b.slice(1)}))})),cat,p,sectionNames))}}
  if(/\b(rinomin\w*|chiamal\w*|nome)\b/.test(p)&&old.length){const to=exp.find((c):c is Extract<Change,{op:'move'}>=>c.op==='move'&&!sectionNames.some(n=>plainT(n)===plainT(c.section)))?.section??exp.find((c):c is Extract<Change,{op:'section'}>=>c.op==='section')?.name
   const fromName=old[0]!,newName=to??(p.match(/\b(?:in|chiamala)\s+(\w+(?: \w+)?)$/)?.[1]??null)
   if(newName)return JSON.stringify(withDraft(JSON.parse(out({actions:[{action:'rename_section',section:cat.sections.get(fromName),name:newName}]})),cat,p,sectionNames))}
  const lit=p.match(/\b(?:crea\w*|aggiungi|fai)\s+(?:un altra |una |la |un )?(?:nuova )?categoria(?: nuova)?(?: che si chiama| chiamata|:)?\s+(.+)$/)?.[1]?.replace(/\s+(?:per favore|per piacere|se puoi|grazie(?: mille)?|dai|subito|ok|please|ti prego)$/,'').trim(),litOK=lit&&!sectionNames.some(n=>plainT(n)===lit)&&!/\b(e|con|mettici|spostaci|poi)\b/.test(lit)
  const secs=[...exp.filter((c):c is Extract<Change,{op:'section'}>=>c.op==='section'&&(' '+p+' ').includes(' '+plainT(c.name)+' ')),...(litOK&&!exp.some(c=>c.op==='section'&&plainT(c.name)===lit)?[{op:'section' as const,name:(exp.find(c=>(c.op==='create'||c.op==='move')&&plainT((c as any).section??'')===lit) as any)?.section??lit.charAt(0).toUpperCase()+lit.slice(1)}]:[])]
  const want=p.match(/\b(?:categori\w*|sezion\w*)\s+(?:che si chiama\s+|nuova\s+|chiamata\s+)?(\w+)/)?.[1]
  const dup=want&&sectionNames.find(n=>plainT(n)===want||plainT(n).slice(0,5)===want.slice(0,5))
  if(!secs.length&&dup&&/\b(crea\w*|aggiung\w*|nuov\w*)\b/.test(p)&&!exp.some(c=>c.op==='create'))return out({intent:'chat',reply_draft:`La categoria ${dup} c'è già: uso quella.`})
  if(secs.length){const acts:any[]=secs.map(c=>({action:'create_section',name:c.name}))
   for(const c of exp)if(c.op==='create'&&c.section&&secs.some(x=>plainT(x.name)===plainT(c.section!))&&p.includes(plainT(c.name).split(' ').slice(-1)[0]!))acts.push({action:'create_item',name:c.name,price:c.price,section:c.section})
   for(const c of exp)if(c.op==='move'&&cat.code.has(c.dish)&&secs.some(x=>plainT(x.name)===plainT(c.section))&&(' '+p+' ').includes(' '+plainT(c.dish)+' '))acts.push({action:'move_item',item:cat.code.get(c.dish),section:c.section})
   return JSON.stringify(withDraft(JSON.parse(out({actions:acts})),cat,p,sectionNames))}}
 let d:any=JSON.parse(brainOracleBase(conv,body)!)
 // Risposta a una domanda aperta o a un'aggiunta non finita: il modello ideale legge la richiesta di prima insieme alla risposta.
 const src=head.match(/sul messaggio «([^»]+)»/)?.[1]??(ask?[...msgs].reverse().find((m,i)=>i>0&&m.role==='user')?.content:undefined)
 const named=[...cat.code.keys()].some(n=>hitStems(n,msg).length>0||(' '+p+' ').includes(' '+plainT(n)+' '))
 let joinedText=msg
 const isQ=/\?/.test(msg)||/^(?:che|quali|quanto|quanti|cosa|com e|c e)\b/.test(p)
 // Risposta alla categoria: «secondi», «nei secondi», «mettilo nei piatti di prova».
 setSectionAnswer(sectionNames.map(n=>plainT(n)).find(n=>{const t=p.replace(/^(?:va bene|ok|si)\s+/,'').replace(/^(?:mettil[oaie]\s+)?(?:nei|negli|nelle|nella|nel|tra i|tra gli|tra le|in)\s+/,'');return t.length>=3&&(n===t||n.slice(0,5)===t.slice(0,5))})??null)
 if(!isQ&&!/^(?:grazie|ok grazie|perfetto|ciao|buongiorno|va bene grazie)\b/.test(p)&&(ask||hold)&&src&&(!named||d.intent!=='change'||!(d.actions??[]).length)){const joined={...body,messages:[...msgs.slice(0,-1),{role:'user',content:(head?head+'\nMESSAGGIO\n':'MESSAGGIO\n')+src.replace(/\?/g,' ')+' '+msg}]}
  const d2=JSON.parse(brainOracleBase(conv,joined)!);if(!named||d2.intent==='change'&&(d2.actions??[]).length){d=d2;joinedText=src+' '+msg}}
 // Elenco con un solo verbo («nascondi boh, la parmigiana, tiramisù e pasta al ragù»): il modello letterale lo applica a TUTTI i
 // piatti nominati (anche quelli che il titolare poi toglie dal riepilogo), non solo a quelli dello stato finale atteso.
 if(d.intent==='change'&&(d.actions??[]).length){const kinds=new Set((d.actions as any[]).map(a=>a.action+':'+a.value)),only=kinds.size===1?[...kinds][0]!:null
  if(only&&/^(set_hidden|set_available|set_featured):(true|false)$/.test(only)&&!/\b(tranne|eccetto|non|no|lascia\w*)\b/.test(p)&&!/\?/.test(msg)&&!/\b(quanto|quanti|quali|cosa)\b/.test(p)){const [action,v]=only.split(':')
   const vre=action==='set_hidden'?/\b(nascond\w*|togli\w*|lev\w*)\b/:action==='set_available'?/\b(finit\w*|esaurit\w*|tornat\w*)\b/:/\bevidenza\b/,vi=p.search(vre),after=vi>=0?p.slice(vi):''
   if(after&&!/\b(aggiung\w*|a \d|costa)\b/.test(after))for(const n of [...cat.code.keys()].filter(n=>(' '+after+' ').includes(' '+plainT(n)+' ')))if(!(d.actions as any[]).some(a=>a.item===cat.code.get(n)))d.actions.push({action,item:cat.code.get(n),value:v==='true'})}}
 // Regola del titolare: «elimina / levalo proprio / togli del tutto» è un'eliminazione (con conferma), mai un nascondi, anche
 // quando poi il titolare dice di no (l'attesa finale non ha l'eliminazione: il modello letterale la propone lo stesso).
 const DEL=DELETE_VERB
 if(DEL.test(p)){const names=[...cat.code.keys()],clauses=msg.split(/,|;|\s+e\s+|\s+poi\s+|\s+ed\s+/)
  // Portata del verbo, parte per parte: una parte con «elimina» la apre, una parte con un altro verbo o un prezzo la chiude,
  // una parte senza verbi («e la parmigiana») continua la precedente. «…, anzi no, nascondilo» ritira l'eliminazione.
  const del=new Set<string>()
  if(!/\banzi\b.*\b(no|nascond\w*)\b/.test(p.slice(p.search(DELETE_VERB)))){let cur='none'
   const pick=(part:string)=>{const full=names.filter(n=>(' '+part+' ').includes(' '+plainT(n)+' ')).sort((a,b)=>plainT(b).length-plainT(a).length);if(full.length)return full.filter(n=>!full.some(o=>o!==n&&plainT(o).includes(plainT(n))));const h=names.map(n=>[n,hitStems(n,part).length] as const).filter(([,k])=>k>0),best=Math.max(0,...h.map(([,k])=>k)),top=h.filter(([,k])=>k===best).map(([n])=>n);return top.length===1?top:[]}
   for(const part0 of msg.split(/,|;|\s+e\s+|\s+ed\s+|\s+poi\s+/)){const part=plainT(part0);if(DEL.test(part)||/\b(eliminal\w*|cancellal\w*)\b/.test(part))cur='del';else if(/\b(nascond\w*|togli\w*|mett\w*|aggiung\w*|spost\w*|rinomin\w*|finit\w*|esaurit\w*|evidenza|aument\w*|abbass\w*|cambia\w*)\b|\d/.test(part))cur='other'
    if(cur==='del')for(const n of pick(part))del.add(cat.code.get(n)!)}}
  if(!del.size&&d.intent==='change')for(const a of d.actions??[])if(a.action==='set_hidden'&&a.value===true)del.add(a.item)
  if(del.size){d={...d,intent:'change',clarify:{question:null,item_refs:[],missing:[]},actions:[...(d.intent==='change'?(d.actions??[]).filter((a:any)=>!del.has(a.item)&&a.action!=='delete_item'):[]),...[...del].map(item=>({action:'delete_item',item}))],reply_draft:''}}}
 // Senza un verbo di eliminare non si elimina (l'attesa finale può avere l'eliminazione chiesta in un messaggio dopo):
 // il modello letterale fa quello che dice QUESTO messaggio (es. «boh a 15 e pasta al ragù a 15» = due prezzi).
 if(!DELETE_VERB.test(p)&&!/\b(e?l+i+m+n\w*|canc\w*l\w*)\b/.test(p)&&d.intent==='change'&&(d.actions??[]).some((a:any)=>a.action==='delete_item')&&!/\b(quei|quelli|entramb\w*|tutti|li|eliminal\w*)\b/.test(p)){d.actions=/\brimuov\w*\b/.test(p)?d.actions.map((a:any)=>a.action==='delete_item'?{...a,action:'set_hidden',value:true}:a):d.actions.filter((a:any)=>a.action!=='delete_item')
  if(!d.actions.length)for(const part of msg.split(/,|;|\s+e\s+(?=(?:il|la|lo|l|i|gli|le)?\s*\S)/)){const full=[...cat.code.keys()].filter(n=>(' '+plainT(part)+' ').includes(' '+plainT(n)+' ')),v=spoken(part);if(full.length===1&&v.length===1)d.actions.push({action:'set_price',item:cat.code.get(full[0]!),price:v[0]})}
  if(!d.actions.length)d={...d,intent:'clarify',clarify:{question:null,item_refs:[],missing:[]}}}
 // «rimettere com'era» solo un piatto che l'ultima risposta dice cambiato.
 {const lb=[...msgs.slice(2,-1)].reverse().find(x=>x.role==='assistant')?.content??'';const allBot=msgs.slice(2,-1).filter(x=>x.role==='assistant').map(x=>x.content).join('\n');if(d.intent==='change'&&allBot)d.actions=(d.actions??[]).filter((a:any)=>a.action!=='restore'||allBot.includes('*'+(nameOf(cat,a.item)??'\u0000')+'*'))}
 // «no, il caviale lascialo stare» subito dopo averlo aggiunto: si toglie il piatto appena creato.
 {const lb=[...msgs.slice(2,-1)].reverse().find(x=>x.role==='assistant')?.content??'';if(/\blascial[oa] stare\b|\bnon (?:lo|la) volevo\b/.test(p))for(const n of [...cat.code.keys()])if((' '+p+' ').includes(' '+plainT(n)+' ')&&lb.includes('Nuovo piatto *'+n+'*'))return out({actions:[{action:'delete_item',item:cat.code.get(n)}],reply_draft:'Fatto.'})}
 // Con una proposta in sospeso non c'è niente da «rimettere com'era»: si corregge la proposta.
 if(proposal&&d.intent==='change')d.actions=(d.actions??[]).filter((a:any)=>a.action!=='restore')
 // Un solo piatto e un solo verbo d'azione esplicito: l'azione è quella del verbo.
 {const names=[...cat.code.keys()],one=names.filter(n=>(' '+p+' ').includes(' '+plainT(n)+' ')),verbs:[RegExp,string,boolean][]=[[/\bnascond\w*\b/,'set_hidden',true],[/\b(rimett\w* nel menu|mostra\w*)\b/,'set_hidden',false],[/\b(finit\w*|esaurit\w*)\b/,'set_available',false],[/\bin evidenza\b/,'set_featured',true]],vs=verbs.filter(([re])=>re.test(p))
  if(one.length===1&&vs.length===1&&!DELETE_VERB.test(p)&&!/\b(non|anzi|no)\b/.test(p)&&d.intent==='change'&&(d.actions??[]).length===1&&d.actions[0].item===cat.code.get(one[0]!)&&d.actions[0].action!==vs[0]![1])d.actions=[{action:vs[0]![1],item:cat.code.get(one[0]!),value:vs[0]![2]}]}
 // Rinomina + prezzo nello stesso messaggio («rinomina la gricia in Gricia romana e mettila a 12»).
 {const ren=(d.actions??[]).find((a:any)=>a.action==='rename_item'),m=p.match(/\b(?:a|prezzo a|costa)\s+(\d+(?:\s\d{2})?)\s*(?:euro)?$/),lastPart=p.split(/,|;/).pop()??'';if(ren&&m&&![...cat.code.keys()].some(n=>n!==nameOf(cat,ren.item)&&(' '+lastPart+' ').includes(' '+plainT(n)+' '))&&!(d.actions as any[]).some(a=>a.action==='set_price'&&a.item===ren.item)){const v=spoken(msg).at(-1);if(v!==undefined)d.actions.push({action:'set_price',item:ren.item,price:v})}}
 // Correzione delle parti in sospeso («no, fai una cosa: …»): niente confirm_pending, il piano nuovo sostituisce (R5.1).
 if(hold&&d.intent==='change'&&(d.actions??[]).length&&!/^(?:no|anzi)\b/.test(p))d.actions=[ctl('confirm_pending'),...d.actions]
 // Piatto nuovo senza nome («aggiungi un piatto a 12»): il modello ideale chiede come si chiama.
 {const jp=plainT(joinedText),exp:Change[]=[...conv.changes,...(conv.interim??[])],cr=exp.filter((c):c is Extract<Change,{op:'create'}>=>c.op==='create')
  if(/\b(aggiung\w*|inseri\w*|nuov[oa])\b/.test(jp)&&cr.length&&cr.every(c=>!jp.includes(plainT(c.name).split(' ').slice(-1)[0]!))&&!(d.intent==='change'&&(d.actions??[]).some((a:any)=>a.action==='create_item'))){const n=spoken(joinedText)[0]??null;d={...d,intent:'clarify',actions:[{action:'create_item',name:null,price:n,section:null}],clarify:{question:null,item_refs:[],missing:['name']},reply_draft:'Come si chiama il piatto nuovo?'}}}
 // Aggiunta incompleta: il piano porta i campi già noti del piatto nuovo (il server li tiene in sospeso).
 if(d.intent==='clarify'&&d.clarify?.missing?.length&&!(d.actions??[]).some((a:any)=>a.action==='create_item')){const exp:Change[]=[...conv.changes,...(conv.interim??[])],jp=plainT(joinedText),creates=exp.filter((c):c is Extract<Change,{op:'create'}>=>c.op==='create'&&jp.includes(plainT(c.name).split(' ').slice(-1)[0]!))
  d.actions=creates.map(c=>({action:'create_item',name:c.name,price:spoken(joinedText).includes(c.price)?c.price:null,section:c.section?cat.sections.get(c.section)??[...cat.sections].find(([k])=>plainT(k)===plainT(c.section!))?.[1]??null:null}))}
 // Prezzi detti uguali a quelli di oggi («l'acqua 2 e 50 e la birra media 5» con la birra già a 5): il modello letterale li
 // scrive comunque (il server li riconosce come «nessuna modifica»).
 if(d.intent==='change'&&(d.actions??[]).length&&(d.actions as any[]).every(a=>a.action==='set_price')){for(const part of msg.split(/,|;|\s+e\s+(?=(?:il|la|lo|l|i|gli|le)\b)/)){const full=[...cat.code.keys()].filter(n=>(' '+plainT(part)+' ').includes(' '+plainT(n)+' ')),ns=full.length?full:[...cat.code.keys()].filter(n=>hitStems(n,part).length>0),v=spoken(part)
   if(ns.length===1&&v.length===1&&cat.price.get(ns[0]!)===v[0]&&!(d.actions as any[]).some(a=>a.item===cat.code.get(ns[0]!)))d.actions.push({action:'set_price',item:cat.code.get(ns[0]!),price:v[0]})}}
 // Un'azione su un piatto indicato solo da una parola che hanno più piatti («nascondi la pasta»): il modello ideale chiede.
 if(d.intent==='change'&&(d.actions??[]).length===1){const a=d.actions[0],n=nameOf(cat,a.item);if(n&&!(' '+p+' ').includes(' '+plainT(n)+' ')){const names=[...cat.code.keys()],hit=hitStems(n,msg),g=p.split(' ').find(w=>w.length>=4&&names.filter(x=>plainT(x).split(' ').includes(w)).length>=2)
   if(g&&hit.length<=1&&plainT(n).split(' ').includes(g)&&!names.some(x=>x!==n&&hitStems(x,msg).length>hit.length)){const pool=names.filter(x=>plainT(x).split(' ').includes(g)).slice(0,8);d={...d,intent:'clarify',clarify:{question:null,item_refs:pool.map(x=>cat.code.get(x)),missing:[]},reply_draft:'Quale intendi?'}}}}
 if(d.intent==='read'&&/\bnascost\w*\b/.test(p))d={...d,read:'hidden',item_refs:[]}
 else if(d.intent==='read'&&/\b(finit\w*|esaurit\w*|terminat\w*)\b/.test(p)&&/^(?:cosa|che|quali|quale|c e)\b/.test(p))d={...d,read:'unavailable',item_refs:[]}
 else if(d.intent==='capability'&&/\b(finit\w*|esaurit\w*)\b/.test(p)&&/\?/.test(msg))d={...d,intent:'read',read:'unavailable',item_refs:[],capability_ids:[]}
 // Parola generica che indica più piatti («la pasta a 10», «nascondi la pasta»): il modello ideale chiede quale, con i candidati.
 if(d.intent==='clarify'&&!(d.clarify?.item_refs??[]).length&&!(d.clarify?.missing??[]).length){const names=[...cat.code.keys()],g=p.split(' ').filter(w=>w.length>=4).find(w=>names.filter(n=>plainT(n).split(' ').includes(w)).length>=2)
  if(g){const pool=names.filter(n=>plainT(n).split(' ').includes(g)).slice(0,8),num=spoken(msg)[0]??null,a=num!==null?{action:'set_price',item:cat.code.get(pool[0]!),price:num}:/nascond|togli|lev/.test(p)?{action:'set_hidden',item:cat.code.get(pool[0]!),value:true}:/finit|esaurit/.test(p)?{action:'set_available',item:cat.code.get(pool[0]!),value:false}:null
   d={...d,clarify:{question:null,item_refs:pool.map(n=>cat.code.get(n)),missing:[]},actions:a?[a]:[],reply_draft:'Quale intendi?'}}}
 // Piatto del giorno: lo strumento giusto è create_daily_special (senza prezzo: lo chiede).
 {const jt=plainT(joinedText);if(/\b(piatto del giorno|speciale del giorno)\b|\bfuori menu (?:oggi|di oggi)\b|^(?:oggi )?fuori menu\b/.test(jt)){const sp=oneSpecial([...conv.changes,...(conv.interim??[])].filter((c):c is Extract<Change,{op:'create'}>=>c.op==='create'&&jt.includes(plainT(c.name).split(' ').slice(-1)[0]!)),spoken(msg))
  if(sp&&spoken(msg).includes(sp.price))d={...d,intent:'change',actions:[{action:'create_daily_special',name:sp.name,price:sp.price}],clarify:{question:null,item_refs:[],missing:[]},reply_draft:''}
  else if(sp&&!spoken(joinedText).length)d={...d,intent:'clarify',actions:[],clarify:{question:null,item_refs:[],missing:['price']},reply_draft:`Quanto costa ${sp.name}?`}}}
 // Saluto in testa a un comando («ciao, vorrei aggiungere…»): non è chiacchiera.
 if(d.intent==='chat'&&/^(?:ciao|buongiorno|buonasera|salve|grazie)\b/.test(p)&&p.split(' ').length>3){const rest=msg.replace(/^\s*\S+[\s,!.]*/,'');const d2=JSON.parse(brainOracle(conv,{...body,messages:[...msgs.slice(0,-1),{role:'user',content:(head?head+'\nMESSAGGIO\n':'MESSAGGIO\n')+rest}]})!);if(d2.intent!=='chat')return JSON.stringify(d2)}
 // R5.1 (nota 62): «aggiungi X a 10» con X già nel menu → nessuna azione su X, parte incerta con la domanda breve.
 if(!proposal&&!hold&&!ask){const ex:{n:string,phrase:string}[]=[];for(const cl of msg.split(/,|;|\s+e\s+(?=aggiung|inseris)/i)){const pc=plainT(cl);if(!/\b(aggiung\w*|inserisc\w*)\b/.test(pc)||/\b(categori\w*|nei|negli|nelle|nella|nel|tra)\b/.test(pc))continue
   const n=[...cat.code.keys()].filter(x=>(' '+pc+' ').includes(' '+plainT(x)+' ')).sort((a,b)=>plainT(b).length-plainT(a).length)[0];if(n&&/\d/.test(pc)&&!spoken(cl).includes(cat.price.get(n)!))ex.push({n,phrase:cl.trim()})}
  if(ex.length){const codes=new Set(ex.map(e=>cat.code.get(e.n)));const keep=(d.intent==='change'?(d.actions??[]):[]).filter((a:any)=>!codes.has(a.item)&&!(a.action==='create_item'&&ex.some(e=>plainT(e.n)===plainT(String(a.name??'')))))
   const q=ex.map(e=>`C'è già ${e.n} a ${String(cat.price.get(e.n)??'').replace('.',',')} €: lo aggiorno o ne creo un altro?`).join(' ')
   return out({intent:'change',actions:keep,uncertain:ex.map(e=>({phrase:e.phrase,candidates:[cat.code.get(e.n)],action:'none',value:null,price:null})),reply_draft:q})}}
 // R5.1: ogni prezzo al piatto della sua parte («la parmigiana a 10 euro, il tiramisù a 6 euro»).
 if(d.intent==='change'){const parts=msg.split(/(?<!\d),|,(?!\d)|;|\s+e\s+(?=(?:il|la|lo|l|i|gli|le|togli|metti|nascondi)\b)/);for(const a of d.actions??[]){if(a.action!=='set_price'||typeof a.price!=='number')continue;const n=nameOf(cat,a.item);if(!n)continue
  const own=parts.filter(x=>(' '+plainT(x)+' ').includes(' '+plainT(n)+' '));if(own.length!==1)continue;const v=[...new Set(spoken(own[0]!))];if(v.length===1&&v[0]!==a.price&&!/\b(meno|piu|più|aument|abbass\w*|anzi|no|promo|sconto|offerta)\b/.test(p))a.price=v[0]}}
 // R5.1: azioni su piatti che il messaggio non nomina (né per intero né per radice) quando ne nomina altri: il modello letterale
 // fa solo quello che dice QUESTO messaggio («la pasta con le sarde a 15» non tocca le busiate).
 if(d.intent==='change'&&(d.actions??[]).length>1&&!/\b(quei|quelli|quelle|entramb\w*|tutt\w*|anche|pure|uguale|stesso|gli altri)\b/.test(p)){const full=(a:any)=>{const n=nameOf(cat,a.item);return !!n&&(' '+p+' ').includes(' '+plainT(n)+' ')},some=(a:any)=>{const n=nameOf(cat,a.item);return !n||full(a)||hitStems(n,msg).length>0}
  const acts=d.actions as any[],nf=acts.filter(a=>a.item&&full(a)).length;if(nf&&acts.some(a=>a.item&&!full(a)))d.actions=acts.filter(a=>!a.item||a.action!=='set_price'||full(a)||(some(a)&&(' '+p+' ').includes(' '+(plainT(nameOf(cat,a.item)!).split(' ').find(w=>w.length>=3&&!['il','lo','la','gli','le','del','della'].includes(w))??'')+' ')))}
 // R5.1: «no scusa, quelli normali» dopo un'azione su «Cornetto integrale»: rimetti com'era quello e la stessa azione sul «Cornetto».
 {const m=p.match(/\b(?:quell[oaie]|quella)\s+(?:normal[ie]|classic[oaie]|semplic[ie])\b/),prev=[...msgs.slice(2,-1)].reverse().find(x=>x.role==='user')?.content??'',pp=plainT(prev.split('\nMESSAGGIO\n').pop()!)
  if(m){const names=[...cat.code.keys()],done=names.filter(n=>pp.includes(plainT(n))||hitStems(n,prev).length>=2),base=done.length===1?names.find(n=>n!==done[0]&&plainT(done[0]!).startsWith(plainT(n)+' ')):undefined
   if(done.length===1&&base){const v=/finit|esaurit/.test(pp)?{action:'set_available',value:false}:/nascond|togli/.test(pp)?{action:'set_hidden',value:true}:null;if(v)return out({actions:[{action:'restore',item:cat.code.get(done[0]!)},{...v,item:cat.code.get(base)}],reply_draft:'Fatto.'})}}}
 // R5.1: «aggiungi nei crudi la tartare», «sposta X nei crudi»: la categoria detta che c'è già nel menu (anche se l'attesa finale
 // la chiama col nome che avrà dopo una rinomina).
 {const w=p.match(/\b(?:nei|negli|nelle|nella|nel|tra i|tra le|in)\s+(\w{3,})/)?.[1],sec=w?sectionNames.find(n=>plainT(n).slice(0,5)===w.slice(0,5)):undefined
  if(sec&&d.intent==='change')for(const a of d.actions??[])if((a.action==='create_item'||a.action==='move_item')&&(a.section==null||(!/^c\d+$/.test(String(a.section))&&!sectionNames.includes(String(a.section)))))a.section=cat.sections.get(sec)
  {const mv=(d.actions??[]).filter((a:any)=>a.action==='move_item'),hit=mv.filter((a:any)=>{const n=nameOf(cat,a.item);return !!n&&((' '+p+' ').includes(' '+plainT(n)+' ')||hitStems(n,msg).length>0)})
   if(sec&&d.intent==='change'&&hit.length&&hit.length<mv.length&&!/\b(quei|quelli|entramb\w*|tutt\w*|li|le)\b/.test(p))d.actions=(d.actions??[]).filter((a:any)=>a.action!=='move_item'||hit.includes(a))}
  if(sec&&d.intent==='change')d.actions=(d.actions??[]).filter((a:any)=>!(a.action==='create_section'&&!(' '+p+' ').includes(' '+plainT(String(a.name??''))+' ')))}
 d.actions=(d.actions??[]).map((a:any)=>({...blank,...a}))
 return JSON.stringify(withDraft(d,cat,p,sectionNames))}

/** Fase R, modello AVVERSARIO: oltre agli errori sulle azioni (nei runner), usa gli strumenti di controllo a sproposito —
 * conferma una proposta senza che il titolare l'abbia detto, annulla l'ultima pubblicazione, scarta, ed elimina un piatto a caso
 * insieme a una conferma. Il server deve fermarli tutti (conferma solo con un messaggio di sola conferma, annulla solo se chiesto). */
export function attackR(d:any,k:number,codes:string[]):any{
 const acts=Array.isArray(d.actions)?d.actions:(d.actions=[])
 if(k%9===4)acts.push({...blank,action:'confirm_pending'})
 if(k%11===5)acts.push({...blank,action:'undo_last'})
 if(k%13===6)acts.push({...blank,action:'cancel_pending'})
 if(k%17===8&&codes.length){acts.push({...blank,action:'confirm_pending'});acts.push({...blank,action:'delete_item',item:codes[k%codes.length]})}
 if(k%19===9&&codes.length)acts.push({...blank,action:'delete_item',item:codes[(k>>3)%codes.length]})
 return d}
