import{createRequire}from'node:module';import{createServer,type Server}from'node:http';import type{AddressInfo}from'node:net';import{afterAll,beforeAll,beforeEach,describe,expect,it,vi}from'vitest';import{twilioSignature,twiml}from'../apps/server/src/lib/twilio-menu-command.js';import{copy,alertCopy}from'../apps/server/src/lib/twilio-menu-copy.js';import{normalizeOwnerPhone}from'../apps/server/src/lib/whatsapp-phone.js'
// Collegamento del titolare dalla dashboard + avvisi di guasto. DB in memoria che interpreta le sole query del modulo.
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',VIC='528e263c-634e-4695-9632-6c5cc6a3302f',OTHER='11111111-1111-4111-8111-111111111111'
const AGENCY='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',OWNER_QA='3af33a5e-8eb8-4f2e-a94d-acaf18b9dd9f',OWNER_OTHER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',EDITOR='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const MANUEL='whatsapp:+390000000098',ITEM='55555555-5555-4555-8555-555555555555'
type Link={restaurant_id:string,actor_id:string,activated_at:Date|null,created_at:Date}
const names:Record<string,string>={[QA]:'Tako · Verifica web',[VIC]:'Victoria Bar',[OTHER]:'Altro locale'}
const users:Record<string,{restaurant_id:string,role:string}>={[AGENCY]:{restaurant_id:VIC,role:'owner'},[OWNER_QA]:{restaurant_id:QA,role:'owner'},[OWNER_OTHER]:{restaurant_id:OTHER,role:'owner'},[EDITOR]:{restaurant_id:QA,role:'menu_editor'}}
const db={links:new Map<string,Link>(),proposals:new Map<string,{restaurant_id:string,actor_id:string,revision:number,command:any}>(),codes:new Map<string,{restaurant_id:string,actor_id:string}>(),messages:new Map<string,string>(),errors:[] as any[],alertAt:null as Date|null,forwarded:0}
const parse=(q:any)=>{let text='';const params:unknown[]=[];for(const c of q.queryChunks)if(c&&typeof c==='object'&&Array.isArray(c.value))text+=c.value.join('');else{text+='$';params.push(c)}return{text:text.replace(/\s+/g,' ').trim(),params}}
const linksOf=(r:string)=>[...db.links].filter(([,l])=>l.restaurant_id===r)
const execute=async(q:unknown):Promise<any[]>=>{const{text,params}=parse(q);const p=params as any[]
 if(text.includes('pg_advisory_xact_lock'))return[]
 if(text.startsWith('SELECT u.id,u.restaurant_id,u.role,r.active FROM users u')){const u=users[p[1]];return u&&names[p[0]]?[{id:p[1],restaurant_id:u.restaurant_id,role:u.role,active:true}]:[]}
 if(text.startsWith('SELECT role FROM web_location_memberships'))return[]
 if(text.startsWith('SELECT 1 FROM tako_whatsapp_links'))return db.links.has(p[0])?[{}]:[]
 if(text.startsWith('SELECT restaurant_id,actor_id,activated_at FROM tako_whatsapp_links')){const l=db.links.get(p[0]);return l?[{...l}]:[]}
 if(text.startsWith('SELECT phone,activated_at FROM tako_whatsapp_links')){const rows=linksOf(p[0]).sort((a,b)=>b[1].created_at.getTime()-a[1].created_at.getTime());return rows.slice(0,1).map(([phone,l])=>({phone,activated_at:l.activated_at}))}
 if(text.startsWith('SELECT l.restaurant_id,l.activated_at,r.name FROM tako_whatsapp_links')){const l=db.links.get(p[0]);return l?[{restaurant_id:l.restaurant_id,activated_at:l.activated_at,name:names[l.restaurant_id]}]:[]}
 if(text.startsWith('UPDATE tako_whatsapp_links SET activated_at=now()')){const l=db.links.get(p[0]);if(l&&!l.activated_at)l.activated_at=new Date();return[]}
 if(text==='DELETE FROM tako_whatsapp_links WHERE phone=$ OR restaurant_id=$'){db.links.delete(p[0]);for(const[k]of linksOf(p[1]))db.links.delete(k);return[]}
 if(text==='DELETE FROM tako_whatsapp_links WHERE restaurant_id=$ AND phone<>$'){for(const[k]of linksOf(p[0]))if(k!==p[1])db.links.delete(k);return[]}
 if(text==='DELETE FROM tako_whatsapp_links WHERE restaurant_id=$'){for(const[k]of linksOf(p[0]))db.links.delete(k);return[]}
 if(text.startsWith('INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at) VALUES($,$,$,NULL)')){if(db.links.has(p[0])||linksOf(p[1]).length)throw new Error('unique violation');db.links.set(p[0],{restaurant_id:p[1],actor_id:p[2],activated_at:null,created_at:new Date()});return[]}
 if(text.startsWith('INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at) VALUES($,$,$,now())')){if(linksOf(p[1]).some(([k])=>k!==p[0]))throw new Error('unique violation');db.links.set(p[0],{restaurant_id:p[1],actor_id:p[2],activated_at:new Date(),created_at:new Date()});return[]}
 if(text==='DELETE FROM tako_whatsapp_proposals WHERE phone=$ OR phone IN (SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=$)'){db.proposals.delete(p[0]);for(const[k]of linksOf(p[1]))db.proposals.delete(k);return[]}
 if(text==='DELETE FROM tako_whatsapp_proposals WHERE phone IN (SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=$)'){for(const[k]of linksOf(p[0]))db.proposals.delete(k);return[]}
 if(text==='DELETE FROM tako_whatsapp_proposals WHERE phone=$'){db.proposals.delete(p[0]);return[]}
 if(text.startsWith('DELETE FROM tako_whatsapp_codes WHERE restaurant_id=$')){for(const[k,c]of db.codes)if(c.restaurant_id===p[0])db.codes.delete(k);return[]}
 if(text.startsWith('DELETE FROM tako_whatsapp_codes WHERE code_hash=$')){const c=db.codes.get(p[0]);db.codes.delete(p[0]);return c?[c]:[]}
 if(text.startsWith('SELECT 1 FROM tako_whatsapp_proposals'))return db.proposals.has(p[0])?[{}]:[]
 if(text.startsWith('SELECT command,revision FROM tako_whatsapp_proposals')){const x=db.proposals.get(p[0]);return x?[x]:[]}
 if(text.startsWith('INSERT INTO tako_whatsapp_proposals')){db.proposals.set(p[0],{restaurant_id:p[1],actor_id:p[2],revision:p[3],command:JSON.parse(p[4])});return[]}
 if(text.startsWith('SELECT response FROM tako_whatsapp_messages'))return db.messages.has(p[0])?[{response:db.messages.get(p[0])}]:[]
 if(text.startsWith('INSERT INTO tako_whatsapp_messages')){if(!db.messages.has(p[0]))db.messages.set(p[0],p[1]);return[]}
 if(text.startsWith('UPDATE tako_whatsapp_messages')){db.messages.set(p[1],p[0]);return[]}
 if(text.startsWith('SELECT name FROM restaurants'))return[{name:names[p[0]]}]
 if(text.startsWith('SELECT settings FROM restaurants'))return[{settings:{timezone:'Europe/Rome'}}]
 if(text.startsWith('INSERT INTO tako_whatsapp_errors')){const row={id:db.errors.length+1,kind:p[0],restaurant_id:p[1],phone_tail:p[2],detail:p[3],alerted:p[4],at:Date.now()};db.errors.push(row);return[{id:row.id}]}
 if(text.startsWith('SELECT count(*)::int AS n FROM tako_whatsapp_errors'))return[{n:db.errors.filter(e=>!String(e.kind).startsWith('alert_')&&Date.now()-e.at<600000).length}]
 if(text.startsWith('UPDATE tako_whatsapp_errors SET alerted=true')){const e=db.errors.find(x=>x.id===p[0]);if(e)e.alerted=true;return[]}
 if(text.startsWith('INSERT INTO tako_whatsapp_alerts')){if(db.alertAt&&Date.now()-db.alertAt.getTime()<3600000)return[];db.alertAt=new Date();return[{channel:'guasti'}]}
 throw new Error('Unexpected SQL '+text.slice(0,90))}
