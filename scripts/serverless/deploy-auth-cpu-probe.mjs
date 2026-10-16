import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {tmpdir,homedir} from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {loadLocalEnvironment} from '../start-webapp.mjs'
const root=path.resolve(new URL('../../',import.meta.url).pathname),require=createRequire(root+'/apps/server/package.json'),bcrypt=require('bcryptjs'),local=await loadLocalEnvironment(root)
const hash=await bcrypt.hash('tako-synthetic-cpu-fixture-only',12)
const raw=await readFile(path.join(homedir(),'.config/tako-webapp/supabase-management.env'),'utf8')
const env={...process.env};for(const line of raw.split('\n')){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}
if(!env.SUPABASE_ACCESS_TOKEN)throw new Error('Management token unavailable')
const ref=new URL(local.SUPABASE_URL).hostname.split('.')[0],directory=await mkdtemp(path.join(tmpdir(),'tako-auth-probe-')),slug='tako-auth-cpu-probe',results=[]
try{
 const functionDir=path.join(directory,'supabase/functions',slug);await mkdir(functionDir,{recursive:true})
 await writeFile(path.join(functionDir,'index.ts'),(await readFile(path.join(root,'supabase/functions',slug,'index.ts'),'utf8')).replace('FIXTURE_HASH',hash))
 await writeFile(path.join(directory,'supabase/config.toml'),`[functions.${slug}]\nverify_jwt=true\n`)
 const deployed=spawnSync('pnpm',['dlx','supabase','functions','deploy',slug,'--project-ref',ref],{cwd:directory,env,encoding:'utf8',timeout:180000});console.log(JSON.stringify({deployStatus:deployed.status,stderr:deployed.stderr.slice(-1000)}))
 if(deployed.status!==0)throw new Error('Auth probe deploy failed')
 try{
  const base=`${local.SUPABASE_URL}/functions/v1/${slug}`;results.push({mode:'unauthenticated',status:(await fetch(base)).status})
  for(const mode of ['health','correct','wrong','correct','dual','dual']){const response=await fetch(base+'?mode='+mode,{headers:{Authorization:`Bearer ${local.SUPABASE_SERVICE_ROLE_KEY}`},signal:AbortSignal.timeout(60000)});results.push({mode,status:response.status,data:await response.text()})}
 }finally{
  const deleted=await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/${slug}`,{method:'DELETE',headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`}})
  const lookup=await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/${slug}`,{headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`}})
  results.push({cleanupDelete:deleted.status,cleanupLookup:lookup.status})
 }
}finally{await rm(directory,{recursive:true,force:true});await writeFile(path.join(root,'docs/webapp/activation/auth-hosted-cpu-metrics.json'),JSON.stringify({bcryptVersion:'3.0.3',cost:12,fixture:'synthetic only, not client passwords',results},null,2));console.log(JSON.stringify(results))}
