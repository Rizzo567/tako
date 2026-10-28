/** R6.1 (avversaria Z) · vincoli del validatore sui prezzi del piano del modello. Non interpretano il messaggio al posto del
 * modello: dicono solo se un prezzo del piano è compatibile con il testo e con il prezzo attuale. Un piano incompatibile torna
 * al modello (auto-correzione) e poi diventa una domanda, mai una scrittura.
 *  Z1 numeri spezzati dalla trascrizione («tre dici» = 13, «dicia nove» = 19): il prezzo non può essere un pezzo del numero;
 *     salto oltre 3× o sotto 1/3 del prezzo attuale solo se quel numero è detto per intero.
 *  Z2 percentuali («del 10%», «+10%», «20 per cento»): il prezzo nuovo è l'attuale ± la percentuale, mai la percentuale in euro.
 *  Z3 verbi opposti («alza e abbassala di 2», «alza, anzi abbassala di 1»): il verso del prezzo è quello detto per il piatto;
 *     dopo «anzi» vale l'ultimo verbo; due versi opposti senza «anzi» → domanda. */
import {plain,g9Prices,g9DishMentioned,type MenuAction,type MenuRef} from './twilio-menu-ai.js'

const r2=(x:number)=>Math.round(x*100)/100
const squash=(s:string)=>s.replace(/(.)\1+/g,'$1')
const UNIT:Record<string,number>={uno:1,un:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9}
const TEEN:Record<string,number>={undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19}
const TENS:Record<string,number>={venti:20,trenta:30,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90}
// Parole intere 11–99 (forma «schiacciata»: doppie ridotte, così «dicianove», «quatordici» tornano uguali).
const WHOLE=new Map<string,number>()
for(const [w,v] of Object.entries(TEEN))WHOLE.set(squash(w),v)
for(const [t,tv] of Object.entries(TENS))for(const [u,uv] of Object.entries(UNIT)){if(u==='un'||u==='una')continue;const base=(u==='uno'||u==='otto')?t.slice(0,-1):t;WHOLE.set(squash(base+u),tv+uv);WHOLE.set(squash(t+u),tv+uv)}
WHOLE.set('quatrodici',14);WHOLE.set('tredeci',13);WHOLE.set('dicianove',19)
const pieceValue=(w:string)=>UNIT[w]??TEEN[w]??TENS[w]??(/^\d+$/.test(w)?Number(w):null)

/** Numeri detti in due pezzi (trascrizione): «tre dici» → 13, «dicia nove» → 19, «venti due» → 22. Mai attraverso la punteggiatura. */
export function splitNumbers(message:string):{value:number,pieces:number[],text:string}[]{
 const out:{value:number,pieces:number[],text:string}[]=[]
 for(const seg of message.split(/[,;.!?…()]+/)){const w=plain(seg).split(' ').filter(Boolean)
  for(let i=0;i+1<w.length;i++){const a=w[i]!,b=w[i+1]!;if(/^\d/.test(a)||/^\d/.test(b))continue
   const v=WHOLE.get(squash(a+b));if(v===undefined)continue
   out.push({value:v,pieces:[pieceValue(a),pieceValue(b)].filter((x):x is number=>x!==null),text:a+' '+b});i++}}
 return out}

const PCT=/(\d+(?:[.,]\d+)?)\s*(?:%|per\s*cento|percento)/i
const PCT_DOWN=/\b(?:scont\w*|abbass\w*|diminu\w*|ribass\w*|ridu[cr]\w*|cal[ai]\w*|meno|togli\w*|lev[ai]\w*)\b|-\s*\d+(?:[.,]\d+)?\s*(?:%|per\s*cento|percento)/i
const PCT_UP=/\b(?:aument\w*|alz\w*|rincar\w*|piu)\b|\+\s*\d+(?:[.,]\d+)?\s*(?:%|per\s*cento|percento)/i
// Verbi di verso per Z3 (stretti di proposito: «togli/meno/più» hanno altri usi: «togli dall'evidenza», «non c'è più»).
const UP3=/\b(?:aument\w*|alz\w*|rincar\w*|sali|salila|salilo|salile|salili|sale)\b|(?:^|\s)\+\s*\d/,DOWN3=/\b(?:abbass\w*|diminu\w*|ribass\w*|ridu[cr]\w*|scend\w*|cala|calala|calalo|calale|calali)\b|(?:^|\s)-\s*\d/

type Price={id:string,price:number,current:number}
const pricesOf=(actions:MenuAction[],refs:MenuRef[]):Price[]=>actions.flatMap(a=>{if((a as any).fromRestore)return[]
 if(a.kind!=='price'&&!(a.kind==='promo'&&(a as any).price!==null))return[]
 const id=(a as any).id as string,ref=refs.find(r=>r.id===id);if(!ref||typeof ref.price!=='number'||!(ref.price>0))return[]
 return[{id,price:r2((a as any).price),current:ref.price}]})

