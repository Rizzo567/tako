// Modello «ideale per messaggio» per il bot ATTUALE (come il modelReply delle batterie round1–5c): risponde nel JSON del
// prompt attuale vedendo SOLO il messaggio corrente, conoscendo le attese della conversazione. Serve a misurare il limite
// dell'architettura attuale senza spendere token: se una conversazione fallisce anche con l'oracolo, il problema è il
// contesto/le regole, non il modello. NON è un modello vero: i numeri «oracolo» vanno letti come tetto superiore.
import {plainT} from '../judge.js'
import type {Change,Conversation} from '../types.js'

const units:Record<string,number>={zero:0,uno:1,un:1,una:1,due:2,tre:3,quattro:4,quattru:4,cinque:5,cinche:5,cincu:5,sei:6,sette:7,setti:7,otto:8,ottu:8,nove:9,novi:9,dieci:10,deci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciottu:18,diciannove:19,diciannovi:19,venti:20,vinti:20,ventuno:21,ventidue:22,ventitre:23,ventiquattro:24,venticinque:25,trenta:30,quaranta:40,cinquanta:50}
export function spoken(raw:string):number[]{const out:number[]=[],w=plainT(raw.replace(/(\d),(\d)/g,'$1.$2')).split(' ')
 for(const m of raw.replace(/(\d),(\d)/g,'$1.$2').matchAll(/\d+(?:\.\d{1,2})?/g))out.push(Number(m[0]))
 for(let i=0;i<w.length;i++){const a=units[w[i]!]??(/^\d+$/.test(w[i]!)?Number(w[i]):undefined);if(a===undefined)continue;out.push(a);let j=i+1;if(w[j]==='euro'||w[j]==='euri'||w[j]==='euru')j++
  if(w[j]==='e'){const n=w[j+1]??'';if(/^mezz|^menzu/.test(n))out.push(a+0.5);else{const b=units[n]??(/^\d+$/.test(n)?Number(n):undefined);if(b!==undefined&&b>=10)out.push(a+b/100)}}}
 return out.map(x=>Math.round(x*100)/100)}
const GENERIC=new Set(['alla','allo','alle','della','dello','delle','con','pasta','pizza','piatto'])
const stems=(name:string)=>plainT(name).split(' ').filter(w=>w.length>3&&!GENERIC.has(w))
const skel=(w:string)=>w.replace(/[aeiou]/g,'')
// Un modello ideale riconosce la parola anche storpiata dal dialetto o dall'ASR («pisci»/«pesce», «tunnu»/«tonno», «sardi»/«sarde»).
const wordHit=(w:string,msg:string[])=>msg.some(m=>m===w||(m.length>=4&&w.length>=4&&m.slice(0,5)===w.slice(0,5))||(skel(m).length>=3&&skel(m)===skel(w)))
const hitStems=(name:string,msg:string)=>{const m=plainT(msg).split(' ');return stems(name).filter(w=>wordHit(w,m))}
const mentions=(msg:string,c:Change)=>{if(c.op==='create')return plainT(msg).includes(plainT(c.name).split(' ').slice(-1)[0]!);return hitStems(c.dish,msg).length>0}
/** Altri piatti del catalogo che il messaggio nomina allo stesso modo (stesse parole, nessuna parola distintiva): ambiguità. */
const rivals=(dish:string,msg:string,names:string[])=>{const hit=hitStems(dish,msg),all=stems(dish);if(hit.length===all.length)return[];return names.filter(n=>n!==dish&&hit.every(w=>stems(n).includes(w))&&hitStems(n,msg).length<=hit.length)}

type Catalog={items:Map<string,string>,sections:Map<string,string>}
function catalog(user:string):Catalog{const items=new Map<string,string>(),sections=new Map<string,string>()
 for(const line of user.split('\n')){if(!line.startsWith('['))continue;try{const r=JSON.parse(line);if(typeof r[0]!=='string')continue;if(r[0].startsWith('p'))items.set(r[1],r[0]);else if(r[0].startsWith('c'))sections.set(r[1],r[0])}catch{}}
 return{items,sections}}

