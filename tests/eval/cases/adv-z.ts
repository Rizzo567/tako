// Verifica AVVERSARIA indipendente Z (18/10/2026, agente Z) dopo la fase R «un solo cervello». Conversazioni NUOVE, famiglie che
// X e Y non hanno provato: dialetti, vocali trascritti male, numeri in lettere, tempi («da domani», «solo stasera»), categorie
// omonime ai piatti (fixture «zeta»: Calzoni/Calzone, Pizze/Pizza 'nduja, Vini/Vino della casa), correzioni a riepiloghi in attesa,
// messaggi lunghissimi, emoji/media, richieste contraddittorie, «annulla» in ogni posizione, piatti nascosti/finiti, prezzi assurdi,
// apostrofi/virgolette nei nomi, ripetizioni, interruzioni a metà conferma, domande travestite da ordini e viceversa,
// promo/evidenza, spostamenti, rinomine a catena. Regole del titolare come Y: «togli» = nascondi; elimina solo dopo «sì»;
// «annulla» = ultima pubblicazione entro 10 minuti; > 3 modifiche → riepilogo e OK; mai prezzi non detti; mai «fatto» falso.
// Runner: tests/eval/eval-adv-z.test.ts.
import type {Change,Conversation,Family,MenuFixture,Turn} from '../types.js'
import {FIXTURES} from '../fixtures/menus.js'
import './adv-y.js' // registra la fixture «ycat»

const hex=(n:number,w:number)=>n.toString(16).padStart(w,'0')
function build(key:string,code:number,restaurant:string,spec:[string,string,[string,[string,number][]][]][]):MenuFixture{let m=0,s=0,i=0
 const menus=spec.map(([name,type,sections])=>({id:`6${hex(code,7)}-6666-4666-8666-${hex(++m,12)}`,name,type,sections:sections.map(([sname,items])=>({id:`7${hex(code,7)}-7777-4777-8777-${hex(++s,12)}`,name:sname,items:items.map(([iname,price])=>({id:`5${hex(code,7)}-5555-4555-8555-${hex(++i,12)}`,name:iname,price}))}))}))
 return{key,restaurant,menu:{menus,design:{}}}}
// ---------- fixture «zeta»: apostrofi, numeri nei nomi, «e» dentro i nomi, categorie omonime ai piatti.
export const zeta=build('zeta',0xb8,"Osteria dell'Apostrofo",[['Pranzo e cena','lunch',[
 ['Antipasti',[['Bruschetta',5],["Frittatina 'e pasta",3],['Burrata',9],["Tagliere dell'oste",14]]],
 ['Pizze',[['Margherita',7],["Pizza 'nduja",9],['Quattro stagioni',8.5],["Pizza all'ortolana",8]]],
 ['Calzoni',[['Calzone',8],['Calzone fritto',9]]],
 ['Primi',[['Carbonara',12],["Spaghetti all'astice",24],['Pasta e patate',10],['Gnocchi alla sorrentina',11]]],
 ['Secondi',[['Tagliata',18],['Baccalà fritto',15],["Polpo all'insalata",14]]],
 ['Dolci',[['Tiramisù',6],['Babà',5],['Delizia al limone',5.5]]]]],
 ['Bevande','drinks',[['Bibite',[['Acqua',2],['Birra',5],['Coca Cola',3]]],['Vini',[['Vino della casa',4],['Greco di Tufo',25]]]]]])
FIXTURES.zeta=zeta

type In=string|Turn
const T=(s:string):Turn=>({text:s}),Q=(s:string):Turn=>({text:s,q:true}),V=(s:string):Turn=>({voice:s}),W=(m:number):Turn=>({wait:m})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const FE=(dish:string,value=true):Change=>({op:'featured',dish,value}),AV=(dish:string,value=false):Change=>({op:'available',dish,value})
const PR=(dish:string,price:number|null):Change=>({op:'promo',dish,price})
const CR=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const DEL=(dish:string):Change=>({op:'delete',dish}),REN=(dish:string,name:string):Change=>({op:'rename',dish,name}),MV=(dish:string,section:string):Change=>({op:'move',dish,section})
const SEC=(name:string):Change=>({op:'section',name})
const NONE:Change[]=[]
type Extra={ask?:number[],askNoWrite?:boolean,alt?:Change[][],reply?:RegExp,interim?:Change[],note?:string,mods?:Conversation['mods']}
export const ADV_Z_CASES:Conversation[]=[]
let fam='dialetto'
const c=(menu:string,turns:In|In[],changes:Change|Change[],x:Extra={})=>{const id=`z-${fam}-${String(ADV_Z_CASES.filter(k=>k.source===`z:${fam}`).length+1).padStart(3,'0')}`
 ADV_Z_CASES.push({id,family:'b1-elimina' as Family,menu,turns:(Array.isArray(turns)?turns:[turns]).map(t=>typeof t==='string'?T(t):t),changes:Array.isArray(changes)?changes:[changes],source:`z:${fam}`,...x})}
const Z='zeta',Y='ycat'

// ---- 1. dialetti e parlato regionale ----
fam='dialetto'
c(Z,"'a carbonara mettila a tridici",P('Carbonara',13),{alt:[NONE]})
c(Z,'o babà è fernuto',AV('Babà'))
c(Z,"'o babà nun ce sta cchiù",AV('Babà'),{alt:[[HI('Babà')]]})
c(Z,'la tagliata oggi nun ce sta',AV('Tagliata'),{alt:[[HI('Tagliata')]]})
c(Z,'mettece la burrata a diece euro',P('Burrata',10))
c(Z,'la burrata falla a dieci, va bbuono',P('Burrata',10))
c(Z,"ué, 'a margherita a otto",P('Margherita',8))
c(Z,'la birra a sei, ja',P('Birra',6))
c(Z,'daje, la carbonara a 13',P('Carbonara',13))
c(Z,'la carbonara mettimela a 13 nè',P('Carbonara',13))
c(Z,'la tagliata è finita, abbiamo finito tutto stasera',AV('Tagliata'),{alt:[NONE],note:'notte 22/10: «abbiamo finito tutto stasera» è un secondo comando potenziale (tutto esaurito?): tenere la tagliata in sospeso e chiedere del «tutto» è la regola delle parti incerte (mai pubblicato a metà), quindi vale anche zero scritture'})
c(Z,'il babà levalo che non è venuto bene',HI('Babà'))
c(Z,'il babà scancellalo proprio',DEL('Babà'),{ask:[1],alt:[NONE]})
c(Z,['il babà scancellalo proprio','sine'],DEL('Babà'),{ask:[1],alt:[NONE]})
c(Z,['elimina il babà','seh'],DEL('Babà'),{ask:[1],alt:[NONE],note:'«seh» romanesco = sì, ma può anche richiedere'})
c(Z,['elimina il babà','manco pe gnente'],NONE,{ask:[1]})
c(Z,['elimina il babà','nun lo fa'],NONE,{ask:[1]})
c(Z,'ma quanto costa la tagliata, mo?',NONE,{note:'domanda in dialetto: nessuna scrittura'})
c(Z,[Q('a quanto sta o calzone?')],NONE)
c(Z,[Q("che c'è nei dolci, fra?")],NONE)
c(Z,'la pasta e patate mettila a unnici',P('Pasta e patate',11),{alt:[NONE]})
c(Z,"lo spaghetto all'astice fallo a ventisei",P("Spaghetti all'astice",26))
c(Z,'aò la coca a tre e cinquanta',P('Coca Cola',3.5))
c(Z,'mette o vino da casa a cinque',P('Vino della casa',5))
c(Z,'u polpu all\'insalata finìu',AV("Polpo all'insalata"),{alt:[NONE]})

