// Verifica V (17/10/2026): i casi di tests/eval/cases/manuel-1017.ts sul route vero, col cervello ACCESO (default) o spento.
//   TAKO_EVAL=1 TAKO_EVAL_GROQ=off|oracle|replay|record [TAKO_V_BOT=nuovo|attuale] npx vitest run tests/eval/eval-manuel-1017.test.ts
// Filtri come il banco: TAKO_EVAL_ONLY=id,id · TAKO_EVAL_FAMILY=v-deixis,… · TAKO_EVAL_OUT=<nome>. Risultati in
// docs/webapp/bot-cervello-2026-10-17/verifica-v/. In più del giudice del banco: MEDIO «frase-fissa» se una risposta chiede di
// «rimandare/riscrivere la richiesta completa» (regola del titolare: niente frasi fisse, il modello ragiona col contesto).
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z'))})
vi.mock('../../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./route-harness.js')).onboardingMock)
vi.mock('../../packages/db/src/index.ts',async()=>(await import('./route-harness.js')).dbMock)
vi.mock('../../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./route-harness.js')).storeMock)
import {appendFileSync} from 'node:fs'
import {V_CASES} from './cases/manuel-1017.js'
import {createGroq} from './groq-cache.js'
import {closeHarness,createRouteBot,installNet,S} from './route-harness.js'
import {runBench,writeResults} from './runner.js'
import {createNewBot} from './adapters/new-bot.js'
import {brainOracle} from './adapters/brain-oracle.js'
import {currentOracle} from './adapters/current-oracle.js'
import type {BotUnderTest,Verdict} from './types.js'

const which=process.env.TAKO_V_BOT||'nuovo',realFetch=globalThis.fetch
const groq=createGroq({cacheDir:new URL('./cache/groq/',import.meta.url).pathname,ledgerFile:new URL('./cache/token-ledger.json',import.meta.url).pathname,realFetch,
 oracle:which==='nuovo'?(conv,body)=>brainOracle(conv,body)??currentOracle(conv,body):currentOracle})
const only=process.env.TAKO_EVAL_ONLY?.split(','),families=process.env.TAKO_EVAL_FAMILY?.split(',')
const convs=V_CASES.filter(c=>(!only||only.includes(c.id))&&(!families||families.includes(c.family)))
const out=new URL('../../docs/webapp/bot-cervello-2026-10-17/verifica-v/',import.meta.url)
afterAll(()=>closeHarness())

export const FIXED=/(?:rimandami|riscrivimi|riscrivi|rimanda)\s+(?:la\s+)?richiesta\s+completa/i
export function fixedPhrase(v:Verdict):Verdict{const n=v.replies.findIndex(r=>FIXED.test(r));if(n<0)return v
 const fails=[...v.fails,{sev:'MEDIO' as const,code:'frase-fissa',why:`turno ${n+1}: «${v.replies[n]!.replace(/\s+/g,' ').slice(0,90)}»`}];return{...v,fails,success:!fails.some(f=>f.sev!=='BASSO')}}

describe.skipIf(!process.env.TAKO_EVAL)('verifica V: casi di Manuel 17/10',()=>{
 it(`${convs.length} conversazioni (${which})`,async()=>{installNet(groq,realFetch)
  const inner:BotUnderTest=which==='nuovo'?createNewBot(createRouteBot):createRouteBot({name:'attuale'})
  // Traccia del percorso (GATE/BRAIN/REMEMBER del route) per conversazione, solo locale: TAKO_BRAIN_DEBUG=<file>.
  const bot:BotUnderTest={...inner,run:async(c,m,x)=>{if(process.env.TAKO_BRAIN_DEBUG)appendFileSync(process.env.TAKO_BRAIN_DEBUG,`\n### ${c.id}\n`);return inner.run(c,m,x)}}
  const vs=(await runBench(bot,convs)).map(fixedPhrase),name=process.env.TAKO_EVAL_OUT||`${which}-${groq.mode}`
  const s=writeResults(out,name,vs,{groq:groq.mode,bot:which,tetto:groq.maxTokens,conversazioni:convs.length},{groqStats:groq.stats,unknownSql:[...S.unknownSql]})
  console.log(JSON.stringify({total:s.total,llm:s.llm,groq:groq.stats}))
  expect(vs.length).toBe(convs.length)},Number(process.env.TAKO_EVAL_TIMEOUT_MS||900000))
})
