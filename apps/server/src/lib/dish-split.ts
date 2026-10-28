/** 23/10/2026 (Victoria Bar, decisione Manuel «divisione dei piatti con la e»): «nei secondi nodino con burro e salvia e coppa» = DUE
 * piatti (Nodino con burro e salvia, Coppa); «nei contorni insalata, funghi misti e peperoni» = Insalata, Funghi misti, Peperoni.
 * La «e» è sia dentro un nome («burro e salvia», «pasta e fagioli», «aglio olio e peperoncino») sia separatore di elenco.
 * Modulo PURO (niente DB, rete, modello). Ordine di decisione per ogni «e»/«ed» fra due pezzi senza punteggiatura:
 *  1. regola imparata dal locale (correzione o risposta «1/2») → vince sempre;
 *  2. locuzione nota (lista curata qui sotto) → la «e» resta nel nome;
 *  3. lessico del locale (nomi in carta/menu, storico, eliminati): il pezzo prima o dopo è per intero un piatto conosciuto → si divide;
 *  4. indizi certi: dopo una locuzione chiusa la «e» separa; nei Contorni ogni ortaggio/contorno semplice è un piatto a sé; «con …»
 *     tiene unito il pezzo che segue (la prima «e» dopo «con»); una parola che apre un piatto (2+ parole o piatto «da solo») separa;
 *     un ingrediente da solo («… e peperoncino», «… e speck») resta nel nome;
 *  5. nome conosciuto che contiene la «e» (es. «Tagliatelle panna, speck e zucchine») → resta;
 *  6. altrimenti DUBBIO: chi può chiedere chiede in una riga («"funghi misti e peperoni": 1 piatto o 2?»), chi non può usa l'ipotesi
 *     (si divide se dopo la «e» comincia una parola da piatto/ortaggio, altrimenti resta unito). */
import {plain,type MenuRef,type SectionRef,type MenuAction} from './twilio-menu-ai.js'

/** Regola imparata per locale: `split` = quel pezzo sono più piatti (`parts`, chiavi), `join` = è un piatto solo. Chiavi = parole «piane». */
export type SplitRule={phrase:string,kind:'split'|'join',parts:string[]}
/** Lessico del locale: nomi conosciuti (attuali + storico) e regole imparate. */
export type Lexicon={names:string[],rules:SplitRule[]}
export type SplitCtx={lexicon?:Lexicon|null,section?:string|null}
export type AndVerdict='keep'|'split'|'doubt'