// ---- 2. vocali trascritti male ----
fam='asr'
c(Z,V('la carbo nara a tredici euro'),P('Carbonara',13))
c(Z,V('la carbonara a tre dici'),P('Carbonara',13),{alt:[NONE]})
c(Z,V('il tira mi su è finito'),AV('Tiramisù'))
c(Z,V('il tiramisu e finito'),AV('Tiramisù'))
c(Z,V('la pizza en duja a dieci'),P("Pizza 'nduja",10))
c(Z,V('la pizza indulia a dieci'),P("Pizza 'nduja",10),{alt:[NONE]})
c(Z,V('il greco di tufo a ventotto'),P('Greco di Tufo',28))
c(Z,V('il greco di tutto a ventotto'),P('Greco di Tufo',28),{alt:[NONE]})
c(Z,V('il bacalà fritto a sedici'),P('Baccalà fritto',16))
c(Z,V('i gnocchi alla sorrentina a dodici'),P('Gnocchi alla sorrentina',12))
c(Z,V('gli occhi alla sorrentina a dodici'),P('Gnocchi alla sorrentina',12),{alt:[NONE]})
c(Z,V('la tagliata a diciotto anzi diciannove'),P('Tagliata',19))
c(Z,V('la tagliata a diciannove. Punto.'),P('Tagliata',19))
c(Z,V('eeeh allora... la birra... sei euro'),P('Birra',6))
c(Z,V('la burata a nove e cinquanta'),P('Burrata',9.5))
c(Z,V('la delizia al limone a sei'),P('Delizia al limone',6))
c(Z,V('la delizia a limone e finita'),AV('Delizia al limone'))
c(Z,V('il calzone fritto a dieci e il calzone a nove'),[P('Calzone fritto',10),P('Calzone',9)])
c(Z,V('il calzone a nove e il calzone fritto a dieci'),[P('Calzone fritto',10),P('Calzone',9)])
c(Z,V('quattro stagioni a nove'),P('Quattro stagioni',9))
c(Z,V('la 4 stagioni a 9'),P('Quattro stagioni',9))
c(Z,V('la quattro stagione a nove euro'),P('Quattro stagioni',9))
c(Z,V('sottotitoli creati dalla comunità amara.org'),NONE,{note:'allucinazione tipica di Whisper sul silenzio'})
c(Z,V('grazie a tutti per la visione'),NONE,{note:'allucinazione Whisper'})
c(Z,V('...'),NONE)

// ---- 3. numeri in lettere ----
fam='numeri'
c(Z,'la tagliata a venti',P('Tagliata',20))
c(Z,'la tagliata a ventuno',P('Tagliata',21))
c(Z,'la tagliata a ventidue e cinquanta',P('Tagliata',22.5))
c(Z,'la tagliata a diciannove e novanta',P('Tagliata',19.9))
c(Z,'la tagliata a diciannove virgola cinque',P('Tagliata',19.5))
c(Z,'il greco di tufo a trentadue',P('Greco di Tufo',32))
c(Z,'il greco di tufo a trentotto',P('Greco di Tufo',38))
c(Z,'la birra a cinque e mezzo',P('Birra',5.5))
c(Z,'la birra a cinque euro e mezzo',P('Birra',5.5))
c(Z,'la birra a 5 e mezzo',P('Birra',5.5))
c(Z,"l'acqua a un euro e cinquanta",P('Acqua',1.5))
c(Z,"l'acqua a uno e cinquanta",P('Acqua',1.5))
c(Z,"l'acqua a 1 e 50",P('Acqua',1.5))
c(Z,'la carbonara a dodici e mezzo',P('Carbonara',12.5))
c(Z,'la quattro stagioni a nove',P('Quattro stagioni',9),{note:'«quattro» è nel nome, il prezzo è nove'})
c(Z,'la quattro stagioni a quattro',P('Quattro stagioni',4),{alt:[NONE]})
c(Z,'quattro stagioni 9',P('Quattro stagioni',9))
c(Z,'aumenta la quattro stagioni di un euro',P('Quattro stagioni',9.5))
c(Z,'aumenta la tagliata di due euro',P('Tagliata',20))
c(Z,'abbassa la tagliata di tre',P('Tagliata',15))
c(Z,'la tagliata un euro in più',P('Tagliata',19))
c(Z,'la tagliata due euro in meno',P('Tagliata',16))
c(Z,'la tagliata la metti a diciotto',NONE,{note:'già a 18: nessuna scrittura'})
c(Z,'il calzone a otto',NONE,{note:'già a 8'})
c(Z,'aggiungi nei dolci la cassata a sei',CR('cassata',6,'Dolci'))

// ---- 4. tempi: da domani, solo stasera, fino a ----
fam='tempo'
c(Z,'da domani la carbonara a 13',NONE,{ask:[1],alt:[[P('Carbonara',13)]],note:'la nota 65 vuole una domanda; mai un prezzo diverso'})
c(Z,'dalla settimana prossima la tagliata a 20',NONE,{ask:[1],alt:[[P('Tagliata',20)]]})
c(Z,'solo stasera la tagliata è finita',AV('Tagliata'))
c(Z,'per oggi niente babà',AV('Babà'),{alt:[[HI('Babà')]]})
c(Z,'stasera il babà non c\'è',AV('Babà'),{alt:[[HI('Babà')]]})
c(Z,'domani il babà non c\'è',NONE,{ask:[1],alt:[[AV('Babà')]]})
c(Z,'il babà finito fino a domenica',AV('Babà'),{alt:[NONE]})
c(Z,'la burrata in promo a 7 fino a domenica',PR('Burrata',7),{alt:[NONE]})
c(Z,'la carbonara a 13 da adesso',P('Carbonara',13))
c(Z,'da ora la carbonara a 13',P('Carbonara',13))
c(Z,'ieri la carbonara era a 13',NONE,{note:'racconto al passato: nessuna scrittura'})
c(Z,'la settimana scorsa avevo messo la carbonara a 13?',NONE)
c(Z,'la tagliata è tornata',AV('Tagliata',true),{mods:{unavail:['Tagliata']}})
c(Z,'da stasera torna la tagliata',AV('Tagliata',true),{mods:{unavail:['Tagliata']},alt:[NONE]})
c(Z,'domani torna la tagliata',NONE,{mods:{unavail:['Tagliata']},alt:[[AV('Tagliata',true)]],ask:[1]})
c(Z,['la tagliata a 20',W(15),'anzi 21'],P('Tagliata',21),{interim:[P('Tagliata',20)],alt:[[P('Tagliata',20)]]})
c(Z,['la tagliata a 20',W(45),'anzi 21'],P('Tagliata',21),{alt:[[P('Tagliata',20)]],note:'oltre 30 min: o 21 o chiede, mai altro'})
c(Z,['la tagliata a 20',W(12),'annulla'],P('Tagliata',20),{note:'oltre 10 minuti annulla non torna indietro'})
c(Z,['la tagliata a 20',W(8),'annulla'],NONE,{interim:[P('Tagliata',20)]})
c(Z,'fino a fine mese la birra a 4',P('Birra',4),{alt:[[PR('Birra',4)],NONE]})

