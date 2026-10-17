// Verifica avversaria del bot WhatsApp del TITOLARE — QUINTO GIRO TER (17/10/2026, falsi positivi e regressioni delle regole nuove): i 4 bug del collaudo WhatsApp reale
// sul QA (prezzi alternativi «13 o 14?», clausole negate «non cambiare boh; …», risposta a «Quale piatto intendi?» che perdeva
// l'operazione, nome del piatto nuovo «Piatto test QA» diventato «Test QA») e tutta la loro famiglia, più le domande che non scrivono.
// Webhook firmato vero (router + NLU + validatori veri), DB e documento menu in memoria, Groq/Whisper/Twilio finti, orologio fisso.
// Ogni caso gira con un modello «ideale» e, quando passa dall'IA, anche con modelli che rispondono male
// (JSON vuoto, azione su un piatto sbagliato, creazione inventata). Nessuna rete, nessun DB reale, nessun deploy.
// Risultati: docs/webapp/owner-bot-verify-2026-10-16/results-round5c.json (scritto a fine run).
import {createRequire} from 'node:module'
import {writeFileSync,mkdirSync} from 'node:fs'
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest'
// Orologio fissato (17/10): il risultato non dipende dall'ora del run (alle 3 di notte «oggi» è ancora la giornata di ieri).
// Venerdì 16/10/2026 alle 12:00 di Roma, come la validazione del 16/10. TAKO_TEST_NOW=<ISO> per provare un altro istante.
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z'))})
import {twilioSignature} from '../apps/server/src/lib/twilio-menu-command.js'
import {copy} from '../apps/server/src/lib/twilio-menu-copy.js'
import {setTranslationEnqueue} from '../apps/server/src/lib/menu-translation-queue.js'
import {setMenuPresetTarget} from '../apps/server/src/lib/menu-preset-target.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'

const S=vi.hoisted(()=>({draft:null as any,published:null as any,revision:5,published_revision:5,proposals:new Map<string,{revision:number,command:any}>(),messages:new Map<string,string>(),links:new Set<string>(),unknownSql:[] as string[],versions:[] as {tenant:string,revision:number,label:string,snapshot:any}[],offset:0,B:{draft:null as any,published:null as any,revision:5,published_revision:5}}))
vi.mock('../apps/server/src/lib/onboarding-chat.js',()=>({expiredOnboardingNotice:async()=>null,startsOnboarding:()=>false,onboardingTransport:async()=>null,queueOnboardingChat:async()=>false}))
const tenant='26050ecd-2e55-4057-a4c5-bff2b449cd47',tenantB='36050ecd-2e55-4057-a4c5-bff2b449cd48',actor='44444444-4444-4444-8444-444444444444',actorB='54444444-4444-4444-8444-444444444445',phone='whatsapp:+390000000077',phoneB='whatsapp:+390000000078'
const nowMs=()=>Date.now()
const parse=(q:any)=>{let text='';const params:unknown[]=[];for(const c of q.queryChunks)if(c&&typeof c==='object'&&Array.isArray(c.value))text+=c.value.join('');else{text+='$';params.push(c)}return{text,params}}
const live=(ph:string)=>{const x:any=S.proposals.get(ph);return x&&(x.exp===undefined||x.exp>Date.now())?x:undefined}
const execute=async(q:unknown):Promise<any[]>=>{const {text,params}=parse(q),p=params as any[]
 if(text.startsWith('SELECT 1 FROM tako_whatsapp_links'))return S.links.has(p[0])?[{}]:[]
 if(text.startsWith('SELECT restaurant_id,actor_id,activated_at FROM tako_whatsapp_links'))return S.links.has(p[0])?[{restaurant_id:p[0]===phoneB?tenantB:tenant,actor_id:p[0]===phoneB?actorB:actor,activated_at:new Date()}]:[]
 if(text.includes('FROM users u'))return[{id:p[1],restaurant_id:p[0],role:'owner',active:true}]
 if(text.includes('pg_advisory_xact_lock'))return[]
 if(text.startsWith('SELECT response FROM tako_whatsapp_messages'))return S.messages.has(p[0])?[{response:S.messages.get(p[0])}]:[]
 if(text.startsWith('INSERT INTO tako_whatsapp_messages')){if(!S.messages.has(p[0]))S.messages.set(p[0],p[1]);return[]}
 if(text.startsWith('UPDATE tako_whatsapp_messages')){S.messages.set(p[1],p[0]);return[]}
 if(text.startsWith('SELECT settings FROM restaurants'))return[{settings:{timezone:'Europe/Rome'}}]
 if(text.startsWith('SELECT name FROM restaurants'))return[{name:'Trattoria Da Mario'}]
 if(text.startsWith('DELETE FROM tako_whatsapp_proposals')){S.proposals.delete(p[0]);return[]}
 if(text.startsWith('SELECT 1 FROM tako_whatsapp_proposals'))return live(p[0])?[{}]:[]
 if(text.startsWith('SELECT command,revision FROM tako_whatsapp_proposals')){const x=live(p[0]);return x?[structuredClone(x)]:[]}
 if(text.startsWith('SELECT command FROM tako_whatsapp_proposals')){const x=live(p[0]);return x?[{command:structuredClone(x.command)}]:[]}
 if(text.startsWith('UPDATE tako_whatsapp_proposals SET command')){const x=S.proposals.get(p[1]);if(x)x.command=JSON.parse(p[0]);return[]}
 if(text.startsWith('INSERT INTO tako_whatsapp_proposals')){const mins=Number(text.match(/interval '(\d+) minutes'/)?.[1]??10);S.proposals.set(p[0],{revision:p[3],command:JSON.parse(p[4]),exp:Date.now()+mins*60000} as any);return[]}
 if(text.startsWith('SELECT revision,label,snapshot FROM menu_workspace_versions')){const pre=[String(p[1]).replace('%',''),String(p[2]).replace('%','')];return S.versions.filter(v=>v.tenant===p[0]&&pre.some(x=>v.label.startsWith(x))).sort((a,b)=>b.revision-a.revision).slice(0,1).map(v=>structuredClone(v))}
 if(text.startsWith('INSERT INTO tako_whatsapp_ai_usage'))return[{requests:1,prompt_tokens:0,completion_tokens:0,audio_seconds:0,warned_at:null}]
 if(text.startsWith('INSERT INTO tako_whatsapp_errors'))return[{id:1}]
 if(text.startsWith('SELECT count(*)::int AS n FROM tako_whatsapp_errors'))return[{n:0}]
 if(text.startsWith('INSERT INTO tako_whatsapp_alerts'))return[]
 S.unknownSql.push(text.slice(0,90));return[]}
vi.mock('../packages/db/src/index.ts',()=>({db:{execute:(q:unknown)=>execute(q),transaction:(fn:any)=>fn({execute})},sessions:{},users:{}}))
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',()=>({
 readWorkspace:async(t:string)=>{const X:any=t==='36050ecd-2e55-4057-a4c5-bff2b449cd48'?S.B:S;return{draft:structuredClone(X.draft),published:structuredClone(X.published),revision:X.revision,published_revision:X.published_revision}},
 mutateWorkspace:async(t:string,_a:string,expected:number,w:any,publish:boolean,label='')=>{S.versions.push({tenant:t,revision:(t==='36050ecd-2e55-4057-a4c5-bff2b449cd48'?S.B:S).revision+1,label,snapshot:structuredClone(publish?(t==='36050ecd-2e55-4057-a4c5-bff2b449cd48'?S.B:S).draft:w)});const X:any=t==='36050ecd-2e55-4057-a4c5-bff2b449cd48'?S.B:S;if(expected!==X.revision)throw new Error('Revision conflict');if(publish)X.published=structuredClone(X.draft);else X.draft=structuredClone(w);X.revision++;if(publish)X.published_revision=X.revision;return{revision:X.revision}}}))
import {twilioMenuRoutes} from '../apps/server/src/routes/twilio-menu.js'
const Fastify=createRequire(new URL('../apps/server/package.json',import.meta.url))('fastify')

