import { createRequire } from 'node:module'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ role: 'owner', writes: [] as any[], rows: [] as any[] }))
vi.doMock(createRequire(new URL('../apps/server/package.json',import.meta.url)).resolve('@tako/db'), () => ({
  tables: {}, rooms: {}, bills: {}, orders: {}, waiterCalls: {}, sessions: {}, users: {},
  db: {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => [{session:{kind:'staff',expiresAt:new Date(Date.now()+86400000)},user:{id:'actor',restaurantId:'tenant',role:state.role}}] }) }), where: () => ({ limit: async () => state.rows }) }) }),
    insert: (entity:any) => ({ values: (value:any) => ({ returning: async () => {state.writes.push(value);return [{id:'11111111-1111-4111-8111-111111111111',...value}]} }) }),
    update: () => ({ set: (value:any) => ({ where: () => ({returning: async () => {state.writes.push(value);return [{id:'11111111-1111-4111-8111-111111111111',...value}]}}) }) }),
  },
}))
vi.mock('../apps/server/src/lib/web-location-scope.js', () => ({resolveWebLocation: async (_:any,user:any) => ({restaurantId:user.restaurantId,role:user.role}),menuEditorAllowed:()=>true}))
vi.mock('../apps/server/src/index.js', () => ({io:{}}))
vi.mock('../apps/server/src/lib/event-delivery.js', () => ({deliverPersistedEvent:vi.fn()}))
vi.mock('../apps/server/src/lib/read-queries.js', () => ({readRooms:vi.fn(),readWaiterCalls:vi.fn()}))
const { tableRoutes } = await import('../apps/server/src/routes/tables.js')
import { webBoundary } from '../apps/server/src/lib/web-runtime.js'
const Fastify = createRequire(new URL('../apps/server/package.json',import.meta.url))('fastify')
const origin='https://tako.example.com', id='11111111-1111-4111-8111-111111111111'
async function app(){const server=Fastify();server.addHook('onRequest',webBoundary(origin));await server.register(tableRoutes,{prefix:'/api/tables'});return server}
const endpoints=[{method:'POST',url:'/api/tables/rooms',payload:{name:'Terrazza'}},{method:'POST',url:'/api/tables',payload:{number:'1',seats:4}},{method:'PATCH',url:'/api/tables/'+id,payload:{posX:20,posY:30,seats:4}}] as const
beforeEach(()=>{state.role='owner';state.writes=[];state.rows=[]})
describe('real table routes with browser boundary and real owner authorization',()=>{
 it.each(endpoints)('allows owner configuration $method $url and persists tenant scope',async endpoint=>{const server=await app();const res=await server.inject({...endpoint,headers:{origin,authorization:'Bearer valid'}});expect(res.statusCode).toBe(endpoint.method==='POST'?201:200);expect(state.writes).toHaveLength(1);if(endpoint.method==='POST')expect(state.writes[0].restaurantId).toBe('tenant');await server.close()})
 it.each(endpoints)('rejects missing/foreign origin, missing login, and nonowner $method $url',async endpoint=>{const server=await app();for(const headers of [{authorization:'Bearer valid'},{origin:'https://evil.example.com',authorization:'Bearer valid'}])expect((await server.inject({...endpoint,headers})).statusCode).toBe(403);expect((await server.inject({...endpoint,headers:{origin}})).statusCode).toBe(401);for(const role of ['manager','cameriere','menu_editor']){state.role=role;expect((await server.inject({...endpoint,headers:{origin,authorization:'Bearer valid'}})).statusCode).toBe(403)}expect(state.writes).toHaveLength(0);await server.close()})
 it('trims room names, rejects whitespace/overlong names, excessive seats and fractional positions',async()=>{const server=await app(),headers={origin,authorization:'Bearer valid'};for(const name of ['   ','x'.repeat(81)])expect((await server.inject({method:'POST',url:'/api/tables/rooms',headers,payload:{name}})).statusCode).toBe(400);expect((await server.inject({method:'POST',url:'/api/tables/rooms',headers,payload:{name:'  Patio  '}})).json().data.name).toBe('Patio');for(const payload of [{seats:51},{posX:1.5},{posY:2.5},{posX:101},{}])expect((await server.inject({method:'PATCH',url:'/api/tables/'+id,headers,payload})).statusCode).toBe(400);await server.close()})
 it('keeps QR, delete, unknown config paths unavailable and refuses foreign rooms',async()=>{const server=await app(),headers={origin,authorization:'Bearer valid'};for(const [method,url] of [['GET',`/api/tables/${id}/qr`],['POST',`/api/tables/${id}/qr/refresh`],['DELETE',`/api/tables/${id}`],['PATCH','/api/tables/not-a-uuid'],['POST','/api/tables/other']])expect((await server.inject({method,url,headers})).statusCode).toBe(404);for(const endpoint of [endpoints[1],endpoints[2]])expect((await server.inject({...endpoint,headers,payload:{...endpoint.payload,roomId:id}})).statusCode).toBe(404);expect(state.writes).toHaveLength(0);await server.close()})
})
