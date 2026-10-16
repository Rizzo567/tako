import {createHash} from 'node:crypto'
export const DEFAULT_IMAGE_QUOTA_BYTES=2*1024*1024*1024
export type ImageReservation={tenantId:string;objectHash:string;contentHash:string;bytes:number}
export type ReservationResult='reserved'|'committed'|'reconcile_required'|'quota_exceeded'
export type QuotaExecutor={
 reserve(reservation:ImageReservation,ttlMs:number):Promise<ReservationResult>
 commit(reservation:ImageReservation):Promise<boolean>
 release(reservation:ImageReservation):Promise<boolean>
 reconcile(reservation:ImageReservation,actualBytes:number|null,contentHash:string|null):Promise<boolean>
}
export type AbsenceProof={absent:true;uploadState:'never-started'|'completed-without-write'|'exclusive-reconciliation'}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function imageQuotaLimit(env:Record<string,string|undefined>=process.env){
 const value=Number(env.UPLOADS_MAX_BYTES??DEFAULT_IMAGE_QUOTA_BYTES)
 if(!Number.isSafeInteger(value)||value<1)throw new Error('Invalid image quota')
 return value
}
export function imageReservation(tenantId:string,immutableObjectKey:string,contentHash:string,bytes:number):ImageReservation{
 if(!uuid.test(tenantId)||!immutableObjectKey||immutableObjectKey.length>2048||/[\x00-\x1f]/.test(immutableObjectKey)||!/^[a-f0-9]{64}$/.test(contentHash)||!Number.isSafeInteger(bytes)||bytes<1)throw new Error('Invalid image reservation')
 return {tenantId,objectHash:createHash('sha256').update(`tako-image-v1:${tenantId}\0${immutableObjectKey}`).digest('hex'),contentHash,bytes}
}
const unavailable=()=>Object.assign(new Error('Quota immagini temporaneamente non verificabile'),{statusCode:503,code:'IMAGE_QUOTA_UNAVAILABLE'})
export class DurableImageQuota{
 constructor(private execute:QuotaExecutor){}
 async reserve(reservation:ImageReservation,ttlMs=300000):Promise<ReservationResult>{
  if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>3600000)throw new Error('Invalid reservation lease')
  try{const result=await this.execute.reserve(reservation,ttlMs);if(!['reserved','committed','reconcile_required','quota_exceeded'].includes(result))throw unavailable();return result}catch{throw unavailable()}
 }
 async commit(reservation:ImageReservation,verification:{bytes:number;contentHash:string}):Promise<void>{
  if(verification.bytes!==reservation.bytes||verification.contentHash!==reservation.contentHash)throw new Error('Storage size/hash confirmation required')
  try{if(!await this.execute.commit(reservation))throw unavailable()}catch{throw unavailable()}
 }
 async release(reservation:ImageReservation,proof:AbsenceProof):Promise<boolean>{
  // Expiry, request timeout and a HEAD404 during an in-flight PUT are NOT proofs.
  if(proof?.absent!==true||!['never-started','completed-without-write','exclusive-reconciliation'].includes(proof.uploadState))throw new Error('Settled upload and verified absence required')
  try{return await this.execute.release(reservation)}catch{throw unavailable()}
 }
 async reconcile(reservation:ImageReservation,observation:{state:'present';bytes:number;contentHash:string}|{state:'absent';proof:AbsenceProof}|{state:'indeterminate'}):Promise<void>{
  if(observation.state==='indeterminate')throw unavailable()
  let bytes:number|null=null,hash:string|null=null
  if(observation.state==='present'){
   if(!Number.isSafeInteger(observation.bytes)||observation.bytes<1||!/^[a-f0-9]{64}$/.test(observation.contentHash))throw new Error('Invalid persisted object size')
   bytes=observation.bytes;hash=observation.contentHash
  }else if(observation.proof?.absent!==true||observation.proof.uploadState!=='exclusive-reconciliation')throw new Error('Exclusive reconciliation required before decrement')
  try{if(!await this.execute.reconcile(reservation,bytes,hash))throw unavailable()}catch{throw unavailable()}
 }
}

/** SQL executor is injected; this module never opens a DB or applies a schema. */
export type QuotaSQLQuery=(statement:string,parameters:readonly unknown[])=>Promise<readonly {result:unknown}[]>
export function createImageQuotaExecutor(query:QuotaSQLQuery):QuotaExecutor{
 const result=async(statement:string,parameters:readonly unknown[])=>{
  const rows=await query(statement,parameters)
  if(rows.length!==1)throw unavailable()
  return rows[0]!.result
 }
 return {
  reserve:async(r,ttl)=>(await result('SELECT public.reserve_edge_image_quota($1::uuid,$2::text,$3::text,$4::bigint,$5::integer) AS result',[r.tenantId,r.objectHash,r.contentHash,r.bytes,ttl])) as ReservationResult,
  commit:async r=>(await result('SELECT public.commit_edge_image_quota($1::uuid,$2::text,$3::bigint,$4::text) AS result',[r.tenantId,r.objectHash,r.bytes,r.contentHash]))===true,
  release:async r=>(await result('SELECT public.release_edge_image_quota($1::uuid,$2::text,true) AS result',[r.tenantId,r.objectHash]))===true,
  reconcile:async(r,bytes,hash)=>(await result('SELECT public.reconcile_edge_image_quota($1::uuid,$2::text,true,$3::bigint,$4::text) AS result',[r.tenantId,r.objectHash,bytes,hash]))===true,
 }
}