// ---------- liste curate ----------
export const LOCUTIONS=['pasta e fagioli','pasta e ceci','pasta e patate','pasta e lenticchie','pasta e piselli','pasta e broccoli','pasta e zucca','pasta e cavolfiore','riso e piselli','riso e patate','pane e coperto','pane e burro','pane e olio','pane e pomodoro','salsiccia e friarielli','friarielli e salsiccia','prosciutto e melone','prosciutto e fichi','fichi e prosciutto','prosciutto e funghi','prosciutto e mozzarella','prosciutto e piselli','piselli e prosciutto','panna e prosciutto','salumi e formaggi','formaggi e salumi','affettati e formaggi','prosciutto e panna','cacio e pepe','cacio e uova','burro e salvia','burro e parmigiano','burro e alici','burro e acciughe','sale e pepe','pepe e limone','olio e limone','olio e sale','aglio olio e peperoncino','aglio e olio','olio e aglio','rucola e grana','rucola e parmigiano','pomodoro e basilico','pomodorini e basilico','pomodoro e mozzarella','mozzarella e pomodoro','pomodorini e burrata','pistacchio e burrata','panna e speck','speck e panna','speck e zucchine','zucchine e speck','zucchine e gamberi','gamberi e zucchine','zucchine e gamberetti','gamberetti e zucchine','salmone e zucchine','cozze e vongole','vongole e cozze','vongole e pomodorini','cozze e pecorino','funghi e salsiccia','salsiccia e funghi','zucca e salsiccia','salsiccia e zucca','zucca e speck','radicchio e speck','radicchio e gorgonzola','pere e gorgonzola','pere e formaggio','noci e gorgonzola','gorgonzola e noci','spinaci e ricotta','ricotta e spinaci','patate e cozze','patate e provola','provola e patate','patate e rosmarino','cime di rapa e salsiccia','broccoli e salsiccia','tonno e cipolla','tonno e cipolle','fagioli e cotiche','ceci e baccala','baccala e ceci','uova e tartufo','guanciale e pecorino','carciofi e guanciale','lardo e miele','miele e noci','mortadella e pistacchio','crema e amarene','panna e fragole','fragole e panna','crema e cioccolato','nutella e mascarpone','mele e cannella','pere e cioccolato','bacon e uova','uova e bacon','pepe e pecorino','limone e pepe']
/** Ingredienti che da soli dopo una «e» restano nel nome («… olio e peperoncino», «tagliatelle panna e speck»). */
const INGREDIENT=new Set(['pepe','sale','salvia','basilico','peperoncino','prezzemolo','rosmarino','origano','timo','limone','lime','aglio','olio','burro','grana','parmigiano','pecorino','ricotta','gorgonzola','provola','scamorza','stracciatella','burrata','rucola','speck','guanciale','pancetta','panna','ceci','fagioli','piselli','lenticchie','pomodorini','pomodoro','zafferano','tartufo','pistacchio','pistacchi','noci','pinoli','mandorle','nocciole','miele','menta','capperi','olive','acciughe','alici','bottarga','vongole','cozze','gamberi','gamberetti','scampi','tonno','uova','uovo','mozzarella','bufala','pesto','ragu','zucca','cipolla','finocchietto','mascarpone','cioccolato','crema','amarene','fragole','lamponi','caramello','cannella','granella','pecorino','taleggio','fontina','mortadella','salmone','tonno','limoni','arancia','cotiche','friarielli','cime','rapa','zenzero','curry','soia','sesamo','avocado','philadelphia','nduja','zola','bacon','prosciutto','cotto','crudo','funghetti','porcini','tartufato','carciofini'])
/** Piatti che stanno in piedi da soli: dopo una «e», anche come parola unica, sono un piatto a parte. */
const STANDALONE=new Set(['coppa','bresaola','salame','salami','mortadella','culatello','tagliere','tiramisu','cannoli','cannolo','macedonia','gelato','gelati','sorbetto','affogato','pannacotta','cheesecake','crostata','torta','baba','profiteroles','semifreddo','caprese','bruschetta','bruschette','parmigiana','lasagna','lasagne','carbonara','amatriciana','gricia','frittata','polpette','cotoletta','tagliata','arrosto','spezzatino','involtini','hamburger','bistecca','nodino','filetto','orata','branzino','minestrone','insalatona','carpaccio','risotto','spaghetti','linguine','tagliatelle','pappardelle','fettuccine','penne','fusilli','rigatoni','paccheri','tortellini','tortelloni','ravioli','gnocchi','orecchiette','trofie','bucatini','tortiglioni','cannelloni','maccheroni','scaloppine','scaloppina','grigliata','frittura','calzone','pizza','focaccia','piadina','panino','tramezzino','cornetto','brioche','suppli','arancini','arancine','crocchette','olive ascolane','vitello','stinco','cotolette','braciola','braciole','ossobuco','trippa','baccala','seppie','polpo','calamari','frittelle','zuppa','vellutata','minestra','crespelle','sformato','flan','quiche','strudel','cantucci','biscotti','mousse','zabaione','zeppole','sfogliatella','pastiera','cassata','bignè','bigne'])
/** Piatti da soli di due parole («tiramisù e panna cotta»). */
const STANDALONE2=new Set(['panna cotta','vitello tonnato','olive ascolane','crema catalana','zuppa inglese','torta della','fiori di','fritto misto','insalata russa','parmigiana di'])
/** Ortaggi/contorni semplici: nella sezione Contorni ognuno è un piatto a sé; altrove, da soli dopo una «e», sono un dubbio. */
const CONTORNO=new Set(['patate','patatine','insalata','insalatina','verdure','verdura','fagiolini','piselli','carote','cipolle','cipolline','cavolo','cavolfiore','broccoli','friarielli','bietole','erbette','scarola','radicchio','asparagi','porri','zucca','puree','pure','caponata','peperonata','pomodori','funghi','zucchine','melanzane','peperoni','spinaci','carciofi','cime','cicoria','finocchi','ceci','fagioli','lenticchie','polenta','rucola','misticanza','songino','valeriana','legumi','champignon','topinambur','barbabietole','cavoletti','cicorietta','agretti','fave'])
/** Parole che aprono il nome di un piatto (portate comuni). */
const HEADW=new Set(['pasta','riso','risotto','minestra','zuppa','vellutata','insalata','pollo','salsiccia','salsicce','patate','patatine','funghi','zucchine','melanzane','peperoni','spinaci','carciofi','fritto','tagliere','petto','coscia','cosce','fesa','lombata','costine','costolette','alette','spiedini','spiedino','pesce','gamberoni','scampi','salmone','tonno','pizza','pizze','focaccia','torta','crostata','gelato','dolce','sorbetto'])
const KS=new Set(['al','alla','alle','allo','ai','agli','all','di','del','della','dei','degli','delle','dello','dell','con','in','il','la','lo','le','i','gli','l','un','una','uno','da','sul','sulla','sui','su','a','d','nei','negli','nelle','nel','nella','nello','sugli','sulle','dai','dagli','dalle','dal','dalla','per','tra','fra'])
/** Parole di raccordo dei messaggi (anche vocali) che non sono mai parte di un nome: fuori da L/R. */
const SOFT=new Set(['poi','anche','pure','mentre','invece','allora','quindi','ok','adesso','ora','inoltre','infine','oggi','stasera','metti','mettiamo','mettici','inserisci','aggiungi','inseriamo','aggiungiamo','ci','va','vanno','sono','abbiamo','c','ce','e','ed','tipo','cioe','ehm','eh','dai','grazie'])
/** Sezione dei contorni (lì ogni ortaggio/contorno semplice è un piatto a sé). */
export const isContorniSection=(name:string|null|undefined)=>!!name&&CONTORNI_SEC.test(plain(name))
export const isContornoWord=(w:string)=>CONTORNO.has(w)
/** 28/10 sera: parola che è un piatto da sola («tagliata», «orata», «nodino»): indizio di confine, solo per le proposte da confermare. */
export const isStandaloneWord=(w:string)=>STANDALONE.has(w)
const CONTORNI_SEC=/\b(?:contorn\w*|verdur\w*|insalat\w*)\b/
const stem=(w:string)=>w.length>4?w.replace(/[aeiou]$/,''):w
const isE=(w:string)=>w==='e'||w==='ed'
const keyWords=(s:string)=>plain(s.replace(/^[^\p{L}\p{N}]+/u,'')).split(' ').filter(w=>w&&!KS.has(w)).map(w=>w==='ed'?'e':w)
/** Chiave di un nome di piatto per i confronti del lessico (minuscole, accenti, articoli e preposizioni via, «ed» = «e»). */
export const lexKey=(s:string)=>keyWords(s).join(' ')
const lev1=(a:string,b:string)=>{if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,e=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++e>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}}return e+(a.length-i)+(b.length-j)<=1}
const DISHES=[...new Set([...STANDALONE,...HEADW,...CONTORNO])].filter(w=>w.length>=5)
const fuzzyCache=new Map<string,boolean>()
/** Parola da piatto, anche con UNA lettera sbagliata nei vocali/refusi («polpete», «risoto»), mai un ingrediente. */
const dishWord=(w:string)=>{if(STANDALONE.has(w)||HEADW.has(w)||CONTORNO.has(w))return true;if(w.length<5||INGREDIENT.has(w))return false
 let v=fuzzyCache.get(w);if(v===undefined){v=DISHES.some(d=>lev1(d,w));if(fuzzyCache.size<5000)fuzzyCache.set(w,v)}return v}
