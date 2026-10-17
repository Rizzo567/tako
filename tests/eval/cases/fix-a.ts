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
for(let i=0;i<30;i++){const n=pick(NAMES,i),p=pick([12,15,9,20,11],i+1);c('qa',[pick(UNK(n,p),i),pick(WHERE,i)],CR(n,p,PP),{ask:[1]})}
// conferme mai come nome
const YES=['sì creala','ok','sì','vai','creala','sì, crea pure']
for(let i=0;i<24;i++){const n=pick(NAMES,i+1),p=pick([12,15,9,20],i);c('qa',[`aggiungi tra i primi ${n} a ${p}`,pick(YES,i),pick(WHERE,i+1)],CR(n,p,PP),{ask:[1,2]})}
for(let i=0;i<8;i++){const n=pick(NAMES,i);c('qa',['aggiungi un piatto a 12',pick(['ok','sì','vai','va bene'],i),n],CR(n,12,PP),{ask:[1,2]})}
// mario: altre categorie esistenti
const SEC:[string,string][]=[['tra i dolci','Dolci'],['nei secondi','Secondi'],['negli antipasti','Antipasti'],['nei contorni','Contorni']]
const OTHER=['torta della nonna','grigliata di carne','crostini misti','verdure grigliate']
for(let i=0;i<16;i++){const [w,s]=pick(SEC,i),n=OTHER[SEC.findIndex(x=>x[1]===s)]!,p=pick([6,16,8,5],i);c('mario',pick([`Inserisce il piatto ${n} ${w} a ${p} euro`,`mi aggiungi per favore ${w} ${n} a ${p}`,`voglio aggiungere ${n} a ${p} ${w}`,`aggiungere ${w} il piatto ${n} che costa ${p} euro`],i),CR(n,p,s))}
// nome composto con cortesia
for(let i=0;i<6;i++){const [n,p]=pick([['pasta e fagioli alla napoletana',10],['spaghetti cacio e pepe',11],['tagliatelle burro e salvia',12]] as [string,number][],i);c('mario',pick([`mi aggiungi per favore ${n} a ${p} nei primi`,`Inserisce il piatto ${n} a ${p} euro nei primi`],i),CR(n,p,'Primi'))}
