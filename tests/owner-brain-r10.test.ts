// R10 (18/10/2026): bug dal vivo sul QA 16:05–16:06 UTC. «Togli tutti i piatti dalla sezione altre proposte» → «Quale sezione intendi
// nascondere?» → «Quali piatti…?» → «Non esiste una sezione chiamata "altre proposte"». Le domande sono quelle VERE di gpt-oss
// (tako_owner_brain_turns del QA); i piani successivi sono scritti a mano per provare i vincoli (il server non decide al posto del modello).
// Menu = QA riletto alle 16:10 (fixtures/qa-live-1018-r10.json).
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {readFileSync} from 'node:fs'
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {diff} from './eval/judge.js'
import {brainSql,resetBrainTables} from './eval/adapters/new-bot.js'
import {publicNames,namedSections,allOfSections,unknownSectionPhrase} from '../apps/server/src/lib/owner-brain-sections.js'
import type {Conversation} from './eval/types.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const qa=JSON.parse(readFileSync(new URL('./eval/fixtures/qa-live-1018-r10.json',import.meta.url),'utf8'))
const macro=JSON.parse(readFileSync(new URL('./eval/fixtures/r10-macro.json',import.meta.url),'utf8'))
let queue:any[]=[];const seen:string[]=[],cards:string[]=[]
const fake:any={mode:'fake',stats:{},maxTokens:0,pace:async()=>{},setConversation:()=>{},spentToday:()=>0,
 async handle(_u:string,init:any){const body=JSON.parse(String(init?.body??'{}'));const isPlan=body?.response_format?.json_schema?.name==='owner_brain_plan',plan=isPlan?queue.shift():null
  if(isPlan){seen.push(String(body.messages.at(-1)?.content??''));cards.push(String(body.messages[1]?.content??''))}
  const content=plan?JSON.stringify(plan):JSON.stringify({intent:'none'})
  return{response:new Response(JSON.stringify({choices:[{message:{content}}],usage:{prompt_tokens:1,completion_tokens:1}}),{status:200,headers:{'Content-Type':'application/json'}}),hit:false,miss:false,tokens:0,ms:0}}}
const B={item:null,section:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}
const P=(o:any)=>({intent:'change',actions:[],read:null,item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:'',...o})
const A=(o:any)=>({...B,...o}),Q=(q:string)=>P({intent:'clarify',reply_draft:q})
// Domande vere di gpt-oss alle 16:05–16:06.
const Q1='Quale sezione intendi nascondere?',Q2='Quali piatti vuoi nascondere nella sezione "altre proposte"?',Q3='Non esiste una sezione chiamata "altre proposte". Come vuoi procedere?'
const M1='Togli tutti i piatti dalla sezione altre proposte'
// QA: «Piatti di prova» = c1 (pubblico: Altre proposte); visibili p4 ragù, p6 tiramisù, p7 Pasta al sugo, p8 Pasta al pesto e lasagna.
const HIDE=P({actions:['p4','p6','p7','p8'].map(item=>A({action:'set_hidden',item,value:true})),reply_draft:'Confermi? Rispondi OK per pubblicare.'})
const strip=(r:string)=>r.replace(/^Sono l.*?persona\.\s*/s,'')
async function conv(turns:{voice?:string,text?:string}[],plans:any[],menu=qa){queue=structuredClone(plans);seen.length=0;cards.length=0;installNet(fake,realFetch);resetBrainTables()
 const c:Conversation={id:'r10',family:'manuel',menu:'qa',turns:turns.map(t=>t.voice!==undefined?{voice:t.voice}:{text:t.text!}),changes:[]}
 const run=await createRouteBot({name:'nuovo',settings:{botBrain:true,botEngine:'groq'/* storico Groq: dal 21/10 il default è haiku (PIANO bot-haiku §1.5) */},extraSql:brainSql}).run(c,structuredClone(menu),{restaurant:'Tako · Verifica web'})
 if(process.env.TAKO_R10_SHOW)for(const t of run.turns)process.stderr.write('REPLY '+JSON.stringify(t.reply)+'\n')
 return{turns:run.turns.map(t=>({reply:strip(t.reply),changes:diff(menu,t.menuAfter)})),left:queue.length,pending:run.pending as any}}
const secs=(w:any)=>w.menus.flatMap((m:any)=>{const p=publicNames(m);return m.sections.map((s:any)=>({id:s.id,name:s.name,menu:m.name,pub:p.get(s.id)}))})

