// Verifica V (17/10/2026): casi nati dalle prove vocali vere di Manuel sul QA (sessioni 13:16 e 17:26, cervello v112) e dai
// problemi derivati o simili che possono uscire nei suoi test. Stesso formato del banco E (tests/eval/conversations.ts), ma in
// un set separato: il banco principale resta com'è. Runner: tests/eval/eval-manuel-1017.test.ts.
// Regole del titolare già decise: «togli» = nascondi sempre; ≥2 parti incerte → una domanda per ciascuna; «no» pubblica le parti
// chiare; «annulla» solo l'ultima pubblicazione; mai «fatto» senza riga scritta; niente frasi fisse.
// Scelte di questa verifica (da confermare con Manuel, scritte in `note`): «rimuovi completamente / elimina / cancella» = ELIMINARE
// (oggi il bot nasconde: capacità mancante); creare/rinominare categorie e spostare piatti dalla chat = capacità attese.
import type {Change,Conversation,Family,Mods,Pick,Turn} from '../types.js'

type In=string|Turn
const T=(s:string):Turn=>({text:s}),Q=(s:string):Turn=>({text:s,q:true}),V=(s:string):Turn=>({voice:s}),W=(m:number):Turn=>({wait:m})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),AV=(dish:string,value=false):Change=>({op:'available',dish,value}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const FE=(dish:string,value=true):Change=>({op:'featured',dish,value}),PR=(dish:string,price:number|null):Change=>({op:'promo',dish,price})
const CR=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const DEL=(dish:string):Change=>({op:'delete',dish}),REN=(dish:string,name:string):Change=>({op:'rename',dish,name}),MV=(dish:string,section:string):Change=>({op:'move',dish,section})
const NONE:Change[]=[]
type Extra={ask?:number[],askNoWrite?:boolean,alt?:Change[][],reply?:RegExp,mods?:Mods,source?:string,note?:string,pick?:Pick,interim?:Change[]}

export const V_CASES:Conversation[]=[]
let fam:Family='v-deixis'
const c=(menu:string,turns:In|In[],changes:Change|Change[],x:Extra={})=>{const id=`${fam}-${String(V_CASES.filter(k=>k.family===fam).length+1).padStart(3,'0')}`
 V_CASES.push({id,family:fam,menu,turns:(Array.isArray(turns)?turns:[turns]).map(t=>typeof t==='string'?T(t):t),changes:Array.isArray(changes)?changes:[changes],...x})}
const PP='Piatti di prova'
// Le tre frasi vere di Manuel delle 17:27–17:30 (trascrizioni Whisper).
const M1=V('Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.'),M2=V('Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.')
const M3=V('E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.')

// ===================== v-deixis: «quei due», «quelli», «l'ultimo», «il primo», «entrambi», «tutti tranne» =====================
fam='v-deixis'
c('qa',[M1,M2,V('Ok, adesso nascondi quei due piatti.')],[HI('boh'),P('la parmigiana',15),P('tiramisù',15),HI('la parmigiana'),HI('tiramisù')],{source:'Manuel 17:27–17:30, con «nascondi» al posto di «rimuovi completamente»'})
c('qa',['la parmigiana a 15 e il tiramisù a 15','nascondi quei due piatti'],[P('la parmigiana',15),P('tiramisù',15),HI('la parmigiana'),HI('tiramisù')])
c('qa',['la parmigiana costa 12','il tiramisù costa 7','nascondi entrambi'],[P('la parmigiana',12),P('tiramisù',7),HI('la parmigiana'),HI('tiramisù')])
c('qa',['la parmigiana costa 12','il tiramisù costa 7',"nascondi l'ultimo"],[P('la parmigiana',12),P('tiramisù',7),HI('tiramisù')])
c('qa',['la parmigiana costa 12','il tiramisù costa 7','il primo mettilo a 11'],[P('la parmigiana',11),P('tiramisù',7)],{interim:[P('la parmigiana',12)]})
c('qa',['la parmigiana costa 12','il tiramisù costa 7','quelli mettili in evidenza'],[P('la parmigiana',12),P('tiramisù',7),FE('la parmigiana'),FE('tiramisù')])
c('qa',['metti in evidenza la parmigiana, il tiramisù e boh',"togli l'evidenza a tutti tranne boh"],[FE('boh')],{interim:[FE('la parmigiana'),FE('tiramisù')]})
c('qa',[Q('quanto costano la parmigiana e il tiramisù?'),'mettili tutti e due a 9'],[P('la parmigiana',9),P('tiramisù',9)])
c('qa',['la parmigiana a 15','e mettila anche in evidenza'],[P('la parmigiana',15),FE('la parmigiana')])
c('qa',['nascondi la parmigiana','rimettila'],NONE,{interim:[HI('la parmigiana')]})
c('mario',['la carbonara costa 13','la lasagna costa 12','quei due mettili in evidenza'],[P('Spaghetti alla carbonara',13),P('Lasagna al forno',12),FE('Spaghetti alla carbonara'),FE('Lasagna al forno')])
c('qa',['la parmigiana costa 12','il tiramisù costa 7','boh costa 25','nascondi tutti e tre'],[P('la parmigiana',12),P('tiramisù',7),P('boh',25),HI('la parmigiana'),HI('tiramisù'),HI('boh')])
c('qa',[M1,'nascondi quei due piatti'],[HI('boh'),HI('la parmigiana'),HI('tiramisù')],{note:'«quei due» = parmigiana e tiramisù del messaggio prima (boh è già nascosto)'})

// ===================== v-elimina: eliminare vs nascondere =====================
fam='v-elimina'
c('qa',[M1,M2,V('Ok, adesso rimuovi completamente quei due piatti.')],[HI('boh'),DEL('la parmigiana'),DEL('tiramisù')],{source:'Manuel 17:30 (risposta vera: «Quale piatto intendi: parmigiana, tiramisù? Riscrivimi…»)',note:'«rimuovi completamente» = eliminare (capacità mancante)'})
c('qa','elimina il piatto pasta al ragù',DEL('pasta al ragù'),{source:'Manuel 13:18 («Da questa chat non posso eliminare»)'})
c('qa','cancella boh',DEL('boh'))
c('qa','boh levalo proprio dal menu',DEL('boh'),{alt:[[HI('boh')]],note:'«leva» ≈ togli (= nascondi); «proprio» spinge verso eliminare: accettati entrambi'})
c('qa','togli boh',HI('boh'),{note:'controllo: «togli» = nascondi (regola Manuel)'})
c('qa','elimina definitivamente il tiramisù dal menu',DEL('tiramisù'))
c('qa',['nascondi boh','anzi no, eliminalo proprio'],DEL('boh'))
c('qa','rimuovi la parmigiana',DEL('la parmigiana'),{alt:[[HI('la parmigiana')]],note:'«rimuovi» da solo: decisione 17/10 = nasconde con nota; accettati entrambi'})
c('qa','cancella pasta al ragù e boh',[DEL('pasta al ragù'),DEL('boh')])
c('qa',['la parmigiana a 15 e il tiramisù a 15','eliminali tutti e due'],[P('la parmigiana',15),P('tiramisù',15),DEL('la parmigiana'),DEL('tiramisù')])

// ===================== v-aggiunte: aggiunte multiple con/senza prezzi/categoria =====================
fam='v-aggiunte'
c('qa',M3,NONE,{ask:[1],source:'Manuel 17:30 (risposta vera: «manca la categoria … Rimandami la richiesta completa»)',note:'decisione 18/10 (nota 62): pasta al ragù c\'è già → domanda breve «c\'è già pasta al ragù a 12 €: lo aggiorno o ne creo un altro?», nessuna scrittura sul ragù; con una parte incerta le parti chiare aspettano la risposta (regola del titolare)',alt:[[CR('pasta al pesto',15,PP),CR('caviale',150,PP)]]})
c('qa','aggiungi pasta al pesto a 15 e caviale a 150',[CR('pasta al pesto',15,PP),CR('caviale',150,PP)])
c('qa',V('Aggiungi il piatto pasta al sugo a 12 euro.'),CR('pasta al sugo',12,PP),{source:'Manuel 17:36 (ok dal vivo)'})
c('qa','aggiungi pasta al pesto a 15, lasagna a 20 e polpette a 9',[CR('pasta al pesto',15,PP),CR('lasagna',20,PP),CR('polpette',9,PP)])
c('qa',['aggiungi pasta al pesto e lasagna','pasta al pesto 10 e lasagna 20'],[CR('pasta al pesto',10,PP),CR('lasagna',20,PP)],{ask:[1]})
c('qa',['aggiungi pasta al pesto a 15 e la lasagna','20'],[CR('pasta al pesto',15,PP),CR('lasagna',20,PP)],{ask:[1],askNoWrite:false})
c('mario','aggiungi tra i primi pasta al pesto a 13 e trofie a 12',[CR('pasta al pesto',13,'Primi'),CR('trofie',12,'Primi')])
c('mario',['aggiungi pasta al pesto a 13','nei primi'],CR('pasta al pesto',13,'Primi'),{ask:[1]})
c('qa',['aggiungi pasta al pesto 15, lasagna 20, polpette 9 e gnocchi 11','ok'],[CR('pasta al pesto',15,PP),CR('lasagna',20,PP),CR('polpette',9,PP),CR('gnocchi',11,PP)])
c('qa',V('aggiungi caviale a centocinquanta euro'),CR('caviale',150,PP))
c('qa','aggiungi pasta al ragù a 12',NONE,{note:'c\'è già a 12: dirlo, niente doppione'})

// ===================== v-categorie: creare categorie, piatti in categorie nuove, spostare =====================
fam='v-categorie'
c('qa',[M3,V("No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.")],[MV('pasta al ragù','Primi'),CR('pasta al pesto',15,'Primi'),CR('caviale',150,'Speciali')],{alt:[[P('pasta al ragù',10),MV('pasta al ragù','Primi'),CR('pasta al pesto',15,'Primi'),CR('caviale',150,'Speciali')]],source:'Manuel 17:30–17:31',note:'capacità mancante: creare categorie dalla chat; ragù già nel menu (nota 62): spostato nei Primi, prezzo 10 accettato ma non richiesto'})
c('qa',[V('Ok, adesso devi creare un\'altra categoria che si chiama "primi pasti".'),'aggiungi pasta al sugo a 12 nei primi pasti'],CR('pasta al sugo',12,'primi pasti'),{source:'Manuel 17:38 («Le categorie si creano dalla dashboard»)'})
c('qa','aggiungi una categoria speciali con il caviale a 150',CR('caviale',150,'Speciali'))
c('mario','sposta la lasagna nei secondi',MV('Lasagna al forno','Secondi'))
c('mario','metti la bruschetta nei primi',MV('Bruschetta al pomodoro','Primi'))
c('qa',['aggiungi tra i primi la pasta al pesto a 15','sì creala'],CR('pasta al pesto',15,'Primi'),{ask:[1],note:'la categoria Primi non c\'è: chiedere se crearla'})
c('qa',[Q('che categorie ho?')],NONE,{reply:/piatti di prova/i})
c('mario',['aggiungi il caviale a 150 in una categoria nuova che si chiama speciali'],CR('caviale',150,'speciali'))

// ===================== v-composti: «X e Y» due piatti o un nome composto =====================
fam='v-composti'
c('qa',[V('Allora aggiungi il piatto pasta al pesto e lasagna.'),V('No, pasta al pesto e lasagna sono due piatti separati.'),V('Uno deve essere a 10 euro e uno deve essere a 20 euro.')],[CR('pasta al pesto',10,PP),CR('lasagna',20,PP)],{source:'Manuel 17:39–17:40 (risposta vera: UN piatto «Pasta al pesto e lasagna» a 10,01 €)'})
c('mario','aggiungi pasta e fagioli alla napoletana a 10 nei primi',CR('pasta e fagioli alla napoletana',10,'Primi'))
c('qa','aggiungi pane e coperto a 2',CR('pane e coperto',2,PP))
c('qa','aggiungi pasta e fagioli a 9',CR('pasta e fagioli',9,PP))
c('qa','aggiungi pasta al pesto e lasagna a 10 e 20',[CR('pasta al pesto',10,PP),CR('lasagna',20,PP)])
c('qa','aggiungi pasta al pesto a 10 e lasagna a 20',[CR('pasta al pesto',10,PP),CR('lasagna',20,PP)])
c('mario','la pasta e fagioli costa 10',P('Pasta e fagioli',10),{note:'controllo'})
c('mario','pasta e fagioli e lasagna sono finite',[AV('Pasta e fagioli'),AV('Lasagna al forno')])
c('qa',['aggiungi il piatto pasta al pesto e lasagna','no sono due piatti','pasta al pesto 10, lasagna 20'],[CR('pasta al pesto',10,PP),CR('lasagna',20,PP)])
c('qa','aggiungi spaghetti cacio e pepe a 11',CR('spaghetti cacio e pepe',11,PP))
c('qa','aggiungi gnocchi e polpette a 9',[CR('gnocchi',9,PP),CR('polpette',9,PP)],{alt:[[CR('gnocchi e polpette',9,PP)]],ask:[],note:'ambiguo: accettati due piatti a 9 o un piatto composto'})

// ===================== v-correzioni: correzioni dopo una domanda o una modifica =====================
fam='v-correzioni'
c('qa',[V('Allora aggiungi il piatto pasta al pesto e lasagna.'),V('No, pasta al pesto e lasagna sono due piatti separati.')],NONE,{ask:[1,2],source:'Manuel 17:39 (risposta vera al turno 2: la stessa domanda sul piatto unico)'})
c('qa',['la parmigiana a 12','no, intendevo il tiramisù'],P('tiramisù',12),{interim:[P('la parmigiana',12)]})
c('qa','la parmigiana a 12, anzi no a 13',P('la parmigiana',13))
c('qa',V('Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.'),[P('la parmigiana',15),PR('tiramisù',3)],{source:'Manuel 13:27'})
c('qa',V('No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.'),[P('la parmigiana',15),P('tiramisù',10)],{source:'Manuel 13:28'})
c('qa',['aggiungi pasta al pesto a 15','no scusa 14'],CR('pasta al pesto',14,PP))
c('qa',['aggiungi caviale a 150','no, mettilo in una categoria nuova, speciali'],CR('caviale',150,'Speciali'))
c('qa',['nascondi boh','no scusa, il tiramisù'],HI('tiramisù'),{interim:[HI('boh')]})
c('qa',[V('Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.'),V('No, ho detto togli boh.')],HI('boh'),{source:'Manuel 13:25–13:26 (risposta vera: boh «finito»)'})
c('qa',['la parmigiana costa 12','anzi lascia stare'],NONE,{interim:[P('la parmigiana',12)]})
c('qa',[M3,'no, il caviale lascialo stare'],[CR('pasta al pesto',15,PP)],{interim:[CR('caviale',150,PP)],note:'nota 62: il ragù c\'è già (domanda), il «no» pubblica la parte chiara rimasta (pesto)'})

// ===================== v-risposte: risposte brevi a una domanda del bot =====================
fam='v-risposte'
c('qa',['aggiungi pasta al pesto e lasagna','10 e 20'],[CR('pasta al pesto',10,PP),CR('lasagna',20,PP)],{ask:[1]})
c('qa',['aggiungi pasta al pesto e lasagna','uno a 10 e uno a 20'],[CR('pasta al pesto',10,PP),CR('lasagna',20,PP)],{ask:[1],note:'in ordine; chiedere quale è quale è accettabile (MEDIO)'})
c('qa',['aggiungi la lasagna','20'],CR('lasagna',20,PP),{ask:[1]})
c('qa',['aggiungi la lasagna','20 euro'],CR('lasagna',20,PP),{ask:[1]})
c('qa',['aggiungi la lasagna','venti'],CR('lasagna',20,PP),{ask:[1]})
c('mario',['gli spaghetti sono finiti','il primo'],AV('Spaghetti alla carbonara'),{ask:[1]})
c('qa',['aggiungi la lasagna','la lasagna costa 20'],CR('lasagna',20,PP),{ask:[1]})
c('qa',['aggiungi la lasagna','10 euro e 50'],CR('lasagna',10.5,PP),{ask:[1]})
c('qa',['aggiungi pasta al pesto e lasagna','la prima 10 la seconda 20'],[CR('pasta al pesto',10,PP),CR('lasagna',20,PP)],{ask:[1]})

// ===================== v-prezzi: prezzi mai detti, inventati o arrotondati =====================
fam='v-prezzi'
c('qa',['aggiungi la lasagna','uno deve essere a 10 euro e uno a 20'],NONE,{ask:[1,2],note:'un piatto solo e due prezzi: chiedere, mai 10,01'})
c('qa',['aggiungi la lasagna','10 euro e uno a 20'],NONE,{ask:[1,2],note:'«10 euro e uno» non è 10,01'})
c('qa','aggiungi la lasagna',NONE,{ask:[1]})
c('qa','la parmigiana costa dodici e cinquanta',P('la parmigiana',12.5))
c('qa','la parmigiana costa 12 e 50',P('la parmigiana',12.5))
c('qa','metti la parmigiana e il tiramisù a 10 e 20 euro',P('tiramisù',20),{note:'la parmigiana è già 10'})
c('qa',[V('Aggiungi il piatto pasta al pesto e lasagna.'),V('Uno deve essere a 10 euro e uno deve essere a 20 euro.')],[CR('pasta al pesto',10,PP),CR('lasagna',20,PP)],{ask:[1]})
c('qa','aggiungi lasagna a 20 euro e uno',CR('lasagna',20,PP),{alt:[NONE],note:'mai 20,01'})
c('qa','il tiramisù costa 6 e 50',P('tiramisù',6.5))

// ===================== v-verbi: verbi e frasi finiti nel nome del piatto =====================
fam='v-verbi'
c('mario',V('Inserisce il piatto la parmigiana a 12 euro nei primi'),CR('parmigiana',12,'Primi'),{alt:[[CR('la parmigiana',12,'Primi')]],source:'Manuel 13:20 (risposta vera: piatto «Inserisce il piatto la parmigiana»)'})
c('mario',[V('Inserisci un nuovo piatto, si chiama parmigiana.'),'12 euro','nei primi'],CR('parmigiana',12,'Primi'),{source:'Manuel 13:22'})
c('mario','voglio aggiungere il piatto lasagna verde a 13 nei primi',CR('lasagna verde',13,'Primi'))
c('mario','mi aggiungi per favore la pasta alla norma a 12 nei primi?',CR('pasta alla norma',12,'Primi'))
c('qa','inserisce il piatto pasta al pesto a 15',CR('pasta al pesto',15,PP))
c('qa','aggiungere il piatto lasagna a 20',CR('lasagna',20,PP))
c('qa','puoi aggiungere un piatto che si chiama lasagna a 20',CR('lasagna',20,PP))
c('qa','ci metti anche la lasagna a 20?',CR('lasagna',20,PP),{alt:[NONE],note:'domanda-richiesta: creare o chiedere'})
c('qasporco','metti la parmigiana a 15',P('la parmigiana',15),{source:'Manuel 13:27 (risposta vera: «Quale piatto intendi: Inserisce il piatto la parmigiana, la parmigiana? Riscrivimi…»)',note:'«la parmigiana» è il nome esatto'})
c('mario',[V('Inserisce il piatto la parmigiana.'),'12 euro','nei primi'],CR('parmigiana',12,'Primi'),{alt:[[CR('la parmigiana',12,'Primi')]],source:'Manuel 13:20–13:22'})

// ===================== v-asr: nomi storpiati dalla trascrizione =====================
fam='v-asr'
c('qa',[V('Bu costa 40 euro'),'sì'],P('boh',40),{ask:[1],source:'Manuel 13:17 (risposta vera: «Non trovo «b»»)'})
c('qa',V('Passa il ragù, metti prezzo a 20 euro.'),P('pasta al ragù',20),{source:'Manuel 13:18'})
c('qa',V('nel kenesac metti la promo a 12 euro'),PR('Che ne sacc',12),{source:'Manuel 13:23 (kenesac = Che ne sacc)'})
c('qa',V('il che ne sacc costa 18'),P('Che ne sacc',18))
c('qa',V('tojibo'),NONE,{ask:[1]})
c('qa',V('la parmiggiana a 11'),P('la parmigiana',11))
c('qa',V('il tiramisu a sette'),P('tiramisù',7))
c('qa',V('Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?'),P('boh',50),{source:'Manuel 13:17 (risposta vera: «Non ho capito cosa cambiare per boh»)'})
c('qa',V('il piatto bo mettilo a 25'),P('boh',25))
c('qa',V('Allora nel piatto Bo cambia la descrizione e metti Joe fa schifo, invece nel piatto Kenesac metti la promo a 12 euro.'),[{op:'description',dish:'boh',text:'Joe fa schifo'},PR('Che ne sacc',12)],{source:'Manuel 13:24 (risposta vera: «Non ho capito la richiesta»)'})

// ===================== v-stato: domande sullo stato dopo le modifiche =====================
fam='v-stato'
c('qa',['nascondi boh',Q('quali piatti ho nascosto?')],HI('boh'),{reply:/boh/i})
c('qa',['la parmigiana costa 12',Q('quanto costa la parmigiana adesso?')],P('la parmigiana',12),{reply:/12/})
c('qa',['la parmigiana è finita',Q('cosa è finito?')],AV('la parmigiana'),{reply:/parmigiana/i})
c('qa',[Q('quanto costa il piatto boh?')],NONE,{reply:/20/})
c('qa',['aggiungi pasta al pesto a 15',Q('che piatti ho nei piatti di prova?')],CR('pasta al pesto',15,PP),{reply:/pesto/i})
c('qa',['metti il tiramisù in promo a 4',Q('quali promo ho attive?')],PR('tiramisù',4),{reply:/tiramis/i})
c('qa',[V('Ciao, cosa sai fare?')],NONE,{source:'Manuel 17:26 (ok dal vivo)'})
c('qa',['elimina boh',Q("boh c'è ancora nel menu?")],NONE,{reply:/boh/i,note:'R5.1 (nota 63): elimina solo dopo «sì» (regola del titolare): la domanda non è un sì, boh resta e la risposta lo dice; l\'attesa di prima (eliminato) contraddiceva la regola'})

// ===================== v-annulla: annulla dopo modifiche singole e multiple =====================
fam='v-annulla'
c('qa',['la parmigiana a 12 e il tiramisù a 7','annulla'],NONE,{interim:[P('la parmigiana',12),P('tiramisù',7)]})
c('qa',['nascondi boh','la parmigiana a 12','annulla'],HI('boh'),{interim:[P('la parmigiana',12)],note:'annulla solo l\'ultima pubblicazione'})
c('qa',['aggiungi pasta al pesto a 15','annulla'],NONE,{interim:[CR('pasta al pesto',15,PP)]})
c('qa',[M1,'annulla'],NONE,{interim:[HI('boh')]})
c('qa',['la parmigiana a 12 e il tiramisù a 7',"rimetti il tiramisù com'era"],P('la parmigiana',12),{interim:[P('tiramisù',7)]})
c('qa',['la parmigiana a 12',W(40),'annulla'],P('la parmigiana',12),{note:'oltre la finestra: dirlo, non annullare'})
c('qa',['la parmigiana a 12, il tiramisù a 7, boh a 25 e che ne sacc a 22','ok','annulla'],NONE,{interim:[P('la parmigiana',12),P('tiramisù',7),P('boh',25),P('Che ne sacc',22)]})
c('qa',[M3,'annulla'],NONE,{interim:[CR('pasta al pesto',15,PP),CR('caviale',150,PP)],note:'nota 62: niente prezzo sul ragù (c\'è già)'})

// ===================== v-misti: domanda + modifica nello stesso messaggio =====================
fam='v-misti'
c('qa','quanto costa la parmigiana? mettila a 12',P('la parmigiana',12))
c('qa','metti la parmigiana a 12 e dimmi quanto costa il tiramisù',P('la parmigiana',12),{reply:/6/})
c('qa','la parmigiana è finita, cosa altro è finito?',AV('la parmigiana'))
c('qa','il tiramisù costa ancora 6? se sì mettilo a 7',P('tiramisù',7))
c('qa',V('Ciao cosa sai fare? intanto nascondi boh'),HI('boh'))
c('qa',['ciao','la parmigiana a 12'],P('la parmigiana',12))
c('qa','nascondi boh e dimmi quali piatti sono nascosti',HI('boh'),{reply:/boh/i})

// ===================== v-frasefissa: «Rimandami/Riscrivimi la richiesta completa» quando il contesto basta =====================
fam='v-frasefissa'
c('qa','aggiungi pasta al pesto a 15 e caviale a 150',[CR('pasta al pesto',15,PP),CR('caviale',150,PP)])
c('qa',[M3,V("No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.")],[MV('pasta al ragù','Primi'),CR('pasta al pesto',15,'Primi'),CR('caviale',150,'Speciali')],{alt:[[P('pasta al ragù',10),MV('pasta al ragù','Primi'),CR('pasta al pesto',15,'Primi'),CR('caviale',150,'Speciali')]],source:'Manuel 17:31',note:'ragù già nel menu (nota 62)'})
c('qa',['la parmigiana e il tiramisù a 15','rimuovi completamente quei due piatti'],[P('la parmigiana',15),P('tiramisù',15),DEL('la parmigiana'),DEL('tiramisù')])
c('qa','aggiungi lasagna',NONE,{ask:[1]})
c('mario','aggiungi pasta al pesto a 13',NONE,{ask:[1]})
c('qasporco',['la parmigiana è finita'],AV('la parmigiana'))

// ===================== v-coerenza: risposte contraddittorie tra turni =====================
fam='v-coerenza'
c('qa',['crea la categoria primi pasti','aggiungi la pasta al sugo nei primi pasti a 12'],CR('pasta al sugo',12,'primi pasti'))
c('qa',['nascondi boh',Q('boh è nascosto?')],HI('boh'),{reply:/nascost/i})
c('qa',M1,HI('boh'),{source:'Manuel 17:27 (ok dal vivo)'})
c('qa',['la parmigiana a 15','la parmigiana a 15'],P('la parmigiana',15))
c('qa',['aggiungi pasta al sugo a 12','aggiungi pasta al sugo a 12'],CR('pasta al sugo',12,PP))
c('qa',['elimina boh','rimetti boh'],NONE,{alt:[[]],note:'se ha nascosto, «rimetti» lo rimostra; se ha eliminato non può: dirlo'})

// ===================== v-rinomina: rinominare piatti e categorie =====================
fam='v-rinomina'
c('qasporco','rinomina «Inserisce il piatto la parmigiana» in «Parmigiana di melanzane»',REN('Inserisce il piatto la parmigiana','Parmigiana di melanzane'))
c('qa','cambia il nome di boh in Bollito misto',REN('boh','Bollito misto'),{source:'Manuel 13:24 («Il nome del piatto si cambia dalla dashboard»)'})
c('qa','boh chiamalo Bollito',REN('boh','Bollito'))
c('mario','rinomina la categoria Proposte in Speciali',[MV('Nuovo burger','Speciali'),MV('Burger classico','Speciali')])
c('qa','il piatto di verifica da oggi si chiama Piatto del giorno',REN('Piatto di verifica','Piatto del giorno'))
c('qa',V('Cambia il nome del piatto boh, mettici bollito.'),REN('boh','bollito'),{alt:[[REN('boh','Bollito')]]})
