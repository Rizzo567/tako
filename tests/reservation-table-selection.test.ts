import { describe, it, expect, vi } from 'vitest'
const mock = vi.hoisted(() => ({ results: [] as any[], selections: [] as any[] }))
const fakeDb = { select: (fields: any) => { mock.selections.push(fields); const rows = mock.results.shift(); const chain: any = { from: () => chain, where: () => chain, limit: async () => rows, orderBy: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) }; return chain } }
import { overlapsReservation, publicReservationRooms, selectedReservationTableError } from '../apps/server/src/lib/reservation-tables.js'
const start = new Date('2030-10-20T18:00:00Z')
describe('public exact-table booking', () => {
 it('allows adjacent bookings and cancelled intervals; no-show follows staff overlap policy', () => {
  expect(overlapsReservation(start,90,{ startsAt:'2030-10-20T19:30:00Z',durationMin:90,status:'requested' })).toBe(false)
  expect(overlapsReservation(start,90,{ startsAt:start,durationMin:90,status:'cancelled' })).toBe(false)
  expect(overlapsReservation(start,90,{ startsAt:start,durationMin:90,status:'no_show' })).toBe(true)
  expect(overlapsReservation(start,90,{ startsAt:'2030-10-20T18:30:00Z',durationMin:90,status:'confirmed' })).toBe(true)
 })
 it('rejects missing/cross-tenant/inactive table and undersized table', async () => {
  mock.results=[[]]
  expect((await selectedReservationTableError(fakeDb as any,'tenant','foreign',start,2))?.code).toBe('TABLE_NOT_AVAILABLE')
  mock.results=[[{id:'small',seats:2}]]
  expect((await selectedReservationTableError(fakeDb as any,'tenant','small',start,3))?.code).toBe('TABLE_CAPACITY')
 })
 it('rejects a table whose room is disabled or belongs to another restaurant', async () => {
  mock.results=[[{id:'t1',seats:4,roomId:'closed'}],[]]
  expect((await selectedReservationTableError(fakeDb as any,'tenant','t1',start,2))?.code).toBe('TABLE_NOT_AVAILABLE')
 })
 it('rejects overlap at write time even after the client viewed availability', async () => {
  mock.results=[[{id:'t1',seats:4}],[{startsAt:start,durationMin:90,status:'requested'}]]
  expect((await selectedReservationTableError(fakeDb as any,'tenant','t1',start,2))?.code).toBe('RESERVATION_OVERLAP')
 })
 it('returns only public map fields and marks busy and undersized tables unavailable', async () => {
  mock.selections=[]
  mock.results=[[{id:'r1',name:'Sala'}],[{id:'a',roomId:'r1',number:'1',seats:4,shape:'round',posX:20,posY:30},{id:'b',roomId:null,number:'2',seats:2,shape:'square',posX:null,posY:null}],[{tableId:'a',startsAt:start,durationMin:90,status:'requested'}]]
  const result=await publicReservationRooms('tenant',start,3,90,fakeDb as any)
  expect(result).toHaveLength(2)
  expect(result.flatMap(room=>room.tables).map(table=>table.available)).toEqual([false,false])
  expect(Object.keys(result[0]!.tables[0]!).sort()).toEqual(['id','number','seats','shape','posX','posY','available'].sort())
  expect(mock.selections.flatMap(fields=>Object.keys(fields))).not.toContain('qrToken')
  expect(mock.selections.flatMap(fields=>Object.keys(fields))).not.toContain('customerName')
 })
})

// Exercise the actual info handler independently of server bootstrap, sockets or DB.
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { transformSync } from 'esbuild'
import { z } from 'zod'
function infoHandler(rows: any[]) {
 const source=readFileSync(new URL('../apps/server/src/routes/customer.ts',import.meta.url),'utf8')
 const from=source.indexOf("  fastify.get('/restaurant/:restaurantId/reservation-info'")
 const to=source.indexOf('  // PRENOTAZIONE self-service',from)
 let handler: any
 const chain: any={from:()=>chain,where:()=>chain,limit:async()=>rows}
 runInNewContext(transformSync(source.slice(from,to),{loader:'ts'}).code,{ z, fastify:{get:(_path:any,_config:any,fn:any)=>handler=fn},db:{select:()=>chain},restaurants:{},eq:()=>true })
 return handler
}
function infoReply(){return {status:200,headers:{} as Record<string,string>,code(n:number){this.status=n;return this},send(body:any){return body},header(k:string,v:string){this.headers[k]=v;return this}}}
describe('public booking info gate',()=>{
 it('validates restaurant UUID and rejects inactive restaurants',async()=>{
  const invalid=infoReply();await infoHandler([])({params:{restaurantId:'bad'}},invalid);expect(invalid.status).toBe(400)
  const inactive=infoReply();await infoHandler([{active:false}])({params:{restaurantId:'11111111-1111-4111-8111-111111111111'}},inactive);expect(inactive.status).toBe(404)
 })
 it('returns only restaurant name and real flag without cached/private data',async()=>{
  const reply=infoReply();const result=await infoHandler([{active:true,name:'Test',settings:{reservationsEnabled:true,secret:'private'},phone:'private'}])({params:{restaurantId:'11111111-1111-4111-8111-111111111111'}},reply)
  expect(JSON.parse(JSON.stringify(result))).toEqual({data:{restaurantName:'Test',reservationsEnabled:true}})
  expect(reply.headers['Cache-Control']).toBe('no-store')
 })
})
