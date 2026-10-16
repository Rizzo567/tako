// node --experimental-strip-types --test scripts/menu-fix/ops-engine.test.mjs
import test from 'node:test';import assert from 'node:assert/strict'
import {applyOps,diffWorkspaces,countOps,zodAvailable,structuralErrors,canonical,untouchedChanges} from './ops-engine.mjs'

const U=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const item=(n,name,price,extra={})=>({id:U(n),name,description:null,price,imageUrl:null,allergens:[],tags:[],additives:[],available:true,hidden:false,featured:false,displayMode:'normal',externalLink:null,priceDisplay:null,kitchenStation:null,prepTimeMinutes:10,costPrice:null,calories:null,variants:[],translations:{en:{name:name+' EN'}},...extra})
const section=(n,name,items,parent=null)=>({id:U(n),parentSectionId:parent,name,description:null,active:true,translations:{},items})
function ws(){return {schemaVersion:1,languages:['it','en'],defaultLanguage:'it',translationSettings:{protectedNames:[],glossary:[]},foodTranslations:{},design:{preset:'tako',headerTitle:'X'},pdf:{format:'A4'},pdfPresets:[],
 menus:[
  {id:U(1),name:'Menu',description:null,type:'main',active:true,translations:{},sections:[
   section(10,'Antipasti',[item(100,'Bruschetta',5),item(101,'Bruschetta',5),item(102,'Tagliere',12)]),
   section(11,'Colazione',[item(110,'Cornetto',1.5),item(111,'Cappuccino',1.8)]),
   section(12,'Pizze',[item(120,'Margherita',7)]),
   section(13,'Pizze bianche',[item(130,'Focaccia',5)],U(12)),
   section(14,'Vuota',[]),
  ]},
  {id:U(2),name:'Bevande',description:null,type:'drinks',active:true,translations:{},sections:[
   section(20,'Birre',[item(200,'Birra piccola',4),item(201,'Birra media',6),item(202,'Tenents',5),item(203,'Spritz',6,{variants:[{id:U(2030),name:'Aperol',priceModifier:0,available:true}]})]),
   section(21,'Note',[item(210,'Coperto 2€',0)]),
  ]},
 ]}}
const ev={reason:'test',evidence:{source:'live',ref:'x',quote:'x'}}
let seq=0;const rnd=()=>`aaaaaaaa-0000-4000-8000-${String(++seq).padStart(12,'0')}`
const run=(ops,opts={})=>applyOps(ws(),ops.map(o=>({...ev,...o})),{randomUUID:rnd,...opts})
const all=w=>w.menus.flatMap(m=>m.sections.flatMap(s=>s.items))
const sec=(w,id)=>w.menus.flatMap(m=>m.sections).find(s=>s.id===id)

test('zod contract caricato (lanciare con --experimental-strip-types)',()=>assert.ok(zodAvailable()))
test('il workspace finto è valido e applyOps([]) non cambia nulla',()=>{const r=run([]);assert.deepEqual(r.errors,[]);assert.equal(canonical(r.workspace),canonical(ws()))})
test('input non mutato',()=>{const w=ws(),snap=canonical(w);applyOps(w,[{...ev,op:'deleteItem',itemId:U(101)}],{randomUUID:rnd});assert.equal(canonical(w),snap)})

test('deleteItem',()=>{const r=run([{op:'deleteItem',itemId:U(101)}]);assert.deepEqual(r.errors,[]);assert.equal(sec(r.workspace,U(10)).items.length,2);assert.ok(!all(r.workspace).some(i=>i.id===U(101)))})
test('deleteItem id inesistente -> errore',()=>{const r=run([{op:'deleteItem',itemId:U(999)}]);assert.match(r.errors[0].message,/item inesistente/)})

