vi.mock('../apps/server/src/lib/onboarding-lifecycle.js',()=>({agencyStartActor:vi.fn(async()=>null),onboardingLifecycleCommand:()=>null,redeemAgencyOnboardingCode:vi.fn(),touchOnboardingActivity:vi.fn(),purgeExpiredOnboarding:vi.fn()}))
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({execute:vi.fn(),active:vi.fn(),update:vi.fn(),extractMessage:vi.fn(),extractMenu:vi.fn(),send:vi.fn(),dispatch:vi.fn(),download:vi.fn(),inspect:vi.fn(),transcribe:vi.fn(),translate:vi.fn()}))
vi.mock('../packages/db/src/index.ts',()=>({db:{execute:mocks.execute,transaction:vi.fn(async fn=>fn({execute:mocks.execute}))}}))
vi.mock('../apps/server/src/lib/onboarding-store.js',()=>({createOnboarding:vi.fn(),activeOnboarding:mocks.active,getOnboarding:vi.fn(),updateOnboarding:mocks.update,cancelOnboarding:vi.fn(),approveOnboarding:vi.fn(),listOnboarding:vi.fn()}))
vi.mock('../apps/server/src/lib/menu-workspace-translate.js',()=>({translateWorkspace:mocks.translate,groqTranslationProviderFor:()=>undefined}))
vi.mock('../apps/server/src/lib/onboarding-dispatch.js',()=>({dispatchOnboardingJob:mocks.dispatch}))
vi.mock('../apps/server/src/lib/onboarding-source.js',()=>({ingestOnboardingSource:vi.fn(),inspectOnboardingMedia:mocks.inspect}))
vi.mock('../apps/server/src/lib/onboarding-planner.js',()=>({extractOnboardingMessage:mocks.extractMessage,extractOnboardingMenu:mocks.extractMenu}))
vi.mock('../apps/server/src/lib/onboarding-ocr.js',()=>({ocrOnboardingImage:vi.fn(),ocrOnboardingPdf:vi.fn()}))
vi.mock('../apps/server/src/lib/twilio-menu-ai.js',()=>({downloadTwilioMedia:mocks.download,sendWhatsApp:mocks.send,transcribeAudio:mocks.transcribe}))
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {onboardingCreationName,onboardingCommand,onboardingSlug,reservedOnboardingSlug,startsOnboarding,onboardingSourceIssues,pendingOnboardingTranslations,pendingOnboardingSources,splitOnboardingResponse,nextOnboardingStep,summary,drainOnboardingQueue,onboardingTransport,handleOnboardingChat} from '../apps/server/src/lib/onboarding-chat.js'
const actor='11111111-1111-4111-8111-111111111111',phone='whatsapp:+393331234567',savedEnv=process.env.TAKOMENU_AGENCY_USER_IDS
function session(extra:any={}){return{id:'22222222-2222-4222-8222-222222222222',actorId:actor,phone,state:'collecting',revision:1,data:{name:'Locale',slug:'locale',workspace:workspaceSchema.parse({menus:[]}),warnings:[],unresolved:[],...extra}}}
beforeEach(()=>{vi.clearAllMocks();mocks.translate.mockReset();mocks.send.mockReset();process.env.TAKOMENU_AGENCY_USER_IDS=actor;mocks.execute.mockResolvedValue([{actor_id:actor,id:actor}]);mocks.update.mockImplementation(async(id,actor,revision,data,state)=>({...session(),id,actorId:actor,revision:revision+1,data,state}));mocks.extractMessage.mockResolvedValue({});mocks.extractMenu.mockResolvedValue({rows:[],issues:[]})})
afterEach(()=>{process.env.TAKOMENU_AGENCY_USER_IDS=savedEnv})
describe('WhatsApp agency onboarding controls',()=>{
 it('grounds a simple creation name even when the model omits it',async()=>{mocks.active.mockResolvedValue(session({name:'',slug:''}));mocks.extractMessage.mockResolvedValue({});await handleOnboardingChat(actor,phone,'CREA LOCALI BLACK SHEEP');expect(mocks.update.mock.calls.at(-1)?.[3]).toMatchObject({name:'BLACK SHEEP',slug:'black-sheep'})})
 it('does not guess names from commands carrying contact details or instructions',()=>{expect(onboardingCreationName('Crea locale Black Sheep')).toBe('Black Sheep');for(const text of ['Crea locale Black Sheep https://example.com','Crea locale Black Sheep telefono 3331770927','Crea locale Black Sheep email a@b.it'])expect(onboardingCreationName(text)).toBeNull();for(const text of ['Crea locale Black Sheep, il titolare è Marco','Crea locale Black Sheep\nmenu pizza'])expect(onboardingCreationName(text)).toBe('Black Sheep')})

 it('normalizes commands and public slugs without allowing paths',()=>{expect(onboardingCommand(' PREPÀRA   ONBOARDING ')).toBe('prepara onboarding');expect(onboardingSlug("L’Agorà / Milano")).toBe('l-agora-milano');expect(reservedOnboardingSlug('staff')).toBe(true);expect(startsOnboarding('Crea un locale Victoria')).toBe(true)})
 it('accepts plural spoken locale creation without treating it as a dish',async()=>{mocks.active.mockResolvedValue(null);expect(startsOnboarding('CREA LOCALI BLACK SHEEP')).toBe(true);expect(await onboardingTransport(phone,'CREA LOCALI BLACK SHEEP')).toEqual({actor,active:false})})
 it('routes agency-only voice only for a separately verified agency',async()=>{mocks.active.mockResolvedValue(null);expect(await onboardingTransport(phone,'',true)).toEqual({actor,active:false});process.env.TAKOMENU_AGENCY_USER_IDS='';expect(await onboardingTransport(phone,'',true)).toBeNull()})
 it('requires typed activation even when a voice says approve',async()=>{expect(await handleOnboardingChat(actor,phone,'APPROVA E ATTIVA',{OnboardingVoice:'1'})).toContain('APPROVA E ATTIVA');expect(mocks.update).not.toHaveBeenCalled()})
 it('a paused session does not hijack normal restaurant messages',async()=>{mocks.active.mockResolvedValue(session({paused:true}));expect(await onboardingTransport(phone,'la pasta è finita')).toBeNull();expect(await onboardingTransport(phone,'RIPRENDI')).toEqual({actor,active:false})})
 it('an active onboarding receives material sent in separate messages',async()=>{mocks.active.mockResolvedValue(session());expect(await onboardingTransport(phone,'Ecco il PDF')).toEqual({actor,active:true})})
 it('revoked agency permission stops interception',async()=>{process.env.TAKOMENU_AGENCY_USER_IDS='';expect(await onboardingTransport(phone,'Crea locale Test')).toBeNull()})
 it('preserves issues on processed sources, and resolves only the explicitly reviewed source',()=>{const sources:any=[{processed:true,issues:['Prezzo dubbio']},{processed:true,reviewed:true,issues:['Contatto dubbio']}];expect(onboardingSourceIssues(sources)).toEqual(['Prezzo dubbio'])})
 it('does not truncate a long summary or an invitation link',()=>{const text=('Riga di testo\n').repeat(200)+'https://takoitalia.com/onboarding-claim/'+'a'.repeat(64);const parts=splitOnboardingResponse(text);expect(parts.every(p=>p.length<=1400)).toBe(true);expect(parts.join('\n')).toBe(text);expect(parts.at(-1)).toContain('https://takoitalia.com/onboarding-claim/')})
 it('all eleven foreign languages remain pending before translation',()=>{const w=workspaceSchema.parse({menus:[{id:'33333333-3333-4333-8333-333333333333',name:'Cena'}]});expect(pendingOnboardingTranslations(w)).toHaveLength(11)})
 it('applies explicit corrected contact fields instead of ignoring planner corrections',async()=>{mocks.active.mockResolvedValue(session());mocks.extractMessage.mockResolvedValue({ownerName:'Vecchio',corrections:{ownerName:'Marco',ownerEmail:'marco@example.com',ownerPhone:'3331234567'}});await handleOnboardingChat(actor,phone,'Correggi titolare Marco, marco@example.com, 3331234567');const last=mocks.update.mock.calls.at(-1)!;expect(last[3]).toMatchObject({ownerName:'Marco',ownerEmail:'marco@example.com',ownerPhone:'+393331234567'})})
 it('ESCI retains materials and pauses interception with a new revision',async()=>{mocks.active.mockResolvedValue(session({sources:[{url:'message:1',kind:'text',text:'Originale',warnings:[]}]}));const response=await handleOnboardingChat(actor,phone,'ESCI ONBOARDING');expect(response).toContain('Bozza in pausa');expect(mocks.update.mock.calls[0]![3]).toMatchObject({paused:true,sources:[{text:'Originale'}]})})
})

