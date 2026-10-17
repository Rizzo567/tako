// Verifica avversaria del bot WhatsApp del TITOLARE — SESTO GIRO (17/10/2026, perimetro Q): «togli» coerente (= nascondere, mai
// esaurito), il vocale di Manuel con una parte incerta («… e tojibo» = «togli boh»?) che non deve far perdere le parti chiare,
// le correzioni con «no», l'annulla vero entro 10 minuti e la riga «assistente automatico» una sola volta.
// Webhook firmato vero (router + NLU + validatori veri), DB e documento menu in memoria, Groq/Whisper/Twilio finti, orologio fisso.
// Ogni caso gira con un modello «ideale» e, quando passa dall'IA, anche con modelli che rispondono male
// (JSON vuoto, azione su un piatto sbagliato, creazione inventata). Nessuna rete, nessun DB reale, nessun deploy.
// Risultati: docs/webapp/owner-bot-verify-2026-10-16/results-round6.json (scritto a fine run).
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
const realFetch=globalThis.fetch,prompts:string[]=[]
const okJson=(content:any)=>new Response(JSON.stringify({choices:[{message:{content:typeof content==='string'?content:JSON.stringify(content)}}],usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20}}),{status:200,headers:{'Content-Type':'application/json'}})
vi.stubGlobal('fetch',async(url:any,init:any)=>{const u=String(url)
 if(u.includes('/chat/completions')){net.chats++;const body=JSON.parse(init.body),system=String(body.messages[0]?.content??''),user=String(body.messages[1]?.content??'')
  let source:string|null=null;try{source=JSON.parse(user).source??null}catch{}
  if(source!==null)return okJson(net.mode==='ideal'&&net.caseNow?.fullRows?{rows:net.caseNow.fullRows.filter((r:any)=>source!.toLowerCase().includes(r.name.toLowerCase())).map((r:any)=>({section:r.section,name:r.name,price:r.price,description:'',evidence:source!.slice(source!.toLowerCase().indexOf(r.name.toLowerCase())).match(/^[^,.;\n]+/)![0]})),issues:[]}:{rows:[],issues:[]})
  const message=(user.split(/\n(?:MESSAGGIO|NOME INDICATO)\n/)[1]??'').trim(),hasSections=user.startsWith('CATEGORIE'),pending=system.includes('ESISTE UNA PROPOSTA')
  return okJson(modelReply(net.mode,net.caseNow,message,hasSections,pending,system.includes('Il ristoratore ha mandato una foto')))}
 if(u.includes('/audio/transcriptions')){prompts.push(String((init.body as FormData).get('prompt')??''));return new Response(JSON.stringify({text:net.transcript,duration:5}),{status:200,headers:{'Content-Type':'application/json'}})}
 if(u.endsWith('/Messages.json')){net.sent.push(new URLSearchParams(String(init.body)).get('Body')!);return new Response('{}',{status:201,headers:{'Content-Type':'application/json'}})}
 if(u.includes('/Media/'))return new Response(new Uint8Array([79,103,103,83]),{status:200,headers:{'Content-Type':'audio/ogg'}})
 return realFetch(url,init)})

