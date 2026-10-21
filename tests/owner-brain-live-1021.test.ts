// Prova dal vivo sul QA (21/10 sera): tre difetti corretti nel codice deterministico, senza modello.
import {describe,expect,it} from 'vitest'
import {planOwnerMessage,validateBrainPlan,restoreDestination,formulaClausesOut,structureActions} from '../apps/server/src/lib/owner-brain-plan.js'
import {decideTurn,uniformDelta,uniformReply,pruneWroteDraft,reasonText} from '../apps/server/src/lib/owner-brain-r.js'

// Locale «tipo QA»: Menu di verifica alla carta, Menu del giorno a prezzo fisso (piatti a 0).
const Q=(n:number)=>'00000000-0000-4000-8000-2'+String(n).padStart(11,'0')
const SEC={vPrimi:Q(1),vProva:Q(2),gPrimi:Q(3),gSecondi:Q(4)}
const qSections=[{id:SEC.vPrimi,name:'Primi',menu:'Menu di verifica'},{id:SEC.vProva,name:'Piatti di prova',menu:'Menu di verifica'},{id:SEC.gPrimi,name:'Primi',menu:'Menu del giorno'},{id:SEC.gSecondi,name:'Secondi',menu:'Menu del giorno'}]
let qn=10;const mk=(name:string,sec:keyof typeof SEC,price=0,hidden=false)=>{const s=qSections.find(x=>x.id===SEC[sec])!;return{id:Q(++qn),name,price,available:true,hidden,menu:s.menu,section:s.name,sectionId:s.id}}
const qRefs=[mk('la parmigiana','vPrimi',15),mk('pasta al pesto','vPrimi',11),mk('pasta carbonara','vPrimi',10),mk('riso giallo','vPrimi',8),mk('tiramisù','vPrimi',5),
 mk('pasta al ragù','vProva',12),mk('pasta al sugo','vProva',9),mk('panna cotta','vProva',5),
 mk('Lasagna','gPrimi'),mk('Carbonara','gPrimi'),mk('Cotoletta','gSecondi'),mk('Polpette','gSecondi')] as any[]
const byName=(n:string)=>qRefs.find(r=>r.name===n)!
const F={completo:Q(901),soloPrimo:Q(902)}
const qMenus=[{id:Q(801),name:'Menu di verifica',sections:2,active:true,pricing:'carta' as const,formulas:[],secs:[{id:SEC.vPrimi,name:'Primi',active:true,parent:null,items:5},{id:SEC.vProva,name:'Piatti di prova',active:true,parent:null,items:3}]},
 {id:Q(802),name:'Menu del giorno',sections:2,active:true,pricing:'fisso' as const,formulas:[{id:F.completo,name:'Completo',price:17},{id:F.soloPrimo,name:'Solo primo',price:9}],secs:[{id:SEC.gPrimi,name:'Primi',active:true,parent:null,items:2},{id:SEC.gSecondi,name:'Secondi',active:true,parent:null,items:2}]}]
const fixedIds=new Set([SEC.gPrimi,SEC.gSecondi])
const code=(id:string)=>'p'+(qRefs.findIndex(r=>r.id===id)+1),scode=(id:string)=>'c'+(qSections.findIndex(s=>s.id===id)+1)
const A=(action:string,o:any={})=>({action,item:null,section:null,menu:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null,...o})
const plan=(intent:string,actions:any[],draft:string,extra:any={})=>({intent,actions,read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:draft,...extra})
const fake=(p:any)=>async()=>new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(p)}],stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1}}),{status:200,headers:{'content-type':'application/json'}})
const run=(p:any,message:string,extra:any={})=>planOwnerMessage({refs:qRefs,sections:qSections,menus:qMenus,message,...extra} as any,'k',{engine:'haiku',fetch:fake(p) as any})

const VOICE='🎤 allora senti eh… nel menu del giorno il solo primo mettilo a 10… poi tra i secondi del menu del giorno aggiungi la frittata di zucchine… e la pasta al sugo… quella nascondila'

const codes=new Map<string,string>([...qSections.map((x,i)=>['c'+(i+1),x.id] as [string,string]),...qRefs.map((r,i)=>['p'+(i+1),r.id] as [string,string])])
const decide=(d:any,message:string)=>decideTurn({decision:d,control:[],raw:d.raw??{intent:d.intent,actions:[]},message,pend:null,undoOK:false,sections:qSections,refs:qRefs,fixedSecIds:fixedIds} as any)