const LOC_KEYS=[...new Set(LOCUTIONS)].map(l=>l.split(' ').filter(w=>!KS.has(w)))

/** Indici delle «e» che stanno dentro una locuzione nota. */
export function locutionEs(W:string[]):Set<number>{const F=W.map((w,i)=>({w:w==='ed'?'e':w,i})).filter(x=>x.w&&!KS.has(x.w)),out=new Set<number>()
 for(const k of LOC_KEYS)for(let s=0;s+k.length<=F.length;s++)if(k.every((x,j)=>F[s+j]!.w===x)){const a=F[s]!.i,b=F[s+k.length-1]!.i;for(let i=a+1;i<b;i++)if(isE(W[i]!))out.add(i)}
 return out}
type Prepared={known:string[],knownSet:Set<string>,byLen:Map<number,string[][]>,knownE:string[][]}
const prepCache=new WeakMap<object,Prepared>()
/** Lessico preparato una volta per oggetto (le chiavi di 3000 nomi non si ricalcolano per ogni pezzo di testo). */
function prepare(lex:Lexicon|null|undefined):Prepared{if(lex&&prepCache.has(lex))return prepCache.get(lex)!
 const known=[...new Set([...(lex?.names??[]).map(lexKey),...(lex?.rules??[]).filter(r=>r.kind==='split').flatMap(r=>r.parts)])].filter(Boolean)
 const byLen=new Map<number,string[][]>();for(const k of known){const ws=k.split(' ');const l=byLen.get(ws.length)??[];l.push(ws);byLen.set(ws.length,l)}
 const p:Prepared={known,knownSet:new Set(known),byLen,knownE:known.filter(k=>k.split(' ').includes('e')).map(k=>k.split(' '))}
 if(lex)prepCache.set(lex,p);return p}
/** Verdetto per ogni «e»/«ed» di una sequenza di parole «piane» (senza punteggiatura). Chiave = indice nella sequenza.
 *  Costo lineare-ish anche su vocali lunghissimi (23/10: indice per prima parola, lessico preparato una volta). */
