// Verifica avversaria del bot WhatsApp del TITOLARE — QUINTO GIRO BIS (17/10/2026, frasi nuove del verificatore indipendente): i 4 bug del collaudo WhatsApp reale
// sul QA (prezzi alternativi «13 o 14?», clausole negate «non cambiare boh; …», risposta a «Quale piatto intendi?» che perdeva
// l'operazione, nome del piatto nuovo «Piatto test QA» diventato «Test QA») e tutta la loro famiglia, più le domande che non scrivono.
// Webhook firmato vero (router + NLU + validatori veri), DB e documento menu in memoria, Groq/Whisper/Twilio finti, orologio fisso.
// Ogni caso gira con un modello «ideale» e, quando passa dall'IA, anche con modelli che rispondono male
// (JSON vuoto, azione su un piatto sbagliato, creazione inventata). Nessuna rete, nessun DB reale, nessun deploy.
// Risultati: docs/webapp/owner-bot-verify-2026-10-16/results-round5b.json (scritto a fine run).
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

// ===== QUINTO GIRO (17/10/2026): i 4 bug del QA WhatsApp e le loro famiglie =====
// Invarianti: mai scrivere su una domanda; mai cambiare un piatto non nominato o negato; ambiguità → domanda, mai scelta
// silenziosa; il nome di un piatto nuovo resta quello scritto (controllato carattere per carattere, prima lettera a parte).
const W=(m:number)=>({wait:m})
const ASK=/quale prezzo|un solo prezzo|rispondi|due prezzi/i,ASKD=/Quale piatto|1\.|numero/i,BAD=/non è tra|Riscrivimi/i
const addD=(n:number)=>{const d=new Date(todayIso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const dateOf=(m:number,d:number)=>{const y=Number(todayIso.slice(0,4));const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return iso<todayIso?`${y+1}${iso.slice(4)}`:iso}
void addD
// IA ideale per i chiarimenti: il modello capisce l'azione giusta, il validatore chiede quale piatto (due nomi completi nel testo).
const priceAi=(dish:string,price:number)=>(msg:string)=>/come/.test(plainT(msg))?{intent:'change',actions:[{action:'set_price',item_id:ID[dish],price}]}:{intent:'clarify',item_ids:[]}

// ===== QUINTO GIRO BIS (17/10/2026): frasi NUOVE per le 4 famiglie del QA WhatsApp (verificatore indipendente) =====
// Stesse invarianti del quinto giro. Nessuna frase ripresa dalla batteria round5.

// A) Prezzi alternativi → domanda, nessuna scrittura
add('alt','uè, la carbonara facimmo 13 o 14?',NONE,{reply:ASK,note:'napoletano'})
add('alt','ciao! la lasagna 12 o 13 euro grazie',NONE,{reply:ASK})
add('alt','Buongiorno, tagliata 19/20',NONE,{reply:ASK})
add('alt','cotoletta 16 oppure 17',NONE,{reply:ASK})
add('alt','tiramisù a 6 o 6,50 😅',NONE,{reply:ASK})
add('alt',V('la panna cotta mettila a sei o sette euro'),NONE,{reply:ASK})
add('alt',V('il piatto di verifica a quattordici o quindici euro'),NONE,{reply:ASK})
add('alt','PIATTO DI VERIFICA 14 O 15',NONE,{reply:ASK})
add('alt','piatto di verifica 14-15',NONE,{reply:ASK,note:'trattino tra due prezzi = intervallo, non un prezzo'})
add('alt','piatto di verifica tra i 14 e i 15 euro',NONE,{reply:ASK})
add('alt','che ne sacc 22 o 23 boh',NONE,{reply:ASK,note:'«boh» finale è anche il nome di un piatto: comunque domanda'})
add('alt','a carbonara a 13 o a 14 ? dimmi tu',NONE,{reply:ASK})
add('alt','la carbonara la mettiamo 13 o 13,50',NONE,{reply:ASK})
add('alt','Margherita 7,50 oppure 8 euro',NONE,{reply:ASK})
add('alt','la capricciosa: 10 o 10,50?',NONE,{reply:/10.*10,50/})
add('alt','diavola tra i 9 e i 10',NONE,{reply:ASK})
add('alt','pasta al ragu 13 o 14',NONE,{reply:ASK,note:'senza accento'})
add('alt',V('pasta al ragù tredici o tredici e cinquanta'),NONE,{reply:ASK})
add('alt','boh a 18 o 19 €',NONE,{reply:ASK})
add('alt','il prezzo del tiramisù lo porto a 6 o a 7, che dici?',NONE,{reply:ASK})
add('alt','aho la cotoletta mettila a 16 o 17',NONE,{reply:ASK,note:'romano'})
add('alt','ciò, la tagliata xe 19 o 20?',NONE,{reply:/19.*20/,note:'veneto'})
add('alt','a lasagna a mittemu a 12 o 13',NONE,{reply:ASK,note:'siciliano'})
add('alt','carbonara 13 o 14 e lasagna finita',NONE,{reply:ASK,note:'discutibile: come round5, tutta la richiesta resta ferma se una parte è ambigua'})
add('alt','metti la lasagna a 12 e la tagliata a 19 o 20',NONE,{reply:ASK})
add('alt','carbonara 13 o 14, lasagna 12 o 13',NONE,{reply:ASK})
add('alt','tredici o quattordici la carbonara',NONE,{reply:ASK})
add('alt','carbonara 13 o 14???',NONE,{reply:ASK})
add('alt','carbonara 13 o 14 vedi tu quale è meglio',NONE,{reply:ASK})
add('alt','cappuccino 2 o 2,20',NONE,{reply:ASK})
add('alt','la birra media 5,50 o 6',NONE,{reply:ASK})
add('alt','gnocchi 4 formaggi 11 o 12',NONE,{reply:/11.*12/,note:'il 4 del nome non è un prezzo'})
add('alt','pizza 4 formaggi 10/11',NONE,{reply:/10.*11/})
// risposte alla domanda sul prezzo
add('altrisp',['la tagliata la mettiamo a 19 o 20?','20'],P('Tagliata di manzo',20),{note:'piatto nominato: la risposta col prezzo dovrebbe completare'})
add('altrisp',['cotoletta 16 oppure 17','17'],P('Cotoletta alla milanese',17))
add('altrisp',['pasta al ragù a 13 o 14 euro','14 euro'],P('pasta al ragù',14))
add('altrisp',['PIATTO DI VERIFICA 14 O 15',V('quindici')],P('Piatto di verifica',15))
add('altrisp',['piatto di verifica 14 o 15','il primo'],P('Piatto di verifica',14))
add('altrisp',['carbonara 13 o 14','13,50'],NONE,{reply:/rispondi/i})
add('altrisp',['carbonara 13 o 14',W(9),'14'],P('Spaghetti alla carbonara',14),{note:'entro i 10 minuti'})
add('altrisp',['carbonara 13 o 14',W(12),'14'],NONE,{note:'scaduta'})
add('altrisp',['carbonara 13 o 14','no lascia stare'],NONE)
add('altrisp',['carbonara 13 o 14','14 grazie mille'],P('Spaghetti alla carbonara',14))
add('altrisp',['tiramisù a 6 o 6,50','6,50'],P('Tiramisù',6.5))
add('altrisp',['margherita 7,50 oppure 8 euro','facciamo 8'],P('Margherita',8))
add('altrisp',['boh a 18 o 19 €','19'],P('boh',19))
add('altrisp',['carbonara 13 o 14','14','la lasagna 12'],[P('Spaghetti alla carbonara',14),P('Lasagna al forno',12)])
add('altrisp',['carbonara 13 o 14','la lasagna a 12'],P('Lasagna al forno',12),{note:'nuovo comando: la carbonara resta ferma'})
// controlli: niente falsi allarmi
add('altok','carbonara 13 anzi 14',P('Spaghetti alla carbonara',14),{note:'discutibile: autocorrezione esplicita, vale l\'ultimo'})
add('altok','carbonara a 13, no scusa 14',P('Spaghetti alla carbonara',14),{note:'discutibile: autocorrezione esplicita'})
add('altok','piatto di verifica da 13,50 a 14',P('Piatto di verifica',14),{note:'«da X a Y» col prezzo attuale = cambio, non alternativa'})
add('altok','metti la lasagna in promo a 9 fino al 20/10',PRu('Lasagna al forno',9,dateOf(10,20)))
add('altok','carbonara: ultime 2 porzioni',LP('Spaghetti alla carbonara',true))
add('altok','della tagliata restano le ultime 3 porzioni',LP('Tagliata di manzo',true))
add('altok','Pasta e fagioli a 10',P('Pasta e fagioli',10))
add('altok','pizza 4 formaggi a 10',P('Pizza 4 formaggi',10))
add('altok','acqua 0,5 l a 2 euro',P('Acqua 0,5 l',2))
add('altok','coca cola 33cl 3,50',P('Coca Cola 33cl',3.5))
add('altok','carbonara 13. lasagna 12',[P('Spaghetti alla carbonara',13),P('Lasagna al forno',12)])
add('altok','tiramisù e panna cotta a 6',[P('Tiramisù',6),P('Panna cotta',6)])
add('altok','quanto costa la Pasta e fagioli?',NONE,{reply:/9,00/})
add('altok','la carbonara 120',NONE,{mustConfirm:true,ai:()=>({intent:'change',actions:[{action:'set_price',item_id:ID['Spaghetti alla carbonara'],price:120}]})})
add('altok','boh è finito',[AV('boh',false),LP('boh',false)])

// B) Clausole negate
add('neg','non cambiare la lasagna; carbonara 14',P('Spaghetti alla carbonara',14))
add('neg','Non toccare boh!! piatto di verifica 14,50',P('Piatto di verifica',14.5))
add('neg','boh lascialo stare, il piatto di verifica a 15 euro',P('Piatto di verifica',15))
add('neg','lassa stà boh, piatto di verifica a 14',P('Piatto di verifica',14),{note:'romano'})
add('neg',"boh nun 'o tuccà, piatto di verifica a 14",P('Piatto di verifica',14),{note:'napoletano'})
add('neg','lassa star boh, el piatto de verifica a 14',P('Piatto di verifica',14),{note:'veneto'})
add('neg','boh non si tocca. piatto di verifica 14',P('Piatto di verifica',14))
add('neg','piatto di verifica 14 euro, boh invece resta uguale',P('Piatto di verifica',14))
add('neg','piatto di verifica a 14 (boh no)',P('Piatto di verifica',14))
add('neg','metti 14 al piatto di verifica e niente su boh',P('Piatto di verifica',14),{note:'«niente su X» come esclusione'})
add('neg',V('non cambiare boh metti il piatto di verifica a quattordici euro'),P('Piatto di verifica',14),{note:'vocale senza punteggiatura'})
add('neg',V('allora boh non lo cambiare e il piatto di verifica lo metti a quattordici e cinquanta'),P('Piatto di verifica',14.5))
add('neg','non cambiare che ne sacc; boh a 22',P('boh',22))
add('neg','non cambiare il piatto di verifica; che ne sacc a 22',P('Che ne sacc',22))
add('neg','carbonara finita, lasagna no',AV('Spaghetti alla carbonara',false))
add('neg','nascondi la diavola ma lascia la capricciosa',HI('Diavola',true))
add('neg','nascondi tutti i dolci tranne il tiramisù',[HI('Panna cotta',true),HI('Dolce del giorno',true)])
add('neg',['tutti i secondi finiti tranne la tagliata','ok'],['Cotoletta alla milanese','Menù del giorno','Grigliata del venerdì'].map(d=>AV(d,false)))
add('neg',['i secondi sono tutti finiti, la tagliata no','ok'],['Cotoletta alla milanese','Menù del giorno','Grigliata del venerdì'].map(d=>AV(d,false)))
add('neg',['le pizze sono tutte finite eccetto la capricciosa e la diavola','ok'],['Margherita','Pizza 4 formaggi','Margherita con bufala','Pizza del lunedì','Pizza mezzo metro'].map(d=>AV(d,false)))
add('neg','metti in promo il tiramisù a 4 ma non la panna cotta',PR('Tiramisù',4))
add('neg','carbonara 13 e basta, non toccare altro',P('Spaghetti alla carbonara',13))
add('neg','non cambiare nulla sulla lasagna però la carbonara mettila in evidenza',FE('Spaghetti alla carbonara',true))
add('neg','senza toccare boh e che ne sacc, metti il piatto di verifica a 12',P('Piatto di verifica',12))
add('neg','non segnare finita la lasagna, la carbonara sì',AV('Spaghetti alla carbonara',false))
add('neg','la lasagna non è finita, la carbonara sì',AV('Spaghetti alla carbonara',false),{note:'la lasagna è già disponibile: nessun cambio'})
add('neg','non nascondere la diavola, nascondi la capricciosa',HI('Capricciosa',true))
add('neg','lascia stare boh grazie',NONE)
add('neg','boh e che ne sacc restano come sono',NONE)
add('neg','non cambiare la carbonara',NONE)
add('neg','tranne boh',NONE)
add('neg','non cambiare boh; metti boh a 22',NONE,{note:'contraddizione: il piatto negato non si cambia mai'})
add('neg','piatto di verifica e boh a 14, anzi boh no',P('Piatto di verifica',14),{note:'discutibile: esclusione a posteriori'})
add('neg','nn toccare la lasagna x favore, carbonara a 13',P('Spaghetti alla carbonara',13))
add('neg','NON CAMBIARE BOH. PIATTO DI VERIFICA 14',P('Piatto di verifica',14))
add('neg','ciao 👋 non cambiare boh, il piatto di verifica mettilo a 14 grazie 🙏',P('Piatto di verifica',14))
add('neg','la carbonara non la cambiare che va bene così, la lasagna a 12',P('Lasagna al forno',12))
add('neg','non cambiare il prezzo di boh, è finito',[AV('boh',false),LP('boh',false)],{ai:()=>({intent:'change',actions:[{action:'set_available',item_id:ID['boh'],available:false}]}),note:'discutibile: si esclude solo il prezzo, «finito» vale'})
add('neg','boh rimane 20, piatto di verifica 14,50',P('Piatto di verifica',14.5))
add('neg','il piatto di verifica a 14, la pasta al ragù la lasciamo',P('Piatto di verifica',14))
add('neg','pasta al ragù no, piatto di verifica sì a 14',P('Piatto di verifica',14))
add('neg','Pasta e fagioli lasciala stare, carbonara 13',P('Spaghetti alla carbonara',13))
add('neg',['non cambiare boh; metti il piatto di verifica a 14','e anche la carbonara a 13'],[P('Piatto di verifica',14),P('Spaghetti alla carbonara',13)])
add('neg',['non cambiare boh; il piatto di verifica a 14','ok'],P('Piatto di verifica',14))

// C) Risposta a «Quale piatto intendi?»
add('chiar',['il burger costa 11','il classico'],P('Burger classico',11))
add('chiar',['il burger costa 11','quello nuovo'],P('Nuovo burger',11))
add('chiar',['il burger costa 11','Burger classico'],P('Burger classico',11))
add('chiar',['il burger costa 11',V('il burger classico')],P('Burger classico',11))
add('chiar',['il burger è finito','il nuovo'],AV('Nuovo burger',false))
add('chiar',['nascondi il burger','tutti e due'],[HI('Nuovo burger',true),HI('Burger classico',true)],{note:'discutibile: «tutti e due» = entrambe le opzioni proposte'})
add('chiar',['la pasta costa 10','pasta e fagioli'],P('Pasta e fagioli',10))
add('chiar',['la pasta costa 10','quella al ragù'],P('pasta al ragù',10))
add('chiar',['la pasta costa 10','la pasta del giorno'],P('Pasta del giorno',10))
add('chiar',['il piatto costa 12','il piatto di verifica'],P('Piatto di verifica',12))
add('chiar',['il piatto costa 12','Piatto di prova'],P('Piatto di prova',12))
add('chiar',['il piatto è finito','di verifica'],AV('Piatto di verifica',false))
add('chiar',['gli spaghetti costano 9','carbonara grazie'],P('Spaghetti alla carbonara',9))
add('chiar',['gli spaghetti costano 9','aglio e olio'],P('Spaghetti aglio olio e peperoncino',9))
add('chiar',['gli spaghetti costano 9','👍 quelli alla carbonara'],P('Spaghetti alla carbonara',9))
add('chiar',['gli spaghetti costano 9','CARBONARA'],P('Spaghetti alla carbonara',9))
add('chiar',['gli spaghetti costano 9','carbonra'],P('Spaghetti alla carbonara',9),{note:'refuso nella risposta'})
add('chiar',['gli spaghetti costano 9','1'],P('Spaghetti alla carbonara',9),{note:'ordine del menu: carbonara prima'})
add('chiar',['gli spaghetti costano 9','tutti e due'],[P('Spaghetti alla carbonara',9),P('Spaghetti aglio olio e peperoncino',9)],{note:'discutibile'})
add('chiar',['gli spaghetti costano 9',W(5),'carbonara'],P('Spaghetti alla carbonara',9))
add('chiar',['gli spaghetti costano 9',W(9),'carbonara'],P('Spaghetti alla carbonara',9))
add('chiar',['gli spaghetti costano 9',W(15),'carbonara'],NONE,{reply:/12,00/,note:'scaduta: «carbonara» torna a essere una lettura'})
add('chiar',['gli spaghetti costano 9','pizza margherita'],NONE,{reply:BAD})
add('chiar',['gli spaghetti costano 9','boh'],NONE,{reply:BAD,note:'«boh» è un piatto del menu ma non tra le opzioni'})
add('chiar',['gli spaghetti costano 9','non lo so'],NONE,{reply:/non è tra|Riscrivimi|numero|nome/i})
add('chiar',['gli spaghetti costano 9','lascia perdere'],NONE)
add('chiar',['gli spaghetti costano 9','quanto costa la lasagna?'],NONE,{reply:/11,00/})
add('chiar',['gli spaghetti costano 9','la tagliata è finita'],AV('Tagliata di manzo',false))
add('chiar',['non cambiare boh; gli spaghetti a 9','carbonara'],P('Spaghetti alla carbonara',9))
add('chiar',['metti la pasta e fagioli a 10 come la lasagna al forno','pasta e fagioli'],P('Pasta e fagioli',10),{ai:priceAi('Pasta e fagioli',10),note:'chiarimento dal validatore (due nomi completi)'})
add('chiar',['metti la pasta e fagioli a 10 come la lasagna al forno',V('la pasta e fagioli')],P('Pasta e fagioli',10),{ai:priceAi('Pasta e fagioli',10)})
add('chiar',['metti la pasta e fagioli a 10 come la lasagna al forno','la lasagna'],P('Lasagna al forno',10),{ai:priceAi('Pasta e fagioli',10)})
add('chiar',['metti la pasta e fagioli a 10 come la lasagna al forno',W(11),'pasta e fagioli'],NONE,{ai:priceAi('Pasta e fagioli',10)})
add('chiar',['metti la pasta e fagioli a 10 come la lasagna al forno','il tiramisù'],NONE,{ai:priceAi('Pasta e fagioli',10),reply:BAD})
add('chiar',['il dolce è finito','la panna cotta'],AV('Panna cotta',false))
add('chiar',['il dolce è finito','dolce del giorno'],AV('Dolce del giorno',false))
add('chiar',['metti in evidenza il burger','classico'],FE('Burger classico',true))
add('chiar',['il burger in promo a 9','il nuovo burger'],PR('Nuovo burger',9))
add('chiar',['il menù costa 25','degustazione'],P('Menù degustazione',25))
add('chiar',['il menù costa 25','quello della domenica'],P('Menù della domenica',25))
add('chiar',['gli spaghetti costano 9','carbonara','grazie'],P('Spaghetti alla carbonara',9))
add('chiar',['gli spaghetti costano 9','carbonara 10'],P('Spaghetti alla carbonara',10),{note:'discutibile: la risposta contiene un comando completo, vale il nuovo prezzo'})
add('chiar',['gli spaghetti costano 9','annullare'],NONE,{reply:/annull/i})

// D) Nome del piatto nuovo preservato
add('nome','aggiungi ai piatti di prova il piatto Piatto della casa a 11',CR('Piatto della casa',11,'Piatti di prova'))
add('nome','nei piatti di prova aggiungi il piatto "Piatto ricco" a 13',CR('Piatto ricco',13,'Piatti di prova'))
add('nome','aggiungi tra i secondi «Piatto del pastore» a 15',CR('Piatto del pastore',15,'Secondi'),{note:'tra virgolette: nessuna parola tolta'})
add('nome','aggiungi tra i secondi il piatto "Piatto del pastore" a 15',CR('Piatto del pastore',15,'Secondi'))
add('nome','aggiungi tra i primi il piatto Piatto forte della casa a 14',CR('Piatto forte della casa',14,'Primi'),{note:'«il piatto» introduttivo tolto una volta sola'})
add('nome','aggiungi tra gli antipasti il piatto Piattino misto a 9',CR('Piattino misto',9,'Antipasti'))
add('nome','aggiungi tra i piatti di prova il piatto Test QA a 9',CR('Test QA',9,'Piatti di prova'))
add('nome','aggiungi nella categoria Piatti di prova il piatto Piatto test QB a 8 euro',CR('Piatto test QB',8,'Piatti di prova'))
add('nome',V('aggiungi nella categoria piatti di prova il piatto piatto di mare a dodici euro'),CR('Piatto di mare',12,'Piatti di prova'))
add('nome',V('aggiungi tra i secondi il piatto piatto del contadino a quindici euro'),CR('Piatto del contadino',15,'Secondi'))
add('nome','aggiungi tra i primi “Pasta e patate” a 10',CR('Pasta e patate',10,'Primi'))
add('nome','aggiungi tra i primi il piatto Pasta e ceci a 10',CR('Pasta e ceci',10,'Primi'))
add('nome','aggiungi tra le pizze la pizza "Pizza 5 formaggi" a 10',CR('Pizza 5 formaggi',10,'Pizze'))
add('nome','aggiungi tra le pizze la Pizza 5 formaggi a 10',CR('Pizza 5 formaggi',10,'Pizze'),{note:'numero nel nome'})
add('nome','aggiungi nei dolci «Torta 3 cioccolati» a 6',CR('Torta 3 cioccolati',6,'Dolci'))
add('nome','aggiungi tra le bibite "Birra 0,33" a 4',CR('Birra 0,33',4,'Bibite'))
add('nome',"aggiungi tra i secondi 'Pollo al curry' a 13",CR('Pollo al curry',13,'Secondi'),{note:'apici semplici'})
add('nome','aggiungi tra i piatti di prova il piatto Piatto di verifica 2 a 9',CR('Piatto di verifica 2',9,'Piatti di prova'),{note:'nome che contiene un piatto esistente'})
add('nome','aggiungi ai primi il piatto Pasta al ragù bianco a 13',CR('Pasta al ragù bianco',13,'Primi'))
add('nome','aggiungi tra i piatti di prova un nuovo piatto: Piatto test QA3 a 9',CR('Piatto test QA3',9,'Piatti di prova'))
add('nome','aggiungi tra i piatti di prova il piatto Piatto test QA, 9 euro',CR('Piatto test QA',9,'Piatti di prova'))
add('nome','ciao aggiungi tra i piatti di prova il piatto Piatto test QA a 9 euro grazie mille 😊',CR('Piatto test QA',9,'Piatti di prova'))
add('nome','Aggiungi Tra I Piatti Di Prova Il Piatto Piatto Test QA A 9 Euro',CR('Piatto Test QA',9,'Piatti di prova'),{note:'maiuscole iniziali ovunque'})
add('nome','aggiungi tra i piatti di prova il piatto PIATTO TEST QA a 9',CR('PIATTO TEST QA',9,'Piatti di prova'),{note:'discutibile: maiuscolo come scritto'})
add('nome','aggiungi nei piatti di prova piatto test qa a 9 euro',CR('Piatto test qa',9,'Piatti di prova'),{note:'senza «il piatto»: «piatto» fa parte del nome'})
add('nome','aggiungi nei piatti di prova il piatto piatto test qa a 9 euro',CR('Piatto test qa',9,'Piatti di prova'))
add('nome','aggiungi nei piatti di prova il piatto test qa a 9 euro',CR('Test qa',9,'Piatti di prova'))
add('nome','aggiungi nei piatti di prova il piatto chiamato Piatto test QA a 9',CR('Piatto test QA',9,'Piatti di prova'))
add('nome','aggiungi nei piatti di prova il piatto di nome Piatto test QA a 9',CR('Piatto test QA',9,'Piatti di prova'))
add('nome','metti nel menu tra i secondi il piatto Piatto di carne a 16',CR('Piatto di carne',16,'Secondi'))
add('nome','nuovo piatto tra i secondi: Piatto di carne, 16 euro',CR('Piatto di carne',16,'Secondi'))
add('nome','aggiungi un piatto nei secondi, si chiama Piatto di carne, costa 16',CR('Piatto di carne',16,'Secondi'))
add('nome',['aggiungi nei piatti di prova il piatto Piatto test QA','costa 9'],CR('Piatto test QA',9,'Piatti di prova'))
add('nome',['aggiungi il piatto «Piatto test QA» a 9','nei piatti di prova'],CR('Piatto test QA',9,'Piatti di prova'))
add('nome',['aggiungi tra i secondi un piatto a 16','Piatto di carne'],CR('Piatto di carne',16,'Secondi'))
add('nome',['aggiungi tra i secondi un piatto a 16','il piatto si chiama Piatto di carne'],CR('Piatto di carne',16,'Secondi'))
add('nome','aggiungi tra i secondi il piatto Piatto di carne a 16 e il piatto Piatto di pesce a 18',[CR('Piatto di carne',16,'Secondi'),CR('Piatto di pesce',18,'Secondi')])
add('nome','aggiungi tra i dolci il piatto «Dolce della casa» a 6',CR('Dolce della casa',6,'Dolci'))
add('nome',"aggiungi tra i primi il piatto Spaghetti all'assassina a 12",CR("Spaghetti all'assassina",12,'Primi'))
add('nome','aggiungi tra gli antipasti il piatto Frittatina di pasta a 4 🍝',CR('Frittatina di pasta',4,'Antipasti'))
add('nome',V('aggiungi nei primi il piatto pasta e patate con la provola a dieci euro'),CR('Pasta e patate con la provola',10,'Primi'))
add('nome','aggiungi tra i piatti di prova il piatto Piatto a 5',CR('Piatto',5,'Piatti di prova'),{note:'tolto «il piatto» resta «Piatto»'})
add('nome','aggiungi tra i secondi il piatto “Piatto di carne” a 16',CR('Piatto di carne',16,'Secondi'))
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
 writeFileSync(new URL('results-round5b.json',dir),JSON.stringify({cases:C.length,runs:results.length,unknownSql:[...new Set(S.unknownSql)],results},null,1))})

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

describe('bot titolare: verifica avversaria, quinto giro bis (frasi nuove, QA WhatsApp 17/10)',()=>{
 it('ha tra 150 e 200 casi nuovi (quinto giro)',()=>{expect(C.length).toBeGreaterThanOrEqual(150);expect(C.length).toBeLessThanOrEqual(200)})
 for(const cs of C)it(`${cs.id}: ${cs.turns.map(label).join(' ⏎ ').slice(0,90)}`,async()=>{
  const ideal=await run(cs,'ideal'),fails=[...ideal.fails.map(x=>`[ideal] ${x.sev} ${x.why}`)]
  if(ideal.aiCalls>0)for(const mode of ['empty','wrong','wrongCreate'] as AiMode[]){const r=await run(cs,mode);fails.push(...r.fails.map(x=>`[${mode}] ${x.sev} ${x.why}`))}
  expect(fails,`risposte: ${JSON.stringify(ideal.replies)}\nscritto: ${JSON.stringify(ideal.actual)}`).toEqual([])
 })
})
