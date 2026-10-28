// Chat di Luisa del 28/10/2026 18:59–19:22 (Victoria Bar): quattro tentativi di rifare il Menu Cena. Dopo «elimina secondi» il bot perdeva
// il sottomenu e metteva i piatti per portata in Primi/Contorni; «tagliolini cozze e pomodori» diventava «Fagiolini cozze» + «Pomodori»;
// «Mandami menù sera» chiedeva sempre quale menu; i vocali «mandami menù cena da stampare» non davano il PDF; il PDF chiesto mentre un
// inserimento era in lavorazione partiva prima della sua conferma. Testi SINTETICI sulla copia della struttura di Victoria
// (tests/fixtures/victoria-struttura-1023.json: solo nomi/prezzi/sottomenu). Route vero, DB e modello finti: ogni scrittura è del server.
import {afterAll,describe,expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-28T17:59:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {brainSql,resetBrainTables} from './eval/adapters/new-bot.js'
import {createFakeHaiku,A,P,Q,code,type Planner,type FakeCtx} from './eval/fake-haiku.js'
import {ruleTurn,parseInsert,type RuleMenu} from '../apps/server/src/lib/owner-brain-svuota.js'
import {pdfIntent} from '../apps/server/src/lib/twilio-menu-nlu.js'
import {menusIn} from '../apps/server/src/lib/owner-brain-svuota.js'
import {splitPieces} from '../apps/server/src/lib/dish-split.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {catalogOf} from '../apps/server/src/lib/owner-brain-eval.js'
import type {Conversation,EvalMenu,Turn} from './eval/types.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const plainT=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()

// ---------------- copia della struttura di Victoria ----------------
const STRUCT=JSON.parse(readFileSync(new URL('./fixtures/victoria-struttura-1023.json',import.meta.url),'utf8')) as any[]
let n=0;const id=(p:string)=>p+'-5555-4555-8555-'+String(++n).padStart(12,'0')
function victoria():EvalMenu{n=0
 return{menus:STRUCT.map(m=>{const sections=m.sections.map((s:any)=>({id:id('7c000000'),name:s.name,items:s.items.map(([nm,price,h]:[string,number,boolean?])=>({id:id('5c000000'),name:nm,price,...(h?{hidden:true}:{})}))}))
  return{id:id('6c000000'),name:m.name,type:m.type,...(m.pricing==='fisso'?{pricing:'fisso',formulas:m.formulas.map((f:any)=>({id:id('5d000000'),name:f.name,price:f.price,note:f.note,sectionIds:f.secs.map((i:number)=>sections[i].id),translations:{}}))}:{}),sections}}) as any,design:{}}}
const W0=workspaceSchema.parse(victoria()),CAT=catalogOf(W0)
const MENUS:RuleMenu[]=(W0.menus as any[]).map(m=>({id:m.id,name:m.name,pricing:m.pricing==='fisso'?'fisso':'carta',formulas:(m.formulas??[]).map((f:any)=>({id:f.id,name:f.name,price:Number(f.price)}))}))
const M=(w:any,name:string)=>w.menus.find((m:any)=>m.name===name)
const secItems=(w:any,menu:string,sec:string)=>M(w,menu).sections.find((s:any)=>s.name===sec).items.filter((i:any)=>!i.hidden).map((i:any)=>i.name)
const allItems=(w:any)=>JSON.stringify(w.menus.map((m:any)=>[m.name,m.sections.map((s:any)=>[s.name,s.items.map((i:any)=>i.name+':'+i.price+(i.hidden?':h':''))])]))
const shape=(w:any)=>JSON.stringify(w.menus.map((m:any)=>({name:m.name,pricing:m.pricing??null,formulas:(m.formulas??[]).map((f:any)=>[f.name,f.price]),sections:m.sections.map((s:any)=>s.name)})))


// ---------------- route ----------------
Object.assign(process.env,{JWT_SECRET:'j'.repeat(48),WEB_ORIGIN:'https://takoitalia.com'})
// il locale serve il PDF (attivo, non in prova): nel DB finto del route manca la riga
const sqlPdf=(t:string,p:unknown[])=>t.startsWith('SELECT active,settings FROM restaurants')?[{active:true,settings:{timezone:'Europe/Rome'}}]:brainSql(t,p)
const base:Planner=c=>{const m=plainT(c.message);if(/^(?:annulla|annulla l ultima)$/.test(m))return P('change',[A('undo_last')],'Ok, annullo.');return P('chat',[],'MODELLO')}
async function play(turns0:(Turn|string)[],planner:Planner=base,o:{slowMs?:number}={}){const turns=turns0.map(t=>typeof t==='string'?{text:t}:t) as Turn[]
 const fake=createFakeHaiku(planner),slow=o.slowMs?{...fake,handle:async(u:string,i:any)=>{await new Promise(r=>setTimeout(r,o.slowMs));return fake.handle(u,i)}}:fake
 installNet(null,realFetch,slow as any);resetBrainTables();process.env.ANTHROPIC_API_KEY='eval-anthropic-key'
 const c:Conversation={id:'luisa-1028',family:'manuel',menu:'victoria',turns,changes:[]}
 const run=await createRouteBot({name:'haiku',settings:{botBrain:true,botEngine:'haiku'},extraSql:sqlPdf}).run(c,structuredClone(victoria()),{restaurant:'Victoria (copia)'})
 return{replies:run.turns.map(t=>t.reply.replace(/^Sono l.*?persona\.\s*/s,'')),menus:[workspaceSchema.parse(victoria()),...run.turns.map(t=>t.menuAfter as any)] as any[]}}
const last=(r:{menus:any[]})=>r.menus[r.menus.length-1]
const CENA=(w:any,sec:string)=>secItems(w,'Menu Cena',sec)
const PDF_CENA=/Ecco il PDF da stampare: \*Menu Cena\*/
const SECS=CAT.sections.filter(s=>s.menu==='Menu Cena')

// ======================= 1) sottomenu appena svuotato = contesto dell'inserimento =======================
describe('1) «elimina secondi» → «inserisci …» senza sottomenu: tutto nei Secondi',()=>{
 it('con le virgole: i quattro piatti nei Secondi, subito; Primi e Contorni intatti',async()=>{
  const r=await play(['Elimina secondi menù sera','inserisci impepata di cozze, fritto di anelli con verdure, scaloppine al vino bianco, nodino alla griglia'])
  expect(r.replies[0]).toMatch(/Ora scrivimi i piatti nuovi/);expect(r.replies[0]).not.toMatch(/Cosa inserisco/)
  expect(CENA(r.menus[2],'Secondi')).toEqual(['Impepata di cozze','Fritto di anelli con verdure','Scaloppine al vino bianco','Nodino alla griglia'])
  for(const s of ['Primi','Contorni'])expect(CENA(r.menus[2],s)).toEqual(CENA(r.menus[0],s))
  expect(r.replies[1]).toMatch(/\*Secondi\*/);expect(r.replies[1]).not.toMatch(/\*Primi\*|\*Contorni\*/)})
 it('la chat vera senza virgole: proposta tutta nei Secondi, nessuna scrittura; «sì» li scrive lì',async()=>{
  const r=await play(['Elimina secondi menù sera','Inserisci impepata di cozze Fritto di anelli di totani con verdure  Scaloppine al vino bianco Nodino alla griglia','sì'])
  expect(r.replies[1]).toMatch(/^Ho capito così, nei \*Secondi\* del \*Menu Cena\*/);expect(allItems(r.menus[2])).toBe(allItems(r.menus[1]))
  expect(CENA(r.menus[3],'Secondi')).toEqual(['Impepata di cozze','Fritto di anelli di totani con verdure','Scaloppine al vino bianco','Nodino alla griglia'])
  for(const s of ['Primi','Contorni'])expect(CENA(r.menus[3],s)).toEqual(CENA(r.menus[0],s))})
 it('il sottomenu detto prevale sul contesto',async()=>{
  const r=await play(['Elimina secondi menù sera','nei contorni inserisci zucchine trifolate'])
  expect(CENA(r.menus[2],'Contorni')).toEqual([...CENA(r.menus[0],'Contorni'),'Zucchine trifolate']);expect(CENA(r.menus[2],'Secondi')).toEqual([])})
 it('mai il contesto di un altro Menu: «nel menu del giorno inserisci …» non va nei Secondi della Cena',async()=>{
  const r=await play(['Elimina secondi menù sera','nel menu del giorno nei secondi inserisci tagliata'])
  expect(CENA(r.menus[2],'Secondi')).toEqual([]);expect(secItems(r.menus[2],'Menu Giorno','Secondi')).toContain('Tagliata')})
 it('contesto scaduto (oltre 10 minuti): nessun riuso, nessuna scrittura per portata',async()=>{
  const r=await play(['Elimina secondi menù sera',{wait:15} as any,'inserisci nodino alla griglia, scaloppine al vino bianco'])
  const w=last(r);expect(CENA(w,'Secondi')).toEqual([]);expect(allItems(w)).toBe(allItems(r.menus[1]))})
 it('un comando diverso dopo lo svuotamento non diventa un piatto e il contesto resta del nuovo sottomenu',async()=>{
  const r=await play(['Elimina secondi menù sera','Elimina tutti i contorni menù sera','inserisci insalata mista, patate al forno'])
  expect(CENA(r.menus[2],'Contorni')).toEqual([]);expect(CENA(r.menus[3],'Contorni')).toEqual(['Insalata mista','Patate al forno']);expect(CENA(r.menus[3],'Secondi')).toEqual([])})})

// ======================= 2) la «e» non divide «tagliolini cozze e pomodori»; nomi mai corretti =======================
describe('2) «tagliolini cozze e pomodori» = un piatto, con il nome scritto',()=>{
 it('lettura pura',()=>{const W='tagliolini cozze e pomodori'.split(' ');expect(splitPieces(W,{section:'Primi'},true)).toHaveLength(1)
  expect(parseInsert('nei primi inserisci tagliolini cozze e pomodori',SECS,MENUS,CAT.refs.map(r=>r.name),{ask:true}).lists[0]!.names).toEqual(['tagliolini cozze e pomodori'])})
 it('route: creato intero e invariato (mai «Fagiolini»), nient’altro',async()=>{
  const r=await play(['Elimina primi menù sera','inserisci tagliolini cozze e pomodori'])
  expect(CENA(r.menus[2],'Primi')).toEqual(['Tagliolini cozze e pomodori']);expect(r.replies[1]).not.toMatch(/fagiolini|pomodorini/i)})
 it('nomi nuovi mai corretti sul vocabolario del locale («pancetta», «tagliolini» restano)',async()=>{
  const r=await play(['nel menu cena nei primi inserisci tagliolini al ragù, orecchiette broccoli e pancetta'])
  expect(CENA(r.menus[1],'Primi')).toEqual([...CENA(r.menus[0],'Primi'),'Tagliolini al ragù','Orecchiette broccoli e pancetta'])})})

// ======================= 3) elenco ambiguo senza virgole: chiarimento, zero scritture =======================
describe('3) elenco senza virgole ambiguo: proposta breve, nessuna scrittura',()=>{
 it('confini indovinati dentro un sottomenu',async()=>{
  const r=await play(['Elimina primi menù sera','Inserisci tagliolini cozze e pomodori  Gnocchi sorrentina orecchiette broccoli e pancetta'])
  expect(r.replies[1]).toMatch(/Ho capito così/);expect(r.replies[1]).toMatch(/separati da una virgola/);expect(r.replies[1]).not.toMatch(/aggiornato/)
  expect(allItems(r.menus[2])).toBe(allItems(r.menus[1]))
  expect(r.replies[1]).toMatch(/• Tagliolini cozze e pomodori\n• Gnocchi sorrentina\n• Orecchiette broccoli e pancetta/)})
 it('sottomenu indovinati per portata (nessun sottomenu detto, nessun contesto): proposta, nessuna scrittura',async()=>{
  const r=await play(['nel menu cena inserisci nodino alla griglia, insalata mista'])
  expect(r.replies[0]).toMatch(/Ho capito così/);expect(allItems(r.menus[1])).toBe(allItems(r.menus[0]))})
 it('«no» alla proposta: niente cambiato',async()=>{
  const r=await play(['Elimina primi menù sera','Inserisci gnocchi sorrentina orecchiette broccoli e pancetta','no'])
  expect(allItems(r.menus[3])).toBe(allItems(r.menus[1]));expect(r.replies[2]).toMatch(/non ho cambiato nulla/i)})})

// ======================= 4) «menù sera» = «menù cena» anche per il PDF =======================
describe('4) PDF: «mandami menù sera» e «mandami menù cena» danno lo stesso Menu',()=>{
 const pub=(W0.menus as any[]),ms=pub.map(m=>({id:m.id,name:m.name})),alias=(t:string)=>menusIn(t,pub).map((m:any)=>m.id),cena=pub.find(m=>m.name==='Menu Cena').id
 it('lettura pura (stessa risoluzione delle modifiche)',()=>{
  for(const t of ['Mandami menù sera','Mandami menù cena','mandami il menu di stasera','Mandami menù cena da stampare','manda mi il menù serale'])expect(pdfIntent(t,ms,[],{alias}),t).toEqual({menuIds:[cena]})
  expect(pdfIntent('Mandami menù da stampare',ms,[],{alias})).toEqual({ask:ms.map(m=>m.name)})
  expect(pdfIntent('mandami anteprima',ms,[],{alias,current:cena})).toEqual({menuIds:[cena]})
  expect(pdfIntent('mandami anteprima',ms,[],{alias})).toEqual({ask:ms.map(m=>m.name)})})
 it('route: stesso PDF, nessuna domanda, nessuna modifica',async()=>{
  const r=await play(['Mandami menù sera','Mandami menù cena'])
  for(const x of r.replies)expect(x).toMatch(PDF_CENA)
  expect(r.replies[0]).not.toMatch(/Quale menu/);expect(allItems(last(r))).toBe(allItems(r.menus[0]))})})

// ======================= 5) testo e vocale: stessa gestione PDF/anteprima =======================
describe('5) PDF/anteprima: scritto e vocale uguali, nessuna modifica ai piatti',()=>{
 const cases=['mandami menù cena da stampare','Mandami menù cena','Manda mi anche prima menù cena','mandami l’anteprima del menu cena']
 it('ogni frase, scritta e detta: PDF del Menu Cena',async()=>{
  for(const t of cases){const r=await play([t,{voice:t} as any])
   expect(r.replies[0],t).toMatch(PDF_CENA);expect(r.replies[1],t).toMatch(PDF_CENA)
   expect(r.replies[1]).not.toMatch(/Non ho cambiato nulla|MODELLO/)
   expect(allItems(last(r))).toBe(allItems(r.menus[0]))}})
 it('«mandami anteprima» senza nome: il Menu della conversazione; senza conversazione chiede quale',async()=>{
  const a=await play(['Elimina secondi menù sera','mandami anteprima',{voice:'mandami anteprima'} as any])
  expect(a.replies[1]).toMatch(PDF_CENA);expect(a.replies[2]).toMatch(PDF_CENA)
  const b=await play(['mandami anteprima',{voice:'mandami anteprima'} as any])
  for(const x of b.replies)expect(x).toMatch(/Quale menu ti mando in PDF/)})
 it('il vocale del PDF non tocca il contesto: dopo, «inserisci …» va ancora nei Secondi',async()=>{
  const r=await play(['Elimina secondi menù sera',{voice:'mandami menù cena da stampare'} as any,'inserisci tagliata, orata al forno'])
  expect(r.replies[1]).toMatch(PDF_CENA);expect(CENA(r.menus[3],'Secondi')).toEqual(['Tagliata','Orata al forno'])})})

// ======================= 6) messaggi ravvicinati: ordine e niente doppioni =======================
describe('6) messaggi consecutivi: contesto e conferme in ordine, nessun doppione',()=>{
 it('una modifica in lavorazione e subito «mandami menù cena»: prima la conferma, poi il PDF, una volta ciascuno',async()=>{
  const pl:Planner=c=>{if(/margherita/i.test(c.message))return P('change',[A('set_price',{item:code(c,'Margherita'),price:8})],'Ok, la Margherita a 8 €.');return base(c)}
  const r=await play(['la margherita a 8',{text:'Mandami menù cena',overlapMs:20} as any],pl,{slowMs:150})
  const out=r.replies[0]+'\n'+r.replies[1],iConf=out.search(/Margherita/),iPdf=out.search(PDF_CENA)
  expect(iConf).toBeGreaterThanOrEqual(0);expect(iPdf).toBeGreaterThan(iConf)
  expect((out.match(new RegExp(PDF_CENA.source,'g'))??[]).length).toBe(1);expect((out.match(/prezzo da 7,00 €/g)??[]).length).toBe(1)
  expect(M(last(r),'Alla carta').sections.flatMap((x:any)=>x.items).find((i:any)=>i.name==='Margherita').price).toBe(8)})
 it('senza messaggi in lavorazione il PDF resta immediato (nella risposta, non in fila)',async()=>{
  const r=await play(['Mandami menù cena']);expect(r.replies[0]).toMatch(PDF_CENA)})
 it('quattro giri di fila come nella chat: ogni sottomenu col suo contesto, mai piatti in sottomenu sbagliati',async()=>{
  const r=await play(['Elimina primi menù sera','inserisci tagliolini cozze e pomodori, gnocchi sorrentina, orecchiette broccoli e pancetta',
   'Elimina secondi menù sera','inserisci impepata di cozze, fritto di anelli con verdure, scaloppine al vino bianco, nodino alla griglia',
   'Elimina tutti i contorni menù sera','inserisci insalata mista, zucchine trifolate, patate al forno','Mandami menù sera'])
  const w=last(r)
  expect(CENA(w,'Primi')).toEqual(['Tagliolini cozze e pomodori','Gnocchi sorrentina','Orecchiette broccoli e pancetta'])
  expect(CENA(w,'Secondi')).toEqual(['Impepata di cozze','Fritto di anelli con verdure','Scaloppine al vino bianco','Nodino alla griglia'])
  expect(CENA(w,'Contorni')).toEqual(['Insalata mista','Zucchine trifolate','Patate al forno'])
  expect(r.replies[6]).toMatch(PDF_CENA)
  for(const m of ['Menu Giorno','Alla carta','Drinks'])expect(JSON.stringify(M(w,m))).toBe(JSON.stringify(M(r.menus[0],m)))})})
