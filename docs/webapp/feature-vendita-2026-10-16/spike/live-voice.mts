// Misura 8/10 (Feature 1) con whisper e gpt-oss-120b REALI, sulla pipeline di produzione del menu intero:
// transcribeAudio (stessa chiamata del bot) → extractFullMenu (parser onboarding + normalizzazione della citazione,
// reasoning_effort low, max 4000 token in uscita). 3 vocali generati con `say` (spike/audio) + 5 testi (cases.mts).
//   npx tsx docs/webapp/feature-vendita-2026-10-16/spike/live-voice.mts --dry   (nessuna rete, solo collegamenti)
//   SPIKE_ALLOW_NETWORK=1 npx tsx docs/webapp/feature-vendita-2026-10-16/spike/live-voice.mts
// Budget RIGIDO di token LLM (default 15000, SPIKE_TOKEN_BUDGET): prima di ogni chiamata si riservano 2500 token; se non
// bastano il caso resta «non misurato». Una sola esecuzione: la quota Groq serve i ristoratori veri.
// La chiave sta in ~/.config/tako-webapp/groq-key.txt e non viene mai stampata né scritta nei risultati.
import {readFileSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {extractFullMenu,fullMenuFetcher} from '../../../../apps/server/src/lib/menu-full-extract.ts'
import {transcribeAudio} from '../../../../apps/server/src/lib/twilio-menu-ai.ts'
import {cases} from './cases.mts'
const here=dirname(fileURLToPath(import.meta.url)),dry=process.argv.includes('--dry')
const plain=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const BUDGET=Number(process.env.SPIKE_TOKEN_BUDGET||15000),RESERVE=2500
if(!dry&&process.env.SPIKE_ALLOW_NETWORK!=='1'){console.error('Rete disabilitata: SPIKE_ALLOW_NETWORK=1 oppure --dry.');process.exit(2)}
const key=dry?'dry':readFileSync(join(homedir(),'.config/tako-webapp/groq-key.txt'),'utf8').trim()
class Budget extends Error{}
let tokens=0,calls=0,budgetHit=''
const metered:typeof fetch=async(url,init)=>{
 if(dry)return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({rows:[],issues:[]})}}],usage:{total_tokens:0}}),{status:200})
 if(tokens+RESERVE>BUDGET){budgetHit=`budget: usati ${tokens}, riserva ${RESERVE}, tetto ${BUDGET}`;throw new Budget(budgetHit)}
 if(false)throw new Budget(`budget: usati ${tokens}, riserva ${RESERVE}, tetto ${BUDGET}`)
 calls++;const res=await fetch(url,init);try{const j:any=await res.clone().json();tokens+=Number(j?.usage?.total_tokens)||0}catch{}
 return res
}
const order=[...cases.filter(c=>c.kind==='voice'),...cases.filter(c=>c.kind==='text')],results:any[]=[]
for(const c of order){
 const r:any={id:c.id,kind:c.kind};budgetHit=''
 try{
  let text=c.say
  if(c.kind==='voice'){const bytes=readFileSync(join(here,'audio',c.id+'.ogg'));text=dry?c.say.toLowerCase():await transcribeAudio(bytes,'audio/ogg',key);r.transcript=text}
  const t0=Date.now(),out=await extractFullMenu(text,key,fullMenuFetcher(metered));r.ms=Date.now()-t0
  r.rows=out.rows.map(x=>({section:x.section,name:x.name,price:x.price}));r.missing=out.missing;r.issues=out.issues
  let ok=0,okCat=0,priced=0;const detail=c.dishes.map(d=>{
   const row=out.rows.find(x=>plain(x.name).includes(plain(d.m)))
   if(d.flag){const good=!row&&out.missing.some(m=>plain(m.name).includes(plain(d.m)));return{dish:d.m,expected:'segnalato',got:row?`online a ${row.price}`:good?'segnalato':'silenzio',ok:good}}
   priced++;if(!row)return{dish:d.m,expected:d.price,got:null,ok:false}
   const good=row.price===d.price,cat=d.cat===null?null:plain(row.section).includes(plain(d.cat));if(good)ok++;if(good&&cat!==false)okCat++
   return{dish:d.m,expected:d.price,got:row.price,section:row.section,ok:good,catOk:cat}})
  r.score={priced,nameAndPrice:ok,per10:priced?Math.round(ok/priced*100)/10:null,withCategory:okCat,flagged:detail.filter(d=>d.expected==='segnalato').length,flagOk:detail.filter(d=>d.expected==='segnalato'&&d.ok).length,falseOnline:detail.filter(d=>String(d.got).startsWith('online')).length,detail}
 }catch(e:any){r.error=budgetHit?'NON MISURATO ('+budgetHit+')':String(e?.message||e).slice(0,200)}
 results.push(r);console.log(c.id,JSON.stringify(r.score?{ok:r.score.nameAndPrice,of:r.score.priced,per10:r.score.per10,flag:`${r.score.flagOk}/${r.score.flagged}`,tokens}:{error:r.error,tokens}))
}
const sum=(kind:string,f:(s:any)=>number)=>results.filter(r=>r.kind===kind&&r.score).reduce((a,r)=>a+f(r.score),0)
const summary={tokensUsed:tokens,llmCalls:calls,budget:BUDGET,voice:{ok:sum('voice',s=>s.nameAndPrice),of:sum('voice',s=>s.priced)},text:{ok:sum('text',s=>s.nameAndPrice),of:sum('text',s=>s.priced)},notMeasured:results.filter(r=>r.error).map(r=>r.id)}
console.log(JSON.stringify(summary))
if(!dry)writeFileSync(join(here,'live-result-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'),JSON.stringify({summary,results},null,1))
