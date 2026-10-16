import { describe, it, expect } from 'vitest'
import { DurableRateCounter } from '../apps/server/src/lib/durable-rate-counter.js'
const secret = 'x'.repeat(32)
describe('durable counter boundary', () => {
 it('does not pass raw IP/email to storage and isolates namespaces', async () => {
  const calls:unknown[][]=[]
  const execute=async(...args:[string,string,number])=>{calls.push(args);return {current:1,ttl:1000,iterationStartMs:1}}
  await new DurableRateCounter(execute,secret,'global').consume('127.0.0.1::owner@example.com',1000)
  await new DurableRateCounter(execute,secret,'login').consume('127.0.0.1::owner@example.com',1000)
  expect(calls[0][1]).toMatch(/^[a-f0-9]{64}$/);expect(calls[0][1]).not.toBe(calls[1][1]);expect(JSON.stringify(calls)).not.toContain('owner@example.com')
 })
 it('fails closed on database outage',async()=>{
  const store=new DurableRateCounter(async()=>{throw new Error('private database details')},secret,'global')
  await expect(store.consume('key',1000)).rejects.toMatchObject({statusCode:503,code:'RATE_STORE_UNAVAILABLE'})
  await expect(store.consume('key',1000)).rejects.not.toThrow('private database details')
 })
 it('rejects malformed storage responses',async()=>{
  const store=new DurableRateCounter(async()=>({current:0,ttl:1000,iterationStartMs:1}),secret,'global')
  await expect(store.consume('key',1000)).rejects.toMatchObject({statusCode:503})
 })
 it('requires bounded windows and a dedicated strong secret',async()=>{
  expect(()=>new DurableRateCounter(async()=>({current:1,ttl:1,iterationStartMs:1}),'short','global')).toThrow()
  const store=new DurableRateCounter(async()=>({current:1,ttl:1,iterationStartMs:1}),secret,'global')
  for(const window of [0,-1,Infinity,86400001,0.5])await expect(store.consume('key',window)).rejects.toThrow('Invalid counter window')
 })
})

import Fastify from '../apps/server/node_modules/fastify/fastify.js'
import rateLimit from '../apps/server/node_modules/@fastify/rate-limit/index.js'
import { durableStoreConstructor, optionalDurableStore } from '../apps/server/src/lib/durable-rate-store.js'
describe('Fastify durable store integration',()=>{
 it('supports callback and isolates child route buckets',async()=>{
  const counts=new Map<string,number>();const execute=async(ns:string,key:string,window:number)=>{const id=ns+key;const current=(counts.get(id)??0)+1;counts.set(id,current);return {current,ttl:window,iterationStartMs:1}}
  const app=Fastify();await app.register(rateLimit,{store:durableStoreConstructor(execute,secret),max:1,timeWindow:1000})
  app.get('/one',{config:{rateLimit:{max:1,timeWindow:1000}}},async()=>({ok:true}))
  app.get('/two',{config:{rateLimit:{max:1,timeWindow:1000}}},async()=>({ok:true}))
  expect((await app.inject('/one')).statusCode).toBe(200);expect((await app.inject('/one')).statusCode).toBe(429);expect((await app.inject('/two')).statusCode).toBe(200)
  await app.close()
 })
 it('returns 503 when missing migration/database fails, never runs handler',async()=>{
  const app=Fastify();let hit=false
  await app.register(rateLimit,{store:durableStoreConstructor(async()=>{throw new Error('missing relation')},secret),skipOnError:false})
  app.get('/',async()=>{hit=true;return {ok:true}})
  expect((await app.inject('/')).statusCode).toBe(503);expect(hit).toBe(false);await app.close()
 })
 it('leaves Node disabled and rejects invalid Edge configuration',()=>{
  expect(optionalDurableStore({})).toBeUndefined()
  expect(()=>optionalDurableStore({TAKO_DURABLE_RATE_LIMIT:'1'})).toThrow('Edge')
  expect(()=>optionalDurableStore({TAKO_DURABLE_RATE_LIMIT:'1',TAKO_EXECUTION_RUNTIME:'edge'})).toThrow('DATABASE_URL')
 })
})
it('recovers a transient database failure without allowing unverified access',async()=>{
 let calls=0;const store=new DurableRateCounter(async()=>{if(++calls===1)throw new Error('connection reset');return {current:2,ttl:1000,iterationStartMs:1}},secret,'global')
 expect((await store.consume('key',1000)).current).toBe(2);expect(calls).toBe(2)
})
