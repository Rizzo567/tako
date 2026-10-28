// Batterie delle correzioni di FASE A (17/10/2026, docs/webapp/bot-correzioni-2026-10-17/PIANO.md): 150–200 conversazioni per
// famiglia toccata, multi-turno, sul route vero (stesso formato del banco E e dei casi V). Generate da modelli di frase: ogni
// variante è una frase che un titolare può dire o dettare. Runner: tests/eval/eval-fix-a.test.ts (orologio fisso, invarianti).
//   a1-composti   «X e Y» due piatti o uno, risposte con più prezzi, bozza in sospeso corretta
//   a2-prezzi     centesimi solo espliciti, quantità e rimandi («quei due», «tutti e tre») mai prezzi
//   a3-nomi       verbi/cortesia/categorie fuori dal nome, conferme mai come nome
//   a4-validatore una sola categoria, nessuna parte persa, misti modifica+domanda, niente frasi fisse
//   a5-asr        nomi storpiati verso piatti esistenti (con soglia), nessun falso abbinamento
import type {Change,Conversation,Family,Turn} from '../types.js'

type In=string|Turn
const T=(s:string):Turn=>({text:s}),Q=(s:string):Turn=>({text:s,q:true}),V=(s:string):Turn=>({voice:s})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const FE=(dish:string,value=true):Change=>({op:'featured',dish,value}),AV=(dish:string,value=false):Change=>({op:'available',dish,value})
const PR=(dish:string,price:number|null):Change=>({op:'promo',dish,price}),DE=(dish:string,text:string):Change=>({op:'description',dish,text})
const CR=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const NONE:Change[]=[]
type Extra={ask?:number[],askNoWrite?:boolean,alt?:Change[][],reply?:RegExp,interim?:Change[],note?:string}
export const A_CASES:Conversation[]=[]
let fam:Family='a1-composti'
const c=(menu:string,turns:In|In[],changes:Change|Change[],x:Extra={})=>{const id=`${fam}-${String(A_CASES.filter(k=>k.family===fam).length+1).padStart(3,'0')}`
 A_CASES.push({id,family:fam,menu,turns:(Array.isArray(turns)?turns:[turns]).map(t=>typeof t==='string'?T(t):t),changes:Array.isArray(changes)?changes:[changes],...x})}
const PP='Piatti di prova'
const pick=<X,>(xs:X[],i:number)=>xs[i%xs.length]!
const it=(s:string)=>s.replace('.',',')
const W:Record<number,string>={2:'due',7:'sette',8:'otto',9:'nove',10:'dieci',11:'undici',12:'dodici',13:'tredici',14:'quattordici',15:'quindici',18:'diciotto',20:'venti',25:'venticinque'}

// ===================== A1 · «X e Y» e risposte con più prezzi =====================
fam='a1-composti'
const PAIRS_QA:[string,string][]=[['pasta al pesto','lasagna'],['trofie al pesto','polpette al sugo'],['risotto ai funghi','arrosto di vitello'],['gnocchi alla sorrentina','cotoletta'],['insalata di mare','frittura mista'],['crespelle','cannelloni']]
const PAIRS_MARIO:[string,string][]=[['trofie al pesto','polpette al sugo'],['risotto ai funghi','arrosto di vitello'],['crespelle','cannelloni'],['orecchiette al pomodoro','bucatini al tonno']]
const START=(a:string,b:string)=>[`aggiungi ${a} e ${b}`,`Allora aggiungi il piatto ${a} e ${b}.`,`inserisci ${a} e ${b}`,`mi aggiungi ${a} e ${b}`,`aggiungiamo ${a} e ${b}`,`voglio aggiungere ${a} e ${b}`]
const last=(n:string)=>n.split(' ').filter(w=>w.length>=4&&!['pasta','piatto'].includes(w)).at(-1)??n
const TWO_PRICES=(a:string,b:string,pa:number,pb:number)=>[`${it(String(pa))} e ${it(String(pb))}`,`uno a ${it(String(pa))} e uno a ${it(String(pb))}`,`la prima ${it(String(pa))} la seconda ${it(String(pb))}`,`il primo a ${it(String(pa))} e il secondo a ${it(String(pb))}`,`${a} ${it(String(pa))}, ${b} ${it(String(pb))}`,`${b} ${it(String(pb))} e ${a} ${it(String(pa))}`,`Uno deve essere a ${it(String(pa))} euro e uno deve essere a ${it(String(pb))} euro.`,`${it(String(pa))} euro e ${it(String(pb))} euro`,`il ${last(a)} a ${it(String(pa))} e il ${last(b)} a ${it(String(pb))}`,...(W[pa]&&W[pb]?[`${W[pa]} e ${W[pb]}`]:[])]
const PRICES:[number,number][]=[[10,20],[12,9],[8,15],[13.5,11],[7,14],[18,25]]
// 1. due prezzi subito dopo la domanda
for(let i=0;i<72;i++){const [a,b]=pick(PAIRS_QA,i),[pa,pb]=pick(PRICES,i*5+1),start=pick(START(a,b),i),ans=pick(TWO_PRICES(a,b,pa,pb),i*7+i%3)
 c('qa',[i%4===0?V(start):start,i%5===0?V(ans):ans],[CR(a,pa,PP),CR(b,pb,PP)],{ask:[1]})}