export function andVerdicts(W:string[],ctx:SplitCtx={}):Map<number,AndVerdict>{
 const out=new Map<number,AndVerdict>(),eIdx=W.map((w,i)=>isE(w)?i:-1).filter(i=>i>0&&i<W.length-1)
 if(!eIdx.length)return out
 // parole significative (senza articoli/preposizioni) con l'indice originale
 const F=W.map((w,i)=>({w:w==='ed'?'e':w,i})).filter(x=>x.w&&!KS.has(x.w))
 const eq=(a:string,b:string)=>a===b||(a.length>=4&&b.length>=4&&stem(a)===stem(b))
 const first=new Map<string,number[]>();F.forEach((x,s)=>{const k=stem(x.w);const l=first.get(k)??[];l.push(s);first.set(k,l)})
 const runs=(key:string[])=>{const hits:{a:number,b:number}[]=[];if(!key.length)return hits;for(const s of first.get(stem(key[0]!))??[])if(s+key.length<=F.length&&key.every((k,j)=>eq(F[s+j]!.w,k)))hits.push({a:F[s]!.i,b:F[s+key.length-1]!.i});return hits}
 const fixed=new Map<number,AndVerdict>() // regole e locuzioni: non si discutono
 // 1. regole imparate
 for(const r of ctx.lexicon?.rules??[]){const key=r.phrase.split(' ').filter(Boolean);if(!key.some(isE))continue
  for(const h of runs(key)){const inside=eIdx.filter(i=>i>h.a&&i<h.b)
   if(r.kind==='join'){for(const i of inside)fixed.set(i,'keep');continue}
   // split: le «e» che stanno fra due parti sono tagli, le altre restano
   const fIn=F.filter(x=>x.i>=h.a&&x.i<=h.b);let pos=0;const cutAt=new Set<number>()
   r.parts.forEach((p,j)=>{pos+=p.split(' ').filter(Boolean).length;if(j<r.parts.length-1&&fIn[pos]&&isE(fIn[pos]!.w)){cutAt.add(fIn[pos]!.i);pos++}})
   for(const i of inside)fixed.set(i,cutAt.has(i)?'split':'keep')}}
 // 2. locuzioni
 const locSpans:{a:number,b:number}[]=[],locByEnd=new Map<number,number>()
 for(const k of LOC_KEYS)for(const h of runs(k)){locSpans.push(h);locByEnd.set(h.b,Math.max(locByEnd.get(h.b)??-1,h.a));for(let i=h.a+1;i<h.b;i++)if(isE(W[i]!)&&!fixed.has(i))fixed.set(i,'keep')}
 // nomi conosciuti (anche parole da sole) e regole «X è un piatto a parte»; «e» dentro un nome conosciuto con la «e»
 const P=prepare(ctx.lexicon),inKnownE=new Set<number>()
 for(const k of P.knownE)for(const h of runs(k))for(let i=h.a+1;i<h.b;i++)if(isE(W[i]!))inKnownE.add(i)
 const isKnown=(a:number,b:number)=>{const ws=F.filter(x=>x.i>=a&&x.i<=b).map(x=>x.w);if(!ws.length||ws.length>10)return false;if(P.knownSet.has(ws.join(' ')))return true;return (P.byLen.get(ws.length)??[]).some(nw=>nw.every((x,j)=>eq(x,ws[j]!)))}
 const sec=ctx.section?plain(ctx.section):'',contorni=CONTORNI_SEC.test(sec)
 // si decide da sinistra a destra: L = dall'ultimo taglio alla «e», R = dalla «e» alla prossima «e» libera (o alla fine)
 let start=0
 for(let n=0;n<eIdx.length;n++){const e=eIdx[n]!
  let nextE=W.length;for(let m=n+1;m<eIdx.length;m++)if(fixed.get(eIdx[m]!)!=='keep'){nextE=eIdx[m]!;break}
  const lFrom=Math.max(start,e-24),L=W.slice(lFrom,e).filter(w=>!KS.has(w)&&!(SOFT.has(w)&&!isE(w))),R=W.slice(e+1,Math.min(nextE,e+25)).filter(w=>!KS.has(w)&&!SOFT.has(w))
  let v:AndVerdict
  if(fixed.has(e))v=fixed.get(e)!
  else if(!L.length||!R.length)v='split'
  else{
   const r0=R[0]!,l0=W.slice(start,e).find(w=>!KS.has(w)&&!SOFT.has(w))??L[0]!
   let j=e-1;while(j>=start&&KS.has(W[j]!))j--
   const locClosed=(locByEnd.get(j)??-1)>=start
   const conAt=W.slice(lFrom,e).lastIndexOf('con'),conFree=conAt>=0&&!W.slice(lFrom+conAt+1,e).some(isE)
   const acrossKnown=inKnownE.has(e)
   if(!acrossKnown&&(isKnown(start,e-1)||isKnown(e+1,nextE-1)))v='split'
   else if(locClosed)v='split'
   else if(contorni&&(CONTORNO.has(r0)||STANDALONE.has(r0))&&(CONTORNO.has(l0)||!INGREDIENT.has(l0)))v='split'
   else if(conFree)v='keep'
   else if(R.length===1&&(STANDALONE.has(r0)||(dishWord(r0)&&!HEADW.has(r0)&&!CONTORNO.has(r0)&&!DISHES.filter(d=>HEADW.has(d)||CONTORNO.has(d)).some(d=>lev1(d,r0))))&&!INGREDIENT.has(r0))v='split'
   else if(STANDALONE2.has(W.slice(e+1,Math.min(nextE,e+6)).filter(w=>!SOFT.has(w)).slice(0,2).join(' ')))v='split'
   else if(R.length>=2&&(dishWord(r0)||STANDALONE.has(r0))&&(dishWord(l0)||STANDALONE.has(l0)||L.length>=2))v='split'
   // dopo la «e» un piatto intero con la sua locuzione («… e gamberetti sale e pepe»): si divide
   else if(R.length>=3&&locSpans.some(h=>h.a>e+1&&h.b<nextE)&&(L.length>=2||dishWord(l0)||STANDALONE.has(l0)))v='split'
   else if(INGREDIENT.has(r0)&&(R.length===1||!dishWord(r0)))v='keep'
   // 28/10 sera (chat di Luisa «tagliolini cozze e pomodori»): fuori dai Contorni un ortaggio da solo dopo un INGREDIENTE («… cozze e
   // pomodori») è un altro condimento del piatto, non un piatto a parte (prima: dubbio → ipotesi «divido» → «Pomodori» creato da solo).
   // «funghi misti e peperoni», «arrosto di vitello e patate» restano dubbi (si chiede).
   else if(R.length===1&&CONTORNO.has(r0)&&L.length>=2&&INGREDIENT.has(L[L.length-1]!))v='keep'
   else v='doubt'
   // 5. un nome conosciuto che contiene proprio questa «e» la tiene (ma mai sopra un indizio certo di separazione)
   if((v==='doubt'||v==='keep')&&acrossKnown)v='keep'}
  out.set(e,v);if(v==='split')start=e+1}
 return out}

