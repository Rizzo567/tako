// A8.0 (verifica avversaria Y, 17/10 notte): regola strutturale «lettura completa».
// Il percorso deterministico può SCRIVERE (o proporre una conferma) solo se ogni parola del messaggio ha un significato letto:
// una parola di servizio o di cortesia nota, un numero/prezzo, un verbo la cui azione c'è davvero tra quelle capite, una
// parola del nome di un piatto/categoria toccato, oppure il nome nuovo detto in una posizione esplicita (contiguo nel testo,
// senza verbi né cortesie dentro: un secondo verbo chiude il nome). Se resta testo non spiegato il messaggio passa al cervello
// (con il validatore) o, con Groq spento, a una domanda breve che cita quel testo. Le liste qui sotto sono il vocabolario
// che il deterministico SA leggere: una parola nuova non allarga mai una scrittura, la manda al cervello.
import type {MenuAction,MenuRef,SectionRef} from './twilio-menu-ai.js'
import {sameWord,nearWord} from './twilio-menu-nlu.js'
import {phoneScore} from './twilio-menu-phonetic.js'
import {g9WordNumber} from './twilio-menu-ai.js'

const fold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/€/g,' euro ').replace(/(\d)[,.](\d)/g,'$1.$2').replace(/[^a-z0-9.+\-]+/g,' ').replace(/(?<!\d)\.|\.(?!\d)/g,' ').replace(/\s+/g,' ').trim()
const words=(s:string)=>fold(s).split(' ').filter(Boolean)

// Parole di servizio: articoli, preposizioni, pronomi, congiunzioni, ausiliari, quantificatori.
const FUNCTION=new Set(('il lo la i gli le l un uno una un di da del dello della dei degli delle d al allo alla ai agli alle dal dallo dalla dai dagli dalle '+
 'nel nello nella nei negli nelle con col coi su sul sullo sulla sui sugli sulle per tra fra a ad in e ed o od oppure che chi cui ci ce ne mi ti si vi me te se '+
 'li non no ne anche pure poi invece solo soltanto tutti tutte tutto tutta entrambi entrambe ambedue quei quegli quelle quelli quello quella quel questo questa questi queste '+
 'lui lei suo sua suoi sue loro mio mia miei mie ho hai ha abbiamo avete hanno e sono sei siamo siete era c cè piu ancora gia proprio cosi come quanto quanti quanta quante '+
 'stesso stessa stessi stesse altro altra altri altre ogni nostro nostra dentro li la qui qua ecco tipo quindi ma pero perche visto oramai ormai '+
 // ordinali (risposte a «quale?»), esclusioni, tempo delle promo
 'primo prima secondo seconda terzo terza quarto quarta ultimo ultima numero tranne eccetto esclus escluso esclusa esclusi escluse parte meno fino sino entro da '+
 'stasera domani dopodomani sera pranzo cena settimana weekend giorno giorni lunedi martedi mercoledi giovedi venerdi sabato domenica mese '+
 // modali e ausiliari («devi creare», «vorrei», «deve essere a 18»)
 'devi deve devono dovresti puoi potresti posso possiamo vorrei voglio volevo vogliamo essere sia siano stato stata fare facciamo fammi').split(' '))
// Cortesia e riempitivi noti (detti da soli o in coda): non sono mai parte di un nome nuovo.
const COURTESY=new Set(('favore perfavore piacere cortesia grazie mille ok okay dai allora ecco si va bene perfetto ciao buongiorno buonasera salve senti ehm eh ah oh mh '+
 'beh cioe insomma comunque subito adesso ora oggi intanto please thx thanks top raga ragazzi capo scusa scusami aspetta ops pardon '+
 // conferme («vai», «procedi»): rispondono a una domanda, non sono nomi
 'vai procedi conferma confermo confermato certo esatto giusto daje anzi '+
 'definitivamente completamente proprio totalmente sempre del tutto davvero').split(' '))
// Numeri detti a parole e unità del prezzo.
const NUMBER=new Set(('zero uno una due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici diciassette diciotto diciannove venti '+
 'ventuno ventidue ventitre ventiquattro venticinque ventisei ventisette ventotto ventinove trenta quaranta cinquanta sessanta settanta ottanta novanta cento mezzo mezza '+
 'euro eur euri centesimi cent centesimo virgola').split(' '))
// Parole del dominio senza un'azione propria (oggetto della frase).
const DOMAIN=new Set('menu menù piatto piatti prezzo prezzi costa costano costare categoria categorie sezione sezioni voce voci carta listino nuovo nuova nuovi nuove ce nome coperto'.split(' '))

