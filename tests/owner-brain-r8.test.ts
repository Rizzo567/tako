// R8 (18/10/2026): bug dal vivo sul QA. Guardie strutturali del cervello: mai un testo del modello che dice «fatto» quando il
// server non ha pubblicato nulla; mai il solo «Non ho cambiato nulla.» su una richiesta capita. I piani sono quelli VERI di
// gpt-oss-120b registrati sui messaggi di Manuel (tests/eval/fixtures/r8-gptoss-plans.json), menu = QA riletto il 18/10.
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {readFileSync} from 'node:fs'
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {diff,sectionDiff} from './eval/judge.js'
import {brainSql} from './eval/adapters/new-bot.js'
import {cleanDraft,claimsWrite} from '../apps/server/src/lib/owner-brain-r.js'
import {g9Prices} from '../apps/server/src/lib/twilio-menu-ai.js'
import type {Conversation} from './eval/types.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const after=JSON.parse(readFileSync(new URL('./eval/fixtures/qa-live-1018-after.json',import.meta.url),'utf8'))
const PLANS=JSON.parse(readFileSync(new URL('./eval/fixtures/r8-gptoss-plans.json',import.meta.url),'utf8')) as any[]
let queue:any[]=[]
const fake:any={mode:'fake',stats:{},maxTokens:0,pace:async()=>{},setConversation:()=>{},spentToday:()=>0,
 async handle(_u:string,init:any){const body=JSON.parse(String(init?.body??'{}'));const plan=body?.response_format?.json_schema?.name==='owner_brain_plan'?queue.shift():null
  const content=plan?JSON.stringify(plan):JSON.stringify({intent:'none'})
  return{response:new Response(JSON.stringify({choices:[{message:{content}}],usage:{prompt_tokens:1,completion_tokens:1}}),{status:200,headers:{'Content-Type':'application/json'}}),hit:false,miss:false,tokens:0,ms:0}}}
const MSG='ora in primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.\nmetti le paste a 10 euro e il riso a 8 euro'
async function turn(plans:any[],text=MSG){queue=structuredClone(plans);installNet(fake,realFetch)
 const conv:Conversation={id:'r8',family:'manuel',menu:'qa',turns:[{text}],changes:[]}
 const run=await createRouteBot({name:'nuovo',settings:{botBrain:true},extraSql:brainSql}).run(conv,structuredClone(after),{restaurant:'Tako · Verifica web'})
 const t=run.turns[0]!;if(process.env.TAKO_R8_SHOW)process.stderr.write("REPLY "+JSON.stringify(t.reply)+"\n");return{reply:t.reply.replace(/^Sono l.*?persona\.\s*/s,''),wrote:diff(after,t.menuAfter).length+sectionDiff(after,t.menuAfter).length,pending:run.pending as any}}

describe('R8: mai «fatto» senza scrittura, mai il solo «Non ho cambiato nulla.»',()=>{
 it('bozze: i participi da soli sono un «fatto», le domande no, i codici interni mai',()=>{
  for(const s of ['Aggiunti i nuovi piatti nella sezione "primi": pasta al pesto, pasta al ragu, pasta carbonara a 10 €, e riso giallo a 8 €.','Creata la categoria Primi.','Piatti spostati in Primi.','Ho inserito il riso giallo.','Tutto aggiunto!'])
   {expect(claimsWrite(s),s).toBe(true);expect(cleanDraft(s,{wrote:false,numbers:[10,8]}),s).toBeNull()}
  for(const s of ['La categoria Primi non c’è: la creo?','C’è già pasta al ragù a 20 €: lo aggiorno a 10 € o ne creo un altro?','Vuoi che lo sposti nei Primi?'])expect(cleanDraft(s,{wrote:false,numbers:[10,20]}),s).toBe(s)
  expect(cleanDraft('Quale parmigiana vuoi spostare, quella di p5 o p6?',{wrote:false,numbers:[]})).toBeNull()
  expect(cleanDraft('Aggiunti i nuovi piatti in Primi.',{wrote:true,numbers:[]})).toBe('Aggiunti i nuovi piatti in Primi.')})
 it('«a 10, 10 e 8»: elenco di prezzi, non 10,10',()=>{const p=g9Prices('a 10, 10 e 8');expect(p).toContain(10);expect(p).toContain(8)})
 it('12:57 vero: piatto già nel menu, poi riepilogo di 4 modifiche senza domanda → proposta da confermare, nessuna scrittura',async()=>{
  const r=await turn([PLANS[0],PLANS[1]]);expect(r.wrote).toBe(0)
  expect(r.reply).not.toMatch(/^Non ho cambiato nulla\.$/);expect(claimsWrite(r.reply.split('\n\n')[0]!)&&!/da confermare/.test(r.reply.split('\n\n')[0]!)).toBe(false)
  expect(r.reply).toMatch(/da confermare con OK/);expect(r.pending?.kind).toBe('batch')})
 it('12:58 vero: «Aggiunti i nuovi piatti…» due volte rifiutato → mai inviato; i fatti dicono cosa non è salvato',async()=>{
  const r=await turn([PLANS[2],PLANS[2]]);expect(r.wrote).toBe(0)
  expect(r.reply).not.toMatch(/Aggiunti/);expect(r.reply).toMatch(/Non salvato: |Non ancora pubblicato:\n1\. /);expect(r.reply).toMatch(/pasta al ragù\* \(20,00 €\)/)})
 it('piano senza azioni con bozza «Ho spostato…»: la bozza cade, nessuna scrittura',async()=>{
  const p={...PLANS[0],intent:'chat',actions:[],reply_draft:'Ho spostato la parmigiana nei Primi.'}
  const r=await turn([p,p],'grazie');expect(r.wrote).toBe(0);expect(r.reply).not.toMatch(/spostat/i)})
 it('piatto già nel menu: la domanda del modello arriva al titolare con i piatti chiari in sospeso',async()=>{
  const q={...PLANS[0],intent:'clarify',actions:PLANS[0].actions.filter((a:any)=>a.action==='create_item'&&a.name!=='pasta al ragu'),reply_draft:'C’è già pasta al ragù a 20 €: lo aggiorno o ne creo un altro?'}
  const r=await turn([PLANS[0],q]);expect(r.wrote).toBe(0);expect(r.reply).toMatch(/^C’è già pasta al ragù a 20 €: lo aggiorno o ne creo un altro\?/);expect(r.pending?.kind).toBe('brain_ask')})
})
