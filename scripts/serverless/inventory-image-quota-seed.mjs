/** READ ONLY: inventory+download hashes. Never applies quota SQL or writes Storage. */
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises'
import {homedir} from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import postgres from 'postgres'
import {loadLocalEnvironment} from '../start-webapp.mjs'
const root=path.resolve(new URL('../../',import.meta.url).pathname)
const directory=path.join(homedir(),'.config/tako-webapp/image-quota-seed')
const env=await loadLocalEnvironment(root)
const origin=new URL(env.SUPABASE_URL)
if(origin.protocol!=='https:'||!origin.hostname.endsWith('.supabase.co'))throw Error('Invalid storage origin')
const bucket=env.SUPABASE_STORAGE_BUCKET??'tako-menu-images'
if(!/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket)||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Invalid storage configuration')
const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`}
const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(env.DATABASE_URL,{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}})
const digest=value=>createHash('sha256').update(value).digest('hex')
let stage='tenants'
try{
 const tenants=await db.begin('read only',tx=>tx`SELECT id,name FROM restaurants ORDER BY id`)
 await db.end()
 stage='initial inventory'
 async function listAll(){
  const objects=[];let directories=0
  async function walk(prefix){
   if(++directories>100000)throw Error('Inventory directory bound exceeded')
   for(let offset=0;offset<100000;offset+=1000){
    const response=await fetch(`${origin.origin}/storage/v1/object/list/${bucket}`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({prefix,offset,limit:1000,sortBy:{column:'name',order:'asc'}}),signal:AbortSignal.timeout(30000)})
    if(!response.ok)throw Error('Storage listing unavailable')
    const rows=await response.json();if(!Array.isArray(rows))throw Error('Invalid listing')
    for(const row of rows){
     const name=String(row.name??'');if(!name||/[\x00-\x1f]/.test(name)||name==='.'||name==='..'||name.includes('/'))throw Error('Invalid object name')
     const key=prefix?prefix+'/'+name:name
     if(!row.id&&!row.metadata)await walk(key)
     else{
      const bytes=Number(row.metadata?.size)
      if(!row.id||!Number.isSafeInteger(bytes)||bytes<0)throw Error('Invalid object size/identity')
      objects.push({key,id:row.id,bytes,updatedAt:row.updated_at??null,createdAt:row.created_at??null,etag:row.metadata?.eTag??row.metadata?.etag??null})
     }
    }
    if(rows.length<1000)return
   }
   throw Error('Inventory pagination bound exceeded')
  }
  await walk('')
  objects.sort((a,b)=>a.key.localeCompare(b.key));if(new Set(objects.map(o=>o.key)).size!==objects.length)throw Error('Duplicate object listing')
  return objects
 }
 const first=await listAll(),listingDigest=digest(JSON.stringify(first)),tenantMap=new Map(tenants.map(t=>[t.id,{tenantId:t.id,tenantName:t.name,assets:[],bytes:0}]))
 let cursor=0,totalBytes=0,completed=0
 stage='object hashes'
 await Promise.all(Array.from({length:4},async()=>{
  while(cursor<first.length){
   const index=cursor++,entry=first[index],tenantId=entry.key.split('/')[0],tenant=tenantMap.get(tenantId)
   if(!tenant)throw Error('Unassigned bucket object: inventory cannot seed all usage')
   const response=await fetch(`${origin.origin}/storage/v1/object/authenticated/${bucket}/${entry.key.split('/').map(encodeURIComponent).join('/')}`,{headers,signal:AbortSignal.timeout(60000)})
   if(!response.ok||!response.body)throw Error('Object download unavailable')
   const hash=createHash('sha256');let bytes=0
   for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>entry.bytes)throw Error('Object size changed while downloading');hash.update(chunk)}
   if(bytes!==entry.bytes)throw Error('Object size changed while downloading')
   const objectHash=digest(`tako-image-v1:${tenantId}\0${entry.key}`)
   tenant.assets.push({objectKey:entry.key,objectHash,contentHash:hash.digest('hex'),bytes,storageId:entry.id,updatedAt:entry.updatedAt})
   tenant.bytes+=bytes;totalBytes+=bytes;completed++
   if(completed%100===0)console.log(JSON.stringify({stage:'read-only hashes',completed,objects:first.length}))
  }
 }))
 stage='recheck inventory'
 const second=await listAll()
 if(digest(JSON.stringify(second))!==listingDigest)throw Error('Storage changed during inventory; checkpoint rejected')
 for(const t of tenantMap.values())t.assets.sort((a,b)=>a.objectKey.localeCompare(b.objectKey))
 const manifest={version:1,mode:'READ_ONLY_DRY_RUN_NOT_SEEDED',capturedAt:new Date().toISOString(),writesFrozen:false,seedRequiresFrozenRevalidation:true,bucket,quotaBytes:Number(env.UPLOADS_MAX_BYTES??2147483648),listingDigest,tenantCount:tenants.length,objectCount:first.length,totalBytes,tenants:[...tenantMap.values()]}
 const text=JSON.stringify(manifest,null,2)+'\n',checksum=digest(text)
 await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700)
 const file=path.join(directory,`manifest-${new Date().toISOString().replace(/[:.]/g,'-')}.json`)
 await writeFile(file,text,{mode:0o600});await writeFile(file+'.sha256',checksum+'\n',{mode:0o600})
 console.log(JSON.stringify({passed:true,mode:manifest.mode,tenantCount:tenants.length,objectCount:first.length,totalBytes,tenantsWithAssets:[...tenantMap.values()].filter(t=>t.assets.length).length,stableDoubleListing:true,sha256:checksum,privateManifest:file,remoteWrites:false}))
}catch{
 console.error(JSON.stringify({passed:false,stage,message:'Read-only inventory failed; no seed/checkpoint approved',remoteWrites:false}));process.exitCode=1
}finally{await db.end().catch(()=>{})}