describe('difetto 1 — aumento uniforme: il testo segue il dato',()=>{
 const primi=['la parmigiana','pasta al pesto','pasta carbonara','riso giallo'].map(byName)
 const up=primi.map(r=>({kind:'price',id:r.id,price:r.price+1}) as any)
 it('stessa differenza su più piatti = aumento uniforme (la risposta la compone il server)',()=>{
  expect(uniformDelta(up,qRefs)).toBe(1)
  expect(uniformDelta(primi.map(r=>({kind:'price',id:r.id,price:r.price-0.5}) as any),qRefs)).toBe(-0.5)
  expect(uniformDelta([up[0]],qRefs)).toBeNull()
  expect(uniformDelta([up[0],{kind:'price',id:primi[1]!.id,price:primi[1]!.price+2}] as any,qRefs)).toBeNull()
  expect(uniformDelta([...up,{kind:'hidden',id:byName('panna cotta').id,value:true}] as any,qRefs)).toBeNull()
  const t=uniformReply(1,4,'*la parmigiana*: prezzo da 15,00 € a *16,00 €*')
  expect(t).toMatch(/^Aumentati di 1,00 € i prezzi di 4 piatti\./);expect(t).toMatch(/la parmigiana/)
  expect(t).not.toMatch(/riepilogo|prima di pubblicare|categori|lascio fuori/i)
  expect(uniformReply(-0.5,2,'')).toBe('Abbassati di 0,50 € i prezzi di 2 piatti.')
 })
 it('la bozza dal vivo («Ti mostro il riepilogo…», «la parmigiana… la lascio fuori») non passa sopra una scrittura',()=>{
  const live='Aumento di un euro i piatti dei *Primi* del *Menu di verifica* che hanno un prezzo: *la parmigiana* e *pasta al ragù* li lascio fuori perché non sono nei Primi. Ti mostro il riepilogo prima di pubblicare.'
  expect(pruneWroteDraft(live,up,qRefs)).toBeNull()
  // Restano le frasi vere; un «escluso» che davvero non è stato toccato resta.
  expect(pruneWroteDraft('Aumento di un euro i Primi. Ti mostro il riepilogo prima di pubblicare.',up,qRefs)).toBe('Aumento di un euro i Primi.')
  expect(pruneWroteDraft('Aumento i Primi. La *panna cotta* la lascio fuori.',up,qRefs)).toBe('Aumento i Primi. La *panna cotta* la lascio fuori.')
 })
})

