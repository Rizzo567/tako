// Prova dal vivo di Manuel sul QA, 21/10 sera (edge v137): «inizialmente sembrava andare bene, poi è diventata super buggata».
// Test DETERMINISTICI (nessun modello): (1) funzioni pure della rete di sicurezza (owner-brain-sera.ts); (2) la conversazione vera
// rigiocata sul route vero col finto Haiku che ripete i piani SBAGLIATI visti quella sera; (3) gli invarianti sulla domanda in sospeso.
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {brainSql,resetBrainTables} from './eval/adapters/new-bot.js'
import {initialMenu} from './eval/fixtures/menus.js'
import {diff} from './eval/judge.js'
import {createFakeHaiku,A,P,Q,code,secCode,type Planner,type FakeCtx} from './eval/fake-haiku.js'
import {yesToAsk,newCommandOverAsk,nextAskSource,askOrigin,parseStructRename,groupCommand,namedMenus,dishCourse,suitableSection,clearCommand,specificQuestion,visibleOnly,uniformTarget} from '../apps/server/src/lib/owner-brain-sera.js'
import type {Conversation,EvalMenu,Turn} from './eval/types.js'
import {haikuChecks} from '../apps/server/src/lib/owner-brain-plan.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const strip=(r:string)=>r.replace(/^Sono l.*?persona\.\s*/s,'')
const T=(s:string):Turn=>({text:s}),V=(s:string):Turn=>({voice:s})
const plainT=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
async function play(turns:Turn[],planner:Planner,menu:EvalMenu=initialMenu('qasera')){
 const fake=createFakeHaiku(planner);installNet(null,realFetch,fake);resetBrainTables();process.env.ANTHROPIC_API_KEY='eval-anthropic-key'
 const c:Conversation={id:'sera',family:'manuel',menu:'qasera',turns,changes:[]}
 const run=await createRouteBot({name:'haiku',settings:{botBrain:true,botEngine:'haiku'},extraSql:brainSql}).run(c,structuredClone(menu),{restaurant:'Tako · Verifica web'})
 const menus=[menu,...run.turns.map(t=>t.menuAfter)]
 return{replies:run.turns.map(t=>strip(t.reply)),menus,d:(n:number)=>diff(menus[n-1]!,menus[n]!),final:run.finalMenu,pending:run.pending as any,calls:fake.calls as {ctx:FakeCtx,proposal:any}[]}}
const item=(w:EvalMenu,name:string)=>w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>({...i,section:s.name,menu:m.name})))).find(i=>i.name===name)
const secOf=(w:EvalMenu,menu:string,name:string)=>w.menus.find(m=>m.name===menu)?.sections.find(s=>plainT(s.name)===plainT(name))

// ---------------------------------------------------------------------------------------------------------------------------
// Menu come lo vede il route (catalogOf) per le funzioni pure.
const W=initialMenu('qasera') as any
const sections=W.menus.flatMap((m:any)=>m.sections.map((s:any)=>({id:s.id,name:s.name,menu:m.name})))
const refs=W.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>({id:i.id,name:i.name,price:i.price,available:i.available!==false,hidden:!!i.hidden,menu:m.name,section:s.name,sectionId:s.id}))))
const fixed=new Set<string>(W.menus[3].sections.map((s:any)=>s.id))
const menus=W.menus.map((m:any)=>({id:m.id,name:m.name,pricing:m.pricing??'carta'}))
const R=(n:string)=>refs.find((r:any)=>r.name===n)

