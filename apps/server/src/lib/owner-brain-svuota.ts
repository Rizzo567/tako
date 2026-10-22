/** Regola d'uso 22/10/2026 (decisione Manuel dopo la prova con Gio, Victoria Bar). Modulo PURO: niente DB, niente rete, niente modello.
 * - «togli tutto il menu di pranzo», «svuota il menu cena», «togli tutti i piatti del pranzo», «nascondi tutto» = NASCONDE tutti i piatti
 *   visibili di quel Menu. Sottomenu, Menu e prezzi fissi restano; mai eliminazioni; nessuna domanda di conferma («annulla» 10 minuti).
 * - «nei primi inserisci A, B, C», «nei secondi D e E», «contorni F» (anche tutto insieme, anche in vocale) = nel sottomenu del Menu di cui
 *   si parla: piatto omonimo esistente → di nuovo visibile (con la sua foto), nuovo → creato senza prezzo (Menu a prezzo fisso).
 *   «Inserisci» NON nasconde gli altri piatti (la sostituzione giornaliera «oggi a pranzo primi …» resta com'è).
 * - Menu: quello detto nel messaggio («a cena», «menu del giorno», «pranzo» → il Menu del pranzo/giorno), altrimenti l'ultimo nominato
 *   nella conversazione; se resta ambiguo una domanda di una riga («Nel *Menu Giorno* o nel *Menu Cena*?»).
 * Invarianti (batteria avversaria 22/10): mai sottomenu o Menu eliminati/nascosti, mai piatti di altri Menu, ogni nome detto è inserito o
 * segnalato nella risposta, prezzi fissi intatti, «annulla» rimette esattamente com'era (undo generico della pubblicazione). */
import {plain,type MenuRef,type SectionRef,type MenuAction} from './twilio-menu-ai.js'
import {sameSection} from './twilio-menu-structure.js'
import {namedMenus,dishCourse,fixSpelling} from './owner-brain-sera.js'

export type RuleMenu={id:string,name:string,pricing?:'carta'|'fisso',active?:boolean}
export type RuleWait={kind:'menu',text:string,options:string[]}|{kind:'names',menuId:string,secId:string}
export type RuleSection={secId:string,name:string,created:string[],shown:string[],already:string[]}
export type RuleReport={menu:string,fixed:boolean,cleared:string[],deleteWord:boolean,sections:RuleSection[],unknownSecs:{word:string,names:string[]}[],notPlaced:string[],notFound?:string[],kept?:string[]}
export type RuleResult={kind:'apply',menu:RuleMenu,actions:MenuAction[],report:RuleReport}|{kind:'ask',question:string,wait:RuleWait}|{kind:'info',text:string}

// ---------- Menu di cui si parla ----------
const LUNCH=/ (?:pranzo|pranzi|mezzogiorno|mezzo giorno) /,DINNER=/ (?:cena|cene|stasera|stassera|sera|serale) /
const isLunch=(m:{name:string})=>/\b(?:pranz\w*|giorno|mezzogiorno)\b/.test(plain(m.name)),isDinner=(m:{name:string})=>/\b(?:cen[ae]|sera\w*)\b/.test(plain(m.name))
/** Menu nominati nel testo: il nome («menu cena», «menu del giorno») o la parola del pasto («a pranzo» → il Menu del pranzo/giorno). */
export function menusIn<T extends {name:string}>(text:string,menus:T[]):T[]{
 const direct=namedMenus(text,menus);if(direct.length)return direct
 const p=' '+plain(text)+' ',out:T[]=[]
 if(LUNCH.test(p))out.push(...menus.filter(isLunch))
 if(DINNER.test(p))out.push(...menus.filter(isDinner))
 return [...new Set(out)]}
/** Ultimo Menu nominato nella conversazione (turni più recenti prima): un turno del titolare con più Menu = ambiguo (null). */
export function contextMenu<T extends {name:string}>(turns:{role:string,text:string,at:number}[],menus:T[]):T|null{
 for(const t of [...turns].sort((a,b)=>b.at-a.at)){const m=menusIn(t.text,menus);if(m.length===1)return m[0]!;if(m.length>1&&t.role==='owner')return null}
 return null}
const mLabel=(n:string)=>/^men[uù]\b/i.test(n.trim())?'*'+n.trim()+'*':'Menu *'+n.trim()+'*'
const orList=(xs:string[])=>xs.length<=1?xs.join(''):xs.slice(0,-1).join(', ')+' o '+xs[xs.length-1]
const andList=(xs:string[])=>xs.length<=1?xs.join(''):xs.slice(0,-1).join(', ')+' e '+xs[xs.length-1]

