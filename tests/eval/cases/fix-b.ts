// Batterie di FASE B (17/10/2026, docs/webapp/bot-correzioni-2026-10-17/PIANO.md B1.3, B2.3, B3.3): 150–200 conversazioni per
// famiglia, multi-turno, sul route vero (stesso formato del banco E). Decisioni 17/10: «elimina / cancella / rimuovi
// completamente / levalo proprio» = eliminare SOLO dopo conferma, «annulla» per 10 minuti; «togli» e «rimuovi» = nascondere;
// categorie nuove senza doppioni e in ordine sensato; spostare e rinominare dalla chat; il vecchio nome resta un alias.
//   b1-elimina          eliminare con conferma, no/annulla, finestra di 10 minuti, rimandi, controlli «togli»
//   b2-categorie        creare categorie (anche con piatti), «la creo?» per quelle implicite, rinominare, niente doppioni
//   b3-sposta-rinomina  spostare piatti tra categorie (anche nuove), rinominare piatti, alias del vecchio nome
import type {Change,Conversation,Family,Turn} from '../types.js'
import {mario} from '../fixtures/menus.js'
const SEC_OF=new Map(mario.menu.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>[i.name,s.name] as [string,string]))))

type In=string|Turn
const T=(s:string):Turn=>({text:s}),Q=(s:string):Turn=>({text:s,q:true}),V=(s:string):Turn=>({voice:s}),W=(m:number):Turn=>({wait:m})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const CR=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const DEL=(dish:string):Change=>({op:'delete',dish}),REN=(dish:string,name:string):Change=>({op:'rename',dish,name}),MV=(dish:string,section:string):Change=>({op:'move',dish,section})
const SEC=(name:string):Change=>({op:'section',name})
const NONE:Change[]=[]
type Extra={ask?:number[],askNoWrite?:boolean,alt?:Change[][],reply?:RegExp,interim?:Change[],note?:string}
export const B_CASES:Conversation[]=[]
let fam:Family='b1-elimina'
const c=(menu:string,turns:In|In[],changes:Change|Change[],x:Extra={})=>{const id=`${fam}-${String(B_CASES.filter(k=>k.family===fam).length+1).padStart(3,'0')}`
 B_CASES.push({id,family:fam,menu,turns:(Array.isArray(turns)?turns:[turns]).map(t=>typeof t==='string'?T(t):t),changes:Array.isArray(changes)?changes:[changes],...x})}
const pick=<X,>(xs:X[],i:number)=>xs[i%xs.length]!
const PP='Piatti di prova'