describe('R10: nomi pubblici delle sezioni, domande che usano il testo',()=>{
 it('nomi pubblici = stessa logica della pagina pubblica; sezioni nominate anche storpiate; sezione inesistente',()=>{
  const s=secs(macro),pub=Object.fromEntries(s.map((x:any)=>[x.name,x.pub]))
  expect(pub).toMatchObject({'Primi':'Primi','Piatti di prova':'Altre proposte','Sezione da spostare':'Altre proposte','Panini':'Secondi e panini','Carne':'Secondi e panini','Dessert':'Dolci e frutta','Frutta':'Dolci e frutta','Bibite':'Bevande e caffetteria'})
  expect(namedSections('togli tutte le altre propose',s).ids.length).toBe(3);expect(allOfSections(M1,s).length).toBe(3)
  // La sezione di arrivo non è fra quelle di «tutti»; «sposta» non nomina «Sezione da spostare».
  expect(allOfSections('sposta tutti i piatti di dolci e frutta nei primi',s).map(id=>s.find((x:any)=>x.id===id).name).sort()).toEqual(['Dessert','Frutta'])
  expect(unknownSectionPhrase('togli tutti i piatti dalla sezione antipasti',s)).toBe('antipasti');expect(unknownSectionPhrase(M1,s)).toBe(null)})
 it('la scheda del locale mostra il nome pubblico quando il titolare lo usa',async()=>{
  await conv([{voice:M1}],[HIDE]);expect(cards[0]).toMatch(/# c1 Piatti di prova \(pubblico: Altre proposte\)/);expect(cards[0]).toMatch(/# c2 Primi$/m)})
 it('16:05 vero: «Quale sezione intendi nascondere?» non parte: motivo «ha già detto», poi il riepilogo dei 4 piatti da confermare',async()=>{
  const r=await conv([{voice:M1},{text:'ok'}],[Q(Q1),HIDE,P({actions:[A({action:'confirm_pending'})],reply_draft:'Fatto.'})]);const t=r.turns[0]!
  expect(seen[1]).toMatch(/il titolare ha già detto: la sezione «Altre proposte» \(= «Piatti di prova»\)/);expect(t.reply).not.toContain(Q1)
  expect(t.changes).toEqual([]);expect(t.reply).toMatch(/Non ancora pubblicato, da confermare con OK:\n1\. \*pasta al ragù\*: \*nascosto\*/)
  expect(r.turns[1]!.changes.sort()).toEqual(['hidden|Pasta al pesto e lasagna|true','hidden|Pasta al sugo|true','hidden|pasta al ragù|true','hidden|tiramisù|true'])})
 it('16:06 vero: «Quali piatti…?» dopo «tutti i piatti nella sezione altre proposte» e «Non esiste una sezione…» non partono',async()=>{
  const r=await conv([{voice:'tutti i piatti nella sezione altre proposte'}],[Q(Q2),Q(Q3),HIDE]);const t=r.turns[0]!
  expect(seen[1]).toMatch(/ha già detto: «tutti» i piatti di «Altre proposte»/);expect(seen[2]).toMatch(/che esiste: è il nome nel menu digitale delle sezioni «Piatti di prova»/)
  expect(t.reply).not.toMatch(/Quali piatti|Non esiste/);expect(t.reply).toMatch(/da confermare con OK/)})
 it('«tutti i piatti» solo dopo una domanda in sospeso sulla sezione: vale la sezione della richiesta di prima',async()=>{
  const r=await conv([{voice:M1},{voice:'tutti i piatti'}],[Q(Q1),Q(Q1),Q(Q1),Q(Q2),HIDE]);if(process.env.TAKO_R10_SHOW)process.stderr.write(JSON.stringify(seen.map(x=>x.slice(0,160)))+'\n')
  expect(r.turns[0]!.reply).not.toContain(Q1);expect(r.turns[1]!.reply).not.toMatch(/Quali piatti|Quale sezione/);expect(r.turns[1]!.reply).toMatch(/da confermare con OK/)})
 it('modello testardo: dopo 3 chiamate la domanda che ignora il testo non parte comunque',async()=>{
  const r=await conv([{voice:M1}],[Q(Q1),Q(Q1),Q(Q1),Q(Q1)]);expect(r.left).toBe(1);expect(r.turns[0]!.reply).not.toContain(Q1);expect(r.turns[0]!.changes).toEqual([])})
 it('«tutti» su un sottoinsieme: rifiutato con l’elenco dei piatti mancanti',async()=>{
  const two=P({actions:['p4','p6'].map(item=>A({action:'set_hidden',item,value:true})),reply_draft:'Fatto.'})
  const r=await conv([{voice:M1}],[two,HIDE]);expect(seen[1]).toMatch(/mancano: «Pasta al sugo», «Pasta al pesto e lasagna»/);expect(r.turns[0]!.changes).toEqual([]);expect(r.turns[0]!.reply).toMatch(/da confermare con OK/)})
 it('sezione inesistente: «Quale sezione intendi?» è rifiutata, la domanda deve dirlo subito con l’elenco',async()=>{
  const good='Non c’è una sezione «antipasti»: ci sono Piatti di prova (Altre proposte) e Primi. Quale intendi?'
  const r=await conv([{voice:'togli tutti i piatti dalla sezione antipasti'}],[Q('Quale sezione intendi?'),Q(good)]);const t=r.turns[0]!
  expect(seen[1]).toMatch(/nel menu non c’è una sezione «antipasti»: dillo subito .*Piatti di prova \(nel menu digitale: Altre proposte\), Primi/);expect(t.reply).toMatch(/^Non c’è una sezione «antipasti»/);expect(t.changes).toEqual([])})
 it('sezione inesistente e modello che non lo dice mai: la sua domanda resta e il server aggiunge il fatto con l’elenco delle sezioni',async()=>{
  const r=await conv([{voice:'togli tutti i piatti dalla sezione antipasti'}],[Q('Quale sezione intendi?'),Q('Quale sezione intendi?'),Q('Quale sezione intendi?')]);const t=r.turns[0]!
  expect(r.left).toBe(0);expect(t.changes).toEqual([]);expect(t.reply).toMatch(/^Quale sezione intendi\?/);expect(t.reply).toMatch(/Sezioni del menu: Piatti di prova \(nel menu digitale: Altre proposte\), Primi/)})
})
