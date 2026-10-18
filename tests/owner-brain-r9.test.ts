// R9 (18/10/2026): bug dal vivo sul QA 12:30–12:32 UTC (tre vocali). «Ora nei primi aggiungi pasta al pesto, pasta al ragù, pasta
// carbonara e riso giallo…» → domanda «c'è già…» (con «Pasta al pesto e lasagna» preso per «pasta al pesto»), poi «Aggiornapure» e
// «Sì sì, aggiornali» → la STESSA domanda all'infinito. I primi tre piani sono quelli VERI di gpt-oss-120b (fixtures/r9-gptoss-plans.json,
// chiave del bot, 12.624 token); i successivi sono scritti a mano per provare i vincoli (il server non decide al posto del modello).
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {readFileSync} from 'node:fs'
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {diff} from './eval/judge.js'
import {brainSql,resetBrainTables} from './eval/adapters/new-bot.js'
import {sameDishName,duplicateCreate,sameQuestion} from '../apps/server/src/lib/owner-brain-r.js'
import type {Conversation} from './eval/types.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const after=JSON.parse(readFileSync(new URL('./eval/fixtures/qa-live-1018-after.json',import.meta.url),'utf8'))
const REAL=JSON.parse(readFileSync(new URL('./eval/fixtures/r9-gptoss-plans.json',import.meta.url),'utf8')) as any[]
let queue:any[]=[];const seen:string[]=[]
const fake:any={mode:'fake',stats:{},maxTokens:0,pace:async()=>{},setConversation:()=>{},spentToday:()=>0,
 async handle(_u:string,init:any){const body=JSON.parse(String(init?.body??'{}'));const isPlan=body?.response_format?.json_schema?.name==='owner_brain_plan',plan=isPlan?queue.shift():null
  if(isPlan)seen.push(String(body.messages.at(-1)?.content??''))
  const content=plan?JSON.stringify(plan):JSON.stringify({intent:'none'})
  return{response:new Response(JSON.stringify({choices:[{message:{content}}],usage:{prompt_tokens:1,completion_tokens:1}}),{status:200,headers:{'Content-Type':'application/json'}}),hit:false,miss:false,tokens:0,ms:0}}}
const B={item:null,section:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}
const P=(o:any)=>({intent:'change',actions:[],read:null,item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:'',...o})
const A=(o:any)=>({...B,...o})
const T1='Ora nei primi aggiungi pasta al pesto, pasta al ragù, pasta carbonara e riso giallo, metti le paste a 10 euro e il riso a 8 euro'
const Q_OK='C’è già pasta al ragù a 20 € (nascosta): la aggiorno a 10 € e la rimetto visibile o ne creo un’altra?'
const T1_FIX=P({intent:'clarify',clarify:{question:null,item_refs:['p4'],missing:[]},actions:[],reply_draft:Q_OK})
const ANSWER=P({actions:[A({action:'set_price',item:'p4',price:10}),A({action:'set_hidden',item:'p4',value:false}),A({action:'create_item',name:'pasta al pesto',price:10,section:'c2'}),A({action:'create_item',name:'pasta carbonara',price:10,section:'c2'}),A({action:'create_item',name:'riso giallo',price:8,section:'c2'})],reply_draft:'Fatto.'})
const strip=(r:string)=>r.replace(/^Sono l.*?persona\.\s*/s,'')
async function conv(turns:{voice?:string,text?:string}[],plans:any[]){queue=structuredClone(plans);seen.length=0;installNet(fake,realFetch);resetBrainTables()
 const c:Conversation={id:'r9',family:'manuel',menu:'qa',turns:turns.map(t=>t.voice!==undefined?{voice:t.voice}:{text:t.text!}),changes:[]}
 const run=await createRouteBot({name:'nuovo',settings:{botBrain:true},extraSql:brainSql}).run(c,structuredClone(after),{restaurant:'Tako · Verifica web'})
 if(process.env.TAKO_R9_SHOW)for(const t of run.turns)process.stderr.write('REPLY '+JSON.stringify(t.reply)+'\n')
 return{turns:run.turns.map(t=>({reply:strip(t.reply),changes:diff(after,t.menuAfter)})),left:queue.length,pending:run.pending as any}}

