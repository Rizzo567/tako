// Giro reale minimo sul cervello (Groq vero). Tetto: si ferma se il consumo supera BRAIN_LIVE_CAP token (default 23000).
// Uso: bundle con esbuild e node; chiave letta da file (mai stampata). Solo lettura: nessun DB, nessun WhatsApp.
import {readFileSync,appendFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {planOwnerMessage} from '../apps/server/src/lib/owner-brain-plan.js'
import {catalogOf} from '../apps/server/src/lib/owner-brain-eval.js'
import {typicalWorkspace,largeWorkspace} from './owner-brain-fixture.js'
const dir=homedir()+'/.config/tako-webapp/',testKey=(()=>{try{return readFileSync(dir+'groq-key-test.txt','utf8').trim()}catch{return ''}})(),key=testKey||readFileSync(dir+'groq-key.txt','utf8').trim()
const cap=Number(process.env.BRAIN_LIVE_CAP??23000),only=process.env.BRAIN_LIVE_ONLY?.split(',')
const now=Date.now(),typ=catalogOf(typicalWorkspace()),big=catalogOf(largeWorkspace(320)),tagliate=typ.refs.filter(r=>r.name.startsWith('Tagliata')).map(r=>r.id)
const cases:{id:string,cat:typeof typ,message:string,history?:any[],pending?:any}[]=[
 {id:'stesso-prezzo',cat:typ,message:'la carbonara è finita e metti la amatriciana allo stesso prezzo della cacio e pepe'},
 {id:'domanda',cat:typ,message:'quanto costa la tagliata?'},
 {id:'multi-turno',cat:typ,message:'quella di tonno, a 21',history:[{role:'owner',text:'la tagliata mettila a 21',at:now-60000},{role:'bot',text:'Quale piatto intendi?\n- *Tagliata di manzo*\n- *Tagliata di tonno*',at:now-59000}],pending:{clarify:{question:'Quale piatto intendi?',itemIds:tagliate}}},
 {id:'dialetto',cat:typ,message:"nun ce sta cchiù 'a parmigiana, e 'o babà costa sette euri"},
 {id:'grande',cat:big,message:'le linguine alle vongole costano 15 e le trofie al pesto genovese sono finite'},
]
let used=0,rawUsage:any=null
const spy=async(u:string,i:RequestInit)=>{const r=await fetch(u,i);if(r.ok){const c=r.clone();c.json().then((d:any)=>{rawUsage={usage:d?.usage,x_groq:d?.x_groq?.usage}}).catch(()=>{})}return r}
for(const c of cases){if(only&&!only.includes(c.id))continue;if(used>=cap){console.log('STOP tetto',used);break}
 const r=await planOwnerMessage({restaurantName:'Tako QA',refs:c.cat.refs,sections:c.cat.sections,history:c.history,pending:c.pending,message:c.message,now},key,{budgetMs:45000,timeoutMs:20000,fetch:spy})
 const u=r.usage;used+=(u?.prompt??0)+(u?.completion??0)
 const plan=r.path==='brain'?JSON.stringify(r.plan).replace(/0{8}-0{4}-4000-8000-0{6}/g,'#'):r.reason
 console.log(JSON.stringify({id:c.id,path:r.path,stima:r.tokens?.total,prompt:u?.prompt,cached:u?.cached,completion:u?.completion,ms:u?.latencyMs,model:u?.model,intent:r.path==='brain'?r.intent:null,notes:r.path==='brain'?r.notes:null,alias:r.path==='brain'?r.aliasesUsed:null}),'\n  plan',plan,'\n  raw',JSON.stringify(rawUsage))
 appendFileSync('docs/webapp/bot-cervello-2026-10-17/token-log.md',`| ${new Date().toISOString()} | N | ${c.id} | ${u?.model??'-'} | ${u?.prompt??0} | ${u?.cached??0} | ${u?.completion??0} | ${u?.latencyMs??'-'} ms | ${testKey?'chiave test':'chiave bot'} |\n`)}
console.log('totale token',used)
