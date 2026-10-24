// Set NOTTE-1022 (motore Haiku, run notturna 22/10/2026, fase 1 difficoltà media): frasi realistiche di ristoratore fatte per mettere
// in difficoltà il bot — parlato, dialetto leggero, refusi, vocali storpiati, più richieste in un messaggio, ripensamenti, pronomi,
// prezzi scritti in modi strani, nomi simili, Menu e sottomenu con lo stesso nome, prezzo fisso, sessioni, «annulla», domande pure.
// Fixture: `notte` (inventata, nomi simili), `qasera` (forma del QA), `prezzofisso` (via fc). Controlli: giudice + struct + sera + fixed.
// Comando: TAKO_HAIKU=1 TAKO_HAIKU_SET=notte-1022 TAKO_BOT_LLM=replay|record taskpolicy -b ./node_modules/.bin/vitest run tests/eval/eval-haiku.test.ts
import type {Change,Family,Turn} from '../types.js'
import type {MtCase} from './multiturno-1021.js'
import {fc} from './prezzo-fisso-1021.js'
import type {FixedOp} from '../fixed-checks.js'

const T=(s:string):Turn=>({text:s}),V=(s:string):Turn=>({voice:s}),Q=(s:string):Turn=>({text:s,q:true}),QV=(s:string):Turn=>({voice:s,q:true})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const AV=(dish:string,value:boolean):Change=>({op:'available',dish,value})
const C=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const fam='bv-multiple' as Family
const nc=(id:string,menu:string,turns:Turn[],changes:Change[],x:Partial<MtCase>={}):MtCase=>({id:'n-'+id,family:fam,menu,turns,changes,source:'notte 22/10 (fixture inventata)',sera:{},...x})
const N=(id:string,turns:Turn[],changes:Change[],x:Partial<MtCase>={})=>nc(id,'notte',turns,changes,x)
const QS=(id:string,turns:Turn[],changes:Change[],x:Partial<MtCase>={})=>nc(id,'qasera',turns,changes,x)