// ---------------- Casi ----------------
type Change={op:'create',name:string,price:number,section?:string}|{op:'price',dish:string,price:number}|{op:'available'|'hidden'|'featured'|'last'|'today',dish:string,value:boolean}|{op:'description',dish:string,text:string}|{op:'tag',dish:string,tag:string,value:boolean}|{op:'promo',dish:string,price:number|null}|{op:'until',dish:string,date:string|null}|{op:'special',name:string,price:number}|{op:'k',k:string}
type Turn=string|{v:string}|{b:string}|{wait:number}|{dash:true|[string,string,any]}
type Case={id:string,cat:string,turns:Turn[],changes:Change[],replyAt?:[number,RegExp][],anyWithReply?:RegExp,alt?:Change[][],changesB?:Change[],mustConfirm?:boolean,reply?:RegExp,mods?:Mods,ai?:(msg:string,hasSections:boolean,pending:boolean)=>any,relative?:boolean,fullRows?:{section:string,name:string,price:number}[],note?:string}
const C:Case[]=[]
const add=(cat:string,turns:Turn|Turn[],changes:Change[]|Change,extra:Partial<Case>={})=>C.push({id:`${cat}-${String(C.filter(c=>c.cat===cat).length+1).padStart(2,'0')}`,cat,turns:Array.isArray(turns)?turns:[turns],changes:Array.isArray(changes)?changes:[changes],...extra})
const CR=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const P=(dish:string,price:number):Change=>({op:'price',dish,price})
const AV=(dish:string,value:boolean):Change=>({op:'available',dish,value}),HI=(dish:string,value:boolean):Change=>({op:'hidden',dish,value}),FE=(dish:string,value:boolean):Change=>({op:'featured',dish,value})
const DE=(dish:string,text:string):Change=>({op:'description',dish,text}),TG=(dish:string,tag:string,value=true):Change=>({op:'tag',dish,tag,value})
const PR=(dish:string,price:number|null):Change=>({op:'promo',dish,price}),PRu=(dish:string,price:number,date:string):Change[]=>[{op:'promo',dish,price},{op:'until',dish,date}],LP=(dish:string,value:boolean):Change=>({op:'last',dish,value}),OT=(dish:string,value:boolean):Change=>({op:'today',dish,value}),SP=(name:string,price:number):Change=>({op:'special',name,price})
const V=(s:string)=>({v:s})
const NONE:Change[]=[]
const W=(m:number)=>({wait:m})
const R4T='la carbonara a 13, la lasagna a 12, la tagliata a 20 e la cotoletta a 16'
// ===== SESTO GIRO (17/10/2026, perimetro Q): «togli» coerente, vocale di Manuel con una parte incerta, annulla vero, riga AI =====
// Regola (Manuel 17/10): «togli/leva/levami/elimina/cancella/rimuovi X» = SEMPRE nascondere dal menu (mai «esaurito»), anche dentro
// richieste multiple e correzioni; «finito/esaurito/non c'è più/nun ce sta» = esaurito. Una parte incerta non fa perdere le chiare.
const D=(nm:string,field:string,val:any)=>({dash:[nm,field,val] as [string,string,any]})
const B='boh',CS='Che ne sacc',PV='Piatto di verifica',PR0='pasta al ragù',CARB='Spaghetti alla carbonara',LAS='Lasagna al forno',TIR='Tiramisù',PC='Panna cotta',DIA='Diavola',MAR='Margherita',TAG='Tagliata di manzo',COT='Cotoletta alla milanese',BRU='Bruschetta al pomodoro'
const PP='Piatti di prova'
const ASKB=/Intendi \*togliere boh\*/,ASKCS=/Intendi \*togliere Che ne sacc\*/,ASKPV=/Intendi \*togliere Piatto di verifica\*/
const MANUEL='aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tojibo'
const MANUEL_V='Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tojibo.'
const two=[CR('Parmigiana',10,PP),CR('Tiramisù',6,PP)]
// Modello «difettoso» come quello del 17/10: segna esaurito un piatto da togliere.
const buggyFinish=(dishes:string[])=>()=>({intent:'change',actions:dishes.map(d=>({action:'set_available',item_id:ID[d],available:false}))})

// A) «togli» e sinonimi = nascondere, mai esaurito (testo e vocale)
for(const [t,d] of [['togli boh',B],['leva boh',B],['levami boh',B],['elimina boh',B],['cancella boh',B],['rimuovi boh',B],['togli boh dal menu',B],['leva dal menu boh',B],
 ['togli la lasagna',LAS],['leva la diavola',DIA],['levami la panna cotta',PC],['elimina il tiramisù',TIR],['cancella la cotoletta',COT],['rimuovi la tagliata',TAG],['eliminami la bruschetta',BRU],
 ['cancellami il piatto di verifica',PV],['rimuovimi la margherita',MAR],['togliamo la lasagna',LAS],['leviamo la diavola dal menu',DIA],['no, togli boh',B],['scusa, leva la lasagna',LAS],
 ['togli che ne sacc',CS],['leva il piatto di verifica',PV],['toglici la diavola',DIA],['togli la pasta al ragù',PR0]] as [string,string][])add('togli',t,HI(d,true))
