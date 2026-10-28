/** 28/10 sera (audit «chat anti-rincoglioniti»): parole da cibo. Un nome di piatto NUOVO scritto senza conferma deve contenerne almeno una
 * (o una parola dei piatti del locale): «Marco», «mannaggia», «noo», «sei bravissima» non diventano mai piatti in silenzio.
 * Modulo PURO. Lista larga apposta: un nome fuori lista non viene rifiutato, viene solo fatto confermare. */
import {plain} from './twilio-menu-ai.js'
const W=`pasta spaghetti spaghettoni linguine tagliatelle tagliolini tagliatelline fettuccine pappardelle penne pennette rigatoni fusilli farfalle orecchiette
gnocchi gnocchetti ravioli raviolini tortellini tortelloni tortelli agnolotti cappelletti cannelloni lasagna lasagne paccheri mezze maniche bucatini vermicelli
trofie strozzapreti pici cavatelli casarecce garganelli maltagliati tonnarelli scialatielli calamarata conchiglie ditalini mafalde fregola culurgiones
risotto riso minestrone minestra zuppa vellutata crema brodo passatelli polenta frittata frittatina pizza pizze focaccia focacce calzone calzoni
bruschetta bruschette crostini crostino panino panini piadina piadine toast tramezzino hamburger burger cotoletta cotolette milanese scaloppine scaloppina
bistecca tagliata filetto arrosto brasato stracotto spezzatino polpette polpettone involtini salsiccia salsicce pollo tacchino maiale manzo vitello agnello
capretto coniglio anatra faraona nodino costata costine costolette braciola braciole lonza coppa pancetta guanciale speck prosciutto crudo cotto salame salumi
bresaola mortadella porchetta trippa fegato lampredotto cinghiale lepre cervo wurstel merluzzo baccala stoccafisso orata branzino spigola salmone tonno
spada pesce pescato calamari calamaro totani anelli polpo moscardini seppie seppia gamberi gamberetti gamberoni scampi mazzancolle cozze vongole lupini
fasolari capesante ostriche frutti mare impepata sauté soute fritto frittura fritti fritta grigliata griglia grigliato alla piastra arrostito forno umido
vapore insalata insalatona insalate patate patata patatine verdure verdura funghi porcini champignon zucchine zucchina melanzane melanzana peperoni
peperonata caponata carciofi carciofo spinaci fagiolini fagioli ceci lenticchie piselli broccoli cime rapa friarielli cavolfiore cavolo carote cipolle
pomodori pomodoro pomodorini rucola radicchio scarola cicoria bietole asparagi finocchi zucca mozzarella bufala burrata stracciatella provola provolone
scamorza ricotta gorgonzola parmigiano grana pecorino fontina taleggio formaggi formaggio caprese parmigiana tiramisu panna cotta pannacotta torta
crostata gelato gelati sorbetto semifreddo cannolo cannoli baba babbà sfogliatella profiteroles cheesecake macedonia frutta tartufo meringa torroncino
dolce dolci biscotti pasticceria tagliere affettati antipasto antipasti olive ascolane acqua vino vini birra birre caffe caffè bibita bibite coca cola
aranciata spritz amaro amari grappa limoncello mirto liquirizia whisky prosecco calice bottiglia pane coperto pure purè puree mandorle pistacchio pistacchi
noci nocciole pinoli cioccolato cacao vaniglia limone arancia fragole frutti bosco ragu ragù sugo salsa pesto carbonara amatriciana gricia cacio pepe
aglio olio peperoncino burro salvia norma puttanesca arrabbiata pescatora scoglio marinara margherita diavola capricciosa quattro stagioni napoletana
romana boscaiola ortolana vegetariana vegana vegano tofu seitan hummus falafel kebab sushi sashimi poke tacos burrito nachos chips crocchette arancini
arancino supplì suppli mozzarelline panzerotti olive fiori zucca uova uovo omelette carne bollito lesso brodetto cacciucco guazzetto zuppetta`.split(/\s+/).filter(Boolean)
const FOOD=new Set(W.map(w=>plain(w)))
const lev1=(a:string,b:string)=>{if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,e=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++e>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}}return e+(a.length-i)+(b.length-j)<=1}
const LONG=[...FOOD].filter(w=>w.length>=6)
const STOPW=new Set(['al','alla','alle','allo','ai','agli','di','del','della','dei','delle','con','e','ed','in','la','il','lo','le','i','gli','un','una','a','da'])
/** Il nome ha almeno una parola da cibo (lista, parole dei piatti del locale, o un refuso di una parola lunga della lista). */
export function foodish(name:string,vocab:readonly string[]=[]):boolean{
 const ws=plain(name).split(' ').filter(w=>w&&!STOPW.has(w));if(!ws.length)return false
 const local=new Set(vocab.flatMap(v=>plain(v).split(' ')).filter(w=>w.length>=4&&!STOPW.has(w)))
 return ws.some(w=>FOOD.has(w)||local.has(w)||(w.length>=6&&LONG.some(f=>lev1(f,w)))||(w.endsWith('i')||w.endsWith('e'))&&(FOOD.has(w.slice(0,-1)+'o')||FOOD.has(w.slice(0,-1)+'a')))}
