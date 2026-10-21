// Set STRUTTURA (motore Haiku, 21/10/2026): creazione di Menu e Sottomenu dal bot titolare. Nasce dal bug trovato da Manuel sul QA
// il 21/10: chiede due Menu nuovi (Pranzo, Cena) con i loro sottomenu, il bot non crea nulla, chiede quattro volte conferma e alla
// fine dice «Il sistema non può ancora creare Menu e Sottomenu vuoti». Regola nuova: la creazione di STRUTTURA (create_menu,
// create_section con un Menu preciso, anche vuota) si applica SUBITO con un riepilogo, senza conferma.
// Lessico: Menu = menus[] · Sottomenu = sections con parentSectionId=null · Sezione = parentSectionId≠null · Piatti = items.
// Tre blocchi: (i) la conversazione vera di Manuel (fixture qastruttura) + varianti; (ii) le frasi di Bim Bum Bar (bimbum, bimbum2);
// (iii) batteria avversaria da TEMPLATE deterministici (fixture strutt, qualcuno su qastruttura), 12 famiglie.
// Attese: `struct` (lista bianca di Menu/sottomenu dopo il turno N, vedi HaikuExtra) + `changes` sui piatti come il giudice
// condiviso (NONE = nessuna scrittura sui piatti: ogni differenza è GRAVE modifica-non-richiesta) + `ask` dove serve una domanda.
// Set: struttura (tutto) · struttura60 (60 della batteria, sottoinsieme deterministico) · struttura-vere (solo i blocchi i e ii).
import {createHash} from 'node:crypto'
import type {Change,Family,Turn} from '../types.js'
import type {HaikuCase,StructCheck} from './victoria-1019.js'

const T=(s:string):Turn=>({text:s}),V=(s:string):Turn=>({voice:s})
const P=(dish:string,price:number):Change=>({op:'price',dish,price})
const NONE:Change[]=[]
const fam='bv-categorie' as Family
type M={name:string,sections?:string[],sub?:{parent:string,name:string}[]}
const S=(after:number,menus:M[],x:Partial<StructCheck>={}):StructCheck=>({after,menus,...x})
const mk=(id:string,menu:string,turns:(string|Turn)[],changes:Change[],x:Partial<HaikuCase>={}):HaikuCase=>({id,family:fam,menu,turns:turns.map(t=>typeof t==='string'?T(t):t),changes,...x})

// ---------- (i) La conversazione vera di Manuel (QA, 21/10) ----------
const PRANZO_CENA:M[]=[{name:'Pranzo',sections:['Completo']},{name:'Cena',sections:['Completo','Primo','Secondo']}]
const MANUEL=['voglio che aggiungi un nuovo menù che si chiama pranzo e un nuovo menù che si chiama cena','in pranzo metti completo come sottomenu, invece in cena metti completo, primo e secondo','No, tu inizi a crearli','Tu inizi a crearli','vai si','si','1']
export const STRUTTURA_MANUEL:HaikuCase[]=[
 mk('str-m1','qastruttura',MANUEL,NONE,{source:'QA Manuel 21/10',struct:[S(2,PRANZO_CENA),...[3,4,5,6,7].map(n=>S(n,PRANZO_CENA))],
  note:'conversazione vera: al più tardi dopo il turno 2 Pranzo {Completo} e Cena {Completo, Primo, Secondo}; poi niente doppioni né conferme a vuoto'}),
 mk('str-m2','qastruttura',MANUEL.slice(0,2),NONE,{source:'QA Manuel 21/10 (variante)',struct:[S(1,[{name:'Pranzo'},{name:'Cena'}]),S(2,PRANZO_CENA)],
  note:'variante: il turno 1 basta da solo (Menu vuoti subito), il turno 2 aggiunge i sottomenu'}),
 mk('str-m3','qastruttura',MANUEL.slice(0,1),NONE,{source:'QA Manuel 21/10 (variante)',struct:[S(1,[{name:'Pranzo'},{name:'Cena'}])],
  note:'solo il turno 1: due Menu vuoti creati subito (una domanda di seguito sui sottomenu è ammessa)'}),
]