for(const [t,d] of [['Togli boh.',B],['Leva la lasagna dal menu.',LAS],['Elimina il tiramisù.',TIR],['Levami la panna cotta.',PC],['No, togli bo.',B],['Cancella la diavola.',DIA],['Toglie boh.',B],['Rimuovi che ne sacc.',CS]] as [string,string][])add('togliv',V(t),HI(d,true))
// Esaurito resta esaurito
// Sul QA boh e Che ne sacc hanno «Ultime porzioni»: segnati finiti, l'etichetta si toglie (regola dell'esaurito operativo).
const FIN=(d:string)=>[AV(d,false),...([B,CS].includes(d)?[LP(d,false)]:[])]
for(const [t,d] of [['boh è finito',B],['è finita la lasagna',LAS],['la diavola è esaurita',DIA],['non c\'è più il tiramisù',TIR],['esaurito boh',B],['la panna cotta non c\'è più',PC]] as [string,string][])add('finito',t,FIN(d))
add('finito',V('Nun ce sta cchiù la lasagna.'),AV(LAS,false),{ai:()=>({intent:'change',actions:[{action:'set_available',item_id:ID[LAS],available:false}]})})
add('finito',V('La diavola è fernuta.'),AV(DIA,false),{ai:()=>({intent:'change',actions:[{action:'set_available',item_id:ID[DIA],available:false}]})})
// Il modello sbaglia e segna «finito» un piatto da togliere: il server lo corregge in «nascosto».
add('togliai','togli boh e la lasagna',[HI(B,true),HI(LAS,true)],{ai:buggyFinish([B,LAS])})
add('togliai','leva la diavola e pure la margherita',[HI(DIA,true),HI(MAR,true)],{ai:buggyFinish([DIA,MAR])})
add('togliai',V('Allora, levami boh e anche che ne sacc dal menu.'),[HI(B,true),HI(CS,true)],{ai:buggyFinish([B,CS])})
add('togliai','elimina la lasagna e la diavola',[HI(LAS,true),HI(DIA,true)],{ai:buggyFinish([LAS,DIA])})
add('togliai','la lasagna è finita e togli la diavola',[AV(LAS,false),HI(DIA,true)],{ai:buggyFinish([LAS,DIA])})
add('togliai','togli la diavola, la lasagna invece è finita',[HI(DIA,true),AV(LAS,false)],{ai:buggyFinish([DIA,LAS])})

// B) «togli» dentro richieste multiple (deterministiche o con IA ideale)
add('multi','la carbonara a 13 e togli la lasagna',[P(CARB,13),HI(LAS,true)])
add('multi','togli la lasagna e la carbonara è finita',[HI(LAS,true),AV(CARB,false)])
add('multi','leva la diavola, la margherita costa 8',[HI(DIA,true),P(MAR,8)])
add('multi','elimina il tiramisù e la panna cotta costa 6',[HI(TIR,true),P(PC,6)])
add('multi',V('Togli boh e il piatto di verifica costa 14.'),[HI(B,true),P(PV,14)])
add('multi','boh è finito e togli che ne sacc',[...FIN(B),HI(CS,true)])
add('multi','aggiungi nei piatti di prova la parmigiana a 10 euro e togli boh',[CR('Parmigiana',10,PP),HI(B,true)])
add('multi','aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e togli boh',[...two,HI(B,true)])
add('multi',V('Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.'),[...two,HI(B,true)])
add('multi','aggiungi tra i dolci il cannolo a 4 e leva la panna cotta',[CR('Cannolo',4,'Dolci'),HI(PC,true)])
add('multi','aggiungi tra i dolci il cannolo a 4 e la panna cotta è finita',[CR('Cannolo',4,'Dolci'),AV(PC,false)])
add('multi','aggiungi nei primi la gricia a 11 ed elimina la lasagna',[CR('Gricia',11,'Primi'),HI(LAS,true)])

