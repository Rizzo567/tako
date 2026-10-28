import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
if(!process.argv.includes('--apply'))throw Error('Explicit --apply required');
const P='/Users/manuel/.config/tako-webapp/migration-access-20261028',hash=x=>createHash('sha256').update(x).digest('hex');
const token=(await fs.readFile('/Users/manuel/Library/Preferences/.wrangler/config/default.toml','utf8')).match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];if(!token)throw Error('Existing Wrangler session required');
const api='https://api.cloudflare.com/client/v4/accounts/6978af99fd8949fba8ddb1d721e2a351/workers/scripts/takomenu-web',headers={Authorization:'Bearer '+token};
async function read(){const r=await fetch(api,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Read worker '+r.status);const form=await r.formData(),parts=[...form.entries()];if(parts.length!==1||parts[0][0]!=='worker.js')throw Error('Worker modules drift');const part=parts[0][1];return typeof part==='string'?part:await part.text();}
async function settings(){const r=await fetch(api+'/settings',{headers});const j=await r.json();if(!j.success)throw Error('Settings '+r.status);return j.result;}
const manifest=JSON.parse(await fs.readFile(P+'/frontend-manifest.json','utf8')),current=await read(),before=await settings();
if(hash(current)!==manifest.baseWorkerSha256)throw Error('Live Worker changed: rebase wrapper required');
const baseline=JSON.parse(await fs.readFile(P+'/worker-settings.json','utf8'));if(JSON.stringify(before)!==JSON.stringify(baseline.result??baseline))throw Error('Worker settings drift');
const base=await fs.readFile(P+'/worker-candidate/worker.js','utf8'),wrapper=await fs.readFile(P+'/worker-candidate/migration-worker.mjs','utf8');
if(hash(base)!==manifest.baseWorkerSha256)throw Error('Base module hash mismatch');
const metadata={main_module:'migration-worker.mjs',keep_assets:true,keep_bindings:[...new Set(before.bindings.map(b=>b.type))],annotations:{'workers/message':'Migration username login and mandatory first password change; live assets preserved'}};
for(const k of ['compatibility_date','compatibility_flags','usage_model','tags','tail_consumers','logpush','limits','observability'])if(before[k]!==undefined)metadata[k]=before[k];
if(before.placement?.mode)metadata.placement=before.placement;
const form=new FormData();form.set('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}),'metadata.json');form.set('worker.js',new Blob([base],{type:'application/javascript+module'}),'worker.js');form.set('migration-worker.mjs',new Blob([wrapper],{type:'application/javascript+module'}),'migration-worker.mjs');
if(hash(await read())!==manifest.baseWorkerSha256)throw Error('Worker drift immediately before PUT');
const response=await fetch(api,{method:'PUT',headers,body:form,signal:AbortSignal.timeout(60000)}),result=await response.json();await fs.writeFile(P+'/worker-release-response.json',JSON.stringify(result),{mode:0o600});if(!response.ok||!result.success)throw Error('Worker upload rejected '+JSON.stringify(result.errors?.map(x=>({code:x.code,message:x.message}))));
const after=await settings();
if(JSON.stringify(after.bindings)!==JSON.stringify(before.bindings))throw Error('Worker bindings changed unexpectedly');
await fs.writeFile(P+'/worker-release-receipt.json',JSON.stringify({at:new Date().toISOString(),worker:'takomenu-web',before,after,result:result.result,scriptPath:manifest.scriptPath,baseHash:hash(base),wrapperHash:hash(wrapper)},null,2),{mode:0o600});
console.log(JSON.stringify({deployed:true,worker:'takomenu-web',assetsPreserved:true,bindingsUnchanged:true,scriptPath:manifest.scriptPath}));
