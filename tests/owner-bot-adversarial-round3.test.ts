// Verifica avversaria del bot WhatsApp del TITOLARE — TERZO GIRO (16/10/2026, edge v100): 120+ casi nuovi mirati ai meccanismi v100
// (domande senza «?», negazioni, «scusa», prezzi oltre 3×, nomi con offerta/menu/nuovo/del giorno, parole generiche,
// memoria oltre 10 minuti o dopo un cambio da dashboard, conversazioni lunghe, due titolari in contemporanea, promo+scarsità+menu intero).
// Webhook firmato vero (router + NLU + validatori veri), DB e documento menu in memoria, Groq/Whisper/Twilio finti.
// Ogni caso gira con un modello «ideale» e, quando passa dall'IA, anche con modelli che rispondono male
// (JSON vuoto, azione su un piatto sbagliato, creazione inventata). Nessuna rete, nessun DB reale, nessun deploy.
// Risultati: docs/webapp/owner-bot-verify-2026-10-16/results.json (scritto a fine run).
import {createRequire} from 'node:module'
import {writeFileSync,mkdirSync} from 'node:fs'
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest'
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
 [23,9,'Offerta pranzo',10],[24,9,'Menù bambini',8],[25,2,'Pasta del giorno',9],[26,10,'Nuovo burger',12],[27,10,'Burger classico',10],[28,10,'Menù degustazione',30],[29,6,'Dolce del giorno',4],[30,9,'Coperto',1],[31,11,'Bottiglia di Brunello',45],[32,12,'Patate al forno',4],[33,12,'Insalata mista',4],[34,5,'Margherita con bufala',9]]
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
type Turn=string|{v:string}|{b:string}|{wait:number}|{dash:true}
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

// ===== TERZO GIRO: casi nuovi mirati ai meccanismi v100 =====
const W=(m:number)=>({wait:m}),B=(s:string)=>({b:s})
const addD=(n:number)=>{const d=new Date(todayIso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const wd=new Date(todayIso+'T12:00:00Z').getUTCDay(),nextWd=(w:number)=>addD((w-wd+7)%7)
const SUN=nextWd(0),MON=nextWd(1),SAT=nextWd(6),TODAY=todayIso,TOMORROW=addD(1)
const endOfMonth=(()=>{const d=new Date(todayIso+'T12:00:00Z');return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)).toISOString().slice(0,10)})()
const FULL='menu di pranzo: primi: carbonara 12, amatriciana 11, gricia 11. secondi: tagliata 18, pollo arrosto 12'
const fullRows3=[{section:'Primi',name:'carbonara',price:12},{section:'Primi',name:'amatriciana',price:11},{section:'Primi',name:'gricia',price:11},{section:'Secondi',name:'tagliata',price:18},{section:'Secondi',name:'pollo arrosto',price:12}]
const FOUR='carbonara 13, lasagna 12, tagliata 19, cotoletta 16',FOUR_CH=[P('Spaghetti alla carbonara',13),P('Lasagna al forno',12),P('Tagliata di manzo',19),P('Cotoletta alla milanese',16)]