describe('funzioni pure della rete di sicurezza',()=>{
 const ask={question:'Per le Lasagne nel Menu pranzo ti suggerisco Primi. Vuoi che lo crei così?',actions:[{kind:'create_section',newSectionId:'n1',name:'Primi',menuId:'m',menuName:'Menu pranzo'}] as any,draft:{name:'Lasagne',price:null,sectionId:null,sectionName:'Primi'},source:'aggiungi nel menu pranzo le lasagne',ids:[] as string[]}
 it('(a) «sì / ok / esatto / sì voglio chiamarlo primi» = sì alla proposta; correzioni, numeri e nomi diversi no',()=>{
  for(const t of ['si','sì','ok','esatto','sì voglio chiamarlo primi','si voglio chiamarlo Primi','ok crealo','va bene','sì grazie','certo, crealo pure','perfetto'])expect(yesToAsk(t,ask),t).toBe(true)
  for(const t of ['no','sì ma chiamalo Paste','si a 12','chiamalo Secondi','no aspetta','si però nei secondi','ok anzi no','aumenta tutti i primi di 1 euro'])expect(yesToAsk(t,ask),t).toBe(false)})
 it('(b) comando nuovo sopra una domanda in sospeso: chiude la domanda; le risposte restano risposte',()=>{
  const a1={question:'Come vuoi chiamare il Sottomenu nel Menu pranzo per le Lasagne: Primi?',source:'aggiungi nel menù pranzo le lasagne',ids:[] as string[]}
  for(const t of ['aumenta tutti i primi di 1 euro','aggiungi gnocchi al ragu in menu pranzo a 10','No vabbè fa niente, voglio che aggiungi nel menù pranzo le lasagne','nascondi il tiramisù','metti la carbonara a 12'])expect(newCommandOverAsk(t,a1,refs),t).toBe(true)
  for(const t of ['si','primi','chiamalo primi','nei primi crealo','sì voglio chiamarlo primi','no, chiamalo Paste','Tu come mi consiglieresti di chiamare il sottomenù?','mettilo nei primi','a 12','solamente pasta al pesto e carbonara'])expect(newCommandOverAsk(t,a1,refs),t).toBe(false)
  const a2={question:'Intendi tutte e cinque le paste a 9 €? Rispondi sì oppure dimmi quali.',source:'Ok, adesso metti tutte le paste a 9 euro',ids:['x']}
  expect(newCommandOverAsk('No, no, diminuisci il prezzo solamente a quelle là che sono visibili',a2,refs)).toBe(false)
  expect(newCommandOverAsk('solamente pasta al pesto e carbonara',a2,refs)).toBe(false)
  expect(newCommandOverAsk('Cambia il nome del menù, da menù di verifica a menù di prova',a2,refs)).toBe(true)})
 it('source: al massimo «richiesta originale + ultima risposta», mai accumulato',()=>{
  let prev:any=null;const msgs=['aggiungi nel menù pranzo le lasagne','Tu come mi consiglieresti di chiamare il sottomenù?','si','si','si voglio chiamarlo primi','aumenta tutti i primi di 1 euro']
  for(const m of msgs){const n=nextAskSource(prev,m);prev={source:n.source,origin:n.origin,rounds:n.rounds};expect(n.source.split(' \n ').length).toBeLessThanOrEqual(2);expect(n.origin).toBe('aggiungi nel menù pranzo le lasagne')}
  expect(prev.rounds).toBe(6);expect(askOrigin({source:'a \n b \n c'})).toBe('a');expect(nextAskSource(null,'x'.repeat(2000)).source.length).toBe(600)})
 it('rinomina di Menu e Sottomenu letta dal server',()=>{
  expect(parseStructRename('Cambia il nome del menù, da menù di verifica a menù di prova',menus,sections)).toMatchObject({kind:'rename_menu',menuId:W.menus[0].id,name:'Menu di prova'})
  expect(parseStructRename('rinomina il menu pranzo in Pranzo veloce',menus,sections)).toMatchObject({kind:'rename_menu',menuId:W.menus[1].id,name:'Pranzo veloce'})
  expect(parseStructRename('cambia il nome del sottomenu Completo in Primi piatti',menus,sections)).toMatchObject({kind:'rename_section',sectionId:W.menus[1].sections[0].id,name:'Primi piatti'})
  expect(parseStructRename('rinomina il sottomenu primi in Paste',menus,sections)).toEqual({ask:'sottomenu_ambiguo'})
  expect(parseStructRename('rinomina il sottomenu primi del menu cena in Paste',menus,sections)).toMatchObject({kind:'rename_section',sectionId:W.menus[2].sections[0].id})
  expect(parseStructRename('rinomina il menu pranzo in Menu cena',menus,sections)).toEqual({ask:'nome_doppio'})
  expect(parseStructRename('rinomina la carbonara in Carbonara romana',menus,sections)).toBeNull()
  expect(parseStructRename('metti la carbonara a 12',menus,sections)).toBeNull()})
 it('gruppo intero: «tutte le paste a 9» (solo con prezzo, mai menu fissi), «aumenta tutti i primi di 1 euro», «solo i visibili»',()=>{
  const g:any=groupCommand('Ok, adesso metti tutte le paste a 9 euro',refs,sections,fixed,{menus})
  expect(g.actions.map((a:any)=>refs.find((r:any)=>r.id===a.id).name).sort()).toEqual(["Pasta al pesto e lasagna","pasta al pesto","pasta al ragù","pasta all'amatriciana","pasta alla norma","pasta carbonara"])
  expect(g.actions.every((a:any)=>a.price===9)).toBe(true);expect(uniformTarget(g.actions)).toBe(9)
  const v:any=groupCommand('metti tutte le paste visibili a 9',refs,sections,fixed,{menus});expect(v.actions.some((a:any)=>refs.find((r:any)=>r.id===a.id).hidden)).toBe(false)
  const p:any=groupCommand('aumenta tutti i primi di 1 euro',refs,sections,fixed,{menus})
  expect(p.actions.map((a:any)=>[refs.find((r:any)=>r.id===a.id).name,a.price])).toEqual([['la parmigiana',16],['pasta al pesto',12],['pasta carbonara',11],['riso giallo',9],["pasta all'amatriciana",12],['pasta alla norma',11]])
  // Primi con prezzo in due Menu alla carta e nessun Menu detto → una domanda sola.
  const two=[...refs,{id:'zz',name:'Risotto',price:12,available:true,hidden:false,menu:'Menu cena',section:'Primi',sectionId:W.menus[2].sections[0].id}]
  expect(groupCommand('aumenta tutti i primi di 1 euro',two,sections,fixed,{menus})).toMatchObject({ask:'menu'})
  expect((groupCommand('aumenta tutti i primi del menu cena di 1 euro',two,sections,fixed,{menus}) as any).actions).toEqual([{kind:'price',id:'zz',price:13}])
  expect(groupCommand('metti la carbonara a 9',refs,sections,fixed,{menus})).toBeNull()})
 it('Menu nominato, portata del piatto, sottomenu adatto',()=>{
  expect(namedMenus('aggiungi gnocchi al ragu in menu pranzo a 10',menus).map(m=>m.name)).toEqual(['Menu pranzo'])
  expect(namedMenus('nel menù del giorno',menus).map(m=>m.name)).toEqual(['Menu del giorno'])
  expect(namedMenus('cambia il nome del menu di verifica',menus).map(m=>m.name)).toEqual(['Menu di verifica · web QA'])
  expect(dishCourse('Lasagne')).toBe('Primi');expect(dishCourse('Gnocchi al ragù')).toBe('Primi');expect(dishCourse('Cotoletta')).toBe('Secondi');expect(dishCourse('xyz')).toBeNull()
  expect(suitableSection('Menu pranzo','Lasagne',sections)).toBeNull();expect(suitableSection('Menu cena','Lasagne',sections)?.name).toBe('Primi')})
 it('comando chiaro e domanda specifica al posto di «Non ho cambiato nulla»',()=>{
  for(const t of ['aumenta tutti i primi di 1 euro','aggiungi gnocchi al ragu in menu pranzo a 10','la parmigiana passa a 12.50'])expect(clearCommand(t),t).toBe(true)
  for(const t of ['si','no','grazie','annulla','ok','no lascia stare'])expect(clearCommand(t),t).toBe(false)
  expect(specificQuestion('aumenta i primi',[])).toMatch(/«aumenta i primi»/);expect(specificQuestion('la pasta a 10',[R('pasta al pesto'),R('pasta carbonara')])).toMatch(/numero/)
  expect(visibleOnly('diminuisci il prezzo solamente a quelle là che sono visibili')).toBe(true)})
})

