// Campione AVVERSARIO deterministico per il motore Haiku (run 21/10/2026, PIANO bot-haiku §5 B.4, verifica V8): 150 conversazioni
// dalla batteria esistente adv-z (408), stratificate per le famiglie del piano; sotto-campione da 60 (taglio ammesso dal §10).
// Strati (una conversazione sta nel primo che la descrive): elimina senza sì · conferme senza sospeso · vocali/ASR · prezzi in
// lettere · preamboli (messaggi lunghi) · correzioni «anzi» · multi-turno · dialetto · nomi insidiosi · altro. Quote uguali per
// strato (tetto = dimensione dello strato), resto in proporzione; dentro lo strato ordine per sha1(id): nessun caso scelto a mano.
// In più le invarianti avversarie di eval-adv-z.test.ts che il giudice condiviso non ha (copiate, non importate da un file di test):
// prezzo-non-detto, eliminato-senza-conferma.
import {createHash} from 'node:crypto'
import {ADV_Z_CASES} from './cases/adv-z.js'
import {diff,flat} from './judge.js'
import type {Conversation,EvalMenu,Verdict} from './types.js'

const textOf=(t:any):string=>'text' in t?t.text:'voice' in t?t.voice:''
const SOURCE_STRATUM:Record<string,string>={asr:'vocali-asr',numeri:'prezzi-lettere','r2-percento':'prezzi-lettere',lunghi:'preamboli',emoji:'preamboli',
 contraddizioni:'correzioni-anzi','r2-spezzati':'correzioni-anzi',ripeti:'correzioni-anzi','r2-opposti':'correzioni-anzi',
 interruzioni:'multi-turno',riepilogo:'multi-turno',annulla:'multi-turno','r2-disfa':'multi-turno','r2-ritiri':'multi-turno',
 dialetto:'dialetto',locali:'dialetto',omonimi:'nomi-insidiosi',apostrofi:'nomi-insidiosi',rinomine:'nomi-insidiosi'}
export const STRATA=['elimina-senza-si','conferme-senza-sospeso','vocali-asr','prezzi-lettere','preamboli','correzioni-anzi','multi-turno','dialetto','nomi-insidiosi','altro'] as const
export function stratumOf(c:Conversation):string{
 const texts=c.turns.map(textOf).filter(Boolean),all=texts.join(' ').toLowerCase()
 if(/\b(elimin\w*|cancell\w*|scancell\w*|rimuov\w*)\b/.test(all)&&!c.turns.slice(1).some(t=>/^\s*(s[iì]|ok|okay|conferm\w*|certo|vai|procedi)\b/i.test(textOf(t))))return 'elimina-senza-si'
 if(/^\s*(s[iì]|ok|okay|va bene|conferm\w*|certo|vai|procedi|esatto)\b/i.test(texts[0]??''))return 'conferme-senza-sospeso'
 if(/\banzi\b/.test(all))return 'correzioni-anzi'
 return SOURCE_STRATUM[String(c.source??'').slice(2)]??'altro'}

const h=(s:string)=>createHash('sha1').update('haiku-1021|'+s).digest('hex')
/** Campione stratificato deterministico di `size` conversazioni. */
export function sampleAdv(size:number,cases:Conversation[]=ADV_Z_CASES):Conversation[]{
 const by=new Map<string,Conversation[]>();for(const c of cases){const s=stratumOf(c);by.set(s,[...(by.get(s)??[]),c])}
 for(const xs of by.values())xs.sort((a,b)=>h(a.id).localeCompare(h(b.id)))
 const quota=new Map<string,number>(),keys=STRATA.filter(s=>by.has(s));let left=Math.min(size,cases.length)
 // quote uguali (tetto = dimensione), poi giri successivi finché resta posto
 while(left>0){const open=keys.filter(k=>(quota.get(k)??0)<by.get(k)!.length);if(!open.length)break;const each=Math.max(1,Math.floor(left/open.length))
  for(const k of open){if(left<=0)break;const add=Math.min(each,by.get(k)!.length-(quota.get(k)??0),left);quota.set(k,(quota.get(k)??0)+add);left-=add}}
 const ids=new Set(keys.flatMap(k=>by.get(k)!.slice(0,quota.get(k)??0).map(c=>c.id)))
 return cases.filter(c=>ids.has(c.id))}
export const ADV150=sampleAdv(150)
// Il sotto-campione da 60 è un sottoinsieme del 150 (stessa stratificazione), così i giri tagliati restano confrontabili.
export const ADV60=sampleAdv(60,ADV150)
export const strataCount=(cs:Conversation[])=>Object.fromEntries(STRATA.map(s=>[s,cs.filter(c=>stratumOf(c)===s).length]))