// 2. «sono due piatti» poi i prezzi
const TWO_WORDS=(a:string,b:string)=>['No, sono due piatti separati.','sono due piatti','due piatti diversi',`No, ${a} e ${b} sono due piatti separati.`,'sono due','separati']
for(let i=0;i<24;i++){const [a,b]=pick(PAIRS_QA,i+2),[pa,pb]=pick(PRICES,i+3)
 c('qa',[pick(START(a,b),i+1),pick(TWO_WORDS(a,b),i),pick(TWO_PRICES(a,b,pa,pb),i*3+1)],[CR(a,pa,PP),CR(b,pb,PP)],{ask:[1,2]})}
// 3. «uno solo» → un nome composto, poi il prezzo
for(let i=0;i<12;i++){const [a,b]=pick(PAIRS_QA,i),p=pick([15,9,12,22],i)
 c('qa',[pick(START(a,b),i+2),pick(['uno solo','è un piatto unico','un piatto solo','no, è un piatto solo'],i),String(p)],CR(`${a} e ${b}`,p,PP),{ask:[1,2]})}
// 4. un prezzo solo senza dire se sono due: si chiede, poi due prezzi
for(let i=0;i<8;i++){const [a,b]=pick(PAIRS_QA,i+1),[pa,pb]=pick(PRICES,i)
 c('qa',[pick(START(a,b),i),String(pa),`${pa} e ${pb}`],[CR(a,pa,PP),CR(b,pb,PP)],{ask:[1,2]})}
// 5. un piatto solo e due prezzi: domanda, mai 10,01 né scrittura
const ONE_DISH=['aggiungi la lasagna','aggiungi il caviale','aggiungi la frittura mista','aggiungi le crespelle']
const TWO_FOR_ONE=['uno a 10 e uno a 20','10 euro e uno a 20','uno deve essere a 10 euro e uno a 20','Uno deve essere a 12 euro e uno deve essere a 15 euro.']
for(let i=0;i<16;i++)c('qa',[pick(ONE_DISH,i),pick(TWO_FOR_ONE,i+Math.floor(i/4))],NONE,{ask:[1,2]})
// 6. nomi composti veri: nessuna domanda «due piatti?»
const COMPOUNDS:[string,number][]=[['pasta e fagioli',9],['spaghetti cacio e pepe',11],['pane e coperto',2],['pasta e ceci',8],['salsiccia e friarielli',10],['prosciutto e melone',9],['pasta e patate',8],['tagliatelle burro e salvia',12]]
for(let i=0;i<8;i++){const [n,p]=COMPOUNDS[i]!;c('qa',`aggiungi ${n} a ${p}`,CR(n,p,PP))}
for(let i=0;i<8;i++){const [n,p]=COMPOUNDS[i]!;c('qa',[`aggiungi ${n}`,`${p} euro`],CR(n,p,PP),{ask:[1]})}
// 7. più categorie (mario): categoria detta subito o chiesta dopo i prezzi
for(let i=0;i<8;i++){const [a,b]=pick(PAIRS_MARIO,i),[pa,pb]=pick(PRICES,i+2)
 c('mario',[`aggiungi nei primi ${a} e ${b}`,pick(TWO_PRICES(a,b,pa,pb),i)],[CR(a,pa,'Primi'),CR(b,pb,'Primi')],{ask:[1]})}
