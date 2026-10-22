// 22/10/2026 — foto WhatsApp → HTTP 546 «CPU Time exceeded» sull'edge (codec ImageMagick WASM).
// Una foto già entro i limiti (WhatsApp 1080×1920, ~66 KB) si salva senza codec; i file non immagine restano rifiutati.
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
const sharp=createRequire(new URL('../apps/server/package.json',import.meta.url))('sharp') as typeof import('../apps/server/node_modules/sharp')
const store=vi.hoisted(()=>({uploads:[] as {tenant:string,name:string,bytes:number,mime:string}[],objects:new Map<string,Buffer>()}))
vi.mock('../apps/server/src/lib/remote-image-store.js',()=>({
 remoteStorageEnabled:()=>true,remoteImageUsage:async()=>0,
 uploadRemoteImage:async(tenant:string,name:string,bytes:Buffer,mime:string)=>{store.uploads.push({tenant,name,bytes:bytes.length,mime});store.objects.set(tenant+'/'+name,Buffer.from(bytes))},
 downloadRemoteImage:async(tenant:string,name:string)=>{const b=store.objects.get(tenant+'/'+name);return b?new Response(new Uint8Array(b)):new Response(null,{status:404})}}))
vi.mock('../apps/server/src/lib/edge-image-persistence.js',()=>({persistEdgeImage:async(_q:unknown,_t:string,_k:string,_b:Uint8Array,io:{upload:()=>Promise<void>})=>{await io.upload();return 'committed'}}))
const tenant='26050ecd-2e55-4057-a4c5-bff2b449cd47'
// Foto «come WhatsApp»: JPEG progressivo 1080×1920 (2,07 MP, sopra il vecchio tetto di 2 MP), JFIF senza EXIF, decine di KB.
async function whatsappLike(){const w=1080,h=1920,raw=Buffer.alloc(w*h*3);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*3;raw[i]=(x*7+y*3)&255;raw[i+1]=(x*y>>9)&255;raw[i+2]=((x^y)*5)&255}
 return sharp(raw,{raw:{width:w,height:h,channels:3}}).blur(2).jpeg({quality:60,progressive:true}).toBuffer()}
let codec:ReturnType<typeof vi.fn>,initializer:ReturnType<typeof vi.fn>
async function edgeStore(){
 vi.resetModules();vi.stubEnv('TAKO_EXECUTION_RUNTIME','edge');vi.stubEnv('UPLOADS_DRIVER','supabase')
 const m=await import('../apps/server/src/lib/image-store.js')
 codec=vi.fn(async()=>{throw new Error('il codec WASM non deve girare per questa foto')});initializer=vi.fn(async()=>{})
 m.configureImageCodec(Object.assign(codec,{downscale:vi.fn(async()=>{throw new Error('niente riduzione')})}) as any)
 m.configureImageInitializer(initializer);m.configureImageQuota({} as any);return m}