test('updateItem tocca solo i campi in set',()=>{
 const r=run([{op:'updateItem',itemId:U(202),set:{name:"Tennent's",price:5.5,allergens:['glutine'],priceDisplay:'S.Q.',hidden:true,description:'Lager'}}])
 assert.deepEqual(r.errors,[]);const i=all(r.workspace).find(x=>x.id===U(202)),o=all(ws()).find(x=>x.id===U(202))
 assert.equal(i.name,"Tennent's");assert.equal(i.price,5.5);assert.deepEqual(i.allergens,['glutine']);assert.equal(i.priceDisplay,'S.Q.');assert.equal(i.hidden,true);assert.equal(i.description,'Lager')
 assert.deepEqual(i.translations,o.translations);assert.equal(i.prepTimeMinutes,o.prepTimeMinutes)
})
test('updateItem errori: campo non ammesso, prezzo negativo, allergene ignoto, set vuoto',()=>{
 const r=run([{op:'updateItem',itemId:U(100),set:{tags:['x']}},{op:'updateItem',itemId:U(100),set:{price:-1}},{op:'updateItem',itemId:U(100),set:{allergens:['gluten']}},{op:'updateItem',itemId:U(100),set:{}}])
 assert.equal(r.errors.length,4);assert.match(r.errors[0].message,/non ammessi/);assert.match(r.errors[1].message,/price/);assert.match(r.errors[2].message,/allergeni sconosciuti/);assert.match(r.errors[3].message,/vuoto/)
})
test('allergenIds dal catalogo live',()=>{const r=run([{op:'updateItem',itemId:U(100),set:{allergens:['custom']}}],{allergenIds:['custom']});assert.deepEqual(r.errors,[])})

test('moveItem con index e verso sezione temp',()=>{
 const r=run([{op:'moveItem',itemId:U(102),toSectionId:U(12),index:0},
  {op:'createMenu',temp:'col',name:'Colazione',type:'main',index:0},{op:'createSection',temp:'brioche',menuTemp:'col',name:'Brioches'},
  {op:'moveItem',itemId:U(110),toSectionTemp:'brioche'}])
 assert.deepEqual(r.errors,[]);assert.deepEqual(sec(r.workspace,U(12)).items.map(i=>i.name),['Tagliere','Margherita'])
 assert.equal(r.workspace.menus[0].name,'Colazione');assert.equal(r.workspace.menus[0].sections[0].items[0].name,'Cornetto');assert.equal(r.workspace.menus[0].id,r.temps.col)
 assert.equal(r.workspace.menus[0].sections[0].id,r.temps.brioche)
})
test('moveItem index fuori range / temp sconosciuto / entrambi i target -> errore',()=>{
 const r=run([{op:'moveItem',itemId:U(102),toSectionId:U(12),index:9},{op:'moveItem',itemId:U(102),toSectionTemp:'boh'},{op:'moveItem',itemId:U(102),toSectionId:U(12),toSectionTemp:'x'}])
 assert.equal(r.errors.length,3);assert.match(r.errors[0].message,/fuori range/);assert.match(r.errors[1].message,/temp sconosciuto/);assert.match(r.errors[2].message,/esattamente uno/)
})

test('createMenu: type non valido e temp duplicato',()=>{const r=run([{op:'createMenu',temp:'a',name:'X',type:'brunch'},{op:'createMenu',temp:'b',name:'X',type:'lunch'},{op:'createMenu',temp:'b',name:'Y',type:'lunch'}]);assert.equal(r.errors.length,2);assert.match(r.errors[0].message,/type/);assert.match(r.errors[1].message,/duplicato/)})

test('createSection figlia: va dopo le figlie esistenti, parent temp',()=>{
 const r=run([{op:'createSection',temp:'rosse',menuId:U(1),name:'Pizze rosse',parentSectionId:U(12)},{op:'createSection',temp:'p',menuId:U(2),name:'Vini'},{op:'createSection',temp:'c',menuId:U(2),name:'Rossi',parentTemp:'p',description:'d'}])
 assert.deepEqual(r.errors,[]);const names=r.workspace.menus[0].sections.map(s=>s.name);assert.deepEqual(names,['Antipasti','Colazione','Pizze','Pizze bianche','Pizze rosse','Vuota'])
 const rossi=r.workspace.menus[1].sections.find(s=>s.name==='Rossi');assert.equal(rossi.parentSectionId,r.temps.p);assert.equal(rossi.description,'d')
})
test('createSection errori: padre già figlio, padre in altro menu',()=>{const r=run([{op:'createSection',temp:'x',menuId:U(1),name:'X',parentSectionId:U(13)},{op:'createSection',temp:'y',menuId:U(2),name:'Y',parentSectionId:U(12)}]);assert.equal(r.errors.length,2);assert.match(r.errors[0].message,/max 1 livello/);assert.match(r.errors[1].message,/stesso menu/)})