// ---------------------------------------------------------------------------------------------------------------------------
// La conversazione vera. Il finto Haiku ripete i piani SBAGLIATI di quella sera dove il modello sbagliava.
const LIVE:Planner=c=>{const m=plainT(c.message)
 if(/parmigiana passa/.test(m))return P('change',[A('set_price',{item:code(c,'la parmigiana'),price:12.5})],'Ok, la *parmigiana* a 12,50 €.')
 if(/ha detto la parmigiana/.test(m))return P('read',[],'La *parmigiana* è a 12,50 €.',{item_refs:[code(c,'la parmigiana')]})
 if(/tutte le paste a 9/.test(m))return Q('Intendi tutte e cinque le paste a *9 €*? Rispondi sì oppure dimmi quali.',c.items.filter(i=>/pasta/i.test(i.name)&&!i.hidden).map(i=>i.code))
 if(/visibili/.test(m))return Q('Intendi tutte e cinque le paste visibili a *9 €*? Rispondi *tutte* oppure dimmi quali.',c.items.filter(i=>/pasta/i.test(i.name)&&!i.hidden).map(i=>i.code))
 if(/pasta al pesto e carbonara/.test(m))return P('change',[A('set_price',{item:code(c,'pasta al pesto'),price:9}),A('set_price',{item:code(c,'pasta carbonara'),price:9})],'Ok, metto a 9 € la pasta al pesto e la carbonara.')
 if(/cambia il nome del menu/.test(m))return P('chat',[],'Non ho un comando per rinominare un Menu. Vuoi che ti indichi come farlo dal pannello?')
 if(/aggiungi nel menu pranzo le lasagne/.test(m))return P('clarify',[A('create_item',{name:'Lasagne'})],'Ok, in quale Sottomenu del *Menu pranzo* metto le *Lasagne*?',{clarify:{question:null,item_refs:[],missing:['section','price']}})
 if(/consiglieresti/.test(m))return Q('Per le Lasagne nel *Menu pranzo* ti suggerisco *Primi*: è il nome più chiaro per i clienti. Vuoi che lo crei così?')
 if(/^si voglio chiamarlo primi$/.test(m))return P('chat',[],'Il sottomenu *Primi* c’è già nel *Menu pranzo*.')
 if(/^si$/.test(m))return Q('Intendi il Sottomenu *Primi* nel *Menu pranzo* per le *Lasagne*? Rispondi sì oppure dimmi il nome.')
 if(/aumenta tutti i primi di 1 euro/.test(m))return Q('',['Che ne sacc','la parmigiana','pasta al pesto','pasta carbonara','riso giallo'].map(n=>code(c,n)!))
 if(/gnocchi al ragu in menu pranzo/.test(m))return P('change',[A('set_price',{item:code(c,'Gnocchi al ragù'),price:10})],'Ok, gnocchi al ragù a 10 €.')
 return P('chat',[],'Ok.')}
