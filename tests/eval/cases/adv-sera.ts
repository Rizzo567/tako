// Set ADV-SERA (motore Haiku, 21/10 sera): batteria AVVERSARIA sui temi della prova dal vivo di Manuel (regola Takomenu: ogni bug
// del bot → 150–200 frasi con invarianti). Conversazioni brevi (1–3 turni) sulla fixture `qasera`, generate da blocchi fissi
// (deterministico). Invarianti automatici (sera-checks.ts) su ogni risposta: mai conferma senza scrittura, mai la stessa domanda due
// volte, sì → applica, comando nuovo → eseguito da solo, Menu nominato rispettato, nessun «non posso/non ho un comando», mai
// «categoria», nessuna emoji. Più le attese sullo stato finale (giudice condiviso) e la struttura (struct).
import type {Change,Family,Turn} from '../types.js'
import type {MtCase} from './multiturno-1021.js'

const T=(s:string):Turn=>({text:s}),V=(s:string):Turn=>({voice:s})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const C=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const fam='bv-multiple' as Family,M='qasera'
const out:MtCase[]=[],seq=new Map<string,number>()
const add=(g:string,turns:Turn[],changes:Change[],x:Partial<MtCase>={})=>{const k=(seq.get(g)??0)+1;seq.set(g,k);out.push({id:`as-${g}-${String(k).padStart(2,'0')}`,family:fam,menu:M,turns,changes,source:'adv-sera 21/10 (fixture qasera)',...x})}
const voice=(i:number,s:string)=>i%3===1?V(s):T(s)

const BASE:Record<string,number>={'la parmigiana':15,'pasta al pesto':11,'pasta carbonara':10,'riso giallo':8,"pasta all'amatriciana":11,'pasta alla norma':10,'pasta al ragù':10,'Pasta al pesto e lasagna':10.01,'Pasta al sugo':9}
const PASTE_VIS=['pasta al ragù','Pasta al pesto e lasagna','pasta al pesto','pasta carbonara','Pasta al sugo'],PASTE_HID=["pasta all'amatriciana",'pasta alla norma']
const PRIMI_VIS=['la parmigiana','pasta al pesto','pasta carbonara','riso giallo']
const setAll=(ds:string[],f:(p:number)=>number)=>ds.flatMap(d=>{const v=Math.round(f(BASE[d]!)*100)/100;return Math.abs(v-BASE[d]!)>0.004?[P(d,v)]:[]})

// 1. «sì» (in tante forme) a una proposta con azioni pronte: sottomenu + piatto nel Menu pranzo, in un colpo solo.
const YES=['si','sì','ok','esatto','va bene','certo','sì grazie','sì voglio chiamarlo primi','crealo','perfetto','ok vai','sì sì','si si crealo pure','va benissimo','giusto','d\'accordo']
const PROPOSALS:{say:string,ch:Change[],alt:Change[][],dish:string,section:string}[]=[
 {say:'aggiungi nel menu pranzo le lasagne a 12',ch:[C('Lasagna',12,'Primi')],alt:[[C('Lasagne',12,'Primi')]],dish:'Lasagn',section:'Primi'},
 {say:'aggiungi gnocchi al ragu in menu pranzo a 10',ch:[C('Gnocchi al ragù',10,'Primi')],alt:[[C('gnocchi al ragu',10,'Primi')]],dish:'Gnocchi al ragù',section:'Primi'},
 {say:'nel menu pranzo metti la cotoletta a 14',ch:[C('Cotoletta',14,'Secondi')],alt:[],dish:'Cotoletta',section:'Secondi'},
]
YES.flatMap((y,i)=>[[y,i],[y,i+1]] as [string,number][]).forEach(([y0,i])=>{const p=PROPOSALS[i%PROPOSALS.length]!,y=y0.replace('primi',p.section.toLowerCase())
 add('si',[voice(i,p.say),voice(i+1,y)],p.ch,{alt:p.alt,struct:[{after:2,menus:[{name:'Menu pranzo',sections:[p.section]}],noNewMenus:true}],sera:{yes:[2],cmd:[1],inMenu:[{after:2,dish:p.dish,menu:'Menu pranzo'}]}})})
// catene di sì: niente doppioni, nessuna domanda ripetuta
for(const [i,p] of PROPOSALS.entries())for(const ys of [['si','si'],['ok','sì'],['si','ok','si']])add('catena',[voice(i,p.say),...ys.map(T)],p.ch,{alt:p.alt,struct:[{after:2,menus:[{name:'Menu pranzo',sections:[p.section]}],noNewMenus:true}],sera:{yes:[2],cmd:[1]}})

