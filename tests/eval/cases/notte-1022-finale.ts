// Set FINALE a occhi chiusi n.2 (run notturna 22/10/2026): misura onesta delle 06:00, scritto da un agente che NON ha letto gli altri
// set notte-1022* e che non corregge il bot. NON usare per correggere il bot (solo per misurare).
// Conversazioni come le scriverebbero i ristoratori nella prima settimana d'uso: primo contatto, prezzi (cifre, lettere, «e mezzo»,
// relativi), finiti/tornati, nascondi/mostra, piatti nuovi, eliminazioni con sì, spostamenti, rinomine, descrizioni, prezzo fisso,
// multi-turno con pronomi/correzioni/annulla/domande in mezzo/dashboard/attese, vocali sporchi, dialetti, refusi, fuori tema.
// Controlli: giudice condiviso + struct + fixed (casi prezzo fisso) + seraChecks (casi con `sera`) + `says` (lunghezza, contenuto,
// mai «categoria»). Casi di capacità NON supportate (allergeni, foto, fuori tema) senza `sera`: lì un «non posso» onesto è giusto.
// Comando: TAKO_HAIKU=1 TAKO_HAIKU_SET=notte-finale TAKO_BOT_LLM=record taskpolicy -b ./node_modules/.bin/vitest run tests/eval/eval-haiku.test.ts
import type {Change,Family,Turn} from '../types.js'
import type {MtCase} from './multiturno-1021.js'
import {fc} from './prezzo-fisso-1021.js'
import type {FixedOp} from '../fixed-checks.js'

const T=(s:string):Turn=>({text:s}),V=(s:string):Turn=>({voice:s}),Q=(s:string):Turn=>({text:s,q:true})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),AV=(dish:string,value=false):Change=>({op:'available',dish,value})
const HI=(dish:string,value=true):Change=>({op:'hidden',dish,value}),C=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const RN=(dish:string,name:string):Change=>({op:'rename',dish,name}),MV=(dish:string,section:string):Change=>({op:'move',dish,section})
const DEL=(dish:string):Change=>({op:'delete',dish}),DESC=(dish:string,text:string):Change=>({op:'description',dish,text})
/** Risposta breve: al massimo n caratteri (il primo turno comprende la presentazione «Sono l'assistente automatico…», ~95 caratteri). */
const SHORT=(turn:number,n:number)=>({turn,re:new RegExp(`^[\\s\\S]{0,${n}}$`),sev:'MEDIO' as const})
/** Mai «categoria» verso il ristoratore (per i casi senza `sera`, dove l'invariante non gira). */
const NOCAT=(turn:number)=>({turn,re:/^(?![\s\S]*categori)/i,sev:'MEDIO' as const})
const SRC='finale a occhi chiusi n.2 (22/10 notte)'
const f=(id:string,family:string,menu:string,turns:Turn[],changes:Change[],x:Partial<MtCase>={}):MtCase=>({id:'fin-'+id,family:family as Family,menu,turns,changes,source:SRC,...x})

// ---- prezzo fisso (fixture prezzofisso: Alla carta · Menu pranzo fisso Completo 12 · Menu cena fisso Completo 16,90 / Solo primo 9 / Solo secondo 10) ----
const PR='Menu pranzo',CE='Menu cena',AC='Alla carta'
const fp=(menu:string,name:string,price:number):FixedOp=>({k:'fp',menu,name,price})
const rep=(menu:string,section:string,...names:string[]):FixedOp=>({k:'rep',menu,section,names})
const ci=(menu:string,section:string,name:string):FixedOp=>({k:'ci',menu,section,name,price:0})
const UNDO:FixedOp={k:'undo'}
const pf=(id:string,steps:Parameters<typeof fc>[1],x:Parameters<typeof fc>[2]&{sera?:MtCase['sera']}={}):MtCase=>{const c=fc('fin-'+id,steps,x) as MtCase;return{...c,id:'fin-pf-'+id,source:SRC,sera:x.sera??{}}}

