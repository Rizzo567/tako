import {readFile,mkdir,cp,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {tmpdir,homedir} from 'node:os'
import path from 'node:path'
import {loadLocalEnvironment} from '../start-webapp.mjs'
const root=path.resolve(new URL('../../',import.meta.url).pathname),local=await loadLocalEnvironment(root)
const raw=await readFile(path.join(homedir(),'.config/tako-webapp/supabase-management.env'),'utf8')
const env={...process.env};for(const line of raw.split('\n')){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}
if(!env.SUPABASE_ACCESS_TOKEN)throw new Error('Management token unavailable')
const ref=new URL(local.SUPABASE_URL).hostname.split('.')[0],directory=await mkdtemp(path.join(tmpdir(),'tako-probe-'))
try{
 await mkdir(path.join(directory,'supabase/functions/tako-image-probe'),{recursive:true})
 await cp(path.join(root,'supabase/functions/tako-image-probe/index.ts'),path.join(directory,'supabase/functions/tako-image-probe/index.ts'))
 for(const name of ['edge-static-image-codec','static-image-policy'])await cp(path.join(root,'apps/server/src/lib',name+'.ts'),path.join(directory,'supabase/functions/tako-image-probe',name+'.ts'))
 let source=await readFile(path.join(directory,'supabase/functions/tako-image-probe/index.ts'),'utf8');source=source.replace("../../../apps/server/src/lib/edge-static-image-codec.ts","./edge-static-image-codec.ts")
 const digest=createHash('sha256').update(await readFile('/tmp/tako-image-runtime-spike/node_modules/@imagemagick/magick-wasm/dist/x86/magick.wasm')).digest('hex')
 source=source.replace("await Deno.readFile(new URL('./magick.wasm',import.meta.url))","new Uint8Array(await (await fetch('https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.44/dist/x86/magick.wasm')).arrayBuffer())")
 source=source.replace('const codec=',"const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',wasm))).map(x=>x.toString(16).padStart(2,'0')).join('');if(digest!=="+JSON.stringify(digest)+")throw new Error('WASM integrity mismatch');\nconst codec=")
 await writeFile(path.join(directory,'supabase/functions/tako-image-probe/index.ts'),source)
 const codecPath=path.join(directory,'supabase/functions/tako-image-probe/edge-static-image-codec.ts');await writeFile(codecPath,(await readFile(codecPath,'utf8')).replace('./static-image-policy.js','./static-image-policy.ts'))
 // WASM fetched from pinned CDN with SHA256 check to avoid Management API5MB limit.
 await writeFile(path.join(directory,'supabase/config.toml'),'[functions.tako-image-probe]\nverify_jwt = true\n')
 const result=spawnSync('pnpm',['dlx','supabase','functions','deploy','tako-image-probe','--project-ref',ref],{cwd:directory,env,encoding:'utf8',timeout:180000});console.log(JSON.stringify({deployStatus:result.status,stdout:result.stdout.slice(-1800),stderr:result.stderr.slice(-1800)}))
 if(result.status!==0)throw new Error('Probe deployment failed')
 const url=`${local.SUPABASE_URL}/functions/v1/tako-image-probe`,results=[]
 try{const unauth=await fetch(url,{method:'POST',body:'empty'});results.push({name:'unauthenticated',status:unauth.status})
 for(const format of ['jpeg','png','webp','alpha.png','png']){const bytes=await readFile('/tmp/tako-image-runtime-spike/fixtures/static2mp.'+format);const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${local.SUPABASE_SERVICE_ROLE_KEY}`},body:bytes,signal:AbortSignal.timeout(60000)});results.push({format,status:response.status,data:await response.text()})}
 await writeFile(path.join(root,'docs/webapp/activation/static-image-hosted-metrics.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results))
 }finally{const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/tako-image-probe`,{method:'DELETE',headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`}});console.log(JSON.stringify({deleteProbeStatus:response.status}))}
}finally{await rm(directory,{recursive:true,force:true})}
