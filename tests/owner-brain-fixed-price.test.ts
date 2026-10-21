// Menu a prezzo fisso (21/10): formule, sostituzione giornaliera dei piatti, niente prezzi sui piatti dei menu fissi.
import {describe,expect,it} from 'vitest'
import {structureActions,haikuChecks,replaceSaidPhrase,replaceSaidPhrases} from '../apps/server/src/lib/owner-brain-plan.js'
import {applyActions} from '../apps/server/src/lib/twilio-menu-ai.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'

const U=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const ws=()=>workspaceSchema.parse({menus:[{id:U(1),name:'Menu pranzo',type:'lunch',pricing:'fisso',included:'¼ di vino',formulas:[{id:U(9),name:'Completo',price:12,note:'primo + secondo con contorno',translations:{}}],sections:[
 {id:U(2),name:'Primi',items:[{id:U(3),name:'Carbonara',price:0},{id:U(4),name:'Lasagna',price:0,hidden:true},{id:U(5),name:'Gricia',price:0}]},
 {id:U(6),name:'Secondi',items:[{id:U(7),name:'Cotoletta',price:0}]}]}]})
const menus=[{id:U(1),name:'Menu pranzo',sections:2,active:true,pricing:'fisso' as const,formulas:[{id:U(9),name:'Completo',price:12}],secs:[{id:U(2),name:'Primi',active:true,parent:null,items:3},{id:U(6),name:'Secondi',active:true,parent:null,items:1}]}]
const sections=[{id:U(2),name:'Primi',menu:'Menu pranzo'},{id:U(6),name:'Secondi',menu:'Menu pranzo'}]
const refs=[{id:U(3),name:'Carbonara',price:0,sectionId:U(2),hidden:false},{id:U(4),name:'Lasagna',price:0,sectionId:U(2),hidden:true},{id:U(5),name:'Gricia',price:0,sectionId:U(2),hidden:false},{id:U(7),name:'Cotoletta',price:0,sectionId:U(6),hidden:false}] as any[]
const A=(action:string,o:any={})=>({action,item:null,section:null,menu:null,name:null,price:null,text:null,...o})
const codes=new Map([['c1',U(2)],['c2',U(6)]])

describe('formule',()=>{
 it('«il completo a pranzo passa a 12,50» cambia il prezzo della formula (solo se detto)',()=>{
  const r=structureActions([A('set_formula_price',{menu:'pranzo',name:'Completo',price:12.5})],{message:'il completo a pranzo passa a 12,50',sections,menus,refs})
  expect(r.actions[0]).toMatchObject({kind:'set_formula',formulaId:U(9),price:12.5,before:12})
  const w=ws();applyActions(w,r.actions);expect(workspaceSchema.parse(w).menus[0]!.formulas![0]!.price).toBe(12.5)
  expect(structureActions([A('set_formula_price',{menu:'pranzo',name:'Completo',price:17})],{message:'il completo a pranzo passa a 12',sections,menus,refs}).ask).toBe('prezzo_formula_non_detto')
 })
 it('«aggiungi l\'opzione solo primo a 9» crea la formula',()=>{
  const r=structureActions([A('create_formula',{menu:'pranzo',name:'Solo primo',price:9})],{message:"aggiungi l'opzione solo primo a 9 al pranzo",sections,menus,refs})
  expect(r.actions[0]).toMatchObject({kind:'set_formula',isNew:true,name:'Solo primo',price:9})
  const w=ws();applyActions(w,r.actions);expect(workspaceSchema.parse(w).menus[0]!.formulas!.map(f=>f.name)).toEqual(['Completo','Solo primo'])
 })
})

