// Banco E sul bot ATTUALE (percorso vero del route, store in memoria, Groq in record/replay). Spento di default nella suite:
//   TAKO_EVAL=1 npx vitest run tests/eval/eval-current.test.ts
// Opzioni: TAKO_EVAL_GROQ=off|replay|record|oracle (default replay), TAKO_EVAL_GROQ_MAX_TOKENS (default 20000, tetto giornaliero),
// TAKO_EVAL_ONLY=id1,id2 · TAKO_EVAL_FAMILY=anche,correzione · TAKO_EVAL_OUT=<nome risultati> (default «attuale-<modo>»).
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z'))})
vi.mock('../../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./route-harness.js')).onboardingMock)
vi.mock('../../packages/db/src/index.ts',async()=>(await import('./route-harness.js')).dbMock)
vi.mock('../../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./route-harness.js')).storeMock)
import {CONVERSATIONS} from './conversations.js'
import {createGroq} from './groq-cache.js'
import {closeHarness,createRouteBot,installNet,S} from './route-harness.js'
import {runBench,writeResults} from './runner.js'
import {currentOracle} from './adapters/current-oracle.js'

const realFetch=globalThis.fetch
const groq=createGroq({cacheDir:new URL('./cache/groq/',import.meta.url).pathname,ledgerFile:new URL('./cache/token-ledger.json',import.meta.url).pathname,realFetch,oracle:currentOracle})
const only=process.env.TAKO_EVAL_ONLY?.split(','),families=process.env.TAKO_EVAL_FAMILY?.split(',')
const convs=CONVERSATIONS.filter(c=>(!only||only.includes(c.id))&&(!families||families.includes(c.family)))
afterAll(()=>closeHarness())

describe.skipIf(!process.env.TAKO_EVAL)('banco E: bot attuale',()=>{
 it(`${convs.length} conversazioni`,async()=>{installNet(groq,realFetch)
  const bot=createRouteBot({name:'attuale'}),vs=await runBench(bot,convs)
  const s=writeResults(new URL('../../docs/webapp/bot-cervello-2026-10-17/eval/',import.meta.url),process.env.TAKO_EVAL_OUT||`attuale-${groq.mode}`,vs,{groq:groq.mode,tetto:groq.maxTokens,orologio:process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z',conversazioni:convs.length},{groqStats:groq.stats,unknownSql:[...S.unknownSql]})
  console.log(JSON.stringify({total:s.total,llm:s.llm,groq:groq.stats,latency:s.latency}))
  expect(vs.length).toBe(convs.length)},600000)
})
