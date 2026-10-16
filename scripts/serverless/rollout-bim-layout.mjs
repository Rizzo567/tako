import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import assert from 'node:assert/strict';
const apply=process.argv.includes('--apply'),base='http://localhost:5137',bim='84fe4d77-2d87-5187-aa94-9c01840e99de';
const backup=homedir()+'/.config/tako-webapp/portfolio-layout-backups';await mkdir(backup,{recursive:true,mode:0o700});await mkdir('docs/webapp/portfolio-rollout',{recursive:true});
let cookie=await readFile(homedir()+'/.config/tako-webapp/bim-hero-session-cookie.txt','utf8');
async function call(path,options={}){const r=await fetch(base+path,{...options,headers:{Origin:base,Cookie:cookie,...options.headers}});const cs=r.headers.getSetCookie();if(cs.length)cookie=cs.map(x=>x.split(';')[0]).join('; ');const body=await r.json();if(!r.ok)throw Error(path+' '+r.status+' '+(body.error?.code||''));return body}
const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const data=(await call('/api/agency/restaurants')).data,rows=Array.isArray(data)?data:data.restaurants;
await call('/api/web-locations/switch',json({restaurantId:bim}));const canonical=(await call('/api/menu-workspace')).data.design;
const structural=['layout','fontSize','spacing','imageShape','showImages','showPrices','showDescriptions','showAllergens','borderWidth','borderRadius','categoryGap','categoryAlign','navigation','headerSticky','showSubcategoryNavigation','logoShape','imageRadius','allergenGapX','allergenGapY','specificationSize','specificationGapX','specificationGapY','foodInfoSize','categoryTitleGap','subcategoryGap','centeredItemGap','showFoodLegends','imageWidth','imageHeight','allergenSize','showAllergenIcons','showSpecificationIcons','menuPosition','logoSize','headerRadius','headerScrolledOpacity'];
const items=w=>w.menus.flatMap(m=>m.sections.flatMap(s=>s.items)).sort((a,b)=>a.id.localeCompare(b.id));const report=[];
try{for(const row of rows){if(/demo|verifica|^qa\b/i.test(row.name)||row.name==='Pizzeria')continue;await call('/api/web-locations/switch',json({restaurantId:row.id}));const before=await call('/api/menu-workspace'),w=structuredClone(before.data);
for(const k of structural){if(canonical[k]!==undefined)w.design[k]=structuredClone(canonical[k]);else delete w.design[k]}
for(const key of ['categoryStyle','categoryActiveStyle','subcategoryStyle','subcategoryActiveStyle','menuStyle','menuActiveStyle','headerTitleStyle','headerDescriptionStyle']){const target=w.design[key]||{},source=canonical[key]||{};for(const geometry of ['width','height','radius','borderWidth','fontSize','fontWeight','gap','padding','margin','lineHeight','letterSpacing','textAlign']){if(source[geometry]!==undefined)target[geometry]=source[geometry];else delete target[geometry]}w.design[key]=target;}
w.design.headerSticky=true;w.design.showSubcategoryNavigation=false;w.design.headerTitle='';w.design.headerDescription='';w.design.backgroundImageUrl=null;
for(const m of w.menus){const name=m.type==='dinner'?'Cena':m.type==='drinks'?'Drinks':m.type==='lunch'?'Pranzo':null;if(name&&m.name!==name){m.name=name;m.translations={}}}
assert.deepEqual(items(w),items(before.data),'Item mismatch '+row.name);const changed=JSON.stringify(w)!==JSON.stringify(before.data);
await writeFile(backup+'/'+row.id+'-revision-'+before.revision+'.json',JSON.stringify(before),{mode:0o600});
if(apply&&changed){await call('/api/menu-workspace',{...json({expectedRevision:before.revision,workspace:w}),method:'PUT'});const after=await call('/api/menu-workspace');assert.deepEqual(items(after.data),items(before.data),'Readback item mismatch '+row.name)}
report.push({id:row.id,slug:row.slug,name:row.name,revision:before.revision+(apply&&changed?1:0),changed,applied:apply&&changed,logo:w.design.logoUrl,colors:{primary:w.design.primary,background:w.design.background,text:w.design.text},samples:items(w).filter(i=>i.imageUrl).slice(0,6).map(i=>({name:i.name,imageUrl:i.imageUrl})),workspace:w});}
await writeFile(backup+'/inventory.json',JSON.stringify({published:false,apply,restaurants:report},null,2),{mode:0o600});await writeFile('docs/webapp/portfolio-rollout/inventory.json',JSON.stringify({published:false,apply,restaurants:report.map(({workspace,...r})=>r)},null,2));console.log(JSON.stringify({apply,restaurants:report.length,changed:report.filter(r=>r.changed).length,names:report.map(r=>r.name)}));
}finally{await call('/api/web-locations/switch',json({restaurantId:bim}));await writeFile(homedir()+'/.config/tako-webapp/bim-hero-session-cookie.txt',cookie,{mode:0o600})}
