// Verificatore avversario #2 (16/10, v75): casi NUOVI, pipeline reale del messaggio chat = estrazione (modello simulato)
// + guardrail copertura clausole + merge. Ogni test dichiara il comportamento ATTESO sensato; i rossi sono bug.
import {describe,expect,it} from 'vitest'
import {randomUUID} from 'node:crypto'
import {workspaceSchema} from '../../../../apps/server/src/lib/menu-workspace-contract.js'
import {extractOnboardingMenu,onboardingUncoveredClauses,onboardingClauseIntent} from '../../../../apps/server/src/lib/onboarding-planner.js'
import {mergeOnboardingRows} from '../../../../apps/server/src/lib/onboarding-menu-merge.js'
type Spec=[string,[string,[string,number][]][]][]
const mk=(spec:Spec)=>workspaceSchema.parse({menus:spec.map(([m,secs])=>({id:randomUUID(),name:m,sections:secs.map(([s,items])=>({id:randomUUID(),name:s,items:items.map(([n,p])=>({id:randomUUID(),name:n,price:p}))}))}))})
const BASE:Spec=[['Pranzo',[['Primi',[['Pasta al pomodoro',10]]]]],['Cena',[['Panini',[['Burger classico',12]]]]]]
const row=(menu:string|null,section:string,name:string,price:number,evidence:string)=>({...(menu?{menuEvidence:menu,menu}:{}),section,name,price,description:'',evidence})
const dishes=(w:any)=>w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>`${m.name}/${s.name}/${i.name}/${i.price}`))).sort()
async function pipe(source:string,rows:any[],spec:Spec=BASE){
 const fetcher=(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({rows,issues:[]})}}]}),{status:200})) as any
 rows=rows.map(r=>{if(!r.menu)return r;const at=source.toLowerCase().indexOf(String(r.menu).toLowerCase());if(at<0){const {menu,menuEvidence,...rest}=r;return rest};return{...r,menuEvidence:source.slice(at,at+r.menu.length)}})
 const w=mk(spec),extracted=await extractOnboardingMenu(source,'k',fetcher)
 const before=w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>i.name)))
 const guard=onboardingUncoveredClauses(source,extracted.rows,before,w.menus.map(m=>m.name))
 const merged=mergeOnboardingRows(w,[...extracted.rows,...guard.rows],false)
 const issues=[...extracted.issues,...guard.issues,...merged.issues]
 const noChange=!merged.changes.length&&!issues.length
 return{w,d:dishes(w),issues,changes:merged.changes,noChange,state:()=>`dishes=${JSON.stringify(dishes(w))} issues=${JSON.stringify(issues)} changes=${JSON.stringify(merged.changes)}`}
}
// ---------- A. Nomi di piatto con un verbo dentro (falsi positivi della pulizia nomi)
describe('A nomi con verbo',()=>{
 const cases:[string,string,string][]=[
  ['A01 Porta Nuova','Porta Nuova','Nel menu Pranzo, categoria Pizze, aggiungi Porta Nuova a 9 euro.'],
  ['A02 Metti in tavola','Metti in tavola','Nel menu Pranzo, categoria Secondi, aggiungi Metti in tavola a 14 euro.'],
  ['A03 Lascia o raddoppia','Lascia o raddoppia','Nel menu Cena, categoria Cocktail, aggiungi Lascia o raddoppia a 8 euro.'],
  ['A04 Mantieni la linea','Mantieni la linea','Nel menu Pranzo, categoria Insalate, aggiungi Mantieni la linea a 7 euro.'],
  ['A05 Alza il gomito','Alza il gomito','Nel menu Cena, categoria Cocktail, aggiungi Alza il gomito a 9 euro.'],
  ['A06 Tieni il resto','Tieni il resto','Nel menu Cena, categoria Dolci, aggiungi Tieni il resto a 5 euro.'],
  ['A07 Crea la tua pizza','Crea la tua pizza','Nel menu Pranzo, categoria Pizze, aggiungi Crea la tua pizza a 10 euro.'],
 ]
 for(const [id,name,src] of cases) it(id,async()=>{
  const menu=/Pranzo/.test(src)?'Pranzo':'Cena',sec=src.match(/categoria (\w+)/)![1]!,price=Number(src.match(/a (\d+) euro/)![1])
  const r=await pipe(src,[row(menu,sec,name,price,src.slice(src.indexOf(name)).replace(/\.$/,''))])
  expect(r.d.join('|'),r.state()).toContain(`${menu}/${sec}/${name}/${price}`)
 })
})
// ---------- B. Stesso nome in due menu voluti davvero
describe('B omonimi voluti',()=>{
 const ACQ:Spec=[...BASE.slice(0,1).map(([m,s])=>[m,[...s,['Bevande',[['Acqua',2]]]]] as any),BASE[1]!]
 it('B01 Acqua anche in Cena, menu detto',async()=>{
  const s='Nel menu Cena, categoria Bevande, aggiungi Acqua a 2 euro.',r=await pipe(s,[row('Cena','Bevande','Acqua',2,'Acqua a 2 euro')],ACQ)
  expect(r.d,r.state()).toContain('Cena/Bevande/Acqua/2')
 })
 it('B02 Acqua in Cena a prezzo diverso',async()=>{
  const s='Nel menu Cena, categoria Bevande, aggiungi Acqua a 3 euro.',r=await pipe(s,[row('Cena','Bevande','Acqua',3,'Acqua a 3 euro')],ACQ)
  expect(r.d,r.state()).toContain('Cena/Bevande/Acqua/3');expect(r.d).toContain('Pranzo/Bevande/Acqua/2')
 })
 it('B03 dettatura: acqua in cena, lowercase, prezzo in lettere',async()=>{
  const s='nel menu cena categoria bevande aggiungi acqua a due euro',r=await pipe(s,[row('cena','bevande','acqua',2,'acqua a due euro')],ACQ)
  expect(r.d.some(x=>/^Cena\/Bevande\/Acqua\/2$/.test(x)),r.state()).toBe(true)
 })
 it('B04 due menu nella stessa frase',async()=>{
  const s='Nel menu Pranzo aggiungi Spritz a 5 euro e nel menu Cena aggiungi Spritz a 6 euro, categoria Aperitivi.'
  const r=await pipe(s,[row('Pranzo','Aperitivi','Spritz',5,'Spritz a 5 euro'),row('Cena','Aperitivi','Spritz',6,'Spritz a 6 euro')])
  expect(r.d,r.state()).toEqual(expect.arrayContaining(['Pranzo/Aperitivi/Spritz/5','Cena/Aperitivi/Spritz/6']))
 })
 it('B05 omonimo con menu nominato come "al Pranzo e alla Cena" in una frase',async()=>{
  const s='Aggiungi Caffè a 1,50 euro al Pranzo e alla Cena, categoria Bevande.'
  const r=await pipe(s,[row('Pranzo','Bevande','Caffè',1.5,'Caffè a 1,50 euro'),row('Cena','Bevande','Caffè',1.5,'Caffè a 1,50 euro')])
  expect(r.d,r.state()).toEqual(expect.arrayContaining(['Pranzo/Bevande/Caffè/1.5','Cena/Bevande/Caffè/1.5']))
 })
})
// ---------- C. nome corto vs lungo
describe('C corto/lungo',()=>{
 it('C01 Burger corto accanto a Burger classico',async()=>{
  const s='Nel menu Pranzo, categoria Panini, aggiungi Burger a 8 euro.',r=await pipe(s,[row('Pranzo','Panini','Burger',8,'Burger a 8 euro')])
  expect(r.d,r.state()).toContain('Pranzo/Panini/Burger/8');expect(r.d).toContain('Cena/Panini/Burger classico/12')
 })
 it('C02 Burger classico XL (lungo) accanto a Burger classico',async()=>{
  const s='Nel menu Cena, categoria Panini, aggiungi Burger classico XL a 16 euro.',r=await pipe(s,[row('Cena','Panini','Burger classico XL',16,'Burger classico XL a 16 euro')])
  expect(r.d,r.state()).toContain('Cena/Panini/Burger classico XL/16');expect(r.d).toContain('Cena/Panini/Burger classico/12')
 })
 it('C03 Lasagna vs Lasagne (piatti diversi, refuso 1 lettera)',async()=>{
  const S:Spec=[['Pranzo',[['Primi',[['Lasagne',9]]]]]]
  const s='Nel menu Pranzo, categoria Primi, aggiungi Lasagna a 11 euro.',r=await pipe(s,[row('Pranzo','Primi','Lasagna',11,'Lasagna a 11 euro')],S)
  console.log('C03',r.state());expect(r.d.length,r.state()).toBeGreaterThanOrEqual(1)
 })
 it('C04 Pizza 4 stagioni vs Pizza 4 formaggi (stesso numero, nomi simili)',async()=>{
  const S:Spec=[['Pranzo',[['Pizze',[['Pizza 4 stagioni',10]]]]]]
  const s='Nel menu Pranzo, categoria Pizze, aggiungi Pizza 4 formaggi a 11 euro.',r=await pipe(s,[row('Pranzo','Pizze','Pizza 4 formaggi',11,'Pizza 4 formaggi a 11 euro')],S)
  expect(r.d,r.state()).toContain('Pranzo/Pizze/Pizza 4 formaggi/11')
 })
 it('C05 Birra media vs Birra piccola',async()=>{
  const S:Spec=[['Cena',[['Birre',[['Birra piccola',4]]]]]]
  const s='Nel menu Cena, categoria Birre, aggiungi Birra piccolo a 5 euro.',r=await pipe(s,[row('Cena','Birre','Birra piccolo',5,'Birra piccolo a 5 euro')],S)
  console.log('C05',r.state())
 })
})
// ---------- D. messaggi che sono modifiche ma non cambiano prezzo / nessun prezzo nuovo
describe('D modifiche non-prezzo',()=>{
 it('D01 elimina piatto esistente (con prezzo): non deve dire "nessuna modifica: erano gia cosi"',async()=>{
  const s='Elimina il Burger classico da 12 euro.',r=await pipe(s,[row('Cena','Panini','Burger classico',12,'Burger classico da 12 euro')])
  expect(r.noChange,r.state()).toBe(false)
 })
 it('D02 elimina piatto NON esistente: non lo crea',async()=>{
  const s='Nel menu Pranzo, categoria Dolci, elimina il Tiramisu a 6 euro.',r=await pipe(s,[row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')])
  expect(r.d.some(x=>x.includes('Tiramisu')),r.state()).toBe(false)
 })
 it('D03 "togli" con menu esplicito non crea',async()=>{
  const s='Nel menu Cena togli il Tiramisu a 6 euro, categoria Dolci.',r=await pipe(s,[row('Cena','Dolci','Tiramisu',6,'Tiramisu a 6 euro')])
  expect(r.d.some(x=>x.includes('Tiramisu')),r.state()).toBe(false)
 })
 it('D04 "non aggiungere" non crea',async()=>{
  const s='Nel menu Pranzo, categoria Dolci, non aggiungere il Tiramisu a 6 euro.',r=await pipe(s,[row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')])
  expect(r.d.some(x=>x.includes('Tiramisu')),r.state()).toBe(false)
 })
 it('D05 "sposta nel menu Pranzo" non duplica',async()=>{
  const s='Sposta il Burger classico nel menu Pranzo, categoria Panini, a 12 euro.',r=await pipe(s,[row('Pranzo','Panini','Burger classico',12,'Burger classico nel menu Pranzo, categoria Panini, a 12 euro')])
  expect(r.d.filter(x=>x.includes('Burger classico')).length,r.state()).toBe(1)
 })
 it('D06 "cancella" ammette sinonimo',async()=>{
  const s='Nel menu Cena, categoria Panini, cancella il Burger classico a 12 euro.',r=await pipe(s,[row('Cena','Panini','Burger classico',12,'Burger classico a 12 euro')])
  expect(r.noChange,r.state()).toBe(false)
 })
})
// ---------- E. numeri scambiati per prezzi / clausole spurie
describe('E numeri e clausole spurie',()=>{
 it('E01 "0,33 l" nel nome (il modello tiene la misura fuori dal nome)',async()=>{
  const s='Nel menu Cena, categoria Bevande, aggiungi Coca Cola 0,33 l a 3 euro.',r=await pipe(s,[row('Cena','Bevande','Coca Cola',3,'Coca Cola 0,33 l a 3 euro')])
  expect(r.d,r.state()).toContain('Cena/Bevande/Coca Cola/3')
 })
 it('E02 "2 pezzi" dopo il nome',async()=>{
  const s='Nel menu Pranzo, categoria Antipasti, aggiungi Arancini 2 pezzi a 4 euro.',r=await pipe(s,[row('Pranzo','Antipasti','Arancini',4,'Arancini 2 pezzi a 4 euro')])
  expect(r.d.some(x=>x.includes('Arancini/4')),r.state()).toBe(true)
 })
 it('E03 "da 12 a 13 ore" nella descrizione',async()=>{
  const s='Nel menu Pranzo, categoria Pizze, aggiungi Pizza margherita a 9 euro, con impasto che lievita da 12 a 13 ore.'
  const r=await pipe(s,[row('Pranzo','Pizze','Pizza margherita',9,'Pizza margherita a 9 euro')])
  expect(r.d,r.state()).toContain('Pranzo/Pizze/Pizza margherita/9');expect(r.issues,r.state()).toEqual([])
 })
 it('E04 coperto non e un piatto',async()=>{
  const s='Il coperto costa 2 euro. Nel menu Pranzo, categoria Dolci, aggiungi Tiramisu a 6 euro.'
  const r=await pipe(s,[row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')])
  expect(r.d).toContain('Pranzo/Dolci/Tiramisu/6');expect(r.issues,r.state()).toEqual([])
 })
 it('E05 consegna gratis sopra 20 euro',async()=>{
  const s='Nel menu Pranzo, categoria Dolci, aggiungi Tiramisu a 6 euro. La consegna è gratis sopra 20 euro.'
  const r=await pipe(s,[row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')])
  expect(r.issues,r.state()).toEqual([])
 })
 it('E06 orario con prezzo: aperitivo dalle 18 alle 20',async()=>{
  const s='Nel menu Cena, categoria Aperitivi, aggiungi Spritz a 8 euro dalle 18 alle 20.'
  const r=await pipe(s,[row('Cena','Aperitivi','Spritz',8,'Spritz a 8 euro')])
  expect(r.d,r.state()).toContain('Cena/Aperitivi/Spritz/8')
 })
 it('E07 "un euro" (dettatura) ',async()=>{
  const s='Nel menu Cena, categoria Bevande, aggiungi Caffè a un euro.',r=await pipe(s,[row('Cena','Bevande','Caffè',1,'Caffè a un euro')])
  expect(r.d,r.state()).toContain('Cena/Bevande/Caffè/1')
 })
 it('E08 "un euro e cinquanta"',async()=>{
  const s='Nel menu Cena, categoria Bevande, aggiungi Caffè a un euro e cinquanta.',r=await pipe(s,[row('Cena','Bevande','Caffè',1.5,'Caffè a un euro e cinquanta')])
  expect(r.d,r.state()).toContain('Cena/Bevande/Caffè/1.5')
 })
})
// ---------- F. prezzi relativi / decimali / copertura clausole
describe('F copertura e ricostruzione',()=>{
 it('F01 rialzo relativo "di 2 euro": mai prezzo 2',async()=>{
  const s='Alza la Pasta al pomodoro di 2 euro.',r=await pipe(s,[row('Pranzo','Primi','Pasta al pomodoro',12,'Pasta al pomodoro di 2 euro')])
  expect(r.d.some(x=>x.endsWith('Pasta al pomodoro/2')),r.state()).toBe(false)
 })
 it('F02 "costa 1 euro in piu": mai prezzo 1 (modello omette la riga)',async()=>{
  const s='Il Burger classico costa 1 euro in più.',r=await pipe(s,[])
  expect(r.d.some(x=>x.endsWith('Burger classico/1')),r.state()).toBe(false)
 })
 it('F03 "togli 1 euro al Burger": mai prezzo 1',async()=>{
  const s='Togli 1 euro al Burger classico.',r=await pipe(s,[])
  expect(r.d.some(x=>x.endsWith('Burger classico/1')),r.state()).toBe(false)
 })
 it('F04 "sconto di 2 euro sulla Pasta"',async()=>{
  const s='Fai uno sconto di 2 euro sulla Pasta al pomodoro.',r=await pipe(s,[])
  expect(r.d.some(x=>x.endsWith('Pasta al pomodoro/2')),r.state()).toBe(false)
 })
 it('F05 decimale 12,50 con riga omessa dal modello: si applica o si chiede in modo sensato',async()=>{
  const s='Porta il Burger classico a 12,50 euro.',r=await pipe(s,[])
  const ok=r.d.includes('Cena/Panini/Burger classico/12.5')||r.issues.some(i=>/Burger/i.test(i))
  expect(ok,r.state()).toBe(true)
 })
 it('F06 due piatti nella stessa clausola, il modello ne restituisce uno solo (dettatura senza e/virgole)',async()=>{
  const s='porta il burger classico a tredici euro la pasta al pomodoro a undici euro'
  const r=await pipe(s,[row('Cena','Panini','burger classico',13,'burger classico a tredici euro')])
  const pasta=r.d.includes('Pranzo/Primi/Pasta al pomodoro/11')||r.issues.some(i=>/pasta|capito/i.test(i))
  expect(pasta,r.state()).toBe(true)
 })
 it('F07 prezzo con "€" davanti, modello omette',async()=>{
  const s='Porta la Pasta al pomodoro a €11.',r=await pipe(s,[])
  expect(r.d,r.state()).toContain('Pranzo/Primi/Pasta al pomodoro/11')
 })
 it('F08 due prezzi per lo stesso piatto "13 euro anziché 12"',async()=>{
  const s='Il Burger classico costa 13 euro anziché 12.',r=await pipe(s,[row('Cena','Panini','Burger classico',13,'Burger classico costa 13 euro anziché 12')])
  expect(r.d,r.state()).toContain('Cena/Panini/Burger classico/13')
 })
})
// ---------- G. intenti per clausola, frasi lunghe
describe('G frasi lunghe e intenti',()=>{
 const full='Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro, Risotto ai funghi a 14 euro, alza la Pasta al pomodoro a 11 euro, tieni il Burger classico a 12 euro e aggiungi Tiramisu a 6 euro nella categoria Dolci.'
 it('G01 5 clausole con punteggiatura',async()=>{
  const r=await pipe(full,[row('Pranzo','Primi','Gnocchi al pesto',11,'Gnocchi al pesto a 11 euro'),row('Pranzo','Primi','Risotto ai funghi',14,'Risotto ai funghi a 14 euro'),row('Pranzo','Primi','Pasta al pomodoro',11,'Pasta al pomodoro a 11 euro'),row('Pranzo','Primi','Burger classico',12,'Burger classico a 12 euro'),row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')])
  expect(r.d,r.state()).toEqual(['Cena/Panini/Burger classico/12','Pranzo/Dolci/Tiramisu/6','Pranzo/Primi/Gnocchi al pesto/11','Pranzo/Primi/Pasta al pomodoro/11','Pranzo/Primi/Risotto ai funghi/14'].sort())
 })
 it('G02 5 clausole dettatura senza punteggiatura',async()=>{
  const s='nel menu pranzo categoria primi aggiungi gnocchi al pesto a undici euro risotto ai funghi a quattordici euro alza la pasta al pomodoro a undici euro tieni il burger classico a dodici euro aggiungi tiramisu a sei euro categoria dolci'
  const r=await pipe(s,[row('pranzo','primi','gnocchi al pesto',11,'gnocchi al pesto a undici euro'),row('pranzo','primi','risotto ai funghi',14,'risotto ai funghi a quattordici euro'),row('pranzo','primi','pasta al pomodoro',11,'pasta al pomodoro a undici euro'),row('pranzo','primi','burger classico',12,'burger classico a dodici euro'),row('pranzo','dolci','tiramisu',6,'tiramisu a sei euro')])
  expect(r.d.length,r.state()).toBe(5);expect(r.d.some(x=>x.includes('Pasta al pomodoro/11')),r.state()).toBe(true);expect(r.d.filter(x=>x.includes('Burger')).length).toBe(1)
 })
 it('G03 mantieni X, poi piatto nuovo senza verbo: non perderlo in silenzio',async()=>{
  const s='Mantieni il Burger classico a 12 euro, Tiramisu a 6 euro nel menu Pranzo, categoria Dolci.'
  const r=await pipe(s,[row('Cena','Panini','Burger classico',12,'Burger classico a 12 euro'),row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')])
  const handled=r.d.includes('Pranzo/Dolci/Tiramisu/6')||r.issues.some(i=>/Tiramisu/.test(i))
  expect(handled,r.state()).toBe(true)
 })
 it('G04 clitico "mantienilo" + cambio in altra clausola',async()=>{
  const s='Il Burger classico mantienilo a 12 euro e la Pasta al pomodoro portala a 11 euro.'
  const r=await pipe(s,[row('Cena','Panini','Burger classico',12,'Burger classico mantienilo a 12 euro'),row('Pranzo','Primi','Pasta al pomodoro',11,'Pasta al pomodoro portala a 11 euro')])
  expect(r.d,r.state()).toEqual(expect.arrayContaining(['Pranzo/Primi/Pasta al pomodoro/11','Cena/Panini/Burger classico/12']))
  expect(r.d.length).toBe(2)
 })
 it('G05 "lascialo" con menu errato dal modello e prezzo uguale',async()=>{
  const s='Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro. Il Burger classico lascialo a 12 euro.'
  const r=await pipe(s,[row('Pranzo','Primi','Gnocchi al pesto',11,'Gnocchi al pesto a 11 euro'),row('Pranzo','Menu','Burger classico',12,'Burger classico lascialo a 12 euro')])
  expect(r.d.filter(x=>x.includes('Burger')).length,r.state()).toBe(1)
 })
 it('G06 "ora è 13 euro" senza verbo di cambio: si applica o si chiede una domanda semplice',async()=>{
  const s='Il Burger classico adesso è 13 euro, non più 12.',r=await pipe(s,[row('Cena','Panini','Burger classico',13,'Burger classico adesso è 13 euro')])
  expect(r.d,r.state()).toContain('Cena/Panini/Burger classico/13')
 })
 it('G07 "ripristina" a prezzo vecchio',async()=>{
  const S:Spec=[['Cena',[['Panini',[['Burger classico',13]]]]]]
  const s='Rimetti il Burger classico a 12 euro.',r=await pipe(s,[row('Cena','Panini','Burger classico',12,'Burger classico a 12 euro')],S)
  expect(r.d,r.state()).toContain('Cena/Panini/Burger classico/12')
 })
 it('G08 "anche il Burger" aggiunge omonimo nello stesso menu? deve restare 1',async()=>{
  const s='Nel menu Cena, categoria Panini, aggiungi anche il Burger classico a 12 euro.',r=await pipe(s,[row('Cena','Panini','Burger classico',12,'Burger classico a 12 euro')])
  expect(r.d.filter(x=>x.includes('Burger')).length,r.state()).toBe(1)
 })
 it('G09 aggiungi piatto + "non pubblicare" (clausola senza prezzo con "invito")',async()=>{
  const s='Nel menu Pranzo, categoria Dolci, aggiungi Tiramisu a 6 euro. Non pubblicare e non inviare inviti, costa meno di 10 euro per tutti.'
  const r=await pipe(s,[row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')])
  expect(r.d).toContain('Pranzo/Dolci/Tiramisu/6');expect(r.issues,r.state()).toEqual([])
 })
 it('G10 prezzo corretto di piatto in altro menu detto con "di cena"',async()=>{
  const s='Il prezzo corretto del Burger classico di cena è 14 euro.',r=await pipe(s,[row('Cena','Panini','Burger classico',14,'Burger classico di cena è 14 euro')])
  expect(r.d,r.state()).toContain('Cena/Panini/Burger classico/14')
 })
})

describe('H varianti aggiuntive',()=>{
 it('H01 "costa 1 euro in piu": il modello calcola 13 (riga scartata dal verificatore, poi ricostruita)',async()=>{
  const s='Il Burger classico costa 1 euro in più.',r=await pipe(s,[row('Cena','Panini','Burger classico',13,'Burger classico costa 1 euro in più')])
  expect(r.d.some(x=>x.endsWith('Burger classico/1')),r.state()).toBe(false)
 })
 it('H02 Coca Cola 0,33 l: nome con la misura (modello fedele)',async()=>{
  const s='Nel menu Cena, categoria Bevande, aggiungi Coca Cola 0,33 l a 3 euro.',r=await pipe(s,[row('Cena','Bevande','Coca Cola 0,33 l',3,'Coca Cola 0,33 l a 3 euro')])
  expect(r.d,r.state()).toContain('Cena/Bevande/Coca Cola 0,33 l/3');expect(r.issues.filter(i=>!/piatti e prezzi/.test(i)),r.state()).toEqual([])
 })
 it('H03 Porta Lasagne -> articolo "la" mangiato (nome dato dal modello con verbo)',async()=>{
  const s='Nel menu Pranzo, categoria Primi, aggiungi Lasagne a 9 euro.',r=await pipe(s,[row('Pranzo','Primi','Aggiungi Lasagne',9,'aggiungi Lasagne a 9 euro')])
  expect(r.d,r.state()).toContain('Pranzo/Primi/Lasagne/9')
 })
 it('H04 Pizza Quattro stagioni: omonimo con altro menu e prezzo uguale in dettatura',async()=>{
  const S:Spec=[['Pranzo',[['Pizze',[['Pizza margherita',8]]]]],['Cena',[['Pizze',[]]]]]
  const s='nel menu cena categoria pizze aggiungi pizza margherita a otto euro',r=await pipe(s,[row('cena','pizze','pizza margherita',8,'pizza margherita a otto euro')],S)
  expect(r.d,r.state()).toContain('Cena/Pizze/Pizza margherita/8')
 })
})

describe('I omonimo voluto in frase unica (live adv3)',()=>{
 const src='Crea locale Verifica Avversaria Quattro. Nel menu Pranzo, categoria Panini, Burger classico a 12 euro. Nel menu Cena, categoria Panini, Burger classico a 12 euro. Non pubblicare.'
 const E:Spec=[]
 it('I01 il modello restituisce entrambe le righe',async()=>{
  const r=await pipe(src,[row('Pranzo','Panini','Burger classico',12,'Burger classico a 12 euro'),row('Cena','Panini','Burger classico',12,'Burger classico a 12 euro')],E)
  expect(r.d,r.state()).toEqual(['Cena/Panini/Burger classico/12','Pranzo/Panini/Burger classico/12'])
 })
 it('I02 il modello omette la seconda riga: va almeno chiesta',async()=>{
  const r=await pipe(src,[row('Pranzo','Panini','Burger classico',12,'Burger classico a 12 euro')],E)
  expect(r.d.length===2||r.issues.some(i=>/Cena|Burger/.test(i)),r.state()).toBe(true)
 })
})