// ---------------- Fixture: trattoria con Pranzo, Cena, Bevande ----------------
const PRANZO='66666666-6666-4666-8666-000000000001',CENA='66666666-6666-4666-8666-000000000002',BEV='66666666-6666-4666-8666-000000000003'
const sid8=(n:number)=>`77777777-7777-4777-8777-${String(n).padStart(12,'0')}`,iid=(n:number)=>`55555555-5555-4555-8555-${String(n).padStart(12,'0')}`
const SECTIONS:[number,string,string][]=[[1,PRANZO,'Antipasti'],[2,PRANZO,'Primi'],[3,PRANZO,'Secondi'],[4,PRANZO,'Piatti di prova'],[5,CENA,'Pizze'],[6,CENA,'Dolci'],[7,BEV,'Bibite'],[8,BEV,'Caffetteria'],[9,PRANZO,'Offerte'],[10,CENA,'Proposte'],[11,BEV,'Vini'],[12,PRANZO,'Contorni']]
const ITEMS:[number,number,string,number][]=[
 [1,1,'Bruschetta al pomodoro',5],[2,1,'Tagliere misto',14],
 [3,2,'Spaghetti alla carbonara',12],[4,2,'Pasta e fagioli',9],[5,2,'Spaghetti aglio olio e peperoncino',8],[6,2,'Lasagna al forno',11],[7,2,'Gnocchi 4 formaggi',10],
 [8,3,'Tagliata di manzo',18],[9,3,'Cotoletta alla milanese',15],[10,3,'Menù del giorno',15],
 [11,4,'Piatto di prova',10],
 [12,5,'Margherita',7],[13,5,'Pizza 4 formaggi',9],[14,5,'Diavola',8.5],[15,5,'Capricciosa',9.5],
 [16,6,'Tiramisù',5],[17,6,'Panna cotta',5],
 [18,7,'Acqua 0,5 l',1.5],[19,7,'Coca Cola 33cl',3],[20,7,'Birra media',5],
 [21,8,'Caffè',1.2],[22,8,'Cappuccino',1.8],
 [23,9,'Offerta pranzo',10],[24,9,'Menù bambini',8],[25,2,'Pasta del giorno',9],[26,10,'Nuovo burger',12],[27,10,'Burger classico',10],[28,10,'Menù degustazione',30],[29,6,'Dolce del giorno',4],[30,9,'Coperto',1],[31,11,'Bottiglia di Brunello',45],[32,12,'Patate al forno',4],[33,12,'Insalata mista',4],[34,5,'Margherita con bufala',9],[35,9,'Menù della domenica',22],[36,5,'Pizza del lunedì',7],[37,3,'Grigliata del venerdì',18],[38,5,'Pizza mezzo metro',18],[39,11,'Mezzo litro di vino',6],[40,9,'Mezza porzione bimbi',6],
 // Piatti del locale QA «Tako · Verifica web» (stato del collaudo 17/10)
 [41,4,'Piatto di verifica',13.5],[42,4,'Che ne sacc',20],[43,4,'boh',20],[44,4,'pasta al ragù',12]]
const ID:Record<string,string>=Object.fromEntries(ITEMS.map(([n,,name])=>[name,iid(n)]))
const SEC:Record<string,string>=Object.fromEntries(SECTIONS.map(([n,,name])=>[name,sid8(n)]))
type Mods={unavail?:string[],hidden?:string[],featured?:string[],tags?:Record<string,string[]>,promo?:Record<string,number>,last?:string[],today?:string[],prices?:Record<string,number>}
const todayIso=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(new Date())
// Come il QA: «Che ne sacc» e «boh» in promo (15 e 10 €) e con le ultime porzioni.
const QA_MODS:Mods={promo:{'Che ne sacc':15,boh:10},last:['Che ne sacc','boh']}
function fixture(m0:Mods={}){const m:Mods={...m0,promo:{...QA_MODS.promo,...m0.promo},last:[...QA_MODS.last!,...(m0.last??[])]}
 const menus=[[PRANZO,'Pranzo','lunch'],[CENA,'Cena','dinner'],[BEV,'Bevande','drinks']].map(([id,name,type])=>({id,name,type,sections:SECTIONS.filter(s=>s[1]===id).map(([n,,sname])=>({id:sid8(n),name:sname,items:ITEMS.filter(i=>i[1]===n).map(([k,,iname,price])=>{const it:any={id:iid(k),name:iname,price:m.prices?.[iname]??price}
  if(m.unavail?.includes(iname))it.available=false;if(m.hidden?.includes(iname))it.hidden=true;if(m.featured?.includes(iname))it.featured=true;if(m.tags?.[iname])it.tags=m.tags[iname]
  if(m.promo?.[iname]!==undefined)it.promo={price:m.promo[iname],until:null};if(m.last?.includes(iname)||m.today?.includes(iname))it.scarcity={lastPortions:!!m.last?.includes(iname),onlyToday:m.today?.includes(iname)?todayIso:null};return it})}))}))
 return workspaceSchema.parse({menus,design:{}})}

// ---------------- Rete finta: Groq (chat + whisper) e Twilio ----------------
type AiMode='ideal'|'empty'|'wrong'|'wrongCreate'
const net={msgNow:'',mode:'ideal' as AiMode,caseNow:null as any,chats:0,transcript:'',sent:[] as string[]}
const plainT=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const realFetch=globalThis.fetch
const okJson=(content:any)=>new Response(JSON.stringify({choices:[{message:{content:typeof content==='string'?content:JSON.stringify(content)}}],usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20}}),{status:200,headers:{'Content-Type':'application/json'}})
vi.stubGlobal('fetch',async(url:any,init:any)=>{const u=String(url)
 if(u.includes('/chat/completions')){net.chats++;const body=JSON.parse(init.body),system=String(body.messages[0]?.content??''),user=String(body.messages[1]?.content??'')
  let source:string|null=null;try{source=JSON.parse(user).source??null}catch{}
  if(source!==null)return okJson(net.mode==='ideal'&&net.caseNow?.fullRows?{rows:net.caseNow.fullRows.filter((r:any)=>source!.toLowerCase().includes(r.name.toLowerCase())).map((r:any)=>({section:r.section,name:r.name,price:r.price,description:'',evidence:source!.slice(source!.toLowerCase().indexOf(r.name.toLowerCase())).match(/^[^,.;\n]+/)![0]})),issues:[]}:{rows:[],issues:[]})
  const message=(user.split(/\n(?:MESSAGGIO|NOME INDICATO)\n/)[1]??'').trim(),hasSections=user.startsWith('CATEGORIE'),pending=system.includes('ESISTE UNA PROPOSTA')
  return okJson(modelReply(net.mode,net.caseNow,message,hasSections,pending,system.includes('Il ristoratore ha mandato una foto')))}
 if(u.includes('/audio/transcriptions'))return new Response(JSON.stringify({text:net.transcript,duration:5}),{status:200,headers:{'Content-Type':'application/json'}})
 if(u.endsWith('/Messages.json')){net.sent.push(new URLSearchParams(String(init.body)).get('Body')!);return new Response('{}',{status:201,headers:{'Content-Type':'application/json'}})}
 if(u.includes('/Media/'))return new Response(new Uint8Array([79,103,103,83]),{status:200,headers:{'Content-Type':'audio/ogg'}})
 return realFetch(url,init)})

