// 30 conversazioni NUOVE dello spike Haiku (18/10/2026), scritte nello stile del banco vero: vocali storpiati, correzioni,
// riepiloghi, percentuali, «tre dici», numeri non-prezzo, elimina con conferma, annulla, piatto del giorno, due richieste,
// domande travestite da ordini. Stesse attese del banco (stato finale + turni ask), stesso giudice.
import type {Change,Conversation,Family,Turn} from '../../../../tests/eval/types.ts'
type In=string|Turn
const T=(s:string):Turn=>({text:s}),Q=(s:string):Turn=>({text:s,q:true}),V=(s:string):Turn=>({voice:s}),VQ=(s:string):Turn=>({voice:s,q:true})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),AV=(dish:string,value=false):Change=>({op:'available',dish,value}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const PR=(dish:string,price:number|null):Change=>({op:'promo',dish,price}),FE=(dish:string,value=true):Change=>({op:'featured',dish,value})
const CR=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const DEL=(dish:string):Change=>({op:'delete',dish})
const NONE:Change[]=[]
type Extra={ask?:number[],askNoWrite?:boolean,alt?:Change[][],reply?:RegExp,interim?:Change[],note?:string,mods?:Conversation['mods']}
export const EXTRA_CASES:Conversation[]=[]
const c=(menu:string,turns:In|In[],changes:Change|Change[],x:Extra={})=>{EXTRA_CASES.push({id:`x-${String(EXTRA_CASES.length+1).padStart(3,'0')}`,family:'bv-semplici' as Family,menu,turns:(Array.isArray(turns)?turns:[turns]).map(t=>typeof t==='string'?T(t):t),changes:Array.isArray(changes)?changes:[changes],source:'spike-haiku 18/10',...x})}

// vocali storpiati
c('pesce',V('U tunnu in agrodolce è finito.'),AV('Tonno in agrodolce'),{note:'«u tunnu» = tonno'})
c('romana',V('La carbonare mettila a tre dici euro.'),P('Carbonara',13),{note:'«tre dici» = 13'})
c('pizzeria',V('Il babbà costa cinque euro adesso.'),P('Babà',5))
c('romana',V('Le pontarelle non ci stanno più.'),AV('Puntarelle'))
c('pesce',V('Metti la pasta con le sarte a quindici.'),P('Pasta con le sarde',15))
// correzioni
c('romana','la gricia a 12, anzi no a 11 e 50',P('Gricia',11.5))
c('pizzeria',['la diavola mettila a 8','no scusa, la capricciosa a 8, la diavola lasciala com\'era'],P('Capricciosa',8),{interim:[P('Diavola',8)]})
// riepilogo da confermare
c('romana',['carbonara 13, amatriciana 12, cacio e pepe 12, gricia 12, saltimbocca 16','va bene così'],[P('Carbonara',13),P('Amatriciana',12),P('Cacio e pepe',12),P('Gricia',12),P('Saltimbocca alla romana',16)])
// percentuali e delta
c('bar','alza il cappuccino del 25%',P('Cappuccino',2))
c('bar','abbassa di 50 centesimi lo spritz aperol',P('Spritz Aperol',5.5))
// numeri non-prezzo
c('romana','al tavolo 7 hanno detto che la coda era fredda, comunque la coda è finita',AV('Coda alla vaccinara'),{note:'7 non è un prezzo'})
c('pizzeria',Q('per 4 persone quante margherite servono?'),NONE,{note:'domanda fuori menu, niente scritture'})
// elimina con conferma
c('romana',['elimina la trippa','sì'],DEL('Trippa alla romana'),{ask:[1]})
c('pesce',['cancella proprio la cassata','no lascia stare'],NONE,{ask:[1]})
c('pizzeria',['elimina la montanarina','la marinara a 6'],P('Marinara',6),{ask:[1],note:'il «sì» non arriva: niente eliminazione'})
// annulla
c('romana',['il maritozzo è finito','annulla'],NONE,{interim:[AV('Maritozzo con la panna')]})
c('bar',['negroni a 9','americano a 8','annulla'],P('Negroni',9),{interim:[P('Americano',8)]})
// piatto del giorno
c('romana','piatto del giorno: pasta e ceci a 10 euro',CR('pasta e ceci',10,'Piatto del giorno'),{alt:[[CR('Pasta e ceci',10,'Piatto del giorno')]]})
c('pesce',['oggi piatto del giorno pesce spada alla griglia a 18','annulla'],CR('pesce spada alla griglia',18,'Piatto del giorno'),{note:'il piatto del giorno non si annulla'})
// due richieste in un messaggio
c('pizzeria','la bufalina è finita e la sfogliatella mettila a 3 e mezzo',[AV('Bufalina'),P('Sfogliatella',3.5)])
c('pesce',V('Nascondi le panelle e metti in evidenza i ricci.'),[HI('Panelle'),FE('Spaghetti ai ricci')])
c('bar','tramezzino tonno finito, toast a 4 e 50 e il ginseng lo metti in promo a 1 e 50',[AV('Tramezzino tonno'),P('Toast',4.5),PR('Ginseng',1.5)])
// domande travestite da ordini
c('romana',Q('dimmi se la carbonara costa ancora 12'),NONE,{reply:/12/})
c('pizzeria',Q('controlla se il babà è finito'),NONE)
c('bar',Q('fammi vedere cosa ho nascosto'),NONE,{mods:{hidden:['Orzo']},reply:/orzo/i})
// ambigui / mancanti
c('romana','le fettuccine a 13',P('Fettuccine al ragù',13),{note:'una sola fettuccine'})
c('romana','il supplì a 3',NONE,{ask:[1],note:'due supplì: chiedere'})
c('pizzeria',['aggiungi la pizza tonno e cipolla','8 euro'],CR('pizza tonno e cipolla',8,'Pizze'),{ask:[1],alt:[[CR('Pizza tonno e cipolla',8,'Pizze')],[CR('tonno e cipolla',8,'Pizze')]]})
c('pesce','aggiungi il tiramisù a 7',NONE,{ask:[1],note:'c\'è già il tiramisù a 6: chiedere, niente doppione'})
c('bar',V('Il cornetto mettilo a 1 e 40, quello integrale invece lascialo.'),P('Cornetto',1.4))
