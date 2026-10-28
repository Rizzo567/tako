import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const P='/Users/manuel/.config/tako-webapp/migration-access-20261028';
const ref='tcfccmvpycivxuxkoqpw',slug='tako-operational-candidate';
if(!process.argv.includes('--apply'))throw Error('Explicit --apply required');
const secrets=parseEnv(await fs.readFile('/Users/manuel/.config/tako-webapp/migration-audit-20261027/whatsapp-credentials/management-session.env','utf8'));
const headers={Authorization:'Bearer '+secrets.SUPABASE_ACCESS_TOKEN},hash=b=>createHash('sha256').update(b).digest('hex');
async function metadata(){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/${slug}`,{headers,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Metadata '+r.status);return r.json();}
async function cli(args,cwd,logFile){const result=await new Promise((resolve,reject)=>{const c=spawn('pnpm',['dlx','supabase',...args],{cwd,env:{...process.env,SUPABASE_ACCESS_TOKEN:secrets.SUPABASE_ACCESS_TOKEN},stdio:['ignore','pipe','pipe']});let log='';c.stdout.on('data',b=>log+=b);c.stderr.on('data',b=>log+=b);c.on('error',reject);c.on('exit',code=>resolve({code,log}));});await fs.writeFile(logFile,result.log,{mode:0o600});if(result.code!==0)throw Error('CLI failed; private log saved');}
const tests=JSON.parse(await fs.readFile(P+'/stage-tests.json','utf8'));if(!tests.passed)throw Error('Staging tests must pass');
const manifest=JSON.parse(await fs.readFile(P+'/patch-manifest.json','utf8')),before=await metadata();
const fresh=P+'/pre-release-'+Date.now();await fs.mkdir(fresh,{recursive:true,mode:0o700});
await cli(['functions','download',slug,'--project-ref',ref,'--use-api'],fresh,fresh+'/download.log');
const current=await fs.readFile(fresh+'/supabase/functions/'+slug+'/index.ts');
if(hash(current)!==manifest.baseSourceSha256)throw Error('BASE DRIFT: downloaded online source differs; rebase required');
const source=await fs.readFile(P+'/candidate-index.ts');if(hash(source)!==manifest.candidateSourceSha256)throw Error('Candidate hash changed');
if(source.includes(Buffer.from('MIGRATION_QA_DIAG')))throw Error('Diagnostic staging code forbidden');
const aux=await fs.readFile(P+'/supabase/functions/'+slug+'/magick-wasm-0.0.44.js');
if(hash(aux)!==hash(await fs.readFile(fresh+'/supabase/functions/'+slug+'/magick-wasm-0.0.44.js')))throw Error('Auxiliary source drift');
const dir=P+'/release/supabase/functions/'+slug;await fs.mkdir(dir,{recursive:true,mode:0o700});await fs.writeFile(dir+'/index.ts',source,{mode:0o600});await fs.writeFile(dir+'/magick-wasm-0.0.44.js',aux,{mode:0o600});
const last=await metadata();if(last.version!==before.version||last.ezbr_sha256!==before.ezbr_sha256)throw Error('BASE DRIFT before deploy');
await cli(['functions','deploy',slug,'--project-ref',ref,'--no-verify-jwt'],P+'/release',P+'/release.log');
const after=await metadata();if(after.status!=='ACTIVE'||after.version<=before.version)throw Error('New ACTIVE version not confirmed');
await fs.writeFile(P+'/release-receipt.json',JSON.stringify({at:new Date().toISOString(),before,after,sourceSha256:hash(source),rollbackSource:fresh+'/supabase/functions/'+slug+'/index.ts'},null,2),{mode:0o600});
console.log(JSON.stringify({deployed:true,project:ref,function:slug,version:after.version}));
