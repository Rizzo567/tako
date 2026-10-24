// BANCO VERO (18/10/2026, agente B, task 4 del PIANO cervello Anthropic): conversazioni REALI di Manuel con Tako su WhatsApp
// (mittente …0927, 14–17/10). Testi: messaggi scritti copiati da Twilio; vocali trascritti in locale con whisper-cli large-v3-turbo
// (la trascrizione è il turno `voice`, storpiature comprese). Ogni conversazione = messaggi consecutivi della stessa sessione,
// sul menu del QA/Victoria Bar ricostruito com'era in quel momento (fixture + mods). Restano fuori l'onboarding agenzia
// (Crea locale…, RIPRENDI…), le foto e i «collega/attiva» con codice: non sono il bot del titolare.
// Stato finale atteso scritto con le regole del titolare: togli = nascondi; elimina/cancella/rimuovi completamente = cancella solo
// dopo «sì» (quindi qui: domanda e niente scrittura se il «sì» non arriva); ≥2 parti incerte → una domanda ciascuna; «no» pubblica
// le chiare; «annulla» = ultima pubblicazione; mai prezzi non detti. Intenzione ambigua → `ask` (domanda attesa) e `note` che
// inizia con «AMBIGUO:» col motivo. `source` = giorno e ora italiani del primo messaggio vero.
import type {Change,Conversation,Family,Mods,Pick,Turn} from '../types.js'