// ---------- (ii) Bim Bum Bar ----------
export const STRUTTURA_BIMBUM:HaikuCase[]=[
 mk('str-b1','bimbum',['Tutti i secondi aumentali di 3 euro'],[P('Cotoletta alla milanese',17),P('Hamburger di manzo',16),P('Salsiccia ai ferri',13),P('Pollo alla piastra',14)],
  {source:'Bim Bum Bar 21/10',struct:[S(1,[])],note:'+3 € a tutti i Secondi applicato subito con riepilogo, niente OK (4 piatti: se il server vuole l\'OK oltre 3 modifiche esce «in-attesa-ok» MEDIO)'}),
 mk('str-b2','bimbum',['Aggiungi un nuovo menù'],NONE,{source:'Bim Bum Bar 21/10',ask:[1],struct:[S(1,[])],note:'manca il nome: una domanda breve, nessuna scrittura'}),
 mk('str-b3','bimbum',['Aggiungi un nuovo menù','No, ho detto che devi proprio creare un nuovo menù'],NONE,{source:'Bim Bum Bar 21/10',ask:[1,2],struct:[S(1,[]),S(2,[])],
  note:'insiste senza nome: di nuovo una domanda sul nome, mai un Menu/piatto che si chiama con la frase'}),
 mk('str-b4','bimbum2',['Tutti i secondi aumentali di 3 euro'],NONE,{source:'Bim Bum Bar 21/10',ask:[1],says:[{turn:1,re:/pranzo|cena/i}],struct:[S(1,[])],
  note:'«Secondi» in due Menu: una sola domanda (quale menu), nessuna scrittura'}),
]

