// Temporary mutations exclusively on the explicitly named QA restaurant; never creates a customer account.
import fs from 'node:fs';import {parseEnv} from 'node:util';import {randomBytes} from 'node:crypto';
import postgres from '../../apps/server/node_modules/postgres/src/index.js';import bcrypt from '../../apps/server/node_modules/bcryptjs/index.js';
const base=process.env.HOME+'/.config/tako-webapp/',dir=base+'email-automation-20261019/',config=parseEnv(fs.readFileSync(base+'candidate.env','utf8'));
const db=postgres(config.TAKO_CANDIDATE_DATABASE_URL,{ssl:{ca:config.TAKO_CANDIDATE_DATABASE_CA_CERT},max:1});
const oldAddress=process.env.TAKOMENU_QA_EMAIL,newAddress=process.env.TAKOMENU_QA_NEW_EMAIL;
let state;const stateFile=dir+'qa-state.json',phase=process.argv[2];
if(phase!=='restore'&&(!oldAddress?.includes('@')||!newAddress?.includes('@')))throw Error('Configure two QA inbox aliases you control; never customer addresses');
const save=()=>fs.writeFileSync(stateFile,JSON.stringify(state),{mode:0o600});
async function api(path,body,authenticated=true){const r=await fetch('https://takoitalia.com/api/'+path,{method:body?'POST':'GET',headers:{Origin:'https://takoitalia.com','Content-Type':'application/json',...(authenticated&&state?.cookie?{Cookie:state.cookie}:{})},body:body?JSON.stringify(body):undefined});const text=await r.text();let json;try{json=JSON.parse(text)}catch{json={error:{message:'Non-JSON response'}}}return {status:r.status,json,cookie:(r.headers.getSetCookie?.()||[]).map(x=>x.split(';')[0]).join('; ')};}
async function login(email,password){const r=await api('auth/login',{email,password},false);if(r.status!==200||!r.cookie)throw Error('QA login failed '+r.status);state.cookie=r.cookie;save();return r;}
try{
 if(phase==='prepare'){
  if(fs.existsSync(stateFile))throw Error('QA state exists; restore before another run');
  const rows=await db`select u.*,r.slug as qa_slug from users u join restaurants r on r.id=u.restaurant_id where r.slug='qa-web-verifica' and r.name='Tako · Verifica web' and u.role='owner' and u.active=true`;
  if(rows.length!==1)throw Error('QA identity ambiguous');
  state={original:rows[0],qaEmailOld:oldAddress,qaEmailNew:newAddress,password:randomBytes(24).toString('base64url'),cookie:null,qaPhone:null};save();
  await db`update users set email=${oldAddress},password_hash=${await bcrypt.hash(state.password,12)},local_owner_secret_hash=null where id=${state.original.id}`;
  await login(oldAddress,state.password);
  const bad=await api('web-accounts/email/request',{email:newAddress,currentPassword:'wrong-synthetic-password'});
  if(bad.status!==400)throw Error('Wrong password not rejected');
  const requested=await api('web-accounts/email/request',{email:newAddress,currentPassword:state.password});
  if(requested.status!==200)throw Error('Email request failed '+requested.status+' '+JSON.stringify(requested.json));
  const [user]=await db`select email from users where id=${state.original.id}`;
  if(user.email!==oldAddress)throw Error('Email changed before confirmation');
  console.log(JSON.stringify({phase,wrongPasswordRejected:true,requestStatus:200,oldEmailPreserved:true}));
 }else{
  state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
  if(phase==='confirm'){
   const token=fs.readFileSync(dir+'qa-confirm-token.txt','utf8').trim();
   const [before]=await db`select email from users where id=${state.original.id}`;
   const scanner=await fetch('https://takoitalia.com/api/web-accounts/email/confirm?token='+token);if(scanner.status!==200)throw Error('Confirmation page unavailable');
   const [afterGet]=await db`select email from users where id=${state.original.id}`;if(afterGet.email!==before.email)throw Error('GET consumed token');
   const invalid=await api('web-accounts/email/confirm',{token:'invalid-token-'.repeat(4)},false);if(invalid.status!==400)throw Error('Invalid token accepted');
   const results=await Promise.all([api('web-accounts/email/confirm',{token},false),api('web-accounts/email/confirm',{token},false)]);
   const statuses=results.map(x=>x.status).sort();if(statuses.join(',')!=='200,400')throw Error('Confirmation single-use failed '+statuses);
   const stale=await api('web-accounts/email/status');if(stale.status!==401)throw Error('Old session not revoked');
   await login(newAddress,state.password);
   const [updated]=await db`select email,email_verified from users where id=${state.original.id}`;
   if(updated.email!==newAddress||!updated.email_verified)throw Error('Confirmation state wrong');
   const pending=await api('web-accounts/email/request',{email:oldAddress,currentPassword:state.password});if(pending.status!==200)throw Error('Pending second request failed');
   const newPassword=randomBytes(24).toString('base64url');
   const changed=await api('web-accounts/change-password',{current:state.password,password:newPassword});if(changed.status!==200)throw Error('Dashboard password change failed '+JSON.stringify(changed.json));
   state.password=newPassword;save();
   const [active]=await db`select count(*)::int as n from tako_email_changes where user_id=${state.original.id} and consumed_at is null`;if(active.n!==0)throw Error('Pending email token survived password change');
   await login(newAddress,newPassword);
   console.log(JSON.stringify({phase,scannerGetSafe:true,invalidTokenRejected:true,concurrentConfirm:statuses,oldSessionRevoked:true,newEmailVerified:true,newEmailLogin:true,dashboardPasswordChanged:true,pendingEmailInvalidated:true}));
  }else if(phase==='welcome'){
   if((await db`select phone from tako_whatsapp_links where restaurant_id=${state.original.restaurant_id}`).length){console.log(JSON.stringify({welcome:'SKIPPED',reason:'QA has existing WhatsApp link; preserved'}));}
   else{
    state.qaPhone='whatsapp:+15550009001';save();
    await db`insert into tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at,owner_email) values(${state.qaPhone},${state.original.restaurant_id},${state.original.id},now(),${newAddress})`;
    const runtime=parseEnv(fs.readFileSync(dir+'runtime.env','utf8'));
    const r=await fetch('https://takoitalia.com/api/web-accounts/email/tick',{method:'POST',headers:{Origin:'https://takoitalia.com','Content-Type':'application/json','x-tako-cron-secret':runtime.EMAIL_CRON_SECRET},body:'{}'});const result=await r.json();if(r.status!==200)throw Error('Tick failed '+JSON.stringify(result));
    const [row]=await db`select status from tako_email_outbox where dedupe_key=${'welcome:'+state.original.restaurant_id+':'+state.original.id}`;
    if(row?.status!=='sent')throw Error('Welcome not sent');
    console.log(JSON.stringify({phase,triggerCaptured:true,queueStatus:row.status,whatsappMessages:0}));
   }
  }else if(phase==='restore'){
   const o=state.original;
   if(state.qaPhone)await db`delete from tako_whatsapp_links where phone=${state.qaPhone} and actor_id=${o.id} and restaurant_id=${o.restaurant_id}`;
   await db`update users set email=${o.email},password_hash=${o.password_hash},local_owner_secret_hash=${o.local_owner_secret_hash},email_verified=${o.email_verified},last_login_at=${o.last_login_at||null} where id=${o.id}`;
   await db`delete from sessions where user_id=${o.id}`;
   await db`update tako_email_changes set consumed_at=coalesce(consumed_at,now()) where user_id=${o.id}`;
   await db`update web_password_resets set consumed_at=coalesce(consumed_at,now()) where user_id=${o.id}`;
   await db`update tako_email_outbox set status='cancelled',encrypted_payload=null,claim_token=null where user_id=${o.id} and status in ('pending','sending')`;
   const [u]=await db`select email,password_hash,local_owner_secret_hash,email_verified from users where id=${o.id}`;
   const restored=u.email===o.email&&u.password_hash===o.password_hash&&u.local_owner_secret_hash===o.local_owner_secret_hash&&u.email_verified===o.email_verified;
   if(!restored)throw Error('QA restoration mismatch');console.log(JSON.stringify({phase,restored:true,customerWrites:0,qaSessionsRevoked:true}));
  }else throw Error('Unknown phase');
 }
}finally{await db.end();}
