// Batteria R9 (18/10/2026, agente R6): bug dal vivo sul QA 12:30–12:32 UTC (tre vocali). «Ora nei primi aggiungi pasta al pesto,
// pasta al ragù, pasta carbonara e riso giallo, metti le paste a 10 euro e il riso a 8 euro» → «C'è già…» (con «Pasta al pesto e
// lasagna» preso per «pasta al pesto»), poi «Aggiornapure» / «Sì sì, aggiornali» → la STESSA domanda all'infinito.
// Famiglie: risposte brevi alla domanda a due opzioni (30 forme × richieste), vocali storpiati dopo la domanda, doppioni veri contro
// nomi contenuti, modello testardo che ripete la domanda (invariante: mai la stessa domanda due volte di fila).
// Menu = QA vero riletto dal DB (rev 1820, sola lettura). Runner: tests/eval/eval-adv-r9.test.ts (oracolo brain-oracle-r9.ts).
import {readFileSync} from 'node:fs'
import type {Change,Conversation,Family,Turn} from '../types.js'
import {FIXTURES} from '../fixtures/menus.js'
import type {R9Meta} from '../adapters/brain-oracle-r9.js'

const load=(f:string)=>JSON.parse(readFileSync(new URL('../fixtures/'+f,import.meta.url),'utf8'))
FIXTURES.qalive2={key:'qalive2',restaurant:'Tako · Verifica web',menu:load('qa-live-1018-after.json')}

const CR=(name:string,price:number,section='Primi'):Change=>({op:'create',name,price,section})
const PR=(dish:string,price:number):Change=>({op:'price',dish,price}),VIS=(dish:string):Change=>({op:'hidden',dish,value:false})
export const ADV_R9_CASES:(Conversation&{r9:R9Meta})[]=[]
let fam='risposta-breve'
const c=(turns:Turn[],changes:Change[],r9:R9Meta,x:{ask?:number[],alt?:Change[][],note?:string}={})=>{const id=`r9-${fam}-${String(ADV_R9_CASES.filter(k=>k.source===`r9:${fam}`).length+1).padStart(3,'0')}`
 ADV_R9_CASES.push({id,family:'b2-categorie' as Family,menu:'qalive2',turns,changes,source:`r9:${fam}`,r9,...x})}
const V=(s:string):Turn=>({voice:s}),T=(s:string):Turn=>({text:s})

// Richieste con UN piatto che c'è già con lo stesso nome (pasta al ragù, nascosta a 20 €) e piatti nuovi (anche dal nome contenuto
// in un piatto più lungo: «pasta al pesto» ≠ «Pasta al pesto e lasagna»).
type Req={text:string,req:{name:string,price:number}[],twins:string[],falseTwin?:boolean}
const REQS:Req[]=[
 {text:'Ora nei primi aggiungi pasta al pesto, pasta al ragù, pasta carbonara e riso giallo, metti le paste a 10 euro e il riso a 8 euro',req:[{name:'pasta al pesto',price:10},{name:'pasta al ragù',price:10},{name:'pasta carbonara',price:10},{name:'riso giallo',price:8}],twins:['pasta al ragù'],falseTwin:true},
 {text:'nei primi aggiungi pasta al ragù a 10 e riso giallo a 8',req:[{name:'pasta al ragù',price:10},{name:'riso giallo',price:8}],twins:['pasta al ragù']},
 {text:'aggiungi in primi pasta al pesto a 10, pasta al ragù a 10 e pasta carbonara a 10',req:[{name:'pasta al pesto',price:10},{name:'pasta al ragù',price:10},{name:'pasta carbonara',price:10}],twins:['pasta al ragù'],falseTwin:true}]
const after=(r:Req,mode:'update'|'create')=>[...r.req.filter(x=>!r.twins.includes(x.name)).map(x=>CR(x.name,x.price)),...r.twins.flatMap(t=>{const p=r.req.find(x=>x.name===t)!.price;return mode==='update'?[PR(t,p),VIS(t)]:[CR(t,p)]})]

// ---- 1. risposte brevi: 30 forme (20 «aggiorna», 10 «crea») × 3 richieste, vocali e testo ----
fam='risposta-breve'
const UPD=['aggiornali','sì aggiornali','Sì sì, aggiornali','aggiorna','Aggiornapure','aggiorna pure','aggiornalo','quelli vecchi','quello che c’è','il primo','la 1','1','sì','ok aggiorna','va bene, aggiornalo','usa quello che c’è','modifica quello esistente','sì, quello vecchio','aggiorna quello','prima opzione']
const NEW=['crea nuovi','nuovi','creane un altro','il secondo','la 2','2','fanne uno nuovo','nuovo','crea','seconda opzione']
REQS.forEach((r,ri)=>{for(const [i,a] of UPD.entries())c([V(r.text),i%2?T(a):V(a)],after(r,'update'),{req:r.req,section:'Primi',twins:r.twins,falseTwin:r.falseTwin},{ask:[1]})
 for(const [i,a] of NEW.entries())c([V(r.text),i%2?V(a):T(a)],after(r,'create'),{req:r.req,section:'Primi',twins:r.twins,falseTwin:r.falseTwin},{ask:[1]})})