// ---------- (iii) Batteria avversaria (template deterministici) ----------
// Fixture strutt: Pranzo {Antipasti, Primi, Secondi} · Cena {Primi, Secondi, Pizze > Pizze bianche} · Bevande {Bibite, Vini}.
type Gen={fam:string,menu?:string,turns:(string|Turn)[],struct:StructCheck[],ask?:number[],says?:{turn:number,re:RegExp}[],note?:string}
const G:Gen[]=[]
const add=(fam:string,xs:Omit<Gen,'fam'>[])=>{for(const x of xs)G.push({fam,...x})}
const NEW1=(name:string):M[]=>[{name}]
// 1. Menu nuovo con nome
add('menu-nuovo',[
 ...([['crea il menu Aperitivo','Aperitivo'],['aggiungi un nuovo menù che si chiama Brunch','Brunch'],['fammi un menu Colazione','Colazione'],['nuovo menu: Degustazione','Degustazione'],
  ['voglio un menù nuovo, chiamalo Asporto','Asporto'],['mi crei il menu Dopocena?','Dopocena'],['aggiungi il menu Pranzo di lavoro','Pranzo di lavoro']] as const).map(([t,n])=>({turns:[t],struct:[S(1,NEW1(n))]})),
])
// 2. Più Menu insieme
add('piu-menu',[
 {turns:['crea i menu Aperitivo e Brunch'],struct:[S(1,[{name:'Aperitivo'},{name:'Brunch'}])]},
 {turns:['aggiungi tre menu: Colazione, Aperitivo e Dopocena'],struct:[S(1,[{name:'Colazione'},{name:'Aperitivo'},{name:'Dopocena'}])]},
 {turns:['voglio due menu nuovi, Asporto e Delivery'],struct:[S(1,[{name:'Asporto'},{name:'Delivery'}])]},
 {turns:['crea un menu Brunch con i sottomenu Dolci e Salati'],struct:[S(1,[{name:'Brunch',sections:['Dolci','Salati']}])]},
 {turns:['fai il menu Aperitivo con dentro Spritz e Taglieri, e il menu Dopocena con Amari'],struct:[S(1,[{name:'Aperitivo',sections:['Spritz','Taglieri']},{name:'Dopocena',sections:['Amari']}])]},
])
// 3. Sottomenu in un Menu esistente
add('sottomenu',[
 {turns:['nel Menu cena aggiungi il sottomenu Dolci'],struct:[S(1,[{name:'Cena',sections:['Dolci']}])]},
 {turns:['in pranzo metti il sottomenu Contorni'],struct:[S(1,[{name:'Pranzo',sections:['Contorni']}])]},
 {turns:['aggiungi nel pranzo un sottomenu Insalate'],struct:[S(1,[{name:'Pranzo',sections:['Insalate']}])]},
 {turns:['crea il sottomenu Amari nelle Bevande'],struct:[S(1,[{name:'Bevande',sections:['Amari']}])]},
 {turns:['nel menu cena crea Antipasti'],struct:[S(1,[{name:'Cena',sections:['Antipasti']}])]},
 {turns:['alla cena aggiungi i sottomenu Contorni e Dolci'],struct:[S(1,[{name:'Cena',sections:['Contorni','Dolci']}])]},
])
// 4. Lo stesso sottomenu in due Menu
add('due-menu',[
 {turns:['aggiungi il sottomenu Dolci sia a pranzo che a cena'],struct:[S(1,[{name:'Pranzo',sections:['Dolci']},{name:'Cena',sections:['Dolci']}])]},
 {turns:['metti Contorni in pranzo e in cena'],struct:[S(1,[{name:'Pranzo',sections:['Contorni']},{name:'Cena',sections:['Contorni']}])]},
 {turns:['in pranzo e cena aggiungi il sottomenu Insalate'],struct:[S(1,[{name:'Pranzo',sections:['Insalate']},{name:'Cena',sections:['Insalate']}])]},
 {turns:['crea Dolci nel pranzo e anche nella cena'],struct:[S(1,[{name:'Pranzo',sections:['Dolci']},{name:'Cena',sections:['Dolci']}])]},
])
// 5. Sezione dentro un sottomenu (se il server non la supporta: una domanda, non GRAVE)
add('sezione',[
 {turns:['dentro Pizze della cena aggiungi la sezione Pizze rosse'],struct:[S(1,[{name:'Cena',sub:[{parent:'Pizze',name:'Pizze rosse'}]}],{orAsk:true})]},
 {turns:['nei Primi del pranzo crea una sezione Pasta fresca'],struct:[S(1,[{name:'Pranzo',sub:[{parent:'Primi',name:'Pasta fresca'}]}],{orAsk:true})]},
 {turns:['nel sottomenu Vini metti una sezione Rossi'],struct:[S(1,[{name:'Bevande',sub:[{parent:'Vini',name:'Rossi'}]}],{orAsk:true})]},
 {turns:['nei Secondi della cena crea la sezione Pesce'],struct:[S(1,[{name:'Cena',sub:[{parent:'Secondi',name:'Pesce'}]}],{orAsk:true})]},
])
// 6. Nomi strani (apostrofi, emoji vietate, «Fuori menù», «&», dialetto)
add('nomi-strani',[
 {turns:['crea il menu Fuori menù'],struct:[S(1,NEW1('Fuori menù'))]},
 {turns:['nel menu cena aggiungi il sottomenu Pizze & Calzoni'],struct:[S(1,[{name:'Cena',sections:['Pizze & Calzoni']}])]},
 {turns:["crea il sottomenu L'angolo dello chef nel pranzo"],struct:[S(1,[{name:'Pranzo',sections:["L'angolo dello chef"]}])]},
 {turns:['crea il menu Aperitivo 🍹🍸'],struct:[S(1,NEW1('Aperitivo'))],note:'emoji vietate nei nomi: il Menu si chiama Aperitivo'},
 {turns:['nel menu cena metti il sottomenu Cuoppi'],struct:[S(1,[{name:'Cena',sections:['Cuoppi']}])]},
 {turns:["aggiungi in pranzo il sottomenu Sfizi 'e casa"],struct:[S(1,[{name:'Pranzo',sections:["Sfizi 'e casa"]}])]},
 {turns:["crea il menu Mangiari d'a nonna"],struct:[S(1,NEW1("Mangiari d'a nonna"))]},
])
// 7. Conferme vaghe dopo una richiesta chiara: struttura subito al turno 1, al turno 2 niente doppioni e niente nuova conferma
const REQ:[string,M[]][]=[['crea il menu Aperitivo',NEW1('Aperitivo')],['nel menu cena aggiungi il sottomenu Dolci',[{name:'Cena',sections:['Dolci']}]],['aggiungi i menu Brunch e Asporto',[{name:'Brunch'},{name:'Asporto'}]],['in pranzo metti il sottomenu Contorni',[{name:'Pranzo',sections:['Contorni']}]]]
const YES=['vai','fallo','sì dai','ok procedi']
add('conferme-vaghe',REQ.flatMap(([t,m],i)=>[YES[i]!,YES[(i+1)%4]!].map(y=>({turns:[t,y],struct:[S(1,m),S(2,m)]}))))
// 8. Correzioni (attesa la correzione, senza doppioni)
add('correzioni',[
 {turns:['in pranzo aggiungi il sottomenu Dolci','no, in cena non in pranzo'],struct:[S(2,[{name:'Cena',sections:['Dolci']}])]},
 {turns:['crea il menu Aperitivo con il sottomenu Spritz','no, anche Cocktail'],struct:[S(2,[{name:'Aperitivo',sections:['Spritz','Cocktail']}])]},
 {turns:['crea il menu Brunch','no, chiamalo Colazione'],struct:[S(2,NEW1('Colazione'))]},
 {turns:['in pranzo metti Contorni','no, anche Insalate'],struct:[S(2,[{name:'Pranzo',sections:['Contorni','Insalate']}])]},
 {turns:['crea in cena il sottomenu Antipasti','anzi no, chiamalo Stuzzichini'],struct:[S(2,[{name:'Cena',sections:['Stuzzichini']}])]},
 {menu:'qastruttura',turns:['crea il menu Pranzo con il sottomenu Completo','no, anche completo nella cena, crea pure il menu Cena'],struct:[S(2,[{name:'Pranzo',sections:['Completo']},{name:'Cena',sections:['Completo']}])]},
])
// 9. «categoria» detto dal titolare = sottomenu
add('categoria',[
 {turns:['aggiungi la categoria Dolci nel menu cena'],struct:[S(1,[{name:'Cena',sections:['Dolci']}])]},
 {turns:['crea una categoria Contorni nel pranzo'],struct:[S(1,[{name:'Pranzo',sections:['Contorni']}])]},
 {turns:['nel menu bevande metti la categoria Amari'],struct:[S(1,[{name:'Bevande',sections:['Amari']}])]},
 {turns:['crea la categoria Insalate in pranzo'],struct:[S(1,[{name:'Pranzo',sections:['Insalate']}])]},
])
// 10. Menu o sottomenu già esistente: nessun doppione
add('esistente',[
 {turns:['crea il menu Bevande'],struct:[S(1,[])]},
 {turns:['aggiungi un menu Pranzo'],struct:[S(1,[])]},
 {turns:['crea il menu cena'],struct:[S(1,[])]},
 {turns:['nel menu cena aggiungi il sottomenu Pizze'],struct:[S(1,[])]},
 {turns:['crea in pranzo il sottomenu Primi'],struct:[S(1,[])]},
])
// 11. Richieste incomplete: una domanda, nessuna scrittura
add('incompleta',[
 {turns:['crea un sottomenu'],struct:[S(1,[])],ask:[1]},
 {turns:['aggiungi il sottomenu Dolci'],struct:[S(1,[])],ask:[1],says:[{turn:1,re:/pranzo|cena|bevande/i}],note:'tre Menu: quale?'},
 {turns:['crea un nuovo menu'],struct:[S(1,[])],ask:[1]},
 {turns:['aggiungi un menu'],struct:[S(1,[])],ask:[1]},
 {turns:['nel menu cena aggiungi un sottomenu'],struct:[S(1,[])],ask:[1]},
 {turns:['aggiungi una categoria'],struct:[S(1,[])],ask:[1]},
])
// 12. Vocali sporchi
add('vocali',[
 {menu:'qastruttura',turns:[V('eh crea… il menu… pranz')],struct:[S(1,NEW1('Pranzo'),{orAsk:true})]},
 {turns:[V('allora senti eh mettimi nel… nella cena il sottomenu… dolci')],struct:[S(1,[{name:'Cena',sections:['Dolci']}],{orAsk:true})]},
 {turns:[V('eh nuovo menu aperitiv… aperitivo')],struct:[S(1,NEW1('Aperitivo'),{orAsk:true})]},
 {turns:[V('crea… crea il sottomenu contorni nel pranz')],struct:[S(1,[{name:'Pranzo',sections:['Contorni']}],{orAsk:true})]},
 {turns:[V('nel menu cena… eh… aggiungi anche… la categoria insalate')],struct:[S(1,[{name:'Cena',sections:['Insalate']}],{orAsk:true})]},
])