describe('bounded onboarding queue handoff',()=>{
 it('transcribes active onboarding audio before handling it and never imports audio as a menu photo',async()=>{
  mocks.active.mockResolvedValue(null);mocks.execute.mockReset();mocks.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
   .mockResolvedValueOnce([{sid:'MM'+'a'.repeat(32),payload:{text:'',form:{NumMedia:'1',MediaContentType0:'audio/ogg',MediaUrl0:'https://api.twilio.com/voice'}}}])
   .mockResolvedValueOnce([{id:actor}]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
  mocks.download.mockResolvedValue({bytes:Buffer.from('OggS'),type:'audio/ogg'});mocks.transcribe.mockResolvedValue('APPROVA E ATTIVA')
  await drainOnboardingQueue(actor,phone)
  expect(mocks.transcribe).toHaveBeenCalledOnce();expect(mocks.inspect).not.toHaveBeenCalled();expect(mocks.send.mock.calls[0]?.[4]).toContain('APPROVA E ATTIVA')
 })

 it('processes one job then dispatches the oldest ordinary queued message',async()=>{
  const first='SM'+'a'.repeat(32),second='MM'+'b'.repeat(32)
  mocks.active.mockResolvedValue(null)
  mocks.execute.mockReset()
  mocks.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
   .mockResolvedValueOnce([{sid:first,payload:{text:'collega agenzia '+ 'c'.repeat(64),form:{}}}])
   .mockResolvedValueOnce([{id:actor}])
   .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{sid:second}])
  mocks.dispatch.mockResolvedValue(true)
  await drainOnboardingQueue(actor,phone)
  expect(mocks.send).toHaveBeenCalledOnce()
  expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith(second)
  expect(mocks.execute).toHaveBeenCalledTimes(8)
 })
 it('does not spin if the next invocation cannot be dispatched',async()=>{
  const first='SM'+'d'.repeat(32),second='SM'+'e'.repeat(32)
  mocks.active.mockResolvedValue(null);mocks.execute.mockReset()
  mocks.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
   .mockResolvedValueOnce([{sid:first,payload:{text:'collega agenzia '+ 'c'.repeat(64),form:{}}}])
   .mockResolvedValueOnce([{id:actor}]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{sid:second}])
  mocks.dispatch.mockResolvedValue(false)
  await drainOnboardingQueue(actor,phone)
  expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith(second);expect(mocks.execute).toHaveBeenCalledTimes(8)
 })
})

