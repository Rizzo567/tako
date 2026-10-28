// Verifica avversaria del bot WhatsApp del TITOLARE — SECONDO GIRO (16/10/2026, edge v99): 120+ casi nuovi mirati ai fix
// (domande senza «?», negazioni, «scusa», prezzi oltre 3×, nomi con offerta/menu/nuovo/del giorno, parole generiche,
// memoria oltre 10 minuti o dopo un cambio da dashboard, conversazioni lunghe, due titolari in contemporanea, promo+scarsità+menu intero).
// Webhook firmato vero (router + NLU + validatori veri), DB e documento menu in memoria, Groq/Whisper/Twilio finti.
// Ogni caso gira con un modello «ideale» e, quando passa dall'IA, anche con modelli che rispondono male
// (JSON vuoto, azione su un piatto sbagliato, creazione inventata). Nessuna rete, nessun DB reale, nessun deploy.
// Risultati: docs/webapp/owner-bot-verify-2026-10-16/results.json (scritto a fine run).
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

const S=vi.hoisted(()=>({draft:null as any,published:null as any,revision:5,published_revision:5,proposals:new Map<string,{revision:number,command:any}>(),messages:new Map<string,string>(),links:new Set<string>(),unknownSql:[] as string[],offset:0,B:{draft:null as any,published:null as any,revision:5,published_revision:5}}))
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
 if(text.startsWith('SELECT revision,label,snapshot FROM menu_workspace_versions'))return[]
 if(text.startsWith('INSERT INTO tako_whatsapp_ai_usage'))return[{requests:1,prompt_tokens:0,completion_tokens:0,audio_seconds:0,warned_at:null}]
 if(text.startsWith('INSERT INTO tako_whatsapp_errors'))return[{id:1}]
 if(text.startsWith('SELECT count(*)::int AS n FROM tako_whatsapp_errors'))return[{n:0}]
 if(text.startsWith('INSERT INTO tako_whatsapp_alerts'))return[]
 S.unknownSql.push(text.slice(0,90));return[]}
vi.mock('../packages/db/src/index.ts',()=>({db:{execute:(q:unknown)=>execute(q),transaction:(fn:any)=>fn({execute})},sessions:{},users:{}}))
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',()=>({
 readWorkspace:async(t:string)=>{const X:any=t==='36050ecd-2e55-4057-a4c5-bff2b449cd48'?S.B:S;return{draft:structuredClone(X.draft),published:structuredClone(X.published),revision:X.revision,published_revision:X.published_revision}},
 mutateWorkspace:async(t:string,_a:string,expected:number,w:any,publish:boolean)=>{const X:any=t==='36050ecd-2e55-4057-a4c5-bff2b449cd48'?S.B:S;if(expected!==X.revision)throw new Error('Revision conflict');if(publish)X.published=structuredClone(X.draft);else X.draft=structuredClone(w);X.revision++;if(publish)X.published_revision=X.revision;return{revision:X.revision}}}))
import {twilioMenuRoutes} from '../apps/server/src/routes/twilio-menu.js'
const Fastify=createRequire(new URL('../apps/server/package.json',import.meta.url))('fastify')

// ---------------- Fixture: trattoria con Pranzo, Cena, Bevande ----------------
const PRANZO='66666666-6666-4666-8666-000000000001',CENA='66666666-6666-4666-8666-000000000002',BEV='66666666-6666-4666-8666-000000000003'
const sid8=(n:number)=>`77777777-7777-4777-8777-${String(n).padStart(12,'0')}`,iid=(n:number)=>`55555555-5555-4555-8555-${String(n).padStart(12,'0')}`
const SECTIONS:[number,string,string][]=[[1,PRANZO,'Antipasti'],[2,PRANZO,'Primi'],[3,PRANZO,'Secondi'],[4,PRANZO,'Piatti di prova'],[5,CENA,'Pizze'],[6,CENA,'Dolci'],[7,BEV,'Bibite'],[8,BEV,'Caffetteria'],[9,PRANZO,'Offerte'],[10,CENA,'Proposte'],[11,BEV,'Vini']]
const ITEMS:[number,number,string,number][]=[
 [1,1,'Bruschetta al pomodoro',5],[2,1,'Tagliere misto',14],
 [3,2,'Spaghetti alla carbonara',12],[4,2,'Pasta e fagioli',9],[5,2,'Spaghetti aglio olio e peperoncino',8],[6,2,'Lasagna al forno',11],[7,2,'Gnocchi 4 formaggi',10],
 [8,3,'Tagliata di manzo',18],[9,3,'Cotoletta alla milanese',15],[10,3,'Menù del giorno',15],
 [11,4,'Piatto di prova',10],
 [12,5,'Margherita',7],[13,5,'Pizza 4 formaggi',9],[14,5,'Diavola',8.5],[15,5,'Capricciosa',9.5],
 [16,6,'Tiramisù',5],[17,6,'Panna cotta',5],
 [18,7,'Acqua 0,5 l',1.5],[19,7,'Coca Cola 33cl',3],[20,7,'Birra media',5],
 [21,8,'Caffè',1.2],[22,8,'Cappuccino',1.8],
 [23,9,'Offerta pranzo',10],[24,9,'Menù bambini',8],[25,2,'Pasta del giorno',9],[26,10,'Nuovo burger',12],[27,10,'Burger classico',10],[28,10,'Menù degustazione',30],[29,6,'Dolce del giorno',4],[30,9,'Coperto',1],[31,11,'Bottiglia di Brunello',45]]