// A) «scusa», «anche», «anzi», «lascia stare», «torna come prima» che NON correggono né annullano
add('noncorr',['la lasagna costa 12','scusa se ti disturbo, la carbonara è finita'],[P('Lasagna al forno',12),AV('Spaghetti alla carbonara',false)])
add('noncorr','scusa se ti disturbo, la carbonara è finita',AV('Spaghetti alla carbonara',false))
add('noncorr',['la carbonara costa 13','lascia stare la panna cotta, la tagliata costa 19'],[P('Spaghetti alla carbonara',13),P('Tagliata di manzo',19)])
add('noncorr','lascia stare la panna cotta, la tagliata costa 19',P('Tagliata di manzo',19))
add('noncorr',['la lasagna è finita',W(20),'torna come prima la lasagna'],NONE,{note:'20 minuti dopo: la lasagna deve tornare disponibile (o il bot deve chiedere)'})
add('noncorr',['la lasagna è finita',W(5),'torna come prima la lasagna'],NONE)
add('noncorr',['la carbonara costa 13','anzi già che ci sei la tagliata è finita'],[P('Spaghetti alla carbonara',13),AV('Tagliata di manzo',false)])
add('noncorr',['metti in evidenza la tagliata','anche la lasagna costa 12'],[FE('Tagliata di manzo',true),P('Lasagna al forno',12)])
add('noncorr',['la carbonara è finita','anche oggi niente tiramisù'],[AV('Spaghetti alla carbonara',false),AV('Tiramisù',false)])
add('noncorr',['la carbonara costa 13','anche se è cara la lasciamo così'],P('Spaghetti alla carbonara',13))
add('noncorr',['nascondi la bruschetta','scusa, quanto costa la tagliata'],HI('Bruschetta al pomodoro',true),{reply:/18/})
add('noncorr','anche oggi la carbonara è finita',AV('Spaghetti alla carbonara',false))
add('noncorr','scusa ma il tiramisù costa 6 da oggi',P('Tiramisù',6))
add('noncorr','anzi metti la lasagna a 12',P('Lasagna al forno',12))
add('noncorr',['la carbonara è finita','grazie, scusa il disturbo'],AV('Spaghetti alla carbonara',false))
add('noncorr',['la carbonara costa 13','lascia stare il resto, va bene così'],P('Spaghetti alla carbonara',13),{note:'«lascia stare il resto» non annulla'})
add('noncorr',['la tagliata in promo a 15','anche la cotoletta è finita'],[PR('Tagliata di manzo',15),AV('Cotoletta alla milanese',false)])
add('noncorr',['la diavola è piccante','anche la margherita è vegetariana'],[TG('Diavola','piccante'),TG('Margherita','vegetariano')])
add('noncorr',['la carbonara costa 13','scusa ho detto 13 giusto?'],P('Spaghetti alla carbonara',13))
add('noncorr',['la carbonara costa 13','torna come prima la lasagna'],P('Spaghetti alla carbonara',13),{note:'la lasagna non è stata toccata: niente annullamento della carbonara'})
add('noncorr',['nascondi la bruschetta','lascia stare la bruschetta, nascondi il tagliere'],HI('Tagliere misto',true))
add('noncorr',V('scusa se ti mando un vocale la carbonara è finita'),AV('Spaghetti alla carbonara',false))
add('noncorr',['la carbonara costa 13',W(20),'torna come prima'],P('Spaghetti alla carbonara',13),{reply:/prima|non|annull|ultim/i,note:'memoria scaduta: niente annullamento silenzioso, risposta chiara'})
add('noncorr',['la carbonara costa 13','anche a me sembra giusto'],P('Spaghetti alla carbonara',13))
add('noncorr',['la carbonara è finita','scusa, la lasagna costa 12'],[AV('Spaghetti alla carbonara',false),P('Lasagna al forno',12)])
add('noncorr',['metti la carbonara a 13','lascia stare, la lasagna è finita'],[P('Spaghetti alla carbonara',13),AV('Lasagna al forno',false)],{alt:[[AV('Lasagna al forno',false)]],note:'ambiguo: «lascia stare» può annullare il 13'})
add('noncorr',['la carbonara costa 13','torna come prima il prezzo della lasagna'],P('Spaghetti alla carbonara',13))
add('noncorr','ciao scusa anche stasera niente tagliata',AV('Tagliata di manzo',false))
// controlli: annullamenti veri
add('noncorr',['la carbonara costa 13','torna come prima'],NONE)
add('noncorr',['la carbonara costa 13','anzi no, lascia stare'],NONE)

