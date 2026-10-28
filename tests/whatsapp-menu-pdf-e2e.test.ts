// 28/10 — «mandami il menu giorno»: webhook Twilio firmato vero → risposta con allegato PDF → la route pubblica scaricata come farebbe
// Twilio genera il PDF vero dal menu PUBBLICATO. DB, Twilio e rete finti; nessuna scrittura reale.
import {createRequire} from 'node:module'
import {describe,it,expect,vi,beforeEach,afterAll} from 'vitest'
const S=vi.hoisted(()=>({published:null as any,draft:null as any,messages:new Map<string,string>(),links:new Set<string>(),active:true,settings:{timezone:'Europe/Rome'} as any,sent:[] as URLSearchParams[]}))
const tenant='26050ecd-2e55-4057-a4c5-bff2b449cd47',actor='44444444-4444-4444-8444-444444444444',phone='whatsapp:+390000000099'
const parse=(q:any)=>{let text='';const params:unknown[]=[];for(const c of q.queryChunks)if(c&&typeof c==='object'&&Array.isArray(c.value))text+=c.value.join('');else{text+='$';params.push(c)}return{text,params}}
vi.mock('../apps/server/src/lib/onboarding-chat.js',()=>({expiredOnboardingNotice:async()=>null,startsOnboarding:()=>false,onboardingTransport:async()=>null,queueOnboardingChat:async()=>false}))
vi.mock('../apps/server/src/index.js',()=>({io:{}}))
vi.mock('../packages/db/src/index.ts',async importOriginal=>{const real:any=await importOriginal()
 const execute=async(q:unknown):Promise<any[]>=>{const {text,params}=parse(q),p=params as any[]
  if(text.startsWith('SELECT 1 FROM tako_whatsapp_links'))return S.links.has(p[0])?[{}]:[]
  if(text.startsWith('SELECT restaurant_id,actor_id,activated_at FROM tako_whatsapp_links'))return S.links.has(p[0])?[{restaurant_id:tenant,actor_id:actor,activated_at:new Date()}]:[]
  if(text.includes('FROM users u'))return[{id:actor,restaurant_id:tenant,role:'owner',active:true}]
  if(text.includes('pg_advisory_xact_lock'))return[]
  if(text.startsWith('SELECT response FROM tako_whatsapp_messages'))return S.messages.has(p[0])?[{response:S.messages.get(p[0])}]:[]
  if(text.startsWith('INSERT INTO tako_whatsapp_messages')){if(!S.messages.has(p[0]))S.messages.set(p[0],p[1]);return[]}
  if(text.startsWith('UPDATE tako_whatsapp_messages')){S.messages.set(p[1],p[0]);return[]}
  if(text.startsWith('SELECT active,settings FROM restaurants'))return[{active:S.active,settings:structuredClone(S.settings)}]
  if(text.startsWith('SELECT settings FROM restaurants'))return[{settings:structuredClone(S.settings)}]
  if(text.startsWith('SELECT name FROM restaurants'))return[{name:'Victoria'}]
  if(text.includes('tako_whatsapp_proposals'))return[]
  if(text.includes('tako_owner_brain')||text.includes('tako_whatsapp_turns')||text.includes('tako_whatsapp_memory'))return[]
  if(text.startsWith('INSERT INTO tako_whatsapp_errors'))return[{id:1}]
  if(text.startsWith('SELECT count(*)::int AS n FROM tako_whatsapp_errors'))return[{n:0}]
  return[]}
 const chain=()=>{let table:unknown;const q:any={from(t:unknown){table=t;return q},where(){return q},limit(){return q},then(res:any,rej:any){return Promise.resolve(table===real.restaurants?[{name:'Victoria',active:S.active,settings:structuredClone(S.settings)}]:[]).then(res,rej)}};return q}
 return {...real,db:{execute,select(){return chain()},transaction:async(fn:any)=>fn({execute})}}})
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async importOriginal=>{const real:any=await importOriginal();return {...real,readWorkspace:async()=>S.published?{draft:structuredClone(S.draft),published:structuredClone(S.published),revision:9,published_revision:9}:null}})
import {twilioSignature} from '../apps/server/src/lib/twilio-menu-command.js'
import {twilioMenuRoutes} from '../apps/server/src/routes/twilio-menu.js'
import {publicMenuPdfRoutes} from '../apps/server/src/routes/menu-workspace.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {victoriaFixedWorkspace,VICTORIA_IDS as I} from './fixtures/victoria-fixed-workspace.mjs'
const Fastify=createRequire(new URL('../apps/server/package.json',import.meta.url))('fastify')
const unpdf=await import(new URL('../apps/server/node_modules/unpdf/dist/index.mjs',import.meta.url).href)
const pdfText=async(bytes:Uint8Array)=>{const pdf=await unpdf.getDocumentProxy(new Uint8Array(bytes));const {text}=await unpdf.extractText(pdf,{mergePages:true});return String(text).replace(/\s+/g,' ')}

