// Regressions from the live WhatsApp tests of 15/10 night and 16/10 morning (Collaudo Mattina Sedici):
// B1 «mantieni» created a Burger duplicate, B2 explicit price changes were treated as a conflict, B3a the
// combined request failed with no cause, B3b stale doubts blocked replies and the recap, B3c technical copy.
// The real planner (verification, clause intent) runs; only the provider HTTP call is scripted, with plausible
// model outputs — including the wrong ones seen live (keep clause extracted as a row, "section":"").
vi.mock('../apps/server/src/lib/onboarding-lifecycle.js',()=>({agencyStartActor:vi.fn(async()=>null),onboardingLifecycleCommand:()=>null,redeemAgencyOnboardingCode:vi.fn(),touchOnboardingActivity:vi.fn(),purgeExpiredOnboarding:vi.fn()}))
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
const m=vi.hoisted(()=>({active:vi.fn(),update:vi.fn(),create:vi.fn(),send:vi.fn(),dispatch:vi.fn(),translate:vi.fn(),db:{jobs:[] as any[],errors:[] as any[],clock:0}}))
function parse(q:any){let text='';const params:any[]=[];for(const c of q.queryChunks)if(c&&typeof c==='object'&&Array.isArray(c.value))text+=c.value.join('');else{text+='$';params.push(c)}return{text:text.replace(/\s+/g,' '),params}}
async function execute(q:any):Promise<any[]>{const {text,params:p}=parse(q),db=m.db,now=++db.clock
 if(text.includes('pg_advisory_xact_lock'))return []
 if(text.startsWith('SELECT id FROM users'))return [{id:p[0]}]
 if(text.startsWith('INSERT INTO tako_onboarding_tokens'))return []
 if(text.startsWith('INSERT INTO tako_whatsapp_errors')){db.errors.push({kind:p[0],phone_tail:p[2],detail:p[3],alerted:p[4]});return []}
 if(text.startsWith("UPDATE tako_onboarding_inbox_jobs SET status='failed'"))return []
 if(text.startsWith('SELECT sid FROM tako_onboarding_inbox_jobs WHERE phone=$ AND status=\'running\''))return db.jobs.filter(j=>j.status==='running')
 if(text.startsWith("UPDATE tako_onboarding_inbox_jobs SET status='running'")){const pending=db.jobs.filter(j=>j.status==='pending').sort((a,b)=>Number(a.sid.startsWith('OB'))-Number(b.sid.startsWith('OB'))||a.updated-b.updated);const j=pending[0];if(!j)return [];j.status='running';j.updated=now;return [{sid:j.sid,payload:structuredClone(j.payload)}]}
 // Busy retry: back to pending, updated_at untouched.
 if(text.startsWith("UPDATE tako_onboarding_inbox_jobs SET status='pending'")){const j=db.jobs.find(x=>x.sid===p[1]);if(j?.status==='running'){j.status='pending';j.payload=JSON.parse(p[0]);j.updated=j.queued}return []}
 if(text.startsWith('INSERT INTO tako_onboarding_inbox_jobs')){if(text.includes('WHERE NOT EXISTS')&&db.jobs.some(j=>j.status==='pending'&&j.sid.startsWith('OB')))return [];if(db.jobs.some(j=>j.sid===p[0]))return [];db.jobs.push({sid:p[0],payload:JSON.parse(p[3]),status:'pending',updated:now,queued:now});return [{sid:p[0]}]}
 if(text.startsWith('UPDATE tako_onboarding_inbox_jobs SET status=$')){const j=db.jobs.find(x=>x.sid===p[2]);if(j&&(j.status==='running'||p[3]===true)){j.status=p[0];j.payload=JSON.parse(p[1]);j.updated=now}return []}
 if(text.startsWith('SELECT sid FROM tako_onboarding_inbox_jobs WHERE actor_id=$ AND phone=$ AND status=\'pending\'')){const pending=db.jobs.filter(j=>j.status==='pending').sort((a,b)=>Number(a.sid.startsWith('OB'))-Number(b.sid.startsWith('OB'))||a.updated-b.updated);return pending.slice(0,1).map(j=>({sid:j.sid}))}
 throw new Error('Unexpected SQL '+text.slice(0,90))}
