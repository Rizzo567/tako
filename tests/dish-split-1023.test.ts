// 23/10/2026 — divisione dei piatti con la «e» (Victoria: «nodino con burro e salvia e coppa» → 2 piatti; «funghi misti e peperoni» nei
// contorni → 2 piatti). Decisione Manuel (4 punti): consiglio non obbligo; lessico del locale + indizi; nel dubbio UNA domanda di una
// riga solo sul pezzo dubbio; correzione facile e memorizzata («coppa è un piatto a parte», «pasta e fagioli è un piatto solo»).
// Unit test delle funzioni pure + BATTERIA «e ambigue» (≥80 frasi scritte e vocali) con invarianti + route vero (DB e modello finti).
// Fixture «vicd»: locale INVENTATO con la forma di Victoria, nessun dato vero.
import {afterAll,describe,expect,it,vi} from 'vitest'
import {writeFileSync} from 'node:fs'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {brainSql,resetBrainTables,brainTables} from './eval/adapters/new-bot.js'
import {createFakeHaiku,A,P,type Planner} from './eval/fake-haiku.js'
import {parseInsert,ruleTurn} from '../apps/server/src/lib/owner-brain-svuota.js'
import {andVerdicts,parseCorrection,correctionPlan,doubtAnswer,ruleMeaning,ruleOfMeaning,LOCUTIONS,type Lexicon,type SplitRule} from '../apps/server/src/lib/dish-split.js'
import {_lexiconCache} from '../apps/server/src/lib/dish-lexicon.js'
import {parseSession} from '../apps/server/src/lib/owner-brain-sera.js'
import {applyActions} from '../apps/server/src/lib/twilio-menu-ai.js'
import {OWNER_PHONES_MAX} from '../apps/server/src/routes/twilio-menu.js'
import {copy} from '../apps/server/src/lib/twilio-menu-copy.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import type {Conversation,EvalMenu,Turn} from './eval/types.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const plainT=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const strip=(r:string)=>r.replace(/^Sono l.*?persona\.\s*/s,'')

// ---------------- fixture vicd ----------------
let n=0;const id=(p:string)=>p+'-5555-4555-8555-'+String(++n).padStart(12,'0')
const S_=(name:string,items:[string,number,boolean?][])=>({id:id('7b000000'),name,items:items.map(([nm,price,h])=>({id:id('5c000000'),name:nm,price,...(h?{hidden:true}:{})}))})
function vicd(extra:{giornoSecondi?:[string,number,boolean?][],giornoContorni?:[string,number,boolean?][],giornoPrimi?:[string,number,boolean?][]}={}):EvalMenu{n=0
 const giorno={id:id('6b000000'),name:'Menu Giorno',type:'lunch',pricing:'fisso',formulas:[] as any[],sections:[
  S_('Primi',extra.giornoPrimi??[['Lasagna',0],['Pasta al pomodoro',0]]),
  S_('Secondi',extra.giornoSecondi??[['Cotoletta alla milanese',0],['Polpette al sugo',0]]),
  S_('Contorni',extra.giornoContorni??[['Patate al forno',0],['Spinaci al burro',0]])]}
 const cena={id:id('6b000000'),name:'Menu Cena',type:'dinner',pricing:'fisso',formulas:[] as any[],sections:[
  S_('Primi',[['Risotto ai funghi porcini',0],['Tagliatelle panna, speck e zucchine',0,true]]),
  S_('Secondi',[['Orata al forno',0],['Nodino burro e salvia',0,true],['Gamberetti sale e pepe',0,true]]),
  S_('Contorni',[['Insalata mista',0]])]}
 const carta={id:id('6b000000'),name:'Alla carta',type:'main',sections:[S_('Primi piatti',[['Spaghetti alla carbonara',10],['Pasta al pesto',8]]),S_('Contorni',[['Patatine fritte',4]])]}
 giorno.formulas=[{id:id('5d000000'),name:'Completo',price:12,note:null,sectionIds:giorno.sections.map(s=>s.id),translations:{}}]
 cena.formulas=[{id:id('5d000000'),name:'Completo',price:16.9,note:null,sectionIds:cena.sections.map(s=>s.id),translations:{}}]
 return{menus:[giorno,cena,carta] as any,design:{}}}

