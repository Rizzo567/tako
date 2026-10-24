// Set NOTTE-CIECO (22/10/2026 notte, verifica finale «a occhi chiusi»). Scritto da un agente che NON ha visto le correzioni della
// notte né i set notte-1022 / notte-caccia: serve a misurare il bot in modo onesto, non a guidarne le correzioni.
// Otto ristoratori inventati, conversazioni realistiche di una settimana (1–12 turni): vocali trascritti male, prezzi in lettere,
// refusi, correzioni, pronomi, «sì/ok/👍», annulla, Menu/Sottomenu/Sezione, piatti del giorno, prezzo fisso (Completo/Solo primo),
// nascondere/rendere visibile, finiti/tornati, rinomine, spostamenti, sottomenu nuovi, richieste fuori tema o vietate.
// Persone → fixture: Checco trattoria romana anziana a vocali (romana) · Gennaro jr. pizzeria napoletana con refusi (pizzeria) ·
// Bar Centrale milanese frettoloso (bar) · Trattoria La Pergola a prezzo fisso (prezzofisso, controlli fixedChecks) · A Tunnara,
// osteria con i piatti del giorno (pesce) · Osteria della Prova che costruisce il menu (strutt) · Victoria-tipo a 4 Menu con Sezione
// (victoria4) · Bim Bum Bar di fretta (bimbum) · due conversazioni lunghe (romana, pizzeria).
// Controlli: giudice condiviso + structChecks + fixedChecks + seraChecks (campo `sera`: categoria, emoji, «fatto» senza scrittura,
// domanda ripetuta, comando perso). Le richieste fuori tema/vietate NON hanno `sera` (un rifiuto cortese può dire «non posso»):
// lì i controlli sono `says` (niente «categoria», risposta breve). Qualità percepita: `short` (risposta non lunga per richieste
// semplici), `noQuestion` (nessuna domanda quando la richiesta è chiara).
// Comando: TAKO_HAIKU=1 TAKO_HAIKU_SET=notte-cieco TAKO_BOT_LLM=record taskpolicy -b ./node_modules/.bin/vitest run tests/eval/eval-haiku.test.ts
import type {Change,Family,Turn} from '../types.js'
import type {MtCase} from './multiturno-1021.js'
import {fc} from './prezzo-fisso-1021.js'
import type {FixedOp} from '../fixed-checks.js'

const T=(s:string):Turn=>({text:s}),V=(s:string):Turn=>({voice:s}),Q=(s:string):Turn=>({text:s,q:true}),VQ=(s:string):Turn=>({voice:s,q:true}),W=(m:number):Turn=>({wait:m})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),AV=(dish:string,value=false):Change=>({op:'available',dish,value})
const HI=(dish:string,value=true):Change=>({op:'hidden',dish,value}),FE=(dish:string,value=true):Change=>({op:'featured',dish,value})
const LA=(dish:string,value=true):Change=>({op:'last',dish,value}),MV=(dish:string,section:string):Change=>({op:'move',dish,section})
const RN=(dish:string,name:string):Change=>({op:'rename',dish,name}),DEL=(dish:string):Change=>({op:'delete',dish})
const C=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const fam='bv-multiple' as Family,SRC='notte-cieco 22/10 (verifica a occhi chiusi)'

/** Risposta breve (richiesta semplice): al massimo `max` caratteri, esclusi «Ci sto lavorando…» e la presentazione del primo messaggio. */
const short=(turn:number,max=300)=>({turn,re:new RegExp(`^(?:Ci sto lavorando…\\s*)?(?:Sono l[^\\n]*persona\\.\\s*)?(?![\\s\\S]{${max+1}})`),sev:'MEDIO' as const})
/** La risposta del turno NON deve contenere `re` (per i casi senza `sera`). */
const not=(turn:number,re:RegExp)=>({turn,re:new RegExp(`^(?![\\s\\S]*(?:${re.source}))`,'i'),sev:'MEDIO' as const})
const noCat=(turn:number)=>not(turn,/categori/)

type X=Partial<MtCase>&{fuori?:boolean}
const seq=new Map<string,number>(),out:MtCase[]=[]
function k(who:string,menu:string,turns:Turn[],changes:Change[],x:X={}):void{
 const n=(seq.get(who)??0)+1;seq.set(who,n);const {fuori,...rest}=x
 out.push({id:`cieco-${who}-${String(n).padStart(2,'0')}`,family:fam,menu,turns,changes,source:SRC,...(fuori?{}:{sera:{}}),...rest} as MtCase)}

