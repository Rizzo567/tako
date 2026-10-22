// Vista di modifica (dashboard editor 22/10): logica pura del layer — selezione, tastiera, protocollo iframe↔SPA, fotografia dell'ordine.
import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url'
const root=resolve(new URL('../..',import.meta.url).pathname),dir=mkdtempSync(join(tmpdir(),'tako-menu-edit-'))
async function load(entry){const out=join(dir,entry.replace(/\W/g,'_')+'.mjs');await build({stdin:{contents:`export * from './${entry}'`,resolveDir:resolve(root,'apps/web/src/components/menu-edit'),loader:'ts'},bundle:true,format:'esm',platform:'neutral',outfile:out,alias:{'@':resolve(root,'apps/web/src')},logLevel:'error'});return import(pathToFileURL(out).href)}
const sel=await load('selection'),proto=await load('protocol')
const parent={},origin='https://takoitalia.com'
const state=(over={})=>({type:'tako-menu-edit-state',v:1,document:{schemaVersion:1,menus:[]},menuId:'m1',selection:null,flash:[],disabled:false,editing:false,...over})

test('gesture kinds map to model kinds (submenu and section are both sections)',()=>{
 assert.equal(sel.modelKind('dish'),'item');assert.equal(sel.modelKind('submenu'),'section');assert.equal(sel.modelKind('section'),'section');assert.equal(sel.modelKind('menu'),'menu');assert.equal(sel.modelKind('x'),null)
})
test('selection comes from data-edit-select first, otherwise from id + kind',()=>{
 assert.deepEqual(sel.selectionFromAttributes({select:'section:abc'}),{kind:'section',id:'abc'})
 assert.deepEqual(sel.selectionFromAttributes({select:'item:i-1',id:'s',kind:'section'}),{kind:'item',id:'i-1'})
 assert.deepEqual(sel.selectionFromAttributes({id:'p',kind:'dish'}),{kind:'item',id:'p'})
 assert.deepEqual(sel.selectionFromAttributes({id:'r',kind:'submenu'}),{kind:'section',id:'r'})
 assert.equal(sel.selectionFromAttributes({select:'bogus'}),null);assert.equal(sel.selectionFromAttributes({select:'pill:x'}),null);assert.equal(sel.selectionFromAttributes({id:'',kind:'dish'}),null)
})
test('frame targets: Menu = chip, Sottomenu/Sezione = title before pill, Piatto = whole row',()=>{
 assert.deepEqual(sel.frameSelectors({kind:'menu',id:'m'}),['[data-edit-kind="menu"][data-edit-id="m"]'])
 const s=sel.frameSelectors({kind:'section',id:'s1'});assert.equal(s[0],'[data-edit-select="section:s1"]');assert.ok(s.at(-1).includes('submenu'))
 assert.equal(sel.frameSelectors({kind:'item',id:'i'})[0],'[data-edit-kind="dish"][data-edit-id="i"]')
 assert.ok(sel.frameSelectors({kind:'item',id:'a"b'})[0].includes('a\\"b'));assert.deepEqual(sel.frameSelectors(null),[])
})
test('pencil labels use the fixed lexicon and never «categoria»',()=>{
 assert.equal(sel.pencilLabel('item','Carbonara'),'Modifica piatto «Carbonara»');assert.equal(sel.pencilLabel('section','Primi'),'Modifica sottomenu «Primi»');assert.equal(sel.pencilLabel('section','Di mare',true),'Modifica sezione «Di mare»');assert.equal(sel.pencilLabel('menu',''),'Modifica menu')
 for(const k of ['menu','section','item'])assert.ok(!/categori/i.test(sel.pencilLabel(k,'x')+sel.levelName(k)))
})
test('keyboard: Enter opens the pencil, Esc deselects, keys owned by the gesture are ignored',()=>{
 assert.equal(sel.keyAction('Enter',{selected:true,handled:false}),'open');assert.equal(sel.keyAction('Enter',{selected:false,handled:false}),null)
 assert.equal(sel.keyAction('Escape',{selected:true,handled:false}),'deselect');assert.equal(sel.keyAction('Enter',{selected:true,handled:true}),null);assert.equal(sel.keyAction('Enter',{selected:true,handled:false,picking:true}),null);assert.equal(sel.keyAction('a',{selected:true,handled:false}),null)
})
test('drops only into the container of the same level',()=>{
 assert.ok(sel.canDropInto('dish','items:s2','m'));assert.ok(!sel.canDropInto('dish','children:s2','m'));assert.ok(!sel.canDropInto('dish','items:formula~f~s','m'))
 assert.ok(sel.canDropInto('section','children:r','m'));assert.ok(sel.canDropInto('submenu','pills:m','m'));assert.ok(!sel.canDropInto('submenu','pills:other','m'));assert.ok(sel.canDropInto('menu','menus','m'));assert.ok(!sel.canDropInto('menu','pills:m','m'))
})
test('order snapshot = what the public page shows now (menus by hour, pills merged and sorted); manual documents keep their order',()=>{
 const doc={design:{},menus:[{id:'cena',name:'Cena',type:'dinner',sections:[{id:'d',name:'Dolci',items:[]},{id:'p1',name:'Primi di terra',items:[]},{id:'a',name:'Antipasti',items:[]},{id:'p2',name:'Primi di mare',items:[]},{id:'p2c',name:'Crudi',parentSectionId:'p2',items:[]}]},{id:'pranzo',name:'Pranzo',type:'lunch',sections:[]}]}
 const noon=sel.currentOrderView(doc,13),night=sel.currentOrderView(doc,20)
 assert.deepEqual(noon.menuOrder,['pranzo','cena']);assert.deepEqual(night.menuOrder,['cena','pranzo'])
 assert.deepEqual(noon.sectionOrder.cena,['a','p1','p2','p2c','d'])
 const manual=sel.currentOrderView({...doc,design:{manualOrder:true}},13);assert.deepEqual(manual.menuOrder,['cena','pranzo']);assert.deepEqual(manual.sectionOrder.cena,['d','p1','a','p2','p2c'])
})
test('parent messages: same origin, same parent window, v:1 and valid shape only',()=>{
 const ok=proto.acceptParentMessage({origin,source:parent,data:state({selection:{kind:'item',id:'i'},flash:['i',3],editing:true})},origin,parent)
 assert.equal(ok.type,'tako-menu-edit-state');assert.deepEqual(ok.selection,{kind:'item',id:'i'});assert.deepEqual(ok.flash,['i']);assert.equal(ok.editing,true);assert.equal(ok.disabled,false)
 assert.equal(proto.acceptParentMessage({origin:'https://evil.example',source:parent,data:state()},origin,parent),null)
 assert.equal(proto.acceptParentMessage({origin,source:{},data:state()},origin,parent),null)
 assert.equal(proto.acceptParentMessage({origin,source:parent,data:{...state(),v:2}},origin,parent),null)
 assert.equal(proto.acceptParentMessage({origin,source:parent,data:{...state(),document:null}},origin,parent),null)
 assert.equal(proto.acceptParentMessage({origin,source:parent,data:{...state(),selection:{kind:'categoria',id:'x'}}},origin,parent),null)
 assert.equal(proto.acceptParentMessage({origin,source:parent,data:{type:'tako-menu-preview',v:1,document:{}}},origin,parent),null)
 assert.deepEqual(proto.acceptParentMessage({origin,source:parent,data:{type:'tako-menu-edit-exit',v:1}},origin,parent),{type:'tako-menu-edit-exit',v:1})
 assert.equal(proto.acceptParentMessage({origin,source:null,data:state()},origin,null),null)
})
test('outgoing messages match CONTRATTO §4 exactly',()=>{
 const o=proto.outgoing
 assert.deepEqual(o.ready(),{type:'tako-menu-edit-ready',v:1});assert.deepEqual(o.select({kind:'item',id:'i'}),{type:'tako-menu-edit-select',v:1,kind:'item',id:'i'});assert.deepEqual(o.select(null),{type:'tako-menu-edit-select',v:1,kind:null})
 assert.deepEqual(o.open({kind:'section',id:'s'}),{type:'tako-menu-edit-open',v:1,kind:'section',id:'s'});assert.deepEqual(o.ops([{op:'manualOrder',value:true}],3,true),{type:'tako-menu-edit-ops',v:1,ops:[{op:'manualOrder',value:true}],seq:3,provisional:true})
 assert.equal('provisional' in o.ops([],1),false);assert.deepEqual(o.mode(true),{type:'tako-menu-edit-mode',v:1,editing:true});assert.deepEqual(o.menu('m'),{type:'tako-menu-edit-menu',v:1,menuId:'m'});assert.deepEqual(o.error('X'),{type:'tako-menu-edit-error',v:1,code:'X'})
 assert.ok(proto.sameSelection(null,null));assert.ok(proto.sameSelection({kind:'item',id:'a'},{kind:'item',id:'a'}));assert.ok(!proto.sameSelection({kind:'item',id:'a'},{kind:'section',id:'a'}))
})
test('the public page never loads the edit layer; the gesture has a single import point',()=>{
 const preview=readFileSync('apps/web/src/components/MenuPreview.tsx','utf8'),digital=readFileSync('apps/web/src/components/DigitalMenu.tsx','utf8'),renderer=readFileSync('apps/web/src/components/WorkspaceMenuRenderer.tsx','utf8'),gesture=readFileSync('apps/web/src/components/menu-edit/gesture.ts','utf8'),layer=readFileSync('apps/web/src/components/menu-edit/MenuEditLayer.tsx','utf8')
 assert.ok(preview.includes("lazy(()=>import('./menu-edit/MenuEditLayer'))"));assert.ok(!digital.includes('menu-edit'));assert.ok(!renderer.includes('menu-edit/'))
 assert.equal((gesture.match(/^export \{ createMenuGesture \}/gm)||[]).length,1);assert.ok(layer.includes("from './gesture'"));assert.ok(!layer.includes('gesture-stub'))
 for(const f of ['MenuEditLayer.tsx','selection.ts','protocol.ts','edit.css'])assert.ok(!/categori/i.test(readFileSync('apps/web/src/components/menu-edit/'+f,'utf8').replace(/\/\/.*$/gm,'')),f)
})
test('revisione 22/10: la fotografia dell’ordine manuale parte solo col rilascio di Menu/Sottomenu, nello stesso gruppo di op',()=>{
 const doc={design:{},menus:[{id:'cena',name:'Cena',type:'dinner',sections:[{id:'d',name:'Dolci',items:[{id:'i1',name:'Tiramisù',price:5},{id:'i2',name:'Panna cotta',price:5}]},{id:'p1',name:'Primi di terra',items:[]},{id:'a',name:'Antipasti',items:[]}]},{id:'pranzo',name:'Pranzo',type:'lunch',sections:[]}]}
 const pill=sel.dropOps(doc,{id:'d',kind:'submenu',fromGroup:'pills:cena',toGroup:'pills:cena',toIndex:0},13)
 assert.ok(pill.some(o=>o.op==='manualOrder'&&o.value===true),'fotografia presente');assert.ok(pill.at(-1).op==='reorder','rilascio dopo la fotografia')
 const menus=sel.dropOps(doc,{id:'cena',kind:'menu',fromGroup:'menus',toGroup:'menus',toIndex:0},13)
 assert.ok(menus.some(o=>o.op==='manualOrder'));assert.ok(menus.some(o=>o.op==='reorder'&&o.kind==='menu'))
 const dish=sel.dropOps(doc,{id:'i2',kind:'dish',fromGroup:'items:d',toGroup:'items:d',toIndex:0},13)
 assert.ok(dish.length>0&&!dish.some(o=>o.op==='manualOrder'),'piatti: niente fotografia')
 const manual=sel.dropOps({...doc,design:{manualOrder:true}},{id:'d',kind:'submenu',fromGroup:'pills:cena',toGroup:'pills:cena',toIndex:1},13)
 assert.ok(manual.length>0&&!manual.some(o=>o.op==='manualOrder'),'già manuale: solo il rilascio')
 const layer=readFileSync('apps/web/src/components/menu-edit/MenuEditLayer.tsx','utf8')
 assert.ok(!/provisional|true\)\s*\n?\s*}/.test(layer.replace(/\/\/.*$/gm,'').match(/onModeChange[\s\S]*?\n\s{6}},/)[0]),'entrata nel tremolio senza op')
 assert.ok(!/requestAnimationFrame\(tick\)/.test(layer),'niente ciclo a ogni frame per seguire la selezione')
})
