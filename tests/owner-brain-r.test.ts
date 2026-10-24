// Fase R (R1.3, R2, 17/10/2026 notte): col cervello acceso ogni messaggio va al modello; se Groq non risponde (errore, 429,
// JSON rotto anche col modello di riserva, cervello spento per emergenza no) l'unica risposta è «Sono momentaneamente non
// disponibile, riprova tra un minuto.» e il menu NON cambia: nessuna riserva a regole. Più i vincoli puri del validatore R.
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {diff,sectionDiff} from './eval/judge.js'
import {brainSql} from './eval/adapters/new-bot.js'
import {FIXTURES,initialMenu} from './eval/fixtures/menus.js'
import {copy} from '../apps/server/src/lib/twilio-menu-copy.js'
import {isAffirmative,undoRequested,cleanDraft,deleteScopeProblem,referenceAsTarget,moveTargetProblem,nameWithTail,decideTurn,lostClauses,politeRequest} from '../apps/server/src/lib/owner-brain-r.js'
import type {Conversation} from './eval/types.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
type Mode='503'|'429'|'json'|'timeout'
let mode:Mode='503',calls=0
const fake:any={mode:'fake',stats:{},maxTokens:0,pace:async()=>{},setConversation:()=>{},spentToday:()=>0,
 async handle(){calls++;const ok=(content:string)=>new Response(JSON.stringify({choices:[{message:{content}}],usage:{prompt_tokens:1,completion_tokens:1}}),{status:200,headers:{'Content-Type':'application/json'}})
  const r=mode==='503'?new Response('{"error":{}}',{status:503}):mode==='429'?new Response('{"error":{}}',{status:429,headers:{'retry-after':'60'}}):mode==='json'?ok('questo non è JSON'):(()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'})})()
  return{response:r,hit:false,miss:false,tokens:0,ms:0}}}

describe('fase R: Groq non risponde → solo «non disponibile», nessuna modifica (R1.3)',()=>{
 const bot=createRouteBot({name:'r',settings:{botBrain:true,botEngine:'groq'/* storico Groq: dal 21/10 il default è haiku (PIANO bot-haiku §1.5) */},extraSql:brainSql})
 const conv=(text:string):Conversation=>({id:'r-'+text,family:'manuel',menu:'qa',turns:[{text},{text:'sì'}],changes:[]})
 for(const m of ['503','429','json','timeout'] as Mode[])for(const text of ['la carbonara a 13','elimina boh','annulla','nascondi boh e metti la parmigiana a 12','ciao'])it(`${m}: «${text}»`,async()=>{
  mode=m;calls=0;installNet(fake,realFetch);const menu=initialMenu('qa'),run=await bot.run(conv(text),structuredClone(menu),{restaurant:FIXTURES.qa!.restaurant})
  for(const t of run.turns){expect(t.reply).toContain(copy.brainDown);expect(t.reply.replace(copy.aiDisclosure,'').replace(copy.brainDown,'').trim()).toBe('')}
  expect(diff(menu,run.finalMenu)).toEqual([]);expect(sectionDiff(menu,run.finalMenu)).toEqual([])
  expect(run.pending).toBeUndefined();expect(calls).toBeGreaterThan(0)})
})

describe('fase R: vincoli del server sugli strumenti e sul piano (R2.2)',()=>{
 const refs=[{id:'a',name:'Tiramisù',price:6,available:true,hidden:false,menu:'M',section:'Dolci',sectionId:'s1'},{id:'b',name:'Carbonara',price:12,available:true,hidden:false,menu:'M',section:'Primi',sectionId:'s2'},{id:'c',name:'boh',price:20,available:true,hidden:false,menu:'M',section:'Primi',sectionId:'s2'},{id:'d',name:'Gricia',price:11,available:true,hidden:false,menu:'M',section:'Primi',sectionId:'s2'}] as any[]
 const sections=[{id:'s1',name:'Dolci',menu:'M'},{id:'s2',name:'Primi',menu:'M'}] as any[]
 it('conferma esplicita: solo messaggi di sola conferma',()=>{
  for(const t of ['sì','si','ok','OK grazie','sì eliminalo','cancella pure','va bene','conferma','procedi','👍 ok'])expect(isAffirmative(t),t).toBe(true)
  for(const t of ['sicuro?','no','sì ma prima mettilo a 7','la carbonara','ok la carbonara a 14','forse','sì la seconda','dai'])expect(isAffirmative(t),t).toBe(false)})
 it('annulla solo se chiesto nel messaggio',()=>{for(const t of ['annulla','anzi no','torna indietro','rimetti com\'era','ho sbagliato','no aspetta'])expect(undoRequested(t),t).toBe(true);for(const t of ['la carbonara a 13','sì','nascondi boh'])expect(undoRequested(t),t).toBe(false)})
 const dec=(raw:any,control:any[],pend:any,undoOK=true,message='sì',plan:any={type:'clarify',ids:[]})=>decideTurn({decision:{intent:raw.intent,plan,notes:[],exclude:[]},control,raw,message,pend,undoOK,sections,refs})
 it('confirm_pending: niente proposta → rifiuto; riepilogo con messaggio non di conferma → rifiuto; con altre azioni → rifiuto',()=>{
  expect(dec({intent:'change',actions:[{action:'confirm_pending'}]},['confirm_pending'],null).kind).toBe('reject')
  const batch={kind:'batch',actions:[{kind:'delete',id:'a'}],why:'delete'}
  expect(dec({intent:'change',actions:[{action:'confirm_pending'}]},['confirm_pending'],batch,true,'la carbonara a 13').kind).toBe('reject')
  expect(dec({intent:'change',actions:[{action:'confirm_pending'},{action:'delete_item',item:'p2'}]},['confirm_pending'],batch,true,'sì').kind).toBe('reject')
  expect(dec({intent:'change',actions:[{action:'confirm_pending'}]},['confirm_pending'],batch,true,'sì eliminalo').kind).toBe('confirm')})
 it('undo_last: scaduto, non chiesto o con altre azioni → rifiuto',()=>{
  expect(dec({intent:'change',actions:[{action:'undo_last'}]},['undo_last'],null,false,'annulla').kind).toBe('reject')
  expect(dec({intent:'change',actions:[{action:'undo_last'}]},['undo_last'],null,true,'la carbonara a 13').kind).toBe('reject')
  expect(dec({intent:'change',actions:[{action:'undo_last'},{action:'set_price',item:'p1',price:3}]},['undo_last'],null,true,'annulla').kind).toBe('reject')
  expect(dec({intent:'change',actions:[{action:'undo_last'}]},['undo_last'],null,true,'annulla').kind).toBe('undo')})
 it('eliminare solo i piatti nella portata del verbo',()=>{
  expect(deleteScopeProblem('togli boh ed elimina il tiramisù',[{kind:'delete',id:'a'},{kind:'delete',id:'c'}] as any,refs)).toEqual(['c'])
  expect(deleteScopeProblem('elimina la carbonara e la gricia',[{kind:'delete',id:'b'},{kind:'delete',id:'d'}] as any,refs)).toEqual([])
  expect(deleteScopeProblem('elimina la carbonara e la gricia mettila a 9',[{kind:'delete',id:'b'},{kind:'delete',id:'d'}] as any,refs)).toEqual(['d'])})
 it('«uguale alla X» non cambia X; spostamenti solo nella categoria detta; nomi senza code; parti perse per parte',()=>{
  expect(referenceAsTarget('mettila uguale alla carbonara',[{kind:'price',id:'b',price:11}] as any,refs)).toEqual(['b'])
  expect(moveTargetProblem('sposta la carbonara nei dolci',[{kind:'move',id:'b',sectionId:'s2'}] as any,sections)).toEqual(['b'])
  expect(moveTargetProblem('sposta la carbonara nei dolci',[{kind:'move',id:'b',sectionId:'s1'}] as any,sections)).toEqual([])
  for(const n of ['Crudi per favore','Gricia romana se puoi','Linguine grazie mille'])expect(nameWithTail(n),n).toBe(true);for(const n of ['Crudi','Gricia romana','Pasta e fagioli'])expect(nameWithTail(n),n).toBe(false)
  expect(lostClauses('aggiungi la parmigiana a 10 e togli bo',[{kind:'price',id:'b',price:10}] as any,refs)).toEqual(['togli bo'])})
 it('bozza: mai «fatto» senza scrittura, mai numeri inventati; richieste cortesi non sono domande',()=>{
  expect(cleanDraft('Fatto, ho messo la carbonara a 13.',{wrote:false,numbers:[13]})).toBeNull()
  expect(cleanDraft('Fatto.',{wrote:true,numbers:[]})).toBe('Fatto.')
  expect(cleanDraft('Quanto costa la lasagna, 12 euro?',{wrote:false,numbers:[]})).toBeNull()
  expect(cleanDraft('Elimino il tiramisù dal menu? Rispondi sì.',{wrote:false,numbers:[]})).toBe('Elimino il tiramisù dal menu? Rispondi sì.')
  for(const t of ['potresti inserire la lasagna a 11 nei primi per favore','mi aggiungi la lasagna a 13?'])expect(politeRequest(t),t).toBe(true)
  for(const t of ['quanto costa la lasagna?','puoi dirmi i prezzi?'])expect(politeRequest(t),t).toBe(false)})
})

// R5.1 (18/10): la conferma la decide il MODELLO (confirm_pending) in qualunque forma; il server la blocca solo se il messaggio
// la contraddice (negazione, numeri, altra azione, un piatto nominato). Niente lista chiusa di frasi.
import {confirmBlocked} from '../apps/server/src/lib/owner-brain-r.js'
describe('fase R: conferma decisa dal modello (R5.1)',()=>{
 const refs=[{name:'Tiramisù'},{name:'boh'},{name:'Carbonara'}]
 it('frasi libere di accordo passano',()=>{for(const t of ['va bene così','ok vai','sì sì','certo','confermo','procedi','sì','OK grazie','sì toglilo','sì, eliminalo pure','perfetto, vai','dai fallo','sì va benissimo così'])expect(confirmBlocked(t,refs),t).toBe(false)})
 it('negazioni, numeri, altre azioni o piatti nominati non confermano',()=>{for(const t of ['no','no aspetta','anzi no','sì ma la carbonara a 13','togli boh','ok ma tranne il tiramisù','nascondi boh','metti 12','lascia stare','sì però non il tiramisù','annulla'])expect(confirmBlocked(t,refs),t).toBe(true)})
})