// C) Il caso vocale di Manuel (17/10) e le sue varianti: le aggiunte chiare restano in sospeso, una domanda, la correzione completa tutto
add('manuel',[V(MANUEL_V),V('No, togli bo.')],[...two,HI(B,true)],{replyAt:[[0,ASKB],[0,/Parmigiana/],[0,/Tiramisù/],[0,/Non ho ancora cambiato nulla/]]})
add('manuel',[V(MANUEL_V),'no, togli bo'],[...two,HI(B,true)])
add('manuel',[MANUEL,'no togli boh'],[...two,HI(B,true)])
add('manuel',[MANUEL,'sì'],[...two,HI(B,true)])
add('manuel',[MANUEL,'si'],[...two,HI(B,true)])
add('manuel',[MANUEL,'esatto'],[...two,HI(B,true)])
add('manuel',[MANUEL,'sì, toglilo'],[...two,HI(B,true)])
add('manuel',[MANUEL,V('Sì, toglilo pure.')],[...two,HI(B,true)])
add('manuel',[MANUEL,'togli il boh'],[...two,HI(B,true)])
add('manuel',[MANUEL,'toglibo'],[...two,HI(B,true)])
add('manuel',[MANUEL,'no ho detto togli boh'],[...two,HI(B,true)])
add('manuel',[MANUEL,'ok'],[...two,HI(B,true)])
add('manuel',[MANUEL,'no'],two,{replyAt:[[1,/Non ho toccato \*boh\*/]]})
add('manuel',[MANUEL,'no, lascialo'],two)
add('manuel',[MANUEL,'annulla'],NONE)
add('manuel',[MANUEL,'lascia perdere'],NONE)
for(const t of ['Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toibo.','Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toglibo.','Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tolibo.','Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e levabo.','Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toji bo.','Aggiungi nei piatti di prova la parmigiana a dieci euro, il tiramisù a sei euro e tojibo.','aggiungi nei piatti di prova la parmigiana a 10 euro, tojibo e il tiramisù a 6 euro','Aggiungi tra i piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e togliboh.'])add('manuelv',[V(t),V('No, togli bo.')],[...two,HI(B,true)],{replyAt:[[0,ASKB]]})
add('manuelv',[V('Aggiungi nei piatti di prova la parmigiana a 10 euro e tojibo.'),'sì'],[CR('Parmigiana',10,PP),HI(B,true)],{replyAt:[[0,ASKB]]})
add('manuelv',[V('Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tojichenesacc.'),'sì'],[...two,HI(CS,true)],{replyAt:[[0,ASKCS]]})
add('manuelv',[V('Aggiungi nei primi la gricia a 11, la cacio e pepe a 10 e toglibo.'),'sì'],[CR('Gricia',11,'Primi'),CR('Cacio e pepe',10,'Primi'),HI(B,true)])
add('manuelv',[V('Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tojibo.'),W(11),'sì'],NONE,{note:'proposta scaduta dopo 10 minuti: niente pubblicato'})
add('manuelv',[MANUEL,'la carbonara costa 13'],[P(CARB,13)],{replyAt:[[1,/non l’ho pubblicata/]],note:'comando nuovo: la richiesta in sospeso non si pubblica e lo si dice'})
add('manuelv',[MANUEL,'quanto costa la carbonara?','sì'],[...two,HI(B,true)],{replyAt:[[1,/12,00/]],note:'una domanda non cancella la richiesta in sospeso'})
add('manuelv',[MANUEL,'boh vediamo','no, togli bo'],[...two,HI(B,true)],{replyAt:[[1,ASKB]],note:'risposta non valida: la domanda si ripete'})
add('manuelv',[MANUEL,D(CARB,'price',15),'sì'],NONE,{note:'menu cambiato dalla dashboard nel frattempo: niente pubblicato'})
// Parte incerta che è davvero un piatto nuovo: si chiede il prezzo, le altre restano in sospeso
add('prezzo',['aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e la frittata','8 euro'],[...two,CR('Frittata',8,PP)],{replyAt:[[0,/Quanto costa \*Frittata\*/]]})
add('prezzo',['aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e la frittata','8'],[...two,CR('Frittata',8,PP)])
add('prezzo',['aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e la frittata',V('Otto euro.')],[...two,CR('Frittata',8,PP)])
add('prezzo',['aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e la frittata','a 8,50'],[...two,CR('Frittata',8.5,PP)])
add('prezzo',['aggiungi tra i dolci il cannolo a 4 e la sbrisolona','5 euro'],[CR('Cannolo',4,'Dolci'),CR('Sbrisolona',5,'Dolci')])
add('prezzo',['aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e la frittata','no'],two,{replyAt:[[1,/Non ho aggiunto \*Frittata\*/]]})
add('prezzo',['aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e la frittata','annulla'],NONE)
add('prezzo',['aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tobia','no, togli bo'],[...two,HI(B,true)],{note:'«tobia» trattato come piatto nuovo: la correzione «togli bo» completa con la rimozione'})