// ---------------- Casi ----------------
type Change={op:'create',name:string,price:number,section?:string}|{op:'price',dish:string,price:number}|{op:'available'|'hidden'|'featured'|'last'|'today',dish:string,value:boolean}|{op:'description',dish:string,text:string}|{op:'tag',dish:string,tag:string,value:boolean}|{op:'promo',dish:string,price:number|null}|{op:'until',dish:string,date:string|null}|{op:'special',name:string,price:number}
type Turn=string|{v:string}|{b:string}|{wait:number}|{dash:true|[string,string,any]}
type Case={id:string,cat:string,turns:Turn[],changes:Change[],anyWithReply?:RegExp,alt?:Change[][],changesB?:Change[],mustConfirm?:boolean,reply?:RegExp,mods?:Mods,ai?:(msg:string,hasSections:boolean,pending:boolean)=>any,relative?:boolean,fullRows?:{section:string,name:string,price:number}[],note?:string}
const C:Case[]=[]
const add=(cat:string,turns:Turn|Turn[],changes:Change[]|Change,extra:Partial<Case>={})=>C.push({id:`${cat}-${String(C.filter(c=>c.cat===cat).length+1).padStart(2,'0')}`,cat,turns:Array.isArray(turns)?turns:[turns],changes:Array.isArray(changes)?changes:[changes],...extra})
const CR=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const P=(dish:string,price:number):Change=>({op:'price',dish,price})
const AV=(dish:string,value:boolean):Change=>({op:'available',dish,value}),HI=(dish:string,value:boolean):Change=>({op:'hidden',dish,value}),FE=(dish:string,value:boolean):Change=>({op:'featured',dish,value})
const DE=(dish:string,text:string):Change=>({op:'description',dish,text}),TG=(dish:string,tag:string,value=true):Change=>({op:'tag',dish,tag,value})
const PR=(dish:string,price:number|null):Change=>({op:'promo',dish,price}),PRu=(dish:string,price:number,date:string):Change[]=>[{op:'promo',dish,price},{op:'until',dish,date}],LP=(dish:string,value:boolean):Change=>({op:'last',dish,value}),OT=(dish:string,value:boolean):Change=>({op:'today',dish,value}),SP=(name:string,price:number):Change=>({op:'special',name,price})
const V=(s:string)=>({v:s})
const NONE:Change[]=[]
// ===== QUINTO GIRO TER (17/10/2026): FALSI POSITIVI e REGRESSIONI delle regole nuove (verificatore indipendente, terzo giro) =====
// Frasi normali di ristoratori che le regole deterministiche (prezzi alternativi, clausole negate, risposte ai chiarimenti,
// nome da solo = lettura, nome nuovo preservato) rischiano di leggere male. Nessuna frase ripresa da round5/round5b.
const W=(m:number)=>({wait:m})
const ASK=/quale prezzo|un solo prezzo|rispondi|due prezzi/i,ASKD=/Quale piatto|1\.|numero/i,BAD=/non è tra|Riscrivimi/i
const dateOf=(m:number,d:number)=>{const y=Number(todayIso.slice(0,4));const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return iso<todayIso?`${y+1}${iso.slice(4)}`:iso}
void W;void ASKD;void BAD
const R4T='la carbonara a 13, la lasagna a 12, la tagliata a 20 e la cotoletta a 16'
const R4=[P('Spaghetti alla carbonara',13),P('Lasagna al forno',12),P('Tagliata di manzo',20),P('Cotoletta alla milanese',16)]

// A) Numeri che NON sono prezzi alternativi (date, orari, persone, pezzi, porzioni) e correzioni
add('altfp','metti la carbonara in promo a 10 fino al 25-10',PRu('Spaghetti alla carbonara',10,dateOf(10,25)))
add('altfp','promo carbonara a 10 fino al 25.10',PRu('Spaghetti alla carbonara',10,dateOf(10,25)),{note:'discutibile: data col punto'})
add('altfp','birra media in promo a 4, happy hour 18-20',PR('Birra media',4),{note:'18-20 è un orario'})
add('altfp','offerta pranzo a 11, valida 12-15',P('Offerta pranzo',11),{note:'discutibile: 12-15 orario del pranzo'})
add('altfp','menù bambini a 9 per bimbi 3-10',P('Menù bambini',9),{note:'3-10 sono anni'})
add('altfp','cotoletta: ultime 4 o 5',LP('Cotoletta alla milanese',true),{note:'4 o 5 pezzi rimasti, non prezzi'})
add('altfp','pizza mezzo metro a 20, basta per 2 o 3',P('Pizza mezzo metro',20))
add('altfp','tagliere misto per 2 o 3 a 16',P('Tagliere misto',16))
add('altfp','metti la lasagna nelle ultime porzioni, ne restano cinque o sei',LP('Lasagna al forno',true))
add('altfp','ultime 2 o 3 porzioni di tiramisù',LP('Tiramisù',true))
add('altfp',V('ultime due o tre porzioni di panna cotta'),LP('Panna cotta',true))
add('altfp','la tagliata per 1 o 2 persone a 20',P('Tagliata di manzo',20))
add('altfp','la carbonara a 13, o meglio 14',P('Spaghetti alla carbonara',14),{note:'autocorrezione nella stessa frase'})
add('altfp','carbonara 13... anzi 14',P('Spaghetti alla carbonara',14))
add('altfp','la carbonara a 13? no, a 14',P('Spaghetti alla carbonara',14),{note:'discutibile: autocorrezione dopo il punto di domanda'})
add('altfp','il caffè passa da 1,20 a 1,30',P('Caffè',1.3))
add('altfp','la cotoletta da 15 a 16',P('Cotoletta alla milanese',16))
add('altfp','tagliata a 20, tra 10 e 15 giorni la ritocco',P('Tagliata di manzo',20))
add('altfp','descrizione del tagliere misto: ideale per 2 o 3',DE('Tagliere misto','ideale per 2 o 3'),{note:'discutibile: testo della descrizione'})
add('altfp','mezza porzione bimbi a 7, per bimbi di 3 o 4 anni',P('Mezza porzione bimbi',7))
add('altfp','il menù degustazione a 35 per 2 o 3 portate',P('Menù degustazione',35))
add('altfp','coca cola 33cl a 3,50 e acqua 0,5 l a 2',[P('Coca Cola 33cl',3.5),P('Acqua 0,5 l',2)])
add('altfp','la diavola in promo a 7 dalle 19-23',PR('Diavola',7),{note:'discutibile: fascia oraria non rappresentabile'})
add('altfp','bruschetta al pomodoro 5 o 6 pezzi a 6',P('Bruschetta al pomodoro',6))
add('altfp','bruschetta al pomodoro 4 o 5 fette a 6',P('Bruschetta al pomodoro',6))
add('altfp',V('la diavola in promo a sette euro fino al venticinque ottobre'),PRu('Diavola',7,dateOf(10,25)),{note:'discutibile: il modello finto passa la data in lettere'})
add('altfp','coperto 2 o 2,50?',NONE,{reply:ASK,note:'controllo: questa è davvero un\'alternativa'})
// risposte alla domanda sul prezzo
add('altrisp',['carbonara 13 o 14?','no scusa 14'],P('Spaghetti alla carbonara',14))
add('altrisp',['carbonara 13 o 14?','14 grazie'],P('Spaghetti alla carbonara',14))
add('altrisp',['carbonara 13 o 14?','facciamo 14 dai'],P('Spaghetti alla carbonara',14))
add('altrisp',['carbonara 13 o 14?','13,50'],NONE,{reply:/rispondi/i,note:'discutibile, in conflitto con round5b altrisp-06 (atteso: nessuna scrittura). Scelta conservativa del giro 3: un prezzo fuori dalle due opzioni non si applica, il bot ripete la domanda. Da confermare con Manuel.'})
add('altrisp',['carbonara 13 o 14?','lascia stare'],NONE)
add('altrisp',['la lasagna 12 o 13?','il primo'],P('Lasagna al forno',12))
add('altrisp',['carbonara 13 o 14?','tutti e due'],NONE,{reply:ASK})
add('altrisp',['gnocchi 4 formaggi 11 o 12','12'],P('Gnocchi 4 formaggi',12))
add('altrisp',['pizza 4 formaggi 10 o 11?','4'],NONE,{reply:ASK,note:'«4» non è uno dei due prezzi (e non è il 4 del nome)'})

