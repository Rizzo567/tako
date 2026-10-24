// Set PREZZO FISSO (motore Haiku, 21/10/2026): Menu «a prezzo fisso» (CONTRATTO docs/webapp/menu-prezzo-fisso-2026-10-21/CONTRATTO.md
// §1 §4, decisione brain 2026-10-21-takomenu-menu-a-prezzo-fisso). Fixture `prezzofisso` (tipo Victoria, inventata): Alla carta con
// prezzi · Menu pranzo fisso (Completo 12) · Menu cena fisso (Completo 16,90 · Solo primo 9 · Solo secondo 10), sottomenu Primi /
// Secondi / Contorni con piatti a prezzo 0.
// Ogni turno porta le operazioni attese (FixedOp, fixed-checks.ts): l'oracolo calcola formule, pricing e piatti visibili attesi dopo
// ogni turno, e le attese `changes` del giudice condiviso. Famiglie: formula-prezzo · ambigua · piatto-nuovo · sostituzione ·
// formula-nuova · prezzo-piatto · carta · annulla · lettura · pricing · formula-tolta.
// Comando: TAKO_HAIKU=1 TAKO_HAIKU_SET=prezzofisso TAKO_BOT_LLM=replay|mock taskpolicy -b ./node_modules/.bin/vitest run tests/eval/eval-haiku.test.ts
import {initialMenu} from '../fixtures/menus.js'
import {applyOps,changesOf,type FixedCase,type FixedOp} from '../fixed-checks.js'
import type {HaikuCase} from './victoria-1019.js'
import type {EvalMenu,Family,Turn} from '../types.js'

const FIX='prezzofisso',T=(s:string):Turn=>({text:s}),V=(s:string):Turn=>({voice:s}),Q=(s:string):Turn=>({text:s,q:true})
const PR='Menu pranzo',CE='Menu cena',AC='Alla carta'
const fp=(menu:string,name:string,price:number):FixedOp=>({k:'fp',menu,name,price}),fn=(menu:string,name:string,price:number):FixedOp=>({k:'fn',menu,name,price})
const rep=(menu:string,section:string,...names:string[]):FixedOp=>({k:'rep',menu,section,names})
const ci=(menu:string,section:string,name:string,price=0):FixedOp=>({k:'ci',menu,section,name,price})
const UNDO:FixedOp={k:'undo'}
type Step=string|Turn|[string|Turn,...FixedOp[]]
type X={ask?:number[],orAsk?:number[],says?:{turn:number,re:RegExp,sev?:'MEDIO'|'BASSO'}[],noPriceAsk?:boolean,note?:string}
const counters=new Map<string,number>()
export function fc(fam:string,steps:Step[],x:X={}):HaikuCase&FixedCase{
 const k=(counters.get(fam)??0)+1;counters.set(fam,k)
 const init=initialMenu(FIX),oracle:EvalMenu[]=[init],turns:Turn[]=[],repTurns:Record<number,string[]>={},allOps:FixedOp[]=[]
 steps.forEach((st,i)=>{const [t0,...ops]=Array.isArray(st)?st:[st];const t=typeof t0==='string'?T(t0):t0;turns.push(t);allOps.push(...ops)
  const next=applyOps(oracle.at(-1)!,ops,oracle);oracle.push(next)
  const ids=ops.filter(o=>o.k==='rep').map(o=>{const r=o as Extract<FixedOp,{k:'rep'}>;return next.menus.find(m=>m.name===r.menu)!.sections.find(s=>s.name===r.section)!.id});if(ids.length)repTurns[i+1]=ids})
 const changes=changesOf(init,oracle.at(-1)!),undoAt=steps.findIndex(s=>Array.isArray(s)&&s.slice(1).some(o=>(o as FixedOp).k==='undo'))
 const extra:Partial<HaikuCase>={}
 if(undoAt>0){const interim=changesOf(init,oracle[undoAt]!);extra.interim=interim;extra.alt=[interim.filter(c=>c.op==='create')]} // annullare può togliere o nascondere i piatti nuovi
 else if(x.orAsk?.length&&steps.length===1)extra.alt=[[]] // una domanda senza scrittura è ammessa
 const fixedMenu=allOps.some(o=>(o.k==='rep'||o.k==='ci')&&o.menu!==AC)
 return{id:`pf-${fam}-${String(k).padStart(2,'0')}`,family:'bv-multiple' as Family,menu:FIX,turns,changes,source:'prezzo fisso 21/10 (fixture inventata)',...extra,
  ...(x.ask?{ask:x.ask}:{}),...(x.says?{says:x.says}:{}),...(x.note?{note:x.note}:{}),
  fixed:{oracle,orAsk:x.orAsk??[],repTurns,noPriceAsk:x.noPriceAsk??fixedMenu}}}