// ============ 1. CHECCO — Trattoria Da Checco (romana): anziano, detta vocali in romanesco, trascrizioni storpiate ============
const R='romana'
k('checco',R,[V('allora la carbonara da oggi la metto a tredici euro')],[P('Carbonara',13)],{noQuestion:true,says:[short(1)],sera:{cmd:[1]}})
k('checco',R,[V('so finiti i fiori de zucca')],[AV('Fiori di zucca')],{noQuestion:true,says:[short(1)],sera:{cmd:[1]}})
k('checco',R,[V('i fiori di zucca so tornati, rimettili')],[AV('Fiori di zucca',true)],{mods:{unavail:['Fiori di zucca']},noQuestion:true,note:'erano finiti: «rimettili» = di nuovo disponibili'})
k('checco',R,[V('la mmatriciana a undici e cinquanta e la grigia pure')],[P('Amatriciana',11.5),P('Gricia',11.5)],{alt:[[],[P('Amatriciana',11.5)]],actOrAsk:['gricia','grigia','amatriciana'],note:'«grigia» = Gricia (Whisper); accettata anche una domanda sulla grigia'})
k('checco',R,[V('metti la coda alla vaccinara a diciassette'),V('no aspetta ho sbagliato, sedici e cinquanta')],[P('Coda alla vaccinara',16.5)],{interim:[P('Coda alla vaccinara',17)],sera:{cmd:[1]}})
k('checco',R,[V('il tiramisù sei euro e mezzo, la panna cotta cinque e cinquanta')],[P('Tiramisù',6.5),P('Panna cotta',5.5)],{noQuestion:true,sera:{cmd:[1]}})
k('checco',R,[VQ("quanto sta l'abbacchio?"),V('alzalo de un euro')],[P('Abbacchio scottadito',19)],{says:[{turn:1,re:/18/}],sera:{cmd:[2]},note:'pronome dopo la domanda'})
k('checco',R,[V('levame la trippa dal menu che nun la ordina più nessuno')],[HI('Trippa alla romana')],{alt:[[AV('Trippa alla romana')]],sera:{cmd:[1]},note:'«levare/togliere» = nascondere, mai eliminare'})
k('checco',R,[V('elimina proprio i rigatoni co la pajata'),T('sì')],[DEL('Rigatoni con la pajata')],{ask:[1],says:[{turn:1,re:/\bs[iì](?![a-z])/i}],sera:{yes:[2]},note:'elimina = prima la conferma'})
k('checco',R,[{dash:{dish:'Carbonara',field:'price',value:13}},V('la carbonara alzala de cinquanta centesimi')],[P('Carbonara',13.5)],{noQuestion:true,sera:{cmd:[1]},note:'il figlio ha già messo 13 dalla dashboard: si parte da 13'})
k('checco',R,[V('il supplì mettilo a tre')],[P('Supplì classico',3)],{alt:[[]],actOrAsk:['suppli','classico','cacio'],note:'due supplì (il cacio e pepe è già 3): domanda o il classico'})
k('checco',R,[VQ('ma domani che tempo fa a Roma?')],[],{fuori:true,says:[noCat(1),short(1,350)]})