// ---------------- unit ----------------
const SECS=[{id:'p',name:'Primi',menu:'M'},{id:'s',name:'Secondi',menu:'M'},{id:'c',name:'Contorni',menu:'M'},{id:'d',name:'Dolci',menu:'M'},{id:'a',name:'Antipasti',menu:'M'}]
const NOLEX:Lexicon={names:[],rules:[]}
const VIC:Lexicon={names:['Nodino burro e salvia','Tagliatelle panna, speck e zucchine','Gamberetti sale e pepe','Funghi misti','Peperoni','Arrosto di vitello','Spezzatino e polenta','Coppa'],rules:[]}
const LEARNED:Lexicon={names:[],rules:[{phrase:'funghi misti e peperoni',kind:'split',parts:['funghi misti','peperoni']},{phrase:'salsiccia e patate',kind:'join',parts:['salsiccia e patate']}]}
const LEX:Record<string,Lexicon>={none:NOLEX,vic:VIC,learned:LEARNED}
function sp(text:string,lex:Lexicon=NOLEX){const t=parseInsert(text,SECS,[{name:'M'}],[],{lexicon:lex,ask:true});const l=t.lists[0];return{names:l?.names??[],doubts:(l?.doubts??[]).map(d=>d.text),sec:l?.word??null,all:t}}