// B) Negazioni che NON escludono un piatto
add('negfp',"non c'è più la carbonara",AV('Spaghetti alla carbonara',false))
add('negfp',"la carbonara non c'è più",AV('Spaghetti alla carbonara',false))
add('negfp','la carbonara non è più disponibile',AV('Spaghetti alla carbonara',false))
add('negfp','non abbiamo più il tiramisù',AV('Tiramisù',false))
add('negfp','non ho capito',NONE)
add('negfp','boh non è più in promo',PR('boh',null))
add('negfp','che ne sacc non è più in promo',PR('Che ne sacc',null))
add('negfp','non mettere più in evidenza la tagliata',FE('Tagliata di manzo',false),{mods:{featured:['Tagliata di manzo']}})
add('negfp','non nascondere più la panna cotta',HI('Panna cotta',false),{mods:{hidden:['Panna cotta']}})
add('negfp','non segnare più la carbonara come finita',AV('Spaghetti alla carbonara',true),{mods:{unavail:['Spaghetti alla carbonara']}})
add('negfp','non togliere la promo a boh, togli quella di che ne sacc',PR('Che ne sacc',null))
add('negfp','la carbonara non costa più 12, ora costa 13',P('Spaghetti alla carbonara',13))
add('negfp','la lasagna non è più finita',AV('Lasagna al forno',true),{mods:{unavail:['Lasagna al forno']}})
add('negfp','niente più lasagna per oggi, è finita',AV('Lasagna al forno',false))
add('negfp','a parte la carbonara è finita anche la lasagna',[AV('Spaghetti alla carbonara',false),AV('Lasagna al forno',false)],{note:'discutibile: «a parte» = oltre a'})
add('negfp','oltre alla carbonara è finita anche la lasagna',[AV('Spaghetti alla carbonara',false),AV('Lasagna al forno',false)])
add('negfp',"la carbonara resta così, ma è finita",AV('Spaghetti alla carbonara',false),{note:'discutibile: «resta così» riferito al prezzo'})
add('negfp','la carbonara la lasciamo in promo a 10',PR('Spaghetti alla carbonara',10))
add('negfp','il tiramisù lo lascio a 5 e la panna cotta a 6',P('Panna cotta',6))
add('negfp','la carbonara resta disponibile, la lasagna è finita',AV('Lasagna al forno',false))
add('negfp',"la tagliata resta in evidenza, togli la cotoletta dall'evidenza",FE('Cotoletta alla milanese',false),{mods:{featured:['Tagliata di manzo','Cotoletta alla milanese']}})
add('negfp','il menù del giorno a 16, escluso il caffè',P('Menù del giorno',16))
add('negfp','offerta pranzo a 12 escluse le bevande',P('Offerta pranzo',12))
add('negfp',['la carbonara a 13','lascia stare, ho sbagliato'],NONE,{note:'annulla l\'ultima modifica'})
add('negfp',['la carbonara a 13','no scusa a 14'],P('Spaghetti alla carbonara',14))
add('negfp',['la carbonara a 13','no, la lasagna'],P('Lasagna al forno',13),{note:'discutibile: correzione del piatto, la carbonara torna a 12'})
add('negfp','no no la lasagna è finita, non la carbonara',AV('Lasagna al forno',false))
add('negfp',"non è la carbonara che è finita, è la lasagna",AV('Lasagna al forno',false))
add('negfp','boh, mettiamo la carbonara a 13',P('Spaghetti alla carbonara',13),{note:'«boh» intercalare, non il piatto'})
add('negfp',V('boh, mettiamo la panna cotta a sei'),P('Panna cotta',6))
add('negfp','e che ne so, la lasagna è finita',AV('Lasagna al forno',false))
add('negfp','che ne sacc è finito',[AV('Che ne sacc',false),LP('Che ne sacc',false)])
add('negfp','ma no, la carbonara costa 13',P('Spaghetti alla carbonara',13))
add('negfp','no, il tiramisù è finito',AV('Tiramisù',false))
add('negfp','nessuna modifica alla lasagna, la carbonara è finita',AV('Spaghetti alla carbonara',false))
add('negfp',['gli spaghetti sono finiti','la carbonara no'],AV('Spaghetti aglio olio e peperoncino',false),{note:'discutibile: «la carbonara no» = l\'altro'})
add('negfp','togli il piccante dalla diavola, gli spaghetti aglio olio no',TG('Diavola','piccante',false),{mods:{tags:{Diavola:['piccante'],'Spaghetti aglio olio e peperoncino':['piccante']}}})
add('negfp','la lasagna no, è finita la carbonara',AV('Spaghetti alla carbonara',false))
add('negfp','non lo so, la carbonara mettila a 13',P('Spaghetti alla carbonara',13))
add('negfp','lasagna no 🙅, carbonara 13',P('Spaghetti alla carbonara',13))
add('negfp','cabonara a 13 , lasgna no',P('Spaghetti alla carbonara',13),{note:'refusi'})
add('negfp','nn toccare la lasagan, carbonara 13',P('Spaghetti alla carbonara',13),{note:'refusi'})
add('negfp','🍝 carbonara 13 👍',P('Spaghetti alla carbonara',13))
add('negfp','tiramisù finito 😭',AV('Tiramisù',false))

// C) «tranne/eccetto/a parte» nei comandi su gruppi
add('tranne','tutti i dolci sono finiti tranne il tiramisù',[AV('Panna cotta',false),AV('Dolce del giorno',false)])
add('tranne','togli il piccante da tutti tranne la diavola',TG('Spaghetti aglio olio e peperoncino','piccante',false),{mods:{tags:{Diavola:['piccante'],'Spaghetti aglio olio e peperoncino':['piccante']}}})
add('tranne','togli tutte le promo tranne boh',PR('Che ne sacc',null))
add('tranne','togli le ultime porzioni da tutti tranne che ne sacc',LP('boh',false))
add('tranne','nascondi tutta la caffetteria tranne il cappuccino',HI('Caffè',true))
add('tranne','tutti i secondi sono finiti eccetto la tagliata',['Cotoletta alla milanese','Menù del giorno','Grigliata del venerdì'].map(d=>AV(d,false)))
add('tranne',['tutte le pizze sono finite a parte la margherita','ok'],['Pizza 4 formaggi','Diavola','Capricciosa','Margherita con bufala','Pizza del lunedì','Pizza mezzo metro'].map(d=>AV(d,false)),{note:'discutibile: «la margherita» non è «Margherita con bufala»'})
add('tranne',['tutti i primi sono finiti tranne pasta e fagioli','ok'],['Spaghetti alla carbonara','Spaghetti aglio olio e peperoncino','Lasagna al forno','Gnocchi 4 formaggi','Pasta del giorno'].map(d=>AV(d,false)))
add('tranne',['tutti i primi sono finiti tranne la lasagna e la pasta e fagioli','ok'],['Spaghetti alla carbonara','Spaghetti aglio olio e peperoncino','Gnocchi 4 formaggi','Pasta del giorno'].map(d=>AV(d,false)))
add('tranne',['tutti i piatti di prova sono finiti tranne il piatto di verifica','ok'],[AV('Piatto di prova',false),AV('Che ne sacc',false),LP('Che ne sacc',false),AV('boh',false),LP('boh',false),AV('pasta al ragù',false)])
add('tranne',['metti in evidenza tutte le pizze tranne la diavola','ok'],['Margherita','Pizza 4 formaggi','Capricciosa','Margherita con bufala','Pizza del lunedì','Pizza mezzo metro'].map(d=>FE(d,true)))
add('tranne','tutti i dolci sono finiti tranne la panna cotta e il tiramisù',AV('Dolce del giorno',false))
add('tranne',V("tutte le bibite sono finite tranne l'acqua"),[AV('Coca Cola 33cl',false),AV('Birra media',false)])
add('tranne',['tutti i primi sono finiti tranne gli spaghetti aglio olio e peperoncino','ok'],['Spaghetti alla carbonara','Pasta e fagioli','Lasagna al forno','Gnocchi 4 formaggi','Pasta del giorno'].map(d=>AV(d,false)))
add('tranne','nascondi tutte le bibite eccetto la coca cola',[HI('Acqua 0,5 l',true),HI('Birra media',true)])

