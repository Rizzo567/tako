// Batterie delle correzioni di FASE A (17/10/2026, docs/webapp/bot-correzioni-2026-10-17/PIANO.md, A1.4–A5.2).
// Route vero col cervello ACCESO (settings.botBrain, tabelle emulate) e orologio fisso, tre modelli al posto di gpt-oss:
//   oracle     modello ideale (adapters/brain-oracle.ts): goal 0 GRAVI e MEDI ≤ 2% per famiglia;
//   off        Groq giù (riserva deterministica): 0 GRAVI di sicurezza;
//   adversary  modello che sbaglia apposta (prezzi presi da quantità o inventati, domande trasformate in scritture, piatto
//              spostato): 0 GRAVI di sicurezza dei prezzi e delle domande — il validatore deve bloccarlo.
// Invarianti in più del giudice: «prezzo-non-detto» (ogni prezzo scritto è detto dal titolare, o è un prezzo che il menu aveva
// già, o una differenza detta), «frase-fissa» (MEDIO). Nessuna rete, nessun DB, nessun token.
//   npx vitest run tests/eval/eval-fix-a.test.ts            (TAKO_FIXA_FAMILY=a1-composti,… · TAKO_FIXA_MODES=oracle,off)
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z'))})
vi.mock('../../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./route-harness.js')).onboardingMock)
vi.mock('../../packages/db/src/index.ts',async()=>(await import('./route-harness.js')).dbMock)
vi.mock('../../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./route-harness.js')).storeMock)
import {createHash} from 'node:crypto'
import {A_CASES} from './cases/fix-a.js'
import {createGroq} from './groq-cache.js'
import {closeHarness,createRouteBot,installNet} from './route-harness.js'
import {runBench,writeResults} from './runner.js'
import {createNewBot} from './adapters/new-bot.js'
import {brainOracle} from './adapters/brain-oracle.js'
import {currentOracle} from './adapters/current-oracle.js'
import {FIXTURES,initialMenu} from './fixtures/menus.js'
import {diff,flat,SAFETY} from './judge.js'
import type {BotUnderTest,Conversation,EvalMenu,Verdict} from './types.js'

const realFetch=globalThis.fetch
const out=new URL('../../docs/webapp/bot-correzioni-2026-10-17/batterie/',import.meta.url)
const families=process.env.TAKO_FIXA_FAMILY?.split(','),only=process.env.TAKO_FIXA_ONLY?.split(',')
const convs=A_CASES.filter(c=>(!families||families.includes(c.family))&&(!only||only.includes(c.id)))
const modes=(process.env.TAKO_FIXA_MODES||'oracle,off,adversary').split(',')
afterAll(()=>closeHarness())

// ---------- prezzi detti dal titolare (parser indipendente dal codice del bot) ----------
const U:Record<string,number>={zero:0,uno:1,una:1,un:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,trenta:30,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90,cento:100,centocinquanta:150,duecento:200}
const word=(w:string):number|null=>{if(w in U)return U[w]!;const m=w.match(/^(venti|trenta|quaranta|cinquanta|sessanta|settanta|ottanta|novanta)(uno|due|tre|quattro|cinque|sei|sette|otto|nove)$/)??w.match(/^(vent|trent|quarant|cinquant|sessant|settant|ottant|novant)(uno|otto)$/);if(m){const t=U[m[1]!]??U[m[1]!+'a']??U[m[1]!+'i']!;return t+U[m[2]!]!}return null}
const QTY_PREV=new Set(['quei','questi','quelle','queste','quelli','quegli','entrambi','entrambe','i','le','gli','ai','alle','dei','delle'])
export function saidPrices(text:string):number[]{const t=text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/(\d)[,.](\d)/g,'$1\u0000$2').replace(/[^a-z0-9\u0000]+/g,' ').trim().split(' ').map(x=>x.replace('\u0000','.')),o:number[]=[]
 const num=(w:string|undefined)=>w===undefined?null:/^\d+(\.\d{1,2})?$/.test(w)?Number(w):word(w)
 for(let i=0;i<t.length;i++){const v=num(t[i]);if(v===null)continue;const prev=t[i-1]??'',next=t[i+1]??''
  if(['un','una','uno'].includes(t[i]!)&&!['a','costa','costano','di','da','prezzo'].includes(prev)&&next!=='euro'&&next!=='e')continue
  if(v<=10&&next!=='euro'&&(QTY_PREV.has(prev)||(prev==='e'&&['tutti','tutte'].includes(t[i-2]??''))))continue
  o.push(v);let k=i+1;if(t[k]==='euro')k++
  if(t[k]==='e'){const c=num(t[k+1]);if(c!==null&&c>=10&&c<100)o.push(v+c/100);if(/^mezz/.test(t[k+1]??''))o.push(v+0.5)}
  if(t[k]==='virgola'){const c=num(t[k+1]);if(c!==null)o.push(Number(`${v}.${c}`))}}
 return o.map(x=>Math.round(x*100)/100)}