const ID:Record<string,string>=Object.fromEntries(ITEMS.map(([n,,name])=>[name,iid(n)]))
const SEC:Record<string,string>=Object.fromEntries(SECTIONS.map(([n,,name])=>[name,sid8(n)]))
type Mods={unavail?:string[],hidden?:string[],featured?:string[],tags?:Record<string,string[]>,promo?:Record<string,number>,last?:string[],today?:string[]}
const todayIso=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(new Date())
function fixture(m:Mods={}){
 const menus=[[PRANZO,'Pranzo','lunch'],[CENA,'Cena','dinner'],[BEV,'Bevande','drinks']].map(([id,name,type])=>({id,name,type,sections:SECTIONS.filter(s=>s[1]===id).map(([n,,sname])=>({id:sid8(n),name:sname,items:ITEMS.filter(i=>i[1]===n).map(([k,,iname,price])=>{const it:any={id:iid(k),name:iname,price}
  if(m.unavail?.includes(iname))it.available=false;if(m.hidden?.includes(iname))it.hidden=true;if(m.featured?.includes(iname))it.featured=true;if(m.tags?.[iname])it.tags=m.tags[iname]
  if(m.promo?.[iname]!==undefined)it.promo={price:m.promo[iname],until:null};if(m.last?.includes(iname)||m.today?.includes(iname))it.scarcity={lastPortions:!!m.last?.includes(iname),onlyToday:m.today?.includes(iname)?todayIso:null};return it})}))}))
 return workspaceSchema.parse({menus,design:{}})}

// ---------------- Rete finta: Groq (chat + whisper) e Twilio ----------------
type AiMode='ideal'|'empty'|'wrong'|'wrongCreate'
const net={mode:'ideal' as AiMode,caseNow:null as any,chats:0,transcript:'',sent:[] as string[]}
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
type Change={op:'create',name:string,price:number,section?:string}|{op:'price',dish:string,price:number}|{op:'available'|'hidden'|'featured'|'last'|'today',dish:string,value:boolean}|{op:'description',dish:string,text:string}|{op:'tag',dish:string,tag:string,value:boolean}|{op:'promo',dish:string,price:number|null}|{op:'special',name:string,price:number}
type Turn=string|{v:string}|{b:string}|{wait:number}|{dash:true}
type Case={id:string,cat:string,turns:Turn[],changes:Change[],changesB?:Change[],mustConfirm?:boolean,reply?:RegExp,mods?:Mods,ai?:(msg:string,hasSections:boolean,pending:boolean)=>any,relative?:boolean,fullRows?:{section:string,name:string,price:number}[],note?:string}
const C:Case[]=[]
const add=(cat:string,turns:Turn|Turn[],changes:Change[]|Change,extra:Partial<Case>={})=>C.push({id:`${cat}-${String(C.filter(c=>c.cat===cat).length+1).padStart(2,'0')}`,cat,turns:Array.isArray(turns)?turns:[turns],changes:Array.isArray(changes)?changes:[changes],...extra})
const CR=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const P=(dish:string,price:number):Change=>({op:'price',dish,price})
const AV=(dish:string,value:boolean):Change=>({op:'available',dish,value}),HI=(dish:string,value:boolean):Change=>({op:'hidden',dish,value}),FE=(dish:string,value:boolean):Change=>({op:'featured',dish,value})
const DE=(dish:string,text:string):Change=>({op:'description',dish,text}),TG=(dish:string,tag:string,value=true):Change=>({op:'tag',dish,tag,value})
const PR=(dish:string,price:number|null):Change=>({op:'promo',dish,price}),LP=(dish:string,value:boolean):Change=>({op:'last',dish,value}),OT=(dish:string,value:boolean):Change=>({op:'today',dish,value}),SP=(name:string,price:number):Change=>({op:'special',name,price})
const V=(s:string)=>({v:s})
const NONE:Change[]=[]

// ===== SECONDO GIRO: casi nuovi mirati ai fix di v99 =====
const W=(m:number)=>({wait:m}),DASH={dash:true as const},B=(s:string)=>({b:s})