const counters=new Map<string,number>()
export const STRUTTURA_ADV:HaikuCase[]=G.map(g=>{const k=(counters.get(g.fam)??0)+1;counters.set(g.fam,k)
 return mk(`str-a-${g.fam}-${String(k).padStart(2,'0')}`,g.menu??'strutt',g.turns,NONE,{source:'batteria struttura 21/10 (template)',struct:g.struct,...(g.ask?{ask:g.ask}:{}),...(g.says?{says:g.says}:{}),...(g.note?{note:g.note}:{})})})

/** 60 della batteria: giro per famiglie in ordine sha1(id), deterministico (stesse 60 a ogni esecuzione). */
function pick60(cs:HaikuCase[],size=60):HaikuCase[]{
 const h=(s:string)=>createHash('sha1').update('struttura-1021|'+s).digest('hex'),by=new Map<string,HaikuCase[]>()
 for(const c of cs){const f=c.id.replace(/-\d+$/,'');by.set(f,[...(by.get(f)??[]),c])}
 for(const xs of by.values())xs.sort((a,b)=>h(a.id).localeCompare(h(b.id)))
 const ids=new Set<string>();for(let i=0;ids.size<Math.min(size,cs.length);i++)for(const xs of by.values()){if(ids.size>=size)break;if(xs[i])ids.add(xs[i]!.id)}
 return cs.filter(c=>ids.has(c.id))}
