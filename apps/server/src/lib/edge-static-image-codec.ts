import { inspectStaticImage, STATIC_IMAGE_LIMITS } from './static-image-policy.js'
/** Runtime injection keeps the pinned WASM asset external to the Node boot graph. */
export const DOWNSCALE_TARGET_PIXELS=1_900_000
export const downscaleSize=(width:number,height:number,target=DOWNSCALE_TARGET_PIXELS)=>{const scale=Math.min(1,Math.sqrt(target/(width*height)));return{width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))}}
export function edgeStaticImageCodec(runtime:any,wasm:Uint8Array){
 let initialized:Promise<void>|undefined,tail=Promise.resolve(),pending=0
 const exclusive=async<T>(work:()=>T|Promise<T>)=>{
  if(pending>=2)throw new Error('IMAGE_CODEC_BUSY');pending++
  let release!:()=>void;const previous=tail;tail=new Promise<void>(resolve=>{release=resolve});await previous
  try{initialized??=runtime.initializeImageMagick(wasm);await initialized;runtime.ResourceLimits.memory=96n*1024n*1024n;runtime.ResourceLimits.disk=0n;runtime.ResourceLimits.listLength=8n;runtime.ResourceLimits.maxProfileSize=1024n*1024n;return await work()}finally{pending--;release()}
 }
 const codec=async(input:Uint8Array)=>{
  const info=inspectStaticImage(input) // reject bombs/animation before WASM allocation or decode
  return exclusive(()=>{
   const format=runtime.MagickFormat[info.format==='jpeg'?'Jpeg':info.format==='png'?'Png':'WebP']
   const settings=new runtime.MagickReadSettings({format})
   const ping=runtime.MagickImageInfo.create(input,settings)
   if(ping.width!==info.width||ping.height!==info.height||ping.width*ping.height>STATIC_IMAGE_LIMITS.pixels)throw new Error('INVALID_FILE_CONTENT')
   return runtime.ImageMagick.read(input,settings,(image:any)=>{
    if(image.width*image.height>STATIC_IMAGE_LIMITS.pixels)throw new Error('INPUT_PIXEL_LIMIT')
    image.autoOrient();image.strip();image.quality=85
    const outputFormat=info.format==='png'?'webp':info.format
    return image.write(outputFormat==='webp'?runtime.MagickFormat.WebP:format,(bytes:Uint8Array)=>{if(bytes.length>STATIC_IMAGE_LIMITS.bytes)throw new Error('OUTPUT_BYTE_LIMIT');return {bytes:Uint8Array.from(bytes),format:outputFormat,width:image.width,height:image.height}})
   })
  })
 }
 // JPEG above the pixel limit: libjpeg DCT scaling during decode keeps memory bounded, then resize under the limit.
 const downscale=async(input:Uint8Array,maxSourcePixels:number)=>{
  const info=inspectStaticImage(input,maxSourcePixels);if(info.width*info.height<=STATIC_IMAGE_LIMITS.pixels)return input;if(info.format!=='jpeg')throw new Error('INPUT_PIXEL_LIMIT')
  const size=downscaleSize(info.width,info.height)
  return exclusive(()=>{const settings=new runtime.MagickReadSettings({format:runtime.MagickFormat.Jpeg});settings.setDefine(runtime.MagickFormat.Jpeg,'size',`${size.width}x${size.height}`)
   return runtime.ImageMagick.read(input,settings,(image:any)=>{image.resize(size.width,size.height);if(image.width*image.height>STATIC_IMAGE_LIMITS.pixels)throw new Error('INPUT_PIXEL_LIMIT');image.autoOrient();image.strip();image.quality=90
    return image.write(runtime.MagickFormat.Jpeg,(bytes:Uint8Array)=>Uint8Array.from(bytes))})})
 }
 return Object.assign(codec,{downscale})
}