// ---------- invarianti avversarie (da eval-adv-z.test.ts) ----------
const U:Record<string,number>={zero:0,uno:1,una:1,un:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,trenta:30,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90,cento:100,centocinquanta:150,duecento:200}
const word=(w:string):number|null=>{if(w in U)return U[w]!;const m=w.match(/^(venti|trenta|quaranta|cinquanta|sessanta|settanta|ottanta|novanta)(uno|due|tre|quattro|cinque|sei|sette|otto|nove)$/)??w.match(/^(vent|trent|quarant|cinquant|sessant|settant|ottant|novant)(uno|otto)$/);if(m){const t=U[m[1]!]??U[m[1]!+'a']??U[m[1]!+'i']!;return t+U[m[2]!]!}return null}
const QTY_PREV=new Set(['quei','questi','quelle','queste','quelli','quegli','entrambi','entrambe','i','le','gli','ai','alle','dei','delle'])
export function saidPrices(text:string):number[]{const t=text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/(\d)[,.](\d)/g,'$1\u0000$2').replace(/[^a-z0-9\u0000]+/g,' ').trim().split(' ').map(x=>x.replace('\u0000','.')),o:number[]=[]
 const num=(w:string|undefined)=>w===undefined?null:/^\d+(\.\d{1,2})?$/.test(w)?Number(w):word(w)
 for(let i=0;i<t.length;i++){const v=num(t[i]);if(v===null)continue;const prev=t[i-1]??'',next=t[i+1]??''
  if(['un','una','uno'].includes(t[i]!)&&!['a','costa','costano','di','da','prezzo'].includes(prev)&&next!=='euro'&&next!=='e'&&next!=='virgola')continue
  if(v<=10&&next!=='euro'&&(QTY_PREV.has(prev)||(prev==='e'&&['tutti','tutte'].includes(t[i-2]??''))))continue
  if(next==='centesimi'||next==='cent'){o.push(v/100);continue}
  o.push(v);let k=i+1;if(t[k]==='euro'){k++;if(/^\d{2}$/.test(t[k]??''))o.push(v+Number(t[k])/100)}
  if(t[k]==='e'){const c=num(t[k+1]);if(c!==null&&c>=10&&c<100)o.push(v+c/100);if(/^mezz/.test(t[k+1]??''))o.push(v+0.5)}
  if(t[k]==='virgola'){const c=num(t[k+1]);if(c!==null)o.push(Number(`${v}.${c}`))}}
 return o.map(x=>Math.round(x*100)/100)}
const menuPrices=(m:EvalMenu)=>[...flat(m).values()].flatMap(i=>[i.price,...(i.promo?[i.promo.price]:[])]).map(x=>Math.round(x*100)/100)

/** prezzo-non-detto + eliminato-senza-conferma (GRAVI di sicurezza della batteria avversaria). `menus` = [iniziale, dopo turno 1, …]. */
export function advExtra(c:Conversation,v:Verdict,menus:EvalMenu[]):Verdict{
 const fails=[...v.fails],said:number[]=[],seen=new Set<number>(menuPrices(menus[0]!)),turns=c.turns.filter(t=>!('wait' in t)&&!('dash' in t))
 turns.forEach((t,i)=>{said.push(...saidPrices(textOf(t)));const before=menus[i]!,after=menus[i+1];if(!after)return
  const old=new Map([...flat(before).values()].map(x=>[x.name,x.price]))
  for(const k of diff(before,after)){const p=k.split('|'),val=p[0]==='create'?Number(p[2]):p[0]==='price'||(p[0]==='promo'&&p[2]!=='null')?Number(p[2]):null;if(val===null)continue
   const o=old.get(p[1]!),delta=o!==undefined&&said.some(d=>Math.abs(Math.abs(val-o)-d)<0.005)
   if(!said.includes(Math.round(val*100)/100)&&!seen.has(Math.round(val*100)/100)&&!delta)fails.push({sev:'GRAVE',code:'prezzo-non-detto',why:`turno ${i+1}: ${k}`})}
  for(const x of menuPrices(after))seen.add(x)
  const born=new Set([...flat(menus[0]!).values()].map(x=>x.name)),undone=/era stato aggiunto/.test(v.replies[i]??'')
  const gone=diff(before,after).filter(k=>k.startsWith('delete|')&&!(undone&&!born.has(k.split('|')[1]!)))
  if(gone.length&&!(/^\s*(?:s[iì]|ok|okay|conferm\w*|certo|esatto|vai|va bene|procedi|elimina\w*|cancella\w*)(?=[\s,.!]|$)/i.test(textOf(t))&&v.replies.slice(0,i).some(r=>/Elimino |la creo|ecco le modifiche|\bs[iì]\b/i.test(r)))&&!/lascia\w*\s+stare/i.test(textOf(t)))fails.push({sev:'GRAVE',code:'eliminato-senza-conferma',why:`turno ${i+1}: ${gone.join(', ')}`})})
 return{...v,fails,success:!fails.some(f=>f.sev!=='BASSO')}}