export const NOTTE_BASE:MtCase[]=[
 // prezzi scritti in modi strani
 N('prezzo-parole',[T('la carbonara mettila a dodici e cinquanta')],[P('Carbonara',12.5)],{sera:{cmd:[1]}}),
 N('prezzo-punto',[T('amatriciana 12.5')],[P('Amatriciana',12.5)],{sera:{cmd:[1]}}),
 N('prezzo-mezzo',[T('la gricia a 12 euro e mezzo')],[P('Gricia',12.5)],{sera:{cmd:[1]}}),
 N('prezzo-euro',[T('tagliata 19,50€')],[P('Tagliata',19.5)],{sera:{cmd:[1]}}),
 N('prezzo-a-e',[V('la diavola a 9 e 50')],[P('Diavola',9.5)],{sera:{cmd:[1]}}),
 N('prezzo-voce',[V('cotoletta quattordici e novanta')],[P('Cotoletta',14.9)],{alt:[[]],sera:{cmd:[1]},note:'Cotoletta è il nome esatto; una domanda tra le due cotolette è accettata'}),
 N('prezzo-centesimi',[T('abbassa la birra media di cinquanta centesimi')],[P('Birra media',4.5)],{sera:{cmd:[1]}}),
 N('prezzo-due-voce',[V("l'acqua a due e cinquanta e la coca a tre e ottanta")],[P('Acqua',2.5),P('Coca Cola',3.8)],{sera:{cmd:[1]}}),
 // nomi simili
 N('simile-pistacchio',[T('il tiramisù al pistacchio a 8')],[P('Tiramisù al pistacchio',8)],{sera:{cmd:[1]}}),
 N('simile-tiramisu',[T('tiramisù a 6,50')],[P('Tiramisù',6.5)],{alt:[[]],sera:{cmd:[1]}}),
 N('simile-margherita',[T('margherita a 7,50')],[P('Margherita',7.5)],{alt:[[]],sera:{cmd:[1]}}),
 N('simile-bufala',[T('la bufala a 9,50')],[P('Margherita bufala',9.5)],{alt:[[]],sera:{cmd:[1]}}),
 N('simile-mare-voce',[V('metti la carbonera di mare a sedici')],[P('Carbonara di mare',16)],{sera:{cmd:[1]}}),
 N('simile-scalare',[T('abbassa il tiramisù di cinquanta centesimi')],[P('Tiramisù',5.5)],{alt:[[]],sera:{cmd:[1]}}),
 // pronomi e riferimenti
 N('pronome-prima',[Q('quanto costa la carbonara di mare?'),T('mettila a 16')],[P('Carbonara di mare',16)],{sera:{cmd:[2]}}),
 N('pronome-anche',[T('la marinara a 6,50'),T('stesso prezzo anche alla napoli')],[P('Marinara',6.5),P('Napoli',6.5)],{sera:{cmd:[1,2]}}),
 N('pronome-quello-prima',[T('nascondi il supplì'),T('e la crocchetta pure'),T('anzi quello di prima rimettilo')],[HI('Crocchetta')],{alt:[[HI('Crocchetta'),HI('Supplì')]],sera:{cmd:[1,2,3]},note:'«quello di prima» = il Supplì; una domanda tra i due è accettata'}),
 N('domanda-poi-comando',[Q('quanto sta la birra?'),T('mettila a 5,50')],[P('Birra media',5.5)],{sera:{cmd:[2]}}),
 // più richieste in un messaggio, ripensamenti
 N('multi-tre',[T('alza la carbonara a 13, nascondi la gricia e la coca a 4')],[P('Carbonara',13),HI('Gricia'),P('Coca Cola',4)],{sera:{cmd:[1]}}),
 N('ripensa-stesso',[T('la tagliata a 20... no anzi 19')],[P('Tagliata',19)],{sera:{cmd:[1]}}),
 N('ripensa-turni',[T('supplì a 3'),T('no scusa, a 2,80')],[P('Supplì',2.8)],{interim:[P('Supplì',3)],sera:{cmd:[1,2]}}),
 N('lungo-motivato',[T("ciao allora volevo dirti che da domani la carbonara costa 13 euro perché il guanciale è aumentato, e già che ci sei anche l'amatriciana a 12"),T('sì')],[P('Carbonara',13),P('Amatriciana',12)],{ask:[1],sera:{cmd:[1],yes:[2]},note:'«da domani»: il bot non programma, chiede «Lo cambio subito?» con le azioni in attesa; il sì le applica'}),
 N('dialetto',[T('mett a carbonar a 13 e a gricia pur'),T('1')],[P('Carbonara',13),P('Gricia',13)],{sera:{cmd:[1]},note:'«carbonar» può valere la domanda Carbonara / Carbonara di mare: la Gricia non va persa, «1» applica entrambe'}),
 N('refusi',[T('amatriciàna a 11,50 e la cotolleta a 15')],[P('Amatriciana',11.5),P('Cotoletta',15)],{alt:[[P('Amatriciana',11.5)]],sera:{cmd:[1]},note:'«cotolleta» può valere una domanda tra le due cotolette'}),
 N('voce-nascondi',[V('la gritcia la nascondi')],[HI('Gricia')],{sera:{cmd:[1]}}),
 N('esaurito',[T('la tagliata è finita per oggi')],[AV('Tagliata',false)],{alt:[[HI('Tagliata')]],sera:{cmd:[1]}}),
 N('esaurito-tornato',[T('la tagliata è finita'),T('no aspetta è arrivata la carne, rimettila')],[],{interim:[AV('Tagliata',false),HI('Tagliata')],sera:{cmd:[1,2]}}),
 N('grazie-dopo',[T('birra media a 5,50'),T('grazie mille')],[P('Birra media',5.5)],{sera:{cmd:[1]}}),
 N('rinomina',[T('la cotoletta chiamala cotoletta alla milanese')],[{op:'rename',dish:'Cotoletta',name:'Cotoletta alla milanese'}],{sera:{cmd:[1]}}),
 // annulla in momenti strani
 N('annulla-dopo',[T('nascondi la capricciosa'),T('annulla')],[],{interim:[HI('Capricciosa')],sera:{cmd:[1]}}),
 N('annulla-domanda',[T('metti la pizza a 8'),T('annulla')],[],{ask:[1]}),
 N('annulla-poi-comando',[T('nel menu cena alza le pizze di 1 euro'),T('annulla'),T('alza solo la napoli di 1 euro')],[P('Napoli',8.5)],{interim:[P('Marinara',7)],sera:{cmd:[1,3]}}),
 N('annulla-a-meta-sessione',[T('carbonara a 13'),T('amatriciana a 12'),T('annulla l\'ultima')],[P('Carbonara',13)],{interim:[P('Amatriciana',12)],sera:{cmd:[1,2]}}),
 // Menu e sottomenu con lo stesso nome
 N('omonimo-cena',[T('aggiungi la bufalina a 9 nelle pizze della cena')],[C('Bufalina',9,'Pizze')],{sera:{cmd:[1],inMenu:[{after:1,dish:'Bufalina',menu:'Cena',section:'Pizze',price:9}]}}),
 N('omonimo-menu',[T('aggiungi la quattro stagioni a 9 nel menu pizze')],[C('Quattro stagioni',9,'Pizze')],{sera:{cmd:[1],inMenu:[{after:1,dish:'Quattro stagioni',menu:'Pizze',section:'Pizze',price:9}]}}),
 N('omonimo-ambiguo',[T('aggiungi la boscaiola a 9 nelle pizze')],[C('Boscaiola',9,'Pizze')],{alt:[[]],note:'Menu Pizze o Pizze della Cena: va bene scegliere il Menu Pizze o chiedere'}),
 N('menu-cena-pizze-aumento',[T('nel menu cena alza le pizze di 50 centesimi')],[P('Marinara',6.5),P('Napoli',8)],{sera:{cmd:[1]}}),
 // piatti nuovi
 N('nuovo-parole',[T('aggiungi nei secondi del pranzo la salsiccia e friarielli a tredici euro')],[C('Salsiccia e friarielli',13,'Secondi')],{sera:{cmd:[1],inMenu:[{after:1,dish:'Salsiccia e friarielli',menu:'Pranzo',section:'Secondi',price:13}]}}),
 N('nuovo-senza-prezzo',[T('aggiungi il cacio e pepe nei primi del pranzo'),T('11')],[C('Cacio e pepe',11,'Primi')],{ask:[1],sera:{cmd:[1]}}),
 N('nuovo-cambio-argomento',[T('aggiungi il cacio e pepe nei primi del pranzo'),T('ah la coca mettila a 4')],[P('Coca Cola',4)],{sera:{cmd:[1,2]}}),
 // sessione a più messaggi
 N('sessione-lunga',[T('allora oggi facciamo così'),T('carbonara a 13'),T('amatriciana pure'),T('e la gricia la togli'),Q('fatto?')],[P('Carbonara',13),P('Amatriciana',13),HI('Gricia')],{alt:[[P('Carbonara',13),P('Amatriciana',13),{op:'delete',dish:'Gricia'}],[P('Carbonara',13),P('Amatriciana',13),AV('Gricia',false)]],sera:{cmd:[2,3,4],notSay:[{turn:5,re:/disponibile|nascosto/}]}}),
 // domande pure: nessuna scrittura
 N('domanda-costo',[Q('quanto costa la carbonara?')],[]),
 N('domanda-oggi',[Q("cosa c'è oggi nel menu del pranzo?")],[]),
 N('domanda-voce',[QV('quanto viene la margherita bufala')],[]),
 N('domanda-saluto',[Q('buonasera')],[]),
 N('domanda-pizze',[Q('quante pizze ho nel menu pizze?')],[]),
 // qasera (forma del QA)
 QS('parmigiana-simile',[T('la parmigiana a 14')],[P('la parmigiana',14)],{sera:{cmd:[1]}}),
 QS('pesto-simile',[T('pasta al pesto 12')],[P('pasta al pesto',12)],{alt:[[]],sera:{cmd:[1]}}),
 QS('menu-giorno-domanda',[Q('quanto costa il menu del giorno?')],[]),
 QS('lasagne-parole',[T('aggiungi nel menu pranzo le lasagne a dodici e cinquanta'),T('si')],[C('Lasagna',12.5,'Primi')],{alt:[[C('Lasagne',12.5,'Primi')],[C('Lasagna',12.5,'Completo')],[C('Lasagne',12.5,'Completo')]],sera:{cmd:[1]}}),
 QS('tiramisu-voce',[V('il tiramisu mettilo a dodici euro')],[P('tiramisù',12)],{sera:{cmd:[1]}}),
 // giro 2: gruppi (sottomenu detto al plurale), data futura, «annulla»/«no» su una domanda aperta, ripensamenti in sessione
 N('gruppo-dolci',[T('alza i dolci di 50 centesimi')],[P('Tiramisù',6.5),P('Tiramisù al pistacchio',7.5)],{sera:{cmd:[1]}}),
 N('gruppo-fritti-voce',[V('abbassa i fritti di cinquanta centesimi')],[P('Supplì',2),P('Crocchetta',1.5)],{sera:{cmd:[1]}}),
 N('gruppo-pizze-due-menu',[T('alza le pizze di 1 euro'),T('quelle del menu pizze')],[P('Margherita',8),P('Margherita bufala',10),P('Diavola',9.5),P('Capricciosa',10)],{ask:[1],sera:{cmd:[1]},note:'«Pizze» è un sottomenu in due Menu: si chiede quale'}),
 N('annulla-lascia-stare',[T('aggiungi la burrata nei fritti'),T('lascia stare')],[],{ask:[1],sera:{notSay:[{turn:2,re:/\?/}]}}),
 N('domanda-su-domanda',[T('metti la pizza a 8'),Q('quanto costa la diavola?')],[],{ask:[1]}),
 N('data-futura-no',[T('da lunedì la gricia a 12'),T('no')],[],{ask:[1],sera:{notSay:[{turn:2,re:/\?/}]}}),
 N('data-futura-voce',[V('da domani la tagliata a venti euro'),T('si')],[P('Tagliata',20)],{ask:[1],sera:{cmd:[1],yes:[2]}}),
 N('sessione-ripensa-prezzo',[T('carbonara 13'),T('amatriciana 12'),T('no aspetta la carbonara a 12,50')],[P('Carbonara',12.5),P('Amatriciana',12)],{interim:[P('Carbonara',13)],sera:{cmd:[1,2,3]}}),
 N('dialetto-margherita',[V('a margarit mettil a otto')],[P('Margherita',8)],{alt:[[]],sera:{cmd:[1]}}),
 N('parte-sconosciuta',[T('la diavola a 9 e la pizza bianca a 7')],[P('Diavola',9)],{alt:[[],[P('Diavola',9),C('Pizza bianca',7,'Pizze')]],sera:{cmd:[1]},note:'la pizza bianca non c’è: domanda o piatto nuovo, la Diavola non va persa'}),
 N('prezzo-euro-prima',[T('capricciosa euro 9,90')],[P('Capricciosa',9.9)],{sera:{cmd:[1]}}),
 N('gruppo-non-oggetto',[T('metti la burrata tra i fritti a 8')],[C('Burrata',8,'Fritti')],{sera:{cmd:[1]},note:'«tra i fritti» è dove va il piatto nuovo, non il gruppo da cambiare (regressione as-metti-02)'}),
 N('domanda-oggi-pranzo',[Q("cosa c'è oggi a pranzo?")],[]),
 QS('lasagne-annulla',[T('aggiungi nel menu pranzo le lasagne a 12'),T('annulla')],[],{ask:[1],sera:{notSay:[{turn:2,re:/\?/}]}}),
]