// ===================== B1 · eliminare con conferma =====================
fam='b1-elimina'
const QA_D=['boh','la parmigiana','tiramisù','pasta al ragù','Che ne sacc','Piatto di verifica']
const MARIO_D:[string,string][]=[['la bruschetta','Bruschetta al pomodoro'],['la lasagna','Lasagna al forno'],['la tagliata','Tagliata di manzo'],['la cotoletta','Cotoletta alla milanese'],['la diavola','Diavola'],['il tiramisù','Tiramisù'],['la panna cotta','Panna cotta'],['il nuovo burger','Nuovo burger']]
const DEL_FORMS=(d:string)=>[`elimina ${d}`,`cancella ${d}`,`elimina definitivamente ${d} dal menu`,`rimuovi completamente ${d}`,`${d} levalo proprio dal menu`,`togli proprio ${d} dal menu`,`cancellami ${d}`,`elimina il piatto ${d}`]
const YES=['sì','si','ok','sì eliminalo','conferma','sì, cancella pure','sì elimina','va bene']
for(let i=0;i<40;i++){const d=pick(QA_D,i),t=pick(DEL_FORMS(d),i);c('qa',[i%3===0?V(t):t,pick(YES,i)],DEL(d),{ask:[1]})}
for(let i=0;i<24;i++){const [w,d]=pick(MARIO_D,i),t=pick(DEL_FORMS(w),i+3);c('mario',[i%4===1?V(t):t,pick(YES,i+2)],DEL(d),{ask:[1]})}
// più piatti nella stessa richiesta
for(let i=0;i<10;i++){const a=pick(QA_D,i),b=pick(QA_D,i+2);c('qa',[pick([`elimina ${a} e ${b}`,`cancella ${a} e ${b}`,`elimina sia ${a} sia ${b}`],i),pick(YES,i)],[DEL(a),DEL(b)],{ask:[1]})}
// no / annulla prima del sì: niente cambia
for(let i=0;i<12;i++){const d=pick(QA_D,i);c('qa',[pick(DEL_FORMS(d),i),pick(['no','no lascia stare','annulla','no, tienilo'],i)],NONE,{ask:[1]})}
// annulla entro 10 minuti dopo l'eliminazione: il piatto torna com'era; dopo 10 minuti no
for(let i=0;i<12;i++){const d=pick(QA_D,i);c('qa',[pick(DEL_FORMS(d),i),'sì',pick(['annulla','annulla l’ultima modifica','rimetti come prima','torna indietro'],i)],NONE,{ask:[1],interim:[DEL(d)]})}
for(let i=0;i<6;i++){const d=pick(QA_D,i);c('qa',[pick(DEL_FORMS(d),i),'sì',W(12),'annulla'],DEL(d),{ask:[1],note:'oltre i 10 minuti: definitiva, «annulla» lo dice'})}
// rimandi col cervello
for(let i=0;i<8;i++){const d=pick(['boh','la parmigiana','tiramisù','pasta al ragù'],i);c('qa',[`nascondi ${d}`,pick(['anzi no, eliminalo proprio','no aspetta, cancellalo','anzi eliminalo del tutto','no, eliminalo'],i),'sì'],DEL(d),{ask:[2],interim:[HI(d)]})}
for(let i=0;i<8;i++){const [a,b]=pick([['la parmigiana','tiramisù'],['boh','pasta al ragù']] as [string,string][],i);c('qa',[`${a} a 15 e ${b} a 15`,pick(['eliminali tutti e due','rimuovi completamente quei due piatti','cancella entrambi','elimina quei due'],i),'sì'],[DEL(a),DEL(b)],{ask:[2],interim:[P(a,15),P(b,15)]})}
// domanda mentre si aspetta il sì: risposta, poi il sì vale ancora
for(let i=0;i<8;i++){const d=pick(QA_D,i);c('qa',[`elimina ${d}`,Q(`${d} quanto costa?`),'sì'],DEL(d),{ask:[1]})}
// controlli: «togli», «rimuovi», «nascondi» = nascondere, mai eliminare
for(let i=0;i<16;i++){const d=pick(QA_D,i);c('qa',pick([`togli ${d}`,`rimuovi ${d}`,`nascondi ${d}`,`leva ${d} dal menu`],i),HI(d))}
// «elimina» di un piatto che non c'è: mai una scrittura
for(let i=0;i<6;i++)c('qa',pick(['elimina la lasagna','cancella il caviale','elimina la pizza margherita'],i),NONE)

