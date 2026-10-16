import {Buffer} from 'node:buffer'
import {pdfRuntimeFontManifest} from './pdf-runtime-font-manifest.js'
import type {Workspace} from './menu-workspace-contract.js'
import type {PdfRuntimeAssets} from './menu-workspace-pdf.js'
const families={sans:'NotoSans',serif:'NotoSerif',mono:'NotoSansMono',poppins:'Poppins',staatliches:'Staatliches',amaranth:'Amaranth',italiana:'Italiana'} as const
export class EdgePdfAssetError extends Error {
 readonly statusCode=503
 constructor(public readonly code:'PDF_ASSETS_BUSY'|'PDF_ASSETS_INVALID',message:string){super(message)}
}
export type EdgePdfFontSource=(name:string,signal:AbortSignal)=>Promise<Response>
/** No filesystem, signed URL logging, or global font cache. One render lease per loader. */
export function createEdgePdfRuntimeAssetLoader(source:EdgePdfFontSource,options:{maxFontBytes?:number;timeoutMs?:number}={}){
 const maxBytes=options.maxFontBytes??32*1024*1024,timeoutMs=options.timeoutMs??15_000
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||!Number.isSafeInteger(timeoutMs)||timeoutMs<1)throw new Error('Invalid PDF asset limits')
 let active=false
 return async function withPdfAssets<T>(workspace:Workspace,menuIds:string[],language:string,render:(assets:PdfRuntimeAssets)=>Promise<T>):Promise<T>{
  if(active)throw new EdgePdfAssetError('PDF_ASSETS_BUSY','PDF renderer occupied')
  if(!workspace.languages.includes(language))throw new EdgePdfAssetError('PDF_ASSETS_INVALID','Unsupported PDF language')
  active=true
  const fonts=new Map<string,Buffer>(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs)
  try{
   const lang=workspace.pdf.translationActive===false?workspace.defaultLanguage:language,names=new Set<string>()
   // Include base fallback and configured typefaces, with actual available faces only.
   const selectedFonts=new Set<keyof typeof families>(['sans',workspace.pdf.font])
   for(const style of Object.values(workspace.pdf.typography??{}))if(style?.font)selectedFonts.add(style.font)
   for(const font of selectedFonts)for(const face of ['Regular','Bold','Italic','BoldItalic']){
    const name=`${families[font]}-${face}.ttf`;if(name in pdfRuntimeFontManifest)names.add(name)
   }
   const selected={...workspace,menus:workspace.menus.filter(menu=>menuIds.includes(menu.id))}
   const corpus=JSON.stringify(selected,(key,value)=>key==='translations'?{[lang]:value?.[lang]}:key==='foodTranslations'?{[lang]:value?.[lang]}:value)
   if(/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(corpus))names.add('NotoSansArabic-Regular.ttf')
   if(/[\u0590-\u05ff]/.test(corpus))names.add('NotoSansHebrew-Regular.ttf')
   if(/[\u2e80-\u9fff\uf900-\ufaff\u3040-\u30ff]/.test(corpus))names.add(lang.startsWith('ja')?'NotoSansCJKjp-Regular.otf':'NotoSansCJKsc-Regular.otf')
   let total=0
   for(const name of names){
    const expected=pdfRuntimeFontManifest[name as keyof typeof pdfRuntimeFontManifest]
    total+=expected.bytes;if(total>maxBytes)throw new EdgePdfAssetError('PDF_ASSETS_INVALID','PDF font byte budget exceeded')
    const response=await source(name,controller.signal)
    if(!response.ok||!response.body)throw new EdgePdfAssetError('PDF_ASSETS_INVALID','PDF font unavailable')
    const declared=response.headers.get('content-length');if(declared&&Number(declared)!==expected.bytes)throw new EdgePdfAssetError('PDF_ASSETS_INVALID','PDF font length mismatch')
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0
    try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>expected.bytes)throw new EdgePdfAssetError('PDF_ASSETS_INVALID','PDF font exceeds pinned length');chunks.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
    if(length!==expected.bytes)throw new EdgePdfAssetError('PDF_ASSETS_INVALID','PDF font length mismatch')
    const bytes=Buffer.concat(chunks,length),digest=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex')
    if(digest!==expected.sha256)throw new EdgePdfAssetError('PDF_ASSETS_INVALID','PDF font integrity mismatch')
    fonts.set(name,bytes)
   }
   clearTimeout(timer)
   return await render({fonts})
  }catch(error){if(error instanceof EdgePdfAssetError)throw error;throw new EdgePdfAssetError('PDF_ASSETS_INVALID','PDF runtime asset loading failed')}
  finally{clearTimeout(timer);controller.abort();fonts.clear();active=false}
 }
}
let configuredLoader:ReturnType<typeof createEdgePdfRuntimeAssetLoader>|undefined
/** Call once in the Edge entry before createApp. Reads existing env; never writes it. */
export function initializeEdgePdf():void{
 const origin=process.env.SUPABASE_URL,bucket=process.env.PDF_FONT_BUCKET,key=process.env.SUPABASE_SERVICE_ROLE_KEY,prefix=process.env.PDF_FONT_PREFIX??'fonts'
 if(!origin||!bucket||!key)throw new EdgePdfAssetError('PDF_ASSETS_INVALID','Edge PDF font storage configuration missing')
 const base=new URL(origin)
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/'||!/^[a-zA-Z0-9_-]+$/.test(bucket)||!/^([a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/.test(prefix))throw new EdgePdfAssetError('PDF_ASSETS_INVALID','Invalid Edge PDF storage configuration')
 const timeoutMs=Number(process.env.PDF_FONT_TIMEOUT_MS??15000),maxFontBytes=Number(process.env.PDF_FONT_MAX_BYTES??32*1024*1024)
 configuredLoader=createEdgePdfRuntimeAssetLoader((name,signal)=>fetch(`${base.origin}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${[prefix,name].filter(Boolean).join('/').split('/').map(encodeURIComponent).join('/')}`,{signal,headers:{Authorization:`Bearer ${key}`,apikey:key},redirect:'error'}),{timeoutMs,maxFontBytes})
}
/** Route wrapper: Node gets undefined and preserves installed-font behavior. */
export async function withConfiguredPdfRuntimeAssets<T>(workspace:Workspace,menuIds:string[],language:string,render:(assets:PdfRuntimeAssets|undefined)=>Promise<T>):Promise<T>{
 if(configuredLoader)return configuredLoader(workspace,menuIds,language,render)
 // Edge activation must initialize explicitly; do not silently fall back to filesystem.
 if(process.env.TAKO_EXECUTION_RUNTIME==='edge'||process.env.EDGE_RUNTIME==='1'||typeof(globalThis as {Deno?:unknown}).Deno!=='undefined')throw new EdgePdfAssetError('PDF_ASSETS_INVALID','Edge PDF initializer not configured')
 return render(undefined)
}