for(let i=0;i<8;i++){const [a,b]=pick(PAIRS_MARIO,i+1),[pa,pb]=pick(PRICES,i+4)
 c('mario',[`aggiungi ${a} e ${b}`,pick(TWO_PRICES(a,b,pa,pb),i+2),pick(['nei secondi','secondi','mettili nei secondi','tra i secondi'],i)],[CR(a,pa,'Secondi'),CR(b,pb,'Secondi')],{ask:[1,2]})}
// 8. correzione del nome con la bozza in sospeso
const RENAME:[string,string,number][]=[['la lasagna','lasagna verde',13],['il risotto','risotto alla milanese',14],['le crespelle','crespelle ai funghi',11]]
for(let i=0;i<6;i++){const [first,real,p]=pick(RENAME,i)
 c('qa',[`aggiungi ${first}`,pick([`no, intendevo ${real}`,`no scusa, si chiama ${real}`],i),String(p)],CR(real,p,PP),{ask:[1,2]})}
// 9. due nomi e due prezzi nello stesso messaggio
for(let i=0;i<8;i++){const [a,b]=pick(PAIRS_QA,i),[pa,pb]=pick(PRICES,i+1)
 c('qa',`aggiungi ${a} e ${b} a ${it(String(pa))} e ${it(String(pb))}${i%2?' euro':''}`,[CR(a,pa,PP),CR(b,pb,PP)])}

// 10. bozza in sospeso e una domanda in mezzo (va al cervello con la bozza nel contesto, A1.1): la bozza resta e si completa
const MID=[Q('quanto costa il tiramisù?'),Q('aspetta, quanto costa la parmigiana?'),Q('che piatti ho?'),Q('boh quanto costa?')]
for(let i=0;i<8;i++){const n=pick(['lasagna','caviale','frittura mista','crespelle'],i),p=pick([20,150,14,11],i);c('qa',[`aggiungi ${n}`,pick(MID,i),`${p}`],CR(n,p,PP),{ask:[1]})}

// ===================== A2 · prezzi mai inventati =====================
fam='a2-prezzi'
const QA_D=['la parmigiana','tiramisù','boh','pasta al ragù']
const CENTS:[number,number][]=[[12,50],[6,50],[10,20],[14,90],[8,30]]
const CENT_FORMS=(d:string,n:number,m:number)=>[`${d} costa ${n} e ${m}`,`${d} a ${n} euro e ${m}`,`${d} costa ${W[n]??n} e ${m===50?'cinquanta':m===20?'venti':m===90?'novanta':m===30?'trenta':m}`,`${d} a ${n},${m}`,`metti ${d} a ${n} euro e ${m} centesimi`,`${d} a ${n} euro e ${m}, grazie`]
for(let i=0;i<36;i++){const d=pick(QA_D,i),[n,m]=pick(CENTS,i+Math.floor(i/4)),t=pick(CENT_FORMS(d,n,m),i);c('qa',i%3===0?V(t):t,P(d,n+m/100))}
// «… euro e uno»: mai 20,01
const NEWD=['lasagna','caviale','frittura mista','crespelle']
for(let i=0;i<8;i++){const n=pick(NEWD,i),p=pick([20,15,12,9],i);c('qa',`aggiungi ${n} a ${p} euro e uno`,CR(n,p,PP),{alt:[NONE]})}
for(let i=0;i<8;i++){const d=pick(QA_D,i),p=pick([11,14,16,9],i);c('qa',`${d} a ${p} euro e uno lo togli dopo`,P(d,p),{alt:[NONE],note:'«e uno» non è un centesimo'})}
// quantità e rimandi: «quei due», «entrambi», «tutti e tre» non sono prezzi
const PAIRQ:[string,string][]=[['la parmigiana','tiramisù'],['boh','pasta al ragù'],['tiramisù','boh'],['pasta al ragù','la parmigiana']]
const DEIX_TWO:[string,(a:string)=>Change][]=[['nascondi quei due',d=>HI(d)],['nascondi tutti e due',d=>HI(d)],['nascondi entrambi',d=>HI(d)],['metti in evidenza quei due piatti',d=>FE(d)],['quei due mettili in evidenza',d=>FE(d)],['nascondi questi due',d=>HI(d)],['mettili entrambi in evidenza',d=>FE(d)],['tutti e due sono finiti',d=>AV(d)]]
const PP2:[number,number][]=[[15,15],[12,7],[9,11],[14,16]]
for(let i=0;i<24;i++){const [a,b]=pick(PAIRQ,i),[pa,pb]=pick(PP2,i+1),[t2,mk]=pick(DEIX_TWO,i)
 c('qa',[`${a} a ${pa} e ${b} a ${pb}`,i%4===1?V(t2):t2],[P(a,pa),P(b,pb),mk(a),mk(b)].filter(x=>!(x.op==='price'&&x.price===({'la parmigiana':10,'tiramisù':6,'boh':20,'pasta al ragù':12} as any)[x.dish])))}