describe('corrected dish translation freshness',()=>{
 it('invalidates translated descriptions when a grounded correction changes ingredients',async()=>{
  const current=session();current.data.workspace=workspaceSchema.parse({menus:[{id:'33333333-3333-4333-8333-333333333333',name:'Cena',sections:[{id:'44444444-4444-4444-8444-444444444444',name:'Primi',items:[{id:'55555555-5555-4555-8555-555555555555',name:'Pasta',price:10,description:'pomodoro',translations:{en:{name:'Pasta',description:'tomato'}}}]}]}]})
  mocks.active.mockResolvedValue(current);mocks.extractMessage.mockResolvedValue({menuText:'Pasta 12 euro con funghi',corrections:{}});mocks.extractMenu.mockResolvedValue({rows:[{section:'Primi',name:'Pasta',price:12,description:'funghi'}],issues:[]})
  await handleOnboardingChat(actor,phone,'Correggi Pasta 12 euro con funghi')
  const item=mocks.update.mock.calls.at(-1)![3].workspace.menus[0].sections[0].items[0]
  expect(item).toMatchObject({price:12,description:'funghi',translations:{}})
  expect(pendingOnboardingTranslations(mocks.update.mock.calls.at(-1)![3].workspace)).toContain('en')
 })
})

describe('durable bounded material processing',()=>{
 it('acquires one attachment per invocation then extracts each source without duplicates',async()=>{
  let current=session();mocks.active.mockImplementation(async()=>current);mocks.update.mockImplementation(async(id,actor,revision,data,state)=>current={...current,revision:revision+1,data,state})
  mocks.download.mockResolvedValue({bytes:Buffer.from('image')});mocks.inspect.mockResolvedValueOnce({kind:'image',text:'Pasta 10 euro',warnings:[]}).mockResolvedValueOnce({kind:'image',text:'Pizza 12 euro',warnings:[]})
  mocks.extractMessage.mockResolvedValue({});mocks.extractMenu.mockImplementation(async text=>({rows:[{section:'Menu',name:text.startsWith('Pasta')?'Pasta':'Pizza',price:text.startsWith('Pasta')?10:12,description:''}],issues:[]}))
  const form={MessageSid:'SM'+'1'.repeat(32),NumMedia:'2',MediaUrl0:'https://api.twilio.com/a',MediaUrl1:'https://api.twilio.com/b',MediaContentType0:'image/jpeg',MediaContentType1:'image/jpeg'}
  await handleOnboardingChat(actor,phone,'Ecco il menu',form)
  expect(mocks.download).toHaveBeenCalledTimes(1);expect(mocks.extractMenu).not.toHaveBeenCalled();expect(pendingOnboardingSources(current.data)).toBe(true)
  await handleOnboardingChat(actor,phone,'Ecco il menu',form) // delivery retry uses saved descriptors
  expect(mocks.download).toHaveBeenCalledTimes(2);expect(current.data.sources).toHaveLength(2);expect(mocks.extractMessage).toHaveBeenCalledOnce()
  await handleOnboardingChat(actor,phone,'riprendi');expect(mocks.extractMenu).toHaveBeenCalledTimes(1)
  await handleOnboardingChat(actor,phone,'riprendi');expect(mocks.extractMenu).toHaveBeenCalledTimes(2);expect(pendingOnboardingSources(current.data)).toBe(false)
  await handleOnboardingChat(actor,phone,'riprendi');expect(mocks.extractMenu).toHaveBeenCalledTimes(2)
  expect(current.data.workspace.menus[0].sections[0].items.map(i=>i.name)).toEqual(['Pasta','Pizza'])
 })
 it('checkpoints a large source after one bounded chunk and resumes without replaying dishes',async()=>{
  let current=session({sources:[{url:'message:long',kind:'text',text:('Pasta 10 euro\n').repeat(1100),warnings:[]}]})
  mocks.active.mockImplementation(async()=>current);mocks.update.mockImplementation(async(id,actor,revision,data,state)=>current={...current,revision:revision+1,data,state})
  mocks.extractMenu.mockResolvedValue({rows:[{section:'Menu',name:'Pasta',price:10,description:''}],issues:[]})
  await handleOnboardingChat(actor,phone,'riprendi');expect(mocks.extractMenu).toHaveBeenCalledOnce();expect(mocks.extractMenu.mock.calls[0][0].length).toBeLessThanOrEqual(12000);expect(pendingOnboardingSources(current.data)).toBe(true)
  const offset=(current.data.sources as any)[0].extractionOffset;expect(offset).toBeGreaterThan(0)
  await handleOnboardingChat(actor,phone,'riprendi');expect(mocks.extractMenu).toHaveBeenCalledTimes(2);expect(pendingOnboardingSources(current.data)).toBe(false);expect(current.data.workspace.menus[0].sections[0].items).toHaveLength(1)
 })
})