const LIVE_TURNS=[V('La parmigiana passa a 12.50.'),V('No, ha detto la parmigiana.'),V('Ok, adesso metti tutte le paste a 9 euro.'),V('No, no, diminuisci il prezzo solamente a quelle là che sono visibili.'),T('solamente pasta al pesto e carbonara'),
 V('Cambia il nome del menù, da menù di verifica a menù di prova.'),V('No vabbè fa niente, voglio che aggiungi nel menù pranzo le lasagne.'),V('Tu come mi consiglieresti di chiamare il sottomenù?'),T('si'),T('si'),T('si voglio chiamarlo primi'),T('aumenta tutti i primi di 1 euro'),T('aggiungi gnocchi al ragu in menu pranzo a 10')]

describe('la conversazione vera di quella sera, col finto Haiku che sbaglia come quella sera',()=>{
 it('ogni punto della lista è corretto e gli invarianti tengono',async()=>{
  const r=await play(LIVE_TURNS,LIVE),f=r.final
  if(process.env.TAKO_SERA_SHOW)r.replies.forEach((x,i)=>process.stderr.write(`T${i+1} ${JSON.stringify(x)}\n   ${r.d(i+1).join(', ')}\n`))
  // 1. la parmigiana a 12,50
  expect(r.d(1)).toEqual(['price|la parmigiana|12.5'])
  // 3. «tutte le paste a 9» si applica subito, testo del server con «annulla»
  expect(r.d(3).length).toBe(6);expect(r.replies[2]).toMatch(/^Messi a 9,00 € i prezzi di 6 piatti\./);expect(r.replies[2]).toMatch(/annulla/)
  // 4. «solo quelle visibili»: le paste nascoste tornano come prima
  expect(r.d(4).sort()).toEqual(["price|pasta all'amatriciana|11","price|pasta alla norma|10"])
  // 6. rinomina del Menu, mai «non ho un comando»
  expect(f.menus[0]!.name).toBe('Menu di prova');expect(r.replies[5]).toMatch(/ora si chiama \*Menu di prova\*/);expect(r.replies.join('\n')).not.toMatch(/non ho un comando|dal pannello/i)
  // 7. «fa niente, aggiungi nel menù pranzo le lasagne»: il server propone il sottomenu Primi (nessuna scrittura)
  expect(r.d(7)).toEqual([]);expect(r.replies[6]).toMatch(/creo il sottomenu \*Primi\*/)
  // 9. «sì» = sottomenu Primi creato nel Menu pranzo, poi la domanda del prezzo (mai la stessa domanda di prima)
  expect(secOf(r.menus[9]!,'Menu pranzo','Primi')).toBeTruthy();expect(r.replies[8]).toMatch(/A che prezzo/)
  // 10–11: nessuna domanda uguale due volte di fila, mai «Non ho cambiato nulla.» da solo
  for(let i=1;i<r.replies.length;i++){const a=r.replies[i-1]!.split('\n\n')[0]!,b=r.replies[i]!.split('\n\n')[0]!;if(/\?/.test(b))expect(plainT(a)===plainT(b),`turni ${i}/${i+1}`).toBe(false)}
  // 12. «aumenta tutti i primi di 1 euro»: aumento uniforme sui Primi con prezzo (nessun «Che ne sacc», nessun «Non ho cambiato nulla»)
  expect(r.replies[11]).toMatch(/^Aumentati di 1,00 €/);expect(r.replies[11]).not.toMatch(/Che ne sacc|Non ho cambiato nulla/);expect(r.d(12).length).toBe(6)
  // 13. il Menu nominato vince: Gnocchi al ragù creati nel Menu pranzo (Primi) a 10, il piatto del Menu del giorno resta com'era
  const g=f.menus.find(m=>m.name==='Menu pranzo')!.sections.flatMap(s=>s.items.map(i=>({...i,section:s.name}))).find(i=>/gnocchi/i.test(i.name))
  expect(g).toMatchObject({price:10,section:'Primi'});expect(f.menus.find(m=>m.name==='Menu del giorno')!.sections[0]!.items.find(i=>i.name==='Gnocchi al ragù')!.price).toBe(0)
  // source mai accumulato: ogni proposta vista dal modello ha al massimo «richiesta + risposta»
  for(const c of r.calls)if(c.proposal?.kind==='brain_ask')expect(String(c.proposal.source).split(' \n ').length).toBeLessThanOrEqual(2)
  expect(r.replies.join('\n')).not.toMatch(/categori/i)},30000)
})