export const FINALE_CASES:MtCase[]=[
 // ---------- 1. Primo contatto ----------
 f('ciao','bv-domande','romana',[Q('ciao')],[],{says:[SHORT(1,400)],sera:{},note:'saluto: risposta breve, si presenta e dice cosa può fare in una riga'}),
 f('cosa-sai-fare','bv-domande','pizzeria',[Q('buonasera, cosa sai fare?')],[],{says:[{turn:1,re:/prezz/i,sev:'MEDIO'},SHORT(1,650)],sera:{}}),
 f('come-funziona','bv-domande','bar',[Q('come funziona? devo scrivere in un modo preciso?')],[],{says:[SHORT(1,650)],sera:{},note:'risposta breve con un esempio; niente elenchi lunghi'}),
 f('posso-prezzi','bv-domande','anziano',[Q('posso cambiare i prezzi da qui?')],[],{says:[{turn:1,re:/\bs[iì]\b|puoi|certo|basta/i,sev:'MEDIO'},SHORT(1,500)],sera:{}}),
 f('ciao-poi-comando','bv-domande','pesce',[Q('ciao'),T('la caponata a 8')],[P('Caponata',8)],{says:[SHORT(2,250)],sera:{cmd:[2]}}),
 f('persona-o-robot','bv-domande','romana',[Q('ma sei una persona o un programma?')],[],{says:[{turn:1,re:/automatic|assistente|non sono una persona/i,sev:'MEDIO'},SHORT(1,450)],sera:{}}),
 f('prova-dopo-domanda','bv-domande','bar',[Q('cosa posso fare con te?'),T('ok proviamo: il cappuccino a 1,70')],[P('Cappuccino',1.7)],{says:[SHORT(2,250)],sera:{cmd:[2]}}),

 // ---------- 2. Prezzi ----------
 f('saluti-attorno','bv-semplici','romana',[T('buongiorno! oggi la carbonara a 13 grazie mille')],[P('Carbonara',13)],{noQuestion:true,says:[SHORT(1,320)],sera:{cmd:[1]}}),
 f('lettere','bv-semplici','anziano',[T("l'amatriciana mettila a dodici euro")],[P('Amatriciana',12)],{noQuestion:true,says:[SHORT(1,320)],sera:{cmd:[1]}}),
 f('e-mezzo','bv-semplici','romana',[T('gricia undici e mezzo')],[P('Gricia',11.5)],{noQuestion:true,sera:{cmd:[1]}}),
 f('piu-uno','bv-semplici','pizzeria',[T('diavola +1')],[P('Diavola',8.5)],{noQuestion:true,sera:{cmd:[1]},note:'«+1» = un euro in più'}),
 f('uno-in-piu','bv-semplici','bar',[T("lo spritz aperol mettilo uno in più")],[P('Spritz Aperol',7)],{alt:[[]],sera:{cmd:[1]},note:'«uno in più» = +1 €; una domanda è accettata'}),
 f('scontalo','bv-semplici','romana',[T('la coda alla vaccinara scontala a 14 questa settimana')],[P('Coda alla vaccinara',14)],{alt:[[{op:'promo',dish:'Coda alla vaccinara',price:14}],[]],sera:{cmd:[1]},note:'prezzo a 14 o promo a 14; una domanda è accettata'}),
 f('dolci-meno-50','bv-multiple','pizzeria',[T('abbassa tutti i dolci di 50 centesimi'),T('ok')],[P('Babà',4),P('Sfogliatella',2.5),P('Delizia al limone',4.5),P('Tiramisù',4.5)],{sera:{cmd:[1]},note:'gruppo: applicato subito o dopo l\'ok, mai doppio'}),
 f('simbolo-euro','bv-semplici','pesce',[T('busiate 13,50€')],[P('Busiate al pesto trapanese',13.5)],{noQuestion:true,sera:{cmd:[1]}}),
 f('due-prezzi','bv-multiple','anziano',[T('carbonara 13 e gricia 12')],[P('Carbonara',13),P('Gricia',12)],{noQuestion:true,says:[SHORT(1,400)],sera:{cmd:[1]}}),
 f('prezzo-assurdo','bv-semplici','anziano',[T('la carbonara a 1300')],[],{sera:{},note:'prezzo insolito: domanda o riepilogo con OK, mai scritto'}),
 f('recap-cinque','bv-multiple','anziano',[T('allora: carbonara 13, gricia 12, cacio e pepe 11, lasagna 12 e il saltimbocca è finito'),T('ok')],[P('Carbonara',13),P('Gricia',12),P('Cacio e pepe',11),P('Lasagna',12),AV('Saltimbocca alla romana')],{recap:[1],sera:{yes:[2]},note:'oltre 3 modifiche: riepilogo, poi tutto all\'ok'}),

 // ---------- 3. Finiti / tornati / nascondi / mostra ----------
 f('finiti-ricci','bv-semplici','pesce',[T('ragazzi oggi sono finiti i ricci')],[AV('Spaghetti ai ricci')],{noQuestion:true,says:[SHORT(1,320)],sera:{}}),
 f('tornate-puntarelle','bv-semplici','romana',[T('sono tornate le puntarelle')],[AV('Puntarelle',true)],{mods:{unavail:['Puntarelle']},noQuestion:true,sera:{}}),
 f('nascondi-ginseng','bv-semplici','bar',[T('nascondi il ginseng che la macchinetta è rotta')],[HI('Ginseng')],{noQuestion:true,sera:{cmd:[1]}}),
 f('rimetti-ripieno','bv-semplici','pizzeria',[T('rimetti il ripieno al forno nel menu')],[HI('Ripieno al forno',false)],{mods:{hidden:['Ripieno al forno']},noQuestion:true,sera:{}}),
 f('finiti-due','bv-multiple','anziano',[T('finiti abbacchio e coda')],[AV('Abbacchio scottadito'),AV('Coda alla vaccinara')],{noQuestion:true,sera:{}}),
 f('togli-panelle','bv-semplici','pesce',[T('togli le panelle')],[HI('Panelle')],{noQuestion:true,sera:{cmd:[1]},note:'«togli» = nascondi, mai elimina'}),

 // ---------- 4. Piatti nuovi ----------
 f('nuovo-completo','bv-aggiunte','pesce',[T('aggiungi nei secondi il tonno alla griglia a 18')],[C('Tonno alla griglia',18,'Secondi')],{noQuestion:true,sera:{cmd:[1]}}),
 f('nuovo-senza-prezzo','bv-aggiunte','romana',[T('aggiungi nei primi le fettuccine ai funghi'),T('14')],[C('Fettuccine ai funghi',14,'Primi')],{ask:[1],sera:{cmd:[1]},note:'chiede solo il prezzo; mai un prezzo inventato'}),
 f('nuovo-senza-sottomenu','bv-aggiunte','bar',[T('aggiungi lo Spritz Hugo a 6,50')],[C('Spritz Hugo',6.5)],{sera:{cmd:[1]},note:'il sottomenu ovvio (Aperitivi) senza domande'}),
 f('nuovo-vocale','bv-aggiunte','pizzeria',[V('aggiungi nelle pizze la mortadella e pistacchio a undici euro')],[C('Mortadella e pistacchio',11,'Pizze')],{alt:[[C('Pizza mortadella e pistacchio',11,'Pizze')]],sera:{cmd:[1]}}),
 f('nuovo-sottomenu-nuovo','bv-categorie','bimbum',[T("aggiungi un'insalatona a 9 in un sottomenu nuovo che si chiama Insalate"),T('sì')],[C('Insalatona',9,'Insalate')],{struct:[{after:2,menus:[{name:'Menu',sections:['Insalate']}],noNewMenus:true}],sera:{cmd:[1]}}),
 f('nuovo-menu-nominato','bv-aggiunte','strutt',[T('nella cena aggiungi i paccheri allo scoglio a 16 nei primi')],[C('Paccheri allo scoglio',16,'Primi')],{noQuestion:true,sera:{cmd:[1],inMenu:[{after:1,dish:'Paccheri allo scoglio',menu:'Cena',section:'Primi',price:16}]}}),
 f('nuovo-proposta-dolci','bv-categorie','strutt',[T('a pranzo aggiungi la panna cotta a 5'),T('ok')],[C('Panna cotta',5,'Dolci')],{struct:[{after:2,menus:[{name:'Pranzo',sections:['Dolci']}],noNewMenus:true}],sera:{cmd:[1],inMenu:[{after:2,dish:'Panna cotta',menu:'Pranzo',price:5}]},note:'nel Pranzo non ci sono Dolci: propone il sottomenu, «ok» lo crea col piatto'}),

 // ---------- 5. Eliminazioni ----------
 f('elimina-si','bv-elimina','romana',[T('elimina la trippa'),T('sì')],[DEL('Trippa alla romana')],{ask:[1],sera:{cmd:[1],yes:[2]}}),
 f('elimina-ci-ripensa','bv-elimina','pizzeria',[T('cancella la montanarina dal menu'),T('no aspetta, lasciala')],[],{ask:[1],sera:{cmd:[1]}}),
 f('elimina-pollice','bv-elimina','bar',[T('elimina il toast'),T('👍')],[DEL('Toast')],{ask:[1],sera:{cmd:[1],yes:[2]},note:'il pollice su vale sì'}),

 // ---------- 6. Spostamenti, rinomine, descrizioni ----------
 f('sposta','bv-categorie','romana',[T('sposta la parmigiana nei secondi')],[MV('Parmigiana di melanzane','Secondi')],{noQuestion:true,sera:{cmd:[1]}}),
 f('rinomina-piatto','bv-categorie','pizzeria',[T('la crocchè chiamala Crocchè di patate')],[RN('Crocchè','Crocchè di patate')],{noQuestion:true,sera:{cmd:[1]}}),
 f('rinomina-sottomenu','bv-categorie','bar',[T('rinomina il sottomenu Panini in Panini e toast')],[],{sera:{cmd:[1],sectionIn:[{after:1,menu:'Bar',section:'Panini e toast'}]}}),
 f('rinomina-menu','bv-categorie','anziano',[T('il menu Pranzo e cena chiamalo Menu della casa')],[],{sera:{cmd:[1],menuNamed:[{after:1,name:'Menu della casa'}]}}),
 f('descrizione','bv-semplici','romana',[T('nella descrizione della carbonara scrivi: guanciale, pecorino romano, uovo e pepe nero')],[DESC('Carbonara','guanciale, pecorino romano, uovo e pepe nero')],{noQuestion:true,sera:{cmd:[1]}}),
 f('ingredienti','bv-semplici','romana',[T('alla gricia metti come ingredienti guanciale e pecorino')],[DESC('Gricia','guanciale e pecorino')],{alt:[[DESC('Gricia','Ingredienti: guanciale e pecorino')],[DESC('Gricia','guanciale, pecorino')]],sera:{cmd:[1]},note:'ingredienti = descrizione del piatto'}),
 f('allergeni','bv-fuori','pesce',[Q('posso segnare gli allergeni sui piatti?')],[],{says:[SHORT(1,500),NOCAT(1)],note:'capacità non supportata o parziale (tag/descrizione): risposta onesta e breve, nessuna scrittura'}),
 f('foto','bv-fuori','pizzeria',[Q('come faccio a mettere la foto della margherita?')],[],{says:[SHORT(1,500),NOCAT(1)],note:'risposta onesta e breve'}),

 // ---------- 7. Prezzo fisso ----------
 pf('completo-cena',[['il completo della cena passa a 18',fp(CE,'Completo',18)]]),
 pf('completo-ambiguo',['il completo a 13 euro',['pranzo',fp(PR,'Completo',13)]],{ask:[1],says:[{turn:1,re:/pranzo|cena/i}]}),
 pf('oggi-pranzo',[['oggi a pranzo primi pasta e fagioli e risotto alla milanese, secondi cotoletta, contorni patate',rep(PR,'Primi','pasta e fagioli=Pasta e fagioli','risotto alla milanese=Risotto alla milanese'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese'),rep(PR,'Contorni','patate=Patate al forno')]],{note:'piatti di oggi in un messaggio: Pasta e fagioli (nascosta da ieri) torna con lo stesso id'}),
 pf('nuovo-cena',[['a cena aggiungi nei primi i ravioli burro e salvia',ci(CE,'Primi','Ravioli burro e salvia')]],{note:'menu fisso: piatto nuovo senza prezzo, mai chiesto il prezzo'}),
 pf('solo-secondo-relativo',[['alza il solo secondo della cena di 50 centesimi',fp(CE,'Solo secondo',10.5)]]),
 pf('alla-carta',[['la carbonara alla carta a 13',{k:'ip',menu:AC,dish:'Carbonara',price:13}]]),
 pf('annulla',[['il completo del pranzo a 12,50',fp(PR,'Completo',12.5)],['annulla',UNDO]]),
 pf('primi-correzione',['cambiamo i primi del pranzo di oggi',["pasta al pomodoro e penne all'arrabbiata",rep(PR,'Primi','pasta al pomodoro=Pasta al pomodoro',"penne all'arrabbiata=Penne all'arrabbiata")],['no, al posto delle penne metti il risotto alla milanese',rep(PR,'Primi','pasta al pomodoro=Pasta al pomodoro','risotto alla milanese=Risotto alla milanese')]],{orAsk:[2],note:'correzione della sostituzione: le penne tornano nascoste, il risotto visibile'}),

 // ---------- 8. Multi-turno ----------
 f('pronome','bv-deixis','romana',[Q('quanto costa la cacio e pepe?'),T('mettila a 12')],[P('Cacio e pepe',12)],{sera:{cmd:[2]}}),
 f('intendevo','bv-correzioni','pizzeria',[T('la marinara a 6,50'),T('no scusa intendevo la margherita a 6,50, la marinara resta a 5')],[P('Margherita',6.5)],{interim:[P('Marinara',6.5)],sera:{cmd:[1,2]}}),
 f('annulla','bv-annulla','bar',[T('il negroni a 9'),T('annulla')],[],{interim:[P('Negroni',9)],sera:{cmd:[1]}}),
 f('risponde-alla-domanda','bv-deixis','bar',[T('lo spritz a 7'),T('aperol')],[P('Spritz Aperol',7)],{ask:[1],sera:{cmd:[1]},note:'due spritz: una domanda, «aperol» la chiude'}),
 f('cambio-argomento','bv-multiple','pesce',[T('aggiungi la tartare di tonno negli antipasti'),T('ah è finita la cassata'),T('16')],[AV('Cassata'),C('Tartare di tonno',16,'Antipasti')],{ask:[1],alt:[[AV('Cassata')]],sera:{cmd:[2]},note:'la cassata va eseguita subito; il «16» può completare la tartare o essere chiesto'}),
 f('domanda-in-mezzo','bv-deixis','anziano',[T('la lasagna a 12'),Q('e il tiramisù quanto sta?'),T('mettilo a 6,50')],[P('Lasagna',12),P('Tiramisù',6.5)],{sera:{cmd:[1,3]}}),
 f('va-bene-grazie','bv-multiple','bimbum',[T('aggiungi nei secondi la tagliata a 18'),T('va bene'),T('grazie')],[C('Tagliata',18,'Secondi')],{sera:{cmd:[1]},note:'«va bene»/«grazie» dopo un fatto non scrivono nulla e non duplicano'}),
 f('giornata-lunga','bv-multiple','romana',[Q('buongiorno'),T('oggi carbonara a 13'),T("e l'amatriciana a 12"),T('finite le puntarelle'),Q('quanto costa la gricia?'),T('portala a 12 pure lei'),T('aggiungi nei dolci i tozzetti a 4'),T('no scusa a 4,50'),T('nascondi il maritozzo'),T('anzi no lascialo'),T('il caffè a 1,60'),Q('ok basta così grazie')],
  [P('Carbonara',13),P('Amatriciana',12),AV('Puntarelle'),P('Gricia',12),C('Tozzetti',4.5,'Dolci'),P('Caffè',1.6)],{interim:[C('Tozzetti',4,'Dolci'),HI('Maritozzo con la panna')],sera:{cmd:[2,3,4,6,7,9,11]},note:'12 turni: correzione del prezzo di un piatto appena creato, «anzi no» rimette il maritozzo'}),
 f('dashboard-in-mezzo','bv-deixis','romana',[T('la carbonara a 13'),{dash:{dish:'Amatriciana',field:'price',value:12}},T("metti la gricia come l'amatriciana")],[P('Carbonara',13),P('Gricia',12)],{sera:{cmd:[1,2]},note:'l\'amatriciana è stata portata a 12 dalla dashboard: la gricia segue il prezzo attuale'}),
 f('attesa-lunga','bv-multiple','pesce',[T('aggiungi negli antipasti il polpo alla luciana'),{wait:120},T('ciao, la caponata a 7,50')],[P('Caponata',7.5)],{ask:[1],sera:{cmd:[2]},note:'dopo 2 ore il 7,50 è della caponata: il polpo non nasce con quel prezzo'}),

 // ---------- 9. Vocali, dialetti, refusi ----------
 f('voce-romanesco','bv-asr','anziano',[V('eh la carbonara… mettece tredici')],[P('Carbonara',13)],{alt:[[]],actOrAsk:['carbonara'],sera:{}}),
 f('romano','bv-dialetto','romana',[T("aò, l'abbacchio da oggi sta a diciannove")],[P('Abbacchio scottadito',19)],{noQuestion:true,sera:{}}),
 f('napoletano','bv-dialetto','pizzeria',[T("uè, 'a capricciosa mettila a nove euro, e 'e sfogliatelle so' fernute")],[P('Capricciosa',9),AV('Sfogliatella')],{sera:{cmd:[1]}}),
 f('milanese','bv-dialetto','bar',[T('ué, il cornetto integrale a un euro e sessanta, va bene?')],[P('Cornetto integrale',1.6)],{sera:{cmd:[1]},note:'«va bene?» è un intercalare, non una domanda vera'}),
 f('siciliano','bv-dialetto','pesce',[T('u pisci spada a 19 mettilo')],[P('Pesce spada alla ghiotta',19)],{noQuestion:true,sera:{}}),
 f('veneto','bv-dialetto','bimbum',[T('ciò, la salsiccia ai ferri xe finia')],[AV('Salsiccia ai ferri')],{sera:{}}),
 f('voce-storpiata','bv-asr','pesce',[V('le busiate al pesto trapani si a 14 euro')],[P('Busiate al pesto trapanese',14)],{alt:[[]],actOrAsk:['busiate'],sera:{}}),
 f('maiuscole','bv-semplici','romana',[T("IL TIRAMISU' A 6 E 50")],[P('Tiramisù',6.5)],{noQuestion:true,sera:{}}),
 f('refuso','bv-semplici','pizzeria',[T('la quattro formagi a 8.50')],[P('Quattro formaggi',8.5)],{noQuestion:true,sera:{}}),
 f('voce-due-prezzi','bv-asr','bar',[V('allora il caffè macchiato uno e quaranta e lorzo uno e cinquanta')],[P('Caffè macchiato',1.4),P('Orzo',1.5)],{alt:[[P('Caffè macchiato',1.4)],[]],sera:{}}),

 // ---------- 10. Fuori tema ----------
 f('meteo','bv-fuori','romana',[Q('che tempo fa domani a roma?')],[],{says:[SHORT(1,400),NOCAT(1)]}),
 f('recensione','bv-fuori','pizzeria',[Q('scrivimi una risposta per una recensione negativa su google')],[],{says:[SHORT(1,450),NOCAT(1)]}),
 f('altro-locale','bv-fuori','bar',[Q('quanto fa pagare lo spritz il bar di fronte?')],[],{says:[SHORT(1,400),NOCAT(1)]}),
]
