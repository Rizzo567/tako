import{createRequire}from'node:module';import{createServer,type Server}from'node:http';import type{AddressInfo}from'node:net';import{afterAll,beforeAll,beforeEach,describe,expect,it,vi}from'vitest';import{twilioSignature,twiml}from'../apps/server/src/lib/twilio-menu-command.js';import{copy,alertCopy}from'../apps/server/src/lib/twilio-menu-copy.js';import{normalizeOwnerPhone}from'../apps/server/src/lib/whatsapp-phone.js';import{fill}from'../apps/server/src/lib/twilio-menu-copy.js';import bcrypt from'bcryptjs'
// Collegamento del titolare dalla dashboard + avvisi di guasto. DB in memoria che interpreta le sole query del modulo.
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',VIC='528e263c-634e-4695-9632-6c5cc6a3302f',OTHER='11111111-1111-4111-8111-111111111111'
const AGENCY='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',OWNER_QA='3af33a5e-8eb8-4f2e-a94d-acaf18b9dd9f',OWNER_OTHER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',EDITOR='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const MANUEL='whatsapp:+390000000098',ITEM='55555555-5555-4555-8555-555555555555'
type Link={restaurant_id:string,actor_id:string,activated_at:Date|null,created_at:Date,owner_email?:string|null,password_reissue?:boolean}
const names:Record<string,string>={[QA]:'Tako · Verifica web',[VIC]:'Victoria Bar',[OTHER]:'Altro locale'}
const users:Record<string,{restaurant_id:string,role:string,email?:string,phone?:string,active?:boolean,password_hash?:string,name?:string,delivered?:Date|null,last_login?:Date|null,sessions?:number}>={[AGENCY]:{restaurant_id:VIC,role:'owner',email:'agenzia@test.invalid'},[OWNER_QA]:{restaurant_id:QA,role:'owner',email:'owner-qa@test.invalid'},[OWNER_OTHER]:{restaurant_id:OTHER,role:'owner'},[EDITOR]:{restaurant_id:QA,role:'menu_editor'}}
const originalUsers=new Set(Object.keys(users)),usersInit=JSON.stringify(users);const db={sessionsDeleted:[] as string[],links:new Map<string,Link>(),proposals:new Map<string,{restaurant_id:string,actor_id:string,revision:number,command:any}>(),codes:new Map<string,{restaurant_id:string,actor_id:string}>(),messages:new Map<string,string>(),errors:[] as any[],alertAt:null as Date|null,forwarded:0,oneIndex:false}
const parse=(q:any)=>{let text='';const params:unknown[]=[];for(const c of q.queryChunks)if(c&&typeof c==='object'&&Array.isArray(c.value))text+=c.value.join('');else{text+='$';params.push(c)}return{text:text.replace(/\s+/g,' ').trim(),params}}
let tick=0;const linksOf=(r:string)=>[...db.links].filter(([,l])=>l.restaurant_id===r)
const execute=async(q:unknown):Promise<any[]>=>{const{text,params}=parse(q);const p=params as any[]
 if(text.includes('pg_advisory_xact_lock'))return[]
 if(text.startsWith('SELECT u.id,u.restaurant_id,u.role,r.active FROM users u')){const u=users[p[1]];return u&&names[p[0]]?[{id:p[1],restaurant_id:u.restaurant_id,role:u.role,active:true}]:[]}
 // 19/10: account titolare (whatsapp-owner-account.ts)
 if(text==='SELECT id,restaurant_id,role,active FROM users WHERE lower(email)=$')return Object.entries(users).filter(([,u])=>u.email===p[0]).map(([id,u])=>({id,restaurant_id:u.restaurant_id,role:u.role,active:u.active??true}))
 if(text==='SELECT id,restaurant_id,role,active,email FROM users WHERE id=$'){const u=users[p[0]];return u?[{id:p[0],restaurant_id:u.restaurant_id,role:u.role,active:u.active??true,email:u.email??p[0]+'@test.invalid'}]:[]}
 if(text.startsWith("SELECT id,restaurant_id,role,active,email FROM users WHERE restaurant_id=$ AND role='owner' AND active=true AND phone IN ($,$)"))return Object.entries(users).filter(([,u])=>u.restaurant_id===p[0]&&u.role==='owner'&&(u.active??true)&&!!u.phone&&[p[1],p[2]].includes(u.phone)).map(([id,u])=>({id,restaurant_id:u.restaurant_id,role:u.role,active:true,email:u.email}))
 if(text.startsWith('INSERT INTO users(id,restaurant_id,name,email,password_hash,role,phone,active,email_verified)')){if(Object.values(users).some(u=>u.email===p[3]))throw new Error('unique violation');users[p[0]]={restaurant_id:p[1],name:p[2],role:'owner',email:p[3],password_hash:p[4],phone:p[5],active:true};return[]}
 // 19/10 sera: consegna password, ricollegamento, collegamento al titolare
 if(text==='SELECT u.id,u.restaurant_id,u.role,u.active,u.password_delivered_at,u.last_login_at,EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=u.id) AS has_session FROM users u WHERE lower(u.email)=$')return Object.entries(users).filter(([,u])=>u.email===p[0]).map(([id,u])=>({id,restaurant_id:u.restaurant_id,role:u.role,active:u.active??true,password_delivered_at:u.delivered??null,last_login_at:u.last_login??null,has_session:(u.sessions??0)>0}))
 if(text==='SELECT password_delivered_at FROM users WHERE id=$'){const u=users[p[0]];return u?[{password_delivered_at:u.delivered??null}]:[]}
 if(text==='UPDATE users SET password_delivered_at=now() WHERE id=$'){const u=users[p[0]];if(u)u.delivered=new Date();return[]}
 if(text==='UPDATE tako_whatsapp_links SET actor_id=$ WHERE phone=$ AND restaurant_id=$'){const l=db.links.get(p[1]);if(l&&l.restaurant_id===p[2])l.actor_id=p[0];return[]}
 if(text==='UPDATE tako_whatsapp_links SET password_reissue=false WHERE phone=$ AND restaurant_id=$'){const l=db.links.get(p[0]);if(l&&l.restaurant_id===p[1])l.password_reissue=false;return[]}
 if(text==='SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=$ AND phone<>$')return linksOf(p[0]).filter(([k])=>k!==p[1]).map(([phone])=>({phone}))
 if(text.startsWith('UPDATE users SET password_hash=$')){const u=users[p[1]];if(!u||u.restaurant_id!==p[2]||u.role!=='owner')return[];u.password_hash=p[0];return[{id:p[1]}]}
 if(text==='DELETE FROM sessions WHERE user_id=$'){db.sessionsDeleted.push(p[0]);if(users[p[0]])users[p[0]]!.sessions=0;return[]}
 if(text==='DELETE FROM tako_whatsapp_messages WHERE sid=$'){db.messages.delete(p[0]);return[]}
 if(text.startsWith('SELECT role FROM web_location_memberships'))return[]
 if(text.startsWith('SELECT 1 FROM tako_whatsapp_links'))return db.links.has(p[0])?[{}]:[]
 if(text.startsWith('SELECT restaurant_id,actor_id,activated_at FROM tako_whatsapp_links')){const l=db.links.get(p[0]);return l?[{...l}]:[]}
 if(text==='SELECT phone,activated_at,owner_email FROM tako_whatsapp_links WHERE restaurant_id=$ ORDER BY created_at ASC'){const rows=linksOf(p[0]).sort((a,b)=>a[1].created_at.getTime()-b[1].created_at.getTime());return rows.map(([phone,l])=>({phone,owner_email:l.owner_email??null,activated_at:l.activated_at}))}
 // 21/10: due numeri per locale
 if(text==='SELECT phone,owner_email,actor_id FROM tako_whatsapp_links WHERE restaurant_id=$')return linksOf(p[0]).map(([phone,l])=>({phone,owner_email:l.owner_email??null,actor_id:l.actor_id}))
 if(text==='SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=$')return linksOf(p[0]).map(([phone])=>({phone}))
 if(text==='DELETE FROM tako_whatsapp_links WHERE phone=$'){db.links.delete(p[0]);return[]}
 if(text==='DELETE FROM tako_whatsapp_links WHERE phone=$ AND restaurant_id=$'){if(db.links.get(p[0])?.restaurant_id===p[1])db.links.delete(p[0]);return[]}
 if(text.startsWith('SELECT l.restaurant_id,l.activated_at,l.owner_email,r.name FROM tako_whatsapp_links')){const l=db.links.get(p[0]);return l?[{restaurant_id:l.restaurant_id,activated_at:l.activated_at,owner_email:l.owner_email??null,name:names[l.restaurant_id]}]:[]}
 if(text.startsWith('UPDATE tako_whatsapp_links SET activated_at=now()')){const l=db.links.get(p[0]);if(l&&!l.activated_at)l.activated_at=new Date();return[]}
 if(text==='DELETE FROM tako_whatsapp_links WHERE phone=$ OR restaurant_id=$'){db.links.delete(p[0]);for(const[k]of linksOf(p[1]))db.links.delete(k);return[]}
 if(text==='DELETE FROM tako_whatsapp_links WHERE restaurant_id=$ AND phone<>$'){for(const[k]of linksOf(p[0]))if(k!==p[1])db.links.delete(k);return[]}
 if(text==='DELETE FROM tako_whatsapp_links WHERE restaurant_id=$'){for(const[k]of linksOf(p[0]))db.links.delete(k);return[]}
 if(text.startsWith('INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at,owner_email,password_reissue) VALUES($,$,$,NULL,$,$)')){if(db.links.has(p[0]))throw new Error('unique violation');if(db.oneIndex&&linksOf(p[1]).length)throw Object.assign(new Error('duplicate key value violates unique constraint "tako_whatsapp_links_one_per_restaurant"'),{constraint_name:'tako_whatsapp_links_one_per_restaurant'});db.links.set(p[0],{restaurant_id:p[1],actor_id:p[2],activated_at:null,created_at:new Date(Date.now()+(++tick)),owner_email:p[3],password_reissue:p[4]});return[]}
 if(text==='UPDATE tako_whatsapp_links SET owner_email=$ WHERE phone=$'){const l=db.links.get(p[1]);if(l)l.owner_email=p[0];return[]}
 if(text==='SELECT owner_email,password_reissue FROM tako_whatsapp_links WHERE phone=$ AND restaurant_id=$'){const l=db.links.get(p[0]);return l&&l.restaurant_id===p[1]?[{owner_email:l.owner_email??null,password_reissue:l.password_reissue??false}]:[]}
 if(text.startsWith('INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at) VALUES($,$,$,now())')){db.links.set(p[0],{restaurant_id:p[1],actor_id:p[2],activated_at:new Date(),created_at:new Date(Date.now()+(++tick))});return[]}
 if(text==='DELETE FROM tako_whatsapp_proposals WHERE phone=$ OR phone IN (SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=$)'){db.proposals.delete(p[0]);for(const[k]of linksOf(p[1]))db.proposals.delete(k);return[]}
 if(text==='DELETE FROM tako_whatsapp_proposals WHERE phone IN (SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=$)'){for(const[k]of linksOf(p[0]))db.proposals.delete(k);return[]}
 if(text==='DELETE FROM tako_whatsapp_proposals WHERE phone=$'){db.proposals.delete(p[0]);return[]}
 if(text.startsWith('DELETE FROM tako_whatsapp_codes WHERE restaurant_id=$')){for(const[k,c]of db.codes)if(c.restaurant_id===p[0])db.codes.delete(k);return[]}
 if(text.startsWith('DELETE FROM tako_whatsapp_codes WHERE code_hash=$')){const c=db.codes.get(p[0]);db.codes.delete(p[0]);return c?[c]:[]}
 if(text.startsWith('SELECT 1 FROM tako_whatsapp_proposals'))return db.proposals.has(p[0])?[{}]:[]
 if(text.startsWith('SELECT command,revision FROM tako_whatsapp_proposals')){const x=db.proposals.get(p[0]);return x?[x]:[]}
 if(text.startsWith('INSERT INTO tako_whatsapp_proposals')){db.proposals.set(p[0],{restaurant_id:p[1],actor_id:p[2],revision:p[3],command:JSON.parse(p[4])});return[]}
 if(text.startsWith('SELECT response FROM tako_whatsapp_messages'))return db.messages.has(p[0])?[{response:db.messages.get(p[0])}]:[]
 if(text.startsWith('INSERT INTO tako_whatsapp_messages')){if(!db.messages.has(p[0])||text.includes('DO UPDATE'))db.messages.set(p[0],p[1]);return[]}
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
let groqContent='{"intent":"clarify","item_ids":[]}';let servers:Server[]=[],sent:Record<string,string>[]=[],twilioMode:'ok'|'fail'|'window'|'failpw'='ok',polls=0,groqHang=false
const listen=async(h:Parameters<typeof createServer>[1])=>{const s=createServer(h);servers.push(s);await new Promise<void>(r=>s.listen(0,'127.0.0.1',()=>r()));return`http://127.0.0.1:${(s.address() as AddressInfo).port}`}
const read=(req:any)=>new Promise<Buffer>(r=>{const c:Buffer[]=[];req.on('data',(d:Buffer)=>c.push(d));req.on('end',()=>r(Buffer.concat(c)))})
beforeAll(async()=>{const twilio=await listen(async(req,res)=>{const body=await read(req);if(req.method==='POST'&&req.url!.endsWith('/Messages.json')){const form=Object.fromEntries(new URLSearchParams(body.toString()));if((twilioMode==='fail'&&form.To!==MANUEL)||(twilioMode==='failpw'&&/Password: /.test(form.Body||''))){res.writeHead(500,{'Content-Type':'application/json'});return res.end('{"code":20500}')}sent.push(form);res.writeHead(201,{'Content-Type':'application/json'});return res.end(JSON.stringify({sid:'SM'+'f'.repeat(32),status:'queued'}))}
  if(req.method==='GET'&&/\/Messages\/SM[f]{32}\.json$/.test(req.url!)){polls++;res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(twilioMode==='window'?{status:'failed',error_code:63016}:{status:'sent',error_code:null}))}
  res.writeHead(404);res.end()})
 const groq=await listen(async(_req,res)=>{if(groqHang)return;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:groqContent}}],usage:{prompt_tokens:1,completion_tokens:1}}))})
 const menusmart=await listen((_q,res)=>{db.forwarded++;res.writeHead(200,{'Content-Type':'text/xml'});res.end('<Response><Message>MenuSmart</Message></Response>')})
 Object.assign(process.env,{TWILIO_AUTH_TOKEN:token,TWILIO_WEBHOOK_URL:self,TWILIO_ACCOUNT_SID:account,TWILIO_WHATSAPP_NUMBER:sender,TWILIO_API_BASE:twilio,GROQ_API_KEY:'k',GROQ_API_BASE:groq,MENUSMART_WHATSAPP_WEBHOOK_URL:menusmart,TAKOMENU_AGENCY_USER_IDS:AGENCY})})