/** Ipotesi per un dubbio quando non si può chiedere: si divide se dopo la «e» comincia una parola da piatto/ortaggio. */
export function guessDoubt(W:string[],e:number):AndVerdict{const r0=W.slice(e+1).find(w=>!KS.has(w))??'';return dishWord(r0)?'split':'keep'}

export type Piece={ix:number[],doubt:boolean,doubtAt:number[]}
/** Pezzi (indici delle parole, «e» di taglio escluse) di una sequenza senza punteggiatura. `ask`=false: i dubbi diventano l'ipotesi. */
export function splitPieces(W:string[],ctx:SplitCtx={},ask=true):Piece[]{
 const v=andVerdicts(W,ctx),pieces:Piece[]=[];let cur:number[]=[],doubts:number[]=[]
 const flush=()=>{if(cur.length)pieces.push({ix:cur,doubt:doubts.length>0,doubtAt:doubts});cur=[];doubts=[]}
 for(let i=0;i<W.length;i++){let x=v.get(i);if(x==='doubt'&&!ask)x=guessDoubt(W,i)
  if(x==='split'||(isE(W[i]!)&&(i===0||i===W.length-1))){flush();continue}
  if(x==='doubt')doubts.push(i)
  cur.push(i)}
 flush();return pieces}

/** I due modi di leggere un pezzo dubbio: tutto insieme (1 piatto) o diviso alle «e» dubbie. */
export function doubtReadings(W:string[],p:Piece):{one:number[],parts:number[][]}{const parts:number[][]=[[]];for(const i of p.ix){if(p.doubtAt.includes(i)){parts.push([]);continue}parts[parts.length-1]!.push(i)}return{one:p.ix,parts:parts.filter(x=>x.length)}}

/** Domanda di una riga per un pezzo dubbio. */
export const doubtQuestion=(text:string,n:number)=>'«'+text+'»: 1 piatto o '+n+'?'
/** Risposta alla domanda «1 piatto o 2?»: 'one' | 'split' | null (non è una risposta). */
export function doubtAnswer(text:string):'one'|'split'|null{const p=plain(text).replace(/^(?:sono |e |è |allora |ok |no |si |guarda )+/,'').trim()
 if(/^(?:1|uno|un piatto|1 piatto|uno solo|un solo piatto|piatto unico|un piatto solo|un piatto unico|solo uno|unico|insieme|uniti|unito|tutto insieme|stanno insieme|vanno insieme|e un piatto solo|un unico piatto)(?: solo| unico| grazie)?$/.test(p))return 'one'
 if(/^(?:2|3|4|due|tre|quattro|separati|separate|separato|divisi|divise|dividili|separali|a parte|due piatti|tre piatti|2 piatti|3 piatti|sono due|sono tre|piatti separati|due separati|due diversi|diversi|distinti)(?: piatti| separati| diversi| grazie)?$/.test(p))return 'split'
 return null}