// Q) Domande senza «?» (spesso da vocale): mai azioni
add('domanda2',V("c'è ancora la carbonara"),NONE,{reply:/carbonara/i})
add('domanda2',V("ce l'abbiamo ancora la tagliata"),NONE,{reply:/tagliata/i})
add('domanda2',V('la lasagna è ancora disponibile'),NONE,{reply:/lasagna/i})
add('domanda2',V('mi dici quanto costa la diavola'),NONE,{reply:/8,50/})
add('domanda2',V('quanto la facciamo pagare la carbonara'),NONE,{reply:/12/})
add('domanda2',V('a quanto sta la tagliata adesso'),NONE,{reply:/18/})
add('domanda2',V('è finito il tiramisù o no'),NONE,{reply:/tiramis/i})
add('domanda2',V('sai se la panna cotta è finita'),NONE,{reply:/panna/i})
add('domanda2',V('dimmi se il caffè è disponibile'),NONE,{reply:/caff/i})
add('domanda2',V('volevo sapere il prezzo della pizza 4 formaggi'),NONE,{reply:/9,00/})
add('domanda2',V('ma la carbonara quanto costa adesso'),NONE,{reply:/12/})
add('domanda2',V('cosa abbiamo di finito oggi'),NONE,{reply:/finit|disponibil|esaurit/i})
add('domanda2',V('quali piatti abbiamo nascosto'),NONE,{reply:/nascost/i})
add('domanda2','ma il tiramisù è finito o ce n è ancora',NONE,{reply:/tiramis/i})
add('domanda2',"c'è ancora pasta e fagioli",NONE,{reply:/fagioli/i})
add('domanda2','abbiamo ancora la birra media',NONE,{reply:/birra/i})
add('domanda2','la carbonara è finita?',NONE,{reply:/carbonara/i})
add('domanda2','il tiramisù è finito',AV('Tiramisù',false),{note:'controllo: affermazione scritta'})
add('domanda2',V('ti volevo chiedere se la cotoletta costa sempre 15'),NONE,{reply:/15|cotoletta/i})
add('domanda2','la carbonara costa 12 vero',NONE,{reply:/12/})

// N) Negazioni dentro frasi lunghe
add('negazione','la carbonara è finita ma non la lasagna',AV('Spaghetti alla carbonara',false))
add('negazione',"non è vero che la lasagna è finita, è finita la tagliata",AV('Tagliata di manzo',false))
add('negazione',"la tagliata non c'è più",AV('Tagliata di manzo',false))
add('negazione','non abbiamo più la panna cotta da stasera',AV('Panna cotta',false))
add('negazione','la lasagna non costa più 11 ma 12',P('Lasagna al forno',12))
add('negazione','non so se la carbonara è finita',NONE)
add('negazione','se non ti dispiace metti la carbonara a 13',P('Spaghetti alla carbonara',13),{note:'«non» di cortesia'})
add('negazione','metti la carbonara a 13 non 14',P('Spaghetti alla carbonara',13))
add('negazione','la diavola non è più piccante',TG('Diavola','piccante',false),{mods:{tags:{Diavola:['piccante']}}})
add('negazione','nascondi la bruschetta che non la facciamo più',HI('Bruschetta al pomodoro',true))
add('negazione','il caffè non lo facciamo più 1,20 ma 1,30',P('Caffè',1.3))
add('negazione','senza dubbio la tagliata è finita',AV('Tagliata di manzo',false))
add('negazione',"non c'è problema, metti la lasagna a 12",P('Lasagna al forno',12))
add('negazione','la cotoletta è finita, non rimetterla fino a domani',AV('Cotoletta alla milanese',false))
add('negazione','non mettere in evidenza la tagliata',NONE)
add('negazione','oggi non abbiamo il tiramisù',AV('Tiramisù',false))
add('negazione',V('nessuno ordina mai la panna cotta nascondila'),HI('Panna cotta',true))
add('negazione','non toccare la carbonara, la lasagna invece mettila a 12',P('Lasagna al forno',12))

