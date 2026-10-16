// Parità read-edge ↔ servizio operativo per GET /api/menu-workspace/publish/diff.
// Le due strade girano sul codice vero (requireAuth, webBoundary, route Fastify del menu,
// lib/menu-workspace-read.ts, edge-read-handler) e sullo stesso finto database.
import {createRequire} from 'node:module'
import {describe,it,expect,vi,beforeEach} from 'vitest'
const state=vi.hoisted(()=>({rows:new Map<unknown,any[]>(),workspace:null as any,writes:0}))
vi.mock('../packages/db/src/index.ts',async importOriginal=>{
 const real:any=await importOriginal()
 const chain=()=>{let table:unknown;const q:any={from(t:unknown){table=t;return q},where(){return q},orderBy(){return q},limit(){return q},innerJoin(){return q},then(res:any,rej:any){return Promise.resolve(state.rows.get(table)??[]).then(res,rej)}};return q}
 const write=()=>{state.writes++;throw Error('write not expected')}
 return {...real,db:{select(){return chain()},execute:async(query:any)=>{let text='';try{text=JSON.stringify(query?.queryChunks??'')}catch{};return text.includes('FROM menu_workspaces')&&state.workspace?[structuredClone(state.workspace)]:[]},update:write,insert:write,delete:write,transaction:write}}
})
vi.mock('../apps/server/src/index.js',()=>({io:{}}))
vi.mock('../apps/server/src/lib/durable-rate-store.js',()=>({postgresCounterExecutor:async()=>({current:1,ttl:30000,iterationStartMs:0})}))
import {sessions,restaurants} from '../packages/db/src/index.ts'
import {webBoundary} from '../apps/server/src/lib/web-runtime.js'
import {menuWorkspaceRoutes} from '../apps/server/src/routes/menu-workspace.js'
import {createEdgeReadHandler} from '../apps/server/src/lib/edge-read-handler.js'
const Fastify=createRequire(new URL('../apps/server/package.json',import.meta.url))('fastify')
const origin='https://takoitalia.example',secret='gateway-secret-longer-than-thirty-two-characters!'
const agency='737fad5f-6615-4860-8393-65e23547a8c4',tenant='11111111-1111-4111-8111-111111111111'
const env={...process.env,WEB_ORIGIN:origin,TAKO_GATEWAY_SECRET:secret,TAKO_RATE_LIMIT_SECRET:'rate-secret-longer-than-thirty-two-characters!!',JWT_SECRET:'jwt-secret-longer-than-thirty-two-characters!!!',TAKOMENU_AGENCY_USER_IDS:agency}
process.env.TAKOMENU_AGENCY_USER_IDS=agency
const menu=(id:string,name:string,price:number,extra:Record<string,unknown>={})=>({id,name,type:'dinner',active:true,translations:{},sections:[{id:'a2222222-2222-4222-8222-222222222222',name:'Primi',active:true,translations:{},items:[{id:'b3333333-3333-4333-8333-333333333333',name:'Carbonara',price,available:true,translations:{},variants:[],allergens:[],tags:[],...extra}]}]})
const published={menus:[menu('c4444444-4444-4444-8444-444444444444','Cena',12)]}
const draft={menus:[menu('c4444444-4444-4444-8444-444444444444','Cena serale',13.5,{description:'Guanciale'}),{...menu('d5555555-5555-4555-8555-555555555555','Pranzo',9),sections:[]}]}
function seed(role='owner',userId=agency,workspace:any={draft,published,revision:7,published_revision:5}){
 state.writes=0;state.workspace=workspace
 state.rows=new Map<unknown,any[]>([
  [sessions,[{session:{token:'short-token',expiresAt:new Date('2099-01-01T00:00:00Z'),kind:'staff'},user:{id:userId,name:'Manuel',email:'m@example.com',role,restaurantId:tenant,active:true}}]],
  [restaurants,[{id:tenant,name:'Locale',slug:'locale',settings:{}}]],
 ])
}
async function both(url='/api/menu-workspace/publish/diff',headers:Record<string,string>={authorization:'Bearer short-token'}){
 const app=Fastify();app.addHook('onRequest',webBoundary(origin));await app.register(menuWorkspaceRoutes as any,{prefix:'/api/menu-workspace'});await app.ready()
 const a=await app.inject({method:'GET',url,headers});await app.close()
 const b=await createEdgeReadHandler(env as any)(new Request('https://edge.example/functions/v1/tako-read-candidate'+url,{headers:{'x-tako-gateway-secret':secret,'x-tako-gateway-origin':origin,'x-tako-client-ip':'203.0.113.9',...headers}}))
 const text=await b.text()
 return {op:{status:a.statusCode,body:a.body?JSON.parse(a.body):null},edge:{status:b.status,body:text?JSON.parse(text):null,lane:b.headers.get('x-takomenu-read-lane')}}
}
beforeEach(()=>seed())
describe('publish diff: read-edge parity with the operational route',()=>{
 it('same status and JSON on a real draft ↔ published difference',async()=>{const r=await both();expect(r.edge.lane).toBe('1');expect(r.edge.status).toBe(200);expect(r.edge.body).toEqual(r.op.body);const d=r.op.body.data;expect(d.revision).toBe(7);expect(d.publishedRevision).toBe(5);expect(d.added.length).toBeGreaterThan(0);expect(d.changed.length).toBeGreaterThan(0);expect(state.writes).toBe(0)})
 it('same JSON when never published (published null) and when nothing changed',async()=>{seed('owner',agency,{draft,published:null,revision:3,published_revision:null});let r=await both();expect(r.edge.body).toEqual(r.op.body);seed('owner',agency,{draft,published:draft,revision:4,published_revision:4});r=await both();expect(r.edge.body).toEqual(r.op.body);expect([...r.op.body.data.added,...r.op.body.data.removed,...r.op.body.data.changed]).toEqual([])})
 it('same role and tenant scoping: menu_editor and manager allowed, waiter refused with the same 403',async()=>{for(const role of ['menu_editor','manager','waiter']){seed(role,'33333333-3333-4333-8333-333333333333');const r=await both();expect(r.edge.status).toBe(r.op.status);expect(r.edge.body).toEqual(r.op.body)}expect((await both()).edge.status).toBe(403)})
 it('same 401 without a session and same 403 for a foreign origin',async()=>{const none=await both(undefined,{});expect(none.edge.status).toBe(401);expect(none.edge.body).toEqual(none.op.body);const foreign=await both(undefined,{authorization:'Bearer short-token',origin:'https://evil.example'});expect(foreign.edge.status).toBe(403);expect(foreign.edge.body).toEqual(foreign.op.body)})
 it('workspace never created: the edge answers 501 (gateway falls back to the operational route, which creates it) and writes nothing',async()=>{seed('owner',agency,null);const b=await createEdgeReadHandler(env as any)(new Request('https://edge.example/functions/v1/tako-read-candidate/api/menu-workspace/publish/diff',{headers:{'x-tako-gateway-secret':secret,'x-tako-gateway-origin':origin,'x-tako-client-ip':'203.0.113.9',authorization:'Bearer short-token'}}));expect(b.status).toBe(501);expect(state.writes).toBe(0)})
})