// ---------- correzioni del titolare («coppa è un piatto a parte», «pasta e fagioli è un piatto solo») ----------
export type Correction={kind:'split'|'join',phrase:string,n:number|null}
const NUM:Record<string,number>={due:2,'2':2,tre:3,'3':3,quattro:4,'4':4}
const BAD_PHRASE=/\d|\b(?:prezz\w*|euro|foto|menu|sottomenu|sezion\w*|categori\w*|ordin\w*|tavol\w*|conto|scontrin\w*|cliente|clienti|questo|questa|quello|quella|tutto|tutti|cosa)\b/
const KIND_W='(?:piatt[oi]|contorn[oi]|second[oi]|prim[oi]|dolc[ei]|antipast[oi]|portat[ae]|cos[ae])'
/** Frase di correzione della divisione. null = non è una correzione. */
export function parseCorrection(text:string):Correction|null{
 let p=plain(text).replace(/^(?:no|ma|guarda|attento|attenzione|scusa|aspetta|ehi|allora|ok|invece|per[ò]?|pero)\s+/g,'').trim()
 for(let i=0;i<3;i++)p=p.replace(/^(?:no|ma|guarda|attento|attenzione|scusa|aspetta|ehi|allora|ok|invece|pero|che)\s+/,'').trim()
 const art=(s:string)=>s.replace(/^(?:il|lo|la|l|i|gli|le|un|una)\s+/,'').replace(/\s+(?:nel|nei|in|del|dei)\s+(?:menu|sottomenu)\b.*$/,'').trim()
 let m=p.match(new RegExp('^(.+?)\\s+(?:e|sono)\\s+(?:un |una )?(?:solo |unico )?'+KIND_W+'\\s+(?:solo|unic[oa]|singol[oa])$'))??p.match(new RegExp('^(.+?)\\s+(?:e|sono)\\s+(?:un |una )(?:solo|unico|unica|sola)\\s+'+KIND_W+'$'))??p.match(/^(.+?)\s+(?:e|sono)\s+lo stesso piatto$/)??p.match(/^(.+?)\s+(?:va|vanno|stanno)\s+(?:insieme|uniti|unite)$/)??p.match(/^(?:unisci|metti insieme)\s+(.+)$/)
 if(m){const ph=art(m[1]!);return ph.split(' ').length>=2&&!BAD_PHRASE.test(ph)?{kind:'join',phrase:ph,n:1}:null}
 m=p.match(new RegExp('^(.+?)\\s+sono\\s+(due|tre|quattro|2|3|4)\\s+'+KIND_W+'(?:\\s+(?:separat[ie]|divers[ie]|distint[ie]|a parte))?$'))
 if(m&&!BAD_PHRASE.test(art(m[1]!)))return{kind:'split',phrase:art(m[1]!),n:NUM[m[2]!]??null}
 m=p.match(new RegExp('^(.+?)\\s+(?:e|sono)\\s+(?:(?:un |una )?(?:altro |altra )?'+KIND_W+'\\s+)?(?:a parte|separat[oaie]|per conto suo|da solo|da sola|a se)$'))??p.match(new RegExp('^(.+?)\\s+(?:e|sono)\\s+(?:un |una )(?:altro |altra )'+KIND_W+'$'))??p.match(/^(.+?)\s+(?:va|vanno)\s+(?:a parte|separat\w*|divis\w*|da soli|da sole)$/)??p.match(/^(?:dividi|separa|dividimi|separami)\s+(.+?)(?:\s+in\s+(?:due|tre|2|3)(?:\s+piatti)?)?$/)
 if(m){const ph=art(m[1]!);if(!ph||ph.split(' ').length>8||BAD_PHRASE.test(ph))return null;return{kind:'split',phrase:ph,n:null}}
 return null}

export type CorrectionPlan={actions:MenuAction[],rule:SplitRule|null,lines:{menu:string,section:string,names:{name:string,isNew:boolean}[]}[],found:boolean}
const cap=(s:string)=>s.charAt(0).toLocaleUpperCase('it')+s.slice(1)
const rawWords=(name:string)=>name.replace(/^[^\p{L}\p{N}]+/u,'').replace(/[,;]/g,' ').split(/\s+/).filter(Boolean)
/** Azioni della correzione: divide il piatto creato male nei piatti giusti (stessa sezione, subito dopo) o unisce piatti divisi male.
 *  `prefMenu` = Menu di cui si parla (se ce ne sono più con lo stesso piatto). Sempre la regola da salvare nel lessico del locale. */