test('updateSection: nome, descrizione, parent e promozione a radice',()=>{
 const r=run([{op:'updateSection',sectionId:U(14),set:{name:'Dolci',description:'fatti in casa',parentSectionId:U(10)}},{op:'updateSection',sectionId:U(13),set:{parentSectionId:null}}])
 assert.deepEqual(r.errors,[]);const s=sec(r.workspace,U(14));assert.equal(s.name,'Dolci');assert.equal(s.parentSectionId,U(10));assert.equal(sec(r.workspace,U(13)).parentSectionId,null)
})
test('updateSection errori: con figlie non può diventare figlia, self, campo vietato',()=>{const r=run([{op:'updateSection',sectionId:U(12),set:{parentSectionId:U(10)}},{op:'updateSection',sectionId:U(10),set:{parentSectionId:U(10)}},{op:'updateSection',sectionId:U(10),set:{active:false}}]);assert.equal(r.errors.length,3)})

test('moveSection porta le figlie, con index',()=>{
 const r=run([{op:'moveSection',sectionId:U(12),toMenuId:U(2),index:0}])
 assert.deepEqual(r.errors,[]);assert.deepEqual(r.workspace.menus[1].sections.map(s=>s.name),['Pizze','Pizze bianche','Birre','Note']);assert.ok(!r.workspace.menus[0].sections.some(s=>s.id===U(13)))
 assert.equal(sec(r.workspace,U(13)).parentSectionId,U(12))
})
test('moveSection verso menu temp e riordino nello stesso menu',()=>{const r=run([{op:'createMenu',temp:'col',name:'Colazione',type:'main',index:0},{op:'moveSection',sectionId:U(11),toMenuTemp:'col'},{op:'moveSection',sectionId:U(14),toMenuId:U(1),index:0}]);assert.deepEqual(r.errors,[]);assert.equal(r.workspace.menus[0].sections[0].name,'Colazione');assert.equal(r.workspace.menus[1].sections[0].name,'Vuota')})
test('moveSection figlia verso altro menu -> errore',()=>{const r=run([{op:'moveSection',sectionId:U(13),toMenuId:U(2)}]);assert.match(r.errors[0].message,/figlia/)})

test('deleteSection solo se vuota e senza figlie (anche dopo op precedenti)',()=>{
 const r=run([{op:'deleteSection',sectionId:U(14)},{op:'deleteSection',sectionId:U(10)},{op:'deleteSection',sectionId:U(12)},{op:'moveItem',itemId:U(210),toSectionId:U(20)},{op:'deleteSection',sectionId:U(21)}])
 assert.equal(r.errors.length,2);assert.match(r.errors[0].message,/non vuota/);assert.match(r.errors[1].message,/figlie|non vuota/)
 assert.ok(!sec(r.workspace,U(14)));assert.ok(!sec(r.workspace,U(21)))
})

test('updateMenu: nome e note',()=>{const r=run([{op:'updateMenu',menuId:U(2),set:{name:'Drink',description:'Coperto 2 €'}}]);assert.deepEqual(r.errors,[]);assert.equal(r.workspace.menus[1].description,'Coperto 2 €');assert.equal(r.workspace.menus[1].type,'drinks')})
test('updateMenu type non ammesso / menu inesistente',()=>{const r=run([{op:'updateMenu',menuId:U(2),set:{type:'main'}},{op:'updateMenu',menuId:U(9),set:{name:'x'}}]);assert.equal(r.errors.length,2)})

