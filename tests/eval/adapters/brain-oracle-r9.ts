// Oracolo R9 (18/10/2026, bug dal vivo QA 12:30–12:32): imita gpt-oss-120b dove il bug è nato e fa da TETTO dove serve capire.
//  - richiesta con un piatto già nel menu: crea TUTTI i piatti (come il gpt-oss vero), così il server rifiuta con piatto_doppio;
//  - correzione piatto_doppio: chiede «C'è già X a N €: lo aggiorno o ne creo un altro?» (con `falseTwin` cita anche il piatto dal
//    nome più lungo, come il gpt-oss vero, finché il server non lo corregge con doppio_falso);
//  - risposta del titolare: legge SOLO il blocco «RICHIESTA IN ATTESA DELLA RISPOSTA» del contesto (parti chiare, gemelli, prezzi
//    detti) e la risposta breve; se non sceglie (vocale storpiato) chiede di nuovo con parole diverse e le opzioni numerate;
//  - `stubborn` = N: nel turno di risposta ripete la domanda in sospeso parola per parola per le prime N chiamate (il bug vero).
// Non è gpt-oss: misura contesto + validatore + guardie del route con un modello che sceglie bene quando può.
import {catalog} from './brain-oracle.js'
import {brainOracle} from './brain-oracle-r.js'
import {currentOracle} from './current-oracle.js'
import {plainT} from '../judge.js'

export type R9Meta={req:{name:string,price:number}[],section:string,twins:string[],falseTwin?:boolean,stubborn?:number}
const blank={action:'set_price',item:null,section:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}
const out=(o:any)=>JSON.stringify({intent:'change',read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:'',...o,actions:(o.actions??[]).map((a:any)=>({...blank,...a}))})
const eur=(n:number)=>String(n).replace('.',',')+' €'
const calls=new Map<string,number>()
export const resetR9Oracle=()=>calls.clear()

// Forme della risposta (lette come le leggerebbe un modello che capisce l'italiano parlato).
const UPDATE=/\b(?:aggiorn\w*|modific\w*|vecch\w*|esistent\w*|quell[oaie] che c e|quell[oaie] che ci sono|usa quell\w*|tieni quell\w*|il primo|la prima|prima opzione|opzione 1|la 1|l 1|cambia(?:l[oaie])? il prezzo)\b|^(?:1|si|sì|si si|ok|okay|va bene|certo|esatto|vai|procedi|sì sì|si grazie)$/
const CREATE=/\b(?:cre\w*|nuov\w*|un altr[oa]|altri|il secondo|la seconda|seconda opzione|opzione 2|la 2|l 2|fanne|aggiungil\w* (?:comunque|lo stesso))\b|^2$/
function parsePending(head:string){const blk=head.split('RICHIESTA IN ATTESA DELLA RISPOSTA')[1]??'';if(!blk)return null
 const clear=[...(blk.match(/parti chiare: ([^\n]+)/)?.[1]??'').matchAll(/nuovo «([^»]+)» ([\d.]+) in (c\d+)/g)].map(m=>({name:m[1]!,price:Number(m[2]),section:m[3]!}))
 const twins=[...(blk.match(/già nel menu con lo stesso nome: ([^\n]+)/)?.[1]??'').matchAll(/(p\d+) «([^»]+)» ([\d.]+)( nascosto)?(?: \((?:prezzo detto ([\d.]+))?(?:, )?(?:nome detto «([^»]+)»)?\))?/g)].map(m=>({code:m[1]!,name:m[6]??m[2]!,price:Number(m[3]),hidden:!!m[4],said:m[5]?Number(m[5]):null}))
 const q=head.match(/IN SOSPESO \(tua domanda aperta\): (.+?)(?: — sul messaggio|\n|$)/)?.[1]??''
 return{clear,twins,q}}
function answer(pend:NonNullable<ReturnType<typeof parsePending>>,msg:string,section:string|null){const p=plainT(msg).replace(/[.,!?]/g,' ').replace(/\s+/g,' ').trim()
 const per=pend.twins.map(t=>{const w=plainT(t.name).split(' ').filter(x=>x.length>=4&&!['pasta','alla','allo','della'].includes(x)),clause=plainT(msg.replace(/[,;]/g,' qqsep ')).split(/\b(?:e|ma|invece|poi|qqsep)\b/).map(x=>x.trim()).find(c=>w.some(x=>c.includes(x.slice(0,5))))
  const c=clause??(pend.twins.length===1||/\b(?:entramb\w*|tutt\w*|tutti e due|li|le)\b/.test(p)?p:'');return{t,u:!!c&&UPDATE.test(c)&&!/\bnon (?:aggiorn|modific)/.test(c),n:!!c&&CREATE.test(c)&&!/\bnon (?:cre|fare)/.test(c)}})
 if(per.some(x=>x.u===x.n))return null
 const acts:any[]=pend.clear.map(c=>({action:'create_item',name:c.name,price:c.price,section:c.section}))
 for(const {t,u} of per){if(t.said==null)return null
  if(u){acts.push({action:'set_price',item:t.code,price:t.said});if(t.hidden)acts.push({action:'set_hidden',item:t.code,value:false})}
  else acts.push({action:'create_item',name:t.name,price:t.said,section:section??pend.clear[0]?.section??null})}
 return acts}
