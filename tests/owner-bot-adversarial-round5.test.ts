// Verifica avversaria del bot WhatsApp del TITOLARE — QUINTO GIRO (17/10/2026, edge v107): i 4 bug del collaudo WhatsApp reale
// sul QA (prezzi alternativi «13 o 14?», clausole negate «non cambiare boh; …», risposta a «Quale piatto intendi?» che perdeva
// l'operazione, nome del piatto nuovo «Piatto test QA» diventato «Test QA») e tutta la loro famiglia, più le domande che non scrivono.
// Webhook firmato vero (router + NLU + validatori veri), DB e documento menu in memoria, Groq/Whisper/Twilio finti, orologio fisso.
// Ogni caso gira con un modello «ideale» e, quando passa dall'IA, anche con modelli che rispondono male
// (JSON vuoto, azione su un piatto sbagliato, creazione inventata). Nessuna rete, nessun DB reale, nessun deploy.
// Risultati: docs/webapp/owner-bot-verify-2026-10-16/results-round5.json (scritto a fine run).
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

// A) Prezzi alternativi: domanda, mai scrittura (caso 1 del QA)
add('alt','piatto di verifica 13 o 14?',NONE,{reply:/13.*14/,note:'QA 17/10 10:43'})
add('alt','carbonara 13 o 14?',NONE,{reply:/13.*14/})
add('alt','metti la carbonara a 13 o 14 euro',NONE,{reply:ASK})
add('alt','la carbonara a 13 oppure 14',NONE,{reply:ASK})
add('alt','carbonara 13/14',NONE,{reply:ASK})
add('alt','metti la lasagna tra 11 e 12 euro',NONE,{reply:ASK})
add('alt','la tagliata la mettiamo a 19 o 20?',NONE,{reply:/19.*20/})
add('alt',V('la tagliata mettila a diciannove o venti euro'),NONE,{reply:ASK})
add('alt',V('piatto di verifica tredici o quattordici'),NONE,{reply:/tredici.*quattordici/})
add('alt','metti il tiramisù a 5,50 o 6',NONE,{reply:ASK})
add('alt','la diavola 9 o 9,50?',NONE,{reply:/9.*9,50/})
add('alt','boh 21 o 22',NONE,{reply:ASK})
add('alt','che ne sacc a 21 oppure 22 euro',NONE,{reply:ASK})
add('alt','pasta al ragù 12 o 13 euro?',NONE,{reply:/12.*13/})
add('alt','margherita 7/7,50',NONE,{reply:ASK})
add('alt','cotoletta 15 o 16 non so',NONE,{reply:ASK})
add('alt','mettiamo la carbonara a 13 o forse 14',NONE,{reply:ASK})
add('alt','capricciosa tra 10 e 11',NONE,{reply:ASK})
add('alt','porta la panna cotta a 5 o 6 euro',NONE,{reply:ASK})
add('alt','il prezzo della lasagna 12 o 13?',NONE,{reply:/12.*13/})
add('alt','cambia il prezzo del piatto di verifica a 14 o 15',NONE,{reply:ASK})
add('alt',V('allora il piatto di verifica lo mettiamo a tredici euro o quattordici'),NONE,{reply:ASK})
add('alt','carbonaa 13 o 14',NONE,{reply:/13.*14/,note:'refuso nel piatto'})
add('alt','la carbonara 13 o 14 e la lasagna 12',NONE,{reply:ASK,note:'tutta la richiesta resta ferma'})
add('alt','metti la lasagna a 12 e la carbonara a 13 o 14',NONE,{reply:ASK})
add('alt','gli spaghetti 13 o 14',NONE,{reply:ASK,note:'due spaghetti: né piatto né prezzo scelti'})
add('alt','13 o 14?',NONE,{reply:ASK})
add('alt','la carbonara a 13 euro o 14 euro',NONE,{reply:ASK})
add('alt','carbonara: 13 o 14 euro, decidi tu',NONE,{reply:ASK})
add('alt',V('metti la diavola a nove o dieci'),NONE,{reply:ASK})
add('alt','pizza 4 formaggi a 10 o 11',NONE,{reply:/Pizza 4 formaggi/})
add('alt','metti la carbonara a 13, la lasagna a 12 o 13',NONE,{reply:ASK})
add('alt','tiramisù 5 o 6 euro?',NONE,{reply:/5.*6/})
add('alt','la cotoletta costa 15 o 16?',NONE,{reply:/15.*16/})
add('alt',V('il piatto di verifica a tredici oppure a quattordici'),NONE,{reply:ASK})
// risposte alla domanda sul prezzo (caso 3 per il prezzo)
add('altrisp',['carbonara 13 o 14?','14'],P('Spaghetti alla carbonara',14))
add('altrisp',['metti la carbonara a 13 o 14 euro','13'],P('Spaghetti alla carbonara',13))
add('altrisp',['piatto di verifica 13 o 14?','quattordici'],P('Piatto di verifica',14))
add('altrisp',['la lasagna tra 11 e 12 euro','il secondo'],P('Lasagna al forno',12))
add('altrisp',['la lasagna tra 11 e 12 euro','12 euro'],P('Lasagna al forno',12))
add('altrisp',['tiramisù 5 o 6?',V('sei euro')],P('Tiramisù',6))
add('altrisp',['boh 21 o 22','ok 22'],P('boh',22))
add('altrisp',['carbonara 13 o 14?','15'],NONE,{reply:/rispondi/i})
add('altrisp',['carbonara 13 o 14?','annulla'],NONE,{reply:/annull/i})
add('altrisp',['carbonara 13 o 14?',W(11),'14'],NONE,{note:'domanda scaduta: «14» da solo non scrive'})
add('altrisp',['carbonara 13 o 14?','la lasagna è finita'],AV('Lasagna al forno',false))
add('altrisp',['carbonara 13 o 14?','ok'],NONE,{reply:/13.*14/})
add('altrisp',['margherita 7/7,50','7,50'],P('Margherita',7.5))
// controlli: niente falsi allarmi
add('altok','metti la carbonara in promo a 10 fino al 20/10',PRu('Spaghetti alla carbonara',10,dateOf(10,20)))
add('altok','la carbonara costa 13',P('Spaghetti alla carbonara',13))
add('altok','quanto costa la carbonara? 13 o 14?',NONE,{reply:/12,00/})
add('altok','gnocchi 4 formaggi 11',P('Gnocchi 4 formaggi',11))
add('altok','metti il piatto di verifica a tredici euro e cinquanta',P('Piatto di verifica',13.5),{mods:{prices:{'Piatto di verifica':14}},note:'QA 17/10 11:13'})

