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
REN_SEC.forEach(([s,menu,section],i)=>add('rinomina-sottomenu',[voice(i,s)],section==='Altre proposte'?PROVA.map(dish=>({op:'move',dish,section})):[],{sera:{cmd:[1],sectionIn:[{after:1,menu,section}]}}))
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