afterAll(()=>{for(const s of servers){s.closeAllConnections();s.close()}})
beforeEach(()=>{db.links=new Map([[MANUEL,{restaurant_id:VIC,actor_id:AGENCY,activated_at:new Date('2026-10-14T17:26:14Z'),created_at:new Date('2026-10-14T17:26:14Z')}]]);db.proposals.clear();db.codes.clear();db.messages.clear();db.errors=[];db.alertAt=null;db.forwarded=0;db.oneIndex=false;db.sessionsDeleted=[];for(const id of Object.keys(users))if(!originalUsers.has(id))delete users[id];Object.assign(users,JSON.parse(usersInit));delete process.env.WEB_EMAIL_ENABLED;sent=[];groqContent='{"intent":"clarify","item_ids":[]}';process.env.TAKO_WHATSAPP_FOLLOWUP_DELAY_MS='0';twilioMode='ok';polls=0;groqHang=false;delete process.env.TAKO_WHATSAPP_JOB_TIMEOUT_MS})
let n=0;const sid=()=>'SM'+(++n).toString(16).padStart(32,'0')
const app=async()=>{const a=Fastify();await a.register(twilioMenuRoutes,{prefix:'/api'});return a}
const as=(user:string,tenant:string)=>({'x-test-user':user+'|'+tenant})
const get=(a:any,user:string,tenant:string)=>a.inject({method:'GET',url:'/api/menu-workspace/whatsapp/owner',headers:as(user,tenant)})
const defaultEmail=(phone:string)=>'t'+phone.replace(/\D/g,'')+'@test.invalid'
const save=(a:any,user:string,tenant:string,phone:string,move?:boolean,email:string|null=defaultEmail(phone))=>a.inject({method:'POST',url:'/api/menu-workspace/whatsapp/owner',headers:as(user,tenant),payload:{phone,...(email===null?{}:{email}),...(move===undefined?{}:{move})}})
const unlink=(a:any,user:string,tenant:string,phone?:string)=>a.inject({method:'DELETE',url:'/api/menu-workspace/whatsapp/owner'+(phone?'?phone='+encodeURIComponent(phone):''),headers:as(user,tenant)})
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
  // 19/10: dopo il benvenuto, due messaggi via REST: account creato con l'email del pannello (utente = email, password a tre parole)
  expect(sent.map(m=>m.To)).toEqual(['whatsapp:+390000000041','whatsapp:+390000000041']);expect(sent[0]!.Body).toContain('Utente: t390000000041@test.invalid');expect(sent[0]!.Body).toMatch(/Password: [a-z]+\.[a-z]+\.[a-z]+$/);expect(sent[1]!.Body).toContain('/r/'+QA+'/menu');sent=[]
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
 it('22/10: un locale ha al massimo tre telefoni: secondo e terzo si aggiungono, il quarto è rifiutato dal server; i rifiutati restano a MenuSmart',async()=>{const a=await app()
  await save(a,OWNER_QA,QA,'3330000043');await post(a,'whatsapp:+393330000043','ciao');db.proposals.set('whatsapp:+393330000043',{restaurant_id:QA,actor_id:OWNER_QA,revision:7,command:{kind:'batch',actions:[]}})
  const two=await save(a,OWNER_QA,QA,'3330000044');expect(two.statusCode).toBe(200);expect(two.json().data.numbers.map((n:any)=>[n.phone,n.status])).toEqual([['+393330000043','linked'],['+393330000044','pending']]);expect(two.json().data.max).toBe(3)
  expect(db.proposals.has('whatsapp:+393330000043')).toBe(true)
  const third=await save(a,OWNER_QA,QA,'3330000045');expect(third.statusCode).toBe(200);expect(third.json().data.numbers).toHaveLength(3)
  const fourth=await save(a,OWNER_QA,QA,'3330000046');expect(fourth.statusCode).toBe(409);expect(fourth.json().error).toMatchObject({code:'OWNER_PHONES_LIMIT',field:'phone'});expect(fourth.json().error.message).toContain('tre numeri')
  // anche un numero collegato altrove con move=true: prima il limite, niente spostamento
  const moving=await save(a,AGENCY,QA,'+390000000098',true);expect(moving.statusCode).toBe(409);expect(moving.json().error.code).toBe('OWNER_PHONES_LIMIT');expect(db.links.get(MANUEL)!.restaurant_id).toBe(VIC)
  expect(linksOf(QA).map(([k])=>k).sort()).toEqual(['whatsapp:+393330000043','whatsapp:+393330000044','whatsapp:+393330000045'])
  await post(a,'whatsapp:+393330000046','ciao');expect(db.forwarded).toBe(1)
  // risalvare lo stesso numero già collegato non lo rimette in attesa e non conta come terzo
  const again=await save(a,OWNER_QA,QA,'+39 333 000 0043',undefined,defaultEmail('3330000043'));expect(again.statusCode).toBe(200);expect(again.json().data.numbers[0].status).toBe('linked');await a.close()})
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
  const spoof=await a.inject({method:'POST',url:'/api/menu-workspace/whatsapp/owner',headers:{...as(OWNER_OTHER,QA),'x-test-role':'owner'},payload:{phone:'3330000048',email:'t3330000048@test.invalid'}});expect(spoof.statusCode).toBe(403);expect((await a.inject({method:'DELETE',url:'/api/menu-workspace/whatsapp/owner',headers:{...as(OWNER_OTHER,QA),'x-test-role':'owner'}})).statusCode).toBe(403)
  expect((await a.inject({method:'POST',url:'/api/menu-workspace/whatsapp/owner',payload:{phone:'3330000048',email:'t3330000048@test.invalid'}})).statusCode).toBe(401)
  expect((await save(a,OWNER_QA,QA,'123')).statusCode).toBe(400);expect((await save(a,OWNER_QA,QA,'+1 838 262 2788')).statusCode).toBe(400);expect(linksOf(QA)).toHaveLength(0)
  expect(db.links.get(MANUEL)).toMatchObject({restaurant_id:VIC,actor_id:AGENCY});expect((await get(a,AGENCY,VIC)).json().data).toMatchObject({phone:'+390000000098',status:'linked'});await a.close()})
 it('il collegamento con codice «collega tako …» resta funzionante e rispetta due telefoni per locale',async()=>{const a=await app();const{createHash}=await import('node:crypto');const code='d'.repeat(24);db.codes.set(createHash('sha256').update(code).digest('hex'),{restaurant_id:QA,actor_id:OWNER_QA})
  await save(a,OWNER_QA,QA,'3330000049');const w=await post(a,'whatsapp:+393330000050','collega tako '+code);expect(messages(w.body)[0]).toContain('il menu digitale di *Tako · Verifica web*')
  expect(linksOf(QA).map(([k,l])=>[k,!!l.activated_at]).sort()).toEqual([['whatsapp:+393330000049',false],['whatsapp:+393330000050',true]])
  // a 2 su 2 un altro codice non aggiunge un terzo numero
  const code2='e'.repeat(24);db.codes.set(createHash('sha256').update(code2).digest('hex'),{restaurant_id:QA,actor_id:OWNER_QA});const w2=await post(a,'whatsapp:+393330000053','collega tako '+code2);expect(messages(w2.body)).toEqual([copy.pairLimit]);expect(linksOf(QA)).toHaveLength(2);await a.close()})
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
  await save(a,OWNER_QA,QA,'3330000052');await post(a,'whatsapp:+393330000052','ciao');sent=[]
  await post(a,'whatsapp:+393330000052','boh vediamo un po domani');expect(sent.find(s=>s.To==='whatsapp:+393330000052')!.Body).toBe(copy.jobTimeout);expect(db.errors.map(e=>e.kind)).toContain('job_timeout');expect(sent.filter(s=>s.To===MANUEL)).toHaveLength(1)
  groqHang=false;twilioMode='fail';db.alertAt=null;await post(a,'whatsapp:+393330000052','boh vediamo un po domani sera');expect(db.errors.map(e=>e.kind)).toContain('send_failed');expect(sent.filter(s=>s.To===MANUEL)).toHaveLength(2);expect(sent.at(-1)!.Body).toContain('risposta non inviata dopo due tentativi');await a.close()},20000)
 it('TwiML: più messaggi nella stessa risposta',()=>{expect(twiml('a\u0002b')).toBe('<?xml version="1.0" encoding="UTF-8"?><Response><Message>a</Message><Message>b</Message></Response>')})
})

