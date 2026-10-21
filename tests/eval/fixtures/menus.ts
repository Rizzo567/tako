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

// BANCO VERO 18/10 (tests/eval/cases/banco-vero.ts): stati del QA e di Victoria Bar ricostruiti dalle chat vere di Manuel 14–17/10.
// QA la mattina del 17/10 e alle 13:16 (prima di parmigiana e tiramisù).
export const qamattina=build('qamattina',8,{restaurant:'Tako · Verifica web',menus:[['Menu','lunch',[
 ['Piatti di prova',[['Piatto di verifica',13.5],['Che ne sacc',20],['boh',20],['pasta al ragù',12]]]]]]})
// QA il 16/10 sera, prima che esistesse la pasta al ragù.
export const qa1016=build('qa1016',9,{restaurant:'Tako · Verifica web',menus:[['Menu','lunch',[
 ['Piatti di prova',[['Piatto di verifica',13.5],['Che ne sacc',20],['boh',20]]]]]]})
// QA alle 13:23 del 17/10: c'è il piatto nato dalla frase, visibile; pasta al ragù nascosta (mods).
export const qa1323=build('qa1323',10,{restaurant:'Tako · Verifica web',menus:[['Menu','lunch',[
 ['Piatti di prova',[['Piatto di verifica',13.5],['Che ne sacc',20],['boh',20],['pasta al ragù',20],['Inserisce il piatto la parmigiana',12]]]]]]})
for(const f of [qamattina,qa1016,qa1323])for(const s of f.menu.menus.flatMap(m=>m.sections))for(const i of s.items)if(i.name==='Che ne sacc')i.promo={price:15,until:null};else if(i.name==='boh')i.promo={price:10,until:null}
// QA del 15/10 pomeriggio (collaudo prezzi): i quattro piatti «collaudo» con i prezzi delle 15:42.
export const collaudo=build('collaudo',11,{restaurant:'Tako · Verifica web',menus:[['Menu','lunch',[
 ['Piatti di prova',[['Piatto di verifica',13.5],['Pasta collaudo',10],['Pizza collaudo',12],['Tiramisu collaudo',5],['Acqua collaudo',2]]]]]]})
// Victoria Bar (14–15/10): categorie vere (elenco del bot alle 14:00 del 15/10); piatti veri citati in chat con i prezzi veri
// (Bruschetta Victoria 8, tre tagliate 20/24/20); Polpo rucola e patate a prezzo NON noto (14 di comodo) e pochi riempitivi.
export const victoria=build('victoria',12,{restaurant:'Victoria Bar',menus:[['Menu','lunch',[
 ['Antipasti di mare',[['Polpo rucola e patate',14],['Sautè di cozze',12]]],
 ['Antipasti di terra',[['Bruschetta Victoria',8],['Tagliere di salumi',15]]],
 ['Primi piatti',[['Spaghetti alle vongole',15],['Paccheri al ragù',13]]],
 ['Secondi di carne',[['Tagliata rucola e grana',20],['Tagliata con funghi porcini e panna',24]]],
 ['Secondi di pesce',[['Tagliata di orata o branzino con rucola e grana',20]]],
 ['Contorni',[['Patate al forno',5]]],['Dolci',[['Tiramisù della casa',6]]],['Pizze e calzoni',[['Margherita',7]]],['Bevande',[['Acqua naturale',2]]]]]]})

// ---------------- Motore Haiku 5.5 (run 21/10/2026, perimetro B) ----------------
// victoria4: locale «tipo Victoria» a 4 menu (Menu pranzo, Menu cena, Bevande, Alla carta) con DATI INVENTATI di comodo (mai letti
// dal DB di Victoria). Due sottomenu omonimi «Primi» (pranzo e cena) e due «Secondi»; una Sezione (gruppo pubblico di livello 3,
// `parentSectionId` = sottomenu «Pizze») «Pizze bianche». «Pizza Sorrentina» + «Gnocchi alla sorrentina»: l'alias attivo
// «la sorrentina» = Pizza Sorrentina (seminato da eval-haiku.test.ts) toglie l'ambiguità. La chiave «victoria» resta quella del banco vero.
export const victoria4=build('victoria4',13,{restaurant:'Victoria Bar (prova)',menus:[
 ['Menu pranzo','lunch',[
  ['Antipasti',[['Bruschetta classica',6],['Caprese',9]]],
  ['Primi',[['Spaghetti alle vongole',15],['Gnocchi alla sorrentina',11],['Paccheri al ragù',12]]],
  ['Secondi',[['Cotoletta alla milanese',14],['Tagliata rucola e grana',20]]]]],
 ['Menu cena','dinner',[
  ['Primi',[['Risotto ai frutti di mare',18],['Tagliatelle ai porcini',16],['Carbonara',13]]],
  ['Secondi',[['Filetto al pepe verde',24],['Branzino al forno',22]]],
  ['Dolci',[['Tiramisù della casa',6],['Panna cotta ai frutti di bosco',6],['Cheesecake',6.5]]]]],
 ['Bevande','drinks',[
  ['Bibite',[['Acqua naturale',2],['Acqua frizzante',2],['Coca Cola',3.5]]],
  ['Birre',[['Birra media',5],['Birra piccola',3.5]]],
  ['Vini',[['Calice di rosso',6],['Calice di bianco',6]]]]],
 ['Alla carta','main',[
  ['Pizze',[['Margherita',7],['Pizza Sorrentina',9],['Diavola',8.5],['Capricciosa',9.5]]],
  ['Pizze bianche',[['Pizza bianca al rosmarino',6],['Focaccia crudo e burrata',12]]]]]]})
{const carta=victoria4.menu.menus[3]!,pizze=carta.sections[0]!;(carta.sections[1] as any).parentSectionId=pizze.id}