export function correctionPlan(c:Correction,refs:MenuRef[],sections:SectionRef[],menus:{name:string,pricing?:string}[],prefMenu:string|null,lex:Lexicon|null):CorrectionPlan{
 const lines:CorrectionPlan['lines']=[],actions:MenuAction[]=[],pk=lexKey(c.phrase),pw=pk.split(' ').filter(Boolean)
 const live=refs.filter(r=>!r.hidden),inMenu=(xs:MenuRef[])=>{const f=prefMenu?xs.filter(r=>r.menu===prefMenu):[];return (f.length?f:xs).slice(0,5)}
 const secName=(r:MenuRef)=>sections.find(s=>s.id===r.sectionId)?.name??r.section??''
 const fixedMenu=(m:string)=>menus.find(x=>x.name===m)?.pricing==='fisso'
 if(c.kind==='split'){
  // (1) il piatto ha proprio quel nome («funghi misti e peperoni sono due contorni»); (2) quel pezzo è in coda/testa a un piatto («coppa è un piatto a parte»)
  const whole=inMenu(live.filter(r=>lexKey(r.name)===pk&&lexKey(r.name).split(' ').includes('e')))
  const part=whole.length?[]:inMenu(live.filter(r=>{const k=lexKey(r.name);return !pw.includes('e')&&k!==pk&&(k.endsWith(' e '+pk)||k.startsWith(pk+' e '))}))
  let ruleParts:string[]|null=null,rulePhrase=pk
  for(const r of [...whole,...part]){const ws=rawWords(r.name),W=ws.map(w=>plain(w).replace(/ /g,'')||w.toLowerCase())
   const eIx=W.map((w,i)=>isE(w)&&i>0&&i<W.length-1?i:-1).filter(i=>i>=0);if(!eIx.length)continue
   let cuts:number[]
   if(part.includes(r)){const k=keyWords(c.phrase).length,head=lexKey(r.name).startsWith(pk+' e ');cuts=[head?eIx.find(i=>keyWords(ws.slice(0,i).join(' ')).length===k)??eIx[0]!:eIx.find(i=>keyWords(ws.slice(i+1).join(' ')).length===k)??eIx[eIx.length-1]!]}
   else{const v=andVerdicts(W,{lexicon:{names:[],rules:[]},section:secName(r)}),loc=locutionEs(W),inLoc=(i:number)=>loc.has(i)
    const rank=(i:number)=>inLoc(i)?3:v.get(i)==='split'?0:v.get(i)==='doubt'?1:2
    const want=c.n?c.n-1:eIx.filter(i=>!inLoc(i)).length||1
    cuts=[...eIx].sort((a,b)=>rank(a)-rank(b)||b-a).slice(0,want).sort((a,b)=>a-b)}
   const parts:string[][]=[];let cur:string[]=[];ws.forEach((w,i)=>{if(cuts.includes(i)){parts.push(cur);cur=[];return}cur.push(w)});parts.push(cur)
   const names=parts.map(p=>cap(p.join(' ').replace(/\s+/g,' ').trim())).filter(Boolean);if(names.length<2)continue
   const sec=sections.find(s=>s.id===r.sectionId);if(!sec)continue
   const exists=(n:string)=>refs.find(x=>x.sectionId===r.sectionId&&x.id!==r.id&&!x.hidden&&lexKey(x.name)===lexKey(n))
   actions.push({kind:'rename',id:r.id,name:names[0]!} as MenuAction)
   const news=names.slice(1).filter(n=>!exists(n))
   for(const n of [...news].reverse())actions.push({kind:'create',sectionId:sec.id,name:n,price:fixedMenu(r.menu)?0:r.price,description:null,afterId:r.id} as MenuAction)
   lines.push({menu:r.menu,section:sec.name,names:names.map(n=>({name:n,isNew:news.includes(n)}))})
   if(!ruleParts){ruleParts=names.map(lexKey);rulePhrase=lexKey(r.name)}}
  if(!ruleParts){// niente da dividere nel menu: si ricorda comunque (pezzo da solo = piatto a parte; frase con «e» = divisa alle «e» libere)
   if(pw.includes('e')){const W=pw,v=andVerdicts(W,{lexicon:lex});const cuts=W.map((w,i)=>isE(w)&&i>0&&i<W.length-1&&v.get(i)!=='keep'?i:-1).filter(i=>i>=0);const cs=cuts.length?cuts:W.map((w,i)=>isE(w)?i:-1).filter(i=>i>0)
    const parts:string[]=[];let cur:string[]=[];W.forEach((w,i)=>{if(cs.includes(i)){parts.push(cur.join(' '));cur=[];return}cur.push(w)});parts.push(cur.join(' '));ruleParts=parts.filter(Boolean)}
   else ruleParts=[pk]}
  return{actions,rule:{phrase:rulePhrase.slice(0,60),kind:'split',parts:ruleParts},lines,found:actions.length>0}}
 // join: piatti della stessa sezione che insieme fanno il nome detto
 const eAt=pw.map((w,i)=>isE(w)?i:-1).filter(i=>i>0&&i<pw.length-1)
 const raw=rawWords(c.phrase)
 for(let mask=1;mask<(1<<eAt.length)&&!actions.length;mask++){const cut=eAt.filter((_,j)=>mask&(1<<j)),parts:string[]=[];let cur:string[]=[];pw.forEach((w,i)=>{if(cut.includes(i)){parts.push(cur.join(' '));cur=[];return}cur.push(w)});parts.push(cur.join(' '))
  const bySec=new Map<string,MenuRef[]>();for(const r of live)if(r.sectionId){const l=bySec.get(r.sectionId)??[];l.push(r);bySec.set(r.sectionId,l)}
  const hits:{sec:string,items:MenuRef[]}[]=[]
  for(const [sid,items] of bySec){const pick=parts.map(p=>items.find(r=>lexKey(r.name)===p));if(pick.every(Boolean)&&new Set(pick.map(r=>r!.id)).size===parts.length)hits.push({sec:sid,items:pick as MenuRef[]})}
  const use=(()=>{const f=prefMenu?hits.filter(h=>h.items[0]!.menu===prefMenu):[];return (f.length?f:hits).slice(0,5)})()
  for(const h of use){const keep=h.items.find(r=>r.hasImage)??h.items[0]!,name=cap(raw.join(' ').replace(/\s+/g,' ').trim()),sec=sections.find(s=>s.id===h.sec)
   actions.push({kind:'rename',id:keep.id,name} as MenuAction);for(const r of h.items)if(r.id!==keep.id)actions.push({kind:'delete',id:r.id,soft:true} as MenuAction)
   lines.push({menu:keep.menu,section:sec?.name??'',names:[{name,isNew:false}]})}}
 return{actions,rule:{phrase:pk.slice(0,60),kind:'join',parts:[pk]},lines,found:actions.length>0}}

