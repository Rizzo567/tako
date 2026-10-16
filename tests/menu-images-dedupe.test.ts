import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest'
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const sharp=createRequire(new URL('../apps/server/package.json',import.meta.url))('sharp') as typeof import('../apps/server/node_modules/sharp')
let directory:string
beforeEach(async()=>{directory=await mkdtemp(join(tmpdir(),'tako-image-dedupe-'));vi.resetModules();vi.stubEnv('UPLOADS_DIR',directory);vi.stubEnv('UPLOADS_DRIVER','local')})
afterEach(async()=>{vi.unstubAllEnvs();await rm(directory,{recursive:true,force:true})})
describe('canonical immutable image dedupe',()=>{
 it('reuses canonical server reencoding and preserves tenant isolation',async()=>{const {saveImageBuffer}=await import('../apps/server/src/lib/image-store.js');const file=await sharp({create:{width:100,height:80,channels:4,background:{r:50,g:100,b:200,alpha:.5}}}).png().toBuffer();const tenant='26050ecd-2e55-4057-a4c5-bff2b449cd47';const [first,again]=await Promise.all([saveImageBuffer(tenant,file),saveImageBuffer(tenant,file)]);expect(again).toEqual(first);expect(await readdir(join(directory,tenant))).toHaveLength(1);if('url'in first){const stored=await readFile(join(directory,tenant,first.url.split('/').pop()!));expect((await sharp(stored).metadata()).hasAlpha).toBe(true)}const other=await saveImageBuffer('36050ecd-2e55-4057-a4c5-bff2b449cd47',file);expect(other).not.toEqual(first)})
 it('recognizes old random asset names without replacing historical bytes',async()=>{const {saveImageBuffer}=await import('../apps/server/src/lib/image-store.js');const {rename}=await import('node:fs/promises');const file=await sharp({create:{width:200,height:180,channels:3,background:'#ff8800'}}).jpeg({quality:92}).toBuffer();const tenant='26050ecd-2e55-4057-a4c5-bff2b449cd47';const first=await saveImageBuffer(tenant,file);if(!('url'in first))throw new Error(first.error);const old='abcdefghijklmnop.jpg';await rename(join(directory,tenant,first.url.split('/').pop()!),join(directory,tenant,old));const bytes=await readFile(join(directory,tenant,old));const next=await saveImageBuffer(tenant,file);expect(next).toEqual({url:`/uploads/${tenant}/${old}`});expect(await readFile(join(directory,tenant,old))).toEqual(bytes);expect(await readdir(join(directory,tenant))).toHaveLength(1)})
})
