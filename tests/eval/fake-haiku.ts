// Finto Claude Haiku per i test deterministici sul route vero (21/10 sera): nessuna rete, nessuna chiave. Il «modello» è una funzione
// che riceve il messaggio del titolare, il menu come lo vede il modello (codici pN/cN dal contesto vero), il blocco IN SOSPESO e
// l'eventuale motivo di rifiuto del server, e restituisce il JSON dello schema. Serve a rigiocare i piani VERI visti dal vivo (anche
// quelli sbagliati) e a generare piani plausibili nei test di proprietà.
import {S} from './route-harness.js'

export type FakeItem={code:string,name:string,price:number,hidden:boolean,section:string}
export type FakeSection={code:string,name:string,menu:string}
export type FakeCtx={message:string,items:FakeItem[],sections:FakeSection[],pending:string,correction:string|null,call:number,user:string}
export type Planner=(c:FakeCtx)=>any

const plainF=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
export const A=(action:string,o:Record<string,unknown>={})=>({action,item:null,section:null,menu:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null,...o})
export const P=(intent:string,actions:any[]=[],draft='',extra:Record<string,unknown>={})=>({intent,actions,read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:draft,...extra})
export const Q=(draft:string,refs:string[]=[],extra:Record<string,unknown>={})=>P('clarify',[],draft,{item_refs:refs,clarify:{question:draft,item_refs:refs,missing:[]},...extra})
/** Codice del piatto per nome (esatto, poi contenuto). */
export const code=(c:FakeCtx,name:string)=>{const k=plainF(name);return (c.items.find(i=>plainF(i.name)===k)??c.items.find(i=>plainF(i.name).includes(k)))?.code??null}
export const secCode=(c:FakeCtx,name:string,menu?:string)=>c.sections.find(s=>plainF(s.name)===plainF(name)&&(!menu||plainF(s.menu).includes(plainF(menu))))?.code??null

/** Contesto del modello letto dalla richiesta vera (system = regole + menu, ultimo messaggio utente = IN SOSPESO + MESSAGGIO). */
function parse(body:any,call:number):FakeCtx{
 const sys=(Array.isArray(body.system)?body.system:[]).map((b:any)=>String(b.text??'')).join('\n'),users=(body.messages??[]).filter((m:any)=>m.role==='user').map((m:any)=>String(m.content))
 const items:FakeItem[]=[],sections:FakeSection[]=[];let cur=''
 for(const l of sys.split('\n')){const s=l.match(/^# (c\d+) (.+?)(?: \(([^)]*)\))?(?: \(pubblico: .*\))?$/);if(s){cur=s[2]!;sections.push({code:s[1]!,name:s[2]!,menu:s[3]??''});continue}
  const i=l.match(/^(p\d+)\|([^|]+)\|([\d.,]+)(?:\|([xh*]+))?/);if(i)items.push({code:i[1]!,name:i[2]!,price:Number(i[3]!.replace(',','.')),hidden:(i[4]??'').includes('h'),section:cur})}
 const all=users.join('\n\n'),k=all.lastIndexOf('MESSAGGIO\n'),message=k>=0?all.slice(k+10).split('\n\n')[0]!.trim():''
 const last=users.at(-1)??'',correction=last.startsWith('IL SERVER HA RIFIUTATO')?last:null
 const pk=all.lastIndexOf('IN SOSPESO'),pending=pk>=0&&pk<k?all.slice(pk,k):''
 return{message,items,sections,pending,correction,call,user:last}}

export type FakeCall={ctx:FakeCtx,proposal:any}
/** Oggetto «Anthropic» per installNet: ogni chiamata passa dal planner. `calls` = contesto visto + proposta in sospeso nel DB finto. */
export function createFakeHaiku(planner:Planner){
 const calls:FakeCall[]=[];let n=0
 const api:any={mode:'fake',maxUsd:0,set:'fake',stats:{log:[],tokens:{input:0,output:0,cacheRead:0,cacheWrite:0}},calls,
  setConversation:()=>{},finish:()=>{},
  async handle(_u:string,init:any){const body=JSON.parse(String(init?.body??'{}')),ctx=parse(body,++n)
   calls.push({ctx,proposal:structuredClone([...S.proposals.values()][0]?.command??null)})
   let plan:any;try{plan=planner(ctx)}catch(e){plan=P('chat',[],'Ok.')}
   const res={id:'msg_fake',type:'message',role:'assistant',model:'claude-haiku-5-5',content:[{type:'text',text:JSON.stringify(plan)}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1,cache_read_input_tokens:0,cache_creation_input_tokens:0}}
   return{response:new Response(JSON.stringify(res),{status:200,headers:{'content-type':'application/json'}}),hit:false,miss:false,refused:false,tokens:2,ms:0}}}
 return api}
