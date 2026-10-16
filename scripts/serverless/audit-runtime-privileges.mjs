/** Read-only PostgreSQL privilege and RLS inventory, no customer row reads. */
import {readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'
import {loadLocalEnvironment} from '../start-webapp.mjs'
const root=path.resolve(new URL('../../',import.meta.url).pathname),env=await loadLocalEnvironment(root)
const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(env.DATABASE_URL,{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}})
try{
 const report=await db.begin('read only',async tx=>{
  const tables=await tx`SELECT c.relname AS table_name,r.rolname AS owner,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS force_rls,has_table_privilege('anon',c.oid,'SELECT') AS anon_select,has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,has_table_privilege('anon',c.oid,'UPDATE') AS anon_update,has_table_privilege('anon',c.oid,'DELETE') AS anon_delete,has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select,has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_insert,has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update,has_table_privilege('authenticated',c.oid,'DELETE') AS authenticated_delete FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname`
  const policies=await tx`SELECT tablename,policyname,roles,cmd,permissive,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`
  const sequences=await tx`SELECT c.relname AS sequence_name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S' ORDER BY c.relname`
  const functions=await tx`SELECT p.proname AS function_name,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef AS security_definer,has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname`
  return {mode:'READ_ONLY_PRIVILEGE_AUDIT',capturedAt:new Date().toISOString(),tables,policies,sequences,functions,remoteWrites:false}
 })
 await writeFile(path.join(root,'docs/webapp/activation/runtime-privileges-readonly.json'),JSON.stringify(report,null,2)+'\n')
 const exposed=report.tables.filter(t=>!t.rls_enabled&&(t.anon_select||t.anon_insert||t.anon_update||t.anon_delete||t.authenticated_select||t.authenticated_insert||t.authenticated_update||t.authenticated_delete))
 console.log(JSON.stringify({passed:true,tables:report.tables.length,rlsEnabled:report.tables.filter(t=>t.rls_enabled).length,unprotectedApiTables:exposed.map(t=>t.table_name),policies:report.policies.length,sequences:report.sequences.length,functions:report.functions.length,remoteWrites:false}))
}finally{await db.end()}