vi.mock('../packages/db/src/index.ts',()=>({db:{execute:(q:any)=>execute(q),transaction:vi.fn(async(fn:any)=>fn({execute:(q:any)=>execute(q)}))}}))
vi.mock('../apps/server/src/lib/onboarding-store.js',()=>({createOnboarding:m.create,activeOnboarding:m.active,getOnboarding:vi.fn(),updateOnboarding:m.update,cancelOnboarding:vi.fn(),approveOnboarding:vi.fn(),listOnboarding:vi.fn(async()=>[])}))
vi.mock('../apps/server/src/lib/menu-workspace-translate.js',()=>({translateWorkspace:m.translate,groqTranslationProviderFor:(model:string)=>({model})}))
vi.mock('../apps/server/src/lib/onboarding-dispatch.js',()=>({dispatchOnboardingJob:m.dispatch}))
vi.mock('../apps/server/src/lib/onboarding-source.js',()=>({ingestOnboardingSource:vi.fn(),inspectOnboardingMedia:vi.fn()}))
vi.mock('../apps/server/src/lib/onboarding-ocr.js',()=>({ocrOnboardingImage:vi.fn(),ocrOnboardingPdf:vi.fn()}))
vi.mock('../apps/server/src/lib/twilio-menu-ai.js',()=>({downloadTwilioMedia:vi.fn(),sendWhatsApp:m.send,transcribeAudio:vi.fn()}))
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {drainOnboardingQueue,handleOnboardingChat,nextOnboardingStep,onboardingRecapRequest} from '../apps/server/src/lib/onboarding-chat.js'
import {extractOnboardingMenu,extractOnboardingMessage,onboardingClauseIntent} from '../apps/server/src/lib/onboarding-planner.js'
import {mergeOnboardingRows} from '../apps/server/src/lib/onboarding-menu-merge.js'
const actor='11111111-1111-4111-8111-111111111111',phone='whatsapp:+390000000099'
const ids={pranzo:'33333333-3333-4333-8333-333333333333',primi:'44444444-4444-4444-8444-444444444444',pasta:'55555555-5555-4555-8555-555555555555',cena:'66666666-6666-4666-8666-666666666666',panini:'77777777-7777-4777-8777-777777777777',burger:'88888888-8888-4888-8888-888888888888'}
const twoMenus=(burger=12)=>workspaceSchema.parse({menus:[{id:ids.pranzo,name:'Pranzo',sections:[{id:ids.primi,name:'Primi',items:[{id:ids.pasta,name:'Pasta al pomodoro',price:10}]}]},{id:ids.cena,name:'Cena',sections:[{id:ids.panini,name:'Panini',items:[{id:ids.burger,name:'Burger classico',price:burger}]}]}]})
let current:any
const session=(data:any={})=>({id:'22222222-2222-4222-8222-222222222222',actorId:actor,phone,state:'collecting',revision:1,data:{name:'',slug:'',workspace:workspaceSchema.parse({menus:[]}),warnings:[],unresolved:[],...data}})
const draft=(burger=12,extra:any={})=>session({name:'Collaudo Mattina Sedici',slug:'collaudo-mattina-sedici',heroAttempted:true,workspace:twoMenus(burger),...extra})
const dishes=(w:any)=>w.menus.flatMap((mm:any)=>mm.sections.flatMap((s:any)=>s.items.map((i:any)=>`${mm.name}/${s.name}/${i.name}/${i.price}`)))
const burgers=(w:any)=>w.menus.flatMap((mm:any)=>mm.sections.flatMap((s:any)=>s.items.filter((i:any)=>i.name==='Burger classico')))
const sent=()=>m.send.mock.calls.map(c=>String(c[4]))
// Scripted provider: message extraction and menu extraction answers keyed by the exact user text.
type Script={message?:unknown;menu?:unknown;status?:number}
let script=new Map<string,Script>(),calls:{kind:string;source:string}[]=[]
const fakeFetch=vi.fn(async(_url:string,init:any)=>{const body=JSON.parse(init.body),kind=String(body.messages[0].content).includes('Estrai il menu con schema')?'menu':'message',source=JSON.parse(body.messages[1].content).source as string
 calls.push({kind,source});const entry=[...script.entries()].find(([text])=>source===text||source.startsWith(text))?.[1]
 if(entry?.status)return new Response(JSON.stringify({error:{message:'rate',code:'rate_limit_exceeded'}}),{status:entry.status,headers:{'retry-after':'0'}})
 const content=entry?.[kind as 'message'|'menu']??(kind==='menu'?{rows:[],issues:[]}:{})
 return new Response(JSON.stringify({choices:[{message:{content:typeof content==='string'?content:JSON.stringify(content)}}]}),{status:200})})
const saved={...process.env}
beforeEach(()=>{vi.clearAllMocks();Object.assign(process.env,{TAKOMENU_AGENCY_USER_IDS:actor,GROQ_API_KEY:'test-key',TAKO_ONBOARDING_BUSY_WAIT_MS:'0',TAKO_ONBOARDING_RETRY_BASE_MS:'0',TAKO_ONBOARDING_RETRY_MAX_MS:'0'});vi.stubGlobal('fetch',fakeFetch)
 m.db.jobs=[];m.db.errors=[];current=null;script=new Map();calls=[]
 m.active.mockImplementation(async()=>current);m.update.mockImplementation(async(_id:string,_a:string,revision:number,data:any,state:string)=>current={...current,revision:revision+1,data:structuredClone(data),state})
 m.create.mockImplementation(async()=>current=session());m.send.mockResolvedValue({});m.dispatch.mockResolvedValue(true)})
afterEach(()=>{vi.unstubAllGlobals();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)})
let sidCounter=0
async function say(text:string){const sid='SM'+String(++sidCounter).padStart(32,'0');m.db.jobs.push({sid,payload:{text,form:{MessageSid:sid,NumMedia:'0'}},status:'pending',updated:++m.db.clock,queued:m.db.clock});const before=m.send.mock.calls.length
 for(let i=0;i<10&&m.db.jobs.some(j=>j.status==='pending'&&!j.sid.startsWith('OB'));i++)await drainOnboardingQueue(actor,phone)
 return m.send.mock.calls.slice(before).map(c=>String(c[4])).join('\n')}

// The 8 phrases of the morning test of 16/10, verbatim.
const morning=[
 'Crea locale Collaudo Mattina Sedici. Crea due menu: Pranzo, categoria Primi, Pasta al pomodoro a 10 euro; Cena, categoria Panini, Burger classico a 12 euro. È solo una bozza privata: non pubblicare e non inviare inviti.',
 'Nel menu Pranzo, categoria Primi, aggiungi Risotto ai funghi a quattordici euro. Nel menu Cena cambia il prezzo del Burger classico da dodici a tredici euro. Non cambiare la Pasta al pomodoro. Non pubblicare nulla.',
 'Nel menu Cena, categoria Panini, cambia il prezzo del Burger classico da 12 a 13 euro. Non aggiungere un nuovo piatto. Non pubblicare.',
 'Nel menu Pranzo, nella categoria Primi, aggiungi Risotto ai funghi a quattordici euro. Non pubblicare.',
 'Nel menu Cena, categoria Panini, il prezzo corretto del Burger classico è 13 euro. Aggiorna il piatto esistente. Non pubblicare.',
 'Nel menu Pranzo aggiungi la categoria Dolci con Tiramisu a 6 euro. Sfondo nero, pulsanti arancioni, testo bianco e font Poppins. Mantieni Burger classico a 12 euro nel menu Cena e tutti gli altri piatti invariati. Non pubblicare.',
 'Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro. Mantieni Burger classico a 12 euro e Pasta al pomodoro a 10 euro. Non pubblicare.',
 'Non cambiare prezzi, non aggiungere piatti e non pubblicare. Mostrami soltanto il riepilogo dei menu e dei piatti della bozza.']
