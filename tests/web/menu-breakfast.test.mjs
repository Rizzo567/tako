// Regola COLAZIONE (16/10/2026): prodotti da colazione mai in "Menu", menu dedicato "Colazione" (type main) primo.
// Regola CAFFETTERIA (16/10/2026): la caffetteria calda resta nelle bevande e viene anche copiata (id nuovi) in Colazione / Caffetteria.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import {transform} from 'esbuild'
import {isBreakfastSection,isBreakfastItemName,isBreakfastMenuName,misplacedBreakfast,isHotCoffeeItemName,isCoffeeSectionName,breakfastCoffeeSources} from '../../scripts/menu-structure/breakfast.mjs'
import {restructure} from '../../scripts/menu-structure/restructure.mjs'
async function lib(file){const ctx={module:{exports:{}}};runInNewContext((await transform(readFileSync(file,'utf8'),{loader:'ts',format:'cjs'})).code,ctx);return ctx.module.exports}
const it=(name,extra={})=>({id:crypto.randomUUID(),name,price:2,hidden:false,...extra})
const sec=(name,items=[])=>({id:crypto.randomUUID(),name,items,parentSectionId:null,translations:{},description:null,active:true})

test('classifies breakfast sections by name or by their dishes, never coffee sections',()=>{
 for(const name of ['Brioches','Cornetti','Croissant','French toast','French toast salato','Pancakes','Bagel','Colazione','Brunch','Pasticceria da banco'])assert.equal(isBreakfastSection(sec(name)),true,name)
 for(const name of ['Caffetteria','Caffè e Succhi','Dolci','Pizze','Antipasti','Primi','Pasticceria'])assert.equal(isBreakfastSection(sec(name)),false,name)
 assert.equal(isBreakfastSection(sec('Dal forno',[it('Cornetto vuoto'),it('Cornetto alla crema'),it('Muffin')])),true)
 assert.equal(isBreakfastSection(sec('Dal forno',[it('Cornetto vuoto'),it('Focaccia'),it('Pizza rossa'),it('Pane')])),false)
 assert.equal(isBreakfastSection(sec('Caffè e Succhi',[it('Cappuccino e brioche'),it('Brioche e caffè')])),false)
 for(const name of ['Uova Benedict','Eggs Benedict','Uova strapazzate','Pain au chocolat','Pancake allo sciroppo'])assert.equal(isBreakfastItemName(name),true,name)
 for(const name of ['Carbonara','Tagliatelle all\'uovo','Tiramisù'])assert.equal(isBreakfastItemName(name),false,name)
 assert.equal(isBreakfastMenuName('Colazione'),true);assert.equal(isBreakfastMenuName('Menu'),false)
 assert.deepEqual(misplacedBreakfast([{name:'Menu',sections:[sec('Brioches'),sec('Primi')]},{name:'Colazione',sections:[sec('Cornetti')]}]),[{menu:'Menu',section:'Brioches'}])
})

test('restructure creates Colazione as first main menu and keeps every dish identical',()=>{
 const brioche=it('Brioche vuota'),toast=it('French toast'),pasta=it('Carbonara'),coffee=it('Espresso')
 const w={menus:[{id:crypto.randomUUID(),name:'Cena',type:'dinner',active:true,translations:{},description:null,sections:[sec('Primi',[pasta]),sec('Brioches',[brioche]),sec('French toast',[toast])]},{id:crypto.randomUUID(),name:'Drinks',type:'drinks',active:true,translations:{},description:null,sections:[sec('Caffetteria',[coffee])]}],design:{}}
 const plan={targets:[{name:'Menu',type:'main',keep:'Cena',from:[['Cena',['Primi']]]},{name:'Drinks',type:'drinks',keep:'Drinks',from:[['Drinks','*']]},{name:'Colazione',type:'main',keep:null,from:[['Cena',['Brioches','French toast']]]}]}
 const out=restructure(w,plan)
 assert.deepEqual(out.errors,[])
 assert.deepEqual(out.workspace.menus.map(m=>[m.name,m.type]),[['Colazione','main'],['Menu','main'],['Drinks','drinks']])
 assert.match(out.workspace.menus[0].id,/^[0-9a-f-]{36}$/)
 assert.deepEqual(out.workspace.menus[0].sections.slice(0,2).flatMap(s=>s.items),[brioche,toast])
 assert.deepEqual(out.workspace.menus[2].sections.flatMap(s=>s.items),[coffee])
 const caff=out.workspace.menus[0].sections.at(-1);assert.equal(caff.name,'Caffetteria');assert.equal(caff.items.length,1)
 assert.notEqual(caff.items[0].id,coffee.id);assert.deepEqual({...caff.items[0],id:coffee.id},coffee)
})

