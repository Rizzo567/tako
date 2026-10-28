// Oracolo R10 (18/10/2026, bug dal vivo QA 16:03–16:06): imita gpt-oss-120b dove il bug è nato e fa da TETTO dove serve capire.
//  - nomi pubblici: legge SOLO la scheda del locale; trova le sezioni dal tag «(pubblico: X)» (o dal nome della sezione). Senza tag
//    nella scheda si comporta come il gpt-oss vero: «Non esiste una sezione chiamata "X"» (il validatore deve fermarlo);
//  - correzione del server: legge le sezioni dal motivo («(= «A», «B»)», «ogni piatto delle sezioni …») e rifà il piano;
//  - `stubborn` = la domanda vera del bug per le prime N chiamate: «Quale sezione intendi nascondere?» (section), «Quali piatti vuoi
//    nascondere nella sezione "X"?» (dishes), «Non esiste una sezione chiamata "X"» (nonexist);
//  - sezione inesistente: buono = lo dice subito con l'elenco letto dalla scheda; `bug` = prima «Quale sezione intendi?»;
//  - proposta in sospeso (riepilogo da confermare) e messaggio che ripete la richiesta: «Sono già pronti: rispondi OK…»; «ok» →
//    oracolo R (confirm_pending). Piatti già nel menu chiesti in un'altra sezione: oracolo R9 (meta r9).
// Non è gpt-oss: misura contesto + validatore + guardie del route con un modello che sceglie bene quando può.
import {brainOracle} from './brain-oracle-r.js'
import {currentOracle} from './current-oracle.js'
import {r9Oracle} from './brain-oracle-r9.js'
import {plainT} from '../judge.js'

export type R10Verb='hide'|'show'|'fin'|'back'|'delta'|'move'|'read'
export type R10Meta={verb:R10Verb,target:string,said:string,dest?:string,delta?:number,stubborn?:'section'|'dishes'|'nonexist',n?:number,unknown?:boolean,bug?:boolean}
const blank={action:'set_price',item:null,section:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}
const out=(o:any)=>JSON.stringify({intent:'change',read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:'',...o,actions:(o.actions??[]).map((a:any)=>({...blank,...a}))})
const calls=new Map<string,number>()
export const resetR10Oracle=()=>calls.clear()

