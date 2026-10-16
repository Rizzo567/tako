// Prezzi detti a voce o scritti come si parla («dieci e cinquanta», «10 e 50», «dodici») convertiti in cifre.
// Si applica SOLO alla citazione di una riga già delimitata dal modello (nome + prezzo), mai al testo intero:
// senza punteggiatura (trascrizioni whisper) non si possono trovare i confini con regole. Nessuna rete.
const ones:Record<string,number>={zero:0,uno:1,un:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19}
const tens:Record<string,number>={venti:20,trenta:30,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90}
export function spokenNumber(word:string):number|null{
 const w=word.toLowerCase();if(w in ones)return ones[w]!;if(w in tens)return tens[w]!;if(w==='cento')return 100
 for(const [t,v] of Object.entries(tens)){const stem=t.slice(0,-1);for(const [o,n] of Object.entries(ones)){if(n<1||n>9||o==='un'||o==='una')continue;if(w===t+o&&n!==1&&n!==8||w===stem+o&&(n===1||n===8))return v+n}}
 return null
}
const cents=(w:string)=>{if(w.toLowerCase()==='mezzo')return 50;const v=spokenNumber(w);return v!==null&&v>=5&&v<=95&&v%5===0?v:null}
const fmt=(euro:number,c=0)=>`${euro}${c?','+String(c).padStart(2,'0'):''} €`
const isSpace=(s:string)=>/^\s+$/.test(s)
const isPunct=(s:string)=>/^[,;:.!?\n]$/.test(s)
/** «carbonara dieci e cinquanta» → «carbonara 10,50 €». A number word at the start of a clause is part of the name
 * («Quattro formaggi dodici» → «Quattro formaggi 12 €»); without «euro» a number is a price only at the end of the clause. */
export function normalizeSpokenPrices(text:string):string{
 let out=text.replace(/(\d{1,4})(?:\s*(?:€|euro|euri))?\s+e\s+(\d{2})(?!\d)(?:\s*centesimi)?/gi,(m,a,b)=>Number(b)%5===0?fmt(Number(a),Number(b)):m)
 out=out.replace(/(\d{1,4})(?:\s*(?:€|euro|euri))?\s+e\s+([A-Za-zÀ-ÿ]+)(?:\s+centesimi)?/gi,(m,a,w)=>{const c=cents(w);return c!==null?fmt(Number(a),c):m})
 const parts=out.split(/(\s+|(?=[,;:.!?\n])|(?<=[,;:.!?\n]))/).filter(p=>p!==''),res:string[]=[]
 const next=(k:number)=>{let x=k;while(x<parts.length&&isSpace(parts[x]!))x++;return x}
 for(let i=0;i<parts.length;i++){
  const w=parts[i]!,v=/^[A-Za-zÀ-ÿ]+$/.test(w)?spokenNumber(w):null
  if(v===null){res.push(w);continue}
  let end=i,hasEuro=false,c=0,j=i+1
  const k=next(j);if(k<parts.length&&/^(euro|euri)$/i.test(parts[k]!)){hasEuro=true;end=k;j=k+1}
  const k2=next(j);if(k2<parts.length&&parts[k2]!.toLowerCase()==='e'){const k3=next(k2+1);if(k3<parts.length){const cv=cents(parts[k3]!);if(cv!==null){c=cv;end=k3;const k4=next(k3+1);if(k4<parts.length&&/^centesimi$/i.test(parts[k4]!))end=k4}}}
  const lastSolid=res.filter(p=>!isSpace(p)).at(-1),clauseStart=!lastSolid||isPunct(lastSolid),after=next(end+1),atEnd=after>=parts.length||isPunct(parts[after]!)
  // «un/una» alone is an article, not a price («un tagliere», «una birra»).
  const article=/^(un|una|uno)$/i.test(w)&&!hasEuro
  if(!article&&(hasEuro||(!clauseStart&&atEnd)||(!clauseStart&&c>0))){res.push(fmt(v,c));i=end;continue}
  res.push(w)
 }
 return res.join('')
}