// D) Nomi di piatti che contengono parole delle regole («e», «no», numeri, «boh», «ne», «piatto», «giorno»)
add('nomi','pasta e fagioli a 10',P('Pasta e fagioli',10))
add('nomi','la pasta e fagioli resta a 9, la lasagna a 12',P('Lasagna al forno',12))
add('nomi','non toccare la pasta e fagioli, la carbonara a 13',P('Spaghetti alla carbonara',13))
add('nomi','spaghetti aglio olio e peperoncino a 9',P('Spaghetti aglio olio e peperoncino',9))
add('nomi','gli spaghetti aglio olio e peperoncino non si toccano, carbonara a 13',P('Spaghetti alla carbonara',13))
add('nomi','menù del giorno a 16',P('Menù del giorno',16))
add('nomi','pizza 4 formaggi a 10',P('Pizza 4 formaggi',10))
add('nomi','gnocchi 4 formaggi 12',P('Gnocchi 4 formaggi',12))
add('nomi','gnocchi 4 formaggi 11 o 12',NONE,{reply:/11.*12/})
add('nomi','mezzo litro di vino a 7',P('Mezzo litro di vino',7))
add('nomi','mezzo litro di vino 7 o 8',NONE,{reply:/7.*8/})
add('nomi',V('il mezzo litro di vino a sette euro'),P('Mezzo litro di vino',7))
add('nomi','acqua 0,5 l a 2',P('Acqua 0,5 l',2))
add('nomi','acqua 0,5 a 1,80',P('Acqua 0,5 l',1.8))
add('nomi','coca cola 33cl a 3,50',P('Coca Cola 33cl',3.5))
add('nomi',V('coca cola trentatré a tre e cinquanta'),P('Coca Cola 33cl',3.5))
add('nomi','boh a 22',P('boh',22))
add('nomi','che ne sacc a 22',P('Che ne sacc',22))
add('nomi','che ne sacc no, boh a 22',P('boh',22))
add('nomi','piatto di prova no, piatto di verifica a 14',P('Piatto di verifica',14))
add('nomi','il piatto di prova è finito',AV('Piatto di prova',false))
add('nomi','pasta del giorno a 10',P('Pasta del giorno',10))
add('nomi','pasta del giorno 10 o 11',NONE,{reply:/10.*11/})
add('nomi',V('pizza quattro formaggi a dieci'),P('Pizza 4 formaggi',10))
add('nomi',V('acqua mezzo litro a due euro'),P('Acqua 0,5 l',2),{note:'discutibile: «mezzo litro» richiama anche il vino'})
add('nomi','pasta e fagioli a 10 e lasagna a 12',[P('Pasta e fagioli',10),P('Lasagna al forno',12)])
add('nomi','pasta e fagioli e lasagna finite',[AV('Pasta e fagioli',false),AV('Lasagna al forno',false)])
add('nomi','menù del giorno no, menù bambini a 9',P('Menù bambini',9))
add('nomi','pizza 4 formaggi finita, la diavola no',AV('Pizza 4 formaggi',false))
add('nomi','la pizza mezzo metro non si tocca, margherita a 8',P('Margherita',8))

// E) Nome di piatto da solo, senza nulla in sospeso → lettura
add('sola','Pasta e fagioli',NONE,{reply:/9,00/})
add('sola','pasta e fagioli?',NONE,{reply:/9,00/})
add('sola','Mezzo litro di vino',NONE,{reply:/6,00/})
add('sola','Acqua 0,5 l',NONE,{reply:/1,50/})
add('sola','Pizza 4 formaggi',NONE,{reply:/9,00/})
add('sola','Coca Cola 33cl',NONE,{reply:/3,00/})
add('sola','Menù del giorno',NONE,{reply:/15,00/})
add('sola','pasta del giorno',NONE,{reply:/9,00/})
add('sola','Che ne sacc',NONE,{reply:/Che ne sacc/})
add('sola','piatto di prova',NONE,{reply:/10,00/})
add('sola','spaghetti aglio olio e peperoncino',NONE,{reply:/8,00/})
add('sola','gli spaghetti',NONE,{reply:/carbonara/i})
add('sola','la diavola',NONE,{reply:/8,50/})
add('sola',V('pasta e fagioli'),NONE,{reply:/9,00/})
add('sola','gnocchi 4 formaggi',NONE,{reply:/10,00/})

// F) Nome di piatto quando c'è in sospeso un'altra cosa
add('sosp',['gli spaghetti costano 13','spaghetti aglio olio'],P('Spaghetti aglio olio e peperoncino',13))
add('sosp',['gli spaghetti costano 13','tutti e due'],[P('Spaghetti alla carbonara',13),P('Spaghetti aglio olio e peperoncino',13)])
add('sosp',['gli spaghetti sono finiti','entrambi'],[AV('Spaghetti alla carbonara',false),AV('Spaghetti aglio olio e peperoncino',false)])
add('sosp',['gli spaghetti costano 13','no, la carbonara'],P('Spaghetti alla carbonara',13))
add('sosp',['gli spaghetti costano 13',"la carbonara no, l'altro"],P('Spaghetti aglio olio e peperoncino',13),{note:'discutibile'})
add('sosp',['gli spaghetti costano 13','boh'],NONE,{note:'«boh» = non so: mai scrivere sul piatto boh'})
add('sosp',['gli spaghetti costano 13','che ne sacc'],NONE,{note:'«che ne sacc» = non so: mai scrivere sul piatto omonimo'})
add('sosp',['gli spaghetti costano 13','tutti'],[P('Spaghetti alla carbonara',13),P('Spaghetti aglio olio e peperoncino',13)])
add('sosp',['il menù costa 16','tutti e due'],NONE,{note:'più di due opzioni: «tutti e due» non vale'})
add('sosp',[R4T,'Piatto di verifica','ok'],R4,{note:'il nome letto non deve far perdere il riepilogo'})
add('sosp',[R4T,'la lasagna no','ok'],R4.filter(c=>(c as any).dish!=='Lasagna al forno'),{note:'discutibile: togliere dal riepilogo'})
add('sosp',[R4T,'annulla, no anzi conferma'],R4,{note:'discutibile: ripensamento nella stessa frase'})
add('sosp',[R4T,'boh','ok'],R4,{note:'discutibile'})
add('sosp',[R4T,'pasta e fagioli','ok'],R4)
add('sosp',[R4T,'ok grazie'],R4)
add('sosp',['aggiungi tra i contorni un piatto a 5','Fagioli'],CR('Fagioli',5,'Contorni'),{note:'nome uguale a una parola di «Pasta e fagioli»: completa la bozza, non è una lettura'})
add('sosp',['aggiungi tra i secondi un piatto a 16','Milanese'],CR('Milanese',16,'Secondi'),{note:'discutibile: il bot lo legge come la Cotoletta alla milanese'})
add('sosp',['aggiungi tra gli antipasti un piatto a 8','Bufala'],CR('Bufala',8,'Antipasti'))
add('sosp',['aggiungi tra le bibite una bibita a 3','Birra'],CR('Birra',3,'Bibite'))
add('sosp',['aggiungi tra i contorni un piatto a 5','boh'],NONE,{note:'discutibile: «boh» come nome = non so'})
add('sosp',['gli spaghetti costano 13','spaghetti aglio olio e peperoncino, grazie'],P('Spaghetti aglio olio e peperoncino',13))
add('sosp',['nascondi gli spaghetti','la carbonara'],HI('Spaghetti alla carbonara',true))
add('sosp',['gli spaghetti in promo a 7','tutti e due'],[PR('Spaghetti alla carbonara',7),PR('Spaghetti aglio olio e peperoncino',7)])
add('sosp',['il menù costa 16','il menù del giorno'],P('Menù del giorno',16))

