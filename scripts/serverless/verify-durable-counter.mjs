import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import postgres from 'postgres'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
const directory=await mkdtemp(path.join(tmpdir(),'tako-counter-'))
let started=false,client
const run=(name,args)=>execFileSync(`/opt/homebrew/opt/postgresql@17/bin/${name}`,args,{stdio:'pipe'})
try{
 run('initdb',['-D',path.join(directory,'data'),'-A','trust','--no-locale','--encoding=UTF8'])
 run('pg_ctl',['-D',path.join(directory,'data'),'-l',path.join(directory,'postgres.log'),'-o',`-k ${directory} -p 55439 -h ''`,'-w','start']);started=true
 client=postgres({host:directory,port:55439,database:'postgres',username:process.env.USER,max:8})
 await client.unsafe('CREATE ROLE anon; CREATE ROLE authenticated;')
 const reserved=await client.reserve()
 try{await reserved.unsafe(await readFile(new URL('./durable-rate-counter.sql',import.meta.url),'utf8'));await reserved.unsafe(await readFile(new URL('./durable-login.sql',import.meta.url),'utf8'))}finally{reserved.release()}
 const key='a'.repeat(64)
 const consume=async()=>Number((await client`select current from public.consume_edge_rate_counter('stress',${key},1000)`)[0].current)
 const hits=await Promise.all(Array.from({length:80},consume))
 assert.deepEqual(hits.sort((a,b)=>a-b),Array.from({length:80},(_,i)=>i+1))
 await client`update edge_rate_counters set expires_at=clock_timestamp()-interval '1 millisecond' where namespace='stress'`
 assert.equal(await consume(),1)
 const other=await client`select current from public.consume_edge_rate_counter('other',${key},1000)`
 assert.equal(Number(other[0].current),1)
 await assert.rejects(client`select * from public.consume_edge_rate_counter('stress',${key},0)`)
 const privileges=await client`select has_table_privilege('anon','edge_rate_counters','SELECT') as readable,has_function_privilege('authenticated','consume_edge_rate_counter(text,text,integer)','EXECUTE') as callable`
 assert.equal(privileges[0].readable,false);assert.equal(privileges[0].callable,false)
 const sprayIp='e'.repeat(64)
 const spray=await Promise.all(Array.from({length:40},async(_,i)=>{const hash=i.toString(16).padStart(64,'0');return (await client`select public.reserve_edge_login(${randomUUID()}::uuid,${hash},${sprayIp}) as allowed`)[0].allowed}))
 assert.equal(spray.filter(Boolean).length,30)
 const pair='b'.repeat(64),ip='c'.repeat(64)
 const ids=Array.from({length:20},()=>randomUUID())
 const slots=await Promise.all(ids.map(async id=>({id,allowed:(await client`select public.reserve_edge_login(${id}::uuid,${pair},${ip}) as allowed`)[0].allowed})))
 assert.equal(slots.filter(x=>x.allowed).length,5)
 for(const slot of slots.filter(x=>x.allowed))await client`select public.finish_edge_login(${slot.id}::uuid,'failure')`
 assert.equal((await client`select public.reserve_edge_login(${randomUUID()}::uuid,${pair},${ip}) as allowed`)[0].allowed,false)
 await client`update edge_login_buckets set expires_at=clock_timestamp()-interval '1 second'`
 const first=randomUUID(),second=randomUUID()
 assert.equal((await client`select public.reserve_edge_login(${first}::uuid,${pair},${ip}) as allowed`)[0].allowed,true)
 assert.equal((await client`select public.reserve_edge_login(${second}::uuid,${pair},${ip}) as allowed`)[0].allowed,true)
 await client`select public.finish_edge_login(${second}::uuid,'failure')`
 await client`select public.finish_edge_login(${first}::uuid,'success')`
 const preserved=await client`select failures-cleared as failures from edge_login_buckets where key_hash=${pair}`
 assert.equal(Number(preserved[0].failures),1)
 assert.equal((await client`select public.finish_edge_login(${first}::uuid,'failure') as done`)[0].done,false)
 console.log(JSON.stringify({passed:true,parallelHits:80,isolatedDatabase:true,checks:['atomic sequence','expiry reset','namespace isolation','window validation','anon table denied','authenticated RPC denied','login concurrent cap5','login IP spray cap30','login expiry reset','success preserves newer failures','finish idempotent']}))
}finally{
 if(client)await client.end()
 if(started)run('pg_ctl',['-D',path.join(directory,'data'),'-m','immediate','-w','stop'])
 await rm(directory,{recursive:true,force:true})
}