describe('divisione con la «e» — funzioni pure',()=>{
 it('i due casi di Victoria (senza lessico)',()=>{
  expect(sp('nei secondi metti coscia di pollo, nodino con burro e salvia e coppa')).toMatchObject({names:['coscia di pollo','nodino con burro e salvia','coppa'],doubts:[]})
  expect(sp('mentre nei contorni metti insalata, funghi misti e peperoni')).toMatchObject({names:['insalata','funghi misti','peperoni'],doubts:[]})})
 it('fuori dai Contorni «funghi misti e peperoni» è un dubbio (si chiede); col lessico o con la regola imparata no',()=>{
  expect(sp('nei secondi metti salsiccia alla griglia, funghi misti e peperoni')).toMatchObject({names:['salsiccia alla griglia'],doubts:['funghi misti e peperoni']})
  expect(sp('nei secondi metti funghi misti e peperoni',VIC)).toMatchObject({names:['funghi misti','peperoni'],doubts:[]})
  expect(sp('nei secondi metti funghi misti e peperoni',LEARNED)).toMatchObject({names:['funghi misti','peperoni'],doubts:[]})
  expect(sp('nei secondi metti salsiccia e patate',LEARNED)).toMatchObject({names:['salsiccia e patate'],doubts:[]})})
 it('andVerdicts: locuzione, con, ingrediente, dubbio',()=>{
  const v=(s:string,sec='Secondi',lex=NOLEX)=>{const W=plainT(s).split(' ');return [...andVerdicts(W,{lexicon:lex,section:sec}).entries()].map(([i,x])=>W[i-1]+'|'+x)}
  expect(v('nodino con burro e salvia e coppa')).toEqual(['burro|keep','salvia|split'])
  expect(v('pollo con patate e peperoni')).toEqual(['patate|keep'])
  expect(v('spaghetti aglio olio e peperoncino','Primi')).toEqual(['olio|keep'])
  expect(v('fusilli cavolfiore acciughe e pomodorini','Primi')).toEqual(['acciughe|keep'])
  expect(v('arrosto di vitello e patate')).toEqual(['vitello|doubt'])
  expect(v('arrosto di vitello e patate','Contorni')).toEqual(['vitello|split'])})
 it('risposta alla domanda «1 piatto o 2?»',()=>{
  for(const t of ['1','uno','un piatto','un piatto solo','insieme','è un piatto solo','uno solo'])expect(doubtAnswer(t),t).toBe('one')
  for(const t of ['2','due','separati','sono due','due piatti','a parte','divisi'])expect(doubtAnswer(t),t).toBe('split')
  for(const t of ['la carbonara a 12','ok grazie','annulla','nei primi metti lasagne'])expect(doubtAnswer(t),t).toBeNull()})
 it('frasi di correzione',()=>{
  expect(parseCorrection('coppa è un piatto a parte')).toEqual({kind:'split',phrase:'coppa',n:null})
  expect(parseCorrection('no, la coppa è un altro piatto')).toEqual({kind:'split',phrase:'coppa',n:null})
  expect(parseCorrection('funghi misti e peperoni sono due contorni')).toEqual({kind:'split',phrase:'funghi misti e peperoni',n:2})
  expect(parseCorrection('nodino con burro e salvia e coppa sono due piatti')).toEqual({kind:'split',phrase:'nodino con burro e salvia e coppa',n:2})
  expect(parseCorrection('pasta e fagioli è un piatto solo')).toEqual({kind:'join',phrase:'pasta e fagioli',n:1})
  expect(parseCorrection('funghi misti e peperoni sono un piatto unico')).toEqual({kind:'join',phrase:'funghi misti e peperoni',n:1})
  for(const t of ['la carbonara è finita','il prezzo è a parte','nei primi metti pasta e fagioli','togli la coppa','questo è a parte','quanto costa la coppa?'])expect(parseCorrection(t),t).toBeNull()})
 it('correctionPlan: divide nella stessa sezione, subito dopo; unisce; regola sempre',()=>{
  const sections=[{id:'s',name:'Secondi',menu:'Menu Giorno'},{id:'c',name:'Contorni',menu:'Menu Giorno'},{id:'p',name:'Primi',menu:'Menu Giorno'}],menus=[{name:'Menu Giorno',pricing:'fisso'}]
  const refs=[{id:'a',name:'Coscia di pollo',price:0,available:true,hidden:false,menu:'Menu Giorno',sectionId:'s'},{id:'b',name:'Nodino con burro e salvia e coppa',price:0,available:true,hidden:false,menu:'Menu Giorno',sectionId:'s'},{id:'f',name:'Funghi misti e peperoni',price:0,available:true,hidden:false,menu:'Menu Giorno',sectionId:'c'},{id:'x',name:'Pasta',price:0,available:true,hidden:false,menu:'Menu Giorno',sectionId:'p',hasImage:true},{id:'y',name:'Fagioli',price:0,available:true,hidden:false,menu:'Menu Giorno',sectionId:'p'}]
  const a=correctionPlan(parseCorrection('coppa è un piatto a parte')!,refs,sections,menus,null,null)
  expect(a.actions).toEqual([{kind:'rename',id:'b',name:'Nodino con burro e salvia'},{kind:'create',sectionId:'s',name:'Coppa',price:0,description:null,afterId:'b'}])
  expect(a.rule).toEqual({phrase:'nodino burro e salvia e coppa',kind:'split',parts:['nodino burro e salvia','coppa']})
  const b=correctionPlan(parseCorrection('nodino con burro e salvia e coppa sono due piatti')!,refs,sections,menus,null,null)
  expect(b.actions).toEqual(a.actions)
  const c=correctionPlan(parseCorrection('funghi misti e peperoni sono due contorni')!,refs,sections,menus,null,null)
  expect(c.actions).toEqual([{kind:'rename',id:'f',name:'Funghi misti'},{kind:'create',sectionId:'c',name:'Peperoni',price:0,description:null,afterId:'f'}])
  const d=correctionPlan(parseCorrection('pasta e fagioli è un piatto solo')!,refs,sections,menus,null,null)
  expect(d.actions).toEqual([{kind:'rename',id:'x',name:'Pasta e fagioli'},{kind:'delete',id:'y',soft:true}])
  expect(d.rule?.kind).toBe('join')
  const e=correctionPlan(parseCorrection('salsiccia e patate è un piatto solo')!,refs,sections,menus,null,null)
  expect(e.found).toBe(false);expect(e.rule).toEqual({phrase:'salsiccia e patate',kind:'join',parts:['salsiccia e patate']})})
 it('regole nella memoria: testo leggibile ↔ regola',()=>{
  for(const r of [{phrase:'funghi misti e peperoni',kind:'split',parts:['funghi misti','peperoni']},{phrase:'pasta e fagioli',kind:'join',parts:['pasta e fagioli']}] as SplitRule[])expect(ruleOfMeaning(ruleMeaning(r))).toEqual(r)
  expect(ruleOfMeaning('altro')).toBeNull()})
 it('create con afterId: il piatto nuovo va subito dopo',()=>{
  const w={menus:[{sections:[{id:'s',items:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}]}]}]}
  applyActions(w,[{kind:'create',sectionId:'s',name:'B2',price:0,description:null,afterId:'b'} as any],{newId:()=>'n1'})
  expect(w.menus[0]!.sections[0]!.items.map(i=>i.name)).toEqual(['A','B','B2','C'])})
 it('sessione del menu del giorno: stessa divisione (senza domande)',()=>{
  const secs=[{id:'s',name:'Secondi',menu:'M'},{id:'c',name:'Contorni',menu:'M'}]
  const ps=parseSession('secondi nodino con burro e salvia e coppa, contorni insalata funghi misti e peperoni',secs,[])
  expect(ps.lists.map(l=>[l.secId,l.names])).toEqual([['s',['nodino con burro e salvia','coppa']],['c',['insalata funghi misti','peperoni']]])})
 it('quattro numeri per locale (patch online v169 portata nel sorgente)',()=>{
  expect(OWNER_PHONES_MAX).toBe(4);expect(copy.pairLimit).toContain('quattro numeri')})})

