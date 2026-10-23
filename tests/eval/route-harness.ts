// Adattatore «percorso vero del route» per il banco E, come le batterie owner-bot-adversarial: webhook firmato vero
// (router + NLU + validatori + IA del bot), DB e documento menu IN MEMORIA, Twilio/Whisper finti, Groq in record/replay.
// I vi.mock vanno dichiarati nel file di test (sono «hoisted» solo lì): vedi eval-current.test.ts. Questo modulo non importa
// staticamente nulla del server, così i mock sono già attivi quando il route viene caricato.
import {vi} from 'vitest'
import type {BotRun,BotUnderTest,Conversation,EvalMenu,TurnResult,Turn} from './types.js'
import type {Groq} from './groq-cache.js'
import type {Anthropic} from './anthropic-cache.js'

export const BASE_TIME=process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z' // venerdì 16/10/2026 12:00 a Roma, come le batterie
export const tenant='26050ecd-2e55-4057-a4c5-bff2b449cd47',actor='44444444-4444-4444-8444-444444444444',phone='whatsapp:+390000000077'
type Proposal={revision:number,command:any,exp:number}
export const S={draft:null as any,published:null as any,revision:5,published_revision:5,proposals:new Map<string,Proposal>(),messages:new Map<string,string>(),versions:[] as {revision:number,label:string,snapshot:any}[],unknownSql:new Set<string>(),restaurant:'Trattoria',settings:{timezone:'Europe/Rome'} as Record<string,unknown>,extraSql:null as null|((text:string,params:unknown[])=>any[]|undefined)}

const parse=(q:any)=>{let text='';const params:unknown[]=[];for(const c of q.queryChunks)if(c&&typeof c==='object'&&Array.isArray(c.value))text+=c.value.join('');else{text+='$';params.push(c)}return{text,params}}
const live=(ph:string)=>{const x=S.proposals.get(ph);return x&&x.exp>Date.now()?x:undefined}
export async function execute(q:unknown):Promise<any[]>{const {text,params}=parse(q),p=params as any[]
 if(S.extraSql){const r=S.extraSql(text,p);if(r!==undefined)return r}
 if(text.startsWith('SELECT 1 FROM tako_whatsapp_links'))return p[0]===phone?[{}]:[]
 if(text.startsWith('SELECT restaurant_id,actor_id,activated_at FROM tako_whatsapp_links'))return p[0]===phone?[{restaurant_id:tenant,actor_id:actor,activated_at:new Date()}]:[]
 if(text.includes('FROM users u'))return[{id:p[1],restaurant_id:p[0],role:'owner',active:true}]
 if(text.includes('pg_advisory_xact_lock'))return[]
 if(text.startsWith('SELECT response FROM tako_whatsapp_messages'))return S.messages.has(p[0])?[{response:S.messages.get(p[0])}]:[]
 if(text.startsWith('INSERT INTO tako_whatsapp_messages')){if(!S.messages.has(p[0]))S.messages.set(p[0],p[1]);return[]}
 if(text.startsWith('UPDATE tako_whatsapp_messages')){S.messages.set(p[1],p[0]);return[]}
 if(text.startsWith('SELECT settings FROM restaurants'))return[{settings:structuredClone(S.settings)}]
 if(text.startsWith('SELECT name FROM restaurants'))return[{name:S.restaurant}]
 if(text.startsWith('DELETE FROM tako_whatsapp_proposals')){S.proposals.delete(p[0]);return[]}
 if(text.startsWith('SELECT 1 FROM tako_whatsapp_proposals'))return live(p[0])?[{}]:[]
 if(text.startsWith('SELECT command,revision FROM tako_whatsapp_proposals')){const x=live(p[0]);return x?[structuredClone(x)]:[]}
 if(text.startsWith('SELECT command FROM tako_whatsapp_proposals')){const x=live(p[0]);return x?[{command:structuredClone(x.command)}]:[]}
 if(text.startsWith('UPDATE tako_whatsapp_proposals SET command')){const x=S.proposals.get(p[1]);if(x)x.command=JSON.parse(p[0]);return[]}
 if(text.startsWith('INSERT INTO tako_whatsapp_proposals')){const mins=Number(text.match(/interval '(\d+) minutes'/)?.[1]??10);S.proposals.set(p[0],{revision:p[3],command:JSON.parse(p[4]),exp:Date.now()+mins*60000});return[]}
 // 23/10: lessico del locale (dish-lexicon.ts) = nomi dei piatti delle ultime 25 versioni
 if(text.includes('FROM menu_workspace_versions')&&text.includes('jsonb_path_query'))return [...new Set(S.versions.slice(-25).flatMap((v:any)=>(v.snapshot?.menus??[]).flatMap((m:any)=>(m.sections??[]).flatMap((x:any)=>(x.items??[]).map((i:any)=>String(i.name))))))].map(n=>({n}))
 if(text.startsWith('SET LOCAL statement_timeout'))return[]
 if(text.startsWith('SELECT revision,label,snapshot FROM menu_workspace_versions')){const pre=[String(p[1]).replace('%',''),String(p[2]).replace('%','')];return S.versions.filter(v=>pre.some(x=>v.label.startsWith(x))).sort((a,b)=>b.revision-a.revision).slice(0,1).map(v=>structuredClone(v))}
 if(text.startsWith('INSERT INTO tako_whatsapp_ai_usage'))return[{requests:1,prompt_tokens:0,completion_tokens:0,audio_seconds:0,warned_at:null}]
 if(text.startsWith('INSERT INTO tako_whatsapp_errors'))return[{id:1}]
 if(text.startsWith('SELECT count(*)::int AS n FROM tako_whatsapp_errors'))return[{n:0}]
 if(text.startsWith('INSERT INTO tako_whatsapp_alerts'))return[]
 S.unknownSql.add(text.slice(0,120));return[]}
