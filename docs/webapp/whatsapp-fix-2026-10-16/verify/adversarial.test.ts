// Verificatore avversario 16/10: varianti realistiche (dettatura, refusi, sinonimi) contro la logica reale
// (planner + merge). Solo il fetch del modello e' simulato, con output plausibili (anche quelli sbagliati visti dal vivo).
import {describe,expect,it} from 'vitest'
import {workspaceSchema} from '../../../../apps/server/src/lib/menu-workspace-contract.js'
import {extractOnboardingMenu,onboardingClauseIntent,onboardingPriceChange} from '../../../../apps/server/src/lib/onboarding-planner.js'
import {mergeOnboardingRows} from '../../../../apps/server/src/lib/onboarding-menu-merge.js'
import {onboardingRecapRequest} from '../../../../apps/server/src/lib/onboarding-chat.js'
const ids={pranzo:'33333333-3333-4333-8333-333333333333',primi:'44444444-4444-4444-8444-444444444444',pasta:'55555555-5555-4555-8555-555555555555',cena:'66666666-6666-4666-8666-666666666666',panini:'77777777-7777-4777-8777-777777777777',burger:'88888888-8888-4888-8888-888888888888'}
const ws=(burger=12)=>workspaceSchema.parse({menus:[{id:ids.pranzo,name:'Pranzo',sections:[{id:ids.primi,name:'Primi',items:[{id:ids.pasta,name:'Pasta al pomodoro',price:10}]}]},{id:ids.cena,name:'Cena',sections:[{id:ids.panini,name:'Panini',items:[{id:ids.burger,name:'Burger classico',price:burger}]}]}]})
const row=(menu:string|null,section:string,name:string,price:number,evidence:string)=>({...(menu?{menuEvidence:menu,menu}:{}),section,name,price,description:'',evidence})
const dishes=(w:any)=>w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>`${m.name}/${s.name}/${i.name}/${i.price}`))).sort()
async function run(source:string,rows:any[],opts:{burger?:number,correction?:boolean}={}){
 const fetcher=(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({rows,issues:[]})}}]}),{status:200})) as any
 rows=rows.map(r=>{if(!r.menu)return r;const at=source.toLowerCase().indexOf(String(r.menu).toLowerCase());if(at<0){const {menu,menuEvidence,...rest}=r;return rest};return{...r,menuEvidence:source.slice(at,at+r.menu.length)}}) // il modello cita il menu solo se e' nella frase
 const extracted=await extractOnboardingMenu(source,'k',fetcher),w=ws(opts.burger??12),before=dishes(w),burgerId=ids.burger
 const merged=mergeOnboardingRows(w,extracted.rows,!!opts.correction)
 return{w,dishes:dishes(w),before,merged,extractIssues:extracted.issues,burger:w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items)).filter((i:any)=>i.name==='Burger classico'),burgerId}
}
const GN=(t:string)=>row('Pranzo','Primi','Gnocchi al pesto',11,t)
const KEEP_BASE=['Cena/Panini/Burger classico/12','Pranzo/Primi/Gnocchi al pesto/11','Pranzo/Primi/Pasta al pomodoro/10']
// ---- B1: nessun duplicato con "mantieni" e sinonimi. Il modello sbaglia come visto dal vivo: menu Pranzo portato sulla clausola keep.
const keepCases:[string,string,string][]=[
 ['K01 tieni','Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro. Tieni Burger classico a 12 euro e Pasta al pomodoro a 10 euro.','Tieni'],
 ['K02 lascia','Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro. Lascia Burger classico a 12 euro.','Lascia'],
 ['K03 resta','Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro. Burger classico resta a 12 euro.','Resta'],
 ['K04 non toccare','Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro. Non toccare il Burger classico a 12 euro.','Non toccare'],
 ['K05 dettatura senza punteggiatura','nel menu pranzo categoria primi aggiungi gnocchi al pesto a undici euro mantieni burger classico a dodici euro e pasta al pomodoro a dieci euro','Dettatura'],
 ['K06 refuso mantienni','Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro. Mantienni Burger classico a 12 euro.','Refuso'],
 ['K07 resta com e','Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro. Il Burger classico a 12 euro resta com\'è.','com e'],
 ['K08 va bene cosi','Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro. Il Burger classico a 12 euro va bene così.','va bene'],
 ['K09 conferma','Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro. Confermo Burger classico a 12 euro.','Conferma'],
 ['K10 mantieni dopo e, stessa frase','Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro e mantieni Burger classico a 12 euro.','e mantieni'],
 ['K11 mantieni stile maiuscolo','NEL MENU PRANZO, CATEGORIA PRIMI, AGGIUNGI GNOCCHI AL PESTO A 11 EURO. MANTIENI BURGER CLASSICO A 12 EURO.','MAIUSCOLO'],
]
describe('B1 mantieni e sinonimi',()=>{
 for(const [name,source] of keepCases) it(name,async()=>{
  const burgerAt=source.search(/burger classico/i),ev=source.slice(burgerAt).match(/^burger classico[^.]*?(?:euro|dodici)/i)?.[0]??'Burger classico a 12 euro'
  const gn=source.match(/gnocchi al pesto a (?:11|undici) euro/i)![0]
  const r=await run(source,[row('Pranzo','Primi','Gnocchi al pesto',11,gn),row('Pranzo','Menu','Burger classico',12,ev)])
  expect(r.dishes,`stato osservato: ${JSON.stringify(r.dishes)} issues=${JSON.stringify(r.merged.issues)} intent=${onboardingClauseIntent(source,ev,'Burger classico')}`).toEqual(KEEP_BASE)
 })
})
// ---- B2: cambi prezzo legittimi con verbi/sinonimi diversi
const changeCases:[string,string,string,number,number?][]=[
 ['C01 alza','Nel menu Cena, categoria Panini, alza il Burger classico a 13 euro.','Burger classico a 13 euro',13],
 ['C02 abbassa','Nel menu Cena, categoria Panini, abbassa il Burger classico a 11 euro.','Burger classico a 11 euro',11],
 ['C03 metti','Metti il Burger classico a 13 euro.','Burger classico a 13 euro',13],
 ['C04 il burger ora costa','Il Burger classico ora costa 13 euro.','Burger classico ora costa 13 euro',13],
 ['C05 decimale 12,50 a 13','Cambia il Burger classico da 12,50 a 13 euro.','Burger classico da 12,50 a 13 euro',13,12.5],
 ['C06 da 12 a 13,50','Cambia il Burger classico da 12 a 13,50.','Burger classico da 12 a 13,50',13.5],
 ['C07 dettatura da dodici a tredici','cambia burger classico da dodici a tredici euro','burger classico da dodici a tredici euro',13],
 ['C08 senza verbo da X a Y','Burger classico da 12 a 13 euro.','Burger classico da 12 a 13 euro',13],
 ['C09 non X ma Y','Il Burger classico non costa 12 ma 13 euro.','Burger classico non costa 12 ma 13 euro',13],
 ['C10 passa a','Il Burger classico passa da 12 a 13 euro.','Burger classico passa da 12 a 13 euro',13],
 ['C11 refuso camba','Camba il burger classico da 12 a 13 euro','burger classico da 12 a 13 euro',13],
 ['C12 sposta prezzo','Aggiorna il prezzo del Burger classico: 13 euro.','Burger classico: 13 euro',13],
]
describe('B2 cambio prezzo',()=>{
 for(const [name,source,ev,price] of changeCases) it(name,async()=>{
  const r=await run(source,[row('Cena','Panini','Burger classico',price,ev)])
  expect(r.burger.length,`burger: ${JSON.stringify(r.dishes)}`).toBe(1)
  expect(r.burger[0].id).toBe(r.burgerId)
  expect(r.burger[0].price,`stato: ${JSON.stringify(r.dishes)} issues=${JSON.stringify(r.merged.issues)} ext=${JSON.stringify(r.extractIssues)}`).toBe(price)
  expect(r.merged.issues).toEqual([])
 })
})
// ---- negazione che non deve bloccare un cambio legittimo nella stessa frase
const mixed:[string,string,string,number][]=[
 ['M01 tranne','Non cambiare niente, tranne il Burger classico che va a 13 euro.','Burger classico che va a 13 euro',13],
 ['M02 lascia stare','Lascia stare la pasta, il Burger classico costa 13 euro.','Burger classico costa 13 euro',13],
 ['M03 non cambiare e lo porto','Non cambiare la pasta e il Burger classico lo porto a 13 euro.','Burger classico lo porto a 13 euro',13],
 ['M04 non toccare ma','Non toccare la pasta ma il Burger classico mettilo a 13 euro.','Burger classico mettilo a 13 euro',13],
 ['M05 porta poi non cambiare','Porta il Burger classico a 13 euro e non cambiare la Pasta al pomodoro.','Burger classico a 13 euro',13],
 ['M06 non cambiare ma cambia','Non cambiare la Pasta al pomodoro ma cambia il Burger classico a 13 euro.','Burger classico a 13 euro',13],
]
describe('negazione + cambio legittimo',()=>{
 for(const [name,source,ev,price] of mixed) it(name,async()=>{
  const r=await run(source,[row('Cena','Panini','Burger classico',price,ev)])
  expect(r.burger.length).toBe(1);expect(r.burger[0].price,`stato: ${JSON.stringify(r.dishes)} issues=${JSON.stringify(r.merged.issues)} intent=${onboardingClauseIntent(source,ev,'Burger classico')}`).toBe(price)
 })
})
// ---- add legittimo non scambiato per keep
describe('add legittimo',()=>{
 it('A01 stesso nome in altro menu: aggiungi Burger classico a Pranzo',async()=>{
  const s='Nel menu Pranzo, categoria Panini, aggiungi Burger classico a 12 euro.',r=await run(s,[row('Pranzo','Panini','Burger classico',12,'Burger classico a 12 euro')])
  expect(r.dishes).toEqual(['Cena/Panini/Burger classico/12','Pranzo/Panini/Burger classico/12','Pranzo/Primi/Pasta al pomodoro/10'])
 })
 it('A02 mantieni X e aggiungi Y nella stessa frase',async()=>{
  const s='Mantieni la Pasta al pomodoro a 10 euro e aggiungi Tiramisu a 6 euro nel Pranzo, categoria Dolci.',r=await run(s,[row('Pranzo','Primi','Pasta al pomodoro',10,'Pasta al pomodoro a 10 euro'),row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')])
  expect(r.dishes).toContain('Pranzo/Dolci/Tiramisu/6')
 })
 it('A03 non cambiare Pasta, aggiungi Tiramisu',async()=>{
  const s='Non cambiare la Pasta al pomodoro, aggiungi Tiramisu a 6 euro nel menu Pranzo categoria Dolci.',r=await run(s,[row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')])
  expect(r.dishes).toContain('Pranzo/Dolci/Tiramisu/6')
 })
 it('A04 aggiungi stesso piatto con prezzo con virgola',async()=>{
  const s='Nel menu Pranzo categoria Dolci aggiungi Tiramisu a 6,50 euro.',r=await run(s,[row('Pranzo','Dolci','Tiramisu',6.5,'Tiramisu a 6,50 euro')])
  expect(r.dishes).toContain('Pranzo/Dolci/Tiramisu/6.5')
 })
 it('A05 nome piatto con quantita: Pizza margherita 30 cm da 8 a 9 (aggiunta nuova importata da menu PDF-like)',async()=>{
  const s='Nel menu Pranzo categoria Pizze aggiungi Pizza margherita da 8 a 9 euro.',r=await run(s,[row('Pranzo','Pizze','Pizza margherita',9,'Pizza margherita da 8 a 9 euro')])
  // atteso (ragionevole): non perdere la richiesta in silenzio. Documenta lo stato.
  console.log('A05 stato',r.dishes,r.merged.issues)
 })
})
// ---- Case: keep con prezzo diverso, change con piatto inesistente
describe('altri casi',()=>{
 it('X01 cambio prezzo di piatto inesistente non crea',async()=>{
  const r=await run('Cambia il Tiramisu da 6 a 7 euro.',[row('Pranzo','Dolci','Tiramisu',7,'Tiramisu da 6 a 7 euro')])
  expect(r.dishes).toEqual(r.before);expect(r.merged.issues.length).toBeGreaterThan(0)
 })
 it('X02 omonimi in due menu: cambio genera scelta',async()=>{
  const w=ws();w.menus[0]!.sections[0]!.items.push(workspaceSchema.parse({menus:[{id:ids.cena,name:'t',sections:[{id:ids.panini,name:'t',items:[{id:'99999999-9999-4999-8999-999999999999',name:'Burger classico',price:12}]}]}]}).menus[0]!.sections[0]!.items[0]!)
  const m=mergeOnboardingRows(w,[{...row(null,'Menu','Burger classico',15,'Burger classico a 15 euro'),intent:'change'} as any],false)
  expect(m.choices).toHaveLength(1);expect(m.issues[0]).toMatch(/Pranzo.*Cena|Cena.*Pranzo/)
 })
 it('X03 priceChange unit',()=>{
  expect(onboardingPriceChange(' da 12,50 a 13')).toEqual({from:12.5,to:13})
  expect(onboardingPriceChange(' da dodici a tredici euro')).toEqual({from:12,to:13})
  expect(onboardingPriceChange(' da 12 a 13 euro e Pasta')).toEqual({from:12,to:13})
 })
 it('X04 range di prezzo in menu importato "Coperto da 2 a 3 euro" non diventa cambio silenzioso',async()=>{
  const r=await run('Aggiungi nel Pranzo, categoria Primi, Spaghetti da 8 a 10 euro.',[row('Pranzo','Primi','Spaghetti',10,'Spaghetti da 8 a 10 euro')])
  console.log('X04 stato',r.dishes,r.merged.issues);expect(r.dishes.some(d=>d.includes('Spaghetti'))||r.merged.issues.length>0).toBe(true)
 })
})
// ---- riepilogo
describe('riepilogo',()=>{
 const yes=['Mostra il riepilogo','Mostrami il riepilogo dei menu e dei piatti','fammi vedere il menu','Riepilogo','Mi mandi il riepilogo?','Elenca i piatti della bozza','Non cambiare niente, mostrami solo i piatti']
 const no=['Aggiungi il Tiramisu e mostra il riepilogo','Mostrami il menu con Tiramisu a 6 euro','Cambia il menu e mostra i piatti']
 for(const t of yes) it('recap SI: '+t,()=>expect(onboardingRecapRequest(t)).toBe(true))
 for(const t of no) it('recap NO: '+t,()=>expect(onboardingRecapRequest(t)).toBe(false))
})