// ---- 5. categorie omonime ai piatti ----
fam='omonimi'
c(Z,'il calzone a 9',P('Calzone',9))
c(Z,'i calzoni a 10',NONE,{ask:[1],alt:[[P('Calzone',10),P('Calzone fritto',10)]]})
c(Z,'nascondi i calzoni',[HI('Calzone'),HI('Calzone fritto')],{alt:[[HI('Calzone')]]})
c(Z,'nascondi il calzone',HI('Calzone'))
c(Z,'il calzone è finito',AV('Calzone'))
c(Z,'sposta il calzone nelle pizze',MV('Calzone','Pizze'))
c(Z,'sposta il calzone fritto negli antipasti',MV('Calzone fritto','Antipasti'))
c(Z,'aggiungi nei calzoni il calzone con ricotta a 9',CR('calzone con ricotta',9,'Calzoni'))
c(Z,'aggiungi il calzone ripieno a 9',CR('calzone ripieno',9,'Calzoni'),{alt:[NONE],ask:[]})
c(Z,'rinomina la categoria calzoni in ripieni',[]) // 22/10 notte: rinomina = stessi piatti, nessuno spostamento (giudice per id del sottomenu)
c(Z,'rinomina il calzone in calzone classico',REN('Calzone','calzone classico'),{alt:[[REN('Calzone','Calzone classico')]]})
c(Z,'la pizza a 8',NONE,{ask:[1],note:'«la pizza» = 4 pizze: domanda'})
c(Z,'tutte le pizze a 9',[P('Margherita',9),P("Pizza 'nduja",9),P('Quattro stagioni',9),P("Pizza all'ortolana",9)],{alt:[NONE]})
c(Z,'il vino a 5',P('Vino della casa',5),{alt:[NONE]})
c(Z,'i vini in evidenza',[FE('Vino della casa'),FE('Greco di Tufo')],{alt:[NONE]})
c(Z,'sposta il vino della casa nelle bibite',MV('Vino della casa','Bibite'))
c(Z,'sposta la birra nei vini',MV('Birra','Vini'))
c(Z,'la pasta e patate a 11',P('Pasta e patate',11),{note:'«e» dentro il nome: un solo piatto'})
c(Z,'la pasta e patate a 11 e la carbonara a 13',[P('Pasta e patate',11),P('Carbonara',13)])
c(Z,'nascondi pasta e patate',HI('Pasta e patate'))
c(Z,'la pasta a 11',NONE,{ask:[1],alt:[[P('Pasta e patate',11)]]})
c(Y,'i dolci a 6',NONE,{ask:[1],alt:[[P('Dolce del giorno',6),P('Panna cotta',6)]],note:'mai il solo Dolce del giorno'})
c(Y,'nascondi lo speciale',HI('Speciale della casa'))
c(Y,'rinomina speciali in specialità',NONE,{alt:[[MV('Speciale della casa','Specialità')]]})

// ---- 6. correzioni a riepiloghi in attesa (> 3 modifiche) ----
fam='riepilogo'
const R4='la carbonara a 13, la tagliata a 19, la birra a 6 e il babà a 4'
const R4C=[P('Carbonara',13),P('Tagliata',19),P('Birra',6),P('Babà',4)]
c(Z,[R4,'ok'],R4C)
c(Z,[R4,'la birra però a 5,50','ok'],[P('Carbonara',13),P('Tagliata',19),P('Birra',5.5),P('Babà',4)],{alt:[[P('Carbonara',13),P('Tagliata',19),P('Birra',5.5),P('Babà',4)]]})
c(Z,[R4,'togli la birra dalla lista','ok'],[P('Carbonara',13),P('Tagliata',19),P('Babà',4)],{alt:[[P('Carbonara',13),P('Tagliata',19),P('Babà',4),HI('Birra')]],note:'«togli dalla lista» = non cambiarla; nascondere la birra sarebbe un errore (alt solo per misurarlo)'})
c(Z,[R4,'la birra lasciala com\'è','ok'],[P('Carbonara',13),P('Tagliata',19),P('Babà',4)])
c(Z,[R4,'no'],NONE)
c(Z,[R4,'annulla'],NONE)
c(Z,[R4,'annulla la birra','ok'],[P('Carbonara',13),P('Tagliata',19),P('Babà',4)],{alt:[NONE]})
c(Z,[R4,'aggiungi anche la burrata a 10','ok'],[...R4C,P('Burrata',10)])
c(Z,[R4,'il babà a 4,50 non 4','ok'],[P('Carbonara',13),P('Tagliata',19),P('Birra',6),P('Babà',4.5)])
c(Z,[R4,'sì ma la tagliata a 20'],[P('Carbonara',13),P('Tagliata',20),P('Birra',6),P('Babà',4)],{alt:[NONE]})
c(Z,[R4,'quanto costava la birra prima?'],NONE,{note:'domanda con riepilogo in attesa: niente pubblicazione'})
c(Z,[R4,Q('quanto costava la birra prima?'),'ok'],R4C)
c(Z,[R4,'ok ok'],R4C)
c(Z,[R4,'OK!'],R4C)
c(Z,[R4,'okk'],R4C,{alt:[NONE]})
c(Z,[R4,'va bene tutto tranne la birra'],[P('Carbonara',13),P('Tagliata',19),P('Babà',4)],{alt:[NONE]})
c(Z,[R4,W(40),'ok'],NONE,{note:'OK dopo 40 minuti: mai pubblicare un riepilogo vecchio'})
c(Z,[R4,'elimina il tiramisù'],NONE,{ask:[2],note:'richiesta nuova: non conferma il riepilogo'})
c(Z,['la carbonara a 13, la tagliata a 19, la birra a 6, il babà a 4 e il tiramisù a 7','ok'],[...R4C,P('Tiramisù',7)])
c(Z,[R4,'ok','annulla'],NONE,{interim:R4C,alt:[R4C],note:'annulla dopo un riepilogo: tutto o niente, mai a metà'})

