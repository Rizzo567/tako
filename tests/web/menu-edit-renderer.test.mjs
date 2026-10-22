// Vista di modifica + ordine manuale (dashboard editor 22/10): renderer vero reso con React su Node.
// Non regressione: senza `editing` e senza `design.manualOrder` il markup è identico byte per byte al renderer di prima (315c05e1).
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {runInNewContext} from 'node:vm';import {transform} from 'esbuild';import {createRequire} from 'node:module'
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));const React=require('react');const {renderToStaticMarkup}=require('react-dom/server')
async function lib(file){const ctx={module:{exports:{}},Intl,Date,require:createRequire(new URL('../../'+file,import.meta.url))};runInNewContext((await transform(readFileSync(file,'utf8'),{loader:'ts',format:'cjs'})).code,ctx);return ctx.module.exports}
const libs=['menu-copy','menu-coming-soon','menu-name-copy','menu-price','menu-sales-copy','menu-fixed-price','menu-day-order','menu-motion','menu-category-pages','menu-palette']
async function component(source){const stripped=source.replace(/^import .*$/gm,'').replace('export function WorkspaceMenuRenderer','function WorkspaceMenuRenderer');const ctx={module:{exports:{}},headerStyles:new Proxy({},{get:(_,k)=>String(k)}),MenuHeaderControls:p=>React.createElement('div',{'data-header-controls':p.locked?'locked':'free'}),AnimatedMenuLogo:p=>React.createElement('img',{src:p.src,alt:p.alt}),TakoLoading:()=>React.createElement('div',{role:'status'}),formatEuro:v=>`${v} €`,...React,...require('framer-motion'),React};for(const l of libs)Object.assign(ctx,await lib(`apps/web/src/lib/${l}.ts`));ctx.categoryGroups=ctx.macroCategoryGroups;runInNewContext((await transform(stripped+'\nmodule.exports=WorkspaceMenuRenderer',{loader:'tsx',jsx:'transform'})).code,ctx);return ctx.module.exports}
const now=await component(readFileSync('apps/web/src/components/WorkspaceMenuRenderer.tsx','utf8'))
const before=await component(execFileSync('git',['show','315c05e1:apps/web/src/components/WorkspaceMenuRenderer.tsx'],{encoding:'utf8'}))
const cal=await lib('apps/web/src/lib/menu-preview-calendar.ts')
const item=(id,name,extra={})=>({id,name,price:10,available:true,description:'',allergens:[],tags:[],additives:[],translations:{},...extra})
const sections=[{id:'d',name:'Dolci',items:[item('d1','Tiramisù')]},{id:'p1',name:'Primi di terra',items:[item('p11','Carbonara')]},{id:'a',name:'Antipasti',items:[item('a1','Bruschetta')]},{id:'p2',name:'Primi di mare',items:[item('p21','Vongole')]},{id:'p2c',name:'Crudi',parentSectionId:'p2',items:[item('c1','Tartare')]}]
const menus=[{id:'cena',name:'Cena',type:'dinner'},{id:'pranzo',name:'Pranzo',type:'lunch'}]
const render=(R,props)=>renderToStaticMarkup(React.createElement(R,{menu:{id:'cena',name:'Cena',sections},design:{},menus,onSelectMenu(){},languages:['it'],language:'it',onSelectLanguage(){},...props}))
const pills=html=>[...html.matchAll(/data-category="([^"]+)"[^>]*>([^<]+)</g)].map(m=>m[2])
const chips=html=>[...html.matchAll(/aria-label="Menu disponibili".*?<\/nav>/gs)].flatMap(n=>[...n[0].matchAll(/<button[^>]*>([^<]+)</g)].map(m=>m[1]))