describe('sostituzione giornaliera dei piatti',()=>{
 it('«oggi primi lasagna e carbonara»: lasagna torna, carbonara resta, gricia nascosta (mai eliminata), nuovi a prezzo 0',()=>{
  const r=structureActions([A('replace_section_items',{section:'c1',menu:'pranzo',text:'Lasagna; Carbonara; Amatriciana'})],{message:'oggi a pranzo primi lasagna, carbonara e amatriciana',sections,menus,refs,codes})
  expect(r.ask).toBeNull()
  const w=ws();applyActions(w,r.actions as any);const p=workspaceSchema.parse(w),primi=p.menus[0]!.sections[0]!
  expect(primi.items.filter(i=>!i.hidden).map(i=>i.name).sort()).toEqual(['Amatriciana','Carbonara','Lasagna'])
  expect(primi.items.find(i=>i.name==='Gricia')!.hidden).toBe(true);expect(primi.items.find(i=>i.name==='Amatriciana')!.price).toBe(0)
  expect(p.menus[0]!.sections[1]!.items[0]!.hidden).toBe(false)
 })
 it('nomi non detti → domanda',()=>{
  expect(structureActions([A('replace_section_items',{section:'c1',menu:'pranzo',text:'Tortellini'})],{message:'oggi a pranzo primi lasagna',sections,menus,refs,codes}).ask).toBe('nome_non_detto')
 })
})

describe('prezzi dei piatti nei menu fissi',()=>{
 it('set_price su un piatto di un menu fisso → domanda',()=>{
  const d={intent:'change' as const,plan:{type:'change' as const,actions:[{kind:'price',id:U(3),price:8}]},exclude:[],aliasesUsed:[],replyDraft:'',notes:[] as string[]}
  expect(haikuChecks(d as any,'la carbonara a 8',sections as any,refs,new Set([U(2),U(6)]))!.notes).toContain('prezzo_piatto_menu_fisso')
 })
})

// ── Banco prezzofisso 21/10 (48/75): correzioni deterministiche, senza modello ───────────────────────────────────────────────
import {validateBrainPlan,planOwnerMessage,replaceCandidates,formulaRead} from '../apps/server/src/lib/owner-brain-plan.js'
import {decideTurn,cleanDraft,claimsWrite,reasonText,draftOfUnappliedChange,draftAsksOkOnDate,HIDE_WHOLE_MENU_Q,fixedDishFact} from '../apps/server/src/lib/owner-brain-r.js'
import {validateMenuPlan,describeAction,plain} from '../apps/server/src/lib/twilio-menu-ai.js'

// Locale «tipo Victoria»: Alla carta con prezzi, Menu pranzo e Menu cena a prezzo fisso (piatti a 0).
const V=(n:number)=>'00000000-0000-4000-8000-1'+String(n).padStart(11,'0')
const SEC={acPrimi:V(1),prPrimi:V(2),prSecondi:V(3),prContorni:V(4),cePrimi:V(5),ceContorni:V(6)}
const vSections=[{id:SEC.acPrimi,name:'Primi',menu:'Alla carta'},{id:SEC.prPrimi,name:'Primi',menu:'Menu pranzo'},{id:SEC.prSecondi,name:'Secondi',menu:'Menu pranzo'},{id:SEC.prContorni,name:'Contorni',menu:'Menu pranzo'},{id:SEC.cePrimi,name:'Primi',menu:'Menu cena'},{id:SEC.ceContorni,name:'Contorni',menu:'Menu cena'}]
let vn=10;const mk=(name:string,sec:keyof typeof SEC,price=0,hidden=false)=>{const s=vSections.find(x=>x.id===SEC[sec])!;return{id:V(++vn),name,price,available:true,hidden,menu:s.menu,section:s.name,sectionId:s.id}}
const vRefs=[mk('Carbonara','acPrimi',12),mk('Amatriciana','acPrimi',11),mk('Pasta al pomodoro','prPrimi'),mk('Pasta e fagioli','prPrimi',0,true),mk('Risotto alla milanese','prPrimi'),
 mk('Cotoletta alla milanese','prSecondi'),mk('Petto di pollo ai ferri','prSecondi'),mk('Polpette al sugo','prSecondi'),mk('Patate al forno','prContorni'),
 mk('Gnocchi al pomodoro','cePrimi'),mk('Tagliatelle al ragù','cePrimi'),mk('Patatine fritte','ceContorni'),mk('Verdure grigliate','ceContorni')] as any[]