// ---- 7. messaggi lunghissimi ----
fam='lunghi'
c(Z,'Buongiorno, allora, scusa se ti scrivo così presto ma stamattina sono andato al mercato e il pesce costava tantissimo, quindi ho deciso: il polpo all\'insalata lo metti a 16, gli spaghetti all\'astice a 26, e poi niente, per il resto lascia tutto com\'è, grazie mille e buona giornata',[P("Polpo all'insalata",16),P("Spaghetti all'astice",26)])
c(Z,'senti ho parlato con mia moglie e dice che la carbonara a 12 è troppo poco, io dicevo 14 ma lei dice 13, alla fine facciamo come dice lei',P('Carbonara',13),{alt:[NONE]})
c(Z,'allora ricapitolo: ieri ti avevo detto la tagliata a 20, ma non l\'hai fatto, però va bene così, lasciala a 18, non toccare niente',NONE)
c(Z,'la carbonara costa 12 da tre anni, il guanciale è aumentato del 30 per cento, le uova pure, mi conviene alzarla?',NONE,{note:'domanda di consiglio: nessuna scrittura'})
c(Z,'Ciao! Oggi è una giornata pienissima, abbiamo 40 coperti a pranzo, quindi per favore: il babà è finito, la burrata pure, e metti in evidenza la tagliata che ne abbiamo tanta. Grazie!',[AV('Babà'),AV('Burrata'),FE('Tagliata')])
c(Z,'Ho 3 tavoli da 8 persone stasera, il tiramisù non basta per tutti, mettilo come ultime porzioni',{op:'last',dish:'Tiramisù',value:true},{alt:[[AV('Tiramisù')],NONE],note:'«3» e «8» non sono prezzi'})
c(Z,'abbiamo fatto 12 pizze margherita in 10 minuti, record!',NONE,{note:'numeri che non sono prezzi'})
c(Z,'il cliente del tavolo 5 ha detto che la carbonara a 12 è un regalo',NONE)
c(Z,'x'.repeat(3000),NONE)
// R6.1 riclassificato (REPORT-R6): 40 ripetizioni, il bot non scrive e risponde che non ha letto: nessuna scrittura, accettato.
c(Z,('la carbonara a 13 ').repeat(40),P('Carbonara',13),{alt:[NONE]})

// ---- 8. emoji, media, vuoti ----
fam='emoji'
c(Z,'🍝 13',NONE,{ask:[1],alt:[[P('Carbonara',13)]]})
c(Z,'carbonara ➡️ 13',P('Carbonara',13))
c(Z,'carbonara 13€ ✅',P('Carbonara',13))
c(Z,'babà ❌',AV('Babà'),{alt:[[HI('Babà')],NONE]})
c(Z,'🚫 babà',AV('Babà'),{alt:[[HI('Babà')],NONE]})
c(Z,'tagliata 🔝',FE('Tagliata'),{alt:[NONE]})
c(Z,'⭐ tagliata',FE('Tagliata'),{alt:[NONE]})
c(Z,'😂😂😂',NONE)
c(Z,'🙏',NONE)
c(Z,['la carbonara a 13','👍'],P('Carbonara',13))
c(Z,['la carbonara a 13','😡'],P('Carbonara',13),{alt:[NONE]})
c(Z,'[immagine]',NONE)
c(Z,'<media omessi>',NONE)
c(Z,'​',NONE)
c(Z,'\n\n\n',NONE)

// ---- 9. richieste contraddittorie ----
fam='contraddizioni'
c(Z,'la carbonara a 13 e la carbonara a 14',NONE,{ask:[1],alt:[[P('Carbonara',14)]]})
c(Z,'nascondi il babà e mettilo in evidenza',NONE,{ask:[1],alt:[[FE('Babà')],[HI('Babà')]]})
c(Z,'il babà è finito ma lascialo disponibile',NONE,{note:'attesa Z corretta: scrivere «finito» è accettato (alt), chiedere anche',alt:[[AV('Babà')]]})
c(Z,'alza la tagliata e abbassala di 2',NONE,{ask:[1],alt:[[P('Tagliata',16)]]})
c(Z,'aumenta la tagliata a 15',NONE,{ask:[1],alt:[[P('Tagliata',15)]],note:'«aumenta» a un prezzo più basso: domanda'})
c(Z,'abbassa la carbonara a 14',NONE,{ask:[1],alt:[[P('Carbonara',14)]]})
c(Z,'elimina e nascondi il babà',NONE,{ask:[1],alt:[[HI('Babà')]]})
c(Z,'aggiungi la carbonara a 13',P('Carbonara',13),{ask:[1],alt:[NONE],note:'nota 62: già esiste → domanda'})
c(Z,['la carbonara a 13','no a 12'],NONE,{interim:[P('Carbonara',13)]})
c(Z,['la carbonara a 13','non ho detto questo'],NONE,{interim:[P('Carbonara',13)],alt:[[P('Carbonara',13)]]})
c(Z,['nascondi il babà','mostralo'],NONE,{interim:[HI('Babà')]})
c(Z,['metti in evidenza la tagliata','toglila dall\'evidenza'],NONE,{interim:[FE('Tagliata')]})
c(Z,'la carbonara a 13, anzi no, a 14, anzi lascia 13',P('Carbonara',13))
c(Z,'la carbonara a 13 anzi no lascia stare',NONE)
c(Z,'tutto a 10 tranne niente',NONE,{ask:[1]})

// ---- 10. «annulla» in ogni posizione ----
fam='annulla'
c(Z,'annulla',NONE)
c(Z,'annulla tutto',NONE)
c(Z,'annulla la carbonara a 13',NONE,{ask:[1],alt:[[P('Carbonara',13)]],note:'mai pubblicare il 13 dopo «annulla»? alt per misurare'})
c(Z,'la carbonara a 13 annulla',NONE)
c(Z,'la carbonara a 13, annulla, la tagliata a 19',P('Tagliata',19))
c(Z,['la carbonara a 13','la tagliata a 19','annulla'],P('Carbonara',13),{interim:[P('Tagliata',19)]})
c(Z,['la carbonara a 13','annulla','annulla'],NONE,{interim:[P('Carbonara',13)],alt:[[P('Carbonara',13)]]})
c(Z,['la carbonara a 13','annulla','la carbonara a 14'],P('Carbonara',14))
c(Z,['la carbonara a 13','annullare'],NONE,{interim:[P('Carbonara',13)]})
c(Z,['la carbonara a 13','ANNULLA'],NONE,{interim:[P('Carbonara',13)]})
c(Z,['la carbonara a 13','annula'],NONE,{interim:[P('Carbonara',13)],alt:[[P('Carbonara',13)]]})
c(Z,['la carbonara a 13','annulla per piacere'],NONE,{interim:[P('Carbonara',13)]})
c(Z,['la carbonara a 13','undo'],NONE,{interim:[P('Carbonara',13)],alt:[[P('Carbonara',13)]]})
c(Z,['la carbonara a 13','ctrl z'],NONE,{interim:[P('Carbonara',13)],alt:[[P('Carbonara',13)]]})
// R6.1 riclassificato (REPORT-R6): il bot chiede senza scrivere; vincolo del server (undo solo da solo e con la parola che lo chiede; rinomina/spostamento solo col piatto nominato), da misurare con gpt-oss.
c(Z,['nascondi il babà','annulla e mettilo finito'],AV('Babà'),{interim:[HI('Babà')],alt:[[HI('Babà')]]})
c(Z,['la carbonara a 13','annulla, intendevo la tagliata a 13'],P('Tagliata',13),{interim:[P('Carbonara',13)]})
c(Z,['aggiungi nei dolci la cassata a 6','annulla'],NONE,{interim:[CR('cassata',6,'Dolci')]})
c(Z,['elimina il babà','annulla','sì'],NONE,{ask:[1],note:'sì dopo annulla: nessuna eliminazione'})
c(Z,['elimina il babà','sì, annulla'],NONE,{ask:[1],alt:[[DEL('Babà')]],note:'contraddizione: misura'})
c(Z,['rinomina il babà in babà al rum','annulla'],NONE,{interim:[REN('Babà','Babà al rum')]})