const row=(menu:string|null,section:string,name:string,price:number,evidence:string)=>({...(menu?{menu,menuEvidence:menu}:{}),section,name,price,description:'',evidence})
function scriptMorning(){
 script.set(morning[0]!,{message:{name:'Collaudo Mattina Sedici',menuText:morning[0],menuStructure:[{menu:'Pranzo',section:'Primi',evidence:'Pranzo, categoria Primi'},{menu:'Cena',section:'Panini',evidence:'Cena, categoria Panini'}]},menu:{rows:[row('Pranzo','Primi','Pasta al pomodoro',10,'Pasta al pomodoro a 10 euro'),row('Cena','Panini','Burger classico',12,'Burger classico a 12 euro')],issues:[]}})
 // Live output of gpt-oss-120b on 16/10 09:40: "section":"" for the Burger and a doubt about the untouched Pasta.
 script.set(morning[1]!,{message:{menuText:morning[1],menuStructure:[{menu:'Pranzo',section:'Primi',evidence:'Nel menu Pranzo, categoria Primi, aggiungi Risotto ai funghi a quattordici euro.'},{menu:'Cena',section:null,evidence:'Nel menu Cena cambia il prezzo del Burger classico da dodici a tredici euro.'}],styleRestaurant:null},menu:{rows:[row('Pranzo','Primi','Risotto ai funghi',14,'Risotto ai funghi a quattordici euro'),{...row('Cena','','Burger classico',13,'Burger classico da dodici a tredici euro')}],issues:['*Pasta al pomodoro*: manca il prezzo.']}})
 script.set(morning[2]!,{message:{menuText:morning[2]},menu:{rows:[row('Cena','Panini','Burger classico',13,'Burger classico da 12 a 13 euro')],issues:[]}})
 script.set(morning[3]!,{message:{menuText:morning[3]},menu:{rows:[row('Pranzo','Primi','Risotto ai funghi',14,'Risotto ai funghi a quattordici euro')],issues:[]}})
 script.set(morning[4]!,{message:{menuText:morning[4]},menu:{rows:[row('Cena','Panini','Burger classico',13,'Burger classico è 13 euro')],issues:[]}})
 script.set(morning[5]!,{message:{menuText:morning[5],menuStructure:[{menu:'Pranzo',section:'Dolci',evidence:'Nel menu Pranzo aggiungi la categoria Dolci'}],designInstructions:[{field:'background',value:'nero',evidence:'Sfondo nero'},{field:'primary',value:'arancioni',evidence:'pulsanti arancioni'},{field:'text',value:'bianco',evidence:'testo bianco'},{field:'font',value:'Poppins',evidence:'font Poppins'}]},menu:{rows:[row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro'),row('Cena','Menu','Burger classico',12,'Burger classico a 12 euro')],issues:[]}})
 // The model carries «Pranzo» from the first sentence onto the keep clause (the live bug): it must not matter.
 script.set(morning[6]!,{message:{menuText:morning[6],menuStructure:[{menu:'Pranzo',section:'Primi',evidence:'Nel menu Pranzo, categoria Primi'}]},menu:{rows:[row('Pranzo','Primi','Gnocchi al pesto',11,'Gnocchi al pesto a 11 euro'),row('Pranzo','Menu','Burger classico',12,'Burger classico a 12 euro'),row('Pranzo','Primi','Pasta al pomodoro',10,'Pasta al pomodoro a 10 euro')],issues:[]}})
}

describe('the 8 morning phrases in sequence give the expected draft',()=>{
 it('Pranzo/Primi Pasta 10, Risotto 14, Gnocchi 11; Pranzo/Dolci Tiramisu 6; Cena/Panini Burger 13 (same id); style; recap',async()=>{
  scriptMorning();const replies:string[]=[];let burgerId=''
  for(const [index,text] of morning.entries()){replies.push(await say(text));if(index===0)burgerId=burgers(current.data.workspace)[0].id}
  const w=current.data.workspace
  expect(dishes(w).sort()).toEqual(['Cena/Panini/Burger classico/13','Pranzo/Dolci/Tiramisu/6','Pranzo/Primi/Gnocchi al pesto/11','Pranzo/Primi/Pasta al pomodoro/10','Pranzo/Primi/Risotto ai funghi/14'])
  expect(burgers(w)).toHaveLength(1);expect(burgers(w)[0].id).toBe(burgerId)
  expect(w.menus.flatMap((mm:any)=>mm.sections.map((s:any)=>s.name))).not.toContain('Menu');expect(w.menus.map((mm:any)=>mm.name)).toEqual(['Pranzo','Cena'])
  expect(w.design).toMatchObject({background:'#000000',primary:'#ff8a28',text:'#ffffff',font:'poppins'})
  expect(current.data.unresolved).toEqual([])
  // B3a: the combined request is applied, and the reply confirms both changes before the next question.
  expect(replies[1]).toContain('Fatto: aggiunto *Risotto ai funghi* (Pranzo · Primi) a 14 €; *Burger classico* (Cena) 12 € → 13 €.')
  expect(replies[1]!.indexOf('Fatto:')).toBeLessThan(replies[1]!.indexOf('Come si chiama il *titolare*?'))
  expect(replies[5]).toContain('aggiunto *Tiramisu* (Pranzo · Dolci) a 6 €');expect(replies[5]).toContain('stile aggiornato (sfondo, pulsanti, testo, font)')
  expect(replies[6]).toContain('aggiunto *Gnocchi al pesto* (Pranzo · Primi) a 11 €');expect(replies[6]).toContain('*Burger classico* è a 13 €, non a 12 €: l’ho lasciato così.') // round 3: a keep with another price is said, not silent
  // B3b: the recap request is answered with menus, dishes and prices, and makes no AI call.
  expect(replies[7]).toContain('*Pranzo*\nPrimi: Pasta al pomodoro 10 €, Risotto ai funghi 14 €, Gnocchi al pesto 11 €\nDolci: Tiramisu 6 €\n*Cena*\nPanini: Burger classico 13 €')
  expect(calls.filter(c=>c.source===morning[7])).toHaveLength(0)
  // B3c: no technical copy anywhere.
  for(const reply of replies){expect(reply).not.toMatch(/Fonte \d|VERIFICATO|trovo due prezzi|Non sono riuscito/);expect(reply.length).toBeGreaterThan(0)}
  expect(m.db.jobs.filter(j=>j.status==='failed')).toHaveLength(0)})
})

describe('B1 — «mantieni» never creates rows',()=>{
 it('reproduces 09:02:58: the keep clause extracted as a Pranzo/Menu row does not duplicate the Burger of Cena',async()=>{
  current=draft(12);const text=morning[6]!;script.set(text,{message:{menuText:text},menu:{rows:[row('Pranzo','Primi','Gnocchi al pesto',11,'Gnocchi al pesto a 11 euro'),row('Pranzo','Menu','Burger classico',12,'Burger classico a 12 euro'),row(null,'Menu','Pasta al pomodoro',10,'Pasta al pomodoro a 10 euro')],issues:[]}})
  await say(text);const w=current.data.workspace
  expect(dishes(w).sort()).toEqual(['Cena/Panini/Burger classico/12','Pranzo/Primi/Gnocchi al pesto/11','Pranzo/Primi/Pasta al pomodoro/10']);expect(burgers(w)[0].id).toBe(ids.burger)
  expect(w.menus.flatMap((mm:any)=>mm.sections.map((s:any)=>s.name))).not.toContain('Menu')})
 it('night 15/10 phrase 5: «Mantieni Burger classico a 13 euro e Pasta al pomodoro a 10 euro» with style keeps 3 dishes, no «Menu Pranzo»',async()=>{
  current=draft(13);const text='Nel menu Pranzo, categoria Primi, aggiungi Risotto ai funghi a quattordici euro. Sfondo nero, pulsanti arancioni, testo bianco e font Poppins. Mantieni Burger classico a 13 euro e Pasta al pomodoro a 10 euro. Non pubblicare.'
  script.set(text,{message:{menuText:text},menu:{rows:[row('Pranzo','Primi','Risotto ai funghi',14,'Risotto ai funghi a quattordici euro'),row('Menu Pranzo','Menu Pranzo','Burger classico',13,'Burger classico a 13 euro'),row('Pranzo','Primi','Pasta al pomodoro',10,'Pasta al pomodoro a 10 euro')],issues:[]}})
  await say(text);expect(dishes(current.data.workspace).sort()).toEqual(['Cena/Panini/Burger classico/13','Pranzo/Primi/Pasta al pomodoro/10','Pranzo/Primi/Risotto ai funghi/14']);expect(current.data.workspace.menus).toHaveLength(2)})
 it('keep, leave and «non cambiare» are read from the sentence, never from the model',()=>{
  const s='Aggiungi Tiramisu a 6 euro e mantieni Burger classico a 12 euro. Lascia Pasta al pomodoro a 10 euro. Non cambiare la Pasta al pomodoro. Il Risotto ai funghi a 14 euro resta invariato.'
  expect(onboardingClauseIntent(s,'Tiramisu a 6 euro','Tiramisu')).toBe('add');expect(onboardingClauseIntent(s,'Burger classico a 12 euro','Burger classico')).toBe('keep');expect(onboardingClauseIntent(s,'Pasta al pomodoro a 10 euro','Pasta al pomodoro')).toBe('keep');expect(onboardingClauseIntent(s,'Risotto ai funghi a 14 euro','Risotto ai funghi')).toBe('keep')
  const w=twoMenus(12),result=mergeOnboardingRows(w,[{...row('Pranzo','Menu','Burger classico',12,'x'),intent:'keep'},{...row('Pranzo','Primi','Lasagne',9,'x'),intent:'keep'}] as any,true)
  expect(result.issues).toEqual([]);expect(dishes(w)).toEqual(['Pranzo/Primi/Pasta al pomodoro/10','Cena/Panini/Burger classico/12'])})
})

describe('B2 — an explicit price change updates the existing dish',()=>{
 for(const [label,text,evidence] of [['«da 12 a 13»',morning[2]!,'Burger classico da 12 a 13 euro'],['«il prezzo corretto è 13, aggiorna il piatto esistente»',morning[4]!,'Burger classico è 13 euro'],['«porta il Burger a 13»','Porta il Burger classico a 13 euro. Non pubblicare.','Burger classico a 13 euro']] as const)
  it(label+' → 13, same id, no «trovo due prezzi»',async()=>{current=draft(12);script.set(text,{message:{menuText:text},menu:{rows:[row(text.includes('Cena')?'Cena':null,text.includes('Panini')?'Panini':'Menu','Burger classico',13,evidence)],issues:[]}})
   const reply=await say(text);expect(burgers(current.data.workspace)).toEqual([expect.objectContaining({id:ids.burger,price:13})]);expect(current.data.unresolved).toEqual([]);expect(reply).toContain('*Burger classico* (Cena) 12 € → 13 €');expect(reply).not.toMatch(/prezzo corretto\?|trovo due prezzi/)})
 it('night 15/10 phrase 6: two Burgers in two menus → one plain question, then the menu name applies it',async()=>{
  const w=twoMenus(13);w.menus[0]!.sections[0]!.items.push({...w.menus[1]!.sections[0]!.items[0]!,id:'99999999-9999-4999-8999-999999999999'});current=draft(13,{workspace:w})
  const text='Porta il Burger classico a 15 euro. Non pubblicare.';script.set(text,{message:{menuText:text},menu:{rows:[row(null,'Menu','Burger classico',15,'Burger classico a 15 euro')],issues:[]}})
  const reply=await say(text);expect(burgers(current.data.workspace).map((b:any)=>b.price)).toEqual([13,13]);expect(reply).toContain('Quale *Burger classico* vuoi a 15 €: *Pranzo* o *Cena*?');expect(reply).not.toMatch(/Fonte|VERIFICATO/)
  const answer=await say('Cena');expect(burgers(current.data.workspace).map((b:any)=>[b.id,b.price])).toEqual([['99999999-9999-4999-8999-999999999999',13],[ids.burger,15]]);expect(answer).toContain('Fatto: *Burger classico* (Cena) 13 € → 15 €.');expect(current.data.unresolved).toEqual([])})
})

describe('B3a — the combined request and diagnosable failures',()=>{
 it('the live model output with "section":"" and null fields no longer fails the whole message',async()=>{
  scriptMorning();const text=morning[1]!
  const message=await extractOnboardingMessage(text,'k');expect(message.menuStructure).toHaveLength(2)
  const menu=await extractOnboardingMenu(text,'k');expect(menu.rows.map(r=>[r.name,r.price,r.intent])).toEqual([['Risotto ai funghi',14,'add'],['Burger classico',13,'change']])})
 it('a provider quota (429) is retried automatically without losing the request, and the cause is recorded',async()=>{
  current=draft(12);const text=morning[3]!;script.set(text,{status:429})
  const reply=await say(text)
  expect(reply).toContain('riprovo da solo');expect(sent().filter(t=>/occupato/.test(t))).toHaveLength(2)
  expect(m.db.errors.map(e=>e.kind)).toEqual(['onboarding_quota','onboarding_quota','onboarding_quota']);expect(m.db.errors.every(e=>e.alerted===false&&!/Risotto|quattordici/.test(e.detail)&&e.phone_tail==='099')).toBe(true)
  const job=m.db.jobs.find(j=>j.sid.startsWith('SM'))!;expect(job.status).toBe('failed');expect(job.payload.diagnostic).toEqual({cause:'quota'});expect(job.payload.text).toBe(text)
  // After the quota frees up, the same message works.
  script.set(text,{message:{menuText:text},menu:{rows:[row('Pranzo','Primi','Risotto ai funghi',14,'Risotto ai funghi a quattordici euro')],issues:[]}});await say(text);expect(dishes(current.data.workspace)).toContain('Pranzo/Primi/Risotto ai funghi/14')})
 it('a malformed model answer records a parse cause, not a silent failure',async()=>{
  current=draft(12);const text=morning[3]!;script.set(text,{message:{menuText:text},menu:'{"rows":"none"}'})
  const reply=await say(text);expect(reply).toContain('Non sono riuscito a leggere');expect(m.db.errors).toEqual([expect.objectContaining({kind:'onboarding_parse',alerted:false})]);expect(m.db.errors[0].detail).toMatch(/menu schema/)
  expect(m.db.jobs.find(j=>j.sid.startsWith('SM'))!.payload.diagnostic).toEqual({cause:'parse'})})
})

describe('B3b — old doubts close and do not block',()=>{
 const stale=()=>[{url:'message:SMold2',kind:'text',text:'x',warnings:[],processed:true,issues:['*Burger classico*: qual è il prezzo corretto?','Non riesco a leggere *piatti e prezzi*. Invia una foto più nitida o il testo del menu.']},{url:'message:SMold4',kind:'text',text:'y',warnings:[],processed:true,issues:['*Burger classico*: trovo due prezzi, 12 e 13. Qual è quello corretto?']}]
 it('the morning doubts («Fonte 2»/«Fonte 4») are closed by the explicit correction',async()=>{
  current=draft(12,{sources:stale(),unresolved:['Fonte 2: *Burger classico*: qual è il prezzo corretto?']});const text=morning[4]!;script.set(text,{message:{menuText:text},menu:{rows:[row('Cena','Panini','Burger classico',13,'Burger classico è 13 euro')],issues:[]}})
  const reply=await say(text);expect(current.data.unresolved).toEqual([]);expect(burgers(current.data.workspace)[0].price).toBe(13);expect(reply).toContain('Come si chiama il *titolare*?')})
 it('a new message about another dish still answers, and «mostra il riepilogo» gets the recap even with an open doubt',async()=>{
  current=draft(12,{sources:[{url:'message:SMold',kind:'text',text:'x',warnings:[],processed:true,issues:['*Lasagne*: qual è il prezzo corretto?']}]});const text='Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro.';script.set(text,{message:{menuText:text},menu:{rows:[row('Pranzo','Primi','Gnocchi al pesto',11,'Gnocchi al pesto a 11 euro')],issues:[]}})
  const reply=await say(text);expect(reply).toContain('Fatto: aggiunto *Gnocchi al pesto*');expect(reply).toContain('*Lasagne*: qual è il prezzo corretto?')
  const recap=await say(morning[7]!);expect(recap).toContain('Primi: Pasta al pomodoro 10 €, Gnocchi al pesto 11 €');expect(recap).toContain('Panini: Burger classico 12 €')})
 it('recap requests are recognised, edits are not',()=>{expect(onboardingRecapRequest(morning[7]!)).toBe(true);expect(onboardingRecapRequest('Mostrami il menu')).toBe(true);expect(onboardingRecapRequest('Fammi vedere i piatti della bozza')).toBe(true);for(const t of ['Aggiungi Tiramisu a 6 euro e mostrami il riepilogo','Mostrami il menu e cambia il Burger','Pasta al pomodoro'])expect(onboardingRecapRequest(t)).toBe(false)})
})

describe('B3c — plain copy',()=>{
 it('no «Fonte N» or «VERIFICATO FONTE» even for drafts saved by the old version',()=>{const text=nextOnboardingStep({...draft(12).data,unresolved:['Fonte 2: *Burger classico*: qual è il prezzo corretto?','Fonte 4: altra incertezza']} as any);expect(text).toBe('*Burger classico*: qual è il prezzo corretto?\nPoi c’è *un altro dato* da controllare.')})
 it('after a change the reply confirms it in one line before the next question (night phrase 4)',async()=>{
  current=draft(12,{ownerName:'Mario Collaudo'});const text='Nel menu Cena cambia solo il prezzo del Burger classico a 13 euro. Non aggiungere un nuovo piatto. Non pubblicare.';script.set(text,{message:{menuText:text},menu:{rows:[row('Cena','Menu','Burger classico',13,'Burger classico a 13 euro')],issues:[]}})
  const reply=await handleOnboardingChat(actor,phone,text,{MessageSid:'SM'+'7'.repeat(32),NumMedia:'0'});const lines=reply.split('\n\n')
  expect(lines[1]).toBe('Fatto: *Burger classico* (Cena) 12 € → 13 €.');expect(lines[2]).toContain('numero WhatsApp del titolare');expect(burgers(current.data.workspace)[0].id).toBe(ids.burger)})
})
describe('leniency does not weaken the extraction contract',()=>{
 it('unknown keys are still rejected; null/empty known values are not',async()=>{
  const reply=(content:unknown)=>(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(content)}}]}),{status:200})) as any
  await expect(extractOnboardingMessage('Crea Victoria','k',reply({name:'Victoria',exec:'delete all'}))).rejects.toThrow()
  await expect(extractOnboardingMenu('Tiramisu a 6 euro','k',reply({rows:[],issues:[],run:'x'}))).rejects.toThrow()
  expect(await extractOnboardingMessage('Crea Victoria','k',reply({name:'Victoria',ownerEmail:null,slug:'',menuStructure:[{menu:'Cena',section:null,evidence:'x'}]}))).toEqual({name:'Victoria',menuStructure:[]})
  const menu=await extractOnboardingMenu('Aggiungi Tiramisu a 6 euro','k',reply({rows:[{menu:null,section:'',name:'Tiramisu',price:6,description:null,evidence:'Tiramisu a 6 euro'},{name:'Torta',price:'boh',evidence:'Torta'}],issues:[null]}))
  expect(menu.rows).toEqual([expect.objectContaining({name:'Tiramisu',price:6,section:'Menu',intent:'add'})]);expect(menu.issues).toContain('*Torta*: qual è il prezzo corretto?')})
})

