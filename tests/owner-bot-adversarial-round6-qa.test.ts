// Verifica avversaria del bot WhatsApp del TITOLARE — SESTO GIRO (17/10/2026, perimetro Q): «togli» coerente (= nascondere, mai
// esaurito), il vocale di Manuel con una parte incerta («… e tojibo» = «togli boh»?) che non deve far perdere le parti chiare,
// le correzioni con «no», l'annulla vero entro 10 minuti e la riga «assistente automatico» una sola volta.
// Webhook firmato vero (router + NLU + validatori veri), DB e documento menu in memoria, Groq/Whisper/Twilio finti, orologio fisso.
// Ogni caso gira con un modello «ideale» e, quando passa dall'IA, anche con modelli che rispondono male
// (JSON vuoto, azione su un piatto sbagliato, creazione inventata). Nessuna rete, nessun DB reale, nessun deploy.
// Risultati: docs/webapp/owner-bot-verify-2026-10-16/results-round6-qa.json (scritto a fine run).
// SESTO GIRO sul MENU VERO del QA (istantanea 17/10 14:34, dopo le prove vocali di Manuel): le stesse sequenze della verifica dal vivo,
// tutte deterministiche (nessuna chiamata all'IA: dal vivo la risposta dell'IA arriverebbe sul telefono di Manuel).
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

