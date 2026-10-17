// Menu di prova realistici del banco E. Nomi dei piatti unici dentro ogni fixture (il giudice confronta per nome).
// mario = fixture delle batterie round5 (trattoria + piatti del QA «Tako · Verifica web»): serve per i casi del QA 17/10,
// il caso vocale di Manuel e le conversioni dei casi più duri delle batterie round1–5c.
import type {EvalMenu,MenuFixture,Mods} from '../types.js'

type Spec={restaurant:string,menus:[name:string,type:string,sections:[section:string,items:[string,number][]][]][]}
const hex=(n:number,w:number)=>n.toString(16).padStart(w,'0')
function build(key:string,code:number,spec:Spec):MenuFixture{
 let m=0,s=0,i=0
 const menus=spec.menus.map(([name,type,sections])=>({id:`6${hex(code,7)}-6666-4666-8666-${hex(++m,12)}`,name,type,sections:sections.map(([sname,items])=>({id:`7${hex(code,7)}-7777-4777-8777-${hex(++s,12)}`,name:sname,items:items.map(([iname,price])=>({id:`5${hex(code,7)}-5555-4555-8555-${hex(++i,12)}`,name:iname,price}))}))}))
 const names=menus.flatMap(x=>x.sections.flatMap(y=>y.items.map(z=>z.name.toLowerCase())))
 if(new Set(names).size!==names.length)throw new Error(`fixture ${key}: nomi di piatti duplicati`)
 return{key,restaurant:spec.restaurant,menu:{menus,design:{}}}
}

export const romana=build('romana',1,{restaurant:'Trattoria Da Checco',menus:[['Pranzo e cena','lunch',[
 ['Antipasti',[['Supplì classico',2.5],['Supplì cacio e pepe',3],['Fiori di zucca',3.5],['Bruschetta al pomodoro',4],['Carciofo alla giudia',6],['Parmigiana di melanzane',10]]],
 ['Primi',[['Carbonara',12],['Amatriciana',11],['Cacio e pepe',11],['Gricia',11],['Fettuccine al ragù',12],['Rigatoni con la pajata',14]]],
 ['Secondi',[['Saltimbocca alla romana',15],['Coda alla vaccinara',16],['Abbacchio scottadito',18],['Trippa alla romana',13],['Polpette al sugo',12]]],
 ['Contorni',[['Cicoria ripassata',5],['Puntarelle',6],['Patate al forno',4.5]]],
 ['Dolci',[['Tiramisù',6],['Maritozzo con la panna',4],['Crostata di visciole',5],['Panna cotta',5]]]]],
 ['Bevande','drinks',[['Bevande',[['Acqua naturale',2],['Vino della casa rosso 1/4',4],['Vino della casa bianco 1/4',4],['Birra Peroni',4],['Caffè',1.5]]]]]]})

export const pizzeria=build('pizzeria',2,{restaurant:"Pizzeria 'O Vesuvio",menus:[['Cena','dinner',[
 ['Pizze',[['Margherita',6],['Marinara',5],['Diavola',7.5],['Capricciosa',8.5],['Quattro formaggi',8],['Bufalina',9],['Salsiccia e friarielli',9],['Ortolana',8],['Ripieno al forno',9]]],
 ['Fritti',[['Frittatina di pasta',3],['Frittatina di patate',3],['Crocchè',2],['Montanarina',2.5],['Arancino',3]]],
 ['Dolci',[['Babà',4.5],['Sfogliatella',3],['Delizia al limone',5],['Tiramisù',5]]]]],
 ['Bevande','drinks',[['Bibite',[['Coca Cola',3],['Birra Nastro Azzurro',4],['Acqua',1.5]]]]]]})

export const bar=build('bar',3,{restaurant:'Bar Centrale',menus:[['Bar','drinks',[
 ['Caffetteria',[['Caffè',1.2],['Cappuccino',1.6],['Caffè macchiato',1.3],['Ginseng',1.8],['Orzo',1.4],['Cornetto',1.3],['Cornetto integrale',1.5]]],
 ['Aperitivi',[['Spritz Aperol',6],['Spritz Campari',6.5],['Negroni',8],['Americano',7],['Analcolico alla frutta',5]]],
 ['Panini',[['Tramezzino tonno',3.5],['Tramezzino prosciutto',3.5],['Toast',4],['Piadina crudo',6]]],
 ['Bibite',[['Acqua',1],['Succo di frutta',2.5],['Tè freddo',2.5],['Coca Cola',3]]]]]]})