// S) «scusa» che non è una correzione, «anche», «no»
add('scusa',['la carbonara costa 13','scusa, la lasagna è finita'],[P('Spaghetti alla carbonara',13),AV('Lasagna al forno',false)])
add('scusa',['metti la carbonara a 13','scusa se ti disturbo, quanto costa la tagliata'],P('Spaghetti alla carbonara',13),{reply:/18/})
add('scusa',['la tagliata è finita','scusa il ritardo, la cotoletta costa 16'],[AV('Tagliata di manzo',false),P('Cotoletta alla milanese',16)])
add('scusa',['nascondi la bruschetta','scusa ancora, metti in evidenza la tagliata'],[HI('Bruschetta al pomodoro',true),FE('Tagliata di manzo',true)])
add('scusa',['la carbonara costa 13','scusami tanto grazie'],P('Spaghetti alla carbonara',13))
add('scusa','scusa ma la panna cotta è finita',AV('Panna cotta',false))
add('scusa',['la carbonara costa 13','no'],P('Spaghetti alla carbonara',13))
add('scusa',['la carbonara costa 13','ok grazie'],P('Spaghetti alla carbonara',13))
add('scusa',['la carbonara è finita','scusa, anche la lasagna'],[AV('Spaghetti alla carbonara',false),AV('Lasagna al forno',false)])
add('scusa',['la carbonara costa 13','anche la lasagna è finita'],[P('Spaghetti alla carbonara',13),AV('Lasagna al forno',false)],{note:'«anche» con comando completo: niente 13 sulla lasagna'})
add('scusa',['la carbonara costa 13','anche la tagliata costa 20'],[P('Spaghetti alla carbonara',13),P('Tagliata di manzo',20)])
add('scusa',['la carbonara costa 13','anche'],P('Spaghetti alla carbonara',13))
add('scusa',['la tagliata è finita','anche la cotoletta'],[AV('Tagliata di manzo',false),AV('Cotoletta alla milanese',false)])
add('scusa',['nascondi la bruschetta','anche il tagliere misto'],[HI('Bruschetta al pomodoro',true),HI('Tagliere misto',true)])
add('scusa',['la carbonara costa 13','scusa la lasagna invece costa 12'],[P('Spaghetti alla carbonara',13),P('Lasagna al forno',12)])
add('scusa',['la carbonara costa 13','scusa no 13,50'],P('Spaghetti alla carbonara',13.5))
add('scusa',['la carbonara costa 13','no aspetta, lascia stare'],NONE,{note:'ritiro: tornare a 12 o chiedere'})
add('scusa',['metti in evidenza la tagliata','anche la lasagna'],[FE('Tagliata di manzo',true),FE('Lasagna al forno',true)])

// P) Prezzi oltre 3× (realistici) e sospetti
add('prezzo3x','il menù degustazione passa da 30 a 95',P('Menù degustazione',95),{note:'realistico, oltre 3×'})
add('prezzo3x',['il menù degustazione passa da 30 a 95','ok'],P('Menù degustazione',95))
add('prezzo3x','il menù degustazione costa 95 euro',P('Menù degustazione',95))
add('prezzo3x','il coperto passa a 3,50',P('Coperto',3.5))
add('prezzo3x','il brunello costa 140',P('Bottiglia di Brunello',140))
add('prezzo3x','la bottiglia di brunello passa a 150 euro',P('Bottiglia di Brunello',150))
add('prezzo3x','il tagliere misto costa 140',NONE,{mustConfirm:true,note:'14 → 140: refuso probabile'})
add('prezzo3x','il caffè costa 12',NONE,{mustConfirm:true,note:'1,20 → 12: refuso probabile'})
add('prezzo3x','la carbonara costa 120',NONE,{mustConfirm:true})
add('prezzo3x','aggiungi tra le proposte il menù degustazione di pesce a 85 euro',CR('Menù degustazione di pesce',85,'Proposte'))
add('prezzo3x','aggiungi tra i vini il barolo riserva a 600 euro',NONE,{mustConfirm:true})
add('prezzo3x','il coperto passa a 3',P('Coperto',3))
add('prezzo3x',V('il menù degustazione da stasera costa novantacinque euro'),P('Menù degustazione',95))

// O) Nomi con offerta / menu / nuovo / del giorno
add('nomi','nuovo burger a 13',P('Nuovo burger',13))
add('nomi','il nuovo burger costa 13 euro',P('Nuovo burger',13))
add('nomi','il nuovo burger è finito',AV('Nuovo burger',false))
add('nomi','nascondi il nuovo burger',HI('Nuovo burger',true))
add('nomi','metti in evidenza il nuovo burger',FE('Nuovo burger',true))
add('nomi','nuovo burger in promo a 10',PR('Nuovo burger',10))
add('nomi','offerta pranzo a 11',P('Offerta pranzo',11))
add('nomi',"l'offerta pranzo costa 11 euro",P('Offerta pranzo',11))
add('nomi',"l'offerta pranzo è finita",AV('Offerta pranzo',false))
add('nomi',"nascondi l'offerta pranzo",HI('Offerta pranzo',true))
add('nomi',"metti l'offerta pranzo in promo a 9",PR('Offerta pranzo',9))
add('nomi',"togli la promo dall'offerta pranzo",PR('Offerta pranzo',null),{mods:{promo:{'Offerta pranzo':9}}})
add('nomi','il menù degustazione è finito',AV('Menù degustazione',false))
add('nomi','menù degustazione a 35',P('Menù degustazione',35))
add('nomi','nascondi il menù bambini',HI('Menù bambini',true))
add('nomi','il menù bambini costa 9',P('Menù bambini',9))
add('nomi','la pasta del giorno costa 10',P('Pasta del giorno',10),{note:'piatto esistente, non piatto del giorno nuovo'})
add('nomi','la pasta del giorno è finita',AV('Pasta del giorno',false))
add('nomi','pasta del giorno a 10 euro',P('Pasta del giorno',10))
add('nomi','il dolce del giorno è finito',AV('Dolce del giorno',false))
add('nomi','dolce del giorno 5 euro',P('Dolce del giorno',5))
add('nomi','nella pasta del giorno scrivi: oggi amatriciana',DE('Pasta del giorno','oggi amatriciana'))
add('nomi','aggiungi tra le proposte il burger vegano a 11',CR('Burger vegano',11,'Proposte'))
add('nomi',"aggiungi tra le offerte l'offerta cena a 15 euro",CR('Offerta cena',15,'Offerte'))
add('nomi','aggiungi tra i primi la pasta del giorno di venerdì a 10',CR('Pasta del giorno di venerdì',10,'Primi'))
add('nomi','aggiungi tra le offerte il menù della domenica a 25',CR('Menù della domenica',25,'Offerte'))
add('nomi','metti nel menu il nuovo burger',HI('Nuovo burger',false),{mods:{hidden:['Nuovo burger']}})
add('nomi',"rimetti nel menu l'offerta pranzo",HI('Offerta pranzo',false),{mods:{hidden:['Offerta pranzo']}})
add('nomi','il menù bambini in promo a 7 fino a domenica',PR('Menù bambini',7))
add('nomi','ultime porzioni di pasta del giorno',LP('Pasta del giorno',true))

