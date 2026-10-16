// Regressions observed live on 15/10/2026 20:00–20:42 (Collaudo Finale): doubled replies, name not
// accepted, vocal not applied, audio document, translation 429 copy, follow-ups after expiry.
vi.mock('../apps/server/src/lib/onboarding-lifecycle.js',()=>({agencyStartActor:vi.fn(async()=>null),onboardingLifecycleCommand:()=>null,redeemAgencyOnboardingCode:vi.fn(),touchOnboardingActivity:vi.fn(),purgeExpiredOnboarding:vi.fn()}))
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
const m=vi.hoisted(()=>({active:vi.fn(),update:vi.fn(),create:vi.fn(),extractMessage:vi.fn(),extractMenu:vi.fn(),send:vi.fn(),dispatch:vi.fn(),download:vi.fn(),transcribe:vi.fn(),translate:vi.fn(),db:{jobs:[] as any[],links:new Map<string,string>(),owner:new Map<string,string>(),openSession:false,clock:0}}))
function parse(q:any){let text='';const params:any[]=[];for(const c of q.queryChunks)if(c&&typeof c==='object'&&Array.isArray(c.value))text+=c.value.join('');else{text+='$';params.push(c)}return{text:text.replace(/\s+/g,' '),params}}
// Minimal in-memory model of the inbox-job table that honours the ordering/guards written in the SQL.
async function execute(q:any):Promise<any[]>{const {text,params:p}=parse(q),db=m.db,now=++db.clock
 if(text.includes('pg_advisory_xact_lock'))return []
 if(text.startsWith('SELECT id FROM users'))return [{id:p[0]}]
 if(text.startsWith('INSERT INTO tako_onboarding_tokens'))return []
 if(text.startsWith("UPDATE tako_onboarding_inbox_jobs SET status='failed'"))return []
 if(text.startsWith('SELECT sid FROM tako_onboarding_inbox_jobs WHERE phone=$ AND status=\'running\''))return db.jobs.filter(j=>j.status==='running')
 if(text.startsWith("UPDATE tako_onboarding_inbox_jobs SET status='running'")){const pending=db.jobs.filter(j=>j.status==='pending');const ob=text.includes("(sid LIKE 'OB%')");pending.sort((a,b)=>(ob?Number(a.sid.startsWith('OB'))-Number(b.sid.startsWith('OB')):0)||a.updated-b.updated||a.sid.localeCompare(b.sid));const j=pending[0];if(!j)return [];j.status='running';j.updated=now;return [{sid:j.sid,payload:structuredClone(j.payload)}]}
 if(text.startsWith('INSERT INTO tako_onboarding_inbox_jobs')){
  if(text.includes('WHERE NOT EXISTS')&&db.jobs.some(j=>j.status==='pending'&&j.sid.startsWith('OB')))return []
  const values=text.includes('SELECT $,$,$,$')||text.includes('VALUES($,$,$,$')?p:p
  const sid=values[0],status=text.includes("'done')")?'done':'pending';if(db.jobs.some(j=>j.sid===sid))return []
  db.jobs.push({sid,actor:values[1],phone:values[2],payload:JSON.parse(values[3]),status,updated:now});return [{sid}]}
 if(text.startsWith('UPDATE tako_onboarding_inbox_jobs SET status=$')){const j=db.jobs.find(x=>x.sid===p[2]);if(j&&(j.status==='running'||p[3]===true)){j.status=p[0];j.payload=JSON.parse(p[1]);j.updated=now}return []}
 if(text.startsWith('SELECT sid FROM tako_onboarding_inbox_jobs WHERE actor_id=$ AND phone=$ AND status=\'pending\'')){const pending=db.jobs.filter(j=>j.status==='pending');const ob=text.includes("(sid LIKE 'OB%')");pending.sort((a,b)=>(ob?Number(a.sid.startsWith('OB'))-Number(b.sid.startsWith('OB')):0)||a.updated-b.updated);return pending.slice(0,1).map(j=>({sid:j.sid}))}
 if(text.startsWith('SELECT actor_id FROM tako_onboarding_agency_links'))return db.links.has(p[0])?[{actor_id:db.links.get(p[0])}]:[]
 if(text.startsWith('SELECT 1 FROM tako_onboarding_sessions'))return db.openSession?[{}]:[]
 if(text.startsWith('SELECT sid,status,payload,updated_at>now()')){const j=[...db.jobs].filter(x=>x.sid!==p[2]).sort((a,b)=>b.updated-a.updated)[0];return j?[{sid:j.sid,status:j.status,payload:j.payload,recent:j.recent??true}]:[]}
 if(text.startsWith('SELECT r.name FROM tako_whatsapp_links'))return db.owner.has(p[0])?[{name:db.owner.get(p[0])}]:[]
 throw new Error('Unexpected SQL '+text.slice(0,90))}