const ASK_MENU={turn:1,re:/pranzo|cena/i}
const FIXED_WHY=/prezzo fisso|menu fisso|formula|complet|opzion|non (?:ha|hanno) (?:un )?prezz|\?/i

export const PREZZO_FISSO_CASES:(HaikuCase&FixedCase)[]=[
 // 1. Cambio prezzo di una formula
 fc('formula-prezzo',[['il completo a cena passa a 17',fp(CE,'Completo',17)]]),
 fc('formula-prezzo',[['il completo del pranzo a 12,50',fp(PR,'Completo',12.5)]]),
 fc('formula-prezzo',[['solo primo 9,50 a cena',fp(CE,'Solo primo',9.5)]]),
 fc('formula-prezzo',[['a cena il solo secondo lo metti a 11',fp(CE,'Solo secondo',11)]]),
 fc('formula-prezzo',[['menu pranzo: completo 13 euro da oggi',fp(PR,'Completo',13)]]),
 fc('formula-prezzo',[['cena: completo 17,90 e solo primo 9,50',fp(CE,'Completo',17.9),fp(CE,'Solo primo',9.5)]]),
 fc('formula-prezzo',[['alza il completo della cena di un euro',fp(CE,'Completo',17.9)]]),
 fc('formula-prezzo',[["il pranzo completo da domani costa 12 e 50",fp(PR,'Completo',12.5)]]),
 fc('formula-prezzo',[[V('eh il complet… a cena… diciassett'),fp(CE,'Completo',17)]],{orAsk:[1],note:'vocale sporco: il Completo della cena a 17, oppure una domanda'}),
 fc('formula-prezzo',[[V('allora il completo del pranzo… da domani dodici e cinquanta'),fp(PR,'Completo',12.5)]],{orAsk:[1]}),
 fc('formula-prezzo',[[V('il solo primo della sera… nove e cinquanta'),fp(CE,'Solo primo',9.5)]],{orAsk:[1]}),
 fc('formula-prezzo',[[V('eh senti il solo secondo la sera mettilo a dieci e cinquanta'),fp(CE,'Solo secondo',10.5)]],{orAsk:[1]}),
 // 2. Ambiguità: Completo in due Menu → una domanda, nessuna scrittura
 fc('ambigua',['il completo a 17'],{ask:[1],says:[ASK_MENU],note:'Completo a pranzo e a cena: una domanda, nessuna formula cambiata'}),
 fc('ambigua',['metti il completo a 13 euro'],{ask:[1],says:[ASK_MENU]}),
 fc('ambigua',[V('eh il completo… diciassette')],{ask:[1],says:[ASK_MENU]}),
 fc('ambigua',['il completo a 17',['a cena',fp(CE,'Completo',17)]],{ask:[1],says:[ASK_MENU],note:'la risposta completa la richiesta'}),
 fc('ambigua',['il completo a 13',['quello del pranzo',fp(PR,'Completo',13)]],{ask:[1],says:[ASK_MENU]}),
 // 3. Piatto nuovo in un menu fisso: creato subito, senza prezzo
 fc('piatto-nuovo',[['aggiungi la lasagna ai primi del pranzo',ci(PR,'Primi','Lasagna')]],{note:'creato a prezzo 0 senza domande; GRAVE se chiede o inventa il prezzo'}),
 fc('piatto-nuovo',[['nei secondi della cena aggiungi la frittura di calamari',ci(CE,'Secondi','Frittura di calamari')]]),
 fc('piatto-nuovo',[['aggiungi tra i contorni del pranzo le zucchine trifolate',ci(PR,'Contorni','Zucchine trifolate')]]),
 fc('piatto-nuovo',[[V('eh metti… nei primi di stasera… le linguine al pesto'),ci(CE,'Primi','Linguine al pesto')]],{orAsk:[1]}),
 fc('piatto-nuovo',[['aggiungi la caprese nei secondi del pranzo',ci(PR,'Secondi','Caprese')]]),
 fc('piatto-nuovo',[['nei contorni della cena aggiungi le patate al forno',ci(CE,'Contorni','Patate al forno')]],{note:'omonimo del pranzo: nuovo piatto nella cena, il pranzo invariato'}),
 fc('piatto-nuovo',[['aggiungi ai primi della cena i ravioli di ricotta e spinaci',ci(CE,'Primi','Ravioli di ricotta e spinaci')]]),
 fc('piatto-nuovo',[['aggiungi la lasagna ai primi del pranzo',ci(PR,'Primi','Lasagna')],'la lasagna a 8'],{says:[{turn:2,re:FIXED_WHY}],note:'creata a 0; «a 8» su un piatto di menu fisso: domanda o spiegazione, mai il prezzo scritto'}),
 // 4. Sostituzione giornaliera (caso d'uso di Gio)
 fc('sostituzione',[['oggi a pranzo primi lasagna e carbonara, secondi cotoletta',rep(PR,'Primi','lasagna','carbonara'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese')]],{note:'Primi = Lasagna, Carbonara (nuovi); Secondi = solo Cotoletta alla milanese (stesso id); gli altri nascosti; Contorni e cena invariati'}),
 fc('sostituzione',[['stasera i primi sono gnocchi al ragù e risotto ai funghi',rep(CE,'Primi','gnocchi al ragù','risotto ai funghi')]],{note:'Risotto ai funghi (nascosto) torna con lo stesso id; Gnocchi al ragù nuovo; il pranzo invariato'}),
 fc('sostituzione',[['oggi a pranzo i primi sono pasta al pomodoro e pasta e fagioli',rep(PR,'Primi','pasta al pomodoro','pasta e fagioli')]]),
 fc('sostituzione',[['pranzo di oggi: primi risotto alla milanese, penne all\'arrabbiata e trofie al pesto. secondi polpette al sugo e arrosto di vitello',rep(PR,'Primi','risotto alla milanese',"penne all'arrabbiata",'trofie al pesto'),rep(PR,'Secondi','polpette al sugo','arrosto di vitello')]]),
 fc('sostituzione',[['stasera secondi tagliata di manzo e branzino al forno',rep(CE,'Secondi','tagliata di manzo','branzino al forno')]]),
 fc('sostituzione',[['per stasera primi spaghetti alle vongole e paccheri al sugo di pesce, secondi salmone alla griglia, contorni patatine fritte e insalata verde',rep(CE,'Primi','spaghetti alle vongole','paccheri al sugo di pesce'),rep(CE,'Secondi','salmone alla griglia'),rep(CE,'Contorni','patatine fritte','insalata verde')]]),
 fc('sostituzione',[[V('allora oggi a pranzo… eh… primi lasagna e… carbonara, secondi… cotoletta e… petto di pollo'),rep(PR,'Primi','lasagna','carbonara'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese','petto di pollo=Petto di pollo ai ferri')]]),
 fc('sostituzione',[[V('stasera i primi sono gnocchi al ragù e risotto ai funghi'),rep(CE,'Primi','gnocchi al ragù','risotto ai funghi')]]),
 fc('sostituzione',[[V('eh per oggi pranzo i contorni sono patate al forno e… fagiolini'),rep(PR,'Contorni','patate al forno','fagiolini')]]),
 fc('sostituzione',[[V('ok senti stasera… primi tagliatelle al ragù… e basta, secondi scaloppine al limone e tagliata'),rep(CE,'Primi','tagliatelle al ragù'),rep(CE,'Secondi','scaloppine al limone','tagliata=Tagliata di manzo')]]),
 fc('sostituzione',[['oggi primi: lasagna, carbonara',rep(PR,'Primi','lasagna','carbonara')]],{orAsk:[1],note:'senza «pranzo/stasera»: «oggi» detto di giorno vale pranzo, oppure una domanda (pranzo o cena?)'}),
 fc('sostituzione',[['a pranzo oggi abbiamo come primi la pasta al forno e la minestra di verdure',rep(PR,'Primi','pasta al forno','minestra di verdure')]]),
 fc('sostituzione',[['menu del pranzo di oggi, secondi: cotoletta alla milanese, polpette al sugo, frittata di zucchine',rep(PR,'Secondi','cotoletta alla milanese','polpette al sugo','frittata di zucchine')]]),
 fc('sostituzione',[['stasera contorni verdure grigliate e patate al forno',rep(CE,'Contorni','verdure grigliate','patate al forno')]]),
 fc('sostituzione',[["primi di stasera: spaghetti alle vongole, risotto ai funghi e gnocchi al pomodoro",rep(CE,'Primi','spaghetti alle vongole','risotto ai funghi','gnocchi al pomodoro')]],{note:'solo Tagliatelle al ragù nascoste, Risotto torna'}),
 fc('sostituzione',[['oggi a pranzo primi lasagna e carbonara, secondi cotoletta',rep(PR,'Primi','lasagna','carbonara'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese')],['stasera i primi sono gnocchi al ragù e risotto ai funghi',rep(CE,'Primi','gnocchi al ragù','risotto ai funghi')]],{note:'pranzo e poi cena nello stesso giro'}),
 fc('sostituzione',[['oggi a pranzo primi lasagna e carbonara',rep(PR,'Primi','lasagna','carbonara')],['aggiungi anche la pasta e fagioli ai primi del pranzo',rep(PR,'Primi','lasagna','carbonara','pasta e fagioli')]],{note:'il giorno dopo / ritocco: Pasta e fagioli (nascosta) torna con lo stesso id, non un doppione'}),
 fc('sostituzione',[[V('pranzo oggi primi pasta al pomodoro risotto alla milanese secondi polpette contorni insalata mista e spinaci'),rep(PR,'Primi','pasta al pomodoro','risotto alla milanese'),rep(PR,'Secondi','polpette=Polpette al sugo'),rep(PR,'Contorni','insalata mista','spinaci=Spinaci al burro')]]),
 fc('sostituzione',[['stasera solo due primi: carbonara e amatriciana',rep(CE,'Primi','carbonara','amatriciana')]],{note:'omonimi dell\'Alla carta: nuovi nella cena a prezzo 0, l\'Alla carta invariata'}),
 fc('sostituzione',[['i primi del pranzo di oggi sono orecchiette alle cime di rapa e pasta al pomodoro',rep(PR,'Primi','orecchiette alle cime di rapa','pasta al pomodoro')]]),
 // 5. Formula nuova (prezzo detto) / senza prezzo (domanda)
 fc('formula-nuova',[["aggiungi l'opzione solo primo a 9 al pranzo",fn(PR,'Solo primo',9)]]),
 fc('formula-nuova',[['al pranzo metti anche il solo secondo a 10 euro',fn(PR,'Solo secondo',10)]]),
 fc('formula-nuova',[["crea a cena l'opzione bambini a 8 euro",fn(CE,'Bambini',8)]]),
 fc('formula-nuova',["aggiungi l'opzione solo secondo al pranzo"],{ask:[1],note:'prezzo non detto: una domanda, nessuna formula'}),
 fc('formula-nuova',['a cena aggiungi anche il piatto unico'],{ask:[1],note:'prezzo non detto: una domanda (prezzo o piatto?), nessuna scrittura'}),
 fc('formula-nuova',["aggiungi l'opzione solo primo al pranzo",['9 euro',fn(PR,'Solo primo',9)]],{ask:[1]}),
 // 6. Prezzo a un piatto di un menu fisso: domanda o spiegazione, mai il prezzo sul piatto
 fc('prezzo-piatto',['la cotoletta del pranzo a 8'],{says:[{turn:1,re:FIXED_WHY}]}),
 fc('prezzo-piatto',['il risotto alla milanese a 9 euro'],{says:[{turn:1,re:FIXED_WHY}]}),
 fc('prezzo-piatto',['metti le tagliatelle al ragù a 10'],{says:[{turn:1,re:FIXED_WHY}]}),
 fc('prezzo-piatto',[V('la tagliata… quindici euro')],{says:[{turn:1,re:FIXED_WHY}]}),
 fc('prezzo-piatto',['le vongole a cena a 14'],{says:[{turn:1,re:FIXED_WHY}]}),
 // 7. Alla carta invariato
 fc('carta',[['la carbonara alla carta a 13',{k:'ip',menu:AC,dish:'Carbonara',price:13}]]),
 fc('carta',[['la margherita a 7,50',{k:'ip',menu:AC,dish:'Margherita',price:7.5}]]),
 fc('carta',[['aggiungi tra le pizze la bufala a 10',ci(AC,'Pizze','Bufala',10)]]),
 fc('carta',[['il tiramisù a 6,50',{k:'ip',menu:AC,dish:'Tiramisù',price:6.5}]]),
 fc('carta',["aggiungi nei primi alla carta i bucatini all'amatriciana"],{ask:[1],noPriceAsk:false,note:'alla carta il prezzo serve: una domanda'}),
 // 8. Annulla dopo una sostituzione
 fc('annulla',[['oggi a pranzo primi lasagna e carbonara, secondi cotoletta',rep(PR,'Primi','lasagna','carbonara'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese')],['annulla',UNDO]]),
 fc('annulla',[['stasera i primi sono gnocchi al ragù e risotto ai funghi',rep(CE,'Primi','gnocchi al ragù','risotto ai funghi')],['no aspetta, annulla',UNDO]]),
 fc('annulla',[['stasera contorni verdure grigliate e patate al forno',rep(CE,'Contorni','verdure grigliate','patate al forno')],[V('annulla annulla'),UNDO]]),
 fc('annulla',[['oggi a pranzo i primi sono pasta al pomodoro e pasta e fagioli',rep(PR,'Primi','pasta al pomodoro','pasta e fagioli')],['annulla l\'ultima modifica',UNDO]]),
 // 9. Lettura
 fc('lettura',[Q('quanto costa il completo a cena?')],{says:[{turn:1,re:/16[,.]90?/}]}),
 fc('lettura',[Q('quanto viene il solo primo la sera?')],{says:[{turn:1,re:/\b9\b|9[,.]00/}]}),
 fc('lettura',[Q('quanto costa il pranzo?')],{says:[{turn:1,re:/\b12\b|12[,.]00/}]}),
 fc('lettura',[Q("cosa c'è oggi nei primi del pranzo?")],{says:[{turn:1,re:/pomodoro/i},{turn:1,re:/^(?![\s\S]*fagioli)/i,sev:'BASSO'}],note:'i visibili, non la Pasta e fagioli nascosta'}),
 // 10. Pricing del Menu
 fc('pricing',[['rimetti il menu pranzo alla carta',{k:'pricing',menu:PR,v:'carta'}]],{orAsk:[1],note:'pricing carta, formule conservate, prezzi dei piatti invariati'}),
 fc('pricing',[['il menu alla carta fallo a prezzo fisso',{k:'pricing',menu:AC,v:'fisso'}]],{orAsk:[1]}),
 fc('pricing',[Q('il menu cena è a prezzo fisso?')],{says:[{turn:1,re:/\bs[iì]\b|prezzo fisso|complet/i}]}),
 // 11. Formula tolta: solo con conferma
 fc('formula-tolta',["togli l'opzione solo primo dalla cena"],{says:[{turn:1,re:/\?|confermi|\bok\b|\bs[iì]\b/i}],note:'nessuna formula tolta senza conferma'}),
 fc('formula-tolta',["togli l'opzione solo primo dalla cena",['sì',{k:'fd',menu:CE,name:'Solo primo'}]],{says:[{turn:1,re:/\?|confermi|\bok\b|\bs[iì]\b/i}]}),
 fc('formula-tolta',["a cena elimina il solo secondo",['ok',{k:'fd',menu:CE,name:'Solo secondo'}]],{says:[{turn:1,re:/\?|confermi|\bok\b|\bs[iì]\b/i}]}),
]