// ---------------- Fixture: menu vero del QA (istantanea) ----------------
import {readFileSync} from 'node:fs'
const QA_DOC=JSON.parse(readFileSync(new URL('../docs/webapp/bot-cervello-2026-10-17/live-Q/qa-workspace-1017.json',import.meta.url),'utf8')).published
const qaItems=QA_DOC.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>({...i,section:s.name,sectionId:s.id}))))
const ID:Record<string,string>=Object.fromEntries(qaItems.map((i:any)=>[i.name,i.id]))
const SEC:Record<string,string>=Object.fromEntries(QA_DOC.menus.flatMap((m:any)=>m.sections.map((s:any)=>[s.name,s.id])))
type Mods={unavail?:string[],hidden?:string[],featured?:string[],tags?:Record<string,string[]>,promo?:Record<string,number>,last?:string[],today?:string[],prices?:Record<string,number>}
const todayIso=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(new Date())
function fixture(_m:Mods={}){return workspaceSchema.parse(structuredClone(QA_DOC))}

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
type Change={op:'create',name:string,price:number,section?:string}|{op:'price',dish:string,price:number}|{op:'available'|'hidden'|'featured'|'last'|'today',dish:string,value:boolean}|{op:'description',dish:string,text:string}|{op:'tag',dish:string,tag:string,value:boolean}|{op:'promo',dish:string,price:number|null}|{op:'until',dish:string,date:string|null}|{op:'special',name:string,price:number}
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
// ===== SESTO GIRO sul menu vero del QA: le sequenze della verifica dal vivo (live-Q/verify-live-q.mjs) =====
const D=(nm:string,field:string,val:any)=>({dash:[nm,field,val] as [string,string,any]})
const B='boh',CS='Che ne sacc',PV='Piatto di verifica',PP='Piatti di prova'
const ASKB=/Intendi \*togliere boh\*/
const M='aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tojibo'
const NEW='aggiungi nei piatti di prova la caprese a 9 euro, il cannolo a 4 euro e tojibo'
const TWO=[CR('Caprese',9,PP),CR('Cannolo',4,PP)]
// Il caso di Manuel sul menu di oggi: parmigiana e tiramisù ci sono già (aggiunti dal suo vocale delle 13:26): non si raddoppiano.
add('live','x',NONE)
C.pop()
add('live',[M,'no, togli bo'],HI(B,true),{replyAt:[[0,ASKB],[0,/già in \*Piatti di prova\*/],[1,/Confermato/]]})
add('live',[M,'sì'],HI(B,true),{replyAt:[[0,ASKB]]})
add('live',[M.replace('tojibo','toibo'),'no, togli boh'],HI(B,true),{replyAt:[[0,ASKB]]})
add('live',[NEW,'sì'],[...TWO,HI(B,true)],{replyAt:[[0,ASKB]]})
add('live',[NEW,'no'],TWO,{replyAt:[[1,/Non ho toccato \*boh\*/]]})
add('live',[NEW,'annulla'],NONE,{replyAt:[[1,/Annullato/]]})
add('live',['aggiungi nei piatti di prova la caprese a 9 euro e togli boh'],[CR('Caprese',9,PP),HI(B,true)])
add('live',['piatto di verifica a 14 e tojibo','sì'],[P(PV,14),HI(B,true)],{replyAt:[[0,ASKB]]})
add('live',['tojibo','no'],NONE,{replyAt:[[0,ASKB]]})
add('live',['togli che ne sacc'],HI(CS,true),{replyAt:[[0,/nascosto/]]})
add('live',['elimina boh'],HI(B,true),{replyAt:[[0,/non li elimino/]]})
add('live',['aggiungi nei piatti di prova la caprese a 9 euro, il cannolo a 4 euro e la frittata','8 euro'],[...TWO,CR('Frittata',8,PP)],{replyAt:[[0,/Quanto costa \*Frittata\*/]]})
add('live',['piatto di verifica a 14','annulla'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('live',[NEW,'sì','torna indietro'],NONE,{replyAt:[[2,/\*Annullato\.\*/]]})
add('live',['togli che ne sacc','rimetti com\'era'],NONE,{replyAt:[[1,/\*Annullato\.\*/]]})
add('live',['piatto di verifica a 14',D(PV,'price',15),'annulla'],NONE,{replyAt:[[1,/Non annullo/]]})
add('live',['annulla'],NONE,{reply:/Non ci sono modifiche in attesa/})
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
 writeFileSync(new URL('results-round6-qa.json',dir),JSON.stringify({cases:C.length,runs:results.length,unknownSql:[...new Set(S.unknownSql)],results},null,1))})

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
 if(res.aiCalls>0)res.fails.push({sev:'GRAVE',why:`passato all'IA (${res.aiCalls}): dal vivo la risposta arriverebbe sul telefono di Manuel`})
 if(mode==='ideal')for(const [i,re] of cs.replyAt??[])if(!re.test(replies[i]??''))res.fails.push({sev:'MEDIO',why:`turno ${i+1}: risposta senza ${re}`})
 const ai=copy.aiDisclosure;if(replies.length&&(replies[0]!.split(ai).length-1)!==1)res.fails.push({sev:'MEDIO',why:'prima risposta senza la riga «assistente automatico» (una volta)'})
 for(const [i,r] of replies.entries())if(i>0&&r.includes(ai))res.fails.push({sev:'MEDIO',why:`turno ${i+1}: riga «assistente automatico» ripetuta`})
 // Whisper (17/10): ogni vocale porta nel `prompt` i nomi del locale (categorie e piatti, i più recenti di ogni categoria) e le parole di servizio, ≤ ~200 token.
 for(const pr of prompts.splice(0))if(!(pr.includes('pasta al ragù')&&pr.includes('boh')&&pr.includes('Mezza porzione bimbi')&&pr.includes('Piatti di prova')&&pr.includes('esaurito')&&pr.length<=600))res.fails.push({sev:"MEDIO",why:`prompt Whisper senza i nomi del locale (${pr.length}): ${pr}`})
 // Mai «finito» per un verbo di rimozione: nessuna chiave available|…|false se il caso non la prevede.
 for(const k of actual)if(/^available\|.*\|false$/.test(k)&&!res.expected.includes(k))res.fails.push({sev:'GRAVE',why:`«togli» diventato esaurito: ${k}`})
 results.push(res);return res}

describe('bot titolare: sesto giro sul menu vero del QA (sequenze della verifica dal vivo, 17/10)',()=>{
 it('ha le 17 sequenze della verifica dal vivo',()=>{expect(C.length).toBe(17)})
 for(const cs of C)it(`${cs.id}: ${cs.turns.map(label).join(' ⏎ ').slice(0,90)}`,async()=>{
  const ideal=await run(cs,'ideal'),fails=[...ideal.fails.map(x=>`[ideal] ${x.sev} ${x.why}`)]
  if(ideal.aiCalls>0)for(const mode of ['empty','wrong','wrongCreate'] as AiMode[]){const r=await run(cs,mode);fails.push(...r.fails.map(x=>`[${mode}] ${x.sev} ${x.why}`))}
  expect(fails,`risposte: ${JSON.stringify(ideal.replies)}\nscritto: ${JSON.stringify(ideal.actual)}`).toEqual([])
 })
})