test('without manualOrder and without editing the markup is byte-identical to the renderer before the editor',()=>{
 for(const props of [{},{design:{primary:'#1e5baa'}},{readOnly:true},{menu:{id:'f',name:'Fisso',pricing:'fisso',formulas:[{id:'f1',name:'Pranzo completo',price:15,sectionIds:['p1']}],included:'Acqua',sections}},{menu:{id:'e',name:'Vuoto',empty:true,sections:[]}},{design:{manualOrder:false}},{design:{showSubcategoryNavigation:false}}])assert.equal(render(now,props),render(before,props),JSON.stringify(props).slice(0,80))
})
test('default public page keeps merged pills sorted by the fixed list and menus by hour',()=>{
 const html=render(now,{});assert.deepEqual(pills(html),['Antipasti e sfiziosità','Primi','Dolci e frutta'])
})
test('manualOrder: menus in document order, pills = real Sottomenu names in document order, no merge',()=>{
 const html=render(now,{design:{manualOrder:true},menus:[{id:'pranzo',name:'Pranzo',type:'lunch'},{id:'cena',name:'Cena',type:'dinner'}]})
 assert.deepEqual(pills(html),['Dolci','Primi di terra','Antipasti','Primi di mare'])
 assert.deepEqual(chips(html).map(s=>s.trim()),['Pranzo','Cena'])
 const late=render(now,{design:{manualOrder:true},menus:[{id:'cena',name:'Cena',type:'dinner'},{id:'pranzo',name:'Pranzo',type:'lunch'}]});assert.deepEqual(chips(late).map(s=>s.trim()),['Cena','Pranzo'])
 // la pagina mostra il primo Sottomenu vero con le sue Sezioni figlie
 assert.ok(html.includes('Tiramisù'));assert.ok(!html.includes('Carbonara'))
})
test('editing adds only contract attributes; no editing = no data-edit anywhere',()=>{
 assert.ok(!render(now,{}).includes('data-edit'))
 const doc={schemaVersion:1,defaultLanguage:'it',languages:['it'],design:{manualOrder:true},menus:[{id:'cena',name:'Cena',type:'dinner',sections:[{...sections[3],active:true},{...sections[4]},{id:'vuota',name:'Vuota',items:[]},{id:'h',name:'Nascosti',active:false,items:[item('h1','Segreto',{hidden:true}),item('h2','Finito',{available:false})]}]}]}
 const v=cal.projectMenuForEdit(doc,'cena')
 const html=renderToStaticMarkup(React.createElement(now,{menu:v.menu,design:v.design,menus:v.menus,onSelectMenu(){},languages:['it'],language:'it',onSelectLanguage(){},readOnly:true,editing:true}))
 assert.ok(html.includes('data-edit-group-id="menus"'));assert.ok(html.includes('data-edit-kind="menu"'));assert.ok(html.includes('data-edit-group-id="pills:cena"'));assert.ok(html.includes('data-edit-kind="submenu"'))
 assert.ok(html.includes('data-edit-select="section:p2"'));assert.ok(html.includes('data-edit-group-id="children:p2"'));assert.ok(/data-edit-id="p2c" data-edit-kind="section" data-edit-group="children:p2"/.test(html))
 assert.ok(html.includes('data-edit-group-id="items:p2"'));assert.ok(/data-edit-id="p21" data-edit-kind="dish" data-edit-group="items:p2"/.test(html));assert.ok(html.includes('data-header-controls="locked"'))
 // pillola del Sottomenu nascosto: attenuata con etichetta corta
 assert.ok(/data-edit-id="h"[^>]*data-edit-state="inactive"/.test(html));assert.ok(html.includes('>Nascosto<'))
 const hidden=renderToStaticMarkup(React.createElement(now,{menu:{...v.menu,sections:v.menu.sections.filter(s=>s.id==='h')},design:{...v.design},menus:v.menus,languages:['it'],language:'it',readOnly:true,editing:true}))
 assert.ok(/data-edit-id="h1"[^>]*data-edit-state="hidden"/.test(hidden));assert.ok(hidden.includes('Nascosto · rendilo visibile dalla matita'));assert.ok(/data-edit-id="h2"[^>]*data-edit-state="unavailable"/.test(hidden));assert.ok(hidden.includes('>Esaurito<'))
 assert.ok(!/categori/i.test(html.replace(/aria-label="Categorie"/g,'')))
})
test('empty Sottomenu keeps its (empty) dish container and children container for drops',()=>{
 const doc={schemaVersion:1,defaultLanguage:'it',languages:['it'],design:{manualOrder:true},menus:[{id:'m',name:'M',sections:[{id:'s',name:'Nuovo',items:[]}]}]}
 const v=cal.projectMenuForEdit(doc,'m');const html=renderToStaticMarkup(React.createElement(now,{menu:v.menu,design:v.design,menus:v.menus,languages:['it'],language:'it',readOnly:true,editing:true}))
 assert.ok(html.includes('<div data-edit-group-id="items:s" data-edit-axis="y"></div>'));assert.ok(html.includes('<div data-edit-group-id="children:s" data-edit-axis="y"></div>'));assert.ok(html.includes('data-menu-coming-soon'))
})
test('fixed-price view: dishes selectable by dish (not by option block), not draggable inside repeated blocks',()=>{
 const doc={schemaVersion:1,defaultLanguage:'it',languages:['it'],design:{},menus:[{id:'f',name:'Pranzo',pricing:'fisso',formulas:[{id:'o1',name:'Completo',price:15,sectionIds:['p']}],sections:[{id:'p',name:'Primi',items:[item('i1','Lasagna')]},{id:'d',name:'Dolci',items:[item('i2','Torta')]}]}]}
 const v=cal.projectMenuForEdit(doc,'f');const html=renderToStaticMarkup(React.createElement(now,{menu:v.menu,design:v.design,menus:v.menus,languages:['it'],language:'it',readOnly:true,editing:true}))
 assert.ok(!html.includes('data-edit-id="formula~'));assert.ok(!html.includes('data-edit-select="item:formula~'))
})
test('projectMenuForEdit keeps everything the public page hides, flags it, and never mutates the draft',()=>{
 const sched={enabled:true,timezone:'Europe/Rome',windows:[{weekdays:[1],start:'12:00',end:'13:00'}]}
 const doc={schemaVersion:1,defaultLanguage:'it',languages:['it','en'],design:{},menus:[{id:'m',name:'Cena',active:false,translations:{en:{name:'Dinner'}},sections:[{id:'r',name:'Primi',active:false,translations:{en:{name:'Pasta'}},items:[item('x','Nascosto',{hidden:true}),item('y','Esaurito',{available:false}),item('z','Orario',{schedule:sched})]},{id:'c',name:'Figlia',parentSectionId:'r',items:[]}]}]}
 const original=JSON.stringify(doc),v=cal.projectMenuForEdit(doc,'m',new Date('2026-10-13T20:00:00Z'))
 assert.equal(JSON.stringify(doc),original);assert.equal(v.menu.name,'Cena');assert.equal(v.menu.sections[0].name,'Primi');assert.equal(v.menu.sections.length,2);assert.equal(v.menu.sections[0].items.length,3)
 assert.deepEqual({...v.menu.edit},{hidden:false,unavailable:false,inactive:true,scheduledOff:false});assert.equal(v.menu.sections[1].edit.inactive,true,'la Sezione figlia eredita il Sottomenu nascosto');assert.equal(v.menu.sections[1].empty,true)
 const [x,y,z]=v.menu.sections[0].items;assert.equal(x.edit.hidden,true);assert.equal(y.edit.unavailable,true);assert.equal(y.available,false);assert.equal(z.edit.scheduledOff,true);assert.equal(v.menus[0].edit.inactive,true)
 assert.throws(()=>cal.projectMenuForEdit(doc,'nessuno'))
})
