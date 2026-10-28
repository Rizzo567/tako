// Feature 1 — menu intero da messaggio o vocale (WhatsApp). Webhook firmato vero, DB e documento menu in memoria,
// Groq (modello e whisper) e Twilio finti: nessuna rete, nessun DB reale. Criteri di accettazione del prompt 16/10.
import {createRequire} from 'node:module'
import {afterAll,beforeEach,describe,expect,it,vi} from 'vitest'
import {twilioSignature} from '../apps/server/src/lib/twilio-menu-command.js'
import {copy,fullMenuCopy} from '../apps/server/src/lib/twilio-menu-copy.js'
import {normalizeSpokenPrices} from '../apps/server/src/lib/menu-spoken-prices.js'
import {verifyFullMenu} from '../apps/server/src/lib/menu-full-extract.js'
import {verifyOnboardingMenuRow} from '../apps/server/src/lib/onboarding-planner.js'
import {replaceMenuContent,restoreMenuFrom} from '../apps/server/src/lib/menu-replace.js'
import {fullMenuSignal,applyCorrections} from '../apps/server/src/lib/menu-full-flow.js'
import {operationalDay} from '../apps/server/src/lib/menu-operational-day.js'
import {setTranslationEnqueue} from '../apps/server/src/lib/menu-translation-queue.js'
import {setMenuPresetTarget} from '../apps/server/src/lib/menu-preset-target.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'

const S=vi.hoisted(()=>({draft:null as any,published:null as any,revision:5,published_revision:5,versions:[] as {revision:number,label:string,snapshot:any}[],proposals:new Map<string,{revision:number,command:any}>(),messages:new Map<string,string>(),links:new Set<string>(),usage:0}))
vi.mock('../apps/server/src/lib/onboarding-chat.js',()=>({expiredOnboardingNotice:async()=>null,startsOnboarding:()=>false,onboardingTransport:async()=>null,queueOnboardingChat:async()=>false}))
const tenant='26050ecd-2e55-4057-a4c5-bff2b449cd47',actor='44444444-4444-4444-8444-444444444444',phone='whatsapp:+390000000099'
const parse=(q:any)=>{let text='';const params:unknown[]=[];for(const c of q.queryChunks)if(c&&typeof c==='object'&&Array.isArray(c.value))text+=c.value.join('');else{text+='$';params.push(c)}return{text,params}}
const execute=async(q:unknown):Promise<any[]>=>{const {text,params}=parse(q),p=params as any[]
 if(text.startsWith('SELECT 1 FROM tako_whatsapp_links'))return S.links.has(p[0])?[{}]:[]
 if(text.startsWith('SELECT restaurant_id,actor_id,activated_at FROM tako_whatsapp_links'))return S.links.has(p[0])?[{restaurant_id:tenant,actor_id:actor,activated_at:new Date()}]:[]
 if(text.includes('FROM users u'))return[{id:actor,restaurant_id:tenant,role:'owner',active:true}]
 if(text.includes('pg_advisory_xact_lock'))return[]
 if(text.startsWith('SELECT response FROM tako_whatsapp_messages'))return S.messages.has(p[0])?[{response:S.messages.get(p[0])}]:[]
 if(text.startsWith('INSERT INTO tako_whatsapp_messages')){if(!S.messages.has(p[0]))S.messages.set(p[0],p[1]);return[]}
 if(text.startsWith('UPDATE tako_whatsapp_messages')){S.messages.set(p[1],p[0]);return[]}
 if(text.startsWith('SELECT settings FROM restaurants'))return[{settings:{}}]
 if(text.startsWith('SELECT name FROM restaurants'))return[{name:'Osteria Prova'}]
 if(text.startsWith('DELETE FROM tako_whatsapp_proposals')){S.proposals.delete(p[0]);return[]}
 if(text.startsWith('SELECT 1 FROM tako_whatsapp_proposals'))return S.proposals.has(p[0])?[{}]:[]
 if(text.startsWith('SELECT command,revision FROM tako_whatsapp_proposals')){const x=S.proposals.get(p[0]);return x?[structuredClone(x)]:[]}
 if(text.startsWith('SELECT command FROM tako_whatsapp_proposals')){const x=S.proposals.get(p[0]);return x?[{command:structuredClone(x.command)}]:[]}
 if(text.startsWith('INSERT INTO tako_whatsapp_proposals')){S.proposals.set(p[0],{revision:p[3],command:JSON.parse(p[4])});return[]}
 if(text.startsWith('SELECT revision,label,snapshot FROM menu_workspace_versions')){const hits=S.versions.filter(v=>v.label.startsWith(String(p[1]).replace('%',''))||v.label.startsWith(String(p[2]).replace('%',''))).sort((a,b)=>b.revision-a.revision);return hits.slice(0,1).map(v=>structuredClone(v))}
 if(text.startsWith('INSERT INTO tako_whatsapp_ai_usage')){S.usage++;return[{requests:1,prompt_tokens:0,completion_tokens:0,audio_seconds:0,warned_at:null}]}
 if(text.startsWith('INSERT INTO tako_whatsapp_errors'))return[{id:1}]
 if(text.startsWith('SELECT count(*)::int AS n FROM tako_whatsapp_errors'))return[{n:0}]
 throw new Error('Unexpected SQL '+text.slice(0,80))}