// G) Una sola parola generica
add('generico','il burger costa 11',NONE,{reply:/quale|1\./i})
add('generico',['il burger costa 11','il classico'],P('Burger classico',11))
add('generico','la pasta è finita',NONE,{reply:/quale|1\./i})
add('generico','la pizza costa 10',NONE,{reply:/quale|pizz/i})
add('generico','gli spaghetti sono finiti',NONE,{reply:/quale|1\./i})
add('generico','il menù costa 16',NONE,{reply:/quale|1\.|menù/i})
add('generico','il dolce è finito',NONE,{reply:/quale|1\.|dolce/i})
add('generico',"l'acqua è finita",AV('Acqua 0,5 l',false))
add('generico','la birra costa 6',P('Birra media',6))
add('generico','il caffè è finito',AV('Caffè',false))
add('generico','nascondi la pasta',NONE,{reply:/quale|1\./i})
add('generico','metti in promo il burger a 9',NONE,{reply:/quale|1\./i})
add('generico','ultime porzioni di pasta',NONE,{reply:/quale|1\./i})
add('generico','il vino costa 50',NONE)

// M) Memoria: oltre 10 minuti, dopo un cambio dalla dashboard, scadenze delle proposte
add('memoria',['la carbonara costa 13',W(11),'no scusa 14'],P('Spaghetti alla carbonara',13),{note:'oltre 10 minuti: non va collegato in silenzio'})
add('memoria',['la carbonara costa 13',W(9),'no scusa 14'],P('Spaghetti alla carbonara',14))
add('memoria',['la carbonara è finita',W(11),'scusa no era la lasagna'],AV('Spaghetti alla carbonara',false))
add('memoria',['la carbonara costa 13',DASH,'no scusa 14'],P('Spaghetti alla carbonara',13))
add('memoria',['la carbonara è finita',DASH,'anche la lasagna'],AV('Spaghetti alla carbonara',false))
add('memoria',['metti la carbonara a 13',W(11),'anche la lasagna'],P('Spaghetti alla carbonara',13))
add('memoria',['aggiungi tra i primi la pasta al ragù',W(11),'12 euro'],NONE,{note:'bozza scaduta'})
add('memoria',['aggiungi tra i primi la pasta al ragù',W(9),'12 euro'],CR('Pasta al ragù',12,'Primi'))
add('memoria',['carbonara 13, lasagna 12, tagliata 19, cotoletta 16',W(11),'ok'],NONE)
add('memoria',['gli spaghetti sono finiti',W(11),'il primo'],NONE)
add('memoria',['la carbonara costa 13',DASH,'scusa no era la lasagna'],P('Spaghetti alla carbonara',13))
add('memoria',['aggiungi tra i primi la pasta al ragù',DASH,'12 euro'],NONE,{note:'menu cambiato dalla dashboard: bozza non più valida'})
add('memoria',['la carbonara costa 13','la tagliata è finita','no scusa 14'],[P('Spaghetti alla carbonara',13),AV('Tagliata di manzo',false)],{note:'«no scusa 14» dopo un esaurito: non deve toccare la carbonara né la tagliata'})