const byName=(n:string)=>vRefs.find(r=>r.name===n)!
const F={prCompleto:V(901),ceCompleto:V(902),ceSoloPrimo:V(903)}
const vMenus=[{id:V(801),name:'Alla carta',sections:1,active:true,pricing:'carta' as const,formulas:[],secs:[{id:SEC.acPrimi,name:'Primi',active:true,parent:null,items:2}]},
 {id:V(802),name:'Menu pranzo',sections:3,active:true,pricing:'fisso' as const,included:'¼ di vino',formulas:[{id:F.prCompleto,name:'Completo',price:12}],secs:[{id:SEC.prPrimi,name:'Primi',active:true,parent:null,items:3},{id:SEC.prSecondi,name:'Secondi',active:true,parent:null,items:3},{id:SEC.prContorni,name:'Contorni',active:true,parent:null,items:1}]},
 {id:V(803),name:'Menu cena',sections:2,active:true,pricing:'fisso' as const,formulas:[{id:F.ceCompleto,name:'Completo',price:16.9},{id:F.ceSoloPrimo,name:'Solo primo',price:9}],secs:[{id:SEC.cePrimi,name:'Primi',active:true,parent:null,items:2},{id:SEC.ceContorni,name:'Contorni',active:true,parent:null,items:2}]}]
const fixedIds=new Set([SEC.prPrimi,SEC.prSecondi,SEC.prContorni,SEC.cePrimi,SEC.ceContorni])
const vCodes=new Map(vSections.map((s,i)=>['c'+(i+1),s.id]))
const SI=(input:any)=>({sections:vSections,menus:vMenus,refs:vRefs,codes:vCodes,...input})
const decide=(actions:any[],message:string,fixed:Set<string>|undefined=fixedIds)=>decideTurn({decision:{intent:'change',plan:{type:'change',actions},notes:[],exclude:[]},control:[],raw:{intent:'change',actions:[]},message,pend:null,undoOK:false,sections:vSections,refs:vRefs,fixedSecIds:fixed})

describe('difetto 1 — nessun testo di conferma senza una mutazione vera',()=>{
 it('«Ok, il Completo del Menu cena passa a 17 €.» è un «fatto»: cade se il server non ha scritto, resta se ha scritto',()=>{
  const d='Ok, il *Completo* del Menu cena passa a 17 €.'
  expect(claimsWrite(d)).toBe(true)
  expect(cleanDraft(d,{wrote:false,numbers:[17]})).toBeNull()
  expect(cleanDraft(d,{wrote:true,numbers:[17]})).toBe(d)
  // Una domanda resta ammessa.
  expect(cleanDraft('Vuoi che il *Completo* del Menu cena passi a 17 €?',{wrote:false,numbers:[17]})).not.toBeNull()
 })
 it('la bozza di un piano di modifica non applicato non arriva mai come risposta (salvo una domanda)',()=>{
  expect(draftOfUnappliedChange({intent:'change'},'Ok, il Completo del Menu cena passa a 17 €.')).toBe(true)
  expect(draftOfUnappliedChange({intent:'change'},'Intendi il Completo del pranzo o della cena?')).toBe(false)
  expect(draftOfUnappliedChange({intent:'clarify'},'Il menu è a prezzo fisso.')).toBe(false)
  // Riepilogo da confermare e strumenti di controllo: la bozza resta (dice proprio cosa succede).
  expect(draftOfUnappliedChange({intent:'change'},'Correggo la pasta a 15 €. Rispondi OK per pubblicare.')).toBe(false)
  expect(draftOfUnappliedChange({intent:'change',actions:[{action:'cancel_pending'}]},'Ok, annullo l\'eliminazione del Babà.')).toBe(false)
 })
 it('«il completo a 17» → «pranzo o cena?» → «a cena»: il prezzo della richiesta a cui risponde vale, la formula cambia davvero',()=>{
  const A2=(o:any)=>A('set_formula_price',{menu:'Menu cena',name:'Completo',price:17,...o})
  const r=structureActions([A2({})],SI({message:'a cena',pending:{clarify:{question:'Intendi il Completo del Menu pranzo o del Menu cena?',itemIds:[],source:'il completo a 17'}}}))
  expect(r.ask).toBeNull();expect(r.actions[0]).toMatchObject({kind:'set_formula',formulaId:F.ceCompleto,price:17,before:16.9})
  // Anche dalla cronologia: domanda del bot entro 10 minuti; dopo, il prezzo non vale più.
  const now=Date.parse('2026-10-21T12:00:00Z'),hist=(ago:number)=>[{role:'owner' as const,text:'il completo a 13',at:now-ago-1000},{role:'bot' as const,text:'Intendi il *Completo* del Menu pranzo o del Menu cena?',at:now-ago}]
  expect(structureActions([A('set_formula_price',{menu:'Menu pranzo',name:'Completo',price:13})],SI({message:'quello del pranzo',history:hist(60_000),now})).actions[0]).toMatchObject({formulaId:F.prCompleto,price:13})
  expect(structureActions([A('set_formula_price',{menu:'Menu pranzo',name:'Completo',price:13})],SI({message:'quello del pranzo',history:hist(11*60_000),now})).ask).toBe('prezzo_formula_non_detto')
 })
})