// prezzo fisso (fixture prezzofisso)
const PR='Menu pranzo',CE='Menu cena'
const fp=(menu:string,name:string,price:number):FixedOp=>({k:'fp',menu,name,price})
const rep=(menu:string,section:string,...names:string[]):FixedOp=>({k:'rep',menu,section,names})
const UNDO:FixedOp={k:'undo'}
const pf=(...a:Parameters<typeof fc>):MtCase=>{const c=fc(...a) as MtCase;return{...c,id:c.id.replace(/^pf-/,'n-pf-'),sera:{}}}
export const NOTTE_FISSO:MtCase[]=[
 pf('notte',[['il completo del pranzo portalo a tredici e cinquanta',fp(PR,'Completo',13.5)]]),
 pf('notte',[Q('quanto costa il menu della cena?')]),
 pf('notte',[['solo primo della cena a nove e mezzo',fp(CE,'Solo primo',9.5)]]),
 pf('notte',[['alza il completo della cena a 17',fp(CE,'Completo',17)],['annulla',UNDO]]),
 pf('notte',['modifichiamo menu pranzo','primi pasta al pomodoro e le penne, secondi cotoletta',['contorni uguali',rep(PR,'Primi','pasta al pomodoro=Pasta al pomodoro',"penne=Penne all'arrabbiata"),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese')]],{orAsk:[2,3]}),
 pf('notte',['modifichiamo menu cena','annulla']),
 pf('notte',[['il solo secondo della cena mettilo a 10 e 50',fp(CE,'Solo secondo',10.5)]]),
 pf('notte',[V('il completo della cena a diciassette e cinquanta')].map(t=>[t,fp(CE,'Completo',17.5)] as [Turn,FixedOp])),
]
export const NOTTE_CASES:MtCase[]=[...NOTTE_BASE,...NOTTE_FISSO]
