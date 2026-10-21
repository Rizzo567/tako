// Set MULTITURNO (motore Haiku, prova dal vivo di Manuel sul QA 21/10 sera, edge v137). `mt-vera` rigioca ESATTAMENTE la
// conversazione di quella sera (vocali come trascritti: Whisper locale large-v3-turbo sugli ogg della sera, identici al testo
// riportato); le varianti provano catene di sì, cambio argomento a metà di una domanda, «no» poi comando nuovo, vocali, rinomine,
// «solo i visibili», Menu nominato. Fixture `qasera` (stessa forma del QA). Controlli: giudice condiviso + struct + seraChecks.
// Comando: TAKO_HAIKU=1 TAKO_HAIKU_SET=multiturno TAKO_BOT_LLM=replay|record taskpolicy -b ./node_modules/.bin/vitest run tests/eval/eval-haiku.test.ts
import type {Change,Family,Turn} from '../types.js'
import type {HaikuCase} from './victoria-1019.js'
import type {SeraCase} from '../sera-checks.js'
import {fc} from './prezzo-fisso-1021.js'
import type {FixedOp} from '../fixed-checks.js'

const T=(s:string):Turn=>({text:s}),V=(s:string):Turn=>({voice:s}),Q=(s:string):Turn=>({text:s,q:true})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const C=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const fam='bv-multiple' as Family,M='qasera'
export type MtCase=HaikuCase&SeraCase
let n=0;const mt=(id:string,turns:Turn[],changes:Change[],x:Partial<MtCase>={}):MtCase=>({id:'mt-'+id,family:fam,menu:M,turns,changes,source:'QA 21/10 sera (fixture qasera)',...x})

// Paste con prezzo (Pasta al sugo è già a 9): visibili / nascoste. Primi del Menu di verifica.
const PASTE_VIS=['pasta al ragù','Pasta al pesto e lasagna','pasta al pesto','pasta carbonara'],PASTE_HID=["pasta all'amatriciana",'pasta alla norma']
const BASE:Record<string,number>={'la parmigiana':15,'pasta al pesto':11,'pasta carbonara':10,'riso giallo':8,"pasta all'amatriciana":11,'pasta alla norma':10,'pasta al ragù':10,'Pasta al pesto e lasagna':10.01}
const PRIMI_VIS=['la parmigiana','pasta al pesto','pasta carbonara','riso giallo']
/** Stato finale = prezzi per piatto (solo quelli cambiati rispetto a BASE). */
const finalOf=(prices:Record<string,number>,extra:Change[]=[]):Change[]=>[...Object.entries(prices).filter(([d,p])=>Math.abs(p-BASE[d]!)>0.004).map(([d,p])=>P(d,p)),...extra]

// ---- mt-vera: le alternative accettate dipendono da come il bot legge i turni 5 e 12 (vedi note) ----
function vera():MtCase{
 const alts:Change[][]=[]
 for(const onlyTwo of [false,true])for(const hid of [true,false]){const pr:Record<string,number>={...BASE,'la parmigiana':12.5}
  for(const d of PASTE_VIS)pr[d]=9;if(onlyTwo){pr['pasta al ragù']=10;pr['Pasta al pesto e lasagna']=10.01}
  for(const d of [...PRIMI_VIS,...(hid?PASTE_HID:[])])pr[d]=Math.round((pr[d]!+1)*100)/100
  alts.push(finalOf(pr,[C('Gnocchi al ragù',10,'Primi')]))}
 return mt('vera',[V('La parmigiana passa a 12.50.'),V('No, ha detto la parmigiana.'),V('Ok, adesso metti tutte le paste a 9 euro.'),V('No, no, diminuisci il prezzo solamente a quelle là che sono visibili.'),T('solamente pasta al pesto e carbonara'),
  V('Cambia il nome del menù, da menù di verifica a menù di prova.'),V('No vabbè fa niente, voglio che aggiungi nel menù pranzo le lasagne.'),V('Tu come mi consiglieresti di chiamare il sottomenù?'),T('si'),T('si'),T('si voglio chiamarlo primi'),T('aumenta tutti i primi di 1 euro'),T('aggiungi gnocchi al ragu in menu pranzo a 10')],
  alts[0]!,{alt:alts.slice(1),interim:[...PASTE_HID.map(d=>P(d,9))],
   note:'conversazione vera: 5 «solamente pasta al pesto e carbonara» può valere come correzione (solo quelle due a 9) o come conferma; 12 «tutti i primi» con o senza i nascosti; Lasagne senza prezzo mai create con un prezzo inventato',
   struct:[{after:9,menus:[{name:'Menu pranzo',sections:['Primi']}],noNewMenus:true,orAsk:true}],
   sera:{cmd:[1,3,6,7,12,13],menuNamed:[{after:6,name:'Menu di prova'}],inMenu:[{after:13,dish:'Gnocchi al ragù',menu:'Menu pranzo',price:10}]}})}