// L) Conversazioni lunghe (5–6 turni)
add('lunga',['ciao','la carbonara costa 13','anche la lasagna','no scusa 14','grazie'],[P('Spaghetti alla carbonara',13),P('Lasagna al forno',14)])
add('lunga',['aggiungiamo un piatto','pasta al ragù','12 euro','nei primi','grazie','quanto costa la pasta al ragù'],CR('Pasta al ragù',12,'Primi'),{reply:/12/})
add('lunga',['la tagliata è finita','la cotoletta costa 16','nascondi la bruschetta','metti in evidenza la lasagna','cosa è finito?','grazie'],[AV('Tagliata di manzo',false),P('Cotoletta alla milanese',16),HI('Bruschetta al pomodoro',true),FE('Lasagna al forno',true)])
add('lunga',['gli spaghetti costano 13','la carbonara','anche la lasagna','scusa no era la tagliata'],[P('Spaghetti alla carbonara',13),P('Tagliata di manzo',13)])
add('lunga',['carbonara in promo a 10','ultime porzioni di tagliata','la lasagna solo per oggi','togli la promo dalla carbonara','grazie'],[LP('Tagliata di manzo',true),OT('Lasagna al forno',true)])
add('lunga',['ciao','cosa sai fare','aggiungi tra i dolci la crostata a 5','quanto costa la crostata','grazie'],CR('Crostata',5,'Dolci'),{reply:/nulla|altro|./i})
add('lunga',['menu di pranzo: primi: carbonara 12, amatriciana 11, gricia 11. secondi: tagliata 18, pollo arrosto 12','annulla','la carbonara costa 13'],P('Spaghetti alla carbonara',13),{fullRows:[{section:'Primi',name:'carbonara',price:12},{section:'Primi',name:'amatriciana',price:11},{section:'Primi',name:'gricia',price:11},{section:'Secondi',name:'tagliata',price:18},{section:'Secondi',name:'pollo arrosto',price:12}]})
add('lunga',['nascondi la bruschetta','mostra la bruschetta','nascondi la bruschetta','ok','grazie'],HI('Bruschetta al pomodoro',true))
add('lunga',['metti la carbonara a 13','metti la carbonara a 14','metti la carbonara a 15','no scusa 14','grazie'],P('Spaghetti alla carbonara',14))
add('lunga',['la carbonara è finita','la carbonara è tornata','la carbonara è finita','scusa no era la lasagna','quanto costa la lasagna'],AV('Lasagna al forno',false),{reply:/11/})

// D) Due titolari diversi in contemporanea
add('duetitolari',['la carbonara costa 13',B('la carbonara costa 15')],P('Spaghetti alla carbonara',13),{changesB:[P('Spaghetti alla carbonara',15)]})
add('duetitolari',['aggiungi tra i primi la pasta al ragù',B('aggiungi tra i dolci la crostata'),'12 euro',B('5 euro')],CR('Pasta al ragù',12,'Primi'),{changesB:[CR('Crostata',5,'Dolci')]})
add('duetitolari',['gli spaghetti sono finiti',B('gli spaghetti costano 9'),'il primo',B('il secondo')],AV('Spaghetti alla carbonara',false),{changesB:[P('Spaghetti aglio olio e peperoncino',9)]})
add('duetitolari',['la carbonara costa 13',B('la lasagna è finita'),'no scusa 14',B('scusa no era la tagliata')],P('Spaghetti alla carbonara',14),{changesB:[AV('Tagliata di manzo',false)]})
add('duetitolari',['carbonara 13, lasagna 12, tagliata 19, cotoletta 16',B('ok'),'ok'],[P('Spaghetti alla carbonara',13),P('Lasagna al forno',12),P('Tagliata di manzo',19),P('Cotoletta alla milanese',16)])
add('duetitolari',[B('la carbonara costa 13'),'anche la lasagna'],NONE,{changesB:[P('Spaghetti alla carbonara',13)],note:'A non ha memoria: non deve ereditare quella di B'})
add('duetitolari',['nascondi la bruschetta',B('annulla'),'mostra la bruschetta'],NONE)
add('duetitolari',['metti la carbonara a 13',B('no scusa 14')],P('Spaghetti alla carbonara',13),{note:'B non deve correggere il prezzo di A né il proprio'})
add('duetitolari',['metti in promo la tagliata a 15',B('ultime porzioni di tagliata'),'anche la cotoletta a 12'],[PR('Tagliata di manzo',15)],{changesB:[LP('Tagliata di manzo',true)],note:'«anche la cotoletta a 12» ambiguo: atteso nessun dato sbagliato'})