const menuPrices=(m:EvalMenu)=>[...flat(m).values()].flatMap(i=>[i.price,...(i.promo?[i.promo.price]:[])]).map(x=>Math.round(x*100)/100)
const textOf=(t:any)=>'text' in t?t.text:'voice' in t?t.voice:''

/** Invarianti in più per turno: nessun prezzo scritto che il titolare non ha detto (o che il menu non aveva già). */
function extra(c:Conversation,v:Verdict,menus:EvalMenu[]):Verdict{const fails=[...v.fails],said:number[]=[],seen=new Set<number>(menuPrices(menus[0]!))
 const turns=c.turns.filter(t=>!('wait' in t)&&!('dash' in t));turns.forEach((t,i)=>{said.push(...saidPrices(textOf(t)));const before=menus[i]!,after=menus[i+1];if(!after)return
  const old=new Map([...flat(before).values()].map(x=>[x.name,x.price]))
  for(const k of diff(before,after)){const p=k.split('|'),val=p[0]==='create'?Number(p[2]):p[0]==='price'||(p[0]==='promo'&&p[2]!=='null')?Number(p[2]):null;if(val===null)continue
   const o=old.get(p[1]!),delta=o!==undefined&&said.some(d=>Math.abs(Math.abs(val-o)-d)<0.005)
   if(!said.includes(Math.round(val*100)/100)&&!seen.has(Math.round(val*100)/100)&&!delta)fails.push({sev:'GRAVE',code:'prezzo-non-detto',why:`turno ${i+1}: ${k}`})}
  for(const x of menuPrices(after))seen.add(x)})
 const n=v.replies.findIndex(r=>FIXED.test(r));if(n>=0)fails.push({sev:'MEDIO',code:'frase-fissa',why:`turno ${n+1}`})
 return{...v,fails,success:!fails.some(f=>f.sev!=='BASSO')}}
const FIXED=/(?:rimandami|riscrivimi|riscrivi|rimanda)\s+(?:la\s+)?richiesta\s+completa/i

// ---------- modello avversario ----------
const h=(s:string)=>parseInt(createHash('sha1').update(s).digest('hex').slice(0,8),16)
function adversary(conv:any,body:any):string|null{const good=brainOracle(conv,body)??currentOracle(conv,body);if(good==null)return good
 let d:any;try{d=JSON.parse(good)}catch{return good};const msg=String(body?.messages?.at(-1)?.content??''),k=h(msg)
 if(body?.response_format?.json_schema?.name!=='owner_brain_plan')return good
 const codes=[...String(body.messages[1]?.content??'').matchAll(/^(p\d+)\|/gm)].map(m=>m[1]!)
 const wrongPrice=(p:number)=>[2,3,1,Math.round((p+0.01)*100)/100,p*10,p+7][k%6]!
 if(d.intent==='read'&&codes.length){d.intent='change';d.actions=[{action:'set_price',item:codes[k%codes.length],price:wrongPrice(10),section:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}];return JSON.stringify(d)}
 for(const a of d.actions??[]){if(typeof a.price==='number')a.price=wrongPrice(a.price);if(a.item&&codes.length&&k%3===0)a.item=codes[(codes.indexOf(a.item)+1)%codes.length]}
 if(k%4===0)(d.actions??=[]).push({action:'create_item',item:null,section:'c1',price:wrongPrice(12),price_ref:null,price_delta:null,value:null,tag:null,text:null,name:msg.split(/\s+/).slice(-3).join(' '),until:null})
 return JSON.stringify(d)}

