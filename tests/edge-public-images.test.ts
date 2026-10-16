import Fastify from 'fastify'
import {afterEach,expect,it,vi} from 'vitest'
import {remoteImageRoutes} from '../apps/server/src/routes/remote-images.js'
import {createApp} from '../apps/server/src/index.js'
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('Edge registers public image GET and HEAD without a local filesystem server',async()=>{
 for(const [key,value] of Object.entries({TAKO_MODE:'web',NODE_ENV:'development',WEB_ORIGIN:'https://fixture.invalid',JWT_SECRET:'fixture-secret-over-thirty-two-characters',TAKO_EXECUTION_RUNTIME:'edge',UPLOADS_DRIVER:'supabase'}))vi.stubEnv(key,value)
 const app=await createApp({runtime:'edge-candidate'})
 try{expect(app.hasRoute({method:'GET',url:'/uploads/:restaurantId/:filename'})).toBe(true);expect(app.hasRoute({method:'HEAD',url:'/uploads/:restaurantId/:filename'})).toBe(true)}finally{await app.close()}
})
it('public image bytes and HEAD metadata work while invalid paths never reach Storage',async()=>{
 vi.stubEnv('SUPABASE_URL','https://fixture.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','fixture-service-key-over-thirty-two-characters')
 const bytes=new Uint8Array([137,80,78,71]);const upstream=vi.fn(async()=>new Response(bytes,{headers:{'Content-Type':'image/png'}}));vi.stubGlobal('fetch',upstream)
 const app=Fastify();await app.register(remoteImageRoutes)
 try{
  const path='/uploads/00000000-0000-0000-0000-000000000001/abcdefghijklmnop.png'
  const image=await app.inject(path);expect(image.statusCode).toBe(200);expect([...image.rawPayload]).toEqual([...bytes]);expect(image.headers['cache-control']).toContain('immutable')
  const head=await app.inject({method:'HEAD',url:path});expect(head.statusCode).toBe(200);expect(head.headers['content-type']).toContain('image/png');expect(head.rawPayload.length).toBe(0)
  const calls=upstream.mock.calls.length;expect((await app.inject('/uploads/invalid/abcdefghijklmnop.png')).statusCode).toBe(404);expect(upstream.mock.calls.length).toBe(calls)
 }finally{await app.close()}
})
