import {it,expect,vi} from 'vitest'
import {initializeNodeImageQuota} from '../apps/server/src/lib/node-image-quota-initializer.js'
const env={TAKO_DURABLE_IMAGE_QUOTA:'1',DATABASE_URL:'postgresql://fixture',UPLOADS_DRIVER:'supabase',SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'}
it('preserves Node default without opening a pool',async()=>{const connect=vi.fn();expect(await initializeNodeImageQuota({}, {connect})).toBeUndefined();expect(connect).not.toHaveBeenCalled()})
it('preflights readonly then installs durable ledger and returns pool cleanup',async()=>{const query=vi.fn(async()=>[{result:true}]),close=vi.fn(async()=>{}),install=vi.fn(async()=>{}),connect=vi.fn(()=>({query,close}));const state=await initializeNodeImageQuota(env,{connect,install});expect(connect.mock.calls[0]?.[1]).toMatchObject({max:1,prepare:false,ssl:{rejectUnauthorized:true}});expect(query.mock.calls[0]?.[0]).toMatch(/^SELECT/);expect(install).toHaveBeenCalledTimes(1);await state?.close();expect(close).toHaveBeenCalledTimes(1)})
it('fails closed and closes pool if seed/schema unavailable',async()=>{const close=vi.fn(async()=>{}),install=vi.fn(async()=>{});await expect(initializeNodeImageQuota(env,{connect:()=>({query:async()=>[{result:false}],close}),install})).rejects.toThrow('uploads remain blocked');expect(close).toHaveBeenCalledTimes(1);expect(install).not.toHaveBeenCalled()})

it('supports a Node CA file without weakening TLS',async()=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const directory=await mkdtemp(join(tmpdir(),'tako-quota-ca-'));const certificate=join(directory,'fixture.pem');await writeFile(certificate,'public-fixture-certificate');
 try{const connect=vi.fn(()=>({query:async()=>[{result:true}],close:async()=>{}}));await initializeNodeImageQuota({...env,DATABASE_CA_CERT_PATH:certificate},{connect,install:async()=>{}});const options=connect.mock.calls[0]?.[1];expect(options).toMatchObject({max:1,prepare:false,ssl:{rejectUnauthorized:true}});expect(typeof options?.ssl?.ca).toBe('string');expect(options?.ssl?.ca.length).toBeGreaterThan(0)}finally{await rm(directory,{recursive:true,force:true})}
})
