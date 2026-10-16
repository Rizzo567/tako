import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {tmpdir,homedir} from 'node:os'
import path from 'node:path'
import {builtinModules} from 'node:module'
import {build} from 'esbuild'
import {loadLocalEnvironment} from '../start-webapp.mjs'
const root=path.resolve(new URL('../../',import.meta.url).pathname),local=await loadLocalEnvironment(root),slug='tako-api-graph-probe',results=[]
const raw=await readFile(path.join(homedir(),'.config/tako-webapp/supabase-management.env'),'utf8'),env={...process.env}
for(const line of raw.split('\n')){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}
if(!env.SUPABASE_ACCESS_TOKEN)throw new Error('Management token unavailable')
const ref=new URL(local.SUPABASE_URL).hostname.split('.')[0],directory=await mkdtemp(path.join(tmpdir(),'tako-api-probe-'))
const functionDir=path.join(directory,'supabase/functions',slug);await mkdir(functionDir,{recursive:true})
const canonicalEntry=path.join(root,'apps/server/src/index.ts'),versions=new Map(),builtins=new Set([...builtinModules,...builtinModules.map(x=>'node:'+x)])
const source=`import process from 'node:process';
if(process.env.TAKO_PROBE_DISABLE_ENV_SET==='1')Object.defineProperty(Deno.env,'set',{value:()=>{throw new Error('OS ENV WRITES FORBIDDEN IN PROBE')},configurable:true});
Object.defineProperty(process,'env',{value:{...process.env,...{TAKO_MODE:'web',TAKO_EXECUTION_RUNTIME:'edge',NODE_ENV:'development',WEB_ORIGIN:'https://tako-fixture.invalid',JWT_SECRET:'synthetic-graph-fixture-not-client-credentials',TAKO_DURABLE_RATE_LIMIT:'0',UPLOADS_DRIVER:'supabase',DATABASE_URL:'postgresql://fixture:fixture@database.invalid/tako',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key-not-client-access'}},writable:true,configurable:true});
const boot=import(${JSON.stringify(canonicalEntry)}).then(async({createApp})=>{const app=await createApp({runtime:'edge-candidate'});return app}).catch(error=>({bootError:String(error),bootStack:error?.stack?.slice(0,3000)}));
Deno.serve(async()=>{try{const app=await boot;if(app.bootError)return Response.json({operational:false,stage:'boot',error:app.bootError,stack:app.bootStack},{status:503});const requests=[{method:'GET',url:'/health'},{method:'GET',url:'/api/restaurants/me'},{method:'POST',url:'/api/auth/login'}];const results=[];for(const request of requests){const response=await app.inject(request);results.push({method:request.method,path:request.url,status:response.statusCode,body:response.payload});}return Response.json({operational:false,scope:'actual-canonical-routegraph-no-db',listening:app.server.listening,routeCount:app.printRoutes().split('\\n').length,results});}catch(error){return Response.json({operational:false,stage:'boot',error:String(error),stack:error?.stack?.slice(0,3000)},{status:503})}});`
const deployed=false
try{
 const bundle=await build({stdin:{contents:source,resolveDir:root,sourcefile:'api-graph-entry.ts',loader:'ts'},bundle:true,format:'esm',platform:'neutral',target:'es2022',write:false,treeShaking:true,metafile:true,plugins:[{name:'pinned-npm-externals',setup(ctx){ctx.onResolve({filter:/.*/},async args=>{
  if(args.path.startsWith('@tako/db')){const pkg=JSON.parse(await readFile(path.join(root,'packages/db/package.json'),'utf8'));const sub=args.path==='@tako/db'?'.':'.'+args.path.slice('@tako/db'.length);if(!pkg.exports[sub])throw new Error('Unknown workspace DB export '+sub);return {path:path.resolve(root,'packages/db',pkg.exports[sub])}}
  if(args.path==='@tako/types')return {path:path.join(root,'packages/types/src/index.ts')}
  if(builtins.has(args.path))return {path:args.path.startsWith('node:')?args.path:'node:'+args.path,external:true}
  if(args.path.startsWith('.')||args.path.startsWith('/')||args.path.startsWith('node:'))return
  const parts=args.path.split('/'),pkg=args.path.startsWith('@')?parts.slice(0,2).join('/'):parts[0],sub=args.path.slice(pkg.length)
  let version=versions.get(pkg);if(!version){for(const directory of ['apps/server/node_modules','packages/db/node_modules','node_modules']){try{version=JSON.parse(await readFile(path.join(root,directory,pkg,'package.json'),'utf8')).version;break}catch{}}if(!version)throw new Error('Unresolved external '+pkg);versions.set(pkg,version)}
  return {path:`npm:${pkg}@${version}${sub}`,external:true}
 })}}]})
 const code=bundle.outputFiles[0].text
 await writeFile(path.join(functionDir,'index.ts'),code)
 if(process.env.TAKO_PROBE_BUILD_ONLY==='1'){await writeFile('/tmp/tako-api-graph-probe.ts',code);console.log(JSON.stringify({buildOnly:true,bundleBytes:Buffer.byteLength(code)}));process.exitCode=0;throw Object.assign(new Error('BUILD_ONLY_DONE'),{buildOnly:true})}
 await writeFile(path.join(directory,'supabase/config.toml'),`[functions.${slug}]\nverify_jwt=true\n`)
 await writeFile(path.join(root,'docs/webapp/activation/api-graph-bundle-inventory.json'),JSON.stringify({bundleBytes:Buffer.byteLength(code),canonicalEntry,inputs:Object.keys(bundle.metafile.inputs),externals:Object.fromEntries(versions),production:false},null,2))
 const command=spawnSync('pnpm',['dlx','supabase','functions','deploy',slug,'--project-ref',ref],{cwd:directory,env,encoding:'utf8',timeout:180000});console.log(JSON.stringify({deployStatus:command.status,stdout:command.stdout.slice(-2400),stderr:command.stderr.slice(-1600),bundleBytes:Buffer.byteLength(code)}))
 if(command.status!==0)throw new Error('Canonical graph deploy failed')
 try{const detail=await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/${slug}`,{headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`}});if(detail.ok){const metadata=await detail.json();results.push({functionId:metadata.id})}const url=`${local.SUPABASE_URL}/functions/v1/${slug}`;results.push({mode:'unauthenticated',status:(await fetch(url)).status});for(let i=0;i<2;i++){const response=await fetch(url,{headers:{Authorization:`Bearer ${local.SUPABASE_SERVICE_ROLE_KEY}`},signal:AbortSignal.timeout(60000)});results.push({mode:'canonical-graph',status:response.status,data:await response.text()});}}
 finally{const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/${slug}`,{method:'DELETE',headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`}});const lookup=await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/${slug}`,{headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`}});results.push({cleanupDelete:response.status,cleanupLookup:lookup.status})}
}catch(error){if(!error.buildOnly)throw error}finally{await rm(directory,{recursive:true,force:true});if(process.env.TAKO_PROBE_BUILD_ONLY!=='1')await writeFile(path.join(root,'docs/webapp/activation/api-graph-hosted-metrics.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results))}
