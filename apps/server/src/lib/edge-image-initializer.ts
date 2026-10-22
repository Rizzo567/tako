import { createHash } from 'node:crypto'
import { DurableImageQuota, createImageQuotaExecutor, imageQuotaLimit, type QuotaSQLQuery } from './durable-image-quota.js'
import { edgeStaticImageCodec } from './edge-static-image-codec.js'

type Seed = { tenantId:string; checkpoint:string }
type Options = {
 env:Record<string,string|undefined>
 runtime:any
 runtimeVersion:string
 wasm:Uint8Array
 expectedWasmSha256:string
 query:QuotaSQLQuery
 milestone?:(stage:string)=>void
 seeds:readonly Seed[]
 install?:(codec:ReturnType<typeof edgeStaticImageCodec>,quota:DurableImageQuota)=>Promise<void>
}
const unavailable=()=>Object.assign(new Error('Edge image initialization unavailable'),{code:'EDGE_IMAGE_INITIALIZATION_UNAVAILABLE',statusCode:503})
type QuotaOptions={env:Record<string,string|undefined>;query:QuotaSQLQuery;milestone?:(stage:string)=>void;seeds:readonly Seed[]}
/** Controlli in sola lettura del registro quota (seed per locale + funzioni SQL), condivisi dai due avvii. */
async function verifyQuotaLedger(options:QuotaOptions,quotaBytes:number){
 if(!options.seeds.length||new Set(options.seeds.map(s=>s.tenantId)).size!==options.seeds.length)throw unavailable()
 options.milestone?.('image_before_seed_queries')
 for(const seed of options.seeds){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(seed.tenantId)||seed.checkpoint.length<16)throw unavailable()
  const rows=await options.query('SELECT (seeded_at IS NOT NULL AND seed_checkpoint=$2::text AND quota_bytes=$3::bigint) AS result FROM public.edge_image_quota_accounts WHERE tenant_id=$1::uuid',[seed.tenantId,seed.checkpoint,quotaBytes])
  if(rows.length!==1||rows[0]!.result!==true)throw unavailable()
 }
 options.milestone?.('image_seed_queries_complete')
 // SQL function existence is checked without invoking a mutating reservation.
 const functions=await options.query("SELECT (to_regprocedure('public.reserve_edge_image_quota(uuid,text,text,bigint,integer)') IS NOT NULL AND to_regprocedure('public.commit_edge_image_quota(uuid,text,bigint,text)') IS NOT NULL AND to_regprocedure('public.release_edge_image_quota(uuid,text,boolean)') IS NOT NULL AND to_regprocedure('public.reconcile_edge_image_quota(uuid,text,boolean,bigint,text)') IS NOT NULL) AS result",[])
 if(functions.length!==1||functions[0]!.result!==true)throw unavailable()
 options.milestone?.('image_function_query_complete')
}
/** 22/10/2026 — foto WhatsApp salvate senza ricodifica (passthrough): serve il registro quota durevole ma NON il codec.
 *  Stessi controlli in sola lettura di initializeEdgeImages, senza scaricare/compilare il WASM ImageMagick
 *  (che sull'edge sforava «CPU Time exceeded»). Installa solo la quota; il codec resta pigro per le foto che lo richiedono. */
export async function initializeEdgeImageQuota(options:QuotaOptions&{install?:(quota:DurableImageQuota)=>Promise<void>}){
 const {env}=options
 if(env.TAKO_EXECUTION_RUNTIME!=='edge'||env.UPLOADS_DRIVER!=='supabase'||!env.DATABASE_URL||!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw unavailable()
 const quotaBytes=imageQuotaLimit(env)
 try{
  await verifyQuotaLedger(options,quotaBytes)
  const quota=new DurableImageQuota(createImageQuotaExecutor(options.query))
  if(options.install)await options.install(quota)
  else{
   if(process.env.TAKO_EXECUTION_RUNTIME!=='edge'||process.env.UPLOADS_DRIVER!=='supabase')throw unavailable()
   const store=await import('./image-store.js')
   store.configureImageQuota(quota)
  }
  options.milestone?.('image_quota_install_complete')
  return {quotaBytes,seededTenants:options.seeds.length}
 }catch{throw unavailable()}
}
/** Explicit candidate bootstrap; never applies migrations, seeds or provider secrets. */
export async function initializeEdgeImages(options:Options){
 const {env}=options
 if(env.TAKO_EXECUTION_RUNTIME!=='edge'||env.UPLOADS_DRIVER!=='supabase'||!env.DATABASE_URL||!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw unavailable()
 if(options.runtimeVersion!=='0.0.44'||!options.wasm.length||!/^[a-f0-9]{64}$/.test(options.expectedWasmSha256)||createHash('sha256').update(options.wasm).digest('hex')!==options.expectedWasmSha256)throw unavailable()
 options.milestone?.('image_hash_verified')
 const quotaBytes=imageQuotaLimit(env)
 try{
  await verifyQuotaLedger(options,quotaBytes)
  const codec=edgeStaticImageCodec(options.runtime,options.wasm)
  const quota=new DurableImageQuota(createImageQuotaExecutor(options.query))
  if(options.install)await options.install(codec,quota)
  else{
   if(process.env.TAKO_EXECUTION_RUNTIME!=='edge'||process.env.UPLOADS_DRIVER!=='supabase')throw unavailable()
   const store=await import('./image-store.js')
   store.configureImageCodec(codec);store.configureImageQuota(quota)
  }
  options.milestone?.('image_install_complete')
  return {quotaBytes,seededTenants:options.seeds.length,runtimeVersion:options.runtimeVersion}
 }catch{throw unavailable()}
}
