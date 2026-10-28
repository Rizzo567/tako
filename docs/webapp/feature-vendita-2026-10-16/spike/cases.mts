// Casi dello spike 3b. «m» = parola che identifica il piatto nel nome estratto; «cat» = categoria detta
// ad alta voce / scritta (null = implicita, mai nominata come categoria); «flag» = il bot DEVE segnalarlo e non pubblicarlo.
export type Dish={m:string,price?:number,cat:string|null,flag?:boolean}
export type Case={id:string,kind:'text'|'voice',say:string,dishes:Dish[]}
export const cases:Case[]=[
 {id:'T1-esempio-prompt',kind:'text',say:'Menu di oggi. Primi: carbonara 10, amatriciana 9. Secondi: tagliata 16. Dolci: tiramisù 5.',
  dishes:[{m:'carbonara',price:10,cat:'primi'},{m:'amatriciana',price:9,cat:'primi'},{m:'tagliata',price:16,cat:'secondi'},{m:'tiramisu',price:5,cat:'dolci'}]},
 {id:'T2-dodici-piatti-righe',kind:'text',say:`Menu di lunedì
Antipasti
Bruschetta al pomodoro 5
Tagliere misto 12,50
Primi
Spaghetti alla carbonara 10
Penne all'arrabbiata 8,50
Lasagna della nonna 11
Secondi
Tagliata di manzo 18
Cotoletta alla milanese con patate 15
Saltimbocca alla romana 16
Dolci
Tiramisù 5
Panna cotta ai frutti di bosco 5,50
Caffè 1,50`,
  dishes:[{m:'bruschetta',price:5,cat:'antipasti'},{m:'tagliere',price:12.5,cat:'antipasti'},{m:'carbonara',price:10,cat:'primi'},{m:'arrabbiata',price:8.5,cat:'primi'},{m:'lasagna',price:11,cat:'primi'},{m:'tagliata',price:18,cat:'secondi'},{m:'cotoletta',price:15,cat:'secondi'},{m:'saltimbocca',price:16,cat:'secondi'},{m:'tiramisu',price:5,cat:'dolci'},{m:'panna cotta',price:5.5,cat:'dolci'},{m:'caffe',price:1.5,cat:'dolci'}]},
 {id:'T3-una-riga-categorie-implicite',kind:'text',say:'Oggi abbiamo risotto ai funghi 12 euro, lasagne 11, poi come secondo la grigliata mista a 18 euro e le patate al forno a 4. Per finire tiramisù 5 euro e sorbetto al limone 4',
  dishes:[{m:'risotto',price:12,cat:null},{m:'lasagne',price:11,cat:null},{m:'grigliata',price:18,cat:'secondo'},{m:'patate',price:4,cat:'secondo'},{m:'tiramisu',price:5,cat:null},{m:'sorbetto',price:4,cat:null}]},
 {id:'T4-prezzi-in-lettere',kind:'text',say:'Menu pranzo: primi, carbonara dieci euro, amatriciana nove euro e cinquanta; secondi, saltimbocca sedici euro; dolci, tiramisù cinque euro, caffè un euro e cinquanta.',
  dishes:[{m:'carbonara',price:10,cat:'primi'},{m:'amatriciana',price:9.5,cat:'primi'},{m:'saltimbocca',price:16,cat:'secondi'},{m:'tiramisu',price:5,cat:'dolci'},{m:'caffe',price:1.5,cat:'dolci'}]},
 {id:'T5-senza-prezzo-e-due-prezzi',kind:'text',say:'Pranzo di oggi. Primi: Risotto allo zafferano 14 (con midollo), Gnocchi al gorgonzola 11. Secondi: Branzino al forno 19, Arrosto della casa (prezzo da definire). Contorni: insalata mista 4 / 6 con pomodori. Dolci: Cheesecake 6.',
  dishes:[{m:'risotto',price:14,cat:'primi'},{m:'gnocchi',price:11,cat:'primi'},{m:'branzino',price:19,cat:'secondi'},{m:'arrosto',cat:'secondi',flag:true},{m:'insalata',cat:'contorni',flag:true},{m:'cheesecake',price:6,cat:'dolci'}]},
 // Vocali: testo parlato con «say» (voce italiana), poi whisper (stessa chiamata del bot), poi il parser.
 {id:'V1-euro-detti',kind:'voice',say:'Menu di oggi. Primi: carbonara dieci euro, amatriciana nove euro, risotto ai funghi dodici euro. Secondi: tagliata sedici euro, saltimbocca quindici euro. Dolci: tiramisù cinque euro, panna cotta quattro euro e cinquanta, caffè un euro.',
  dishes:[{m:'carbonara',price:10,cat:'primi'},{m:'amatriciana',price:9,cat:'primi'},{m:'risotto',price:12,cat:'primi'},{m:'tagliata',price:16,cat:'secondi'},{m:'saltimbocca',price:15,cat:'secondi'},{m:'tiramisu',price:5,cat:'dolci'},{m:'panna cotta',price:4.5,cat:'dolci'},{m:'caffe',price:1,cat:'dolci'}]},
 {id:'V2-senza-la-parola-euro',kind:'voice',say:'Allora, menu di lunedì. Antipasti: bruschetta cinque, tagliere dodici e cinquanta. Primi: spaghetti alle vongole quattordici, penne all\'arrabbiata otto e cinquanta, lasagna undici. Secondi: tagliata diciotto, cotoletta quindici. Dolci: tiramisù cinque, panna cotta cinque e cinquanta.',
  dishes:[{m:'bruschetta',price:5,cat:'antipasti'},{m:'tagliere',price:12.5,cat:'antipasti'},{m:'vongole',price:14,cat:'primi'},{m:'arrabbiata',price:8.5,cat:'primi'},{m:'lasagna',price:11,cat:'primi'},{m:'tagliata',price:18,cat:'secondi'},{m:'cotoletta',price:15,cat:'secondi'},{m:'tiramisu',price:5,cat:'dolci'},{m:'panna cotta',price:5.5,cat:'dolci'}]},
 {id:'V3-categorie-implicite',kind:'voice',say:'Oggi abbiamo risotto ai funghi dodici euro, gnocchi al gorgonzola undici euro, poi come secondo il branzino al forno diciannove euro e le polpette al sugo tredici euro, contorno patate al forno quattro euro, per finire cheesecake sei euro e sorbetto al limone tre euro e cinquanta.',
  dishes:[{m:'risotto',price:12,cat:null},{m:'gnocchi',price:11,cat:null},{m:'branzino',price:19,cat:'secondo'},{m:'polpette',price:13,cat:'secondo'},{m:'patate',price:4,cat:'contorno'},{m:'cheesecake',price:6,cat:null},{m:'sorbetto',price:3.5,cat:null}]},
]
