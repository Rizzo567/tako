import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {createApp,EDGE_SPIKE_CAPABILITIES} from '../apps/server/src/index.js'
afterEach(()=>vi.unstubAllEnvs())
function env(){vi.stubEnv('TAKO_MODE','web');vi.stubEnv('NODE_ENV','development');vi.stubEnv('WEB_ORIGIN','http://localhost:5137');vi.stubEnv('JWT_SECRET','test-factory-secret-over-thirty-two-characters')}
describe('request-only factory isolation',()=>{
 it('builds health without listener, assets, DB or authenticated API stubs',async()=>{env();const app=await createApp({runtime:'edge-spike'});try{expect(app.server.listening).toBe(false);const health=await app.inject('/health');expect(health.statusCode).toBe(200);expect(health.json().status).toBe('ok');expect((await app.inject('/api/auth/me')).statusCode).toBe(404);expect(EDGE_SPIKE_CAPABILITIES.productionReady).toBe(false);expect(EDGE_SPIKE_CAPABILITIES.unsupported).toContain('realtime')}finally{await app.close()}})
 it('builds the complete Node route graph without listening or querying DB',async()=>{env();const dir=await mkdtemp(join(tmpdir(),'tako-factory-'));vi.stubEnv('UPLOADS_DIR',dir);vi.stubEnv('UPLOADS_DRIVER','');vi.stubEnv('DATABASE_URL','postgresql://fixture:fixture@database.invalid/tako');const app=await createApp();try{expect(app.server.listening).toBe(false);expect(app.hasRoute({method:'POST',url:'/api/orders/'})).toBe(true);expect(app.hasRoute({method:'GET',url:'/api/restaurants/me'})).toBe(true);expect((await app.inject('/api/restaurants/me')).statusCode).toBe(401);expect((await app.inject('/health')).statusCode).toBe(200)}finally{await app.close();await rm(dir,{recursive:true,force:true})}})
 it('candidate requires explicit Edge runtime and remains prohibited in production',async()=>{env();vi.stubEnv('TAKO_EXECUTION_RUNTIME','node');await expect(createApp({runtime:'edge-candidate'})).rejects.toThrow('requires TAKO_EXECUTION_RUNTIME=edge');vi.stubEnv('TAKO_EXECUTION_RUNTIME','edge');vi.stubEnv('NODE_ENV','production');await expect(createApp({runtime:'edge-candidate'})).rejects.toThrow('cannot run in production')})
 it('rejects production use of incomplete edge runtime',async()=>{env();vi.stubEnv('NODE_ENV','production');await expect(createApp({runtime:'edge-spike'})).rejects.toThrow('cannot run in production')})
 it('retains browser origin boundary before route handling',async()=>{env();const app=await createApp({runtime:'edge-spike'});try{expect((await app.inject({method:'POST',url:'/api/auth/login',headers:{origin:'https://foreign.invalid'}})).statusCode).toBe(403)}finally{await app.close()}})
})