// B) Clausole negate (caso 2 del QA)
add('neg','non cambiare boh; metti il piatto di verifica a tredici euro e cinquanta',P('Piatto di verifica',13.5),{mods:{prices:{'Piatto di verifica':14}},note:'QA 17/10 11:09'})
add('neg',V('non cambiare boh, metti il piatto di verifica a tredici euro e cinquanta'),P('Piatto di verifica',13.5),{mods:{prices:{'Piatto di verifica':14}}})
add('neg','metti il piatto di verifica a 13,50 ma non cambiare boh',P('Piatto di verifica',13.5),{mods:{prices:{'Piatto di verifica':14}}})
add('neg','lascia stare boh, il piatto di verifica a 14',P('Piatto di verifica',14))
add('neg','metti la carbonara a 13, la lasagna no',P('Spaghetti alla carbonara',13))
add('neg','la carbonara a 13 e la lasagna no',P('Spaghetti alla carbonara',13))
add('neg','metti la carbonara a 13 ma non la lasagna',P('Spaghetti alla carbonara',13))
add('neg','non toccare la lasagna, la carbonara è finita',AV('Spaghetti alla carbonara',false))
add('neg',"la lasagna resta com'è, la carbonara costa 13",P('Spaghetti alla carbonara',13))
add('neg','la lasagna rimane così e la tagliata mettila a 20',P('Tagliata di manzo',20))
add('neg','non modificare il tiramisù; panna cotta a 6',P('Panna cotta',6))
add('neg','non cambiare niente',NONE)
add('neg','non cambiare boh',NONE,{reply:/boh/})
add('neg','lascia stare la lasagna',NONE)
add('neg','la diavola non la toccare, metti la margherita a 8',P('Margherita',8))
add('neg','nascondi il tiramisù, la panna cotta no',HI('Tiramisù',true))
add('neg','la carbonara è finita, la lasagna no',AV('Spaghetti alla carbonara',false))
add('neg',['tutti i primi sono finiti tranne la lasagna','ok'],['Spaghetti alla carbonara','Pasta e fagioli','Spaghetti aglio olio e peperoncino','Gnocchi 4 formaggi','Pasta del giorno'].map(d=>AV(d,false)))
add('neg','metti in promo la carbonara a 10 e non toccare la lasagna',PR('Spaghetti alla carbonara',10))
add('neg','non cambiare il prezzo della lasagna, la carbonara a 13',P('Spaghetti alla carbonara',13))
add('neg','boh no, piatto di verifica a 14',P('Piatto di verifica',14))
add('neg',"che ne sacc lascialo com'è, boh a 21",P('boh',21))
add('neg','senza toccare la carbonara metti la lasagna a 12',P('Lasagna al forno',12))
add('neg','lascia perdere il tiramisù; la panna cotta è finita',AV('Panna cotta',false))
add('neg','nascondi tutte le bibite tranne la birra',[HI('Acqua 0,5 l',true),HI('Coca Cola 33cl',true)])
add('neg',['tutte le pizze sono finite tranne la diavola','ok'],['Margherita','Pizza 4 formaggi','Capricciosa','Margherita con bufala','Pizza del lunedì','Pizza mezzo metro'].map(d=>AV(d,false)))
add('neg',V('non mi cambiare la carbonara, la lasagna mettila a dodici'),P('Lasagna al forno',12))
add('neg','la carbonara a 13, la lasagna lasciala stare',P('Spaghetti alla carbonara',13))
add('neg','la tagliata resta a 18, la cotoletta a 16',P('Cotoletta alla milanese',16))
add('neg','non cambiare boh e che ne sacc, piatto di verifica a 15',P('Piatto di verifica',15))
add('neg','non cambiare il prezzo del piatto di verifica, mettilo in promo a 12',PR('Piatto di verifica',12),{note:'pronome: il testo resta intero, si esclude solo il prezzo'})
add('neg','boh no',NONE,{reply:/boh/})
add('neg','tranne la lasagna',NONE)
add('neg','la carbonara è finita ma non la lasagna',AV('Spaghetti alla carbonara',false))
add('neg','metti in evidenza la tagliata ma la cotoletta no',FE('Tagliata di manzo',true))
add('neg','metti la carbonara a 13 e lascia stare la lasagna',P('Spaghetti alla carbonara',13))
add('neg',"lascia com'è la lasagna e porta la carbonara a 13",P('Spaghetti alla carbonara',13))
add('neg',"'a lasagna lassala stà, 'a carbonara a 13",P('Spaghetti alla carbonara',13),{note:'napoletano'})
add('neg','non cambiare la carbonara, mettila a 13',NONE,{note:'contraddizione: il piatto negato non si cambia mai'})
add('neg','nascondi il caffè e il cappuccino no',HI('Caffè',true))
add('neg',V('il tiramisù lascialo stare e la panna cotta è finita'),AV('Panna cotta',false))
add('neg','piatto di verifica a 14, boh resta a 20',P('Piatto di verifica',14))
add('neg','tranne boh, metti tutti i piatti di prova a 15',NONE,{reply:/tutt/i})
// Gate Groq del 17/10: il modello vero ha risposto set_price su boh. Il piatto negato non si cambia comunque.
add('neg','non cambiare boh, mettilo a 25',NONE,{ai:()=>({intent:'change',actions:[{action:'set_price',item_id:ID['boh'],price:25}]}),note:'risposta reale di gpt-oss al gate'})
add('neg',V('non toccare boh e mettilo a venticinque'),NONE,{ai:()=>({intent:'change',actions:[{action:'set_price',item_id:ID['boh'],price:25}]})})
add('neg','non toccare il piatto di verifica; boh è finito',[AV('boh',false),LP('boh',false)],{note:'finito toglie anche «ultime porzioni» (regola esistente)'})
add('neg','la carbonara costa 13 però la lasagna non toccarla',P('Spaghetti alla carbonara',13),{note:'«non toccarla» non è nei modi coperti: niente scrittura sulla lasagna in ogni caso'})
add('neg','nn cambiare boh, piatto di verifica a 14',P('Piatto di verifica',14),{note:'«nn» scritto veloce'})