export const dbMock={db:{execute:(q:unknown)=>execute(q),transaction:(fn:any)=>fn({execute})},sessions:{},users:{}}
export const storeMock={
 readWorkspace:async()=>({draft:structuredClone(S.draft),published:structuredClone(S.published),revision:S.revision,published_revision:S.published_revision}),
 mutateWorkspace:async(_t:string,_a:string,expected:number,w:any,publish:boolean,label='')=>{S.versions.push({revision:S.revision+1,label,snapshot:structuredClone(publish?S.draft:w)});if(expected!==S.revision)throw new Error('Revision conflict');if(publish)S.published=structuredClone(S.draft);else S.draft=structuredClone(w);S.revision++;if(publish)S.published_revision=S.revision;return{revision:S.revision}}}
export const onboardingMock={expiredOnboardingNotice:async()=>null,startsOnboarding:()=>false,onboardingTransport:async()=>null,queueOnboardingChat:async()=>false}

// ---------------- Rete finta ----------------
// groqChat (V4, motore Haiku 21/10): richieste a .../chat/completions. In un giro Haiku (anthropic installato) ognuna è vietata:
// si risponde 503 senza rete e il runner la conta come errore del caso. Whisper (/audio/transcriptions) resta ammesso.
const net={transcript:'',sent:[] as string[],llm:{calls:0,tokens:0,misses:0,ms:0},groqChat:0}
let groq:Groq|null=null,anth:Anthropic|null=null
export const netStats=()=>({groqChat:net.groqChat})
export function installNet(g:Groq|null,realFetch:typeof fetch,a:Anthropic|null=null){groq=g;anth=a
 vi.stubGlobal('fetch',async(url:any,init:any)=>{const u=String(url)
  if(u.startsWith('https://api.anthropic.com/')){if(!anth)throw new Error('eval: rete vera non ammessa: '+u.slice(0,60));const r=await anth.handle(u,init);if(r.miss||r.refused)net.llm.misses++;else net.llm.calls++;net.llm.tokens+=r.tokens;net.llm.ms+=r.ms;return r.response}
  if(u.includes('/chat/completions')){net.groqChat++
   if(anth||!groq)return new Response(JSON.stringify({error:{message:'eval: Groq chat vietato con il motore Haiku (V4)'}}),{status:503,headers:{'Content-Type':'application/json'}})
   const r=await groq.handle(u,init);if(r.miss)net.llm.misses++;else net.llm.calls++;net.llm.tokens+=r.tokens;net.llm.ms+=r.ms;return r.response}
  if(u.includes('/audio/transcriptions'))return new Response(JSON.stringify({text:net.transcript,duration:5}),{status:200,headers:{'Content-Type':'application/json'}})
  if(u.endsWith('/Messages.json')){net.sent.push(new URLSearchParams(String(init.body)).get('Body')!);return new Response('{}',{status:201,headers:{'Content-Type':'application/json'}})}
  if(u.includes('/Media/'))return new Response(new Uint8Array([79,103,103,83]),{status:200,headers:{'Content-Type':'audio/ogg'}})
  if(u.includes('api.groq.com')||u.includes('twilio.com'))throw new Error('eval: rete vera non ammessa: '+u.slice(0,60))
  return realFetch(url,init)})}

const token='eval-token',self='https://takoitalia.com/api/whatsapp/twilio',account='AC'+'3'.repeat(32),sender='whatsapp:+18382622788'
let n=0;const sid=(p='SM')=>p+(++n).toString(16).padStart(32,'0')
const unxml=(s:string)=>s.replace(/<\/Message><Message>/g,'\n').replace(/<[^>]+>/g,'').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')

