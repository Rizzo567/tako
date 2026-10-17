// Banco E sul bot NUOVO (perimetro N) e confronto con il bot attuale. Spento di default:
//   TAKO_EVAL=1 npx vitest run tests/eval/eval-new.test.ts
// Stesse opzioni di eval-current.test.ts. Le risposte Groq del bot nuovo hanno prompt diversi: la prima esecuzione va in
// record (entro il tetto), le successive in replay a 0 token.
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z'))})
vi.mock('../../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./route-harness.js')).onboardingMock)
vi.mock('../../packages/db/src/index.ts',async()=>(await import('./route-harness.js')).dbMock)
vi.mock('../../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./route-harness.js')).storeMock)
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
import {CONVERSATIONS} from './conversations.js'
import {createGroq} from './groq-cache.js'
import {closeHarness,createRouteBot,installNet,S} from './route-harness.js'
import {runBench,writeResults,type Summary} from './runner.js'
import {createNewBot} from './adapters/new-bot.js'

const realFetch=globalThis.fetch
const groq=createGroq({cacheDir:new URL('./cache/groq/',import.meta.url).pathname,ledgerFile:new URL('./cache/token-ledger.json',import.meta.url).pathname,realFetch})
const only=process.env.TAKO_EVAL_ONLY?.split(','),families=process.env.TAKO_EVAL_FAMILY?.split(',')
const convs=CONVERSATIONS.filter(c=>(!only||only.includes(c.id))&&(!families||families.includes(c.family)))
const out=new URL('../../docs/webapp/bot-cervello-2026-10-17/eval/',import.meta.url)
afterAll(()=>closeHarness())

describe.skipIf(!process.env.TAKO_EVAL)('banco E: bot nuovo',()=>{
 const bot=createNewBot(createRouteBot)
 it.skipIf(!bot.ready)(`${convs.length} conversazioni + confronto con l'attuale`,async()=>{installNet(groq,realFetch)
  const vs=await runBench(bot,convs),name=process.env.TAKO_EVAL_OUT||`nuovo-${groq.mode}`
  const s=writeResults(out,name,vs,{groq:groq.mode,tetto:groq.maxTokens,conversazioni:convs.length},{groqStats:groq.stats,unknownSql:[...S.unknownSql]})
  // Confronto: di default contro il bot attuale con IA ideale per messaggio (tetto dell'architettura attuale, il paragone più duro);
  // TAKO_EVAL_BASE=attuale-replay|attuale-off per un confronto alla pari nello stesso modo Groq.
  const base=new URL(`results-${process.env.TAKO_EVAL_BASE||'attuale-oracle'}.json`,out)
  if(existsSync(base)){const b=JSON.parse(readFileSync(base,'utf8')) as {summary:Summary,verdicts:{id:string,success:boolean}[]},bm=new Map(b.verdicts.map(v=>[v.id,v.success]))
   const better=vs.filter(v=>v.success&&bm.get(v.id)===false).map(v=>v.id),worse=vs.filter(v=>!v.success&&bm.get(v.id)===true).map(v=>v.id)
   const goal={graviSicurezza:s.total.safety===0,medi2pct:s.total.medio<=Math.floor(s.total.n*0.02)&&s.total.medio<b.summary.total.medio,multiTurnoPiu10:Math.round(s.multi.success/s.multi.n*100)>=Math.round(b.summary.multi.success/b.summary.multi.n*100)+10}
   writeFileSync(new URL(`confronto-${name}.json`,out),JSON.stringify({goal,attuale:b.summary.total,nuovo:s.total,multiAttuale:b.summary.multi,multiNuovo:s.multi,migliorate:better,peggiorate:worse},null,1)+'\n')
   console.log(JSON.stringify({goal,migliorate:better.length,peggiorate:worse.length}))}
  expect(vs.length).toBe(convs.length)},600000)
 it.skipIf(bot.ready)('adattatore del bot nuovo non ancora pronto (CONTRATTO.md)',()=>{expect(bot.ready).toBe(false)})
})
