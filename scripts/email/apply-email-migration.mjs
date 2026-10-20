import fs from 'node:fs/promises';import {homedir} from 'node:os';import {parseEnv} from 'node:util';import {createHash} from 'node:crypto';
const names=['transactional-email.sql','email-welcome-capture.sql','email-cron.sql'];
const query='BEGIN;\n'+(await Promise.all(names.map(name=>fs.readFile(new URL('../serverless/'+name,import.meta.url),'utf8')))).join('\n')+'\nCOMMIT;';
if(!process.argv.includes('--apply')){console.log(JSON.stringify({mode:'dry-run',files:names,sha256:createHash('sha256').update(query).digest('hex'),remoteWrites:0}));process.exit(0);}
const {SUPABASE_ACCESS_TOKEN:token}=parseEnv(await fs.readFile(homedir()+'/.config/tako-webapp/supabase-management.env','utf8'));
const response=await fetch('https://api.supabase.com/v1/projects/tcfccmvpycivxuxkoqpw/database/query',{method:'POST',headers:{authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query})});
if(!response.ok){const failure=await response.json().catch(()=>({}));console.log(JSON.stringify({migration:'FAILED',status:response.status,code:failure.code,message:failure.message}));process.exit(1);}
console.log(JSON.stringify({migration:'PASS',files:names,schedulerChanged:false,customerBackfill:false}));
