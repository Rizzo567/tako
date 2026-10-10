import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {createRequire} from 'node:module'
import {transform} from 'esbuild'
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url)),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
async function render({tab='document',group='format',dirty=false,element='name',area='page'}={}){
 const source=readFileSync('apps/dashboard/public/staff/src/14-menu-print.js','utf8')
 let hook=0,fields,mutation;const buttons=[],schemas=[]
 const values={7:tab,8:group,9:element,10:area}
 const document={revision:2,menus:[{id:'menu-a',name:'Cena'}],languages:['it','en'],pdf:{columns:1},pdfPresets:[{id:'preset-a',name:'Elegante',config:{format:'A4',columns:2,font:'serif'}}]}
 const ctx={React,URL,window:{},useState:initial=>[Object.hasOwn(values,hook)?values[hook++]:((hook++),initial),()=>{}],useRef:initial=>({current:initial}),useEffect:()=>{},MenuWorkspaceSchema:props=>{schemas.push(props);fields=props.fields;return React.createElement('div',{'data-fields':props.fields.map(f=>f.key).join(',')})},MenuWorkspaceField:()=>null,Btn:props=>{buttons.push(props);return React.createElement('button',{disabled:props.disabled},props.children)},setTimeout,clearTimeout,crypto:{randomUUID:()=> 'new-preset'}}
 runInNewContext((await transform(source,{loader:'jsx',jsx:'transform'})).code,ctx)
 const adapter={pdfFields:['format','columns','font','nameBold','showPrices','translationPolicy','marginTop','showLogo'].map(key=>({key}))}
 const html=renderToStaticMarkup(React.createElement(ctx.window.MenuWorkspacePrint,{adapter,document,menu:document.menus[0],dirty,mutate:fn=>{mutation=structuredClone(document);fn(mutation)}}))
 return {html,fields,buttons,schemas,document,getMutation:()=>mutation}
}
test('PDF editor groups document settings with a separate real preview region and top download',async()=>{
 const result=await render();assert.ok(result.html.includes('mw-pdf-layout'));assert.ok(result.html.includes('mw-pdf-preview-area'));assert.ok(result.html.includes('role="tablist"'))
 assert.deepEqual(Array.from(result.fields,f=>f.key),['format','columns','verticalCentered','backgroundOpacity','backgroundSize']);assert.ok(result.html.indexOf('Scarica menu PDF')<result.html.indexOf('mw-pdf-layout'))
 for(const label of ['Formato','Stile testo','Contenuti','Traduzione','Spazi','Avanzate'])assert.ok(result.html.includes(label))
})
test('content/language sections retain actual menu selection and original language choice',async()=>{
 const content=await render({group:'content'});assert.ok(content.html.includes('Menu da includere'));assert.ok(content.html.includes('Cena'));assert.deepEqual(Array.from(content.fields,f=>f.key),['showPrices'])
 const translation=await render({group:'translation'});assert.ok(translation.html.includes('Lingua del documento'));assert.ok(translation.html.includes('Originale'));assert.ok(translation.html.includes('EN'));assert.deepEqual(Array.from(translation.fields,f=>f.key),['translationPolicy'])
})
test('persisted PDF theme application copies config into draft and dirty state blocks generation',async()=>{
 const theme=await render({tab:'themes'});assert.ok(theme.html.includes('Elegante'));theme.buttons.find(b=>b.children==='Applica tema').onClick();assert.deepEqual(JSON.parse(JSON.stringify(theme.getMutation().pdf)),theme.document.pdfPresets[0].config);assert.notEqual(theme.getMutation().pdf,theme.document.pdfPresets[0].config)
 const dirty=await render({dirty:true});assert.equal(dirty.buttons.find(b=>b.children==='Scarica menu PDF').disabled,true);assert.equal(dirty.buttons.find(b=>b.children==='Aggiorna').disabled,true);assert.ok(dirty.html.includes('Salva le modifiche'))
})

test('per-element type and area spaces write distinct nested PDF config',async()=>{
 const type=await render({group:'text',element:'price'});const typography=type.schemas.find(s=>s.fields.some(f=>f.key==='underline'));assert.ok(typography);assert.ok(typography.fields.find(f=>f.key==='font').options.includes('poppins'));typography.onChange({font:'poppins',fontSize:18,underline:true,color:'#ee0000'});assert.equal(type.getMutation().pdf.typography.price.font,'poppins');assert.equal(type.getMutation().pdf.typography.price.underline,true);assert.equal(type.getMutation().pdf.typography.name,undefined);
 const spaces=await render({group:'spaces',area:'subcategory'});const areaSchema=spaces.schemas.find(s=>s.fields.some(f=>f.key==='top'));areaSchema.onChange({top:8,right:4,bottom:10,left:3});assert.equal(spaces.getMutation().pdf.spaces.subcategory.top,8);assert.equal(spaces.getMutation().pdf.spaces.category,undefined);
})