// ---- 2. vocale storpiato o fuori tema dopo la domanda: nessuna scrittura, una domanda DIVERSA (mai la stessa) ----
fam='vocale-storpiato'
const NOISE=['Buongiorno a tutti','grazie','boh','pronto?','Ciao, sì sì','aspetta un attimo','[vocale senza parole]','eh','mmh vediamo','Buonasera']
for(const r of REQS.slice(0,2))for(const a of NOISE)c([V(r.text),V(a)],[],{req:r.req,section:'Primi',twins:r.twins,falseTwin:r.falseTwin},{ask:[1,2],alt:[after(r,'update'),after(r,'create')]})
// …e poi la risposta vera al terzo vocale: si esegue.
for(const r of REQS.slice(0,2))for(const [a,b] of [['Buongiorno a tutti','Sì sì, aggiornali'],['boh','aggiornali'],['grazie','1'],['pronto?','crea nuovi'],['eh','2']] as const)c([V(r.text),V(a),V(b)],after(r,/crea|^2$/.test(b)?'create':'update'),{req:r.req,section:'Primi',twins:r.twins,falseTwin:r.falseTwin},{ask:[1,2]})

// ---- 3. modello testardo: ripete la domanda in sospeso parola per parola (il bug vero) ----
fam='testardo'
for(const r of REQS)for(const [a,n] of [['aggiornali',1],['Sì sì, aggiornali',1],['crea nuovi',1],['il primo',1],['aggiornali',2],['nuovi',2],['Aggiornapure',2],['sì',1]] as const)
 c([V(r.text),V(a)],after(r,/crea|nuov/.test(a)?'create':'update'),{req:r.req,section:'Primi',twins:r.twins,falseTwin:r.falseTwin,stubborn:n},{ask:[1]})
// Sempre testardo: mai la stessa domanda due volte, nessuna scrittura.
// Turno 2 senza domanda attesa: un modello che ripete sempre la stessa domanda non ha una domanda da mandare; il server manda solo i
// fatti (niente testo fisso) e mai la domanda ripetuta (invariante domanda-ripetuta).
for(const r of REQS)for(const a of ['aggiornali','Buongiorno a tutti','sì'])c([V(r.text),V(a)],[],{req:r.req,section:'Primi',twins:r.twins,falseTwin:r.falseTwin,stubborn:9},{ask:[1]})

// ---- 4. doppioni veri contro nomi contenuti (un turno) ----
fam='doppioni'
const NEWONLY:[string,{name:string,price:number}[]][]=[
 ['nei primi aggiungi pasta al pesto a 10',[{name:'pasta al pesto',price:10}]],
 ['in primi aggiungi pasta al pesto a 10 e riso giallo a 8',[{name:'pasta al pesto',price:10},{name:'riso giallo',price:8}]],
 ['aggiungi nei primi la pasta al pesto a 12',[{name:'pasta al pesto',price:12}]],
 ['nei primi aggiungi pasta al pesto e lasagna verde a 13',[{name:'pasta al pesto e lasagna verde',price:13}]],
 ['nei primi aggiungi lasagna a 11',[{name:'lasagna',price:11}]],
 ['nei primi aggiungi pasta a 7',[{name:'pasta',price:7}]]]
for(const [t,req] of NEWONLY){c([V(t)],req.map(x=>CR(x.name,x.price)),{req,section:'Primi',twins:[]});c([T(t)],req.map(x=>CR(x.name,x.price)),{req,section:'Primi',twins:[]})}
const TWINS:[string,{name:string,price:number}[],string[]][]=[
 ['nei primi aggiungi pasta al ragù a 10',[{name:'pasta al ragù',price:10}],['pasta al ragù']],
 ['nei primi aggiungi pasta al ragu a 10',[{name:'pasta al ragu',price:10}],['pasta al ragù']],
 ['nei primi aggiungi Pasta al Ragù a 10',[{name:'Pasta al Ragù',price:10}],['pasta al ragù']],
 ['nei primi aggiungi pasta al sugo a 11',[{name:'pasta al sugo',price:11}],['Pasta al sugo']],
 ['nei primi aggiungi il tiramisù a 7',[{name:'tiramisù',price:7}],['tiramisù']]]
for(const [t,req,tw] of TWINS)for(const a of ['aggiornalo','crea nuovo','Buongiorno a tutti']){const twin=tw[0]!,p=req[0]!.price
 c([V(t),V(a)],a==='aggiornalo'?[PR(twin,p),...(twin==='pasta al ragù'?[VIS(twin)]:[])]:a==='crea nuovo'?[CR(req[0]!.name,p)]:[],{req,section:'Primi',twins:tw},{ask:a.startsWith('Buon')?[1,2]:[1]})}
// Due gemelli nella stessa richiesta: «aggiorna il ragù e crea la pasta al sugo», «entrambi aggiorna».
{const req=[{name:'pasta al ragù',price:10},{name:'pasta al sugo',price:11}],tw=['pasta al ragù','Pasta al sugo'],t='nei primi aggiungi pasta al ragù a 10 e pasta al sugo a 11'
 c([V(t),V('aggiorna il ragù e crea la pasta al sugo')],[PR('pasta al ragù',10),VIS('pasta al ragù'),CR('pasta al sugo',11)],{req,section:'Primi',twins:tw},{ask:[1]})
 c([V(t),V('entrambi aggiorna')],[PR('pasta al ragù',10),VIS('pasta al ragù'),PR('Pasta al sugo',11)],{req,section:'Primi',twins:tw},{ask:[1]})
 c([V(t),T('aggiornali tutti e due')],[PR('pasta al ragù',10),VIS('pasta al ragù'),PR('Pasta al sugo',11)],{req,section:'Primi',twins:tw},{ask:[1]})
 c([V(t),T('creali tutti e due nuovi')],[CR('pasta al ragù',10),CR('pasta al sugo',11)],{req,section:'Primi',twins:tw},{ask:[1]})
 c([V(t),V('il sugo aggiornalo, il ragù fanne uno nuovo')],[PR('Pasta al sugo',11),CR('pasta al ragù',10)],{req,section:'Primi',twins:tw},{ask:[1]})}

if(ADV_R9_CASES.length<150)throw new Error('batteria R9: meno di 150 conversazioni ('+ADV_R9_CASES.length+')')
