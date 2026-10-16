import postgres from 'postgres'
import {databaseOptions} from '@tako/db'
import {DurableImageQuota,createImageQuotaExecutor,imageQuotaLimit,type QuotaSQLQuery} from './durable-image-quota.js'

type Dependencies={connect?:(url:string,options:ReturnType<typeof databaseOptions>)=>{query:QuotaSQLQuery;close:()=>Promise<void>};install?:(quota:DurableImageQuota)=>Promise<void>}
/** Node opt-in shares the durable ledger after seed. No schema/seed mutations. */
export async function initializeNodeImageQuota(env:NodeJS.ProcessEnv=process.env,dependencies:Dependencies={}){
 if(env.TAKO_DURABLE_IMAGE_QUOTA!=='1')return undefined
 if(env.TAKO_EXECUTION_RUNTIME==='edge'||env.UPLOADS_DRIVER!=='supabase'||!env.DATABASE_URL||!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Durable Node image quota requires Supabase storage and database')
 const quotaBytes=imageQuotaLimit(env)
 // Explicit max1/TLS even on Node; local disk defaults are not suitable here.
 const nodeOptions=databaseOptions(env)
 const options={...nodeOptions,max:1,prepare:false,ssl:{rejectUnauthorized:true,...nodeOptions.ssl}}
 const connection=dependencies.connect?dependencies.connect(env.DATABASE_URL,options):(()=>{const client=postgres(env.DATABASE_URL!,options);return {query:async(statement:string,parameters:readonly unknown[])=>await client.unsafe<{result:unknown}[]>(statement,[...parameters] as any),close:async()=>{await client.end({timeout:2})}}})()
 try{
  const rows=await connection.query("SELECT (count(*)>0 AND bool_and(seeded_at IS NOT NULL AND seed_checkpoint IS NOT NULL AND quota_bytes=$1::bigint) AND to_regprocedure('public.reserve_edge_image_quota(uuid,text,text,bigint,integer)') IS NOT NULL AND to_regprocedure('public.commit_edge_image_quota(uuid,text,bigint,text)') IS NOT NULL AND to_regprocedure('public.release_edge_image_quota(uuid,text,boolean)') IS NOT NULL AND to_regprocedure('public.reconcile_edge_image_quota(uuid,text,boolean,bigint,text)') IS NOT NULL) AS result FROM public.edge_image_quota_accounts",[quotaBytes])
  if(rows.length!==1||rows[0]!.result!==true)throw new Error('Quota seed/functions unavailable')
  const quota=new DurableImageQuota(createImageQuotaExecutor(connection.query))
  if(dependencies.install)await dependencies.install(quota)
  else{const store=await import('./image-store.js');store.configureImageQuota(quota)}
  return {close:connection.close}
 }catch{await connection.close().catch(()=>{});throw new Error('Durable image quota unavailable; uploads remain blocked')}
}
