/** Nomi storpiati dalla trascrizione vocale (17/10/2026, correzioni A5): «kenesac» = «Che ne sacc», «Bu» = «boh»,
 * «Passa il ragù» = «Pasta al ragù». Chiave fonetica italiana + distanza di modifica, SOLO verso piatti che esistono nel menu.
 * - forte (≥ 0,85, unico, chiave ≥ 4 lettere): il piatto vale come nominato;
 * - debole (≥ 0,6, o chiavi corte quasi uguali): mai una scrittura diretta, si chiede «Intendi *X*?».
 * Modulo puro (gira anche nell'edge Deno). */
import type {MenuRef} from './twilio-menu-ai.js'

const fold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()
/** Chiave fonetica: come suona in italiano, senza spazi, doppie e «h» mute. */
export function phoneKey(s:string){let t=fold(s).replace(/\s+/g,'')
 t=t.replace(/ph/g,'f').replace(/ch/g,'k').replace(/gh/g,'g').replace(/c(?=[aou]|$|[^aeiouy])/g,'k').replace(/q/g,'k').replace(/x/g,'s').replace(/z/g,'s').replace(/j|y/g,'i').replace(/w/g,'v').replace(/h/g,'')
 t=t.replace(/(.)\1+/g,'$1').replace(/ck/g,'k').replace(/sc(?=[ei])/g,'s').replace(/gn/g,'n').replace(/gl(?=i)/g,'l')
 return t}
export function lev(a:string,b:string){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let prev=Array.from({length:n+1},(_,j)=>j)
 for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]!+1,cur[j-1]!+1,prev[j-1]!+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[n]!}
export const phoneScore=(a:string,b:string)=>{const x=phoneKey(a),y=phoneKey(b);if(!x||!y)return 0;return 1-lev(x,y)/Math.max(x.length,y.length)}

// Parole di servizio: una finestra fatta solo di queste non è mai un nome storpiato.
const SERVICE=new Set(['il','lo','la','l','i','gli','le','un','una','uno','di','del','della','dei','nel','nella','nei','al','alla','a','e','ed','in','con','per','da','su','che','piatto','piatti','costa','costano','prezzo','prezzi','euro','metti','mettilo','mettila','mettici','cambia','cambiare','promo','offerta','descrizione','nascondi','togli','finito','finita','esaurito','aggiungi','allora','invece','ok','si','no','poi','anche','ancora','puoi','dimmi','quanto','cosa','sono','e','scrivi','mettere','fa','fai','va','sai','fare','ciao','grazie','menu','ho','hai','oggi',
 'scusa','scusami','anzi','aspetta','intendevo','volevo','dire','sbagliato','errore','va','bene','perfetto','tutto','tutti','tutte','quello','quella','quelli','quelle','questo','questa','questi','queste','mettili','mettile','toglilo','toglila','nascondilo','nascondila','rimetti','rimettilo','rimettila','fallo','falla','uguale','stesso','stessa','pure','altro','altra','prima','primo','seconda','secondo','ultimo','ultima','entrambi','come','era','sì','esatto','giusto','certo','vai','forse','boh','mah','meno','piu','più','di','nuovo','nuova','categoria','solo','sola','invece','dopo','adesso','ora','subito'])
const STRONG=0.85,WEAK=0.6
/** Piatti che una parte del messaggio indica «a suono». Le finestre di 1–4 parole che nominano già un piatto per intero non contano. */
export function phoneticHits(message:string,refs:MenuRef[]):{strong:string[],weak:string[],phrase:Map<string,string>}{
 const words=fold(message).split(' ').filter(Boolean),phrase=new Map<string,string>(),best=new Map<string,number>(),named=new Set<string>()
 const exact=new Set(refs.filter(r=>(' '+words.join(' ')+' ').includes(' '+fold(r.name)+' ')).map(r=>r.id))
 for(let i=0;i<words.length;i++)for(let k=1;k<=4&&i+k<=words.length;k++){const win=words.slice(i,i+k);if(win.every(w=>SERVICE.has(w)||/^\d/.test(w)))continue
  const text=win.join(' '),key=phoneKey(text),lead=SERVICE.has(win[0]!)||SERVICE.has(win.at(-1)!);if(key.length<2)continue
  for(const r of refs){if(exact.has(r.id))continue;const rk=phoneKey(r.name),rw=fold(r.name).split(' ')
   // Una parola di servizio in testa o in coda conta solo se è anche nel nome del piatto («che nesac» = «Che ne sacc»).
   if(lead&&!((!SERVICE.has(win[0]!)||rw[0]===win[0])&&(!SERVICE.has(win.at(-1)!)||rw.at(-1)===win.at(-1))))continue
   // Una parola che il nome del piatto contiene già («frittatina», «tramezzino») è un nome parziale, non un suono storpiato.
   // notte 22/10 (z-asr-005 «la pizza en duja» = Pizza 'nduja): parole del nome dette uguali + il RESTO storpiato dalla trascrizione
   // («en duja» = «nduja», vocale iniziale e spazio in più). Il resto unito, senza una vocale iniziale caduta, uguale a quello del nome = forte.
   if(text.split(' ').some(w=>w.length>=4&&rw.includes(w))&&win.length>=2){const restT=win.filter(w=>!rw.includes(w)&&!SERVICE.has(w)).join(''),restN=rw.filter(w=>!win.includes(w)&&!SERVICE.has(w)).join('')
    if(restT.length>=3&&restN.length>=4&&(phoneKey(restT)===phoneKey(restN)||phoneKey(restT).replace(/^[aeiou]/,'')===phoneKey(restN))&&win.length>=rw.length){if(1>(best.get(r.id)??0)){best.set(r.id,1);phrase.set(r.id,text)}continue}}
   if((' '+fold(r.name)+' ').includes(' '+text+' ')||text.split(' ').some(w=>w.length>=4&&(' '+fold(r.name)+' ').includes(' '+w+' ')))continue;if(Math.abs(rk.length-key.length)>Math.max(2,rk.length*0.4))continue
   const sc=phoneScore(text,r.name),short=rk.length<=3&&key.length<=3&&key[0]===rk[0]&&lev(key,rk)<=1?Math.max(sc,WEAK):sc
   if(short>(best.get(r.id)??0)){best.set(r.id,short);phrase.set(r.id,text)}
   // «nel piatto Bo»: con «piatto» davanti, la stessa chiave anche corta è il nome detto.
   if(sc===1&&['piatto','piatti'].includes(words[i-1]??''))named.add(r.id)}}
 const ranked=[...best].filter(([,s])=>s>=WEAK).sort((a,b)=>b[1]-a[1])
 const strong=ranked.filter(([id,s])=>s>=STRONG&&(phoneKey(refs.find(r=>r.id===id)!.name).length>=4||named.has(id))&&!ranked.some(([o,t])=>o!==id&&phrase.get(o)===phrase.get(id)&&t>=s-0.1)).map(([id])=>id)
 // A7.6 (G: «risotto alla zucca» → mai «Polpo alla griglia»): un'ipotesi debole vale solo se le parole piene della frase
 // corrispondono una a una a quelle del nome, ognuna con un suono vicino; altrimenti non è un nome storpiato.
 const aligned=(id:string)=>{const r=refs.find(x=>x.id===id),ph=phrase.get(id);if(!r||!ph)return false;const a=fold(ph).split(' ').filter(w=>w.length>=3&&!SERVICE.has(w)),b=fold(r.name).split(' ').filter(w=>w&&!SERVICE.has(w));if(a.length<=1&&b.length<=1)return true;if(a.length>b.length)return false
  // Ogni parola detta somiglia a una parola del nome (anche un nome parziale: «patane» = Frittatina di *patate*); con una
  // parola uguale basta una somiglianza più larga sulle altre («granita di mennula» = Granita di mandorla).
  const sc=a.map(w=>Math.max(...b.map(x=>phoneScore(w,x))));return sc.filter(x=>x>=0.6).length>=Math.ceil(a.length/2)&&Math.max(...sc)>=0.8}
 return{strong,weak:ranked.map(([id])=>id).filter(id=>!strong.includes(id)&&aligned(id)),phrase}}