vi.mock('../packages/db/src/index.ts',()=>({db:{execute:(q:unknown)=>execute(q),transaction:async(fn:any)=>{const snapshot={links:new Map([...db.links].map(([k,v])=>[k,{...v}])),proposals:new Map(db.proposals)};try{return await fn({execute})}catch(e){db.links=snapshot.links;db.proposals=snapshot.proposals;throw e}}},sessions:{},users:{}}))
vi.mock('../apps/server/src/middleware/auth.ts',()=>({requireRole:(...roles:string[])=>async(req:any,reply:any)=>{const[id,restaurantId]=String(req.headers['x-test-user']||'').split('|');const u=users[id!];if(!u)return reply.code(401).send({error:{code:'UNAUTHORIZED'}});const role=req.headers['x-test-role']||(id===AGENCY?'owner':u.restaurant_id===restaurantId?u.role:'none');if(!roles.includes(role))return reply.code(403).send({error:{code:'FORBIDDEN'}});req.user={id,restaurantId,role}}}))
const workspace=()=>({menus:[{id:'66666666-6666-4666-8666-666666666666',name:'Menu',sections:[{id:'77777777-7777-4777-8777-777777777777',name:'Piatti',items:[{id:ITEM,name:'Piatto di verifica',price:12}]}]}],design:{}})
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',()=>({readWorkspace:async()=>({draft:workspace(),published:workspace(),revision:7,published_revision:7}),mutateWorkspace:async()=>({revision:8})}))
import{twilioMenuRoutes}from'../apps/server/src/routes/twilio-menu.js'
import{reportFailure}from'../apps/server/src/lib/twilio-menu-alerts.js'
const Fastify=createRequire(new URL('../apps/server/package.json',import.meta.url))('fastify')
const token='owner-link-token',self='https://takoitalia.com/api/whatsapp/twilio',account='AC'+'2'.repeat(32),sender='whatsapp:+18382622788'
let servers:Server[]=[],sent:Record<string,string>[]=[],twilioMode:'ok'|'fail'|'window'='ok',polls=0,groqHang=false
const listen=async(h:Parameters<typeof createServer>[1])=>{const s=createServer(h);servers.push(s);await new Promise<void>(r=>s.listen(0,'127.0.0.1',()=>r()));return`http://127.0.0.1:${(s.address() as AddressInfo).port}`}
const read=(req:any)=>new Promise<Buffer>(r=>{const c:Buffer[]=[];req.on('data',(d:Buffer)=>c.push(d));req.on('end',()=>r(Buffer.concat(c)))})
beforeAll(async()=>{const twilio=await listen(async(req,res)=>{const body=await read(req);if(req.method==='POST'&&req.url!.endsWith('/Messages.json')){const form=Object.fromEntries(new URLSearchParams(body.toString()));if(twilioMode==='fail'&&form.To!==MANUEL){res.writeHead(500,{'Content-Type':'application/json'});return res.end('{"code":20500}')}sent.push(form);res.writeHead(201,{'Content-Type':'application/json'});return res.end(JSON.stringify({sid:'SM'+'f'.repeat(32),status:'queued'}))}
  if(req.method==='GET'&&/\/Messages\/SM[f]{32}\.json$/.test(req.url!)){polls++;res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(twilioMode==='window'?{status:'failed',error_code:63016}:{status:'sent',error_code:null}))}
  res.writeHead(404);res.end()})
 const groq=await listen(async(_req,res)=>{if(groqHang)return;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:'{"intent":"clarify","item_ids":[]}'}}],usage:{prompt_tokens:1,completion_tokens:1}}))})
 const menusmart=await listen((_q,res)=>{db.forwarded++;res.writeHead(200,{'Content-Type':'text/xml'});res.end('<Response><Message>MenuSmart</Message></Response>')})
 Object.assign(process.env,{TWILIO_AUTH_TOKEN:token,TWILIO_WEBHOOK_URL:self,TWILIO_ACCOUNT_SID:account,TWILIO_WHATSAPP_NUMBER:sender,TWILIO_API_BASE:twilio,GROQ_API_KEY:'k',GROQ_API_BASE:groq,MENUSMART_WHATSAPP_WEBHOOK_URL:menusmart,TAKOMENU_AGENCY_USER_IDS:AGENCY})})