const LAS_OK:Change[]=[C('Lasagna',12,'Primi')],LAS_ALT:Change[][]=[[C('Lasagne',12,'Primi')]]
const lasStruct=(after:number,section='Primi')=>[{after,menus:[{name:'Menu pranzo',sections:[section]}],noNewMenus:true}]
export const MULTITURNO_BASE:MtCase[]=[
 vera(),
 // catene di sì
 mt('si-catena',[T('aggiungi nel menu pranzo le lasagne a 12'),T('si'),T('si')],LAS_OK,{alt:LAS_ALT,struct:lasStruct(2),sera:{yes:[2],cmd:[1]},note:'sì applica sottomenu + piatto in un colpo; il secondo sì non duplica né ripete la domanda'}),
 mt('si-voglio',[T('aggiungi nel menu pranzo le lasagne a 12'),T('sì voglio chiamarlo primi')],LAS_OK,{alt:LAS_ALT,struct:lasStruct(2),sera:{yes:[2],cmd:[1]}}),
 mt('si-vocale',[V('aggiungi nel menù pranzo le lasagne a dodici euro'),V('sì')],LAS_OK,{alt:LAS_ALT,struct:lasStruct(2),sera:{yes:[2],cmd:[1]}}),
 mt('si-consiglio',[T('aggiungi nel menu pranzo le lasagne a 12'),T('come mi consigli di chiamare il sottomenu?'),T('ok')],LAS_OK,{alt:LAS_ALT,struct:lasStruct(3),sera:{yes:[3],cmd:[1]}}),
 mt('si-senza-prezzo',[T('aggiungi nel menu pranzo le lasagne'),T('si'),T('12')],LAS_OK,{alt:LAS_ALT,struct:[{after:3,menus:[{name:'Menu pranzo',sections:['Primi']}],noNewMenus:true}],sera:{cmd:[1]},note:'senza prezzo: al sì il sottomenu, poi il prezzo completa il piatto'}),
 mt('nome-diverso',[T('aggiungi nel menu pranzo le lasagne a 12'),T('no, chiamalo Paste fresche')],[C('Lasagna',12,'Paste fresche')],{alt:[[C('Lasagne',12,'Paste fresche')],[]],struct:[{after:2,menus:[{name:'Menu pranzo',sections:['Paste fresche']}],noNewMenus:true,orAsk:true}],sera:{cmd:[1]}}),
 mt('domanda-a-meta',[T('aggiungi nel menu pranzo le lasagne a 12'),Q('quanto costa il tiramisù?'),T('si')],LAS_OK,{alt:LAS_ALT,struct:lasStruct(3),sera:{yes:[3],cmd:[1]}}),
 // cambio argomento a metà di una domanda
 mt('cambio-argomento',[T('aggiungi nel menu pranzo le lasagne'),T('aumenta tutti i primi di 1 euro')],finalOf({...BASE,...Object.fromEntries([...PRIMI_VIS,...PASTE_HID].map(d=>[d,BASE[d]!+1]))}),{alt:[finalOf({...BASE,...Object.fromEntries(PRIMI_VIS.map(d=>[d,BASE[d]!+1]))})],sera:{cmd:[1,2]},note:'il comando nuovo chiude la domanda sul sottomenu ed è eseguito da solo'}),
 mt('fa-niente',[T('aggiungi nel menu pranzo le lasagne'),V('No vabbè fa niente, nascondi il riso giallo')],[HI('riso giallo')],{sera:{cmd:[1,2]}}),
 mt('comando-su-domanda',[T('la pasta a 10'),T('metti il tiramisù a 7')],[P('tiramisù',7)],{ask:[1],sera:{cmd:[2]}}),
 mt('no-poi-comando',[T('la pasta a 10'),T('no lascia stare'),T('metti il tiramisù a 7')],[P('tiramisù',7)],{ask:[1],sera:{cmd:[3]}}),
 mt('no-poi-comando-voce',[T('aggiungi nel menu pranzo le lasagne a 12'),V('no'),V('nascondi la pasta al sugo')],[HI('Pasta al sugo')],{sera:{cmd:[3]}}),
 // «tutte» e «solo i visibili»
 mt('tutte-paste',[V('metti tutte le paste a 9 euro')],finalOf({...BASE,...Object.fromEntries([...PASTE_VIS,...PASTE_HID].map(d=>[d,9]))}),{alt:[finalOf({...BASE,...Object.fromEntries(PASTE_VIS.map(d=>[d,9]))})],sera:{cmd:[1]},note:'«tutte» è chiaro: si applica subito con «annulla»'}),
 mt('solo-visibili',[T('metti tutte le paste visibili a 9')],finalOf({...BASE,...Object.fromEntries(PASTE_VIS.map(d=>[d,9]))}),{sera:{cmd:[1]}}),
 mt('tutte-poi-visibili',[T('metti tutte le paste a 9'),T('no, solo quelle visibili')],finalOf({...BASE,...Object.fromEntries(PASTE_VIS.map(d=>[d,9]))}),{interim:PASTE_HID.map(d=>P(d,9)),sera:{cmd:[1]}}),
 mt('primi-aumento',[T('aumenta tutti i primi di 1 euro')],finalOf({...BASE,...Object.fromEntries([...PRIMI_VIS,...PASTE_HID].map(d=>[d,BASE[d]!+1]))}),{alt:[finalOf({...BASE,...Object.fromEntries(PRIMI_VIS.map(d=>[d,BASE[d]!+1]))})],sera:{cmd:[1]}}),
 // rinomine
 mt('rinomina-menu',[V('Cambia il nome del menù, da menù di verifica a menù di prova.')],[],{sera:{cmd:[1],menuNamed:[{after:1,name:'Menu di prova'}]}}),
 mt('rinomina-sottomenu',[T('rinomina il sottomenu Completo del menu pranzo in Primi')],[],{sera:{cmd:[1],sectionIn:[{after:1,menu:'Menu pranzo',section:'Primi'}]}}),
 mt('rinomina-piatto',[T('rinomina la pasta carbonara in Carbonara romana')],[{op:'rename',dish:'pasta carbonara',name:'Carbonara romana'}],{sera:{cmd:[1]}}),
 mt('rinomina-annulla',[T('rinomina il menu pranzo in Pranzo veloce'),T('annulla')],[],{sera:{cmd:[1],menuNamed:[{after:1,name:'Pranzo veloce'},{after:2,name:'Menu pranzo'}]}}),
 // Menu nominato
 mt('menu-nominato',[T('aggiungi gnocchi al ragu in menu pranzo a 10'),T('si')],[C('Gnocchi al ragù',10,'Primi')],{alt:[[C('gnocchi al ragu',10,'Primi')]],struct:[{after:2,menus:[{name:'Menu pranzo',sections:['Primi']}],noNewMenus:true}],sera:{cmd:[1],yes:[2],inMenu:[{after:2,dish:'Gnocchi al ragù',menu:'Menu pranzo',price:10}]}}),
 mt('menu-nominato-cena',[T('aggiungi gnocchi al ragù nel menu cena a 12')],[C('Gnocchi al ragù',12,'Primi')],{alt:[[C('gnocchi al ragu',12,'Primi')]],sera:{cmd:[1],inMenu:[{after:1,dish:'Gnocchi al ragù',menu:'Menu cena',price:12}]}}),
 mt('parmigiana',[V('La parmigiana passa a 12.50.')],[P('la parmigiana',12.5)],{sera:{cmd:[1]}}),
]
void n