vi.mock('../packages/db/src/index.ts',()=>({db:{execute:(q:any)=>execute(q),transaction:vi.fn(async(fn:any)=>fn({execute:(q:any)=>execute(q)}))}}))
vi.mock('../apps/server/src/lib/onboarding-store.js',()=>({createOnboarding:m.create,activeOnboarding:m.active,getOnboarding:vi.fn(),updateOnboarding:m.update,cancelOnboarding:vi.fn(),approveOnboarding:vi.fn(),listOnboarding:vi.fn(async()=>[])}))
vi.mock('../apps/server/src/lib/menu-workspace-translate.js',()=>({translateWorkspace:m.translate,groqTranslationProviderFor:(model:string)=>({model})}))
vi.mock('../apps/server/src/lib/onboarding-dispatch.js',()=>({dispatchOnboardingJob:m.dispatch}))
vi.mock('../apps/server/src/lib/onboarding-source.js',()=>({ingestOnboardingSource:vi.fn(),inspectOnboardingMedia:vi.fn()}))
vi.mock('../apps/server/src/lib/onboarding-planner.js',()=>({extractOnboardingMessage:m.extractMessage,extractOnboardingMenu:m.extractMenu}))
vi.mock('../apps/server/src/lib/onboarding-ocr.js',()=>({ocrOnboardingImage:vi.fn(),ocrOnboardingPdf:vi.fn()}))
vi.mock('../apps/server/src/lib/twilio-menu-ai.js',()=>({downloadTwilioMedia:m.download,sendWhatsApp:m.send,transcribeAudio:m.transcribe}))
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {handleOnboardingChat,drainOnboardingQueue,onboardingCreationName,startsOnboarding,onboardingStepAnswer,expiredOnboardingNotice,onboardingFailureCopy,whatsappAudioType} from '../apps/server/src/lib/onboarding-chat.js'
import {onboardingRetryDelayMs,classifyOnboardingTranslationFailure} from '../apps/server/src/lib/onboarding-translation-retry.js'
const actor='11111111-1111-4111-8111-111111111111',phone='whatsapp:+390000000099'
const menu=()=>workspaceSchema.parse({menus:[{id:'33333333-3333-4333-8333-333333333333',name:'Pranzo',sections:[{id:'44444444-4444-4444-8444-444444444444',name:'Primi',items:[{id:'55555555-5555-4555-8555-555555555555',name:'Pasta al pomodoro',price:10}]}]}]})
let current:any
const session=(data:any={})=>({id:'22222222-2222-4222-8222-222222222222',actorId:actor,phone,state:'collecting',revision:1,data:{name:'',slug:'',workspace:workspaceSchema.parse({menus:[]}),warnings:[],unresolved:[],...data}})
const sentTexts=()=>m.send.mock.calls.map(c=>String(c[4]))
const saved={...process.env}
beforeEach(()=>{vi.clearAllMocks();Object.assign(process.env,{TAKOMENU_AGENCY_USER_IDS:actor,TAKO_ONBOARDING_RETRY_BASE_MS:'0',TAKO_ONBOARDING_RETRY_MAX_MS:'0'});m.db.jobs=[];m.db.links=new Map([[phone,actor]]);m.db.owner=new Map();m.db.openSession=false;current=null
 m.active.mockImplementation(async()=>current);m.update.mockImplementation(async(_id:string,_a:string,revision:number,data:any,state:string)=>current={...current,revision:revision+1,data:structuredClone(data),state})
 m.create.mockImplementation(async()=>current=session());m.extractMessage.mockResolvedValue({});m.extractMenu.mockResolvedValue({rows:[],issues:[]});m.send.mockResolvedValue({});m.dispatch.mockResolvedValue(true)})
afterEach(()=>{for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)})
async function deliver(sid:string,text:string,form:Record<string,string>={}){m.db.jobs.push({sid,actor,phone,payload:{text,form:{MessageSid:sid,NumMedia:'0',...form}},status:'pending',updated:++m.db.clock})}
async function runQueue(limit=40){for(let i=0;i<limit&&m.db.jobs.some(j=>j.status==='pending');i++)await drainOnboardingQueue(actor,phone)}