// ---------- parole ----------
const COURSES=['primi','primo','secondi','secondo','contorni','contorno','dolci','dolce','dessert','antipasti','antipasto','pizze','pizza','insalate','insalatone','panini','bevande','frutta','piatti unici','piatto unico','zuppe','minestre']
const CLEAR_V=/\b(?:svuot\w*|togli\w*|toglie\w*|lev[ai]\w*|levare|levamo|levate|nascond\w*|rimuov\w*|elimin\w*|cancell\w*|sgombr\w*)\b/
const INSERT_V=/\b(?:inser(?:isc|ic|is|isci|iamo|ire|ite)\w*|ag+iung\w*|metti|mettici|mettete|mettiamo|mettere|mettimi|ci vanno|ci va)\b/
const STRONG_INSERT=/\b(?:inser(?:isc|ic|is|isci|iamo|ire|ite)\w*|ag+iung\w*)\b/
const NOT_DISH=/\b(?:restan\w*|resta|rimang\w*|uguali|uguale|togli\w*|nascond\w*|lascia\w*|cambi\w*|elimin\w*|cancell\w*|annull\w*|aspett\w*|scusa|sbagliat\w*|prezz\w*|cost[ao]|costano|euro|finit\w*|esaurit\w*|svuot\w*|leva\w*|rimuov\w*|cosa|quale|quali|perche|come prima|com era)\b/
const DAILY=/\b(?:oggi|stasera|stassera|stamattina|domani|stamani)\b/
const NEG=/\b(?:non|nun)\s+(?:(?:li|le|lo|la|ci|mi|piu)\s+)?(?:togli|lev|nascond|svuot|elimin|cancell|rimuov|mett|inser|aggiung)/
/** Altri comandi nello stesso messaggio: prezzi, esaurito, foto, eliminazione di un piatto, rinomina → non è la regola (resta il resto). */
const OTHER=/\b(?:euro|prezz\w*|cost\w*|finit\w*|esaurit\w*|foto|rinomin\w*|spost\w*|evidenz\w*|promo\w*|sconto|scont\w*|alz\w*|abbass\w*|aument\w*|diminu\w*)\b|€/
const PREP=new Set(['nei','negli','nelle','nel','nella','nello','tra','fra','in','i','gli','le','per','come','di','dei','delle','degli','ai','agli','alle','al','alla','sui','sugli','sulle','il','lo','la','l','da','dai','dagli','dalle','dal','dalla'])
const FILL=new Set(['inserici','agiungi','ehm','beh','mah','insomma','inserisci','inserire','inseriamo','inserite','aggiungi','aggiungere','aggiungiamo','aggiungete','aggiungo','metti','mettici','mettete','mettiamo','mettere','mettimi','rimetti','rimettici','rimettere','ci','vanno','va','anche','pure','poi','e','ed','solo','soltanto','invece','il','lo','la','l','i','gli','le','un','uno','una','di','oggi','stasera','per','favore','grazie','ok','allora','dai','adesso','ora','quindi','sono','abbiamo','c','ce','cioe','tipo','sotto','dentro','nei','negli','nelle','nel','nella','tra','fra','in','ai','agli','alle','al','alla','con','da','che','mentre','invece','piatti','piatto','questi','queste','seguenti','se','puoi','potresti','voglio','vorrei','bisogna','devi','dobbiamo','facciamo','fai','scrivi','scrivimi','metto','inserisco','no','aspetta','scusa','anzi','ecco','ciao','senti','guarda','ah','eh','dunque','perfetto','bene','benissimo','esatto','mi','raccomando','subito','tutti','tutte','questo','quello','cosa','cose','vorremmo','volevo','bisogna','serve','servono','mettere','ricorda'])
const SKIP=new Set(['niente','nulla','basta','ok','si','no','grazie','altro','tutto','tutti'])
const DEFAULT_PROTECT=['pasta e fagioli','pasta e ceci','pasta e patate','pasta e lenticchie','pasta e piselli','riso e piselli','pane e coperto','salsiccia e friarielli','prosciutto e melone','cacio e pepe','burro e salvia','sale e pepe','aglio olio e peperoncino','aglio e olio','rucola e grana','pomodoro e basilico','panna e speck','speck e zucchine','zucchine e gamberi','cozze e vongole','vongole e pomodorini','pane e pomodoro','mozzarella e pomodoro','salmone e zucchine','funghi e salsiccia','zucchine e speck','pomodorini e basilico','pepe e limone','olio e limone','spinaci e ricotta','ricotta e spinaci','burro e parmigiano','patate e cozze','cime di rapa e salsiccia']
// Parola che apre il nome di un piatto (per i vocali senza virgole: «pasta alla carbonara linguine» = due piatti).
const HEAD=new Set(['pasta','spaghetti','linguine','tagliatelle','pappardelle','fettuccine','penne','fusilli','rigatoni','paccheri','tortellini','tortelloni','ravioli','gnocchi','risotto','riso','lasagna','lasagne','orecchiette','trofie','bucatini','tortiglioni','cannelloni','maccheroni','mezze','minestrone','minestra','zuppa','vellutata','tagliata','cotoletta','cotolette','scaloppine','scaloppina','orata','branzino','salsiccia','salsicce','pollo','polpette','frittata','insalata','insalatona','nodino','filetto','bistecca','arrosto','hamburger','spezzatino','involtini','frittura','fritto','patate','patatine','parmigiana','bruschetta','bruschette','tiramisu','polenta','caprese','vitello','stinco','grigliata','calzone'])
const VEG=new Set(['zucchine','melanzane','peperoni','spinaci','carciofi','fagiolini','broccoli','cime','cicoria','funghi','verdure','cavolfiore','finocchi'])
const VEG_NEXT=/^(?:fritt\w*|grigliat\w*|al|alla|alle|trifolat\w*|ripien\w*|saltat\w*|lessat\w*|gratinat\w*|ripassat\w*|in|impanat\w*|arrost\w*)$/
const capW=(x:string)=>x.charAt(0).toLocaleUpperCase('it')+x.slice(1)
const ART=/^(?:il|lo|la|l|i|gli|le|un|uno|una)\s+/
const norm=(s:string)=>plain(s).replace(ART,'').trim()
const SIGSTOP=new Set(['al','alla','alle','allo','all','ai','agli','di','del','della','dello','dei','degli','delle','dell','con','e','ed','in','la','il','lo','l','le','i','gli','un','una','uno','da','nel','nella','sul','sulla','a'])
const sig=(s:string)=>plain(s).split(' ').filter(w=>w&&!SIGSTOP.has(w))
const stem=(w:string)=>w.length>4?w.replace(/[aeio]$/,''):w
const lev1=(a:string,b:string)=>{if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,e=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++e>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}}return e+(a.length-i)+(b.length-j)<=1}
/** Stesso piatto (omonimo): nome uguale a meno di articoli, preposizioni, plurali o UNA lettera sbagliata per parola lunga.
 * «nodino di burro e salvia» = Nodino burro e salvia; «linguine» ≠ Linguine vongole e pomodorini (nome diverso → piatto nuovo). */
export function sameName(a:string,b:string):boolean{if(norm(a)===norm(b))return true;const x=sig(a),y=sig(b);if(!x.length||x.length!==y.length)return false
 return x.every((w,i)=>{const v=y[i]!;return w===v||stem(w)===stem(v)||(w.length>=5&&v.length>=5&&lev1(w,v))})}