// D) Richieste su piatti esistenti con una parte incerta
add('incerto',['la carbonara a 13 e tojibo','sì'],[P(CARB,13),HI(B,true)],{replyAt:[[0,ASKB]]})
add('incerto',['la carbonara a 13 e tojibo','no'],[P(CARB,13)])
add('incerto',[V('La carbonara a 13 e tojibo.'),V('No, togli bo.')],[P(CARB,13),HI(B,true)])
add('incerto',['boh è finito e toglichenesacc','sì'],[...FIN(B),HI(CS,true)],{replyAt:[[0,ASKCS]]})
add('incerto',['la lasagna è finita, toibo','sì'],[AV(LAS,false),HI(B,true)])
add('incerto',['tojibo','sì'],[HI(B,true)],{replyAt:[[0,ASKB]]})
add('incerto',['tojibo','no'],NONE)
add('incerto',[V('Tojibo.'),V('Sì.')],[HI(B,true)])
add('incerto',['toglipiattodiverifica','sì'],[HI(PV,true)],{replyAt:[[0,ASKPV]]})
add('incerto',['la diavola costa 9 e levabo','sì'],[P(DIA,9),HI(B,true)])
add('incerto',['il tiramisù a 6 e tolibo','esatto'],[P(TIR,6),HI(B,true)])
add('incerto',['tojibo','annulla'],NONE)

// E) Falsi positivi: niente domanda, «togli» della promo/etichette non nasconde, nomi nuovi che iniziano come un verbo
add('fp','togli la promo da boh',PR(B,null))
add('fp','togli le ultime porzioni da boh',LP(B,false))
add('fp','leva la promo a che ne sacc',PR(CS,null))
add('fp','togli dall\'evidenza la tagliata',FE(TAG,false),{mods:{featured:[TAG]}})
add('fp','aggiungi tra i dolci levante a 5',CR('Levante',5,'Dolci'))
add('fp','aggiungi tra i dolci il tozzetto a 3',CR('Tozzetto',3,'Dolci'))
add('fp','aggiungi tra i primi i tonnarelli a 11 e i tortelli a 12',[CR('Tonnarelli',11,'Primi'),CR('Tortelli',12,'Primi')])
add('fp','boh, mettiamo la carbonara a 13',P(CARB,13))
add('fp','boh',NONE,{reply:/boh/i})
add('fp','la carbonara costa 13 e la lasagna 12',[P(CARB,13),P(LAS,12)])
add('fp','non togliere boh',NONE)
add('fp','puoi cancellare la carbonara?',NONE,{reply:/eliminare|nascond/i})
add('fp','elimina la categoria dolci',NONE,{reply:/eliminare|categori|dashboard/i})
add('fp','rimetti boh',HI(B,false),{mods:{hidden:[B]}})
add('fp','boh è tornato',AV(B,true),{mods:{unavail:[B]}})