test('hot coffee classifier: caffetteria calda sì; fredda, succhi, bibite, alcolici, correzioni, tessere no',()=>{
 for(const name of ["CAFFE'","Caffè espresso",'CAFFE MACCHIATO',"CAFFE' DECA",'Caffè decaffeinato','MAROCCHINO','CAFFE AMERICANO','Caffè corretto','GINSENG PICCOLO','ORZO GRANDE','Caffè ginseng/orzo in tazza grande','Cappuccino','CAPPUCCINO SOIA','CAPPUCCINO ORZO DECA','LATTE BIANCO','Latte macchiato','MOCACCINO','Nutellino','Cioccolata calda','Cioccolata calda con panna','Thé caldo','Tè verde','Tisana','Espresso'])assert.equal(isHotCoffeeItemName(name),true,name)
 for(const name of ["CAFFE' SHAKERATO","CREMA CAFFE'",'Caffè freddo','SPREMUTA','SUCCO FRUTTA','Succhi di frutta','BRICK','Correzione','Tessera caffè','Estathé al limone','Estathé alla pesca','Acqua 0,5 l','Coca-Cola 33cl','Sambuca','Grappa bianca','MIRTILLO','Brioche vuota'])assert.equal(isHotCoffeeItemName(name),false,name)
 for(const name of ['Caffetteria','CAFFETTERIA','Caffè e Succhi','Coffee'])assert.equal(isCoffeeSectionName(name),true,name)
 for(const name of ['Bevande','Bibite e analcolici','Amari e Liquori','No - Alcohol Drinks'])assert.equal(isCoffeeSectionName(name),false,name)
})

test('breakfastCoffeeSources: solo sezioni di caffetteria fuori da Colazione, visibili, nell\'ordine del menu',()=>{
 const a=it('Caffè espresso'),b=it('Cappuccino'),hidden=it('Tisane',{hidden:true}),juice=it('Spremuta'),soda=it('Tè caldo')
 const menus=[{name:'Colazione',sections:[sec('Caffetteria',[it('Espresso')])]},{name:'Drinks',sections:[sec('Caffè e Succhi',[a,juice,hidden,b]),sec('Bibite',[soda])]}]
 assert.deepEqual(breakfastCoffeeSources(menus).map(x=>x.item),[a,b])
})

test('restructure copia la caffetteria in Colazione con id nuovi (anche varianti), in fondo e nello stesso ordine; idempotente',()=>{
 const espresso=it('Caffè espresso',{translations:{en:{name:'Espresso'}},allergens:[]}),ginseng=it('Ginseng',{variants:[{id:crypto.randomUUID(),name:'Piccolo',priceModifier:0,available:true},{id:crypto.randomUUID(),name:'Grande',priceModifier:0.4,available:true}]}),shake=it('Caffè shakerato'),juice=it('Spremuta'),brioche=it('Brioche')
 const w={menus:[{id:crypto.randomUUID(),name:'Cena',type:'dinner',active:true,translations:{},description:null,sections:[sec('Brioches',[brioche])]},{id:crypto.randomUUID(),name:'Drinks',type:'drinks',active:true,translations:{},description:null,sections:[sec('Caffetteria',[espresso,shake,juice,ginseng])]}],design:{}}
 const plan={targets:[{name:'Colazione',type:'main',keep:null,from:[['Cena',['Brioches']]]},{name:'Drinks',type:'drinks',keep:'Drinks',from:[['Drinks','*']]}]}
 const out=restructure(w,plan);assert.deepEqual(out.errors,[])
 const [col,drinks]=out.workspace.menus;assert.deepEqual(col.sections.map(s=>s.name),['Brioches','Caffetteria'])
 const copies=col.sections[1].items;assert.deepEqual(copies.map(i=>i.name),['Caffè espresso','Ginseng'])
 assert.deepEqual(drinks.sections[0].items,[espresso,shake,juice,ginseng])
 for(const [c,o] of [[copies[0],espresso],[copies[1],ginseng]]){assert.notEqual(c.id,o.id);const {id:_c,variants:vc,...rc}=c,{id:_o,variants:vo,...ro}=o;assert.deepEqual(rc,ro);assert.equal(vc?.length,vo?.length);(c.variants||[]).forEach((v,k)=>{assert.notEqual(v.id,o.variants[k].id);assert.deepEqual({...v,id:o.variants[k].id},o.variants[k])})}
 assert.deepEqual(out.copied.sort(),copies.map(i=>i.id).sort())
 const again=restructure(out.workspace,{targets:[{name:'Colazione',type:'main',keep:'Colazione',from:[['Colazione','*']]},{name:'Drinks',type:'drinks',keep:'Drinks',from:[['Drinks','*']]}]})
 assert.deepEqual(again.errors,[]);assert.equal(again.workspace.menus[0].sections.filter(s=>s.name==='Caffetteria').length,1);assert.equal(again.workspace.menus[0].sections[1].items.length,2)
 const off=restructure(w,{...plan,breakfastCoffee:false});assert.deepEqual(off.workspace.menus[0].sections.map(s=>s.name),['Brioches'])
})