describe('difetto 2 — prezzo della formula',()=>{
 it('«alza il completo della cena di un euro» = price_delta sul prezzo attuale (letto dal server)',()=>{
  const r=structureActions([A('set_formula_price',{menu:'Menu cena',name:'Completo',price:null,price_delta:1})],SI({message:'alza il completo della cena di un euro'}))
  expect(r.ask).toBeNull();expect(r.actions[0]).toMatchObject({kind:'set_formula',formulaId:F.ceCompleto,price:17.9,before:16.9})
  // Verso opposto a quello detto, o differenza non detta → domanda.
  expect(structureActions([A('set_formula_price',{menu:'Menu cena',name:'Completo',price:null,price_delta:-1})],SI({message:'alza il completo della cena di un euro'})).ask).toBe('prezzo_formula_non_detto')
  expect(structureActions([A('set_formula_price',{menu:'Menu cena',name:'Completo',price:null,price_delta:1})],SI({message:'il completo della cena'})).ask).toBe('prezzo_formula_non_detto')
 })
 it('«da domani dodici e cinquanta»: il prezzo detto a parole vale (nessun controllo «data futura» sulle opzioni)',()=>{
  const r=structureActions([A('set_formula_price',{menu:'Menu pranzo',name:'Completo',price:12.5})],SI({message:'allora il completo del pranzo… da domani dodici e cinquanta'}))
  expect(r.ask).toBeNull();expect(r.actions[0]).toMatchObject({price:12.5})
 })
 it('il motivo del rifiuto torna al modello giusto (prima: «per creare un Menu serve il nome»)',()=>{
  const t=reasonText(['struttura_incompleta:prezzo_formula_non_detto'])
  expect(t).toMatch(/price_delta/);expect(t).not.toMatch(/creare un Menu/)
  expect(reasonText(['struttura_incompleta:nome_menu'])).toMatch(/creare un Menu/)
 })
})

describe('banco finale — opzione omonima in più Menu fissi',()=>{
 it('«il completo a 17» senza Menu detto → domanda (mai il pranzo scelto dal modello); col Menu detto → applica',()=>{
  expect(structureActions([A('set_formula_price',{menu:'Menu pranzo',name:'Completo',price:17})],SI({message:'il completo a 17'})).ask).toBe('menu_della_formula')
  expect(structureActions([A('set_formula_price',{menu:null,name:'Completo',price:17})],SI({message:'il completo a 17'})).ask).toBe('menu_della_formula')
  expect(structureActions([A('set_formula_price',{menu:'Menu cena',name:'Completo',price:17})],SI({message:'il completo della cena a 17'})).ask).toBeNull()
  expect(structureActions([A('set_formula_price',{menu:'Menu cena',name:'Completo',price:17})],SI({message:'stasera il completo a 17'})).ask).toBeNull()
  expect(structureActions([A('set_formula_price',{menu:'Menu pranzo',name:'Completo',price:13})],SI({message:'a pranzo il completo a 13'})).ask).toBeNull()
 })
})