describe('every step accepts the answer (bug: «collaudo finale» → name asked again)',()=>{
 it('a bare reply to «Come si chiama il locale?» becomes the name without the AI extractor',async()=>{current=session()
  const reply=await handleOnboardingChat(actor,phone,'collaudo finale',{MessageSid:'SM'+'1'.repeat(32)})
  expect(current.data.name).toBe('Collaudo Finale');expect(current.data.slug).toBe('collaudo-finale');expect(m.extractMessage).not.toHaveBeenCalled();expect(reply).not.toContain('Come si chiama il *locale*')})
 it('owner name, WhatsApp, email and link name are each accepted in turn',async()=>{current=session({name:'Collaudo Finale',slug:'',workspace:menu()})
  current.data.slug='';await handleOnboardingChat(actor,phone,'Mario Rossi',{MessageSid:'SM'+'2'.repeat(32)});expect(current.data.ownerName).toBe('Mario Rossi')
  await handleOnboardingChat(actor,phone,'333 123 4567',{MessageSid:'SM'+'3'.repeat(32)});expect(current.data.ownerPhone).toBe('+393331234567')
  await handleOnboardingChat(actor,phone,'mario@example.com',{MessageSid:'SM'+'4'.repeat(32)});expect(current.data.ownerEmail).toBe('mario@example.com')
  expect(m.extractMessage).not.toHaveBeenCalled()})
 it('instructions and menu data are never mistaken for a step answer',()=>{const d:any=session().data;for(const text of ['aggiungi tiramisu a 6 euro','cambia il colore in blu','Crea locale Prova','ok','https://example.com'])expect(onboardingStepAnswer(d,text)).toBeNull()})
 it('the creation message names the locale even when menu sentences follow (typed or transcribed)',()=>{
  expect(onboardingCreationName('Crea locale Collaudo Finale. Crea il menu Pranzo con la categoria Primi e Pasta al pomodoro a 10 euro. Non pubblicare nulla.')).toBe('Collaudo Finale')
  expect(onboardingCreationName("Crea locale con l'audo finale. Crea il menù pranzo con la categoria primi e pasta al pomodoro a 10 euro.")).toBe("Con L'audo Finale")
  expect(onboardingCreationName('crea locale collaudo finale crea il menu pranzo con pasta a 10 euro')).toBe('Collaudo Finale')
  expect(startsOnboarding('Crea un nuovo locale')).toBe(true);expect(onboardingCreationName('Crea un nuovo locale')).toBeNull()})
})

describe('vocal = text in onboarding (bug: vocal not applied)',()=>{
 const said='Crea locale Collaudo Finale. Crea il menu Pranzo con la categoria Primi e Pasta al pomodoro a 10 euro.'
 async function outcome(kind:'text'|'voice'|'document'){vi.clearAllMocks();m.db.jobs=[];current=null;m.active.mockImplementation(async()=>current);m.update.mockImplementation(async(_i:string,_a:string,r:number,data:any,state:string)=>current={...current,revision:r+1,data:structuredClone(data),state});m.create.mockImplementation(async()=>current=session());m.send.mockResolvedValue({});m.dispatch.mockResolvedValue(true)
  m.extractMessage.mockResolvedValue({menuText:said});m.extractMenu.mockImplementation(async()=>({rows:[{menu:'Pranzo',section:'Primi',name:'Pasta al pomodoro',price:10,description:'',evidence:'Pasta al pomodoro a 10 euro'}],issues:[]}));m.transcribe.mockResolvedValue(said);m.download.mockResolvedValue({bytes:Buffer.from('audio'),type:kind==='document'?'application/octet-stream':'audio/ogg'})
  const sid=(kind==='text'?'SM':'MM')+'a'.repeat(32)
  await deliver(sid,kind==='text'?said:kind==='document'?'richiesta-completa.m4a':'',kind==='text'?{}:{NumMedia:'1',MediaUrl0:'https://api.twilio.com/2010-04-01/Accounts/AC/Messages/x/Media/y',MediaContentType0:kind==='document'?'application/octet-stream':'audio/ogg',Body:kind==='document'?'richiesta-completa.m4a':''})
  await drainOnboardingQueue(actor,phone)
  const items=current.data.workspace.menus.flatMap((mm:any)=>mm.sections.flatMap((s:any)=>s.items.map((i:any)=>`${mm.name}/${s.name}/${i.name}/${i.price}`)))
  return {name:current.data.name,items,first:sentTexts()[0]?.replace(/[a-f0-9]{64}/g,'<token>'),extracted:m.extractMessage.mock.calls[0]?.[0]}}
 it('the same request gives the same draft and the same reply as text, voice note and audio document',async()=>{
  const text=await outcome('text'),voice=await outcome('voice'),doc=await outcome('document')
  expect(text.name).toBe('Collaudo Finale');expect(text.items).toEqual(['Pranzo/Primi/Pasta al pomodoro/10'])
  expect(voice).toEqual(text);expect(doc).toEqual(text);expect(m.transcribe).toHaveBeenCalledOnce()})
 it('recognises audio sent as a document by MIME type or file name, never a video or an image',()=>{expect(whatsappAudioType('audio/mp4','richiesta-completa.m4a')).toBe('audio/mp4');expect(whatsappAudioType('audio/x-m4a','')).toBe('audio/x-m4a');expect(whatsappAudioType('application/octet-stream','richiesta-completa.m4a')).toBe('audio/mp4');expect(whatsappAudioType('video/mp4','clip.mp4')).toBeNull();expect(whatsappAudioType('image/png','LOGO')).toBeNull()})
})