describe('acquisition continuation without imported dishes',()=>{
 it('schedules PREPARA rather than repeating an approval or dropping unprocessed material',async()=>{
  const first='SM'+'f'.repeat(32),next='OB'+'a'.repeat(32)
  mocks.active.mockResolvedValue(session({pendingAcquisitions:[{kind:'media',mediaUrl:'https://api.twilio.com/media'}]}));mocks.execute.mockReset()
  mocks.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
   .mockResolvedValueOnce([{sid:first,payload:{text:'collega agenzia '+ 'c'.repeat(64),form:{}}}])
   .mockResolvedValueOnce([{id:actor}]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{sid:next}])
  mocks.dispatch.mockResolvedValue(true)
  await drainOnboardingQueue(actor,phone)
  expect(mocks.execute).toHaveBeenCalledTimes(9);expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith(next)
  const chunks=mocks.execute.mock.calls[6][0].queryChunks
  const serialized=JSON.stringify(chunks)
  expect(serialized).toContain('prepara onboarding');expect(serialized).not.toContain('approva e attiva')
 })
})


describe('persistent translation retry',()=>{
 function translationSession(){const s=session({heroAttempted:true});s.data.workspace=workspaceSchema.parse({menus:[{id:'33333333-3333-4333-8333-333333333333',name:'Cena',sections:[{id:'44444444-4444-4444-8444-444444444444',name:'Primi',items:[{id:'55555555-5555-4555-8555-555555555555',name:'Pasta',price:10}]}]}]});return s}
 async function runFailure(error:unknown,form:Record<string,string>={}){mocks.active.mockResolvedValue(translationSession());mocks.translate.mockRejectedValue(error);mocks.execute.mockReset();mocks.execute.mockResolvedValue([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{sid:'OB'+'f'.repeat(32),payload:{text:'prepara onboarding',form}}]).mockResolvedValueOnce([{id:actor}]);await drainOnboardingQueue(actor,phone);return mocks.execute.mock.calls.map(c=>JSON.stringify(c[0].queryChunks)).join('\n')}
 it('persists one continuation for provider 429 without inline retry or sensitive diagnostics',async()=>{const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});try{const queries=await runFailure({status:429,message:'SECRET PROVIDER BODY'});expect(mocks.translate).toHaveBeenCalledOnce();expect(queries).toContain('OnboardingTranslationRetry');expect(queries).toContain('rate_limit');expect(queries).not.toContain('SECRET PROVIDER BODY');expect(queries).toContain('INSERT INTO tako_onboarding_inbox_jobs')}finally{warn.mockRestore()}})
 it('stops after the bounded transient retries and gives a step-appropriate resume',async()=>{const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});try{const queries=await runFailure({status:503},{OnboardingInternal:'1',OnboardingTranslationRetry:'6'});expect(queries).not.toContain('INSERT INTO tako_onboarding_inbox_jobs');const text=mocks.send.mock.calls[0]?.[4];expect(text).toContain('PREPARA ONBOARDING');expect(text).not.toMatch(/STATO ONBOARDING|RIPRENDI/)}finally{warn.mockRestore()}})
 it('does not automatically retry malformed provider JSON',async()=>{const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});try{const queries=await runFailure(new SyntaxError('private response'));expect(queries).not.toContain('INSERT INTO tako_onboarding_inbox_jobs');expect(queries).toContain('validation')}finally{warn.mockRestore()}})
 it('a WhatsApp delivery failure never becomes a provider retry',async()=>{mocks.active.mockResolvedValue(null);mocks.send.mockRejectedValue({status:503});mocks.execute.mockReset();mocks.execute.mockResolvedValue([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{sid:'OB'+'e'.repeat(32),payload:{text:'collega agenzia '+'c'.repeat(64),form:{}}}]).mockResolvedValueOnce([{id:actor}]);await drainOnboardingQueue(actor,phone);expect(mocks.translate).not.toHaveBeenCalled();expect(mocks.execute.mock.calls.map(c=>JSON.stringify(c[0].queryChunks)).join('')).not.toContain('OnboardingTranslationRetry')})
})