// mariopg: il menu «Trattoria Da Mario» del playground del 20/10 (PLAYGROUND-1-SYSTEM: p1…p30 = stessi piatti, stessi prezzi e
// stesso ordine della fixture mario). Chiave separata perché il set playground semina gli alias «la carbo», «la coca», «la tagliata».
export const mariopg:MenuFixture={key:'mariopg',restaurant:'Trattoria Da Mario',menu:structuredClone(mario.menu)}

// anziano: trattoria romana per il set «parlato sporco» (vocali di un ristoratore anziano trascritti male).
export const anziano=build('anziano',14,{restaurant:'Trattoria Er Sor Gigi',menus:[['Pranzo e cena','lunch',[
 ['Primi',[['Carbonara',12],['Amatriciana',11],['Gricia',11],['Cacio e pepe',10],['Lasagna',11]]],
 ['Secondi',[['Saltimbocca alla romana',15],['Abbacchio scottadito',18],['Coda alla vaccinara',16],['Polpette al sugo',12]]],
 ['Contorni',[['Cicoria ripassata',5],['Patate al forno',4.5]]],
 ['Pizze',[['Margherita',7],['Sorrentina',9],['Diavola',8]]],
 ['Dolci',[['Tiramisù',6],['Panna cotta',5],['Crostata',5]]]]],
 ['Bevande','drinks',[['Bevande',[['Coca Cola',3],['Acqua naturale',2],['Birra',5],['Vino della casa 1/4',5],['Caffè',1.5]]]]]]})

export const FIXTURES:Record<string,MenuFixture>={romana,pizzeria,bar,pesce,mario,qa,qasporco,qamattina,qa1016,qa1323,collaudo,victoria,victoria4,mariopg,anziano}

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

// ---------------- Set STRUTTURA (motore Haiku, 21/10/2026: creazione di Menu e Sottomenu, cases/struttura-1021.ts) ----------------
// qastruttura: il QA come lo ha usato Manuel il 21/10 (un solo Menu «Menu» con tre sottomenu e piatti, NESSUN Menu «Pranzo» o «Cena»).
export const qastruttura=build('qastruttura',15,{restaurant:'Tako · Verifica web',menus:[['Menu','lunch',[
 ['Antipasti',[['Bruschetta al pomodoro',5],['Tagliere misto',14]]],
 ['Piatti di prova',[['Piatto di verifica',13.5],['pasta al ragù',12]]],
 ['Dolci',[['tiramisù',6]]]]]]})
// strutt: tre Menu (Pranzo, Cena, Bevande) per la batteria avversaria della struttura; «Primi» e «Secondi» in due Menu; Sezione
// «Pizze bianche» (parentSectionId = sottomenu «Pizze» della Cena). Nessun «Dolci», «Contorni», «Insalate», «Amari».
export const strutt=build('strutt',16,{restaurant:'Osteria della Prova',menus:[
 ['Pranzo','lunch',[['Antipasti',[['Bruschetta',5],['Caprese',8]]],['Primi',[['Carbonara',12],['Amatriciana',11]]],['Secondi',[['Cotoletta',14],['Tagliata',18]]]]],
 ['Cena','dinner',[['Primi',[['Risotto ai funghi',15],['Tagliatelle al ragù',13]]],['Secondi',[['Filetto al pepe',24],['Branzino al forno',22]]],['Pizze',[['Margherita',7],['Diavola',8.5]]],['Pizze bianche',[['Focaccia rosmarino',6]]]]],
 ['Bevande','drinks',[['Bibite',[['Acqua naturale',2],['Coca Cola',3.5]]],['Vini',[['Calice di rosso',6],['Calice di bianco',6]]]]]]})
{const cena=strutt.menu.menus[1]!;(cena.sections[3] as any).parentSectionId=cena.sections[2]!.id}
// bimbum: un Menu con un sottomenu «Secondi» di 4 piatti (frasi di Bim Bum Bar). bimbum2: «Secondi» in DUE Menu (Pranzo e Cena).
export const bimbum=build('bimbum',17,{restaurant:'Bim Bum Bar (prova)',menus:[['Menu','main',[
 ['Antipasti',[['Tagliere bimbum',12],['Fritto misto',9]]],
 ['Primi',[['Carbonara',11],['Gnocchi al pomodoro',9]]],
 ['Secondi',[['Cotoletta alla milanese',14],['Hamburger di manzo',13],['Salsiccia ai ferri',10],['Pollo alla piastra',11]]],
 ['Dolci',[['Tiramisù',5]]]]]]})