// ===================== B2 · categorie =====================
fam='b2-categorie'
const NEWSEC=['Speciali','Primi','Antipasti','Dolci','Bevande','Secondi','Novità','Pizze']
for(let i=0;i<24;i++){const s=pick(NEWSEC,i);c('qa',pick([`crea la categoria ${s.toLowerCase()}`,`aggiungi una categoria ${s.toLowerCase()}`,`crea un'altra categoria che si chiama ${s.toLowerCase()}`,`Ok, adesso devi creare un'altra categoria che si chiama "${s.toLowerCase()}".`,`aggiungi la categoria ${s}`,`crea una nuova categoria ${s.toLowerCase()}`],i),SEC(s))}
const DISH:[string,number][]=[['caviale',150],['pasta al pesto',15],['tiramisù al pistacchio',7],['frittura mista',18],['bruschette miste',8],['polpo alla griglia',19]]
for(let i=0;i<24;i++){const s=pick(NEWSEC,i+1),[n,p]=pick(DISH,i);c('qa',pick([`aggiungi una categoria ${s.toLowerCase()} con il ${n} a ${p}`,`crea la categoria ${s.toLowerCase()} e mettici ${n} a ${p}`,`aggiungi ${n} a ${p} in una categoria nuova che si chiama ${s.toLowerCase()}`,`aggiungi ${n} a ${p} in un'altra categoria, ${s.toLowerCase()}`],i),[SEC(s),CR(n,p,s)])}
// categoria nominata che non c'è: «la creo?», sì → creata col piatto; oppure una categoria esistente
for(let i=0;i<20;i++){const s=pick(NEWSEC,i+2),[n,p]=pick(DISH,i+1);c('qa',[pick([`aggiungi tra i ${s.toLowerCase()} ${n} a ${p}`,`aggiungi ${n} a ${p} nei ${s.toLowerCase()}`,`aggiungi ${n} a ${p} nella categoria ${s.toLowerCase()}`],i),pick(['sì','sì creala','ok','creala'],i)],[SEC(s),CR(n,p,s)],{ask:[1]})}
for(let i=0;i<12;i++){const s=pick(NEWSEC,i+3),[n,p]=pick(DISH,i+2);c('qa',[`aggiungi tra i ${s.toLowerCase()} ${n} a ${p}`,pick(['no, mettilo nei piatti di prova','piatti di prova','nei piatti di prova'],i)],CR(n,p,PP),{ask:[1]})}
// categoria nuova vuota, poi un piatto lì
for(let i=0;i<12;i++){const s=pick(['Primi pasti','Speciali','Fuori menu','Novità'],i),[n,p]=pick(DISH,i);c('qa',[`crea la categoria ${s.toLowerCase()}`,`aggiungi ${n} a ${p} nei ${s.toLowerCase()}`],[SEC(s),CR(n,p,s)])}
// niente doppioni: una categoria che c'è già si usa
for(let i=0;i<12;i++){const s=pick(['primi','secondi','dolci','antipasti','pizze','contorni'],i);c('mario',pick([`crea la categoria ${s}`,`aggiungi una categoria ${s}`],i),NONE,{reply:/c.è già/i})}
for(let i=0;i<8;i++){const s=pick(['primi','dolci','secondi','antipasti'],i),[n,p]=pick(DISH,i);c('mario',`crea la categoria ${s} e mettici ${n} a ${p}`,CR(n,p,s.charAt(0).toUpperCase()+s.slice(1)))}
// rinominare una categoria (i suoi piatti risultano «spostati» nella categoria col nome nuovo)
const RSEC:[string,string,string[]][]=[['Proposte','Speciali',['Nuovo burger','Burger classico']],['Contorni','Verdure',['Patate al forno','Insalata mista']],['Antipasti','Per iniziare',['Bruschetta al pomodoro','Tagliere misto']],['Bibite','Bevande fredde',['Acqua 0,5 l','Coca Cola 33cl','Birra media']]]
for(let i=0;i<16;i++){const [o,n,items]=pick(RSEC,i);c('mario',pick([`rinomina la categoria ${o} in ${n}`,`cambia il nome della categoria ${o.toLowerCase()} in ${n.toLowerCase()}`,`la categoria ${o.toLowerCase()} chiamala ${n.toLowerCase()}`,`rinomina la categoria ${o.toLowerCase()} in ${n}`],i),items.map(d=>MV(d,n.charAt(0).toUpperCase()+n.slice(1).toLowerCase()===n?n:n.charAt(0).toUpperCase()+n.slice(1))))}
// una categoria nuova in un menu con più categorie va in un posto sensato (antipasti prima dei primi, dolci in fondo…)
for(let i=0;i<16;i++){const s=pick(['Insalate','Crudi','Zuppe','Dessert','Grigliate','Fritti','Gelati','Vini'],i);c('mario',pick([`crea la categoria ${s.toLowerCase()}`,`aggiungi una categoria ${s.toLowerCase()}`],i),SEC(s))}
// rinomina verso un nome che c'è già: mai doppioni
for(let i=0;i<6;i++)c('mario',pick(['rinomina la categoria proposte in pizze','rinomina la categoria contorni in primi','la categoria bibite chiamala caffetteria'],i),NONE)