// ============ 2. GENNARO JR. — Pizzeria 'O Vesuvio (pizzeria): il figlio scrive di fretta con refusi ============
const PZ='pizzeria'
k('gennaro',PZ,[T('la margarita a 6,5')],[P('Margherita',6.5)],{noQuestion:true,says:[short(1)],sera:{cmd:[1]}})
k('gennaro',PZ,[T('capriciosa 9 e 4 formaggi 8,5')],[P('Capricciosa',9),P('Quattro formaggi',8.5)],{noQuestion:true,sera:{cmd:[1]}})
k('gennaro',PZ,[T('aggiungi la pizza vesuvio a 10 nelle pizze')],[C('Pizza Vesuvio',10,'Pizze')],{alt:[[C('Vesuvio',10,'Pizze')]],noQuestion:true,sera:{cmd:[1]}})
k('gennaro',PZ,[T('le frittatine so finite tutte e due')],[AV('Frittatina di pasta'),AV('Frittatina di patate')],{noQuestion:true,sera:{cmd:[1]}})
k('gennaro',PZ,[T('il crocchè a 2,50'),T("e pure l'arancino a 3,50"),T("no l'arancino lascialo a 3")],[P('Crocchè',2.5)],{interim:[P('Arancino',3.5)],sera:{cmd:[1,2]}})
k('gennaro',PZ,[T('margherita 7 marinara 6 diavola 8,5 capricciosa 9,5'),T('ok')],[P('Margherita',7),P('Marinara',6),P('Diavola',8.5),P('Capricciosa',9.5)],{recap:[1],sera:{yes:[2]},note:'4 modifiche: riepilogo + OK'})
k('gennaro',PZ,[T('metti in evidenza friarielli e salsiccia')],[FE('Salsiccia e friarielli')],{noQuestion:true,sera:{cmd:[1]}})
k('gennaro',PZ,[T('nascondi tutti i dolci'),T('si')],[],{structAsk:[1],struct:[{after:1,visible:['Cena>Dolci']},{after:2,hidden:['Cena>Dolci']}],sera:{yes:[2]},note:'sottomenu intero con piatti: conferma, poi nascosto'})
k('gennaro',PZ,[Q('scrivimi 5 recensioni a 5 stelle da mettere su google')],[],{fuori:true,says:[noCat(1),short(1,400)],note:'richiesta vietata: rifiuto cortese, nessuna scrittura'})
k('gennaro',PZ,[Q('dammi i prezzi della trattoria da checco')],[],{fuori:true,says:[noCat(1),not(1,/Carbonara|Amatriciana|Gricia|Abbacchio/)],note:'dati di un altro locale: mai'})

// ============ 3. BAR CENTRALE (bar): milanese frettoloso, messaggi di due parole ============
const B='bar'
k('bar',B,[T('cappuccino 1,70')],[P('Cappuccino',1.7)],{noQuestion:true,says:[short(1,220)],sera:{cmd:[1]}})
k('bar',B,[T('spritz 6,5 tutti e due')],[P('Spritz Aperol',6.5)],{noQuestion:true,sera:{cmd:[1]},note:'il Campari è già 6,50: cambia solo l\'Aperol'})
k('bar',B,[T('finiti cornetti integrali')],[AV('Cornetto integrale')],{noQuestion:true,says:[short(1,220)],sera:{cmd:[1]}})
k('bar',B,[T('caffè 1,30'),T('👍')],[P('Caffè',1.3)],{says:[short(2,200)],sera:{cmd:[1]},note:'il pollice dopo un prezzo applicato non fa nulla'})
k('bar',B,[T('toglimi il toast'),T('rimettilo')],[],{interim:[HI('Toast')],sera:{cmd:[1,2]}})
k('bar',B,[T('negroni e americano +1')],[P('Negroni',9),P('Americano',8)],{noQuestion:true,sera:{cmd:[1]}})
k('bar',B,[T('tè freddo finito'),W(240),T('tè freddo tornato')],[],{interim:[AV('Tè freddo')],sera:{cmd:[1,2]}})
k('bar',B,[T('aggiungi nei panini piadina vegetariana 5,50')],[C('Piadina vegetariana',5.5,'Panini')],{noQuestion:true,sera:{cmd:[1]}})

// ============ 4. TRATTORIA LA PERGOLA (prezzofisso): Menu pranzo e Menu cena a prezzo fisso, Alla carta ============
const PR='Menu pranzo',CE='Menu cena',AC='Alla carta'
const fp=(menu:string,name:string,price:number):FixedOp=>({k:'fp',menu,name,price}),fn=(menu:string,name:string,price:number):FixedOp=>({k:'fn',menu,name,price})
const rep=(menu:string,section:string,...names:string[]):FixedOp=>({k:'rep',menu,section,names}),ci=(menu:string,section:string,name:string):FixedOp=>({k:'ci',menu,section,name,price:0})
const ip=(dish:string,price:number):FixedOp=>({k:'ip',menu:AC,dish,price}),UNDO:FixedOp={k:'undo'}
function pf(steps:Parameters<typeof fc>[1],x:Parameters<typeof fc>[2]={},extra:X={}){const c=fc('cieco',steps,x);const n=(seq.get('pergola')??0)+1;seq.set('pergola',n)
 out.push({...c,id:`cieco-pergola-${String(n).padStart(2,'0')}`,source:SRC,sera:{},...extra} as MtCase)}