for(let i=0;i<24;i++){const [a,b]=pick(PAIRQ,i+1),[pa,pb]=pick(PP2,i+2),[t2,mk]=pick(DEIX_TWO,i+3)
 c('qa',[`${a} costa ${pa}`,`${b} costa ${pb}`,t2],[P(a,pa),P(b,pb),mk(a),mk(b)].filter(x=>!(x.op==='price'&&x.price===({'la parmigiana':10,'tiramisù':6,'boh':20,'pasta al ragù':12} as any)[x.dish])))}
for(let i=0;i<8;i++){c('qa',['la parmigiana costa 12','il tiramisù costa 7',`boh costa ${pick([25,22,18,30],i)}`,pick(['nascondi tutti e tre','nascondili tutti e tre','metti in evidenza tutti e tre','tutti e tre in evidenza'],i)],[P('la parmigiana',12),P('tiramisù',7),P('boh',pick([25,22,18,30],i)),...(i%4<2?[HI('la parmigiana'),HI('tiramisù'),HI('boh')]:[FE('la parmigiana'),FE('tiramisù'),FE('boh')])])}
for(let i=0;i<12;i++){const [a,b]=pick(PAIRQ,i),p=pick([9,13,8,16],i);c('qa',[Q(`quanto costano ${a} e ${b}?`),pick([`mettili tutti e due a ${p}`,`mettili entrambi a ${p}`,`tutti e due a ${p}`],i)],[P(a,p),P(b,p)])}
for(let i=0;i<8;i++){const p=pick([11,9,14,13],i);c('qa',['la parmigiana costa 12','il tiramisù costa 7',pick([`il primo mettilo a ${p}`,`la prima mettila a ${p}`,`l'ultimo mettilo a ${p}`,`l'ultimo a ${p}`],i)],i%4<2?[P('la parmigiana',p),P('tiramisù',7)]:[P('la parmigiana',12),P('tiramisù',p)],{interim:i%4<2?[P('la parmigiana',12)]:[P('tiramisù',7)]})}
// un piatto e due prezzi alternativi: si chiede
for(let i=0;i<8;i++){const d=pick(QA_D,i);c('qa',`${d} a ${pick([10,12,14,9],i)} o ${pick([12,13,16,11],i)}`,NONE,{ask:[1]})}
// «in una categoria», «un altro piatto»: nessun prezzo 1
for(let i=0;i<8;i++){const n=pick(NEWD,i),p=pick([150,15,22,9],i);c('qa',pick([`aggiungi ${n} a ${p} in una categoria nuova`,`aggiungi ${n} a ${p} in un'altra categoria`],i),NONE,{ask:[1],note:'categoria nuova: fase B; intanto domanda, mai prezzo 1'})}
for(let i=0;i<8;i++){const [a,b]=pick(PAIRQ,i),p=pick([13,15,9,11],i);c('qa',[`${a} costa ${p}`,`e ${b.replace(/^(la|il) /,'')} uguale`],[P(a,p),P(b,p)])}

