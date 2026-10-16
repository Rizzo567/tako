import {describe,it,expect} from 'vitest'
import {readFile} from 'node:fs/promises'
import {loadSuppliedMenuPdf} from '../apps/server/src/lib/supplied-menu-pdf.js'
const tenant='528e263c-634e-4695-9632-6c5cc6a3302f'
const response=(bytes:Uint8Array,headers:Record<string,string>={})=>new Response(bytes,{headers:{'content-type':'application/pdf',...headers}})
describe('approved supplied restaurant PDF',()=>{
 it('never fetches supplied documents for another tenant',async()=>{let called=false;expect(await loadSuppliedMenuPdf('another-tenant',async()=>{called=true;throw new Error()})).toBeUndefined();expect(called).toBe(false)})
 it('returns the exact approved document and rejects redirects',async()=>{const bytes=await readFile('apps/web/public/victoria-menu.pdf');let seen='';const result=await loadSuppliedMenuPdf(tenant,async(url,options)=>{seen=String(url);expect(options?.redirect).toBe('error');expect(options?.signal).toBeDefined();return response(bytes,{'content-length':String(bytes.length)})});expect(seen).toBe('https://takoitalia.com/takomenu-public/victoria-menu.pdf');expect(result?.filename).toBe('victoria-menu.pdf');expect(result?.bytes.equals(bytes)).toBe(true)})
 it('fails closed instead of falling back on unavailable or HTML responses',async()=>{for(const reply of [new Response('unavailable',{status:503}),new Response('<html/>',{headers:{'content-type':'text/html'}})])await expect(loadSuppliedMenuPdf(tenant,async()=>reply)).rejects.toMatchObject({statusCode:503,code:'SUPPLIED_PDF_UNAVAILABLE'})})
 it('rejects a changed document even with valid PDF markers',async()=>{const bytes=await readFile('apps/web/public/victoria-menu.pdf');bytes[50]^=1;await expect(loadSuppliedMenuPdf(tenant,async()=>response(bytes))).rejects.toMatchObject({statusCode:503})})
 it('rejects oversized declarations before reading and truncated documents',async()=>{await expect(loadSuppliedMenuPdf(tenant,async()=>response(new Uint8Array(),{'content-length':'6334257'}))).rejects.toMatchObject({statusCode:503});await expect(loadSuppliedMenuPdf(tenant,async()=>response(Buffer.from('%PDF-1.4\n%%EOF')))).rejects.toMatchObject({statusCode:503})})
})
