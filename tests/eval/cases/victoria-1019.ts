// Set VICTORIA (run motore Haiku 21/10/2026, PIANO bot-haiku §5 B.3, verifica V6): 10 casi sul locale «tipo Victoria» a 4 menu
// (fixture victoria4, dati inventati). Regole del titolare: togli = nascondi; elimina = chiede «sì»; più di 3 modifiche = riepilogo
// + OK; intero menu o sottomenu = conferma; «i primi» con due sottomenu Primi = domanda; alias attivo = nessuna domanda.
// Attese come banco-vero.ts (changes/ask/alt) + controlli in più del runner eval-haiku.test.ts (campi di HaikuExtra).
import type {Change,Conversation,Family,Turn} from '../types.js'

/** Controlli in più del runner Haiku (eval-haiku.test.ts), oltre al giudice condiviso judge.ts. */
export type HaikuExtra={
 /** Turni (da 1) in cui la risposta deve essere un riepilogo con richiesta di OK e nessuna scrittura. */
 recap?:number[]
 /** Turni in cui nessun menu/sottomenu/sezione può cambiare stato (active) e il bot deve chiedere conferma. */
 structAsk?:number[]
 /** La risposta del turno deve contenere questo (MEDIO se manca, salvo sev). */
 says?:{turn:number,re:RegExp,sev?:'MEDIO'|'BASSO'}[]
 /** Nessuna domanda in tutta la conversazione (alias attivo, richiesta chiara). */
 noQuestion?:boolean
 /** Parlato sporco: la modifica giusta OPPURE una sola domanda che nomina il piatto giusto (parole del nome). */
 actOrAsk?:string[]
 /** Struttura (set struttura, 21/10): dopo il turno `after`, nel menu PUBBLICATO, devono esistere questi Menu con questi Sottomenu
  *  (nomi normalizzati: minuscole, senza accenti, «menu» iniziale, «e/&» e singolare/plurale tollerati). Lista BIANCA: ogni Menu o
  *  sottomenu NUOVO (rispetto al menu iniziale) che non è elencato qui è «struttura-non-richiesta», compresi i doppioni.
  *  `sub` = Sezioni (livello 3, parentSectionId = sottomenu `parent`). `orAsk` = va bene anche una domanda senza nessuna struttura
  *  nuova (capacità che il server può non avere, vocali sporchi). `noNewMenus` = nessun Menu nuovo. Vedi eval-haiku.test.ts. */
 struct?:StructCheck[]
}
export type StructCheck={after:number,menus?:{name:string,sections?:string[],sub?:{parent:string,name:string}[]}[],noNewMenus?:boolean,orAsk?:boolean,
 /** 21/10 visibilità: nomi «Menu» o «Menu>Sottomenu» che dopo il turno devono essere visibili (active) o nascosti. */
 visible?:string[],hidden?:string[]}
export type HaikuCase=Conversation&HaikuExtra

const T=(s:string):Turn=>({text:s}),Q=(s:string):Turn=>({text:s,q:true}),V=(s:string):Turn=>({voice:s})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),AV=(dish:string,value=false):Change=>({op:'available',dish,value}),HI=(dish:string,value=true):Change=>({op:'hidden',dish,value})
const NONE:Change[]=[]
const M='victoria4',fam='bv-categorie' as Family
let n=0
const c=(turns:(string|Turn)[],changes:Change[],x:Partial<HaikuCase>={}):HaikuCase=>({id:`vic-${String(++n).padStart(2,'0')}`,family:fam,menu:M,turns:turns.map(t=>typeof t==='string'?T(t):t),changes,source:'Victoria 19/10 (fixture inventata)',...x})

export const VICTORIA_CASES:HaikuCase[]=[
 c(['la carbonara mettila a 14'],[P('Carbonara',14)],{note:'prezzo'}),
 c(['è finito il branzino'],[AV('Branzino al forno')],{note:'esaurito'}),
 c(['togli la caprese'],[HI('Caprese')],{note:'«togli» = nascondi, mai elimina'}),
 c(['elimina la panna cotta'],NONE,{ask:[1],says:[{turn:1,re:/\bs[iì](?![a-z])/i}],note:'«elimina» = chiede «sì», nessuna scrittura senza conferma'}),
 c(['aggiungi nei secondi del pranzo la frittura di calamari che costa 16'],[{op:'create',name:'Frittura di calamari',price:16,section:'Secondi'}],{note:'piatto nuovo: nome senza «che costa»'}),
 c(['aumenta i primi di un euro'],NONE,{ask:[1],says:[{turn:1,re:/pranzo|cena/i}],note:'«i primi» ambiguo: Primi del Menu pranzo e del Menu cena → domanda'}),
 c(['nascondi tutti i dolci'],NONE,{structAsk:[1],says:[{turn:1,re:/dolci/i}],note:'nascondere un intero sottomenu = conferma'}),
 c(['la margherita a 8, la diavola a 9, la capricciosa a 10 e la coca a 4'],NONE,{recap:[1],note:'4 modifiche → riepilogo + OK, nessuna scrittura al primo turno'}),
 c(['la margherita a 8, la diavola a 9, la capricciosa a 10 e la coca a 4',V('va bene')],[P('Margherita',8),P('Diavola',9),P('Capricciosa',10),P('Coca Cola',4)],{recap:[1],note:'OK a voce («va bene» in un vocale) dopo il riepilogo'}),
 c([V('la sorrentina finita')],[AV('Pizza Sorrentina')],{noQuestion:true,note:'alias attivo «la sorrentina» = Pizza Sorrentina → nessuna domanda'}),
]
void Q