let app:any=null,sign:any=null
async function boot(){if(app)return app
 Object.assign(process.env,{TWILIO_AUTH_TOKEN:token,TWILIO_WEBHOOK_URL:self,TWILIO_ACCOUNT_SID:account,TWILIO_WHATSAPP_NUMBER:sender,GROQ_API_KEY:'eval-key'})
 delete process.env.GROQ_API_BASE;delete process.env.TWILIO_API_BASE;delete process.env.TAKO_WHATSAPP_ONBOARDING_ENABLED
 // Motore Haiku (V4): TAKO_EVAL_NO_GROQ_KEY=1 toglie GROQ_API_KEY per provare che i turni scritti non ne hanno bisogno (i vocali sì: Whisper).
 if(process.env.TAKO_EVAL_NO_GROQ_KEY==='1')delete process.env.GROQ_API_KEY
 const {createRequire}=await import('node:module'),{twilioMenuRoutes}=await import('../../apps/server/src/routes/twilio-menu.js'),{twilioSignature}=await import('../../apps/server/src/lib/twilio-menu-command.js')
 const {setTranslationEnqueue}=await import('../../apps/server/src/lib/menu-translation-queue.js'),{setMenuPresetTarget}=await import('../../apps/server/src/lib/menu-preset-target.js')
 setTranslationEnqueue(async()=>{});setMenuPresetTarget({enabled:async()=>false,save:async()=>({label:'x'})} as any);sign=twilioSignature
 const Fastify=createRequire(new URL('../../apps/server/package.json',import.meta.url))('fastify');app=Fastify();await app.register(twilioMenuRoutes,{prefix:'/api'});await app.ready();return app}
export async function closeHarness(){await app?.close();app=null;vi.unstubAllGlobals()}
async function post(fields:Record<string,string>){const form={AccountSid:account,From:phone,To:sender,NumMedia:'0',...fields};return app.inject({method:'POST',url:'/api/whatsapp/twilio',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(token,self,form)},payload:new URLSearchParams(form).toString()})}

/** Bot attuale (o un bot dietro l'interruttore settings.botBrain) attraverso il route vero. */
/** `afterTurn` (21/10 sera, test di proprietà): chiamato dopo ogni turno col comando in sospeso nel DB finto. */
export function createRouteBot(o:{name:string,settings?:Record<string,unknown>,extraSql?:(text:string,params:unknown[])=>any[]|undefined,afterTurn?:(i:number,pending:any)=>void}):BotUnderTest{
 return{name:o.name,ready:true,async run(conv:Conversation,menu:EvalMenu,ctx:{restaurant:string}):Promise<BotRun>{
  const a=await boot(),{workspaceSchema}=await import('../../apps/server/src/lib/menu-workspace-contract.js')
  const doc=workspaceSchema.parse(structuredClone(menu))
  vi.setSystemTime(new Date(BASE_TIME));S.draft=structuredClone(doc);S.published=structuredClone(doc);S.revision=5;S.published_revision=5;S.proposals.clear();S.messages.clear();S.versions=[]
  S.restaurant=ctx.restaurant;S.settings={timezone:'Europe/Rome',botEngine:'groq'/* run Haiku 21/10: il default del codice è haiku; i giri storici restano su Groq */,...(o.settings??{})};S.extraSql=o.extraSql??null;groq?.setConversation(conv);anth?.setConversation(conv)
  await groq?.pace()
  const turns:TurnResult[]=[]
  for(const t of conv.turns as Turn[]){
   if('wait' in t){vi.setSystemTime(new Date(Date.now()+t.wait*60000));continue}
   if('dash' in t){const w=structuredClone(S.published);for(const m of w.menus)for(const s of m.sections)for(const i of s.items)if(i.name===t.dash.dish)(i as any)[t.dash.field]=t.dash.value;S.draft=w;S.published=structuredClone(w);S.revision++;S.published_revision=S.revision;continue}
   const before=net.sent.length,llm0={...net.llm},g0=net.groqChat,t0=performance.now();let reply=''
   try{if('text' in t){const res=await post({MessageSid:sid(),Body:t.text});reply=unxml(res.body).trim()}
    else{net.transcript=t.voice;const s=sid('MM');const res=await post({MessageSid:s,Body:'',NumMedia:'1',MediaContentType0:'audio/ogg',MediaUrl0:`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages/${s}/Media/ME1`});reply=unxml(res.body).trim()}}catch(e){reply='';if(process.env.TAKO_BRAIN_DEBUG)(await import('node:fs')).appendFileSync(process.env.TAKO_BRAIN_DEBUG,'HARNESS-ERR '+String((e as any)?.stack??e).slice(0,600)+'\n')}
   reply=(reply+'\n'+net.sent.slice(before).join('\n')).trim()
   turns.push({reply,menuAfter:structuredClone(S.published),latencyMs:Math.round((performance.now()-t0)*10)/10,llm:{calls:net.llm.calls-llm0.calls,tokens:net.llm.tokens-llm0.tokens,misses:net.llm.misses-llm0.misses,recordedMs:net.llm.ms-llm0.ms},...({groqChat:net.groqChat-g0} as {})})
   o.afterTurn?.(turns.length-1,structuredClone(S.proposals.get(phone)?.command??null))
   // Il bot lavora a tempo «fermo»: ogni messaggio arriva qualche secondo dopo il precedente.
   vi.setSystemTime(new Date(Date.now()+20000))}
  return{turns,finalMenu:structuredClone(S.published),pending:S.proposals.get(phone)?.command}}}}
