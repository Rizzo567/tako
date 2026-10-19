// SPIKE Haiku 5.5 come cervello del bot titolare (18/10/2026). Simulatore di menu + validatore lato server + costruttore del prompt
// + giudice (riusa tests/eval/judge.ts). Nessuna rete, nessuna chiave. L'orchestratore (Opus) fa il ristoratore e passa i prompt
// a un sottoagente Haiku nuovo per ogni messaggio; i risultati degli strumenti tornano allo stesso Haiku (tool loop).
// Uso: node --experimental-strip-types spike.ts <comando> ...  (vedi main in fondo)
import fs from 'node:fs'
import path from 'node:path'
import {BV_CASES} from '../../../../tests/eval/cases/banco-vero.ts'
import {FIXTURES,initialMenu} from '../../../../tests/eval/fixtures/menus.ts'
import {judge,diff,isQuestion} from '../../../../tests/eval/judge.ts'
import {EXTRA_CASES} from './cases-extra.ts'
import type {Conversation,EvalMenu,EvalItem,Turn} from '../../../../tests/eval/types.ts'

const DIR=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..')
const RUNS=path.join(DIR,'runs')
const ALL:Conversation[]=[...BV_CASES,...EXTRA_CASES]
const conv=(id:string)=>{const c=ALL.find(x=>x.id===id);if(!c)throw new Error('conversazione sconosciuta '+id);return c}
const locale=(menu:string)=>/^qa|^collaudo/.test(menu)?'qa':menu
const plain=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const num=(n:number)=>Number.isInteger(n)?String(n):String(Math.round(n*100)/100).replace('.',',')
const textOf=(t:Turn)=>'text' in t?t.text:'voice' in t?t.voice:''

// ---------------------------------------------------------------- scheda generale (copiata dal contenuto di owner-brain-context)
export const SYSTEM=`Sei il cervello di un assistente WhatsApp per il titolare di un ristorante. Capisci cosa vuole cambiare nel menu e agisci con gli strumenti. Rispondi SOLO con JSON.

FORMATO: {"chiamate":[{"strumento":"<nome>","argomenti":{...}}]}. Puoi mettere più chiamate in un passo. Il server esegue e ti rimanda i risultati; poi continui. "chiedi" o "rispondi" chiudono il turno (il testo va al titolare). Massimo 6 passi per messaggio.

VINCOLO DURO (il server lo controlla e rifiuta il piano):
- Nessuna scrittura con un prezzo o un nome che non siano nel testo del titolare (messaggio o cronologia) o in un risultato di strumento. Mai prezzi inventati.
- elimina_piatto: il server chiede il «sì»; si cancella solo se il titolare risponde sì al turno dopo.
- annulla_ultima: solo l'ultima pubblicazione, mai il piatto del giorno.
- «togli/leva/nascondi» = nascondi, NON elimina. «elimina/cancella/rimuovi completamente/levalo proprio» = elimina_piatto.
- Mai dire «fatto» prima del risultato dello strumento.
- Chiedi solo se serve davvero (piatto ambiguo, prezzo mancante, due prezzi alternativi, intenzione non chiara).
- Risposte brevi (≤ 40 parole), numerate se le modifiche sono più di una, senza emoji.
- Il testo può essere una trascrizione vocale con errori di ascolto («kenesac» = Che ne sacc?, «u tunnu» = tonno, «Bo/Bu» = boh?): riconcilia col menu usando cerca_piatti; se non è sicuro, chiedi.

REGOLE DEL TITOLARE: più parti incerte → una domanda per ciascuna; le parti chiare si eseguono. «annulla» = annulla_ultima. Prezzo solo se detto. «aumenta/abbassa di N» = prezzo attuale ± N; «del 10%» = prezzo × 1,10. «aggiungi X a 10» con X già nel menu → non creare un doppione: chiedi «C'è già X a 12 €: lo aggiorno o ne creo un altro?». Nome nuovo = le parole dette, intere («il piatto Piatto test QA» → «Piatto test QA»). Una sola categoria → crea_piatto la usa. «quei due», «entrambi», «il primo» = piatti degli ultimi messaggi. Una domanda («quanto costa X?», «13 o 14?», «X c'è?») non è mai una modifica: leggi e rispondi. «da domani» o orari futuri: non programmi, chiedi se farlo subito. Numeri non-prezzo («tavolo 7», «per 4 persone») non sono prezzi. Una risposta a una tua domanda o a un'operazione in sospeso la completa («sì», «ok», «va bene così», «confermo»). Negazioni («non cambiare X», «nun cambià», «lascia com'è») = nessuna azione su X.

GLOSSARIO (italiano, colloquiale, regionale; usa il significato solo se il contesto lo conferma)
ESAURITO → finito: finito/a, esaurito, terminato, è andato, non c'è più, non ce l'ho, manca, sold out, nun ce sta cchiù, un c'è cchiù, è fernuto, l'è finida, la xe finia, a l'é finìa, è spicciato.
DI NUOVO DISPONIBILE → disponibile: è tornato, c'è di nuovo, rimettilo disponibile, riattiva, ce sta ancora, l'è tornada.
NASCONDI: togli/leva dal menu, nascondi, non farlo vedere, tira via, levalo. MOSTRA: rimetti nel menu, fallo vedere, mostra.
EVIDENZA: consiglia, metti in evidenza, in vetrina, piatto forte. PROMO: in sconto/offerta/promo a N = promo(piatto, "N").
PREZZO: costa, mettilo a, fallo, portalo a, euri/euro/€; «e mezzo»=,50; «dodici e cinquanta»=12,50; «tre dici» (vocale) = tredici.
NEGAZIONI: non, nun, un, mica, manco, lascia stare, tranne, eccetto. «nun è fernuta» = NON esaurito.
SERVIZIO: piatto/menu del giorno → piatto_del_giorno; coperto, asporto, mezza porzione, calice, bottiglia.
SINONIMI (solo se nel menu c'è UN solo piatto corrispondente): arancino=arancina; polpette=purpette; salsiccia=sasizza; melanzane=mulignane; patate=patane; pomodoro=pummarola; matriciana=amatriciana; carbo=carbonara; marghe=margherita; tiramisù=tirami su; coca=coca cola.
DIVERSI (MAI scambiarli): guanciale≠pancetta; calamari≠totani; gamberi≠mazzancolle; mozzarella≠bufala≠burrata; spaghetti≠spaghettoni; pizza≠focaccia.

STRUMENTI (argomenti JSON):
cerca_piatti{testo} · leggi_menu{filtri?: "finiti"|"nascosti"|"promo"|nome categoria} · cambia_prezzo{piatto_id,prezzo} · nascondi{piatto_id} · mostra{piatto_id} · finito{piatto_id} · disponibile{piatto_id} · crea_piatto{nome,prezzo,categoria (cat_id o nome)} · elimina_piatto{piatto_id} · crea_categoria{nome} · rinomina_piatto{piatto_id,nome} · rinomina_categoria{cat_id,nome} · sposta_piatto{piatto_id,cat_id} · descrizione{piatto_id,testo} · promo{piatto_id,testo: prezzo promo o null per toglierla} · evidenza{piatto_id,on} · piatto_del_giorno{piatto_id|nome,prezzo?} · annulla_ultima{} · chiedi{domanda} · rispondi{testo}`

