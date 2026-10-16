import {Buffer} from 'node:buffer'
import {inspectStaticImage} from './static-image-policy.js'
let initialized:Promise<void>|undefined
/** A 138 KB decoder avoids initializing the upload ImageMagick runtime inside a PDF request. */
export async function pdfWebpToPng(input:Buffer):Promise<Buffer>{
 const info=inspectStaticImage(input)
 if(info.format!=='webp')return input
 const decoder=await import('@jsquash/webp/decode.js')
 initialized??=(async()=>{
  const response=await fetch('https://cdn.jsdelivr.net/npm/@jsquash/webp@1.5.0/codec/dec/webp_dec.wasm',{signal:AbortSignal.timeout(15000),redirect:'error'})
  if(!response.ok)throw new Error('PDF WebP decoder unavailable')
  const bytes=await response.arrayBuffer()
  if(bytes.byteLength!==137960||Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex')!=='30fb52fa2a80166d25ba7debf902218904ba1f05ccce9f959f722beff9e2f344')throw new Error('PDF WebP decoder integrity mismatch')
  await decoder.init({wasmBinary:bytes})
 })().catch(error=>{initialized=undefined;throw error})
 await initialized
 const image=await decoder.default(input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength) as ArrayBuffer)
 if(image.width!==info.width||image.height!==info.height)throw new Error('PDF WebP dimensions mismatch')
 const {PNG}=await import('pngjs')
 return PNG.sync.write({width:image.width,height:image.height,data:Buffer.from(image.data)} as any,{deflateLevel:3})
}
