import {describe,it,expect} from 'vitest'
import {randomUUID} from 'node:crypto'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {renderWorkspacePdf} from '../apps/server/src/lib/menu-workspace-pdf.js'

async function inspect(bytes:Buffer){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs')
 const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:false,isEvalSupported:false})
 const document=await loading.promise
 try{
  const pages=[]
  for(let n=1;n<=document.numPages;n++){
   const page=await document.getPage(n),content=await page.getTextContent()
   pages.push({view:page.view,items:content.items.filter((i:any)=>'str'in i).map((i:any)=>({text:i.str,x:i.transform[4],y:i.transform[5],height:i.height,width:i.width,font:i.fontName}))})
  }
  return pages
 }finally{await loading.destroy()}
}
const sample=()=>workspaceSchema.parse({languages:['it','en'],menus:[{id:randomUUID(),name:'Original menu',translations:{en:{name:'Translated menu'}},sections:[{id:randomUUID(),name:'Original section',translations:{en:{name:'Translated section'}},items:[{id:randomUUID(),name:'Untranslated dish',description:'Private description marker',price:27.31,allergens:['latte']},{id:randomUUID(),name:'Original dish',description:'Original description',price:18.45,translations:{en:{name:'Translated dish',description:'Translated description'}},allergens:['glutine']},{id:randomUUID(),name:'Unavailable marker',price:77,available:false}]}]}],pdf:{showQr:false,showLogo:false,showFoodLegends:false,showPageNumbers:false}})
describe('PDF control effects in actual generated document',()=>{
 it('hides prices/descriptions/allergens and translated-only excludes missing entries',async()=>{
  const w=sample();Object.assign(w.pdf,{showPrices:false,showDescriptions:false,showAllergens:false,translationPolicy:'translated-only'})
  const pages=await inspect(await renderWorkspacePdf(w,[w.menus[0]!.id],'en','Test',randomUUID()))
  const text=pages.flatMap(p=>p.items.map(i=>i.text)).join(' ')
  expect(text).toContain('Translated dish');expect(text).toContain('Translated menu');expect(text).toContain('Translated section')
  for(const absent of ['Untranslated dish','Unavailable marker','Translated description','glutine','18,45','27,31'])expect(text).not.toContain(absent)
 })
 it('format/orientation/margins change page dimensions and item position; unavailable switch changes actual contents',async()=>{
  const w=sample();Object.assign(w.pdf,{format:'A5',showDescriptions:false,showAllergens:false})
  const normal=await inspect(await renderWorkspacePdf(w,[w.menus[0]!.id],'it','Test',randomUUID()))
  const before=normal[0]!.items.find(i=>i.text.includes('Untranslated dish'))!
  expect(normal[0]!.view[2]).toBeCloseTo(419.53,1);expect(normal[0]!.view[3]).toBeCloseTo(595.28,1)
  Object.assign(w.pdf,{orientation:'landscape',marginLeft:72,marginTop:80,includeUnavailable:true})
  const changed=await inspect(await renderWorkspacePdf(w,[w.menus[0]!.id],'it','Test',randomUUID()))
  const after=changed[0]!.items.find(i=>i.text.includes('Untranslated dish'))!
  expect(changed[0]!.view[2]).toBeCloseTo(595.28,1);expect(changed[0]!.view[3]).toBeCloseTo(419.53,1)
  expect(after.x).toBe(72);expect(after.x).not.toBe(before.x)
  expect(changed.flatMap(p=>p.items.map(i=>i.text)).join(' ')).toContain('Unavailable marker')
  expect(normal.flatMap(p=>p.items.map(i=>i.text)).join(' ')).not.toContain('Unavailable marker')
 })
 it('per-element typography and area spacing alter real glyph sizes and positions',async()=>{
  const w=sample();Object.assign(w.pdf,{showMenuName:false,showDescriptions:false,showAllergens:false})
  const baseline=await inspect(await renderWorkspacePdf(w,[w.menus[0]!.id],'it','Test',randomUUID()))
  const first=baseline[0]!.items.find(i=>i.text.includes('Untranslated dish'))!
  w.pdf.typography={name:{font:'serif',fontSize:25,underline:true,color:'#123456'},price:{font:'mono',fontSize:8,color:'#654321'},category:{fontSize:10}}
  w.pdf.spaces={item:{top:16,right:11,bottom:20,left:19}}
  const changed=await inspect(await renderWorkspacePdf(w,[w.menus[0]!.id],'it','Test',randomUUID()))
  const name=changed[0]!.items.find(i=>i.text.includes('Untranslated dish'))!,price=changed[0]!.items.find(i=>i.text.includes('27,31'))!
  expect(name.height).toBeGreaterThan(first.height);expect(name.height).toBeGreaterThan(price.height*2)
  expect(name.x).toBe(w.pdf.margin+19);expect(name.x).not.toBe(first.x)
  expect(price.x).toBeGreaterThan(name.x)
 })
 it('vertical centering and translation toggle affect PDF contents and placement',async()=>{
  const w=sample();Object.assign(w.pdf,{showDescriptions:false,showAllergens:false})
  const normal=await inspect(await renderWorkspacePdf(w,[w.menus[0]!.id],'en','Test',randomUUID()))
  Object.assign(w.pdf,{verticalCentered:true,translationActive:false})
  const changed=await inspect(await renderWorkspacePdf(w,[w.menus[0]!.id],'en','Test',randomUUID()))
  expect(normal[0]!.items.some(i=>i.text==='Translated menu')).toBe(true)
  const title=changed[0]!.items.find(i=>i.text==='Original menu')!
  expect(title).toBeTruthy();expect(title.y).toBeLessThan(normal[0]!.items.find(i=>i.text==='Translated menu')!.y-50)
  expect(changed[0]!.items.some(i=>i.text==='Translated dish')).toBe(false)
 })
 it('large configured footer remains inside the physical page',async()=>{
  const w=sample();Object.assign(w.pdf,{footer:'Footer bounds marker',showPageNumbers:true,marginBottom:15,typography:{footer:{fontSize:48}}})
  const pages=await inspect(await renderWorkspacePdf(w,[w.menus[0]!.id],'it','Test',randomUUID()))
  const footer=pages[0]!.items.find(i=>i.text.includes('Footer bounds marker'))!
  expect(footer,JSON.stringify(pages[0]!.items)).toBeTruthy();expect(footer.y).toBeGreaterThanOrEqual(0)
  expect(footer.y+footer.height).toBeLessThanOrEqual(pages[0]!.view[3]!)
 })

 it('stress: extreme type sizes, two columns and large area spaces preserve every item once inside page bounds',async()=>{
  const w=sample(),items=Array.from({length:16},(_,n)=>({id:randomUUID(),name:`Z${String(n).padStart(3,'0')}Q`,description:'Lunga descrizione dettagliata con ingredienti e preparazione accurata. '.repeat(3),price:n+1,priceDisplay:`Prezzo speciale personalizzato ${n+1},00 EUR`,available:true}))
  w.menus[0]!.sections[0]!.items=workspaceSchema.parse({menus:[{id:randomUUID(),name:'Stress',sections:[{id:randomUUID(),name:'Sezione',items}]}]}).menus[0]!.sections[0]!.items
  Object.assign(w.pdf,{format:'A5',columns:2,showAllergens:false,showMenuName:false,typography:{name:{fontSize:48,font:'poppins'},price:{fontSize:48,font:'mono'},description:{fontSize:48,font:'serif'},category:{fontSize:48},footer:{fontSize:48}},spaces:{item:{top:70,right:20,bottom:70,left:20},description:{top:50,right:20,bottom:50,left:20}},footer:'FINE',marginLeft:45,marginRight:45,marginTop:40,marginBottom:20})
  const pages=await inspect(await renderWorkspacePdf(w,[w.menus[0]!.id],'it','Stress',randomUUID()))
  expect(pages.length).toBeGreaterThan(2)
  const nameFont=pages.flatMap(p=>p.items).find(i=>i.text==='Z'||i.text.startsWith('Z0'))?.font
  const aggregate=pages.flatMap(p=>p.items.filter(i=>i.font===nameFont).map(i=>i.text)).join('').replace(/\s/g,'')
  for(let n=0;n<16;n++){const marker=`Z${String(n).padStart(3,'0')}Q`;expect(aggregate.split(marker).length-1,marker+' extracted:'+aggregate.slice(0,200)).toBe(1)}
  for(const [pageIndex,page] of pages.entries())for(const item of page.items.filter(i=>i.height>0)){
   expect(item.x,`page ${pageIndex+1}: ${item.text}`).toBeGreaterThanOrEqual(-1)
   expect(item.x+item.width,`page ${pageIndex+1}: ${item.text}`).toBeLessThanOrEqual(page.view[2]!+1)
   expect(item.y,`page ${pageIndex+1}: ${item.text}`).toBeGreaterThanOrEqual(-1)
   expect(item.y+item.height,`page ${pageIndex+1}: ${item.text}`).toBeLessThanOrEqual(page.view[3]!+2)
  }
 },60_000)

})
