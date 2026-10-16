import {describe,it,expect} from 'vitest'
import {loginGuard} from '../apps/server/src/lib/durable-login.js'
const secret='x'.repeat(32)
describe('durable login boundary',()=>{
 it('hashes identity and does not expose raw emails/IP',async()=>{
  const calls:string[][]=[];const guard=loginGuard({reserve:async(...args)=>{calls.push(args);return true},finish:async()=>true},secret)
  const reservation=await guard.reserve('127.0.0.1','Owner@Example.com');expect(reservation).not.toBeNull();expect(calls[0][1]).toMatch(/^[a-f0-9]{64}$/);expect(calls[0][1]).not.toBe(calls[0][2]);expect(JSON.stringify(calls)).not.toContain('Example');await reservation!.finish('success')
 })
 it('returns no reservation when locked',async()=>{
  const guard=loginGuard({reserve:async()=>false,finish:async()=>true},secret);expect(await guard.reserve('ip','x@y.it')).toBeNull()
 })
 it('fails closed on reserve outage and expired/failing finalization',async()=>{
  const broken=loginGuard({reserve:async()=>{throw new Error('private')},finish:async()=>true},secret);await expect(broken.reserve('ip','x@y.it')).rejects.toMatchObject({statusCode:503})
  const guard=loginGuard({reserve:async()=>true,finish:async()=>false},secret);const reservation=await guard.reserve('ip','x@y.it');await expect(reservation!.finish('success')).rejects.toMatchObject({statusCode:503})
 })
})