// B) Parole di categoria con 1, 2 o molte voci
add('categoria','la pizza è finita',NONE,{reply:/quale|1\./i})
add('categoria','il dolce costa 6',NONE,{reply:/quale|1\./i})
add('categoria','il primo è finito',NONE,{reply:/quale|1\./i})
add('categoria','il vino costa 50',P('Bottiglia di Brunello',50),{alt:[[]],note:'una sola voce nei Vini'})
add('categoria','il contorno è finito',NONE,{reply:/quale|1\.|patate|insalata/i})
add('categoria',['il contorno è finito','le patate'],AV('Patate al forno',false))
add('categoria',['la pizza costa 10','la diavola'],P('Diavola',10))
add('categoria',['il dolce è finito','il tiramisù'],AV('Tiramisù',false))
add('categoria','la pizza 4 formaggi costa 10',P('Pizza 4 formaggi',10))
add('categoria','la pizza margherita costa 8',P('Margherita',8))
add('categoria','il dolce del giorno costa 5',P('Dolce del giorno',5))
add('categoria','il secondo costa 16',NONE,{reply:/quale|1\./i})
add('categoria','la birra è finita',AV('Birra media',false))
add('categoria','il contorno costa 5',NONE,{reply:/quale|1\.|patate/i})
add('categoria','nascondi il dolce',NONE,{reply:/quale|1\./i})
add('categoria','il primo del pranzo costa 11',NONE,{reply:/quale|1\./i})
add('categoria',['la pizza è finita','tutte'],[AV('Margherita',false),AV('Pizza 4 formaggi',false),AV('Diavola',false),AV('Capricciosa',false),AV('Margherita con bufala',false)],{alt:[[]]})

// C) Promo con date
add('promodata','carbonara in promo a 10 fino a domenica',PRu('Spaghetti alla carbonara',10,SUN))
add('promodata','la tagliata in promo a 15 solo stasera',PRu('Tagliata di manzo',15,TODAY))
add('promodata','la lasagna in promo a 9 per tutto il weekend',PRu('Lasagna al forno',9,SUN))
add('promodata','promo sulla cotoletta a 12 fino a lunedì',PRu('Cotoletta alla milanese',12,MON))
add('promodata','metti la carbonara in offerta a 10 fino al 31 ottobre',PRu('Spaghetti alla carbonara',10,todayIso.slice(0,4)+'-10-31'))
add('promodata','la diavola in promo a 7 fino a domani',PRu('Diavola',7,TOMORROW))
add('promodata','promo pizza 4 formaggi a 8 per questa settimana',PRu('Pizza 4 formaggi',8,SUN))
add('promodata','la carbonara in promo a 10 fino a fine mese',PRu('Spaghetti alla carbonara',10,endOfMonth))
add('promodata','la tagliata in promo a 15 fino a domenica sera',PRu('Tagliata di manzo',15,SUN))
add('promodata','la carbonara in promo a 10 per il weekend',PRu('Spaghetti alla carbonara',10,SUN))
add('promodata','la carbonara in promo solo per stasera a 10',PRu('Spaghetti alla carbonara',10,TODAY))
add('promodata',V('metti la tagliata in promo a quindici euro fino a domenica'),PRu('Tagliata di manzo',15,SUN))
add('promodata',['carbonara in promo a 10 fino a domenica','no scusa fino a sabato'],PRu('Spaghetti alla carbonara',10,SAT))
add('promodata','solo per oggi la lasagna in promo a 9',PRu('Lasagna al forno',9,TODAY))
add('promodata','la carbonara in promo a 10 fino a stasera e la tagliata solo oggi',[...PRu('Spaghetti alla carbonara',10,TODAY),OT('Tagliata di manzo',true)])