// C) Risposta a «Quale piatto intendi?» (caso 3 del QA)
add('chiar',['gli spaghetti costano 13','Spaghetti alla carbonara'],P('Spaghetti alla carbonara',13))
add('chiar',['gli spaghetti costano 13','spaghetti aglio olio e peperoncino'],P('Spaghetti aglio olio e peperoncino',13))
add('chiar',['gli spaghetti costano 13','Piatto di verifica'],NONE,{reply:BAD})
add('chiar',['gli spaghetti costano 13','la tagliata'],NONE,{reply:BAD})
add('chiar',['gli spaghetti costano 13','5'],NONE,{reply:BAD})
add('chiar',['gli spaghetti costano 13',W(11),'quelli alla carbonara'],NONE)
add('chiar',['gli spaghetti costano 13','la lasagna è finita'],AV('Lasagna al forno',false))
add('chiar',['metti il tiramisù a 6 come la panna cotta','il tiramisù'],P('Tiramisù',6),{ai:priceAi('Tiramisù',6),note:'chiarimento dal validatore: l\'azione resta in sospeso'})
add('chiar',['metti il tiramisù a 6 come la panna cotta','1'],P('Tiramisù',6),{ai:priceAi('Tiramisù',6)})
add('chiar',['metti il tiramisù a 6 come la panna cotta','la panna cotta'],P('Panna cotta',6),{ai:priceAi('Tiramisù',6)})
add('chiar',['metti il tiramisù a 6 come la panna cotta','la tagliata'],NONE,{ai:priceAi('Tiramisù',6),reply:BAD})
add('chiar',['metti il tiramisù a 6 come la panna cotta','annulla'],NONE,{ai:priceAi('Tiramisù',6),reply:/annull/i})
add('chiar',['metti il tiramisù a 6 come la panna cotta',W(11),'1'],NONE,{ai:priceAi('Tiramisù',6)})
add('chiar',['metti il piatto di verifica a 13,50 come boh','Piatto di verifica'],P('Piatto di verifica',13.5),{ai:priceAi('Piatto di verifica',13.5),mods:{prices:{'Piatto di verifica':14}},note:'come il QA: risposta col nome del piatto'})
add('chiar',['metti il piatto di verifica a 13,50 come boh','boh'],P('boh',13.5),{ai:priceAi('Piatto di verifica',13.5),mods:{prices:{'Piatto di verifica':14}}})
add('chiar',['metti il piatto di verifica a 13,50 come boh',V('piatto di verifica')],P('Piatto di verifica',13.5),{ai:priceAi('Piatto di verifica',13.5),mods:{prices:{'Piatto di verifica':14}}})
add('chiar',['non cambiare boh; metti il piatto di verifica a tredici euro e cinquanta','Piatto di verifica'],P('Piatto di verifica',13.5),{mods:{prices:{'Piatto di verifica':14}},note:'sequenza esatta del QA (11:09 → 11:11)'})
add('chiar',['la pizza costa 10','la diavola'],P('Diavola',10))
add('chiar',['il dolce è finito','il tiramisù'],AV('Tiramisù',false))
add('chiar',['il dolce è finito','la torta'],NONE)
add('chiar',['nascondi gli spaghetti','quelli alla carbonara'],HI('Spaghetti alla carbonara',true))
add('chiar',['il primo del pranzo costa 12','la lasagna'],P('Lasagna al forno',12))
add('chiar',['il menù costa 16','2'],P('Menù bambini',16))
add('chiar',['gli spaghetti costano 13',V('spaghetti alla carbonara')],P('Spaghetti alla carbonara',13))
add('chiar',['gli spaghetti costano 13','ok'],NONE,{reply:/numero|nome/i})
add('chiar',['gli spaghetti costano 13','carbonara','anche la lasagna'],[P('Spaghetti alla carbonara',13),P('Lasagna al forno',13)])
add('chiar',['metti in promo gli spaghetti a 7','quelli aglio e olio'],PR('Spaghetti aglio olio e peperoncino',7))
add('chiar',['gli spaghetti sono finiti','il secondo'],AV('Spaghetti aglio olio e peperoncino',false))
add('chiar',['gli spaghetti costano 13','il terzo'],NONE,{reply:BAD})

