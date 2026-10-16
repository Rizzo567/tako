import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import postgres from 'postgres'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const directory=await mkdtemp(path.join(tmpdir(),'tako-image-quota-'))
let started=false,client
const run=(name,args)=>execFileSync(`/opt/homebrew/opt/postgresql@17/bin/${name}`,args,{stdio:'pipe'})
const hash=n=>n.toString(16).padStart(64,'0'),content='a'.repeat(64)
try{
 run('initdb',['-D',path.join(directory,'data'),'-A','trust','--no-locale','--encoding=UTF8'])
 run('pg_ctl',['-D',path.join(directory,'data'),'-l',path.join(directory,'postgres.log'),'-o',`-k ${directory} -p 55441 -h ''`,'-w','start']);started=true
 client=postgres({host:directory,port:55441,database:'postgres',username:process.env.USER,max:12})
 await client.unsafe('CREATE ROLE anon; CREATE ROLE authenticated;')
 const reserved=await client.reserve()
 try{await reserved.unsafe(await readFile(new URL('./durable-image-quota.sql',import.meta.url),'utf8'))}finally{reserved.release()}
 const tenant=randomUUID(),other=randomUUID(),unknown=randomUUID()
 const reserve=async(t,key,bytes)=> (await client`select public.reserve_edge_image_quota(${t}::uuid,${key},${content},${bytes},1000) as state`)[0].state
 await assert.rejects(reserve(unknown,hash(0),1),/not seeded/)
 await assert.rejects(client`select public.seed_edge_image_quota(${unknown}::uuid,NULL::jsonb,'complete-inventory-checkpoint',10)`)
 const assets=[{object_hash:hash(1000),content_hash:content,bytes:1}]
 assert.equal((await client`select public.seed_edge_image_quota(${tenant}::uuid,${client.json(assets)}::jsonb,'complete-inventory-checkpoint',10) as seeded`)[0].seeded,true)
 assert.equal(await reserve(tenant,hash(1000),1),'committed','seed preserves existing content identity')
 await client`select public.seed_edge_image_quota(${other}::uuid,'[]'::jsonb,'complete-inventory-checkpoint',10)`
 const attempts=await Promise.all(Array.from({length:80},async(_,n)=>({key:hash(n+1),state:await reserve(tenant,hash(n+1),3)})))
 const accepted=attempts.filter(r=>r.state==='reserved');assert.equal(accepted.length,3)
 const total=(await client`select sum(bytes)::int as total from edge_image_quota_objects where tenant_id=${tenant}`)[0].total;assert.equal(total,10)
 await client`update edge_image_quota_objects set expires_at=clock_timestamp()-interval '1 hour' where tenant_id=${tenant} and state='reserved'`
 assert.equal(await reserve(tenant,hash(999),1),'quota_exceeded','expiry cannot release possibly persisted uploads')
 const first=accepted[0].key
 await assert.rejects(client`select public.release_edge_image_quota(${tenant}::uuid,${first},false)`)
 assert.equal((await client`select public.release_edge_image_quota(${tenant}::uuid,${first},true) as released`)[0].released,true)
 assert.equal(await reserve(tenant,hash(999),3),'reserved')
 await assert.rejects(client`select public.commit_edge_image_quota(${tenant}::uuid,${hash(999)},NULL::bigint,${content})`)
 await assert.rejects(client`select public.commit_edge_image_quota(${tenant}::uuid,${hash(999)},2,${content})`)
 const commits=await Promise.all(Array.from({length:20},()=>client`select public.commit_edge_image_quota(${tenant}::uuid,${hash(999)},3,${content}) as done`))
 assert.ok(commits.every(r=>r[0].done))
 assert.equal((await client`select public.release_edge_image_quota(${tenant}::uuid,${hash(999)},true) as released`)[0].released,false)
 const duplicate=await Promise.all(Array.from({length:40},()=>reserve(other,hash(1),2)))
 assert.equal(duplicate.filter(r=>r==='reserved').length,1);assert.equal(duplicate.filter(r=>r==='reconcile_required').length,39)
 await client`select public.commit_edge_image_quota(${other}::uuid,${hash(1)},2,${content})`
 assert.equal(await reserve(other,hash(1),2),'committed')
 await assert.rejects(reserve(other,hash(1),3),/size mismatch/)
 await client`select public.reconcile_edge_image_quota(${tenant}::uuid,${hash(999)},true,20,${'b'.repeat(64)})`
 assert.equal(await reserve(tenant,hash(1999),1),'quota_exceeded','actual excess persisted bytes must stay charged')
 await assert.rejects(client`select public.reconcile_edge_image_quota(${tenant}::uuid,${hash(999)},false,NULL::bigint,NULL::text)`)
 await client`select public.reconcile_edge_image_quota(${tenant}::uuid,${hash(999)},true,NULL::bigint,NULL::text)`
 assert.equal(await reserve(tenant,hash(1999),3),'reserved')
 assert.equal((await client`select public.seed_edge_image_quota(${tenant}::uuid,'[]'::jsonb,'new-inventory-checkpoint',10) as seeded`)[0].seeded,false,'cannot erase charged bytes by reseeding')
 const privileges=await client`select has_table_privilege('anon','edge_image_quota_objects','SELECT') as readable,has_function_privilege('authenticated','reserve_edge_image_quota(uuid,text,text,bigint,integer)','EXECUTE') as callable`
 assert.equal(privileges[0].readable,false);assert.equal(privileges[0].callable,false)
 console.log(JSON.stringify({passed:true,isolatedDatabase:true,remoteSchemaWrites:false,parallelReservations:80,parallelDuplicates:40,parallelCommits:20,checks:['seed required','seed cannot reset usage','atomic cap including legacy assets','expiry holds bytes','release proof required','commit size/hash confirmed','commit idempotent','duplicates reconcile before retry','actual excess persists charged','tenant isolation','public table and RPC denied']}))
}finally{
 if(client)await client.end()
 if(started)run('pg_ctl',['-D',path.join(directory,'data'),'-m','immediate','-w','stop'])
 await rm(directory,{recursive:true,force:true})
}
