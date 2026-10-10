import {afterAll,beforeAll,describe,it,expect} from 'vitest'
import {createRequire} from 'node:module'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {renderWorkspacePdf} from '../apps/server/src/lib/menu-workspace-pdf.js'
const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/legacy/build/pdf.mjs'))
const {createCanvas}=pdfRequire('@napi-rs/canvas')
const tenant=randomUUID(),foreign=randomUUID()
let directory:string
const environment={UPLOADS_DIR:process.env.UPLOADS_DIR,UPLOADS_DRIVER:process.env.UPLOADS_DRIVER}
async function output(workspace:ReturnType<typeof workspaceSchema.parse>){
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs')
 const bytes=await renderWorkspacePdf(workspace,[workspace.menus[0]!.id],'it','Image test',tenant)
 const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:false,isEvalSupported:false})
 const doc=await loading.promise
 try{
  const page=await doc.getPage(1),operators=await page.getOperatorList(),viewport=page.getViewport({scale:1})
  const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),context=canvas.getContext('2d')
  await page.render({canvasContext:context,viewport,canvas}).promise
  const paints=operators.fnArray.filter(fn=>[OPS.paintImageXObject,OPS.paintInlineImageXObject,OPS.paintImageMaskXObject].includes(fn)).length
  const states=operators.fnArray.flatMap((fn,n)=>fn===OPS.setGState?[operators.argsArray[n]]:[])
  const transforms=operators.fnArray.flatMap((fn,n)=>fn===OPS.transform?[operators.argsArray[n]]:[])
  const pixel=(x:number,y:number)=>Array.from(context.getImageData(x,y,1,1).data) as number[]
  return {paints,states,transforms,pixel,width:canvas.width,height:canvas.height}
 }finally{await loading.destroy()}
}
const base=()=>workspaceSchema.parse({menus:[{id:randomUUID(),name:'Empty image-only menu'}],pdf:{format:'A5',showMenuName:false,showLogo:false,showFoodLegends:false,showPageNumbers:false,showQr:false}})
describe('Actual PDF local image controls',()=>{
 beforeAll(async()=>{
  directory=await mkdtemp(join(tmpdir(),'tako-pdf-images-'));process.env.UPLOADS_DIR=directory;process.env.UPLOADS_DRIVER='local'
  await mkdir(join(directory,tenant));await mkdir(join(directory,foreign))
  const background=createCanvas(120,60),bg=background.getContext('2d');bg.fillStyle='#ff0000';bg.fillRect(0,0,120,60)
  await writeFile(join(directory,tenant,'aaaaaaaaaaaaaaaa.png'),background.toBuffer('image/png'))
  await writeFile(join(directory,foreign,'aaaaaaaaaaaaaaaa.png'),background.toBuffer('image/png'))
  const logo=createCanvas(60,60),lg=logo.getContext('2d');lg.fillStyle='#0000ff';lg.fillRect(20,20,20,20)
  await writeFile(join(directory,tenant,'bbbbbbbbbbbbbbbb.png'),logo.toBuffer('image/png'))
 })
 afterAll(async()=>{for(const key of ['UPLOADS_DIR','UPLOADS_DRIVER'] as const){if(environment[key]===undefined)delete process.env[key];else process.env[key]=environment[key]}if(directory)await rm(directory,{recursive:true,force:true})})
 it('paints own background with real opacity and cover/contain geometry; foreign image is never painted',async()=>{
  const w=base();Object.assign(w.pdf,{backgroundImageUrl:`/uploads/${tenant}/aaaaaaaaaaaaaaaa.png`,backgroundOpacity:.5,backgroundSize:'cover'})
  const cover=await output(w)
  expect(cover.paints).toBe(1);expect(JSON.stringify(cover.states)).toContain('0.5')
  const tint=cover.pixel(5,cover.height-5);expect(tint[0]).toBe(255);expect(tint[1]).toBeGreaterThanOrEqual(126);expect(tint[1]).toBeLessThanOrEqual(130);expect(tint[2]).toBe(tint[1])
  w.pdf.backgroundSize='contain';const contain=await output(w)
  expect(contain.paints).toBe(1);expect(contain.transforms).not.toEqual(cover.transforms);expect(contain.pixel(5,contain.height-5).slice(0,3)).toEqual([255,255,255])
  w.pdf.backgroundSize='cover';w.pdf.backgroundOpacity=0;const transparent=await output(w)
  expect(transparent.pixel(5,transparent.height-5).slice(0,3)).toEqual([255,255,255])
  w.pdf.backgroundOpacity=1;w.pdf.backgroundImageUrl=`/uploads/${foreign}/aaaaaaaaaaaaaaaa.png`;const denied=await output(w)
  expect(denied.paints).toBe(0);expect(denied.pixel(5,denied.height-5).slice(0,3)).toEqual([255,255,255])
 })
 it('logo shape clips corner pixels while configured logo background and transparent image preserve actual colors',async()=>{
  const w=base();w.design.logoUrl=`/uploads/${tenant}/bbbbbbbbbbbbbbbb.png`;Object.assign(w.pdf,{showLogo:true,logoBackground:'#00ff00',logoShape:'square'})
  const square=await output(w)
  expect(square.paints).toBe(1);expect(square.pixel(37,37).slice(0,3)).toEqual([0,255,0]);expect(square.pixel(66,66).slice(0,3)).toEqual([0,0,255])
  w.pdf.logoShape='circle';const circle=await output(w)
  expect(circle.pixel(37,37).slice(0,3)).toEqual([255,255,255]);expect(circle.pixel(66,66).slice(0,3)).toEqual([0,0,255])
  w.pdf.logoShape='rounded';const rounded=await output(w)
  expect(rounded.pixel(37,37).slice(0,3)).toEqual([255,255,255]);expect(rounded.pixel(66,66).slice(0,3)).toEqual([0,0,255])
  w.pdf.logoBackground='#ffaa00';w.pdf.logoShape='square';const recolored=await output(w)
  expect(recolored.pixel(37,37).slice(0,3)).toEqual([255,170,0])
  w.design.logoUrl=`/uploads/${foreign}/bbbbbbbbbbbbbbbb.png`;const denied=await output(w);expect(denied.paints).toBe(0)
 })
})