// F) Annulla vero: entro 10 minuti ripristina e pubblica; dopo, o se la dashboard ha cambiato le stesse voci, spiega e non tocca
add('annulla',['la carbonara costa 13','annulla'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla',['togli la lasagna','torna indietro'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla',['la carbonara a 13 e la lasagna a 12','rimetti com\'era'],NONE,{ai:()=>({intent:'change',actions:[{action:'set_price',item_id:ID[CARB],price:13},{action:'set_price',item_id:ID[LAS],price:12}]}),replyAt:[[0,/13,00/],[1,/\*Annullato\.\*/]]})
add('annulla',['la carbonara costa 13','annulla l\'ultima modifica'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla',['la carbonara costa 13','torna come prima'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla',['la carbonara costa 13','no aspetta, annulla'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla',['la carbonara costa 13',V('Annulla.')],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla',['la carbonara costa 13',V('Torna indietro.')],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla',['boh in promo a 8','annulla'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla',['aggiungi tra i dolci il cannolo a 4','annulla'],NONE,{replyAt:[[1,/Cannolo\*: tolto/]]})
add('annulla',[MANUEL,'sì','annulla'],NONE,{replyAt:[[2,/\*Annullato\.\*/]],note:'annulla anche la richiesta multipla completata'})
add('annulla',['la carbonara costa 13','la lasagna costa 12','annulla'],[P(CARB,13)],{replyAt:[[2,/\*Annullato\.\*/]],note:'annulla solo l\'ultima pubblicazione'})
add('annulla',['la carbonara costa 13',W(11),'annulla'],[P(CARB,13)],{replyAt:[[1,/ultimi 10 minuti/]]})
add('annulla',['la carbonara costa 13',D(CARB,'price',15),'annulla'],NONE,{replyAt:[[1,/Non annullo/]],note:'la dashboard ha cambiato la stessa voce: non tocca'})
add('annulla',['la carbonara costa 13',D(LAS,'price',14),'annulla'],NONE,{replyAt:[[1,/\*Annullato\.\*/]],note:'la dashboard ha cambiato un\'altra voce: annulla solo la carbonara'})
add('annulla',['annulla'],NONE,{reply:/Non ci sono modifiche in attesa/})
add('annulla',['la carbonara costa 13','annulla','annulla'],NONE)
const R4AI=()=>({intent:'change',actions:[[CARB,13],[LAS,12],[TAG,20],[COT,16]].map(([d,p])=>({action:'set_price',item_id:ID[d as string],price:p}))})
add('annulla',[R4T,'annulla'],NONE,{ai:R4AI,replyAt:[[0,/OK/],[1,/Il menu è rimasto invariato/]],note:'riepilogo in attesa: annulla resta quello di prima'})
add('annulla',[R4T,'ok','annulla'],NONE,{ai:R4AI,replyAt:[[1,/Confermato/],[2,/\*Annullato\.\*/]],note:'riepilogo confermato e poi annullato'})
add('annulla',['la carbonara costa 13','no'],P(CARB,13),{note:'«no» da solo non annulla una modifica pubblicata'})
add('annulla',['togli boh','rimetti come prima'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla',['boh è finito','annulla'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla',['la carbonara costa 13','annulla',W(2),'la lasagna costa 12'],P(LAS,12))


// G) Altre storpiature e conversazioni (sesto giro, seconda passata)
for(const [t,d] of [['Togli il piatto di verifica.',PV],['Leva pasta al ragù.',PR0],['Togli la pasta al ragù dal menu.',PR0],['Elimina che ne sacc.',CS],['Levami bo.',B],['Togli bho.',B],['Togli il bo dal menu.',B],['Nascondi boh.',B]] as [string,string][])add('storpia',V(t),HI(d,true))
add('storpia','togli boh e che ne sacc',[HI(B,true),HI(CS,true)])
add('storpia','leva la diavola e la margherita',[HI(DIA,true),HI(MAR,true)])
add('storpia',V('Togli boh, che ne sacc e il piatto di verifica.'),[HI(B,true),HI(CS,true),HI(PV,true)])
add('storpia',['la diavola costa 9 e tojichenesacc','sì'],[P(DIA,9),HI(CS,true)],{replyAt:[[0,ASKCS]]})
add('manuel2',[MANUEL,'sì grazie'],[...two,HI(B,true)])
add('manuel2',[MANUEL,'va bene'],[...two,HI(B,true)])
add('manuel2',[MANUEL,'no no'],two)
add('manuel2',[MANUEL,'boh'],NONE,{replyAt:[[1,ASKB]],note:'«boh» non è una risposta: la domanda si ripete'})
add('manuel2',[MANUEL,V('Sì.')],[...two,HI(B,true)])
add('manuel2',[V(MANUEL_V),V('No, ho detto togli boh.')],[...two,HI(B,true)])
add('manuel2',[V(MANUEL_V),V('Toglilo.')],[...two,HI(B,true)])
add('manuel2',['aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e la frittata','8 euro grazie'],[...two,CR('Frittata',8,PP)])
add('annulla2',['la carbonara costa 13','annulla tutto'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla2',['la carbonara costa 13','ops annulla'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla2',[MANUEL,'no','annulla'],NONE,{replyAt:[[2,/\*Annullato\.\*/]]})
add('annulla2',['elimina la lasagna','annulla'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('annulla2',['la carbonara costa 13',W(9),'annulla'],NONE,{replyAt:[[1,/\*Annullato\.\*/]],note:'entro 10 minuti'})
add('annulla2',['la carbonara costa 13','annulla',W(1),'annulla'],NONE,{replyAt:[[2,/Non ci sono modifiche in attesa/]]})
add('annulla2',['togli boh','togli che ne sacc','annulla'],HI(B,true),{replyAt:[[2,/\*Annullato\.\*/]]})
add('annulla2',['boh in promo a 8',D(B,'price',22),'annulla'],PR(B,8),{replyAt:[[1,/Non annullo/]],note:'la dashboard ha cambiato boh: la promo da WhatsApp resta'})

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
const key=(c:Change):string=>(c as any).op==='k'?(c as any).k:c.op==='until'?`until|${c.dish}|${c.date}`:c.op==='create'?`create|${plainT(c.name)}|${c.price}|${c.section?plainT(c.section):'*'}`:c.op==='special'?`special|${plainT(c.name)}|${c.price}`:c.op==='price'?`price|${c.dish}|${c.price}`:c.op==='description'?`description|${c.dish}|${plainT(c.text)}`:c.op==='tag'?`tag|${c.dish}|${c.tag}|${c.value}`:c.op==='promo'?`promo|${c.dish}|${c.price}`:`${c.op}|${c.dish}|${c.value}`
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
 writeFileSync(new URL('results-round6.json',dir),JSON.stringify({cases:C.length,runs:results.length,unknownSql:[...new Set(S.unknownSql)],results},null,1))})

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
 // Sesto giro: risposte attese in turni precisi; la riga «assistente automatico» solo nella prima risposta, una volta.
 if(mode==='ideal')for(const [i,re] of cs.replyAt??[])if(!re.test(replies[i]??''))res.fails.push({sev:'MEDIO',why:`turno ${i+1}: risposta senza ${re}`})
 const ai=copy.aiDisclosure;if(replies.length&&(replies[0]!.split(ai).length-1)!==1)res.fails.push({sev:'MEDIO',why:'prima risposta senza la riga «assistente automatico» (una volta)'})
 for(const [i,r] of replies.entries())if(i>0&&r.includes(ai))res.fails.push({sev:'MEDIO',why:`turno ${i+1}: riga «assistente automatico» ripetuta`})
 // Whisper (17/10): ogni vocale porta nel `prompt` i nomi del locale (categorie e piatti, i più recenti di ogni categoria) e le parole di servizio, ≤ ~200 token.
 for(const pr of prompts.splice(0))if(!(pr.includes('pasta al ragù')&&pr.includes('boh')&&pr.includes('Mezza porzione bimbi')&&pr.includes('Piatti di prova')&&pr.includes('esaurito')&&pr.length<=600))res.fails.push({sev:"MEDIO",why:`prompt Whisper senza i nomi del locale (${pr.length}): ${pr}`})
 // Mai «finito» per un verbo di rimozione: nessuna chiave available|…|false se il caso non la prevede.
 for(const k of actual)if(/^available\|.*\|false$/.test(k)&&!res.expected.includes(k))res.fails.push({sev:'GRAVE',why:`«togli» diventato esaurito: ${k}`})
 results.push(res);return res}

// Fase B (17/10, decisione Manuel): «elimina / cancella / … proprio» = ELIMINARE, solo dopo conferma. I casi scritti quando
// eliminare voleva dire nascondere diventano: richiesta → domanda «Elimino X dal menu?» → «sì» → piatto eliminato (più severo).
for(const cs of C as any[]){const t=(x:any)=>typeof x==='string'?x:x.v??x.b??'';if(cs.turns.length===1&&/\b(?:elimin|cancell)\w*|\b(?:togl|lev)\w* proprio\b/i.test(t(cs.turns[0]))&&cs.changes.length&&cs.changes.every((c:any)=>c.op==='hidden'&&c.value===true)){cs.turns=[...cs.turns,'sì'];cs.changes=cs.changes.map((c:any)=>({op:'k',k:'delete|'+c.dish}));if(cs.replyAt)cs.replyAt=cs.replyAt.map(([i,re]:any)=>[i,/non li elimino/.test(String(re))?/Elimino/:re]);delete cs.ai;delete cs.reply}}

describe('bot titolare: verifica avversaria, sesto giro (togli, parte incerta, annulla vero, riga AI — 17/10)',()=>{
 it('ha tra 150 e 200 casi (sesto giro)',()=>{expect(C.length).toBeGreaterThanOrEqual(150);expect(C.length).toBeLessThanOrEqual(200)})
 for(const cs of C)it(`${cs.id}: ${cs.turns.map(label).join(' ⏎ ').slice(0,90)}`,async()=>{
  const ideal=await run(cs,'ideal'),fails=[...ideal.fails.map(x=>`[ideal] ${x.sev} ${x.why}`)]
  if(ideal.aiCalls>0)for(const mode of ['empty','wrong','wrongCreate'] as AiMode[]){const r=await run(cs,mode);fails.push(...r.fails.map(x=>`[${mode}] ${x.sev} ${x.why}`))}
  expect(fails,`risposte: ${JSON.stringify(ideal.replies)}\nscritto: ${JSON.stringify(ideal.actual)}`).toEqual([])
 })
})
