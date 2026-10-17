// Runner: stato QA salvato, misura via IA (≤ tetto token), ripristino QA via API dashboard e confronto per hash.
import {build} from 'esbuild';import {readFile,writeFile} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {homedir} from 'node:os';import {createHash} from 'node:crypto'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../../..')
const {loadLocalEnvironment}=await import(repo+'/scripts/start-webapp.mjs');const env=await loadLocalEnvironment(repo)
const out=resolve(repo,'apps/server/node_modules/.tako-ai-'+process.pid+'.mjs')
await build({entryPoints:[resolve(here,'ai.ts')],bundle:true,platform:'node',format:'esm',outfile:out,packages:'external',absWorkingDir:resolve(repo,'apps/server'),logLevel:'error',alias:{'@tako/db':resolve(repo,'packages/db/src/index.ts'),'@tako/types':resolve(repo,'packages/types/src/index.ts')}})
Object.assign(process.env,env)
// come sull'edge: l'agenzia (titolare del numero collegato al QA) è riconosciuta dalla lista agenzia della funzione
{const {parseEnv}=await import('node:util');const c=parseEnv(await readFile(homedir()+'/.config/tako-webapp/candidate.env','utf8'));if(c.TAKO_CANDIDATE_TAKOMENU_AGENCY_USER_IDS)process.env.TAKOMENU_AGENCY_USER_IDS=c.TAKO_CANDIDATE_TAKOMENU_AGENCY_USER_IDS}
const {client,json}=await import(repo+'/scripts/translations/common.mjs')
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16)
const q=JSON.parse(await readFile(homedir()+'/.config/tako-webapp/qa-login.json','utf8'));const api=client();await api.call('/api/auth/login',json({email:q.email,password:q.password}))
const before=await api.call('/api/menu-workspace');if(before.revision!==before.publishedRevision)throw Error('bozza in attesa: stop')
const pub=async()=>h(await (await fetch(`https://takoitalia.com/api/customer/restaurant/${QA}/menu?prefetch=1`)).json())
const pubBefore=await pub()
const key=(await readFile(homedir()+'/.config/tako-webapp/groq-key.txt','utf8')).trim()
const {run}=await import(pathToFileURL(out).href)
let r;try{r=await run(key,process.argv.slice(3),Number(process.argv[2]))}finally{
 const cur=await api.call('/api/menu-workspace');const saved=await api.call('/api/menu-workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:cur.revision,workspace:before.data})});await api.call('/api/menu-workspace/publish',json({expectedRevision:saved.revision}))
 const after=await api.call('/api/menu-workspace');console.log((h(after.data)===h(before.data)&&await pub()===pubBefore)?'PASS QA ripristinato (bozza e risposta pubblica)':'FAIL ripristino')
 await api.call('/api/auth/logout',{method:'POST'}).catch(()=>{})}
console.log(JSON.stringify(r,null,1));await writeFile(resolve(here,'../evidence/ai-local-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'),JSON.stringify(r,null,1));process.exit(0)