// G) Creazioni normali: il nome resta quello scritto
add('crea','aggiungi tra i primi pasta al pesto a 11',CR('Pasta al pesto',11,'Primi'))
add('crea','aggiungi un nuovo piatto: tagliatelle 12 tra i primi',CR('Tagliatelle',12,'Primi'))
add('crea','aggiungi tra i dolci il tiramisù al caffè a 6',CR('Tiramisù al caffè',6,'Dolci'))
add('crea','aggiungi tra i primi la pasta e ceci a 9',CR('Pasta e ceci',9,'Primi'))
add('crea','aggiungi tra i secondi pollo e patate a 13',CR('Pollo e patate',13,'Secondi'))
add('crea','aggiungi tra i primi pasta senza glutine a 12',CR('Pasta senza glutine',12,'Primi'))
add('crea','aggiungi tra le bibite acqua frizzante 0,75 l a 2',CR('Acqua frizzante 0,75 l',2,'Bibite'))
add('crea','aggiungi tra le bibite Coca Cola zero 33cl a 3',CR('Coca Cola zero 33cl',3,'Bibite'))
add('crea','aggiungi tra gli antipasti tagliere per 2 a 20',CR('Tagliere per 2',20,'Antipasti'))
add('crea','aggiungi tra le pizze la pizza 4 stagioni a 9',CR('Pizza 4 stagioni',9,'Pizze'))
add('crea','aggiungi tra i secondi la tagliata di pollo a 14',CR('Tagliata di pollo',14,'Secondi'))
add('crea',"aggiungi tra i secondi l'orata al forno a 17",CR('Orata al forno',17,'Secondi'),{note:'discutibile: articolo apostrofato tolto'})
add('crea','aggiungi tra i dolci "Non ti scordar di me" a 6',CR('Non ti scordar di me',6,'Dolci'))
add('crea','aggiungi tra i secondi la grigliata mista 18 o 20',NONE,{reply:/18.*20/})
add('crea','aggiungi tra le proposte un burger di nome Smash burger a 13',CR('Smash burger',13,'Proposte'))
add('crea','aggiungi tra i secondi un piatto che si chiama Pollo alla brace a 14',CR('Pollo alla brace',14,'Secondi'))
add('crea',V('aggiungi tra i primi la pasta e fagioli con le cozze a dodici euro'),CR('Pasta e fagioli con le cozze',12,'Primi'))
add('crea','aggiungi tra le bibite birra 0,4 l a 5',CR('Birra 0,4 l',5,'Bibite'))
add('crea','aggiungi tra i primi gli spaghetti alle vongole a 15',CR('Spaghetti alle vongole',15,'Primi'))
add('crea','aggiungi tra i contorni le patate fritte a 4, non cambiare le patate al forno',CR('Patate fritte',4,'Contorni'))
add('crea','aggiungi tra i primi la carbonara di mare a 16',CR('Carbonara di mare',16,'Primi'))
add('crea','aggiungi tra i primi il piatto Pasta e fagioli alla veneta a 10',CR('Pasta e fagioli alla veneta',10,'Primi'))

// ---------------- Motore ----------------
const token='adv-token',self='https://takoitalia.com/api/whatsapp/twilio',account='AC'+'3'.repeat(32),sender='whatsapp:+18382622788'
Object.assign(process.env,{TWILIO_AUTH_TOKEN:token,TWILIO_WEBHOOK_URL:self,TWILIO_ACCOUNT_SID:account,TWILIO_WHATSAPP_NUMBER:sender,GROQ_API_KEY:'test-key'})
delete process.env.GROQ_API_BASE;delete process.env.TWILIO_API_BASE;delete process.env.TAKO_WHATSAPP_ONBOARDING_ENABLED
let n=0;const sid=(p='SM')=>p+(++n).toString(16).padStart(32,'0')
const post=(a:any,fields:Record<string,string>,from=phone)=>{const form={AccountSid:account,From:from,To:sender,NumMedia:'0',...fields};return a.inject({method:'POST',url:'/api/whatsapp/twilio',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':twilioSignature(token,self,form)},payload:new URLSearchParams(form).toString()})}
const unxml=(s:string)=>s.replace(/<\/Message><Message>/g,'\n').replace(/<[^>]+>/g,'').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
async function send(a:any,t:Turn){const before=net.sent.length;if(typeof t==='object'&&'b' in t){const res=await post(a,{MessageSid:sid(),Body:t.b},phoneB);return(unxml(res.body).trim()+'\n'+net.sent.slice(before).join('\n')).trim()}
 t=t as any;if(typeof t==='string'){const res=await post(a,{MessageSid:sid(),Body:t});return(unxml(res.body).trim()+'\n'+net.sent.slice(before).join('\n')).trim()}
 net.transcript=(t as any).v;const s=sid('MM');const res=await post(a,{MessageSid:s,Body:'',NumMedia:'1',MediaContentType0:'audio/ogg',MediaUrl0:`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages/${s}/Media/ME1`});return(unxml(res.body).trim()+'\n'+net.sent.slice(before).join('\n')).trim()}
const textOf=(t:Turn)=>typeof t==='string'?t:'v' in t?t.v:'b' in t?t.b:''
const label=(t:Turn)=>typeof t==='string'?t:'v' in t?'🎤 '+t.v:'b' in t?'[B] '+t.b:'wait' in t?`[+${t.wait} min]`:Array.isArray((t as any).dash)?`[dashboard: ${(t as any).dash.join(' ')}]`:'[cambio da dashboard]'

// Modello finto. ideal = quello che un modello perfetto restituirebbe vedendo SOLO il messaggio corrente (come il vero).
// Esteso dal fix (16/10): numeri composti in lettere letti dal server («novantacinque»).
const numberWords:Record<string,number>={novantacinque:95,zero:0,uno:1,un:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,trenta:30,cinquanta:50}
const units:Record<string,number>={uno:1,un:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19}
const tens:[string,number][]=[['venti',20],['trenta',30],['quaranta',40],['cinquanta',50],['sessanta',60],['settanta',70],['ottanta',80],['novanta',90]]
function itWord(w:string):number|null{if(w==='zero')return 0;let n=0,s=w;const h=s.match(/^(due|tre|quattro|cinque|sei|sette|otto|nove)?cento/);if(h){n+=(h[1]?units[h[1]]!:1)*100;s=s.slice(h[0].length)}
 if(!s)return n||null;for(const [t,v] of tens){const stem=t.slice(0,-1);if(s.startsWith(t)||s.startsWith(stem)&&/^(uno|otto)/.test(s.slice(stem.length))){const rest=s.startsWith(t)?s.slice(t.length):s.slice(stem.length);if(!rest)return n+v;if(units[rest]!==undefined&&units[rest]!<10)return n+v+units[rest]!;return null}}
 return units[s]!==undefined?n+units[s]!:null}
function spokenNumbers(raw:string):number[]{const out:number[]=[];for(const m of plainT(raw.replace(/(\d),(\d)/g,'$1.$2')).matchAll(/(\d+) (?:euro )?e mezz[oa]/g))out.push(Number(m[1])+0.5);{const w=plainT(raw).split(' ');for(let i=0;i<w.length;i++){const a=itWord(w[i]!);if(a===null)continue;out.push(a);let j=i+1;if(w[j]==='euro')j++;if(w[j]==='e'||w[j]==='virgola'){const b=w[j+1]==='mezzo'?50:itWord(w[j+1]??'');if(b!==null&&b<100){out.push(a+(w[j]==='virgola'&&b<10?b/10:b/100))}}}}for(const m of raw.matchAll(/\d+(?:[.,]\d{1,2})?/g))out.push(Number(m[0].replace(',','.')));const w=plainT(raw).split(' ')
 for(let i=0;i<w.length;i++){const a=numberWords[w[i]!];if(a===undefined)continue;out.push(a);if(w[i+1]==='euro'&&w[i+2]==='e'&&numberWords[w[i+3]!]!==undefined)out.push(a+numberWords[w[i+3]!]!/100);if(w[i+1]==='e'&&numberWords[w[i+2]!]!==undefined)out.push(a+numberWords[w[i+2]!]!/100)}
 const ints=out.filter(Number.isInteger);for(const x of ints)for(const y of ints)if(y>=10&&y<100)out.push(x+y/100);return out}
const mentions=(msg:string,c:Change)=>{const m=plainT(msg);if(c.op==='create'||c.op==='special')return m.includes(plainT(c.name).split(' ')[0]!);const words=plainT(c.dish).split(' ').filter(w=>w.length>3);return words.some(w=>m.includes(w.slice(0,5)))}
const untilWords=(m:string)=>m.match(/(fino a(?:l|lla)? [a-zàèéìòù0-9]+(?: (?:sera|ottobre|novembre|mese))?|solo (?:per )?(?:oggi|stasera)|per (?:tutto )?il weekend|per (?:questa|tutta la) settimana)/i)?.[1]??null
function idealAction(c:Change,hasSections:boolean):any{switch(c.op){
 case 'create':return hasSections?{action:'create_item',section_id:SEC[c.section??'Primi'],name:c.name,price:c.price}:null
 case 'special':return{action:'create_daily_special',name:c.name,price:c.price}
 case 'price':return{action:'set_price',item_id:ID[c.dish],price:c.price}
 case 'available':return{action:'set_available',item_id:ID[c.dish],available:c.value}
 case 'hidden':return{action:'set_hidden',item_id:ID[c.dish],hidden:c.value}
 case 'featured':return{action:'set_featured',item_id:ID[c.dish],featured:c.value}
 case 'description':return{action:'set_description',item_id:ID[c.dish],text:c.text}
 case 'tag':return{action:c.value?'add_tag':'remove_tag',item_id:ID[c.dish],tag:c.tag}
 case 'promo':return c.price===null?{action:'remove_promo',item_id:ID[c.dish]}:{action:'set_promo',item_id:ID[c.dish],price:c.price,...(untilWords(net.msgNow)?{until:untilWords(net.msgNow)}:{})}
 case 'last':return{action:'set_last_portions',item_id:ID[c.dish],value:c.value}
 case 'today':return{action:'set_only_today',item_id:ID[c.dish],value:c.value}}}
function modelReply(mode:AiMode,cs:Case|null,msg:string,hasSections:boolean,pending:boolean,photo:boolean):any{
 net.msgNow=msg;if(mode==='empty')return '{}'
 if(mode==='wrong')return{intent:'change',actions:[{action:'set_price',item_id:ID['Panna cotta'],price:99}]}
 if(mode==='wrongCreate')return{intent:'change',actions:[{action:'create_item',section_id:SEC['Primi'],name:msg.slice(0,120),price:99}]}
 if(!cs)return{intent:'clarify',item_ids:[]}
 if(cs.ai)return cs.ai(msg,hasSections,pending)
 if(photo)return{intent:'clarify',item_ids:[]}
 if(pending)return{intent:'change',actions:[],remove_indices:[],update_indices:[]}
 const relevant=[...cs.changes,...(cs.changesB??[])].filter(c=>mentions(msg,c))
 if(!relevant.length){const q=/\?|quanto|cosa|quali|che /.test(msg)&&!/aggiung/.test(plainT(msg));if(q){const hits=Object.keys(ID).filter(name=>plainT(name).split(' ').some(w=>w.length>4&&plainT(msg).includes(w.slice(0,5))));return hits.length?{intent:'read',read:'items',item_ids:hits.map(h=>ID[h])}:{intent:'capability',capability_ids:['all']}}return{intent:'clarify',item_ids:[]}}
 const creates=relevant.filter(c=>c.op==='create') as Extract<Change,{op:'create'}>[]
 for(const c of creates){const missing=[...(!hasSections?['section']:[]),...(!spokenNumbers(msg).includes(c.price)?['price']:[])];if(missing.length)return{intent:'clarify',missing,name:c.name,section_ids:[]}}
 if(relevant.some(c=>c.op!=='create'&&c.op!=='special'&&!['promo'].includes(c.op)&&'price' in c&&c.price!==null&&!spokenNumbers(msg).includes(c.price as number))&&!cs.relative)return{intent:'clarify',item_ids:relevant.filter(c=>'dish' in c).map(c=>ID[(c as any).dish])}
 return{intent:'change',actions:relevant.map(c=>idealAction(c,hasSections)).filter(Boolean)}}

// Diff tra due documenti: ogni modifica diventa una chiave confrontabile con le attese.
type Item={id:string,name:string,price:number,available?:boolean,hidden?:boolean,featured?:boolean,description?:string|null,tags?:string[],promo?:any,scarcity?:any,section:string}
const flat=(w:any):Map<string,Item>=>new Map(w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>[i.id,{...i,section:s.name}]))))
function diff(before:any,after:any):string[]{const a=flat(before),b=flat(after),out:string[]=[]
 for(const [id,x] of b){const y=a.get(id);if(!y){out.push(x.section==='Piatto del giorno'||x.section==='Piatti del giorno'||/giorno/i.test(x.section)&&!SEC[x.section]?`special|${plainT(x.name)}|${x.price}`:`create|${plainT(x.name)}|${x.price}|${plainT(x.section)}`);continue}
  if(x.name!==y.name)out.push(`rename|${y.name}|${x.name}`);if(x.section!==y.section)out.push(`move|${y.name}|${x.section}`);if(x.price!==y.price)out.push(`price|${y.name}|${x.price}`)
  if((x.available!==false)!==(y.available!==false))out.push(`available|${y.name}|${x.available!==false}`);if(!!x.hidden!==!!y.hidden)out.push(`hidden|${y.name}|${!!x.hidden}`);if(!!x.featured!==!!y.featured)out.push(`featured|${y.name}|${!!x.featured}`)
  if((x.description??'')!==(y.description??''))out.push(`description|${y.name}|${plainT(x.description??'')}`)
  const tx=x.tags??[],ty=y.tags??[];for(const t of tx)if(!ty.includes(t))out.push(`tag|${y.name}|${t}|true`);for(const t of ty)if(!tx.includes(t))out.push(`tag|${y.name}|${t}|false`)
  const px=x.promo?.price??null,py=y.promo?.price??null;if(px!==py)out.push(`promo|${y.name}|${px}`);const ux=x.promo?.until??null,uy=y.promo?.until??null;if(px!==null&&(ux!==uy||px!==py&&ux))out.push(`until|${y.name}|${ux}`)
  const lx=!!x.scarcity?.lastPortions,ly=!!y.scarcity?.lastPortions;if(lx!==ly)out.push(`last|${y.name}|${lx}`)
  const ox=!!x.scarcity?.onlyToday,oy=!!y.scarcity?.onlyToday;if(ox!==oy)out.push(`today|${y.name}|${ox}`)}
 for(const [,y] of a)if(!b.has(y.id))out.push(`delete|${y.name}`);return out}
