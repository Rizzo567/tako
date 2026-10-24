// GROQ 122 (19/10/2026): bot titolare attuale «fase R» (Groq gpt-oss, TAKO_BV_BOT=nuovo) col MODELLO VERO sulle 122 conversazioni
// del confronto Haiku vs Groq = 92 del banco vero (tests/eval/cases/banco-vero.ts) + 30 nuove dello spike
// (docs/webapp/spike-haiku-cloud-2026-10-18/harness/cases-extra.ts), stesso giudice (tests/eval/judge.ts). Spento di default.
//   TAKO_EVAL=1 TAKO_EVAL_GROQ=oracle npx vitest run tests/eval/eval-groq-122.test.ts      (sanity, 0 token)
//   TAKO_EVAL=1 TAKO_EVAL_GROQ=record TAKO_EVAL_GROQ_KEY_ENV=GROQ_API_KEY,GROQ_API_KEY2 TAKO_EVAL_GROQ_MAX_TOKENS=300000 \
//     npx vitest run tests/eval/eval-groq-122.test.ts                                       (giro vero, cache su disco)
//   TAKO_EVAL=1 TAKO_EVAL_GROQ=replay npx vitest run tests/eval/eval-groq-122.test.ts      (rilettura dalla cache, 0 token)
// Chiavi: TAKO_EVAL_GROQ_KEY_ENV (variabili d'ambiente, la seconda al 429 giornaliero) oppure TAKO_EVAL_GROQ_KEY_FILE come il banco vero.
// Filtri: TAKO_EVAL_ONLY=id,id · TAKO_EVAL_FAMILY=… · TAKO_EVAL_SET=bv|extra · TAKO_EVAL_OUT=<nome>.
// Risultati in docs/webapp/bot-anthropic-2026-10-19/groq/ (results-, summary-, metriche-<nome>.json).
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z'))})
vi.mock('../../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./route-harness.js')).onboardingMock)
vi.mock('../../packages/db/src/index.ts',async()=>(await import('./route-harness.js')).dbMock)
vi.mock('../../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./route-harness.js')).storeMock)
import {appendFileSync,existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {BV_CASES} from './cases/banco-vero.js'
import {EXTRA_CASES} from '../../docs/webapp/spike-haiku-cloud-2026-10-18/harness/cases-extra.ts'
import {createGroq,requestHash} from './groq-cache.js'
import {closeHarness,createRouteBot,installNet,S} from './route-harness.js'
import {runBench,writeResults} from './runner.js'
import {SAFETY} from './judge.js'
import {createNewBot} from './adapters/new-bot.js'
import {brainOracle} from './adapters/brain-oracle.js'
import {currentOracle} from './adapters/current-oracle.js'
import type {BotUnderTest,Verdict} from './types.js'

const realFetch=globalThis.fetch,mode=process.env.TAKO_EVAL_GROQ||'replay'
const keyFile=process.env.TAKO_EVAL_GROQ_KEY_FILE,keyEnv=process.env.TAKO_EVAL_GROQ_KEY_ENV
if(process.env.TAKO_EVAL&&mode==='record'){
 if(!keyFile&&!keyEnv)throw new Error('groq 122: in record serve TAKO_EVAL_GROQ_KEY_ENV o TAKO_EVAL_GROQ_KEY_FILE')
 if(keyFile&&/groq-key\.txt$|traduzioni/i.test(keyFile))throw new Error('groq 122: mai la chiave del bot né quella delle traduzioni')}
const cacheDir=new URL('./cache/groq/',import.meta.url).pathname
const groq=createGroq({cacheDir,ledgerFile:new URL('./cache/token-ledger.json',import.meta.url).pathname,realFetch,oracle:(conv,body)=>brainOracle(conv,body)??currentOracle(conv,body)})
// Token «di listino» del giro: usage di ogni risposta usata (registrata ora o già in cache), non solo quelli spesi oggi.
let usageTokens=0,usagePrompt=0,usageCompletion=0
const handle0=groq.handle
groq.handle=async(url:string,init:any)=>{const r=await handle0(url,init);if(!r.miss&&mode!=='oracle'){try{const f=join(cacheDir,requestHash(new URL(url).pathname,JSON.parse(String(init?.body??'{}')))+'.json')
 const u=JSON.parse(readFileSync(f,'utf8')).usage;usageTokens+=Number(u?.total_tokens)||0;usagePrompt+=Number(u?.prompt_tokens)||0;usageCompletion+=Number(u?.completion_tokens)||0}catch{}}return r}

const bvIds=new Set(BV_CASES.map(c=>c.id)),set=process.env.TAKO_EVAL_SET
const only=process.env.TAKO_EVAL_ONLY?.split(','),families=process.env.TAKO_EVAL_FAMILY?.split(',')
const convs=[...(set==='extra'?[]:BV_CASES),...(set==='bv'?[]:EXTRA_CASES)].filter(c=>(!only||only.includes(c.id))&&(!families||families.includes(c.family)))
const out=new URL('../../docs/webapp/bot-anthropic-2026-10-19/groq/',import.meta.url)
afterAll(()=>closeHarness())

// Come il banco vero: MEDIO «frase-fissa» se una risposta chiede di rimandare/riscrivere la richiesta completa.
const FIXED=/(?:rimandami|riscrivimi|riscrivi|rimanda)\s+(?:la\s+)?richiesta\s+completa/i
function fixedPhrase(v:Verdict):Verdict{const n=v.replies.findIndex(r=>FIXED.test(r));if(n<0)return v
 const fails=[...v.fails,{sev:'MEDIO' as const,code:'frase-fissa',why:`turno ${n+1}: «${v.replies[n]!.replace(/\s+/g,' ').slice(0,90)}»`}];return{...v,fails,success:!fails.some(f=>f.sev!=='BASSO')}}

const pct=(a:number,b:number)=>b?Math.round(a/b*1000)/10:0
const quant=(xs:number[],q:number)=>{if(!xs.length)return 0;const s=[...xs].sort((a,b)=>a-b);return Math.round(s[Math.min(s.length-1,Math.floor(q*s.length))]!)}
function block(vs:Verdict[]){const turns=vs.reduce((a,v)=>a+v.replies.length,0),ok=vs.filter(v=>v.success).length
 const grave=vs.filter(v=>v.fails.some(f=>f.sev==='GRAVE')),safe=vs.filter(v=>v.fails.some(f=>f.sev==='GRAVE'&&SAFETY.has(f.code)))
 return{n:vs.length,ok,successo:pct(ok,vs.length),messaggi:turns,conGRAVI:grave.length,graviTotali:vs.reduce((a,v)=>a+v.fails.filter(f=>f.sev==='GRAVE').length,0),
  conGRAVIsicurezza:safe.length,graviSicurezzaTotali:vs.reduce((a,v)=>a+v.fails.filter(f=>f.sev==='GRAVE'&&SAFETY.has(f.code)).length,0),idGRAVIsicurezza:safe.map(v=>v.id),
  domandePer10Messaggi:turns?Math.round(vs.reduce((a,v)=>a+v.clarifications,0)/turns*100)/10:0,conIAmancante:vs.filter(v=>v.llmMisses>0).length}}

describe.skipIf(!process.env.TAKO_EVAL)('groq 122: bot fase R (Groq gpt-oss) sul banco vero + 30 nuove',()=>{
 it(`${convs.length} conversazioni (nuovo, groq ${mode})`,async()=>{
  const name=process.env.TAKO_EVAL_OUT||`groq-${groq.mode}`,cacheBefore=readdirSync(cacheDir).length
  installNet(groq,realFetch)
  const inner=createNewBot(createRouteBot),perTurn=new Map<string,number[]>()
  // Latenza stimata per turno = harness (webhook→risposta) + latenza Groq registrata delle chiamate di quel turno.
  // Ha senso in replay (harness senza rete); in record l'harness include già la chiamata vera e le attese del limite al minuto.
  const bot:BotUnderTest={...inner,run:async(c,m,x)=>{const r=await inner.run(c,m,x);perTurn.set(c.id,r.turns.map(t=>t.latencyMs+t.llm.recordedMs));
   if(process.env.TAKO_EVAL_PROGRESS)appendFileSync(process.env.TAKO_EVAL_PROGRESS,`${c.id} calls=${r.turns.reduce((a,t)=>a+t.llm.calls,0)} misses=${r.turns.reduce((a,t)=>a+t.llm.misses,0)} hits=${groq.stats.hits} rec=${groq.stats.recorded} tok=${groq.stats.tokens}\n`);return r}}
  const vs=(await runBench(bot,convs)).map(fixedPhrase)
  const bv=vs.filter(v=>bvIds.has(v.id)),nu=vs.filter(v=>!bvIds.has(v.id)),lat=vs.flatMap(v=>perTurn.get(v.id)??[])
  const m={motore:'nuovo (fase R, Groq gpt-oss)',groq:groq.mode,giorno:new Date(performance.timeOrigin+performance.now()).toISOString(),
   totale:block(vs),bancoVero92:block(bv),nuove30:block(nu),sempliciBancoVero:block(bv.filter(v=>v.family==='bv-semplici')),sempliciTutte:block(vs.filter(v=>v.family==='bv-semplici')),
   latenzaStimataTurnoMs:{p50:quant(lat,0.5),p95:quant(lat,0.95),turni:lat.length,nota:'harness + recordedLlmMs per turno; significativa in replay'},
   token:{usageTotali:usageTokens,usagePrompt,usageCompletion,spesiInQuestoGiro:groq.stats.tokens,perChiave:groq.stats.byKey},
   chiamateIA:{risposte:groq.stats.calls,dallaCache:groq.stats.hits,registrateOra:groq.stats.recorded,oracolo:groq.stats.oracle,senzaRisposta:groq.stats.misses,rifiutatePerTetto:groq.stats.refused,risposte429:groq.stats.rateLimited,fileCachePrima:cacheBefore,fileCacheDopo:readdirSync(cacheDir).length},
   conversazioniConIAmancante:vs.filter(v=>v.llmMisses>0).map(v=>v.id)}
  const s=writeResults(out,name,vs,{groq:groq.mode,bot:'nuovo',tetto:groq.maxTokens,conversazioni:convs.length},{metriche:m,groqStats:groq.stats,unknownSql:[...S.unknownSql]})
  writeFileSync(new URL(`metriche-${name}.json`,out),JSON.stringify(m,null,1)+'\n')
  appendFileSync(new URL(`summary-${name}.md`,out),['','## Metriche Groq 122','','```json',JSON.stringify(m,null,1),'```',''].join('\n'))
  console.log(JSON.stringify({metriche:m,total:s.total}))
  expect(vs.length).toBe(convs.length)},Number(process.env.TAKO_EVAL_TIMEOUT_MS||900000))
})