// X) Promo, scarsità e menu intero mescolati
add('misto','la carbonara in promo a 10 e la tagliata ultime porzioni',[PR('Spaghetti alla carbonara',10),LP('Tagliata di manzo',true)])
add('misto','ultime porzioni di carbonara e la lasagna è finita',[LP('Spaghetti alla carbonara',true),AV('Lasagna al forno',false)])
add('misto','carbonara in promo a 10 solo oggi',PR('Spaghetti alla carbonara',10))
add('misto','togli la promo dalla carbonara e mettila a 11',[PR('Spaghetti alla carbonara',null),P('Spaghetti alla carbonara',11)],{mods:{promo:{'Spaghetti alla carbonara':10}}})
add('misto','la tagliata in promo a 15 e la cotoletta costa 16',[PR('Tagliata di manzo',15),P('Cotoletta alla milanese',16)])
add('misto','la lasagna è finita, togli le ultime porzioni',[AV('Lasagna al forno',false),LP('Lasagna al forno',false)],{mods:{last:['Lasagna al forno']}})
add('misto','metti in promo il menù degustazione a 25 e il nuovo burger ultime porzioni',[PR('Menù degustazione',25),LP('Nuovo burger',true)])
add('misto','menu di cena: pizze: margherita 7, diavola 9, capricciosa 10, bufalina 11. dolci: tiramisù 5',NONE,{reply:/OK|cena|confermi/i,fullRows:[{section:'Pizze',name:'margherita',price:7},{section:'Pizze',name:'diavola',price:9},{section:'Pizze',name:'capricciosa',price:10},{section:'Pizze',name:'bufalina',price:11},{section:'Dolci',name:'tiramisù',price:5}]})
add('misto',['menu di cena: pizze: margherita 7, diavola 9, capricciosa 10, bufalina 11. dolci: tiramisù 5','la diavola in promo a 8'],NONE,{fullRows:[{section:'Pizze',name:'margherita',price:7},{section:'Pizze',name:'diavola',price:9},{section:'Pizze',name:'capricciosa',price:10},{section:'Pizze',name:'bufalina',price:11},{section:'Dolci',name:'tiramisù',price:5}],note:'durante il riepilogo: nessuna scrittura senza OK'})
add('misto','promo carbonara a 10 fino a domenica e ultime porzioni di lasagna',[PR('Spaghetti alla carbonara',10),LP('Lasagna al forno',true)])
add('misto','togli tutte le promo',[PR('Spaghetti alla carbonara',null),PR('Tagliata di manzo',null)],{mods:{promo:{'Spaghetti alla carbonara':10,'Tagliata di manzo':15}}})
add('misto','carbonara in promo a 13',NONE,{reply:/prezzo|promo|minore|inferiore|basso/i})
add('misto','la carbonara in promo a 10 e scusa la lasagna è finita',[PR('Spaghetti alla carbonara',10),AV('Lasagna al forno',false)])
add('misto',['carbonara in promo a 10','no scusa 9'],PR('Spaghetti alla carbonara',9))
add('misto',['ultime porzioni di tagliata','anche la lasagna'],[LP('Tagliata di manzo',true),LP('Lasagna al forno',true)])

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
const label=(t:Turn)=>typeof t==='string'?t:'v' in t?'🎤 '+t.v:'b' in t?'[B] '+t.b:'wait' in t?`[+${t.wait} min]`:'[cambio da dashboard]'

// Modello finto. ideal = quello che un modello perfetto restituirebbe vedendo SOLO il messaggio corrente (come il vero).
// Esteso dal fix (16/10): numeri composti in lettere letti dal server («novantacinque»).
const numberWords:Record<string,number>={novantacinque:95,zero:0,uno:1,un:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,trenta:30,cinquanta:50}
function spokenNumbers(raw:string):number[]{const out:number[]=[];for(const m of raw.matchAll(/\d+(?:[.,]\d{1,2})?/g))out.push(Number(m[0].replace(',','.')));const w=plainT(raw).split(' ')
 for(let i=0;i<w.length;i++){const a=numberWords[w[i]!];if(a===undefined)continue;out.push(a);if(w[i+1]==='euro'&&w[i+2]==='e'&&numberWords[w[i+3]!]!==undefined)out.push(a+numberWords[w[i+3]!]!/100);if(w[i+1]==='e'&&numberWords[w[i+2]!]!==undefined)out.push(a+numberWords[w[i+2]!]!/100)}
 const ints=out.filter(Number.isInteger);for(const x of ints)for(const y of ints)if(y>=10&&y<100)out.push(x+y/100);return out}
const mentions=(msg:string,c:Change)=>{const m=plainT(msg);if(c.op==='create'||c.op==='special')return m.includes(plainT(c.name).split(' ')[0]!);const words=plainT(c.dish).split(' ').filter(w=>w.length>3);return words.some(w=>m.includes(w.slice(0,5)))}
function idealAction(c:Change,hasSections:boolean):any{switch(c.op){
 case 'create':return hasSections?{action:'create_item',section_id:SEC[c.section??'Primi'],name:c.name,price:c.price}:null
 case 'special':return{action:'create_daily_special',name:c.name,price:c.price}
 case 'price':return{action:'set_price',item_id:ID[c.dish],price:c.price}
 case 'available':return{action:'set_available',item_id:ID[c.dish],available:c.value}
 case 'hidden':return{action:'set_hidden',item_id:ID[c.dish],hidden:c.value}
 case 'featured':return{action:'set_featured',item_id:ID[c.dish],featured:c.value}
 case 'description':return{action:'set_description',item_id:ID[c.dish],text:c.text}
 case 'tag':return{action:c.value?'add_tag':'remove_tag',item_id:ID[c.dish],tag:c.tag}
 case 'promo':return c.price===null?{action:'remove_promo',item_id:ID[c.dish]}:{action:'set_promo',item_id:ID[c.dish],price:c.price}
 case 'last':return{action:'set_last_portions',item_id:ID[c.dish],value:c.value}
 case 'today':return{action:'set_only_today',item_id:ID[c.dish],value:c.value}}}
