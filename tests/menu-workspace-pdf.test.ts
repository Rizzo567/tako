import { it,expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { workspaceSchema } from '../apps/server/src/lib/menu-workspace-contract.js'
import { renderWorkspacePdf, pdfItemPrice } from '../apps/server/src/lib/menu-workspace-pdf.js'
it('renders a real bounded multi-page PDF with Unicode and selected menus',async()=>{
 const menuId=randomUUID(),restaurantId=randomUUID();const w=workspaceSchema.parse({menus:[{id:menuId,name:'Caffè e specialità',sections:[{id:randomUUID(),name:'Piatti',items:Array.from({length:120},(_,i)=>({id:randomUUID(),name:`Piatto ${i} — caffè`,description:'Preparazione con verdure e formaggio, prezzo aggiornato.',price:12.5,allergens:['latte']}))}]}],pdf:{columns:2,showQr:false}})
 const bytes=await renderWorkspacePdf(w,[menuId],'it','Tako · Verifica',restaurantId)
 expect(bytes.subarray(0,8).toString()).toMatch(/^%PDF-1\./)
 expect(bytes.length).toBeGreaterThan(10000)
 expect(bytes.toString('latin1').match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1)
})
it('embeds a repeated restaurant image once across dishes, logo and page backgrounds',async()=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{createRequire}=await import('node:module')
 const sharp=createRequire(new URL('../apps/server/package.json',import.meta.url))('sharp')
 const directory=await mkdtemp(join(tmpdir(),'tako-pdf-image-cache-')),restaurantId=randomUUID(),filename='abcdefghijklmnop.png',url=`/uploads/${restaurantId}/${filename}`,previous=process.env.UPLOADS_DIR
 try{
  process.env.UPLOADS_DIR=directory;await mkdir(join(directory,restaurantId));await writeFile(join(directory,restaurantId,filename),await sharp({create:{width:256,height:256,channels:3,background:'#e8ba74'}}).png().toBuffer())
  const menuId=randomUUID(),w=workspaceSchema.parse({design:{logoUrl:url},menus:[{id:menuId,name:'Menu',sections:[{id:randomUUID(),name:'Piatti',items:Array.from({length:30},(_,i)=>({id:randomUUID(),name:`Piatto ${i}`,price:12.5,imageUrl:url}))}]}],pdf:{showImages:true,showLogo:true,backgroundImageUrl:url,showQr:false}})
  const bytes=await renderWorkspacePdf(w,[menuId],'it','Repeated image test',restaurantId)
  expect(bytes.toString('latin1').match(/\/Subtype \/Image\b/g)).toHaveLength(1)
  expect(bytes.toString('latin1').match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1)
 }finally{if(previous===undefined)delete process.env.UPLOADS_DIR;else process.env.UPLOADS_DIR=previous;await rm(directory,{recursive:true,force:true})}
})
it('converts a WebP restaurant logo to a PDF-supported image without changing the source',async()=>{
 const {mkdtemp,mkdir,writeFile,readFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{createRequire}=await import('node:module')
 const sharp=createRequire(new URL('../apps/server/package.json',import.meta.url))('sharp')
 const directory=await mkdtemp(join(tmpdir(),'tako-pdf-webp-')),restaurantId=randomUUID(),filename='abcdefghijklmnop.webp',previous=process.env.UPLOADS_DIR
 try{
  process.env.UPLOADS_DIR=directory;await mkdir(join(directory,restaurantId));const image=await sharp({create:{width:128,height:128,channels:4,background:'#ed725b'}}).webp().toBuffer();const file=join(directory,restaurantId,filename);await writeFile(file,image)
  const menuId=randomUUID(),w=workspaceSchema.parse({design:{logoUrl:`/uploads/${restaurantId}/${filename}`},menus:[{id:menuId,name:'Menu',sections:[{id:randomUUID(),name:'Piatti',items:[{id:randomUUID(),name:'Piatto',price:12}]}]}],pdf:{showLogo:true,showQr:false}})
  const bytes=await renderWorkspacePdf(w,[menuId],'it','WebP logo',restaurantId)
  expect(bytes.subarray(0,5).toString()).toBe('%PDF-');expect(bytes.toString('latin1')).toContain('/Subtype /Image');expect(await readFile(file)).toEqual(image)
 }finally{if(previous===undefined)delete process.env.UPLOADS_DIR;else process.env.UPLOADS_DIR=previous;await rm(directory,{recursive:true,force:true})}
})
it('never prints a zero price: free text wins, otherwise only prices above zero',()=>{
 expect(pdfItemPrice({price:0,priceDisplay:null})).toBe('')
 expect(pdfItemPrice({price:0,priceDisplay:'  '})).toBe('')
 expect(pdfItemPrice({price:0,priceDisplay:'S.Q.'})).toBe('S.Q.')
 expect(pdfItemPrice({price:12.5,priceDisplay:null})).toMatch(/^12,50\s€$/)
})
it('renders a PDF with zero-priced dishes and zero/priced variants',async()=>{
 const menuId=randomUUID(),restaurantId=randomUUID();const w=workspaceSchema.parse({menus:[{id:menuId,name:'Menu',sections:[{id:randomUUID(),name:'Bevande',items:[{id:randomUUID(),name:'Acqua',price:0},{id:randomUUID(),name:'Vino',price:0,variants:[{id:randomUUID(),name:'Calice',priceModifier:5},{id:randomUUID(),name:'Assaggio',priceModifier:0}]}]}]}],pdf:{showQr:false}})
 const bytes=await renderWorkspacePdf(w,[menuId],'it','Prezzi zero',restaurantId)
 expect(bytes.subarray(0,8).toString()).toMatch(/^%PDF-1\./)
})
it('prints the menu note under the menu title, translated when available',async()=>{
 const menuId=randomUUID(),restaurantId=randomUUID();const w=workspaceSchema.parse({languages:['it','en'],menus:[{id:menuId,name:'Cena',description:'Coperto 2,50 € a persona',translations:{en:{name:'Dinner',description:'Cover charge 2.50 € per person'}},sections:[{id:randomUUID(),name:'Primi',items:[{id:randomUUID(),name:'Pasta',price:10}]}]}],pdf:{showQr:false}})
 const text=async(lang:string)=>{const bytes=await renderWorkspacePdf(w,[menuId],lang,'Nota',restaurantId);const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:false}),pdf=await loading.promise;let out='';for(let i=1;i<=pdf.numPages;i++){const content=await(await pdf.getPage(i)).getTextContent();out+=content.items.filter((v:any)=>'str' in v).map((v:any)=>v.str).join(' ')}await loading.destroy();return out.replace(/\s+/g,' ')}
 const it_=await text('it');expect(it_).toContain('Coperto 2,50 € a persona');expect(it_.indexOf('Cena')).toBeLessThan(it_.indexOf('Coperto'));expect(it_.indexOf('Coperto')).toBeLessThan(it_.indexOf('Primi'))
 expect(await text('en')).toContain('Cover charge 2.50 € per person')
})