// ---------------------------------------------------------------------------------------------------------------------------
describe('invarianti sulla domanda in sospeso (route vero, finto Haiku)',()=>{
 it('(a) «sì» a una proposta con azioni pronte le applica subito, senza chiamare il modello',async()=>{
  // Il modello propone Primi con la bozza delle Lasagne a 12: «sì» crea sottomenu e piatto insieme.
  const pl:Planner=c=>/lasagne/.test(plainT(c.message))?Q('Nel Menu pranzo creo il sottomenu *Primi* per le *Lasagne*?'):P('chat',[],'Ok.')
  const r=await play([T('aggiungi le lasagne nel menu pranzo a 12'),T('sì voglio chiamarlo primi')],pl)
  expect(r.d(1)).toEqual([]);const p=secOf(r.final,'Menu pranzo','Primi');expect(p).toBeTruthy();expect(p!.items.map(i=>[i.name,i.price])).toEqual([['Lasagna',12]])
  expect(r.calls.length).toBe(1)})
 it('(a) «sì» due volte di fila non rifà la stessa domanda (prezzo mancante: domanda con parole nuove, poi si chiude)',async()=>{
  const pl:Planner=c=>/lasagne/.test(plainT(c.message))?Q('Ok, in quale sottomenu?'):Q('A che prezzo metto le *Lasagne*?')
  const r=await play([T('aggiungi nel menu pranzo le lasagne'),T('si'),T('si'),T('si')],pl)
  expect(secOf(r.final,'Menu pranzo','Primi')).toBeTruthy()
  for(let i=1;i<r.replies.length;i++)expect(plainT(r.replies[i]!.split('\n\n')[0]!)).not.toBe(plainT(r.replies[i-1]!.split('\n\n')[0]!))})
 it('(b) un comando nuovo chiude la domanda in sospeso ed è eseguito da solo (il source non lo assorbe)',async()=>{
  const pl:Planner=c=>{const m=plainT(c.message);if(/lasagne/.test(m))return Q('In quale sottomenu del Menu pranzo metto le Lasagne?')
   if(/tiramisu a 7/.test(m))return c.pending?Q('In quale sottomenu metto le Lasagne?'):P('change',[A('set_price',{item:code(c,'tiramisù'),price:7})],'Ok.')
   return P('chat',[],'Ok.')}
  const r=await play([T('aggiungi nel menu pranzo le lasagne a 12'),T('metti il tiramisù a 7')],pl)
  expect(r.d(2)).toEqual(['price|tiramisù|7']);expect(r.calls.at(-1)!.ctx.pending).toBe('');expect(r.pending).toBeFalsy()})
 it('la stessa domanda non parte mai due volte di fila, anche se il modello insiste',async()=>{
  const pl:Planner=c=>Q('Quale pasta intendi?',c.items.filter(i=>/pasta/i.test(i.name)&&!i.hidden).map(i=>i.code))
  const r=await play([T('la pasta a 10'),T('quella buona'),T('boh quella')],pl)
  for(let i=1;i<r.replies.length;i++)expect(plainT(r.replies[i]!.split('\n\n')[0]!)).not.toBe(plainT(r.replies[i-1]!.split('\n\n')[0]!))
  for(const x of r.replies)expect(x.split('\n\n')[0]).not.toBe('Non ho cambiato nulla.')})
 it('rinomina del Sottomenu e del piatto; «annulla» rimette il nome del Menu',async()=>{
  const pl:Planner=c=>/annulla/.test(plainT(c.message))?P('change',[A('undo_last')],'Annullato.'):/carbonara/.test(plainT(c.message))?P('change',[A('rename_item',{item:code(c,'pasta carbonara'),name:'Carbonara romana'})],'Ok.'):P('chat',[],'Ok.')
  const r=await play([T('cambia il nome del sottomenu Completo in Primi piatti'),T('rinomina il menu pranzo in Pranzo veloce'),T('annulla'),T('rinomina la pasta carbonara in Carbonara romana')],pl)
  expect(secOf(r.menus[1]!,'Menu pranzo','Primi piatti')).toBeTruthy();expect(r.menus[2]!.menus[1]!.name).toBe('Pranzo veloce');expect(r.menus[3]!.menus[1]!.name).toBe('Menu pranzo')
  expect(item(r.final,'Carbonara romana')).toBeTruthy();expect(r.replies[1]).toMatch(/annulla/)})
 it('«aggiungi X nel menu pranzo» con X già in un altro Menu: si crea nel Menu nominato (mai il prezzo sul piatto del Menu fisso)',async()=>{
  const menu=initialMenu('qasera') as any;menu.menus[1].sections.push({id:'7aaaaaaa-7777-4777-8777-000000000099',name:'Primi',items:[]})
  const pl:Planner=c=>P('change',[A('set_price',{item:code(c,'Gnocchi al ragù'),price:10})],'Ok.')
  const r=await play([T('aggiungi gnocchi al ragu in menu pranzo a 10')],pl,menu)
  expect(r.d(1)).toEqual(['create|gnocchi al ragu|10|primi'])})
 it('Menu col solo «Completo»: il piatto non finisce nel sottomenu-formula, si propone Primi; «no, chiamalo X» e il prezzo dopo la domanda completano',async()=>{
  const pl:Planner=c=>/lasagne/.test(plainT(c.message))?P('change',[A('create_item',{name:'Lasagne',price:/12/.test(c.message)?12:null,section:secCode(c,'Completo')})],'Aggiungo le Lasagne nel Completo.'):Q('Quanto costano?')
  const a=await play([T('aggiungi nel menu pranzo le lasagne a 12'),T('no, chiamalo Paste fresche')],pl)
  expect(a.d(1)).toEqual([]);expect(a.replies[0]).toMatch(/creo il sottomenu \*Primi\*/);expect(secOf(a.final,'Menu pranzo','Paste fresche')!.items.map(i=>[i.name.slice(0,6),i.price])).toEqual([['Lasagn',12]])
  const b=await play([T('aggiungi nel menu pranzo le lasagne'),T('si'),T('12')],pl)
  expect(secOf(b.final,'Menu pranzo','Primi')!.items.map(i=>[i.name.slice(0,6),i.price])).toEqual([['Lasagn',12]]);expect(secOf(b.final,'Menu pranzo','Completo')!.items).toEqual([])})
})