function modelReply(mode:AiMode,cs:Case|null,msg:string,hasSections:boolean,pending:boolean,photo:boolean):any{
 if(mode==='empty')return '{}'
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
  const px=x.promo?.price??null,py=y.promo?.price??null;if(px!==py)out.push(`promo|${y.name}|${px}`)
  const lx=!!x.scarcity?.lastPortions,ly=!!y.scarcity?.lastPortions;if(lx!==ly)out.push(`last|${y.name}|${lx}`)
  const ox=!!x.scarcity?.onlyToday,oy=!!y.scarcity?.onlyToday;if(ox!==oy)out.push(`today|${y.name}|${ox}`)}
 for(const [,y] of a)if(!b.has(y.id))out.push(`delete|${y.name}`);return out}
const key=(c:Change)=>c.op==='create'?`create|${plainT(c.name)}|${c.price}|${c.section?plainT(c.section):'*'}`:c.op==='special'?`special|${plainT(c.name)}|${c.price}`:c.op==='price'?`price|${c.dish}|${c.price}`:c.op==='description'?`description|${c.dish}|${plainT(c.text)}`:c.op==='tag'?`tag|${c.dish}|${c.tag}|${c.value}`:c.op==='promo'?`promo|${c.dish}|${c.price}`:`${c.op}|${c.dish}|${c.value}`
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
 if(cs.mustConfirm&&mode==='ideal'){if(actual.length)f.push({sev:'GRAVE',why:`prezzo sospetto pubblicato senza conferma: ${actual.join(', ')}`});else if(!proposal?.requiresTypedOk)f.push({sev:'BASSO',why:'prezzo sospetto: né applicato né in conferma'});return f}
 const missing=missing0
 if(mode!=='ideal'){if(wrong.length)f.push({sev:'GRAVE',why:`IA sbagliata (${mode}) → scritto: ${wrong.join(', ')}`});return f}
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
 writeFileSync(new URL('results-round2.json',dir),JSON.stringify({cases:C.length,runs:results.length,unknownSql:[...new Set(S.unknownSql)],results},null,1))})

async function run(cs:Case,mode:AiMode):Promise<Result>{
 S.draft=fixture(cs.mods);S.published=fixture(cs.mods);S.revision=5;S.published_revision=5;S.B.draft=fixture(cs.mods);S.B.published=fixture(cs.mods);S.B.revision=5;S.B.published_revision=5
 S.proposals.clear();S.messages.clear();S.links=new Set([phone,phoneB]);S.offset=0;net.mode=mode;net.caseNow=cs;net.chats=0
 const before=structuredClone(S.published),beforeB=structuredClone(S.B.published),replies:string[]=[];let dashed=false
 for(const t of cs.turns){if(typeof t==='object'&&'wait' in t){S.offset+=t.wait*60000;continue}
  if(typeof t==='object'&&'dash' in t){const w=structuredClone(S.published);for(const m of w.menus)for(const s of m.sections)for(const i of s.items)if(i.name==='Cappuccino')i.price=2;S.draft=w;S.published=structuredClone(w);S.revision++;S.published_revision=S.revision;dashed=true;continue}
  let r='';try{r=await send(app,t)}catch(e){r=''};replies.push(r)}
 const actual=[...diff(before,S.published).filter(k=>!(dashed&&k==='price|Cappuccino|2')),...diff(beforeB,S.B.published).map(k=>'B:'+k)],proposal=live(phone)?.command
 const res:Result={id:cs.id,cat:cs.cat,mode,turns:cs.turns.map(label),replies,expected:[...cs.changes.map(key),...(cs.changesB??[]).map(c=>'B:'+key(c))],actual,aiCalls:net.chats,fails:[],...(cs.note?{note:cs.note}:{}),...(proposal?{proposal:{kind:proposal.kind,stage:proposal.stage,actions:proposal.actions}}:{})}
 res.fails=judge(cs,mode,replies,actual,proposal);results.push(res);return res}

describe('bot titolare: verifica avversaria, secondo giro',()=>{
 it('ha almeno 120 casi nuovi',()=>{expect(C.length).toBeGreaterThanOrEqual(120)})
 for(const cs of C)it(`${cs.id}: ${cs.turns.map(label).join(' ⏎ ').slice(0,90)}`,async()=>{
  const ideal=await run(cs,'ideal'),fails=[...ideal.fails.map(x=>`[ideal] ${x.sev} ${x.why}`)]
  if(ideal.aiCalls>0)for(const mode of ['empty','wrong','wrongCreate'] as AiMode[]){const r=await run(cs,mode);fails.push(...r.fails.map(x=>`[${mode}] ${x.sev} ${x.why}`))}
  expect(fails,`risposte: ${JSON.stringify(ideal.replies)}\nscritto: ${JSON.stringify(ideal.actual)}`).toEqual([])
 })
})
