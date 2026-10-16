/** Local fixture only: no private config, database or external network permission. */
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),temporary=await mkdtemp(join(tmpdir(),'tako-lazy-boot-'));
try{
 const bundle=await readFile(new URL('release/serverless/candidate/index.ts',root));await writeFile(join(temporary,'index.ts'),bundle);
 const fixture=`const config={DATABASE_URL:'postgres://fixture:fixture@127.0.0.1:1/fixture',JWT_SECRET:'fixture-value-'.repeat(4),SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-value',TAKO_GATEWAY_SECRET:'fixture-value-'.repeat(4),TAKO_RATE_LIMIT_SECRET:'fixture-value-'.repeat(4),WEB_ORIGIN:'https://fixture.invalid',PDF_FONT_BUCKET:'fixture',TAKO_IMAGE_SEEDS_JSON:JSON.stringify([{tenantId:'00000000-0000-0000-0000-000000000001',checkpoint:'a'.repeat(64)}])};
for(const [key,value]of Object.entries(config))Deno.env.set('TAKO_CANDIDATE_'+key,value);
let handler;Deno.serve=fn=>{handler=fn;console.log('SERVE_REGISTERED');return{}};
await import('./index.ts');await new Promise(resolve=>setTimeout(resolve,100));console.log('IDLE_SURVIVED');
const url='https://fixture.invalid/functions/v1/tako-operational-candidate/health';
const denied=await handler(new Request(url));if(denied.status!==403)throw Error('Gateway admission failed');console.log('DENIED_BEFORE_BOOT');
const headers={'x-tako-gateway-secret':config.TAKO_GATEWAY_SECRET,'x-tako-gateway-origin':config.WEB_ORIGIN,'x-tako-client-ip':'127.0.0.1'};
for(let i=0;i<2;i++){const response=await handler(new Request(url,{headers}));const body=await response.json();if(![200,500,503].includes(response.status))throw Error('Unexpected denied-network fixture status');}console.log('AUTHORIZED_REQUEST_NO_IMAGE_BOOT');`;
 await writeFile(join(temporary,'fixture.ts'),fixture);
 const stdout=execFileSync('npx',['--yes','deno','run','--node-modules-dir=auto','--allow-env','--allow-read','--allow-sys=hostname','fixture.ts'],{cwd:temporary,encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']});
 const milestones=stdout.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
 assert.equal(milestones.filter(m=>m.phase==='before_image_initializer').length,0,'image init never runs for read-only requests');
 assert.equal(milestones.filter(m=>m.phase==='before_app_import').length,1,'one shared boot for two trusted requests');
 assert(stdout.indexOf('DENIED_BEFORE_BOOT')<stdout.indexOf('before_app_import'));
 assert(stdout.includes('AUTHORIZED_REQUEST_NO_IMAGE_BOOT'));
 const report={passed:true,mode:'LOCAL_DENO_FIXTURE_NO_DEPLOY',bundleBytes:bundle.length,bundleSha256:createHash('sha256').update(bundle).digest('hex'),privateConfigurationRead:false,externalNetworkForbidden:true,checks:['idle does not boot','gateway denied before boot','authorized request starts boot','two requests share settled boot','trusted request completes without image initializer; denied DB network may return generic failure'],memoryMilestones:milestones,limitation:'Denied-network health runs without WASM; hosted upload/PDF peaks require separate verification'};
 await writeFile(new URL('docs/webapp/activation/candidate-lazy-boot-local-verification.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await rm(temporary,{recursive:true,force:true})}
