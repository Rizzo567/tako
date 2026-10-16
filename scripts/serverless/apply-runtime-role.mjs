/** Prepared-only by default. No credential emitted to stdout or command line. */
import {readFile,stat} from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'
import {loadLocalEnvironment} from '../start-webapp.mjs'
export async function applyRuntimeRole(db,source,password){
 if(typeof password!=='string'||password.length<32||password.length>1024)throw Error('Private runtime password must be 32–1024 characters')
 return db.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(hashtextextended('takomenu-runtime-role-v1',0))`
  await tx.unsafe(source.replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,''))
  await tx`SELECT set_config('tako.private_runtime_password',${password},true)`
  await tx.unsafe("DO $$ BEGIN EXECUTE format('ALTER ROLE takomenu_runtime LOGIN PASSWORD %L',current_setting('tako.private_runtime_password')); END $$;")
  await tx`SELECT set_config('tako.private_runtime_password','',true)`
  return {applied:true,role:'takomenu_runtime',passwordPrinted:false}
 })
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const source=await readFile(new URL('./runtime-role-prepared.sql',import.meta.url),'utf8')
 if(!process.argv.includes('--apply')) console.log(JSON.stringify({mode:'DRY_RUN_NO_CONNECTION',role:'takomenu_runtime',tables:35,functions:7,createsActiveLogin:false}))
 else {
  const i=process.argv.indexOf('--private-password-file'),file=process.argv[i+1]
  if(i<0||!file)throw Error('Required private password file')
  const metadata=await stat(file)
  if((metadata.mode&0o077)!==0)throw Error('Password file must be private (0600)')
  const password=(await readFile(file,'utf8')).trim(),root=path.resolve(new URL('../../',import.meta.url).pathname),env=await loadLocalEnvironment(root)
  const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
  const db=postgres(env.DATABASE_URL,{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}})
  try {console.log(JSON.stringify(await applyRuntimeRole(db,source,password)))}catch {console.error('Runtime role transaction failed; no credential output. Check private diagnostics with migration operator.');process.exitCode=1}finally{await db.end()}
 }
}
