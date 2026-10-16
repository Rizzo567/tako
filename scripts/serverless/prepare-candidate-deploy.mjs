import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {parseEnv} from 'node:util'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {loadLocalEnvironment} from '../start-webapp.mjs'
const root=path.resolve(new URL('../../',import.meta.url).pathname)
const slug='tako-operational-candidate'
const required=['DATABASE_URL','JWT_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','TAKO_GATEWAY_SECRET','TAKO_RATE_LIMIT_SECRET','WEB_ORIGIN','PDF_FONT_BUCKET','TAKO_IMAGE_SEEDS_JSON']
const optional=['DATABASE_CA_CERT','UPLOADS_MAX_BYTES','SUPABASE_STORAGE_BUCKET','PDF_FONT_PREFIX','PDF_FONT_TIMEOUT_MS','PDF_FONT_MAX_BYTES','TAKOMENU_AGENCY_USER_IDS']
export const candidateSecretNames=[...required,...optional].map(key=>'TAKO_CANDIDATE_'+key)
function parsePrivate(text){return parseEnv(text)}
export function validateCandidateSecrets(values){
 for(const key of required)if(!values['TAKO_CANDIDATE_'+key])throw new Error('Missing candidate secret name: TAKO_CANDIDATE_'+key)
 for(const key of ['JWT_SECRET','TAKO_GATEWAY_SECRET','TAKO_RATE_LIMIT_SECRET'])if(values['TAKO_CANDIDATE_'+key].length<32)throw new Error('Weak candidate secret: '+key)
 const origin=new URL(values.TAKO_CANDIDATE_WEB_ORIGIN)
 if(origin.protocol!=='https:'||origin.origin!==values.TAKO_CANDIDATE_WEB_ORIGIN)throw new Error('Candidate HTTPS origin required')
 const seeds=JSON.parse(values.TAKO_CANDIDATE_TAKO_IMAGE_SEEDS_JSON)
 if(!Array.isArray(seeds)||!seeds.length)throw new Error('Candidate seed manifest required')
 return candidateSecretNames.filter(name=>values[name]!==undefined)
}
export async function prepareCandidate(){
 const apply=process.argv.includes('--apply')
 if(process.argv.includes('--deploy'))throw new Error('Use explicit --apply with a staging gate artifact')
 const local=await loadLocalEnvironment(root)
 const ref=new URL(local.SUPABASE_URL).hostname.split('.')[0]
 const management=parsePrivate(await readFile(path.join(homedir(),'.config/tako-webapp/supabase-management.env'),'utf8'))
 if(!management.SUPABASE_ACCESS_TOKEN)throw new Error('Management token unavailable')
 const bundle=await readFile(path.join(root,'release/serverless/candidate/index.ts'),'utf8')
 if(!bundle.includes('TAKO_CANDIDATE_')||!bundle.includes('createFetchBridge')||!bundle.includes('TAKO_GATEWAY_SECRET'))throw new Error('Candidate bundle requires scoped config and mandatory gateway')
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`,{headers:{Authorization:`Bearer ${management.SUPABASE_ACCESS_TOKEN}`},signal:AbortSignal.timeout(20000)})
 if(!response.ok)throw new Error('Cannot inspect provider secret names: '+response.status)
 const metadata=await response.json()
 if(!Array.isArray(metadata))throw new Error('Invalid provider secret inventory')
 const existingNames=metadata.map(item=>item.name).filter(name=>typeof name==='string')
 const privateFile=path.join(homedir(),'.config/tako-webapp/candidate.env')
 let candidate={};try{candidate=parsePrivate(await readFile(privateFile,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
 let configurationReady=false,validation='Private candidate configuration not prepared'
 try{validateCandidateSecrets(candidate);configurationReady=true;validation='Names and local configuration valid'}catch(error){validation=error.message}
 const directory=path.join(root,'release/serverless/candidate-deploy')
 await mkdir(path.join(directory,'supabase/functions',slug),{recursive:true})
 await writeFile(path.join(directory,'supabase/functions',slug,'index.ts'),bundle)
 await writeFile(path.join(directory,'supabase/config.toml'),`[functions.${slug}]\nverify_jwt = false\n`)
 const report={mode:'prepare-only',production:false,remoteWrites:0,slug,projectRef:ref,bundleSha256:createHash('sha256').update(bundle).digest('hex'),configurationReady,validation,requiredSecretNames:required.map(key=>'TAKO_CANDIDATE_'+key),optionalSecretNames:optional.map(key=>'TAKO_CANDIDATE_'+key),existingCandidateNames:existingNames.filter(name=>candidateSecretNames.includes(name)),genericSecretsUntouched:true,gatesPending:['seed and restricted DB role','fonts and combined bootstrap','mandatory gateway adversarial checks','explicit staging deployment step']}
 await writeFile(path.join(directory,'prepare-report.json'),JSON.stringify(report,null,2))
 if(apply){
  validateCandidateSecrets(candidate)
  const gatePath=process.argv.find(arg=>arg.startsWith('--gate-file='))?.slice('--gate-file='.length)
  if(!gatePath)throw new Error('Explicit staging gate file required')
  const gate=JSON.parse(await readFile(gatePath,'utf8'))
  if(gate.stagingOnly!==true||gate.approved!==true||gate.bundleSha256!==report.bundleSha256||!['seedRestrictedRole','fontsBootstrap','gatewayAdversarial'].every(key=>gate[key]===true))throw new Error('Staging gates incomplete or bundle changed')
  if(report.existingCandidateNames.length)throw new Error('Existing candidate secrets require separate reviewed update/rollback plan')
  // Only scoped names are written; unrelated project secrets are never sent.
  const write=await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`,{method:'POST',headers:{Authorization:`Bearer ${management.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(validateCandidateSecrets(candidate).map(name=>({name,value:candidate[name]}))),signal:AbortSignal.timeout(20000)})
  if(!write.ok)throw new Error('Candidate secret write failed: '+write.status)
  const deployed=spawnSync('pnpm',['dlx','supabase','functions','deploy',slug,'--project-ref',ref,'--no-verify-jwt'],{cwd:directory,env:{...process.env,SUPABASE_ACCESS_TOKEN:management.SUPABASE_ACCESS_TOKEN},encoding:'utf8',timeout:180000})
  // CLI output can contain provider context; do not echo it or secret values.
  if(deployed.status!==0)throw new Error('Candidate staging deployment failed; scoped secrets may remain, follow rollback')
  report.mode='staging-applied';report.remoteWrites=2
  await writeFile(path.join(directory,'prepare-report.json'),JSON.stringify(report,null,2))
 }
 console.log(JSON.stringify(report))
 return report
}
if(process.argv[1]===new URL(import.meta.url).pathname)await prepareCandidate()