describe('banco finale — frase detta vs nome scelto dal modello nella sostituzione',()=>{
 it('replaceSaidPhrase prende la frase del titolare',()=>{
  expect(replaceSaidPhrase('Gnocchi al pomodoro',['stasera i primi sono gnocchi al ragù e risotto ai funghi'])).toBe('gnocchi al ragù')
  expect(replaceSaidPhrase('Cotoletta alla milanese',['oggi a pranzo primi lasagna e carbonara, secondi cotoletta'])).toBe('cotoletta')
  expect(replaceSaidPhrase('Carbonara',['primi carbonara secondi cotoletta'])).toBe('carbonara')
  expect(replaceSaidPhrase('Gnocchi al pomodoro',['stasera gnocchi al ragù stasera'])).toBe('gnocchi al ragù')
  // «pasta e fagioli»: la lettura intera è compatibile → il nome del modello resta
  const ph=replaceSaidPhrases('Pasta e fagioli',['oggi a pranzo i primi sono pasta al pomodoro e pasta e fagioli'])
  expect(ph.some(p=>p.full.startsWith('pasta e fagioli'))).toBe(true)
 })
 it('vocale senza punteggiatura: «primi pasta al pomodoro risotto alla milanese» = i due piatti esistenti, niente nomi incollati',()=>{
  const msg='pranzo oggi primi pasta al pomodoro risotto alla milanese secondi polpette'
  const r=structureActions([A('replace_section_items',{section:'Primi',menu:'Menu pranzo',text:'Pasta al pomodoro; Risotto alla milanese'})],SI({message:msg}))
  expect(r.actions.filter((a:any)=>a.kind==='create')).toEqual([])
  expect(r.actions.some((a:any)=>a.kind==='hidden'&&a.value===true&&(a.id===byName('Pasta al pomodoro').id||a.id===byName('Risotto alla milanese').id))).toBe(false)
 })
 it('«pasta al pomodoro e pasta e fagioli»: entrambi esistenti, nessun piatto nuovo, gli altri nascosti',()=>{
  const msg='oggi a pranzo i primi sono pasta al pomodoro e pasta e fagioli'
  const r=structureActions([A('replace_section_items',{section:'Primi',menu:'Menu pranzo',text:'Pasta al pomodoro; Pasta e fagioli'})],SI({message:msg}))
  expect(r.actions.filter((a:any)=>a.kind==='create').map((a:any)=>a.name)).not.toContain('Pasta al pomodoro')
  expect(r.actions.some((a:any)=>a.kind==='hidden'&&a.id===byName('Pasta al pomodoro').id&&a.value===true)).toBe(false)
 })
 it('detto «gnocchi al ragù», il modello passa «Gnocchi al pomodoro» → nuovo «Gnocchi al ragù», il pomodoro nascosto; «cotoletta»→milanese resta',()=>{
  const msg='stasera i primi sono gnocchi al ragù e risotto ai funghi'
  const r=structureActions([A('replace_section_items',{section:'Primi',menu:'Menu cena',text:'Gnocchi al pomodoro; Risotto ai funghi'})],SI({message:msg}))
  expect(r.ask).toBeNull()
  const creates=r.actions.filter((a:any)=>a.kind==='create').map((a:any)=>a.name)
  expect(creates).toContain('Gnocchi al ragù')
  const g=byName('Gnocchi al pomodoro');expect(r.actions.some((a:any)=>a.kind==='hidden'&&a.id===g.id&&a.value===true)).toBe(true)
 })
})

