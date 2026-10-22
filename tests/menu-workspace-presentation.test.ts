import { describe,it,expect,vi } from 'vitest'
const state=vi.hoisted(()=>({tenant:'tenant-a',missing:false,draft:{menus:[],languages:['it']},where:vi.fn(),ensure:vi.fn()}))
vi.mock('../packages/db/src/index.ts',()=>({restaurants:{id:'restaurant-id',name:'restaurant-name'},menuItems:{},db:{select:()=>({from:()=>({where:(condition:unknown)=>{state.where(condition);return Promise.resolve(state.missing?[]:[{name:state.tenant==='tenant-a'?'Ristorante A':'Ristorante B'}])}})})}}))
vi.mock('../apps/server/src/middleware/auth.js',()=>({requireAuth:()=>{},requireRole:()=>async(req:unknown)=>{}}))
vi.mock('../apps/server/src/lib/menu-workspace-store.js',()=>({ensureWorkspace:async(tenant:string)=>{state.ensure(tenant);return {draft:state.draft,revision:7,published_revision:6}},mutateWorkspace:vi.fn(),WorkspaceConflict:class extends Error{},WorkspaceOwnership:class extends Error{}}))
vi.mock('../apps/server/src/lib/image-store.js',()=>({saveImageBuffer:vi.fn(),sniffImageMime:vi.fn(),UPLOADS_DIR:'/unused'}))
import Fastify from '../apps/server/node_modules/fastify/fastify.js'
import { menuWorkspaceRoutes } from '../apps/server/src/routes/menu-workspace.js'
import { foodCatalogs } from '../apps/server/src/lib/menu-workspace-catalogs.js'
describe('Workspace presentation envelope',()=>{
 it('reads only authenticated tenant name and keeps draft/revisions intact',async()=>{
  const app=Fastify();app.addHook('preHandler',async req=>{req.user={restaurantId:state.tenant,id:'owner'} as typeof req.user});await app.register(menuWorkspaceRoutes)
  try{for(const tenant of ['tenant-a','tenant-b']){state.tenant=tenant;state.missing=false;const response=await app.inject({url:'/'});expect(response.statusCode,response.body).toBe(200);expect(response.json()).toMatchObject({data:{menus:[]},revision:7,publishedRevision:6,presentation:{restaurantName:tenant==='tenant-a'?'Ristorante A':'Ristorante B',foodCatalogs}});expect(state.where.mock.lastCall?.[0].queryChunks).toContain(tenant);expect(state.where.mock.lastCall?.[0].queryChunks).toContain('restaurant-id');expect(state.ensure).toHaveBeenLastCalledWith(tenant)}expect(state.draft).toEqual({menus:[],languages:['it']})}finally{await app.close()}
 })
 it('returns display fallback when restaurant record is absent',async()=>{
  state.missing=true;const app=Fastify();app.addHook('preHandler',async req=>{req.user={restaurantId:'tenant-a',id:'owner'} as typeof req.user});await app.register(menuWorkspaceRoutes)
  try{const response=await app.inject({url:'/'});expect(response.statusCode,response.body).toBe(200);expect(response.json().presentation).toEqual({restaurantName:'Menu',foodCatalogs});expect(response.json().data).toMatchObject({menus:[]})}finally{state.missing=false;await app.close()}
 })
})
