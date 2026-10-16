import {Buffer} from 'node:buffer'

/** Approved complete print documents. Never accept an arbitrary URL from a request. */
const suppliedPdfs:Readonly<Record<string,{url:string;filename:string;bytes:number;sha256:string}>>={
 '528e263c-634e-4695-9632-6c5cc6a3302f':{url:'https://takoitalia.com/takomenu-public/victoria-menu.pdf',filename:'victoria-menu.pdf',bytes:6334256,sha256:'d145165d47a3058e8f1c6d16c00d8ed0f3b6617d8d03dc245eb665c8ecd60c93'},
}
export class SuppliedPdfError extends Error {
 readonly statusCode=503
 readonly code='SUPPLIED_PDF_UNAVAILABLE'
 constructor(){super('PDF del locale temporaneamente non disponibile: riprova')}
}
/** Retains the supplied artwork for preview and download, independent of draft edits. */
export async function loadSuppliedMenuPdf(tenant:string,source:typeof fetch=fetch):Promise<{filename:string;bytes:Buffer}|undefined>{
 const entry=suppliedPdfs[tenant]
 if(!entry)return undefined
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20_000)
 const maxBytes=entry.bytes
 try{
  const response=await source(entry.url,{signal:controller.signal,redirect:'error'})
  if(!response.ok||!response.body||response.headers.get('content-type')?.split(';')[0]?.trim()!=='application/pdf')throw new SuppliedPdfError()
  const declared=response.headers.get('content-length')
  if(declared&&(!Number.isSafeInteger(Number(declared))||Number(declared)>maxBytes))throw new SuppliedPdfError()
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxBytes)throw new SuppliedPdfError();chunks.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  const bytes=Buffer.concat(chunks,length)
  if(!bytes.subarray(0,8).toString('ascii').startsWith('%PDF-')||!bytes.subarray(Math.max(0,length-1024)).toString('ascii').includes('%%EOF')||(declared&&Number(declared)!==length))throw new SuppliedPdfError()
  if(length!==entry.bytes||Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex')!==entry.sha256)throw new SuppliedPdfError()
  return {filename:entry.filename,bytes}
 }catch{throw new SuppliedPdfError()}
 finally{clearTimeout(timer);controller.abort()}
}