// ---------------------------------------------------------------- stato
type Exchange={owner:string,bot:string,tools:string[]}
type Pub={before:EvalMenu,daily:boolean,label:string}
type Pending={deletes:{id:string,name:string}[],question:string|null}
type StepLog={step:number,input:string,output:string,executed:string[],rejected:string[]}
type TurnLog={turn:number,owner:string,promptFile:string,promptChars:number,steps:StepLog[],reply:string,menuAfter:EvalMenu,rejects:number,selfFixes:number,forcedQuestion:boolean,question:boolean,toolCalls:string[]}
type State={id:string,menuKey:string,locale:string,note:string,codes:Record<string,string>,next:{p:number,c:number},menu:EvalMenu,initial:EvalMenu,turn:number,history:Exchange[],pending:Pending,lastPub:Pub|null,
 cur:{steps:StepLog[],rejectsThisMsg:number,writes:string[],before:EvalMenu,executed:string[],selfFixes:number,pendingReject:boolean}|null,turns:TurnLog[],done:boolean}

const sfile=(id:string)=>path.join(RUNS,id,'state.json')
const load=(id:string):State=>JSON.parse(fs.readFileSync(sfile(id),'utf8'))
const save=(s:State)=>{fs.mkdirSync(path.dirname(sfile(s.id)),{recursive:true});fs.writeFileSync(sfile(s.id),JSON.stringify(s,null,1))}
const notesFile=path.join(RUNS,'notes.json')
const notes=():Record<string,string>=>fs.existsSync(notesFile)?JSON.parse(fs.readFileSync(notesFile,'utf8')):{}

function init(id:string):State{const c=conv(id),menu=initialMenu(c.menu,c.mods),codes:Record<string,string>={}
 let p=0,k=0;for(const m of menu.menus)for(const s of m.sections){codes['c'+(++k)]=s.id;for(const i of s.items)codes['p'+(++p)]=i.id}
 const s:State={id,menuKey:c.menu,locale:locale(c.menu),note:process.env.NONOTE?'':(notes()[locale(c.menu)]??''),codes,next:{p,c:k},menu,initial:structuredClone(menu),turn:0,history:[],pending:{deletes:[],question:null},lastPub:null,cur:null,turns:[],done:false}
 save(s);return s}
const ownerTurns=(c:Conversation)=>c.turns.filter(t=>'text' in t||'voice' in t)
const items=(m:EvalMenu)=>m.menus.flatMap(x=>x.sections.flatMap(s=>s.items.map(i=>({i,s}))))
const codeOf=(s:State,id:string)=>Object.entries(s.codes).find(([,v])=>v===id)?.[0]??'?'
const item=(s:State,code:string)=>{const id=s.codes[String(code).trim()];return items(s.menu).find(x=>x.i.id===id)}
const section=(s:State,ref:string)=>{const id=s.codes[String(ref).trim()];const all=s.menu.menus.flatMap(m=>m.sections);return all.find(x=>x.id===id)??all.find(x=>plain(x.name)===plain(String(ref)))}
const flags=(i:EvalItem)=>(i.available===false?'x':'')+(i.hidden?'h':'')+(i.featured?'*':'')
const line=(s:State,i:EvalItem)=>`${codeOf(s,i.id)}|${i.name}|${num(i.price)}${flags(i)?'|'+flags(i):''}${i.promo?` |promo ${num(i.promo.price)}`:''}`
function compact(s:State){const out=['MENU (codice|nome|prezzo €|stato: x=finito h=nascosto *=evidenza)'];for(const m of s.menu.menus)for(const sec of m.sections){out.push(`# ${codeOf(s,sec.id)} ${sec.name}`+(s.menu.menus.length>1?` (${m.name})`:''));for(const i of sec.items)out.push(line(s,i))}return out.join('\n')}