// ---- Sessione dei piatti di oggi (fixture prezzofisso: Menu pranzo e Menu cena a prezzo fisso, Alla carta). Stili diversi di ristoratore:
// tutto in un messaggio, a pezzi, in ordine sparso, con refusi, che cambia idea, che parte senza piatti, che esce, che dà un comando nuovo.
// Le operazioni attese stanno sul turno in cui il bot applica (prima nessuna scrittura: l'oracolo lo verifica turno per turno).
const PR='Menu pranzo',CE='Menu cena'
const rep=(menu:string,section:string,...names:string[]):FixedOp=>({k:'rep',menu,section,names})
const ses=(id:string,steps:Parameters<typeof fc>[1],x:Parameters<typeof fc>[2]&{sera?:SeraCase['sera']}={}):MtCase=>{const c=fc('sessione',steps,x) as MtCase;return{...c,id:'mt-sessione-'+id,...(x.sera?{sera:x.sera}:{sera:{}})}}
export const SESSIONE_CASES:MtCase[]=[
 ses('a-pezzi',['modifichiamo menu pranzo','primi lasagna e carbonara','secondi cotoletta',['contorni patate al forno',rep(PR,'Primi','lasagna','carbonara'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese'),rep(PR,'Contorni','patate al forno=Patate al forno')]],{sera:{cmd:[1]}}),
 ses('tutto-insieme',[['modifichiamo menu pranzo: primi pasta al pomodoro e risotto alla milanese, secondi polpette, contorni insalata mista',rep(PR,'Primi','pasta al pomodoro=Pasta al pomodoro','risotto alla milanese=Risotto alla milanese'),rep(PR,'Secondi','polpette=Polpette al sugo'),rep(PR,'Contorni','insalata mista=Insalata mista')]],{sera:{cmd:[1]}}),
 ses('ordine-sparso',['aggiorniamo il menu del pranzo','i contorni oggi sono spinaci al burro',["primi penne all'arrabbiata, secondi petto di pollo ai ferri",rep(PR,'Contorni','spinaci al burro=Spinaci al burro'),rep(PR,'Primi',"penne all'arrabbiata=Penne all'arrabbiata"),rep(PR,'Secondi','petto di pollo ai ferri=Petto di pollo ai ferri')]],{sera:{cmd:[1]}}),
 ses('refusi',['modifichiamo menu pranzo','primi risoto alla milanese e pasta al pomodorro','secondi cotolleta',['contorni restano uguali',rep(PR,'Primi','risotto alla milanese=Risotto alla milanese','pasta al pomodoro=Pasta al pomodoro'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese')]],{orAsk:[2,3],sera:{cmd:[1]}}),
 ses('cambia-idea',['modifichiamo menu pranzo','primi lasagna e carbonara','no, la carbonara toglila, metti la pasta e fagioli',['secondi e contorni restano uguali',rep(PR,'Primi','lasagna','pasta e fagioli=Pasta e fagioli')]],{sera:{cmd:[1]}}),
 ses('senza-piatti-esce',['modifichiamo menu pranzo','lascia stare'],{sera:{cmd:[1]}}),
 ses('comando-nuovo',['modifichiamo menu cena','primi gnocchi al pomodoro',['alza il completo della cena di un euro',{k:'fp',menu:CE,name:'Completo',price:17.9}]],{sera:{cmd:[1,3]}}),
 ses('tutto-uguale-tranne',['modifichiamo il menu della cena',['tutto uguale tranne i primi: tagliatelle al ragù e risotto ai funghi',rep(CE,'Primi','tagliatelle al ragù=Tagliatelle al ragù','risotto ai funghi=Risotto ai funghi')]],{sera:{cmd:[1]}}),
 ses('si-al-resto',['modifichiamo menu cena','secondi tagliata di manzo e salmone alla griglia',['sì',rep(CE,'Secondi','tagliata di manzo=Tagliata di manzo','salmone alla griglia=Salmone alla griglia')]],{orAsk:[3],sera:{}}),
 ses('lunga-correzioni',['modifichiamo il menu pranzo di oggi','allora primi: lasagna','e anche la carbonara nei primi','secondi cotoletta e arrosto','no aspetta, l\'arrosto no, metti le polpette',['i contorni come ieri',rep(PR,'Primi','lasagna','carbonara'),rep(PR,'Secondi','cotoletta=Cotoletta alla milanese','polpette=Polpette al sugo')]],{orAsk:[2,3,4,5],sera:{cmd:[1]}}),
]
// ---- v138 dal vivo (22/10 notte): trascrizioni ESATTE sul QA (fixture qasera: Menu del giorno a prezzo fisso, niente Contorni) ----
export const V138_CASES:MtCase[]=[
 mt('v138-sessione',[T('modifichiamo il menu del giorno'),T('primi: lasagne, carbonara e risoto ai funghi'),T('secondi tagliata e polpete al sugo'),T('no la carbonara toglila'),T('i contorni restano uguali')],
  [C('Risotto ai funghi',0,'Primi'),C('Tagliata',0,'Secondi'),HI('Gnocchi al ragù'),HI('Cotoletta'),HI('Polpette',false)],{interim:[HI('Carbonara',false)],sera:{cmd:[1]},note:'Primi = Lasagna + Risotto ai funghi (nuovo, 0 €), Secondi = Tagliata (nuova) + Polpette; il Menu non ha Contorni'}),
 mt('v138-lasagne',[V('No vabbè fa niente, voglio che aggiungi nel menù pranzo le lasagne.'),T('si'),T('si'),T('si voglio chiamarlo primi')],[],{struct:[{after:2,menus:[{name:'Menu pranzo',sections:['Primi']}],noNewMenus:true}],sera:{cmd:[1],notSay:[{turn:4,re:/Non ho cambiato nulla|già così/}]},note:'senza prezzo: mai la stessa domanda, mai «Non ho cambiato nulla» mescolato a una domanda'}),
 mt('v138-gnocchi',[T('aggiungi gnocchi al ragu in menu pranzo a 10'),T('si')],[C('Gnocchi al ragù',10,'Primi')],{alt:[[C('gnocchi al ragu',10,'Primi')]],sera:{cmd:[1],notSay:[{turn:2,re:/\(Menu del giorno\)/},{turn:1,re:/\(Menu del giorno\)/}]}}),
]
// ---- v139 dal vivo (22/10 notte): trascrizione ESATTA (Menu pranzo alla carta con Completo vuoto e Primi: Gnocchi al ragù 10) ----
V138_CASES.push({...mt('v139-si-a-vuoto',[T('voglio che aggiungi nel menù pranzo le lasagne'),T('si'),T('si'),T('si voglio chiamarlo primi'),T('lasagna 12'),T('sì')],[C('Lasagna',12,'Primi')],{sera:{cmd:[1,5],notSay:[{turn:2,re:/è pronto/},{turn:4,re:/Non ho cambiato nulla|già così/},{turn:5,re:/rispondi s[iì]/i},{turn:6,re:/^Non ho cambiato nulla\.?$/m}]},note:'«lasagna 12» dopo il suggerimento del bot crea subito; nessuna conferma senza azioni, nessun «sì» a vuoto'}),menu:'qasera139'})
export const MULTITURNO_CASES:MtCase[]=[...MULTITURNO_BASE,...SESSIONE_CASES,...V138_CASES]