// 2. comando nuovo a metà di una domanda: la domanda si chiude, il comando va da solo.
const PENDINGS=['aggiungi nel menu pranzo le lasagne','la pasta a 10','aggiungi nel menu pranzo i ravioli','aggiungi gnocchi al ragu in menu pranzo']
const NEWCMD:{say:string,ch:Change[],alt?:Change[][]}[]=[
 {say:'metti il tiramisù a 7',ch:[P('tiramisù',7)]},
 {say:'nascondi il riso giallo',ch:[HI('riso giallo')]},
 {say:'la parmigiana passa a 14',ch:[P('la parmigiana',14)]},
 {say:'togli la pasta al sugo',ch:[HI('Pasta al sugo')]},
 {say:'aumenta tutti i primi di 1 euro',ch:setAll([...PRIMI_VIS,...PASTE_HID],p=>p+1),alt:[setAll(PRIMI_VIS,p=>p+1)]},
 {say:'metti tutte le paste a 9 euro',ch:setAll([...PASTE_VIS,...PASTE_HID],()=>9),alt:[setAll(PASTE_VIS,()=>9)]},
 {say:'il riso giallo a 8,50',ch:[P('riso giallo',8.5)]},
 {say:'abbassa la pasta al pesto di 1 euro',ch:[P('pasta al pesto',10)]},
]
PENDINGS.forEach((pd,a)=>NEWCMD.forEach((c,b)=>add('nuovo',[T(pd),voice(a+b,c.say)],c.ch,{...(c.alt?{alt:c.alt}:{}),sera:{cmd:[2]}})))
// «no» / «lascia stare» poi comando nuovo
const NOS=['no','no lascia stare','niente','lascia perdere']
PENDINGS.forEach((pd,a)=>NEWCMD.slice(0,6).forEach((c,b)=>add('no',[T(pd),T(NOS[(a+b)%NOS.length]!),voice(a+b,c.say)],c.ch,{...(c.alt?{alt:c.alt}:{}),sera:{cmd:[3]}})))
// «fa niente, …» nello stesso messaggio
NEWCMD.slice(0,5).forEach((c,b)=>add('fa-niente',[T(PENDINGS[b%3]!),voice(b,'no vabbè fa niente, '+c.say)],c.ch,{...(c.alt?{alt:c.alt}:{}),sera:{cmd:[2]}}))

// 3. Menu nominato: il piatto simile di un altro Menu non conta, si crea nel Menu detto.
const NAMED:{say:string,ch:Change[],alt:Change[][],menu:string,dish:string,two:boolean}[]=[
 {say:'aggiungi gnocchi al ragù nel menu cena a 12',ch:[C('Gnocchi al ragù',12,'Primi')],alt:[[C('gnocchi al ragu',12,'Primi')]],menu:'Menu cena',dish:'Gnocchi al ragù',two:false},
 {say:'nel menu cena aggiungi la lasagna a 11',ch:[C('Lasagna',11,'Primi')],alt:[[C('lasagna',11,'Primi')]],menu:'Menu cena',dish:'Lasagna',two:false},
 {say:'aggiungi la carbonara nel menù cena a 13',ch:[C('Carbonara',13,'Primi')],alt:[],menu:'Menu cena',dish:'Carbonara',two:false},
 {say:'metti la lasagna nel menu cena a 10',ch:[C('Lasagna',10,'Primi')],alt:[],menu:'Menu cena',dish:'Lasagna',two:false},
 {say:'aggiungi la lasagna al menu pranzo a 9',ch:[C('Lasagna',9,'Primi')],alt:[],menu:'Menu pranzo',dish:'Lasagna',two:true},
 {say:'nel menù pranzo aggiungi gli gnocchi al ragù a 10',ch:[C('Gnocchi al ragù',10,'Primi')],alt:[[C('gnocchi al ragu',10,'Primi')]],menu:'Menu pranzo',dish:'Gnocchi al ragù',two:true},
 {say:'aggiungi la carbonara in menu pranzo a 12',ch:[C('Carbonara',12,'Primi')],alt:[],menu:'Menu pranzo',dish:'Carbonara',two:true},
 {say:'aggiungi le polpette nel menu pranzo a 9',ch:[C('Polpette',9,'Secondi')],alt:[],menu:'Menu pranzo',dish:'Polpette',two:true},
]
;[...NAMED,...NAMED.map(x=>({...x,say:x.say.replace(/^aggiungi /,'inserisci ').replace(/ a (\d+)$/,' al prezzo di $1 euro')}))].forEach((x,i)=>{const turns=x.two?[voice(i,x.say),T(i%2?'ok':'si')]:[voice(i,x.say)],after=turns.length
 add('menu',turns,x.ch,{alt:x.alt,...(x.two?{struct:[{after:2,menus:[{name:'Menu pranzo',sections:[x.ch[0]!.op==='create'?(x.ch[0] as any).section:'Primi']}],noNewMenus:true}]}:{}),sera:{cmd:[1],...(x.two?{yes:[2]}:{}),inMenu:[{after,dish:x.dish,menu:x.menu}]}})})