// ---------------------------------------------------------------- prompt
function buildPrompt(s:State,msg:string){const c=conv(s.id)
 const hist=s.history.length>20?[`(${s.history.length-20} scambi più vecchi compressi: ${s.history.slice(0,-20).map(h=>h.owner.slice(0,40)).join(' / ')})`,...s.history.slice(-20).map(fmtEx)]:s.history.map(fmtEx)
 const pend=[...s.pending.deletes.map(d=>`- eliminazione di ${codeOf(s,d.id)} «${d.name}» in attesa del «sì» del titolare (se dice sì: elimina_piatto ${codeOf(s,d.id)})`),...(s.pending.question?[`- la tua ultima domanda al titolare: «${s.pending.question}»`]:[])]
 return `=== SYSTEM ===\n${SYSTEM}\n\n=== SCHEDA DEL LOCALE: ${FIXTURES[c.menu]!.restaurant} ===\n${compact(s)}\n\nNOTA DEL LOCALE (imparata dal titolare): ${s.note.trim()||'(vuota)'}\n\n=== CRONOLOGIA DELLA GIORNATA ===\n${hist.join('\n')||'(nessuno scambio oggi)'}\n\n=== OPERAZIONI IN SOSPESO ===\n${pend.join('\n')||'(nessuna)'}\n\n=== MESSAGGIO DEL TITOLARE ===\n${msg}`}
const fmtEx=(h:Exchange)=>`titolare: ${h.owner}\nbot: ${h.bot}${h.tools.length?`\n(strumenti eseguiti: ${h.tools.join('; ')})`:''}`

// ---------------------------------------------------------------- numeri nel testo (validatore prezzi)
const W:Record<string,number>={zero:0,uno:1,un:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,diece:10,undici:11,dodici:12,tredici:13,tridici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,trenta:30,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90,cento:100,centocinquanta:150}
function wordNum(w:string):number|null{if(/^\d+$/.test(w))return Number(w);if(w in W)return W[w]!;for(const t of ['novanta','ottanta','settanta','sessanta','cinquanta','quaranta','trenta','venti']){if(w.startsWith(t.slice(0,-1))){const rest=w.slice(t.length-1).replace(/^[ai]/,'');const r=rest===''?0:W[rest]??W[rest.replace(/^t/,'t')];if(r!=null&&r<10)return W[t]!+r}}return null}
export function numbersIn(text:string):number[]{const out:number[]=[],t=text.toLowerCase().replace(/(\d),(\d)/g,'$1.$2')
 for(const m of t.matchAll(/\d+(?:\.\d+)?/g))out.push(Number(m[0]))
 const ws=plain(text).split(' ');const vals=ws.map(w=>wordNum(w))
 for(let i=0;i<ws.length;i++){const v=vals[i];if(i+1<ws.length&&!/^\d/.test(ws[i]!)){const j=wordNum(ws[i]!+ws[i+1]!);if(j!=null)out.push(j)};if(v==null)continue;out.push(v)
  if(ws[i+1]==='e'&&ws[i+2]==='mezzo')out.push(v+0.5)
  if(ws[i+1]==='centesimi')out.push(v/100)
  if((ws[i+1]==='e'||ws[i+1]==='euro')&&vals[i+2]!=null)out.push(v+vals[i+2]!/100)
  if(ws[i+1]==='euro'&&ws[i+2]==='e'&&vals[i+3]!=null)out.push(v+vals[i+3]!/100)}
 const base=[...out];for(const n of base)if(/e mezzo/.test(t))out.push(n+0.5)
 return out}
function priceOk(s:State,price:number,refPrice?:number){const txt=[...s.history.map(h=>h.owner),curMsg(s)].join(' \n ');const ns=numbersIn(txt)
 const eq=(a:number,b:number)=>Math.abs(a-b)<0.005
 if(ns.some(n=>eq(n,price)))return true
 if(refPrice!=null){for(const n of ns){if(eq(refPrice+n,price)||eq(refPrice-n,price))return true;if(eq(refPrice*(1+n/100),price)||eq(refPrice*(1-n/100),price))return true;if(Math.abs(refPrice*(1+n/100)-price)<0.051||Math.abs(refPrice*(1-n/100)-price)<0.051)return true}}
 // prezzo presente in un risultato di strumento (es. «stesso prezzo di X»)
 return items(s.menu).some(x=>eq(x.i.price,price))&&/stesso prezzo|come |uguale/i.test(txt)}
function nameOk(s:State,name:string){const txt=plain([...s.history.map(h=>h.owner),curMsg(s)].join(' '));const n=plain(name);return n.length>0&&n.split(' ').every(w=>(' '+txt+' ').includes(' '+w+' '))}
const curMsg=(s:State)=>textOf(ownerTurns(conv(s.id))[s.turn]!)
const YES=/^\s*(s[iì]+|sine|seh|ok|okay|va bene|confermo|conferma|confirma|vai|procedi|certo|elimina(lo|la)?)(?![a-zà-ù])/i