// «metti X e Y a 10 e 20»: due prezzi in ordine, anche se uno non cambia (mai 10,20)
for(let i=0;i<8;i++){const [a,b]=pick(PAIRQ,i),[pa,pb]=pick([[14,9],[11,16],[13,7],[8,18]] as [number,number][],i);c('qa',pick([`metti ${a} e ${b} a ${pa} e ${pb} euro`,`${a} e ${b} a ${pa} e ${pb}`],i),[P(a,pa),P(b,pb)])}

// ===================== A3 · nomi del piatto puliti =====================
fam='a3-nomi'
const NAMES=['pasta alla norma','lasagna verde','tagliolini al tartufo','ravioli di ricotta','bucatini al tonno']
const FORMS_PRIMI=(n:string,p:number)=>[`Inserisce il piatto ${n} a ${p} euro nei primi`,`mi aggiungi per favore ${n} a ${p} nei primi?`,`voglio aggiungere il piatto ${n} a ${p} nei primi`,`puoi aggiungere un piatto che si chiama ${n} a ${p} nei primi`,`aggiungere il piatto ${n} a ${p} nei primi`,`inserisci per cortesia ${n} a ${p} euro nei primi`,`potresti inserire ${n} a ${p} nei primi per favore`,`aggiungi gentilmente ${n} nei primi a ${p}`]
for(let i=0;i<40;i++){const n=pick(NAMES,i),p=pick([12,13,11,14,10],i+Math.floor(i/5)),t=pick(FORMS_PRIMI(n,p),i);c('mario',i%3===0?V(t):t,CR(n,p,'Primi'))}
const FORMS_QA=(n:string,p:number)=>[`Inserisce il piatto ${n} a ${p} euro`,`mi aggiungi per favore ${n} a ${p}?`,`voglio aggiungere il piatto ${n} a ${p}`,`puoi aggiungere un piatto che si chiama ${n} a ${p}`,`aggiungere il piatto ${n} a ${p}`,`inserisci per cortesia ${n} a ${p} euro`,`potresti inserire ${n} a ${p} per favore`,`aggiungi gentilmente ${n} a ${p}`]
for(let i=0;i<32;i++){const n=pick(NAMES,i+2),p=pick([12,15,9,20],i),t=pick(FORMS_QA(n,p),i);c('qa',i%4===2?V(t):t,CR(n,p,PP))}
// categoria che non c'è: il nome resta pulito, si chiede dove metterlo
const UNK=(n:string,p:number)=>[`aggiungi ${n} a ${p} nei primi pasti`,`aggiungi ${n} a ${p} nei primi`,`aggiungi tra i secondi ${n} a ${p}`,`aggiungi ${n} a ${p} in una categoria nuova che si chiama speciali`,`aggiungi ${n} a ${p} nella categoria dolci`,`aggiungi la ${n} a ${p} tra i primi`]
const WHERE=['nei piatti di prova','piatti di prova','mettilo nei piatti di prova','va bene, nei piatti di prova']
// Fase B (17/10): «in una categoria nuova che si chiama speciali» la crea subito (è chiesta); le altre si chiedono.
for(let i=0;i<30;i++){const n=pick(NAMES,i),p=pick([12,15,9,20,11],i+1),t=pick(UNK(n,p),i);if(/categoria nuova che si chiama/.test(t))c('qa',t,CR(n,p,'Speciali'));else c('qa',[t,pick(WHERE,i)],CR(n,p,PP),{ask:[1]})}
// conferme mai come nome. Fase B (17/10): il «sì» alla domanda «la creo?» crea la categoria e ci mette il piatto col SUO nome.
const YES=['sì creala','ok','sì','vai','creala','sì, crea pure']
for(let i=0;i<24;i++){const n=pick(NAMES,i+1),p=pick([12,15,9,20],i);c('qa',[`aggiungi tra i primi ${n} a ${p}`,pick(YES,i)],CR(n,p,'Primi'),{ask:[1]})}
for(let i=0;i<8;i++){const n=pick(NAMES,i);c('qa',['aggiungi un piatto a 12',pick(['ok','sì','vai','va bene'],i),n],CR(n,12,PP),{ask:[1,2]})}
// mario: altre categorie esistenti
const SEC:[string,string][]=[['tra i dolci','Dolci'],['nei secondi','Secondi'],['negli antipasti','Antipasti'],['nei contorni','Contorni']]
const OTHER=['torta della nonna','grigliata di carne','crostini misti','verdure grigliate']
for(let i=0;i<16;i++){const [w,s]=pick(SEC,i),n=OTHER[SEC.findIndex(x=>x[1]===s)]!,p=pick([6,16,8,5],i);c('mario',pick([`Inserisce il piatto ${n} ${w} a ${p} euro`,`mi aggiungi per favore ${w} ${n} a ${p}`,`voglio aggiungere ${n} a ${p} ${w}`,`aggiungere ${w} il piatto ${n} che costa ${p} euro`],i),CR(n,p,s))}
// nome composto con cortesia
for(let i=0;i<6;i++){const [n,p]=pick([['pasta e fagioli alla napoletana',10],['spaghetti cacio e pepe',11],['tagliatelle burro e salvia',12]] as [string,number][],i);c('mario',pick([`mi aggiungi per favore ${n} a ${p} nei primi`,`Inserisce il piatto ${n} a ${p} euro nei primi`],i),CR(n,p,'Primi'))}