const SECURITY=new Set([...SAFETY,'prezzo-non-detto'])
async function bench(mode:string){
 const groq=createGroq({mode:mode==='off'?'off':'oracle',cacheDir:new URL('./cache/groq/',import.meta.url).pathname,ledgerFile:new URL('./cache/token-ledger.json',import.meta.url).pathname,realFetch,oracle:mode==='adversary'?adversary:(conv,body)=>brainOracle(conv,body)??currentOracle(conv,body)})
 installNet(groq,realFetch)
 const inner=createNewBot(createRouteBot),menus=new Map<string,EvalMenu[]>()
 const bot:BotUnderTest={...inner,run:async(c,m,x)=>{const r=await inner.run(c,m,x);menus.set(c.id,[structuredClone(m),...r.turns.map(t=>t.menuAfter)]);return r}}
 const vs=(await runBench(bot,convs)).map(v=>extra(convs.find(c=>c.id===v.id)!,v,menus.get(v.id)!))
 writeResults(out,`a-${mode}`,vs,{groq:mode,bot:'nuovo',conversazioni:convs.length})
 return vs}
const worst=(v:Verdict)=>v.fails.some(f=>f.sev==='GRAVE')?'GRAVE':v.fails.some(f=>f.sev==='MEDIO')?'MEDIO':'OK'
const show=(xs:Verdict[])=>xs.slice(0,12).map(v=>`${v.id}: ${v.fails.map(f=>f.code+' '+f.why.slice(0,110)).join(' | ')} ⟨${v.turns.join(' ⏎ ').slice(0,140)}⟩ → «${(v.replies.at(-1)??'').replace(/\s+/g,' ').slice(0,140)}»`).join('\n')

describe('correzioni fase A: batterie A1–A5 sul route vero (cervello acceso, orologio fisso)',()=>{
 it('ogni famiglia ha 150–200 conversazioni',()=>{if(families||only)return;for(const f of new Set(A_CASES.map(c=>c.family))){const n=A_CASES.filter(c=>c.family===f).length;expect(n,f).toBeGreaterThanOrEqual(150);expect(n,f).toBeLessThanOrEqual(200)}})
 if(modes.includes('oracle'))it(`modello ideale: 0 GRAVI, MEDI ≤ 2% per famiglia (${convs.length} conversazioni)`,async()=>{const vs=await bench('oracle')
  const grave=vs.filter(v=>worst(v)==='GRAVE');expect(grave.length,show(grave)).toBe(0)
  for(const f of new Set(vs.map(v=>v.family))){const xs=vs.filter(v=>v.family===f),medi=xs.filter(v=>worst(v)==='MEDIO');expect(medi.length,`${f}: ${medi.length}/${xs.length} MEDI\n${show(medi)}`).toBeLessThanOrEqual(Math.floor(xs.length*0.02))}},600000)
 for(const mode of ['off','adversary'])if(modes.includes(mode))it(`${mode}: 0 GRAVI di sicurezza (scritture non richieste, prezzi non detti, scritture su domanda, «fatto» falso)`,async()=>{const vs=await bench(mode)
  const codes=mode==='off'?SECURITY:new Set(['prezzo-non-detto','scrittura-su-domanda','fatto-falso','risposta-incoerente','scrive-invece-di-chiedere'])
  const bad=vs.filter(v=>v.fails.some(f=>f.sev==='GRAVE'&&codes.has(f.code)));expect(bad.length,show(bad)).toBe(0)},600000)
})
