// R8 (18/10/2026): riproduzione dei 3 messaggi di Manuel delle 12:56–12:58 sul QA (menu vero riletto dal DB, sola lettura)
// con il route vero, cervello acceso. Spento di default.
//   TAKO_R8=1 TAKO_EVAL_GROQ=record TAKO_EVAL_GROQ_KEY_FILE=~/.config/tako-webapp/groq-key-test.txt TAKO_BRAIN_DEBUG=/tmp/x.log npx vitest run tests/eval/eval-r8-repro.test.ts
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
// Cronologia vera del QA (tako_owner_brain_turns 18/10 10:53–10:56 UTC), riportata prima dell'orologio fisso.
const HISTORY:[string,string][]=[['owner','metti pasta al sugo a 9 euro'],['bot','Prezzo di Pasta al sugo aggiornato a 9 €.\n\n*Pasta al sugo*: prezzo da 12,00 € a *9,00 €*'],
 ['owner','togli che ne sacc'],['bot','Ho nascosto "Che ne sacc" dal menu.\n\n*Che ne sacc*: *nascosto* dal menu'],['owner','togli piatto di verifica'],['bot','Ho nascosto "Piatto di verifica" dal menu.\n\n*Piatto di verifica*: *nascosto* dal menu'],
 ['owner','cosa sai fare?'],['bot','Posso gestire prezzi, disponibilità, nascondere, evidenziare, descrizioni, tag, creare piatti o sezioni, promozioni, speciali, foto, allergeni, cancellare, rinominare, spostare, traduzioni e altro.'],
 ['owner','sposta la parmigiana sotto al tiramisu'],['bot','Vuoi spostare "la parmigiana" in una nuova sezione o semplicemente cambiarne l\'ordine rispetto al tiramisù?\n\n1. *la parmigiana* (15,00 €)\n2. *tiramisù* (15,00 €)'],
 ['owner','sposta la parmigiana in una nuova sezione, crea la nuova sezione "primi"'],['bot','Ho creato la sezione "primi" e spostato "la parmigiana" al suo interno.\n\nNuova categoria *Primi*\n*la parmigiana*: spostato in *Primi*']]
export const R8_TURNS=[ 'ora in primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.\nmetti le paste a 10 euro e il riso a 8 euro',
 'ora nella sezione primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.\nmetti le paste a 10 euro e il riso a 8 euro']
describe.skipIf(!process.env.TAKO_R8)('R8: i 3 messaggi di Manuel 12:56–12:58',()=>{
 it('riproduzione',async()=>{
  const groq=createGroq({cacheDir:new URL('./cache/groq/',import.meta.url).pathname,ledgerFile:new URL('./cache/token-ledger.json',import.meta.url).pathname,realFetch,oracle:(c,b)=>brainOracle(c,b)??currentOracle(c,b)})
  installNet(groq,realFetch)
  const conv:Conversation={id:'r8-repro',family:'manuel',menu:'qa',turns:R8_TURNS.map(text=>({text})),changes:[]}
  const inner=createRouteBot({name:'nuovo',settings:{botBrain:true},extraSql:brainSql});resetBrainTables()
  const t0=Date.parse(process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z');HISTORY.forEach(([role,body],i)=>brainTables.turns.push({id:++brainTables.seq,restaurant_id:'26050ecd-2e55-4057-a4c5-bff2b449cd47',phone:'whatsapp:+390000000077',role,body,created_at:new Date(t0-(HISTORY.length-i)*25000)}))
  const run=await inner.run(conv,structuredClone(after),{restaurant:'Tako · Verifica web'})
  for(const [i,t] of run.turns.entries())process.stderr.write(`--- ${i+1} ${R8_TURNS[i]}\n${t.reply}\n${JSON.stringify(t.menuAfter.menus[0]!.sections.map((s:any)=>[s.name,s.items.map((x:any)=>x.name+' '+x.price)]))}\n`)
  console.log(JSON.stringify(groq.stats))
  expect(run.turns.length).toBe(R8_TURNS.length)},600000)
})