// 4. Rinomine (Menu, Sottomenu, piatto), anche a voce e con la parola «categoria» detta dal titolare.
const REN_MENU:[string,string][]=[['Cambia il nome del menù, da menù di verifica a menù di prova.','Menu di prova'],['rinomina il menu pranzo in Pranzo veloce','Pranzo veloce'],['cambia il nome del menu cena in Cena della casa','Cena della casa'],['il menu del giorno chiamalo Piatti del giorno','Piatti del giorno'],['rinomina il menù cena in Sera','Sera'],['cambia nome al menu pranzo: Pranzo di lavoro','Pranzo di lavoro']]
REN_MENU.forEach(([s,name],i)=>add('rinomina-menu',[voice(i,s)],[],{sera:{cmd:[1],menuNamed:[{after:1,name}]}}))
const REN_SEC:[string,string,string][]=[['rinomina il sottomenu Completo in Primi','Menu pranzo','Primi'],['cambia il nome del sottomenu Completo del menu pranzo in Piatti unici','Menu pranzo','Piatti unici'],['rinomina la categoria Completo in Primi piatti','Menu pranzo','Primi piatti'],['rinomina il sottomenu Piatti di prova in Altre proposte','Menu di verifica · web QA','Altre proposte'],['il sottomenu primi del menu cena chiamalo Paste','Menu cena','Paste']]
const PROVA=['Piatto di verifica','Che ne sacc','boh','pasta al ragù','Inserisce il piatto la parmigiana','Pasta al sugo','Pasta al pesto e lasagna','tiramisù']
REN_SEC.forEach(([s,menu,section],i)=>add('rinomina-sottomenu',[voice(i,s)],[] /* 22/10 notte: la rinomina non sposta i piatti (il giudice confronta l'id del sottomenu); prima l'attesa era un move */,{sera:{cmd:[1],sectionIn:[{after:1,menu,section}]}}))
const REN_DISH:[string,string,string][]=[['rinomina la pasta carbonara in Carbonara romana','pasta carbonara','Carbonara romana'],['cambia il nome del riso giallo in Risotto alla milanese','riso giallo','Risotto alla milanese'],['il tiramisù chiamalo Tiramisù della casa','tiramisù','Tiramisù della casa']]
REN_DISH.forEach(([s,dish,name],i)=>add('rinomina-piatto',[voice(i,s)],[{op:'rename',dish,name}],{sera:{cmd:[1]}}))
add('rinomina-annulla',[T('rinomina il menu pranzo in Pranzo veloce'),T('annulla')],[],{sera:{cmd:[1],menuNamed:[{after:1,name:'Pranzo veloce'},{after:2,name:'Menu pranzo'}]}})
add('rinomina-annulla',[T('rinomina il sottomenu Completo in Primi'),T('annulla')],[],{sera:{cmd:[1],sectionIn:[{after:1,menu:'Menu pranzo',section:'Primi'},{after:2,menu:'Menu pranzo',section:'Completo'}]}})