// ---------- (iv) Visibilità (21/10, decisione Manuel): Menu/Sottomenu nuovi nascosti, «rendi visibile», sinonimi, omonimi ----------
const VS=(after:number,visible:string[]=[],hidden:string[]=[],x:Partial<StructCheck>={}):StructCheck=>({after,menus:x.menus??[],visible,hidden,...x})
const vis=(id:string,turns:(string|Turn)[],struct:StructCheck[],x:Partial<HaikuCase>={})=>mk('str-v-'+id,'struttvis',turns,NONE,{source:'visibilità 21/10',struct,...x})
export const STRUTTURA_VIS:HaikuCase[]=[
 vis('01',['rendi visibile Brunch'],[VS(1,['Brunch'])]),
 vis('02',['mostra il menu aperitivo'],[VS(1,['Aperitivo'],['Brunch'])]),
 vis('03',['fai vedere il brunch ai clienti'],[VS(1,['Brunch'])]),
 vis('04',['pubblica il menu brunch'],[VS(1,['Brunch'])]),
 vis('05',['attiva il menu aperitivo'],[VS(1,['Aperitivo'])]),
 vis('06',['rendi visibili i vini'],[VS(1,['Bevande>Vini'])]),
 vis('07',['fai vedere i dolci'],[VS(1,[],['Pranzo>Dolci','Cena>Dolci'])],{ask:[1],note:'«Dolci» in due Menu: una domanda, niente reso visibile'}),
 vis('08',['fai vedere i dolci della cena'],[VS(1,['Cena>Dolci'],['Pranzo>Dolci'])]),
 vis('09',['nascondi il menu brunch'],[VS(1,[],['Brunch'])],{note:'già nascosto: nessun cambio'}),
 vis('10',['nascondi tutto il menu cena','sì'],[VS(1,['Cena']),VS(2,[],['Cena'])],{structAsk:[1],note:'Menu con piatti: prima la conferma, poi nascosto'}),
 vis('11',['crea il menu Merende'],[VS(1,[],['Merende'],{menus:[{name:'Merende'}]})],{note:'nasce nascosto'}),
 vis('12',['crea il menu Merende','rendi visibile Merende'],[VS(1,[],['Merende'],{menus:[{name:'Merende'}]}),VS(2,['Merende'],[],{menus:[{name:'Merende'}]})]),
 vis('13',['nel menu pranzo crea il sottomenu Contorni'],[VS(1,[],['Pranzo>Contorni'],{menus:[{name:'Pranzo',sections:['Contorni']}]})]),
 vis('14',['nel menu pranzo crea il sottomenu Contorni','mostra i contorni'],[VS(1,[],['Pranzo>Contorni'],{menus:[{name:'Pranzo',sections:['Contorni']}]}),VS(2,['Pranzo>Contorni'],[],{menus:[{name:'Pranzo',sections:['Contorni']}]})]),
 vis('15',[V('eh… rendi visibbile il… brunch')],[VS(1,['Brunch'],[],{orAsk:true})]),
 vis('16',['mostra il menu della colazione'],[VS(1,[],['Brunch','Aperitivo'])],{ask:[1],note:'non esiste: una domanda'}),
 vis('17',['attiva il pranzo'],[VS(1,['Pranzo'])],{note:'già visibile: nessun cambio'}),
 vis('18',['nascondi i secondi della cena'],[VS(1,['Cena>Secondi'])],{structAsk:[1],note:'sottomenu con piatti: conferma prima di nascondere'}),
 vis('19',['rendi visibili brunch e aperitivo'],[VS(1,['Brunch','Aperitivo'])]),
 vis('20',['fai vedere il menu aperitivo e lascia nascosto il brunch'],[VS(1,['Aperitivo'],['Brunch'])]),
]
export const STRUTTURA60=pick60(STRUTTURA_ADV)
export const STRUTTURA_VERE=[...STRUTTURA_MANUEL,...STRUTTURA_BIMBUM]
export const STRUTTURA_CASES:HaikuCase[]=[...STRUTTURA_VERE,...STRUTTURA_ADV,...STRUTTURA_VIS]