describe('progressive onboarding copy',()=>{
 const named=()=>session({name:'Locale',slug:'locale',workspace:workspaceSchema.parse({menus:[{id:'11111111-1111-4111-8111-111111111111',name:'Cena',sections:[{id:'22222222-2222-4222-8222-222222222222',name:'Primi',items:[{id:'33333333-3333-4333-8333-333333333333',name:'Pasta',price:10}]}]}]})})
 it('starts with the name and optional website without asking all contacts',async()=>{const s=session({name:'',slug:''});const text=await summary(s as any,'recap');expect(text).toContain('Come si chiama il *locale*?');expect(text).toContain('*link*');expect(text).toContain('*10 minuti senza attività*');expect(text).not.toMatch(/titolare|email|prefisso|PREPARA|ANNULLA|slug|Mi manca/);expect(text.length).toBeLessThan(180)})
 it('asks only the next missing owner field while preserving internal validation',()=>{const s=named();expect(nextOnboardingStep(s.data)).toBe('Come si chiama il *titolare*?');s.data.ownerName='Marco';expect(nextOnboardingStep(s.data)).toContain('numero WhatsApp del titolare');expect(nextOnboardingStep(s.data)).not.toContain('email');s.data.ownerPhone='+393331234567';expect(nextOnboardingStep(s.data)).toBe('Qual è l’*email del titolare*?')})
 it('keeps status recap short and reports saved fields without the command manual',async()=>{const s=named();s.data.ownerName='Marco';const text=await summary(s as any,'recap');expect(text).toContain('Raccolti: nome titolare.');expect(text.match(/\?/g)).toHaveLength(1);expect(text).not.toMatch(/PREPARA ONBOARDING|ANNULLA ONBOARDING|ESCI ONBOARDING|Mi manca|📝|✅/);expect(text.replace(/https:\/\/\S+/g,'<link>').length).toBeLessThan(250)})
 it('shows one source issue as a plain question, without internal source numbers or commands (16/10)',()=>{const s=named();s.data.unresolved=['Fonte 2: *Pasta*: qual è il prezzo corretto?','Fonte 3: altra incertezza'];const text=nextOnboardingStep(s.data);expect(text).toContain('*Pasta*: qual è il prezzo corretto?');expect(text).not.toMatch(/Fonte|VERIFICATO|altra incertezza/)})
})