// ---------- intenzioni ----------
/** Dopo «tutti i / tutto il …» c'è un gruppo che NON è il Menu intero («togli tutti i primi», «togli tutte le linguine»): non è la regola. */
const WHOLE_OK=new Set(['piatti','piatto','menu','quanto','quanti','cosa','cose','roba','quello','quella','quelli','quelle','e','dal','dalla','dai','del','della','dello','nel','nella','di','da','in','a','oggi','stasera','pranzo','cena','sera','giorno','carta','ma','ok','per','che','ci','c','quanto','subito','adesso','ora','li','le','i','gli','qui','dentro','fuori','presente','presenti','visibile','visibili','dalla'])
function notWholeMenu(p:string,secNames:string[]):boolean{
 for(const m of p.matchAll(/\btutt[oaie]\s+(?:quant[ieoa]\s+)?(?:i |gli |le |il |lo |la |l )?([a-z]+)/g)){const w=m[1]!;if(!WHOLE_OK.has(w))return true}
 // «togli tutto dai primi», «nascondi tutti i piatti dei secondi»
 return [...p.matchAll(/\b(?:dai|dagli|dalle|dei|degli|delle|nei|negli|nelle|tra i|tra le)\s+([a-z]+)/g)].some(m=>COURSES.includes(m[1]!)||secNames.some(s=>sameSection(s,m[1]!)))}
/** «svuota il menu cena», «togli tutto il menu di pranzo», «togli tutti i piatti del pranzo», «nascondi tutto», «leva tutti i piatti». */
export function clearIntent(text:string,secNames:string[]=[]):boolean{
 const p=plain(text);if(!p||NEG.test(p))return false
 if(/\b(?:finit\w*|esaurit\w*|disponibil\w*|prezz\w*|euro|foto|promo\w*|evidenz\w*|allergen\w*|descrizion\w*|nascost\w*|modific\w*|ultim[oaie]|indietro)\b|\b(?:hai|ho|abbiamo)\s+(?:fatto|messo|cambiato|aggiunto|inserito|scritto)\b|\bcom e(?:ra)?\b|\bcome prima\b/.test(p))return false
 if(/\bsvuot\w*\b/.test(p))return !/\bsvuot\w*\s+(?:i|gli|le|il|la)\s+(?:primi|secondi|contorni|dolci|antipasti|pizze)\b/.test(p)||false
 if(!CLEAR_V.test(p)||!/\btutt[oaie]\b/.test(p))return false
 if(/\btutt[oaie] e (?:due|tre|2|3)\b|\bentramb\w*/.test(p))return false
 return !notWholeMenu(p,secNames)}

// ---------- lettura delle liste ----------
type Tok={w:string,raw:string}
const tokens=(text:string):Tok[]=>{const s=text.replace(/[🎤*_~`"“”«»]/gu,' ').replace(/[’`]/g,"'").replace(/\n+/g,' ; ').replace(/([,;:.!?])/g,' $1 ').replace(/\s+/g,' ').trim()
 return s.split(' ').filter(Boolean).flatMap(raw=>{if(/^[,;:.!?]$/.test(raw))return[{w:raw===':'?':':raw==='.'||raw==='!'||raw==='?'?';':raw,raw}];const parts=raw.split("'");return parts.map((x,i)=>({w:plain(x),raw:i<parts.length-1?x+"'":x})).filter(t=>t.w)})}
/** Posizioni del testo che nominano un Menu («nel menu cena», «a pranzo», «per stasera»): non sono nomi di piatti. */
function menuSpans(t:Tok[],menus:{name:string}[]):Set<number>{const out=new Set<number>(),W=t.map(x=>x.w)
 const mark=(i:number,n:number)=>{let s=i;while(s>0&&PREP.has(W[s-1]!))s--;if(s>0&&W[s-1]==='menu')s--;while(s>0&&PREP.has(W[s-1]!))s--;for(let k=s;k<i+n;k++)out.add(k)}
 for(const m of menus){const ws=plain(m.name).split(' ').filter(Boolean),key=ws[0]==='menu'?ws.slice(1).filter(w=>!['del','della','di','dei'].includes(w)):ws
  for(let i=0;i<W.length;i++){if(ws.length&&ws.every((w,k)=>W[i+k]===w)){mark(i,ws.length);continue}
   if(W[i]==='menu'&&key.length){let j=i+1;while(['del','della','di','dei'].includes(W[j]??''))j++;if(key.every((w,k)=>W[j+k]===w)){mark(i,j-i+key.length)}}}}
 for(let i=0;i<W.length;i++){if(/^(?:pranzo|cena|stasera|stassera|sera|mezzogiorno|oggi|domani|stamattina)$/.test(W[i]!))mark(i,1)
  if(W[i]==='menu'&&!out.has(i)){out.add(i);let s=i;while(s>0&&PREP.has(W[s-1]!)){s--;out.add(s)}}}
 return out}
type Mention={i:number,n:number,secId:string|null,word:string}
/** Parole di sottomenu nel testo: i sottomenu del Menu (anche al singolare) e le portate comuni che nel Menu non ci sono. */
function mentions(t:Tok[],secs:SectionRef[],skip:Set<number>):Mention[]{const out:Mention[]=[],W=t.map(x=>x.w)
 const words=(n:string)=>plain(n).split(' ').filter(Boolean)
 for(let i=0;i<W.length;i++){if(skip.has(i))continue;const w=W[i]!
  const multi=secs.find(s=>{const ws=words(s.name);return ws.length>1&&ws.every((x,k)=>W[i+k]===x||(k===0&&sameSection(x,W[i+k]??'')))})
  if(multi){const n=words(multi.name).length;out.push({i,n,secId:multi.id,word:multi.name});i+=n-1;continue}
  // anche con una lettera sbagliata nei vocali («secodi», «contormi»): parole di almeno 5 lettere
  const single=secs.filter(x=>words(x.name).length===1&&(sameSection(x.name,w)||(w.length>=5&&!PREP.has(w)&&!FILL.has(w)&&!['prima','prime','seconda','seconde','primavera'].includes(w)&&(lev1(plain(x.name),w)||lev1(plain(x.name).replace(/i$/,'o'),w)))))
  if(single.length){out.push({i,n:1,secId:single[0]!.id,word:single[0]!.name});continue}
  if(!COURSES.includes(w))continue
  // «nei primi» con un sottomenu «Primi piatti»: la prima parola basta se è l'unico del Menu
  const first=secs.filter(x=>words(x.name).length>1&&sameSection(words(x.name)[0]!,w))
  if(first.length===1){out.push({i,n:1,secId:first[0]!.id,word:first[0]!.name});continue}
  // portata che nel Menu non c'è: vale solo detta come sottomenu («nei dolci», «dolci:», a inizio frase), mai dentro un nome
  const prev=W[i-1]??'',next=W[i+1]??''
  if(i===0||[',',';',':'].includes(prev)||/^(?:nei|negli|nelle|tra|fra|come|per|i|gli|le|ai|agli|alle)$/.test(prev)||next===':')out.push({i,n:1,secId:null,word:w})}
 return out}
