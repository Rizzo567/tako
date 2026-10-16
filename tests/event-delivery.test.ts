import {describe,it,expect,vi} from 'vitest'
import {deliverPersistedEvent,POLLING_EVENT_SNAPSHOTS} from '../apps/server/src/lib/event-delivery.js'

describe('committed operational event delivery',()=>{
 it('Edge consumes persisted snapshots without touching sockets',()=>{
  const socket={to:vi.fn(()=>{throw Error('no Socket.IO in Edge')})}
  for(const event of Object.keys(POLLING_EVENT_SNAPSHOTS) as (keyof typeof POLLING_EVENT_SNAPSHOTS)[]){
   const result=deliverPersistedEvent(socket,'restaurant:one',event,{id:'one'},{persisted:true,runtime:'edge'})
   expect(result.mode).toBe('polling');expect('snapshots' in result&&result.snapshots.length).toBeGreaterThan(0)
  }
  expect(socket.to).not.toHaveBeenCalled()
 })
 it('refuses to report a transient or unsupported Edge event as durable',()=>{
  expect(()=>deliverPersistedEvent(undefined,'restaurant:one','waiter:called',{}, {persisted:false,runtime:'edge'})).toThrow('committed')
  expect(()=>deliverPersistedEvent(undefined,'restaurant:one','inventory:alert' as any,{}, {persisted:true,runtime:'edge'})).toThrow('supported polling')
 })
 it('preserves Node room, event and payload',()=>{
  const emit=vi.fn(),to=vi.fn(()=>({emit})),payload={id:'order',status:'ready'}
  expect(deliverPersistedEvent({to},'order:order','order:updated',payload,{persisted:true,runtime:'node'})).toEqual({mode:'socket',delivered:true})
  expect(to).toHaveBeenCalledWith('order:order');expect(emit).toHaveBeenCalledWith('order:updated',payload)
 })
 it('socket or logger failure cannot invalidate a committed write response',async()=>{
  let stored:any=null
  const write=async()=>{stored={id:'new-order',status:'pending'};return stored}
  const notify=vi.fn(()=>{throw Error('offline socket')})
  const handler=async()=>{
   const row=await write()
   const delivery=deliverPersistedEvent({to:()=>({emit:notify})},'restaurant:one','order:new',row,{persisted:true,runtime:'node',onError:()=>{throw Error('offline logger')}})
   return {status:201,data:row,delivery}
  }
  const response=await handler()
  expect(response.status).toBe(201);expect(response.data).toBe(stored);expect(response.delivery).toEqual({mode:'socket',delivered:false})
  expect(notify).toHaveBeenCalledOnce()
 })
 it('missing Node socket is an observable delivery failure, not mutation failure',()=>{
  const onError=vi.fn()
  expect(deliverPersistedEvent(undefined,'restaurant:one','reservation:changed',{id:'r'},{persisted:true,runtime:'node',onError})).toEqual({mode:'socket',delivered:false})
  expect(onError).toHaveBeenCalledOnce()
 })
})