it('renders agency lists in Italian without internal IDs or database states',async()=>{const store=await import('../apps/server/src/lib/onboarding-store.js');vi.mocked(store.listOnboarding).mockResolvedValue([{...session(),state:'collecting'},{...session(),state:'review'},{...session(),state:'activated'}] as any);const text=await handleOnboardingChat(actor,phone,'elenco onboarding');expect(text).toContain('in preparazione');expect(text).toContain('pronto da controllare');expect(text).toContain('attivo');expect(text).not.toMatch(/collecting|review|activated|[a-f0-9]{8}-[a-f0-9-]{27}/)})


describe('complete private onboarding from WhatsApp',()=>{
 it('keeps the creation name before a trailing private-only instruction',()=>{expect(onboardingCreationName('Crea locale Collaudo Completo. È una prova privata: non pubblicare nulla.')).toBe('Collaudo Completo')})
 it('builds separate menus, scopes corrections and preserves logo, hero and explicit colors',async()=>{
  let current=session({name:'Locale',workspace:workspaceSchema.parse({menus:[],design:{logoUrl:'https://takoitalia.com/logo.png',coverUrl:'https://takoitalia.com/hero.png'}})})
  mocks.active.mockImplementation(async()=>current);mocks.update.mockImplementation(async(id,actor,revision,data,state)=>current={...current,revision:revision+1,data,state})
  const text='Menu Pranzo categoria Primi: Pasta 10 euro. Menu Cena categoria Primi: Pasta 12 euro. Colore arancione.'
  mocks.extractMessage.mockResolvedValue({menuText:text,menuStructure:[{menu:'Pranzo',section:'Primi',evidence:'Menu Pranzo categoria Primi'},{menu:'Cena',section:'Primi',evidence:'Menu Cena categoria Primi'}],designInstructions:[{field:'primary',value:'arancione',evidence:'Colore arancione'}]})
  mocks.extractMenu.mockResolvedValue({rows:[{menu:'Pranzo',menuEvidence:'Menu Pranzo',section:'Primi',name:'Pasta',price:10,description:''},{menu:'Cena',menuEvidence:'Menu Cena',section:'Primi',name:'Pasta',price:12,description:''}],issues:[]})
  await handleOnboardingChat(actor,phone,text,{MessageSid:'SM-first'})
  expect(current.data.workspace.menus.map(m=>m.name)).toEqual(['Pranzo','Cena']);const ids=current.data.workspace.menus.map(m=>m.sections[0].items[0].id);expect(ids[0]).not.toBe(ids[1]);expect(current.data.workspace.design.primary).toBe('#ff8a28')
  mocks.extractMessage.mockResolvedValue({corrections:{menuText:'Nel menu Cena Pasta 15 euro'}});mocks.extractMenu.mockResolvedValue({rows:[{menu:'Cena',menuEvidence:'menu Cena',section:'Primi',name:'Pasta',price:15,description:''}],issues:[]})
  await handleOnboardingChat(actor,phone,'Correggi: nel menu Cena Pasta 15 euro',{MessageSid:'SM-second'})
  expect(current.data.workspace.menus.map(m=>m.sections[0].items[0].price)).toEqual([10,15]);expect(current.data.workspace.menus.map(m=>m.sections[0].items[0].id)).toEqual(ids)
  const sources=await import('../apps/server/src/lib/onboarding-source.js');vi.mocked(sources.ingestOnboardingSource).mockResolvedValue({url:'https://example.com',kind:'html',text:'Locale',colors:['#ff00ff'],warnings:[]});mocks.extractMessage.mockResolvedValue({})
  await handleOnboardingChat(actor,phone,'https://example.com',{MessageSid:'SM-third'})
  expect(current.data.workspace.design.primary).toBe('#ff8a28');expect(current.data.workspace.design.logoUrl).toBe('https://takoitalia.com/logo.png');expect(current.data.workspace.design.coverUrl).toBe('https://takoitalia.com/hero.png')
 })
 it('does not put an unassigned dish into the first of multiple menus',async()=>{let current=session({workspace:workspaceSchema.parse({menus:[{id:actor,name:'Pranzo',sections:[]},{id:'22222222-2222-4222-8222-222222222222',name:'Cena',sections:[]}]})});mocks.active.mockImplementation(async()=>current);mocks.update.mockImplementation(async(id,actor,revision,data,state)=>current={...current,revision:revision+1,data,state});mocks.extractMessage.mockResolvedValue({menuText:'Pasta 10 euro'});mocks.extractMenu.mockResolvedValue({rows:[{section:'Primi',name:'Pasta',price:10,description:''}],issues:[]});await handleOnboardingChat(actor,phone,'Pasta 10 euro');expect(current.data.workspace.menus.every(m=>m.sections.length===0)).toBe(true);expect(current.data.unresolved.join(' ')).toContain('In quale *menu*')})
})