// ---------------------------------------------------------------- strumenti
type R={ok:boolean,text:string,write?:boolean,reject?:boolean}
function exec(s:State,name:string,a:any):R{const it=a?.piatto_id!=null?item(s,a.piatto_id):undefined
 const need=()=>it?null:{ok:false,text:`errore: piatto_id «${a?.piatto_id}» inesistente`} as R
 const pub=(label:string,daily=false)=>{s.lastPub={before:s.cur!.before,daily,label}}
 switch(name){
 case 'cerca_piatti':{const q=plain(String(a?.testo??''));const qs=q.split(' ').filter(w=>w.length>1)
  const sc=(n:string)=>{const p=plain(n);if(p===q)return 100;let x=0;for(const w of qs){if((' '+p+' ').includes(' '+w+' '))x+=10;else if(p.includes(w)||w.includes(p))x+=6;else{for(const pw of p.split(' '))if(pw.length>2&&lev(pw,w)<=Math.max(1,Math.floor(pw.length/3)))x+=4}}
   const pq=p.replace(/ /g,''),qq=q.replace(/ /g,'');if(lev(pq,qq)<=Math.max(2,Math.floor(pq.length/3)))x+=8;return x}
  const hits=items(s.menu).map(x=>({x,v:sc(x.i.name)})).filter(h=>h.v>0).sort((a,b)=>b.v-a.v).slice(0,6)
  return{ok:true,text:hits.length?hits.map(h=>`${line(s,h.x.i)} (categoria ${codeOf(s,h.x.s.id)} ${h.x.s.name})`).join('\n'):'nessun piatto trovato'}}
 case 'leggi_menu':{const f=plain(String(a?.filtri??''));let l=items(s.menu)
  if(/finit/.test(f))l=l.filter(x=>x.i.available===false);else if(/nascost/.test(f))l=l.filter(x=>x.i.hidden);else if(/promo/.test(f))l=l.filter(x=>x.i.promo);else if(f)l=l.filter(x=>plain(x.s.name).includes(f)||codeOf(s,x.s.id)===f)
  return{ok:true,text:l.length?l.map(x=>line(s,x.i)).join('\n'):'nessun piatto'}}
 case 'cambia_prezzo':{const e=need();if(e)return e;const p=Number(String(a.prezzo).replace(',','.'));if(!Number.isFinite(p)||p<=0)return{ok:false,text:'errore: prezzo non valido',reject:true}
  if(!priceOk(s,p,it!.i.price))return{ok:false,reject:true,text:`RIFIUTATO dal server: il prezzo ${num(p)} € non è nel testo del titolare`}
  const old=it!.i.price;it!.i.price=p;pub('prezzo');return{ok:true,write:true,text:`${it!.i.name}: ${num(old)} → ${num(p)} €`}}
 case 'nascondi':case 'mostra':{const e=need();if(e)return e;const v=name==='nascondi';if(!!it!.i.hidden===v)return{ok:true,text:`${it!.i.name}: era già ${v?'nascosto':'visibile'}`};it!.i.hidden=v;pub(name);return{ok:true,write:true,text:`${it!.i.name}: ${v?'nascosto':'visibile'}`}}
 case 'finito':case 'disponibile':{const e=need();if(e)return e;const v=name==='disponibile';if((it!.i.available!==false)===v)return{ok:true,text:`${it!.i.name}: era già ${v?'disponibile':'finito'}`};it!.i.available=v;pub(name);return{ok:true,write:true,text:`${it!.i.name}: ${v?'disponibile':'finito'}`}}
 case 'crea_piatto':{const nm=String(a?.nome??'').trim(),p=Number(String(a?.prezzo).replace(',','.'))
  if(!nm||!nameOk(s,nm))return{ok:false,reject:true,text:`RIFIUTATO dal server: il nome «${nm}» non è nel testo del titolare`}
  if(!Number.isFinite(p)||p<=0||!priceOk(s,p))return{ok:false,reject:true,text:`RIFIUTATO dal server: prezzo ${a?.prezzo} non detto dal titolare`}
  const secs=s.menu.menus.flatMap(m=>m.sections);const sec=a?.categoria!=null?section(s,String(a.categoria)):secs.length===1?secs[0]:undefined;if(!sec)return{ok:false,text:'errore: categoria mancante o inesistente'}
  if(items(s.menu).some(x=>plain(x.i.name)===plain(nm)))return{ok:false,text:`errore: esiste già un piatto «${nm}»`}
  const id=`new-${s.id}-${++s.next.p}`;s.codes['p'+s.next.p]=id;sec.items.push({id,name:nm,price:p});pub('crea');return{ok:true,write:true,text:`creato ${'p'+s.next.p} «${nm}» a ${num(p)} € in ${sec.name}`}}
 case 'elimina_piatto':{const e=need();if(e)return e;const pd=s.pending.deletes.find(d=>d.id===it!.i.id)
  if(pd&&s.cur!.pendingReject===false&&YES.test(curMsg(s))&&s.history.length>0){for(const m of s.menu.menus)for(const sec of m.sections)sec.items=sec.items.filter(x=>x.id!==it!.i.id);s.pending.deletes=s.pending.deletes.filter(d=>d!==pd);pub('elimina');return{ok:true,write:true,text:`eliminato «${it!.i.name}»`}}
  if(!pd)s.pending.deletes.push({id:it!.i.id,name:it!.i.name});s.cur!.pendingReject=true
  return{ok:true,text:`in attesa: il server elimina «${it!.i.name}» solo se il titolare risponde «sì» al prossimo messaggio. Chiedi conferma.`}}
 case 'crea_categoria':{const nm=String(a?.nome??'').trim();if(!nm||!nameOk(s,nm))return{ok:false,reject:true,text:`RIFIUTATO dal server: il nome «${nm}» non è nel testo del titolare`}
  if(s.menu.menus.flatMap(m=>m.sections).some(x=>plain(x.name)===plain(nm)))return{ok:true,text:`la categoria «${nm}» esiste già`}
  const id=`newc-${s.id}-${++s.next.c}`;s.codes['c'+s.next.c]=id;s.menu.menus[0]!.sections.push({id,name:nm,items:[]});pub('categoria');return{ok:true,write:true,text:`creata categoria c${s.next.c} «${nm}»`}}
 case 'rinomina_piatto':{const e=need();if(e)return e;const nm=String(a?.nome??'').trim();if(!nameOk(s,nm))return{ok:false,reject:true,text:`RIFIUTATO dal server: il nome «${nm}» non è nel testo del titolare`};const o=it!.i.name;it!.i.name=nm;pub('rinomina');return{ok:true,write:true,text:`«${o}» → «${nm}»`}}
 case 'rinomina_categoria':{const sec=section(s,String(a?.cat_id));if(!sec)return{ok:false,text:'errore: categoria inesistente'};const nm=String(a?.nome??'');if(!nameOk(s,nm))return{ok:false,reject:true,text:`RIFIUTATO dal server: nome non detto`};const o=sec.name;sec.name=nm;pub('rinomina cat');return{ok:true,write:true,text:`categoria «${o}» → «${nm}»`}}
 case 'sposta_piatto':{const e=need();if(e)return e;const sec=section(s,String(a?.cat_id));if(!sec)return{ok:false,text:'errore: categoria inesistente'};for(const m of s.menu.menus)for(const x of m.sections)x.items=x.items.filter(y=>y.id!==it!.i.id);sec.items.push(it!.i);pub('sposta');return{ok:true,write:true,text:`${it!.i.name} → ${sec.name}`}}
 case 'descrizione':{const e=need();if(e)return e;it!.i.description=String(a?.testo??'');pub('descrizione');return{ok:true,write:true,text:`${it!.i.name}: descrizione «${it!.i.description}»`}}
 case 'promo':{const e=need();if(e)return e;if(a?.testo==null||a.testo==='null'){it!.i.promo=null;pub('promo');return{ok:true,write:true,text:`${it!.i.name}: promo tolta`}}
  const p=Number(String(a.testo).replace(/[^\d,.]/g,'').replace(',','.'));if(!Number.isFinite(p)||p<=0||!priceOk(s,p,it!.i.price))return{ok:false,reject:true,text:`RIFIUTATO dal server: prezzo promo «${a.testo}» non detto dal titolare`}
  it!.i.promo={price:p,until:null};pub('promo');return{ok:true,write:true,text:`${it!.i.name}: promo a ${num(p)} € (prezzo pieno ${num(it!.i.price)} €)`}}
 case 'evidenza':{const e=need();if(e)return e;it!.i.featured=!!a?.on&&a.on!=='false';pub('evidenza');return{ok:true,write:true,text:`${it!.i.name}: evidenza ${it!.i.featured?'sì':'no'}`}}
 case 'piatto_del_giorno':{let target=a?.piatto_id!=null?item(s,a.piatto_id):undefined;const p=a?.prezzo!=null?Number(String(a.prezzo).replace(',','.')):null
  if(p!=null&&!priceOk(s,p,target?.i.price))return{ok:false,reject:true,text:`RIFIUTATO dal server: prezzo ${a.prezzo} non detto`}
  let sec=s.menu.menus[0]!.sections.find(x=>plain(x.name)==='piatto del giorno');if(!sec){const id=`newc-${s.id}-${++s.next.c}`;s.codes['c'+s.next.c]=id;sec={id,name:'Piatto del giorno',items:[]};s.menu.menus[0]!.sections.unshift(sec)}
  if(target){target.i.featured=true;if(p!=null)target.i.price=p;pub('giorno',true);return{ok:true,write:true,text:`piatto del giorno: ${target.i.name}${p!=null?' a '+num(p)+' €':''}`}}
  const nm=String(a?.nome??'');if(!nm||!nameOk(s,nm))return{ok:false,reject:true,text:`RIFIUTATO dal server: nome «${nm}» non detto`};if(p==null)return{ok:false,text:'errore: per un piatto del giorno nuovo serve il prezzo'}
  const id=`new-${s.id}-${++s.next.p}`;s.codes['p'+s.next.p]=id;sec.items.push({id,name:nm,price:p});pub('giorno',true);return{ok:true,write:true,text:`piatto del giorno creato: «${nm}» a ${num(p)} €`}}
 case 'annulla_ultima':{if(!s.lastPub)return{ok:false,text:'niente da annullare: nessuna pubblicazione recente'};if(s.lastPub.daily)return{ok:false,text:'il piatto del giorno non si annulla da qui'}
  const d=diff(s.lastPub.before,s.menu);s.menu=structuredClone(s.lastPub.before);s.lastPub=null;return{ok:true,write:true,text:`annullata l'ultima pubblicazione (${d.join(', ')||'nessuna differenza'})`}}
 default:return{ok:false,text:`errore: strumento sconosciuto «${name}»`}}}