describe('R9: risposta breve a una domanda in sospeso, doppioni solo a nome uguale',()=>{
 it('stesso piatto solo a nome uguale normalizzato',()=>{
  expect(sameDishName('pasta al ragu','Pasta al ragù')).toBe(true);expect(sameDishName('la parmigiana','Parmigiana')).toBe(true);expect(sameDishName('Pasta  al pesto','pasta al pesto')).toBe(true)
  expect(sameDishName('pasta al pesto','Pasta al pesto e lasagna')).toBe(false)
  expect(duplicateCreate([{kind:'create',sectionId:'s',name:'pasta al pesto',price:10,description:null} as any],[{id:'x',name:'Pasta al pesto e lasagna',price:10.01,available:true,hidden:false,menu:'m'}])).toBe(false)
  expect(sameQuestion('Preferisci aggiornare i prezzi di "pasta al ragù" e "Pasta al pesto e lasagna" o crearne di nuovi?','Preferisci aggiornare i prezzi di "pasta al ragù" e "Pasta al pesto e lasagna" o crearne di nuovi?\n\n1. *pasta al ragù*')).toBe(true)
  expect(sameQuestion('C’è già pasta al ragù a 20 €: lo aggiorno o ne creo un altro?','Rispondi 1 per aggiornare pasta al ragù a 10 €, 2 per crearne una nuova.')).toBe(false)})
 it('12:30 vero: «c’è già pasta al pesto» (nome contenuto) non arriva al titolare; la domanda è solo sul ragù, con le parti in attesa',async()=>{
  const r=await conv([{voice:T1}],[REAL[0],REAL[1],T1_FIX]);const t=r.turns[0]!
  expect(r.left).toBe(0);expect(t.changes).toEqual([])
  expect(t.reply).not.toMatch(/parte di|c.è già "?pasta al pesto/i);expect(t.reply).toMatch(/^C’è già pasta al ragù/)
  expect(t.reply).toMatch(/Non ancora pubblicato:/);expect(t.reply).toMatch(/pasta al pesto/);expect(t.reply).toMatch(/Già nel menu:\n1\. \*pasta al ragù\* \(20,00 €\)/)
  expect(t.reply).not.toMatch(/Pasta al pesto e lasagna/)
  expect(r.pending?.kind).toBe('brain_ask');expect(r.pending.twins.map((x:any)=>x.name)).toEqual(['pasta al ragù']);expect(r.pending.actions.length).toBe(3)
  // La correzione al modello dice chi è davvero doppio e che il nome contenuto si crea.
  expect(seen[1]).toMatch(/STESSO nome solo: «pasta al ragù» \(20,00 €, nascosto\)/);expect(seen[1]).toMatch(/«pasta al pesto» non è «Pasta al pesto e lasagna»/)})
 it('«Aggiornapure» dopo la domanda: il contesto porta la richiesta originale e le opzioni; il piano del modello si pubblica senza un altro OK',async()=>{
  const r=await conv([{voice:T1},{voice:'Aggiornapure'}],[REAL[0],REAL[1],T1_FIX,ANSWER]);const t=r.turns[1]!
  if(process.env.TAKO_R9_SHOW)process.stderr.write("SEEN3 "+seen[3]+"\n");expect(seen[3]).toMatch(/RICHIESTA IN ATTESA DELLA RISPOSTA/);expect(seen[3]).toMatch(/p4 «pasta al ragù» 20 nascosto \(prezzo detto 10\)/);expect(seen[3]).toMatch(/OPZIONI per ognuno/)
  expect(seen[3]).toMatch(/vocale trascritto/)
  expect(t.changes.sort()).toEqual(['create|pasta al pesto|10|primi','create|pasta carbonara|10|primi','create|riso giallo|8|primi','hidden|pasta al ragù|false','price|pasta al ragù|10'].sort())
  expect(t.reply).toMatch(/pasta al ragù\*: prezzo da 20,00 € a \*10,00 €\*/)})
 it('12:31 vero: il piano su «Pasta al pesto e lasagna» (nome diverso) è rifiutato, il modello corregge',async()=>{
  const r=await conv([{voice:T1},{voice:'Aggiornapure'}],[REAL[0],REAL[1],T1_FIX,REAL[2],ANSWER]);const t=r.turns[1]!
  if(process.env.TAKO_R9_SHOW)process.stderr.write("CH "+JSON.stringify(t.changes)+"\n");expect(r.left).toBe(0);expect(t.changes).not.toContain('price|Pasta al pesto e lasagna|10');expect(t.changes).toContain('price|pasta al ragù|10');expect(t.changes).toContain('create|pasta al pesto|10|primi')})
 it('la stessa domanda ripetuta non parte: auto-correzione «il titolare ha già risposto», poi il piano',async()=>{
  const again=P({intent:'clarify',clarify:{question:null,item_refs:['p4'],missing:[]},reply_draft:Q_OK})
  const r=await conv([{voice:T1},{voice:'Sì sì, aggiornali'}],[REAL[0],REAL[1],T1_FIX,again,ANSWER]);const t=r.turns[1]!
  expect(seen[4]).toMatch(/ha già risposto/);expect(t.reply).not.toContain(Q_OK);expect(t.changes).toContain('price|pasta al ragù|10')})
 it('modello testardo: mai la stessa domanda due volte di fila (al massimo 3 chiamate, poi solo i fatti)',async()=>{
  const again=P({intent:'clarify',clarify:{question:null,item_refs:['p4'],missing:[]},reply_draft:Q_OK})
  const r=await conv([{voice:T1},{voice:'Buongiorno a tutti'}],[REAL[0],REAL[1],T1_FIX,again,again,again,again]);const t=r.turns[1]!
  expect(r.left).toBe(1);expect(t.changes).toEqual([]);expect(t.reply).not.toContain(Q_OK);expect(t.reply).toMatch(/pasta al ragù/);expect(seen[5]).toMatch(/opzioni numerate/)})
 it('una domanda diversa con le opzioni numerate al secondo giro passa',async()=>{
  const again=P({intent:'clarify',clarify:{question:null,item_refs:['p4'],missing:[]},reply_draft:Q_OK}),other=P({intent:'clarify',clarify:{question:null,item_refs:['p4'],missing:[]},reply_draft:'Non ho capito il vocale: rispondi 1 per aggiornare la pasta al ragù a 10 €, 2 per crearne un’altra.'})
  const r=await conv([{voice:T1},{voice:'Buongiorno a tutti'}],[REAL[0],REAL[1],T1_FIX,again,other]);const t=r.turns[1]!
  expect(t.reply).toMatch(/^Non ho capito il vocale: rispondi 1/);expect(r.pending?.kind).toBe('brain_ask');expect(r.pending.twins.length).toBe(1)})
 it('confirm_pending su una domanda aperta: il server rimanda al modello (scrivi le azioni della richiesta originale)',async()=>{
  const conf=P({actions:[A({action:'confirm_pending'})],reply_draft:'Fatto.'})
  const r=await conv([{voice:T1},{voice:'sì'}],[REAL[0],REAL[1],T1_FIX,conf,ANSWER]);const t=r.turns[1]!
  expect(seen[4]).toMatch(/TUA domanda aperta/);expect(t.changes).toContain('price|pasta al ragù|10')})
 it('«crea nuovi»: il gemello si crea di nuovo (scelta del titolare), il ragù vecchio resta com’è',async()=>{
  const create=P({actions:[A({action:'create_item',name:'pasta al ragù',price:10,section:'c2'}),A({action:'create_item',name:'pasta al pesto',price:10,section:'c2'}),A({action:'create_item',name:'pasta carbonara',price:10,section:'c2'}),A({action:'create_item',name:'riso giallo',price:8,section:'c2'})],reply_draft:'Fatto.'})
  const r=await conv([{voice:T1},{text:'crea nuovi'}],[REAL[0],REAL[1],T1_FIX,create]);const t=r.turns[1]!
  if(process.env.TAKO_R9_SHOW)process.stderr.write("CH "+JSON.stringify(t.changes)+"\n");expect(t.changes.some(c=>/^create\|pasta al rag[uù]\|10\|primi$/.test(c))).toBe(true);expect(t.changes.some(c=>c.startsWith('price|pasta al ragù'))).toBe(false)})
 it('12:33–12:34 vero: «si» / «confermo» a una domanda sì/no del modello non la rilanciano: confirm_pending rimandato, il piano usa i prezzi della richiesta',async()=>{
  const ask=P({intent:'clarify',clarify:{question:null,item_refs:[],missing:[]},reply_draft:'Vuoi davvero impostare tutti i primi a 11 €?'}),conf=P({actions:[A({action:'confirm_pending'})],reply_draft:'Fatto.'}),plan=P({actions:[A({action:'set_price',item:'p9',price:11})],reply_draft:'Fatto.'})
  const r=await conv([{voice:'Metti i primi tutti a 11 euro'},{text:'si'}],[ask,conf,plan]);if(process.env.TAKO_R9_SHOW)process.stderr.write('CH '+JSON.stringify(r.turns.map(t=>t.changes))+'\n')
  expect(r.turns[0]!.changes).toEqual([]);expect(r.turns[1]!.changes).toEqual(['price|la parmigiana|11']);expect(r.turns[1]!.reply).not.toMatch(/Vuoi davvero/)})
})
