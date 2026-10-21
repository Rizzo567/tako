// Set PARLATO SPORCO (run motore Haiku 21/10/2026, PIANO bot-haiku §5 B.5, verifica V8b): 30 vocali di un ristoratore anziano
// che biascica, come li restituirebbe Whisper: parole mangiate («carbonar tredic»), nomi storpiati dal riconoscimento («ghisa» =
// Gricia, «cocacola», «amatricana», «sorrendina»), frasi senza verbo («la sorrentina… finita»), riempitivi e ripetizioni, numeri in
// lettere spezzati («dodici e… cinquanta»), correzioni a metà («quattro e mezzo… no cinque»), dialetto romanesco/napoletano.
// Fixture «anziano» (trattoria romana, nomi unici). Attesa per ognuna: la modifica giusta OPPURE una sola domanda che nomina il
// piatto giusto («Intendi la Gricia?») — `alt:[NONE]` + `actOrAsk` (parole del nome che la domanda deve contenere).
// GRAVE = piatto sbagliato, prezzo sbagliato o non detto, scrittura senza capire (giudice condiviso + invarianti del runner).
// Metriche separate nel runner: corrette, domande giuste, GRAVI.
import type {Change,Family,Turn} from '../types.js'
import type {HaikuCase} from './victoria-1019.js'

const V=(s:string):Turn=>({voice:s})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),AV=(dish:string,value=false):Change=>({op:'available',dish,value}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const NONE:Change[]=[]
let n=0
/** `ask` = parole (≥4 lettere) del piatto giusto che una domanda di conferma deve nominare. */
const c=(voice:string,changes:Change[],ask:string[],x:Partial<HaikuCase>={}):HaikuCase=>({id:`ps-${String(++n).padStart(2,'0')}`,family:'bv-asr' as Family,menu:'anziano',turns:[V(voice)],changes,alt:[NONE],actOrAsk:ask,source:'parlato sporco 21/10',...x})

export const PARLATO_CASES:HaikuCase[]=[
 // parole mangiate
 c('carbonar tredic',[P('Carbonara',13)],['carbonara']),
 c('la lasagn… a dodic',[P('Lasagna',12)],['lasagna']),
 c('saltimbocc… sedic',[P('Saltimbocca alla romana',16)],['saltimbocca']),
 c('polpett… finite',[AV('Polpette al sugo')],['polpette']),
 c('margherita otto',[P('Margherita',8)],['margherita']),
 // nomi storpiati dal riconoscimento vocale
 c('la ghisa a dodici',[P('Gricia',12)],['gricia']),
 c('amatricana finita',[AV('Amatriciana')],['amatriciana']),
 c('la cocacola mettila a tre e cinquanta',[P('Coca Cola',3.5)],['coca']),
 c('la sorrendina a dieci',[P('Sorrentina',10)],['sorrentina']),
 c('il cacio pepe… dodici e… cinquanta',[P('Cacio e pepe',12.5)],['cacio','pepe']),
 // frasi senza verbo
 c('la sorrentina… finita',[AV('Sorrentina')],['sorrentina']),
 c('saltimbocca… nun ce sta… finito',[AV('Saltimbocca alla romana')],['saltimbocca']),
 c('gricia e carbonara… finite',[AV('Gricia'),AV('Carbonara')],['gricia','carbonara']),
 // riempitivi e ripetizioni
 c('eh allora senti eh la… la carbonara… mettila a… quattordici',[P('Carbonara',14)],['carbonara']),
 c('la coda… la coda alla vaccinara diciassette',[P('Coda alla vaccinara',17)],['coda','vaccinara']),
 c("l'abbacchio… è finito l'abbacchio",[AV('Abbacchio scottadito')],['abbacchio']),
 c('la birra… la birra a sei',[P('Birra',6)],['birra']),
 c('eh… la crostata… togli la crostata',[HI('Crostata')],['crostata']),
 c('mo… la diavola… la diavola a nove',[P('Diavola',9)],['diavola']),
 // numeri in lettere spezzati
 c('amatriciana… undici e cinquanta',[P('Amatriciana',11.5)],['amatriciana']),
 c("l'acqua… due e cinquanta",[P('Acqua naturale',2.5)],['acqua']),
 c('vino della casa… sei euri',[P('Vino della casa 1/4',6)],['vino']),
 c('la cicoria mettila a sei euro… sei',[P('Cicoria ripassata',6)],['cicoria']),
 // correzioni a metà: vale l'ultimo valore / l'ultimo piatto
 c('le patate quattro e mezzo… no cinque',[P('Patate al forno',5)],['patate']),
 c('er caffè… uno e cinquanta… no uno e sessanta',[P('Caffè',1.6)],['caffe']),
 c("allora… la carbonara… no aspetta… l'amatriciana a tredici",[P('Amatriciana',13)],['amatriciana']),
 // dialetto
 c("a gricia nun ce sta cchiù",[AV('Gricia')],['gricia']),
 c('o tiramisù levalo',[HI('Tiramisù')],['tiramisu']),
 c("a panna cotta… nun c'è cchiù",[AV('Panna cotta')],['panna','cotta']),
 c('eh senti… le polpette… rimettile… ci stanno di nuovo',[AV('Polpette al sugo',true)],['polpette'],{mods:{unavail:['Polpette al sugo']}}),
]
