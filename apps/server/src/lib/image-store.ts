import { Buffer } from 'node:buffer'
// ─────────────────────────── Tako — STORAGE IMMAGINI (riusabile) ───────────────────────────
// Salvataggio immagini piatti su disco (/uploads/<restaurantId>/), con validazione magic
// bytes + re-encode sharp (anti decompression-bomb, strip metadati, resize) + quota per
// ristorante. Estratto dalla route POST /api/uploads/image così che ANCHE il canale
// WhatsApp e il copilot in-app possano salvare un'immagine (stessa pipeline e stessi tetti).
import { createWriteStream, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { galleryInventory } from './menu-workspace-gallery.js'
import { DurableImageQuota } from './durable-image-quota.js'
import { persistEdgeImage } from './edge-image-persistence.js'
import { inspectStaticImage, STATIC_IMAGE_LIMITS } from './static-image-policy.js'
import { remoteStorageEnabled, remoteImageUsage, uploadRemoteImage, downloadRemoteImage } from './remote-image-store.js'

export const UPLOADS_DIR = process.env['UPLOADS_DIR'] ?? './uploads'
if(process.env['TAKO_EXECUTION_RUNTIME']!=='edge')mkdirSync(UPLOADS_DIR, { recursive: true })

const MAX_UPLOADS_BYTES = Number(process.env['UPLOADS_MAX_BYTES'] ?? 2 * 1024 * 1024 * 1024)
const MAX_INPUT_PIXELS = 2_000_000
const MAX_DIMENSION = 2000

export const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MIME_TO_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

const tenantUsedBytes = new Map<string, number>()
const tenantInFlightBytes = new Map<string, number>()
const remoteTenantWrites = new Map<string, Promise<void>>()

function seedTenantUsage(tenantDir: string): number {
  try {
    return readdirSync(tenantDir).reduce((n, f) => {
      try { return n + statSync(join(tenantDir, f)).size } catch { return n }
    }, 0)
  } catch { return 0 }
}

// Riconosce il tipo immagine dai magic bytes reali (non dall'header, falsificabile).
export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

export type EdgeImageCodec=((input:Uint8Array)=>Promise<{bytes:Uint8Array;format:'jpeg'|'png'|'webp';width:number;height:number}>)&{downscale?:(input:Uint8Array,maxSourcePixels:number)=>Promise<Uint8Array>}
let configuredEdgeCodec:EdgeImageCodec|undefined
let configuredEdgeQuota:DurableImageQuota|undefined
let configuredEdgeInitializer:(()=>Promise<unknown>)|undefined
export function configureImageInitializer(initialize:()=>Promise<unknown>){configuredEdgeInitializer=initialize}
export function configureImageQuota(quota:DurableImageQuota){configuredEdgeQuota=quota}
export function configureImageCodec(codec:EdgeImageCodec){configuredEdgeCodec=codec}

/** PDFKit accepts PNG/JPEG; normalize stored WebP without changing the gallery asset. */
export async function imageBufferForPdf(buf:Buffer):Promise<Buffer>{
 if(sniffImageMime(buf)!=='image/webp')return buf
 if(process.env['TAKO_EXECUTION_RUNTIME']==='edge'){const {pdfWebpToPng}=await import('./pdf-webp-codec.js');return pdfWebpToPng(buf)}
 const {default:sharp}=await import('sharp')
 return sharp(buf,{limitInputPixels:MAX_INPUT_PIXELS}).png().toBuffer()
}

/** JPEG oltre 2 MP (es. foto WhatsApp HD): ridotta sotto il limite prima della pipeline standard di saveImageBuffer. */
export async function downscaleOversizedImage(buf:Buffer,maxSourcePixels=50_000_000):Promise<Buffer>{
 const {inspectStaticImage:inspect,STATIC_IMAGE_LIMITS:limits}=await import('./static-image-policy.js');const info=inspect(buf,maxSourcePixels)
 if(info.width*info.height<=limits.pixels)return buf;if(info.format!=='jpeg')throw new Error('INPUT_PIXEL_LIMIT')
 if(process.env['TAKO_EXECUTION_RUNTIME']==='edge'){if(!configuredEdgeCodec&&configuredEdgeInitializer)await configuredEdgeInitializer();if(!configuredEdgeCodec?.downscale)throw new Error('EDGE_CODEC_REQUIRED');return Buffer.from(await configuredEdgeCodec.downscale(new Uint8Array(buf),maxSourcePixels))}
 const {default:sharp}=await import('sharp'),{downscaleSize}=await import('./edge-static-image-codec.js'),size=downscaleSize(info.width,info.height)
 const side=Math.max(size.width,size.height);return sharp(buf,{limitInputPixels:maxSourcePixels}).rotate().resize({width:side,height:side,fit:'inside'}).jpeg({quality:90}).toBuffer()
}

/** 22/10/2026 — foto WhatsApp e «CPU Time exceeded» (HTTP 546 WORKER_RESOURCE_LIMIT) sull'edge.
 * Misurato dai log edge: 21/10 12:42:30 e 22/10 08:08:43/08:09:21 la funzione muore «CPU Time exceeded» ~1,2-1,5 s dopo
 * `image_install_complete`, cioè dentro il codec ImageMagick WASM (compilazione dei 15 MB + riduzione + ricodifica).
 * Una foto WhatsApp tipica (JPEG 1080×1920, 66 KB = 2,07 MP, appena sopra il tetto di 2 MP) faceva DUE passate WASM.
 * Qui: un'immagine già entro limiti ragionevoli si salva così com'è, senza WASM. Restano la validazione strutturale
 * (inspectStaticImage: magic bytes, dimensioni dalle intestazioni, niente animazioni) e la pulizia dei metadati in JS
 * (EXIF/XMP/IPTC/commenti nel JPEG, chunk di testo/eXIf/tIME nel PNG). Se serve davvero ruotare (EXIF Orientation≠1),
 * convertire (CMYK, WebP con EXIF/XMP) o ridurre, ritorna null e si passa al codec come prima. */
export const PASSTHROUGH_LIMITS=Object.freeze({bytes:3*1024*1024,side:2560,pixels:4_200_000})
const JPEG_KEEP_APP=new Set([0xe0,0xe2,0xee]) // JFIF, ICC_PROFILE, Adobe (trasformazione colore)
const PNG_DROP=new Set(['tEXt','zTXt','iTXt','eXIf','tIME'])
/** Orientamento EXIF (tag 0x0112) da un segmento APP1; null = EXIF illeggibile (nel dubbio si va al codec). */
function exifOrientation(b:Buffer,start:number,end:number):number|null{
 if(end-start<14||b.toString('ascii',start,start+6)!=='Exif\0\0')return 1 // APP1 XMP o altro: nessun orientamento
 const t=start+6,le=b.toString('ascii',t,t+2)==='II';if(!le&&b.toString('ascii',t,t+2)!=='MM')return null
 const u16=(o:number)=>o+2<=end?(le?b.readUInt16LE(o):b.readUInt16BE(o)):-1,u32=(o:number)=>o+4<=end?(le?b.readUInt32LE(o):b.readUInt32BE(o)):-1
 if(u16(t+2)!==42)return null;const ifd=u32(t+4);if(ifd<8||t+ifd+2>end)return null
 const n=u16(t+ifd);if(n<0)return null
 for(let i=0;i<n;i++){const e=t+ifd+2+i*12;if(e+12>end)return null;if(u16(e)===0x0112)return u16(e+8)}
 return 1
}
/** Immagine salvabile senza ricodifica (vedi sopra), già ripulita dai metadati; null = serve il codec. Mai lancia. */
export function passthroughImage(buf:Buffer):Buffer|null{
 try{
  if(!buf.length||buf.length>PASSTHROUGH_LIMITS.bytes)return null
  const info=inspectStaticImage(buf,PASSTHROUGH_LIMITS.pixels),mime=sniffImageMime(buf)
  if(!mime||!ALLOWED_MIME_TYPES.has(mime)||mime!=='image/'+info.format)return null
  if(Math.max(info.width,info.height)>PASSTHROUGH_LIMITS.side)return null
  // PNG/WebP restano sotto il tetto storico di 2 MP: il PDF li decodifica (pdfkit / pdf-webp-codec con quel tetto).
  if(info.format!=='jpeg'&&info.width*info.height>STATIC_IMAGE_LIMITS.pixels)return null
  let out:Buffer
  if(info.format==='jpeg'){
   const parts:Buffer[]=[buf.subarray(0,2)];let p=2,scan=-1
   while(p+4<=buf.length){
    if(buf[p]!==0xff)return null;let q=p+1;while(buf[q]===0xff)q++;const marker=buf[q]!,seg=q+1
    if(marker===0xd8||marker===0xd9||marker===0x01||(marker>=0xd0&&marker<=0xd7))return null // fuori posto prima della scansione
    const len=buf.readUInt16BE(seg),end=seg+len;if(len<2||end>buf.length)return null
    if(marker===0xda){scan=p;break}
    if(marker>=0xc0&&marker<=0xcf&&marker!==0xc4&&marker!==0xc8&&marker!==0xcc){const comps=buf[seg+7];if(comps!==1&&comps!==3)return null} // CMYK/YCCK → codec
    if(marker===0xe1){const o=exifOrientation(buf,seg+2,end);if(o===null||o>1)return null}
    if(marker===0xfe||(marker>=0xe0&&marker<=0xef&&!JPEG_KEEP_APP.has(marker))){p=end;continue}
    parts.push(buf.subarray(p,end));p=end
   }
   // Dati compressi copiati intatti fino all'EOI finale; byte in coda dopo l'EOI → codec (niente contenuto nascosto).
   if(scan<0||buf[buf.length-2]!==0xff||buf[buf.length-1]!==0xd9)return null
   parts.push(buf.subarray(scan));out=Buffer.concat(parts)
  }else if(info.format==='png'){
   const parts:Buffer[]=[buf.subarray(0,8)];let p=8
   while(p+12<=buf.length){const size=buf.readUInt32BE(p),type=buf.toString('ascii',p+4,p+8),end=p+12+size;if(end>buf.length)return null;if(!PNG_DROP.has(type))parts.push(buf.subarray(p,end));p=end;if(type==='IEND')break}
   out=Buffer.concat(parts) // eventuali byte dopo IEND scartati
  }else{
   const vp8x=buf.indexOf('VP8X',12,'ascii');if(vp8x===12&&(buf[20]!&0x0c))return null // EXIF/XMP nel WebP → codec
   out=buf
  }
  const check=inspectStaticImage(out,PASSTHROUGH_LIMITS.pixels);if(check.width!==info.width||check.height!==info.height||check.format!==info.format)return null
  return out
 }catch{return null}
}

export type SaveImageResult = { url: string } | { error: string; code: string }

// Valida (magic bytes) + re-encode (sharp) + quota + scrive su disco. Ritorna l'URL
// pubblico (/uploads/<rest>/<file>) o un errore leggibile. Buffer già in memoria
// (il chiamante impone il limite di dimensione: 10MB multipart, o il media WhatsApp).
// `passthrough` (solo canale WhatsApp, 22/10): immagine già entro PASSTHROUGH_LIMITS → salvata senza ricodifica.
export async function saveImageBuffer(restaurantId: string, buf: Buffer, opts: { passthrough?: boolean } = {}): Promise<SaveImageResult> {
  const direct = opts.passthrough ? passthroughImage(buf) : null
  if (direct) buf = direct
  else try { inspectStaticImage(buf) } catch (error) {
    const code=error instanceof Error?error.message:'INVALID_FILE_CONTENT'
    return {code,error:code==='ANIMATION_NOT_SUPPORTED'?'Sono accettate solo immagini statiche JPG, PNG e WebP.':code==='INPUT_PIXEL_LIMIT'?'Immagine oltre il limite di 2 megapixel.':code==='INPUT_BYTE_LIMIT'?'Immagine oltre il limite di 10 MB.':'Immagine non valida.'}
  }
  const realMime = sniffImageMime(buf)
  if (!realMime || !ALLOWED_MIME_TYPES.has(realMime)) {
    return { code: 'INVALID_FILE_CONTENT', error: 'Il contenuto del file non è un\'immagine valida (JPEG/PNG/WebP statici).' }
  }
  let out: Buffer
  let outputMime=realMime
  const edge=process.env['TAKO_EXECUTION_RUNTIME']==='edge'
  if(edge&&!remoteStorageEnabled())return {code:'EDGE_STORAGE_REQUIRED',error:'Storage non configurato.'}
  if (direct) out = direct
  else try {
    if(edge){
      if(!configuredEdgeCodec&&configuredEdgeInitializer)await configuredEdgeInitializer()
      if(!configuredEdgeCodec)return {code:'EDGE_CODEC_REQUIRED',error:'Elaborazione immagini non configurata.'}
      const encoded=await configuredEdgeCodec(new Uint8Array(buf));out=Buffer.from(encoded.bytes);outputMime=encoded.format==='jpeg'?'image/jpeg':encoded.format==='png'?'image/png':'image/webp'
    }else{
    const {default:sharp}=await import('sharp')
    const isGif = realMime === 'image/gif'
    const pipeline = sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, animated: isGif })
    const meta = await pipeline.metadata()
    if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS) {
      return { code: 'INVALID_FILE_CONTENT', error: 'Immagine troppo grande (dimensioni in pixel eccessive).' }
    }
    const fmt = isGif ? 'gif' : realMime === 'image/png' ? 'png' : realMime === 'image/webp' ? 'webp' : 'jpeg'
    out = await pipeline
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .toFormat(fmt)
      .toBuffer()
    }
  } catch {
    return { code: 'INVALID_FILE_CONTENT', error: 'Il contenuto del file non è un\'immagine valida.' }
  }

  // Durable ledger is mandatory on Edge and optionally shared by Node after seed.
  if((edge||process.env['TAKO_DURABLE_IMAGE_QUOTA']==='1')&&!configuredEdgeQuota)return {code:'EDGE_STORAGE_QUOTA_REQUIRED',error:'Salvataggio immagini Edge non ancora disponibile.'}

  // Stable 96-bit content address stays compatible with the immutable 16-char path contract.
  const filename = `${createHash('sha256').update(out).digest('base64url').slice(0,16)}.${MIME_TO_EXT[outputMime]!}`
  if(edge||configuredEdgeQuota){
    if(!remoteStorageEnabled())return {code:'DURABLE_STORAGE_REQUIRED',error:'Storage non configurato.'}
    try{
      const state=await persistEdgeImage(configuredEdgeQuota!,restaurantId,`${restaurantId}/${filename}`,new Uint8Array(out),{
        upload:()=>uploadRemoteImage(restaurantId,filename,out,outputMime),
        download:async()=>{const response=await downloadRemoteImage(restaurantId,filename);if(!response.ok){await response.body?.cancel();throw new Error('Storage confirmation unavailable')}const reader=response.body?.getReader();if(!reader)throw new Error('Storage body unavailable');const chunks:Uint8Array[]=[];let total=0;try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>out.length){await reader.cancel();throw new Error('Storage size mismatch')}chunks.push(part.value)}}finally{reader.releaseLock()}const result=new Uint8Array(total);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length}return result},
      })
      if(state==='quota_exceeded')return {code:'STORAGE_FULL',error:'Spazio immagini esaurito.'}
      if(state==='reconcile_required')return {code:'IMAGE_RECONCILE_REQUIRED',error:'Immagine in verifica: riprova più tardi.'}
      return {url:`/uploads/${restaurantId}/${filename}`}
    }catch{return {code:'IMAGE_QUOTA_UNAVAILABLE',error:'Salvataggio immagine temporaneamente non disponibile.'}}
  }
  const findExisting = async (): Promise<SaveImageResult | null> => {
    const inventory = await galleryInventory(restaurantId)
    const candidates = inventory.filter(a=>a.bytes===out.length).sort((a,b)=>Number(b.name===filename)-Number(a.name===filename)).slice(0,50)
    for (const asset of candidates) {
      let existing: Buffer
      if (remoteStorageEnabled()) { const response=await downloadRemoteImage(restaurantId,asset.name);if(!response.ok){await response.body?.cancel();continue}existing=Buffer.from(await response.arrayBuffer()) }
      else existing=await readFile(join(UPLOADS_DIR,restaurantId,asset.name))
      if (existing.equals(out)) return {url:asset.url}
      if(asset.name===filename)return {code:'WRITE_FAILED',error:'Conflitto immagine: riprova con un file diverso.'}
    }
    return null
  }
  if (remoteStorageEnabled()) {
    // Serialize quota check + write per restaurant in this single-replica runtime.
    const previous = remoteTenantWrites.get(restaurantId) ?? Promise.resolve()
    const write = previous.catch(() => {}).then(async () => {
      const existing=await findExisting();if(existing)return existing
      if (await remoteImageUsage(restaurantId) + out.length > MAX_UPLOADS_BYTES) {
        return { code: 'STORAGE_FULL', error: 'Spazio immagini esaurito.' }
      }
      await uploadRemoteImage(restaurantId, filename, out, outputMime)
      return { url: `/uploads/${restaurantId}/${filename}` }
    }).catch(() => ({ code: 'WRITE_FAILED', error: 'Salvataggio immagine non riuscito.' }))
    const tail = write.then(() => {})
    remoteTenantWrites.set(restaurantId, tail)
    try { return await write } finally {
      // Only the latest pending writer may remove this restaurant's queue.
      if (remoteTenantWrites.get(restaurantId) === tail) remoteTenantWrites.delete(restaurantId)
    }
  }
  const previous = remoteTenantWrites.get(restaurantId) ?? Promise.resolve()
  const write = previous.catch(()=>{}).then(async (): Promise<SaveImageResult> => {
  const existing=await findExisting();if(existing)return existing
  const tenantDir = join(UPLOADS_DIR, restaurantId)
  mkdirSync(tenantDir, { recursive: true })
  if (!tenantUsedBytes.has(restaurantId)) tenantUsedBytes.set(restaurantId, seedTenantUsage(tenantDir))
  const used = tenantUsedBytes.get(restaurantId) ?? 0
  const inFlight = tenantInFlightBytes.get(restaurantId) ?? 0
  if (used + inFlight + out.length > MAX_UPLOADS_BYTES) {
    return { code: 'STORAGE_FULL', error: 'Spazio immagini esaurito.' }
  }
  tenantInFlightBytes.set(restaurantId, inFlight + out.length)

  const filepath = join(tenantDir, filename)
  try {
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(filepath,{flags:'wx'})
      ws.on('finish', resolve)
      ws.on('error', reject)
      ws.end(out)
    })
    tenantUsedBytes.set(restaurantId, (tenantUsedBytes.get(restaurantId) ?? 0) + out.length)
  } catch (error) {
    if((error as NodeJS.ErrnoException).code==='EEXIST'){const existing=await readFile(filepath);if(existing.equals(out))return {url:`/uploads/${restaurantId}/${filename}`}}
    return { code: 'WRITE_FAILED', error: 'Salvataggio immagine non riuscito.' }
  } finally {
    tenantInFlightBytes.set(restaurantId, (tenantInFlightBytes.get(restaurantId) ?? out.length) - out.length)
  }
  return { url: `/uploads/${restaurantId}/${filename}` }
  })
  const tail=write.then(()=>{},()=>{})
  remoteTenantWrites.set(restaurantId,tail)
  try{return await write}finally{if(remoteTenantWrites.get(restaurantId)===tail)remoteTenantWrites.delete(restaurantId)}
}