// D) «tutte le …»
add('tutte','togli tutte le etichette',[TG('Diavola','piccante',false),TG('Margherita','vegetariano',false)],{mods:{tags:{Diavola:['piccante'],Margherita:['vegetariano']}}})
add('tutte','togli tutte le ultime porzioni',[LP('Tagliata di manzo',false),LP('Lasagna al forno',false)],{mods:{last:['Tagliata di manzo','Lasagna al forno']}})
add('tutte','togli ultime porzioni da tutto',[LP('Tagliata di manzo',false),LP('Lasagna al forno',false)],{mods:{last:['Tagliata di manzo','Lasagna al forno']}})
add('tutte','togli il solo oggi da tutti i piatti',[OT('Lasagna al forno',false),OT('Spaghetti alla carbonara',false)],{mods:{today:['Lasagna al forno','Spaghetti alla carbonara']}})
add('tutte','togli piccante da tutti i piatti',[TG('Diavola','piccante',false),TG('Spaghetti aglio olio e peperoncino','piccante',false)],{mods:{tags:{Diavola:['piccante'],'Spaghetti aglio olio e peperoncino':['piccante']}}})
add('tutte','togli tutte le etichette dalla diavola',[TG('Diavola','piccante',false),TG('Diavola','vegetariano',false)],{mods:{tags:{Diavola:['piccante','vegetariano']}}})
add('tutte',['togli tutte le promo e tutte le ultime porzioni','ok'],[PR('Spaghetti alla carbonara',null),PR('Tagliata di manzo',null),LP('Lasagna al forno',false),LP('Cotoletta alla milanese',false)],{mods:{promo:{'Spaghetti alla carbonara':10,'Tagliata di manzo':15},last:['Lasagna al forno','Cotoletta alla milanese']}})
add('tutte','togli tutte le etichette',NONE,{reply:/nessun|già|non ci sono|aggiornato/i,note:'nessuna etichetta presente'})
add('tutte','togli tutte le promo tranne la carbonara',PR('Tagliata di manzo',null),{mods:{promo:{'Spaghetti alla carbonara':10,'Tagliata di manzo':15}},alt:[[]]})
add('tutte','togli la promo a tutte le pizze',[PR('Diavola',null),PR('Margherita',null)],{mods:{promo:{Diavola:7,Margherita:6,'Spaghetti alla carbonara':10}}})

// E) Soglia dei prezzi (da 8× in su e oltre 500 €)
add('soglia','la carbonara costa 96',NONE,{mustConfirm:true,note:'8×'})
add('soglia','la carbonara costa 90',P('Spaghetti alla carbonara',90),{note:'7,5×: sotto soglia'})
add('soglia','il coperto passa a 8',NONE,{mustConfirm:true})
add('soglia','il coperto passa a 7,50',P('Coperto',7.5))
add('soglia','il menù degustazione costa 240',NONE,{mustConfirm:true})
add('soglia','il menù degustazione costa 230',P('Menù degustazione',230))
add('soglia','il brunello costa 501',NONE,{mustConfirm:true})
add('soglia','aggiungi tra i vini il sassicaia a 480 euro',CR('Sassicaia',480,'Vini'))
add('soglia','aggiungi tra i vini il sassicaia a 520 euro',NONE,{mustConfirm:true})
add('soglia','il brunello costa 350',P('Bottiglia di Brunello',350),{note:'7,8×'})
add('soglia','la tagliata in promo a 9',PR('Tagliata di manzo',9))

// F) Numeri in lettere fino a 999 e decimali detti
add('lettere',V('la carbonara costa dodici e cinquanta'),P('Spaghetti alla carbonara',12.5))
add('lettere',V('la carbonara costa dieci virgola cinque'),P('Spaghetti alla carbonara',10.5))
add('lettere',V('la tagliata costa ventidue'),P('Tagliata di manzo',22))
add('lettere',V('la tagliata costa ventuno euro e novanta'),P('Tagliata di manzo',21.9))
add('lettere',V('il menù degustazione costa centoventi'),P('Menù degustazione',120))
add('lettere',V('il brunello costa centotrentacinque'),P('Bottiglia di Brunello',135))
add('lettere',V('il brunello costa duecentoquaranta euro'),P('Bottiglia di Brunello',240))
add('lettere',V('aggiungi tra i vini il tignanello a centoventotto euro'),CR('Tignanello',128,'Vini'))
add('lettere',V('la carbonara costa tredici e mezzo'),P('Spaghetti alla carbonara',13.5))
add('lettere',V('la margherita costa sette e cinquanta'),P('Margherita',7.5))
add('lettere',V('il caffè costa un euro e quaranta'),P('Caffè',1.4))
add('lettere',V('il coperto costa due e cinquanta'),P('Coperto',2.5))
add('lettere',V('la carbonara costa dodici virgola novanta'),P('Spaghetti alla carbonara',12.9))
add('lettere',V('il menù bambini costa nove e novantanove'),P('Menù bambini',9.99))
add('lettere',V('il brunello costa novecentonovantanove'),NONE,{mustConfirm:true})
add('lettere',V('aggiungi tra i vini il barolo a sessantotto euro'),CR('Barolo',68,'Vini'))

