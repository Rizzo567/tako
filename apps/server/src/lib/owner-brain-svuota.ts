/** Regola d'uso 22/10/2026 (decisione Manuel dopo la prova con Gio, Victoria Bar). Modulo PURO: niente DB, niente rete, niente modello.
 * CORREZIONE 22/10 notte (Manuel, vincolante): per i piatti «nascondere» non esiste più → i piatti tolti si ELIMINANO definitivamente.
 * - «togli tutti i piatti del menu pranzo», «svuota il menu cena», «leva tutti i piatti…», «nascondi tutto» = ELIMINA tutti i piatti di quel
 *   Menu. Sottomenu, Menu e prezzi fissi restano; subito, nessuna domanda («annulla» 10 minuti li ricrea identici: snapshot dei Menu).
 * - «togli tutto il menu pranzo» / «elimina il menu pranzo» = il Menu intero, SOLO col «sì» scritto (deleteMenuIntent).
 * - «nei primi inserisci A, B, C», «nei secondi D e E», «contorni F» (anche tutto insieme, anche in vocale) = nel sottomenu del Menu di cui
 *   si parla: omonimo già lì → non si duplica (un vecchio piatto nascosto da prima torna nel menu), nuovo → creato senza prezzo (Menu a
 *   prezzo fisso). «Inserisci» NON tocca gli altri piatti (la sostituzione giornaliera «oggi a pranzo primi …» elimina i non nominati).
 * - Menu: quello detto nel messaggio («a cena», «menu del giorno», «pranzo» → il Menu del pranzo/giorno), altrimenti l'ultimo nominato
 *   nella conversazione; se resta ambiguo una domanda di una riga («Nel *Menu Giorno* o nel *Menu Cena*?»).
 * Invarianti (batteria avversaria 22/10): mai sottomenu o Menu eliminati/nascosti (senza il «sì»), mai piatti di altri Menu, mai «hidden» prodotto, ogni nome detto è inserito o
 * segnalato nella risposta, prezzi fissi intatti, «annulla» rimette esattamente com'era (undo generico della pubblicazione). */
import {plain,g9Prices,type MenuRef,type SectionRef,type MenuAction} from './twilio-menu-ai.js'
import {sameSection} from './twilio-menu-structure.js'
import {namedMenus,dishCourse,singlePrice} from './owner-brain-sera.js'
import {isAffirmative} from './owner-brain-r.js'
import {splitPieces,doubtReadings,doubtQuestion,isContorniSection,isContornoWord,doubtAnswer,parseCorrection,correctionPlan,correctionReply,ruleFromAnswer,type Lexicon,type SplitRule} from './dish-split.js'

export type RuleMenu={id:string,name:string,pricing?:'carta'|'fisso',active?:boolean,formulas?:{name:string,price:number}[]}
export type Doubt={text:string,one:string,parts:string[]}
/** 23/10: `split` = domanda «"X e Y": 1 piatto o 2?» su un pezzo dubbio (gli altri piatti del messaggio sono già scritti). */
/** `names.ctx` (28/10 sera, chat di Luisa): sottomenu appena svuotato («elimina secondi menù sera» → «Ora scrivimi i piatti nuovi»), il
 * prossimo «inserisci …» senza sottomenu va lì; non è una domanda (`RuleAsk.silent`). */
export type RuleWait={kind:'menu',text:string,options:string[],del?:boolean}|{kind:'names',menuId:string,secId:string,ctx?:boolean}|{kind:'propose',menuId:string,clearIds:string[],lists:{secId:string,names:string[]}[]}|{kind:'split',menuId:string,items:(Doubt&{secId:string})[]}|{kind:'swap',text:string,word:string,options:string[]}
export type RuleSection={secId:string,name:string,created:string[],shown:string[],already:string[]}
export type RuleReport={menu:string,fixed:boolean,cleared:string[],deleteWord:boolean,sections:RuleSection[],unknownSecs:{word:string,names:string[]}[],notPlaced:string[],notFound?:string[],kept?:string[],
 /** 23/10 (chat Luisa): sottomenu svuotati («elimina i primi»), non il Menu intero */
 clearedSecs?:{secId:string,name:string}[],
 /** 24/10: piatti tolti da una sostituzione «togli X metti Y» */
 swapOut?:string[],
 /** 24/10: piatti segnati finiti nella stessa frase della sostituzione */
 soldOut?:string[]}
export type RuleAsk={question:string,wait:RuleWait,silent?:boolean}
/** `learn` = regole di divisione da salvare nel lessico del locale (23/10); `ask` = domanda sul pezzo dubbio DOPO aver scritto il resto;
 * `fix` = correzione della divisione («coppa è un piatto a parte»), testo già pronto. */
export type RuleResult={kind:'delete_menu',menu:RuleMenu,items:number,sections:string[]}|{kind:'apply',menu:RuleMenu,actions:MenuAction[],report:RuleReport,ask?:RuleAsk|null,learn?:SplitRule[]}|{kind:'ask',question:string,wait:RuleWait,learn?:SplitRule[]}|{kind:'info',text:string,learn?:SplitRule[]}|{kind:'fix',actions:MenuAction[],reply:string,learn:SplitRule[]}
 /** 23/10: sottomenu di un Menu alla carta da svuotare: serve il «sì» (proposta di eliminazione con l'elenco). */
 |{kind:'confirm',menu:RuleMenu,actions:MenuAction[],question:string}

// ---------- Menu di cui si parla ----------
const LUNCH=/ (?:pranzo|pranzi|mezzogiorno|mezzo giorno) /,DINNER=/ (?:cena|cene|stasera|stassera|sera|serale) /
const isLunch=(m:{name:string})=>/\b(?:pranz\w*|giorno|mezzogiorno)\b/.test(plain(m.name)),isDinner=(m:{name:string})=>/\b(?:cen[ae]|sera\w*)\b/.test(plain(m.name))
/** Menu nominati nel testo: il nome («menu cena», «menu del giorno») o la parola del pasto («a pranzo» → il Menu del pranzo/giorno). */
export function menusIn<T extends {name:string}>(text:string,menus:T[]):T[]{
 text=fixMealWords(text) // 24/10: «mezzogirno», «pranzzo», «da 12 …» a inizio messaggio
 const direct=namedMenus(text,menus),byPrice=menusByPrice(text,menus)
 if(direct.length)return [...new Set([...direct,...byPrice])]
 const p=' '+plain(text)+' ',out:T[]=[]
 if(LUNCH.test(p))out.push(...menus.filter(isLunch))
 if(DINNER.test(p))out.push(...menus.filter(isDinner))
 // 23/10 (chat Luisa «nel menù pranzo da 12», «menù mezzogiorno da 12 euro»): il prezzo del Completo indica il Menu a prezzo fisso.
 // Se pasto e prezzo indicano Menu diversi restano entrambi (ambiguo → domanda); se coincidono, uno solo.
 if(byPrice.length&&out.length&&byPrice.some(m=>out.includes(m)))return out.filter(m=>byPrice.includes(m))
 out.push(...byPrice)
 return [...new Set(out)]}
/** «menu da 12», «pranzo da 12 euro», «menù da 16,90 €»: il Menu a prezzo fisso il cui *Completo* costa quella cifra (se un Menu non ha
 * un'opzione «Completo», vale la sua opzione più cara). Serve una parola di Menu/pasto subito prima di «da N». */