// 5. Gruppo intero: «tutte le paste», «tutti i primi» (solo con prezzo, mai Menu fissi), «solo i visibili».
const GROUP:{say:string,ch:Change[],alt?:Change[][]}[]=[
 {say:'metti tutte le paste a 9 euro',ch:setAll([...PASTE_VIS,...PASTE_HID],()=>9),alt:[setAll(PASTE_VIS,()=>9)]},
 {say:'tutte le paste a 10',ch:setAll([...PASTE_VIS,...PASTE_HID],()=>10),alt:[setAll(PASTE_VIS,()=>10)]},
 {say:'porta tutte le paste a 8,50',ch:setAll([...PASTE_VIS,...PASTE_HID],()=>8.5),alt:[setAll(PASTE_VIS,()=>8.5)]},
 {say:'metti tutte le paste visibili a 9',ch:setAll(PASTE_VIS,()=>9)},
 {say:'tutte le paste a 9 ma solo quelle visibili',ch:setAll(PASTE_VIS,()=>9)},
 {say:'aumenta tutti i primi di 1 euro',ch:setAll([...PRIMI_VIS,...PASTE_HID],p=>p+1),alt:[setAll(PRIMI_VIS,p=>p+1)]},
 {say:'abbassa tutti i primi di 2 euro',ch:setAll([...PRIMI_VIS,...PASTE_HID],p=>p-2),alt:[setAll(PRIMI_VIS,p=>p-2)]},
 {say:'alza di cinquanta centesimi tutti i primi',ch:setAll([...PRIMI_VIS,...PASTE_HID],p=>p+0.5),alt:[setAll(PRIMI_VIS,p=>p+0.5)]},
 {say:'aumenta di un euro tutti i primi visibili',ch:setAll(PRIMI_VIS,p=>p+1)},
 {say:'tutti i primi del menu di verifica più 1 euro',ch:setAll([...PRIMI_VIS,...PASTE_HID],p=>p+1),alt:[setAll(PRIMI_VIS,p=>p+1)]},
 {say:'diminuisci di 1 euro tutte le paste',ch:setAll([...PASTE_VIS,...PASTE_HID],p=>p-1),alt:[setAll(PASTE_VIS,p=>p-1)]},
 {say:'metti tutti i primi a 12',ch:setAll([...PRIMI_VIS,...PASTE_HID],()=>12),alt:[setAll(PRIMI_VIS,()=>12)]},
]
GROUP.forEach((g,i)=>add('gruppo',[voice(i,g.say)],g.ch,{...(g.alt?{alt:g.alt}:{}),sera:{cmd:[1]}}))
// «solo quelle visibili» dopo il gruppo: le nascoste tornano com'erano
const VIS=['no, solo quelle visibili','no no, diminuisci il prezzo solamente a quelle là che sono visibili','solo i visibili','solamente quelle che si vedono']
VIS.forEach((s,i)=>add('visibili',[T('metti tutte le paste a 9'),voice(i,s)],setAll(PASTE_VIS,()=>9),{interim:PASTE_HID.map(d=>P(d,9)),sera:{cmd:[1]}}))

// 6. Domande di capacità e frasi trappola: mai «non posso», mai «categoria» nelle risposte.
for(const [i,s] of ['puoi rinominare un menu?','si può cambiare il nome di una categoria?','come faccio a cambiare il nome del menu pranzo?','sai creare un sottomenu nuovo?'].entries())add('capacita',[{text:s,q:true}],[],{sera:{}})
export const ADV_SERA_CASES=out