// G) Nascondi/mostra contro aggiungi con nomi simili
add('simili','aggiungi la diavola piccante tra le pizze a 9',CR('Diavola piccante',9,'Pizze'))
add('simili','aggiungi tra le pizze la margherita con bufala a 9',NONE,{mods:{hidden:['Margherita con bufala']},alt:[[HI('Margherita con bufala',false)]],reply:/esiste|già|nascost|visibil/i})
add('simili','mostra la margherita con bufala',HI('Margherita con bufala',false),{mods:{hidden:['Margherita con bufala']}})
add('simili','rimetti la diavola',HI('Diavola',false),{mods:{hidden:['Diavola']}})
add('simili','aggiungi la margherita',NONE,{reply:/esiste|già|prezzo|categori/i})
add('simili','nascondi la margherita',HI('Margherita',true))
add('simili','metti nel menu la diavola',HI('Diavola',false),{mods:{hidden:['Diavola']}})
add('simili','metti nel menu la diavola bianca a 9 tra le pizze',CR('Diavola bianca',9,'Pizze'))
add('simili','rimetti nel menu il tagliere',HI('Tagliere misto',false),{mods:{hidden:['Tagliere misto']}})
add('simili','aggiungi di nuovo il tagliere misto',HI('Tagliere misto',false),{mods:{hidden:['Tagliere misto']},alt:[[]]})
add('simili','nascondi la pasta e fagioli e aggiungi tra i primi la pasta e ceci a 9',[HI('Pasta e fagioli',true),CR('Pasta e ceci',9,'Primi')])
add('simili','aggiungi nuovo burger tra le proposte a 12',NONE,{reply:/esiste|già/i})
add('simili','mostra il nuovo burger',HI('Nuovo burger',false),{mods:{hidden:['Nuovo burger']}})
add('simili','aggiungi tra le proposte il burger classico doppio a 14',CR('Burger classico doppio',14,'Proposte'))
add('simili','metti nel menu la margherita con bufala',HI('Margherita con bufala',false),{mods:{hidden:['Margherita con bufala']}})

// H) Domande che sono comandi
add('domcomando','puoi segnare finita la carbonara?',AV('Spaghetti alla carbonara',false))
add('domcomando','mi metti la carbonara a 13?',P('Spaghetti alla carbonara',13))
add('domcomando','potresti nascondere la bruschetta?',HI('Bruschetta al pomodoro',true))
add('domcomando','mi togli la promo dalla tagliata?',PR('Tagliata di manzo',null),{mods:{promo:{'Tagliata di manzo':15}}})
add('domcomando','riesci a mettere in evidenza la lasagna?',FE('Lasagna al forno',true))
add('domcomando','me la segni finita la lasagna per favore?',AV('Lasagna al forno',false))
add('domcomando','aggiungi tra i primi la pasta al ragù a 12?',CR('Pasta al ragù',12,'Primi'))
add('domcomando','la carbonara è finita vero?',NONE,{alt:[[AV('Spaghetti alla carbonara',false)]],note:'ambiguo: lettura o comando entrambi accettati'})
add('domcomando','possiamo mettere la carbonara a 13?',P('Spaghetti alla carbonara',13))
add('domcomando','ce la fai a mettere la tagliata in promo a 15?',PR('Tagliata di manzo',15))
add('domcomando','puoi rimettere disponibile la cotoletta?',AV('Cotoletta alla milanese',true),{mods:{unavail:['Cotoletta alla milanese']}})
add('domcomando','mi aggiungi la crostata tra i dolci a 5?',CR('Crostata',5,'Dolci'))
add('domcomando','quanto costa la carbonara? mettila a 13',P('Spaghetti alla carbonara',13))
add('domcomando','la carbonara costa 13 giusto?',NONE)
add('domcomando',V('mi segni la carbonara finita'),AV('Spaghetti alla carbonara',false))

