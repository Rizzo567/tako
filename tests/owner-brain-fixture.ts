// Menu di prova per il cervello del bot titolare: «tipico» (48 piatti, 7 categorie) e «grande» (320+ piatti, 3 menu).
const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const typical:Record<string,[string,number][]>={
 Antipasti:[['Bruschetta al pomodoro',6],['Tagliere di salumi e formaggi',16],['Frittura di paranza',14],['Polpette al sugo',9],['Parmigiana di melanzane',10],['Burrata con pomodorini',11],['Arancini al ragù',7]],
 Primi:[['Spaghetti alla carbonara',12],['Bucatini all\'amatriciana',12],['Cacio e pepe',11],['Gnocchi alla sorrentina',11],['Lasagna della casa',13],['Paccheri allo scoglio',18],['Risotto ai funghi porcini',15],['Orecchiette con cime di rapa',12],['Tortellini in brodo',13]],
 Secondi:[['Tagliata di manzo',22],['Tagliata di tonno',20],['Cotoletta alla milanese',18],['Saltimbocca alla romana',16],['Baccalà fritto',17],['Grigliata mista di pesce',24],['Salsiccia e friarielli',14]],
 Pizze:[['Margherita',7],['Marinara',6],['Diavola',8.5],['Quattro formaggi',9],['Capricciosa',9.5],['Bufalina',10],['Ortolana',9],['Calzone fritto',8]],
 Contorni:[['Patate al forno',5],['Insalata mista',5],['Verdure grigliate',6],['Cicoria ripassata',5]],
 Dolci:[['Tiramisù',6],['Panna cotta ai frutti di bosco',6],['Cannolo siciliano',5],['Babà al rum',6],['Torta della nonna',6]],
 Bevande:[['Acqua naturale',2],['Acqua frizzante',2],['Coca Cola',3.5],['Birra media',5],['Birra piccola',3.5],['Calice di vino rosso',5],['Spritz',7],['Caffè',1.5]],
}
export function typicalWorkspace(){let n=0,s=1000;return{menus:[{id:uuid(9001),name:'Menu',sections:Object.entries(typical).map(([name,items])=>({id:uuid(++s),name,items:items.map(([iname,price])=>({id:uuid(++n),name:iname,price,available:true,hidden:false}))}))}]}}
const bases=['Spaghetti','Linguine','Rigatoni','Fusilli','Penne','Tagliatelle','Pappardelle','Trofie','Pici','Scialatielli','Ravioli','Fettuccine']
const sauces=['al pomodoro','al pesto genovese','alle vongole','al ragù bolognese','ai frutti di mare','con zucchine e gamberi','al nero di seppia','con salsiccia e funghi','alla norma','con pomodorini e burrata','all\'arrabbiata','al tartufo nero','con guanciale e pecorino','con pistacchio e speck','alla puttanesca','con ricci di mare']
export function largeWorkspace(count=320){let n=0,s=2000;const menus:any[]=[];const names=bases.flatMap(b=>sauces.map(x=>b+' '+x))
 for(const [mi,mname] of ['Pranzo','Cena','Asporto'].entries()){const sections:any[]=[];for(let c=0;c<6;c++){const items:any[]=[];for(let i=0;i<Math.ceil(count/18);i++){const nm=names[(mi*6+c)*18+i]??('Piatto speciale '+(n+1));items.push({id:uuid(++n),name:nm,price:8+((n*7)%19)+(n%2?0.5:0),available:n%23!==0,hidden:n%31===0,featured:n%17===0,tags:n%11===0?['vegetariano']:[]})}sections.push({id:uuid(++s),name:['Primi di mare','Primi di terra','Paste fresche','Speciali','Della tradizione','Leggeri'][c],items})}menus.push({id:uuid(9100+mi),name:mname,sections})}
 return{menus}}