// 19/10 (decisione Manuel): email del titolare nel pannello; dopo il benvenuto, dashboard con credenziali (utente = email) e menu
// digitale; link su richiesta; nessuna gestione password in chat (si recupera dalla pagina di accesso).
describe('dashboard e menu digitale del titolare su WhatsApp',()=>{
 const dash='https://takoitalia.com/staff/',menuQA='https://takoitalia.com/r/'+QA+'/menu'
 const account=(email:string)=>Object.entries(users).find(([,u])=>u.email===email)
 const activate=async(a:any,local:string,email:string)=>{expect((await save(a,AGENCY,QA,local,undefined,email)).statusCode).toBe(200);const phone='whatsapp:'+normalizeOwnerPhone(local)!;const first=await post(a,phone,'ciao');return{phone,first}}
 it('pannello: email obbligatoria e valida, salvata col numero e restituita; un’email di un altro account è rifiutata',async()=>{const a=await app()
  expect((await save(a,OWNER_QA,QA,'3330000060',undefined,null)).statusCode).toBe(400);expect((await save(a,OWNER_QA,QA,'3330000060',undefined,'mario@')).statusCode).toBe(400);expect(linksOf(QA)).toHaveLength(0)
  const r=await save(a,OWNER_QA,QA,'3330000060',undefined,' Mario.Rossi@Example.com ');expect(r.statusCode).toBe(200);expect(r.json().data).toMatchObject({phone:'+393330000060',email:'mario.rossi@example.com',status:'pending'})
  for(const taken of['agenzia@test.invalid','altro@test.invalid']){users[OWNER_OTHER]!.email='altro@test.invalid';const x=await save(a,OWNER_QA,QA,'3330000060',undefined,taken);expect(x.statusCode).toBe(409);expect(x.json().error.code).toBe('EMAIL_IN_USE')}
  // stesso numero, email cambiata: aggiornata senza toccare lo stato
  expect((await save(a,OWNER_QA,QA,'3330000060',undefined,'nuova@example.com')).json().data).toMatchObject({email:'nuova@example.com',status:'pending'});delete users[OWNER_OTHER]!.email;await a.close()})
 it('primo messaggio: benvenuto, poi due messaggi separati e in ordine (credenziali con utente = email, menu); una sola volta; nel DB solo l’hash',async()=>{const a=await app()
  const{phone,first}=await activate(a,'3330000061','mario.rossi@example.com');const out=messages(first.body);expect(out).toHaveLength(1);expect(out[0]).toContain('menu digitale di *Tako · Verifica web*');expect(out[0]).not.toContain('Password')
  expect(sent.map(m=>m.To)).toEqual([phone,phone])
  const m=sent[0]!.Body!.match(/^La tua dashboard: https:\/\/takoitalia\.com\/staff\/\nUtente: mario\.rossi@example\.com\nPassword: ([a-z]+\.[a-z]+\.[a-z]+)$/);expect(m).not.toBeNull()
  expect(sent[1]!.Body).toBe(fill(copy.ownerMenu,{link:menuQA}))
  const[id,u]=account('mario.rossi@example.com')!;expect(id).not.toBe(AGENCY);expect(u).toMatchObject({restaurant_id:QA,role:'owner',phone:'+393330000061',active:true});expect(u.password_hash).not.toContain(m![1]);expect(await bcrypt.compare(m![1]!,u.password_hash!)).toBe(true)
  for(const v of db.messages.values())expect(v).not.toContain(m![1])
  await post(a,phone,'ciao');expect(sent).toHaveLength(2);expect(Object.values(users).filter(x=>x.email===u.email)).toHaveLength(1);await a.close()})
 it('email di un account titolare già esistente di questo locale: riusato, nessuna password nuova in chat',async()=>{const a=await app()
  users[OWNER_QA]!.last_login=new Date('2026-10-18T10:00:00Z')
  const{phone}=await activate(a,'3330000062','owner-qa@test.invalid');expect(sent[0]!.Body).toBe(fill(copy.dashboardLinkAgency,{link:dash,utente:'owner-qa@test.invalid'}));expect(users[OWNER_QA]!.password_hash).toBeUndefined()
  expect(users[OWNER_QA]!.delivered).toBeInstanceOf(Date);expect(db.links.get(phone)!.actor_id).toBe(OWNER_QA)
  expect(Object.values(users).filter(x=>x.email==='owner-qa@test.invalid')).toHaveLength(1);expect(phone).toBe('whatsapp:+393330000062');await a.close()})
 it('«dashboard», «ho perso la password» e «link del menu» in qualunque momento; niente password in chat; le frasi simili restano al bot',async()=>{const a=await app();const{phone}=await activate(a,'3330000063','anna@example.com');const hash0=account('anna@example.com')![1].password_hash;sent=[]
  // email spente (default in produzione oggi): il bot rimanda all'agenzia, mai al tasto «Password dimenticata»
  const dashReply=fill(copy.dashboardLinkAgency,{link:dash,utente:'anna@example.com'});expect(dashReply).toContain('Se perdi la password chiedi alla tua agenzia.');expect(dashReply).not.toContain('Password dimenticata')
  expect(messages((await post(a,phone,'mi mandi il link della dashboard?')).body)).toEqual([dashReply])
  expect(messages((await post(a,phone,'ho perso la password')).body)).toEqual([dashReply]);expect(messages((await post(a,phone,'conferma')).body).join()).not.toContain('Password:')
  expect(messages((await post(a,phone,'dove vedo il menu?')).body)).toEqual([fill(copy.menuLink,{link:menuQA})])
  expect(messages((await post(a,phone,'menu digitale')).body)).toEqual([fill(copy.menuLink,{link:menuQA})])
  for(const t of['il menu digitale è lento','metti sul menu la carbonara']){const r=messages((await post(a,phone,t)).body).join('\n');expect(r).not.toContain(menuQA);expect(r).not.toContain(dash)}
  expect(sent.every(m=>!/Password:/.test(m.Body!))).toBe(true);expect(account('anna@example.com')![1].password_hash).toBe(hash0);expect(db.sessionsDeleted).toEqual([]);await a.close()})
 it('voce del catalogo scelta dall’IA: il server mette il link vero del locale',async()=>{const a=await app();const{phone}=await activate(a,'3330000064','luca@example.com');sent=[]
  groqContent='{"intent":"capability","capability_ids":["menulink"]}';await post(a,phone,'e i clienti cosa guardano di preciso quando sono al tavolo');expect(sent.at(-1)!.Body).toBe(fill(copy.menuLink,{link:menuQA}))
  groqContent='{"intent":"capability","capability_ids":["dashboard"]}';await post(a,phone,'e per le cose che non fai tu dove le sistemo io di preciso');expect(sent.at(-1)!.Body).toBe(fill(copy.dashboardLinkAgency,{link:dash,utente:'luca@example.com'}))
  // email attive: torna il tasto «Password dimenticata»
  Object.assign(process.env,{WEB_EMAIL_ENABLED:'1',RESEND_API_KEY:'re_x',EMAIL_FROM:'a@b.it'});expect(messages((await post(a,phone,'dashboard')).body)).toEqual([fill(copy.dashboardLink,{link:dash,utente:'luca@example.com'})]);delete process.env.RESEND_API_KEY;delete process.env.EMAIL_FROM;await a.close()})
 it('isolamento: l’account vede solo il suo locale; mai l’account agenzia; email presa da un altro locale dopo il salvataggio → niente credenziali',async()=>{const a=await app();await activate(a,'3330000066','sara@example.com');const[id]=account('sara@example.com')!
  expect((await get(a,id,QA)).statusCode).toBe(200);expect((await get(a,id,OTHER)).statusCode).toBe(403);expect((await get(a,id,VIC)).statusCode).toBe(403)
  expect(users[AGENCY]!.password_hash).toBeUndefined()
  await save(a,AGENCY,QA,'3330000067',undefined,'conteso@example.com');const ALIEN='dddddddd-dddd-4ddd-8ddd-dddddddddddd';users[ALIEN]={restaurant_id:OTHER,role:'owner',email:'conteso@example.com',password_hash:'h0',active:true};sent=[]
  await post(a,'whatsapp:+393330000067','ciao');expect(sent[0]!.Body).toBe(fill(copy.dashboardNoAccount,{link:dash}));expect(sent.some(m=>/Password:/.test(m.Body!))).toBe(false)
  expect(messages((await post(a,'whatsapp:+393330000067','dashboard')).body)).toEqual([fill(copy.dashboardNoAccount,{link:dash})]);expect(users[ALIEN]!.password_hash).toBe('h0');expect(users[ALIEN]!.restaurant_id).toBe(OTHER);await a.close()})

 // 19/10 sera: revisioni v119
 const regen=(b:string)=>b.match(/Password: ([a-z]+\.[a-z]+\.[a-z]+)$/)?.[1]
 it('(1) account già esistente mai entrato: password rigenerata e mandata; sessioni chiuse; nome «Titolare di <locale>» per gli account nuovi',async()=>{const a=await app()
  const{phone}=await activate(a,'3330000070','owner-qa@test.invalid');const pw=regen(sent[0]!.Body!);expect(pw).toBeTruthy();expect(await bcrypt.compare(pw!,users[OWNER_QA]!.password_hash!)).toBe(true);expect(db.sessionsDeleted).toContain(OWNER_QA)
  expect(users[OWNER_QA]!.delivered).toBeInstanceOf(Date);sent=[]
  expect(messages((await post(a,phone,'dashboard')).body)).toEqual([fill(copy.dashboardLinkAgency,{link:dash,utente:'owner-qa@test.invalid'})]);expect(sent).toHaveLength(0)
  await activate(a,'3330000071','nuovo@example.com');expect(account('nuovo@example.com')![1].name).toBe('Titolare di Tako · Verifica web');await a.close()})
 it('(2) Twilio fallisce sulla password: il link del menu parte lo stesso; al prossimo «dashboard» password nuova; poi più nulla',async()=>{const a=await app();twilioMode='failpw'
  const{phone}=await activate(a,'3330000072','pia@example.com');expect(sent.map(m=>m.Body)).toEqual([fill(copy.ownerMenu,{link:menuQA})]);const[id,u]=account('pia@example.com')!;expect(u.delivered??null).toBeNull();expect(db.errors.map(e=>e.kind)).toContain('send_failed')
  const h1=u.password_hash;twilioMode='ok';sent=[]
  const r=await post(a,phone,'dashboard');expect(messages(r.body).join('')).not.toContain('Password:');expect(sent).toHaveLength(1);const pw=regen(sent[0]!.Body!)!;expect(pw).toBeTruthy();expect(users[id]!.password_hash).not.toBe(h1);expect(await bcrypt.compare(pw,users[id]!.password_hash!)).toBe(true);expect(users[id]!.delivered).toBeInstanceOf(Date)
  sent=[];expect(messages((await post(a,phone,'dashboard')).body)).toEqual([fill(copy.dashboardLinkAgency,{link:dash,utente:'pia@example.com'})]);expect(sent).toHaveLength(0);await a.close()})
 it('(5) scollega e ricollega con la stessa email: sessioni chiuse subito, password nuova al primo messaggio',async()=>{const a=await app()
  const{phone}=await activate(a,'3330000073','rino@example.com');const[id]=account('rino@example.com')!;const first=regen(sent[0]!.Body!)!;users[id]!.last_login=new Date();users[id]!.sessions=2;sent=[];db.sessionsDeleted=[]
  await unlink(a,AGENCY,QA);const again=await save(a,AGENCY,QA,'3330000073',undefined,'rino@example.com');expect(again.statusCode).toBe(200);expect(db.sessionsDeleted).toEqual([id]);expect(db.links.get(phone)!.password_reissue).toBe(true)
  await post(a,phone,'ciao');const second=regen(sent[0]!.Body!)!;expect(second).toBeTruthy();expect(second).not.toBe(first);expect(await bcrypt.compare(second,users[id]!.password_hash!)).toBe(true);expect(db.links.get(phone)!.password_reissue).toBe(false)
  sent=[];await post(a,phone,'dashboard');expect(sent).toHaveLength(0);await a.close()})
 it('(7) primo messaggio vocale/foto da numero in attesa: benvenuto, messaggi di accesso e poi il lavoro sul media',async()=>{const a=await app();await save(a,AGENCY,QA,'3330000074',undefined,'foto@example.com')
  const msid='MM'+'a'.repeat(32),form={AccountSid:'AC'+'2'.repeat(32),From:'whatsapp:+393330000074',To:sender,NumMedia:'1',MediaContentType0:'image/jpeg',MediaUrl0:process.env.TWILIO_API_BASE+'/media/x.jpg',MessageSid:msid,Body:'carbonara'}
  const r=await a.inject({method:'POST',url:'/api/whatsapp/twilio',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':twilioSignature(token,self,form)},payload:new URLSearchParams(form).toString()})
expect(messages(r.body)[0]).toContain('menu digitale di');await new Promise(r=>setTimeout(r,100))
  expect(sent.length).toBeGreaterThanOrEqual(3);expect(sent[0]!.Body).toMatch(/Password: /);expect(sent[1]!.Body).toContain('/r/'+QA+'/menu');expect(db.messages.has(msid+':media')).toBe(true);expect(db.messages.get(msid)).toContain('menu digitale di');await a.close()},20000)
 it('(8) pannello: email che il login rifiuta è rifiutata anche qui',async()=>{const a=await app()
  for(const bad of['mario..rossi@gmail.com','.mario@gmail.com','mario@gmail.c'])expect((await save(a,AGENCY,QA,'3330000075',undefined,bad)).statusCode).toBe(400);expect(linksOf(QA)).toHaveLength(0);await a.close()})
 it('(13) dopo la creazione dell’account il collegamento passa al titolare (actor_id), le azioni successive sono sue',async()=>{const a=await app()
  const{phone}=await activate(a,'3330000076','gino@example.com');const[id]=account('gino@example.com')!;expect(db.links.get(phone)!.actor_id).toBe(id)
  groqContent='{"intent":"clarify","item_ids":[]}';expect((await post(a,phone,'cosa sai fare')).statusCode).toBe(200);expect(db.links.get(phone)!.actor_id).toBe(id);await a.close()})
 it('(3)(21) numero sostituito nella risposta; email bloccata a collegamento attivo',async()=>{const a=await app()
  const{phone}=await activate(a,'3330000077','eva@example.com')
  const locked=await save(a,AGENCY,QA,'3330000077',undefined,'altra@example.com');expect(locked.statusCode).toBe(409);expect(locked.json().error).toMatchObject({code:'EMAIL_LOCKED',message:'Il titolare ha già l’accesso con eva@example.com. Per cambiarla scollega e ricollega.'});expect(db.links.get(phone)!.owner_email).toBe('eva@example.com')
  // 21/10: «Modifica» con un numero nuovo sostituisce solo quella riga
  const moved=await a.inject({method:'POST',url:'/api/menu-workspace/whatsapp/owner',headers:as(AGENCY,QA),payload:{phone:'3330000078',email:'eva@example.com',replace:'+393330000077'}});expect(moved.json().data).toMatchObject({phone:'+393330000078',replacedPhones:['+393330000077']})
  const added=await save(a,AGENCY,QA,'3330000079',undefined,'eva2@example.com');expect(added.json().data.replacedPhones).toEqual([]);expect(added.json().data.numbers.map((n:any)=>n.phone)).toEqual(['+393330000078','+393330000079']);await a.close()})
})

// 21/10 (richiesta Manuel): fino a due numeri per locale (22/10: tre), ognuno con la sua email e il suo account; sospesi, annulla e cronologia per numero.
describe('due numeri del titolare per locale',()=>{
 const A='whatsapp:+393330000081',B='whatsapp:+393330000082'
 const account=(email:string)=>Object.entries(users).find(([,u])=>u.email===email)
 const pending=(phone:string)=>db.proposals.set(phone,{restaurant_id:QA,actor_id:OWNER_QA,revision:7,command:{kind:'batch',actions:[]}})
 it('benvenuto e credenziali anche al secondo numero, con la SUA email e un account separato',async()=>{const a=await app()
  await save(a,AGENCY,QA,'3330000081',undefined,'primo@example.com');await post(a,A,'ciao');sent=[]
  expect((await save(a,AGENCY,QA,'3330000082',undefined,'secondo@example.com')).statusCode).toBe(200);expect(sent).toHaveLength(0)
  const first=await post(a,B,'ciao');expect(messages(first.body)[0]).toContain('menu digitale di *Tako · Verifica web*')
  expect(sent.map(m=>m.To)).toEqual([B,B]);expect(sent[0]!.Body).toContain('Utente: secondo@example.com');expect(sent[0]!.Body).toMatch(/Password: [a-z]+\.[a-z]+\.[a-z]+$/)
  const[idA]=account('primo@example.com')!,[idB]=account('secondo@example.com')!;expect(idA).not.toBe(idB);expect(db.links.get(A)!.actor_id).toBe(idA);expect(db.links.get(B)!.actor_id).toBe(idB)
  expect((await get(a,AGENCY,QA)).json().data.numbers).toMatchObject([{phone:'+393330000081',email:'primo@example.com',status:'linked'},{phone:'+393330000082',email:'secondo@example.com',status:'linked'}]);await a.close()})
 it('ogni numero ha la sua email: quella (o l’account) dell’altro numero è rifiutata',async()=>{const a=await app()
  await save(a,AGENCY,QA,'3330000081',undefined,'primo@example.com')
  const same=await save(a,AGENCY,QA,'3330000082',undefined,'PRIMO@example.com');expect(same.statusCode).toBe(409);expect(same.json().error).toMatchObject({code:'EMAIL_OTHER_NUMBER',field:'email'});expect(linksOf(QA)).toHaveLength(1)
  // account già agganciato al primo numero (collegamento di prima del 19/10 senza email): la sua email non va sul secondo
  db.links.set(A,{...db.links.get(A)!,actor_id:OWNER_QA,owner_email:null});const reused=await save(a,AGENCY,QA,'3330000082',undefined,'owner-qa@test.invalid');expect(reused.json().error.code).toBe('EMAIL_OTHER_NUMBER');await a.close()})
 it('proposte in sospeso e «annulla» valgono per il numero che le ha fatte',async()=>{const a=await app()
  await save(a,AGENCY,QA,'3330000081',undefined,'primo@example.com');await save(a,AGENCY,QA,'3330000082',undefined,'secondo@example.com');await post(a,A,'ciao');await post(a,B,'ciao');pending(A)
  // «ok» e «annulla» del secondo numero non toccano la proposta del primo
  await post(a,B,'ok');expect(db.proposals.has(A)).toBe(true)
  expect(messages((await post(a,B,'annulla')).body)).toEqual([copy.nothingToCancel]);expect(db.proposals.has(A)).toBe(true)
  // l'annullamento dell'ultima modifica è per telefono: il record di A non è visibile a B
  db.messages.set('undo:'+A,JSON.stringify({kind:'undo',at:Date.now(),items:[]}));await post(a,B,'torna come prima');expect(db.messages.has('undo:'+A)).toBe(true)
  const own=messages((await post(a,A,'annulla')).body).join('\n');expect(own).not.toBe(copy.nothingToCancel);expect(db.proposals.has(A)).toBe(false);await a.close()})
 it('scollega un numero: l’altro resta collegato con la sua proposta; senza indicare quale (due numeri) è rifiutato',async()=>{const a=await app()
  await save(a,AGENCY,QA,'3330000081',undefined,'primo@example.com');await save(a,AGENCY,QA,'3330000082',undefined,'secondo@example.com');await post(a,A,'ciao');await post(a,B,'ciao');pending(A);pending(B);db.codes.set('h',{restaurant_id:QA,actor_id:OWNER_QA})
  expect((await unlink(a,AGENCY,QA)).statusCode).toBe(400);expect(linksOf(QA)).toHaveLength(2)
  const r=await unlink(a,AGENCY,QA,'+39 333 000 0081');expect(r.statusCode).toBe(200);expect(r.json().data.numbers).toMatchObject([{phone:'+393330000082',status:'linked'}])
  expect(db.links.has(A)).toBe(false);expect(db.proposals.has(A)).toBe(false);expect(db.proposals.has(B)).toBe(true);expect(db.codes.size).toBe(1)
  await post(a,A,'ciao');expect(db.forwarded).toBe(1);expect(messages((await post(a,B,'cosa sai fare')).body)).toEqual([copy.help])
  // un numero di un altro locale non si scollega da qui
  await unlink(a,AGENCY,QA,'+390000000098');expect(db.links.get(MANUEL)!.restaurant_id).toBe(VIC)
  // a un solo numero il vecchio DELETE senza parametro funziona ancora
  expect((await unlink(a,AGENCY,QA)).json().data.numbers).toEqual([]);expect(db.codes.size).toBe(0);await a.close()})
 it('Modifica: il numero nuovo sostituisce solo quella riga; un numero già in elenco è rifiutato',async()=>{const a=await app()
  await save(a,AGENCY,QA,'3330000081',undefined,'primo@example.com');await save(a,AGENCY,QA,'3330000082',undefined,'secondo@example.com')
  const edit=(phone:string,replace:string,email:string)=>a.inject({method:'POST',url:'/api/menu-workspace/whatsapp/owner',headers:as(AGENCY,QA),payload:{phone,email,replace}})
  const dup=await edit('3330000082','+393330000081','primo@example.com');expect(dup.statusCode).toBe(409);expect(dup.json().error.code).toBe('PHONE_ALREADY_LISTED')
  const ok=await edit('3330000083','+393330000081','primo@example.com');expect(ok.statusCode).toBe(200);expect(ok.json().data.replacedPhones).toEqual(['+393330000081']);expect(ok.json().data.numbers.map((n:any)=>n.phone).sort()).toEqual(['+393330000082','+393330000083'])
  // a 2 su 2 la modifica non è un terzo numero
  expect((await edit('3330000084','+393330000083','primo@example.com')).statusCode).toBe(200);expect(linksOf(QA)).toHaveLength(2);await a.close()})
 it('DB senza la migrazione del 21/10: il secondo numero dà un errore chiaro e non tocca il primo',async()=>{const a=await app();db.oneIndex=true
  await save(a,AGENCY,QA,'3330000081',undefined,'primo@example.com');const r=await save(a,AGENCY,QA,'3330000082',undefined,'secondo@example.com');expect(r.statusCode).toBe(409);expect(r.json().error.code).toBe('SECOND_NUMBER_UNAVAILABLE');expect(linksOf(QA).map(([k])=>k)).toEqual([A]);await a.close()})
})