// ---- 11. piatti nascosti / finiti / inesistenti ----
fam='nascosti'
const HB={mods:{hidden:['Babà']}},UB={mods:{unavail:['Babà']}}
c(Z,'il babà a 6',P('Babà',6),HB)
c(Z,'rimetti il babà',HI('Babà',false),HB)
c(Z,'mostra di nuovo il babà',HI('Babà',false),HB)
c(Z,'il babà è tornato',AV('Babà',true),UB)
c(Z,'il babà è tornato',HI('Babà',false),{...HB,alt:[NONE]})
c(Z,'il babà è finito',NONE,{...UB,note:'già finito: niente «fatto» falso'})
c(Z,'nascondi il babà',NONE,HB)
c(Z,[Q('quali piatti sono nascosti?')],NONE,{mods:{hidden:['Babà','Burrata']}})
c(Z,[Q('cosa è finito?')],NONE,UB)
c(Z,[Q('quali sono nascosti?'),'rimettili tutti'],[HI('Babà',false),HI('Burrata',false)],{mods:{hidden:['Babà','Burrata']}})
c(Z,'rimetti tutto disponibile',[AV('Babà',true),AV('Burrata',true)],{mods:{unavail:['Babà','Burrata']},alt:[NONE]})
c(Z,'la cassata a 6',NONE,{ask:[1],alt:[[CR('cassata',6,'Dolci')]]})
c(Z,'la cassata è finita',NONE,{note:'piatto inesistente: niente creazione'})
c(Z,'nascondi la cassata',NONE)
c(Z,'elimina la cassata',NONE)
c(Z,['elimina la cassata','sì'],NONE)
c(Z,'il caviale a 80',NONE,{ask:[1],alt:[[CR('caviale',80)]]})
c(Z,'il babà finito e rimetti la burrata',[AV('Babà'),HI('Burrata',false)],{mods:{hidden:['Burrata']}})
c(Z,'la burrata a 10',P('Burrata',10),{mods:{unavail:['Burrata']}})
c(Z,'metti in evidenza il babà',FE('Babà'),HB)

// ---- 12. prezzi assurdi ----
fam='assurdi'
c(Z,'la carbonara a 1300',NONE,{ask:[1],alt:[[P('Carbonara',1300)]]})
c(Z,'la carbonara a 0',NONE,{ask:[1],alt:[[P('Carbonara',0)]]})
c(Z,'la carbonara gratis',NONE,{ask:[1],alt:[[P('Carbonara',0)]]})
c(Z,'la carbonara a -5',NONE,{ask:[1]})
c(Z,'la carbonara a 0,01',NONE,{ask:[1],alt:[[P('Carbonara',0.01)]]})
c(Z,'la carbonara a 12,345',NONE,{ask:[1],alt:[[P('Carbonara',12.35)],[P('Carbonara',12.34)]]})
c(Z,'la carbonara a 1.200',NONE,{ask:[1],alt:[[P('Carbonara',1200)]]})
c(Z,'la carbonara a 13.000',NONE,{ask:[1]})
c(Z,'la carbonara a un milione',NONE,{ask:[1]})
c(Z,'la carbonara a 12 dollari',NONE,{ask:[1],alt:[[P('Carbonara',12)]]})
c(Z,'la carbonara a 1e3',NONE,{ask:[1]})
c(Z,'la carbonara a 13 13',P('Carbonara',13),{alt:[NONE]})
c(Z,'la carbonara a 120',NONE,{ask:[1],alt:[[P('Carbonara',120)]],note:'10× il prezzo: dovrebbe chiedere'})
c(Z,'aumenta la carbonara del 10%',P('Carbonara',13.2),{alt:[NONE]})
c(Z,'raddoppia il prezzo del babà',P('Babà',10),{alt:[NONE]})

// ---- 13. apostrofi e virgolette nei nomi ----
fam='apostrofi'
c(Z,"la pizza 'nduja a 10",P("Pizza 'nduja",10))
c(Z,'la pizza ’nduja a 10',P("Pizza 'nduja",10))
c(Z,'la pizza nduja a 10',P("Pizza 'nduja",10))
c(Z,"la frittatina 'e pasta a 3,50",P("Frittatina 'e pasta",3.5))
c(Z,'la frittatina e pasta a 3,50',P("Frittatina 'e pasta",3.5),{note:'senza apostrofo: «e» non divide'})
c(Z,"il tagliere dell'oste a 16",P("Tagliere dell'oste",16))
c(Z,'il tagliere dell’oste a 16',P("Tagliere dell'oste",16))
c(Z,'il tagliere dell oste a 16',P("Tagliere dell'oste",16))
c(Z,"lo spaghetto all'astice finito",AV("Spaghetti all'astice"))
c(Z,'nascondi "pizza all\'ortolana"',HI("Pizza all'ortolana"))
c(Z,'«Pizza all’ortolana» a 9',P("Pizza all'ortolana",9))
c(Z,"aggiungi nei primi \"pasta e fagioli\" a 10",CR('pasta e fagioli',10,'Primi'))
c(Z,"aggiungi nelle pizze la pizza 'a scarola a 9",CR("pizza 'a scarola",9,'Pizze'),{alt:[[CR('pizza a scarola',9,'Pizze')]]})
c(Z,"aggiungi nei primi gli spaghetti all'aglio a 9",CR("spaghetti all'aglio",9,'Primi'))
c(Z,"rinomina la pizza 'nduja in Pizza calabrese",REN("Pizza 'nduja",'Pizza calabrese'))
c(Z,'rinomina il babà in "Babà al rum"',REN('Babà','Babà al rum'))
c(Z,"rinomina il tagliere dell'oste in 'Tagliere misto'",REN("Tagliere dell'oste",'Tagliere misto'))
c(Z,"il polpo all'insalata e la pizza all'ortolana a 15 e 9",[P("Polpo all'insalata",15),P("Pizza all'ortolana",9)])
c(Z,"l'astice a 26",P("Spaghetti all'astice",26))
c(Z,"po' di più sulla carbonara, mettila a 13",P('Carbonara',13))