// I) Annullare dopo un menu intero o dopo più modifiche confermate con OK
add('annulla3',[FOUR,'ok','annulla'],FOUR_CH,{alt:[[]],reply:/pubblicat|restano|prima|annull/i})
add('annulla3',[FOUR,'ok','torna come prima'],NONE,{alt:[FOUR_CH],reply:/prima|ripristin|annull|non/i})
add('annulla3',[FOUR,'ok','lascia stare'],FOUR_CH,{alt:[[]]})
add('annulla3',[FULL,'ok','ripristina il menu di prima'],NONE,{fullRows:fullRows3})
add('annulla3',[FULL,'ok','torna come prima'],NONE,{fullRows:fullRows3,anyWithReply:/ripristin/i,note:'atteso ripristino del menu di prima (o domanda chiara). Banco corretto al giro 4: risposta chiara accettata, BASSO se non indica «ripristina il menu di prima»'})
add('annulla3',[FULL,'annulla','torna come prima'],NONE,{fullRows:fullRows3})
add('annulla3',['la carbonara costa 13','la lasagna costa 12','torna come prima'],P('Spaghetti alla carbonara',13))
add('annulla3',['togli tutte le promo','torna come prima'],NONE,{mods:{promo:{'Spaghetti alla carbonara':10,'Tagliata di manzo':15}},alt:[[PR('Spaghetti alla carbonara',null),PR('Tagliata di manzo',null)]]})
add('annulla3',['nascondi la bruschetta','ok','torna come prima'],NONE)
add('annulla3',[FOUR,'ok','no scusa la carbonara 14'],[P('Spaghetti alla carbonara',14),P('Lasagna al forno',12),P('Tagliata di manzo',19),P('Cotoletta alla milanese',16)],{ai:(msg)=>/14/.test(msg)?{intent:'change',actions:[{action:'set_price',item_id:ID['Spaghetti alla carbonara'],price:14}]}:{intent:'change',actions:FOUR_CH.map(c=>idealAction(c,false))},note:'banco corretto al giro 4: il modello ideale vede solo il messaggio corrente'})
add('annulla3',['la carbonara costa 13',B('torna come prima')],P('Spaghetti alla carbonara',13),{note:'un altro titolare non annulla le modifiche di A'})
add('annulla3',['la carbonara è finita','la lasagna è finita','torna come prima','torna come prima'],AV('Spaghetti alla carbonara',false),{alt:[[]]})

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
const units:Record<string,number>={uno:1,un:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19}
const tens:[string,number][]=[['venti',20],['trenta',30],['quaranta',40],['cinquanta',50],['sessanta',60],['settanta',70],['ottanta',80],['novanta',90]]
function itWord(w:string):number|null{if(w==='zero')return 0;let n=0,s=w;const h=s.match(/^(due|tre|quattro|cinque|sei|sette|otto|nove)?cento/);if(h){n+=(h[1]?units[h[1]]!:1)*100;s=s.slice(h[0].length)}
 if(!s)return n||null;for(const [t,v] of tens){const stem=t.slice(0,-1);if(s.startsWith(t)||s.startsWith(stem)&&/^(uno|otto)/.test(s.slice(stem.length))){const rest=s.startsWith(t)?s.slice(t.length):s.slice(stem.length);if(!rest)return n+v;if(units[rest]!==undefined&&units[rest]!<10)return n+v+units[rest]!;return null}}
 return units[s]!==undefined?n+units[s]!:null}
