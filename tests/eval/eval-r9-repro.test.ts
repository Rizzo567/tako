// R9 (18/10/2026): riproduzione dei 3 VOCALI di Manuel delle 12:30–12:32 UTC sul QA (menu vero = rev 1820 riletto dal DB, sola lettura)
// con il route vero, cervello acceso. Spento di default.
//   TAKO_R9=1 TAKO_EVAL_GROQ=record TAKO_EVAL_GROQ_KEY_FILE=~/.config/tako-webapp/groq-key-test.txt TAKO_BRAIN_DEBUG=/tmp/x.log npx vitest run tests/eval/eval-r9-repro.test.ts
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z'))})
vi.mock('../../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./route-harness.js')).onboardingMock)
vi.mock('../../packages/db/src/index.ts',async()=>(await import('./route-harness.js')).dbMock)
vi.mock('../../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./route-harness.js')).storeMock)
import {readFileSync} from 'node:fs'
import {createGroq} from './groq-cache.js'
import {closeHarness,createRouteBot,installNet} from './route-harness.js'
import {brainSql,brainTables,resetBrainTables} from './adapters/new-bot.js'
import {brainOracle} from './adapters/brain-oracle-r.js'
import {currentOracle} from './adapters/current-oracle.js'
import type {Conversation} from './types.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const after=JSON.parse(readFileSync(new URL('./fixtures/qa-live-1018-after.json',import.meta.url),'utf8'))
// Cronologia vera: alle 12:30 i turni di prima (10:56) sono oltre i 30 minuti → nessuna cronologia. Trascrizioni dell'edge (tako_owner_brain_turns).
export const R9_TURNS=['Ora nei primi aggiungi pasta al pesto, pasta al ragù, pasta carbonara e riso giallo, metti le paste a 10 euro e il riso a 8 euro','Aggiornapure','Sì sì, aggiornali']
describe.skipIf(!process.env.TAKO_R9)('R9: i 3 vocali di Manuel 12:30–12:32',()=>{
 it('riproduzione',async()=>{
  const groq=createGroq({cacheDir:new URL('./cache/groq/',import.meta.url).pathname,ledgerFile:new URL('./cache/token-ledger.json',import.meta.url).pathname,realFetch,oracle:(c,b)=>brainOracle(c,b)??currentOracle(c,b)})
  installNet(groq,realFetch)
  const conv:Conversation={id:'r9-repro',family:'manuel',menu:'qa',turns:R9_TURNS.map(voice=>({voice})),changes:[]}
  const inner=createRouteBot({name:'nuovo',settings:{botBrain:true},extraSql:brainSql});resetBrainTables()
    const run=await inner.run(conv,structuredClone(after),{restaurant:'Tako · Verifica web'})
  for(const [i,t] of run.turns.entries())process.stderr.write(`--- ${i+1} ${R9_TURNS[i]}\n${t.reply}\n${JSON.stringify(t.menuAfter.menus[0]!.sections.map((s:any)=>[s.name,s.items.map((x:any)=>x.name+' '+x.price)]))}\n`)
  console.log(JSON.stringify(groq.stats))
  expect(run.turns.length).toBe(R9_TURNS.length)},600000)
})