// ---------------- BATTERIA «e ambigue» ----------------
// [frase, attesi (nomi, oppure {doubt}), lessico]. Scritte e trascrizioni di vocali (senza virgole, con riempitivi).
type BCase=[string,string[]|{doubt:string,names?:string[]},keyof typeof LEX?]
const BATTERIA:BCase[]=[
 ['nei secondi metti nodino con burro e salvia e coppa',['nodino con burro e salvia','coppa']],
 ['nei secondi metti nodino burro e salvia e coppa',['nodino burro e salvia','coppa']],
 ['nei secondi metti coscia di pollo, nodino con burro e salvia e coppa',['coscia di pollo','nodino con burro e salvia','coppa']],
 ['nei secondi tagliata con rucola e grana e orata al forno',['tagliata con rucola e grana','orata al forno']],
 ['nei secondi gamberetti sale e pepe e salsiccia alla griglia',['gamberetti sale e pepe','salsiccia alla griglia']],
 ['nei secondi salsiccia alla griglia e gamberetti sale e pepe',['salsiccia alla griglia','gamberetti sale e pepe']],
 ['nei secondi cotoletta e polpette',['cotoletta','polpette']],
 ['nei secondi arrosto di vitello e patate',{doubt:'arrosto di vitello e patate'}],
 ['nei secondi funghi misti e peperoni',{doubt:'funghi misti e peperoni'}],
 ['nei secondi tagliata e coppa',['tagliata','coppa']],
 ['nei secondi bresaola rucola e grana',['bresaola rucola e grana']],
 ['nei secondi polpette al sugo e cotoletta alla milanese',['polpette al sugo','cotoletta alla milanese']],
 ['nei secondi scaloppine al limone e nodino',['scaloppine al limone','nodino']],
 ['nei secondi filetto al pepe verde e orata al forno',['filetto al pepe verde','orata al forno']],
 ['nei secondi pollo con patate e peperoni',['pollo con patate e peperoni']],
 ['nei secondi tagliata con rucola e pomodorini',['tagliata con rucola e pomodorini']],
 ['nei secondi involtini e salsiccia alla griglia',['involtini','salsiccia alla griglia']],
 ['nei secondi spezzatino e polenta',{doubt:'spezzatino e polenta'}],
 ['nei secondi baccalà e ceci',['baccalà e ceci']],
 ['nei secondi salsiccia e friarielli',['salsiccia e friarielli']],
 ['nei primi pasta e fagioli',['pasta e fagioli']],
 ['nei primi pasta e ceci e lasagne',['pasta e ceci','lasagne']],
 ['nei primi spaghetti aglio olio e peperoncino',['spaghetti aglio olio e peperoncino']],
 ['nei primi spaghetti aglio olio e peperoncino e carbonara',['spaghetti aglio olio e peperoncino','carbonara']],
 ['nei primi carbonara e amatriciana',['carbonara','amatriciana']],
 ['nei primi cacio e pepe e gricia',['cacio e pepe','gricia']],
 ['nei primi tagliatelle panna speck e zucchine',['tagliatelle panna speck e zucchine']],
 ['nei primi risotto zucca e salsiccia',['risotto zucca e salsiccia']],
 ['nei primi gnocchi alla sorrentina e lasagne',['gnocchi alla sorrentina','lasagne']],
 ['nei primi linguine vongole e pomodorini',['linguine vongole e pomodorini']],
 ['nei primi linguine allo scoglio e rigatoni al sugo',['linguine allo scoglio','rigatoni al sugo']],
 ['nei primi pasta al pesto, linguine allo scoglio, rigatoni al sugo',['pasta al pesto','linguine allo scoglio','rigatoni al sugo']],
 ['nei primi orecchiette cime di rapa e salsiccia',['orecchiette cime di rapa e salsiccia']],
 ['nei primi pasta e patate con provola',['pasta e patate con provola']],
 ['nei primi risotto ai funghi porcini e pappardelle al cinghiale',['risotto ai funghi porcini','pappardelle al cinghiale']],
 ['nei primi penne all\'arrabbiata e tortellini panna e prosciutto',['penne all\'arrabbiata','tortellini panna e prosciutto']],
 ['nei primi fusilli cavolfiore, acciughe e pomodorini',['fusilli cavolfiore','acciughe e pomodorini']],
 ['nei primi fusilli cavolfiore acciughe e pomodorini',['fusilli cavolfiore acciughe e pomodorini']],
 ['nei primi ravioli burro e salvia e tagliatelle al ragù',['ravioli burro e salvia','tagliatelle al ragù']],
 ['nei primi minestrone e pasta e fagioli',['minestrone','pasta e fagioli']],
 ['nei primi lasagne e tiramisù',['lasagne','tiramisù']],
 ['nei contorni insalata, funghi misti e peperoni',['insalata','funghi misti','peperoni']],
 ['nei contorni patate al forno e insalata mista',['patate al forno','insalata mista']],
 ['nei contorni zucchine fritte e melanzane al sugo',['zucchine fritte','melanzane al sugo']],
 ['nei contorni spinaci al burro e patate fritte',['spinaci al burro','patate fritte']],
 ['nei contorni funghi trifolati e peperoni',['funghi trifolati','peperoni']],
 ['nei contorni patate e cipolle',['patate','cipolle']],
 ['nei contorni insalata mista e pomodori',['insalata mista','pomodori']],
 ['nei contorni verdure grigliate e patate al forno',['verdure grigliate','patate al forno']],
 ['nei contorni fagiolini e carote',['fagiolini','carote']],
 ['nei contorni patate al forno e rosmarino',['patate al forno e rosmarino']],
 ['nei contorni insalata pomodoro e mozzarella',['insalata pomodoro e mozzarella']],
 ['nei contorni cicoria ripassata e peperonata',['cicoria ripassata','peperonata']],
 ['nei contorni caponata e friarielli',['caponata','friarielli']],
 ['nei contorni piselli e prosciutto',['piselli e prosciutto']],
 ['nei dolci tiramisù e panna cotta',['tiramisù','panna cotta']],
 ['nei dolci crostata e cannoli',['crostata','cannoli']],
 ['nei dolci torta della nonna e gelato',['torta della nonna','gelato']],
 ['nei dolci panna cotta ai frutti di bosco e tiramisù',['panna cotta ai frutti di bosco','tiramisù']],
 ['nei dolci macedonia e gelato',['macedonia','gelato']],
 ['nei dolci crostata crema e amarene',['crostata crema e amarene']],
 ['nei dolci babà e sfogliatella',['babà','sfogliatella']],
 ['negli antipasti prosciutto e melone',['prosciutto e melone']],
 ['negli antipasti bruschette e caprese',['bruschette','caprese']],
 ['negli antipasti tagliere di salumi e formaggi',['tagliere di salumi e formaggi']],
 ['negli antipasti mozzarella e pomodoro e bruschetta',['mozzarella e pomodoro','bruschetta']],
 ['negli antipasti crocchette e arancini',['crocchette','arancini']],
 ['negli antipasti fiori di zucca e supplì',['fiori di zucca','supplì']],
 // lessico del locale: niente domande quando il pezzo è conosciuto
 ['nei secondi funghi misti e peperoni',['funghi misti','peperoni'],'vic'],
 ['nei secondi nodino burro e salvia e coppa',['nodino burro e salvia','coppa'],'vic'],
 ['nei primi tagliatelle panna speck e zucchine',['tagliatelle panna speck e zucchine'],'vic'],
 ['nei secondi arrosto di vitello e patate',['arrosto di vitello','patate'],'vic'],
 ['nei secondi spezzatino e polenta',['spezzatino e polenta'],'vic'],
 ['nei secondi nodino con burro e salvia e coppa',['nodino con burro e salvia','coppa'],'vic'],
 // regole imparate (correzioni / risposte «1/2»)
 ['nei secondi funghi misti e peperoni',['funghi misti','peperoni'],'learned'],
 ['nei secondi salsiccia e patate',['salsiccia e patate'],'learned'],
 ['nei secondi coppa e bresaola',['coppa','bresaola'],'learned'],
 ['nei primi pasta e lenticchie',['pasta e lenticchie'],'learned'],
 // vocali (senza virgole, riempitivi)
 ['allora nei secondi mettiamo coscia di pollo nodino con burro e salvia e coppa',['coscia di pollo','nodino con burro e salvia','coppa']],
 ['ehm nei contorni insalata funghi misti e peperoni',['insalata','funghi misti','peperoni']],
 ['nei primi mettiamo pasta al pesto linguine allo scoglio e rigatoni al sugo',['pasta al pesto','linguine allo scoglio','rigatoni al sugo']],
 ['poi nei secondi tagliata e coppa',['tagliata','coppa']],
 ['nei contorni patate al forno e poi insalata',['patate al forno','insalata']],
 ['nei primi pasta e fagioli e poi anche lasagne',['pasta e fagioli','lasagne']],
 ['nei secondi nodino con burro e salvia e anche la coppa',['nodino con burro e salvia','coppa']],
 ['nei dolci tiramisù e anche panna cotta',['tiramisù','panna cotta']],
 ['nei secondi ehm funghi misti e peperoni',{doubt:'funghi misti e peperoni'}],
 ['nei secondi metti salsiccia e patate',{doubt:'salsiccia e patate'}],
 ['nei contorni metti salsiccia e patate',['salsiccia','patate']],
 ['nei primi metti zuppa di ceci e minestrone',['zuppa di ceci','minestrone']],
 ['nei secondi metti tagliata con rucola e grana e coppa e polpette',['tagliata con rucola e grana','coppa','polpette']],
 ['nei primi inserisci gnocchi al ragù e pasta e fagioli e carbonara',['gnocchi al ragù','pasta e fagioli','carbonara']],
 ['nei secondi metti orata al forno e salsiccia e friarielli',['orata al forno','salsiccia e friarielli']],
]
const FILLW=new Set(['nei','negli','nelle','metti','mettiamo','inserisci','allora','ehm','poi','anche','la','il','e','primi','secondi','contorni','dolci','antipasti','mentre'])
function batteryViolations(c:BCase):string[]{const [text,exp,lk]=c,lex=LEX[lk??'none']!,r=sp(text,lex),out:string[]=[]
 const outNames=[...r.names,...r.doubts].map(plainT)
 // INVARIANTE 1: ogni parola detta (non di raccordo) finisce in un piatto o nel pezzo chiesto
 const words=plainT(text).split(' ').filter(w=>!FILLW.has(w))
 for(const w of words)if(!outNames.some(x=>x.split(' ').includes(w)))out.push('parola persa: '+w)
 // INVARIANTE 2: nessun piatto spezzato a metà di una locuzione nota detta
 const said=' '+plainT(text)+' ';for(const loc of LOCUTIONS)if(said.includes(' '+loc+' ')&&!outNames.some(x=>(' '+x+' ').includes(' '+loc+' ')))out.push('locuzione spezzata: '+loc)
 // INVARIANTE 3: nessuna domanda quando il pezzo è conosciuto (lessico / regola)
 if(lk&&lk!=='none'&&r.doubts.length)out.push('domanda su un pezzo conosciuto: '+r.doubts.join(' | '))
 if(Array.isArray(exp)){if(JSON.stringify(r.names.map(plainT))!==JSON.stringify(exp.map(plainT))||r.doubts.length)out.push(`attesi [${exp.join(' | ')}] avuti [${r.names.join(' | ')}]`+(r.doubts.length?' dubbi ['+r.doubts.join(' | ')+']':''))}
 else{if(!r.doubts.map(plainT).includes(plainT(exp.doubt)))out.push(`attesa la domanda su «${exp.doubt}», avuti [${r.names.join(' | ')}] dubbi [${r.doubts.join(' | ')}]`)}
 return out}
