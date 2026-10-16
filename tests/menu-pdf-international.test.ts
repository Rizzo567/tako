import {describe,it,expect} from 'vitest'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {writeFile,mkdir,readFile} from 'node:fs/promises'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {renderWorkspacePdf,pdfDirectionalRuns} from '../apps/server/src/lib/menu-workspace-pdf.js'
const samples={it:'Risotto al pomodoro',en:'Tomato risotto',fr:'Risotto à la tomate',de:'Tomatenrisotto',es:'Risotto de tomate',pt:'Risoto de tomate',nl:'Tomatenrisotto',pl:'Risotto pomidorowe',ru:'Томатное ризотто',ar:'أرز بالطماطم Tako Chicken Burger 12',zh:'番茄烩饭 配奶酪和新鲜罗勒',ja:'トマトのリゾット チーズとバジル'}
describe('PDF international menu output',()=>{
 it('bundled CJK fonts contain actual glyph outlines for Chinese/Japanese and euro',()=>{
  const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfkit')),fontkit=pdfRequire('fontkit')
  for(const [file,text] of [['NotoSansCJKsc-Regular.otf',samples.zh],['NotoSansCJKjp-Regular.otf',samples.ja]]){
   const font=fontkit.openSync(`apps/server/assets/fonts/${file}`)
   for(const char of text+'€0123456789')if(char.trim())expect(font.glyphForCodePoint(char.codePointAt(0)).id).toBeGreaterThan(0)
  }
 })
 it('renders with supplied font bytes and rejects missing runtime fonts',async()=>{
  const w=workspaceSchema.parse({languages:['it'],menus:[{id:randomUUID(),name:'Menu',sections:[{id:randomUUID(),name:'Primi',items:[{id:randomUUID(),name:'Risotto',price:12.5}]}]}],pdf:{showQr:false,showLogo:false,showFoodLegends:false}})
  const fonts=new Map<string,Buffer>()
  for(const face of ['Regular','Bold','Italic','BoldItalic'])fonts.set(`NotoSans-${face}.ttf`,await readFile(`apps/server/assets/fonts/NotoSans-${face}.ttf`))
  const bytes=await renderWorkspacePdf(w,[w.menus[0]!.id],'it','Menu',randomUUID(),{fonts})
  expect(bytes.subarray(0,5).toString()).toBe('%PDF-')
  await expect(renderWorkspacePdf(w,[w.menus[0]!.id],'it','Menu',randomUUID(),{fonts:new Map()})).rejects.toThrow('PDF runtime font unavailable')
 })
 it('keeps adjacent Latin words and numbers in one directional run',()=>expect(pdfDirectionalRuns('أرز Tako Chicken Burger 12 بالطماطم')).toEqual(['أرز','Tako Chicken Burger 12','بالطماطم']))
 for(const [language,name] of Object.entries(samples))it(`embeds readable ${language} glyphs and prices`,async()=>{
  const w=workspaceSchema.parse({languages:Object.keys(samples),menus:[{id:randomUUID(),name:'Menu',translations:{[language]:{name}},sections:[{id:randomUUID(),name:'Primi',translations:{[language]:{name}},items:[{id:randomUUID(),name,description:Array(8).fill(name).join(' '),price:12.50,translations:{[language]:{name,description:Array(8).fill(name).join(' ')}},allergens:['latte']}]}]}],foodTranslations:{[language]:{allergens:name,latte:name}},pdf:{font:['pl','fr','ru'].includes(language)?'italiana':'sans',columns:2,showQr:false,showLogo:false,showFoodLegends:true,translationNamesPolicy:'all'}})
  const bytes=await renderWorkspacePdf(w,[w.menus[0]!.id],language,'International test',randomUUID())
  if(language==='pl'||language==='ru')expect(bytes.toString('latin1')).toContain('NotoSans')
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:false})
  try{
   const pdf=await loading.promise;let text=''
   for(let i=1;i<=pdf.numPages;i++){const content=await(await pdf.getPage(i)).getTextContent();text+=content.items.filter((v:any)=>'str' in v).map((v:any)=>v.str).join(' ')}
   expect(text).not.toContain('\u0000');expect(text).toContain('12,50');expect(bytes.length).toBeLessThan(1024*1024)
   if(language==='ar')expect(text).toContain('Tako Chicken Burger 12')
   if(language!=='ar')expect(text.replace(/\s/g,'')).toContain(name.replace(/\s/g,''))
   if(['zh','ja','ar'].includes(language)){await mkdir('tmp/pdfs/international',{recursive:true});await writeFile(`tmp/pdfs/international/${language}.pdf`,bytes)}
  }finally{await loading.destroy()}
 })
})