// ---------------------------------------------------------------------------------------------------------------------------
// Sessione di modifica dei piatti di oggi («modifichiamo menu pranzo»), fixture prezzofisso (Menu pranzo fisso: Primi, Secondi, Contorni).
const SECS=['primi','secondi','contorni']
const REPL:Planner=c=>{const m=plainT(c.message),acts:any[]=[]
 if(/tiramisu a 7/.test(m))return P('change',[A('set_price',{item:code(c,'Tiramisù'),price:7})],'Ok.')
 for(const s of SECS){const r=new RegExp('\\b'+s+'\\s+(.+?)(?=\\s+(?:'+SECS.join('|')+')\\b|$)').exec(m);if(!r)continue
  const names=r[1]!.split(/\s*,\s*|\s+e\s+/).map(x=>x.trim()).filter(Boolean)
  // correzione «no la carbonara toglila»: il modello rifà la lista del sottomenu senza quel piatto (dal blocco IN SOSPESO)
  acts.push(A('replace_section_items',{section:secCode(c,s.charAt(0).toUpperCase()+s.slice(1),'Menu pranzo'),menu:'Menu pranzo',text:names.join('; ')}))}
 const corr=/toglil[ao]/.test(m)?c.pending.match(/c\d+ Primi = «([^»]*)»/):null
 if(corr){const keep=corr[1]!.split('; ').filter(n=>!m.includes(plainT(n)));acts.push(A('replace_section_items',{section:secCode(c,'Primi','Menu pranzo'),menu:'Menu pranzo',text:keep.join('; ')}))}
 return acts.length?P('change',acts,'Ok.'):Q('Cosa metto?')}
const vis=(w:EvalMenu,sec:string)=>w.menus.find(m=>m.name==='Menu pranzo')!.sections.find(s=>s.name===sec)!.items.filter(i=>!i.hidden).map(i=>i.name).sort()
describe('sessione di modifica dei piatti di oggi',()=>{
 const pf=()=>initialMenu('prezzofisso')
 it('a pezzi: apertura, i primi, poi secondi e contorni → applica tutto insieme con «annulla»',async()=>{
  const r=await play([T('modifichiamo menu pranzo'),T('primi lasagna e carbonara'),T('secondi cotoletta contorni patate al forno')],REPL,pf())
  expect(r.replies[0]).toMatch(/modifichiamo i piatti di oggi/);expect(r.d(1)).toEqual([]);expect(r.d(2)).toEqual([]);expect(r.replies[1]).toMatch(/Secondi|Contorni/)
  expect(vis(r.final,'Primi')).toEqual(['Carbonara','Lasagna']);expect(vis(r.final,'Secondi')).toEqual(['Cotoletta alla milanese']);expect(vis(r.final,'Contorni')).toEqual(['Patate al forno']);expect(r.replies[2]).toMatch(/annulla/)})
 it('tutto in un messaggio: applica subito, nessuna domanda',async()=>{
  const r=await play([T('modifichiamo menu pranzo: primi lasagna secondi polpette contorni insalata mista')],REPL,pf())
  expect(vis(r.final,'Primi')).toEqual(['Lasagna']);expect(vis(r.final,'Secondi')).toEqual(['Polpette al sugo']);expect(r.replies[0]).not.toMatch(/\?/)})
 it('«i secondi e i contorni restano uguali», «sì» alla domanda su ciò che manca, correzione «no, la carbonara toglila»',async()=>{
  const a=await play([T('modifichiamo menu pranzo'),T('primi pasta al pomodoro'),T('i secondi e i contorni restano uguali')],REPL,pf())
  expect(vis(a.final,'Primi')).toEqual(['Pasta al pomodoro']);expect(vis(a.final,'Secondi')).toEqual(vis(pf(),'Secondi'))
  const b=await play([T('modifichiamo menu pranzo'),T('primi lasagna e carbonara'),T('no, la carbonara toglila'),T('sì')],REPL,pf())
  if(process.env.TAKO_SERA_SHOW)b.replies.forEach((x,i)=>process.stderr.write('B'+i+' '+JSON.stringify(x)+' | '+b.d(i+1).join(',')+'\n'))
  expect(vis(b.final,'Primi')).toEqual(['Lasagna']);for(let i=1;i<b.replies.length;i++)expect(plainT(b.replies[i]!)).not.toBe(plainT(b.replies[i-1]!))})
 it('uscita: «annulla» non scrive nulla; un comando nuovo chiude la sessione ed è eseguito da solo',async()=>{
  const a=await play([T('modifichiamo menu pranzo'),T('primi lasagna'),T('annulla')],REPL,pf());expect(diff(pf(),a.final)).toEqual([]);expect(a.pending).toBeFalsy()
  const b=await play([T('modifichiamo menu pranzo'),T('primi lasagna'),T('aumenta il tiramisù di un euro')],c=>/aumenta/.test(plainT(c.message))?P('change',[A('set_price',{item:code(c,'Tiramisù'),price_delta:1})],'Ok.'):REPL(c),pf())
  expect(b.d(3)).toEqual(['price|Tiramisù|7']);expect(b.calls.at(-1)!.ctx.pending).not.toMatch(/sessione/)})
})

