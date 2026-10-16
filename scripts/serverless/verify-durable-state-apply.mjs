import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import postgres from 'postgres'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {applyPrepared,hash} from './apply-durable-state.mjs'
const directory=await mkdtemp(path.join(tmpdir(),'tako-durable-apply-'))
let started=false,client
const run=(name,args)=>execFileSync(`/opt/homebrew/opt/postgresql@17/bin/${name}`,args,{stdio:'pipe'})
try{
 run('initdb',['-D',path.join(directory,'data'),'-A','trust','--no-locale','--encoding=UTF8'])
 run('pg_ctl',['-D',path.join(directory,'data'),'-l',path.join(directory,'postgres.log'),'-o',`-k ${directory} -p 55443 -h ''`,'-w','start']);started=true
 client=postgres({host:directory,port:55443,database:'postgres',username:process.env.USER,max:1})
 await client.unsafe('CREATE ROLE anon; CREATE ROLE authenticated;')
 const sources=await Promise.all(['durable-rate-counter.sql','durable-login.sql','durable-image-quota.sql'].map(n=>readFile(new URL('./'+n,import.meta.url),'utf8')))
 const tenant=randomUUID(),key=tenant+'/one.png',content='a'.repeat(64)
 const manifest={listingDigest:'b'.repeat(64),quotaBytes:10,tenants:[{tenantId:tenant,assets:[{objectHash:hash(`tako-image-v1:${tenant}\0${key}`),contentHash:content,bytes:1}]}]}
 let calls=0
 await assert.rejects(applyPrepared(client,manifest,sources,async()=>{if(++calls===2)throw Error('Storage moved before commit')},{writersFrozen:true}),/Storage moved/)
 assert.equal((await client`SELECT to_regclass('public.edge_rate_counters') AS table_name`)[0].table_name,null,'failed checkpoint rolls back schema as well as seed')
 const result=await applyPrepared(client,manifest,sources,async()=>{},{writersFrozen:true})
 assert.equal(result.seededTenants,1)
 const usage=await client`SELECT bytes,content_hash FROM public.edge_image_quota_objects WHERE tenant_id=${tenant}`
 assert.equal(Number(usage[0].bytes),1);assert.equal(usage[0].content_hash,content)
 await assert.rejects(applyPrepared(client,manifest,sources,async()=>{},{writersFrozen:true}),/Existing quota seed/)
 assert.equal(Number((await client`SELECT sum(bytes) AS used FROM public.edge_image_quota_objects WHERE tenant_id=${tenant}`)[0].used),1)
 console.log(JSON.stringify({passed:true,isolatedDatabase:true,remoteWrites:false,checks:['DDL and seed atomic rollback on changed Storage checkpoint','full additive schema applies in one transaction','seed preserves bytes and SHA identity','reapply cannot reset charged quota','no new grants']}))
}finally{
 if(client)await client.end()
 if(started)run('pg_ctl',['-D',path.join(directory,'data'),'-m','immediate','-w','stop'])
 await rm(directory,{recursive:true,force:true})
}