describe('live QA — sottomenu in un Menu nascosto',()=>{
 it('il sottomenu creato in un Menu nascosto non è nascosto (lo governa il Menu); in un Menu visibile resta nascosto',()=>{
  const base=SI({message:'nel menu del giorno crea il sottomenu Dolci'}) as any
  const mk=(active:boolean)=>({...base,menus:[...(base.menus??[]),{id:'99999999-9999-4999-8999-999999999999',name:'Menu del giorno',sections:0,active,secs:[]}]})
  const r1=structureActions([A('create_section',{menu:'Menu del giorno',name:'Dolci'})],mk(false));expect(r1.ask).toBeNull();expect(r1.actions[0]).toMatchObject({kind:'create_section',hidden:false})
  const r2=structureActions([A('create_section',{menu:'Menu del giorno',name:'Dolci'})],mk(true));expect(r2.actions[0]).toMatchObject({kind:'create_section',hidden:true})
 })
})

describe('difetto 3 — piatto nuovo in un menu fisso: creato a 0 €, senza domande',()=>{
 it('validateMenuPlan: senza prezzo nel sottomenu di un Menu fisso → 0 € (alla carta il prezzo resta obbligatorio)',()=>{
  const p=validateMenuPlan({intent:'change',actions:[{action:'create_item',section_id:SEC.prPrimi,name:'Lasagna',price:null}]},vRefs,{sections:vSections,message:'aggiungi la lasagna ai primi del pranzo',fixedSectionIds:fixedIds})
  expect(p).toMatchObject({type:'change',actions:[{kind:'create',sectionId:SEC.prPrimi,name:'Lasagna',price:0,noPrice:true}]})
  const q=validateMenuPlan({intent:'change',actions:[{action:'create_item',section_id:SEC.acPrimi,name:'Lasagna',price:null}]},vRefs,{sections:vSections,message:'aggiungi la lasagna ai primi alla carta',fixedSectionIds:fixedIds})
  expect(q).toMatchObject({type:'missing',missing:['price']})
  expect(describeAction((p as any).actions[0],vRefs,vSections)).toMatch(/senza prezzo/)
 })
 it('validateBrainPlan: il piano del modello (create_item, price 0) passa e diventa un piatto nuovo',()=>{
  const raw={intent:'change',actions:[{action:'create_item',item:null,section:'c2',menu:null,price:0,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:'Lasagna',until:null}],read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:'Aggiungo Lasagna.'}
  const d=validateBrainPlan(JSON.stringify(raw),{codes:vCodes},{refs:vRefs,sections:vSections,message:'aggiungi la lasagna ai primi del pranzo',fixedSecIds:fixedIds,menus:vMenus})
  expect(d.intent).toBe('change');expect((d.plan as any).actions).toMatchObject([{kind:'create',name:'Lasagna',price:0}])
 })
 it('omonimo in un ALTRO Menu (Patate al forno del pranzo) non è un doppione per la cena; alla carta il controllo resta',()=>{
  const cr={kind:'create',sectionId:SEC.ceContorni,name:'Patate al forno',price:0,description:null}
  expect(decide([cr],'nei contorni della cena aggiungi le patate al forno').kind).toBe('change')
  expect(decide([cr],'nei contorni della cena aggiungi le patate al forno',new Set()).kind).toBe('reject')
  // Nello stesso Menu sì: è un doppione.
  expect(decide([{...cr,sectionId:SEC.prPrimi}],'nei primi del pranzo aggiungi le patate al forno').kind).toBe('reject')
 })
})

