// Set LUNGHI (21/10 pomeriggio): messaggi con 5–8 richieste (vocale di Manuel sul QA andato in timeout: «metti la carbonara a 12,50,
// il riso giallo a 9 euro anziché 8,50, poi la pasta al ragù a 10, la carbonara a 13.000, poi aumenta tutti i primi di un euro»).
// Attese: oltre 3 modifiche diverse → riepilogo + «ok» (nessuna scrittura al turno 1, tutto scritto dopo l'ok); con «13.000» una
// domanda e nessuna scrittura. Più il caso «sposta la pasta al pesto nel menu cena» → domanda → «primi crealo» (azione originale fatta).
// Fixture `mario` (Pranzo/Cena/Bevande). Deterministico: blocchi fissi combinati con un passo fisso.
import type {Change,Family,Turn} from '../types.js'
import type {HaikuCase} from './victoria-1019.js'

const T=(s:string):Turn=>({text:s}),V=(s:string):Turn=>({voice:s})
const P=(dish:string,price:number):Change=>({op:'price',dish,price}),AV=(dish:string):Change=>({op:'available',dish,value:false}),HI=(dish:string):Change=>({op:'hidden',dish,value:true})
const C=(name:string,price:number,section:string):Change=>({op:'create',name,price,section}),MV=(dish:string,section:string):Change=>({op:'move',dish,section})
const fam='bv-multiple' as Family
type B={say:string,ch:Change[],dish:string}
const BLOCKS:B[]=[
 {say:'la carbonara a 12,50',ch:[P('Spaghetti alla carbonara',12.5)],dish:'carbonara'},
 {say:'il tiramisù a 6 euro',ch:[P('Tiramisù',6)],dish:'tiramisu'},
 {say:'la margherita a 8 euro anziché 7',ch:[P('Margherita',8)],dish:'margherita'},
 {say:'la diavola a 9 anzi 9,50',ch:[P('Diavola',9.5)],dish:'diavola'},
 {say:'la cotoletta a 16',ch:[P('Cotoletta alla milanese',16)],dish:'cotoletta'},
 {say:'gli gnocchi ai quattro formaggi a 11',ch:[P('Gnocchi 4 formaggi',11)],dish:'gnocchi'},
 {say:'la tagliata diciannove euro',ch:[P('Tagliata di manzo',19)],dish:'tagliata'},
 {say:'la birra media a 5,50',ch:[P('Birra media',5.5)],dish:'birra'},
 {say:'è finita la lasagna',ch:[AV('Lasagna al forno')],dish:'lasagna'},
 {say:'la panna cotta non c\'è più',ch:[AV('Panna cotta')],dish:'pannacotta'},
 {say:'è finito il tagliere',ch:[AV('Tagliere misto')],dish:'tagliere'},
 {say:'aggiungi nei dolci il cannolo a 4 euro',ch:[C('Cannolo',4,'Dolci')],dish:'cannolo'},
 {say:'aggiungi tra le pizze la bufalina a 10',ch:[C('Bufalina',10,'Pizze')],dish:'bufalina'},
 {say:'togli la pasta e fagioli',ch:[HI('Pasta e fagioli')],dish:'fagioli'},
 {say:'sposta il burger classico nei secondi',ch:[MV('Burger classico','Secondi')],dish:'burger'},
 {say:'il cappuccino a 2 euro',ch:[P('Cappuccino',2)],dish:'cappuccino'},
]
const JOIN=[', ',', poi ',' e ',', e poi ',', ah e ']
const FILL=['eh allora senti, ','allora, ','ok ascolta: ','','eh… ']
function compose(idx:number[],k:number){return idx.map((i,j)=>(j===0?'':JOIN[(k+j)%JOIN.length])+BLOCKS[i]!.say).join('')}
const cases:HaikuCase[]=[]
for(let k=0;k<35;k++){const n=5+(k%4),start=(k*3)%BLOCKS.length,idx:number[]=[];for(let j=0;idx.length<n;j++){const i=(start+j*5)%BLOCKS.length;if(!idx.includes(i))idx.push(i)}
 const voice=k%3===0,msg=(voice?FILL[k%FILL.length]:'')+compose(idx,k)
 cases.push({id:'lng-'+String(k+1).padStart(2,'0'),family:fam,menu:'mario',turns:[voice?V(msg):T(msg),k%2?T('ok'):V('va bene')],changes:idx.flatMap(i=>BLOCKS[i]!.ch),recap:[1],note:n+' richieste: riepilogo + OK, poi tutto scritto'} as HaikuCase)}
// «13.000»: una domanda, nessuna scrittura (mai un prezzo inventato)
for(let k=0;k<5;k++){const idx=[k,(k+4)%BLOCKS.length,(k+9)%BLOCKS.length,(k+12)%BLOCKS.length].filter((v,i,a)=>a.indexOf(v)===i)
 const msg=compose(idx,k)+', la carbonara a 13.000'
 cases.push({id:'lng-mig-'+(k+1),family:fam,menu:'mario',turns:[k%2?V('eh '+msg):T(msg)],changes:[],ask:[1],note:'«13.000»: una domanda, nessuna scrittura'} as HaikuCase)}
// il messaggio vero di Manuel (adattato a mario: riso giallo → pasta del giorno)
cases.push({id:'lng-manuel',family:fam,menu:'mario',turns:[V('metti la carbonara a 12,50, la pasta del giorno a 9 euro anziché 8,50, poi la pasta al ragù a 10, la carbonara a 13.000, poi aumenta tutti i primi di un euro')],changes:[],ask:[1],note:'vocale vero di Manuel sul QA (timeout 11:30): una domanda (13.000 e carbonara detta due volte), nessuna scrittura, mai «non disponibile»'} as HaikuCase)
// Bug 2: domanda sul sottomenu → risposta che lo crea → l'azione originale va fatta
cases.push({id:'lng-sposta-crea',family:fam,menu:'mario',turns:[T('sposta il nuovo burger nel menù bevande'),T('nei panini, crealo')],changes:[MV('Nuovo burger','Panini')],note:'la risposta che completa la domanda esegue anche lo spostamento'} as HaikuCase)
export const LUNGHI_CASES=cases