test('toVariants: base=min, modifier=diff, elimina fromItemId',()=>{
 const r=run([{op:'toVariants',baseItemId:U(200),set:{name:'Birra'},variants:[{name:'Media 0,4',price:6,fromItemId:U(201)},{name:'Piccola 0,2',price:4}]}])
 assert.deepEqual(r.errors,[]);const b=all(r.workspace).find(i=>i.id===U(200));assert.equal(b.name,'Birra');assert.equal(b.price,4)
 assert.deepEqual(b.variants.map(v=>[v.name,v.priceModifier,v.available]),[['Media 0,4',2,true],['Piccola 0,2',0,true]]);assert.ok(b.variants.every(v=>/^aaaaaaaa/.test(v.id)))
 assert.ok(!all(r.workspace).some(i=>i.id===U(201)))
})
test('toVariants: arrotonda ai centesimi',()=>{const r=run([{op:'toVariants',baseItemId:U(200),variants:[{name:'a',price:4.1},{name:'b',price:4.3}]}]);assert.equal(all(r.workspace).find(i=>i.id===U(200)).variants[1].priceModifier,0.2)})
test('toVariants errori: base con varianti, 1 sola variante, fromItemId=base, fromItemId inesistente',()=>{
 const r=run([{op:'toVariants',baseItemId:U(203),variants:[{name:'a',price:1},{name:'b',price:2}]},{op:'toVariants',baseItemId:U(200),variants:[{name:'a',price:1}]},{op:'toVariants',baseItemId:U(200),variants:[{name:'a',price:1,fromItemId:U(200)},{name:'b',price:2}]},{op:'toVariants',baseItemId:U(200),variants:[{name:'a',price:1,fromItemId:U(999)},{name:'b',price:2}]}])
 assert.equal(r.errors.length,4);assert.match(r.errors[0].message,/già 1 varianti/)
 assert.equal(all(r.workspace).find(i=>i.id===U(200)).variants.length,0)
})

test('copyItem: copia identica con id nuovi (piatto e varianti), originale intatto, anche verso menu/sezione temp',()=>{
 const r=run([{op:'createMenu',temp:'col',name:'Colazione',type:'main',index:0},{op:'createSection',temp:'caff',menuTemp:'col',name:'Caffetteria'},
  {op:'copyItem',itemId:U(111),toSectionTemp:'caff'},{op:'copyItem',itemId:U(203),toSectionTemp:'caff'},{op:'copyItem',itemId:U(100),toSectionTemp:'caff',index:0}])
 assert.deepEqual(r.errors,[]);assert.deepEqual(structuralErrors(r.workspace),[])
 const caff=r.workspace.menus[0].sections[0];assert.equal(caff.id,r.temps.caff);assert.deepEqual(caff.items.map(i=>i.name),['Bruschetta','Cappuccino','Spritz'])
 const src=all(ws()),orig=id=>src.find(i=>i.id===id)
 for(const [copy,id] of [[caff.items[1],U(111)],[caff.items[2],U(203)],[caff.items[0],U(100)]]){
  const o=orig(id);assert.notEqual(copy.id,o.id);assert.match(copy.id,/^aaaaaaaa/)
  const {id:_a,variants:va,...restCopy}=copy,{id:_b,variants:vb,...restOrig}=o;assert.deepEqual(restCopy,restOrig)
  assert.equal(va.length,vb.length);va.forEach((v,k)=>{assert.notEqual(v.id,vb[k].id);assert.deepEqual({...v,id:0},{...vb[k],id:0})})
 }
 assert.deepEqual(sec(r.workspace,U(11)).items.map(i=>i.id),[U(110),U(111)]);assert.deepEqual(all(r.workspace).find(i=>i.id===U(203)),orig(U(203)))
 const d=diffWorkspaces(ws(),r.workspace);assert.equal(d.addedItems.length,3);assert.deepEqual(d.removedItems,[]);assert.deepEqual(d.movedItems,[])
})
test('copyItem verso sezione esistente con index; copia non condivide riferimenti con l\'originale',()=>{
 const r=run([{op:'copyItem',itemId:U(203),toSectionId:U(11),index:1}])
 assert.deepEqual(r.errors,[]);const c=sec(r.workspace,U(11)).items[1];assert.equal(c.name,'Spritz')
 c.translations.en.name='X';c.variants[0].name='Y';const o=all(r.workspace).find(i=>i.id===U(203));assert.equal(o.translations.en.name,'Spritz EN');assert.equal(o.variants[0].name,'Aperol')
})
test('copyItem errori: stessa sezione, item inesistente, index fuori range, target doppio',()=>{
 const r=run([{op:'copyItem',itemId:U(100),toSectionId:U(10)},{op:'copyItem',itemId:U(999),toSectionId:U(11)},{op:'copyItem',itemId:U(100),toSectionId:U(11),index:7},{op:'copyItem',itemId:U(100),toSectionId:U(11),toSectionTemp:'x'}])
 assert.equal(r.errors.length,4);assert.match(r.errors[0].message,/stessa sezione/);assert.match(r.errors[1].message,/item inesistente/);assert.match(r.errors[2].message,/fuori range/);assert.match(r.errors[3].message,/esattamente uno/)
 assert.equal(canonical(r.workspace.menus),canonical(ws().menus))
})
test('integrità: un item nuovo senza copyItem resta "comparso dal nulla"',()=>{
 const w=ws(),after=structuredClone(w);after.menus[0].sections[0].items.push(item(555,'Abusivo',1))
 const t={items:new Set(),sections:new Set(),menus:new Set(),deletedItems:new Set(),deletedSections:new Set(),newSections:new Set(),newMenus:new Set(),newItems:new Set()}
 assert.ok(untouchedChanges(w,after,t).some(m=>/comparso dal nulla: Abusivo/.test(m)))
})