function lev(a:string,b:string){const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=1;j<=b.length;j++)d[0]![j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i]![j]=Math.min(d[i-1]![j]+1,d[i]![j-1]+1,d[i-1]![j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length]![b.length]}

// ---------------------------------------------------------------- ciclo
function nextPrompt(id:string){let s=fs.existsSync(sfile(id))?load(id):init(id);const c=conv(id),ot=ownerTurns(c)
 if(s.turn>=ot.length){s.done=true;save(s);return `DONE ${id}`}
 const msg=textOf(ot[s.turn]!),p=buildPrompt(s,msg),f=path.join(RUNS,id,`t${s.turn+1}.prompt.txt`)
 fs.writeFileSync(f,p);s.cur={steps:[],rejectsThisMsg:0,writes:[],before:structuredClone(s.menu),executed:[],selfFixes:0,pendingReject:false};save(s)
 return `${id} ${path.relative(DIR,f)} ${p.length}`}
function parse(out:string){const m=out.match(/\{[\s\S]*\}/);if(!m)throw new Error('nessun JSON');const j=JSON.parse(m[0]);const calls=Array.isArray(j.chiamate)?j.chiamate:Array.isArray(j)?j:[j];return calls as {strumento:string,argomenti:any}[]}
/** Applica un'uscita di Haiku. Ritorna «SEND <testo>» (da rimandare allo stesso Haiku) o «END <risposta>». */
function step(id:string,out:string):string{const s=load(id),cur=s.cur!;const n=cur.steps.length+1,log:StepLog={step:n,input:n===1?'(prompt)':'(risultati)',output:out,executed:[],rejected:[]}
 let calls:{strumento:string,argomenti:any}[]=[];try{calls=parse(out)}catch(e){cur.steps.push(log);if(n>=6)return end(s,'Scusa, non ho capito bene: me lo riscrivi?',true);save(s);return 'SEND risultati: errore: la tua risposta non è JSON valido. Rispondi SOLO con {"chiamate":[...]}'}
 const results:string[]=[];let closing:{kind:string,text:string}|null=null,rejectNow=false,failed=false
 for(const c of calls){const nm=c?.strumento;if(nm==='chiedi'||nm==='rispondi'){const t=String(c.argomenti?.domanda??c.argomenti?.testo??'');closing={kind:closing?.kind==='chiedi'?'chiedi':nm,text:closing?closing.text+'\n'+t:t};continue}
  const r=exec(s,nm,c.argomenti??{});const tag=`${nm}(${JSON.stringify(c.argomenti??{})})`
  if(r.reject){rejectNow=true;log.rejected.push(tag);cur.rejectsThisMsg++}else if(!r.ok)failed=true
  if(r.write){cur.writes.push(r.text);log.executed.push(tag)}
  cur.executed.push(tag);results.push(`${nm}: ${r.text}`)}
 cur.steps.push(log)
 if(rejectNow&&cur.rejectsThisMsg>=2)return end(s,'Non sono sicuro di nome o prezzo: me li scrivi esattamente?',true)
 if(cur.rejectsThisMsg>0&&!rejectNow&&log.executed.length)cur.selfFixes=1
 if(closing&&!rejectNow&&!failed){return end(s,closing.text,false,closing.kind)}
 if(n>=6)return end(s,closing?.text||'Non sono riuscito a completare: me lo riscrivi?',!closing)
 if(!calls.length){save(s);return 'SEND risultati: nessuna chiamata. Chiudi con chiedi o rispondi.'}
 save(s);return 'SEND risultati:\n'+results.join('\n')+(closing?'\n(la tua risposta non è stata inviata perché uno strumento ha dato errore o rifiuto: correggi e poi rispondi)':'')}