const realFetch=globalThis.fetch
vi.stubGlobal('fetch',async(url:any,init:any)=>{const u=String(url);if(u.endsWith('/Messages.json')){S.sent.push(new URLSearchParams(String(init.body)));return new Response('{}',{status:201,headers:{'Content-Type':'application/json'}})}
 if(u.includes('/chat/completions')||u.includes('anthropic'))throw new Error('Nessuna IA per la richiesta del PDF');return realFetch(url,init)})
afterAll(()=>vi.unstubAllGlobals())
const token='pdf-token',self='https://takoitalia.com/api/whatsapp/twilio',account='AC'+'2'.repeat(32),sender='whatsapp:+18382622788'
Object.assign(process.env,{TWILIO_AUTH_TOKEN:token,TWILIO_WEBHOOK_URL:self,TWILIO_ACCOUNT_SID:account,TWILIO_WHATSAPP_NUMBER:sender,GROQ_API_KEY:'test-key',JWT_SECRET:'j'.repeat(48),WEB_ORIGIN:'https://takoitalia.com'})
delete process.env.TWILIO_API_BASE;delete process.env.TAKO_WHATSAPP_ONBOARDING_ENABLED;delete process.env.TAKO_MENU_PDF_DOCUMENTS
let n=0;const sid=()=>'SM'+(++n).toString(16).padStart(32,'0')
const post=(a:any,body:string)=>{const form={AccountSid:account,From:phone,To:sender,NumMedia:'0',MessageSid:sid(),Body:body};return a.inject({method:'POST',url:'/api/whatsapp/twilio',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':twilioSignature(token,self,form)},payload:new URLSearchParams(form).toString()})}
const app=async()=>{const a=Fastify();await a.register(twilioMenuRoutes,{prefix:'/api'});await a.register(publicMenuPdfRoutes as any,{prefix:'/api/public'});await a.ready();return a}
function victoriaWithGiorno(){const raw=victoriaFixedWorkspace();raw.menus.find((m:any)=>m.id===I.pranzo)!.name='Menu Giorno';return workspaceSchema.parse(raw)}
beforeEach(()=>{S.published=victoriaWithGiorno();S.draft=victoriaWithGiorno();S.messages.clear();S.messages.set('ai:'+phone,'1');S.links=new Set([phone]);S.active=true;S.sent=[]})

describe('«mandami il menu giorno» → PDF in chat',()=>{
 it('risponde con il PDF del Menu Giorno; il link genera il PDF vero dal menu pubblicato',async()=>{const a=await app()
  const res=await post(a,'Mandami il menu giorno come ha chiesto Luisa')
  expect(res.statusCode).toBe(200)
  const media=res.body.match(/<Media>([^<]+)<\/Media>/)?.[1]
  expect(res.body).toMatch(/<Message>Ecco il PDF da stampare: \*Menu Giorno\*\.[^<]*<\/Message><Message><Body><\/Body><Media>/)
  expect(media).toMatch(/^https:\/\/takoitalia\.com\/api\/public\/whatsapp-pdf\/menu-giorno\.pdf\?k=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  expect(res.body).not.toContain('\u0004')
  // Twilio scarica l'allegato
  const u=new URL(media!.replace(/&amp;/g,'&')),pdf=await a.inject({method:'GET',url:u.pathname+u.search})
expect(pdf.statusCode).toBe(200);expect(pdf.headers['content-type']).toContain('application/pdf');expect(pdf.rawPayload.subarray(0,5).toString()).toBe('%PDF-')
  const text=await pdfText(pdf.rawPayload)
  expect(text).toContain('Pasta al pomodoro');expect(text).toContain('Scaloppine al limone')
  expect(text).not.toContain('Gnocchi alla sorrentina');expect(text).not.toContain('Linguine allo scoglio')
  await a.close()})
 it('il PDF segue l ultima modifica pubblicata (stesso link, piatto nuovo)',async()=>{const a=await app()
  const media=(await post(a,'mandami il menu giorno')).body.match(/<Media>([^<]+)<\/Media>/)![1]!
  const raw=victoriaWithGiorno();raw.menus.find(m=>m.id===I.pranzo)!.sections[0]!.items.push({...raw.menus.find(m=>m.id===I.pranzo)!.sections[0]!.items[0]!,id:'00000000-0000-4000-8000-000000009999',name:'Lasagna della casa'});S.published=workspaceSchema.parse(raw)
  const u=new URL(media);expect(await pdfText((await a.inject({method:'GET',url:u.pathname+u.search})).rawPayload)).toContain('Lasagna della casa')
  await a.close()})
 it('con l accento («Mandami menù giorno», chat di Luisa) manda il PDF come senza',async()=>{const a=await app()
  for(const t of ['Mandami menù giorno','Mandami il menù giorno','Inviami il MENÙ GIORNO']){const res=await post(a,t);expect(res.body,t).toMatch(/Ecco il PDF da stampare: \*Menu Giorno\*/);expect(res.body,t).toContain('<Media>')}
  const ask=await post(a,'Mandami il menù');expect(ask.body).toContain('Quale menu ti mando in PDF?')
  await a.close()})
 it('«mandami il pdf» con più Menu chiede quale, senza allegato',async()=>{const a=await app()
  const res=await post(a,'mandami il pdf');expect(res.body).not.toContain('<Media>')
  expect(res.body).toContain('Quale menu ti mando in PDF?');expect(res.body).toMatch(/\d\. Menu Giorno/);expect(res.body).toMatch(/\d\. Alla carta/)
  await a.close()})
 it('«mandami il menu» chiede quale PDF; «mandami il link» dà il link del menu digitale',async()=>{const a=await app()
  const pdf=await post(a,'mandami il menu');expect(pdf.body).not.toContain('<Media>');expect(pdf.body).toContain('Quale menu ti mando in PDF?')
  const res=await post(a,'mandami il link');expect(res.body).not.toContain('<Media>');expect(res.body).toMatch(/takoitalia\.com\/r\//)
  await a.close()})
 it('link manomesso, scaduto o locale spento → 404',async()=>{const a=await app()
  const media=(await post(a,'mandami il menu giorno')).body.match(/<Media>([^<]+)<\/Media>/)![1]!,u=new URL(media),path=u.pathname+u.search
  expect((await a.inject({method:'GET',url:path.replace(/k=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-])/,'k=$1.x$2')})).statusCode).toBe(404)
  expect((await a.inject({method:'GET',url:path.replace('menu-giorno.pdf','x.exe')})).statusCode).toBe(404)
  expect((await a.inject({method:'GET',url:u.pathname})).statusCode).toBe(404)
  S.active=false;expect((await a.inject({method:'GET',url:path})).statusCode).toBe(404)
  const off=await post(a,'mandami il menu giorno');expect(off.body).not.toContain('<Media>');expect(off.body).toContain('Non riesco a preparare il PDF');S.active=true
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(Date.now()+7*60*60*1000);expect((await a.inject({method:'GET',url:path})).statusCode).toBe(404);vi.useRealTimers()
  await a.close()})
})