/** Testo della risposta a una correzione (strutturato: un piatto per riga). */
export function correctionReply(c:Correction,plan:CorrectionPlan,menuCount:number):string{
 const head=c.kind==='split'?'*Divisi*':'*Uniti*',out:string[]=[]
 if(!plan.found){const said='«'+c.phrase+'»'
  return c.kind==='split'?'Ok, me lo ricordo: '+said+(plan.rule&&plan.rule.parts.length>1?' sono '+plan.rule.parts.length+' piatti separati':' è un piatto a parte')+'. Nel menu non ho trovato niente da dividere: la prossima volta li divido da solo.'
   :'Ok, me lo ricordo: '+said+' è un piatto solo. Nel menu non ho trovato piatti da unire: la prossima volta lo tengo unito.'}
 out.push(head)
 for(const l of plan.lines)out.push('*'+l.section+'*'+(menuCount>1?' ('+l.menu+')':'')+'\n'+l.names.map(n=>'• '+n.name+(n.isNew?' (nuovo)':'')).join('\n'))
 out.push(c.kind==='split'?'Me lo ricordo: la prossima volta li divido da solo.':'Me lo ricordo: la prossima volta lo tengo unito.')
 return out.join('\n\n')}

/** Regola dalla risposta «1 / 2» a un dubbio. */
export function ruleFromAnswer(one:string,parts:string[],ans:'one'|'split'):SplitRule{const k=lexKey(one).slice(0,60);return ans==='one'?{phrase:k,kind:'join',parts:[k]}:{phrase:k,kind:'split',parts:parts.map(lexKey)}}

// ---------- memoria (righe «habit» di tako_owner_brain_memory: niente migrazione) ----------
const SPLIT_PREFIX='Divisione dei piatti: ',JOIN_PREFIX='Piatto unico: '
/** Testo leggibile (anche dal modello come «abitudine») che codifica la regola. ≤200 caratteri. */
export function ruleMeaning(r:SplitRule):string{return (r.kind==='split'?SPLIT_PREFIX+'«'+r.phrase+'» = '+r.parts.map(p=>'«'+p+'»').join(' + '):JOIN_PREFIX+'«'+r.phrase+'» è un piatto solo').slice(0,200)}
export function ruleOfMeaning(meaning:string):SplitRule|null{
 if(meaning.startsWith(SPLIT_PREFIX)){const m=meaning.slice(SPLIT_PREFIX.length).match(/^«([^»]+)» = (.+)$/);if(!m)return null;const parts=[...m[2]!.matchAll(/«([^»]+)»/g)].map(x=>x[1]!);return parts.length?{phrase:m[1]!,kind:'split',parts}:null}
 if(meaning.startsWith(JOIN_PREFIX)){const m=meaning.slice(JOIN_PREFIX.length).match(/^«([^»]+)»/);return m?{phrase:m[1]!,kind:'join',parts:[m[1]!]}:null}
 return null}