export function r9Oracle(conv:any,body:any):string|null{
 const meta:R9Meta|undefined=conv?.r9,msgs=body?.messages??[],last=String(msgs.at(-1)?.content??'')
 if(body?.response_format?.json_schema?.name!=='owner_brain_plan'||!meta)return brainOracle(conv,body)??currentOracle(conv,body)
 const cat=catalog(String(msgs[1]?.content??'')),sec=cat.sections.get(meta.section)??[...cat.sections].find(([k])=>plainT(k)===plainT(meta.section))?.[1]??null
 const userMsgs=msgs.filter((m:any)=>m.role==='user'),orig=String(userMsgs.find((m:any)=>/\nMESSAGGIO\n|^MESSAGGIO\n/.test(m.content)&&m===userMsgs.at(-1))?.content??[...msgs].reverse().find((m:any)=>m.role==='user'&&/MESSAGGIO\n/.test(m.content))?.content??'')
 const [head,tail]=orig.includes('MESSAGGIO\n')?[orig.split('MESSAGGIO\n')[0]!,orig.split('MESSAGGIO\n').pop()!.trim()]:['',orig]
 const correction=/^IL SERVER HA RIFIUTATO IL PIANO: /.test(last),pend=parsePending(head)
 const twinQ=(withFalse:boolean)=>{const tw=meta.twins.map(n=>`${n} a ${eur(cat.price.get(n)??0)}`).join(' e ');const extra=withFalse?[...cat.code.keys()].filter(n=>meta.req.some(r=>!meta.twins.includes(r.name)&&plainT(n).includes(plainT(r.name))&&plainT(n)!==plainT(r.name))):[]
  return out({intent:'clarify',clarify:{question:null,item_refs:[...meta.twins,...extra].map(n=>cat.code.get(n)).filter(Boolean),missing:[]},reply_draft:extra.length?`C’è già "${meta.req.find(r=>plainT(extra[0]!).includes(plainT(r.name)))!.name}" a ${eur(cat.price.get(extra[0]!)??0)} e ${tw}: lo aggiorno o ne creo un altro?`:`C’è già ${tw}: lo aggiorno o ne creo un altro?`})}
 // Turno di risposta (c'è la richiesta in attesa nel contesto).
 if(pend){const k=conv.id+'|'+tail,n=(calls.get(k)??0)+1;calls.set(k,n)
  if(n<=(meta.stubborn??0))return out({intent:'clarify',clarify:{question:null,item_refs:pend.twins.map(t=>t.code),missing:[]},reply_draft:pend.q})
  const acts=answer(pend,tail,sec)
  if(acts)return out({intent:'change',actions:acts,reply_draft:'Fatto.'})
  const t0=pend.twins[0]!,alt=/^Il vocale non era chiaro/.test(pend.q)||n>1
  return out({intent:'clarify',clarify:{question:null,item_refs:pend.twins.map(t=>t.code),missing:[]},reply_draft:alt?`Scusa, rispondi col numero: 1 = aggiorno ${t0.name} a ${eur(t0.said??t0.price)}, 2 = ne creo un altro?`:`Il vocale non era chiaro: vuoi che aggiorni ${t0.name} a ${eur(t0.said??t0.price)} (rispondi 1) o che ne crei un altro (rispondi 2)?`})}
 // Correzione del server sul primo messaggio.
 if(correction&&/Hanno lo STESSO nome solo/.test(last))return twinQ(!!meta.falseTwin)
 if(correction&&/nome contenuto in un altro è un piatto nuovo/.test(last))return twinQ(false)
 // Il messaggio con la richiesta: come gpt-oss, crea TUTTI i piatti detti (anche quelli che ci sono già).
 if(!correction&&!head.includes('IN SOSPESO')&&meta.req.every(r=>plainT(tail).includes(plainT(r.name).split(' ').slice(-1)[0]!)))return out({intent:'change',actions:meta.req.map(r=>({action:'create_item',name:r.name,price:r.price,section:sec})),reply_draft:'Aggiungo i piatti.'})
 return brainOracle(conv,body)??currentOracle(conv,body)}