// ---- 14. ripetizioni ----
fam='ripeti'
c(Z,['la carbonara a 13','la carbonara a 13'],P('Carbonara',13))
c(Z,['la carbonara a 13','la carbonara a 13','la carbonara a 13'],P('Carbonara',13))
c(Z,['aggiungi nei dolci la cassata a 6','aggiungi nei dolci la cassata a 6'],CR('cassata',6,'Dolci'),{note:'mai due cassate'})
c(Z,['aumenta la carbonara di 1','aumenta la carbonara di 1'],P('Carbonara',14),{alt:[[P('Carbonara',13)]]})
c(Z,['nascondi il babà','nascondi il babà'],HI('Babà'))
c(Z,['rinomina il babà in babà al rum','rinomina il babà in babà al rum'],REN('Babà','Babà al rum'))
c(Z,['crea la categoria contorni','crea la categoria contorni'],SEC('Contorni'))
c(Z,['sposta la burrata nei secondi','sposta la burrata nei secondi'],MV('Burrata','Secondi'))
c(Z,'la carbonara a 13 la carbonara a 13',P('Carbonara',13))
c(Z,['elimina il babà','sì','elimina il babà','sì'],DEL('Babà'),{ask:[1]})

// ---- 15. interruzioni a metà conferma ----
fam='interruzioni'
c(Z,['elimina il babà','la carbonara a 13'],P('Carbonara',13),{ask:[1],note:'il babà resta (niente sì)'})
c(Z,['elimina il babà','la carbonara a 13','sì'],P('Carbonara',13),{ask:[1],alt:[[P('Carbonara',13),DEL('Babà')]],note:'il sì dopo un\'altra modifica: pericoloso se elimina'})
c(Z,['elimina il babà',Q('quanto costa il babà?'),'sì'],DEL('Babà'),{ask:[1],alt:[NONE]})
c(Z,['elimina il babà','aspetta','sì'],DEL('Babà'),{ask:[1],alt:[NONE]})
c(Z,['elimina il babà','un attimo che chiedo al cuoco',W(5),'sì'],DEL('Babà'),{ask:[1],alt:[NONE]})
c(Z,['elimina il babà','un attimo che chiedo al cuoco',W(5),'no tienilo'],NONE,{ask:[1]})
c(Z,['elimina il babà','sì il tiramisù'],NONE,{ask:[1],alt:[[DEL('Tiramisù')]],note:'sì + altro piatto: mai eliminare il babà'})
c(Z,['elimina il babà','sì e anche il tiramisù'],DEL('Babà'),{ask:[1,2],alt:[[DEL('Babà'),DEL('Tiramisù')]],askNoWrite:false})
c(Z,['elimina il babà','e il tiramisù?'],NONE,{ask:[1]})
c(Z,['elimina il babà e il tiramisù','solo il babà'],NONE,{ask:[1,2],alt:[[DEL('Babà')]]})
c(Z,['elimina il babà e il tiramisù','solo il babà','sì'],DEL('Babà'),{ask:[1]})
c(Z,['elimina il babà e il tiramisù','sì solo il babà'],DEL('Babà'),{ask:[1],alt:[NONE]})
c(Z,['elimina il babà','nascondi il tiramisù','sì'],HI('Tiramisù'),{ask:[1],alt:[[HI('Tiramisù'),DEL('Babà')]]})
c(Z,[R4,'nascondi il tiramisù'],HI('Tiramisù'),{alt:[NONE],note:'richiesta nuova con riepilogo in attesa: mai pubblicare il riepilogo'})
c(Z,[R4,'nascondi il tiramisù','ok'],[...R4C,HI('Tiramisù')],{alt:[R4C,[HI('Tiramisù')]]})
c(Z,['aggiungi nei dolci la cassata','la carbonara a 13'],P('Carbonara',13),{ask:[1],alt:[[P('Carbonara',13),CR('cassata',13,'Dolci')]],note:'il 13 è della carbonara: se crea la cassata a 13 è GRAVE (alt per misurare)'})
c(Z,['aggiungi nei dolci la cassata','6'],CR('cassata',6,'Dolci'),{ask:[1]})
c(Z,['aggiungi nei dolci la cassata','sei euro'],CR('cassata',6,'Dolci'),{ask:[1]})
c(Z,['aggiungi nei dolci la cassata','lascia stare'],NONE,{ask:[1]})
c(Z,['aggiungi nei dolci la cassata',Q('quanto costa il tiramisù?'),'6'],CR('cassata',6,'Dolci'),{ask:[1],alt:[NONE]})

// ---- 16. domande travestite da ordini e viceversa ----
fam='travestite'
c(Z,'la carbonara a 13?',NONE,{alt:[[P('Carbonara',13)]],note:'tono interrogativo: nota quale dei due'})
c(Z,Q('la carbonara è a 13?'),NONE)
c(Z,Q('la carbonara sta a 12 giusto?'),NONE)
c(Z,Q('che dici, la carbonara a 13 va bene?'),NONE)
c(Z,Q('se metto la carbonara a 13 la gente se ne va?'),NONE)
c(Z,Q('mi ricordi il prezzo della tagliata'),NONE)
c(Z,Q('dimmi i prezzi dei primi'),NONE)
c(Z,Q('fammi vedere i dolci'),NONE)
c(Z,Q('mandami il menu'),NONE)
c(Z,Q('elencami cosa è nascosto'),NONE)
c(Z,Q('controlla se il babà è disponibile'),NONE)
c(Z,Q('verifica il prezzo della birra'),NONE)
c(Z,'puoi mettere la carbonara a 13?',P('Carbonara',13))
c(Z,'mi metti la carbonara a 13?',P('Carbonara',13))
c(Z,'riesci a nascondere il babà?',HI('Babà'))
c(Z,'si può togliere il babà?',HI('Babà'),{alt:[NONE]})
c(Z,'potresti eliminare il babà?',DEL('Babà'),{ask:[1],alt:[NONE]})
c(Z,'perché la carbonara è a 12? mettila a 13',P('Carbonara',13))
c(Z,'la carbonara a 13 o 14 secondo te?',NONE,{ask:[1]})
c(Z,Q('quanto costa la carbonara a 13 per due?'),NONE)
c(Z,Q('quante pizze ci sono a 8?'),NONE)
c(Z,Q('chi ha messo la carbonara a 12?'),NONE)
c(Z,Q('è finito il babà?'),NONE)
c(Z,Q('il babà è nascosto?'),NONE)
c(Z,Q('hai tolto il babà?'),NONE)