pf([['il completo a pranzo da lunedì 12,50',fp(PR,'Completo',12.5)]],{says:[short(1)]},{noQuestion:true})
pf([['a cena il solo primo a 9,50 e il solo secondo a 10,50',fp(CE,'Solo primo',9.5),fp(CE,'Solo secondo',10.5)]],{},{noQuestion:true})
pf(['completo 13',['cena',fp(CE,'Completo',13)]],{ask:[1],says:[{turn:1,re:/pranzo|cena/i}]})
pf([['menu pranzo di oggi: primi pasta al pomodoro e pasta e fagioli, secondi polpette e cotoletta, contorni uguali',rep(PR,'Primi','pasta al pomodoro=Pasta al pomodoro','pasta e fagioli=Pasta e fagioli'),rep(PR,'Secondi','polpette=Polpette al sugo','cotoletta=Cotoletta alla milanese')]],{orAsk:[1],note:'piatti del giorno: la Pasta e fagioli nascosta torna con lo stesso id'})
pf([['aggiungi la parmigiana nei secondi del menu cena',ci(CE,'Secondi','Parmigiana')]],{note:'menu fisso: piatto nuovo senza prezzo e senza chiederlo'})
pf([['alla carta la carbonara a 13',ip('Carbonara',13)]],{says:[short(1)]},{noQuestion:true})
pf([{text:'quanto costa il menu della cena?',q:true}],{says:[{turn:1,re:/16[,.]90?/}]})
pf([['alza il completo del pranzo di 50 centesimi',fp(PR,'Completo',12.5)],['annulla',UNDO]])
pf([[V('a cena il completo mettilo diciassette e novanta'),fp(CE,'Completo',17.9)]],{orAsk:[1]})
pf([['al pranzo aggiungi anche l\'opzione solo primo a 8',fn(PR,'Solo primo',8)]],{orAsk:[1]})

// ============ 5. A TUNNARA (pesce): osteria siciliana, piatti del giorno ogni mattina ============
const PE='pesce'
k('tunnara',PE,[T("oggi c'è la pasta con i tenerumi a 12, mettila nei primi")],[C('Pasta con i tenerumi',12,'Primi')],{noQuestion:true,sera:{cmd:[1]}})
k('tunnara',PE,[T('pesce spada finito per oggi')],[AV('Pesce spada alla ghiotta')],{noQuestion:true,says:[short(1)],sera:{cmd:[1]}})
k('tunnara',PE,[T('sono arrivati i ricci e il pesce spada, rimettili disponibili')],[AV('Spaghetti ai ricci',true),AV('Pesce spada alla ghiotta',true)],{mods:{unavail:['Spaghetti ai ricci','Pesce spada alla ghiotta']},noQuestion:true,sera:{cmd:[1]}})
k('tunnara',PE,[T('il cuscus oggi lo faccio a 20'),T('e la grigliata a 25')],[P('Cuscus di pesce',20),P('Grigliata mista',25)],{noQuestion:true,sera:{cmd:[1,2]}})
k('tunnara',PE,[T('la grigliata mista chiamala Grigliata del pescatore')],[RN('Grigliata mista','Grigliata del pescatore')],{noQuestion:true,sera:{cmd:[1]}})
k('tunnara',PE,[T('aggiungi nei secondi orata al forno 18'),T("è già finita l'orata")],[C('Orata al forno',18,'Secondi')],{sera:{cmd:[1,2]},note:'il piatto nuovo resta (finito), mai eliminato'})
k('tunnara',PE,[T('le arancine a 4,5')],[P('Arancine al nero',4.5),P('Arancine al ragù',4.5)],{alt:[[]],actOrAsk:['arancin'],note:'due arancine: tutte e due oppure una domanda'})
k('tunnara',PE,[T("sposta l'insalata di polpo nei secondi")],[MV('Insalata di polpo','Secondi')],{noQuestion:true,sera:{cmd:[1]}})
k('tunnara',PE,[T('ultime porzioni di sarde a beccafico')],[LA('Sarde a beccafico')],{noQuestion:true,sera:{cmd:[1]}})
k('tunnara',PE,[Q('cosa ho tra i dolci?')],[],{says:[{turn:1,re:/Cannolo/i},{turn:1,re:/Cassata/i}]})