describe('one reply per inbound, quiet background retries (bug: every message doubled)',()=>{
 const translating=()=>session({name:'Collaudo Finale',slug:'collaudo-finale',ownerName:'Mario Rossi',ownerPhone:'+393000000000',ownerEmail:'qa@example.com',heroAttempted:true,workspace:menu()})
 it('two quick messages during 429 translations: one answer each, no parallel chains, one clear pause notice',async()=>{
  current=translating();m.translate.mockRejectedValue(Object.assign(new Error('rate'),{status:429}))
  await deliver('SM'+'b'.repeat(32),'Mario Rossi');await deliver('SM'+'c'.repeat(32),'Mario Rossi')
  await runQueue()
  const texts=sentTexts()
  expect(texts.filter(t=>t.includes('*Collaudo Finale*'))).toHaveLength(2)
  const notices=texts.filter(t=>/traduzioni/i.test(t)&&!t.includes('*Collaudo Finale*'));expect(notices).toHaveLength(1)
  expect(texts.join('\n')).not.toMatch(/Riprovo una volta|STATO ONBOARDING|Non ho completato il passaggio/)
  expect(notices[0]).toContain('PREPARA ONBOARDING');expect(texts).toHaveLength(3)
  const internal=m.db.jobs.filter(j=>j.sid.startsWith('OB'));expect(internal.length).toBeLessThanOrEqual(1+6)})
 it('a user message is served before a queued automatic continuation',async()=>{current=translating();m.translate.mockImplementation(async(w:any)=>({workspace:w,translatedCount:0,warnings:[]}))
  m.db.jobs.push({sid:'OB'+'d'.repeat(32),actor,phone,payload:{text:'prepara onboarding',form:{OnboardingInternal:'1'}},status:'pending',updated:++m.db.clock});await deliver('SM'+'e'.repeat(32),'Mario Rossi')
  await drainOnboardingQueue(actor,phone);expect(m.db.jobs.find(j=>j.sid==='SM'+'e'.repeat(32))!.status).toBe('done');expect(m.db.jobs.find(j=>j.sid==='OB'+'d'.repeat(32))!.status).toBe('pending')})
 it('when translations finish in background it sends only the preview, not the question already asked',async()=>{current=translating()
  const {foodCatalogs}=await import('../apps/server/src/lib/menu-workspace-catalogs.js'),ids=['allergens',...foodCatalogs.allergens.map((x:any)=>x.id),...foodCatalogs.traits.map((x:any)=>x.id),...foodCatalogs.additives.map((x:any)=>x.id)]
  m.translate.mockImplementation(async(w:any,lang:string)=>{const x=structuredClone(w);for(const mm of x.menus)for(const e of [mm,...mm.sections.flatMap((s:any)=>[s,...s.items])])e.translations[lang]={name:e.name};x.foodTranslations[lang]=Object.fromEntries(ids.map(k=>[k,'x']));return {workspace:x,translatedCount:1,warnings:[]}})
  m.db.jobs.push({sid:'OB'+'f'.repeat(32),actor,phone,payload:{text:'prepara onboarding',form:{OnboardingInternal:'1'}},status:'pending',updated:++m.db.clock})
  await runQueue();const texts=sentTexts()
  expect(texts).toHaveLength(1);expect(texts[0]).toContain('*anteprima privata*');expect(texts[0]).not.toMatch(/Come si chiama|numero WhatsApp|traduzioni/)})
})