// ===================== A4 · validatore e copy =====================
fam='a4-validatore'
// 1. una sola categoria: mai «in quale categoria?»; più piatti nello stesso messaggio, nessuno perso
const NEW3:[string,number][]=[['pasta al pesto',15],['caviale',150],['lasagna',20],['polpette',9],['trofie al pesto',13],['frittura mista',18],['crespelle',11],['arrosto di vitello',16]]
for(let i=0;i<16;i++){const a=pick(NEW3,i),b=pick(NEW3,i+3),t=pick([`aggiungi ${a[0]} a ${a[1]}`,`E aggiungi ${a[0]} a ${a[1]} euro.`,`inserisci ${a[0]} a ${a[1]} euro`,`aggiungi il piatto ${a[0]} che costa ${a[1]} euro`],i);c('qa',i%3===0?V(t):t,CR(a[0],a[1],PP));void b}
for(let i=0;i<16;i++){const a=pick(NEW3,i),b=pick(NEW3,i+2),d=pick(NEW3,i+5),t=pick([`E aggiungi ${a[0]} a ${a[1]} euro, aggiungi ${b[0]} a ${b[1]} euro, aggiungi ${d[0]} a ${d[1]} euro.`,`aggiungi ${a[0]} a ${a[1]}, ${b[0]} a ${b[1]} e ${d[0]} a ${d[1]}`],i);c('qa',i%2===0?V(t):t,[CR(a[0],a[1],PP),CR(b[0],b[1],PP),CR(d[0],d[1],PP)])}
// piatto già nel menu dentro un'aggiunta multipla: prezzo diverso = cambio di prezzo, uguale = lo dice; le altre parti restano
for(let i=0;i<12;i++){const a=pick(NEW3,i+1),b=pick(NEW3,i+4),p=pick([10,14,9,11],i),t=`E aggiungi pasta al ragù a ${p} euro, aggiungi ${a[0]} a ${a[1]} euro, aggiungi ${b[0]} a ${b[1]} euro.`;c('qa',i%2?V(t):t,NONE,{ask:[1],alt:[[CR(a[0],a[1],PP),CR(b[0],b[1],PP)]],note:'R5.1 (nota 62): il ragù c\'è già → domanda breve, nessuna scrittura sul ragù; le parti chiare aspettano la risposta (accettato anche pubblicarle)'})}
for(let i=0;i<8;i++){const a=pick(NEW3,i+2),b=pick(NEW3,i+6);c('qa',`aggiungi pasta al ragù a 12, ${a[0]} a ${a[1]} e ${b[0]} a ${b[1]}`,[CR(a[0],a[1],PP),CR(b[0],b[1],PP)])}
// 2. modifica + domanda nello stesso messaggio: fa la modifica e risponde
const PRQ:Record<string,number>={'la parmigiana':10,'tiramisù':6,'boh':20,'pasta al ragù':12}
const DQ=Object.keys(PRQ)
for(let i=0;i<12;i++){const a=pick(DQ,i),b=pick(DQ,i+1),p=pick([12,14,9,16],i);c('qa',pick([`metti ${a} a ${p} e dimmi quanto costa ${b}`,`metti ${a} a ${p}, quanto costa ${b}?`,`${a} a ${p} e dimmi quanto costa ${b}`],i),P(a,p),{reply:new RegExp(String(PRQ[b]))})}
for(let i=0;i<8;i++){const a=pick(DQ,i);c('qa',pick([`${a} è finita, cosa altro è finito?`,`${a} è finito, cos'altro è finito?`],i),AV(a),{reply:new RegExp(a.split(' ').at(-1)!,'i')})}
for(let i=0;i<8;i++){const a=pick(DQ,i);c('qa',pick([`Ciao cosa sai fare? intanto nascondi ${a}`,`cosa sai fare? intanto nascondi ${a}`],i),HI(a))}
for(let i=0;i<8;i++){const a=pick(DQ,i),p=pick([7,15,25,13],i);c('qa',`${a} costa ancora ${PRQ[a]}? se sì mettilo a ${p}`,P(a,p))}
for(let i=0;i<4;i++){const a=pick(DQ,i),p=pick([7,15,25,13],i);c('qa',`${a} costa ancora ${PRQ[a]!+1}? se sì mettilo a ${p}`,NONE,{note:'condizione falsa: risponde col prezzo vero, non scrive'})}
for(let i=0;i<8;i++){const a=pick(DQ,i);c('qa',pick([`nascondi ${a} e dimmi quali piatti sono nascosti`,`nascondi ${a}, quali piatti sono nascosti?`],i),HI(a),{reply:new RegExp(a.split(' ').at(-1)!,'i')})}
// 3. «la X no» con un riepilogo in attesa: la toglie davvero, l'ok pubblica il resto
const HIDE4=['boh','la parmigiana','tiramisù','pasta al ragù']
for(let i=0;i<12;i++){const skip=HIDE4[i%4]!;c('qa',[`nascondi ${HIDE4.join(', ').replace(/, ([^,]+)$/,' e $1')}`,pick([`${skip} no`,`${skip} lascialo stare`,`no, ${skip} no`],i),'ok'],HIDE4.filter(d=>d!==skip).map(d=>HI(d)),{note:'4 modifiche = riepilogo con OK (deterministico)'})}
// 4. domande del bot senza frasi fisse né esempi inventati
for(let i=0;i<10;i++)c('qa',pick(['aggiungi lasagna','aggiungi il caviale','aggiungi la frittura mista','aggiungi crespelle','aggiungi un piatto'],i),NONE,{ask:[1]})
for(let i=0;i<10;i++)c('mario',pick(['aggiungi pasta al pesto a 13','aggiungi la frittura mista a 18','aggiungi le crespelle a 11','aggiungi trofie a 12','aggiungi il tiramisù al pistacchio a 6'],i),NONE,{ask:[1]})
// 5. rimando vago con una cronologia recente: la domanda cita il piatto, mai «non ho una richiesta recente»
for(let i=0;i<16;i++){const a=pick(DQ,i),p=pick([12,14,9,16],i);c('qa',[`${a} costa ${p}`,pick(['cambialo','mettilo','fallo','cambiamelo'],i)],[P(a,p)].filter(x=>x.price!==PRQ[a]),{ask:[2]})}
// 6. una categoria sola anche per il cervello (aggiunta dopo un'altra modifica)
for(let i=0;i<8;i++){const a=pick(NEW3,i);c('qa',['nascondi boh',`e aggiungi anche ${a[0]} a ${a[1]}`],[HI('boh'),CR(a[0],a[1],PP)])}