vi.mock('../packages/db/src/index.ts',()=>({db:{execute:(q:unknown)=>execute(q),transaction:(fn:any)=>fn({execute})},sessions:{},users:{}}))
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',()=>({
 readWorkspace:async()=>({draft:structuredClone(S.draft),published:structuredClone(S.published),revision:S.revision,published_revision:S.published_revision}),
 mutateWorkspace:async(_t:string,_a:string,expected:number,w:any,publish:boolean,label:string)=>{if(expected!==S.revision)throw new Error('Revision conflict');if(publish)S.published=structuredClone(S.draft);else S.draft=structuredClone(w);S.revision++;if(publish)S.published_revision=S.revision;S.versions.push({revision:S.revision,label,snapshot:structuredClone(publish?S.draft:w)});return{revision:S.revision}}}))
import {twilioMenuRoutes} from '../apps/server/src/routes/twilio-menu.js'
const Fastify=createRequire(new URL('../apps/server/package.json',import.meta.url))('fastify')

const id=(n:number)=>`55555555-5555-4555-8555-${String(n).padStart(12,'0')}`,sec=(n:number)=>`77777777-7777-4777-8777-${String(n).padStart(12,'0')}`
const PRANZO='66666666-6666-4666-8666-000000000001',CENA='66666666-6666-4666-8666-000000000002',DRINKS='66666666-6666-4666-8666-000000000003'
const item=(n:number,name:string,price:number,extra:any={})=>({id:id(n),name,price,...extra})
function fixture(withDinner=false){return workspaceSchema.parse({menus:[
 {id:PRANZO,name:'Pranzo',type:'lunch',sections:[{id:sec(1),name:'Primi',items:[item(1,'Carbonara',10,{translations:{en:{name:'Carbonara',sourceFingerprint:'x'}}}),item(2,'Lasagna',11),item(3,'Gricia',10)]},{id:sec(2),name:'Secondi',items:[item(4,'Branzino',18),item(5,'Tagliata',16)]},{id:sec(3),name:'Dolci',items:[item(6,'Tiramisù',5)]}]},
 ...(withDinner?[{id:CENA,name:'Cena',type:'dinner',sections:[{id:sec(4),name:'Pizze',items:[item(7,'Margherita',8),item(8,'Diavola',9)]}]}]:[]),
 {id:DRINKS,name:'Drinks',type:'drinks',sections:[{id:sec(5),name:'Bevande',items:[item(9,'Acqua',2),item(10,'Vino della casa',5)]}]}],design:{}})}

// ---- Groq e Twilio finti (fetch globale) ----
const net={model:null as null|((source:string)=>any),planner:0,plannerText:'',chats:0,transcript:'',whisper:0,sent:[] as string[]}
const row=(section:string,name:string,price:number|null,evidence:string)=>({section,name,price,description:'',evidence})
const realFetch=globalThis.fetch
vi.stubGlobal('fetch',async(url:any,init:any)=>{const u=String(url)
 if(u.includes('/chat/completions')){const user=JSON.parse(init.body).messages[1].content;let source:string;try{source=JSON.parse(user).source}catch{net.planner++;net.plannerText=user;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({intent:'clarify',item_ids:[]})}}],usage:{prompt_tokens:1,completion_tokens:1}}),{status:200,headers:{'Content-Type':'application/json'}})}net.chats++;const content=net.model?net.model(source):{rows:[],issues:[]};return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(content)}}],usage:{total_tokens:900}}),{status:200,headers:{'Content-Type':'application/json'}})}
 if(u.includes('/audio/transcriptions')){net.whisper++;return new Response(JSON.stringify({text:net.transcript,duration:6}),{status:200,headers:{'Content-Type':'application/json'}})}
 if(u.endsWith('/Messages.json')){net.sent.push(new URLSearchParams(String(init.body)).get('Body')!);return new Response('{}',{status:201,headers:{'Content-Type':'application/json'}})}
 if(u.includes('/Media/'))return new Response(new Uint8Array([79,103,103,83]),{status:200,headers:{'Content-Type':'audio/ogg'}})
 return realFetch(url,init)})
afterAll(()=>vi.unstubAllGlobals())