describe('casi duri della batteria adv-sera (giro 5)',()=>{
 it('«togli X, per oggi non la facciamo» = solo nascosto (niente «finito» non detto); «i dolci, solo quelli, alzali di 50 centesimi» = gruppo Dolci',()=>{
  const d={intent:'change',plan:{type:'change',actions:[{kind:'hidden',id:'x',value:true},{kind:'available',id:'x',value:false}]},exclude:[],aliasesUsed:[],replyDraft:'',notes:[]}
  expect((haikuChecks(d as any,'togli la diavola dal menu, per oggi non la facciamo') as any).plan.actions).toEqual([{kind:'hidden',id:'x',value:true}])
  expect(haikuChecks(d as any,'la diavola è finita, toglila')).toBeNull()
  const P=initialMenu('prezzofisso') as any,secs=P.menus.flatMap((m:any)=>m.sections.map((x:any)=>({id:x.id,name:x.name,menu:m.name}))),rs=P.menus.flatMap((m:any)=>m.sections.flatMap((x:any)=>x.items.map((i:any)=>({id:i.id,name:i.name,price:i.price,available:true,hidden:!!i.hidden,menu:m.name,sectionId:x.id}))))
  const g:any=groupCommand('i dolci, solo quelli, alzali di 50 centesimi',rs,secs,new Set(P.menus.slice(1).flatMap((m:any)=>m.sections.map((x:any)=>x.id))),{menus:P.menus})
  expect(g.actions.map((a:any)=>[rs.find((r:any)=>r.id===a.id).name,a.price])).toEqual([['Tiramisù',6.5],['Panna cotta',5.5]])
  expect(groupCommand('la panna cotta alzala di 50 centesimi',rs,secs,new Set(),{menus:P.menus})).toBeNull()})
})

describe('regressioni del giro finale (struttura, lunghi, adv150)',()=>{
 it('«aggiungi un nuovo menù che si chiama Brunch» non è una rinomina; percentuali, migliaia e messaggi con più numeri non passano dal gruppo',()=>{
  expect(parseStructRename('aggiungi un nuovo menù che si chiama Brunch',menus,sections)).toBeNull()
  expect(parseStructRename('voglio che aggiungi un nuovo menù che si chiama pranzo e un nuovo menù che si chiama cena',menus,sections)).toBeNull()
  expect(parseStructRename('il menu pranzo da oggi si chiama Pranzo veloce',menus,sections)).toMatchObject({kind:'rename_menu',name:'Pranzo veloce'})
  expect(groupCommand('tutti i primi più 10%',refs,sections,fixed,{menus})).toBeNull()
  expect(groupCommand('metti la carbonara a 12,50, la pasta del giorno a 9 euro, poi aumenta tutti i primi di un euro',refs,sections,fixed,{menus})).toBeNull()
  expect(groupCommand('la carbonara a 13.000 e tutti i primi a 9',refs,sections,fixed,{menus})).toBeNull()
  expect(groupCommand('metti tutte le paste a 8,50',refs,sections,fixed,{menus})).not.toBeNull()})
})

// ---------------------------------------------------------------------------------------------------------------------------
// v138 dal vivo (22/10 notte): trascrizioni ESATTE. Il finto modello sbaglia come quella notte; il server deve reggere da solo.
const V138:Planner=c=>{const m=plainT(c.message)
 if(/risoto/.test(m))return Q('Ok, *Lasagna* e *Carbonara* li metto nei *Primi*. Il *Risotto ai funghi* non è nel menu: lo creo come nuovo piatto?')
 if(/tagliata/.test(m))return P('change',[A('replace_section_items',{section:secCode(c,'Primi','Menu del giorno'),menu:'Menu del giorno',text:'Lasagna; Carbonara'}),A('replace_section_items',{section:secCode(c,'Secondi','Menu del giorno'),menu:'Menu del giorno',text:'Cotoletta; Polpette'})],'Ok, aggiorno.')
 if(/toglila/.test(m))return Q('Quale piatto intendi?')
 if(/visibil/.test(m))return Q('Tutte e quattro sono visibili, quindi non posso scegliere solo alcune. Quali intendi?')
 return P('chat',[],'Ok.')}
