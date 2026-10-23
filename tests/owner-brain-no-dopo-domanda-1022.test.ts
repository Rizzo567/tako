// QA v153 22/10 (batteria dal vivo, 2ª passata, «vietato-elimina-primi»): «la pasta al sugo è finita» → «è tornata» → «elimina tutti i
// primi» → il modello chiede «Quali primi vuoi eliminare: *Pasta al sugo*, …? 1. … 2. … 3. …» → «no» → il bot rispondeva «*Pasta al
// sugo*: com’era prima» e SCRIVEVA available true→false (annullata l'ultima modifica senza che nessuno lo chiedesse).
// Causa: route (fase 3, QA v149b) — «annulla» su una domanda aperta che nomina un piatto scritto da pochi minuti annulla anche quella
// scrittura; il controllo usava undoRequested(), che accetta anche un «no» secco. Difetto già presente in v151 (72dcad41).
// Regola: un «no»/rifiuto a una domanda aperta non scrive e non annulla MAI; l'annullo solo su richiesta esplicita.
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {brainSql,resetBrainTables} from './eval/adapters/new-bot.js'
import {initialMenu} from './eval/fixtures/menus.js'
import {diff} from './eval/judge.js'
import {createFakeHaiku,A,P,Q,code,type Planner} from './eval/fake-haiku.js'
import {explicitUndoRequested,undoRequested,decideTurn} from '../apps/server/src/lib/owner-brain-r.js'
import type {Conversation,EvalMenu,Turn} from './eval/types.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const strip=(r:string)=>r.replace(/^Sono l.*?persona\.\s*/s,'')
const T=(s:string):Turn=>({text:s})
const plainT=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
async function play(turns:Turn[],planner:Planner,menu:EvalMenu=initialMenu('qasera')){
 const fake=createFakeHaiku(planner);installNet(null,realFetch,fake);resetBrainTables();process.env.ANTHROPIC_API_KEY='eval-anthropic-key'
 const c:Conversation={id:'no-dopo-domanda',family:'manuel',menu:'qasera',turns,changes:[]}
 const run=await createRouteBot({name:'haiku',settings:{botBrain:true,botEngine:'haiku'},extraSql:brainSql}).run(c,structuredClone(menu),{restaurant:'Tako · Verifica web'})
 const menus=[menu,...run.turns.map(t=>t.menuAfter)]
 return{replies:run.turns.map(t=>strip(t.reply)),menus,d:(n:number)=>diff(menus[n-1]!,menus[n]!)}}
const item=(w:EvalMenu,name:string)=>w.menus.flatMap(m=>m.sections.flatMap(s=>s.items)).find(i=>i.name===name)

// Piano del modello fissato: finito/tornato = set_available; «elimina tutti i primi» = domanda a opzioni numerate (nessuna azione);
// «no» = chat «Ok, lascio stare.»; «annulla» = undo_last.
const pl:Planner=c=>{const m=plainT(c.message)
 if(/e finita/.test(m))return P('change',[A('set_available',{item:code(c,'Pasta al sugo'),value:false})],'Ok, segno la *Pasta al sugo* come esaurita.')
 if(/e tornata/.test(m))return P('change',[A('set_available',{item:code(c,'Pasta al sugo'),value:true})],'Ok, rimetto la *Pasta al sugo* disponibile.')
 if(/elimina tutti i primi/.test(m))return Q('Quali primi vuoi eliminare: *Pasta al sugo*, *Pasta al pesto* o *Pasta carbonara*? 1. *Pasta al sugo* (9,00 €) 2. *pasta al pesto* (9,00 €) 3. *pasta carbonara* (9,00 €)',[code(c,'Pasta al sugo')!,code(c,'pasta al pesto')!,code(c,'pasta carbonara')!])
 if(/annulla/.test(m))return P('change',[A('undo_last')],'Ok, annullo.')
 return P('chat',[],'Ok, lascio stare.')}

describe('«no» a una domanda aperta dopo una modifica (QA v153 vietato-elimina-primi)',()=>{
 it('undoRequested resta largo, l’annullo esplicito no: «no», «no no», «lascia stare» non sono richieste di annullo',()=>{
  for(const t of ['no','no no','No.','scusa','aspetta','lascia stare','anzi','ho sbagliato','niente'])expect(explicitUndoRequested(t),t).toBe(false)
  for(const t of ['annulla','annullala','torna com’era','torna come prima','rimetti com era','ripristina','torna indietro','annulla l ultima'])expect(explicitUndoRequested(t),t).toBe(true)
  expect(undoRequested('no')).toBe(true)})
 for(const no of ['no','No.','no no','scusa'])it(`«${no}» chiude la domanda: niente scritto, niente annullato`,async()=>{
  const r=await play([T('la pasta al sugo è finita'),T('la pasta al sugo è tornata'),T('elimina tutti i primi'),T(no)],pl)
  expect(item(r.menus[2]!,'Pasta al sugo')!.available).not.toBe(false)
  expect(r.d(3)).toEqual([]);expect(r.replies[2]).toMatch(/Quali primi|In quale Menu|Nel \*.*o nel/) // 23/10: «elimina tutti i primi» in più Menu → la domanda del Menu (server)
  expect(r.d(4),r.replies[3]).toEqual([]);expect(r.replies[3]).not.toMatch(/com.era prima/)
  expect(item(r.menus[4]!,'Pasta al sugo')!.available).not.toBe(false)})
 it('«annulla» esplicito sulla stessa domanda annulla ancora la scrittura appena fatta sullo stesso piatto (fase 3, QA v149b)',async()=>{
  const r=await play([T('la pasta al sugo è finita'),T('la pasta al sugo è tornata'),T('elimina tutti i primi'),T('annulla')],pl)
  expect(r.d(3)).toEqual([]);expect(item(r.menus[4]!,'Pasta al sugo')!.available).toBe(false);expect(r.replies[3]).toMatch(/com.era prima/)})
 it('decideTurn: con una domanda aperta, undo_last del modello su «scusa»/«ho sbagliato» non annulla; su «annulla l’ultima» sì',()=>{
  const pend={kind:'ask',ask:{question:'Quali primi vuoi eliminare?',ids:[],actions:[]}} as any
  const run=(message:string)=>decideTurn({decision:{intent:'change',plan:{type:'change',actions:[]},notes:[],exclude:[]},control:['undo_last'],raw:{intent:'change',actions:[{action:'undo_last'}]},message,pend,undoOK:true,sections:[],refs:[]})
  for(const m of ['scusa','ho sbagliato','anzi','no no'])expect(run(m).kind,m).not.toBe('undo')
  expect(run('torna com’era').kind).toBe('undo')
  // senza domanda aperta il comportamento resta quello di prima («ho sbagliato» subito dopo una scrittura = annulla)
  expect(decideTurn({decision:{intent:'change',plan:{type:'change',actions:[]},notes:[],exclude:[]},control:['undo_last'],raw:{intent:'change',actions:[{action:'undo_last'}]},message:'ho sbagliato',pend:null as any,undoOK:true,sections:[],refs:[]}).kind).toBe('undo')})
})