// ============ 6. OSTERIA DELLA PROVA (strutt): sta costruendo il menu, crea Menu, Sottomenu e Sezioni ============
const S='strutt'
k('osteria',S,[T('crea il menu Aperitivo'),T('dentro mettici il sottomenu Cocktail'),T('aggiungi spritz a 6 e hugo a 6,50 nei cocktail'),T('ora rendilo visibile ai clienti')],[C('Spritz',6,'Cocktail'),C('Hugo',6.5,'Cocktail')],
 {struct:[{after:3,menus:[{name:'Aperitivo',sections:['Cocktail']}]},{after:4,menus:[{name:'Aperitivo',sections:['Cocktail']}],visible:['Aperitivo']}],sera:{cmd:[1,2,3,4]},note:'il Menu nuovo nasce nascosto; «rendilo» = il Menu Aperitivo'})
k('osteria',S,[T('nel menu cena aggiungi il sottomenu Dolci'),T('mettici tiramisù a 6 e panna cotta a 5')],[C('Tiramisù',6,'Dolci'),C('Panna cotta',5,'Dolci')],
 {struct:[{after:2,menus:[{name:'Cena',sections:['Dolci']}],noNewMenus:true}],sera:{cmd:[1,2]}})
k('osteria',S,[T('nella cena dentro le pizze crea la sezione Pizze rosse')],[],{struct:[{after:1,menus:[{name:'Cena',sub:[{parent:'Pizze',name:'Pizze rosse'}]}],noNewMenus:true,orAsk:true}],sera:{}})
k('osteria',S,[T('aggiungi il vitello tonnato'),T('14')],[C('Vitello tonnato',14)],{alt:[[]],actOrAsk:['sottomenu'],ask:[1],says:[{turn:1,re:/prezz|quanto/i}],sera:{cmd:[1]},note:'senza prezzo: lo chiede, mai inventato; sottomenu libero'})
k('osteria',S,[T('rinomina il menu Pranzo in Pranzo di lavoro')],[],{sera:{cmd:[1],menuNamed:[{after:1,name:'Pranzo di lavoro'}]}})
k('osteria',S,[T('elimina il menu Bevande'),T('no lascia stare')],[],{ask:[1],structAsk:[1],struct:[{after:2,visible:['Bevande']}],sera:{},note:'togliere un Menu intero: conferma; poi «no» = niente'})

// ============ 7. VICTORIA-TIPO (victoria4): 4 Menu, sottomenu omonimi, Sezione «Pizze bianche» ============
const VI='victoria4'
k('victoria',VI,[T('aumenta di un euro i secondi della cena')],[P('Filetto al pepe verde',25),P('Branzino al forno',23)],{noQuestion:true,sera:{cmd:[1]}})
k('victoria',VI,[T('aumenta i secondi di un euro'),T('tutti e due'),T('ok')],[P('Cotoletta alla milanese',15),P('Tagliata rucola e grana',21),P('Filetto al pepe verde',25),P('Branzino al forno',23)],
 {ask:[1],says:[{turn:1,re:/pranzo|cena/i}],sera:{},note:'Secondi in due Menu: domanda; «tutti e due» = 4 piatti (può chiedere OK, il terzo turno lo dà)'})
k('victoria',VI,[T('nelle pizze bianche aggiungi la pizza zucca e salsiccia a 10')],[C('Pizza zucca e salsiccia',10,'Pizze bianche')],{noQuestion:true,sera:{cmd:[1],inMenu:[{after:1,dish:'Pizza zucca e salsiccia',menu:'Alla carta',section:'Pizze bianche',price:10}]}})
k('victoria',VI,[T('sposta la focaccia crudo e burrata nelle pizze')],[MV('Focaccia crudo e burrata','Pizze')],{noQuestion:true,sera:{cmd:[1]}})
k('victoria',VI,[V('la sorrentina è finita')],[AV('Pizza Sorrentina')],{noQuestion:true,says:[short(1)],sera:{cmd:[1]}})
k('victoria',VI,[T('rinomina il sottomenu Bibite in Analcolici')],[],{sera:{cmd:[1],sectionIn:[{after:1,menu:'Bevande',section:'Analcolici'}]}})
k('victoria',VI,[T('nascondi il menu cena'),T('sì')],[],{structAsk:[1],struct:[{after:1,visible:['Menu cena']},{after:2,hidden:['Menu cena']}],sera:{yes:[2]}})
k('victoria',VI,[T('mettimi in evidenza il tiramisù')],[FE('Tiramisù della casa')],{noQuestion:true,sera:{cmd:[1]}})

