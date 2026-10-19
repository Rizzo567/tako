// QA-only, explicit invocation. Never reads or updates a customer account.
import fs from 'node:fs';import {parseEnv} from 'node:util';import {randomBytes} from 'node:crypto';
import postgres from '../../apps/server/node_modules/postgres/src/index.js';
const base=process.env.HOME+'/.config/tako-webapp/',dir=base+'email-activation-20261019/',c=parseEnv(fs.readFileSync(base+'candidate.env','utf8'));
const sql=postgres(c.TAKO_CANDIDATE_DATABASE_URL,{ssl:{ca:c.TAKO_CANDIDATE_DATABASE_CA_CERT},max:1});
const backup=dir+'qa-account-backup.json',qaEmail=process.env.TAKOMENU_QA_EMAIL;
if(!qaEmail||!qaEmail.includes('@'))throw new Error('Set TAKOMENU_QA_EMAIL to an inbox you control; never a customer address');
const post=async(path,body)=>{const r=await fetch('https://takoitalia.com/api/web-accounts/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://takoitalia.com'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
try {
 if(process.argv[2]==='prepare'){
  if(fs.existsSync(backup))throw new Error('Existing QA backup: restore before preparing another run');
  const rows=await sql`select u.id,u.email,u.password_hash,u.local_owner_secret_hash,u.name from users u join restaurants r on r.id=u.restaurant_id where r.slug='qa-web-verifica' and r.name='Tako · Verifica web' and u.role='owner' and u.active=true`;
  if(rows.length!==1)throw new Error('Ambiguous QA account');
  fs.writeFileSync(backup,JSON.stringify(rows[0]),{mode:0o600});
  await sql`update users set email=${qaEmail} where id=${rows[0].id} and email=${rows[0].email}`;
  const response=await post('forgot-password',{email:qaEmail});
  console.log(JSON.stringify({phase:'requested',status:response.status,genericResponse:!!response.body.data?.message,qaOnly:true}));
 }else if(process.argv[2]==='reset'){
  const token=fs.readFileSync(dir+'qa-reset-token.txt','utf8').trim();
  const check=await post('reset-check',{token});
  const password=randomBytes(24).toString('base64url');fs.writeFileSync(dir+'qa-password.txt',password,{mode:0o600});
  const reset=await post('reset-password',{token,password});
  const reuse=await post('reset-password',{token,password});
  const checkAfter=await post('reset-check',{token});
  const r=await fetch('https://takoitalia.com/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://takoitalia.com'},body:JSON.stringify({email:qaEmail,password})});
  const login=await r.json();fs.writeFileSync(dir+'qa-live-login.json',JSON.stringify(login),{mode:0o600});
  const proof={validBefore:check.body.data?.valid,resetStatus:reset.status,reset:reset.body.data?.reset,reuseStatus:reuse.status,validAfter:checkAfter.body.data?.valid,loginStatus:r.status};
  fs.writeFileSync(dir+'qa-live-proof.json',JSON.stringify(proof,null,2),{mode:0o600});console.log(JSON.stringify(proof));
 }else if(process.argv[2]==='restore'){
  const old=JSON.parse(fs.readFileSync(backup));
  const rows=await sql`update users set email=${old.email},password_hash=${old.password_hash},local_owner_secret_hash=${old.local_owner_secret_hash} where id=${old.id} and email=${qaEmail} returning id`;
  if(rows.length!==1)throw new Error('QA restoration precondition failed');
  await sql`delete from sessions where user_id=${old.id}`;
  await sql`update web_password_resets set consumed_at=coalesce(consumed_at,now()) where user_id=${old.id}`;
  const [restored]=await sql`select email,password_hash,local_owner_secret_hash from users where id=${old.id}`;
  const ok=restored.email===old.email&&restored.password_hash===old.password_hash&&restored.local_owner_secret_hash===old.local_owner_secret_hash;
  console.log(JSON.stringify({restored:ok,qaSessionsRevoked:true,customerWrites:0}));
 }else throw new Error('Expected prepare/reset/restore');
} finally {await sql.end();}