describe('difetto 4 — sostituzione su più sottomenu nello stesso messaggio',()=>{
 const msg='oggi a pranzo primi lasagna e carbonara, secondi cotoletta'
 const plan=[A('replace_section_items',{section:'c2',menu:'Menu pranzo',text:'Lasagna; Carbonara'}),A('replace_section_items',{section:'c3',menu:'Menu pranzo',text:'Cotoletta'})]
 it('una sostituzione per sottomenu; «cotoletta» = Cotoletta alla milanese (stesso piatto, mai un doppione né nascosta)',()=>{
  const r=structureActions(plan,SI({message:msg}));expect(r.ask).toBeNull()
  const creates=r.actions.filter((a:any)=>a.kind==='create').map((a:any)=>[a.sectionId,a.name])
  expect(creates).toEqual([[SEC.prPrimi,'Lasagna'],[SEC.prPrimi,'Carbonara']])
  const hidden=r.actions.filter((a:any)=>a.kind==='hidden'&&a.value).map((a:any)=>vRefs.find(x=>x.id===a.id)!.name).sort()
  expect(hidden).toEqual(['Pasta al pomodoro','Petto di pollo ai ferri','Polpette al sugo','Risotto alla milanese'])
  expect(r.actions.some((a:any)=>a.id===byName('Cotoletta alla milanese').id)).toBe(false)
  // La Carbonara alla carta non è un «gemello» della Carbonara nuova del Menu pranzo.
  expect(decide(r.actions,msg).kind).toBe('change')
 })
 it('nome detto: contenuto, prefisso, plurali, accenti; nuovo solo senza candidati; domanda con più candidati veri',()=>{
  const prSec=vRefs.filter(r=>r.sectionId===SEC.prSecondi),cePrimi=vRefs.filter(r=>r.sectionId===SEC.cePrimi),prPrimi=vRefs.filter(r=>r.sectionId===SEC.prPrimi)
  expect(replaceCandidates('cotoletta',prSec).map(r=>r.name)).toEqual(['Cotoletta alla milanese'])
  expect(replaceCandidates('polpetta',prSec).map(r=>r.name)).toEqual(['Polpette al sugo'])
  expect(replaceCandidates('petto di pollo',prSec).map(r=>r.name)).toEqual(['Petto di pollo ai ferri'])
  expect(replaceCandidates('tagliatelle al ragu',cePrimi).map(r=>r.name)).toEqual(['Tagliatelle al ragù'])
  expect(replaceCandidates('gnocchi al ragù',cePrimi)).toEqual([])
  expect(replaceCandidates('pasta',prPrimi).length).toBe(2)
  const g=structureActions([A('replace_section_items',{section:'c5',menu:'Menu cena',text:'Gnocchi al ragù; Tagliatelle'})],SI({message:'stasera i primi sono gnocchi al ragù e tagliatelle'}))
  expect(g.actions).toEqual([expect.objectContaining({kind:'create',name:'Gnocchi al ragù',price:0}),expect.objectContaining({kind:'hidden',id:byName('Gnocchi al pomodoro').id,value:true})])
  expect(structureActions([A('replace_section_items',{section:'c2',menu:'Menu pranzo',text:'Pasta'})],SI({message:'oggi a pranzo primi pasta'})).ask).toBe('piatto_ambiguo_sostituzione')
 })
 it('un nome nuovo non detto per intero dal titolare non si crea',()=>{
  expect(structureActions([A('replace_section_items',{section:'c5',menu:'Menu cena',text:'Gnocchi alla sorrentina'})],SI({message:'stasera primi gnocchi'})).ask).toBe('nome_non_detto')
 })
 it('una domanda del modello (intent=clarify) con una sostituzione nel piano non scrive niente',async()=>{
  const plan0={intent:'clarify',actions:plan.map(a=>({...a,price_ref:null,price_delta:null,value:null,tag:null,until:null})),read:'none',item_refs:[],capability_ids:[],clarify:{question:"C'è già Carbonara: lo aggiorno?",item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:"C'è già *Carbonara*: lo aggiorno o ne creo un altro?"}
  const fetch=async()=>new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(plan0)}],stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1}}),{status:200,headers:{'content-type':'application/json'}})
  const d=await planOwnerMessage({refs:vRefs,sections:vSections,menus:vMenus,message:msg} as any,'k',{engine:'haiku',fetch:fetch as any})
  expect(d.path).toBe('brain');expect((d as any).plan).toEqual({type:'clarify',ids:[]});expect((d as any).notes).toContain('struttura_in_domanda')
 })
})

