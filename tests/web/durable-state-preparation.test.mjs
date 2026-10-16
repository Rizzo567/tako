import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {validateManifest,hash,readPrivateManifest,transactionSQL,applyPrepared,storageListing} from '../../scripts/serverless/apply-durable-state.mjs'
const tenant='00000000-0000-0000-0000-000000000001',key=tenant+'/image.jpg'
const asset={objectKey:key,objectHash:hash(`tako-image-v1:${tenant}\0${key}`),contentHash:'a'.repeat(64),bytes:1}
const manifest=()=>({version:1,mode:'READ_ONLY_DRY_RUN_NOT_SEEDED',quotaBytes:10,listingDigest:'b'.repeat(64),tenantCount:1,objectCount:1,totalBytes:1,tenants:[{tenantId:tenant,bytes:1,assets:[asset]}]})
test('manifest cannot hide assets, change quota, duplicate object or mismatch identities',()=>{
 assert.equal(validateManifest(manifest(),10).objectCount,1)
 assert.throws(()=>validateManifest(manifest(),20))
 const m=manifest();m.tenants[0].assets=[asset,asset];assert.throws(()=>validateManifest(m,10))
 assert.throws(()=>validateManifest({...manifest(),totalBytes:2},10))
})
test('private manifest checksum and file permission are mandatory',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'quota-manifest-test-')),file=path.join(dir,'manifest.json'),text=JSON.stringify(manifest())
 try{await writeFile(file,text,{mode:0o600});await writeFile(file+'.sha256',hash(text),{mode:0o600});assert.equal((await readPrivateManifest(file,10)).summary.objectCount,1);await chmod(file,0o644);await assert.rejects(readPrivateManifest(file,10),/private/);await chmod(file,0o600);await writeFile(file+'.sha256','0'.repeat(64));await assert.rejects(readPrivateManifest(file,10),/checksum/)}finally{await rm(dir,{recursive:true,force:true})}
})
test('prepared SQL is outer transaction compatible and forbids new grants',()=>{
 const s=transactionSQL('BEGIN;\nCREATE TABLE example(id int);\nCOMMIT;');assert.ok(!s.includes('BEGIN;'));assert.ok(!s.includes('COMMIT;'));assert.throws(()=>transactionSQL('BEGIN;\nGRANT ALL ON x TO anon;\nCOMMIT;'),/grants/)
})
test('apply cannot enter a transaction without external freeze acknowledgement',async()=>{
 let called=false;await assert.rejects(applyPrepared({begin:()=>{called=true}},manifest(),[],async()=>{}),/freeze/);assert.equal(called,false)
})
test('inventory traverses folders using only read-only list endpoint and retains exact identity',async()=>{
 const calls=[]
 const rows=await storageListing({origin:'https://example.supabase.co',bucket:'images',key:'private'},async(url,opts)=>{const body=JSON.parse(opts.body);calls.push({url,method:opts.method,prefix:body.prefix});return {ok:true,json:async()=>body.prefix?[{name:'image.jpg',id:'id',metadata:{size:1},updated_at:'today'}]:[{name:tenant,id:null,metadata:null}]}})
 assert.equal(rows[0].key,key);assert.equal(rows[0].bytes,1);assert.ok(calls.every(c=>c.method==='POST'&&c.url.includes('/object/list/')))
})