function action(c:Change,cat:Catalog,msg:string):any{const id=c.op==='create'?null:cat.items.get(c.dish);if(c.op!=='create'&&!id)return null
 switch(c.op){case 'create':{const sid=c.section?cat.sections.get(c.section):undefined;return sid?{action:'create_item',section_id:sid,name:c.name,price:c.price}:null}
  case 'price':return{action:'set_price',item_id:id,price:c.price}
  case 'available':return{action:'set_available',item_id:id,available:c.value}
  case 'hidden':return{action:'set_hidden',item_id:id,hidden:c.value}
  case 'featured':return{action:'set_featured',item_id:id,featured:c.value}
  case 'last':return{action:'set_last_portions',item_id:id,value:c.value}
  case 'promo':return c.price===null?{action:'remove_promo',item_id:id}:{action:'set_promo',item_id:id,price:c.price}
  case 'description':return{action:'set_description',item_id:id,text:c.text}}
 void msg}

/** Risposta JSON (stringa) che un modello perfetto darebbe al prompt attuale, oppure null se la richiesta non è del bot menu. */
export function currentOracle(conv:Conversation|null,body:any):string|null{
 const system=String(body?.messages?.[0]?.content??''),user=String(body?.messages?.[1]?.content??'')
 try{if(JSON.parse(user)?.source!==undefined)return JSON.stringify({rows:[],issues:[]})}catch{}
 const parts=user.split(/\n(MESSAGGIO|NOME INDICATO)\n/),label=parts[1],msg=(parts[2]??'').trim(),cat=catalog(user),hasSections=user.startsWith('CATEGORIE')
 if(!conv)return JSON.stringify({intent:'clarify',item_ids:[]})
 const changes=[...conv.changes,...(conv.alt?.[0]??[])]
 if(label==='NOME INDICATO'){const hit=changes.find(c=>c.op!=='create'&&mentions(msg,c)&&cat.items.has(c.dish)) as any;return JSON.stringify(hit?{intent:'dish',item_id:cat.items.get(hit.dish)}:{intent:'clarify',item_ids:[]})}
 if(system.includes('ESISTE UNA PROPOSTA'))return JSON.stringify({intent:'change',actions:[],remove_indices:[],update_indices:[]})
 const question=/\?|\bquanto\b|\bcosa\b|\bquali\b|\bche\b.*\bci sono\b/.test(msg)&&!/aggiung/.test(plainT(msg))
 const relevant=changes.filter(c=>mentions(msg,c)&&(c.op==='create'||cat.items.has(c.dish)))
 // Il modello ideale non sceglie al posto del titolare: un piatto nominato in modo ambiguo è un chiarimento.
 const names=[...cat.items.keys()],amb=relevant.flatMap(c=>c.op==='create'?[]:rivals(c.dish,msg,names).length?[c.dish,...rivals(c.dish,msg,names)]:[])
 if(amb.length&&!question)return JSON.stringify({intent:'clarify',item_ids:[...new Set(amb)].map(n=>cat.items.get(n))})
 if(!relevant.length){if(question){const hits=[...cat.items.keys()].filter(n=>hitStems(n,msg).length>0);return JSON.stringify(hits.length?{intent:'read',read:'items',item_ids:hits.slice(0,5).map(h=>cat.items.get(h))}:/finit/.test(plainT(msg))?{intent:'read',read:'unavailable'}:{intent:'capability',capability_ids:['all']})}
  return JSON.stringify({intent:'clarify',item_ids:[]})}
 if(question)return JSON.stringify({intent:'read',read:'items',item_ids:relevant.filter(c=>c.op!=='create').map(c=>cat.items.get((c as any).dish))})
 const said=spoken(msg)
 for(const c of relevant)if(c.op==='create'){const missing=[...(!hasSections||!c.section?['section']:[]),...(!said.includes(c.price)?['price']:[])];if(missing.length)return JSON.stringify({intent:'clarify',missing,name:c.name,section_ids:[]})}
 if(relevant.some(c=>(c.op==='price'||(c.op==='promo'&&c.price!==null))&&!said.includes((c as any).price)))return JSON.stringify({intent:'clarify',item_ids:relevant.filter(c=>c.op!=='create').map(c=>cat.items.get((c as any).dish))})
 const actions=relevant.map(c=>action(c,cat,msg)).filter(Boolean)
 return JSON.stringify(actions.length?{intent:'change',actions}:{intent:'clarify',item_ids:[]})}