beforeEach(()=>{store.uploads=[];store.objects.clear()})
afterEach(()=>{vi.unstubAllEnvs()})
describe('passthroughImage / saveImageBuffer({passthrough})',()=>{
 it('foto WhatsApp 1080×1920 progressiva: salvata così com\'è, senza codec né inizializzazione WASM',async()=>{
  const photo=await whatsappLike(),m=await edgeStore()
  expect((await sharp(photo).metadata()).width).toBe(1080)
  expect(m.passthroughImage(photo)?.equals(photo)).toBe(true)
  const saved=await m.saveImageBuffer(tenant,photo,{passthrough:true})
  expect(saved).toMatchObject({url:expect.stringMatching(new RegExp(`^/uploads/${tenant}/[A-Za-z0-9_-]{16}\\.jpg$`))})
  expect(codec).not.toHaveBeenCalled();expect(initializer).not.toHaveBeenCalled()
  expect(store.uploads).toEqual([{tenant,name:expect.any(String),bytes:photo.length,mime:'image/jpeg'}])
  // senza opzione (dashboard) il comportamento resta quello di prima: >2 MP → rifiutata prima del codec
  expect(await m.saveImageBuffer(tenant,photo)).toMatchObject({code:'INPUT_PIXEL_LIMIT'})
 })
 it('la vera foto WhatsApp in fixtures (1152×2048, 21 KB) passa senza codec',async()=>{
  const real=readFileSync(new URL('./fixtures/whatsapp-photo-1152x2048.jpg',import.meta.url)),m=await edgeStore()
  expect((await m.saveImageBuffer(tenant,real,{passthrough:true}))).toHaveProperty('url');expect(codec).not.toHaveBeenCalled()
 })
 it('file non immagine o travestiti: rifiutati, niente upload',async()=>{
  const m=await edgeStore(),photo=await whatsappLike()
  const bad=[Buffer.from('%PDF-1.4\n'+'x'.repeat(200)),Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.from('<html><script>alert(1)</script>'.repeat(4))]),Buffer.from('GIF89a'+'\0'.repeat(40)),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'.padEnd(64))]
  for(const b of bad){expect(m.passthroughImage(b)).toBeNull();const r=await m.saveImageBuffer(tenant,b,{passthrough:true});expect(r).toHaveProperty('error')}
  // JPEG valido con contenuto accodato dopo l'EOI: mai salvato tale e quale (va al codec, qui finto e rotto → errore)
  const tail=Buffer.concat([photo,Buffer.from('<script>x</script>')]);expect(m.passthroughImage(tail)).toBeNull()
  expect(await m.saveImageBuffer(tenant,tail,{passthrough:true})).toHaveProperty('error')
  expect(store.uploads).toEqual([])
 })
 it('metadati: EXIF/commenti tolti senza ricodifica; rotazione EXIF, CMYK, foto enormi e PNG/WebP sopra 2 MP vanno al codec',async()=>{
  const m=await edgeStore(),photo=await whatsappLike()
  const described=await sharp(photo).withExif({IFD0:{ImageDescription:'via-segreta-1',Copyright:'x'}}).jpeg().toBuffer()
  expect(described.includes('via-segreta-1')).toBe(true);const clean=m.passthroughImage(described)!
  expect(clean).not.toBeNull();expect(clean.includes('via-segreta-1')).toBe(false);expect(clean.includes(Buffer.from('Exif\0\0'))).toBe(false)
  const meta=await sharp(clean).metadata();expect([meta.width,meta.height,meta.format]).toEqual([1080,1920,'jpeg'])
  expect((await sharp(clean).raw().toBuffer()).equals(await sharp(described).raw().toBuffer())).toBe(true) // stessi pixel
  expect(m.passthroughImage(await sharp(photo).withMetadata({orientation:6}).jpeg().toBuffer())).toBeNull()
  expect(m.passthroughImage(await sharp(photo).toColourspace('cmyk').jpeg().toBuffer())).toBeNull()
  expect(m.passthroughImage(await sharp({create:{width:3000,height:4000,channels:3,background:'#888'}}).jpeg().toBuffer())).toBeNull()
  expect(m.passthroughImage(await sharp({create:{width:1080,height:1920,channels:3,background:'#888'}}).png().toBuffer())).toBeNull()
  const png=await sharp({create:{width:800,height:600,channels:4,background:'#888'}}).png().withMetadata({}).toBuffer();expect(m.passthroughImage(png)).not.toBeNull()
  expect(m.passthroughImage(await sharp(photo).resize(600).withMetadata({orientation:1}).webp().toBuffer())).toBeNull()
  expect(m.passthroughImage(await sharp(photo).resize(600).webp().toBuffer())).not.toBeNull()
  // la rotazione passa davvero dal codec (qui finto): saveImageBuffer lo chiama
  codec.mockImplementationOnce(async()=>({bytes:new Uint8Array(photo),format:'jpeg',width:1080,height:1920}))
  const rotated=await sharp(await sharp(photo).resize(600).toBuffer()).withMetadata({orientation:6}).jpeg().toBuffer()
  expect(await m.saveImageBuffer(tenant,rotated,{passthrough:true})).toHaveProperty('url');expect(codec).toHaveBeenCalledTimes(1)
 })
})