describe('difetto 2 — «rimetti X nei <sottomenu>» è uno spostamento, «rimetti com\'era» un ripristino',()=>{
 // Il tiramisù è appena stato spostato nei Primi del Menu di verifica e il suo prezzo abbassato (da 6 a 5): il modello usa restore.
 const tir=byName('tiramisù'),restorable=new Map([[tir.id,[{kind:'price',id:tir.id,price:6}]]]) as any
 const raw=plan('change',[A('restore',{item:code(tir.id)})],'Ok, rimetto il tiramisù com\'era prima nel sottomenu Primi.')
 const vb=(message:string)=>validateBrainPlan(JSON.stringify(raw),{codes},{refs:qRefs,sections:qSections,message,restorable,fixedSecIds:fixedIds,menus:qMenus} as any)
 it('«rimetti il tiramisù nei Piatti di prova del Menu di verifica» → spostamento, il prezzo non cambia',()=>{
  const d=vb('rimetti il tiramisù nei Piatti di prova del Menu di verifica')
expect(d.intent).toBe('change');expect((d.plan as any).actions).toEqual([expect.objectContaining({kind:'move',id:tir.id,sectionId:SEC.vProva})])
  expect((d.plan as any).actions.some((a:any)=>a.kind==='price')).toBe(false);expect(d.notes).toContain('ripristino_come_spostamento')
  expect(decide({...d,raw},'rimetti il tiramisù nei Piatti di prova del Menu di verifica').kind).toBe('change')
  // Se il modello usa già move_item con «rimetti», il validatore lo accetta (prima: parte persa «rimetti» → domanda → restore).
  const mv=validateBrainPlan(JSON.stringify(plan('change',[A('move_item',{item:code(tir.id),section:scode(SEC.vProva)})],'')),{codes},{refs:qRefs,sections:qSections,message:'rimetti il tiramisù nei Piatti di prova del Menu di verifica',fixedSecIds:fixedIds,menus:qMenus} as any)
  expect(mv.intent).toBe('change');expect((mv.plan as any).actions).toEqual([expect.objectContaining({kind:'move',id:tir.id,sectionId:SEC.vProva})])
  // Anche «riportalo tra i piatti di prova», senza Menu detto: il sottomenu è uno solo.
  expect((vb('riporta il tiramisù tra i piatti di prova').plan as any).actions).toEqual([expect.objectContaining({kind:'move',sectionId:SEC.vProva})])
 })
 it('«rimetti il tiramisù com\'era» (nessuna destinazione) e «…nei Primi» (dove sta già) restano un ripristino',()=>{
  for(const m of ['rimetti il tiramisù com\'era','rimetti il tiramisù come prima','rimetti il tiramisù com\'era nei primi del menu di verifica']){
   const d=vb(m);expect(d.intent).toBe('change');expect((d.plan as any).actions).toEqual([expect.objectContaining({kind:'price',id:tir.id,price:6})]);expect(d.notes).not.toContain('ripristino_come_spostamento')}
 })
 it('sottomenu di arrivo in più Menu e Menu non detto: preferito quello del Menu del piatto, altrimenti domanda',()=>{
  const pc=byName('panna cotta')
  expect(restoreDestination('rimetti la panna cotta nei primi',pc,qSections)).toBe(SEC.vPrimi)
  expect(restoreDestination('rimetti la panna cotta nei primi del menu del giorno',pc,qSections)).toBe(SEC.gPrimi)
  expect(restoreDestination('rimetti la panna cotta nei primi',{...pc,sectionId:'altrove'},qSections)).toBe('ambiguous')
  expect(restoreDestination('rimetti la panna cotta com\'era',pc,qSections)).toBeNull()
  expect(reasonText(['ripristino_con_destinazione'])).toMatch(/move_item/)
 })
})

describe('difetto 3 — vocale con più richieste e prezzo dell\'opzione detto',()=>{
 const p=plan('change',[A('set_formula_price',{menu:'Menu del giorno',name:'Solo primo',price:10}),A('create_item',{section:scode(SEC.gSecondi),name:'Frittata di zucchine'}),A('set_hidden',{item:code(byName('pasta al sugo').id),value:true})],'Ok.')
 it('«il solo primo mettilo a 10… aggiungi la frittata… la pasta al sugo nascondila» → tre modifiche subito, nessuna domanda',async()=>{
  const d=await run(p,VOICE) as any
  expect(d.intent).toBe('change');expect(d.hold).toBeUndefined();expect(d.notes.some((n:string)=>n.startsWith('parte_persa'))).toBe(false)
  expect(d.plan.actions).toEqual([expect.objectContaining({kind:'set_formula',formulaId:F.soloPrimo,price:10,before:9}),expect.objectContaining({kind:'create',sectionId:SEC.gSecondi,name:'Frittata di zucchine',price:0}),expect.objectContaining({kind:'hidden',id:byName('pasta al sugo').id,value:true})])
  expect(decide(d,VOICE)).toMatchObject({kind:'change'})
 })
 it('la parte dell\'opzione esce dal testo del validatore dei piatti solo se non nomina un piatto',()=>{
  const sf=[{kind:'set_formula',name:'Solo primo',price:10}] as any
  const t=formulaClausesOut(VOICE,sf,qRefs);expect(t).not.toMatch(/10/);expect(t).toMatch(/frittata di zucchine/);expect(t).toMatch(/pasta al sugo/)
  expect(formulaClausesOut('il solo primo e la pasta al sugo a 10',sf,qRefs)).toMatch(/pasta al sugo a 10/)
  expect(formulaClausesOut(VOICE,[],qRefs)).toBe(VOICE)
 })
 it('prezzo dell\'opzione davvero non detto: resta la domanda (mai un prezzo inventato)',()=>{
  expect(structureActions([A('set_formula_price',{menu:'Menu del giorno',name:'Solo primo',price:10})],{message:'nel menu del giorno il solo primo cambialo, poi aggiungi la frittata',sections:qSections,refs:qRefs,menus:qMenus} as any).ask).toBe('prezzo_formula_non_detto')
 })
})