/** Candidati per un bersaglio non trovato («kenesac», «Bu»): il migliore se supera la soglia debole e non ha rivali vicini. */
export function phoneticCandidates(target:string,refs:MenuRef[]):MenuRef[]{
 const t=fold(target).replace(/^(?:il|lo|la|l|i|gli|le|piatto|nel|del)\s+/,'');if(!t||t.split(' ').every(w=>SERVICE.has(w)))return []
 const scored=refs.map(r=>{const rk=phoneKey(r.name),k=phoneKey(t),sc=phoneScore(t,r.name);return{r,s:rk.length<=3&&k.length<=3&&k[0]===rk[0]&&lev(k,rk)<=1?Math.max(sc,WEAK):sc}}).filter(x=>x.s>=WEAK).sort((a,b)=>b.s-a.s)
 if(!scored.length)return [];if(scored[1]&&scored[1].s>=scored[0]!.s-0.1)return scored.slice(0,3).map(x=>x.r)
 return [scored[0]!.r]}

/** notte 22/10 (ps-06 «la ghisa» ≈ Gricia): somiglianza LARGA, solo per PROPORRE un piatto in una domanda (mai per scrivere):
 * parola di 4+ lettere, stessa prima e ultima lettera di un piatto dal nome di una parola, chiavi a distanza ≤ metà. */
export function looseSoundAlike(message:string,refs:MenuRef[]):MenuRef[]{const ws=fold(message).split(' ').filter(w=>w.length>=5&&!SERVICE.has(w)&&!/^\d/.test(w)&&!/^(?:alz|abbass|mett|port|togl|nascond|aggiung|cambi|aument|diminu|segn|rimett|elimin|cancell|sposta|rinomin|quell|quest|tutt|prezz|eur)/.test(w))
 return refs.filter(r=>{const n=fold(r.name);if(n.includes(' ')||n.length<4)return false;return ws.some(w=>w!==n&&w[0]===n[0]&&w.at(-1)===n.at(-1)&&lev(phoneKey(w),phoneKey(n))<=Math.floor(Math.max(phoneKey(w).length,phoneKey(n).length)/2))})}
/** 24/10 (Manuel 23/10 18:40 «Porta il tiramisu a 6 euro» → «Intendi *Pirata*?»): un piatto proposto «a suono» deve anche SOMIGLIARE
 * nelle lettere a una parola o a un gruppo di parole detto (distanza ≤ metà del nome e stessa iniziale, o ≤ un terzo). */
export function spelledAlike(message:string,name:string):boolean{const n=fold(name).replace(/ /g,''),ws=fold(message).split(' ').filter(w=>w&&!SERVICE.has(w)&&!/^\d/.test(w)&&!/^(?:alz|abbass|mett|port|togl|nascond|aggiung|cambi|aument|diminu|segn|rimett|elimin|cancell|sposta|rinomin|quell|quest|tutt|prezz|eur|cost|fall|fai|finit|esaurit)/.test(w))
 if(n.length<3)return false
 for(let i=0;i<ws.length;i++)for(let k=1;k<=4&&i+k<=ws.length;k++){const t=ws.slice(i,i+k).join('');const d=lev(t,n);if(d<=Math.floor(n.length/3)||(t[0]===n[0]&&d<=Math.ceil(n.length/2)))return true}
 return false}
