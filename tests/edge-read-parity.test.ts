// Parità read-edge ↔ servizio operativo per le GET autenticate spostate sulla read-edge.
// Le DUE strade girano sul codice vero (requireAuth, webBoundary, route Fastify, read-queries,
// edge-read-handler) e sullo stesso finto database: per ogni richiesta status e JSON devono
// coincidere al byte (dopo il parse), errori compresi.
import {createRequire} from 'node:module'
import {describe,it,expect,vi,beforeEach} from 'vitest'
const state=vi.hoisted(()=>({rows:new Map<unknown,any[]>(),selects:0,counter:1}))
vi.mock('../packages/db/src/index.ts',async importOriginal=>{
 const real:any=await importOriginal()
 const chain=()=>{let table:unknown;const q:any={from(t:unknown){table=t;return q},where(){return q},orderBy(){return q},limit(){return q},innerJoin(){return q},then(res:any,rej:any){return Promise.resolve(state.rows.get(table)??[]).then(res,rej)}};return q}
 return {...real,db:{select(){state.selects++;return chain()},execute:async()=>[],update(){throw Error('write not expected')},insert(){throw Error('write not expected')},delete(){throw Error('write not expected')}}}
})
vi.mock('../apps/server/src/index.js',()=>({io:{}}))
vi.mock('../apps/server/src/lib/durable-rate-store.js',()=>({postgresCounterExecutor:async()=>({current:state.counter,ttl:30000,iterationStartMs:0})}))
import {sessions,orders,orderItems,rooms,tables,waiterCalls,reservations,restaurants,bills,tableSessions} from '../packages/db/src/index.ts'
import {webBoundary} from '../apps/server/src/lib/web-runtime.js'
import {orderRoutes} from '../apps/server/src/routes/orders.js'
import {tableRoutes} from '../apps/server/src/routes/tables.js'
import {reservationRoutes} from '../apps/server/src/routes/reservations.js'
import {statsRoutes} from '../apps/server/src/routes/stats.js'
import {restaurantRoutes} from '../apps/server/src/routes/restaurants.js'
import {agencyRoutes} from '../apps/server/src/routes/agency.js'
import {authRoutes} from '../apps/server/src/routes/auth.js'
import {createEdgeReadHandler,fastifyQuery} from '../apps/server/src/lib/edge-read-handler.js'
const Fastify=createRequire(new URL('../apps/server/package.json',import.meta.url))('fastify')
const origin='https://takoitalia.example',secret='gateway-secret-longer-than-thirty-two-characters!'
const agency='737fad5f-6615-4860-8393-65e23547a8c4',tenant='11111111-1111-4111-8111-111111111111',tableA='22222222-2222-4222-8222-222222222222'
const env={...process.env,WEB_ORIGIN:origin,TAKO_GATEWAY_SECRET:secret,TAKO_RATE_LIMIT_SECRET:'rate-secret-longer-than-thirty-two-characters!!',JWT_SECRET:'jwt-secret-longer-than-thirty-two-characters!!!',TAKOMENU_AGENCY_USER_IDS:agency}
process.env.TAKOMENU_AGENCY_USER_IDS=agency
const at=(iso:string)=>new Date(iso)
function seed(role='owner',userId=agency){
 state.rows=new Map<unknown,any[]>([
  [sessions,[{session:{token:'short-token',expiresAt:at('2099-01-01T00:00:00Z'),kind:'staff'},user:{id:userId,name:'Manuel',email:'m@example.com',role,restaurantId:tenant,active:true}}]],
  [restaurants,[{id:tenant,name:'Locale',slug:'locale',settings:{timezone:'Europe/Rome'},createdAt:at('2026-01-02T03:04:05Z'),updatedAt:at('2026-10-10T10:00:00Z')}]],
  [orders,[{id:'o2',restaurantId:tenant,status:'pending',total:12.5,createdAt:at('2026-10-14T11:00:00Z')},{id:'o1',restaurantId:tenant,status:'served',total:8,createdAt:at('2026-10-14T10:00:00Z')}]],
  [orderItems,[{id:'i1',orderId:'o2',name:'Pasta',quantity:2,unitPrice:6.25,status:'pending'},{id:'i2',orderId:'o1',name:'Vino',quantity:1,unitPrice:8,status:'served'}]],
  [rooms,[{id:'r1',restaurantId:tenant,name:'Sala',active:true}]],
  [tables,[{id:tableA,number:'4',roomId:'r1',restaurantId:tenant,active:true,openedAt:null}]],
  [waiterCalls,[{id:'w1',restaurantId:tenant,tableId:tableA,createdAt:at('2026-10-14T09:00:00Z'),resolvedAt:null}]],
  [reservations,[{id:'res1',restaurantId:tenant,tableId:tableA,customerName:'Rossi',startsAt:at('2026-10-14T18:00:00Z'),durationMin:90},{id:'res2',restaurantId:tenant,tableId:null,customerName:'Bianchi',startsAt:at('2026-10-14T19:00:00Z'),durationMin:60}]],
  [bills,[{id:'b1',restaurantId:tenant,status:'closed',total:20.5,tip:1,discount:0,covers:2,closedAt:new Date(Date.now()-3600_000)}]],
  [tableSessions,[{id:'s1',restaurantId:tenant,scannedAt:new Date(Date.now()-7200_000),firstOrderAt:new Date(Date.now()-7000_000),timeToFirstOrderSec:200}]],
 ])
}
async function operational(){
 const app=Fastify();app.addHook('onRequest',webBoundary(origin))
 for(const [plugin,prefix] of [[authRoutes,'/api/auth'],[restaurantRoutes,'/api/restaurants'],[agencyRoutes,'/api/agency'],[tableRoutes,'/api/tables'],[orderRoutes,'/api/orders'],[statsRoutes,'/api/stats'],[reservationRoutes,'/api/reservations']] as const)await app.register(plugin as any,{prefix})
 await app.ready();return app
}
const edge=createEdgeReadHandler(env as any)
const edgeCall=(url:string,headers:Record<string,string>,method='GET')=>edge(new Request('https://edge.example/functions/v1/tako-read-candidate'+url,{method,headers:{'x-tako-gateway-secret':secret,'x-tako-gateway-origin':origin,'x-tako-client-ip':'203.0.113.9',...headers}}))
async function both(url:string,headers:Record<string,string>={authorization:'Bearer short-token'},method='GET'){
 const app=await operational();const a=await app.inject({method,url,headers});await app.close()
 const b=await edgeCall(url,headers,method);const text=await b.text()
 return {op:{status:a.statusCode,body:a.body?JSON.parse(a.body):null},edge:{status:b.status,body:text?JSON.parse(text):null,lane:b.headers.get('x-takomenu-read-lane')}}
}
const urls=['/api/auth/me','/api/orders/active','/api/orders/active?limit=1','/api/orders/active?limit=abc&before=2026-10-14T10:30:00Z','/api/orders/active?limit=1&limit=2','/api/tables/rooms','/api/tables/waiter-calls','/api/tables/waiter-calls?open=0','/api/reservations','/api/reservations?date=2026-10-14','/api/reservations?date=bad','/api/reservations?date=2026-10-14&date=2026-10-15','/api/reservations?date=2026-02-30','/api/stats/dashboard','/api/stats/dashboard?from=2026-10-01&to=2026-10-14','/api/stats/dashboard?from=garbage','/api/restaurants/me','/api/agency/me']
beforeEach(()=>{state.counter=1;seed()})
describe('read-edge parity with the operational routes',()=>{
 for(const url of urls)it('same status and JSON: '+url,async()=>{const r=await both(url);expect(r.edge.lane).toBe('1');expect(r.edge.status).toBe(r.op.status);expect(r.edge.body).toEqual(r.op.body)})
 it('same 401 without a session and same 403 for a foreign browser origin',async()=>{for(const url of urls.slice(0,3)){const none=await both(url,{});expect(none.edge.status).toBe(401);expect(none.edge.body).toEqual(none.op.body);const foreign=await both(url,{authorization:'Bearer short-token',origin:'https://evil.example'});expect(foreign.edge.status).toBe(403);expect(foreign.edge.body).toEqual(foreign.op.body)}})
 it('same role scoping: menu_editor gets the same 403 except on /api/auth/me; non-agency owner sees agency:false',async()=>{seed('menu_editor','33333333-3333-4333-8333-333333333333');for(const url of ['/api/auth/me','/api/orders/active','/api/tables/rooms','/api/stats/dashboard','/api/restaurants/me','/api/agency/me']){const r=await both(url);expect(r.edge.status).toBe(r.op.status);expect(r.edge.body).toEqual(r.op.body)}
  expect((await both('/api/orders/active')).edge.status).toBe(403);seed('owner','33333333-3333-4333-8333-333333333333');expect((await both('/api/agency/me')).edge.body).toEqual({data:{agency:false}})})
 it('same 404 when the restaurant row is missing',async()=>{state.rows.delete(restaurants);const r=await both('/api/restaurants/me');expect(r.edge.status).toBe(404);expect(r.edge.body).toEqual(r.op.body)})
 it('HEAD answers with the GET status and no body',async()=>{const r=await edgeCall('/api/orders/active',{authorization:'Bearer short-token'},'HEAD');expect(r.status).toBe(200);expect(await r.text()).toBe('')})
})
describe('durable limit runs in parallel but still refuses without data',()=>{
 it('over the limit: 429 with Retry-After and no tenant data, even though the read ran',async()=>{state.counter=101;const r=await edgeCall('/api/orders/active',{authorization:'Bearer short-token'});expect(r.status).toBe(429);expect(r.headers.get('retry-after')).toBe('30');const body=await r.text();expect(JSON.parse(body)).toEqual({error:{code:'RATE_LIMIT',message:'Troppe richieste. Riprova tra un minuto.'}});expect(body).not.toContain('o2')})
 it('over the limit wins over 401 like the operational onRequest limiter',async()=>{state.counter=101;expect((await edgeCall('/api/auth/me',{})).status).toBe(429)})
 it('anonymous paths stay sequential: no read when over the limit',async()=>{state.counter=101;const before=state.selects;const r=await edgeCall('/api/customer/restaurant/'+tenant+'/menu',{});expect(r.status).toBe(429);expect(state.selects).toBe(before)})
 it('unknown paths still answer 501 so the gateway falls back',async()=>{expect((await edgeCall('/api/orders/history',{authorization:'Bearer short-token'})).status).toBe(501)})
})
it('query parsing matches Fastify for repeated keys and prototype-like keys',()=>{const q=fastifyQuery(new URLSearchParams('a=1&a=2&a=3&b=&__proto__=x&c=a+b'));expect({...q}).toEqual({a:['1','2','3'],b:'',['__proto__']:'x',c:'a b'});expect(Object.getPrototypeOf(q)).toBe(null)})
it('the fixture is real data, not two empty answers',async()=>{/* il finto db ignora where/limit: conta solo che i dati arrivino davvero */const r=await both('/api/orders/active');expect(r.op.status).toBe(200);expect((r.op.body as any).data[0]).toEqual({id:'o2',restaurantId:tenant,status:'pending',total:12.5,createdAt:'2026-10-14T11:00:00.000Z',items:[{id:'i1',orderId:'o2',name:'Pasta',quantity:2,unitPrice:6.25,status:'pending'}]});const s=await both('/api/stats/dashboard');expect((s.op.body as any).data.revenue).toBe(20.5);const res=await both('/api/reservations?date=2026-10-14');expect((res.op.body as any).data.map((x:any)=>x.tableNumber)).toEqual(['4',null])})