const isHead=(t:string[],k:number)=>HEAD.has(t[k]!)||(VEG.has(t[k]!)&&VEG_NEXT.test(t[k+1]??''))
/** Nomi dei piatti di un pezzo di testo: virgole, «e»/«ed» (tranne dentro un nome: «pasta e fagioli», «nodino burro e salvia»),
 * e nei vocali senza virgole un nuovo piatto quando compare una parola che apre un piatto («pasta alla carbonara linguine»). */
export function splitNames(seg:Tok[],known:string[]):string[]{
 const protect=[...new Set([...DEFAULT_PROTECT,...known.map(n=>plain(n)).filter(n=>/ (?:e|ed) /.test(n))])].map(n=>n.split(' '))
 const W=seg.map(x=>x.w),R=seg.map(x=>x.raw),keep=new Set<number>()
 for(const pr of protect)for(let i=0;i+pr.length<=W.length;i++)if(pr.every((x,k)=>W[i+k]===x))for(let k=0;k<pr.length;k++)if(W[i+k]==='e'||W[i+k]==='ed')keep.add(i+k)
 // pezzi separati da punteggiatura, poi da «e»
 const out:string[]=[];let cur:number[]=[]
 const flushPart=(ix:number[])=>{if(!ix.length)return;const parts:number[][]=[[]];for(const k of ix){if((W[k]==='e'||W[k]==='ed')&&!keep.has(k)){parts.push([]);continue}parts[parts.length-1]!.push(k)}
  const merged:number[][]=[];for(const p of parts.filter(x=>x.length)){const prev=merged[merged.length-1],ws=p.map(k=>W[k]!)
   // «e» davanti a una sola parola che non è un piatto («… olio e peperoncino», «pasta e ceci»): fa parte del nome di prima
   if(prev&&ws.length===1&&!dishCourse(ws[0]!)&&!HEAD.has(ws[0]!)&&!known.some(n=>norm(n)===ws[0])){prev.push(-1,...p);continue}
   merged.push([...p])}
  for(const p of merged){let cut:number[]=[];for(let j=0;j<p.length;j++){const k=p[j]!;
    if(cut.length&&k>=0&&isHead(W,k)&&cut.some(x=>x>=0&&isHead(W,x))&&!PREP.has(W[p[j-1]!]??'')&&p[j-1]!==-1&&!known.some(n=>norm(n)===cut.filter(x=>x>=0).map(x=>W[x]).concat(W[k]!).join(' ')))
     {out.push(cut.map(x=>x<0?'e':R[x]).join(' ').replace(/' /g,"'"));cut=[]}
    cut.push(k)}
   if(cut.length)out.push(cut.map(x=>x<0?'e':R[x]).join(' ').replace(/' /g,"'"))}}
 for(let k=0;k<W.length;k++){if(W[k]===','||W[k]===';'||W[k]===':'){flushPart(cur);cur=[];continue}cur.push(k)}
 flushPart(cur)
 return out.map(clean).filter(n=>!!n&&!SKIP.has(plain(n)))}
const clean=(n:string)=>{let ws=n.replace(/\s+/g,' ').trim().split(' ').filter(Boolean)
 // «secodi inserisci orata»: un verbo d'inserimento dentro il nome = quello che c'è prima non è il piatto
 {const k=ws.map(w=>plain(w)).reduce((a,w,i)=>INSERT_V.test(w)?i:a,-1);if(k>=0)ws=ws.slice(k+1)}
 while(ws.length&&FILL.has(plain(ws[0]!)))ws.shift()
 while(ws.length&&(FILL.has(plain(ws[ws.length-1]!))||PREP.has(plain(ws[ws.length-1]!))))ws.pop()
 return ws.join(' ').replace(/' /g,"'").replace(/^l'\s*/i,'').trim()}

export type InsertParse={lists:{secId:string|null,word:string,names:string[]}[],loose:string[]}
/** Liste per sottomenu del testo (già tolte le parole del Menu): «nei primi inserisci A, B e C e nei secondi D», «inserisci A e B nei
 * primi», «primi: A, B; secondi: C». `loose` = nomi senza sottomenu detto. */
export function parseInsert(text:string,secs:SectionRef[],menus:{name:string}[],known:string[]):InsertParse{
 const t=tokens(text),skip=menuSpans(t,menus),ms=mentions(t,secs,skip),W=t.map(x=>x.w)
 const keepTok=(k:number)=>!skip.has(k)&&!ms.some(m=>k>=m.i&&k<m.i+m.n)
 const seg=(a:number,b:number)=>{const ix:number[]=[];for(let k=a;k<b;k++)if(keepTok(k))ix.push(k);return ix.map(k=>t[k]!)}
 const namesOf=(x:Tok[])=>splitNames(x,known)
 if(!ms.length)return{lists:[],loose:namesOf(seg(0,t.length))}
 const verbBefore=t.slice(0,ms[0]!.i).some((x,k)=>!skip.has(k)&&INSERT_V.test(x.w)),before=verbBefore?namesOf(seg(0,ms[0]!.i)):[]
 // «inserisci A e B nei primi e C nei secondi»: i nomi stanno PRIMA del loro sottomenu (preposizione davanti alla parola).
 const prepBefore=(m:Mention)=>m.i>0&&/^(?:nei|negli|nelle|nel|nella|tra|fra|in|ai|agli|alle|al|alla|come|sotto|dentro)$/.test(W[m.i-1]!)||(m.i>1&&/^(?:i|gli|le)$/.test(W[m.i-1]!)&&/^(?:tra|fra|in)$/.test(W[m.i-2]!))
 const lists:InsertParse['lists']=[]
 const push=(m:Mention,names:string[])=>{const l=lists.find(x=>x.secId===m.secId&&x.word===m.word);if(l){for(const n of names)if(!l.names.includes(n))l.names.push(n)}else lists.push({secId:m.secId,word:m.word,names:[...names]})}
 if(before.length&&prepBefore(ms[0]!)){
  // stile «nomi → sottomenu»
  let start=0
  ms.forEach((m,j)=>{const names=namesOf(seg(start,m.i));push(m,names);start=m.i+m.n})
  const tail=namesOf(seg(start,t.length))
  // coda senza sottomenu dopo: «… nei secondi e anche C» → all'ultimo sottomenu detto
  if(tail.length)push(ms[ms.length-1]!,tail)
  return{lists:lists.filter(l=>l.names.length),loose:[]}}
 // stile «sottomenu → nomi»
 ms.forEach((m,j)=>{const end=j+1<ms.length?ms[j+1]!.i:t.length;push(m,namesOf(seg(m.i+m.n,end)))})
 // nomi prima del primo sottomenu senza preposizione davanti («carbonara e amatriciana primi»): restano senza sottomenu
 return{lists,loose:before}}

// ---------- azioni ----------
type MenuInfo={menu:RuleMenu,secs:SectionRef[],items:MenuRef[]}
function findExisting(name:string,secId:string|null,items:MenuRef[]):MenuRef|null{
 const all=items.filter(r=>sameName(r.name,name));if(!all.length)return null
 const pick=(xs:MenuRef[])=>xs.find(r=>!r.hidden)??xs[0]??null
 return pick(all.filter(r=>r.sectionId===secId))??pick(all)}
const accentize=(n:string,vocab:string[])=>{const acc=new Map(vocab.flatMap(v=>v.split(/\s+/)).filter(w=>plain(w)!==w.toLowerCase()).map(w=>[plain(w),w.toLowerCase()] as const));return n.split(' ').map(w=>acc.get(plain(w))??w).join(' ')}
const newName=(said:string,vocab:string[])=>capW(accentize(fixSpelling(said.toLowerCase(),vocab),vocab))
/** Sottomenu del Menu adatto a un piatto senza sottomenu detto (portata dal nome). */
function courseSection(name:string,secs:SectionRef[]):SectionRef|null{const c=dishCourse(name);if(!c)return null;const f=secs.filter(s=>sameSection(s.name,c));return f.length===1?f[0]!:null}

export type InsertBuild={actions:MenuAction[],sections:RuleSection[],unknownSecs:{word:string,names:string[]}[],notPlaced:string[],touched:Set<string>,needsPrice:string[]}
/** Azioni dell'inserimento: omonimo → visibile (e disponibile), nuovo → creato a 0 € (prezzo fisso). Mai altri Menu, mai altri piatti. */
export function buildInsert(info:MenuInfo,parse:InsertParse,vocab:string[]):InsertBuild{
 const fixed=info.menu.pricing==='fisso',actions:MenuAction[]=[],sections:RuleSection[]=[],unknownSecs:InsertBuild['unknownSecs']=[],notPlaced:string[]=[],touched=new Set<string>(),needsPrice:string[]=[],newKeys=new Set<string>()
 const secOut=(s:SectionRef)=>{let x=sections.find(y=>y.secId===s.id);if(!x){x={secId:s.id,name:s.name,created:[],shown:[],already:[]};sections.push(x)}return x}
 const place=(name:string,sec:SectionRef|null)=>{
  const ex=findExisting(name,sec?.id??null,info.items)
  if(ex){if(touched.has(ex.id))return;touched.add(ex.id);const s=info.secs.find(z=>z.id===ex.sectionId)!;if(!s)return
   if(ex.hidden||ex.available===false){if(ex.hidden)actions.push({kind:'hidden',id:ex.id,value:false} as MenuAction);if(ex.available===false)actions.push({kind:'available',id:ex.id,value:true} as MenuAction);secOut(s).shown.push(ex.name)}
   else secOut(s).already.push(ex.name);return}
  const target=sec??courseSection(name,info.secs)??(info.secs.length===1?info.secs[0]!:null)
  if(!target){notPlaced.push(newName(name,vocab));return}
  const nm=newName(name,vocab),key=target.id+'|'+norm(nm);if(newKeys.has(key))return;newKeys.add(key)
  if(!fixed){needsPrice.push(nm);return}
  actions.push({kind:'create',sectionId:target.id,name:nm,price:0,description:null} as MenuAction);secOut(target).created.push(nm)}
 for(const l of parse.lists){if(!l.secId){const nm=l.names.map(n=>newName(n,vocab));const u=unknownSecs.find(x=>x.word===l.word);if(u)u.names.push(...nm);else unknownSecs.push({word:l.word,names:nm});continue}
  const s=info.secs.find(z=>z.id===l.secId)!;for(const n of l.names)place(n,s)}
 for(const n of parse.loose)place(n,null)
 return{actions,sections,unknownSecs,notPlaced,touched,needsPrice}}

/** Azioni dello svuotamento: ogni piatto VISIBILE del Menu nascosto (tranne `keep`); sottomenu e Menu non si toccano mai. */
export function buildClear(info:MenuInfo,keep:Set<string>=new Set()):{actions:MenuAction[],names:string[]}{
 const vis=info.items.filter(r=>!r.hidden&&!keep.has(r.id));return{actions:vis.map(r=>({kind:'hidden',id:r.id,value:true}) as MenuAction),names:vis.map(r=>r.name)}}

// ---------- turno intero ----------
export type RuleInput={text:string,menus:RuleMenu[],sections:SectionRef[],refs:MenuRef[],history:{role:string,text:string,at:number}[],
 /** risposta a una domanda della regola (Menu o nomi) */
 wait?:RuleWait|null,
 /** bozza di piatto in sospeso («In quale sottomenu metto X?») */
 draftName?:string|null}
const infoOf=(m:RuleMenu,sections:SectionRef[],refs:MenuRef[]):MenuInfo=>({menu:m,secs:sections.filter(s=>s.menu===m.name),items:refs.filter(r=>r.menu===m.name)})
const hasDigits=(p:string)=>/\d/.test(p)
/** Indice (nelle parole) dove comincia la parte «inserisci» di un messaggio che svuota e inserisce insieme. */
function splitClearInsert(text:string,secNames:string[]):{clear:string,insert:string}{const ws=text.split(/(\s+)/),flat=ws.map(w=>plain(w))
 // si divide solo davanti a un verbo d'inserimento («… e nei primi inserisci …», «togli tutto e metti …»): mai su una parola di sottomenu
 // da sola («elimina tutti i primi» resta un comando su un sottomenu, non lo svuotamento del Menu)
 let v=-1;for(let i=0;i<ws.length;i++){const w=flat[i]!;if(w&&INSERT_V.test(w)){v=i;break}}
 if(v<0)return{clear:text,insert:''}
 const isSec=(w:string)=>COURSES.includes(w)||secNames.some(s=>plain(s).split(' ').length===1&&sameSection(s,w))
 const prevWord=(i:number)=>{let k=i-1;while(k>=0&&!flat[k]!.trim())k--;return k}
 let c=v,k=prevWord(c);if(k>=0&&isSec(flat[k]!)){c=k;let j=prevWord(c);while(j>=0&&PREP.has(flat[j]!)){c=j;j=prevWord(c)}}
 return{clear:ws.slice(0,c).join(''),insert:ws.slice(c).join('')}}

/** Il turno della regola: null = non è la regola (il messaggio va avanti come prima). */
export function ruleTurn(o:RuleInput):RuleResult|null{
 const text=o.text.replace(/[🎤]/gu,' ').trim(),p=plain(text);if(!p)return null
 const allSecNames=[...new Set(o.sections.map(s=>s.name))]
 const vocab=o.refs.map(r=>r.name)
 // 1) risposta alla domanda della regola
 if(o.wait?.kind==='menu'){const opts=o.menus.filter(m=>o.wait!.kind==='menu'&&(o.wait as any).options.includes(m.id)),num=p.match(/^(?:il |la |nel |numero )?(\d)$/)
  const hit=num?opts[Number(num[1])-1]:menusIn(text,opts).length===1?menusIn(text,opts)[0]:(()=>{const m=menusIn(text,o.menus);return m.length===1?m[0]:undefined})()
  if(hit)return runOn(hit,o.wait.text,o,true)
  return null}
 if(o.wait?.kind==='names'){const m=o.menus.find(x=>x.id===(o.wait as any).menuId),s=o.sections.find(x=>x.id===(o.wait as any).secId)
  if(m&&s&&!OTHER.test(p)&&!hasDigits(p)&&!CLEAR_V.test(p)&&!/\?/.test(text)){const info=infoOf(m,o.sections,o.refs),names=splitNames(tokens(text).filter((x,i,a)=>!menuSpans(a,o.menus).has(i)),vocab)
   if(names.length)return applyResult(info,{lists:[{secId:s.id,word:s.name,names}],loose:[]},null,vocab,text)}
  return null}
 if(NEG.test(p)||/\?\s*$/.test(text)||/\b(?:annull\w*|com e(?:ra)?|come prima|come era|indietro|ripristin\w*)\b/.test(p))return null
 // 2) bozza in sospeso («In quale sottomenu metto Nodino…?») + un Menu a prezzo fisso detto («nono devi guardare menu cena»)
 if(o.draftName&&!/\b(?:lascia\w*|stare|perdere|niente|no|annull\w*|basta)\b/.test(p)){const ms=menusIn(text,o.menus);if(ms.length===1&&ms[0]!.pricing==='fisso'&&!hasDigits(p)){const info=infoOf(ms[0]!,o.sections,o.refs),ip=parseInsert(text,info.secs,o.menus,vocab),secId=ip.lists.find(l=>l.secId)?.secId??null
   return applyResult(info,{lists:secId?[{secId,word:'',names:[o.draftName]}]:[],loose:secId?[]:[o.draftName]},null,vocab,text)}}
 const clr=clearIntent(text,allSecNames)||(()=>{const sp=splitClearInsert(text,allSecNames);return !!sp.insert&&clearIntent(sp.clear,allSecNames)})()
 // seguito senza verbo subito dopo una risposta della regola («e nei contorni patate al forno»): è ancora un inserimento
 const lastBot=[...o.history].filter(t=>t.role==='bot').sort((a,b)=>b.at-a.at)[0]?.text??''
 const follow=/(?:aggiornato|svuotato)\*/.test(lastBot)&&/^(?:e |ed |poi |anche |allora |ok )*(?:nei|negli|nelle|nel|tra i|tra le|per i|per le|come|i|gli|le)?\s*(?:primi|primo|secondi|secondo|contorni|contorno|dolci|dolce|antipasti|antipasto)\b/.test(p)
 const ins=(INSERT_V.test(p)||follow)&&!OTHER.test(p)&&!/\b(?:mettil[oaie]|mettel[oaie]|aggiungil[oaie]|inseriscil[oaie])\b/.test(p)
 if(!clr&&!ins)return null
 // la sostituzione giornaliera («stasera a cena metti primi …») resta la sua strada
 if(!clr&&!STRONG_INSERT.test(p)&&DAILY.test(p))return null
 if(!clr&&hasDigits(p))return null
 // Menu del messaggio, poi quello della conversazione
 const said=menusIn(text,o.menus)
 if(said.length===1)return runOn(said[0]!,text,o,follow)
 if(said.length>1){const ask=said.filter(m=>clr||o.sections.some(s=>s.menu===m.name));return askMenu(ask.length?ask:said,text)}
 const ctx=contextMenu(o.history,o.menus)
 if(ctx)return runOn(ctx,text,o,follow)
 // nessun Menu: per svuotare, i Menu con piatti visibili; per inserire, i Menu a prezzo fisso con i sottomenu detti
 if(clr){const c=o.menus.filter(m=>o.refs.some(r=>r.menu===m.name&&!r.hidden));if(c.length===1)return runOn(c[0]!,text,o,false);if(!c.length)return{kind:'info',text:'Non c’è nessun piatto visibile da togliere: il menu è già vuoto.'};return askMenu(c,text)}
 const fixed=o.menus.filter(m=>m.pricing==='fisso'),cands=fixed.filter(m=>{const ip=parseInsert(text,o.sections.filter(s=>s.menu===m.name),o.menus,vocab);return ip.lists.length>0&&ip.lists.every(l=>!!l.secId)})
 if(cands.length===1)return runOn(cands[0]!,text,o,false)
 if(cands.length>1)return askMenu(cands,text)
 return null}
function askMenu(ms:RuleMenu[],text:string):RuleResult{const opts=ms.slice(0,4)
 const q=opts.length===2?'Nel '+mLabel(opts[0]!.name)+' o nel '+mLabel(opts[1]!.name)+'?':'In quale Menu? '+orList(opts.map(m=>mLabel(m.name)))+'?'
 return{kind:'ask',question:q,wait:{kind:'menu',text:text.slice(0,600),options:opts.map(m=>m.id)}}}
function runOn(menu:RuleMenu,text:string,o:RuleInput,answer:boolean):RuleResult|null{
 const info=infoOf(menu,o.sections,o.refs),secNames=info.secs.map(s=>s.name),vocab=o.refs.map(r=>r.name)
 const allNames=secNames.length?secNames:[...new Set(o.sections.map(s=>s.name))],sp=splitClearInsert(text,allNames)
 let clr=false,insText=text,clearText=text
 if(sp.insert.trim()&&sp.clear.trim()&&clearIntent(sp.clear,allNames)){clr=true;insText=sp.insert;clearText=sp.clear}
 else if(clearIntent(text,allNames)){clr=true;insText='';clearText=text}
 // «togli tutto tranne la carbonara»: i piatti detti dopo «tranne» restano visibili
 let keepNames:string[]=[]
 if(clr){const m=clearText.match(/\b(?:tranne|eccetto|a parte|salvo|meno che|tranne che)\b(.*)$/i);if(m){keepNames=splitNames(tokens(m[1]!),vocab);clearText=clearText.slice(0,m.index)}}
 const p=plain(insText)
 let parse:InsertParse={lists:[],loose:[]}
 if(insText.trim()&&(INSERT_V.test(p)||clr||answer)){parse=parseInsert(insText,info.secs,o.menus,vocab)
  // «nei primi inserisci» senza nomi: si chiedono i nomi (una riga)
  if(!clr&&!parse.loose.length&&parse.lists.length===1&&!parse.lists[0]!.names.length&&parse.lists[0]!.secId){const s=info.secs.find(x=>x.id===parse.lists[0]!.secId)!;return{kind:'ask',question:'Cosa inserisco nei *'+s.name+'* del '+mLabel(menu.name)+'? Scrivimi i piatti, per esempio «carbonara, lasagne».',wait:{kind:'names',menuId:menu.id,secId:s.id}}}
  parse={lists:parse.lists.filter(l=>l.names.length||!l.secId),loose:parse.loose}}
 if(!clr){if(!parse.lists.length&&!parse.loose.length)return null
  // senza sottomenu detto si va avanti solo con un Menu a prezzo fisso detto, o con nomi che sono tutti piatti di questo Menu
  if(!parse.lists.length&&!(menusIn(text,o.menus).some(m=>m.id===menu.id)&&menu.pricing==='fisso')&&!parse.loose.every(n=>!!findExisting(n,null,info.items))&&!answer)return null}
 return applyResult(info,parse,clr?{deleteWord:/\b(?:elimin\w*|cancell\w*)\b/.test(plain(clearText)),keep:keepNames}:null,vocab,text)}
function applyResult(info:MenuInfo,parse:InsertParse,clear:{deleteWord:boolean,keep?:string[]}|null,vocab:string[],text:string):RuleResult|null{
 // un «nome» con dentro un verbo o una frase («restano uguali», «toglila», «aspetta») non è un piatto: decide il resto del flusso
 if([...parse.lists.flatMap(l=>l.names),...parse.loose].some(n=>NOT_DISH.test(plain(n))))return null
 const b=buildInsert(info,parse,vocab)
 // Menu alla carta: un piatto nuovo vuole il prezzo → resta il percorso di prima (domanda del prezzo), salvo lo svuotamento
 if(b.needsPrice.length&&!clear)return null
 const keep=new Set(b.touched),notFound:string[]=[]
 for(const n of clear?.keep??[]){const ex=findExisting(n,null,info.items);if(ex&&!ex.hidden)keep.add(ex.id);else notFound.push(newName(n,vocab))}
 const cl=clear?buildClear(info,keep):{actions:[],names:[]}
 const actions=[...cl.actions,...b.actions]
 const report:RuleReport={menu:info.menu.name,fixed:info.menu.pricing==='fisso',cleared:cl.names,deleteWord:!!clear?.deleteWord,sections:b.sections,unknownSecs:b.unknownSecs,notPlaced:[...b.notPlaced,...b.needsPrice],notFound,kept:[...keep].filter(id=>!b.touched.has(id)).map(id=>info.items.find(r=>r.id===id)?.name??'').filter(Boolean)}
 if(!actions.length){
  if(clear&&!b.sections.length)return{kind:'info',text:'Il '+mLabel(info.menu.name)+' è già vuoto: nessun piatto visibile, non ho cambiato nulla. Scrivimi i piatti nuovi, per esempio «nei primi inserisci carbonara, lasagne».'}
  return{kind:'info',text:ruleReply(report,info.items,[],false)}}
 return{kind:'apply',menu:info.menu,actions,report}}

// ---------- risposta (formato strutturato v164) ----------
/** Testo della risposta: titolo per Menu, blocchi per sottomenu con un piatto per riga, note su ciò che non è entrato, «annulla». */
export function ruleReply(r:RuleReport,itemsBefore:MenuRef[],actions:MenuAction[],wrote=true,extra=''):string{
 const out:string[]=[],secNames=[...new Set(itemsBefore.map(i=>i.sectionId))]
 const visibleAfter=(secId:string)=>{const vis=itemsBefore.filter(i=>i.sectionId===secId&&!actions.some(a=>a.kind==='hidden'&&(a as any).id===i.id&&(a as any).value)&&(!i.hidden||actions.some(a=>a.kind==='hidden'&&(a as any).id===i.id&&!(a as any).value))).map(i=>i.name)
  return [...vis,...actions.filter(a=>a.kind==='create'&&a.sectionId===secId).map(a=>(a as any).name as string)]}
 void secNames
 const ins=r.sections.filter(s=>s.created.length||s.shown.length||s.already.length)
 if(r.cleared.length&&!ins.length){
  out.push('*'+(/^men[uù]\b/i.test(r.menu.trim())?r.menu.trim():'Menu '+r.menu.trim())+' svuotato*')
  const secs=[...new Set(itemsBefore.map(i=>i.section??'').filter(Boolean))]
  out.push('Ho nascosto '+(r.kept?.length?(r.cleared.length===1?'1 piatto':r.cleared.length+' piatti'):r.cleared.length===1?'l’unico piatto visibile':'tutti i '+r.cleared.length+' piatti visibili')+(r.deleteWord?' (nascosti, non eliminati: tornano quando li rimetti)':'')+'. '+(secs.length?'I sottomenu ('+andList(secs)+')':'I sottomenu')+(r.fixed?' e i prezzi fissi restano':' restano')+' come sono.')
  out.push('Ora scrivimi i piatti nuovi, per esempio «nei primi inserisci carbonara, lasagne».')}
 else if(ins.length&&!wrote&&ins.every(x=>!x.created.length&&!x.shown.length)){const alr=ins.flatMap(x=>x.already.map(n=>'*'+n+'*'+' ('+x.name+')'))
  out.push((alr.length===1?alr[0]+' è già nel ':andList(alr)+' sono già nel ')+mLabel(r.menu)+': non ho cambiato nulla.')}
 else if(ins.length){
  out.push('*'+(/^men[uù]\b/i.test(r.menu.trim())?r.menu.trim():'Menu '+r.menu.trim())+' aggiornato*')
  if(r.cleared.length)out.push('Ho nascosto gli altri '+(r.cleared.length===1?'piatto':r.cleared.length+' piatti')+' del menu'+(r.deleteWord?' (nascosti, non eliminati)':'')+'.')
  for(const s of ins){const vis=visibleAfter(s.secId),created=new Set(s.created)
   out.push('*'+s.name+'*\n'+(vis.length?vis.map(n=>'• '+n+(created.has(n)?' (nuovo)':'')).join('\n'):'• nessun piatto'))}
  }
 const secList=andList([...new Set(itemsBefore.map(i=>i.section??'').filter(Boolean))].map(x=>'*'+x+'*'))
 for(const u of r.unknownSecs)out.push('Non ho messo '+andList(u.names.map(n=>'*'+n+'*'))+': nel '+mLabel(r.menu)+' non c’è il sottomenu *'+capW(u.word)+'*'+(secList?' (ci sono '+secList+')':'')+'. Dimmi in quale metterl'+(u.names.length>1?'i':'o')+'.')
 if(r.kept?.length)out.push('Restano visibili: '+andList(r.kept.map(n=>'*'+n+'*'))+'.')
 if(r.notFound?.length)out.push('Non trovo nel '+mLabel(r.menu)+' '+andList(r.notFound.map(n=>'*'+n+'*'))+': non l'+(r.notFound.length>1?'i':'o')+' ho toccat'+(r.notFound.length>1?'i':'o')+'.')
 if(r.notPlaced.length)out.push('Non ho messo '+andList(r.notPlaced.map(n=>'*'+n+'*'))+': dimmi in quale sottomenu'+(secList?' ('+secList.replace(/ e (?=\*[^*]+\*$)/,' o ')+')':'')+', per esempio «nei '+(plain([...new Set(itemsBefore.map(i=>i.section??'').filter(Boolean))][0]??'primi'))+' inserisci '+r.notPlaced[0]!.toLowerCase()+'».')
 if(extra)out.push(extra)
 if(wrote)out.push('Per tornare come prima scrivi *annulla* entro 10 minuti.')
 return out.join('\n\n')}

// ---------- sostituzione giornaliera letta dal server (bug 16:37 Victoria «trovo più sottomenu Primi») ----------
/** «stasera a cena metti primi: A e B, secondi C, contorni D» / «nel menu del giorno primi carbonara e pasta e fagioli»: Menu a prezzo
 * fisso DETTO nel messaggio + liste per sottomenu che sono tutte sottomenu di quel Menu, nessun altro comando. null = resta al modello. */
export function dailyReplaceParse(text:string,menus:RuleMenu[],sections:SectionRef[],refs:MenuRef[]):{menu:RuleMenu,lists:{secId:string,names:string[]}[]}|null{
 const p=plain(text);if(STRONG_INSERT.test(p)||OTHER.test(p)||hasDigits(p)||NEG.test(p)||CLEAR_V.test(p)||/\?/.test(text))return null
 const ms=menusIn(text,menus);if(ms.length!==1||ms[0]!.pricing!=='fisso')return null
 const m=ms[0]!,secs=sections.filter(s=>s.menu===m.name),ip=parseInsert(text,secs,menus,refs.map(r=>r.name))
 if(!ip.lists.length||ip.loose.length||ip.lists.some(l=>!l.secId||!l.names.length))return null
 return{menu:m,lists:ip.lists.map(l=>({secId:l.secId!,names:l.names}))}}
