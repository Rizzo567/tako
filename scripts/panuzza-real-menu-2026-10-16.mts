import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.ts';
import {scheduledVisible} from '../apps/server/src/lib/menu-workspace-schedule.ts';
import {login,call,json} from './san-galdino-api.mjs';
const folder='docs/webapp/panuzza-real-menu-2026-10-16';
const backup='/Users/manuel/.config/tako-webapp/panuzza-real-menu-2026-10-16';
const prior=JSON.parse(await readFile(backup+'/before.json','utf8'));
const source=JSON.parse(await readFile(folder+'/source.json','utf8'));
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
if(process.argv.includes('--prepare')){
 const w=structuredClone(prior.data);
 const original=w.menus.find((m:any)=>m.name==='Cena');assert.ok(original);
 const sections=source.sections.map((s:any)=>({id:randomUUID(),name:s.name,description:s.description,active:true,translations:{},items:s.items.map(([name,price,description]:any[])=>({id:randomUUID(),name,price,description,translations:{},allergens:[],tags:[],available:true,hidden:false,...(s.name==='Arrosticini'?{schedule:{enabled:true,timezone:'Europe/Rome',windows:[{weekdays:[1,2,3,4],start:'00:00',end:'00:00'}],from:null,until:null}}:{})}))}));
 w.menus=[{id:original.id,name:source.menu,type:'main',active:true,description:null,translations:{},sections}];
 w.design.showPrices=true;w.design.showDescriptions=true;w.design.showSubcategoryNavigation=true;
 w.translationSettings.protectedNames=[...new Set([...(w.translationSettings?.protectedNames||[]),"Panuzza's",'Panuzza’s Burger'])];
 const parsed=workspaceSchema.parse(w);assert.equal(parsed.menus.flatMap(m=>m.sections.flatMap(s=>s.items)).length,13);
 assert.equal(parsed.design.logoUrl,prior.data.design.logoUrl);assert.equal(parsed.design.coverUrl,prior.data.design.coverUrl);
 const schedule=parsed.menus[0].sections.find(s=>s.name==='Arrosticini')!.items[0].schedule;
 assert.equal(scheduledVisible(schedule,new Date('2026-10-15T12:00:00Z')),true);
 assert.equal(scheduledVisible(schedule,new Date('2026-10-16T12:00:00Z')),false);
 await writeFile(backup+'/prepared.json',JSON.stringify(parsed),{mode:0o600});
 console.log(JSON.stringify({prepared:true,items:13,sections:sections.length,preservedLogo:true,preservedHero:true,pricesVisible:true,arrosticiniMonThuVerified:true}));
}
if(process.argv.includes('--apply')){
 const translations=JSON.parse(await readFile(folder+'/translations.json','utf8'));
 const w=JSON.parse(await readFile(backup+'/prepared.json','utf8'));
 for(const m of w.menus)for(const e of [m,...m.sections.flatMap((s:any)=>[s,...s.items])])for(const lang of w.languages.filter((l:string)=>l!=='it')){
  const name=translations[lang]?.[e.name],description=e.description?translations[lang]?.[e.description]:undefined;
  assert.ok(name,`Missing ${lang} ${e.name}`);if(e.description)assert.ok(description,`Missing description ${lang}`);
  e.translations[lang]={name,...(description?{description}:{})};
 }
 const parsed=workspaceSchema.parse(w);
 await login();await call('/api/web-locations/switch',json({restaurantId:prior.restaurant.id}));
 const current=await call('/api/menu-workspace');
 assert.equal(current.revision,prior.revision,'Target changed since backup');
 assert.equal(hash(current.data),hash(prior.data),'Target content changed since backup');
 const saved=await call('/api/menu-workspace',{...json({expectedRevision:current.revision,workspace:parsed}),method:'PUT'});
 const check=await call('/api/menu-workspace');assert.equal(check.revision,saved.revision);
 assert.equal(check.data.menus.length,1);assert.equal(check.data.menus[0].sections.flatMap((s:any)=>s.items).length,13);
 assert.equal(check.data.design.logoUrl,prior.data.design.logoUrl);assert.equal(check.data.design.coverUrl,prior.data.design.coverUrl);
 await writeFile(backup+'/saved.json',JSON.stringify(check),{mode:0o600});
 const published=await call('/api/menu-workspace/publish',json({expectedRevision:check.revision}));
 const after=await call('/api/menu-workspace');assert.equal(after.publishedRevision,after.revision);
 await writeFile(backup+'/after.json',JSON.stringify(after),{mode:0o600});
 await mkdir(folder,{recursive:true});await writeFile(folder+'/result.json',JSON.stringify({restaurantId:prior.restaurant.id,slug:'panuzza',beforeRevision:prior.revision,revision:after.revision,publishedRevision:after.publishedRevision,items:13,notes:['Verdure senza prezzo','Fuori menu giornalmente'],removedPlaceholderMenus:['Pranzo','Drinks'],preservedLogo:true,preservedHero:true,languages:after.data.languages,sections:after.data.menus[0].sections.map((s:any)=>({name:s.name,description:s.description,items:s.items.map((i:any)=>({name:i.name,price:i.price,schedule:i.schedule}))}))},null,2));
 console.log(JSON.stringify({saved:true,published:true,revision:after.revision,publishedRevision:after.publishedRevision,items:13,languages:after.data.languages.length}));
}