// D) Nome del piatto nuovo preservato (caso 4 del QA)
add('nome','aggiungi nella categoria Piatti di prova il piatto Piatto test QA a 9 euro',CR('Piatto test QA',9,'Piatti di prova'),{note:'QA 17/10 10:56'})
add('nome',V('aggiungi nella categoria piatti di prova il piatto piatto test qa a nove euro'),CR('Piatto test qa',9,'Piatti di prova'))
add('nome','aggiungi tra i primi il piatto «Pasta della nonna» a 12',CR('Pasta della nonna',12,'Primi'))
add('nome','aggiungi tra i secondi "Pollo alla diavola" a 14 euro',CR('Pollo alla diavola',14,'Secondi'))
add('nome','aggiungi tra le pizze “Pizza 4 stagioni” 9 euro',CR('Pizza 4 stagioni',9,'Pizze'))
add('nome','aggiungi il piatto Piatto unico della casa nei secondi a 16',CR('Piatto unico della casa',16,'Secondi'))
add('nome','aggiungi nei primi il piatto Piatto del pescatore a 18',CR('Piatto del pescatore',18,'Primi'))
add('nome','aggiungi tra gli antipasti il piatto La Bruschettona a 7',CR('La Bruschettona',7,'Antipasti'))
add('nome','aggiungi tra i dolci il piatto torta della nonna a 5',CR('Torta della nonna',5,'Dolci'))
add('nome','aggiungi il piatto piatto freddo tra gli antipasti a 8',CR('Piatto freddo',8,'Antipasti'))
add('nome','aggiungi piatto Piatto test QA tra i piatti di prova a 9',CR('Piatto test QA',9,'Piatti di prova'))
add('nome','aggiungi tra i piatti di prova Piatto test QA a 9',CR('Piatto test QA',9,'Piatti di prova'))
add('nome','aggiungi il piatto "Piatto test QA" nei piatti di prova a 9 euro',CR('Piatto test QA',9,'Piatti di prova'))
add('nome','aggiungi nella categoria Piatti di prova il piatto Piatto di prova 2 a 9 euro',CR('Piatto di prova 2',9,'Piatti di prova'))
add('nome','aggiungi tra i secondi il piatto Grigliata mista di pesce a 22 euro',CR('Grigliata mista di pesce',22,'Secondi'))
add('nome',V('aggiungi tra i dolci il piatto tiramisù al pistacchio che costa sei euro'),CR('Tiramisù al pistacchio',6,'Dolci'))
add('nome','aggiungi «Spaghetti del pescatore» tra i primi a 16',CR('Spaghetti del pescatore',16,'Primi'))
add('nome','aggiungi tra le bibite "Acqua 1 l" a 2,50',CR('Acqua 1 l',2.5,'Bibite'))
add('nome','aggiungi nei piatti di prova un piatto chiamato Piatto test QA a 9',CR('Piatto test QA',9,'Piatti di prova'))
add('nome','aggiungi tra i secondi il piatto Tagliata di tonno a 20',CR('Tagliata di tonno',20,'Secondi'))
add('nome',['aggiungi nella categoria Piatti di prova il piatto Piatto test QA','9 euro'],CR('Piatto test QA',9,'Piatti di prova'))
add('nome',['aggiungi il piatto Piatto test QA a 9 euro','piatti di prova'],CR('Piatto test QA',9,'Piatti di prova'))
add('nome',['aggiungi tra i piatti di prova un piatto a 9 euro','Piatto test QA'],CR('Piatto test QA',9,'Piatti di prova'))
add('nome',['aggiungi tra i piatti di prova un piatto a 9 euro','si chiama Piatto test QA'],CR('Piatto test QA',9,'Piatti di prova'))
add('nome','aggiungi tra i primi il piatto «Gnocchi alla sorrentina» a 11 euro grazie',CR('Gnocchi alla sorrentina',11,'Primi'))
add('nome','mi aggiungi tra i secondi il piatto Polpo alla griglia a 19 per favore',CR('Polpo alla griglia',19,'Secondi'))
add('nome',V('aggiungi tra i secondi il piatto polpo alla griglia a diciannove euro'),CR('Polpo alla griglia',19,'Secondi'))
add('nome','aggiungi tra i dolci il piatto Babà al rum a 5',CR('Babà al rum',5,'Dolci'))
add('nome','aggiungi tra le bibite il piatto Spritz Aperol a 6',CR('Spritz Aperol',6,'Bibite'))
add('nome','inserisci nei piatti di prova il piatto QA finale a 1',CR('QA finale',1,'Piatti di prova'))
add('nome','aggiungi tra i secondi Piatto di mare a 25',CR('Piatto di mare',25,'Secondi'))
add('nome','aggiungi tra i primi piatto Piatto della nonna a 12',CR('Piatto della nonna',12,'Primi'))
add('nome','aggiungi tra i primi il piatto pasta al pesto a 11',CR('Pasta al pesto',11,'Primi'))
add('nome','aggiungi tra i piatti di prova il piatto Piatto test QA 2 a 9,50',CR('Piatto test QA 2',9.5,'Piatti di prova'))
add('nome',"aggiungi tra i secondi il piatto L'arrosto della domenica a 17",CR("L'arrosto della domenica",17,'Secondi'))
add('nome','aggiungi tra gli antipasti «Piatto» a 3',CR('Piatto',3,'Antipasti'),{note:'nome di una sola parola, tra virgolette'})

