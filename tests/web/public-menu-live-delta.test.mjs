import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import {build,transform} from 'esbuild';import {resolve} from 'node:path'
// Parità del delta live (17/10): applicare al menu a schermo il delta pubblicato deve dare ESATTAMENTE la risposta che il server
// darebbe rileggendo (stessa publicWorkspace + publicMenuProjection della read-edge), in italiano e in un'altra lingua, con e senza traduzione.
const stub={name:'stub',setup(b){b.onResolve({filter:/^(@tako\/db|drizzle-orm)$/},a=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const db={},menuItems={},and=()=>0,eq=()=>0,sql=()=>0,inArray=()=>0,asc=()=>0,desc=()=>0,or=()=>0;export const menus={},menuSections={},itemVariants={},menuItemTranslations={},restaurants={},menuWorkspaces={};',loader:'js'}))}}
async function server(){const out=await build({stdin:{contents:"export {publicMenuProjection,applyPublicAvailability} from './apps/server/src/lib/published-menu.ts';export {publicWorkspace} from './apps/server/src/lib/menu-workspace-schedule.ts'",resolveDir:resolve('.'),loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',plugins:[stub],logLevel:'silent'});const m={exports:{}};new Function('module','exports','require',out.outputFiles[0].text)(m,m.exports,(await import('node:module')).createRequire(resolve('apps/server/package.json')));return m.exports}
async function client(){const out={module:{exports:{}},document:undefined,JSON,Math};runInNewContext((await transform(readFileSync('apps/web/src/lib/public-menu-live.ts','utf8'),{loader:'ts',format:'cjs'})).code,out);return out.module.exports}
const item=(id,name,price,extra={})=>({id,name,tags:[],price,hidden:false,calories:null,featured:false,imageUrl:null,variants:[],additives:[],allergens:[],available:true,costPrice:null,description:'Descrizione '+name,displayMode:'normal',externalLink:null,priceDisplay:null,translations:{},kitchenStation:null,prepTimeMinutes:10,...extra})
const workspace=()=>({schemaVersion:1,defaultLanguage:'it',languages:['it','en'],foodTranslations:{},design:{},pdf:{},pdfPresets:[],menus:[{id:'m1',name:'Cena',type:'food',active:true,description:null,translations:{},sections:[{id:'s1',name:'Primi',active:true,description:null,translations:{},parentSectionId:null,items:[item('a','Carbonara',12,{translations:{en:{name:'Carbonara EN',description:'Eggs'}}}),item('b','Amatriciana',11),item('c','Gricia',10.5,{description:null})]},{id:'s2',name:'Dolci',active:true,description:null,translations:{},parentSectionId:null,items:[item('d','Tiramisù',6)]}]}]})
const response=(srv,w,lang)=>{const pub=srv.publicWorkspace(w,new Date(),{ignoreSchedules:true});const ids=new Set(w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.filter(i=>i.available&&!i.hidden).map(i=>i.id))));srv.applyPublicAvailability(w,pub,ids);return JSON.parse(JSON.stringify({data:srv.publicMenuProjection(pub.menus[0],lang||pub.defaultLanguage,pub.defaultLanguage),defaultLanguage:pub.defaultLanguage}))}
// Delta come lo costruisce tako_menu_live_delta (sql/up.sql) dal NUOVO pubblicato.
const delta=(w,ids)=>w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.filter(i=>ids.includes(i.id)).map(i=>({i:i.id,m:m.id,n:i.name,ds:i.description??null,p:i.price,t:i.translations??{},h:i.hidden??false,a:i.available??true}))))
const cases=[
 ['prezzo',w=>{w.menus[0].sections[0].items[1].price=13.5},['b']],
 ['nome senza traduzione',w=>{w.menus[0].sections[0].items[1].name='Amatriciana vera'},['b']],
 ['nome con traduzione',w=>{const i=w.menus[0].sections[0].items[0];i.name='Carbonara romana';i.translations={en:{name:'Roman carbonara',description:'Eggs'}}},['a']],
 ['traduzione tolta',w=>{w.menus[0].sections[0].items[0].translations={}},['a']],
 ['descrizione nulla → testo',w=>{w.menus[0].sections[0].items[2].description='Pecorino e guanciale'},['c']],
 ['esaurito',w=>{w.menus[0].sections[0].items[1].available=false},['b']],
 ['nascosto',w=>{w.menus[0].sections[1].items[0].hidden=true},['d']],
 ['due piatti',w=>{w.menus[0].sections[0].items[0].price=99;w.menus[0].sections[0].items[2].name='Gricia 2'},['a','c']]]
for(const [name,mutate,ids] of cases)for(const lang of ['','it','en','de'])test(`delta «${name}» (lingua ${lang||'predefinita'}) = rilettura del server`,async()=>{
 const srv=await server(),live=await client(),before=workspace(),after=workspace();mutate(after)
 const shown=response(srv,before,lang),expected=response(srv,after,lang),patched=live.applyLiveDelta(shown,delta(after,ids),lang)
 assert.ok(patched,'delta applicabile');assert.equal(JSON.stringify(patched),JSON.stringify(expected))})
test('piatto che torna visibile, menu svuotato o delta illeggibile → rilettura (null); piatto di un altro menu → nessun cambio',async()=>{
 const srv=await server(),live=await client(),w=workspace();w.menus[0].sections[0].items[1].available=false;const shown=response(srv,w,'')
 assert.equal(live.applyLiveDelta(shown,[{i:'b',m:'m1',n:'Amatriciana',ds:null,p:11,t:{},h:false,a:true}],''),null)
 assert.equal(live.applyLiveDelta(shown,[{i:'zz',m:'m2',n:'Altro',p:1,t:{},h:false,a:true}],''),shown)
 assert.equal(live.applyLiveDelta(shown,['a','c','d'].map(i=>({i,a:false})),''),null)
 assert.equal(live.applyLiveDelta(shown,[{i:'a'}],''),null);assert.equal(live.applyLiveDelta(shown,[{i:'a',a:false}],'').data.sections[0].items.length,1)
})
for(const lang of ['','en'])test(`delta «piatto eliminato» (lingua ${lang||'predefinita'}) = rilettura del server`,async()=>{
 const srv=await server(),live=await client(),before=workspace(),after=workspace();after.menus[0].sections[0].items.splice(1,1)
 const shown=response(srv,before,lang),expected=response(srv,after,lang),patched=live.applyLiveDelta(shown,[{i:'b',m:'m1',a:false}],lang)
 assert.ok(patched);assert.equal(JSON.stringify(patched),JSON.stringify(expected))})
// 21/10: il delta non distingue «eliminato» (Sottomenu vuoto nel documento → «Menu in arrivo») da «esaurito» (Sottomenu senza riga).
test('Sottomenu svuotato da un piatto eliminato → rilettura (il server lo segna «in arrivo»); da un esaurito → patch senza riga',async()=>{
 const srv=await server(),live=await client(),before=workspace(),shown=response(srv,before,'')
 assert.equal(live.applyLiveDelta(shown,[{i:'d',m:'m1',a:false}],''),null)
 const soldOutDelta=workspace();soldOutDelta.menus[0].sections[1].items[0].available=false
 assert.equal(JSON.stringify(live.applyLiveDelta(shown,delta(soldOutDelta,['d']),'')),JSON.stringify(response(srv,soldOutDelta,'')))
 const deleted=workspace();deleted.menus[0].sections[1].items=[];assert.equal(response(srv,deleted,'').data.sections[1].empty,true)
 const soldOut=workspace();soldOut.menus[0].sections[1].items[0].available=false;const s=response(srv,soldOut,'').data.sections[1];assert.equal(s.items.length,0);assert.equal(s.empty,undefined)})
test('menu vuoto («in arrivo») o con Sottomenu già vuoto: un delta di altri menu non provoca riletture',async()=>{
 const srv=await server(),live=await client(),w=workspace();w.menus[0].sections.forEach(s=>{s.items=[]})
 const shown=response(srv,w,'');assert.equal(shown.data.empty,true);assert.ok(shown.data.sections.every(s=>s.empty===true))
 assert.equal(live.applyLiveDelta(shown,[{i:'zz',m:'m2',a:false}],''),shown)
 assert.equal(live.applyLiveDelta(shown,[{i:'zz',m:'m2',n:'Altro',p:1,t:{},h:false,a:true}],''),shown)
 const partial=workspace();partial.menus[0].sections[1].items=[];const view=response(srv,partial,'')
 assert.equal(live.applyLiveDelta(view,[{i:'zz',m:'m2',a:false}],''),view)
 assert.equal(live.applyLiveDelta(view,[{i:'a',m:'m1',n:'Carbonara',ds:'Descrizione Carbonara',p:13,t:{en:{name:'Carbonara EN',description:'Eggs'}},h:false,a:true}],'').data.sections[0].items[0].price,13)})