// ---- Round 2: bugs from the independent adversarial verification of v74 (verbatim phrases, model mistakes included).
const fullDraft=()=>{const w=twoMenus(12);w.menus[0]!.sections[0]!.items.push({...w.menus[0]!.sections[0]!.items[0]!,id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Risotto ai funghi',price:14});return draft(12,{workspace:w,ownerName:'Mario Collaudo'})}
describe('round 2 — nothing is lost in silence',()=>{
 it('bug 1 (live): the model omits the Burger change → rebuilt from the text, applied and confirmed',async()=>{
  current=draft(12);const text='Nel menu Pranzo, categoria Primi, aggiungi Risotto ai funghi a quattordici euro. Nel menu Cena cambia il Burger classico da dodici a tredici euro. Non cambiare la Pasta al pomodoro. Non pubblicare.'
  script.set(text,{message:{menuText:text},menu:{rows:[row('Pranzo','Primi','Risotto ai funghi',14,'Risotto ai funghi a quattordici euro')],issues:[]}})
  const reply=await say(text);expect(burgers(current.data.workspace)).toEqual([expect.objectContaining({id:ids.burger,price:13})]);expect(reply).toContain('*Burger classico* (Cena) 12 € → 13 €');expect(reply).toContain('aggiunto *Risotto ai funghi*');expect(current.data.unresolved).toEqual([])})
 it('bug 1: a price clause on a dish the model skipped and that is not in the draft becomes a question, shown first',async()=>{
  current=draft(12,{sources:[{url:'message:SMold',kind:'text',text:'x',warnings:[],processed:true,seq:1,issues:['*Lasagne*: qual è il prezzo corretto?']}],chatMessageSeq:1});const text='Aggiungi Tiramisu a 6 euro nel menu Pranzo, categoria Dolci. Nel menu Cena metti la Cheesecake a sette euro.'
  script.set(text,{message:{menuText:text},menu:{rows:[row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')],issues:[]}})
  const reply=await say(text);expect(reply).toContain('aggiunto *Tiramisu*');expect(reply).toContain('Non ho capito questa parte: «Nel menu Cena metti la Cheesecake a sette euro»');expect(reply.indexOf('Cheesecake')).toBeLessThan(reply.indexOf('Lasagne')>=0?reply.indexOf('Lasagne'):Infinity)})
 for(const [label,text,evidence,price] of [['«Non cambiare niente, tranne la Pasta al pomodoro che va a 11 euro» (live: nothing)','Non cambiare niente, tranne la Pasta al pomodoro che va a 11 euro.','Pasta al pomodoro che va a 11 euro',11],['«Lascia stare la pasta, il Burger classico costa 13 euro»','Lascia stare la pasta, il Burger classico costa 13 euro.','Burger classico costa 13 euro',13],['«Non cambiare la pasta e il Burger classico lo porto a 13 euro»','Non cambiare la pasta e il Burger classico lo porto a 13 euro.','Burger classico lo porto a 13 euro',13],['«Non toccare la pasta ma il Burger classico mettilo a 13 euro»','Non toccare la pasta ma il Burger classico mettilo a 13 euro.','Burger classico mettilo a 13 euro',13]] as const)
  it('bug 2: '+label+' → applied per clause and confirmed',async()=>{current=draft(12);const pasta=evidence.startsWith('Pasta');script.set(text,{message:{menuText:text},menu:{rows:[row(null,'Menu',pasta?'Pasta al pomodoro':'Burger classico',price,evidence)],issues:[]}})
   const reply=await say(text),item=current.data.workspace.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items)).find((i:any)=>i.name===(pasta?'Pasta al pomodoro':'Burger classico'))
   expect(item).toMatchObject({id:pasta?ids.pasta:ids.burger,price});expect(reply).toMatch(/Fatto: .*→/);expect(dishes(current.data.workspace)).toHaveLength(2)})
 it('bug 2: the same phrase with the model returning nothing is still applied (guardrail) — never a reply without the outcome',async()=>{current=draft(12);const text='Non cambiare niente, tranne la Pasta al pomodoro che va a 11 euro.';script.set(text,{message:{menuText:text},menu:{rows:[],issues:[]}})
  const reply=await say(text);expect(dishes(current.data.workspace)).toContain('Pranzo/Primi/Pasta al pomodoro/11');expect(reply).toContain('*Pasta al pomodoro* (Pranzo) 10 € → 11 €')})
 for(const keep of ['Tieni Burger classico a 15 euro e Pasta al pomodoro a 10 euro.','Burger classico resta a 15 euro.','Il Burger classico a 15 euro resta com’è.','Il Burger classico a 15 euro va bene così.','Confermo Burger classico a 15 euro.','Mantienni Burger classico a 15 euro.'])
  it('bug 3: «'+keep+'» + Tiramisu: no duplicate, no spurious doubt (verifier phrase 9)',async()=>{current=draft(15);const text=keep+' Nel menu Pranzo, categoria Dolci, aggiungi Tiramisu a 6 euro.'
   // Live output on v74 for «Tieni…»: the verb inside name and evidence, no menu.
   const tieni=keep.startsWith('Tieni'),burgerEv=tieni?'Tieni Burger classico a 15 euro':text.match(/Burger classico[^.]*?15 euro/)![0]
   script.set(text,{message:{menuText:text},menu:{rows:[row(null,'Menu',tieni?'Tieni Burger classico':'Burger classico',15,burgerEv),row(null,'Menu','Pasta al pomodoro',10,'Pasta al pomodoro a 10 euro'),row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')].filter(r=>text.includes(r.evidence)),issues:[]}})
   const reply=await say(text);expect(dishes(current.data.workspace).sort()).toEqual(['Cena/Panini/Burger classico/15','Pranzo/Dolci/Tiramisu/6','Pranzo/Primi/Pasta al pomodoro/10']);expect(current.data.unresolved).toEqual([]);expect(reply).not.toMatch(/In quale \*menu\*/)})
 it('bug 4 (live): «Alza la Pasta al pomodoro a 12 euro nel Pranzo» with the verb in the model name → same Pasta to 12',async()=>{current=draft(12);const text='Alza la Pasta al pomodoro a 12 euro nel Pranzo.';script.set(text,{message:{menuText:text},menu:{rows:[row('Pranzo','Menu','Alza la Pasta al pomodoro',12,'Alza la Pasta al pomodoro a 12 euro')],issues:[]}})
  const reply=await say(text);expect(dishes(current.data.workspace)).toEqual(['Pranzo/Primi/Pasta al pomodoro/12','Cena/Panini/Burger classico/12']);expect(reply).toContain('*Pasta al pomodoro* (Pranzo) 10 € → 12 €')})
 it('bug 5: a spurious doubt («In quale menu va Tieni Burger classico?») closes on the next message about the Burger, and old chat doubts expire',async()=>{
  current=draft(12,{sources:[{url:'message:SMa',kind:'text',text:'x',warnings:[],processed:true,seq:1,issues:['In quale *menu* va Tieni Burger classico?']},{url:'message:SMb',kind:'text',text:'y',warnings:[],processed:true,seq:1,issues:['*Lasagne*: qual è il prezzo corretto?']}],chatMessageSeq:1})
  const t1='Porta il Burger classico a 13 euro.';script.set(t1,{message:{menuText:t1},menu:{rows:[row(null,'Menu','Burger classico',13,'Burger classico a 13 euro')],issues:[]}});await say(t1)
  expect(current.data.unresolved).toEqual(['*Lasagne*: qual è il prezzo corretto?'])
  for(const [i,t] of ['Aggiungi Tiramisu a 6 euro nel menu Pranzo, categoria Dolci.','Aggiungi Panna cotta a 5 euro nel menu Pranzo, categoria Dolci.'].entries()){script.set(t,{message:{menuText:t},menu:{rows:[row('Pranzo','Dolci',i?'Panna cotta':'Tiramisu',i?5:6,i?'Panna cotta a 5 euro':'Tiramisu a 6 euro')],issues:[]}});await say(t)}
  expect(current.data.unresolved).toEqual([])})
 it('bug 6 (live): «Metti il Risotto ai funghi a 15 euro» with a unique Risotto → price change, no «In quale menu»',async()=>{current=fullDraft();const text='Metti il Risotto ai funghi a 15 euro.';script.set(text,{message:{menuText:text},menu:{rows:[row(null,'Menu','Risotto ai funghi',15,'Risotto ai funghi a 15 euro')],issues:[]}})
  const reply=await say(text);expect(dishes(current.data.workspace)).toContain('Pranzo/Primi/Risotto ai funghi/15');expect(reply).toContain('*Risotto ai funghi* (Pranzo) 14 € → 15 €');expect(reply).not.toContain('In quale')})
 it('bug 7: «Aggiungi Pizza margherita da 8 a 9 euro» on a new dish asks the price, never «Non trovo»',async()=>{current=draft(12);const text='Nel menu Pranzo categoria Pizze aggiungi Pizza margherita da 8 a 9 euro.';script.set(text,{message:{menuText:text},menu:{rows:[row('Pranzo','Pizze','Pizza margherita',9,'Pizza margherita da 8 a 9 euro')],issues:[]}})
  const reply=await say(text);expect(reply).toContain('*Pizza margherita*: qual è il prezzo? Ho letto 8 € e 9 €.');expect(reply).not.toContain('Non trovo');expect(dishes(current.data.workspace)).toHaveLength(2)})
 it('a message that changes nothing says so (no silent reply)',async()=>{current=draft(12);const text='Mantieni Burger classico a 12 euro.';script.set(text,{message:{menuText:text},menu:{rows:[row(null,'Menu','Burger classico',12,'Burger classico a 12 euro')],issues:[]}})
  expect(await say(text)).toContain('Nessuna modifica ai piatti');expect(dishes(current.data.workspace)).toHaveLength(2)})
 it('the guardrail does not block a real menu with the same dish under two menu headings (PDF-like source)',async()=>{
  const w=workspaceSchema.parse({menus:[]}),text='Menu Pranzo\nPrimi\nCarbonara 12,00 €\nMenu Cena\nPrimi\nCarbonara 14,00 €'
  const fetcher=(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({rows:[{menu:'Pranzo',menuEvidence:'Menu Pranzo',section:'Primi',name:'Carbonara',price:12,description:'',evidence:'Carbonara 12,00 €'},{menu:'Cena',menuEvidence:'Menu Cena',section:'Primi',name:'Carbonara',price:14,description:'',evidence:'Carbonara 14,00 €'}],issues:[]})}}]}),{status:200})) as any
  const extracted=await extractOnboardingMenu(text,'k',fetcher);mergeOnboardingRows(w,extracted.rows,false);expect(dishes(w).sort()).toEqual(['Cena/Primi/Carbonara/14','Pranzo/Primi/Carbonara/12'])})
})

// ---- Round 3: second adversarial verification of v75 (live phrases of verify2/e2e*.mjs).
describe('round 3 — never a wrong value, never silence',()=>{
 it('N1 (live): «Alza la Pasta al pomodoro di 2 euro» → 10+2 = 12, never 2',async()=>{current=draft(12);const text='Alza la Pasta al pomodoro di 2 euro.';script.set(text,{message:{menuText:text},menu:{rows:[row(null,'Primi','Pasta al pomodoro',2,'Pasta al pomodoro di 2 euro')],issues:[]}})
  const reply=await say(text);expect(dishes(current.data.workspace)).toContain('Pranzo/Primi/Pasta al pomodoro/12');expect(reply).toContain('*Pasta al pomodoro* (Pranzo) 10 € → 12 €')})
 it('N1: «Il Burger classico costa 1 euro in più» with the model silent → a question, the price stays',async()=>{current=draft(12);const text='Il Burger classico costa 1 euro in più.';script.set(text,{message:{menuText:text},menu:{rows:[],issues:[]}})
  const reply=await say(text);expect(burgers(current.data.workspace)[0].price).toBe(12);expect(reply).toContain('*Burger classico*: qual è il nuovo prezzo?')})
 it('N2/N3 (live): «Porta Nuova», «Lascia o raddoppia» keep their names when added',async()=>{current=draft(12)
  for(const [text,name,menu,section,price] of [['Nel menu Pranzo, categoria Pizze, aggiungi Porta Nuova a 9 euro.','Porta Nuova','Pranzo','Pizze',9],['Nel menu Cena, categoria Cocktail, aggiungi Lascia o raddoppia a 8 euro.','Lascia o raddoppia','Cena','Cocktail',8]] as const){script.set(text,{message:{menuText:text},menu:{rows:[row(menu,section,name,price,`${name} a ${price} euro`)],issues:[]}});const reply=await say(text);expect(dishes(current.data.workspace)).toContain(`${menu}/${section}/${name}/${price}`);expect(reply).not.toMatch(/Non trovo/)}})
 it('N4 (live): «non aggiungere il Tiramisu» does nothing; «elimina la Panna cotta» never creates it; «Elimina il Burger classico» removes it',async()=>{current=draft(12)
  const t1='Nel menu Pranzo, categoria Dolci, non aggiungere il Tiramisu a 6 euro.';script.set(t1,{message:{menuText:t1},menu:{rows:[row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')],issues:[]}});await say(t1)
  const t2='Nel menu Cena, categoria Dolci, elimina la Panna cotta a 5 euro.';script.set(t2,{message:{menuText:t2},menu:{rows:[row('Cena','Dolci','Panna cotta',5,'Panna cotta a 5 euro')],issues:[]}});const r2=await say(t2)
  expect(dishes(current.data.workspace)).toEqual(['Pranzo/Primi/Pasta al pomodoro/10','Cena/Panini/Burger classico/12']);expect(r2).toContain('Non trovo *Panna cotta*')
  const r3=await say('Elimina il Burger classico.');expect(dishes(current.data.workspace)).toEqual(['Pranzo/Primi/Pasta al pomodoro/10']);expect(r3).toContain('eliminato *Burger classico* (Cena)')})
 it('N4: «Sposta…» and «Rinomina…» are explained in one line, nothing duplicated',async()=>{current=draft(12)
  const t1='Sposta il Burger classico nel menu Pranzo, categoria Panini, a 12 euro.';script.set(t1,{message:{menuText:t1},menu:{rows:[row('Pranzo','Panini','Burger classico',12,'Burger classico nel menu Pranzo, categoria Panini, a 12 euro')],issues:[]}})
  const r1=await say(t1);expect(burgers(current.data.workspace)).toHaveLength(1);expect(r1).toContain('Da qui non posso *spostare*')
  const r2=await say('Rinomina Burger classico in Burger della casa.');expect(r2).toContain('Da qui non posso *rinominare*');expect(burgers(current.data.workspace)[0].name).toBe('Burger classico')})
 it('N7 (live): after 14+ messages with prices the draft still works (chat sources are folded, not capped)',async()=>{current=draft(12)
  for(let i=1;i<=16;i++){const text=`Nel menu Pranzo, categoria Primi, aggiungi Piatto ${i} a ${i+3} euro.`;script.set(text,{message:{menuText:text},menu:{rows:[row('Pranzo','Primi',`Piatto ${i}`,i+3,`Piatto ${i} a ${i+3} euro`)],issues:[]}});const reply=await say(text);expect(reply,`message ${i}`).toContain(`aggiunto *Piatto ${i}*`)}
  expect(dishes(current.data.workspace)).toHaveLength(18);expect(current.data.sources.length).toBeLessThanOrEqual(12);expect(m.db.jobs.filter(j=>j.status==='failed')).toHaveLength(0)})
 it('N8 (live): «Cena» answers «In quale menu va Sorbetto?» and never becomes the name or the owner',async()=>{current=draft(12,{ownerName:'Mario Collaudo'});const text='Aggiungi Sorbetto a 4 euro, categoria Dolci.'
  script.set(text,{message:{menuText:text},menu:{rows:[row(null,'Dolci','Sorbetto',4,'Sorbetto a 4 euro')],issues:[]}});const r1=await say(text);expect(r1).toContain('In quale *menu* va Sorbetto?')
  script.set('Cena',{message:{name:'Cena',ownerName:'Cena'}});const r2=await say('Cena')
  expect(current.data.name).toBe('Collaudo Mattina Sedici');expect(current.data.ownerName).toBe('Mario Collaudo');expect(dishes(current.data.workspace)).toContain('Cena/Dolci/Sorbetto/4');expect(r2).toContain('aggiunto *Sorbetto* (Cena · Dolci) a 4 €');expect(current.data.unresolved).toEqual([])})
 it('N8 (live): a bare «Cena» while the owner name is asked is not taken as the owner',async()=>{current=draft(12);const reply=await say('Cena');expect(current.data.ownerName).toBeUndefined();expect(reply).toContain('Come si chiama il *titolare*?')})
 it('live 11:14: the model answers «corrections» with an invented key → the message is still read',async()=>{current=draft(12);const text='Porta il Burger classico a 15 euro. Non pubblicare.'
  script.set(text,{message:{menuText:text,corrections:{price:15}},menu:{rows:[row(null,'Menu','Burger classico',15,'Burger classico a 15 euro')],issues:[]}})
  const reply=await say(text);expect(burgers(current.data.workspace)[0].price).toBe(15);expect(reply).not.toContain('Non sono riuscito');expect(m.db.errors).toEqual([])})
 it('N10/N14 (live): «Il coperto costa 2 euro» is not a question; an unclear clause is asked once and expires at the next message',async()=>{current=draft(12)
  const t1='Il coperto costa 2 euro. Nel menu Pranzo, categoria Dolci, aggiungi Tiramisu a 6 euro.';script.set(t1,{message:{menuText:t1},menu:{rows:[row('Pranzo','Dolci','Tiramisu',6,'Tiramisu a 6 euro')],issues:[]}});const r1=await say(t1)
  expect(r1).not.toContain('Non ho capito');expect(current.data.unresolved).toEqual([])
  const t2='Nel menu Cena metti la Cheesecake a sette euro.';script.set(t2,{message:{menuText:t2},menu:{rows:[],issues:[]}});expect(await say(t2)).toContain('Non ho capito questa parte')
  const t3='Porta il Burger classico a 13 euro.';script.set(t3,{message:{menuText:t3},menu:{rows:[row(null,'Menu','Burger classico',13,'Burger classico a 13 euro')],issues:[]}});await say(t3);expect(current.data.unresolved).toEqual([])})
 it('keep with a different price is said, never «erano già così», never overwritten',async()=>{current=draft(12);const text='Mantieni il Burger classico a 13 euro.';script.set(text,{message:{menuText:text},menu:{rows:[row(null,'Menu','Burger classico',13,'Burger classico a 13 euro')],issues:[]}})
  const reply=await say(text);expect(burgers(current.data.workspace)[0].price).toBe(12);expect(reply).toContain('è a 12 €, non a 13 €');expect(reply).not.toContain('erano già così')})
})