export const pesce=build('pesce',4,{restaurant:'Trattoria A Tunnara',menus:[['Pranzo e cena','lunch',[
 ['Antipasti',[['Caponata',7],['Arancine al nero',4],['Arancine al ragù',3.5],['Panelle',4],['Insalata di polpo',12],['Sarde a beccafico',10]]],
 ['Primi',[['Pasta con le sarde',14],['Spaghetti ai ricci',22],['Busiate al pesto trapanese',13],['Linguine allo scoglio',18],['Cuscus di pesce',19]]],
 ['Secondi',[['Pesce spada alla ghiotta',18],['Tonno in agrodolce',17],['Frittura di paranza',15],['Calamari ripieni',16],['Grigliata mista',24]]],
 ['Dolci',[['Cannolo',4],['Cassata',5],['Granita di mandorla',4],['Tiramisù',6]]]]],
 ['Vini','drinks',[['Vini',[['Grillo calice',6],["Nero d'Avola calice",6]]]]]]})

// Fixture delle batterie round5 (tests/owner-bot-adversarial-round5.test.ts), con i piatti del QA. Promo come sul QA.
export const mario=build('mario',5,{restaurant:'Trattoria Da Mario',menus:[['Pranzo','lunch',[
 ['Antipasti',[['Bruschetta al pomodoro',5],['Tagliere misto',14]]],
 ['Primi',[['Spaghetti alla carbonara',12],['Pasta e fagioli',9],['Spaghetti aglio olio e peperoncino',8],['Lasagna al forno',11],['Gnocchi 4 formaggi',10],['Pasta del giorno',9]]],
 ['Secondi',[['Tagliata di manzo',18],['Cotoletta alla milanese',15]]],
 ['Piatti di prova',[['Piatto di verifica',13.5],['Che ne sacc',20],['boh',20],['pasta al ragù',12]]],
 ['Contorni',[['Patate al forno',4],['Insalata mista',4]]]]],
 ['Cena','dinner',[
 ['Pizze',[['Margherita',7],['Pizza 4 formaggi',9],['Diavola',8.5],['Capricciosa',9.5]]],
 ['Dolci',[['Tiramisù',5],['Panna cotta',5],['Dolce del giorno',4]]],
 ['Proposte',[['Nuovo burger',12],['Burger classico',10]]]]],
 ['Bevande','drinks',[['Bibite',[['Acqua 0,5 l',1.5],['Coca Cola 33cl',3],['Birra media',5]]],['Caffetteria',[['Caffè',1.2],['Cappuccino',1.8]]]]]]})
for(const s of mario.menu.menus.flatMap(m=>m.sections))for(const i of s.items)if(i.name==='Che ne sacc')i.promo={price:15,until:null};else if(i.name==='boh')i.promo={price:10,until:null}

// VERIFICA-V 17/10: il QA «Tako · Verifica web» com'era alle 17:26 (prove vocali di Manuel): UNA sola categoria.
export const qa=build('qa',6,{restaurant:'Tako · Verifica web',menus:[['Menu','lunch',[
 ['Piatti di prova',[['Piatto di verifica',13.5],['Che ne sacc',20],['boh',20],['pasta al ragù',12],['la parmigiana',10],['tiramisù',6]]]]]]})
for(const s of qa.menu.menus.flatMap(m=>m.sections))for(const i of s.items)if(i.name==='Che ne sacc')i.promo={price:15,until:null};else if(i.name==='boh')i.promo={price:10,until:null}
// Lo stesso QA con il piatto nato dalla frase («Inserisce il piatto la parmigiana», nascosto) della sessione delle 13:16.
export const qasporco=build('qasporco',7,{restaurant:'Tako · Verifica web',menus:[['Menu','lunch',[
 ['Piatti di prova',[['Piatto di verifica',13.5],['Che ne sacc',20],['boh',20],['pasta al ragù',12],['Inserisce il piatto la parmigiana',12],['la parmigiana',10],['tiramisù',6]]]]]]})
for(const s of qasporco.menu.menus.flatMap(m=>m.sections))for(const i of s.items)if(i.name==='Inserisce il piatto la parmigiana')i.hidden=true

export const FIXTURES:Record<string,MenuFixture>={romana,pizzeria,bar,pesce,mario,qa,qasporco}

/** Menu iniziale di una conversazione: fixture + variazioni `mods` (copia profonda). */
export function initialMenu(key:string,mods:Mods={}):EvalMenu{
 const f=FIXTURES[key];if(!f)throw new Error('fixture sconosciuta: '+key)
 const menu:EvalMenu=structuredClone(f.menu),all=menu.menus.flatMap(m=>m.sections.flatMap(s=>s.items)),byName=(n:string)=>{const it=all.find(i=>i.name===n);if(!it)throw new Error(`mods: piatto «${n}» non in ${key}`);return it}
 for(const [n,p] of Object.entries(mods.prices??{}))byName(n).price=p
 for(const n of mods.unavail??[])byName(n).available=false
 for(const n of mods.hidden??[])byName(n).hidden=true
 for(const n of mods.featured??[])byName(n).featured=true
 for(const [n,p] of Object.entries(mods.promo??{}))byName(n).promo={price:p,until:null}
 for(const n of mods.last??[])byName(n).scarcity={lastPortions:true,onlyToday:null}
 return menu
}
export const dishNames=(key:string)=>FIXTURES[key]!.menu.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>i.name)))