// E) Domande e letture: mai scrivere (bassi del 16/10 e varianti col menu del QA)
add('dom','cosa è finito?',NONE,{reply:/finit|nessun/i})
add('dom','il piatto di verifica quanto costa?',NONE,{reply:/13,50/})
add('dom','Piatto di verifica',NONE,{reply:/13,50/,note:'QA 17/10 11:11 senza nulla in sospeso'})
add('dom','boh',NONE,{reply:/boh/})
add('dom','la carbonara?',NONE,{reply:/12,00/})
add('dom','la lasagna è ancora disponibile?',NONE,{reply:/lasagna/i})
add('dom','è finito il tiramisù o no?',NONE,{reply:/tiramis/i})
add('dom','quali piatti abbiamo nascosto?',NONE,{reply:/nascost/i})
add('dom','ce la fai a dirmi cosa è finito?',NONE,{reply:/finit|nessun/i})
add('dom','volevo sapere il prezzo del piatto di verifica',NONE,{reply:/13,50/})
add('dom','metti una foto al piatto di verifica',NONE,{reply:/foto/i})
add('dom','aumenta tutti i piatti di prova di un euro',NONE,{reply:/tutt/i})
add('dom','metti il piatto di verifica nei primi',NONE,{reply:/categori|dashboard/i})
add('dom','il coperto passa a 8',NONE,{mustConfirm:true})
add('dom','la carbonara costa 13?',NONE)
add('dom','il piatto di verifica costa ancora 13,50?',NONE)
add('dom','non è finito il piatto di verifica',NONE)
add('dom',"ma boh è finito o c'è ancora?",NONE,{reply:/boh/})
add('dom',V('ce l abbiamo ancora il piatto di verifica'),NONE,{reply:/verifica/i})
add('dom','la pizza 4 formaggi costa 9 o 10?',NONE,{reply:/9.*10/})
add('dom','che ne sacc?',NONE,{reply:/Che ne sacc/})
add('dom','pasta al ragù',NONE,{reply:/12,00/})
add('dom','ti volevo chiedere se il piatto di verifica costa sempre 13,50',NONE,{reply:/13,50/})

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
 writeFileSync(new URL('results-round5.json',dir),JSON.stringify({cases:C.length,runs:results.length,unknownSql:[...new Set(S.unknownSql)],results},null,1))})

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

describe('bot titolare: verifica avversaria, quinto giro (QA WhatsApp 17/10)',()=>{
 it('ha tra 150 e 200 casi nuovi (quinto giro)',()=>{expect(C.length).toBeGreaterThanOrEqual(150);expect(C.length).toBeLessThanOrEqual(200)})
 for(const cs of C)it(`${cs.id}: ${cs.turns.map(label).join(' ⏎ ').slice(0,90)}`,async()=>{
  const ideal=await run(cs,'ideal'),fails=[...ideal.fails.map(x=>`[ideal] ${x.sev} ${x.why}`)]
  if(ideal.aiCalls>0)for(const mode of ['empty','wrong','wrongCreate'] as AiMode[]){const r=await run(cs,mode);fails.push(...r.fails.map(x=>`[${mode}] ${x.sev} ${x.why}`))}
  expect(fails,`risposte: ${JSON.stringify(ideal.replies)}\nscritto: ${JSON.stringify(ideal.actual)}`).toEqual([])
 })
})
