import {createHash} from 'node:crypto'
import {DurableImageQuota,imageReservation} from './durable-image-quota.js'
export type EdgeImageStorage={upload():Promise<void>;download():Promise<Uint8Array>}
/** Immutable storage; never release uncertain writes or let concurrent retries overwrite. */
export async function persistEdgeImage(quota:DurableImageQuota,tenant:string,key:string,bytes:Uint8Array,storage:EdgeImageStorage){
 const contentHash=createHash('sha256').update(bytes).digest('hex'),reservation=imageReservation(tenant,key,contentHash,bytes.length)
 const state=await quota.reserve(reservation)
 if(state==='quota_exceeded')return 'quota_exceeded' as const
 if(state==='reconcile_required')return 'reconcile_required' as const
 if(state==='reserved')await storage.upload() // timeout/error leaves reservation intact for reconciliation
 const persisted=await storage.download()
 const persistedHash=createHash('sha256').update(persisted).digest('hex')
 if(persisted.length!==bytes.length||persistedHash!==contentHash)throw new Error('Persisted image verification failed')
 if(state==='reserved')await quota.commit(reservation,{bytes:persisted.length,contentHash:persistedHash})
 return 'committed' as const
}