// ---------------------------------------------------------------------------------------------------------------------------
// 7. AVVERSARIE DURE (richiesta di Manuel 21/10 notte): italiano scritto normale, parole che il modello può confondere. Fixture
// prezzofisso (Alla carta + Menu pranzo e Menu cena a prezzo fisso con «Completo»), controlli fixedChecks + seraChecks.
import {fc} from './prezzo-fisso-1021.js'
import type {FixedOp} from '../fixed-checks.js'
const PR='Menu pranzo',CE='Menu cena',AC='Alla carta'
const rep=(menu:string,section:string,...names:string[]):FixedOp=>({k:'rep',menu,section,names})
const ip=(dish:string,price:number):FixedOp=>({k:'ip',menu:AC,dish,price})
const ci=(menu:string,section:string,name:string,price=0):FixedOp=>({k:'ci',menu,section,name,price})
const fp=(menu:string,name:string,price:number):FixedOp=>({k:'fp',menu,name,price})
const hard=(g:string,steps:Parameters<typeof fc>[1],x:Parameters<typeof fc>[2]&{sera?:MtCase['sera']}={})=>{const c=fc('dura',steps,x) as MtCase;const k=(seq.get(g)??0)+1;seq.set(g,k);out.push({...c,id:`as-${g}-${String(k).padStart(2,'0')}`,sera:x.sera??{}})}
// «completo»: opzione di prezzo o aggettivo
hard('completo',['il completo a 17'],{ask:[1],sera:{}})
hard('completo',[['il completo del pranzo passa a 13',fp(PR,'Completo',13)]],{sera:{cmd:[1]}})
hard('completo',[['a cena il completo lo porti a diciassette euro e cinquanta',fp(CE,'Completo',17.5)]],{sera:{cmd:[1]}})
hard('completo',[['fammi un menu completo per stasera: primi tagliatelle al ragù, secondi tagliata, contorni patatine fritte',rep(CE,'Primi','tagliatelle al ragù=Tagliatelle al ragù'),rep(CE,'Secondi','tagliata=Tagliata di manzo'),rep(CE,'Contorni','patatine fritte=Patatine fritte')]],{orAsk:[1],sera:{}})
hard('completo',[['la carbonara completa di guanciale alla carta la metti a 13',ip('Carbonara',13)]],{orAsk:[1],sera:{}})
// «menu» come Menu o come lista; domande senza scritture
hard('menu',[{text:'mandami il menu del pranzo',q:true}],{sera:{}})
hard('menu',[{text:'cosa c\'è nel menu di stasera?',q:true}],{sera:{}})
hard('menu',[{text:'quanto costa il completo a pranzo?',q:true}],{sera:{}})
// «togli» = nascondere / «elimina» chiede il sì; «metti» = prezzo, aggiunta o spostamento
hard('metti',[['metti la diavola a 9',ip('Diavola',9)]],{sera:{cmd:[1]}})
hard('metti',[['metti la bufalina tra le pizze a 10',ci(AC,'Pizze','Bufalina',10)]],{sera:{cmd:[1]}})
hard('metti',[['metti la lasagna nei primi del pranzo',ci(PR,'Primi','Lasagna')]],{sera:{cmd:[1]}})
hard('metti',[['metti a 12 e 50 la carbonara alla carta',ip('Carbonara',12.5)]],{sera:{cmd:[1]}})
// pronomi e rimandi
hard('pronomi',[['la margherita a 8',ip('Margherita',8)],['anche la diavola',ip('Diavola',8)]],{orAsk:[2],sera:{cmd:[1]}})
hard('pronomi',[['la carbonara alla carta a 13',ip('Carbonara',13)],['no scusa, quella là mettila a 12',ip('Carbonara',12)]],{sera:{cmd:[1]}})
hard('pronomi',[['il tiramisù a 7',ip('Tiramisù',7)],['e la panna cotta uguale',ip('Panna cotta',7)]],{orAsk:[2],sera:{cmd:[1]}})
// numeri in lettere e refusi plausibili
hard('numeri',[['la carbonara a tredici e cinquanta',ip('Carbonara',13.5)]],{sera:{cmd:[1]}})
hard('numeri',[['il tiramisu a sei euro',ip('Tiramisù',6)]],{sera:{cmd:[1]}})
hard('numeri',[['la carbonare alla carta a 13',ip('Carbonara',13)]],{orAsk:[1],sera:{cmd:[1]}})
hard('numeri',[["l'amatriciana a undici e mezzo",ip('Amatriciana',11.5)]],{sera:{cmd:[1]}})
hard('numeri',[['la margerita a 7 e 50',ip('Margherita',7.5)]],{orAsk:[1],sera:{cmd:[1]}})
// frasi lunghe con incisi e richieste multiple
hard('lunghe',[['allora, la carbonara, che ormai la facciamo con il guanciale buono, la porti a 13, e già che ci sei il tiramisù a 6',ip('Carbonara',13),ip('Tiramisù',6)]],{sera:{cmd:[1]}})
hard('lunghe',[['carbonara 13, amatriciana 12, diavola 9',ip('Carbonara',13),ip('Amatriciana',12),ip('Diavola',9)]],{sera:{cmd:[1]}})
hard('lunghe',[['senti, visto che il guanciale è aumentato, la carbonara e l\'amatriciana le porti a 13 tutte e due',ip('Carbonara',13),ip('Amatriciana',13)]],{sera:{cmd:[1]}})
hard('lunghe',[['a cena il solo primo a 9,50 e alla carta la margherita a 7,50',fp(CE,'Solo primo',9.5),ip('Margherita',7.5)]],{sera:{cmd:[1]}})
// menu del giorno completo in un solo messaggio
hard('giorno',[['oggi a pranzo primi lasagna e pasta e fagioli, secondi cotoletta e arrosto di vitello, contorni patate al forno e spinaci al burro',rep(PR,'Primi','lasagna','pasta e fagioli=Pasta e fagioli'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese','arrosto di vitello=Arrosto di vitello'),rep(PR,'Contorni','patate al forno=Patate al forno','spinaci al burro=Spinaci al burro')]],{sera:{cmd:[1]}})
hard('giorno',[['stasera: primi spaghetti alle vongole e risotto ai funghi; secondi salmone alla griglia; contorni verdure grigliate',rep(CE,'Primi','spaghetti alle vongole=Spaghetti alle vongole','risotto ai funghi=Risotto ai funghi'),rep(CE,'Secondi','salmone alla griglia=Salmone alla griglia'),rep(CE,'Contorni','verdure grigliate=Verdure grigliate')]],{sera:{cmd:[1]}})
hard('giorno',[['pranzo di oggi primi pasta al pomodoro secondi polpette contorni insalata mista',rep(PR,'Primi','pasta al pomodoro=Pasta al pomodoro'),rep(PR,'Secondi','polpette=Polpette al sugo'),rep(PR,'Contorni','insalata mista=Insalata mista')]],{sera:{cmd:[1]}})
// sessione guidata dal ristoratore (stili diversi)
hard('sessione',['modifichiamo menu pranzo',['primi lasagna, secondi cotoletta, contorni patate al forno',rep(PR,'Primi','lasagna'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese'),rep(PR,'Contorni','patate al forno=Patate al forno')]],{sera:{cmd:[1]}})
hard('sessione',['cambiamo il menu della cena','primi gnocchi al pomodoro',['il resto resta uguale',rep(CE,'Primi','gnocchi al pomodoro=Gnocchi al pomodoro')]],{sera:{cmd:[1]}})
hard('sessione',['modifichiamo menu pranzo','primi lasagna','basta'],{sera:{cmd:[1]}})
hard('sessione',['modifichiamo menu pranzo','secondi polpette',['primi pasta al pomodoro e contorni insalata mista',rep(PR,'Secondi','polpette=Polpette al sugo'),rep(PR,'Primi','pasta al pomodoro=Pasta al pomodoro'),rep(PR,'Contorni','insalata mista=Insalata mista')]],{sera:{cmd:[1]}})
hard('sessione',['modifichiamo menu cena','primi tagliatelle al ragù e carbonara','no la carbonara toglila',['secondi e contorni come ieri',rep(CE,'Primi','tagliatelle al ragù=Tagliatelle al ragù')]],{sera:{cmd:[1]}})
hard('sessione',['modifichiamo menu pranzo','primi lasagna',['la carbonara alla carta a 13',ip('Carbonara',13)]],{sera:{cmd:[1,3]}})
// «togli» = nascondere, «elimina» = chiede il sì; «tutti tranne», «solo quelli», «l'ultimo»
const HC=(g:string,turns:Turn[],changes:Change[],x:Partial<MtCase>={})=>{const k=(seq.get(g)??0)+1;seq.set(g,k);out.push({id:`as-${g}-${String(k).padStart(2,'0')}`,family:fam,menu:'prezzofisso',turns,changes,source:'adv-sera dure 21/10',sera:{},...x})}
HC('togli',[T('togli la panna cotta')],[HI('Panna cotta')],{sera:{cmd:[1]}})
HC('togli',[T('togli la diavola dal menu, per oggi non la facciamo')],[HI('Diavola')],{sera:{cmd:[1]}})
HC('togli',[T('elimina la panna cotta'),T('sì')],[{op:'delete',dish:'Panna cotta'}],{sera:{cmd:[1],yes:[2]}})
HC('togli',[T('elimina la panna cotta'),T('no lascia stare')],[],{sera:{cmd:[1]}})
HC('tutti',[T('nascondi tutte le pizze tranne la margherita')],[HI('Diavola')],{sera:{cmd:[1]}})
HC('tutti',[T('le pizze tutte a 9 euro')],[P('Margherita',9),P('Diavola',9)],{sera:{cmd:[1]}})
HC('tutti',[T('aumenta di un euro tutti i secondi alla carta')],[P('Filetto al pepe verde',23),P('Grigliata mista',19)],{sera:{cmd:[1]}})
HC('tutti',[T('i dolci, solo quelli, alzali di 50 centesimi')],[P('Tiramisù',6.5),P('Panna cotta',5.5)],{sera:{cmd:[1]}})
HC('pronomi',[T('la margherita a 8 e la diavola a 9'),T("l'ultima mettila a 9,50")],[P('Margherita',8),P('Diavola',9.5)],{interim:[P('Diavola',9)],sera:{cmd:[1]}})
HC('pronomi',[T('quanto costa la grigliata mista?'),T('portala a 19')],[P('Grigliata mista',19)],{sera:{cmd:[2]}})
HC('lunghe',[T('ok allora ascolta, oggi il tiramisù è finito, la carbonara la metti a 13 e la bruschetta, quella col pomodoro, a 6')],[{op:'available',dish:'Tiramisù',value:false},P('Carbonara',13),P('Bruschetta',6)],{sera:{cmd:[1]}})
HC('lunghe',[T('nel menu alla carta: margherita 7,50, diavola 9 e la panna cotta nascondila')],[P('Margherita',7.5),P('Diavola',9),HI('Panna cotta')],{sera:{cmd:[1]}})
HC('menu-lista',[T('il menu lo vedo strano, la carbonara quanto sta?')],[],{sera:{}})
HC('menu-lista',[T('nel menu metti la carbonara a 13')],[P('Carbonara',13)],{sera:{cmd:[1]}})
HC('refusi',[T('la grigliata misat a 19')],[P('Grigliata mista',19)],{alt:[[]],sera:{cmd:[1]}})
HC('refusi',[T('il tiramisu finito')],[{op:'available',dish:'Tiramisù',value:false}],{sera:{cmd:[1]}})

// 8. SESSIONI REALISTICHE (22/10 notte, dopo v138): stili diversi di ristoratore, refusi, correzioni, menu fissi e alla carta.
// prezzofisso: Menu pranzo / Menu cena fissi con Primi, Secondi, Contorni. Le operazioni stanno sul turno in cui il bot applica
// (quando ogni sottomenu è detto o resta com'è); le correzioni dopo l'applicazione si applicano subito (ops sul loro turno).
const S=(steps:Parameters<typeof fc>[1],x:Parameters<typeof fc>[2]&{sera?:MtCase['sera']}={})=>hard('sessione2',steps,{...x,sera:x.sera??{cmd:[1]}})
S([['modifichiamo menu pranzo: primi lasagne e pasta e fagioli, secondi cotolleta, contorni patate al forno',rep(PR,'Primi','lasagne=Lasagne','pasta e fagioli=Pasta e fagioli'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese'),rep(PR,'Contorni','patate al forno=Patate al forno')]])
S(['aggiorniamo il menu del pranzo','primi: risotto alla milanese, penne all\'arrabbiata','secondi: polpette',['contorni insalata mista e spinaci',rep(PR,'Primi','risotto alla milanese=Risotto alla milanese',"penne all'arrabbiata=Penne all'arrabbiata"),rep(PR,'Secondi','polpette=Polpette al sugo'),rep(PR,'Contorni','insalata mista=Insalata mista','spinaci=Spinaci al burro')]])
S(['modifichiamo il menu della cena','secondi tagliata e salmone','primi spaghetti alle vongole',['contorni restano uguali',rep(CE,'Secondi','tagliata=Tagliata di manzo','salmone=Salmone alla griglia'),rep(CE,'Primi','spaghetti alle vongole=Spaghetti alle vongole')]])
S(['modifichiamo menu cena','primi gnocchi al pomodoro e risotto ai funghi','secondi scaloppine',['contorni patatine fritte',rep(CE,'Primi','gnocchi al pomodoro=Gnocchi al pomodoro','risotto ai funghi=Risotto ai funghi'),rep(CE,'Secondi','scaloppine=Scaloppine al limone'),rep(CE,'Contorni','patatine fritte=Patatine fritte')],['no le patatine toglile',rep(CE,'Contorni')]],{sera:{cmd:[1]},orAsk:[5]})
S(['modifichiamo menu pranzo','primi lasagna e carbonara','no la carbonara toglila','secondi cotoletta',['contorni come ieri',rep(PR,'Primi','lasagna'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese')]])
S(['modifichiamo menu pranzo','primi orecchiette e lasagna','e anche la pasta e fagioli nei primi',['secondi e contorni restano uguali',rep(PR,'Primi','orecchiette','lasagna','pasta e fagioli=Pasta e fagioli')]])
S(['modifichiamo il menu del pranzo','i primi sono pasta al pomodorro e risoto alla milanese',['il resto resta uguale',rep(PR,'Primi','pasta al pomodoro=Pasta al pomodoro','risotto alla milanese=Risotto alla milanese')]])
S(['modifichiamo menu cena',['tutto uguale tranne i secondi: tagliata e filetto',rep(CE,'Secondi','tagliata=Tagliata di manzo','filetto')]])
S(['modifichiamo menu pranzo','secondi arrosto e cotoletta','no aspetta, l\'arrosto no, metti le polpette',['primi e contorni restano uguali',rep(PR,'Secondi','cotoletta=Cotoletta alla milanese','polpette=Polpette al sugo')]])
S(['cambiamo il menu della cena di oggi','primi: tagliatelle al ragù',['secondi salmone alla griglia, contorni verdure grigliate',rep(CE,'Primi','tagliatelle al ragù=Tagliatelle al ragù'),rep(CE,'Secondi','salmone alla griglia=Salmone alla griglia'),rep(CE,'Contorni','verdure grigliate=Verdure grigliate')]])
S(['modifichiamo menu pranzo','primi lasagna','basta'])
S(['modifichiamo menu pranzo','annulla'])
S(['modifichiamo menu cena','primi gnocchi al pomodoro',['la carbonara alla carta a 13',ip('Carbonara',13)]],{sera:{cmd:[1,3]}})
S(['modifichiamo menu pranzo','primi lasagna e carbonara','secondi cotoletta',['contorni patate al forno',rep(PR,'Primi','lasagna','carbonara'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese'),rep(PR,'Contorni','patate al forno=Patate al forno')],['aggiungi anche gli spinaci nei contorni',rep(PR,'Contorni','patate al forno=Patate al forno','spinaci=Spinaci al burro')]])
S(['modifichiamo menu pranzo',['primi lasagna secondi cotoletta contorni insalata',rep(PR,'Primi','lasagna'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese'),rep(PR,'Contorni','insalata=Insalata mista')]])
S(['modifichiamo menu cena','secondi tagliata',['sì',rep(CE,'Secondi','tagliata=Tagliata di manzo')],['primi spaghetti alle vongole',rep(CE,'Primi','spaghetti alle vongole=Spaghetti alle vongole')]],{sera:{cmd:[1]}})
S([['oggi il menu del pranzo: primi lasagna, secondi polpette al sugo, contorni insalata mista',rep(PR,'Primi','lasagna'),rep(PR,'Secondi','polpette al sugo=Polpette al sugo'),rep(PR,'Contorni','insalata mista=Insalata mista')]])
S(['modifichiamo menu pranzo','primi carbonara',['i secondi restano uguali e anche i contorni',rep(PR,'Primi','carbonara')]])
S(['modifichiamo menu cena','primi risotto ai fungi e tagliatelle al ragu',['secondi e contorni come prima',rep(CE,'Primi','risotto ai funghi=Risotto ai funghi','tagliatelle al ragù=Tagliatelle al ragù')]])
S(['modifichiamo menu pranzo',['primi lasagna, secondi cotoletta e contorni patate',rep(PR,'Primi','lasagna'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese'),rep(PR,'Contorni','patate=Patate al forno')],['no la cotoletta no, metti il petto di pollo',rep(PR,'Secondi','petto di pollo=Petto di pollo ai ferri')]],{orAsk:[3]})
// alla carta (qasera: Menu pranzo col solo «Completo»): i nuovi vogliono il prezzo
const CS=(turns:Turn[],changes:Change[],x:Partial<MtCase>={})=>{const k=(seq.get('sessione-carta')??0)+1;seq.set('sessione-carta',k);out.push({id:`as-sessione-carta-${String(k).padStart(2,'0')}`,family:fam,menu:'qasera',turns,changes,source:'adv-sera sessioni 22/10',sera:{cmd:[1]},...x})}
CS([T('modifichiamo menu pranzo'),T('completo: lasagna 12 e cotoletta 14')],[C('Lasagna',12,'Completo'),C('Cotoletta',14,'Completo')])
CS([T('modifichiamo menu pranzo'),T('nel completo lasagna 12 e cotoletta'),T('cotoletta 14')],[C('Lasagna',12,'Completo'),C('Cotoletta',14,'Completo')])
CS([T('modifichiamo il menu pranzo'),T('completo lasagna a 12, gnocchi al ragù a 10'),T('no gli gnocchi toglili')],[C('Lasagna',12,'Completo'),C('Gnocchi al ragù',10,'Completo')],{note:'gli gnocchi creati al turno 2 restano nel menu ma nascosti (la sostituzione non elimina mai)'})
CS([T('modifichiamo menu pranzo'),T('lascia stare')],[])