const key=(c:Change):string=>c.op==='until'?`until|${c.dish}|${c.date}`:c.op==='create'?`create|${plainT(c.name)}|${c.price}|${c.section?plainT(c.section):'*'}`:c.op==='special'?`special|${plainT(c.name)}|${c.price}`:c.op==='price'?`price|${c.dish}|${c.price}`:c.op==='description'?`description|${c.dish}|${plainT(c.text)}`:c.op==='tag'?`tag|${c.dish}|${c.tag}|${c.value}`:c.op==='promo'?`promo|${c.dish}|${c.price}`:`${c.op}|${c.dish}|${c.value}`
const same=(exp:string,act:string)=>exp===act||exp.endsWith('|*')&&act.startsWith(exp.slice(0,-1))
const priceOf=(k:string)=>{const p=k.replace(/^B:/,'').split('|');return p[0]==='create'||p[0]==='special'?Number(p[2]):p[0]==='price'||p[0]==='promo'?Number(p[2]):null}

type Fail={sev:'GRAVE'|'MEDIO'|'BASSO',why:string}
type Result={id:string,cat:string,mode:AiMode,turns:string[],replies:string[],expected:string[],actual:string[],aiCalls:number,fails:Fail[],note?:string,proposal?:any}
const results:Result[]=[]
const banned=/\b(aggiung\w*|inserisc\w*|costa|costano|euro|prezzo|il piatto|tra i|tra le|nei|nelle|metti\w*|che costa)\b/
const actionWords=/\b(aggiung\w*|costa|costano|euro|metti\w*|cambia|prezzo|finit\w*|esaurit\w*|nascondi|togli|il piatto|che)\b/
function judge(cs:Case,mode:AiMode,replies:string[],actual:string[],proposal:any):Fail[]{
 const f:Fail[]=[],expected=[...cs.changes.map(key),...(cs.changesB??[]).map(c=>'B:'+key(c))],msgs=cs.turns.map(textOf).join(' '),said=new Set(spokenNumbers(msgs).map(x=>Math.round(x*100)))
 for(const [i,r] of replies.entries()){
  if(!r.trim())f.push({sev:'GRAVE',why:`turno ${i+1}: nessuna risposta`})
  const nf=r.match(/Non trovo «([^»]+)»/);if(nf&&(nf[1]!.split(/\s+/).length>=4||actionWords.test(plainT(nf[1]!))))f.push({sev:'GRAVE',why:`turno ${i+1}: «Non trovo «${nf[1]}»» cita la frase come nome di piatto`})
  if(/undefined|NaN|\[object|\{"|null\b/.test(r))f.push({sev:'BASSO',why:`turno ${i+1}: copy con valori grezzi`})
  if(r.includes(copy.failed))f.push({sev:'GRAVE',why:`turno ${i+1}: errore generico (copy.failed)`})}
 for(const k0 of actual){const k=k0.replace(/^B:/,''),p=k.split('|');if(p[0]==='create'||p[0]==='special'){if(banned.test(p[1]!))f.push({sev:'GRAVE',why:`nome creato con parole d'azione: «${p[1]}»`})}
  const pr=priceOf(k);if(pr!==null&&!Number.isNaN(pr)&&!said.has(Math.round(pr*100))&&!(cs.relative&&expected.some(e=>same(e,k))))f.push({sev:'GRAVE',why:`prezzo ${pr} mai detto (${k})`})}
 const wrong=actual.filter(k=>!expected.some(e=>same(e,k))),missing0=expected.filter(e=>!actual.some(k=>same(e,k)))
 if(mode==='ideal'&&cs.alt?.some(set=>{const ks=set.map(key);return ks.length===actual.length&&actual.every(k=>ks.some(e=>same(e,k)))}))return f
 if(cs.mustConfirm&&mode==='ideal'){if(actual.length)f.push({sev:'GRAVE',why:`prezzo sospetto pubblicato senza conferma: ${actual.join(', ')}`});else if(!proposal?.requiresTypedOk)f.push({sev:'BASSO',why:'prezzo sospetto: né applicato né in conferma'});return f}
 const missing=missing0
 if(cs.anyWithReply){if(mode==='ideal'&&!cs.anyWithReply.test(replies.at(-1)??''))f.push({sev:'BASSO',why:`risposta non indica come tornare indietro (attesa ${cs.anyWithReply})`});return f}
 if(mode!=='ideal'){const altKeys=(cs.alt??[]).flat().map(key);const wrongB=wrong.filter(k=>!altKeys.some(e=>same(e,k)));if(wrongB.length)f.push({sev:'GRAVE',why:`IA sbagliata (${mode}) → scritto: ${wrongB.join(', ')}`});return f}
 if(false){if(wrong.length)f.push({sev:'GRAVE',why:`IA sbagliata (${mode}) → scritto: ${wrong.join(', ')}`});return f}
 if(wrong.length){const addToEdit=cs.changes.some(c=>c.op==='create')&&wrong.some(k=>!k.startsWith('create')),editToAdd=!cs.changes.some(c=>c.op==='create')&&wrong.some(k=>k.startsWith('create'));f.push({sev:'GRAVE',why:(addToEdit?'aggiunta diventata modifica: ':editToAdd?'modifica diventata aggiunta: ':'scrittura sbagliata: ')+wrong.join(', ')})}
 if(missing.length){const last=replies.at(-1)??'',pendingOk=proposal?.requiresTypedOk
  if(pendingOk)f.push({sev:'MEDIO',why:`resta in attesa di OK, non applicato: ${missing.join(', ')}`})
  else if(!last.trim())f.push({sev:'GRAVE',why:'richiesta persa senza risposta'})
  else if(/Non trovo «/.test(last)||last.includes(copy.notUnderstood)||last.includes(copy.noMatch)||last.includes(copy.dishNotFound))f.push({sev:'GRAVE',why:`richiesta persa: ${missing.join(', ')}`})
  else if(/\?|manca|Rimandami|Quale|Scrivi il nome|Rispondi/i.test(last))f.push({sev:'MEDIO',why:`domanda invece di agire / contesto perso: ${missing.join(', ')}`})
  else f.push({sev:'GRAVE',why:`non applicato: ${missing.join(', ')}`})}
 if(!expected.length&&cs.reply&&!cs.reply.test(replies.at(-1)??''))f.push({sev:'BASSO',why:`risposta non pertinente (attesa ${cs.reply})`})
 return f}

let app:any
const realNow=Date.now.bind(Date)
beforeAll(async()=>{vi.spyOn(Date,'now').mockImplementation(()=>realNow()+S.offset);app=Fastify();await app.register(twilioMenuRoutes,{prefix:'/api'})
 setTranslationEnqueue(async()=>{});setMenuPresetTarget({enabled:async()=>false,save:async()=>({label:'x'})})})
afterAll(async()=>{await app?.close();vi.unstubAllGlobals()
 const dir=new URL('../docs/webapp/owner-bot-verify-2026-10-16/',import.meta.url);mkdirSync(dir,{recursive:true})
 writeFileSync(new URL('results-round5c.json',dir),JSON.stringify({cases:C.length,runs:results.length,unknownSql:[...new Set(S.unknownSql)],results},null,1))})

async function run(cs:Case,mode:AiMode):Promise<Result>{
 S.draft=fixture(cs.mods);S.published=fixture(cs.mods);S.revision=5;S.published_revision=5;S.B.draft=fixture(cs.mods);S.B.published=fixture(cs.mods);S.B.revision=5;S.B.published_revision=5
 S.proposals.clear();S.messages.clear();S.versions=[];S.links=new Set([phone,phoneB]);S.offset=0;net.mode=mode;net.caseNow=cs;net.chats=0
 const before=structuredClone(S.published),beforeB=structuredClone(S.B.published),replies:string[]=[];let dashed=false
 for(const t of cs.turns){if(typeof t==='object'&&'wait' in t){S.offset+=t.wait*60000;continue}
  if(typeof t==='object'&&'dash' in t&&Array.isArray(t.dash)){const [nm,field,val]=t.dash,w=structuredClone(S.published);for(const doc of [w,before])for(const m of doc.menus)for(const s of m.sections)for(const i of s.items)if(i.name===nm)(i as any)[field]=val;S.draft=w;S.published=structuredClone(w);S.revision++;S.published_revision=S.revision;continue}
  if(typeof t==='object'&&'dash' in t){const w=structuredClone(S.published);for(const m of w.menus)for(const s of m.sections)for(const i of s.items)if(i.name==='Cappuccino')i.price=2;S.draft=w;S.published=structuredClone(w);S.revision++;S.published_revision=S.revision;dashed=true;continue}
  let r='';try{r=await send(app,t)}catch(e){r=''};replies.push(r)}
 const actual=[...diff(before,S.published).filter(k=>!(dashed&&k==='price|Cappuccino|2')),...diff(beforeB,S.B.published).map(k=>'B:'+k)],proposal=live(phone)?.command
 const res:Result={id:cs.id,cat:cs.cat,mode,turns:cs.turns.map(label),replies,expected:[...cs.changes.map(key),...(cs.changesB??[]).map(c=>'B:'+key(c))],actual,aiCalls:net.chats,fails:[],...(cs.note?{note:cs.note}:{}),...(proposal?{proposal:{kind:proposal.kind,stage:proposal.stage,actions:proposal.actions}}:{})}
 res.fails=judge(cs,mode,replies,actual,proposal)
 // Invariante del quinto giro: il nome del piatto nuovo resta quello scritto (prima lettera a parte), anche maiuscole e articoli.
 const was=new Set([...flat(before).keys()]),made=[...flat(S.published).values()].filter(i=>!was.has(i.id))
 for(const c of cs.changes)if(c.op==='create'){const got=made.find(i=>plainT(i.name)===plainT(c.name));if(got&&got.name.slice(1)!==c.name.slice(1))res.fails.push({sev:'MEDIO',why:`nome alterato: «${got.name}» invece di «${c.name}»`})}
 results.push(res);return res}

describe('bot titolare: verifica avversaria, quinto giro ter (falsi positivi 17/10)',()=>{
 it('ha tra 120 e 200 casi nuovi (quinto giro ter)',()=>{expect(C.length).toBeGreaterThanOrEqual(120);expect(C.length).toBeLessThanOrEqual(200)})
 for(const cs of C)it(`${cs.id}: ${cs.turns.map(label).join(' ⏎ ').slice(0,90)}`,async()=>{
  const ideal=await run(cs,'ideal'),fails=[...ideal.fails.map(x=>`[ideal] ${x.sev} ${x.why}`)]
  if(ideal.aiCalls>0)for(const mode of ['empty','wrong','wrongCreate'] as AiMode[]){const r=await run(cs,mode);fails.push(...r.fails.map(x=>`[${mode}] ${x.sev} ${x.why}`))}
  expect(fails,`risposte: ${JSON.stringify(ideal.replies)}\nscritto: ${JSON.stringify(ideal.actual)}`).toEqual([])
 })
})