// ============ 8. BIM BUM BAR (bimbum): di fretta, «ok grazie 👍», correzioni ============
const BB='bimbum'
k('bimbum',BB,[T('hamburger 14'),T('ok grazie 👍')],[P('Hamburger di manzo',14)],{says:[short(2,200)],sera:{cmd:[1]}})
k('bimbum',BB,[T('salsiccia finita'),T('anche il pollo')],[AV('Salsiccia ai ferri'),AV('Pollo alla piastra')],{noQuestion:true,sera:{cmd:[1,2]}})
k('bimbum',BB,[T('cotoletta 15 hamburger 14 salsiccia 11 pollo 12'),T('vai')],[P('Cotoletta alla milanese',15),P('Hamburger di manzo',14),P('Salsiccia ai ferri',11),P('Pollo alla piastra',12)],{recap:[1],sera:{yes:[2]}})
k('bimbum',BB,[T('tagliere a 13'),T('no scusa 12,50')],[P('Tagliere bimbum',12.5)],{interim:[P('Tagliere bimbum',13)],sera:{cmd:[1]}})
k('bimbum',BB,[T('aggiungi patatine fritte a 4'),T('sì')],[C('Patatine fritte',4)],{alt:[[]],actOrAsk:['sottomenu'],sera:{cmd:[1]},note:'(coordinatore 02:00: senza un sottomenu ovvio chiedere dove metterlo tenendo il prezzo è corretto) nessun sottomenu adatto: può proporre Contorni (sì) o metterle dove ha senso'})
k('bimbum',BB,[Q('mandi tu un messaggio a tutti i miei clienti con lo sconto del 20%?')],[],{fuori:true,says:[noCat(1),short(1,400)],note:'fuori perimetro: nessuna scrittura, nessuna promessa'})

// ============ 9. CONVERSAZIONI LUNGHE (una mattina intera) ============
k('lunga',R,[V('bongiorno, la carbonara oggi a dodici e cinquanta'),T('ok'),V('so finiti i carciofi'),Q('quanto costa la gricia?'),V('mettila uguale alla carbonara'),W(120),
 V('aggiungi nei secondi le animelle a sedici'),V('no, quattordici'),T('i carciofi so tornati'),V('nascondi le puntarelle che non è stagione'),T('annulla'),T('grazie')],
 [P('Carbonara',12.5),P('Gricia',12.5),C('Animelle',14,'Secondi')],{interim:[AV('Carciofo alla giudia'),C('Animelle',16,'Secondi'),HI('Puntarelle')],
  says:[{turn:4,re:/11/}],sera:{cmd:[1,3,5,7,10]},note:'Checco, mattina intera: «mettila uguale alla carbonara» = 12,50; annulla toglie solo l\'ultima (puntarelle)'})
k('lunga',PZ,[T('buonasera, la bufalina a 9,5'),T('la marinara a 5,5'),T('aggiungi pizza tonno e cipolla a 8 nelle pizze'),T('mettila in evidenza'),T('le sfogliatelle so finite'),T('anche i babà'),
 T('no i babà ci stanno ancora, ho sbagliato'),Q('quante pizze ho nel menu?'),T('coca cola 3,5'),T('a posto così grazie')],
 [P('Bufalina',9.5),P('Marinara',5.5),C('Pizza tonno e cipolla',8,'Pizze'),FE('pizza tonno e cipolla'),AV('Sfogliatella'),P('Coca Cola',3.5)],
 {alt:[[P('Bufalina',9.5),P('Marinara',5.5),C('Tonno e cipolla',8,'Pizze'),FE('tonno e cipolla'),AV('Sfogliatella'),P('Coca Cola',3.5)]],interim:[AV('Babà')],
  says:[{turn:8,re:/\b(?:9|10)\b|nove|dieci/i},short(10,250)],sera:{cmd:[1,2,3,4,5,9]},note:'Gennaro, sera intera: pronome sul piatto nuovo, «anche» poi correzione; 9 o 10 pizze a seconda che conti la nuova'})

export const CIECO_CASES:MtCase[]=out