describe('429 and failure copy fits the step',()=>{
 it('a busy provider on a user message asks to resend it, without internal commands',()=>{const text=onboardingFailureCopy({name:'OnboardingBusy'},{text:'Mario Rossi',form:{}});expect(text).toContain('Rimandalo');expect(text).not.toMatch(/STATO ONBOARDING|RIPRENDI/)})
 it('backoff honours the provider hint and is bounded',()=>{const env={TAKO_ONBOARDING_RETRY_BASE_MS:'5000',TAKO_ONBOARDING_RETRY_MAX_MS:'45000'} as any;expect(onboardingRetryDelayMs(0,undefined,env)).toBe(5000);expect(onboardingRetryDelayMs(2,undefined,env)).toBe(20000);expect(onboardingRetryDelayMs(0,30000,env)).toBe(30000);expect(onboardingRetryDelayMs(9,undefined,env)).toBe(45000)
  expect(classifyOnboardingTranslationFailure({status:429,headers:{'retry-after':'7'}},'en').diagnostic.retryAfterMs).toBe(7000);expect(classifyOnboardingTranslationFailure({status:429,headers:new Headers({'x-ratelimit-reset-tokens':'1m2.5s'})},'en').diagnostic.retryAfterMs).toBe(62500)})
})

describe('after expiry (bug: «LOGO:» treated as a dish of the owner restaurant)',()=>{
 const form=(extra:Record<string,string>={})=>({MessageSid:'MM'+'9'.repeat(32),NumMedia:'0',...extra})
 it('the first message after a draft expired gets the notice once, naming the owner restaurant',async()=>{m.db.owner.set(phone,'Victoria Bar');m.db.jobs.push({sid:'SM'+'1'.repeat(32),payload:{},status:'done',updated:++m.db.clock})
  const first=await expiredOnboardingNotice(phone,'Nel menu pranzo aggiungi risotto a 14 euro',form());expect(first).toContain('*scaduta*');expect(first).toContain('*Crea locale Nome*');expect(first).toContain('*Victoria Bar*')
  expect(await expiredOnboardingNotice(phone,'Nel menu pranzo aggiungi risotto a 14 euro',form({MessageSid:'SM'+'8'.repeat(32)}))).toBeNull()})
 it('a LOGO/HERO caption with no draft never reaches a restaurant menu',async()=>{const text=await expiredOnboardingNotice(phone,'LOGO: usa questo PNG trasparente',form({NumMedia:'1',MediaContentType0:'image/png'}));expect(text).toContain('*bozza aperta*')})
 it('does nothing for non-agency phones, open drafts, closed drafts or old activity',async()=>{expect(await expiredOnboardingNotice('whatsapp:+391111111111','ciao',form())).toBeNull();m.db.openSession=true;m.db.jobs.push({sid:'SM'+'2'.repeat(32),payload:{},status:'done',updated:++m.db.clock});expect(await expiredOnboardingNotice(phone,'ciao',form())).toBeNull();m.db.openSession=false;m.db.jobs=[{sid:'SM'+'3'.repeat(32),payload:{closed:true},status:'done',updated:++m.db.clock}];expect(await expiredOnboardingNotice(phone,'ciao',form())).toBeNull();m.db.jobs=[{sid:'SM'+'4'.repeat(32),payload:{},status:'done',updated:++m.db.clock,recent:false}];expect(await expiredOnboardingNotice(phone,'ciao',form())).toBeNull()})
})
describe('translations wait for the answers (bug: 429 on the user\'s own next step)',()=>{
 it('no background translation chain starts while owner questions are still open',async()=>{current=session({name:'Collaudo Finale',slug:'collaudo-finale',heroAttempted:true,workspace:menu()});m.translate.mockRejectedValue(Object.assign(new Error('rate'),{status:429}))
  await deliver('SM'+'7'.repeat(32),'Mario Rossi');await runQueue()
  expect(m.translate).not.toHaveBeenCalled();expect(m.db.jobs.filter(j=>j.sid.startsWith('OB'))).toHaveLength(0);expect(sentTexts()).toHaveLength(1);expect(sentTexts()[0]).toContain('numero WhatsApp del titolare')})
})
describe('after expiry a vocal behaves like the same text',()=>{
 const expired=()=>{m.db.owner.set(phone,'Victoria Bar');m.db.jobs.push({sid:'SM'+'1'.repeat(32),payload:{},status:'done',updated:++m.db.clock})}
 const audio={NumMedia:'1',MediaContentType0:'audio/ogg',MediaUrl0:'https://api.twilio.com/2010-04-01/Accounts/AC/Messages/x/Media/y',Body:''}
 it('the webhook check hands the vocal to transcription instead of answering blindly',async()=>{expired();expect(await expiredOnboardingNotice(phone,'',{MessageSid:'MM'+'6'.repeat(32),...audio})).toEqual({voiceActor:actor})})
 it('a transcribed «Crea locale …» starts a draft exactly like typed text',async()=>{expired();m.transcribe.mockResolvedValue('Crea locale Collaudo Finale');m.download.mockResolvedValue({bytes:Buffer.from('a'),type:'audio/ogg'});await deliver('MM'+'6'.repeat(32),'',audio);await runQueue();expect(m.create).toHaveBeenCalledOnce();expect(current.data.name).toBe('Collaudo Finale')})
 it('a transcribed menu change gets the expiry notice once, like typed text',async()=>{expired();m.transcribe.mockResolvedValue('Nel menu pranzo aggiungi risotto ai funghi a 14 euro');m.download.mockResolvedValue({bytes:Buffer.from('a'),type:'audio/mp4'});await deliver('MM'+'7'.repeat(32),'richiesta-completa.m4a',{...audio,MediaContentType0:'audio/mp4',Body:'richiesta-completa.m4a'});await runQueue()
  expect(m.create).not.toHaveBeenCalled();expect(sentTexts()).toHaveLength(1);expect(sentTexts()[0]).toContain('*scaduta*');expect(sentTexts()[0]).toContain('*Victoria Bar*')
  expect(m.db.jobs.find(j=>j.sid==='MM'+'7'.repeat(32))!.payload.expiredNotice).toBe(true);expect(await expiredOnboardingNotice(phone,'altra modifica',{MessageSid:'SM'+'5'.repeat(32),NumMedia:'0'})).toBeNull()})
})
describe('background translations do not compete with the next answer',()=>{
 it('onboarding translations use the configured model (default gpt-oss-120b, 20b failed live)',async()=>{current=session({name:'Collaudo Finale',slug:'collaudo-finale',ownerName:'Mario Rossi',ownerPhone:'+393000000000',ownerEmail:'qa@example.com',heroAttempted:true,workspace:menu()});m.translate.mockImplementation(async(w:any)=>({workspace:w,translatedCount:0,warnings:[]}))
  await handleOnboardingChat(actor,phone,'prepara onboarding',{OnboardingInternal:'1'});expect(m.translate.mock.calls[0]?.[2]).toEqual({model:'openai/gpt-oss-120b'});process.env.TAKO_ONBOARDING_TRANSLATION_MODEL='openai/gpt-oss-20b';await handleOnboardingChat(actor,phone,'prepara onboarding',{OnboardingInternal:'1'});expect(m.translate.mock.calls.at(-1)?.[2]).toEqual({model:'openai/gpt-oss-20b'})})
 it('lower-case transcribed menus, categories and dishes get the typed capitalisation',async()=>{const {mergeOnboardingRows}=await import('../apps/server/src/lib/onboarding-menu-merge.js');const w=workspaceSchema.parse({menus:[]});mergeOnboardingRows(w,[{menu:'cena',section:'panini',name:'burger classico',price:12,description:'',evidence:'burger classico a 12 euro'} as any],false);expect(w.menus[0]!.name).toBe('Cena');expect(w.menus[0]!.sections[0]!.name).toBe('Panini');expect(w.menus[0]!.sections[0]!.items[0]!.name).toBe('Burger classico')
  mergeOnboardingRows(w,[{menu:'Cena',section:'Panini',name:'Burger Classico',price:13,description:'',evidence:'x'} as any],true);expect(w.menus[0]!.sections[0]!.items).toHaveLength(1);expect(w.menus[0]!.sections[0]!.items[0]!.price).toBe(13)})
})