const visM=(w:EvalMenu,menu:string,sec:string)=>w.menus.find(m=>m.name===menu)!.sections.find(s=>s.name===sec)!.items.filter(i=>!i.hidden).map(i=>i.name).sort()
describe('v138 dal vivo: sessione del Menu del giorno (prezzo fisso) e loop del prezzo',()=>{
 it('S1–S5: i piatti dei turni prima restano, il nuovo nasce a 0 € senza domande, «no la carbonara toglila» è una correzione, niente Contorni',async()=>{
  const r=await play([T('modifichiamo il menu del giorno'),T('primi: lasagne, carbonara e risoto ai funghi'),T('secondi tagliata e polpete al sugo'),T('no la carbonara toglila'),T('i contorni restano uguali')],V138)
  if(process.env.TAKO_SERA_SHOW)r.replies.forEach((x,i)=>process.stderr.write('S'+(i+1)+' '+JSON.stringify(x)+' | '+r.d(i+1).join(',')+'\n'))
  expect(visM(r.final,'Menu del giorno','Primi')).toEqual(['Lasagna','Risotto ai funghi']);expect(visM(r.final,'Menu del giorno','Secondi')).toEqual(['Polpette','Tagliata'])
  for(const x of r.replies)expect(x).not.toMatch(/lo creo come nuovo|mi manca un dettaglio|Non ho cambiato nulla|non posso/i)
  expect(r.replies[4]).toMatch(/Contorni/);expect(r.final.menus.find(m=>m.name==='Menu del giorno')!.sections.flatMap(s=>s.items).filter(i=>/risotto|tagliata/i.test(i.name)).every(i=>i.price===0)).toBe(true)
  for(let i=1;i<r.replies.length;i++)expect(plainT(r.replies[i]!)).not.toBe(plainT(r.replies[i-1]!))})
 it('L1–L4: «si», «si», «si voglio chiamarlo primi» dopo la domanda del prezzo: messaggi diversi e chiari, poi la chiusura; «lasagna 12» la crea',async()=>{
  const pl:Planner=c=>/lasagne/.test(plainT(c.message))?Q('Ok, in quale sottomenu?'):P('chat',[],'Ok.')
  const r=await play([V('No vabbè fa niente, voglio che aggiungi nel menù pranzo le lasagne.'),T('si'),T('si'),T('si voglio chiamarlo primi'),T('si')],pl)
  if(process.env.TAKO_SERA_SHOW)r.replies.forEach((x,i)=>process.stderr.write('L'+(i+1)+' '+JSON.stringify(x)+'\n'))
  expect(r.replies[3]).toMatch(/c’è già/);for(const x of r.replies)expect(x).not.toMatch(/Non ho cambiato nulla|già così/)
  for(let i=1;i<r.replies.length;i++){const a=r.replies[i-1]!.replace(/^Sono l.*?persona\.\s*/s,''),b=r.replies[i]!;expect(plainT(b)).not.toBe(plainT(a));if(i>=2&&/prezzo/.test(a))expect(/\?/.test(b)&&/prezzo/.test(b)&&/\?/.test(a)).toBe(false)}
  const k=await play([V('aggiungi nel menù pranzo le lasagne'),T('si'),T('lasagna 12')],pl);expect(secOf(k.final,'Menu pranzo','Primi')!.items.map(i=>[i.name,i.price])).toEqual([['Lasagna',12]])})
 it('M2: «non posso» non arriva mai al titolare',async()=>{
  const r=await play([T('metti tutte le paste visibili a 9'),T('solo le visibili')],V138);for(const x of r.replies)expect(x).not.toMatch(/non posso/i)})
})
describe('lettura deterministica della sessione',()=>{
 it('liste per sottomenu, correzioni, aggiunte, «restano uguali», «pasta e fagioli» un piatto solo, refusi',async()=>{
  const {parseSession,sessionName}=await import('../apps/server/src/lib/owner-brain-sera.js')
  const sc=[{id:'p',name:'Primi',menu:'M'},{id:'s',name:'Secondi',menu:'M'}]
  expect(parseSession('primi: lasagne, carbonara e risoto ai funghi',sc).lists[0]!.names).toEqual(['lasagne','carbonara','risoto ai funghi'])
  expect(parseSession('primi lasagne e pasta e fagioli, secondi cotolleta',sc).lists.map(l=>l.names)).toEqual([['lasagne','pasta e fagioli'],['cotolleta']])
  expect(parseSession('no la carbonara toglila',sc).removes).toEqual(['carbonara'])
  expect(parseSession("no aspetta, l'arrosto no, metti le polpette",sc)).toMatchObject({removes:['arrosto'],adds:[{name:'polpette'}]})
  expect(parseSession('i secondi e i contorni restano uguali',sc).keep).toEqual(['secondi','contorni'])
  const sec=[{id:'1',name:'Cotoletta alla milanese',price:0,available:true,hidden:false,menu:'M',sectionId:'s'},{id:'2',name:'Polpette',price:0,available:true,hidden:true,menu:'M',sectionId:'s'}] as any
  expect(sessionName('cotolleta',sec,[]).name).toBe('Cotoletta alla milanese');expect(sessionName('polpete al sugo',sec,[]).name).toBe('Polpette');expect(sessionName('risoto ai funghi',[],[]).name).toBe('Risotto ai funghi')
  expect(sessionName('gnocchi al ragu 10',[],['Gnocchi al ragù'])).toEqual({name:'Gnocchi al ragù',existing:null,price:10})})
})