export const bimbum2=build('bimbum2',18,{restaurant:'Bim Bum Bar (prova)',menus:[
 ['Pranzo','lunch',[['Primi',[['Carbonara',11]]],['Secondi',[['Cotoletta alla milanese',14],['Salsiccia ai ferri',10]]]]],
 ['Cena','dinner',[['Secondi',[['Filetto al pepe verde',22],['Grigliata mista',18]]],['Dolci',[['Tiramisù',5]]]]]]})
Object.assign(FIXTURES,{qastruttura,strutt,bimbum,bimbum2})

// struttvis (21/10, Menu nascosti / «rendi visibile»): strutt + Menu nascosti «Brunch» (vuoto) e «Aperitivo» (con Spritz), sottomenu
// «Dolci» vuoto e nascosto in Pranzo e in Cena (omonimi), «Vini» nascosto con piatti.
export const struttvis:MenuFixture=(()=>{const f:MenuFixture={key:'struttvis',restaurant:'Osteria della Prova',menu:structuredClone(strutt.menu)}
 const id=(n:number)=>'5000aa00-5555-4555-8555-'+String(n).padStart(12,'0'),W=f.menu as any
 W.menus.push({id:id(1),name:'Brunch',description:null,type:'main',active:false,translations:{},sections:[]})
 W.menus.push({id:id(2),name:'Aperitivo',description:null,type:'drinks',active:false,translations:{},sections:[{id:id(3),parentSectionId:null,name:'Spritz',description:null,active:true,translations:{},items:[{...structuredClone(W.menus[2].sections[0].items[0]),id:id(4),name:'Aperol spritz',price:6}]}]})
 for(const [mi,n] of [[0,5],[1,6]] as const)W.menus[mi].sections.push({id:id(n),parentSectionId:null,name:'Dolci',description:null,active:false,translations:{},items:[]})
 W.menus[2].sections[1].active=false
 return f})()
Object.assign(FIXTURES,{struttvis})

