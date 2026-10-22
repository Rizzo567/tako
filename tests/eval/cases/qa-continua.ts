// Set QA-CONTINUA (22/10 notte, richiesta del coordinatore): la batteria dal vivo `scratchpad/notte/qa-live-batteria.mjs` (27 conversazioni
// sul QA vero) portata nell'harness con fixture `qavero` (identica al QA dopo v146) e STORIA CHE CONTINUA: è UNA sola conversazione dello
// stesso telefono sullo stesso db, senza reset, con 2 minuti di attesa tra una conversazione e l'altra (come dal vivo). Le attese sono quelle
// della batteria: per ogni messaggio regex che la risposta deve / non deve avere e lo stato del menu rispetto all'INIZIO di quella
// conversazione (controllo `steps` in eval-haiku.test.ts). Alla fine il menu è identico all'inizio (ogni conversazione si ripristina da sola).
import type {Family,Turn} from '../types.js'
import type {HaikuCase} from './victoria-1019.js'

export type Step={turn:number,base:number,conv:string,diff?:string[],re?:RegExp[],no?:RegExp[]}
type T1=[string,{re?:string[],no?:string[],diff?:string[]}?]
const ASK=String.raw`\?|rispondi|dimmi`,NODONE=String.raw`\b(fatto|aggiornat|cambiat|pubblicat|messo|alzat|nascost)\w*`
const P=(d:string,p:number)=>`price|${d}|${p}`,ALL4=[P('la parmigiana',13),P('pasta al pesto',9.5),P('pasta carbonara',9.5),P('riso giallo',8.5)]
const CONVS:[string,T1[]][]=[
 ['annulla-domanda-aperta',[['aggiungi il vitello tonnato',{re:[ASK],diff:[]}],['annulla',{no:[String.raw`sottomenu.*\?|prezzo.*\?`,String.raw`torna come prima|com.era prima`],diff:[]}]]],
 ['lettura-prezzo',[['quanto costa il riso giallo?',{re:[String.raw`\b8\b`],diff:[]}]]],
 ['pronome-alzalo',[['quanto costa il riso giallo?',{re:[String.raw`\b8\b`],diff:[]}],['alzalo di un euro',{re:[String.raw`\b9\b`],no:[String.raw`intendi|\?`],diff:[P('riso giallo',9)]}],['annulla',{diff:[]}]]],
 ['pronome-mettila',[['quanto costa la pasta carbonara?',{re:[String.raw`\b9\b`],diff:[]}],['mettila a 10',{re:[String.raw`\b10\b`],no:[String.raw`\?`],diff:[P('pasta carbonara',10)]}],['annulla',{diff:[]}]]],
 ['pronome-toglila',[['quanto costa la pasta al ragù?',{re:[String.raw`\b10\b`],diff:[]}],['toglila',{no:[String.raw`\?`],diff:['hidden|pasta al ragù|true']}],['rimettila',{no:[String.raw`\?`],diff:[]}]]],
 ['pronome-finito',[["c'è il tiramisù?",{diff:[]}],['è finito',{no:[String.raw`\?`],diff:['available|tiramisù|false']}],['è tornato',{no:[String.raw`\?`],diff:[]}]]],
 ['nuovo-solo-prezzo',[['aggiungi le patatine fritte',{re:[String.raw`prezz|quanto`,String.raw`sottomenu`],no:[String.raw`\bla metto`],diff:[]}],['4',{re:[String.raw`\b4\b`,String.raw`sottomenu`],no:[String.raw`prezz.*\?`],diff:[]}],['nei Piatti di prova',{no:[String.raw`\?`],diff:['create|patatine fritte|4|piatti di prova']}],['annulla',{diff:[]}]]],
 ['nuovo-con-prezzo',[['aggiungi patatine fritte a 4',{re:[String.raw`sottomenu`],no:[String.raw`prezz.*\?`],diff:[]}],['nei Primi del Menu di verifica',{no:[String.raw`\?`],diff:['create|patatine fritte|4|primi']}],['annulla',{diff:[]}]]],
 ['nuovo-solo-sottomenu',[['aggiungi il vitello tonnato nei Primi del Menu di verifica',{re:[String.raw`prezz|quanto`],no:[String.raw`sottomenu.*\?`],diff:[]}],['14',{no:[String.raw`\?`],diff:['create|vitello tonnato|14|primi']}],['annulla',{diff:[]}]]],
 ['si-a-domanda-a-scelta',[['aggiungi patatine fritte a 4',{re:[String.raw`sottomenu`],diff:[]}],['sì',{re:[String.raw`sottomenu|quale`],no:[String.raw`cosa vuoi cambiare`],diff:[]}],['lascia stare',{diff:[]}]]],
 ['tutti-e-due',[['quanto costano il riso giallo e la pasta carbonara?',{re:[String.raw`\b8\b`,String.raw`\b9\b`],diff:[]}],['alzali tutti e due di 50 centesimi',{no:[String.raw`\?`],diff:[P('riso giallo',8.5),P('pasta carbonara',9.5)]}],['annulla',{diff:[]}]]],
 ['gruppo-menu-detto',[['alza di 50 centesimi i primi del Menu di verifica',{no:[String.raw`quale piatto|rispondi col numero`],diff:ALL4}],['annulla',{diff:[]}]]],
 ['gruppo-senza-menu',[['alza di 50 centesimi i primi',{no:[String.raw`quale piatto|rispondi col numero`]}],['annulla',{diff:[]}]]],
 ['prezzo-lettere-1',[['il riso giallo a otto e cinquanta',{no:[String.raw`\?`],diff:[P('riso giallo',8.5)]}],['annulla',{diff:[]}]]],
 ['prezzo-lettere-2',[['la pasta al sugo a dieci euro e mezzo',{no:[String.raw`\?`],diff:[P('Pasta al sugo',10.5)]}],['annulla',{diff:[]}]]],
 ['nascondi-mostra',[['nascondi il riso giallo',{no:[String.raw`\?`],diff:['hidden|riso giallo|true']}],['mostralo di nuovo',{no:[String.raw`\?`],diff:[]}]]],
 ['finito-tornato',[['la pasta al sugo è finita',{no:[String.raw`\?`],diff:['available|Pasta al sugo|false']}],['la pasta al sugo è tornata',{no:[String.raw`\?`],diff:[]}]]],
 ['elimina-poi-annulla',[['elimina la pasta al sugo',{re:[String.raw`sì|si\b`],diff:[]}],['annulla',{diff:[]}]]],
 ['vietato-tutto-zero',[['metti tutto a zero',{re:[ASK],no:[NODONE],diff:[]}],['no',{diff:[]}]]],
 ['vietato-elimina-primi',[['elimina tutti i primi',{re:[ASK],diff:[]}],['no',{diff:[]}]]],
 ['riepilogo-pollice',[['riso giallo a 9, pasta carbonara a 10, pasta al sugo a 10, tiramisù a 16',{re:[String.raw`\bok\b`],diff:[]}],['👍',{no:[String.raw`\?`],diff:[P('riso giallo',9),P('pasta carbonara',10),P('Pasta al sugo',10),P('tiramisù',16)]}],['annulla',{diff:[]}]]],
 ['ambiguo-pesto-ok',[['alza il pesto di un euro',{re:[ASK],diff:[]}],['la pasta al pesto dei primi',{no:[String.raw`\?`],diff:[P('pasta al pesto',10)]}],['annulla',{diff:[]}]]],
 ['lettura-primi',[["cosa c'è nei primi?",{re:[String.raw`riso giallo`,String.raw`carbonara`],diff:[]}]]],
 ['lettura-paste-primi',[['quante paste ho nei primi?',{re:[String.raw`pesto`,String.raw`carbonara`],no:[String.raw`ragù|sugo|gnocchi`],diff:[]}]]],
 ['prezzo-insolito-no',[['il riso giallo a 80',{re:[ASK],no:[NODONE],diff:[]}],['no',{diff:[]}]]],
 ['anzi-rimettilo',[['il riso giallo a 9',{no:[String.raw`\?`],diff:[P('riso giallo',9)]}],['anzi rimettilo a 8',{no:[String.raw`\?`],diff:[]}]]],
 // fase 3: dal vivo «annulla» di ripristino parte solo se la conversazione ha scritto (altrimenti annullerebbe la conversazione prima):
 // qui il ripristino è «rimetti la pasta carbonara nel menu» (se non era stata tolta: «è già visibile»).
 ['ok-a-domanda',[['togli la carbonara',{no:[String.raw`elimin`]}],['rimetti la pasta carbonara nel menu',{diff:[]}]]],
 // ---- fase 3 (22/10 notte): i 3 KO dal vivo v149 con la storia prima + uso reale in sequenza (memoria a breve) ----
 ['v149-patatine-crea-elimina',[['aggiungi le patatine fritte a 4 nei Piatti di prova',{no:[String.raw`\?`],diff:['create|patatine fritte|4|piatti di prova']}],['elimina le patatine fritte',{re:[String.raw`rispondi \*?s`],diff:['create|patatine fritte|4|piatti di prova']}],['sì',{diff:[]}]]],
 ['v149-nuovo-dopo-eliminato',[['aggiungi patatine fritte a 4',{re:[String.raw`sottomenu`,String.raw`\b4\b`],no:[String.raw`prezz.*\?`,String.raw`Completo`],diff:[]}],['nei Primi del Menu di verifica',{no:[String.raw`\?`],diff:['create|patatine fritte|4|primi']}],['annulla',{diff:[]}]]],
 ['v149-pesto-poi-anzi',[['alza il pesto di un euro',{re:[ASK],diff:[]}],['la pasta al pesto dei primi',{no:[String.raw`\?`],diff:[P('pasta al pesto',10)]}],['annulla',{diff:[]}],['il riso giallo a 9',{no:[String.raw`\?`],diff:[P('riso giallo',9)]}],['anzi rimettilo a 8',{no:[String.raw`\?`,String.raw`pesto`],diff:[]}]]],
 ['v149b-annulla-dopo-scrittura',[['aggiungi le patatine fritte a 4 nei Piatti di prova',{no:[String.raw`\?`],diff:['create|patatine fritte|4|piatti di prova']}],['nei Piatti di prova',{diff:['create|patatine fritte|4|piatti di prova']}],['annulla',{no:[String.raw`non ho cambiato nulla`],diff:[]}]]],
 ['sposta-dopo-creazione',[['aggiungi il vitello tonnato a 14 nei Piatti di prova',{no:[String.raw`\?`],diff:['create|vitello tonnato|14|piatti di prova']}],['no, nei Primi del Menu di verifica',{no:[String.raw`\?`],diff:['create|vitello tonnato|14|primi']}],['elimina il vitello tonnato',{re:[String.raw`rispondi \*?s`],diff:['create|vitello tonnato|14|primi']}],['sì',{diff:[]}]]],
 ['lettura-poi-nuovo',[["cosa c'è nei primi?",{re:[String.raw`riso giallo`],diff:[]}],['aggiungi le trofie al pesto a 11 nei primi',{no:[String.raw`\?`],diff:['create|trofie al pesto|11|primi']}],['annulla',{diff:[]}]]],
 ['pronome-dopo-scrittura',[['quanto costa la pasta carbonara?',{re:[String.raw`\b9\b`],diff:[]}],['alzala di un euro',{no:[String.raw`\?`],diff:[P('pasta carbonara',10)]}],['alzala ancora di 50 centesimi',{no:[String.raw`\?`],diff:[P('pasta carbonara',10.5)]}],['rimettila a 9',{no:[String.raw`\?`],diff:[]}]]],
 ['tutti-e-due-dopo-scrittura',[['il riso giallo a 9 e la pasta carbonara a 10',{no:[String.raw`\?`],diff:[P('riso giallo',9),P('pasta carbonara',10)]}],['abbassali tutti e due di un euro',{no:[String.raw`\?`],diff:[]}]]],
 ['finito-poi-tornato',[["c'è la pasta al ragù?",{re:[String.raw`rag[uù]`],diff:[]}],['è finita',{no:[String.raw`\?`],diff:['available|pasta al ragù|false']}],['no scusa, è tornata',{no:[String.raw`\?`],diff:[]}]]],
 ['nascondi-poi-rimettilo',[['nascondi il tiramisù',{no:[String.raw`\?`],diff:['hidden|tiramisù|true']}],['rimettilo',{no:[String.raw`\?`],diff:[]}]]],
 ['scrittura-poi-lettura-altro',[['la pasta al sugo a 10',{no:[String.raw`\?`],diff:[P('Pasta al sugo',10)]}],['quanto costa il riso giallo?',{re:[String.raw`\b8\b`],diff:[P('Pasta al sugo',10)]}],['mettilo a 9',{no:[String.raw`\?`],diff:[P('Pasta al sugo',10),P('riso giallo',9)]}],['annulla',{diff:[P('Pasta al sugo',10)]}],['la pasta al sugo a 9',{no:[String.raw`\?`],diff:[]}]]],
 ['nuovo-solo-nome-lascia',[['aggiungi la frittatina',{re:[ASK],no:[String.raw`Completo`],diff:[]}],['lascia stare',{diff:[]}]]],
 ['conta-primi',[['quanti piatti ho nei Primi del Menu di verifica?',{re:[String.raw`\b4\b|quattro`],no:[String.raw`Lasagna|Gnocchi`],diff:[]}]]],
 ['evidenza-poi-togli',[['metti in evidenza il tiramisù',{no:[String.raw`\?`],diff:['featured|tiramisù|true']}],["toglilo dall'evidenza",{no:[String.raw`\?`],diff:[]}]]],
 ['finito-nome-poi-pronome',[['il riso giallo è finito',{no:[String.raw`\?`],diff:['available|riso giallo|false']}],['quanto costa la pasta al pesto?',{re:[String.raw`\b9\b`],diff:['available|riso giallo|false']}],['il riso giallo è tornato',{no:[String.raw`\?`],diff:[]}]]],
]
// notte 22/10 (fase 3): la batteria dal vivo NON aspetta tra una conversazione e l'altra (2,5 s tra i messaggi): la variante «rapida»
// è senza attese, così il contesto della conversazione prima pesa come dal vivo (il set con 2 minuti passava, il vivo no).
function build(id:string,wait:number){const turns:Turn[]=[],steps:Step[]=[];let n=0
CONVS.forEach(([cid,ts],k)=>{if(k&&wait)turns.push({wait});const base=n;for(const [m,x] of ts){turns.push({text:m});n++;steps.push({turn:n,base,conv:cid,...(x?.diff?{diff:x.diff}:{}),...(x?.re?{re:x.re.map(r=>new RegExp(r,'i'))}:{}),...(x?.no?{no:x.no.map(r=>new RegExp(r,'i'))}:{})})}})
return {id,family:'bv-multiple' as Family,menu:'qavero',turns,changes:[],steps,source:'batteria dal vivo QA v145–v149 (27 conversazioni di fila, storia che continua'+(wait?', 2 min tra le conversazioni)':', senza attese come dal vivo)')} as any}
export const QA_CONTINUA_CASES:(HaikuCase&{steps:Step[]})[]=[build('qa-continua',2),build('qa-continua-rapida',0)]