describe('BATTERIA «e ambigue» (23/10)',()=>{
 it(`${BATTERIA.length} frasi, 0 violazioni`,()=>{expect(BATTERIA.length).toBeGreaterThanOrEqual(80)
  const bad=BATTERIA.map(c=>({c:c[0],lex:c[2]??'none',v:batteryViolations(c)})).filter(x=>x.v.length)
  try{writeFileSync(new URL('../docs/webapp/bot-haiku-2026-10-21/notte-1022/batteria-e-ambigue-1023.json',import.meta.url),JSON.stringify({frasi:BATTERIA.length,violazioni:bad.reduce((a,x)=>a+x.v.length,0),ko:bad},null,1))}catch{}
  expect(bad).toEqual([])})})

// ---------------- route vero ----------------
const plannerOf=():Planner=>c=>{const m=plainT(c.message);if(/^(?:annulla|annulla l ultima|torna come prima)$/.test(m))return P('change',[A('undo_last')],'Ok, annullo.');return P('chat',[],'MODELLO')}
async function play(turns0:(Turn|string)[],menu:EvalMenu=vicd(),keepMemory=false){const turns=turns0.map(t=>typeof t==='string'?{text:t}:t) as Turn[]
 const fake=createFakeHaiku(plannerOf());installNet(null,realFetch,fake);if(!keepMemory)resetBrainTables();_lexiconCache.clear();process.env.ANTHROPIC_API_KEY='eval-anthropic-key'
 const c:Conversation={id:'divisione',family:'manuel',menu:'vicd',turns,changes:[]}
 const t0=performance.now(),run=await createRouteBot({name:'haiku',settings:{botBrain:true,botEngine:'haiku'},extraSql:brainSql}).run(c,structuredClone(menu),{restaurant:'Osteria Prova (vicd)'})
 return{replies:run.turns.map(t=>strip(t.reply)),menus:[workspaceSchema.parse(structuredClone(menu)),...run.turns.map(t=>t.menuAfter as any)] as any[],ms:performance.now()-t0}}
