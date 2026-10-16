import {describe,it,expect} from 'vitest'
import {DurableImageQuota} from '../apps/server/src/lib/durable-image-quota.js'
import {persistEdgeImage} from '../apps/server/src/lib/edge-image-persistence.js'
const tenant='737fad5f-6615-4860-8393-65e23547a8c4',bytes=new Uint8Array([1,2,3])
describe('Edge image persist protocol',()=>{
 it('commits only after confirming persisted hash and size',async()=>{
  const calls:string[]=[];const quota=new DurableImageQuota({reserve:async()=>{calls.push('reserve');return'reserved'},commit:async()=>{calls.push('commit');return true},release:async()=>{calls.push('release');return true},reconcile:async()=>true})
  const state=await persistEdgeImage(quota,tenant,'object.webp',bytes,{upload:async()=>{calls.push('upload')},download:async()=>{calls.push('download');return bytes}})
  expect(state).toBe('committed');expect(calls).toEqual(['reserve','upload','download','commit'])
 })
 it('does not release ambiguous failed uploads',async()=>{
  let released=false,committed=false;const quota=new DurableImageQuota({reserve:async()=>'reserved',commit:async()=>{committed=true;return true},release:async()=>{released=true;return true},reconcile:async()=>true})
  await expect(persistEdgeImage(quota,tenant,'object.webp',bytes,{upload:async()=>{throw new Error('timeout')},download:async()=>bytes})).rejects.toThrow('timeout');expect(released).toBe(false);expect(committed).toBe(false)
 })
 it('does not upload duplicate pending or quota denied assets',async()=>{
  for(const state of ['reconcile_required','quota_exceeded'] as const){const quota=new DurableImageQuota({reserve:async()=>state,commit:async()=>true,release:async()=>true,reconcile:async()=>true});let uploaded=false;expect(await persistEdgeImage(quota,tenant,'object.webp',bytes,{upload:async()=>{uploaded=true},download:async()=>bytes})).toBe(state);expect(uploaded).toBe(false)}
 })
 it('fails closed on storage content mismatch',async()=>{
  let committed=false;const quota=new DurableImageQuota({reserve:async()=>'reserved',commit:async()=>{committed=true;return true},release:async()=>true,reconcile:async()=>true})
  await expect(persistEdgeImage(quota,tenant,'object.webp',bytes,{upload:async()=>{},download:async()=>new Uint8Array([3,2,1])})).rejects.toThrow('verification');expect(committed).toBe(false)
 })
})