describe('difetto 5 — sostituzione di oggi applicata subito',()=>{
 it('«…Va bene?» del modello con «stasera» non mette in attesa dell\'OK una sostituzione (sì per un prezzo con data)',()=>{
  const rep=[{kind:'hidden',id:byName('Patatine fritte').id,value:true,fromReplace:true} as any]
  expect(draftAsksOkOnDate(rep,'Stasera lascio Verdure grigliate. Va bene?','stasera contorni verdure grigliate')).toBe(false)
  expect(draftAsksOkOnDate([{kind:'price',id:byName('Carbonara').id,price:13}],'La metto a 13 da domani. Va bene?','la carbonara da domani a 13')).toBe(true)
 })
 it('«stasera contorni verdure grigliate e patate al forno»: le Patate al forno del pranzo non sono un candidato per la cena',()=>{
  const r=structureActions([A('replace_section_items',{section:'c6',menu:'Menu cena',text:'Verdure grigliate; Patate al forno'})],SI({message:'stasera contorni verdure grigliate e patate al forno'}))
  expect(r.ask).toBeNull()
  expect(r.actions).toEqual([expect.objectContaining({kind:'create',sectionId:SEC.ceContorni,name:'Patate al forno'}),expect.objectContaining({kind:'hidden',id:byName('Patatine fritte').id,value:true})])
  expect(decide(r.actions,'stasera contorni verdure grigliate e patate al forno').kind).toBe('change')
 })
 it('«Intendi per il Menu cena, dove nascondo gli altri primi…?» non diventa la proposta di nascondere tutto il Menu cena',()=>{
  expect(HIDE_WHOLE_MENU_Q.test(plain('Nascondo tutto il Menu *Cena*? Rispondi *sì*.'))).toBe(true)
  expect(HIDE_WHOLE_MENU_Q.test(plain('Intendi per il Menu cena, dove nascondo gli altri primi e lascio solo *Carbonara*?'))).toBe(false)
  expect(HIDE_WHOLE_MENU_Q.test(plain('Nascondo il menu cena e lascio solo i primi?'))).toBe(false)
 })
})

describe('difetto 6 — letture e prezzo di un piatto di un menu fisso',()=>{
 it('domande sulle opzioni: risposta del server dal menu',()=>{
  expect(formulaRead('quanto costa il completo a cena?',vMenus)).toMatch(/16,90/)
  expect(formulaRead('quanto viene il solo primo la sera?',vMenus)).toMatch(/Solo primo\* 9,00/)
  expect(formulaRead('quanto costa il pranzo?',vMenus)).toMatch(/12,00/)
  expect(formulaRead('il menu cena è a prezzo fisso?',vMenus)).toMatch(/^Sì, il \*Menu cena\* è a prezzo fisso/)
  expect(formulaRead('il menu alla carta è a prezzo fisso?',vMenus)).toMatch(/^No, il Menu \*Alla carta\* è alla carta/)
  expect(formulaRead("cosa c'è oggi nei primi del pranzo?",vMenus)).toBeNull()
  const raw={intent:'read',actions:[],read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},uncertain:[],alias_used:[],reply_draft:''}
  const d=validateBrainPlan(JSON.stringify(raw),{codes:vCodes},{refs:vRefs,sections:vSections,message:'quanto costa il completo a cena?',fixedSecIds:fixedIds,menus:vMenus})
  expect(d.plan).toMatchObject({type:'read',read:'formulas'});expect((d.plan as any).text).toMatch(/16,90/)
 })
 it('«la lasagna a 8» su un piatto di un menu fisso senza domanda del modello: il fatto del menu, non «Non ho cambiato nulla.» da solo',()=>{
  const t=fixedDishFact([byName('Pasta al pomodoro').id],vRefs,vMenus as any)!
  expect(t).toMatch(/prezzo fisso/);expect(t).toMatch(/Completo\* 12,00/)
  expect(fixedDishFact([byName('Carbonara').id],vRefs,vMenus as any)).toBeNull()
 })
})