// ---------------- Set PREZZO FISSO (21/10/2026, docs/webapp/menu-prezzo-fisso-2026-10-21/CONTRATTO.md, cases/prezzo-fisso-1021.ts) ----------------
// prezzofisso: locale «tipo Victoria» INVENTATO (nessun dato vero). Alla carta con prezzi · Menu pranzo pricing:'fisso' (Completo 12 €,
// primo + secondo con contorno) · Menu cena pricing:'fisso' (Completo 16,90 €, Solo primo 9 €, Solo secondo 10 €). Piatti dei menu fissi
// a prezzo 0; «Compreso: ¼ di vino oppure ½ l d'acqua + caffè». Nascosti da ieri: Pasta e fagioli e Arrosto di vitello (pranzo),
// Risotto ai funghi (cena), per provare che la sostituzione li fa tornare con lo stesso id.
export const prezzofisso:MenuFixture=(()=>{const f=build('prezzofisso',19,{restaurant:'Trattoria La Pergola (prova)',menus:[
 ['Alla carta','main',[['Antipasti',[['Bruschetta',5],['Tagliere della casa',14]]],['Primi',[['Carbonara',12],['Amatriciana',11]]],['Secondi',[['Filetto al pepe verde',22],['Grigliata mista',18]]],['Pizze',[['Margherita',7],['Diavola',8.5]]],['Dolci',[['Tiramisù',6],['Panna cotta',5]]]]],
 ['Menu pranzo','lunch',[['Primi',[['Pasta al pomodoro',0],["Penne all'arrabbiata",0],['Risotto alla milanese',0],['Pasta e fagioli',0]]],['Secondi',[['Cotoletta alla milanese',0],['Petto di pollo ai ferri',0],['Polpette al sugo',0],['Arrosto di vitello',0]]],['Contorni',[['Patate al forno',0],['Insalata mista',0],['Spinaci al burro',0]]]]],
 ['Menu cena','dinner',[['Primi',[['Tagliatelle al ragù',0],['Spaghetti alle vongole',0],['Gnocchi al pomodoro',0],['Risotto ai funghi',0]]],['Secondi',[['Tagliata di manzo',0],['Salmone alla griglia',0],['Scaloppine al limone',0]]],['Contorni',[['Patatine fritte',0],['Verdure grigliate',0]]]]]]})
 const W=f.menu as any,fid=(n:number)=>'5000bb00-5555-4555-8555-'+String(n).padStart(12,'0'),inc="¼ di vino oppure ½ l d'acqua + caffè",secs=(m:number,ix:number[])=>ix.map(i=>W.menus[m].sections[i].id)
 W.menus[1].pricing='fisso';W.menus[1].included=inc;W.menus[1].formulas=[{id:fid(1),name:'Completo',price:12,note:'primo + secondo con contorno',sectionIds:secs(1,[0,1,2]),translations:{}}]
 W.menus[2].pricing='fisso';W.menus[2].included=inc;W.menus[2].formulas=[{id:fid(2),name:'Completo',price:16.9,note:'primo + secondo con contorno',sectionIds:secs(2,[0,1,2]),translations:{}},{id:fid(3),name:'Solo primo',price:9,note:null,sectionIds:secs(2,[0]),translations:{}},{id:fid(4),name:'Solo secondo',price:10,note:'con contorno',sectionIds:secs(2,[1,2]),translations:{}}]
 for(const n of ['Pasta e fagioli','Arrosto di vitello','Risotto ai funghi'])for(const m of W.menus)for(const s of m.sections)for(const i of s.items)if(i.name===n)i.hidden=true
 return f})()
Object.assign(FIXTURES,{prezzofisso})

// ---------------- Set MULTITURNO / ADV-SERA (21/10/2026 sera, prova dal vivo di Manuel sul QA 26050ecd) ----------------
// qasera: stessa FORMA del QA di quella sera (riletto in sola lettura): «Menu di verifica · web QA» con Piatti di prova (alcuni nascosti)
// e Primi (paste, due nascoste in più rispetto al QA per provare «solo i visibili»), «Menu pranzo» col solo sottomenu «Completo» (vuoto),
// «Menu cena» con «Primi» nascosto e vuoto, «Menu del giorno» a PREZZO FISSO (nascosto) con Gnocchi al ragù. Nomi inventati dove servono.
export const qasera:MenuFixture=(()=>{const f=build('qasera',20,{restaurant:'Tako · Verifica web',menus:[
 ['Menu di verifica · web QA','lunch',[['Piatti di prova',[['Piatto di verifica',13.5],['Che ne sacc',20],['boh',20],['pasta al ragù',10],['Inserisce il piatto la parmigiana',12],['Pasta al sugo',9],['Pasta al pesto e lasagna',10.01],['tiramisù',15]]],
  ['Primi',[['la parmigiana',15],['pasta al pesto',11],['pasta carbonara',10],['riso giallo',8],["pasta all'amatriciana",11],['pasta alla norma',10]]]]],
 ['Menu pranzo','lunch',[['Completo',[]]]],
 ['Menu cena','dinner',[['Primi',[]]]],
 ['Menu del giorno','lunch',[['Primi',[['Lasagna',0],['Carbonara',0],['Gnocchi al ragù',0]]],['Secondi',[['Cotoletta',0],['Polpette',0],['Frittata di zucchine',0],['Frittata di patate',0]]]]]]})
 const W=f.menu as any,hide=['Piatto di verifica','Che ne sacc','boh','Inserisce il piatto la parmigiana',"pasta all'amatriciana",'pasta alla norma','Carbonara','Polpette','Frittata di zucchine','Frittata di patate']
 for(const m of W.menus)for(const s of m.sections)for(const i of s.items){if(hide.includes(i.name))i.hidden=true;if(i.name==='boh')i.available=false}
 W.menus[2].sections[0].active=false
 W.menus[3].pricing='fisso';W.menus[3].active=false;W.menus[3].formulas=[{id:'5000cc00-5555-4555-8555-000000000001',name:'Completo',price:18,note:null,sectionIds:W.menus[3].sections.map((s:any)=>s.id),translations:{}},{id:'5000cc00-5555-4555-8555-000000000002',name:'Solo primo',price:11,note:null,sectionIds:[W.menus[3].sections[0].id],translations:{}}]
 return f})()
Object.assign(FIXTURES,{qasera})