function end(s:State,text:string,forced:boolean,kind='rispondi'){const cur=s.cur!;const facts=cur.writes.length?'\n'+cur.writes.map((w,i)=>cur.writes.length>1?`${i+1}. ${w}`:w).join('\n'):''
 const reply=(text+facts).trim(),msg=curMsg(s)
 if(kind==='chiedi'||forced)s.pending.question=text;else s.pending.question=null
 // un'eliminazione in sospeso vale solo per il turno dopo
 if(!cur.pendingReject)s.pending.deletes=[]
 s.history.push({owner:msg,bot:reply,tools:cur.writes})
 const tl:TurnLog={turn:s.turn+1,owner:msg,promptFile:`t${s.turn+1}.prompt.txt`,promptChars:fs.readFileSync(path.join(RUNS,s.id,`t${s.turn+1}.prompt.txt`),'utf8').length,steps:cur.steps,reply,menuAfter:structuredClone(s.menu),rejects:cur.rejectsThisMsg,selfFixes:cur.selfFixes,forcedQuestion:forced,question:isQuestion(reply)&&!cur.writes.length,toolCalls:cur.executed}
 s.turns.push(tl);s.turn++;s.cur=null;save(s);return 'END '+reply}
function finish(id:string){const s=load(id),c=conv(id)
 const run={turns:s.turns.map(t=>({reply:t.reply,menuAfter:t.menuAfter,latencyMs:0,llm:{calls:t.steps.length,tokens:Math.round(t.promptChars/4),misses:0,recordedMs:0}})),finalMenu:s.menu}
 const v=judge(c,s.initial,run as any);fs.writeFileSync(path.join(RUNS,id,'verdict.json'),JSON.stringify(v,null,1));return `${id} ${v.success?'OK':'KO'} ${v.fails.map(f=>f.sev+':'+f.code).join(',')}`}

