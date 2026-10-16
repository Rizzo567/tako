// Spike 3b: 5 testi + 3 vocali nel parser di onboarding ESISTENTE (extractOnboardingMenu), senza toccare il DB.
//   fase tts : genera gli audio con `say` (nessuna rete)            tsx spike/run-spike.mts tts
//   fase run : whisper (stessa funzione del bot) + parser (Groq)    tsx spike/run-spike.mts run [--dry]
// La chiave sta in ~/.config/tako-webapp/groq-key.txt e non viene mai stampata né scritta nei risultati.
// DISABILITATO (contrordine 16/10): nessuna chiamata a Groq finché la quota non si resetta; serve SPIKE_ALLOW_NETWORK=1.
import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {homedir} from 'node:os'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {extractOnboardingMenu} from '../../../../apps/server/src/lib/onboarding-planner.ts'
import {transcribeAudio} from '../../../../apps/server/src/lib/twilio-menu-ai.ts'
import {cases} from './cases.mts'
const here=dirname(fileURLToPath(import.meta.url)),audio=join(here,'audio'),phase=process.argv[2],dry=process.argv.includes('--dry')
const plain=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const TOKEN_BUDGET=Number(process.env.SPIKE_TOKEN_BUDGET||40000)
if(phase==='tts'){
 mkdirSync(audio,{recursive:true})
 for(const c of cases.filter(c=>c.kind==='voice')){
  const aiff=join(audio,c.id+'.aiff'),ogg=join(audio,c.id+'.ogg')
  execFileSync('say',['-v','Alice','-r','175','-o',aiff,c.say]);execFileSync('ffmpeg',['-y','-loglevel','error','-i',aiff,'-ac','1','-ar','16000','-c:a','libopus','-b:a','24k',ogg])
  console.log('audio',c.id,existsSync(ogg))
 }
 process.exit(0)
}
if(phase!=='run')throw Error('uso: tts | run [--dry]')
const now=new Date(),minutes=now.getHours()*60+now.getMinutes()
// CONTRORDINE 16/10 (coordinatore): oggi nessuna chiamata a Groq (LLM né whisper). Rete vietata finché non si imposta SPIKE_ALLOW_NETWORK=1 dopo il reset della quota.
if(!dry&&process.env.SPIKE_ALLOW_NETWORK!=='1'){console.error('Rete disabilitata: usare deterministic.mts oppure --dry.');process.exit(2)}
const key=dry?'dry':readFileSync(join(homedir(),'.config/tako-webapp/groq-key.txt'),'utf8').trim()
let tokens=0
const fakeRows=(src:string)=>({rows:[{section:'Primi',name:'carbonara',price:10,description:'',evidence:'carbonara 10'}],issues:[]})
const fetcher:typeof fetch=async(url,init)=>{
 if(dry)return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(fakeRows(''))}}],usage:{total_tokens:1}}),{status:200})
 if(tokens>=TOKEN_BUDGET)throw Error('budget token esaurito ('+tokens+')')
 const res=await fetch(url,init);const copy=res.clone();try{const j:any=await copy.json();tokens+=Number(j?.usage?.total_tokens)||0}catch{}
 return res
}
const results:any[]=[]
for(const c of cases){
 const r:any={id:c.id,kind:c.kind,said:c.say}
 let text=c.say
 if(c.kind==='voice'){
  const bytes=readFileSync(join(audio,c.id+'.ogg'))
  text=dry?c.say.toLowerCase():await transcribeAudio(bytes,'audio/ogg',key)
  r.transcript=text
 }
 try{
  const t0=Date.now();const out=await extractOnboardingMenu(text,key,fetcher);r.ms=Date.now()-t0
  r.rows=out.rows.map(x=>({section:x.section,name:x.name,price:x.price,menu:x.menu??null,description:x.description,intent:x.intent??null}))
  r.issues=out.issues
 }catch(e:any){r.error=String(e?.message||e).slice(0,200)}
 // Punteggio: un piatto è giusto se nome+prezzo coincidono; la categoria è valutata a parte.
 const rows:any[]=r.rows??[];let ok=0,okCat=0,flagged=0,flagOk=0,wrongPrice=0,missing=0,falsePublished=0
 const score=c.dishes.map(d=>{
  const row=rows.find(x=>plain(x.name).includes(plain(d.m)))
  if(d.flag){flagged++;const said=(r.issues??[]).some((i:string)=>plain(i).includes(plain(d.m)));const good=!row&&said;if(good)flagOk++;if(row)falsePublished++;return{dish:d.m,expected:'segnalato',got:row?`pubblicato a ${row.price}`:said?'segnalato':'silenzio',ok:good}}
  if(!row){missing++;return{dish:d.m,expected:d.price,got:null,ok:false}}
  const price=row.price===d.price,cat=d.cat===null?null:plain(row.section).includes(plain(d.cat))
  if(!price)wrongPrice++;if(price){ok++;if(cat!==false)okCat++}
  return{dish:d.m,expected:d.price,got:row.price,section:row.section,priceOk:price,catOk:cat,ok:price&&cat!==false}
 })
 const priced=c.dishes.filter(d=>!d.flag).length
 r.score={dishesWithPrice:priced,nameAndPriceOk:ok,nameAndPriceAndCategoryOk:okCat,missing,wrongPrice,flagExpected:flagged,flagOk,falselyPublished:falsePublished,detail:score}
 results.push(r);console.log(c.id,JSON.stringify({ok,priced,okCat,missing,wrongPrice,flagOk,flagged,tokens}))
}
const sum=(f:(s:any)=>number,kind?:string)=>results.filter(r=>!kind||r.kind===kind).reduce((a,r)=>a+f(r.score),0)
const summary={tokensUsed:tokens,voice:{dishes:sum(s=>s.dishesWithPrice,'voice'),nameAndPrice:sum(s=>s.nameAndPriceOk,'voice'),withCategory:sum(s=>s.nameAndPriceAndCategoryOk,'voice')},text:{dishes:sum(s=>s.dishesWithPrice,'text'),nameAndPrice:sum(s=>s.nameAndPriceOk,'text'),withCategory:sum(s=>s.nameAndPriceAndCategoryOk,'text')}}
console.log(JSON.stringify(summary))
if(!dry)writeFileSync(join(here,'results-'+now.toISOString().replace(/[:.]/g,'-')+'.json'),JSON.stringify({summary,results},null,1))
