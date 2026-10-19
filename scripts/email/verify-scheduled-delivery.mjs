import fs from 'node:fs';import {parseEnv}from'node:util';
const base=process.env.HOME+'/.config/tako-webapp/',dir=base+'email-automation-20261019/',candidate=parseEnv(fs.readFileSync(base+'candidate.env','utf8')),mail=parseEnv(fs.readFileSync(base+'resend.env','utf8'));
for(const[name,value]of Object.entries(candidate))if(name.startsWith('TAKO_CANDIDATE_'))process.env[name.slice(15)]=value;
Object.assign(process.env,mail,parseEnv(fs.readFileSync(dir+'runtime.env','utf8')),{TAKO_MODE:'web'});
const {db}=await import('../../packages/db/src/index.ts'),{sql}=await import('../../apps/server/node_modules/drizzle-orm/index.js'),{enqueueEmail}=await import('../../apps/server/src/lib/transactional-email/outbox.ts');
const state=JSON.parse(fs.readFileSync(dir+'qa-state.json'));
const qaEmail=process.env.TAKOMENU_QA_NEW_EMAIL||state.qaEmailNew;if(!qaEmail?.includes('@'))throw Error('Configure your controlled QA inbox alias');
const key='qa-email-scheduler:'+Date.now();
const id=await enqueueEmail(db,{key,userId:state.original.id,recipient:qaEmail,template:'servizio',values:{nome_titolare:'Manuel',titolo:'Takomenu · prova invio automatico',testo:'Questa email verifica il processo automatico. Nessuna azione richiesta.'}});
const {SUPABASE_ACCESS_TOKEN:token}=parseEnv(fs.readFileSync(base+'supabase-management.env','utf8'));
const query="DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='takomenu-email-delivery') THEN PERFORM cron.schedule('takomenu-email-delivery','* * * * *','SELECT public.tako_email_request_tick()'); END IF; END $$;";
const response=await fetch('https://api.supabase.com/v1/projects/tcfccmvpycivxuxkoqpw/database/query',{method:'POST',headers:{authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query})});if(!response.ok)throw Error('Cron scheduling failed '+response.status);
const end=Date.now()+75000;let row;
while(Date.now()<end){[row]=await db.execute(sql`select status,attempts,provider_id,last_error from tako_email_outbox where id=${id}`);if(['sent','failed','cancelled'].includes(row?.status))break;await new Promise(resolve=>setTimeout(resolve,2000));}
const proof={scheduled:true,qaOnly:true,status:row?.status,attempts:row?.attempts,providerId:row?.provider_id,manuallyProcessed:false};fs.writeFileSync(dir+'scheduled-proof.json',JSON.stringify(proof,null,2),{mode:0o600});console.log(JSON.stringify(proof));if(row?.status!=='sent')process.exit(1);process.exit(0);