// ===================== A5 · nomi storpiati dalla trascrizione =====================
fam='a5-asr'
const PR5=[12,14,9,16,22,7]
// forte: il suono è chiaramente quello di un piatto → direttamente
const STRONG_QA:[string,string][]=[['nel kenesac metti la promo a {p} euro','promo'],['il kenesac costa {p}','price'],['kenesak a {p} euro','price'],['che nesac costa {p}','price'],['nel piatto kenesac metti il prezzo a {p}','price'],['metti il kenesac a {p}','price']]
for(let i=0;i<24;i++){const [t,op]=pick(STRONG_QA,i),p=pick(PR5,i);c('qa',V(t.replace('{p}',String(p))),op==='promo'?PR('Che ne sacc',p):P('Che ne sacc',p))}
const STRONG_OTHER:[string,string,string][]=[['pizzeria','la marinera a {p}','Marinara'],['pizzeria','la bufalino costa {p}','Bufalina'],['pizzeria','il babbà a {p} euro','Babà'],['pizzeria','la sfogliatela costa {p}','Sfogliatella'],['bar','lo spriz aperol a {p}','Spritz Aperol'],['bar','il ginsen costa {p}','Ginseng'],['bar','il negrone a {p}','Negroni'],['romana','la matriciana a {p}','Amatriciana'],['mario','la margarita a {p}','Margherita'],['mario','il capuccino costa {p}','Cappuccino'],['mario','la capriciosa a {p}','Capricciosa'],['romana','le puntarele costano {p}','Puntarelle']]
const CHEAP=new Set(['Ginseng','Cappuccino','Babà','Sfogliatella'])
for(let i=0;i<48;i++){const [m,t,d]=pick(STRONG_OTHER,i),p=CHEAP.has(d)?pick([2.5,3.5,5,5.5],i):pick([13,14,16,17,18,19,21],i+Math.floor(i/12));c(m,V(t.replace('{p}',String(p).replace('.',','))),P(d,p))}
// debole: si chiede «intendi X?», il «sì» completa
const WEAK_QA:[string,string][]=[['Bu costa {p} euro','boh'],['Bu a {p}','boh'],['il bu costa {p}','boh'],['il piatto bu costa {p}','boh']]
// «bò», «il piatto bo»: la stessa parola del nome (accento a parte) vale come nominato, come oggi
for(let i=0;i<8;i++){const p=pick([40,25,30,15],i);c('qa',V(pick(['bò a {p} euro','il piatto bo mettilo a {p}','bo costa {p}','il bò a {p}'],i).replace('{p}',String(p))),P('boh',p))}
for(let i=0;i<16;i++){const [t,d]=pick(WEAK_QA,i),p=pick([40,25,30,15],i);c('qa',[V(t.replace('{p}',String(p))),pick(['sì','si','esatto','sì quello'],i)],P(d,p),{ask:[1]})}
// «Passa il ragù», «parmiggiana», «tiramisu»: già oggi riconosciuti, non devono peggiorare
const NEAR:[string,string][]=[['Passa il ragù, metti prezzo a {p} euro.','pasta al ragù'],['la parmiggiana a {p}','la parmigiana'],['il tiramisu a {p}','tiramisù'],['la parmiciana costa {p}','la parmigiana'],['il tiramisú costa {p}','tiramisù']]
for(let i=0;i<15;i++){const [t,d]=pick(NEAR,i),p=pick([11,7,13],i);c('qa',V(t.replace('{p}',String(p))),P(d,p))}
// due nomi storpiati nello stesso vocale
for(let i=0;i<8;i++){const p=pick([12,18,9,14],i);c('qa',V(`Allora nel piatto Bo cambia la descrizione e metti ${pick(['Joe fa schifo','piatto della casa','novità di oggi','solo a pranzo'],i)}, invece nel piatto Kenesac metti la promo a ${p} euro.`),[DE('boh',pick(['Joe fa schifo','piatto della casa','novità di oggi','solo a pranzo'],i)),PR('Che ne sacc',p)])}
// nessun falso abbinamento: parole che non sono piatti del menu → mai una scrittura
const FALSE:[string,string][]=[['qa','la lasagna costa 12'],['qa','la pasta al pesto costa 9'],['qa','il caviale è finito'],['qa','la bistecca a 18'],['mario','la costata è finita'],['mario','il burger vegano costa 12'],['pizzeria','la napoletana a 7'],['pizzeria','le patatine a 3'],['bar','il mojito a 7'],['bar','lo spritz hugo a 6'],['romana','la amatriciana bianca costa 12'],['romana','il cornetto a 2'],['qa','la bruschetta a 5'],['qa','il polpo costa 16'],['mario','la quattro stagioni a 9'],['pizzeria','la calzone a 8']]
for(let i=0;i<32;i++){const [m,t]=pick(FALSE,i);c(m,i%2?V(t):t,NONE,{note:'nessun piatto con quel suono: domanda o «non trovo», mai una scrittura'})}