type Kind=MenuAction['kind']|'any'
// Verbi: la parola è letta solo se tra le azioni capite c'è uno dei tipi che il verbo può voler dire.
const VERBS:[RegExp,Kind[]][]=[
 [/^(?:elimin|cancell)\w*$/,['delete']],
 [/^rimuov\w*$/,['delete','hidden']],
 [/^nascond\w*$/,['hidden']],
 [/^(?:togli|tolg|tolt|lev)\w*$/,['hidden','price','featured','delete','tag','promo']],
 [/^(?:rimett|mostr|riattiv)\w*$/,['hidden','available','featured','price','restore' as Kind]],
 [/^(?:finit|esaurit|fernut|terminat|finid|finia)\w*$/,['available']],
 [/^(?:tornat|torna|disponibil)\w*$/,['available','price','hidden']],
 [/^(?:evidenz|evidenza)\w*$/,['featured']],
 [/^(?:rinomin|chiam)\w*$/,['rename','rename_section','create','create_section']],
 [/^(?:spost|spostal|spostac)\w*$/,['move']],
 [/^(?:crea|creal|crean|creare)\w*$/,['create_section','create','special']],
 [/^(?:aggiung|inseri|aggiunt)\w*$/,['create','special','create_section','move','hidden','price']],
 [/^(?:aument\w*|alz[aio]\w*|abbass\w*|ridu[cr]\w*|riduci|cala|calal[ao]|calare|calato|cali|scala|scalal[ao]|scalare|scalagli|scalato|sconta\w*|rincar\w*)$/,['price','promo']],
 [/^(?:promo|offert|scont)\w*$/,['promo','price']],
 [/^descrizion\w*$/,['description']],
 // Etichette e scarsità (percorso vendite, grammatica sua): «ultime porzioni», «piccante», «solo oggi», «etichette».
 [/^(?:etichett|porzion|ultim|piccant|vegan|vegetarian|glutin|celiac|consigliat|novita|scarsit|limitat|bollin)\w*$/,['tag','scarcity','promo']],
 [/^(?:passa|passano|passare|passal[ao]|sale|salire|salgono|scende|scendere|scendono)$/,['price']],
 // Verbi generici: «metti», «porta», «cambia», «imposta», «segna», «fai», «va»: qualunque azione capita.
 [/^(?:mett\w*|port[aio]\w*|cambi\w*|impost\w*|segn[aio]\w*|fa|fai|fare|fall[aoie]|vanno|va|diventa|diventano|deve|devono|lascia\w*|lasci|tien[ie]\w*|teng[oa]\w*)$/,['any']],
]
// Forme di base per i refusi sui verbi («aggingi», «nascodi», «elimna»): parola lunga a un errore da una di queste.
const VERB_FORMS:[string,Kind[]][]=[['aggiungi',['create','special','create_section','move']],['nascondi',['hidden']],['elimina',['delete']],['cancella',['delete']],['sposta',['move']],['rinomina',['rename','rename_section']],['togli',['hidden','price','featured','delete','tag','promo']],['finito',['available']],['finita',['available']],['esaurito',['available']],['esaurita',['available']],['rimetti',['hidden','available','featured','price']],['evidenza',['featured']],['aumenta',['price','promo']],['abbassa',['price','promo']]]
const edit1=(a:string,b:string)=>{if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,e=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++e>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}}return e+(a.length-i)+(b.length-j)<=1}
const verbKinds=(w:string):Kind[]|null=>{for(const [re,k] of VERBS)if(re.test(w))return k;if(w.length>=6)for(const [f,k] of VERB_FORMS)if(w[0]===f[0]&&edit1(w,f))return k;return null}
export const isVerbWord=(w:string)=>verbKinds(fold(w))!==null&&!['va','fa'].includes(fold(w))

/** Un nome nuovo è letto solo se è nel testo così com'è (contiguo) e non contiene verbi né cortesie: «Gricia romana e mettila
 * a 12», «Crudi per favore», «Linguine thx» (dopo il prezzo) non sono nomi. */
export function nameIsExplicit(name:string,text:string):boolean{
 const n=words(name);if(!n.length)return false
 // Un verbo d'azione dentro il nome lo chiude (le parole delle etichette, «piccante», possono essere nomi).
 if(n.some(w=>COURTESY.has(w)||(verbKinds(w)&&!(verbKinds(w)!.includes('tag'))&&!['va','fa','port','cal','passa'].some(p=>w===p))))return false
 return (' '+words(text).join(' ')+' ').includes(' '+n.join(' ')+' ')}