// ---- 17. promo, evidenza, piatto del giorno ----
fam='promo'
c(Z,'la burrata in promo a 7',PR('Burrata',7))
c(Z,'la burrata in offerta a 7',PR('Burrata',7))
c(Z,'sconto sulla burrata: 7 invece di 9',PR('Burrata',7),{alt:[[P('Burrata',7)]]})
c(Z,'togli la promo dalla burrata',PR('Burrata',null),{mods:{promo:{Burrata:7}}})
c(Z,'togli lo sconto alla burrata',PR('Burrata',null),{mods:{promo:{Burrata:7}},note:'«togli» qui non è nascondi'})
c(Z,'la burrata in promo',NONE,{ask:[1]})
c(Z,'la burrata in promo a 10',NONE,{ask:[1],alt:[[PR('Burrata',10)]],note:'promo più cara del prezzo'})
c(Z,'la burrata in promo a 7 e la tagliata in evidenza',[PR('Burrata',7),FE('Tagliata')])
c(Z,'metti in evidenza la tagliata',FE('Tagliata'))
c(Z,'la tagliata non più in evidenza',FE('Tagliata',false),{mods:{featured:['Tagliata']}})
c(Z,'togli la tagliata dall\'evidenza',FE('Tagliata',false),{mods:{featured:['Tagliata']}})
c(Z,'la tagliata è il piatto del giorno',FE('Tagliata'),{alt:[NONE]})
c(Z,'consiglia la tagliata',FE('Tagliata'),{alt:[NONE]})
c(Z,'in evidenza la tagliata e il babà, il resto no',[FE('Tagliata'),FE('Babà'),FE('Carbonara',false)],{mods:{featured:['Carbonara']},alt:[[FE('Tagliata'),FE('Babà')]]})
c(Z,'metti tutti i dolci in evidenza',[FE('Tiramisù'),FE('Babà'),FE('Delizia al limone')])
c(Z,'la burrata a 7 in promo fino a stasera',PR('Burrata',7),{alt:[NONE]})
c(Z,'promo 2x1 sulla birra',NONE,{ask:[1]})
c(Z,'la birra happy hour a 3',PR('Birra',3),{alt:[NONE]})
c(Z,['la burrata in promo a 7','annulla'],NONE,{interim:[PR('Burrata',7)]})
c(Z,['la burrata in promo a 7','anzi a 6'],PR('Burrata',6),{interim:[PR('Burrata',7)]})

// ---- 18. spostamenti tra categorie ----
fam='sposta'
c(Z,'sposta la burrata nei primi',MV('Burrata','Primi'))
c(Z,'la burrata mettila nei secondi',MV('Burrata','Secondi'))
c(Z,'la burrata va nei secondi',MV('Burrata','Secondi'),{alt:[NONE]})
c(Z,'sposta la burrata e il tagliere nei secondi',[MV('Burrata','Secondi'),MV("Tagliere dell'oste",'Secondi')])
c(Z,'sposta la burrata nei secondi e il babà negli antipasti',[MV('Burrata','Secondi'),MV('Babà','Antipasti')])
c(Z,'sposta la burrata dove sta la tagliata',MV('Burrata','Secondi'),{alt:[NONE]})
c(Z,'sposta la burrata nei contorni',NONE,{ask:[1]})
c(Z,['sposta la burrata nei contorni','sì'],[SEC('Contorni'),MV('Burrata','Contorni')],{ask:[1]})
c(Z,['sposta la burrata nei contorni','no'],NONE,{ask:[1]})
c(Z,'sposta la burrata negli antipasti',NONE,{note:'è già negli antipasti'})
c(Z,'sposta il baccalà fritto nei calzoni',MV('Baccalà fritto','Calzoni'))
c(Z,'sposta il calzone fritto nei fritti',NONE,{ask:[1],note:'non esiste «Fritti»: domanda, mai il Baccalà fritto'})
c(Z,['sposta la burrata nei secondi','e anche il tagliere'],[MV('Burrata','Secondi'),MV("Tagliere dell'oste",'Secondi')])
// R6.1 riclassificato (REPORT-R6): «dov'era» non è tra le parole che aprono l'annullamento (vincolo del server): il bot chiede senza scrivere.
c(Z,['sposta la burrata nei secondi','rimettila dov\'era'],NONE,{interim:[MV('Burrata','Secondi')],alt:[[MV('Burrata','Secondi')]]})
c(Z,'sposta la burrata in cima ai secondi',MV('Burrata','Secondi'),{alt:[NONE]})

// ---- 19. rinomine a catena ----
fam='rinomine'
c(Z,['rinomina il babà in babà al rum','rinomina il babà al rum in babà napoletano'],REN('Babà','Babà napoletano'))
c(Z,['rinomina il babà in babà al rum','e mettilo a 6'],[REN('Babà','Babà al rum'),P('Babà',6)])
c(Z,['rinomina il babà in babà al rum','il babà al rum a 6'],[REN('Babà','Babà al rum'),P('Babà',6)])
c(Z,['rinomina il babà in babà al rum','il babà a 6'],[REN('Babà','Babà al rum'),P('Babà',6)],{alt:[[REN('Babà','Babà al rum')]]})
c(Z,['rinomina il babà in tiramisù'],NONE,{ask:[1],note:'nome già usato: domanda (nota 64)'})
// R6.1 riclassificato (REPORT-R6): il bot chiede senza scrivere; vincolo del server (undo solo da solo e con la parola che lo chiede; rinomina/spostamento solo col piatto nominato), da misurare con gpt-oss.
c(Z,['rinomina il babà in babà al rum','anzi babà e basta'],NONE,{interim:[REN('Babà','Babà al rum')],alt:[[REN('Babà','Babà e basta')],[REN('Babà','Babà al rum')]]})
c(Z,['rinomina il babà in babà al rum','annulla','rinomina il babà in babà classico'],REN('Babà','Babà classico'))
c(Z,'rinomina il babà in babà al rum e il tiramisù in tiramisù della casa',[REN('Babà','Babà al rum'),REN('Tiramisù','Tiramisù della casa')])
c(Z,'rinomina il babà in babà al rum, e nascondilo',[REN('Babà','Babà al rum'),HI('Babà')])
c(Z,['rinomina la categoria dolci in dessert','rinomina la categoria dessert in dolci della casa'],['Tiramisù','Babà','Delizia al limone'].map(d=>MV(d,'Dolci della casa')))
c(Z,['rinomina la categoria dolci in dessert','aggiungi nei dessert la cassata a 6'],[...['Tiramisù','Babà','Delizia al limone'].map(d=>MV(d,'Dessert')),CR('cassata',6,'Dessert')])
c(Z,'rinomina il babà in babà a 6 euro',NONE,{ask:[1],alt:[[REN('Babà','babà'),P('Babà',6)],[P('Babà',6)]],note:'mai nome «babà a 6 euro»'})
c(Z,'chiama la burrata burrata pugliese',REN('Burrata','burrata pugliese'),{alt:[[REN('Burrata','Burrata pugliese')]]})
c(Z,'la burrata da ora si chiama burrata di andria',REN('Burrata','burrata di andria'),{alt:[[REN('Burrata','Burrata di andria')],[REN('Burrata','Burrata di Andria')]]})
c(Z,['rinomina il babà in babà al rum','sì'],REN('Babà','Babà al rum'))

