// BANCO VERO (18/10/2026): conversazioni reali di Manuel 14–17/10 (tests/eval/cases/banco-vero.ts) sul route vero.
// Spento di default. Esempi:
//   TAKO_EVAL=1 TAKO_EVAL_GROQ=oracle npx vitest run tests/eval/eval-banco-vero.test.ts
//   TAKO_EVAL=1 TAKO_EVAL_GROQ=off    npx vitest run tests/eval/eval-banco-vero.test.ts
//   TAKO_EVAL=1 TAKO_EVAL_GROQ=record TAKO_EVAL_GROQ_KEY_FILE=~/.config/tako-webapp/groq-key-test.txt \
//     TAKO_EVAL_GROQ_MAX_TOKENS=60000 TAKO_EVAL_GROQ_MAX_TOKENS_PER_KEY=150000 npx vitest run tests/eval/eval-banco-vero.test.ts
// Motore: TAKO_BV_BOT=nuovo (default, cervello acceso: Groq gpt-oss fase R) | attuale | anthropic (adattatore TODO, saltato).
// Modi Groq come il banco E: off | oracle | replay (default) | record. In record la chiave va data con TAKO_EVAL_GROQ_KEY_FILE
// (mai groq-key.txt del bot né groq-key-traduzioni.txt): senza, il test si ferma prima di chiamare la rete.
// Filtri: TAKO_EVAL_ONLY=id,id · TAKO_EVAL_FAMILY=bv-semplici,… · TAKO_EVAL_OUT=<nome>. Risultati in docs/webapp/banco-vero-2026-10-18/risultati/.
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z'))})
vi.mock('../../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./route-harness.js')).onboardingMock)
vi.mock('../../packages/db/src/index.ts',async()=>(await import('./route-harness.js')).dbMock)
vi.mock('../../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./route-harness.js')).storeMock)
import {appendFileSync,writeFileSync} from 'node:fs'
import {BV_CASES,isAmbiguous} from './cases/banco-vero.js'
import {createGroq} from './groq-cache.js'
import {closeHarness,createRouteBot,installNet,S} from './route-harness.js'
import {runBench,writeResults} from './runner.js'
import {createNewBot} from './adapters/new-bot.js'
import {createAnthropicBot} from './adapters/anthropic-bot.js'
import {brainOracle} from './adapters/brain-oracle.js'
import {currentOracle} from './adapters/current-oracle.js'
import type {BotUnderTest,Verdict} from './types.js'

const which=process.env.TAKO_BV_BOT||'nuovo',realFetch=globalThis.fetch,mode=process.env.TAKO_EVAL_GROQ||'replay'
const keyFile=process.env.TAKO_EVAL_GROQ_KEY_FILE
if(process.env.TAKO_EVAL&&mode==='record'){
 if(!keyFile)throw new Error('banco vero: in record serve TAKO_EVAL_GROQ_KEY_FILE (chiave di test)')
 if(/groq-key\.txt$|traduzioni/i.test(keyFile))throw new Error('banco vero: mai la chiave del bot né quella delle traduzioni')}
const groq=createGroq({cacheDir:new URL('./cache/groq/',import.meta.url).pathname,ledgerFile:new URL('./cache/token-ledger.json',import.meta.url).pathname,realFetch,
 oracle:which==='nuovo'?(conv,body)=>brainOracle(conv,body)??currentOracle(conv,body):currentOracle})
const only=process.env.TAKO_EVAL_ONLY?.split(','),families=process.env.TAKO_EVAL_FAMILY?.split(',')
const convs=BV_CASES.filter(c=>(!only||only.includes(c.id))&&(!families||families.includes(c.family)))
const out=new URL('../../docs/webapp/banco-vero-2026-10-18/risultati/',import.meta.url)
afterAll(()=>closeHarness())

// Come la verifica V: MEDIO «frase-fissa» se una risposta chiede di rimandare/riscrivere la richiesta completa.
const FIXED=/(?:rimandami|riscrivimi|riscrivi|rimanda)\s+(?:la\s+)?richiesta\s+completa/i
function fixedPhrase(v:Verdict):Verdict{const n=v.replies.findIndex(r=>FIXED.test(r));if(n<0)return v
 const fails=[...v.fails,{sev:'MEDIO' as const,code:'frase-fissa',why:`turno ${n+1}: «${v.replies[n]!.replace(/\s+/g,' ').slice(0,90)}»`}];return{...v,fails,success:!fails.some(f=>f.sev!=='BASSO')}}