type In=string|Turn
const T=(s:string):Turn=>({text:s}),Q=(s:string):Turn=>({text:s,q:true}),V=(s:string):Turn=>({voice:s}),VQ=(s:string):Turn=>({voice:s,q:true})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),AV=(dish:string,value=false):Change=>({op:'available',dish,value}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const PR=(dish:string,price:number|null):Change=>({op:'promo',dish,price})
const CR=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const MV=(dish:string,section:string):Change=>({op:'move',dish,section}),REN=(dish:string,name:string):Change=>({op:'rename',dish,name})
const NONE:Change[]=[]
type Extra={ask?:number[],askNoWrite?:boolean,alt?:Change[][],reply?:RegExp,mods?:Mods,note?:string,pick?:Pick,interim?:Change[]}

export const BV_CASES:Conversation[]=[]
let fam:Family='bv-semplici'
const c=(menu:string,source:string,turns:In|In[],changes:Change|Change[],x:Extra={})=>{const id=`${fam}-${String(BV_CASES.filter(k=>k.family===fam).length+1).padStart(3,'0')}`
 BV_CASES.push({id,family:fam,menu,turns:(Array.isArray(turns)?turns:[turns]).map(t=>typeof t==='string'?T(t):t),changes:Array.isArray(changes)?changes:[changes],source:`Manuel ${source}`,...x})}
const PP='Piatti di prova',VER='Piatto di verifica'
/** Conversazioni la cui intenzione è ambigua (domanda attesa): contate nel README e nel report. */
export const isAmbiguous=(c:Conversation)=>/^AMBIGUO:/.test(c.note??'')

// ===================== bv-semplici: un solo comando chiaro (criterio ≥ 97%) =====================
fam='bv-semplici'
c('qa','14/10 18:53',['prezzo Piatto di verifica a 9','conferma'],P(VER,9),{note:'protocollo vecchio con CONFERMA: oggi il bot scrive subito, «conferma» non deve cambiare nulla'})
c('qa','14/10 18:55',['prezzo Piatto di verifica a 12','conferma'],P(VER,12),{mods:{prices:{[VER]:9}}})
c('victoria','14/10 22:35',[V('Nascondi il polpo.'),'conferma'],HI('Polpo rucola e patate'))
c('victoria','15/10 00:22',[V('Mostra il polpo.'),V('Confirma.')],HI('Polpo rucola e patate',false),{mods:{hidden:['Polpo rucola e patate']}})
c('victoria','15/10 12:29','A Bruschetta Victoria un c\'è cchiù',AV('Bruschetta Victoria'))
c('qa1016','16/10 18:21',V('Aggiungi tra piatti di prova, pasta al ragù, 12 euro.'),CR('pasta al ragù',12,PP))
c('qamattina','17/10 10:36','il piatto di verifica costa 13 euro',P(VER,13))
c('qamattina','17/10 10:38','il piatto di verifica è finito',AV(VER))
c('qamattina','17/10 10:41','il piatto di verifica è tornato disponibile',AV(VER,true),{mods:{unavail:[VER]}})
c('qamattina','17/10 10:51','nascondi il piatto di verifica',HI(VER))
c('qamattina','17/10 10:53','mostra il piatto di verifica',HI(VER,false),{mods:{hidden:[VER]}})
c('qamattina','17/10 10:56','aggiungi nella categoria Piatti di prova il piatto Piatto test QA a 9 euro',CR('Piatto test QA',9,PP),{note:'nome detto «Piatto test QA»: il nome nuovo è quello detto letteralmente (decisione 18/10, nota 62); il bot vero aveva creato «Test QA»'})
c('qamattina','17/10 11:13','metti il piatto di verifica a tredici euro e cinquanta',P(VER,13.5),{mods:{prices:{[VER]:14}}})
c('qamattina','17/10 13:18',V('Passa il ragù, metti prezzo a 20 euro.'),P('pasta al ragù',20),{note:'«Passa il ragù» = «pasta al ragù» storpiato da Whisper'})
c('qamattina','17/10 13:17',V('Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?'),P('boh',50),{note:'risposta vera: «Non ho capito cosa cambiare per boh»'})
c('qa','17/10 17:36',V('Aggiungi il piatto pasta al sugo a 12 euro.'),CR('pasta al sugo',12,PP),{note:'una sola categoria: va usata'})
c('qamattina','17/10 13:19',V('Vai, nascondi la pasta del ragù.'),HI('pasta al ragù'))
c('victoria','15/10 12:22','La Bruschetta Victoria la xe finia',AV('Bruschetta Victoria'))
c('victoria','15/10 12:24','La Bruschetta Victoria l\'è finida',AV('Bruschetta Victoria'))
c('victoria','15/10 12:44','Boia, mettimi la Bruschetta Victoria a dodici euri',P('Bruschetta Victoria',12))
// domande semplici (lettura): stesso criterio dei semplici
c('qamattina','17/10 10:32',Q('quanto costa il piatto di verifica?'),NONE,{reply:/13,50/})
c('qamattina','17/10 10:45',Q('cosa è finito?'),NONE)
c('qamattina','17/10 13:16',VQ('Quanto costa la pasta al ragù?'),NONE,{reply:/12/})
c('qamattina','17/10 13:16',VQ('Quanto costa il piatto boh?'),NONE,{reply:/20/})
c('victoria','15/10 12:19',Q('Aò, quanto viene la Bruschetta Victoria?'),NONE,{reply:/8/})
c('victoria','14/10 19:28',VQ('Tagliata rucola e grana, quanto costa?'),NONE,{reply:/20/})

// ===================== bv-domande: domande e saluti, mai scritture =====================
fam='bv-domande'
c('victoria','14/10 19:28',[VQ('Quanto costa la tagliata?'),VQ('Tagliata rucola e grana, quanto costa?')],NONE,{reply:/20/,note:'tre tagliate: elencarle con i prezzi va bene quanto chiedere'})
c('victoria','14/10 22:32',VQ('Dimmi un po\' tutto quello che sai fare'),NONE,{note:'risposta vera: «Non trovo nel menu il piatto»'})
c('victoria','14/10 22:36',VQ('Quanto costa la tagliata'),NONE,{reply:/20/})
c('victoria','15/10 00:23',[Q('cosa sai fare?'),Q('sai cambiare gli allergeni?')],NONE)
c('victoria','15/10 12:16',Q('Ciao! A quale locale sono collegato e cosa puoi fare?'),NONE,{reply:/victoria/i,note:'collegato a Victoria Bar dal 14/10 19:26'})
c('qa1016','16/10 18:18',[Q('ciao'),Q('che locale ho?')],NONE,{reply:/verifica web/i,note:'risposta vera fuori tema («Posso dirti prezzi…»)'})
c('qamattina','17/10 10:43',Q('piatto di verifica 13 o 14?'),NONE,{mods:{prices:{[VER]:13}},note:'domanda sul prezzo: dirlo (13), niente scrittura'})
c('qamattina','17/10 13:19',[VQ('Ok, adesso dimmi cosa è finito.'),VQ('Ok, allora mi devi dire quali piatti ho nascosto, per favore.')],NONE,{mods:{hidden:['pasta al ragù'],prices:{'pasta al ragù':20}},reply:/ragù/i})
c('qa','17/10 17:26',VQ('Ciao, cosa sai fare?'),NONE)
c('qamattina','17/10 11:11',[T('non cambiare boh; metti il piatto di verifica a tredici euro e cinquanta'),T('Piatto di verifica')],P(VER,13.5),{mods:{prices:{[VER]:14,'Che ne sacc':21,boh:21,'pasta al ragù':13}},note:'«non cambiare boh» è una negazione, non un piatto da scegliere; il turno 2 risponde alla domanda vera del bot'})

// ===================== bv-multiple: più modifiche in un messaggio, riepilogo e OK =====================
fam='bv-multiple'
c('collaudo','15/10 15:42','La Pasta collaudo mettila a undici euro, la Pizza collaudo a tredici euro e il Tiramisu collaudo a sei euro.',[P('Pasta collaudo',11),P('Pizza collaudo',13),P('Tiramisu collaudo',6)])
c('collaudo','15/10 15:44',['La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.','Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.','OK'],[P('Pasta collaudo',15),P('Pizza collaudo',16),P('Tiramisu collaudo',7)],{mods:{prices:{'Pasta collaudo':11,'Pizza collaudo':13,'Tiramisu collaudo':6}},note:'risposta vera al turno 2 (prima prova): «Non ho capito bene»'})
c('collaudo','15/10 15:54',['La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.','Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.','OK','OK'],[P('Pasta collaudo',15),P('Pizza collaudo',16),P('Tiramisu collaudo',7)],{mods:{prices:{'Pasta collaudo':11,'Pizza collaudo':13,'Tiramisu collaudo':6}},note:'il secondo OK non ha niente da confermare'})
c('qamattina','17/10 11:05',['metti Piatto di verifica a 14 euro, Che ne sacc a 21 euro, boh a 21 euro e pasta al ragù a 13 euro','ok va bene'],[P(VER,14),P('Che ne sacc',21),P('boh',21),P('pasta al ragù',13)],{mods:{prices:{[VER]:13}}})
c('qamattina','17/10 11:15','metti Che ne sacc a 20 euro, boh a 20 euro e pasta al ragù a 12 euro',[P('Che ne sacc',20),P('boh',20),P('pasta al ragù',12)],{mods:{prices:{[VER]:13.5,'Che ne sacc':21,boh:21,'pasta al ragù':13}}})
c('qamattina','17/10 10:47','aumenta tutti i piatti della categoria Piatti di prova di un euro',[P(VER,14.5),P('Che ne sacc',21),P('boh',21),P('pasta al ragù',13)],{note:'prezzi detti (ognuno +1 €): un solo comando sul gruppo → si applica subito con riepilogo numerato, niente domanda (decisione 18/10 in attesa di Manuel, nota 62); risposta vera: rifiuto'})
c('qa1323','17/10 13:23',V('Allora, voglio che mi nascondi la parmigiana tra i piatti del menù e mi metti in sconto il kenesac a 12 euro.'),[HI('Inserisce il piatto la parmigiana'),PR('Che ne sacc',12)],{mods:{hidden:['pasta al ragù']},note:'«la parmigiana» = l\'unico piatto con parmigiana; kenesac = Che ne sacc'})
c('qa1323','17/10 13:23',[V('Allora, voglio che mi nascondi la parmigiana tra i piatti del menù e mi metti in sconto il kenesac a 12 euro.'),V('Allora, voglio che mi nascondi dal menù il piatto la parmigiana e invece mi metti in promo il piatto di verifica a 11 euro.')],[HI('Inserisce il piatto la parmigiana'),PR('Che ne sacc',12),PR(VER,11)],{mods:{hidden:['pasta al ragù']}})
c('qa1323','17/10 13:24',V('Allora nel piatto Bo cambia la descrizione e metti Joe fa schifo, invece nel piatto Kenesac metti la promo a 12 euro.'),[{op:'description',dish:'boh',text:'Joe fa schifo'},PR('Che ne sacc',12)],{mods:{hidden:['pasta al ragù']},note:'risposta vera: «Non ho capito la richiesta»'})

// ===================== bv-correzioni: «anzi no», «no, ho detto…» =====================
fam='bv-correzioni'
c('qa1323','17/10 13:25',[V('Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.'),V('No, ho detto togli boh.'),V('Sì, ma ti avevo detto che dovevi aggiungere il piatto, la parmigiana a 10 euro e il tiramisù a 6 euro.')],[CR('la parmigiana',10,PP),CR('tiramisù',6,PP),HI('boh')],{alt:[[CR('parmigiana',10,PP),CR('tiramisù',6,PP),HI('boh')]],mods:{hidden:['pasta al ragù']},ask:[1],askNoWrite:false,note:'«toiibo» incerto al turno 1 (domanda), le parti chiare si pubblicano; risposta vera al turno 2: boh «finito» invece di nascosto'})
c('qa1323','17/10 13:26',[V('Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.'),V('No, ho detto togli boh.')],[CR('la parmigiana',10,PP),CR('tiramisù',6,PP),HI('boh')],{alt:[[CR('parmigiana',10,PP),CR('tiramisù',6,PP),HI('boh')]],mods:{hidden:['pasta al ragù']},ask:[1],askNoWrite:false})
c('qasporco','17/10 13:27',V('Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.'),[P('la parmigiana',15),PR('tiramisù',3)],{note:'«la parmigiana» è il nome esatto (l\'altro è nascosto); risposta vera: «Quale piatto intendi… Riscrivimi»'})
c('qasporco','17/10 13:27',[V('Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.'),V('No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.')],[P('la parmigiana',15),P('tiramisù',10)],{interim:[PR('tiramisù',3)],note:'il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo'})
c('qasporco','17/10 13:28',V('No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.'),[P('la parmigiana',15),P('tiramisù',10)],{alt:[NONE],note:'notte 22/10: senza il turno di prima «il tiramisù mettilo a 3, anzi no, mettiLA a 10» è ambiguo (femminile = parmigiana, posizione = tiramisù) e cambia anche la parmigiana: una domanda senza scritture è accettata'})
c('qa','17/10 17:39',[V('Allora aggiungi il piatto pasta al pesto e lasagna.'),V('No, pasta al pesto e lasagna sono due piatti separati.'),V('Uno deve essere a 10 euro e uno deve essere a 20 euro.')],[CR('pasta al pesto',10,PP),CR('lasagna',20,PP)],{ask:[1,2],note:'AMBIGUO: turno 1 «pasta al pesto e lasagna» uno o due piatti, senza prezzo; turno 2 due piatti senza prezzo. Risposta vera finale: un piatto a 10,01 €'})
c('qa','17/10 17:39',[V('Allora aggiungi il piatto pasta al pesto e lasagna.'),V('No, pasta al pesto e lasagna sono due piatti separati.')],NONE,{ask:[1,2],note:'AMBIGUO: mancano i prezzi di entrambi: una domanda (mai prezzi inventati)'})

// ===================== bv-deixis: «quei due», «entrambi» =====================
fam='bv-deixis'
c('qa','17/10 17:27',[V('Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.'),V('Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.')],[HI('boh'),P('la parmigiana',15),P('tiramisù',15)],{note:'parmigiana e tiramisù ci sono già a 10 e 6: non duplicarli'})
c('qa','17/10 17:27',[V('Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.'),V('Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.'),V('Ok, adesso rimuovi completamente quei due piatti.')],[HI('boh'),P('la parmigiana',15),P('tiramisù',15)],{ask:[3],note:'«rimuovi completamente» = eliminare: si cancella solo dopo «sì», quindi al turno 3 domanda di conferma e niente scrittura. Risposta vera: «Quale piatto intendi… Riscrivimi»'})
c('qa','17/10 17:27',V('Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.'),HI('boh'))
c('qa','17/10 17:30',[V('Ok, adesso rimuovi completamente quei due piatti.')],NONE,{mods:{prices:{'la parmigiana':15,'tiramisù':15}},ask:[1],note:'AMBIGUO: senza il contesto della chat «quei due» non si risolve: domanda'})

// ===================== bv-aggiunte: piatti nuovi, dati mancanti =====================
fam='bv-aggiunte'
c('qa1016','16/10 18:19',['aggiungiamo un piatto',V('Aggiungi tra piatti di prova il piatto pasta al ragù che costa 15 euro.')],CR('pasta al ragù',15,PP),{ask:[1],note:'risposta vera al turno 2: «Non trovo «aggiungi tra piatti di prova il piatto pasta al ragu che»»'})
c('qa1016','16/10 18:20',V('Aggiungi tra piatti di prova il piatto pasta al ragù che costa 15 euro.'),CR('pasta al ragù',15,PP))
c('qamattina','17/10 13:20',[V('Inserisce il piatto la parmigiana.'),V('Inserisci un nuovo piatto, si chiama parmigiana.'),V('12 euro')],CR('parmigiana',12,PP),{alt:[[CR('la parmigiana',12,PP)]],ask:[1,2],note:'prezzo assente fino al turno 3: domande; risposta vera: piatto «Inserisce il piatto la parmigiana»'})
c('qamattina','17/10 13:20',V('Inserisce il piatto la parmigiana.'),NONE,{ask:[1],note:'manca il prezzo: domanda'})
c('qa','17/10 17:30',V('E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.'),NONE,{ask:[1],alt:[[CR('pasta al pesto',15,PP),CR('caviale',150,PP)]],note:'AMBIGUO: pasta al ragù c\'è già a 12: domanda breve («c\'è già pasta al ragù a 12 €: lo aggiorno o ne creo un altro?»), nessuna scrittura sul ragù (decisione 18/10, nota 62); con una parte incerta le parti chiare (pesto e caviale, una sola categoria) aspettano la risposta; accettato anche pubblicarle. Risposta vera: «manca la categoria … Rimandami»'})
c('victoria','14/10 22:37',V('La lasagna costa 12'),NONE,{note:'lasagna non c\'è al Victoria: dirlo, niente piatto nuovo'})

// ===================== bv-elimina: eliminare = solo dopo «sì» =====================
fam='bv-elimina'
c('victoria','14/10 22:34',[VQ('Puoi cancellare il polpo?'),V('Nascondi il polpo.'),'conferma'],HI('Polpo rucola e patate'),{ask:[1],note:'«cancellare» → chiedere conferma dell\'eliminazione; Manuel poi sceglie di nascondere'})
c('victoria','14/10 22:34',VQ('Puoi cancellare il polpo?'),NONE,{ask:[1]})
c('qamattina','17/10 13:18',[V('Elimina il piatto pasta al ragù.'),V('Vai, nascondi la pasta del ragù.')],HI('pasta al ragù'),{mods:{prices:{'pasta al ragù':20}},ask:[1],note:'elimina → conferma; poi «nascondi» vince'})
c('qamattina','17/10 13:18',V('Elimina il piatto pasta al ragù.'),NONE,{ask:[1],note:'risposta vera: «Da questa chat non posso eliminare»'})
c('qamattina','17/10 11:01',['aggiungi nella categoria Piatti di prova il piatto Piatto test QA a 9 euro','togli il piatto Test QA','annulla'],CR('Piatto test QA',9,PP),{note:'nome letterale «Piatto test QA» (nota 62); togli = nascondi; annulla = torna visibile (il giudice vede solo la creazione). Risposta vera: «Non ci sono modifiche in attesa»'})

// ===================== bv-categorie: categorie nuove dalla chat =====================
fam='bv-categorie'
c('qa','17/10 17:30',[V('E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.'),V('No, fai una cosa, aggiungi un\'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un\'altra categoria ancora, chiamandola speciali.')],[MV('pasta al ragù','Primi'),CR('pasta al pesto',15,'Primi'),CR('caviale',150,'Speciali')],{alt:[[P('pasta al ragù',10),MV('pasta al ragù','Primi'),CR('pasta al pesto',15,'Primi'),CR('caviale',150,'Speciali')]],note:'il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza risposta); risposta vera: «manca la categoria»'})
c('qa','17/10 17:38',V('Ok, adesso devi creare un\'altra categoria che si chiama "primi pasti".'),{op:'section',name:'primi pasti'},{note:'risposta vera: «Le categorie si creano dalla dashboard»'})
c('qa','17/10 17:36',[V('Aggiungi il piatto pasta al sugo a 12 euro.'),V('Ok, adesso devi creare un\'altra categoria che si chiama "primi pasti".')],[CR('pasta al sugo',12,PP),{op:'section',name:'primi pasti'}])

// ===================== bv-annulla: annulla = ultima pubblicazione =====================
fam='bv-annulla'
c('victoria','15/10 12:20',['Uè, a Bruschetta Victoria nun ce sta cchiù','ANNULLA'],NONE,{interim:[AV('Bruschetta Victoria')]})
c('victoria','15/10 12:22',['La Bruschetta Victoria la xe finia','ANNULLA'],NONE,{interim:[AV('Bruschetta Victoria')]})
c('victoria','15/10 12:24',['La Bruschetta Victoria l\'è finida','ANNULLA'],NONE,{interim:[AV('Bruschetta Victoria')]})
c('victoria','15/10 12:44',['Boia, mettimi la Bruschetta Victoria a dodici euri','ANNULLA'],NONE,{interim:[P('Bruschetta Victoria',12)]})
c('qamattina','17/10 11:18',['metti Piatto di verifica a 14 euro, Che ne sacc a 21 euro, boh a 21 euro e pasta al ragù a 13 euro','annulla'],NONE,{interim:[P(VER,14),P('Che ne sacc',21),P('boh',21),P('pasta al ragù',13)]})
c('qamattina','17/10 10:51',['nascondi il piatto di verifica','mostra il piatto di verifica'],NONE,{interim:[HI(VER)]})
c('qamattina','17/10 10:38',['il piatto di verifica è finito','il piatto di verifica è tornato disponibile'],NONE,{interim:[AV(VER)]})
c('qamattina','17/10 10:32',[Q('quanto costa il piatto di verifica?'),'il piatto di verifica costa 13 euro','il piatto di verifica è finito','il piatto di verifica è tornato disponibile',Q('piatto di verifica 13 o 14?'),Q('cosa è finito?')],P(VER,13),{interim:[AV(VER)],reply:/disponibil|nessun|tutti/i,note:'sessione intera 10:32–10:45'})

// ===================== bv-dialetto: Victoria Bar 15/10 (prove in dialetto) =====================
fam='bv-dialetto'
c('victoria','15/10 12:20','Uè, a Bruschetta Victoria nun ce sta cchiù',AV('Bruschetta Victoria'))
c('victoria','15/10 12:45',['A Bruschetta Victoria nun è fernuta, ce sta ancora','ANNULLA'],NONE,{note:'è già disponibile: dirlo, niente da annullare'})
c('victoria','15/10 12:45','A Bruschetta Victoria nun è fernuta, ce sta ancora',AV('Bruschetta Victoria',true),{mods:{unavail:['Bruschetta Victoria']}})
c('victoria','15/10 12:46','Nun cambià er prezzo de la Bruschetta Victoria',NONE,{note:'negazione: niente scrittura; risposta vera «Non ho capito bene»'})
c('victoria','15/10 12:47','Uè, a tagliata nun ce sta cchiù',NONE,{ask:[1],note:'AMBIGUO: tre tagliate nel menu (rucola e grana, funghi porcini, orata o branzino): una domanda'})

// ===================== bv-asr: storpiature e richieste incerte dai vocali =====================
fam='bv-asr'
c('qa','14/10 19:15',[V('Il piatto di verifica da domani costa 13,50 euro.'),V('Confirma.'),V('Confirma.'),'conferma'],P(VER,13.5),{mods:{prices:{[VER]:12}},ask:[1],note:'AMBIGUO: «da domani» → il bot non programma: chiedere se cambiarlo subito; «Confirma» (Whisper) = sì'})
c('qamattina','17/10 13:17',V('Bu costa 40 euro'),NONE,{ask:[1],note:'AMBIGUO: «Bu» ≈ boh ma non è certo: domanda (risposta vera: «Non trovo «b»»)'})
c('qamattina','17/10 13:17',[V('Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?'),V('Bu costa 40 euro')],P('boh',40),{interim:[P('boh',50)],note:'dopo «Bo» a 50, «Bu costa 40» corregge lo stesso piatto'})
c('qa1323','17/10 13:24',V('Cambia il nome del piatto, inserisci la parmigiana.'),REN('Inserisce il piatto la parmigiana','la parmigiana'),{mods:{hidden:['pasta al ragù']},alt:[[REN('Inserisce il piatto la parmigiana','parmigiana')],[REN('Inserisce il piatto la parmigiana','La parmigiana')],[REN('Inserisce il piatto la parmigiana','Parmigiana')]],note:'R5.1 (nota 63): l\'attesa chiedeva insieme una domanda senza scritture e la rinomina nello stesso turno (impossibile): resta la rinomina col nome detto (unico piatto da rinominare nel menu del 13:24). AMBIGUO: quale piatto rinominare non è detto (si intuisce quello nato dalla frase): chiedere conferma; risposta vera: «Il nome del piatto si cambia dalla dashboard»'})
c('qamattina','17/10 13:16',[VQ('Quanto costa la pasta al ragù?'),VQ('Quanto costa il piatto boh?'),V('Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?'),V('Bu costa 40 euro'),V('Passa il ragù, metti prezzo a 20 euro.')],[P('boh',40),P('pasta al ragù',20)],{interim:[P('boh',50)],note:'sessione 13:16–13:18 intera'})

// ===================== bv-fuori: fuori perimetro, mai scritture =====================
fam='bv-fuori'
c('qamattina','17/10 10:49','metti una foto al piatto di verifica',NONE,{note:'senza foto allegata: spiegare come mandarla'})
c('victoria','15/10 00:23',Q('sai cambiare gli allergeni?'),NONE)
c('collaudo','15/10 15:55','La Pasta collaudo mettila a dodici oppure quattordici euro.',NONE,{mods:{prices:{'Pasta collaudo':15}},ask:[1],note:'AMBIGUO: due prezzi alternativi: chiedere quale (risposta vera: «Non sono sicuro di quale piatto»)'})
c('qa1016','16/10 18:19','aggiungiamo un piatto',NONE,{ask:[1],note:'manca tutto: una domanda (nome e prezzo), niente frase fissa'})
