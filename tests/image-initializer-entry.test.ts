import {it,expect} from 'vitest'
import {imageInitializerEntry,readPinnedWasm} from '../scripts/serverless/image-initializer-entry.mjs'
it('packages no-args entry with fixed asset, readonly env, TLS policy and bounded fetch',()=>{
 const source=imageInitializerEntry({initializerEntry:'/fixture/initializer.ts',databaseEntry:'/fixture/client.ts'})
 expect(source).toContain('export function initializeEdgeImages()')
 expect(source).toContain("env.TAKO_IMAGE_SEEDS_JSON")
 expect(source).not.toContain('Deno.env.set')
 expect(source).toContain('databaseOptions(env)')
 expect(source).toContain('image_before_postgres_construct')
 expect(source).toContain('image_wasm_fetch_headers')
 expect(source).toContain('image_wasm_download_complete')
 expect(source).toContain('Deno.memoryUsage()')
 expect(source).toContain('18*1024*1024')
 expect(source).toContain("redirect:'error'")
 expect(source).toContain('connection.unsafe(statement,[...parameters])')
 expect(source).toContain('b7d6710436b150dc5bd1ca04d80b6b7614c54854d7470f888f7e69a2a41b00e4')
})

it('reads pinned bytes with exact size and rejects overflow/truncation',async()=>{
 const response=(parts:number[][])=>new Response(new ReadableStream({start(controller){for(const part of parts)controller.enqueue(Uint8Array.from(part));controller.close()}}))
 expect(await readPinnedWasm(response([[1,2],[3,4]]),4)).toEqual(new Uint8Array([1,2,3,4]))
 await expect(readPinnedWasm(response([[1,2,3,4,5]]),4)).rejects.toThrow('too large')
 await expect(readPinnedWasm(response([[1,2,3]]),4)).rejects.toThrow('truncated')
 await expect(readPinnedWasm(new Response(new Uint8Array([1,2]),{headers:{'content-length':'2'}}),4)).rejects.toThrow('size mismatch')
})