const M=(w:any,name:string)=>w.menus.find((m:any)=>m.name===name)
const vis=(w:any,menu:string,sec:string)=>M(w,menu).sections.find((s:any)=>s.name===sec).items.filter((i:any)=>!i.hidden).map((i:any)=>i.name)
const habits=()=>[...brainTables.memory.values()].filter(m=>m.kind==='habit').map(m=>m.meaning)

describe('route vero — divisione, domanda, correzione, memoria',()=>{
 it('Victoria 23/10: svuota → primi e secondi (nodino… e coppa) → contorni (funghi misti e peperoni): divisi, niente domande',async()=>{
  const r=await play(['togli tutti i piatti dal menu pranzo','ok adesso nei primi metti pasta al pesto, linguine allo scoglio, rigatoni al sugo mentre nei secondi metti coscia di pollo, nodino con burro e salvia e coppa','mentre nei contorni metti insalata, funghi misti e peperoni'])
  const w=r.menus[3]
  expect(vis(w,'Menu Giorno','Primi')).toEqual(['Pasta al pesto','Linguine allo scoglio','Rigatoni al sugo'])
  expect(vis(w,'Menu Giorno','Secondi')).toEqual(['Coscia di pollo','Nodino con burro e salvia','Coppa'])
  expect(vis(w,'Menu Giorno','Contorni')).toEqual(['Insalata','Funghi misti','Peperoni'])
  for(const x of r.replies)expect(x).not.toMatch(/1 piatto o/)
  expect(r.replies[1]).toMatch(/• Coppa \(nuovo\)/);expect(r.replies[2]).toMatch(/• Peperoni \(nuovo\)/)})
 it('pezzo dubbio: il resto subito, UNA domanda di una riga; «2» divide e si ricorda (la volta dopo niente domanda)',async()=>{
  const r=await play(['nel menu giorno nei secondi metti salsiccia alla griglia, funghi misti e peperoni','2','nel menu cena nei secondi metti funghi misti e peperoni'])
  expect(vis(r.menus[1],'Menu Giorno','Secondi')).toContain('Salsiccia alla griglia');expect(vis(r.menus[1],'Menu Giorno','Secondi')).not.toContain('Funghi misti')
  expect(r.replies[0]).toMatch(/«funghi misti e peperoni»: 1 piatto o 2\?$/)
  expect(vis(r.menus[2],'Menu Giorno','Secondi')).toEqual(['Cotoletta alla milanese','Polpette al sugo','Salsiccia alla griglia','Funghi misti','Peperoni'])
  expect(habits().some(h=>/Divisione dei piatti: «funghi misti e peperoni»/.test(h))).toBe(true)
  expect(r.replies[2]).not.toMatch(/1 piatto o/);expect(vis(r.menus[3],'Menu Cena','Secondi')).toEqual(['Orata al forno','Funghi misti','Peperoni'])})
 it('«1» = un piatto solo, ricordato',async()=>{
  const r=await play(['nel menu giorno nei secondi metti arrosto di vitello e patate','uno','nel menu cena nei secondi metti arrosto di vitello e patate'])
  expect(r.replies[0]).toMatch(/«arrosto di vitello e patate»: 1 piatto o 2\?/)
  expect(vis(r.menus[1],'Menu Giorno','Secondi')).toEqual(['Cotoletta alla milanese','Polpette al sugo'])
  expect(vis(r.menus[2],'Menu Giorno','Secondi')).toContain('Arrosto di vitello e patate')
  expect(r.replies[2]).not.toMatch(/1 piatto o/);expect(vis(r.menus[3],'Menu Cena','Secondi')).toContain('Arrosto di vitello e patate')})
 it('correzione «coppa è un piatto a parte»: diviso nella stessa sezione subito dopo, «annulla» torna com’era, regola salvata',async()=>{
  const menu=vicd({giornoSecondi:[['Coscia di pollo',0],['Nodino con burro e salvia e coppa',0],['Polpette al sugo',0]]})
  const r=await play(['coppa è un piatto a parte','annulla'],menu)
  expect(vis(r.menus[1],'Menu Giorno','Secondi')).toEqual(['Coscia di pollo','Nodino con burro e salvia','Coppa','Polpette al sugo'])
  expect(r.replies[0]).toMatch(/\*Divisi\*/);expect(r.replies[0]).toMatch(/• Coppa \(nuovo\)/);expect(r.replies[0]).toMatch(/annulla/)
  expect(JSON.stringify(r.menus[2].menus)).toBe(JSON.stringify(r.menus[0].menus))
  expect(habits().some(h=>/«nodino burro e salvia e coppa» = «nodino burro e salvia» \+ «coppa»/.test(h))).toBe(true)})
 it('correzione «funghi misti e peperoni sono due contorni» + riuso nei secondi senza domanda',async()=>{
  const menu=vicd({giornoContorni:[['Insalata',0],['Funghi misti e peperoni',0]]})
  const r=await play(['funghi misti e peperoni sono due contorni','nel menu cena nei secondi metti funghi misti e peperoni'],menu)
  expect(vis(r.menus[1],'Menu Giorno','Contorni')).toEqual(['Insalata','Funghi misti','Peperoni'])
  expect(r.replies[1]).not.toMatch(/1 piatto o/);expect(vis(r.menus[2],'Menu Cena','Secondi')).toEqual(['Orata al forno','Funghi misti','Peperoni'])})
 it('correzione «nodino con burro e salvia e coppa sono due piatti»',async()=>{
  const menu=vicd({giornoSecondi:[['Nodino con burro e salvia e coppa',0]]})
  const r=await play(['nodino con burro e salvia e coppa sono due piatti'],menu)
  expect(vis(r.menus[1],'Menu Giorno','Secondi')).toEqual(['Nodino con burro e salvia','Coppa'])})
 it('inverso «salsiccia e patate è un piatto solo» unisce (il piatto con la foto resta) e si ricorda',async()=>{
  const menu=vicd({giornoSecondi:[['Salsiccia',0],['Patate',0],['Polpette al sugo',0]]})
  const r=await play(['salsiccia e patate è un piatto solo','nel menu cena nei secondi metti salsiccia e patate'],menu)
  expect(vis(r.menus[1],'Menu Giorno','Secondi')).toEqual(['Salsiccia e patate','Polpette al sugo'])
  expect(r.replies[1]).not.toMatch(/1 piatto o/);expect(vis(r.menus[2],'Menu Cena','Secondi')).toContain('Salsiccia e patate')})
 it('correzione senza niente da dividere: risposta chiara, regola salvata, nessuna scrittura',async()=>{
  const r=await play(['coppa è un piatto a parte'])
  expect(JSON.stringify(r.menus[1].menus)).toBe(JSON.stringify(r.menus[0].menus));expect(r.replies[0]).toMatch(/me lo ricordo/)})
 it('6a1af510: i casi lenti del v167 rispondono subito (tempi misurati)',async()=>{
  const r=await play(['aggiungi il vitello tonnato','annulla','nei primi del menu giorno metti '+Array.from({length:40},()=>'pasta e fagioli e linguine allo scoglio e carbonara e tagliatelle panna speck e zucchine').join(', '),'allora nei primi oggi mettiamo carbonara e lasagne nei secondi tagliata e coppa'])
  expect(r.ms).toBeLessThan(15000);expect(r.replies.length).toBe(4)})})