const MENU_PRICE=/(?:^|[^a-zà-ù])(?:men[uù]|pranzo|cena|mezzogiorno|giorno|sera|fisso)\s+(?:[a-zà-ù']+\s+){0,2}?da\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:euro|eur|€)?/gi
export function menusByPrice<T extends {name:string}>(text:string,menus:T[]):T[]{
 const out:T[]=[]
 for(const m of text.matchAll(MENU_PRICE)){const n=Number(m[1]!.replace(',','.'));if(!(n>0))continue
  for(const x of menus){const fs=((x as any).formulas??[]) as {name:string,price:number}[];if(!fs.length||(x as any).pricing==='carta')continue
   const comp=fs.find(f=>plain(f.name)==='completo')??[...fs].sort((a,b)=>b.price-a.price)[0]!;if(Math.abs(Number(comp.price)-n)<0.005&&!out.includes(x))out.push(x)}}
 return out}
/** Il testo senza «da N (euro)» detto come prezzo di un Menu (così «euro» e le cifre non sembrano un comando di prezzo). A capo e doppi
 * spazi restano: sono separatori tra piatti. */
export function stripMenuPrice(text:string,menus:{name:string}[]):string{
 return text.replace(MENU_PRICE,(all,n)=>{const v=Number(String(n).replace(',','.'));const hit=menus.some(x=>{const fs=((x as any).formulas??[]) as {name:string,price:number}[];if(!fs.length)return false;const comp=fs.find(f=>plain(f.name)==='completo')??[...fs].sort((a,b)=>b.price-a.price)[0]!;return Math.abs(Number(comp.price)-v)<0.005})
  return hit?all.replace(/\s*da\s+\d{1,3}(?:[.,]\d{1,2})?\s*(?:euro|eur|€)?\s*$/i,' '):all}).trim()}
/** Ultimo Menu nominato nella conversazione (turni più recenti prima): un turno del titolare con più Menu = ambiguo (null). */
export function contextMenu<T extends {name:string}>(turns:{role:string,text:string,at:number}[],menus:T[],recent?:number):T|null{
 const all=[...turns].sort((a,b)=>b.at-a.at),now=Date.now()
 // `recent` (23/10, batteria v181): solo gli ultimi N turni degli ultimi 10 minuti (mai il Menu di una conversazione di prima).
 // 28/10 sera: i 10 minuti contano da adesso, non dall'ultimo turno salvato.
 for(const t of recent?all.slice(0,recent).filter(x=>now-x.at<=10*60*1000):all){const m=menusIn(t.text,menus);if(m.length===1)return m[0]!;if(m.length>1&&t.role==='owner')return null}
 return null}
const mLabel=(n:string)=>/^men[uù]\b/i.test(n.trim())?'*'+n.trim()+'*':'Menu *'+n.trim()+'*'
const orList=(xs:string[])=>xs.length<=1?xs.join(''):xs.slice(0,-1).join(', ')+' o '+xs[xs.length-1]
const andList=(xs:string[])=>xs.length<=1?xs.join(''):xs.slice(0,-1).join(', ')+' e '+xs[xs.length-1]

// ---------- parole ----------
const COURSES=['primi','primo','secondi','secondo','contorni','contorno','dolci','dolce','dessert','antipasti','antipasto','pizze','pizza','insalate','insalatone','panini','bevande','frutta','piatti unici','piatto unico','zuppe','minestre']
const CLEAR_V=/\b(?:svuot\w*|togli\w*|toglie\w*|lev[ai]\w*|levare|levamo|levate|nascond\w*|rimuov\w*|elimin\w*|cancell\w*|sgombr\w*)\b/
const INSERT_V=/\b(?:inser(?:isc|ic|is|isci|iamo|ire|ite)\w*|ag+iung\w*|metti|mettici|mettete|mettiamo|mettere|mettimi|ci vanno|ci va)\b/
const STRONG_INSERT=/\b(?:inser(?:isc|ic|is|isci|iamo|ire|ite)\w*|ag+iung\w*)\b/
const NOT_DISH=/\b(?:capisc\w*|capit[oa]|aiut\w*|grazie|ciao|zero|gratis|tutto|niente|nulla|prezz\w*|restan\w*|resta|rimang\w*|uguali|uguale|togli\w*|nascond\w*|lascia\w*|cambi\w*|elimin\w*|cancell\w*|annull\w*|aspett\w*|scusa|sbagliat\w*|prezz\w*|cost[ao]|costano|euro|finit\w*|esaurit\w*|svuot\w*|leva\w*|rimuov\w*|cosa|quale|quali|perche|come prima|com era)\b/
/** 24/10: parole di domanda («cosa c'è nei primi a pranzo», «quali secondi ci sono stasera») */
const QUESTION_W=/^(?:(?:ma|e|allora|senti|scusa|ok)\s+)*(?:cosa|che cosa|che|quali?|quant\w*|come|dove|perche|mi dici|dimmi|fammi vedere|mostrami|leggimi|c e|ci sono|hai|abbiamo)\b|\b(?:c e|ci sono|cosa)\b/
/** 28/10 sera: comandi che non sono un elenco di piatti (dopo «Ora scrivimi i piatti nuovi» senza «inserisci»). */
const CTX_OTHER=/\b(?:rimett\w*|mostr\w*|spost\w*|cambi\w*|rinomin\w*|mand\w*|invi\w*|manda\w*|dimmi|scriv\w*|vorrei|voglio|puoi|ricord\w*|annull\w*|anteprim\w*|stamp\w*|pdf|link|grazie|ok|perfetto|fatto|basta)\b/
const DAILY=/\b(?:oggi|stasera|stassera|stamattina|domani|stamani)\b/
const NEG=/\b(?:non|nun)\s+(?:(?:li|le|lo|la|ci|mi|piu)\s+)?(?:togli|lev|nascond|svuot|elimin|cancell|rimuov|mett|inser|aggiung)/
/** Altri comandi nello stesso messaggio: prezzi, esaurito, foto, eliminazione di un piatto, rinomina → non è la regola (resta il resto). */
const OTHER=/\b(?:euro|prezz\w*|cost\w*|finit\w*|esaurit\w*|foto|rinomin\w*|spost\w*|evidenz\w*|promo\w*|sconto|scont\w*|alz\w*|abbass\w*|aument\w*|diminu\w*)\b|€/
const PREP=new Set(['del','della','dello','dell','all','nell','sull','nei','negli','nelle','nel','nella','nello','tra','fra','in','i','gli','le','per','come','di','dei','delle','degli','ai','agli','alle','al','alla','sui','sugli','sulle','il','lo','la','l','da','dai','dagli','dalle','dal','dalla'])
const FILL=new Set(['inserici','agiungi','ehm','beh','mah','insomma','inserisci','inserire','inseriamo','inserite','aggiungi','aggiungere','aggiungiamo','aggiungete','aggiungo','metti','mettici','mettete','mettiamo','mettere','mettimi','rimetti','rimettici','rimettere','ci','vanno','va','anche','pure','poi','e','ed','solo','soltanto','invece','il','lo','la','l','i','gli','le','un','uno','una','di','oggi','stasera','per','favore','grazie','ok','allora','dai','adesso','ora','quindi','sono','abbiamo','c','ce','cioe','tipo','sotto','dentro','nei','negli','nelle','nel','nella','tra','fra','in','ai','agli','alle','al','alla','con','da','che','mentre','invece','piatti','piatto','questi','queste','seguenti','se','puoi','potresti','voglio','vorrei','bisogna','devi','dobbiamo','facciamo','fai','scrivi','scrivimi','metto','inserisco','no','aspetta','scusa','anzi','ecco','ciao','senti','guarda','ah','eh','dunque','perfetto','bene','benissimo','esatto','mi','raccomando','subito','tutti','tutte','questo','quello','cosa','cose','vorremmo','volevo','bisogna','serve','servono','mettere','ricorda'])
const SKIP=new Set(['niente','nulla','basta','ok','si','no','grazie','altro','tutto','tutti'])
// DEFAULT_PROTECT → LOCUTIONS in dish-split.ts (23/10, lista curata più ampia)
// Parola che apre il nome di un piatto (per i vocali senza virgole: «pasta alla carbonara linguine» = due piatti).
const HEAD=new Set(['carbonara','amatriciana','gricia','strozzapreti','cavatelli','pici','tonnarelli','maltagliati','garganelli','casarecce','farfalle','ziti','calamarata','conchiglie','gnocchetti','agnolotti','cappelletti','fregola','malloreddus','passatelli','tagliolini','spaghettoni','vermicelli','sedanini','scialatielli','mezzemaniche','caserecce','culurgiones','ravioloni','tortelli','lasagnette','crespelle','pasta','spaghetti','linguine','tagliatelle','pappardelle','fettuccine','penne','fusilli','rigatoni','paccheri','tortellini','tortelloni','ravioli','gnocchi','risotto','riso','lasagna','lasagne','orecchiette','trofie','bucatini','tortiglioni','cannelloni','maccheroni','mezze','minestrone','minestra','zuppa','vellutata','tagliata','cotoletta','cotolette','scaloppine','scaloppina','orata','branzino','salsiccia','salsicce','pollo','polpette','frittata','insalata','insalatona','nodino','filetto','bistecca','arrosto','hamburger','spezzatino','involtini','frittura','fritto','patate','patatine','parmigiana','bruschetta','bruschette','tiramisu','polenta','caprese','vitello','stinco','grigliata','calzone'])
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
 // «svuota primi», «svuota i secondi della cena»: un sottomenu, non il Menu intero (resta il percorso di prima)
 if(/\bsvuot\w*\b/.test(p))return !p.split(' ').some(w=>COURSES.includes(w)||secNames.some(x=>plain(x).split(' ').length===1&&sameSection(x,w)))
 if(!CLEAR_V.test(p)||!/\btutt[oaie]\b/.test(p))return false
 if(/\btutt[oaie] e (?:due|tre|2|3)\b|\bentramb\w*/.test(p))return false
 return !notWholeMenu(p,secNames)}

/** Correzione di Manuel 22/10 sera: «togli tutto il menu pranzo», «elimina il menu pranzo», «cancella il menù cena» = il MENU intero da
 * eliminare (con il «sì» scritto), NON lo svuotamento. «tutti i piatti del menu X», «svuota», «nascondi tutto», «togli tutto dal menu X»,
 * «… tranne …» restano lo svuotamento. */
export function deleteMenuIntent(text:string):boolean{const p=plain(text);if(!p||NEG.test(p))return false
 if(/\b(?:piatt\w*|tranne|eccetto|a parte|salvo|nascond\w*|svuot\w*|foto|prezz\w*|sottomenu|sezion\w*|categori\w*)\b/.test(p))return false
 return /\b(?:togli\w*|toglie\w*|lev[ai]\w*|levare|elimin\w*|cancell\w*|rimuov\w*|butta\w*)\s+(?:(?:proprio|anche|pure|completamente|del tutto)\s+)?(?:tutto\s+)?(?:(?:il|l)\s+)?(?:intero\s+)?menu\b/.test(p)}
const delMenuResult=(m:RuleMenu,o:{sections:SectionRef[],refs:MenuRef[]}):RuleResult=>({kind:'delete_menu',menu:m,items:o.refs.filter(r=>r.menu===m.name).length,sections:o.sections.filter(s=>s.menu===m.name).map(s=>s.name)})
export function deleteMenuQuestion(r:{menu:RuleMenu,items:number,sections:string[]}):string{
 return 'Elimino il '+mLabel(r.menu.name)+' intero? Spariscono '+(r.sections.length?'i sottomenu '+andList(r.sections.map(x=>'*'+x+'*'))+', ':'')+(r.items===1?'1 piatto':r.items+' piatti')+(r.menu.pricing==='fisso'?' e i prezzi fissi':'')+'. Rispondi *sì* per eliminarlo, oppure *no*.\n\nSe vuoi solo togliere i piatti e tenere i sottomenu scrivi «togli tutti i piatti del '+r.menu.name.replace(/^men[uù]\s+/i,'menu ').toLowerCase()+'».'}

// ---------- lettura delle liste ----------
type Tok={w:string,raw:string}
// 23/10 (chat Luisa): il doppio spazio fra due parole è un separatore tra piatti (come la virgola).
const tokens=(text:string):Tok[]=>{const s=text.replace(/[🎤*_~`"“”«»]/gu,' ').replace(/(\S)[ \t\u00a0]{2,}(?=\S)/g,'$1 , ').replace(/[’`]/g,"'").replace(/\n+/g,' ; ').replace(/([,;:.!?])/g,' $1 ').replace(/\s+/g,' ').trim()
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
const NOT_SEC_W=new Set(['prima','prime','seconda','seconde','primavera'])
/** Parole di sottomenu nel testo: i sottomenu del Menu (anche al singolare) e le portate comuni che nel Menu non ci sono. */
function mentions(t:Tok[],secs:SectionRef[],skip:Set<number>):Mention[]{const out:Mention[]=[],W=t.map(x=>x.w)
 const words=(n:string)=>plain(n).split(' ').filter(Boolean)
 for(let i=0;i<W.length;i++){if(skip.has(i))continue;const w=W[i]!
  const multi=secs.find(s=>{const ws=words(s.name);return ws.length>1&&ws.every((x,k)=>W[i+k]===x||(k===0&&sameSection(x,W[i+k]??'')))})
  if(multi){const n=words(multi.name).length;out.push({i,n,secId:multi.id,word:multi.name});i+=n-1;continue}
  // anche con una lettera sbagliata nei vocali («secodi», «contormi»): parole di almeno 5 lettere
  // 28/10 sera (chat di Luisa): «prima/seconda» non sono mai un sottomenu, nemmeno per sameSection: «Per tornare come prima scrivi
  // annulla» in fondo alla risposta del bot diventava l'ultimo sottomenu nominato (Primi) e l'«inserisci» seguente finiva nei Primi.
  if(NOT_SEC_W.has(w))continue
  const single=secs.filter(x=>words(x.name).length===1&&(sameSection(x.name,w)||(w.length>=5&&!PREP.has(w)&&!FILL.has(w)&&(lev1(plain(x.name),w)||lev1(plain(x.name).replace(/i$/,'o'),w)))))
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
/** Nomi dei piatti di un pezzo di testo: virgole/a capo dividono sempre; la «e» divide secondo dish-split.ts (lessico del locale,
 * locuzioni, indizi; 23/10), e nei vocali senza virgole un nuovo piatto comincia quando compare una parola che apre un piatto
 * («pasta alla carbonara linguine»). `ask`: i pezzi dubbi NON diventano nomi, tornano in `doubts` (si chiede «1 piatto o 2?»). */
export type SplitOpts={lexicon?:Lexicon|null,section?:string|null,ask?:boolean}
/** `guessed` (28/10 sera): almeno un confine tra piatti è stato indovinato da una parola che apre un piatto, senza virgola né a capo. */
export function splitNamesX(seg:Tok[],known:string[],o:SplitOpts={}):{names:string[],doubts:Doubt[],guessed:boolean}{
 const W=seg.map(x=>x.w),R=seg.map(x=>x.raw),lex:Lexicon={names:[...new Set([...known,...(o.lexicon?.names??[])])],rules:o.lexicon?.rules??[]}
 const out:string[]=[],doubts:Doubt[]=[],txt=(ix:number[])=>ix.map(x=>R[x]).join(' ').replace(/' /g,"'");let guessed=false
 // nei Contorni anche un ortaggio/contorno semplice apre un piatto nuovo («insalata funghi misti e peperoni» detto a voce)
 const ctn=isContorniSection(o.section),hd=(k:number)=>isHead(W,k)||(ctn&&isContornoWord(W[k]!))
 // 28/10 sera (chat di Luisa «impepata di cozze Fritto di anelli…  Scaloppine al vino bianco Nodino alla griglia»): una maiuscola a metà
 // pezzo dopo una parola piena in minuscolo (mai il Title Case «Insalata Mista») è il probabile inizio di un altro piatto. È solo un indizio: il confine risulta indovinato (`guessed`) e
 // l'elenco si fa confermare prima di scrivere.
 const capStart=(p:number[],j:number)=>j>0&&/^\p{Lu}\p{Ll}/u.test(R[p[j]!]??'')&&/^\p{Ll}/u.test(R[p[j-1]!]??'')&&!PREP.has(W[p[j-1]!]??'')&&!['e','ed','con','di','da','a','in'].includes(W[p[j-1]!]??'')
 const headCut=(p:number[])=>{let cut:number[]=[];for(let j=0;j<p.length;j++){const k=p[j]!
   if(cut.length&&capStart(p,j)&&cut.some(x=>!FILL.has(W[x]!)&&!INSERT_V.test(W[x]!)&&!SKIP.has(W[x]!))){out.push(txt(cut));cut=[];guessed=true}
   else if(cut.length&&hd(k)&&cut.some(x=>hd(x))&&!PREP.has(W[p[j-1]!]??'')&&W[p[j-1]!]!=='e'&&W[p[j-1]!]!=='ed'&&W[p[j-1]!]!=='con'&&!known.some(n=>norm(n)===cut.map(x=>W[x]).concat(W[k]!).join(' '))){out.push(txt(cut));cut=[];guessed=true}
   cut.push(k)}
  if(cut.length)out.push(txt(cut))}
 const flushPart=(ix:number[])=>{if(!ix.length)return;const Wp=ix.map(k=>W[k]!)
  for(const pc of splitPieces(Wp,{lexicon:lex,section:o.section??null},!!o.ask)){const abs=pc.ix.map(j=>ix[j]!)
   if(pc.doubt&&o.ask){const rd=doubtReadings(Wp,pc),one=clean(txt(rd.one.map(j=>ix[j]!))),parts=rd.parts.map(x=>clean(txt(x.map(j=>ix[j]!)))).filter(Boolean)
    if(one&&parts.length>1&&!SKIP.has(plain(one))){doubts.push({text:one,one,parts});continue}}
   headCut(abs)}}
 let cur:number[]=[]
 for(let k=0;k<W.length;k++){if(W[k]===','||W[k]===';'||W[k]===':'){flushPart(cur);cur=[];continue}cur.push(k)}
 flushPart(cur)
 return{names:out.map(clean).filter(n=>!!n&&!SKIP.has(plain(n))),doubts,guessed}}
export function splitNames(seg:Tok[],known:string[],o:Omit<SplitOpts,'ask'>={}):string[]{return splitNamesX(seg,known,{...o,ask:false}).names}
const clean=(n:string)=>{let ws=n.replace(/\s+/g,' ').trim().split(' ').filter(Boolean)
 // «secodi inserisci orata»: un verbo d'inserimento dentro il nome = quello che c'è prima non è il piatto
 {const k=ws.map(w=>plain(w)).reduce((a,w,i)=>INSERT_V.test(w)?i:a,-1);if(k>=0)ws=ws.slice(k+1)}
 while(ws.length&&FILL.has(plain(ws[0]!)))ws.shift()
 while(ws.length&&(FILL.has(plain(ws[ws.length-1]!))||PREP.has(plain(ws[ws.length-1]!))))ws.pop()
 return ws.join(' ').replace(/' /g,"'").replace(/^l'\s*/i,'').trim()}

export type InsertParse={lists:{secId:string|null,word:string,names:string[],doubts?:Doubt[]}[],loose:string[],guessed?:boolean}
/** Liste per sottomenu del testo (già tolte le parole del Menu): «nei primi inserisci A, B e C e nei secondi D», «inserisci A e B nei
 * primi», «primi: A, B; secondi: C». `loose` = nomi senza sottomenu detto. */
export function parseInsert(text:string,secs:SectionRef[],menus:{name:string}[],known:string[],so:{lexicon?:Lexicon|null,ask?:boolean}={}):InsertParse{
 const t=tokens(text),skip=menuSpans(t,menus),ms=mentions(t,secs,skip),W=t.map(x=>x.w)
 const keepTok=(k:number)=>!skip.has(k)&&!ms.some(m=>k>=m.i&&k<m.i+m.n)
 const seg=(a:number,b:number)=>{const ix:number[]=[];for(let k=a;k<b;k++)if(keepTok(k))ix.push(k);return ix.map(k=>t[k]!)}
 let guessed=false
 const namesOf=(x:Tok[],sec:string|null=null)=>{const r=splitNamesX(x,known,{lexicon:so.lexicon,section:sec,ask:false});if(r.guessed)guessed=true;return r.names}
 // 23/10: dentro un sottomenu i pezzi dubbi («funghi misti e peperoni» fuori dai Contorni) si chiedono (so.ask) invece di indovinarli
 const namesSec=(x:Tok[],m:Mention)=>{const r=splitNamesX(x,known,{lexicon:so.lexicon,section:m.word,ask:!!so.ask&&!!m.secId});if(r.guessed)guessed=true;return r}
 if(!ms.length){const loose=namesOf(seg(0,t.length));return{lists:[],loose,...(guessed?{guessed}:{})}}
 const verbBefore=t.slice(0,ms[0]!.i).some((x,k)=>!skip.has(k)&&INSERT_V.test(x.w)),before=verbBefore?namesOf(seg(0,ms[0]!.i)):[]
 // «inserisci A e B nei primi e C nei secondi»: i nomi stanno PRIMA del loro sottomenu (preposizione davanti alla parola).
 const prepBefore=(m:Mention)=>m.i>0&&/^(?:nei|negli|nelle|nel|nella|tra|fra|in|ai|agli|alle|al|alla|come|sotto|dentro)$/.test(W[m.i-1]!)||(m.i>1&&/^(?:i|gli|le)$/.test(W[m.i-1]!)&&/^(?:tra|fra|in)$/.test(W[m.i-2]!))
 const lists:InsertParse['lists']=[]
 const push=(m:Mention,names:string[],doubts:Doubt[]=[])=>{const l=lists.find(x=>x.secId===m.secId&&x.word===m.word);if(l){for(const n of names)if(!l.names.includes(n))l.names.push(n);if(doubts.length)l.doubts=[...(l.doubts??[]),...doubts]}else lists.push({secId:m.secId,word:m.word,names:[...names],...(doubts.length?{doubts:[...doubts]}:{})})}
 const pushSeg=(m:Mention,x:Tok[])=>{const r=namesSec(x,m);push(m,r.names,r.doubts)}
 if(before.length&&prepBefore(ms[0]!)){
  // stile «nomi → sottomenu»
  let start=0
  ms.forEach((m,j)=>{pushSeg(m,seg(start,m.i));start=m.i+m.n})
  // coda senza sottomenu dopo: «… nei secondi e anche C» → all'ultimo sottomenu detto
  pushSeg(ms[ms.length-1]!,seg(start,t.length))
  return{lists:lists.filter(l=>l.names.length||l.doubts?.length),loose:[],...(guessed?{guessed}:{})}}
 // stile «sottomenu → nomi»
 ms.forEach((m,j)=>{const end=j+1<ms.length?ms[j+1]!.i:t.length;pushSeg(m,seg(m.i+m.n,end))})
 // nomi prima del primo sottomenu senza preposizione davanti («carbonara e amatriciana primi»): restano senza sottomenu
 return{lists,loose:before,...(guessed?{guessed}:{})}}

// ---------- azioni ----------
type MenuInfo={menu:RuleMenu,secs:SectionRef[],items:MenuRef[]}
function findExisting(name:string,secId:string|null,items:MenuRef[]):MenuRef|null{
 const all=items.filter(r=>sameName(r.name,name));if(!all.length)return null
 const pick=(xs:MenuRef[])=>xs.find(r=>!r.hidden)??xs[0]??null
 return pick(all.filter(r=>r.sectionId===secId))??pick(all)}
const accentize=(n:string,vocab:string[])=>{const acc=new Map(vocab.flatMap(v=>v.split(/\s+/)).filter(w=>plain(w)!==w.toLowerCase()).map(w=>[plain(w),w.toLowerCase()] as const));return n.split(' ').map(w=>acc.get(plain(w))??w).join(' ')}
// 28/10 sera (chat di Luisa «tagliolini» → «Fagiolini», «pancetta» → «paoletta»): il nome nuovo è quello scritto. Nessuna correzione dei
// refusi sul vocabolario del locale (che rinominava i piatti): solo abbreviazioni note, accenti del locale e iniziale maiuscola.
const newName=(said:string,vocab:string[])=>capW(accentize(expandAbbr(said).toLowerCase(),vocab))
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

/** Azioni dello svuotamento: ogni piatto del Menu ELIMINATO (anche i vecchi nascosti; tranne `keep`); sottomenu e Menu non si toccano mai. */
export function buildClear(info:MenuInfo,keep:Set<string>=new Set()):{actions:MenuAction[],names:string[]}{
 const all=info.items.filter(r=>!keep.has(r.id));return{actions:all.map(r=>({kind:'delete',id:r.id,soft:true}) as MenuAction),names:all.map(r=>r.name)}}

// ---------- turno intero ----------
export type RuleInput={text:string,menus:RuleMenu[],sections:SectionRef[],refs:MenuRef[],history:{role:string,text:string,at:number}[],
 /** risposta a una domanda della regola (Menu o nomi) */
 wait?:RuleWait|null,
 /** bozza di piatto in sospeso («In quale sottomenu metto X?») */
 draftName?:string|null,
 /** 23/10: lessico del locale (nomi attuali + storico + regole imparate) per la divisione con la «e» */
 lexicon?:Lexicon|null}
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
 const text0=fixMealWords(shorthand(o.text.replace(/[🎤]/gu,' '))).trim();if(!plain(text0))return null // 24/10: refusi del pasto e «da 12 …»
 // 23/10 (chat Luisa): «menu pranzo da 12 (euro)» = il Menu, non un prezzo: si toglie «da 12 euro» prima di leggere il comando.
 const text=o.wait?.kind==='menu'?text0:stripMenuPrice(text0,o.menus)||text0,p=plain(text)
 const allSecNames=[...new Set(o.sections.map(s=>s.name))]
 const vocab=o.refs.map(r=>r.name)
 // 1) risposta alla domanda della regola
 if(o.wait?.kind==='menu'){const opts=o.menus.filter(m=>o.wait!.kind==='menu'&&(o.wait as any).options.includes(m.id)),num=p.match(/^(?:il |la |nel |numero )?(\d)$/)
  const hit=num?opts[Number(num[1])-1]:menusIn(text,opts).length===1?menusIn(text,opts)[0]:(()=>{const m=menusIn(text,o.menus);return m.length===1?m[0]:undefined})()
  if(hit){if((o.wait as any).del)return delMenuResult(hit,o);const sc=sectionClearParse(stripMenuPrice(o.wait.text,o.menus),o);return sc?runSectionClear(hit,sc,o):runOn(hit,o.wait.text,o,true)}
  return null}
 if(o.wait?.kind==='swap')return swapAnswer(o,o.wait as SwapWait)
 if(o.wait?.kind==='names'){const w=o.wait,m=o.menus.find(x=>x.id===w.menuId),s=o.sections.find(x=>x.id===w.secId)
  // 28/10 sera (chat di Luisa): vale solo per QUEL Menu (un altro Menu detto = messaggio nuovo) e, se è il contesto di un sottomenu appena
  // svuotato, solo per un elenco di piatti (un altro comando senza «inserisci» non diventa un piatto).
  const said=menusIn(text0,o.menus),otherMenu=said.length>0&&!said.some(x=>x.id===w.menuId),otherCmd=!!w.ctx&&!INSERT_V.test(p)&&CTX_OTHER.test(p)
  if(m&&s&&!otherMenu&&!otherCmd&&!OTHER.test(p)&&!hasDigits(p)&&!CLEAR_V.test(p)&&!/\?/.test(text)){const info=infoOf(m,o.sections,o.refs),toks=tokens(text),sk=menuSpans(toks,o.menus),ms=mentions(toks,info.secs,sk)
   // 23/10 (chat Luisa «Lasagna strozzapreti con Zola e pistacchio  orecchiette con zucca»): virgole, doppio spazio e parole che aprono un
   // piatto dividono; un pezzo con la «e» dubbia si chiede («1 piatto o 2?»), gli altri si scrivono subito. Un sottomenu detto vale.
   // 28/10 sera: un confine indovinato (senza virgola) = proposta da confermare, nessuna scrittura.
   if(ms.some(x=>x.secId)){const ip=parseInsert(text,info.secs,o.menus,vocab,{lexicon:o.lexicon,ask:true});if(ip.lists.length||ip.loose.length)return applyResult(info,{lists:[...ip.lists,...(ip.loose.length?[{secId:s.id,word:s.name,names:ip.loose}]:[])],loose:[],...(ip.guessed?{guessed:true}:{})},null,vocab,text,o.lexicon??null)}
   const r=splitNamesX(toks.filter((x,i)=>!sk.has(i)),vocab,{lexicon:o.lexicon,section:s.name,ask:true})
   if(r.names.length||r.doubts.length)return applyResult(info,{lists:[{secId:s.id,word:s.name,names:r.names,...(r.doubts.length?{doubts:r.doubts}:{})}],loose:[],...(r.guessed?{guessed:true}:{})},null,vocab,text,o.lexicon??null)}
  // non è la risposta (un altro comando, un altro Menu): si legge come un messaggio nuovo
  return ruleTurn({...o,wait:null})}
 // 23/10 sera: risposta alla proposta «Ho capito così …: • A • B — Va bene?». «sì» = applica; una correzione («funghi misti e peperoni sono
 // due piatti», «pasta e fagioli è un piatto solo») o un elenco nuovo = applicati sulla proposta; «no/annulla» = niente.
 if(o.wait?.kind==='propose'){const w=o.wait,m=o.menus.find(x=>x.id===w.menuId);if(!m)return null
  const info=infoOf(m,o.sections,o.refs),pp=plain(text)
  if(/^(?:no|annulla|lascia (?:stare|perdere)|niente|no grazie|non (?:farlo|fare niente))\b/.test(pp)&&!INSERT_V.test(pp))return{kind:'info',text:'Ok, non ho cambiato nulla.'}
  if(isAffirmative(text)||(/^(?:s[iì]|ok|va bene|esatto|giusto|perfetto|certo|confermo)\b/.test(pp)&&!/\b(?:no|non|ma|pero|tranne|invece)\b/.test(pp)&&pp.split(' ').length<=6))return applyProposal(info,w,w.lists,vocab)
  const corr=parseCorrection(text)
  if(corr){const ph=plain(corr.phrase);let hit=false
   const lists=w.lists.map(l=>{let names=[...l.names]
    if(corr.kind==='split'){names=names.flatMap(n=>{if(plain(n)!==ph&&!plain(n).includes(ph))return[n];hit=true;const parts=corr.phrase.split(/\s+(?:e|ed)\s+/i).map(x=>x.trim()).filter(Boolean);return parts.length>1?parts:[n]})}
    else{if(names.some(n=>plain(n)===ph))hit=true;else for(let i=0;i+1<names.length;i++){if(plain(names[i]!+' e '+names[i+1]!)===ph){names.splice(i,2,corr.phrase);hit=true;break}}}
    // la proposta era già così (già divisa / già unita): vale come conferma, si applica com'è
    if(corr.kind==='split'&&!hit){const parts=corr.phrase.split(/\s+(?:e|ed)\s+/i).map(x=>plain(x));for(let i=0;i+parts.length<=names.length;i++)if(parts.every((x,k)=>plain(names[i+k]!)===x)){hit=true;break}}
    return{...l,names}})
   if(hit){const parts=corr.phrase.split(/\s+(?:e|ed)\s+/i).map(x=>x.trim()).filter(Boolean),r=applyProposal(info,w,lists,vocab),learn=parts.length>1?[ruleFromAnswer(corr.phrase,parts,corr.kind==='split'?'split':'one')]:[];return r.kind==='apply'?{...r,learn}:{...r,learn} as RuleResult}}
  if(!OTHER.test(pp)&&!hasDigits(pp)&&!CLEAR_V.test(pp)&&!/\?/.test(text)&&w.lists.length===1){const s0=info.secs.find(x=>x.id===w.lists[0]!.secId);if(s0){const toks=tokens(text),sk=menuSpans(toks,o.menus),r=splitNamesX(toks.filter((x,i)=>!sk.has(i)),vocab,{lexicon:o.lexicon,section:s0.name,ask:false})
   if(r.names.length&&!r.names.some(n=>NOT_DISH.test(plain(n))))return applyProposal(info,w,[{secId:s0.id,names:r.names}],vocab)}}
  // 28/10 sera (chat di Luisa): non è una risposta alla proposta (per esempio «elimina secondi menù sera»): la proposta decade e il
  // messaggio si legge come nuovo (prima andava al modello, che non svuotava nulla).
  if(CLEAR_V.test(pp)||INSERT_V.test(pp)||sectionClearParse(text,o))return ruleTurn({...o,wait:null})
  return null}
 // 23/10: risposta a «"funghi misti e peperoni": 1 piatto o 2?» (gli altri piatti del messaggio erano già scritti). Si impara la risposta.
 if(o.wait?.kind==='split'){const w=o.wait,it=w.items[0],ans=doubtAnswer(text),m=o.menus.find(x=>x.id===w.menuId),s=it?o.sections.find(x=>x.id===it.secId):undefined
  if(!ans||!it||!m||!s)return null
  const info=infoOf(m,o.sections,o.refs),learn=[ruleFromAnswer(it.one,it.parts,ans)],rest=w.items.slice(1)
  const next:RuleAsk|null=rest.length?{question:doubtQuestion(rest[0]!.text,rest[0]!.parts.length),wait:{...w,items:rest}}:null
  const r=applyResult(info,{lists:[{secId:s.id,word:s.name,names:ans==='one'?[it.one]:it.parts}],loose:[]},null,vocab,text)
  if(!r)return next?{kind:'ask',question:next.question,wait:next.wait,learn}:{kind:'info',text:'Ok, me lo ricordo.',learn}
  if(r.kind==='apply')return{...r,ask:next,learn}
  if(r.kind==='info')return next?{kind:'ask',question:r.text+'\n\n'+next.question,wait:next.wait,learn}:{...r,learn}
  return r}
 // 23/10: correzione della divisione («coppa è un piatto a parte», «funghi misti e peperoni sono due contorni», «pasta e fagioli è un
 // piatto solo»): divide/unisce il piatto nel menu (stessa sezione, subito dopo) e salva la regola nel lessico del locale.
 {const corr=parseCorrection(text),pc=corr?plain(corr.phrase):''
  if(corr&&!/\?\s*$/.test(text)&&!COURSES.includes(pc)&&!allSecNames.some(x=>sameSection(x,pc))&&!o.menus.some(m=>plain(m.name)===pc)){const said=menusIn(text,o.menus),pref=said.length===1?said[0]!.name:contextMenu(o.history,o.menus)?.name??null
   const plan=correctionPlan(corr,o.refs,o.sections,o.menus,pref,o.lexicon??null),learn=plan.rule?[plan.rule]:[],reply=correctionReply(corr,plan,o.menus.length)
   return plan.actions.length?{kind:'fix',actions:plan.actions,reply,learn}:{kind:'info',text:reply,learn}}}
 if(NEG.test(p)||/\?\s*$/.test(text)||/\b(?:annull\w*|com e(?:ra)?|come prima|come era|indietro|ripristin\w*)\b/.test(p))return null
 // 23/10 (test «alla Luisa»: «Il primo del menu da 12 costa 9», «Il solo secondo a pranzo mettilo a 11» → domanda senza azioni): il prezzo di
 // un'OPZIONE di un Menu a prezzo fisso detto con il Menu (anche «da 12», «a pranzo») lo legge il server: subito, «annulla» come rete.
 // 24/10 (chat Manuel 18:09): «togli X metti Y» e simili = UNA sostituzione nel sottomenu di X (prima che l'inserimento perda «togli X»)
 {const sw=swapTurn(o);if(sw)return sw}
 {const f=formulaPrice(text,text0,o);if(f)return f}
 // «no aspetta tredici» subito dopo «Il *Completo* del *Menu Giorno* è già 12 €» / «*Completo* del *Menu Giorno*: da … a …»: quel prezzo.
 {const lb=[...o.history].filter(t=>t.role==='bot').sort((a,b)=>b.at-a.at)[0]?.text??'',fm=lb.match(/\*(Completo|Solo primo|Solo secondo)\* del \*([^*\n]+)\*/),rest=p.replace(/^(?:(?:no|anzi|aspetta|scusa|ok|allora|volevo dire|intendevo|mettilo|mettila|fallo|falla|a)\s+)*/,'').replace(/\s*euro$/,'').trim()
  if(fm&&rest&&/^(?:\d+(?:\s\d{1,2})?|[a-z]+(?:\s(?:e|virgola)\s[a-z]+)?)$/.test(rest)){const f=formulaPrice('il '+fm[1]!.toLowerCase()+' del '+fm[2]+' a '+rest,'il '+fm[1]!.toLowerCase()+' del '+fm[2]+' a '+rest,o);if(f)return f}}
 // 23/10 (chat Luisa «Menù mezzogiorno da 12 euro» da solo): solo il nome di un Menu = di quel Menu si parla; mai «a quale piatto metto 12 €?».
 {const ms=menusIn(text0,o.menus),t=tokens(text),sk=menuSpans(t,o.menus),rest=t.filter((x,i)=>!sk.has(i)&&!PREP.has(x.w)&&!FILL.has(x.w)&&![',',';',':'].includes(x.w)&&!/^(?:menu|ok|allora|si|euro|eur)$/.test(x.w))
  if(ms.length===1&&!rest.length&&!CLEAR_V.test(p)&&!INSERT_V.test(p)){const info=infoOf(ms[0]!,o.sections,o.refs),empty=info.secs.filter(x=>!info.items.some(r=>r.sectionId===x.id&&!r.hidden))
   return{kind:'info',text:'Ok, il '+mLabel(ms[0]!.name)+(empty.length?': '+(empty.length===1?'i *'+empty[0]!.name+'* sono vuoti':andList(empty.map(x=>'*'+x.name+'*'))+' sono vuoti'):'')+'. Cosa cambio? Per esempio «'+(empty.length?'nei '+plain(empty[0]!.name)+' inserisci lasagna, carbonara':'togli i primi')+'».'}}}
 // 2) bozza in sospeso («In quale sottomenu metto Nodino…?») + un Menu a prezzo fisso detto («nono devi guardare menu cena»)
 if(o.draftName&&!/\b(?:lascia\w*|stare|perdere|niente|no|annull\w*|basta)\b/.test(p)){const ms=menusIn(text,o.menus);if(ms.length===1&&ms[0]!.pricing==='fisso'&&!hasDigits(p)){const info=infoOf(ms[0]!,o.sections,o.refs),ip=parseInsert(text,info.secs,o.menus,vocab),secId=ip.lists.find(l=>l.secId)?.secId??null
   return applyResult(info,{lists:secId?[{secId,word:'',names:[o.draftName]}]:[],loose:secId?[]:[o.draftName]},null,vocab,text)}}
 // «elimina il menu pranzo» / «togli tutto il menu pranzo»: eliminazione del Menu (con il sì), mai lo svuotamento
 if(deleteMenuIntent(text)){const ms=menusIn(text,o.menus);if(ms.length===1)return delMenuResult(ms[0]!,o)
  const c=ms.length>1?ms:o.menus;const a=askMenu(c,text) as any;a.question=a.question.replace(/^In quale Menu\?/,'Quale Menu elimino?');a.wait.del=true;return a}
 // 23/10 (chat Luisa «Nel menù pranzo da 12 elimina i primi», «Eliminare tutti i primi»): «primi/secondi/contorni/dolci…» sono SOTTOMENU,
 // mai nomi di piatti → tutti i piatti di quel sottomenu eliminati (Menu a prezzo fisso: subito, «annulla» 10 minuti; alla carta col «sì»).
 // Menu: quello detto (anche «pranzo», «mezzogiorno», «da 12»), altrimenti quello della conversazione, altrimenti l'unico che ha quel
 // sottomenu; se restano più Menu, UNA domanda («Nel Menu Giorno o nel Menu Cena?»). «… e inserisci A, B» = svuota e poi inserisce.
 {const scp=sectionClearParse(text,o)
  // Menu candidati: quelli con quel sottomenu PIENO (un sottomenu già vuoto non si propone), se nessuno è pieno quelli che lo hanno.
  if(scp){const hasS=(m:RuleMenu)=>o.sections.filter(x=>x.menu===m.name&&scp.words.some(w=>secMatch(x.name,w))),full=(m:RuleMenu)=>hasS(m).some(x=>o.refs.some(r=>r.sectionId===x.id)),anyFull=o.menus.some(full),has=(m:RuleMenu)=>anyFull?full(m):hasS(m).length>0
   const said=menusIn(text0,o.menus)
   if(said.length===1)return runSectionClear(said[0]!,scp,o)
   const saidH=said.filter(has);if(saidH.length===1)return runSectionClear(saidH[0]!,scp,o);if(saidH.length>1)return askMenu(saidH,text)
   // il Menu della conversazione vale anche se quel sottomenu è già vuoto (si dice «sono già vuoti», mai la domanda su altri Menu)
   const cm=contextMenu(o.history,o.menus,4);if(cm&&hasS(cm).length)return runSectionClear(cm,scp,o)
   const c=o.menus.filter(has);if(c.length===1)return runSectionClear(c[0]!,scp,o);if(c.length>1)return askMenu(c,text)
   return null}}
 const clr=clearIntent(text,allSecNames)||(()=>{const sp=splitClearInsert(text,allSecNames);return !!sp.insert&&clearIntent(sp.clear,allSecNames)})()
 // seguito senza verbo subito dopo una risposta della regola («e nei contorni patate al forno»): è ancora un inserimento
 const lastBot=[...o.history].filter(t=>t.role==='bot').sort((a,b)=>b.at-a.at)[0]?.text??''
 const follow=/(?:aggiornato|svuotato)\*/.test(lastBot)&&/^(?:e |ed |poi |anche |allora |ok |oggi |stasera |per oggi |quindi |adesso |ora )*(?:nei|negli|nelle|nel|tra i|tra le|per i|per le|come|i|gli|le)?\s*(?:primi|primo|secondi|secondo|contorni|contorno|dolci|dolce|antipasti|antipasto)\b/.test(p)
 const ins=(INSERT_V.test(p)||follow)&&!OTHER.test(p)&&!/\b(?:mettil[oaie]|mettel[oaie]|aggiungil[oaie]|inseriscil[oaie])\b/.test(p)
 if(!clr&&!ins)return null
 // 24/10: «togli X e metti Y» non letto come sostituzione: mai inserire Y perdendo «togli X» (decide il resto del flusso)
 if(!clr&&CLEAR_V.test(p))return null
 // la sostituzione giornaliera («stasera a cena metti primi …») resta la sua strada
 // …ma solo con un Menu detto: subito dopo una risposta della regola «allora nei primi oggi mettiamo A e B» (vocale senza Menu) è il seguito
 // dell'inserimento (24/10, ripreso da 6a1af510: prima finiva al modello → niente scritto)
 if(!clr&&!STRONG_INSERT.test(p)&&DAILY.test(p)&&!(follow&&!menusIn(text,o.menus).length))return null
 if(!clr&&hasDigits(p))return null
 // Menu del messaggio, poi quello della conversazione
 const said=menusIn(text0,o.menus) // 24/10: anche «da 12 …» (tolto da `text`) indica il Menu
 if(said.length===1)return runOn(said[0]!,text,o,follow)
 if(said.length>1){const ask=said.filter(m=>clr||o.sections.some(s=>s.menu===m.name));return askMenu(ask.length?ask:said,text)}
 const ctx=contextMenu(o.history,o.menus)
 if(ctx)return runOn(ctx,text,o,follow,true)
 // nessun Menu: per svuotare, i Menu con piatti visibili; per inserire, i Menu a prezzo fisso con i sottomenu detti
 if(clr){const c=o.menus.filter(m=>o.refs.some(r=>r.menu===m.name));if(c.length===1)return runOn(c[0]!,text,o,false);if(!c.length)return{kind:'info',text:'Non c’è nessun piatto da togliere: il menu è già vuoto.'};return askMenu(c,text)}
 const fixed=o.menus.filter(m=>m.pricing==='fisso'),cands=fixed.filter(m=>{const ip=parseInsert(text,o.sections.filter(s=>s.menu===m.name),o.menus,vocab,{lexicon:o.lexicon});return ip.lists.length>0&&ip.lists.every(l=>!!l.secId)})
 if(cands.length===1)return runOn(cands[0]!,text,o,false)
 if(cands.length>1)return askMenu(cands,text)
 return null}
function askMenu(ms:RuleMenu[],text:string):RuleResult{const opts=ms.slice(0,4)
 const q=opts.length===2?'Nel '+mLabel(opts[0]!.name)+' o nel '+mLabel(opts[1]!.name)+'?':'In quale Menu? '+orList(opts.map(m=>mLabel(m.name)))+'?'
 return{kind:'ask',question:q,wait:{kind:'menu',text:text.slice(0,600),options:opts.map(m=>m.id)}}}
function runOn(menu:RuleMenu,text:string,o:RuleInput,answer:boolean,fromCtx=false):RuleResult|null{
 const info=infoOf(menu,o.sections,o.refs),secNames=info.secs.map(s=>s.name),vocab=o.refs.map(r=>r.name)
 const allNames=secNames.length?secNames:[...new Set(o.sections.map(s=>s.name))],sp=splitClearInsert(text,allNames)
 let clr=false,insText=text,clearText=text
 if(sp.insert.trim()&&sp.clear.trim()&&clearIntent(sp.clear,allNames)){clr=true;insText=sp.insert;clearText=sp.clear}
 else if(clearIntent(text,allNames)){clr=true;insText='';clearText=text}
 // «togli tutto tranne la carbonara»: i piatti detti dopo «tranne» restano
 let keepNames:string[]=[]
 if(clr){const m=clearText.match(/\b(?:tranne|eccetto|a parte|salvo|meno che|tranne che)\b(.*)$/i);if(m){keepNames=splitNames(tokens(m[1]!),vocab);clearText=clearText.slice(0,m.index)}}
 const p=plain(insText)
 let parse:InsertParse={lists:[],loose:[]}
 if(insText.trim()&&(INSERT_V.test(p)||clr||answer)){parse=parseInsert(insText,info.secs,o.menus,vocab,{lexicon:o.lexicon,ask:true})
  // «nei primi inserisci» senza nomi: si chiedono i nomi (una riga)
  if(!clr&&!parse.loose.length&&parse.lists.length===1&&!parse.lists[0]!.names.length&&!parse.lists[0]!.doubts?.length&&parse.lists[0]!.secId){const s=info.secs.find(x=>x.id===parse.lists[0]!.secId)!;return{kind:'ask',question:'Cosa inserisco nei *'+s.name+'* del '+mLabel(menu.name)+'? Scrivimi i piatti, per esempio «carbonara, lasagne».',wait:{kind:'names',menuId:menu.id,secId:s.id}}}
  parse={lists:parse.lists.filter(l=>l.names.length||l.doubts?.length||!l.secId),loose:parse.loose,...(parse.guessed?{guessed:true}:{})}}
 // 23/10 (chat Luisa «E inserisci» dopo «elimina i primi»): inserire senza dire il sottomenu = il sottomenu di cui si parlava
 // (ultimo messaggio del titolare che lo nomina, nello stesso Menu). Senza nomi: UNA domanda che chiede i piatti (con lo stato salvato).
 const lastBotT=[...o.history].filter(t=>t.role==='bot').sort((a,b)=>b.at-a.at)[0],justCleared=!!lastBotT&&Date.now()-lastBotT.at<=10*60*1000&&/Ora scrivimi i piatti nuovi|Cosa inserisco/.test(lastBotT.text) // 28/10 sera: solo entro 10 minuti
 const defSec=!clr&&!parse.lists.length&&(STRONG_INSERT.test(p)||justCleared&&INSERT_V.test(p))&&(menusIn(text,o.menus).some(m=>m.id===menu.id)||contextMenu(o.history,o.menus,4)?.id===menu.id)?contextSection(o.history,info,o.menus):null // solo «inserisci/aggiungi» (batteria v181: «metti tutto a zero» diventava un piatto)
 if(defSec&&!parse.loose.length&&INSERT_V.test(p)&&!/\?/.test(text))return{kind:'ask',question:'Cosa inserisco nei *'+defSec.name+'* del '+mLabel(menu.name)+'? Scrivimi i piatti, per esempio «lasagna, carbonara».',wait:{kind:'names',menuId:menu.id,secId:defSec.id}}
 if(defSec&&parse.loose.length){const toSec=parse.loose.filter(n=>!findExisting(n,null,info.items)&&(justCleared||!courseSection(n,info.secs)));if(toSec.length){parse={lists:[{secId:defSec.id,word:defSec.name,names:toSec}],loose:parse.loose.filter(n=>!toSec.includes(n)),...(parse.guessed?{guessed:true}:{})}}}
 // Menu preso dalla conversazione ma il sottomenu detto è di un ALTRO Menu («aggiungi il tiramisù nei dolci» dopo la cena): non è la regola
 if(fromCtx&&parse.lists.some(l=>!l.secId&&o.sections.some(x=>x.menu!==menu.name&&sameSection(x.name,l.word))))return null
 if(!clr){if(!parse.lists.length&&!parse.loose.length)return null
  // senza sottomenu detto si va avanti solo con un Menu a prezzo fisso detto, o con nomi che sono tutti piatti di questo Menu
  if(!parse.lists.length&&!(menusIn(text,o.menus).some(m=>m.id===menu.id)&&menu.pricing==='fisso')&&!parse.loose.every(n=>!!findExisting(n,null,info.items))&&!answer&&!defSec)return null}
 return applyResult(info,parse,clr?{deleteWord:/\b(?:elimin\w*|cancell\w*)\b/.test(plain(clearText)),keep:keepNames}:null,vocab,text,o.lexicon??null)}
function applyResult(info:MenuInfo,parse:InsertParse,clear:{deleteWord:boolean,keep?:string[]}|null,vocab:string[],text:string,lexicon:Lexicon|null=null):RuleResult|null{
 // un «nome» con dentro un verbo o una frase («restano uguali», «toglila», «aspetta») non è un piatto: decide il resto del flusso
 if([...parse.lists.flatMap(l=>[...l.names,...(l.doubts??[]).map(d=>d.one)]),...parse.loose].some(n=>NOT_DISH.test(plain(n))))return null
 // 23/10: pezzi dubbi («"funghi misti e peperoni": 1 piatto o 2?») → una domanda di una riga; tutto il resto si scrive subito
 const doubts=parse.lists.flatMap(l=>l.secId?(l.doubts??[]).map(d=>({...d,secId:l.secId!})):[])
 // 23/10 sera (Manuel): con un pezzo dubbio niente «1 piatto o 2?»: UNA domanda che mostra la proposta intera (lettura più probabile).
 // 28/10 sera (chat di Luisa): lo stesso se i confini tra i piatti o i sottomenu sono indovinati (elenco senza virgole, piatti messi
 // per portata): nessuna scrittura finché il titolare non conferma.
 const gp=info.menu.pricing==='fisso'?guessedPlan(info,parse):null
 if(gp){const keepIds=new Set<string>();for(const n of clear?.keep??[]){const ex=findExisting(n,null,info.items);if(ex)keepIds.add(ex.id)}
  return proposeFrom(info,{lists:gp.lists,loose:[],guessed:parse.guessed},clear?info.items.filter(r=>!keepIds.has(r.id)).map(r=>r.id):[],vocab,lexicon,gp.unplaced)}
 const ask:RuleAsk|null=doubts.length?{question:doubtQuestion(doubts[0]!.text,doubts[0]!.parts.length),wait:{kind:'split',menuId:info.menu.id,items:doubts}}:null
 const b=buildInsert(info,parse,vocab)
 // Menu alla carta: un piatto nuovo vuole il prezzo → resta il percorso di prima (domanda del prezzo), salvo lo svuotamento
 if(b.needsPrice.length&&!clear)return null
 const keep=new Set(b.touched),notFound:string[]=[]
 for(const n of clear?.keep??[]){const ex=findExisting(n,null,info.items);if(ex)keep.add(ex.id);else notFound.push(newName(n,vocab))}
 const cl=clear?buildClear(info,keep):{actions:[],names:[]}
 const actions=[...cl.actions,...b.actions]
 const report:RuleReport={menu:info.menu.name,fixed:info.menu.pricing==='fisso',cleared:cl.names,deleteWord:!!clear?.deleteWord,sections:b.sections,unknownSecs:b.unknownSecs,notPlaced:[...b.notPlaced,...b.needsPrice],notFound,kept:[...keep].filter(id=>!b.touched.has(id)).map(id=>info.items.find(r=>r.id===id)?.name??'').filter(Boolean)}
 if(!actions.length){
  if(ask)return{kind:'ask',question:(b.sections.length?ruleReply(report,info.items,[],false)+'\n\n':'')+ask.question,wait:ask.wait}
  if(clear&&!b.sections.length)return{kind:'info',text:'Il '+mLabel(info.menu.name)+' è già vuoto: nessun piatto, non ho cambiato nulla. Scrivimi i piatti nuovi, per esempio «nei primi inserisci carbonara, lasagne».'}
  return{kind:'info',text:ruleReply(report,info.items,[],false)}}
 return{kind:'apply',menu:info.menu,actions,report,ask}}

// ---------- «elimina i primi»: tutti i piatti di un sottomenu (23/10, chat Luisa) ----------
const SEC_WORDS=new Set(['primi','secondi','contorni','dolci','dessert','antipasti','pizze','insalate','insalatone','panini','zuppe','minestre','bevande','bibite','vini','birre','fritti','piatti unici','focacce','calzoni','taglieri','gelati','frutta'])
const SEC_FILL=new Set(['tutti','tutte','tutto','i','gli','le','il','lo','la','l','e','ed','anche','pure','piatti','piatto','dei','degli','delle','del','della','dello','dai','dagli','dalle','dal','dalla','nei','negli','nelle','nel','nella','di','da','in','menu','ok','allora','adesso','ora','oggi','per','favore','subito','quindi','poi','mi','ci','me','ce','vorrei','voglio','devi','puoi','bisogna','dobbiamo','grazie','ciao','sottomenu','sezione','categoria','quelli','quelle','dentro','presenti','attuali','vecchi','vecchie','che','ci','sono','stasera','pranzo','cena','sera','mezzogiorno','a','al','alla'])
/** Il nome di un sottomenu corrisponde alla parola detta («Primi» / «primi», «Primi piatti» / «primi»). */
export const secMatch=(name:string,w:string)=>{const n=plain(name);return n===w||sameSection(name,w)||(n.split(' ').length>1&&sameSection(n.split(' ')[0]!,w))}
/** «elimina i primi», «Eliminare tutti i primi», «togli i secondi del menu cena», «svuota i contorni», «leva tutti i piatti dei primi»
 * (+ «… e inserisci A, B»): le parole di sottomenu, la parte che toglie e quella che inserisce. null = un altro comando (piatti nominati,
 * prezzi, «tranne», domande, negazioni). Il Menu intero («togli tutti i piatti del menu») resta clearIntent. */
export function sectionClearParse(text:string,o:{menus:RuleMenu[],sections:SectionRef[]}):{words:string[],clear:string,insert:string}|null{
 const p=plain(text);if(!p||NEG.test(p)||/\?\s*$/.test(text)||!CLEAR_V.test(p)||OTHER.test(p)||hasDigits(p)||/\b(?:tranne|eccetto|a parte|salvo|meno che)\b/.test(p))return null
 const allSec=[...new Set(o.sections.map(x=>x.name))],sp=splitClearInsert(text,allSec),hasIns=!!sp.insert.trim()&&!!plain(sp.clear),clear=hasIns?sp.clear:text
 if(!CLEAR_V.test(plain(clear)))return null
 const t=tokens(clear),skip=menuSpans(t,o.menus),W=t.map(x=>x.w),words:string[]=[]
 for(let i=0;i<W.length;i++){if(skip.has(i))continue;const w=W[i]!;if([',',';',':'].includes(w)||CLEAR_V.test(w)||SEC_FILL.has(w))continue
  if(SEC_WORDS.has(w)||(w.length>=4&&allSec.some(x=>plain(x)===w))){ // solo il plurale/il nome intero: «elimina il primo piatto» non è un sottomenu
   if(!words.includes(w))words.push(w);continue}
  return null}
 return words.length?{words,clear,insert:hasIns?sp.insert:''}:null}
/** Sottomenu di cui si parla adesso: gli ultimi 2 scambi (titolare e bot, entro 10 minuti) che nominano un sottomenu di QUESTO Menu. */
function contextSection(history:{role:string,text:string,at:number}[],info:MenuInfo,menus:{name:string}[]):SectionRef|null{
 // 28/10 sera: i 10 minuti contano da ADESSO (prima dall'ultimo messaggio salvato: un contesto vecchio valeva ancora)
 const now=Date.now()
 for(const h of [...history].sort((a,b)=>b.at-a.at).slice(0,4).filter(x=>now-x.at<=10*60*1000)){const t=tokens(h.text),ms=mentions(t,info.secs,menuSpans(t,menus)).filter(m=>m.secId);if(ms.length)return info.secs.find(x=>x.id===ms[ms.length-1]!.secId)??null}
 return null}
function runSectionClear(menu:RuleMenu,scp:{words:string[],clear:string,insert:string},o:RuleInput):RuleResult|null{
 const info=infoOf(menu,o.sections,o.refs),vocab=o.refs.map(r=>r.name),secs=info.secs.filter(x=>scp.words.some(w=>secMatch(x.name,w)))
 if(!secs.length){const said=scp.words.map(w=>'*'+capW(w)+'*');return{kind:'info',text:'Nel '+mLabel(menu.name)+' non c’è il sottomenu '+andList(said)+(info.secs.length?' (ci sono '+andList(info.secs.map(x=>'*'+x.name+'*'))+')':'')+': non ho cambiato nulla.'}}
 let parse:InsertParse={lists:[],loose:[]}
 if(scp.insert.trim()){parse=parseInsert(scp.insert,info.secs,o.menus,vocab,{lexicon:o.lexicon,ask:true})
  // nomi senza sottomenu detto = nel sottomenu appena svuotato (uno solo), altrimenti per portata
  const g=parse.guessed?{guessed:true}:{}
  if(parse.loose.length&&secs.length===1)parse={lists:[...parse.lists,{secId:secs[0]!.id,word:secs[0]!.name,names:parse.loose}],loose:[],...g}
  parse={lists:parse.lists.filter(l=>l.names.length||l.doubts?.length||!l.secId),loose:parse.loose,...g}}
 if([...parse.lists.flatMap(l=>[...l.names,...(l.doubts??[]).map(d=>d.one)]),...parse.loose].some(n=>NOT_DISH.test(plain(n))))return null
 const b=buildInsert(info,parse,vocab)
 if(b.needsPrice.length)return null // alla carta i piatti nuovi vogliono il prezzo: resta il percorso di prima
 const ids=new Set(secs.map(x=>x.id)),old=info.items.filter(r=>ids.has(r.sectionId??'')&&!b.touched.has(r.id))
 const dels=old.map(r=>({kind:'delete',id:r.id,soft:true}) as MenuAction),actions=[...dels,...b.actions]
 const doubts=parse.lists.flatMap(l=>l.secId?(l.doubts??[]).map(d=>({...d,secId:l.secId!})):[])
 if(menu.pricing==='fisso'){const gp=guessedPlan(info,parse);if(gp)return proposeFrom(info,{lists:gp.lists,loose:[],guessed:parse.guessed},old.map(r=>r.id),vocab,o.lexicon??null,gp.unplaced)}
 const ask:RuleAsk|null=doubts.length?{question:doubtQuestion(doubts[0]!.text,doubts[0]!.parts.length),wait:{kind:'split',menuId:menu.id,items:doubts}}:null
 if(!actions.length){
  if(ask)return{kind:'ask',question:ask.question,wait:ask.wait}
  if(!old.length&&!b.sections.length)return{kind:'info',text:(secs.length===1?'I *'+secs[0]!.name+'* del '+mLabel(menu.name)+' sono già vuoti':'I sottomenu '+andList(secs.map(x=>'*'+x.name+'*'))+' del '+mLabel(menu.name)+' sono già vuoti')+': non ho cambiato nulla. Scrivimi i piatti nuovi, per esempio «nei '+plain(secs[0]!.name).split(' ')[0]+' inserisci lasagna, carbonara».'}}
 // Menu alla carta: svuotare un sottomenu chiede il «sì» (proposta con l'elenco); a prezzo fisso è la sostituzione del giorno: subito.
 if(menu.pricing!=='fisso'){if(b.actions.length)return null
  return{kind:'confirm',menu,actions:dels,question:'Elimino '+(old.length===1?'il piatto':'tutti i '+old.length+' piatti')+' dei '+andList(secs.map(x=>'*'+x.name+'*'))+' del '+mLabel(menu.name)+'? Il sottomenu resta. Rispondi *sì* per eliminarli, oppure *no*.'}}
 const report:RuleReport={menu:menu.name,fixed:true,cleared:old.map(r=>r.name),deleteWord:true,sections:b.sections,unknownSecs:b.unknownSecs,notPlaced:[...b.notPlaced],clearedSecs:secs.map(x=>({secId:x.id,name:x.name}))}
 // 28/10 sera (chat di Luisa): «elimina secondi menù sera» da solo → «Ora scrivimi i piatti nuovi». Il sottomenu svuotato resta il contesto
 // (salvato col Menu e il numero, scade come ogni attesa): il prossimo «inserisci …» senza sottomenu va lì, mai per portata.
 const ctxAsk:RuleAsk|null=!ask&&!scp.insert.trim()&&secs.length===1?{question:'Cosa inserisco nei *'+secs[0]!.name+'* del '+mLabel(menu.name)+'?',wait:{kind:'names',menuId:menu.id,secId:secs[0]!.id,ctx:true},silent:true}:null
 return{kind:'apply',menu,actions,report,ask:ask??ctxAsk}}

// ---------- scrittura da telefono (23/10, «a prova di chiunque») ----------
/** Abbreviazioni comuni → parole intere, solo per la lettura delle regole (il modello riceve il messaggio originale). */
export function shorthand(t:string):string{return t.replace(/(^|\s)x(?=\s)/gi,'$1per').replace(/\bnn\b/gi,'non').replace(/\bcmq\b/gi,'comunque').replace(/\btt\b/gi,'tutti').replace(/\bxk[eèé]\b/gi,'perché').replace(/\bqst[io]?\b/gi,'questi').replace(/\bvia tutt([ieoa])\b/gi,'togli tutt$1').replace(/\bleva(?:mi|ci)? via\b/gi,'togli').replace(/[A-Za-zÀ-ú]+/g,w=>{const x=plain(w);for(const [re,full] of ABBR)if(re.test(x))return full;return w})}
/** Nomi abbreviati dei piatti più comuni («carbo», «amatri») → nome intero (solo parole intere, solo per piatti nuovi). */
const ABBR:[RegExp,string][]=[[/^carbo$/,'carbonara'],[/^amatri(?:cia)?$/,'amatriciana'],[/^matriciana$/,'amatriciana'],[/^parmi(?:gia)?$/,'parmigiana'],[/^tira(?:mi)?$/,'tiramisù'],[/^cotol(?:etta)?$/,'cotoletta'],[/^polpet$/,'polpette'],[/^lasagn$/,'lasagna'],[/^insal$/,'insalata']]
export const expandAbbr=(n:string)=>n.split(' ').map(w=>{const x=plain(w);for(const [re,full] of ABBR)if(re.test(x))return full;return w}).join(' ')

// ---------- prezzo di un'opzione del Menu a prezzo fisso ----------
const euroF=(n:number)=>n.toFixed(2).replace('.',',')+' €'
function formulaPrice(text:string,text0:string,o:RuleInput):RuleResult|null{
 const p=plain(text);if(!/\b(?:cost\w*|mett\w*|port\w*|fai|fallo|falla|a|prezzo|euro)\b/.test(p)||/\b(?:alz\w*|abbass\w*|aument\w*|diminu\w*|scont\w*|di un euro|in piu|in meno)\b|%/.test(p))return null
 const fm=p.match(/\b(?:(solo) )?(primo|secondo|completo)\b/);if(!fm)return null
 const ms=menusIn(text0,o.menus).filter(m=>m.pricing==='fisso');if(ms.length!==1)return null
 let nums=[...text.replace(/(\d)\s*,\s*(\d{1,2})\b/g,'$1.$2').matchAll(/\d+(?:\.\d{1,2})?/g)].map(x=>Number(x[0]));if(!nums.length){const w=singlePrice(text)??g9Prices(text,false)[0]??null;if(w!==null)nums=[w]}if(nums.length!==1||!(nums[0]!>0)||nums[0]!>200)return null
 if(o.refs.some(r=>plain(r.name).length>=4&&(' '+p+' ').includes(' '+plain(r.name)+' ')))return null
 const m=ms[0]!,fs=(m.formulas??[]) as {name:string,price:number,id?:string}[],want=fm[2]==='completo'?'completo':'solo '+fm[2],f=fs.find(x=>plain(x.name)===want)??(fm[2]!=='completo'?fs.find(x=>plain(x.name).includes(fm[2]!)):undefined);if(!f||!(f as any).id)return null
 const price=Math.round(nums[0]!*100)/100
 if(Math.abs(Number(f.price)-price)<0.005)return{kind:'info',text:'Il *'+f.name+'* del '+mLabel(m.name)+' è già *'+euroF(price)+'*: non ho cambiato nulla.'}
 return{kind:'fix',actions:[{kind:'set_formula',menuId:m.id,menuName:m.name,formulaId:(f as any).id,isNew:false,name:f.name,price,before:Number(f.price)} as MenuAction],reply:'*'+f.name+'* del '+mLabel(m.name)+': da '+euroF(Number(f.price))+' a *'+euroF(price)+'*.',learn:[]}}

// ---------- proposta con la lettura più probabile (23/10 sera, Manuel: domande intelligenti) ----------
/** Il pezzo dubbio letto nel modo più probabile (stessa regola della divisione senza domanda). */
function guessNames(d:Doubt,section:string|null,lexicon:Lexicon|null):string[]{const W=plain(d.one).split(' ').filter(Boolean),pcs=splitPieces(W,{lexicon,section},false);return pcs.length>1?d.parts:[d.one]}
/** 28/10 sera: piano da far confermare quando la lettura indovina qualcosa: un pezzo dubbio, un confine senza virgola (`guessed`) o un
 * piatto NUOVO senza sottomenu detto (messo per portata). Ogni nome finisce in una lista col suo sottomenu; `unplaced` = senza sottomenu.
 * null = niente da indovinare (si scrive subito). Mai con un sottomenu sconosciuto (lo segnala la risposta normale). */
function guessedPlan(info:MenuInfo,parse:InsertParse):{lists:InsertParse['lists'],unplaced:string[]}|null{
 if(parse.lists.some(l=>!l.secId))return null
 const fresh=parse.loose.filter(n=>!findExisting(n,null,info.items))
 if(!parse.guessed&&!parse.lists.some(l=>l.doubts?.length)&&!fresh.length)return null
 const lists=parse.lists.map(l=>({...l,names:[...l.names]})),unplaced:string[]=[]
 const add=(secId:string,word:string,n:string)=>{let l=lists.find(x=>x.secId===secId);if(!l){l={secId,word,names:[]};lists.push(l)}if(!l.names.includes(n))l.names.push(n)}
 for(const n of parse.loose){const ex=findExisting(n,null,info.items),s=ex?info.secs.find(x=>x.id===ex.sectionId)??null:courseSection(n,info.secs)??(info.secs.length===1?info.secs[0]!:null)
  if(s)add(s.id,s.name,n);else unplaced.push(n)}
 return{lists,unplaced}}
function proposeFrom(info:MenuInfo,parse:InsertParse,clearIds:string[],vocab:string[],lexicon:Lexicon|null,unplaced:string[]=[]):RuleResult{
 const lists=parse.lists.filter(l=>l.secId).map(l=>{const sec=info.secs.find(x=>x.id===l.secId);return{secId:l.secId!,names:[...l.names,...(l.doubts??[]).flatMap(d=>guessNames(d,sec?.name??null,lexicon))].map(n=>newName(n,vocab))}}).filter(l=>l.names.length)
 const ids=new Set(clearIds),secs=info.secs.filter(x=>info.items.some(r=>ids.has(r.id)&&r.sectionId===x.id))
 const head=lists.length===1&&!secs.some(x=>x.id!==lists[0]!.secId)?'Ho capito così, nei *'+info.secs.find(x=>x.id===lists[0]!.secId)!.name+'* del '+mLabel(info.menu.name)+':':'Ho capito così, nel '+mLabel(info.menu.name)+':'
 const out=[head]
 if(clearIds.length)out.push('Tolgo '+andList(info.items.filter(r=>ids.has(r.id)).map(r=>r.name))+'.')
 for(const l of lists){const sec=info.secs.find(x=>x.id===l.secId)!;out.push((lists.length>1||!head.includes('nei *')?'*'+sec.name+'*\n':'')+l.names.map(n=>'• '+n).join('\n'))}
 if(unplaced.length)out.push('Non so in quale sottomenu mettere '+andList(unplaced.map(n=>'*'+newName(n,vocab)+'*'))+': scrivimelo, per esempio «nei secondi inserisci '+newName(unplaced[0]!,vocab).toLowerCase()+'».')
 // nessun piatto da proporre (solo nomi senza sottomenu): una domanda, nessuna scrittura
 if(!lists.length)return{kind:'info',text:'Non ho cambiato nulla. '+out.slice(1).join(' ')}
 out.push(parse.guessed?'Va bene? Rispondi *sì*, oppure riscrivimi i piatti separati da una virgola.':'Va bene? Rispondi *sì* oppure scrivimi cosa correggere.')
 return{kind:'ask',question:out.join('\n\n'),wait:{kind:'propose',menuId:info.menu.id,clearIds,lists}}}
function applyProposal(info:MenuInfo,w:{clearIds:string[]},lists:{secId:string,names:string[]}[],vocab:string[]):RuleResult{
 const b=buildInsert(info,{lists:lists.map(l=>({secId:l.secId,word:info.secs.find(x=>x.id===l.secId)?.name??'',names:l.names})),loose:[]},vocab)
 const old=info.items.filter(r=>w.clearIds.includes(r.id)&&!b.touched.has(r.id)),actions=[...old.map(r=>({kind:'delete',id:r.id,soft:true}) as MenuAction),...b.actions]
 if(!actions.length)return{kind:'info',text:'Il '+mLabel(info.menu.name)+' è già così: non ho cambiato nulla.'}
 const csecs=info.secs.filter(x=>old.some(r=>r.sectionId===x.id)),wholeMenu=info.items.length>0&&info.items.every(r=>w.clearIds.includes(r.id))
 const report:RuleReport={menu:info.menu.name,fixed:true,cleared:old.map(r=>r.name),deleteWord:true,sections:b.sections,unknownSecs:b.unknownSecs,notPlaced:[...b.notPlaced],...(csecs.length&&!wholeMenu?{clearedSecs:csecs.map(x=>({secId:x.id,name:x.name}))}:{})}
 return{kind:'apply',menu:info.menu,actions,report,ask:null}}

// ---------- domanda del modello «Vuoi aggiungere questi piatti nei Primi…?» senza azioni (23/10, chat Luisa) ----------
/** I piatti del messaggio del titolare per una domanda di aggiunta che nomina UN sottomenu (e il suo Menu): azioni pronte e la domanda
 * con l'elenco, così il «sì» le applica. null = non si capisce (la domanda diventa una domanda specifica). */
export function insertForQuestion(question:string,text:string,o:{menus:RuleMenu[],sections:SectionRef[],refs:MenuRef[],lexicon?:Lexicon|null,history?:{role:string,text:string,at:number}[]}):{actions:MenuAction[],question:string}|null{
 const qm=menusIn(question,o.menus),m=qm.length===1?qm[0]!:(()=>{const c=contextMenu(o.history??[],o.menus);return c})();if(!m||m.pricing!=='fisso')return null
 const info=infoOf(m,o.sections,o.refs),qt=tokens(question),qs=mentions(qt,info.secs,menuSpans(qt,o.menus)).filter(x=>x.secId);const secIds=[...new Set(qs.map(x=>x.secId))];if(secIds.length!==1)return null
 const sec=info.secs.find(x=>x.id===secIds[0])!,p=plain(text);if(OTHER.test(p)||hasDigits(p)||CLEAR_V.test(p)||/\?/.test(text))return null
 const vocab=o.refs.map(r=>r.name),toks=tokens(text),sk=menuSpans(toks,o.menus),names=splitNamesX(toks.filter((x,i)=>!sk.has(i)),vocab,{lexicon:o.lexicon,section:sec.name,ask:false}).names
 if(!names.length||names.some(n=>NOT_DISH.test(plain(n))))return null
 const b=buildInsert(info,{lists:[{secId:sec.id,word:sec.name,names}],loose:[]},vocab);if(!b.actions.length)return null
 const list=b.actions.map(a=>'• '+(a.kind==='create'?(a as any).name:info.items.find(r=>r.id===(a as any).id)?.name??'')).filter(x=>x.length>2)
 return{actions:b.actions,question:'Aggiungo nei *'+sec.name+'* del '+mLabel(m.name)+':\n'+[...new Set(list)].join('\n')+'\n\nRispondi *sì* per aggiungerli, oppure riscrivimi i piatti.'}}

// ---------- risposta (formato strutturato v164) ----------
/** Testo della risposta: titolo per Menu, blocchi per sottomenu con un piatto per riga, note su ciò che non è entrato, «annulla». */
export function ruleReply(r:RuleReport,itemsBefore:MenuRef[],actions:MenuAction[],wrote=true,extra=''):string{
 const out:string[]=[],secNames=[...new Set(itemsBefore.map(i=>i.sectionId))]
 const visibleAfter=(secId:string)=>{const vis=itemsBefore.filter(i=>i.sectionId===secId&&!actions.some(a=>(a.kind==='delete'||a.kind==='hidden'&&(a as any).value)&&(a as any).id===i.id)&&(!i.hidden||actions.some(a=>a.kind==='hidden'&&(a as any).id===i.id&&!(a as any).value))).map(i=>i.name)
  return [...vis,...actions.filter(a=>a.kind==='create'&&a.sectionId===secId).map(a=>(a as any).name as string)]}
 void secNames
 const ins=r.sections.filter(s=>s.created.length||s.shown.length||s.already.length)
 const block=(secId:string,name:string)=>{const vis=visibleAfter(secId),created=new Set(r.sections.find(x=>x.secId===secId)?.created??[]);return '*'+name+'*\n'+(vis.length?vis.map(n=>'• '+n+(created.has(n)?' (nuovo)':'')).join('\n'):'• nessun piatto')}
 if(r.swapOut?.length){
  // 24/10: sostituzione «togli X metti Y»: titolo, i sottomenu toccati come sono adesso, cosa è stato tolto
  out.push('*'+(/^men[uù]\b/i.test(r.menu.trim())?r.menu.trim():'Menu '+r.menu.trim())+' aggiornato*')
  for(const x of r.sections)out.push(block(x.secId,x.name))
  out.push((r.swapOut.length===1?'Tolto: ':'Tolti: ')+r.swapOut.map(n=>'*'+n+'*').join(', ')+'.'+(r.soldOut?.length?' Finit'+(r.soldOut.length===1?'o':'i')+': '+r.soldOut.map(n=>'*'+n+'*').join(', ')+'.':''))}
 else if(r.clearedSecs?.length){
  // 23/10 (chat Luisa): sottomenu svuotati (± piatti nuovi): titolo, blocchi dei sottomenu toccati, piatti eliminati, invito a scrivere i nuovi.
  out.push('*'+(/^men[uù]\b/i.test(r.menu.trim())?r.menu.trim():'Menu '+r.menu.trim())+' aggiornato*')
  const done=new Set<string>();for(const c of r.clearedSecs){done.add(c.secId);out.push(block(c.secId,c.name))}
  for(const x of ins)if(!done.has(x.secId))out.push(block(x.secId,x.name))
  if(r.cleared.length)out.push('Eliminati: '+r.cleared.join(', ')+'.')
  if(!ins.some(x=>x.created.length||x.shown.length))out.push('Ora scrivimi i piatti nuovi, per esempio «nei '+plain(r.clearedSecs[0]!.name).split(' ')[0]+' inserisci lasagna, carbonara».')}
 else if(r.cleared.length&&!ins.length){
  out.push('*'+(/^men[uù]\b/i.test(r.menu.trim())?r.menu.trim():'Menu '+r.menu.trim())+' svuotato*')
  const secs=[...new Set(itemsBefore.map(i=>i.section??'').filter(Boolean))]
  out.push('Ho eliminato '+(r.kept?.length?(r.cleared.length===1?'1 piatto':r.cleared.length+' piatti'):r.cleared.length===1?'l’unico piatto':(/^(?:8|11)/.test(String(r.cleared.length))?'tutti gli ':'tutti i ')+r.cleared.length+' piatti')+'. '+(secs.length?'I sottomenu ('+andList(secs)+')':'I sottomenu')+(r.fixed?' e i prezzi fissi restano':' restano')+' come sono.')
  out.push('Eliminati: '+r.cleared.join(', ')+'.')
  out.push('Ora scrivimi i piatti nuovi, per esempio «nei primi inserisci carbonara, lasagne».')}
 else if(ins.length&&!wrote&&ins.every(x=>!x.created.length&&!x.shown.length)){const alr=ins.flatMap(x=>x.already.map(n=>'*'+n+'*'+' ('+x.name+')'))
  out.push((alr.length===1?alr[0]+' è già nel ':andList(alr)+' sono già nel ')+mLabel(r.menu)+': non ho cambiato nulla.')}
 else if(ins.length){
  out.push('*'+(/^men[uù]\b/i.test(r.menu.trim())?r.menu.trim():'Menu '+r.menu.trim())+' aggiornato*')
  if(r.cleared.length)out.push('Ho eliminato gli altri '+(r.cleared.length===1?'piatto':r.cleared.length+' piatti')+' del menu. Eliminati: '+r.cleared.join(', ')+'.')
  for(const s of ins){const vis=visibleAfter(s.secId),created=new Set(s.created)
   out.push('*'+s.name+'*\n'+(vis.length?vis.map(n=>'• '+n+(created.has(n)?' (nuovo)':'')).join('\n'):'• nessun piatto'))}
  }
 const secList=andList([...new Set(itemsBefore.map(i=>i.section??'').filter(Boolean))].map(x=>'*'+x+'*'))
 for(const u of r.unknownSecs)out.push('Non ho messo '+andList(u.names.map(n=>'*'+n+'*'))+': nel '+mLabel(r.menu)+' non c’è il sottomenu *'+capW(u.word)+'*'+(secList?' (ci sono '+secList+')':'')+'. Dimmi in quale metterl'+(u.names.length>1?'i':'o')+'.')
 if(r.kept?.length)out.push('Restano: '+andList(r.kept.map(n=>'*'+n+'*'))+'.')
 if(r.notFound?.length)out.push('Non trovo nel '+mLabel(r.menu)+' '+andList(r.notFound.map(n=>'*'+n+'*'))+': non l'+(r.notFound.length>1?'i':'o')+' ho toccat'+(r.notFound.length>1?'i':'o')+'.')
 if(r.notPlaced.length)out.push('Non ho messo '+andList(r.notPlaced.map(n=>'*'+n+'*'))+': dimmi in quale sottomenu'+(secList?' ('+secList.replace(/ e (?=\*[^*]+\*$)/,' o ')+')':'')+', per esempio «nei '+(plain([...new Set(itemsBefore.map(i=>i.section??'').filter(Boolean))][0]??'primi'))+' inserisci '+r.notPlaced[0]!.toLowerCase()+'».')
 if(extra)out.push(extra)
 if(wrote)out.push('Per tornare come prima scrivi *annulla* entro 10 minuti.')
 return out.join('\n\n')}

// ---------- sostituzione giornaliera letta dal server (bug 16:37 Victoria «trovo più sottomenu Primi») ----------
/** «stasera a cena metti primi: A e B, secondi C, contorni D» / «nel menu del giorno primi carbonara e pasta e fagioli»: Menu a prezzo
 * fisso DETTO nel messaggio + liste per sottomenu che sono tutte sottomenu di quel Menu, nessun altro comando. null = resta al modello. */
export function dailyReplaceParse(text:string,menus:RuleMenu[],sections:SectionRef[],refs:MenuRef[],lexicon:Lexicon|null=null):{menu:RuleMenu,lists:{secId:string,names:string[]}[]}|null{
 const p=plain(text);if(STRONG_INSERT.test(p)||OTHER.test(p)||hasDigits(p)||NEG.test(p)||CLEAR_V.test(p)||/\?/.test(text)||QUESTION_W.test(p))return null
 const ms=menusIn(text,menus);if(ms.length!==1||ms[0]!.pricing!=='fisso')return null
 const m=ms[0]!,secs=sections.filter(s=>s.menu===m.name),ip=parseInsert(text,secs,menus,refs.map(r=>r.name),{lexicon})
 if(!ip.lists.length||ip.loose.length||ip.lists.some(l=>!l.secId||!l.names.length))return null
 // 24/10 (batteria: «cosa c è nei primi a pranzo» → Primi ELIMINATI e piatto «A»): una domanda o un pezzo che non è un piatto non è mai una sostituzione
 if(ip.lists.some(l=>l.names.some(n=>plain(n).length<3||NOT_DISH.test(plain(n)))))return null
 return{menu:m,lists:ip.lists.map(l=>({secId:l.secId!,names:l.names}))}}

// ---------- sostituzione in una frase (24/10, chat Manuel 18:09 «menu mezzogirno togli lasagna metti rigatoni») ----------
// «togli X (e) metti Y», «al posto della X (metti) Y», «invece della X fai Y», «cambia/sostituisci X con Y», «X no, metti Y»: UNA operazione
// letta dal server = X eliminato (annulla 10 minuti) + Y nel sottomenu di X, nello stesso Menu. X deve essere un piatto che c'è (nome
// intero, inizio del nome, plurale o refuso); più piatti con quel nome in Menu diversi e nessun Menu detto → UNA domanda (1. 2.), il
// numero/«sì»/il nome eseguono tutta la sostituzione. Prima: «togli X e metti Y» con il Menu detto inseriva Y e perdeva «togli X»;
// senza «nei <sottomenu>» il validatore rifiutava la creazione e chiedeva «intendi *X*?» su un nome esatto, poi il «sì» non faceva nulla.
/** Refusi delle parole del pasto («mezzogirno», «pranzzo», «stassera») e «da 12» a inizio messaggio = il Menu da 12. */
export function fixMealWords(text:string):string{
 const near=(w:string,t:string,max:number)=>{if(w===t)return true;if(Math.abs(w.length-t.length)>max)return false;const d:number[][]=[];for(let i=0;i<=w.length;i++){d[i]=[i];for(let j=1;j<=t.length;j++)d[i]![j]=i?Math.min(d[i-1]![j]!+1,d[i]![j-1]!+1,d[i-1]![j-1]!+(w[i-1]===t[j-1]?0:1)):j}return d[w.length]![t.length]!<=max}
 let out=text.replace(/[A-Za-zÀ-ÿ]+/g,w=>{const p=plain(w);if(p.length>=8&&p!=='mezzogiorno'&&/^mez/.test(p)&&near(p,'mezzogiorno',2))return 'mezzogiorno';if(p.length>=5&&p!=='pranzo'&&/^pr/.test(p)&&!/^(?:prezz|pront|prima|primi|primo|prend|prov|pran[zs]i)/.test(p)&&near(p,'pranzo',1))return 'pranzo';if(p.length>=6&&p!=='stasera'&&/^sta/.test(p)&&!/^(?:stas|stat|stam)/.test(p.slice(0,4))&&near(p,'stasera',1))return 'stasera';return w})
 out=out.replace(/^(\s*(?:(?:ok|allora|ehm|per|x)\s+)?)da\s+(\d{1,3}(?:[.,]\d{1,2})?)(\s*(?:euro|eur|€))?(?=\s)/i,'$1menu da $2$3')
 return out}
const SW_OUT=/^(?:togli\w*|toglie\w*|lev[ai]\w*|levare|elimin\w*|cancell\w*|rimuov\w*|via|butta\w*)$/
const SW_IN=/^(?:metti|mettici|mettiamo|mettete|mettere|mettimi|metto|aggiung\w*|agiung\w*|inser\w*|fai|facciamo|fate|faccio)$/
const SW_SUB=/^(?:cambia\w*|cambi|sostituisc\w*|sostituire|scambia\w*|rimpiazz\w*)$/
const SW_LEAD=new Set(['ok','allora','ehm','no','scusa','e','ed','poi','oggi','adesso','ora','quindi','dai','anche','senti','ciao','buongiorno','allora','per','favore','mi','raccomando','ah','ecco','vabbe','va','bene','si'])
const SW_ART=new Set(['il','lo','la','l','i','gli','le','un','uno','una','dei','degli','delle','del','della','dello','dell','di','d'])
const SW_STOP=/^(?:finit\w*|esaurit\w*|prezz\w*|euro|cost\w*|foto|rinomin\w*|spost\w*|evidenz\w*|promo\w*|scont\w*|alz\w*|abbass\w*|aument\w*|diminu\w*|nascond\w*|annull\w*|\d.*)$/
export type SwapWait={kind:'swap',text:string,word:string,options:string[]}
type SwapCl={out:Tok[],in:Tok[]}
/** Clausole di sostituzione del testo (già senza parole del Menu). null = non è una sostituzione. */
function swapClauses(t:Tok[]):SwapCl[]|null{
 const W=t.map(x=>x.w),cls:SwapCl[]=[]
 let i=0
 const skipLead=()=>{while(i<W.length&&(SW_LEAD.has(W[i]!)||COURSES.includes(W[i]!)||(PREP.has(W[i]!)&&W[i+1]!=='posto')||W[i]==='a'||[',',';',':'].includes(W[i]!)))i++}
 // 28/10 (frasi nuove 010: «via lasagna e via arrosto, metti rigatoni e salsiccia»): «e via / , togli» continua l'elenco da togliere.
 const findIn=(from:number)=>{for(let k=from;k<W.length;k++){if(SW_IN.test(W[k]!))return k;if(SW_OUT.test(W[k]!)&&k>from&&!['e','ed',','].includes(W[k-1]!))return -1}return -1}
 const nextOut=(from:number)=>{for(let k=from;k<W.length;k++){if(SW_OUT.test(W[k]!)&&!(['e','ed',','].includes(W[k-1]??'')&&findIn(k+1)>k)||SW_SUB.test(W[k]!)||(W[k]==='al'&&W[k+1]==='posto')||(W[k]==='invece'&&k>from))return k}return W.length}
 const isSecW=(w:string)=>COURSES.includes(w)
 const trimTail=(a:number,b:number)=>{let e=b;while(e>a&&(SW_LEAD.has(W[e-1]!)||isSecW(W[e-1]!)||PREP.has(W[e-1]!)||[',',';',':','e','ed'].includes(W[e-1]!)))e--;return e}
 while(i<W.length){skipLead();if(i>=W.length)break
  let outA=-1,outB=-1,inA=-1,boundary=false
  if(SW_OUT.test(W[i]!)){outA=i+1;const k=findIn(outA);if(k<0)return cls.length?cls:null
   outB=k;while(outB>outA&&['e','ed',',',';','al','suo','posto','invece','ci','poi','anche'].includes(W[outB-1]!))outB--
   inA=k+1}
  else if(W[i]==='al'&&W[i+1]==='posto'||W[i]==='invece'){outA=i+(W[i]==='al'?2:1);const k=findIn(outA);if(k>=0){outB=k;inA=k+1}else{outB=-1;inA=-1;boundary=true}}
  else if(SW_SUB.test(W[i]!)){outA=i+1;boundary=true}
  else if(SW_IN.test(W[i]!)){// 28/10 (frasi nuove 004/008): «metti i ravioli al posto delle orecchiette», «metti le polpette invece della cotoletta»
   let k=-1;for(let j=i+1;j<W.length&&j<i+10;j++){if(W[j]==='al'&&W[j+1]==='posto'||W[j]==='invece'){k=j;break}if(SW_OUT.test(W[j]!)||SW_IN.test(W[j]!)||SW_SUB.test(W[j]!))break}
   if(k<0)return cls.length?cls:null
   const oA=k+(W[k]==='al'?2:1),oEnd=trimTail(oA,nextOut(oA));cls.push({out:t.slice(oA,oEnd),in:t.slice(i+1,trimTail(i+1,k))});i=oEnd;continue}
  else{// «X no (,) metti Y»
   const k=W.indexOf('no',i);if(k>i&&k<i+8&&(SW_IN.test(W[k+1]??'')||[',',';'].includes(W[k+1]??'')&&SW_IN.test(W[k+2]??''))){outA=i;outB=k;inA=k+(SW_IN.test(W[k+1]!)?2:3)}else return cls.length?cls:null}
  if(boundary){// confine da trovare dopo: «al posto di X Y», «cambia X con Y»
   const end=trimTail(outA,nextOut(outA+1));cls.push({out:t.slice(outA,end),in:[]});(cls[cls.length-1] as any).open=true;i=end;continue}
  const end=trimTail(inA,nextOut(inA));cls.push({out:t.slice(outA,outB),in:t.slice(inA,end)});i=end}
 return cls.length?cls:null}
const swNameToks=(x:Tok[])=>{let a=0,b=x.length;while(a<b&&(SW_ART.has(x[a]!.w)||SW_LEAD.has(x[a]!.w)||SW_OUT.test(x[a]!.w)))a++;while(b>a&&(SW_ART.has(x[b-1]!.w)||[',',';',':'].includes(x[b-1]!.w)))b--;return x.slice(a,b)}
/** Piatti esistenti con quel nome detto: nome intero → inizio del nome / parole contenute → refuso; il primo livello che trova vince. */
function swapFind(said:string,items:MenuRef[]):MenuRef[]{
 const s=sig(said);if(!s.length||said.length<3)return[]
 const ex=items.filter(r=>sameName(r.name,said));if(ex.length)return ex
 const wEq=(a:string,b:string)=>a===b||stem(a)===stem(b)||(a.length>=5&&b.length>=5&&lev1(a,b))
 const sub=items.filter(r=>{const n=sig(r.name);return s.every((w,k)=>n[k]!==undefined&&wEq(w,n[k]!))});if(sub.length)return sub
 const lev2=(a:string,b:string)=>{if(Math.abs(a.length-b.length)>2)return false;const d:number[][]=[];for(let i=0;i<=a.length;i++){d[i]=[i];for(let j=1;j<=b.length;j++)d[i]![j]=i?Math.min(d[i-1]![j]!+1,d[i]![j-1]!+1,d[i-1]![j-1]!+(a[i-1]===b[j-1]?0:1)):j}return d[a.length]![b.length]!<=2}
 return items.filter(r=>{const n=sig(r.name);return s.length<=n.length&&s.every((w,k)=>w===n[k]||(w.length>=7&&n[k]!.length>=7&&lev2(w,n[k]!))||(w.length>=5&&n[k]!.length>=5&&lev1(w,n[k]!)))})}
/** Pezzi di X: tutto il nome se è un piatto, altrimenti diviso su «e» / virgola dove ogni parte è un piatto. */
function swapOuts(x:Tok[],items:MenuRef[]):{said:string,hits:MenuRef[]}[]|null{
 const nt=swNameToks(x);if(!nt.length)return null
 const whole=nt.map(z=>z.raw).join(' ').replace(/' /g,"'"),h=swapFind(whole,items);if(h.length)return[{said:whole,hits:h}]
 for(let k=1;k<nt.length-1;k++)if(['e','ed',',',';'].includes(nt[k]!.w)){const a=swapOuts(nt.slice(0,k),items),b=swapOuts(nt.slice(k+1),items);if(a&&b)return[...a,...b]}
 return null}
/** Risultato della sostituzione (null = non è una sostituzione o non la so leggere: decide il resto del flusso). */
export function swapTurn(o:RuleInput,forced:Record<string,string>={}):RuleResult|null{
 const raw=fixMealWords(shorthand(o.text.replace(/[🎤]/gu,' '))).trim()
 const text=stripMenuPrice(raw,o.menus)||raw,p=plain(text)
 if(!/\b(?:togli\w*|toglie\w*|lev[ai]\w*|via|elimin\w*|cancell\w*|rimuov\w*|butta\w*|posto|invece|cambi\w*|sostituisc\w*|scambia\w*|rimpiazz\w*|no)\b/.test(p))return null
 if(NEG.test(p)||/\?\s*$/.test(text)||/\btutt[ieoa]\b/.test(p))return null
 const said=menusIn(raw,o.menus),t0=tokens(text),skip=menuSpans(t0,o.menus),t=t0.filter((x,k)=>!skip.has(k)&&!['sera','pranzo','cena','mezzogiorno','stasera','giorno','x'].includes(x.w))
 const cls=swapClauses(t);if(!cls)return null
 // ambito: Menu detto → Menu della conversazione → Menu a prezzo fisso → tutti
 const ctxM=said.length?null:contextMenu(o.history,o.menus,4)
 const scopes:MenuRef[][]=said.length?[o.refs.filter(r=>said.some(m=>m.name===r.menu))]:[...(ctxM?[o.refs.filter(r=>r.menu===ctxM.name)]:[]),o.refs.filter(r=>o.menus.some(m=>m.name===r.menu&&m.pricing==='fisso')),o.refs]
 const vocab=o.refs.map(r=>r.name),pairs:{out:MenuRef[],in:string[]}[]=[],soldOut:string[]=[]
 for(const c of cls){let outT=c.out,inT=c.in
  if((c as any).open){// confine: «al posto di X Y», «cambia X con/in Y»: X = il pezzo più lungo che è un piatto
   const nt=outT;let cut=-1
   for(let k=nt.length-1;k>=1;k--){const sep=['con','in','metti','fai'].includes(nt[k]!.w);const left=sep?nt.slice(0,k):nt.slice(0,k),right=sep?nt.slice(k+1):nt.slice(k);if(!right.length)continue
    if(left.length&&scopes.some(sc=>swapOuts(left,sc))){cut=k;outT=left;inT=right;break}}
   if(cut<0)return null}
  // coda «… e l'arrosto è finito» / «, la cotoletta è esaurita»: il piatto (nome intero di un piatto dello stesso ambito) segnato finito
  {const L=inT.length,last=inT[L-1]?.w??'';if(/^(?:finit\w*|esaurit\w*|terminat\w*)$/.test(last)){let v=L-1;if(['e','sono','so'].includes(inT[v-1]?.w??''))v--
    for(let j=v-1;j>=1;j--)if(['e','ed',',',';'].includes(inT[j]!.w)){const said=swNameToks(inT.slice(j+1,v)).map(z=>z.raw).join(' ').replace(/' /g,"'");let hit:MenuRef[]=[]
     for(const sc of scopes){hit=sc.filter(r=>!r.hidden&&sameName(r.name,said));if(hit.length)break}
     if(hit.length===1){soldOut.push(hit[0]!.id);inT=inT.slice(0,j);break}}}}
  if(inT.some(x=>SW_STOP.test(x.w)||SW_OUT.test(x.w)))return null
  let outs:{said:string,hits:MenuRef[]}[]|null=null
  for(const sc of scopes){outs=swapOuts(outT,sc);if(outs)break}
  if(!outs)return null
  const resolved:MenuRef[]=[]
  // 28/10 (frasi nuove 032: «togli spinaci e patate al forno metti insalata»): un piatto con omonimi in più Menu segue il Menu degli
  // altri piatti della stessa frase che hanno un solo riscontro.
  const anchor=[...new Set(outs.filter(x=>x.hits.length===1).map(x=>x.hits[0]!.menu))]
  for(const x of outs){let hits=x.hits
   if(hits.length>1&&anchor.length===1){const am=hits.filter(h=>h.menu===anchor[0]);if(am.length===1)hits=am}
   if(forced[plain(x.said)]){const f=o.refs.find(r=>r.id===forced[plain(x.said)]);if(f)hits=[f]}
   if(hits.length>1){const vis=hits.filter(h=>!h.hidden);if(vis.length===1)hits=vis}
   if(hits.length>1){const fx=hits.filter(h=>o.menus.some(m=>m.name===h.menu&&m.pricing==='fisso'));if(fx.length===1)hits=fx}
   if(hits.length>1){const opts=hits.slice(0,4)
    return{kind:'ask',question:'Quale *'+capW(x.said)+'* tolgo?\n'+opts.map((h,k)=>(k+1)+'. *'+h.name+'* ('+h.menu+(h.section?' › '+h.section:'')+')').join('\n')+'\n\nRispondi col numero.',wait:{kind:'swap',text:o.text.slice(0,600),word:plain(x.said),options:opts.map(h=>h.id)} as any}}
   resolved.push(hits[0]!)}
  const nt=swNameToks(inT);if(!nt.length)return null
  // 28/10 (frasi nuove 012: «mettimi il pollo arrosto» → «Pollo»): fino a 3 parole senza «e»/virgole è UN piatto, anche se una parola è
  // il nome di un altro piatto del menu.
  const ins=(nt.length<=3&&!nt.some(z=>['e','ed',',',';'].includes(z.w))?[capW(nt.map(z=>z.raw).join(' ').replace(/' /g,"'"))]:splitNames(nt,vocab,{lexicon:o.lexicon??null})).map(n=>n.trim()).filter(Boolean)
  if(!ins.length||ins.some(n=>NOT_DISH.test(plain(n))||n.split(' ').length>8))return null
  pairs.push({out:resolved,in:ins})}
 // tutto nello stesso Menu (mai sostituzioni a cavallo di più Menu in un messaggio)
 const menuName=pairs[0]!.out[0]!.menu;if(pairs.some(pp=>pp.out.some(r=>r.menu!==menuName)))return null
 const menu=o.menus.find(m=>m.name===menuName);if(!menu)return null
 if(menu.pricing!=='fisso')return null // alla carta il piatto nuovo vuole il prezzo: resta il percorso del modello
 const info=infoOf(menu,o.sections,o.refs)
 const outIds=new Set(pairs.flatMap(pp=>pp.out.map(r=>r.id)))
 const lists:InsertParse['lists']=[]
 for(const pp of pairs){const n=pp.in.length,m=pp.out.length
  pp.in.forEach((name,k)=>{const r=pp.out[n===m?k:Math.min(k,m-1)]!,sec=info.secs.find(s=>s.id===r.sectionId);if(!sec)return;const l=lists.find(x=>x.secId===sec.id);if(l)l.names.push(name);else lists.push({secId:sec.id,word:sec.name,names:[name]})})}
 // Y uguale a X («cambia la lasagna con la lasagna»): niente
 const b=buildInsert({...info,items:info.items.filter(r=>!outIds.has(r.id))},{lists,loose:[]},vocab)
 const dels=[...outIds].map(id=>({kind:'delete',id,soft:true}) as MenuAction)
 const outNames=[...outIds].map(id=>o.refs.find(r=>r.id===id)!.name)
 const secs=b.sections.length?b.sections:[...new Set(pairs.flatMap(pp=>pp.out.map(r=>r.sectionId!)))].map(id=>({secId:id,name:info.secs.find(s=>s.id===id)?.name??'',created:[],shown:[],already:[]}))
 for(const pp of pairs)for(const r of pp.out)if(!secs.some(s=>s.secId===r.sectionId))secs.push({secId:r.sectionId!,name:r.section??'',created:[],shown:[],already:[]})
 const report:RuleReport={menu:menu.name,fixed:true,cleared:[],deleteWord:false,sections:secs,unknownSecs:b.unknownSecs,notPlaced:b.notPlaced,swapOut:outNames}
 const sold=soldOut.filter(id=>!outIds.has(id)&&o.refs.find(r=>r.id===id)?.menu===menu.name).map(id=>({kind:'available',id,value:false}) as MenuAction)
 if(soldOut.length&&!sold.length)return null
 for(const id of soldOut){const r=o.refs.find(x=>x.id===id)!;if(!report.sections.some(x=>x.secId===r.sectionId))report.sections.push({secId:r.sectionId!,name:r.section??'',created:[],shown:[],already:[]})}
 if(sold.length)report.soldOut=sold.map(a=>o.refs.find(r=>r.id===(a as any).id)!.name)
 return{kind:'apply',menu,actions:[...dels,...b.actions,...sold],report}}
/** Risposta alla domanda «Quale *X* tolgo? 1. … 2. …» della sostituzione: numero, nome del Menu/piatto, o «sì» con una sola opzione. */
export function swapAnswer(o:RuleInput,w:SwapWait):RuleResult|null{
 const p=plain(o.text),num=p.match(/^(?:il |la |numero |n )?(\d)$/)?.[1]??(/^(?:il |la )?prim[oa]\b/.test(p)?'1':/^(?:il |la )?second[oa]\b/.test(p)?'2':null)
 const opts=w.options.map(id=>o.refs.find(r=>r.id===id)).filter((r):r is MenuRef=>!!r)
 let pick:MenuRef|undefined=num?opts[Number(num)-1]:undefined
 if(!pick){const ms=menusIn(fixMealWords(o.text),o.menus);const by=opts.filter(r=>ms.some(m=>m.name===r.menu));if(by.length===1)pick=by[0]}
 if(!pick&&opts.length===1&&isAffirmative(o.text))pick=opts[0]
 if(!pick)return null
 return swapTurn({...o,text:w.text,wait:null},{[w.word]:pick.id})}
