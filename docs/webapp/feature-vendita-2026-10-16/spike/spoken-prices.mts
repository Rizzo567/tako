// Prototipo (solo spike, non è codice di produzione): pre-normalizzatore dei prezzi detti a voce.
// Idea: il testo passa da qui PRIMA del parser di onboarding, che resta com'è. Nessuna chiamata di rete.
const ones:Record<string,number>={zero:0,uno:1,un:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19}
const tens:Record<string,number>={venti:20,trenta:30,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90}
const wordValue=(w:string):number|null=>{
 w=w.toLowerCase();if(w in ones)return ones[w]!;if(w in tens)return tens[w]!;if(w==='cento')return 100
 for(const [t,v] of Object.entries(tens)){const stem=t.slice(0,-1);for(const [o,n] of Object.entries(ones)){if(n>=1&&n<=9&&(w===t+o||w===stem+o)&&(n!==1&&n!==8||w===stem+o))return v+n}}
 return null
}
const cents=(w:string)=>{const v=wordValue(w);return w.toLowerCase()==='mezzo'?50:v!==null&&v>=5&&v<=95&&v%5===0?v:null}
const fmt=(euro:number,c=0)=>`${euro}${c?','+String(c).padStart(2,'0'):''} €`
const boundary=/^(?:[,;:.!?\n]|$)/
export function normalizeSpokenPrices(text:string):string{
 // 1) cifre: «10 e 50», «10 euro e 50» → «10,50 €»
 let out=text.replace(/(\d{1,3})(?:\s*(?:€|euro))?\s+e\s+(\d{2})(?!\d)(?:\s*centesimi)?/gi,(m,a,b)=>Number(b)%5===0?fmt(Number(a),Number(b)):m)
 out=out.replace(/(\d{1,3})(?:\s*(?:€|euro))?\s+e\s+([A-Za-zÀ-ÿ]+)(?:\s+centesimi)?/gi,(m,a,w)=>{const c=cents(w);return c!==null?fmt(Number(a),c):m})
 // 2) parole: scorro i token e sostituisco le serie numeriche in posizione di prezzo
 const parts=out.split(/(\s+|(?=[,;:.!?\n])|(?<=[,;:.!?\n]))/).filter(p=>p!=='')
 const res:string[]=[];
 const isSpace=(s:string)=>/^\s+$/.test(s)
 for(let i=0;i<parts.length;i++){
  const w=parts[i]!;const v=/^[A-Za-zÀ-ÿ']+$/.test(w)?wordValue(w):null
  if(v===null){res.push(w);continue}
  // serie: <n> [euro] [e <centesimi>] 
  let j=i+1,euro=v,hasEuro=false,c=0,end=i
  const next=(k:number)=>{let x=k;while(x<parts.length&&isSpace(parts[x]!))x++;return x}
  let k=next(j)
  if(k<parts.length&&/^(euro|euri)$/i.test(parts[k]!)){hasEuro=true;end=k;j=k+1}
  let k2=next(j)
  if(k2<parts.length&&parts[k2]!.toLowerCase()==='e'){const k3=next(k2+1);if(k3<parts.length){const cv=cents(parts[k3]!);if(cv!==null){c=cv;end=k3;j=k3+1;if(k3+1<parts.length&&/^centesimi$/i.test(parts[next(k3+1)]??'')){end=next(k3+1);j=end+1}}}}
  const after=parts[next(end+1)]??''
  const clauseStart=res.length===0||/^[,;:.!?\n]$/.test(res.filter(p=>!isSpace(p)).slice(-1)[0]??'')
  const atEnd=boundary.test(after)||next(end+1)>=parts.length
  const price=hasEuro||(!clauseStart&&atEnd)
  if(price&&(hasEuro||c||euro>=1)){res.push(fmt(euro,c));i=end;continue}
  res.push(w)
 }
 return res.join('')
}
if(process.argv[1]?.endsWith('spoken-prices.mts')){
 const {verifyOnboardingMenuRow}=await import('../../../../apps/server/src/lib/onboarding-planner.ts')
 const cases:[string,string,number][]=[
  ['carbonara 10','carbonara',10],['carbonara 10 euro','carbonara',10],['carbonara 10,50','carbonara',10.5],['carbonara 10.50','carbonara',10.5],
  ['carbonara 10 euro e 50','carbonara',10.5],['carbonara 10 e 50','carbonara',10.5],['carbonara 10 euro e cinquanta','carbonara',10.5],
  ['carbonara dieci euro','carbonara',10],['carbonara dieci euro e cinquanta','carbonara',10.5],['carbonara dieci euro e cinquanta centesimi','carbonara',10.5],
  ['carbonara dieci e cinquanta','carbonara',10.5],['carbonara dieci cinquanta','carbonara',10.5],['carbonara dieci','carbonara',10],['carbonara dieci e mezzo','carbonara',10.5],
  ['carbonara dieci euro e mezzo','carbonara',10.5],['carbonara dodici euro','carbonara',12],['carbonara dodici','carbonara',12],['carbonara un euro e cinquanta','carbonara',1.5],
  ['caffè un euro','caffè',1],['tiramisù cinque euro','tiramisù',5],['tiramisù a cinque euro','tiramisù',5],['tagliata ventidue euro','tagliata',22],
  ['tagliata ventidue e cinquanta','tagliata',22.5],['tagliata 22 e 50','tagliata',22.5],['tagliata sedici euro e cinquanta centesimi','tagliata',16.5],
  ['pizza quattro formaggi dodici','pizza quattro formaggi',12],['pizza quattro formaggi dodici euro','pizza quattro formaggi',12],
  ['tagliata di manzo 300 g 18 euro','tagliata di manzo',18],['Quattro stagioni 9','Quattro stagioni',9],['Quattro stagioni nove euro','Quattro stagioni',9],
 ]
 let ok=0,rawOk=0;const bad:any[]=[]
 for(const [say,name,price] of cases){const src=normalizeSpokenPrices(say);const evidence=src;const v=verifyOnboardingMenuRow({section:'Primi',name:name==='Quattro stagioni'?name:name,price,description:'',evidence} as any,src)
  const rawV=verifyOnboardingMenuRow({section:'Primi',name,price,description:'',evidence:say} as any,say);if(rawV.row)rawOk++
  const good=!!v.row;if(good)ok++;else bad.push({say,normalized:src,issue:v.issue})}
 console.log(JSON.stringify({senzaNormalizzatore:rawOk,conNormalizzatore:ok,total:cases.length,rejectedConNormalizzatore:bad},null,1))
 console.log(JSON.stringify(normalizeSpokenPrices('Primi: carbonara dieci euro, amatriciana nove e cinquanta; secondi tagliata sedici. Quattro formaggi dodici, caffè un euro e cinquanta')))
}