/** Motivo di rifiuto (chiave di REASON in owner-brain-r) e piatti coinvolti, o null se i prezzi del piano reggono. */
export function priceSanity(message:string,actions:MenuAction[],refs:MenuRef[],opts:{deltaIds?:Set<string>}={}):{note:string,ids:string[]}|null{
 const ps=pricesOf(actions,refs);if(!ps.length)return null
 // Z2 percentuali.
 const pm=message.match(PCT)
 if(pm){const x=Number(pm[1]!.replace(',','.')),m=plain(message),down=PCT_DOWN.test(message)||PCT_DOWN.test(m),up=PCT_UP.test(message)||PCT_UP.test(m)
  const rest=message.replace(new RegExp(PCT.source,'gi'),' '),explicit=new Set(g9Prices(rest).map(r2))
  const bad=ps.filter(p=>{if(explicit.has(p.price)&&p.price!==r2(x))return false
   const ok=[...(up||!down?[p.current*(1+x/100)]:[]),...(down||!up?[p.current*(1-x/100)]:[]),...(!up&&!down?[p.current*x/100]:[])]
   return !ok.some(v=>Math.abs(v-p.price)<=0.06)})
  if(bad.length)return{note:'percentuale',ids:bad.map(p=>p.id)}}
 // Z1 numeri spezzati: il prezzo è un pezzo di un numero detto in due parole.
 const split=splitNumbers(message)
 {const bad=ps.filter(p=>split.some(s=>s.value!==p.price&&s.pieces.includes(p.price)));if(bad.length)return{note:'numero_spezzato',ids:bad.map(p=>p.id)}}
 // Z1 plausibilità: salto oltre 3× o sotto 1/3 dell'attuale solo se il numero è detto per intero (i pezzi non contano).
 if(!pm){let joined=message;for(const s of split)joined=joined.replace(new RegExp(s.text.split(' ').join('\\W+'),'i'),String(s.value))
  const said=new Set(g9Prices(joined).map(r2))
  const bad=ps.filter(p=>!opts.deltaIds?.has(p.id)&&(p.price>p.current*3||p.price<p.current/3)&&!said.has(p.price));if(bad.length)return{note:'prezzo_implausibile',ids:bad.map(p=>p.id)}}
 // Z3 verso del prezzo per piatto.
 const bad=ps.filter(p=>{const want=directionsFor(message,p.id,refs,ps.length);if(!want.size)return false;if(want.size>1)return true
  const sign=p.price>p.current+0.004?'up':p.price<p.current-0.004?'down':null;return !!sign&&!want.has(sign)})
 if(bad.length)return{note:'verso_del_prezzo',ids:bad.map(p=>p.id)}
 return null}

/** Versi detti per il piatto: ogni parte del messaggio dà il verso al piatto che nomina (o all'ultimo nominato, «…abbassala»);
 * le parti prima del primo piatto vanno al primo piatto. «anzi» ritira i versi detti prima per lo stesso piatto. */
function directionsFor(message:string,id:string,refs:MenuRef[],nPrices:number):Set<'up'|'down'>{
 const ref=refs.find(r=>r.id===id)!,parts=message.split(/[,;.!?…]+|\s+(?:e|ed|poi|ma)\s+/i).map(s=>s.trim()).filter(Boolean)
 const dirOf=(s:string)=>{const p=' '+plain(s)+' ',d=new Set<'up'|'down'>();if(UP3.test(p)||/(?:^|\s)\+\s*\d/.test(s))d.add('up');if(DOWN3.test(p)||/(?:^|\s)-\s*\d/.test(s))d.add('down');return d}
 const own:Set<'up'|'down'>[]=[],all:Set<'up'|'down'>[]=[];let current:string[]=[],pending:Set<'up'|'down'>[]=[],named=false
 const add=(list:Set<'up'|'down'>[],d:Set<'up'|'down'>,retract:boolean)=>{if(retract&&d.size)list.length=0;if(d.size)list.push(d)}
 for(const part of parts){const retract=/\banzi\b/i.test(plain(part)),seg=retract?part.replace(/^.*\banzi\b/i,''):part,d=dirOf(seg)
  const here=refs.filter(r=>g9DishMentioned(r.name,part,refs)).map(r=>r.id);if(here.length)current=here
  add(all,d,retract)
  if(!here.length&&!current.length){if(d.size)pending.push(d);continue}
  if(current.includes(id)){if(!named){named=true;for(const x of pending)own.push(x);pending=[]}add(own,d,retract)}}
 const pick=named?own:nPrices===1?all:[]
 return new Set(pick.flatMap(d=>[...d]))}