function spokenNumbers(raw:string):number[]{const out:number[]=[];{const w=plainT(raw).split(' ');for(let i=0;i<w.length;i++){const a=itWord(w[i]!);if(a===null)continue;out.push(a);let j=i+1;if(w[j]==='euro')j++;if(w[j]==='e'||w[j]==='virgola'){const b=w[j+1]==='mezzo'?50:itWord(w[j+1]??'');if(b!==null&&b<100){out.push(a+(w[j]==='virgola'&&b<10?b/10:b/100))}}}}for(const m of raw.matchAll(/\d+(?:[.,]\d{1,2})?/g))out.push(Number(m[0].replace(',','.')));const w=plainT(raw).split(' ')
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
 writeFileSync(new URL('results-round3.json',dir),JSON.stringify({cases:C.length,runs:results.length,unknownSql:[...new Set(S.unknownSql)],results},null,1))})

async function run(cs:Case,mode:AiMode):Promise<Result>{
 S.draft=fixture(cs.mods);S.published=fixture(cs.mods);S.revision=5;S.published_revision=5;S.B.draft=fixture(cs.mods);S.B.published=fixture(cs.mods);S.B.revision=5;S.B.published_revision=5
 S.proposals.clear();S.messages.clear();S.versions=[];S.links=new Set([phone,phoneB]);S.offset=0;net.mode=mode;net.caseNow=cs;net.chats=0
 const before=structuredClone(S.published),beforeB=structuredClone(S.B.published),replies:string[]=[];let dashed=false
 for(const t of cs.turns){if(typeof t==='object'&&'wait' in t){S.offset+=t.wait*60000;continue}
  if(typeof t==='object'&&'dash' in t){const w=structuredClone(S.published);for(const m of w.menus)for(const s of m.sections)for(const i of s.items)if(i.name==='Cappuccino')i.price=2;S.draft=w;S.published=structuredClone(w);S.revision++;S.published_revision=S.revision;dashed=true;continue}
  let r='';try{r=await send(app,t)}catch(e){r=''};replies.push(r)}
 const actual=[...diff(before,S.published).filter(k=>!(dashed&&k==='price|Cappuccino|2')),...diff(beforeB,S.B.published).map(k=>'B:'+k)],proposal=live(phone)?.command
 const res:Result={id:cs.id,cat:cs.cat,mode,turns:cs.turns.map(label),replies,expected:[...cs.changes.map(key),...(cs.changesB??[]).map(c=>'B:'+key(c))],actual,aiCalls:net.chats,fails:[],...(cs.note?{note:cs.note}:{}),...(proposal?{proposal:{kind:proposal.kind,stage:proposal.stage,actions:proposal.actions}}:{})}
 res.fails=judge(cs,mode,replies,actual,proposal);results.push(res);return res}

describe('bot titolare: verifica avversaria, terzo giro',()=>{
 it('ha almeno 120 casi nuovi (terzo giro)',()=>{expect(C.length).toBeGreaterThanOrEqual(120)})
 for(const cs of C)it(`${cs.id}: ${cs.turns.map(label).join(' ⏎ ').slice(0,90)}`,async()=>{
  const ideal=await run(cs,'ideal'),fails=[...ideal.fails.map(x=>`[ideal] ${x.sev} ${x.why}`)]
  if(ideal.aiCalls>0)for(const mode of ['empty','wrong','wrongCreate'] as AiMode[]){const r=await run(cs,mode);fails.push(...r.fails.map(x=>`[${mode}] ${x.sev} ${x.why}`))}
  expect(fails,`risposte: ${JSON.stringify(ideal.replies)}\nscritto: ${JSON.stringify(ideal.actual)}`).toEqual([])
 })
})