const [cmd,...args]=process.argv.slice(2)
if(cmd==='next')for(const id of args)console.log(nextPrompt(id))
else if(cmd==='step'){const r=step(args[0]!,args[1]!.startsWith('{')?args[1]!:fs.readFileSync(args[1]!,'utf8'));console.log(r);if(r.startsWith('END')){const n=nextPrompt(args[0]!);console.log('NEXT '+n);if(n.startsWith('DONE'))console.log(finish(args[0]!))}}
else if(cmd==='many'){const raw=fs.readFileSync(args[0]!,'utf8');for(const blk of raw.split(/^### /m).filter(x=>x.trim())){const nl=blk.indexOf('\n'),id=blk.slice(0,nl).trim(),out=blk.slice(nl+1);const r=step(id,out);console.log('## '+id+'\n'+r);if(r.startsWith('END')){const n=nextPrompt(id);console.log('NEXT '+n);if(n.startsWith('DONE'))console.log('VERDICT '+finish(id))}}}
else if(cmd==='srv'){// canale del modello: legge l'uscita JSON da stdin, stampa solo i risultati (o «risposta inviata»)
 const s0=load(args[0]!);if(!s0.cur){console.log('nessun messaggio in corso: hai finito.');process.exit(0)}
 const r=step(args[0]!,fs.readFileSync(args[1]??0,'utf8'))
 if(r.startsWith('END')){console.log('OK: turno chiuso, risposta inviata al titolare. Hai finito: scrivi solo FINE.');const n=nextPrompt(args[0]!);if(n.startsWith('DONE'))finish(args[0]!)}
 else console.log(r.replace(/^SEND /,''))}
else if(cmd==='todo'){// lista (e marca come lanciati) i messaggi pronti per un Haiku nuovo; max N
 const ids=fs.readFileSync(args[0]!,'utf8').split('\n').map(x=>x.trim()).filter(Boolean),max=Number(args[1]??10);let k=0,open=0
 for(const id of ids){if(k>=max)break;if(!fs.existsSync(sfile(id)))nextPrompt(id);const s=load(id);if(s.done)continue;if(!s.cur){const n=nextPrompt(id);if(n.startsWith('DONE')){finish(id);continue}}
  const t=load(id);if((t.cur as any).launched){open++;continue};(t.cur as any).launched=Date.now();save(t);console.log(`${id} t${t.turn+1}`);k++}
 console.log(`# in corso ${open}, nuovi ${k}`)}
else if(cmd==='fails'){let ok=0,n=0;for(const d of fs.readdirSync(RUNS)){const f=path.join(RUNS,d,'verdict.json');if(!fs.existsSync(f))continue;const v=JSON.parse(fs.readFileSync(f,'utf8'));n++;if(v.success)ok++;else console.log(v.id,v.fails.filter((x:any)=>x.sev!=='BASSO').map((x:any)=>x.sev+' '+x.code+': '+x.why.slice(0,110)).join(' | '))}console.log(`# ${ok}/${n}`)}
else if(cmd==='notesrc'){// materiale per la «nota del locale»: le conversazioni chiuse di quel locale + la nota attuale
 const [loc,wave]=args;const ids=fs.readFileSync(wave!,'utf8').split('\n').filter(Boolean);const parts:string[]=[]
 for(const id of ids){if(!fs.existsSync(sfile(id)))continue;const s=load(id);if(s.locale!==loc||!s.done)continue;parts.push(`--- conversazione ${id}\n`+s.turns.map(t=>`titolare: ${t.owner}\nbot: ${t.reply}`).join('\n'))}
 const prompt=`Sei il modulo «memoria» dell'assistente WhatsApp del titolare del locale (${loc}). Qui sotto: la nota attuale e le conversazioni di oggi.\nScrivi la NUOVA nota del locale: «cosa ho imparato su come scrive questo titolare?». Al massimo 500 token, solo significati (soprannomi e storpiature dei piatti → nome vero nel menu, modi di dire e cosa vogliono dire, abitudini: es. «togli» = nascondi, conferme che usa). Niente prezzi, niente stato del menu, niente istruzioni nuove al bot, niente cose non viste nelle conversazioni.\n\nNOTA ATTUALE: ${notes()[loc]||'(vuota)'}\n\nCONVERSAZIONI:\n${parts.join('\n')}`
 const f=path.join(RUNS,`notesrc-${loc}.txt`);fs.writeFileSync(f,prompt);console.log(f,parts.length,prompt.length)}
else if(cmd==='setnote'){const n=notes();n[args[0]!]=fs.readFileSync(args[1]!,'utf8').trim();fs.writeFileSync(notesFile,JSON.stringify(n,null,1));console.log('ok',n[args[0]!]!.length)}
else if(cmd==='report'){const wave=(f:string)=>new Set(fs.readFileSync(path.join(DIR,f),'utf8').split('\n').filter(Boolean)),A=wave('waveA.txt')
 const rows:any[]=[];for(const c of ALL){if(!fs.existsSync(path.join(RUNS,c.id,'verdict.json')))continue;const s=load(c.id),v=JSON.parse(fs.readFileSync(path.join(RUNS,c.id,'verdict.json'),'utf8'))
  const fon=/kenesac|\bbo\b|\bbu\b|passa il rag|toiibo|tunnu|pontarelle|sarte|babb|carbonare|inserisce il piatto/i.test(ownerTurns(c).map(textOf).join(' '))
  rows.push({id:c.id,family:c.family,source:c.id.startsWith('x-')?'nuove':'banco-vero',wave:A.has(c.id)?'A (nota vuota)':'B (con nota)',turns:s.turns.length,simple:s.turns.length===1,success:v.success,
   fails:v.fails.filter((f:any)=>f.sev!=='BASSO').map((f:any)=>({sev:f.sev,code:f.code,why:f.why})),steps:s.turns.map(t=>t.steps.length),rejects:s.turns.reduce((a,t)=>a+t.rejects,0),selfFixes:s.turns.reduce((a,t)=>a+t.selfFixes,0),forced:s.turns.filter(t=>t.forcedQuestion).length,
   questions:s.turns.filter(t=>t.question).length,promptTokens:s.turns.map(t=>Math.round(t.promptChars/4)),cerca:s.turns.some(t=>t.toolCalls.some(x=>x.startsWith('cerca_piatti'))),phonetic:fon,replies:s.turns.map(t=>t.reply),owner:s.turns.map(t=>t.owner),diff:diff(s.initial,s.menu)})}
 const agg=(rs:any[])=>{const msgs=rs.reduce((a,r)=>a+r.turns,0),steps=rs.flatMap(r=>r.steps),tok=rs.flatMap(r=>r.promptTokens);return{conversazioni:rs.length,ok:rs.filter(r=>r.success).length,grav:rs.filter(r=>r.fails.some((f:any)=>f.sev==='GRAVE')).length,medi:rs.filter(r=>!r.fails.some((f:any)=>f.sev==='GRAVE')&&r.fails.some((f:any)=>f.sev==='MEDIO')).length,messaggi:msgs,
  passiMedi:+(steps.reduce((a,b)=>a+b,0)/Math.max(1,steps.length)).toFixed(2),passiMax:Math.max(0,...steps),respinti:rs.reduce((a,r)=>a+r.rejects,0),autocorrezioni:rs.reduce((a,r)=>a+r.selfFixes,0),domandeForzate:rs.reduce((a,r)=>a+r.forced,0),
  domandeOgni10:+(10*rs.reduce((a,r)=>a+r.questions,0)/Math.max(1,msgs)).toFixed(2),tokenIngressoMedio:Math.round(tok.reduce((a,b)=>a+b,0)/Math.max(1,tok.length)),tokenIngressoMax:Math.max(0,...tok)}}
 const by=(k:string)=>Object.fromEntries([...new Set(rows.map(r=>r[k]))].map(v=>[String(v),agg(rows.filter(r=>r[k]===v))]))
 const codes:Record<string,number>={};for(const r of rows)for(const f of r.fails)codes[f.sev+' '+f.code]=(codes[f.sev+' '+f.code]??0)+1
 const out={generato:new Date().toISOString(),totale:agg(rows),bancoVero:agg(rows.filter(r=>r.source==='banco-vero')),nuove:agg(rows.filter(r=>r.source==='nuove')),semplici:agg(rows.filter(r=>r.simple)),multiTurno:agg(rows.filter(r=>!r.simple)),perOndata:by('wave'),perFamiglia:by('family'),codici:codes,
  fonetici:rows.filter(r=>r.phonetic).map(r=>({id:r.id,messaggi:r.owner,cercaPiatti:r.cerca,ok:r.success,diff:r.diff})),conversazioni:rows}
 fs.writeFileSync(path.join(DIR,'risultati.json'),JSON.stringify(out,null,1));const {conversazioni,...short}=out;console.log(JSON.stringify(short,null,1))}
else if(cmd==='status'){for(const id of args){const s=fs.existsSync(sfile(id))?load(id):null;console.log(`${id} ${!s?'new':s.done?'DONE':s.cur?`t${s.turn+1} step${s.cur.steps.length}`:'idle'}`)}}
else if(cmd==='finish')for(const id of args)console.log(finish(id))
else if(cmd==='ids')console.log(ALL.map(c=>`${c.id}\t${c.menu}\t${ownerTurns(c).length}`).join('\n'))
else if(cmd==='transcript'){const s=load(args[0]!);console.log(s.turns.map(t=>`T: ${t.owner}\nB: ${t.reply}`).join('\n')+`\nDIFF: ${diff(s.initial,s.menu).join(', ')}`)}
else if(cmd==='reset')for(const id of args)fs.rmSync(path.join(RUNS,id),{recursive:true,force:true})