afterAll(()=>{for(const s of servers){s.closeAllConnections();s.close()}})
beforeEach(()=>{db.links=new Map([[MANUEL,{restaurant_id:VIC,actor_id:AGENCY,activated_at:new Date('2026-10-14T17:26:14Z'),created_at:new Date('2026-10-14T17:26:14Z')}]]);db.proposals.clear();db.codes.clear();db.messages.clear();db.errors=[];db.alertAt=null;db.forwarded=0;sent=[];twilioMode='ok';polls=0;groqHang=false;delete process.env.TAKO_WHATSAPP_JOB_TIMEOUT_MS})
let n=0;const sid=()=>'SM'+(++n).toString(16).padStart(32,'0')
const app=async()=>{const a=Fastify();await a.register(twilioMenuRoutes,{prefix:'/api'});return a}
const as=(user:string,tenant:string)=>({'x-test-user':user+'|'+tenant})
const get=(a:any,user:string,tenant:string)=>a.inject({method:'GET',url:'/api/menu-workspace/whatsapp/owner',headers:as(user,tenant)})
const save=(a:any,user:string,tenant:string,phone:string,move?:boolean)=>a.inject({method:'POST',url:'/api/menu-workspace/whatsapp/owner',headers:as(user,tenant),payload:{phone,...(move===undefined?{}:{move})}})
const unlink=(a:any,user:string,tenant:string)=>a.inject({method:'DELETE',url:'/api/menu-workspace/whatsapp/owner',headers:as(user,tenant)})
const post=(a:any,from:string,body:string,signed=true)=>{const form={AccountSid:account,From:from,To:sender,NumMedia:'0',MessageSid:sid(),Body:body};return a.inject({method:'POST',url:'/api/whatsapp/twilio',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':signed?twilioSignature(token,self,form):'nope'},payload:new URLSearchParams(form).toString()})}
const messages=(xml:string)=>[...xml.matchAll(/<Message>([\s\S]*?)<\/Message>/g)].map(m=>m[1]!.replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'))

describe('numero del titolare: normalizzazione',()=>{
 it('accetta i formati comuni italiani e restituisce E.164',()=>{
  for(const raw of['333 177 0927','3331770927','+39 333 177 0927','+390000000098','0039 333 1770927','0039-333-177-0927','393331770927','(333) 177.09.27',' +39 333 1770927 ','whatsapp:+390000000098'])expect(normalizeOwnerPhone(raw)).toBe('+390000000098')
  expect(normalizeOwnerPhone('02 1234 5678')).toBe('+390212345678');expect(normalizeOwnerPhone('+390000000041')).toBe('+390000000041');expect(normalizeOwnerPhone('3931234567')).toBe('+393931234567');expect(normalizeOwnerPhone('+41 79 123 45 67')).toBe('+41791234567');expect(normalizeOwnerPhone('0041791234567')).toBe('+41791234567')
  for(const bad of['','abc','333','12345','+39 123 4567','33317709271234','+39333abc0927','1234567890',null,undefined,42,'+0 333'])expect(normalizeOwnerPhone(bad as any)).toBeNull()})
})
describe('collegamento del titolare dalla dashboard',()=>{
 it('pre-collegamento → primo messaggio → solo benvenuto (19/10) e stato Collegato; nessun messaggio in uscita al salvataggio',async()=>{const a=await app()
  expect((await get(a,OWNER_QA,QA)).json().data).toMatchObject({phone:null,status:null})
  const saved=await save(a,OWNER_QA,QA,'+39 000 000 0041');expect(saved.statusCode).toBe(200);expect(saved.json().data).toMatchObject({phone:'+390000000041',status:'pending'});expect(db.links.get('whatsapp:+390000000041')).toMatchObject({restaurant_id:QA,actor_id:OWNER_QA,activated_at:null});expect(sent).toHaveLength(0)
  const first=await post(a,'whatsapp:+390000000041','ciao');const out=messages(first.body);expect(out).toHaveLength(1);expect(out[0]).toContain('il menu digitale di *Tako · Verifica web*');expect(out[0]).toContain('🍝 «');
  const again=messages((await post(a,'whatsapp:+390000000041','ciao')).body).join('\n');expect(again).not.toContain('menu digitale di');expect(db.forwarded).toBe(0)
  expect((await get(a,OWNER_QA,QA)).json().data).toMatchObject({phone:'+390000000041',status:'linked'})
  expect(messages((await post(a,'whatsapp:+390000000041','cosa sai fare')).body)).toEqual([copy.help]);expect(db.forwarded).toBe(0);expect(sent).toHaveLength(0);await a.close()})
 it('qualsiasi primo messaggio attiva (non solo «ciao») e un messaggio ripetuto da Twilio non rimanda il benvenuto due volte',async()=>{const a=await app();await save(a,AGENCY,QA,'3330000041')
  const form={AccountSid:account,From:'whatsapp:+393330000041',To:sender,NumMedia:'0',MessageSid:sid(),Body:'la caprese costa 11'},headers={'content-type':'application/x-www-form-urlencoded','x-twilio-signature':twilioSignature(token,self,form)}
  const r1=await a.inject({method:'POST',url:'/api/whatsapp/twilio',headers,payload:new URLSearchParams(form).toString()}),r2=await a.inject({method:'POST',url:'/api/whatsapp/twilio',headers,payload:new URLSearchParams(form).toString()})
  expect(messages(r1.body)[0]).toContain('menu digitale di');expect(r2.body).toBe(r1.body);expect(db.links.get('whatsapp:+393330000041')!.activated_at).toBeInstanceOf(Date);expect(db.proposals.size).toBe(0);await a.close()})
 it('il router tratta il numero pre-collegato come Takomenu e inoltra a MenuSmart solo i numeri non collegati',async()=>{const a=await app();await save(a,OWNER_QA,QA,'3330000042')
  await post(a,'whatsapp:+393330000042','buongiorno');expect(db.forwarded).toBe(0)
  const other=await post(a,'whatsapp:+393499999999','ciao');expect(other.body).toBe('<Response><Message>MenuSmart</Message></Response>');expect(db.forwarded).toBe(1)
  expect((await post(a,'whatsapp:+393330000042','ciao',false)).statusCode).toBe(403);expect(db.forwarded).toBe(1);await a.close()})
 it('un locale ha un solo telefono: un numero nuovo sostituisce il precedente (collegato o in attesa) e ne cancella le proposte',async()=>{const a=await app()
  await save(a,OWNER_QA,QA,'3330000043');await post(a,'whatsapp:+393330000043','ciao');db.proposals.set('whatsapp:+393330000043',{restaurant_id:QA,actor_id:OWNER_QA,revision:7,command:{kind:'batch',actions:[]}})
  expect((await save(a,OWNER_QA,QA,'3330000044')).json().data).toMatchObject({phone:'+393330000044',status:'pending'});expect(db.links.has('whatsapp:+393330000043')).toBe(false);expect(db.proposals.has('whatsapp:+393330000043')).toBe(false)
  expect((await save(a,OWNER_QA,QA,'3330000045')).json().data).toMatchObject({phone:'+393330000045',status:'pending'});expect(linksOf(QA).map(([k])=>k)).toEqual(['whatsapp:+393330000045'])
  // il numero sostituito torna a MenuSmart
  await post(a,'whatsapp:+393330000043','ciao');expect(db.forwarded).toBe(1)
  // risalvare lo stesso numero già collegato non lo rimette in attesa
  await post(a,'whatsapp:+393330000045','ciao');expect((await save(a,OWNER_QA,QA,'+39 333 000 0045')).json().data.status).toBe('linked');await a.close()})
 it('un telefono ha un solo locale: se è collegato altrove chiede conferma e sposta solo con move=true e permesso su entrambi',async()=>{const a=await app()
  const conflict=await save(a,AGENCY,QA,'+390000000098');expect(conflict.statusCode).toBe(409);expect(conflict.json().error).toMatchObject({code:'PHONE_IN_USE_MOVABLE'});expect(conflict.json().error.message).toContain('Victoria Bar');expect(db.links.get(MANUEL)!.restaurant_id).toBe(VIC)
  // il titolare di un altro locale non vede il nome e non può spostarlo nemmeno con move=true
  const denied=await save(a,OWNER_QA,QA,'333 177 0927',true);expect(denied.statusCode).toBe(409);expect(denied.json().error.code).toBe('PHONE_IN_USE');expect(denied.json().error.message).not.toContain('Victoria');expect(db.links.get(MANUEL)!.restaurant_id).toBe(VIC)
  // l'agenzia con conferma: spostato, torna in attesa sul nuovo locale, proposte del numero cancellate
  db.proposals.set(MANUEL,{restaurant_id:VIC,actor_id:AGENCY,revision:7,command:{kind:'batch',actions:[]}})
  const moved=await save(a,AGENCY,QA,'333 177 0927',true);expect(moved.statusCode).toBe(200);expect(moved.json().data).toMatchObject({phone:'+390000000098',status:'pending'});expect(db.links.get(MANUEL)).toMatchObject({restaurant_id:QA,actor_id:AGENCY,activated_at:null});expect(db.proposals.has(MANUEL)).toBe(false)
  expect((await get(a,AGENCY,VIC)).json().data).toMatchObject({phone:null,status:null});await a.close()})
 it('Scollega rimuove collegamento e pre-collegamento e cancella le proposte in sospeso di quel numero',async()=>{const a=await app()
  await save(a,OWNER_QA,QA,'3330000046');expect((await unlink(a,OWNER_QA,QA)).json().data).toMatchObject({phone:null,status:null});expect(linksOf(QA)).toHaveLength(0)
  await save(a,OWNER_QA,QA,'3330000047');await post(a,'whatsapp:+393330000047','ciao');db.proposals.set('whatsapp:+393330000047',{restaurant_id:QA,actor_id:OWNER_QA,revision:7,command:{kind:'batch',actions:[]}});db.codes.set('h',{restaurant_id:QA,actor_id:OWNER_QA})
  await unlink(a,OWNER_QA,QA);expect(db.links.has('whatsapp:+393330000047')).toBe(false);expect(db.proposals.size).toBe(0);expect(db.codes.size).toBe(0)
  await post(a,'whatsapp:+393330000047','ciao');expect(db.forwarded).toBe(1);expect(db.links.get(MANUEL)!.restaurant_id).toBe(VIC);await a.close()})
 it('permessi verificati lato server: editor, titolare di un altro locale e non autenticati vengono respinti',async()=>{const a=await app()
  expect((await save(a,EDITOR,QA,'3330000048')).statusCode).toBe(403);expect((await get(a,EDITOR,QA)).statusCode).toBe(403);expect((await unlink(a,EDITOR,QA)).statusCode).toBe(403)
  expect((await save(a,OWNER_OTHER,QA,'3330000048')).statusCode).toBe(403)
  // sessione con ruolo owner sul QA ma senza titolarità reale (né agenzia né owner del locale): lo nega il controllo server
  const spoof=await a.inject({method:'POST',url:'/api/menu-workspace/whatsapp/owner',headers:{...as(OWNER_OTHER,QA),'x-test-role':'owner'},payload:{phone:'3330000048'}});expect(spoof.statusCode).toBe(403);expect((await a.inject({method:'DELETE',url:'/api/menu-workspace/whatsapp/owner',headers:{...as(OWNER_OTHER,QA),'x-test-role':'owner'}})).statusCode).toBe(403)
  expect((await a.inject({method:'POST',url:'/api/menu-workspace/whatsapp/owner',payload:{phone:'3330000048'}})).statusCode).toBe(401)
  expect((await save(a,OWNER_QA,QA,'123')).statusCode).toBe(400);expect((await save(a,OWNER_QA,QA,'+1 838 262 2788')).statusCode).toBe(400);expect(linksOf(QA)).toHaveLength(0)
  expect(db.links.get(MANUEL)).toMatchObject({restaurant_id:VIC,actor_id:AGENCY});expect((await get(a,AGENCY,VIC)).json().data).toMatchObject({phone:'+390000000098',status:'linked'});await a.close()})
 it('il collegamento con codice «collega tako …» resta funzionante e rispetta un telefono per locale',async()=>{const a=await app();const{createHash}=await import('node:crypto');const code='d'.repeat(24);db.codes.set(createHash('sha256').update(code).digest('hex'),{restaurant_id:QA,actor_id:OWNER_QA})
  await save(a,OWNER_QA,QA,'3330000049');const w=await post(a,'whatsapp:+393330000050','collega tako '+code);expect(messages(w.body)[0]).toContain('il menu digitale di *Tako · Verifica web*')
  expect(linksOf(QA).map(([k,l])=>[k,!!l.activated_at])).toEqual([['whatsapp:+393330000050',true]]);await a.close()})
})
describe('avvisi di guasto a Manuel',()=>{
 it('registra ogni errore e avvisa al massimo una volta all\'ora (claim atomico)',async()=>{
  const r1=await reportFailure({kind:'job_timeout',tenant:QA,phone:'whatsapp:+390000000041',detail:'text'},{pollMs:[1]});expect(r1).toEqual({recorded:true,alerted:true});expect(sent).toHaveLength(1);expect(sent[0]!.To).toBe(MANUEL)
  expect(sent[0]!.Body).toMatch(/^\*Problema WhatsApp Takomenu\*: richiesta senza risposta per tempo scaduto\.\nLocale: \*Tako · Verifica web\*\nOra: \d\d:\d\d$/);expect(sent[0]!.Body).not.toMatch(/0000000041|\+39/)
  const r2=await reportFailure({kind:'send_failed',tenant:QA},{pollMs:[1]});expect(r2).toEqual({recorded:true,alerted:false});expect(sent).toHaveLength(1)
  expect(db.errors.map(e=>[e.kind,e.alerted,e.phone_tail])).toEqual([['job_timeout',true,'041'],['send_failed',false,null]])
  db.alertAt=new Date(Date.now()-3600001);expect((await reportFailure({kind:'job_failed',tenant:VIC},{pollMs:[1]})).alerted).toBe(true);expect(sent[1]!.Body).toContain('Locale: *Victoria Bar*')})
 it('≥3 errori in 10 minuti fanno scattare l\'avviso anche se nessuno da solo lo farebbe',async()=>{
  await reportFailure({kind:'menusmart_forward'});await reportFailure({kind:'usage_record_failed'});expect(sent).toHaveLength(0)
  expect((await reportFailure({kind:'menusmart_forward'},{pollMs:[1]})).alerted).toBe(true);expect(sent[0]!.Body).toContain('3 errori negli ultimi 10 minuti');expect(sent[0]!.Body).toContain('Locale: *'+alertCopy.unknownPlace+'*')})
 it('fuori dalla finestra delle 24 h (63016) lo registra e non riprova',async()=>{twilioMode='window'
  const r=await reportFailure({kind:'job_failed',tenant:QA},{pollMs:[1,1,1]});expect(r.alerted).toBe(false);expect(polls).toBe(1);expect(sent).toHaveLength(1)
  expect(db.errors.at(-1)).toMatchObject({kind:'alert_undelivered'});expect(db.errors.at(-1).detail).toContain('63016');expect(db.errors.at(-1).detail).toContain('24 h')
  await reportFailure({kind:'job_failed',tenant:QA},{pollMs:[1]});expect(sent).toHaveLength(1)})
 it('flusso: guasto simulato del numero di prova sul QA → risposta di errore all\'utente, avviso «PROVA» registrato e inviato una sola volta',async()=>{const a=await app()
  await save(a,AGENCY,QA,'+390000000099');await post(a,'whatsapp:+390000000099','ciao')
  const r=await post(a,'whatsapp:+390000000099','Guasto di prova');expect(messages(r.body)).toEqual([copy.failed]);await new Promise(r=>setTimeout(r,50))
  expect(db.errors.map(e=>e.kind)).toContain('test_fault');expect(sent.filter(s=>s.To===MANUEL)).toHaveLength(1);expect(sent[0]!.Body).toMatch(/^\*Prova avviso Takomenu\*: nessun guasto reale\./)
  await post(a,'whatsapp:+390000000099','guasto di prova');await new Promise(r=>setTimeout(r,50));expect(sent.filter(s=>s.To===MANUEL)).toHaveLength(1);expect(db.errors.filter(e=>e.kind==='test_fault')).toHaveLength(2)
  // la stessa frase da un altro numero collegato non rompe nulla
  await save(a,OWNER_QA,QA,'3330000051');await post(a,'whatsapp:+393330000051','ciao');expect(messages((await post(a,'whatsapp:+393330000051','guasto di prova')).body)[0]).not.toBe(copy.failed);await a.close()})
 it('flusso: job in timeout → risposta di cortesia all\'utente e avviso; invio Twilio fallito dopo il retry → avviso send_failed',async()=>{const a=await app();process.env.TAKO_WHATSAPP_JOB_TIMEOUT_MS='150';groqHang=true
  await save(a,OWNER_QA,QA,'3330000052');await post(a,'whatsapp:+393330000052','ciao')
  await post(a,'whatsapp:+393330000052','boh vediamo un po domani');expect(sent.find(s=>s.To==='whatsapp:+393330000052')!.Body).toBe(copy.jobTimeout);expect(db.errors.map(e=>e.kind)).toContain('job_timeout');expect(sent.filter(s=>s.To===MANUEL)).toHaveLength(1)
  groqHang=false;twilioMode='fail';db.alertAt=null;await post(a,'whatsapp:+393330000052','boh vediamo un po domani sera');expect(db.errors.map(e=>e.kind)).toContain('send_failed');expect(sent.filter(s=>s.To===MANUEL)).toHaveLength(2);expect(sent.at(-1)!.Body).toContain('risposta non inviata dopo due tentativi');await a.close()},20000)
 it('TwiML: più messaggi nella stessa risposta',()=>{expect(twiml('a\u0002b')).toBe('<?xml version="1.0" encoding="UTF-8"?><Response><Message>a</Message><Message>b</Message></Response>')})
})