/** Metriche del confronto tra motori (PIANO task 4.3). */
export function metrics(vs:Verdict[]){
 const pct=(a:number,b:number)=>b?Math.round(a/b*1000)/10:0,turns=vs.reduce((a,v)=>a+v.replies.length,0),simple=vs.filter(v=>v.family==='bv-semplici')
 const lat=vs.flatMap(v=>v.latencyMs).sort((a,b)=>a-b),q=(x:number)=>lat.length?lat[Math.min(lat.length-1,Math.floor(x*lat.length))]!:0
 const amb=new Set(BV_CASES.filter(isAmbiguous).map(c=>c.id))
 return{conversazioni:vs.length,messaggi:turns,successo:pct(vs.filter(v=>v.success).length,vs.length),successoSemplici:pct(simple.filter(v=>v.success).length,simple.length),semplici:simple.length,
  domandePer10Messaggi:turns?Math.round(vs.reduce((a,v)=>a+v.clarifications,0)/turns*100)/10:0,domandeNonAttesePer10:turns?Math.round(vs.reduce((a,v)=>a+v.unexpectedClarifications,0)/turns*100)/10:0,
  gravi:vs.filter(v=>v.fails.some(f=>f.sev==='GRAVE')).length,graviTotali:vs.reduce((a,v)=>a+v.fails.filter(f=>f.sev==='GRAVE').length,0),
  ambigue:{n:vs.filter(v=>amb.has(v.id)).length,successo:pct(vs.filter(v=>amb.has(v.id)&&v.success).length,vs.filter(v=>amb.has(v.id)).length)},
  latenzaMs:{p50:Math.round(q(0.5)),p95:Math.round(q(0.95)),conGroqRegistratoTotale:Math.round(vs.reduce((a,v)=>a+v.recordedLlmMs,0))},
  token:vs.reduce((a,v)=>a+v.llmTokens,0),chiamateIA:vs.reduce((a,v)=>a+v.llmCalls,0),iaMancanti:vs.reduce((a,v)=>a+v.llmMisses,0)}}

describe.skipIf(!process.env.TAKO_EVAL)('banco vero: conversazioni reali di Manuel 14–17/10',()=>{
 it(`${convs.length} conversazioni (${which})`,async()=>{
  const name=process.env.TAKO_EVAL_OUT||`${which}-${groq.mode}`
  if(which==='anthropic'){const b=createAnthropicBot();if(!b.ready){writeFileSync(new URL(`summary-${name}.md`,out),`# Banco vero · ${name}\n\nAdattatore ${b.name} non pronto (TODO): saltato.\n`);console.log('banco vero: adattatore Anthropic non pronto, saltato');return}}
  installNet(groq,realFetch)
  const inner:BotUnderTest=which==='nuovo'?createNewBot(createRouteBot):createRouteBot({name:'attuale'})
  const bot:BotUnderTest={...inner,run:async(c,m,x)=>{if(process.env.TAKO_BRAIN_DEBUG)appendFileSync(process.env.TAKO_BRAIN_DEBUG,`\n### ${c.id}\n`);return inner.run(c,m,x)}}
  const vs=(await runBench(bot,convs)).map(fixedPhrase),m=metrics(vs)
  const s=writeResults(out,name,vs,{groq:groq.mode,bot:which,tetto:groq.maxTokens,conversazioni:convs.length},{metriche:m,groqStats:groq.stats,unknownSql:[...S.unknownSql]})
  appendFileSync(new URL(`summary-${name}.md`,out),['','## Metriche del confronto','','```json',JSON.stringify(m,null,1),'```',''].join('\n'))
  console.log(JSON.stringify({metriche:m,total:s.total,groq:groq.stats}))
  expect(vs.length).toBe(convs.length)},Number(process.env.TAKO_EVAL_TIMEOUT_MS||900000))
})