it('warns about a JPEG transparency loss without editing or pretending the logo is transparent',async()=>{let current=session({name:'Logo test'});mocks.active.mockImplementation(async()=>current);mocks.update.mockImplementation(async(id,actor,revision,data,state)=>current={...current,revision:revision+1,data,state});mocks.download.mockResolvedValue({bytes:Buffer.from('jpeg'),type:'image/jpeg'});const assets=await import('../apps/server/src/lib/onboarding-assets.js');const staged=vi.spyOn(assets,'stageOnboardingImage').mockResolvedValue('https://takoitalia.com/api/onboarding/asset/received');try{const text=await handleOnboardingChat(actor,phone,'LOGO mantieni la trasparenza',{MessageSid:'SM-jpeg-logo',NumMedia:'1',MediaUrl0:'https://api.twilio.com/image',MediaContentType0:'image/jpeg'});expect(text).toContain('Ho ricevuto un *JPEG*');expect(text).toContain('PNG come *documento*');expect(current.data.workspace.design.logoUrl).toBe('https://takoitalia.com/api/onboarding/asset/received');expect(staged).toHaveBeenCalledOnce()}finally{staged.mockRestore()}})
it('a valid angle correction clears only the old angle issue and preserves an unresolved font',async()=>{let current=session({designIssues:['Indica l’*angolo della sfumatura* da 0 a 360.'],designIssuesByField:{gradientAngle:['Indica l’*angolo della sfumatura* da 0 a 360.'],font:['Scegli il font']},workspace:workspaceSchema.parse({menus:[],design:{backgroundGradient:{from:'#000000',to:'#0b132b',angle:180}}})});mocks.active.mockImplementation(async()=>current);mocks.update.mockImplementation(async(id,actor,revision,data,state)=>current={...current,revision:revision+1,data,state});mocks.extractMessage.mockResolvedValue({designInstructions:[{field:'gradientAngle',value:'90 gradi',evidence:'a 90 gradi'}]});await handleOnboardingChat(actor,phone,'Sfumatura a 90 gradi');expect(current.data.workspace.design.backgroundGradient?.angle).toBe(90);expect(current.data.designIssues).toEqual(['Scegli il font'])})