export type Reading={unread:string[]}
/** Parole del messaggio che le azioni capite non spiegano (vuoto = lettura completa). */
export function unreadWords(text:string,actions:MenuAction[],refs:MenuRef[],sections:SectionRef[],opts:{excludedIds?:string[],extraNames?:string[],known?:string[],lenientNumbers?:boolean}={}):string[]{
 const kinds=new Set<string>(actions.map(a=>a.kind));if(actions.some(a=>(a as any).fromRestore))kinds.add('restore')
 const touched=new Set<string>([...actions.flatMap(a=>'id' in a?[(a as any).id as string]:[]),...(opts.excludedIds??[])])
 const nameWords:string[]=[]
 for(const r of refs)if(touched.has(r.id)){nameWords.push(...words(r.name));if(r.section)nameWords.push(...words(r.section))}
 for(const a of actions){const sid=(a as any).sectionId as string|undefined;if(sid){const s=sections.find(x=>x.id===sid);if(s)nameWords.push(...words(s.name))}}
 // Nomi nuovi (piatto, piatto del giorno, rinomina, categoria): letti solo se espliciti.
 const created=[...actions.flatMap(a=>(a.kind==='create'||a.kind==='special'||a.kind==='rename'||a.kind==='create_section'||a.kind==='rename_section')?[(a as any).name as string]:[]),...(opts.extraNames??[])]
 // Nomi già detti prima (bozza in sospeso: «il pesto a 10 e il sugo a 20» completa Trofie al pesto e Polpette al sugo).
 for(const n of opts.known??[])nameWords.push(...words(n))
 const newWords=new Set<string>();for(const n of created)if(nameIsExplicit(n,text))for(const w of words(n))newWords.add(w)
 if(actions.some(a=>a.kind==='special'))for(const w of ['piatto','del','giorno','fuori','speciale','abbiamo'])newWords.add(w)
 const hitName=(w:string)=>nameWords.some(n=>sameWord(w,n)||nearWord(w,n)||(w.length>=3&&n.length>=3&&phoneScore(w,n)>=0.6))
 // «tutti i primi finiti tranne la lasagna e la pasta e fagioli»: i piatti dopo «tranne» sono letti (esclusi dall'azione).
 const exc=fold(text).match(/\b(?:tranne|eccetto|esclus\w*|a parte|meno che)\b(.*)$/)
 if(exc){const tail=new Set(words(exc[1]!));for(const r of refs)if(words(r.name).some(w=>tail.has(w)))nameWords.push(...words(r.name))}
 // Un numero è letto solo se è un prezzo delle azioni o la differenza di un cambio di prezzo («aumenta di 1»): un prezzo detto
 // e non usato («sposta la carbonara nei secondi e mettila a 14» letta come solo spostamento) è una parte persa.
 const nums=new Set<number>();const r2=(x:number)=>Math.round(x*100)/100
 for(const a of actions){const pr=(a as any).price;if(typeof pr==='number'){nums.add(r2(pr));const old=refs.find(r=>r.id===(a as any).id)?.price;if(typeof old==='number')nums.add(r2(Math.abs(pr-old)))}}
 // Il prezzo attuale di un piatto toccato («la parmigiana a 10», già a 10) è letto: dice che resta com'è.
 for(const r of refs)if(touched.has(r.id)&&typeof r.price==='number')nums.add(r2(r.price))
 const numOk=(w:string)=>{if(opts.lenientNumbers)return true;const n=Number(w.replace(/^[+]/,''));if(!Number.isFinite(n))return false;return nums.has(r2(Math.abs(n)))||[...nums].some(x=>Math.abs(x-n)<0.005)}
 const out:string[]=[]
 for(const w of words(text)){
  if(/^[+\-]?\d/.test(w)){if(numOk(w)||newWords.has(w)||nameWords.includes(w))continue;out.push(w);continue}
  if(FUNCTION.has(w)||COURTESY.has(w)||NUMBER.has(w)||DOMAIN.has(w)||w.length<=1||g9WordNumber(w)!==null)continue
  if(newWords.has(w)||hitName(w))continue
  const k=verbKinds(w);if(k){if(k.includes('any')||k.some(x=>kinds.has(x)))continue;out.push(w);continue}
  out.push(w)}
 return [...new Set(out)]}
