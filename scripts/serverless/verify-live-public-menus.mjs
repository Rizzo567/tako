#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const manifest=JSON.parse(await readFile('docs/webapp/portfolio-rollout/public-manifest.json','utf8'));
const normalize=value=>typeof value==='string'?value.replace(/^\/takomenu-public(?=\/uploads\/)/,''):value;
const populated=data=>(data?.sections||[]).some(section=>section.items?.length>0);
const results=[];
for(const restaurant of manifest.restaurants){
 const endpoint=`https://takoitalia.com/api/customer/restaurant/${restaurant.id}/menu`;
 const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(45000)});
 assert.equal(response.status,200,restaurant.name+' default');
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal(response.headers.get('X-Takomenu-Release'),null,'Live backend, not immutable release');
 const body=await response.json();assert.ok(populated(body.data),restaurant.name+' default populated');
 assert.equal(body.features?.customerOrderingEnabled,false);assert.equal(body.features?.reservationsEnabled,false);
 const expected=Object.values(restaurant.responses).find(row=>row.design?.coverUrl);
 assert.ok(expected?.design?.coverUrl,restaurant.name+' approved hero');
 assert.equal(normalize(body.design?.coverUrl),normalize(expected.design.coverUrl),restaurant.name+' approved hero URL');
 assert.equal(normalize(body.design?.logoUrl),normalize(expected.design.logoUrl),restaurant.name+' logo URL');
 assert.ok(body.design?.headerSticky);assert.equal(body.design?.showSubcategoryNavigation,false);
 const image=await fetch(new URL(body.design.coverUrl,'https://takoitalia.com'),{method:'HEAD',signal:AbortSignal.timeout(45000)});
 assert.equal(image.status,200,restaurant.name+' hero asset');assert.ok(image.headers.get('Content-Type')?.startsWith('image/'));
 const menus=body.menus||[];assert.ok(menus.length>0);
 for(const menu of menus){
  const url=new URL(endpoint);url.searchParams.set('menuId',menu.id);url.searchParams.set('lang',restaurant.defaultLanguage);
  const selected=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(45000)});assert.equal(selected.status,200,restaurant.name+' '+menu.name);
  const data=await selected.json();assert.ok(populated(data.data),restaurant.name+' '+menu.name+' not empty');
  assert.equal(data.features?.customerOrderingEnabled,false);assert.equal(data.features?.reservationsEnabled,false);
 }
 results.push({id:restaurant.id,name:restaurant.name,status:200,menus:menus.length,heroStatus:image.status,live:true,readOnly:true});
 console.log(JSON.stringify(results.at(-1)));
}
const out=resolve('docs/webapp/activation/evidence');await mkdir(out,{recursive:true});
await writeFile(resolve(out,'public-live-18.json'),JSON.stringify({verifiedAt:new Date().toISOString(),results},null,2));
console.log(JSON.stringify({restaurants:results.length,passed:true}));
