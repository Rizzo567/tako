#!/usr/bin/env node
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

// Run only after the authenticated operational backend gates have passed.
// Provider secrets are passed on stdin, never as CLI arguments or frontend vars.
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
if(!process.argv.includes('--backend-gates-passed'))throw Error('Explicit backend verification gate required');
const privateDir=resolve(homedir(),'.config/tako-webapp');
const source=await readFile(resolve(privateDir,'candidate.env'),'utf8');
const values={};
for(const line of source.split(/\r?\n/)){
 const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(!match)continue;
 let value=match[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
 values[match[1]]=value;
}
const base=new URL(values.TAKO_CANDIDATE_SUPABASE_URL);
if(base.protocol!=='https:'||!base.hostname.endsWith('.supabase.co'))throw Error('Invalid provider URL');
if(values.TAKO_CANDIDATE_WEB_ORIGIN!=='https://takoitalia.com')throw Error('Gateway origin must match production');
const secret=values.TAKO_CANDIDATE_TAKO_GATEWAY_SECRET;
if(!secret||secret.length<32)throw Error('Missing scoped gateway credential');
const edge=new URL('/functions/v1/tako-operational-candidate',base).href;
const backup=resolve(privateDir,'cloud-dashboard-backup-'+Date.now());await mkdir(backup,{recursive:true,mode:0o700});
async function command(args,input){
 return await new Promise((accept,reject)=>{
  const child=spawn('pnpm',['exec','wrangler',...args],{cwd:repo,stdio:['pipe','pipe','pipe']});
  // Retain only non-sensitive deployment status. Secret command output is discarded.
  let output='';child.stdout.on('data',chunk=>{output+=chunk});child.stderr.on('data',chunk=>{output+=chunk});
  child.on('error',reject);child.on('close',async code=>{
   output=output.replaceAll(secret,'[REDACTED]');
   if(code===0)return accept(input?'':output);
   await writeFile(resolve(backup,'operation-failed.log'),output,{mode:0o600});
   reject(Error('Cloudflare operation failed; inspect private deployment diagnostics'));
  });
  child.stdin.end(input??'');
 });
}
// Public snapshots stay intact unless their live published DTO parity was checked.
const configs=process.argv.includes('--published-menu-parity-passed')?['wrangler.jsonc','wrangler-public.jsonc']:['wrangler.jsonc'];
for(const name of configs){
 const path=resolve(repo,'deploy/cloudflare',name);await copyFile(path,resolve(backup,name));
 const config=JSON.parse(await readFile(path,'utf8'));
 config.vars={...config.vars,TAKO_BACKEND_READY:'true',TAKO_EDGE_URL:edge};
 await writeFile(path,JSON.stringify(config,null,2)+'\n');
 await command(['secret','put','TAKO_GATEWAY_SECRET','--config',path],secret);
 const result=await command(['deploy','--config',path]);
 await writeFile(resolve(backup,name+'.deploy.log'),result,{mode:0o600});
 console.log(JSON.stringify({worker:config.name,activated:true}));
}
