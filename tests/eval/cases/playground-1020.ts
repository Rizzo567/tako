// Set PLAYGROUND (run motore Haiku 21/10/2026, PIANO bot-haiku §5 B.6, verifica V8c): le 20 frasi provate da Manuel nel
// playground Anthropic il 20/10 (~/Downloads/PLAYGROUND-2-ISTRUZIONI-E-FRASI.txt), ora attraverso il route vero (validatore
// compreso), sul menu «Trattoria Da Mario» (fixture mariopg = mario) con la memoria del playground: «la carbo» = Spaghetti alla
// carbonara, «la coca» = Coca Cola 33cl, «la tagliata» = Tagliata di manzo. Attese corrette (PIANO T4b): 16 «la coca a 3» (già
// 3 €) → nessuna scrittura e risposta «è già a 3 €»; 17 → riepilogo + OK, nessuna scrittura al primo turno; 19 «nascondi tutta la
// cena» → una conferma sul Menu cena, nessuna scrittura al primo turno. Le frasi 7–14 (parlato sporco) arrivano come vocali.
// Soglia: 20/20 senza GRAVI.
import type {Change,Family,Turn} from '../types.js'
import type {HaikuCase} from './victoria-1019.js'

const T=(s:string):Turn=>({text:s}),Q=(s:string):Turn=>({text:s,q:true}),V=(s:string):Turn=>({voice:s})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),AV=(dish:string,value=false):Change=>({op:'available',dish,value}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const NONE:Change[]=[]
const CARBO='Spaghetti alla carbonara'
let n=0
const c=(turn:string|Turn,changes:Change[],x:Partial<HaikuCase>={}):HaikuCase=>({id:`pg-${String(++n).padStart(2,'0')}`,family:'bv-semplici' as Family,menu:'mariopg',turns:[typeof turn==='string'?T(turn):turn],changes,source:'playground 20/10',...x})

export const PLAYGROUND_ALIASES=[{phrase:'la carbo',dish:CARBO},{phrase:'la coca',dish:'Coca Cola 33cl'},{phrase:'la tagliata',dish:'Tagliata di manzo'}]

export const PLAYGROUND_CASES:HaikuCase[]=[
 // Normali
 c('la carbonara mettila a 13 euro',[P(CARBO,13)]),
 c('è finita la lasagna',[AV('Lasagna al forno')]),
 c(Q('quanto costa la diavola?'),NONE,{says:[{turn:1,re:/8[,.]5/}]}),
 c('aggiungi nei primi cacio e pepe che costa 11',[{op:'create',name:'Cacio e pepe',price:11,section:'Primi'}]),
 c('elimina la panna cotta',NONE,{ask:[1],says:[{turn:1,re:/\bs[iì](?![a-z])/i}]}),
 c('la carbo a 12 anzi 13',[P(CARBO,13)]),
 // Parlato sporco (vocale trascritto male)
 c(V('eh allora senti eh la… la carbo… mettila a… tredici'),[P(CARBO,13)]),
 c(V('la lasagn… finit'),[AV('Lasagna al forno')],{alt:[NONE],actOrAsk:['lasagna']}),
 c(V('gnocchi quattro formag dodic'),[P('Gnocchi 4 formaggi',12)]),
 c(V("a coca… non ce n'è più"),[AV('Coca Cola 33cl')]),
 c(V('la tagliat… diciott e cinquant'),[P('Tagliata di manzo',18.5)]),
 c(V('quella di prima… mettila a dieci'),NONE,{ask:[1],note:'nessuna cronologia: chiede quale'}),
 c(V('o tiramis… levalo'),[HI('Tiramisù')]),
 c(V('bruschett cinque e mezz'),[P('Bruschetta al pomodoro',5.5)]),
 // Trappole
 c('metti la pasta a 10',NONE,{ask:[1],note:'più paste: Pasta e fagioli / Pasta del giorno / pasta al ragù…'}),
 c('la coca a 3',NONE,{says:[{turn:1,re:/\bgi[aà](?![a-z])/i},{turn:1,re:/\b3\b/}],note:'già a 3 €: nessuna scrittura, lo dice'}),
 c('aumenta tutte le pizze di un euro',[P('Margherita',8),P('Pizza 4 formaggi',10),P('Diavola',9.5),P('Capricciosa',10.5)],{note:'decisione Manuel 21/10: modifica uniforme su un gruppo → si applica subito con riepilogo (undo 10 min), niente «Rispondi OK»'}),
 c('aggiungi la carbonara a 14',NONE,{ask:[1],note:'esiste già: chiede se aggiornare o crearne un altro'}),
 c('nascondi tutta la cena',NONE,{structAsk:[1],says:[{turn:1,re:/cena/i}],note:'intero Menu cena: una conferma, nessuna scrittura al primo turno'}),
 c(Q('cosa sai fare?'),NONE,{says:[{turn:1,re:/prezz/i,sev:'BASSO'}]}),
]
