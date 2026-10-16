/** Default DRY RUN. Prepared schema/ledger only, not restaurant data or Storage. */
import {readFile,stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {homedir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import postgres from 'postgres'
import {loadLocalEnvironment} from '../start-webapp.mjs'
export const hash=value=>createHash('sha256').update(value).digest('hex')
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function validateManifest(manifest,quota){
 if(manifest.mode!=='READ_ONLY_DRY_RUN_NOT_SEEDED'||manifest.version!==1||manifest.quotaBytes!==quota||!Array.isArray(manifest.tenants)||manifest.tenantCount!==manifest.tenants.length||!/^[a-f0-9]{64}$/.test(manifest.listingDigest))throw Error('Invalid manifest/configuration')
 const tenants=new Set(),objects=new Set();let count=0,bytes=0
 for(const t of manifest.tenants){
  if(!uuid.test(t.tenantId)||tenants.has(t.tenantId)||!Array.isArray(t.assets))throw Error('Invalid tenant manifest')
  tenants.add(t.tenantId);let total=0
  for(const a of t.assets){
   if(typeof a.objectKey!=='string'||!a.objectKey.startsWith(t.tenantId+'/')||objects.has(a.objectKey)||!Number.isSafeInteger(a.bytes)||a.bytes<1||!/^[a-f0-9]{64}$/.test(a.contentHash)||a.objectHash!==hash(`tako-image-v1:${t.tenantId}\0${a.objectKey}`))throw Error('Invalid asset manifest')
   objects.add(a.objectKey);count++;bytes+=a.bytes;total+=a.bytes
  }
  if(t.bytes!==total)throw Error('Tenant byte total mismatch')
 }
 if(count!==manifest.objectCount||bytes!==manifest.totalBytes)throw Error('Manifest totals mismatch')
 return {tenantCount:tenants.size,objectCount:count,totalBytes:bytes}
}
export async function readPrivateManifest(file,quota){
 const info=await stat(file);if(info.mode&0o077)throw Error('Manifest must have private permissions')
 const text=await readFile(file,'utf8'),checksum=(await readFile(file+'.sha256','utf8')).trim()
 if(!/^[a-f0-9]{64}$/.test(checksum)||hash(text)!==checksum)throw Error('Manifest checksum mismatch')
 const manifest=JSON.parse(text);return {manifest,checksum,summary:validateManifest(manifest,quota)}
}
export async function storageListing(config,fetcher=fetch){
 const objects=[];let directories=0
 const headers={apikey:config.key,Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'}
 async function walk(prefix){
  if(++directories>100000)throw Error('Inventory bound exceeded')
  for(let offset=0;offset<100000;offset+=1000){
   const response=await fetcher(`${config.origin}/storage/v1/object/list/${config.bucket}`,{method:'POST',headers,body:JSON.stringify({prefix,offset,limit:1000,sortBy:{column:'name',order:'asc'}}),signal:AbortSignal.timeout(30000)})
   if(!response.ok)throw Error('Storage list unavailable')
   const rows=await response.json();if(!Array.isArray(rows))throw Error('Invalid listing')
   for(const row of rows){
    const name=String(row.name??'');if(!name||/[\x00-\x1f]/.test(name)||['.','..'].includes(name)||name.includes('/'))throw Error('Invalid object name')
    const key=prefix?prefix+'/'+name:name
    if(!row.id&&!row.metadata)await walk(key)
    else{const bytes=Number(row.metadata?.size);if(!row.id||!Number.isSafeInteger(bytes)||bytes<0)throw Error('Invalid object metadata');objects.push({key,id:row.id,bytes,updatedAt:row.updated_at??null,createdAt:row.created_at??null,etag:row.metadata?.eTag??row.metadata?.etag??null})}
   }
   if(rows.length<1000)return
  }
  throw Error('Inventory pagination exceeded')
 }
 await walk('');objects.sort((a,b)=>a.key.localeCompare(b.key));if(new Set(objects.map(o=>o.key)).size!==objects.length)throw Error('Duplicate listing');return objects
}
export async function roleAudit(db){
 const rows=await db`SELECT current_user AS role,rolsuper AS superuser,rolbypassrls AS bypass_rls,rolcreaterole AS create_role,rolcreatedb AS create_db FROM pg_roles WHERE rolname=current_user`
 const tables=await db`SELECT c.relname AS table_name,r.rolname AS owner,c.relrowsecurity AS rls,has_table_privilege(current_user,c.oid,'SELECT') AS can_select,has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,has_table_privilege(current_user,c.oid,'UPDATE') AS can_update,has_table_privilege(current_user,c.oid,'DELETE') AS can_delete FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='public' AND c.relname LIKE 'edge_%' ORDER BY c.relname`
 return {role:rows[0],existingDurableTables:tables,restrictedBackendRoleConfigured:tables.length>0&&!rows[0]?.superuser&&!rows[0]?.bypass_rls&&!rows[0]?.create_role&&!rows[0]?.create_db&&tables.every(t=>t.owner!==rows[0]?.role)}
}
export function transactionSQL(source){
 if(!/^BEGIN;$/m.test(source)||!/^COMMIT;$/m.test(source))throw Error('Prepared SQL must have transaction wrapper')
 if(/\bGRANT\b[^\n]*;/i.test(source.replace(/^--.*$/gm,'')))throw Error('New grants are forbidden in this migration')
 return source.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'')
}
export async function applyPrepared(db,manifest,sources,revalidate,{writersFrozen=false}={}){
 if(!writersFrozen)throw Error('External writer freeze is required')
 return db.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(hashtextextended('tako-durable-migration-v1',0))`
  await revalidate()
  for(const source of sources)await tx.unsafe(transactionSQL(source))
  let seeded=0
  for(const tenant of manifest.tenants){
   const assets=tenant.assets.map(a=>({object_hash:a.objectHash,content_hash:a.contentHash,bytes:a.bytes}))
   const rows=await tx`SELECT public.seed_edge_image_quota(${tenant.tenantId}::uuid,${tx.json(assets)}::jsonb,${manifest.listingDigest},${manifest.quotaBytes}::bigint) AS seeded`
   if(rows[0]?.seeded!==true)throw Error('Existing quota seed requires separate reconciliation; transaction aborted')
   seeded++
  }
  await revalidate() // abort SQL transaction if external state moved before commit
  return {seededTenants:seeded}
 })
}
export async function main(args=process.argv.slice(2)){
 const root=path.resolve(new URL('../../',import.meta.url).pathname),env=await loadLocalEnvironment(root)
 const manifestArg=args.indexOf('--manifest'),file=manifestArg<0?null:args[manifestArg+1]
 const privateRoot=path.join(homedir(),'.config/tako-webapp/image-quota-seed')
 if(!file||!path.resolve(file).startsWith(privateRoot+path.sep))throw Error('Explicit private --manifest required')
 const quota=Number(env.UPLOADS_MAX_BYTES??2147483648)
 if(!Number.isSafeInteger(quota)||quota<1)throw Error('Invalid quota configuration')
 const {manifest,checksum,summary}=await readPrivateManifest(file,quota)
 const origin=new URL(env.SUPABASE_URL);if(origin.protocol!=='https:'||!origin.hostname.endsWith('.supabase.co')||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Invalid Storage configuration')
 const config={origin:origin.origin,key:env.SUPABASE_SERVICE_ROLE_KEY,bucket:env.SUPABASE_STORAGE_BUCKET??'tako-menu-images'}
 if(manifest.bucket!==config.bucket)throw Error('Manifest bucket mismatch')
 const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
 const db=postgres(env.DATABASE_URL,{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}})
 try{
  const audit=await db.begin('read only',roleAudit)
  const revalidate=async()=>{if(hash(JSON.stringify(await storageListing(config)))!==manifest.listingDigest)throw Error('Storage checkpoint changed; seed rejected')}
  await revalidate()
  const sources=await Promise.all(['durable-rate-counter.sql','durable-login.sql','durable-image-quota.sql'].map(name=>readFile(new URL('./'+name,import.meta.url),'utf8')))
  sources.forEach(transactionSQL)
  if(!args.includes('--apply')){
   console.log(JSON.stringify({mode:'DRY_RUN_NO_WRITES',...summary,checksum,storageCheckpointValid:true,roleAudit:audit,applyRequires:'--apply --writers-frozen; freeze is external, never inferred from a stable list'}));return
  }
  if(!args.includes('--writers-frozen'))throw Error('Freeze flag required before applying')
  const result=await applyPrepared(db,manifest,sources,revalidate,{writersFrozen:true})
  console.log(JSON.stringify({mode:'ADDITIVE_SCHEMA_AND_QUOTA_SEED_APPLIED',...summary,...result,checksum,newGrants:false,storageWrites:false,roleAudit:audit}))
 }finally{await db.end()}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Durable-state preparation failed closed; no success declared. Inspect private configuration/checkpoint and writer freeze.');process.exitCode=1})
