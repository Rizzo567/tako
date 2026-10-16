import {it,expect,vi} from 'vitest'
import {createRequire} from 'node:module'
import {readFile} from 'node:fs/promises'
import {pdfWebpToPng} from '../apps/server/src/lib/pdf-webp-codec.js'
it('decodes WebP to PNG with the bounded PDF decoder and preserves transparency',async()=>{
 const require=createRequire(new URL('../apps/server/package.json',import.meta.url)),sharp=require('sharp')
 const wasm=await readFile(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'))
 const mock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(wasm))
 try{const input=await sharp({create:{width:128,height:96,channels:4,background:{r:240,g:100,b:50,alpha:.5}}}).webp().toBuffer();const png=await pdfWebpToPng(input);expect(png.subarray(1,4).toString()).toBe('PNG');const meta=await sharp(png).metadata();expect(meta.width).toBe(128);expect(meta.height).toBe(96);expect(meta.hasAlpha).toBe(true);expect(mock).toHaveBeenCalledTimes(1)}finally{mock.mockRestore()}
})