type Sec={code:string,name:string,pub:string|null,items:{code:string,name:string,flags:string}[]}
/** Scheda del locale: «# c2 Piatti di prova (Menu) (pubblico: Altre proposte)» e righe «p5|nome|13.5|h». */
export function sectionsOf(card:string):Sec[]{const out:Sec[]=[];let cur:Sec|null=null
 for(const line of card.split('\n')){const s=line.match(/^# (c\d+) (.+?)(?: \(.+\))?$/);if(s){const pub=line.match(/\(pubblico: ([^)]+)\)\s*$/)?.[1]??null;cur={code:s[1]!,name:s[2]!,pub,items:[]};out.push(cur);continue}
  const p=line.match(/^(p\d+)\|([^|]+)\|[\d.]+(?:\|([xh*]+))?/);if(p&&cur)cur.items.push({code:p[1]!,name:p[2]!,flags:p[3]??''})}
 return out}
const VERB_WORD:Record<R10Verb,string>={hide:'nascondere',show:'rimettere',fin:'segnare finiti',back:'rimettere disponibili',delta:'aumentare',move:'spostare',read:'vedere'}
function actionsFor(meta:R10Meta,secs:Sec[],all:Sec[]){const items=secs.flatMap(s=>s.items),dest=meta.dest?all.find(s=>plainT(s.name)===plainT(meta.dest!)):null
 const vis=(f:string)=>!f.includes('h')
 switch(meta.verb){case 'hide':return items.filter(i=>vis(i.flags)).map(i=>({action:'set_hidden',item:i.code,value:true}))
  case 'show':return items.filter(i=>i.flags.includes('h')).map(i=>({action:'set_hidden',item:i.code,value:false}))
  case 'fin':return items.filter(i=>vis(i.flags)&&!i.flags.includes('x')).map(i=>({action:'set_available',item:i.code,value:false}))
  case 'back':return items.filter(i=>i.flags.includes('x')).map(i=>({action:'set_available',item:i.code,value:true}))
  case 'delta':return items.filter(i=>vis(i.flags)).map(i=>({action:'set_price',item:i.code,price_delta:meta.delta??1}))
  case 'move':return dest?items.filter(i=>vis(i.flags)).map(i=>({action:'move_item',item:i.code,section:dest.code})):[]
  default:return[]}}

export function r10Oracle(conv:any,body:any):string|null{
 const meta:R10Meta|undefined=conv?.r10,msgs=body?.messages??[],last=String(msgs.at(-1)?.content??'')
 if(body?.response_format?.json_schema?.name!=='owner_brain_plan')return brainOracle(conv,body)??currentOracle(conv,body)
 if(conv?.r9)return r9Oracle(conv,body)
 if(!meta)return brainOracle(conv,body)??currentOracle(conv,body)
 const all=sectionsOf(String(msgs[1]?.content??'')),orig=String([...msgs].reverse().find((m:any)=>m.role==='user'&&/MESSAGGIO\n/.test(m.content))?.content??'')
 const [head,tail]=orig.includes('MESSAGGIO\n')?[orig.split('MESSAGGIO\n')[0]!,orig.split('MESSAGGIO\n').pop()!.trim()]:['',orig]
 const correction=/^IL SERVER HA RIFIUTATO IL PIANO: /.test(last),p=plainT(tail).replace(/[.,!?]/g,' ').replace(/\s+/g,' ').trim()
 // Conferma di un riepilogo in sospeso: l'oracolo R (confirm_pending).
 if(/IN SOSPESO \(proposta non confermata/.test(head)&&/^(?:ok|okay|si|sì|si vai|sì vai|ok vai|va bene|confermo|procedi)$/.test(p))return brainOracle(conv,body)
 if(/IN SOSPESO \(proposta non confermata/.test(head)&&!correction){const k0=conv.id+'|pronti',m=(calls.get(k0)??0)+1;calls.set(k0,m);return out({intent:'chat',reply_draft:m%2?'Sono già pronti qui sotto: rispondi OK per pubblicare.':'Li ho tutti in elenco, manca solo il tuo OK.'})}
 const k=conv.id+'|'+tail,n=(calls.get(k)??0)+1;calls.set(k,n)
 const list=all.map(s=>s.name+(s.pub&&plainT(s.pub)!==plainT(s.name)?' ('+s.pub+')':'')).join(', ')
 // Sezione inesistente.
 if(meta.unknown){if(meta.bug&&!correction)return out({intent:'clarify',reply_draft:'Quale sezione intendi?'})
  return out({intent:'clarify',reply_draft:`Nel menu non c’è una sezione «${meta.said}». Le sezioni sono: ${list}. Quale intendi?`})}
 // Il bug: la domanda che ignora il testo.
 if(meta.stubborn&&n<=(meta.n??1)&&!correction){const q=meta.stubborn==='section'?`Quale sezione intendi ${VERB_WORD[meta.verb]}?`:meta.stubborn==='dishes'?`Quali piatti vuoi ${VERB_WORD[meta.verb]} nella sezione "${meta.said}"?`:`Non esiste una sezione chiamata "${meta.said}". Come vuoi procedere?`
  return out({intent:'clarify',reply_draft:q})}
 // Le sezioni: dal motivo del server (correzione) o dalla scheda (nome pubblico o nome della sezione).
 let secs:Sec[]=[]
 if(correction){const m=last.match(/\(= ([^)]*)\)|ogni piatto delle sezioni ([^(;]*)/);const names=m?[...(m[1]??m[2]!).matchAll(/«([^»]+)»/g)].map(x=>x[1]!):[];secs=all.filter(s=>names.some(nm=>plainT(nm)===plainT(s.name)))}
 if(!secs.length)secs=all.filter(s=>(s.pub&&plainT(s.pub)===plainT(meta.target))||plainT(s.name)===plainT(meta.target))
 if(!secs.length)return out({intent:'clarify',reply_draft:`Non esiste una sezione chiamata "${meta.said}". Come vuoi procedere?`})
 if(meta.verb==='read')return out({intent:'read',item_refs:secs.flatMap(s=>s.items.map(i=>i.code)).slice(0,10),reply_draft:'Ecco i piatti.'})
 const acts=actionsFor(meta,secs,all)
 if(!acts.length)return out({intent:'chat',reply_draft:'Non c’è niente da cambiare.'})
 return out({intent:'change',actions:acts,reply_draft:acts.length>3&&meta.verb!=='delta'?'Confermi? Rispondi OK per pubblicare.':'Fatto.'})}