test('op sconosciuta e evidence mancante -> errore',()=>{
 const r=applyOps(ws(),[{op:'renameAll'},{op:'deleteItem',itemId:U(100),reason:'x'}],{randomUUID:rnd});assert.equal(r.errors.length,2);assert.match(r.errors[0].message,/sconosciuta/);assert.match(r.errors[1].message,/evidence/)
 const ok=applyOps(ws(),[{op:'deleteItem',itemId:U(100)}],{randomUUID:rnd,requireEvidence:false});assert.deepEqual(ok.errors,[])
})

test('scenario completo valido con zod e integrità',()=>{
 const r=run([{op:'createMenu',temp:'col',name:'Colazione',type:'main',index:0},{op:'moveSection',sectionId:U(11),toMenuTemp:'col'},{op:'moveItem',itemId:U(111),toSectionId:U(20)},
  {op:'deleteItem',itemId:U(101)},{op:'updateItem',itemId:U(202),set:{name:"Tennent's"}},{op:'toVariants',baseItemId:U(200),variants:[{name:'Piccola',price:4},{name:'Media',price:6,fromItemId:U(201)}]},
  {op:'updateMenu',menuId:U(2),set:{description:'Coperto 2 €'}},{op:'deleteItem',itemId:U(210)},{op:'deleteSection',sectionId:U(21)},{op:'deleteSection',sectionId:U(14)}])
 assert.deepEqual(r.errors,[]);assert.deepEqual(structuralErrors(r.workspace),[])
 const d=diffWorkspaces(ws(),r.workspace);assert.equal(d.removedItems.length,3);assert.ok(d.changedItems.some(c=>c.item==="Tennent's"&&c.changes.name[0]==='Tenents'));assert.ok(d.movedItems.some(m=>m.name==='Cappuccino'))
 assert.deepEqual(d.menus.map(m=>m.change).sort(),['aggiornato','creato']);assert.equal(d.sections.filter(s=>s.change==='eliminata').length,2)
 assert.deepEqual(countOps([{op:'a'},{op:'a'},{op:'b'}]),{a:2,b:1})
})

test('validazione: uuid duplicato e gerarchia rotta nel workspace di partenza',()=>{
 const w=ws();w.menus[1].sections[0].items[0].id=U(100);w.menus[1].sections[1].parentSectionId=U(12)
 const r=applyOps(w,[],{randomUUID:rnd});assert.ok(r.errors.some(e=>/duplicato/.test(e.message)));assert.ok(r.errors.some(e=>/gerarchia/.test(e.message)));assert.ok(r.errors.some(e=>e.op==='zod'))
})
test('validazione: prezzo negativo di partenza',()=>{const w=ws();w.menus[0].sections[0].items[0].price=-2;assert.ok(structuralErrors(w).some(m=>/prezzo/.test(m)))})
