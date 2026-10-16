import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import postgres from 'postgres'
import assert from 'node:assert/strict'
import {applyRuntimeRole} from './apply-runtime-role.mjs'
const directory=await mkdtemp(path.join(tmpdir(),'tako-role-'))
const run=(name,args)=>execFileSync(`/opt/homebrew/opt/postgresql@17/bin/${name}`,args,{stdio:'pipe'})
let db,started=false
try {
 run('initdb',['-D',directory+'/data','-A','trust','--no-locale','--encoding=UTF8'])
 run('pg_ctl',['-D',directory+'/data','-l',directory+'/log','-o',`-k ${directory} -p 55445 -h ''`,'-w','start']);started=true
 db=postgres({host:directory,port:55445,database:'postgres',username:process.env.USER,max:1})
 await db.unsafe('CREATE ROLE anon; CREATE ROLE authenticated; REVOKE CREATE ON SCHEMA public FROM PUBLIC;')
 const matrix=JSON.parse(await readFile(new URL('./runtime-role-grants.json',import.meta.url)))
 for(const table of Object.keys(matrix).filter(t=>!t.startsWith('edge_'))) await db.unsafe(`CREATE TABLE public.${table}(id uuid, tenant_id uuid);`)
 await db.unsafe('CREATE TABLE public.staff_shifts(id uuid); INSERT INTO public.restaurants VALUES(gen_random_uuid(),gen_random_uuid()),(gen_random_uuid(),gen_random_uuid());')
 for(const name of ['durable-rate-counter.sql','durable-login.sql','durable-image-quota.sql']) await db.unsafe(await readFile(new URL('./'+name,import.meta.url),'utf8'))
 await db.unsafe(await readFile(new URL('./runtime-role-prepared.sql',import.meta.url),'utf8'))
 const role=(await db`SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit FROM pg_roles WHERE rolname='takomenu_runtime'`)[0]
 for(const value of Object.values(role)) assert.equal(value,false)
 await db.unsafe('SET ROLE takomenu_runtime')
 assert.equal(Number((await db`SELECT count(*) AS n FROM public.restaurants`)[0].n),2)
 await db`SELECT * FROM public.edge_image_quota_accounts FOR UPDATE`
 assert.equal(Number((await db`SELECT current FROM public.consume_edge_rate_counter('test',${'a'.repeat(64)},1000)`)[0].current),1)
 for(const sql of ['CREATE TABLE public.not_allowed(id int)','ALTER TABLE public.rooms ADD COLUMN blocked int','CREATE ROLE blocked','UPDATE public.edge_image_quota_accounts SET quota_bytes=10','INSERT INTO public.rooms VALUES(gen_random_uuid(),gen_random_uuid())','SELECT * FROM public.staff_shifts']) await assert.rejects(db.unsafe(sql),/permission|owner/i)
 await db.unsafe('RESET ROLE')
 const publicAudit=await db`SELECT has_table_privilege('anon','public.restaurants','SELECT') AS anon,has_table_privilege('authenticated','public.restaurants','SELECT') AS authenticated,has_function_privilege('takomenu_runtime','public.seed_edge_image_quota(uuid,jsonb,text,bigint)','EXECUTE') AS seed,has_database_privilege('takomenu_runtime',current_database(),'TEMP') AS temporary_ddl`
 assert.equal(publicAudit[0].anon,false);assert.equal(publicAudit[0].authenticated,false);assert.equal(publicAudit[0].seed,false)
 const policies=await db`SELECT roles AS policyroles FROM pg_policies WHERE policyname='takomenu_runtime_backend'`
 for(const p of policies)assert.deepEqual(p.policyroles,['takomenu_runtime'])
 await db.unsafe('DROP OWNED BY takomenu_runtime; DROP ROLE takomenu_runtime')
 const roleSource=await readFile(new URL('./runtime-role-prepared.sql',import.meta.url),'utf8')
 await assert.rejects(applyRuntimeRole(db,roleSource+'\nSELECT missing_activation_gate;', 'isolated-only-password-'.repeat(3)))
 assert.equal(Number((await db`SELECT count(*) AS n FROM pg_roles WHERE rolname='takomenu_runtime'`)[0].n),0)
 await applyRuntimeRole(db,roleSource,'isolated-only-password-'.repeat(3))
 assert.equal((await db`SELECT rolcanlogin FROM pg_roles WHERE rolname='takomenu_runtime'`)[0].rolcanlogin,true)
 const result={passed:true,isolatedDatabase:true,remoteWrites:false,tables:Object.keys(matrix).length,checks:['role cannot login or escalate','private cross-tenant policy explicitly works','persistent DDL denied','least DML grants enforced','quota account FOR UPDATE works with column-only update','durable invoker counter works','anonymous grants and runtime seed execute absent','policies target dedicated role only','activation runner rollback atomic and private login enabled only on explicit apply'],temporaryDDLInherited:publicAudit[0].temporary_ddl}
 await writeFile(new URL('../../docs/webapp/activation/runtime-role-isolated-verification.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
} finally {if(db)await db.end();if(started)run('pg_ctl',['-D',directory+'/data','-m','immediate','-w','stop']);await rm(directory,{recursive:true,force:true})}
