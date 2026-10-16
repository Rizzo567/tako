import {describe,it,expect} from 'vitest'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {createEdgePdfRuntimeAssetLoader,withConfiguredPdfRuntimeAssets} from '../apps/server/src/lib/edge-pdf-runtime-assets.js'
const fixture=(lang='it')=>{const mid=randomUUID();return {mid,w:workspaceSchema.parse({languages:['it','zh','ja','ar'],menus:[{id:mid,name:'Menu',sections:[{id:randomUUID(),name:'Piatti',items:[{id:randomUUID(),name:'Pasta',price:12,translations:{zh:{name:'Pasta',description:'番茄'},ja:{name:'Pasta',description:'トマト'},ar:{name:'Pasta',description:'معكرونة'}}}]}]}]})}}
const actualSource=async(name:string)=>new Response(await readFile(`apps/server/assets/fonts/${name}`))
describe('bounded Edge PDF font assets',()=>{
 it('loads pinned selected-script fonts and clears the lease on success',async()=>{const {w,mid}=fixture(),seen:string[]=[];const load=createEdgePdfRuntimeAssetLoader(async name=>{seen.push(name);return actualSource(name)});await load(w,[mid],'zh',async assets=>{expect(assets.fonts.has('NotoSansCJKsc-Regular.otf')).toBe(true);expect(assets.fonts.has('NotoSansCJKjp-Regular.otf')).toBe(false);expect(assets.fonts.has('NotoSansArabic-Regular.ttf')).toBe(false)});seen.length=0;await load(w,[mid],'it',async assets=>expect(assets.fonts.size).toBe(4));expect(seen).toHaveLength(4)})
 it('fails closed on hash mismatch and releases admission for the next call',async()=>{const {w,mid}=fixture();let corrupt=true;const load=createEdgePdfRuntimeAssetLoader(async name=>{const bytes=await readFile(`apps/server/assets/fonts/${name}`);if(corrupt)bytes[0]^=1;return new Response(bytes)});await expect(load(w,[mid],'it',async()=>{})).rejects.toThrow('integrity mismatch');corrupt=false;await expect(load(w,[mid],'it',async()=>true)).resolves.toBe(true)})
 it('rejects simultaneous renders and holds admission through the callback',async()=>{const {w,mid}=fixture(),load=createEdgePdfRuntimeAssetLoader(actualSource);let release!:()=>void,started!:()=>void;const ready=new Promise<void>(resolve=>started=resolve);const first=load(w,[mid],'it',async()=>{started();await new Promise<void>(resolve=>release=resolve)});await ready;await expect(load(w,[mid],'it',async()=>{})).rejects.toMatchObject({code:'PDF_ASSETS_BUSY'});release();await first})
 it('rejects a byte budget before downloading and rejects oversized streams',async()=>{const {w,mid}=fixture();let calls=0;const small=createEdgePdfRuntimeAssetLoader(async()=>{calls++;return new Response('x')},{maxFontBytes:1});await expect(small(w,[mid],'it',async()=>{})).rejects.toThrow('budget');expect(calls).toBe(0);const oversized=createEdgePdfRuntimeAssetLoader(async name=>new Response(Buffer.concat([await readFile(`apps/server/assets/fonts/${name}`),Buffer.from('x')])));await expect(oversized(w,[mid],'it',async()=>{})).rejects.toThrow('pinned length')})
})

it('fails closed in Node-hosted Edge mode when initializer is absent',async()=>{
 const previous=process.env.TAKO_EXECUTION_RUNTIME,{w,mid}=fixture();let called=false
 try{process.env.TAKO_EXECUTION_RUNTIME='edge';await expect(withConfiguredPdfRuntimeAssets(w,[mid],'it',async()=>{called=true})).rejects.toMatchObject({code:'PDF_ASSETS_INVALID',statusCode:503});expect(called).toBe(false)}finally{if(previous===undefined)delete process.env.TAKO_EXECUTION_RUNTIME;else process.env.TAKO_EXECUTION_RUNTIME=previous}
})