const token='f1-token',self='https://takoitalia.com/api/whatsapp/twilio',account='AC'+'2'.repeat(32),sender='whatsapp:+18382622788'
Object.assign(process.env,{TWILIO_AUTH_TOKEN:token,TWILIO_WEBHOOK_URL:self,TWILIO_ACCOUNT_SID:account,TWILIO_WHATSAPP_NUMBER:sender,GROQ_API_KEY:'test-key'})
delete process.env.GROQ_API_BASE;delete process.env.TWILIO_API_BASE;delete process.env.TAKO_WHATSAPP_ONBOARDING_ENABLED
let n=0;const sid=(p='SM')=>p+(++n).toString(16).padStart(32,'0')
const post=(a:any,fields:Record<string,string>)=>{const form={AccountSid:account,From:phone,To:sender,NumMedia:'0',...fields};return a.inject({method:'POST',url:'/api/whatsapp/twilio',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':twilioSignature(token,self,form)},payload:new URLSearchParams(form).toString()})}
const unxml=(s:string)=>s.replace(/<[^>]+>/g,'').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
/** Sends a text and returns what the owner sees: the immediate TwiML answer, or the message sent by the background job. */
async function say(a:any,body:string){const before=net.sent.length,res=await post(a,{MessageSid:sid(),Body:body}),now=unxml(res.body).trim();return now||net.sent.slice(before).join('\n')}
async function voice(a:any,transcript:string){net.transcript=transcript;const before=net.sent.length,s=sid('MM');await post(a,{MessageSid:s,Body:'',NumMedia:'1',MediaContentType0:'audio/ogg',MediaUrl0:`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages/${s}/Media/ME1`});return net.sent.slice(before).join('\n')}
const app=async()=>{const a=Fastify();await a.register(twilioMenuRoutes,{prefix:'/api'});return a}
const menu=(w:any,mid:string)=>w.menus.find((m:any)=>m.id===mid)
const items=(w:any,mid:string)=>menu(w,mid).sections.flatMap((s:any)=>s.items.map((i:any)=>({...i,section:s.name})))
const byName=(w:any,mid:string,name:string)=>items(w,mid).find((i:any)=>i.name.toLowerCase()===name.toLowerCase())
let queued:string[][]=[]
beforeEach(()=>{S.draft=fixture();S.published=fixture();S.revision=5;S.published_revision=5;S.versions=[];S.proposals.clear();S.messages.clear();S.messages.set('ai:'+phone,'1')/* riga AI Act già mostrata (17/10) */;S.links=new Set([phone]);net.model=null;net.chats=0;net.planner=0;net.whisper=0;net.sent=[];queued=[];setTranslationEnqueue(async(_r,texts)=>{queued.push(texts)})})

/** Ideal model: one row per «name price» line, citing the source exactly (as the real model does on text). */
const ideal=(lines:[string,string,number][])=>(source:string)=>({rows:lines.filter(([,name])=>source.toLowerCase().includes(name.toLowerCase())).map(([s,name,price])=>{const at=source.toLowerCase().indexOf(name.toLowerCase()),ev=source.slice(at).match(/^[^,.;\n]+/)![0];return row(s,source.slice(at,at+name.length),price,ev)}),issues:[]})
const twelve='Menu di oggi.\nPrimi: carbonara 11, amatriciana 9, cacio e pepe 10, gricia 10.\nSecondi: tagliata 16, saltimbocca 15, pollo alla cacciatora 13.\nContorni: patate al forno 4, cicoria 4.\nDolci: tiramisù 5, panna cotta 5, crostata 4.'
const twelveModel=ideal([['Primi','carbonara',11],['Primi','amatriciana',9],['Primi','cacio e pepe',10],['Primi','gricia',10],['Secondi','tagliata',16],['Secondi','saltimbocca',15],['Secondi','pollo alla cacciatora',13],['Contorni','patate al forno',4],['Contorni','cicoria',4],['Dolci','tiramisù',5],['Dolci','panna cotta',5],['Dolci','crostata',4]])

describe('F1 accettazione: testo di 12 piatti → riepilogo, OK, menu aggiornato',()=>{
 it('riassume tutto, non scrive nulla prima dell’OK; dopo l’OK aggiorna, nasconde i vecchi e lascia intatti gli altri menu',async()=>{const a=await app();net.model=twelveModel;const drinks=structuredClone(menu(S.draft,DRINKS))
  const summary=await say(a,twelve)
  expect(net.chats).toBe(1);expect(S.versions).toHaveLength(0);expect(S.revision).toBe(5)
  for(const name of ['Carbonara: 11,00 €','Amatriciana: 9,00 €','Cacio e pepe: 10,00 €','Gricia: 10,00 €','Tagliata: 16,00 €','Saltimbocca: 15,00 €','Pollo alla cacciatora: 13,00 €','Patate al forno: 4,00 €','Cicoria: 4,00 €','Tiramisù: 5,00 €','Panna cotta: 5,00 €','Crostata: 4,00 €'])expect(summary).toContain('- '+name)
  expect(summary).toContain('*Primi*');expect(summary).toContain('*Contorni*');expect(summary).toContain('menu *Pranzo*, al posto di quello attuale')
  expect(summary).toContain('Confermi? Rispondi OK, oppure correggi (es. "la carbonara è 12")')
  expect(summary).toContain('2 nascosti (non eliminati): Lasagna, Branzino');expect(summary).toContain('Gli altri menu non cambiano: Drinks')
  const done=await say(a,'OK')
  expect(done).toContain('*Fatto.* Il menu *Pranzo* è online con 12 piatti');expect(done).toContain('ripristina il menu di prima')
  expect(S.published_revision).toBe(S.revision);expect(S.versions.map(v=>v.label)).toEqual(['WhatsApp: copia prima del menu intero #'+PRANZO,'WhatsApp: menu intero (bozza)','WhatsApp: menu intero pubblicato'])
  const w=S.published,visible=items(w,PRANZO).filter((i:any)=>!i.hidden)
  expect(visible.map((i:any)=>i.name)).toEqual(['Carbonara','Amatriciana','Cacio e pepe','Gricia','Tagliata','Saltimbocca','Pollo alla cacciatora','Patate al forno','Cicoria','Tiramisù','Panna cotta','Crostata'])
  expect(byName(w,PRANZO,'Carbonara')).toMatchObject({id:id(1),price:11,hidden:false,translations:{en:{name:'Carbonara'}}})
  expect(byName(w,PRANZO,'Lasagna')).toMatchObject({id:id(2),hidden:true});expect(byName(w,PRANZO,'Branzino')).toMatchObject({id:id(4),hidden:true})
  expect(items(w,PRANZO).filter((i:any)=>i.price===0)).toHaveLength(0)
  expect(menu(w,DRINKS)).toEqual(drinks);expect(S.proposals.size).toBe(0)
  // traduzioni: solo i testi nuovi, mai quelli già presenti (Carbonara, Gricia, Tagliata, Tiramisù)
  expect(queued).toHaveLength(1);expect(queued[0]).toEqual(expect.arrayContaining(['Amatriciana','Cacio e pepe','Contorni','Crostata']));for(const old of ['Carbonara','Gricia','Tagliata','Tiramisù'])expect(queued[0]).not.toContain(old)
  await a.close()})
})

describe('F1 accettazione: vocale → trascrizione completa in chat, poi OK',()=>{
 it('riscrive tutto il menu dal vocale, accetta solo l’OK scritto e poi pubblica',async()=>{const a=await app()
  // Forme reali di whisper+gpt-oss del 16/10: prezzo dentro il nome, «4 euro e 50», una riga saltata dal modello.
  net.model=()=>({rows:[row('primi','carbonara',10,'carbonara 10 euro'),row('primi','amatriciana 9 euro e 50',null,'amatriciana 9 euro e 50'),row('secondi','tagliata',16,'tagliata 16 euro'),row('dolci','panna cotta',4,'panna cotta 4 euro e 50')],issues:[]})
  const summary=await voice(a,'Menù di oggi, primi, carbonara 10 euro, amatriciana 9 euro e 50, secondi, tagliata 16 euro, dolci, tiramisù 5 euro, panna cotta 4 euro e 50.')
  expect(net.whisper).toBe(1);expect(summary).toContain('dal *vocale*')
  for(const line of ['- Carbonara: 10,00 €','- Amatriciana: 9,50 €','- Tagliata: 16,00 €','- Tiramisù: 5,00 €','- Panna cotta: 4,50 €'])expect(summary).toContain(line)
  expect(S.versions).toHaveLength(0)
  expect(await voice(a,'ok')).toContain(copy.typedOk);expect(S.versions).toHaveLength(0)
  expect(await say(a,'ok')).toContain('*Fatto.*');const w=S.published
  expect(byName(w,PRANZO,'Amatriciana')).toMatchObject({price:9.5,hidden:false});expect(byName(w,PRANZO,'Tiramisù')).toMatchObject({id:id(6),price:5,hidden:false});expect(byName(w,PRANZO,'Lasagna').hidden).toBe(true)
  await a.close()})
})

describe('F1 accettazione: senza destinazione su un locale con pranzo e cena',()=>{
 it('fa una sola domanda con le opzioni vere, non chiama il modello e non modifica niente; la risposta sceglie il menu',async()=>{S.draft=fixture(true);S.published=fixture(true);const a=await app()
  net.model=ideal([['Primi','carbonara',10],['Primi','amatriciana',9],['Secondi','tagliata',16],['Dolci','tiramisù',5]])
  const ask=await say(a,'Primi: carbonara 10, amatriciana 9. Secondi: tagliata 16. Dolci: tiramisù 5.')
  expect(ask).toContain('Dove lo metto?');expect(ask).toContain('*Pranzo* o *Cena*');expect(ask).not.toContain('Drinks');expect(ask).toContain('Non ho ancora cambiato nulla.')
  expect(net.chats).toBe(0);expect(S.versions).toHaveLength(0);expect(S.draft).toEqual(fixture(true))
  const summary=await say(a,'cena');expect(net.chats).toBe(1);expect(summary).toContain('menu *Cena*, al posto di quello attuale');expect(summary).toContain('2 nascosti (non eliminati): Margherita, Diavola')
  await say(a,'OK');const w=S.published
  expect(menu(w,PRANZO)).toEqual(menu(fixture(true),PRANZO));expect(items(w,CENA).filter((i:any)=>!i.hidden).map((i:any)=>i.name)).toEqual(['Carbonara','Amatriciana','Tagliata','Tiramisù'])
  expect(byName(w,CENA,'Carbonara').id).not.toBe(id(1))
  await a.close()})
 it('«pranzo di oggi» nel messaggio decide da solo, senza domanda',async()=>{S.draft=fixture(true);S.published=fixture(true);const a=await app();net.model=ideal([['Primi','gnocchi',10],['Primi','risotto',12]])
  const summary=await say(a,'Pranzo di oggi: gnocchi 10, risotto 12');expect(summary).toContain('menu *Pranzo*, al posto di quello attuale');expect(summary).not.toContain('Dove lo metto');await a.close()})
 it('«menu di lunedì» senza preset attivi: lo dice e propone solo il menu attuale',async()=>{const a=await app();net.model=ideal([['Primi','gnocchi',10],['Primi','risotto',12]])
  const ask=await say(a,'Menu di lunedì: primi gnocchi 10, risotto 12');expect(ask).toContain(fullMenuCopy.presetOff);expect(ask).toContain('al posto');expect(net.chats).toBe(0)
  const summary=await say(a,'al posto');expect(summary).toContain('menu *Pranzo*, al posto di quello attuale');await a.close()})
 it('con i preset attivi (Feature 2) propone anche il preset e salva lì, senza toccare il menu online',async()=>{const saved:any[]=[];const undo=setMenuPresetTarget({enabled:async(_t,_r,menuId)=>menuId===PRANZO,save:async(_t,input)=>{saved.push(input);return{label:'preset *Lunedì* del Pranzo'}}});try{const a=await app();net.model=ideal([['Primi','gnocchi',10],['Primi','risotto',12]])
  const ask=await say(a,'Primi: gnocchi 10, risotto 12. Secondi: polpette 13');expect(ask).toContain('nel *preset di un giorno*')
  const summary=await say(a,'lunedì');expect(summary).toContain('preset *Lunedì* del menu *Pranzo*');expect(summary).toContain('il menu online non cambia')
  expect(await say(a,'OK')).toContain('Ho salvato il menu nel preset *Lunedì* del Pranzo');expect(saved).toHaveLength(1);expect(saved[0].destination).toEqual({kind:'preset',menuId:PRANZO,weekday:1,name:'Lunedì'})
  expect(saved[0].sections[0].items.slice(0,2).map((i:any)=>i.name)).toEqual(['Gnocchi','Risotto']);expect(S.versions).toHaveLength(0);await a.close()}finally{undo()}})
})

describe('F1 accettazione: piatto senza prezzo',()=>{
 it('lo segnala, non lo mette mai online a 0 €; con il prezzo in correzione entra nel menu',async()=>{const a=await app()
  net.model=()=>({rows:[row('Primi','carbonara',10,'carbonara 10'),row('Secondi','tagliata',16,'tagliata 16')],issues:['*Amatriciana*: manca il prezzo']})
  const summary=await say(a,'Menu di oggi. Primi: carbonara 10, amatriciana, gricia. Secondi: tagliata 16.')
  expect(summary).toContain('*Senza prezzo*, non li metto online: *Amatriciana*, *Gricia*')
  const fixed=await say(a,'amatriciana 9');expect(fixed).toContain('Fatto: *Amatriciana*: *9,00 €*');expect(fixed).toContain('- Amatriciana: 9,00 €');expect(fixed).toContain('*Senza prezzo*, non li metto online: *Gricia*')
  const done=await say(a,'OK');expect(done).toContain('Non ho messo online: *Gricia* (senza prezzo)')
  const w=S.published;expect(byName(w,PRANZO,'Amatriciana').price).toBe(9);expect(byName(w,PRANZO,'Gricia').hidden).toBe(true);expect(items(w,PRANZO).some((i:any)=>i.price===0)).toBe(false)
  await a.close()})
})

describe('F1 accettazione: correzioni, annulla e ripristina',()=>{
 it('«la carbonara è 11» corregge la bozza; «annulla» la butta via senza toccare il menu',async()=>{const a=await app();net.model=twelveModel
  await say(a,twelve);const fixed=await say(a,'la carbonara è 12, togli la crostata');expect(fixed).toContain('*Carbonara*: 11,00 € → *12,00 €*');expect(fixed).toContain('*Crostata*: tolto');expect(fixed).not.toContain('- Crostata')
  expect(await say(a,'boh qualcosa')).toContain(fullMenuCopy.pending)
  expect(await say(a,'annulla')).toBe(copy.cancelled);expect(S.versions).toHaveLength(0);expect(S.draft).toEqual(fixture());expect(S.proposals.size).toBe(0)
  expect(await say(a,'OK')).toBe(copy.nothingToConfirm);await a.close()})
 it('«ripristina il menu di prima» riporta solo quel menu; una modifica fatta dopo su un altro menu resta',async()=>{const a=await app();net.model=twelveModel
  expect(await say(a,'ripristina il menu di prima')).toBe(fullMenuCopy.restoreNone)
  await say(a,twelve);await say(a,'OK');expect(byName(S.published,PRANZO,'Lasagna').hidden).toBe(true)
  expect(await say(a,'esaurito vino della casa')).toContain('*Vino della casa*: *finito*')
  const back=await say(a,'ripristina il menu di prima');expect(back).toContain('*Ripristinato.* Il menu *Pranzo*')
  const w=S.published;expect(menu(w,PRANZO).sections).toEqual(fixture().menus[0]!.sections);expect(byName(w,DRINKS,'Vino della casa').available).toBe(false)
  expect(await say(a,'ripristina il menu di prima')).toBe(fullMenuCopy.restoreDone);await a.close()})
 it('il riepilogo scade se il menu cambia nel frattempo (dashboard): niente pubblicazione',async()=>{const a=await app();net.model=twelveModel;await say(a,twelve);S.revision=9;S.published_revision=9
  expect(await say(a,'OK')).toBe(copy.menuChanged);expect(S.versions).toHaveLength(0);await a.close()})
})

describe('F1 regressione: le modifiche singole si comportano come prima',()=>{
 it('«è finita la carbonara» e «prezzo branzino a 19» si applicano subito; «carbonara finita» ora deterministico (G8)',async()=>{const a=await app()
  expect(await say(a,'è finita la carbonara')).toContain('*Carbonara*: *finito*');expect(await say(a,'prezzo branzino a 19')).toContain('*Branzino*: prezzo da 18,00 € a *19,00 €*')
  // G8 (16/10): «X finita» senza «è» ora è deterministico (prima andava al pianificatore).
  expect(net.planner).toBe(0);expect(await say(a,'carbonara finita')).toBe(copy.noChanges);expect(net.planner).toBe(0)
  expect(net.chats).toBe(0);expect([...S.proposals.values()].some(p=>p.command.kind==='fullmenu')).toBe(false);expect(byName(S.published,PRANZO,'Lasagna').hidden).toBe(false);await a.close()})
 it('più prezzi su piatti già nel menu restano modifiche (non un menu intero)',()=>{const refs=items(fixture(),PRANZO).map((i:any)=>({...i,menu:'Pranzo',available:true,hidden:false}))
  for(const t of ['carbonara 12, lasagna 12, branzino 19, tiramisù 6','carbonara finita','branzino 18','porta la carbonara a 12 e la lasagna a 13','aggiungi tra i primi: pasta al ragù, 12 euro','quanto costa la tagliata?'])expect(fullMenuSignal(t,refs),t).toBeNull()
  for(const t of [twelve,'Menu di oggi. Primi: carbonara 10, amatriciana 9. Secondi: tagliata 16. Dolci: tiramisù 5.','allora menu di lunedì antipasti bruschetta cinque tagliere dodici e cinquanta primi lasagna undici'])expect(fullMenuSignal(t,refs),t).toBe('full')
  expect(fullMenuSignal('gnocchi 10, risotto 12, polpette 13, sorbetto 4',refs)).toBe('doubt')})
 it('nel dubbio, MODIFICHE rimanda il messaggio originale al pianificatore delle modifiche, senza riepilogo del menu intero',async()=>{const a=await app()
  expect(await say(a,'gnocchi 10, risotto 12, polpette 13, sorbetto 4')).toBe(fullMenuCopy.doubt)
  expect(await say(a,'modifiche')).toBe(copy.notUnderstood);expect(net.planner).toBe(1);expect(net.plannerText).toContain('MESSAGGIO\ngnocchi 10, risotto 12, polpette 13, sorbetto 4');expect(net.chats).toBe(0)
  expect(await say(a,'branzino')).not.toBe(fullMenuCopy.doubtAgain);expect([...S.proposals.values()].some(p=>p.command.kind==='fullmenu')).toBe(false);await a.close()})
 it('nel dubbio fa una sola domanda: MENU porta al menu intero, MODIFICHE al flusso di prima',async()=>{const a=await app();net.model=ideal([['Menu','gnocchi',10],['Menu','risotto',12],['Menu','polpette',13],['Menu','sorbetto',4]])
  expect(await say(a,'gnocchi 10, risotto 12, polpette 13, sorbetto 4')).toBe(fullMenuCopy.doubt);expect(net.chats).toBe(0)
  const summary=await say(a,'menu');expect(summary).toContain('- Gnocchi: 10,00 €');expect(summary).toContain('menu *Pranzo*');await a.close()})
})

describe('F1 parti pure',()=>{
 it('prezzi parlati: 29/30 forme passano il cancello dopo la normalizzazione della citazione (spike 18/30)',()=>{
  const cases:[string,string,number][]=[['carbonara 10','carbonara',10],['carbonara 10 euro','carbonara',10],['carbonara 10,50','carbonara',10.5],['carbonara 10.50','carbonara',10.5],['carbonara 10 euro e 50','carbonara',10.5],['carbonara 10 e 50','carbonara',10.5],['carbonara 10 euro e cinquanta','carbonara',10.5],['carbonara dieci euro','carbonara',10],['carbonara dieci euro e cinquanta','carbonara',10.5],['carbonara dieci euro e cinquanta centesimi','carbonara',10.5],['carbonara dieci e cinquanta','carbonara',10.5],['carbonara dieci cinquanta','carbonara',10.5],['carbonara dieci','carbonara',10],['carbonara dieci e mezzo','carbonara',10.5],['carbonara dieci euro e mezzo','carbonara',10.5],['carbonara dodici euro','carbonara',12],['carbonara dodici','carbonara',12],['carbonara un euro e cinquanta','carbonara',1.5],['caffè un euro','caffè',1],['tiramisù cinque euro','tiramisù',5],['tiramisù a cinque euro','tiramisù',5],['tagliata ventidue euro','tagliata',22],['tagliata ventidue e cinquanta','tagliata',22.5],['tagliata 22 e 50','tagliata',22.5],['tagliata sedici euro e cinquanta centesimi','tagliata',16.5],['pizza quattro formaggi dodici','pizza quattro formaggi',12],['pizza quattro formaggi dodici euro','pizza quattro formaggi',12],['tagliata di manzo 300 g 18 euro','tagliata di manzo',18],['Quattro stagioni 9','Quattro stagioni',9],['Quattro stagioni nove euro','Quattro stagioni',9]]
  const ok=cases.filter(([say,name,price])=>{const src=normalizeSpokenPrices(say);return !!verifyOnboardingMenuRow({section:'Primi',name,price,description:'',evidence:src} as any,src).row})
  expect(ok.length).toBeGreaterThanOrEqual(29);expect(normalizeSpokenPrices('Quattro formaggi dodici')).toBe('Quattro formaggi 12 €');expect(normalizeSpokenPrices('un tagliere')).toBe('un tagliere')})
 it('spike deterministico: 27/27 piatti dettati con citazione normalizzata (vocale senza punteggiatura)',()=>{
  const t='allora menu di lunedì antipasti bruschetta cinque tagliere dodici e cinquanta primi spaghetti alle vongole quattordici penne all arrabbiata otto e cinquanta lasagna undici secondi tagliata diciotto cotoletta quindici dolci tiramisù cinque panna cotta cinque e cinquanta'
  const out=verifyFullMenu(t,[{rows:[row('antipasti','bruschetta',5,'bruschetta cinque'),row('antipasti','tagliere',12.5,'tagliere dodici e cinquanta'),row('primi','spaghetti alle vongole',14,'spaghetti alle vongole quattordici'),row('primi','penne all arrabbiata',8.5,'penne all arrabbiata otto e cinquanta'),row('primi','lasagna',11,'lasagna undici'),row('secondi','tagliata',18,'tagliata diciotto'),row('secondi','cotoletta',15,'cotoletta quindici'),row('dolci','tiramisù',5,'tiramisù cinque'),row('dolci','panna cotta',5.5,'panna cotta cinque e cinquanta')],issues:[]}])
  expect(out.rows.map(r=>[r.name,r.price])).toEqual([['bruschetta',5],['tagliere',12.5],['spaghetti alle vongole',14],['penne all arrabbiata',8.5],['lasagna',11],['tagliata',18],['cotoletta',15],['tiramisù',5],['panna cotta',5.5]]);expect(out.missing).toEqual([])})
 it('forme reali del 16/10 (whisper + gpt-oss): prezzo nel nome o vuoto, prezzo sbagliato del modello, riga saltata → valori letterali dal testo',()=>{
  const v2="Allora, menù di lunedì, antipasti, bruschetta 5, tagliere 12 e 50, primi, spaghetti alle vongole 14, penne all'arrabbiata 8 e 50, lasagna 11, secondi, tagliata 18, cotoletta 15, dolci, tiramisù 5, panna cotta 5 e 50."
  const out=verifyFullMenu(v2,[{rows:[row('antipasti','bruschetta',5,'bruschetta 5'),row('antipasti','tagliere 12 e 50',null,'tagliere 12 e 50'),row('primi',"penne all'arrabbiata 8 e 50",null,"penne all'arrabbiata 8 e 50"),row('primi','lasagna',11,'lasagna 11'),row('dolci','panna cotta',5,'panna cotta 5 e 50')],issues:[]}])
  expect(Object.fromEntries(out.rows.map(r=>[r.name,r.price]))).toEqual({bruschetta:5,tagliere:12.5,"penne all'arrabbiata":8.5,lasagna:11,'panna cotta':5.5,'spaghetti alle vongole':14,tagliata:18,cotoletta:15,'tiramisù':5})
  const t5='Pranzo di oggi. Primi: Risotto allo zafferano 14 (con midollo), Gnocchi al gorgonzola 11. Secondi: Branzino al forno 19, Arrosto della casa (prezzo da definire). Contorni: insalata mista 4 / 6 con pomodori. Dolci: Cheesecake 6.'
  const o5=verifyFullMenu(t5,[{rows:[row('Primi','Risotto allo zafferano',14,'Risotto allo zafferano 14 (con midollo)'),row('Primi','Gnocchi al gorgonzola',11,'Gnocchi al gorgonzola 11'),row('Secondi','Branzino al forno',19,'Branzino al forno 19'),row('Dolci','Cheesecake',6,'Cheesecake 6')],issues:['Arrosto della casa senza prezzo esplicito','insalata mista con prezzo ambiguo 4 / 6']}])
  expect(o5.rows).toHaveLength(4);expect(o5.missing.map(m=>[m.name,m.reason])).toEqual([['Arrosto della casa','price'],['insalata mista','prices']])
  // mai un prezzo inventato: senza cifre nel testo non c'è riga
  expect(verifyFullMenu('Menu di oggi. Primi: carbonara',[{rows:[row('Primi','carbonara',10,'carbonara')],issues:[]}]).rows).toEqual([])})
 it('sostituzione: stessi id e traduzioni per i piatti già presenti, nuovi creati, vecchi nascosti, altri menu identici; ripristino del solo menu',()=>{
  const w=fixture(true),r=replaceMenuContent(w,PRANZO,[row('Primi','carbonara',12,'carbonara 12'),row('Primi','fettuccine',11,'fettuccine 11'),{...row('Menu','tiramisu',6,'tiramisu 6')}])
  expect(r.summary.updated).toEqual([{name:'Carbonara',from:10,to:12},{name:'Tiramisù',from:5,to:6}]);expect(r.summary.created).toEqual([{name:'Fettuccine',price:11,section:'Primi'}]);expect(r.summary.hidden).toEqual(['Lasagna','Gricia','Branzino','Tagliata'])
  expect(menu(r.workspace,CENA)).toEqual(menu(w,CENA));expect(menu(r.workspace,DRINKS)).toEqual(menu(w,DRINKS));expect(w).toEqual(fixture(true))
  expect(workspaceSchema.safeParse(r.workspace).success).toBe(true);expect(items(r.workspace,PRANZO)).toHaveLength(7)
  const back=restoreMenuFrom(r.workspace,w,PRANZO)!;expect(menu(back,PRANZO).sections).toEqual(menu(w,PRANZO).sections)})
 it('correzioni deterministiche: prezzo, togli, aggiungi; il resto non cambia nulla',()=>{const rows=[row('Primi','carbonara',10,''),row('Dolci','tiramisù',5,'')]
  const r=applyCorrections('la carbonara è undici, togli il tiramisù, aggiungi panna cotta 5 tra i dolci',rows,[{name:'gricia',section:'Primi',reason:'price'}])
  expect(r.rows.map(x=>[x.section,x.name,x.price])).toEqual([['Primi','carbonara',11],['Dolci','panna cotta',5]]);expect(r.failed).toEqual([])
  expect(applyCorrections('mettila più in alto',rows,[]).done).toEqual([])})
 it('giornata operativa alle 06:00 nel fuso del locale, ripiego Europe/Rome',()=>{
  expect(operationalDay('Europe/Rome',new Date('2026-10-20T03:59:00Z'))).toMatchObject({date:'2026-10-19',weekday:1})
  expect(operationalDay('Europe/Rome',new Date('2026-10-20T04:00:00Z'))).toMatchObject({date:'2026-10-20',weekday:2})
  expect(operationalDay('Fuso/Inesistente',new Date('2026-10-20T04:00:00Z'))).toMatchObject({zone:'Europe/Rome',date:'2026-10-20'})
  expect(operationalDay(undefined,new Date('2026-10-20T03:00:00Z'),1)).toMatchObject({date:'2026-10-20',weekday:2})
  expect(operationalDay('America/New_York',new Date('2026-10-20T09:59:00Z'))).toMatchObject({date:'2026-10-19'})})
})