// ===================== B3 · spostare e rinominare piatti =====================
fam='b3-sposta-rinomina'
const MOVES:[string,string,string][]=[['la lasagna','Lasagna al forno','Secondi'],['la bruschetta','Bruschetta al pomodoro','Primi'],['la tagliata','Tagliata di manzo','Antipasti'],['il tiramisù','Tiramisù','Proposte'],['la cotoletta','Cotoletta alla milanese','Primi'],['la diavola','Diavola','Proposte'],['le patate al forno','Patate al forno','Secondi'],['il tagliere misto','Tagliere misto','Secondi']]
for(let i=0;i<40;i++){const [w,d,s]=pick(MOVES,i),sl=s.toLowerCase(),t=pick([`sposta ${w} nei ${sl}`,`sposta ${w} tra i ${sl}`,`${w} spostala nei ${sl}`,`metti ${w} nei ${sl}`,`porta ${w} nei ${sl}`],i+Math.floor(i/8));c('mario',i%3===0?V(t):t,MV(d,s))}
for(let i=0;i<10;i++){const [w1,d1,s]=pick(MOVES,i),[w2,d2]=pick(MOVES,i+3);if(d1===d2)continue;c('mario',`sposta ${w1} e ${w2} nei ${s.toLowerCase()}`,[MV(d1,s),...(SEC_OF.get(d2)!==s?[MV(d2,s)]:[])])}
// verso una categoria che non c'è: «la creo?» → sì
for(let i=0;i<12;i++){const [w,d]=pick(MOVES,i),s=pick(['Speciali','Novità','Fuori menu'],i);c('mario',[`sposta ${w} nei ${s.toLowerCase()}`,pick(['sì','sì creala','ok'],i)],[SEC(s),MV(d,s)],{ask:[1]})}
// rinominare
const RN:[string,string,string][]=[['qa','boh','Bollito misto'],['qa','la parmigiana','Parmigiana di melanzane'],['qa','tiramisù','Tiramisù della casa'],['mario','Diavola','Pizza piccante'],['mario','Tagliere misto','Tagliere del contadino'],['mario','Lasagna al forno','Lasagna della nonna'],['qa','pasta al ragù','Tagliatelle al ragù'],['mario','Panna cotta','Panna cotta ai frutti di bosco']]
const RN_FORMS=(d:string,n:string)=>[`rinomina ${d} in ${n}`,`cambia il nome di ${d} in ${n}`,`${d} chiamalo ${n}`,`${d} da oggi si chiama ${n}`,`cambia il nome del piatto ${d}, mettici ${n}`]
for(let i=0;i<40;i++){const [m,d,n]=pick(RN,i),t=pick(RN_FORMS(m==='mario'?d.toLowerCase():d,n),i+Math.floor(i/8));c(m,i%4===2?V(t):t,REN(d,n))}
// mai un doppione del nome
for(let i=0;i<8;i++){const [m,d,n]=pick([['qa','boh','tiramisù'],['mario','Diavola','Margherita'],['qa','la parmigiana','pasta al ragù'],['mario','Panna cotta','Tiramisù']] as [string,string,string][],i);c(m,`rinomina ${d.toLowerCase()} in ${n}`,NONE,{note:'nome già di un altro piatto: si chiede'})}
// il vecchio nome resta un alias (memoria del ristorante, col cervello)
for(let i=0;i<10;i++){const p=pick([30,25,22,18,27],i);c('qa',['rinomina boh in Bollito misto',pick([`boh costa ${p}`,`metti boh a ${p}`,`boh a ${p}`],i)],[REN('boh','Bollito misto'),P('boh',p)])}
// spostare e cambiare prezzo insieme / domande dopo
for(let i=0;i<8;i++){const [w,d,s]=pick(MOVES,i);c('mario',[`sposta ${w} nei ${s.toLowerCase()}`,Q(`che piatti ho nei ${s.toLowerCase()}?`)],MV(d,s),{reply:new RegExp(d.split(' ')[0]!,'i')})}
// rinomina e sposta con un rimando dopo averne parlato
for(let i=0;i<10;i++){const [w,d,s2]=pick(MOVES,i);c('mario',[`${w} costa 13`,pick([`spostala nei ${s2.toLowerCase()}`,`e mettila nei ${s2.toLowerCase()}`],i)],[P(d,13),MV(d,s2)])}
// annulla dopo uno spostamento o una rinomina
for(let i=0;i<8;i++){const [w,d,s]=pick(MOVES,i);c('mario',[`sposta ${w} nei ${s.toLowerCase()}`,'annulla'],NONE,{interim:[MV(d,s)]})}
for(let i=0;i<6;i++){const [m,d,n]=pick(RN,i);c(m,[`rinomina ${m==='mario'?d.toLowerCase():d} in ${n}`,'annulla'],NONE,{interim:[REN(d,n)]})}