// ---- 20. più locali / più menu ----
fam='locali'
c(Z,'nel menu bevande la birra a 6',P('Birra',6))
c(Z,'a pranzo la carbonara a 13',P('Carbonara',13),{alt:[NONE]})
c(Z,"nell'altro locale la carbonara a 13",NONE,{ask:[1],note:'un solo locale collegato: domanda, nessuna scrittura'})
c(Z,'al ristorante di mio fratello la carbonara costa 15, mettila uguale',P('Carbonara',15),{alt:[NONE]})
c(Z,'per la sede di Napoli il babà è finito',NONE,{note:'attesa Z corretta: un solo locale, scrivere è accettato',alt:[[AV('Babà')]]})
c(Z,'solo a cena la carbonara a 14',NONE,{ask:[1],alt:[[P('Carbonara',14)]]})
c(Z,'aggiungi nelle bibite la fanta a 3',CR('fanta',3,'Bibite'))
c(Z,'aggiungi nei vini il fiano a 22',CR('fiano',22,'Vini'))
c(Z,'aggiungi il fiano a 22',CR('fiano',22,'Vini'),{alt:[NONE]})
c(Z,'aggiungi la fanta a 3',CR('fanta',3,'Bibite'),{alt:[NONE]})

// ======================= SECONDO GIRO: varianti vicine alle famiglie trovate nel primo =======================
// ---- r2. percentuali e moltiplicatori ----
fam='r2-percento'
c(Z,'aumenta la tagliata del 10 per cento',P('Tagliata',19.8),{alt:[NONE]})
c(Z,'sconto del 20% sulla burrata',PR('Burrata',7.2),{alt:[NONE],note:'mai la burrata a 20'})
c(Z,'la birra +10%',P('Birra',5.5),{alt:[NONE]})
c(Z,'abbassa il greco di tufo del 20%',P('Greco di Tufo',20),{alt:[NONE]})
c(Z,'tutti i dolci più 10%',[P('Tiramisù',6.6),P('Babà',5.5),P('Delizia al limone',6.05)],{alt:[NONE]})
c(Z,'la carbonara al 50%',NONE,{ask:[1],alt:[[PR('Carbonara',6)],[P('Carbonara',6)]]})
c(Z,'dimezza il prezzo del babà',P('Babà',2.5),{alt:[NONE]})
c(Z,'la tagliata il doppio',NONE,{ask:[1],alt:[[P('Tagliata',36)]]})
// ---- r2. numeri spezzati dalla trascrizione ----
fam='r2-spezzati'
c(Z,V('la tagliata a dicia nove'),P('Tagliata',19),{alt:[NONE]})
c(Z,V('la tagliata a venti due'),P('Tagliata',22),{alt:[NONE]})
c(Z,V('la birra a sei e cinque'),NONE,{ask:[1],alt:[[P('Birra',6.5)],[P('Birra',6.05)]]})
c(Z,V('il greco a trenta cinque'),P('Greco di Tufo',35),{alt:[NONE]})
c(Z,V('la burrata a quattro dici'),P('Burrata',14),{alt:[NONE]})
c(Z,V('la carbonara a tre e dici'),NONE,{ask:[1],alt:[[P('Carbonara',13)]]})
// ---- r2. verbi opposti nella stessa frase ----
fam='r2-opposti'
c(Z,'aumenta e abbassa la carbonara di 1',NONE,{ask:[1]})
c(Z,'sali la tagliata poi scendila di 3',NONE,{ask:[1],alt:[[P('Tagliata',15)]]})
c(Z,'alza la birra, anzi abbassala di 1',P('Birra',4))
c(Z,'mostra e nascondi il babà',NONE,{ask:[1]})
c(Z,'metti e togli la tagliata dall\'evidenza',NONE,{ask:[1],alt:[[FE('Tagliata',false)]]})
// ---- r2. ritiri dentro lo stesso messaggio ----
fam='r2-ritiri'
c(Z,'la carbonara a 13, no lascia, la tagliata a 19',P('Tagliata',19))
c(Z,'la carbonara a 13 (no, lasciala) e la tagliata a 19',P('Tagliata',19))
c(Z,'la carbonara a 13, cancella questa, la tagliata a 19',P('Tagliata',19),{alt:[NONE]})
c(Z,'la birra a 6 e il babà... no il babà niente',P('Birra',6))
c(Z,'la tagliata a 19 e la carbonara a 13, la carbonara no',P('Tagliata',19))
// ---- r2. numeri che non sono prezzi (parti «perse» false) ----
fam='r2-nonprezzi'
c(Z,'la quattro stagioni a 9 e la margherita a 8',[P('Quattro stagioni',9),P('Margherita',8)])
c(Z,'4 stagioni 9 euro',P('Quattro stagioni',9),{alt:[NONE]})
c(Z,'siamo in 3 stasera, il babà è finito',AV('Babà'))
c(Z,'dalle 20 il babà è finito',AV('Babà'),{alt:[NONE]})
c(Z,'il tavolo 7 ha preso l\'ultima burrata, segnala finita',AV('Burrata'))
c(Z,'alle 13 la burrata era finita, ora mettila finita',AV('Burrata'))
c(Z,'aggiungi nelle pizze la pizza 5 formaggi a 9',CR('pizza 5 formaggi',9,'Pizze'))
// ---- r2. «disfa» con parole diverse ----
fam='r2-disfa'
c(Z,['nascondi il babà','rimostralo'],NONE,{interim:[HI('Babà')]})
c(Z,['nascondi il babà','fallo vedere di nuovo'],NONE,{interim:[HI('Babà')]})
c(Z,['metti in evidenza il babà','levalo dall\'evidenza'],NONE,{interim:[FE('Babà')]})
c(Z,['la carbonara a 13','annulla grazie'],NONE,{interim:[P('Carbonara',13)]})
c(Z,['la carbonara a 13','annulla subito'],NONE,{interim:[P('Carbonara',13)]})
c(Z,['la carbonara a 13','annulla quello'],NONE,{interim:[P('Carbonara',13)]})
// R6.1 riclassificato (REPORT-R6): il bot chiede senza scrivere; vincolo del server (undo solo da solo e con la parola che lo chiede; rinomina/spostamento solo col piatto nominato), da misurare con gpt-oss.
c(Z,['sposta la burrata nei secondi','rimettila negli antipasti'],NONE,{interim:[MV('Burrata','Secondi')],alt:[[MV('Burrata','Secondi')]]})
// R6.1 riclassificato (REPORT-R6): il bot chiede senza scrivere; vincolo del server (undo solo da solo e con la parola che lo chiede; rinomina/spostamento solo col piatto nominato), da misurare con gpt-oss.
c(Z,['rinomina il babà in babà al rum','rimetti il nome di prima'],NONE,{interim:[REN('Babà','Babà al rum')],alt:[[REN('Babà','Babà al rum')]]})