test('restructure senza menu Colazione o senza caffetteria non copia nulla',()=>{
 const w={menus:[{id:crypto.randomUUID(),name:'Cena',type:'dinner',active:true,translations:{},description:null,sections:[sec('Primi',[it('Carbonara')])]},{id:crypto.randomUUID(),name:'Drinks',type:'drinks',active:true,translations:{},description:null,sections:[sec('Caffetteria',[it('Espresso')])]}],design:{}}
 const out=restructure(w,{targets:[{name:'Menu',type:'main',keep:'Cena',from:[['Cena','*']]},{name:'Drinks',type:'drinks',keep:'Drinks',from:[['Drinks','*']]}]})
 assert.deepEqual(out.errors,[]);assert.deepEqual(out.copied,[]);assert.equal(out.workspace.menus.flatMap(m=>m.sections).length,2)
 const w2={menus:[{id:crypto.randomUUID(),name:'Cena',type:'dinner',active:true,translations:{},description:null,sections:[sec('Bagel',[it('Bagel')])]},{id:crypto.randomUUID(),name:'Drinks',type:'drinks',active:true,translations:{},description:null,sections:[sec('Bevande',[it('Coca-Cola')])]}],design:{}}
 const out2=restructure(w2,{targets:[{name:'Colazione',type:'main',keep:null,from:[['Cena',['Bagel']]]},{name:'Drinks',type:'drinks',keep:'Drinks',from:[['Drinks','*']]}]})
 assert.deepEqual(out2.errors,[]);assert.deepEqual(out2.workspace.menus[0].sections.map(s=>s.name),['Bagel'])
})

test('restructure blocks a plan that leaves breakfast products in "Menu"',()=>{
 const w={menus:[{id:crypto.randomUUID(),name:'Cena',type:'dinner',active:true,translations:{},description:null,sections:[sec('Primi',[it('Carbonara')]),sec('Brioches',[it('Brioche')])]}],design:{}}
 const out=restructure(w,{targets:[{name:'Menu',type:'main',keep:'Cena',from:[['Cena','*']]}]})
 assert.deepEqual(out.errors,['colazione fuori da "Colazione": Menu / Brioches'])
})

test('public menu tabs put Colazione first at every hour, also when translated',async()=>{
 const {orderDayMenus,dayMenuKind}=await lib('apps/web/src/lib/menu-day-order.ts')
 const menus=[{id:'c',name:'Cena',type:'dinner'},{id:'d',name:'Drinks',type:'drinks'},{id:'b',name:'Colazione',type:'main'},{id:'p',name:'Pranzo',type:'lunch'}]
 for(const hour of [3,8,13,19,23])assert.equal(orderDayMenus(menus,hour)[0].id,'b',String(hour))
 for(const name of ['Colazione','Breakfast','Frühstück','Petit-déjeuner','Desayuno','Pequeno-almoço','Śniadanie','Завтрак','الإفطار','早餐','朝食'])assert.equal(dayMenuKind({name,type:'main'}),'breakfast',name)
 assert.equal(dayMenuKind({name:'Menu',type:'main'}),'dinner')
})

test('Colazione title is translated in every menu language',async()=>{
 const {menuNameCopy}=await lib('apps/web/src/lib/menu-name-copy.ts')
 const want={it:'Colazione',en:'Breakfast',de:'Frühstück',fr:'Petit-déjeuner',es:'Desayuno',pt:'Pequeno-almoço',nl:'Ontbijt',pl:'Śniadanie',ru:'Завтрак',ar:'الإفطار',zh:'早餐',ja:'朝食'}
 for(const [lang,name] of Object.entries(want))assert.equal(menuNameCopy('Colazione',lang),name,lang)
 assert.equal(menuNameCopy('Drinks','it'),'Bevande');assert.equal(menuNameCopy('Cena','en'),'Dinner')
})