it.each([
 ['LOGO: sostituisci il logo con questo PNG originale e mantieni la trasparenza. Non cambiare la copertina.','logo'],
 ['HERO: usa questa copertina. Non sostituire il logo.','hero'],
] as const)('respects the positive image role and preserves the other asset: %s',async(caption,role)=>{
 let current=session({workspace:workspaceSchema.parse({menus:[],design:{logoUrl:'https://takoitalia.com/old-logo.png',coverUrl:'https://takoitalia.com/old-hero.png'}})})
 mocks.active.mockImplementation(async()=>current);mocks.update.mockImplementation(async(id,actor,revision,data,state)=>current={...current,revision:revision+1,data,state});mocks.download.mockResolvedValue({bytes:Buffer.from('PNG'),type:'image/png'});const assets=await import('../apps/server/src/lib/onboarding-assets.js');const staged=vi.spyOn(assets,'stageOnboardingImage').mockResolvedValue('https://takoitalia.com/new-image.png');try{await handleOnboardingChat(actor,phone,caption,{MessageSid:'SM-role-'+role,NumMedia:'1',MediaUrl0:'https://api.twilio.com/image',MediaContentType0:'image/png'});expect(current.data.workspace.design.logoUrl).toBe(role==='logo'?'https://takoitalia.com/new-image.png':'https://takoitalia.com/old-logo.png');expect(current.data.workspace.design.coverUrl).toBe(role==='hero'?'https://takoitalia.com/new-image.png':'https://takoitalia.com/old-hero.png');expect(current.data.warnings.join(' ')).not.toContain('JPEG')}finally{staged.mockRestore()}
})
it('asks to disambiguate an image instead of replacing either asset',async()=>{let current=session({workspace:workspaceSchema.parse({menus:[],design:{logoUrl:'https://takoitalia.com/logo.png',coverUrl:'https://takoitalia.com/hero.png'}})});mocks.active.mockImplementation(async()=>current);mocks.update.mockImplementation(async(id,actor,revision,data,state)=>current={...current,revision:revision+1,data,state});mocks.download.mockResolvedValue({bytes:Buffer.from('png'),type:'image/png'});const assets=await import('../apps/server/src/lib/onboarding-assets.js');const staged=vi.spyOn(assets,'stageOnboardingImage');try{await handleOnboardingChat(actor,phone,'Questa immagine va come logo e hero',{NumMedia:'1',MediaUrl0:'https://api.twilio.com/image',MediaContentType0:'image/png'});expect(staged).not.toHaveBeenCalled();expect(current.data.workspace.design.logoUrl).toBe('https://takoitalia.com/logo.png');expect(current.data.workspace.design.coverUrl).toBe('https://takoitalia.com/hero.png');expect(current.data.unresolved.join(' ')).toContain('*LOGO* o *HERO*')}finally{staged.mockRestore()}})
it('imports an integer-euro follow-up into Cena even when metadata omits menuText',async()=>{let current=session({workspace:workspaceSchema.parse({menus:[{id:actor,name:'Pranzo',sections:[]},{id:'22222222-2222-4222-8222-222222222222',name:'Cena',sections:[]}],design:{logoUrl:'https://takoitalia.com/logo.png',coverUrl:'https://takoitalia.com/hero.png'}})});mocks.active.mockImplementation(async()=>current);mocks.update.mockImplementation(async(id,actor,revision,data,state)=>current={...current,revision:revision+1,data,state});mocks.extractMessage.mockResolvedValue({});mocks.extractMenu.mockResolvedValue({rows:[{menu:'Cena',menuEvidence:'menu Cena',section:'Dolci',name:'Tiramisu',price:6,description:''}],issues:[]});const text='Aggiungi nel menu Cena la categoria Dolci con Tiramisu a 6 euro. Mantieni tutti i piatti, il logo e la copertina. Non pubblicare.';await handleOnboardingChat(actor,phone,text,{MessageSid:'SM-dessert'});expect(mocks.extractMenu).toHaveBeenCalledWith(text,expect.any(String));expect(current.data.workspace.menus[0].sections).toHaveLength(0);expect(current.data.workspace.menus[1].sections[0].name).toBe('Dolci');expect(current.data.workspace.menus[1].sections[0].items[0]).toMatchObject({name:'Tiramisu',price:6});expect(current.data.workspace.design.logoUrl).toBe('https://takoitalia.com/logo.png');expect(current.data.workspace.design.coverUrl).toBe('https://takoitalia.com/hero.png')})

it('stages a pure HERO caption even when the metadata provider would be rate limited',async()=>{let current=session({workspace:workspaceSchema.parse({menus:[],design:{logoUrl:'https://takoitalia.com/logo.png'}})});mocks.active.mockImplementation(async()=>current);mocks.update.mockImplementation(async(id,actor,revision,data,state)=>current={...current,revision:revision+1,data,state});mocks.extractMessage.mockRejectedValue(new Error('Provider429'));mocks.download.mockResolvedValue({bytes:Buffer.from('PNG'),type:'image/png'});const assets=await import('../apps/server/src/lib/onboarding-assets.js');const staged=vi.spyOn(assets,'stageOnboardingImage').mockResolvedValue('https://takoitalia.com/hero.png');try{await handleOnboardingChat(actor,phone,'HERO: usa questa immagine come copertina del locale Collaudo Completo. Non sostituire il logo.',{MessageSid:'SM-hero-provider-bypass',NumMedia:'1',MediaUrl0:'https://api.twilio.com/image',MediaContentType0:'image/png'});expect(mocks.extractMessage).not.toHaveBeenCalled();expect(staged).toHaveBeenCalledOnce();expect(current.data.workspace.design.logoUrl).toBe('https://takoitalia.com/logo.png');expect(current.data.workspace.design.coverUrl).toBe('https://takoitalia.com/hero.png')}finally{staged.mockRestore()}})
