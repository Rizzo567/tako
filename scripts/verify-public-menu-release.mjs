import assert from 'node:assert/strict';import {readFile,writeFile,mkdir}from'node:fs/promises';
async function checkedFetch(url,options={}){for(let attempt=0;attempt<3;attempt++){try{return await fetch(url,{...options,signal:AbortSignal.timeout(20000)})}catch(error){if(attempt===2||!['ECONNRESET','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','ETIMEDOUT'].includes(error.cause?.code))throw error}}}
const base=process.argv[2],manifestPath=process.argv[3];if(!base||!manifestPath)throw Error('Pass public HTTPS base and manifest');
const manifest=JSON.parse(await readFile(manifestPath,'utf8')),results=[];
const index=await checkedFetch(new URL('/menu/',base));assert.equal(index.status,200);const html=await index.text();
for(const restaurant of manifest.restaurants){
 assert.ok(html.includes(restaurant.id));
 const page=await checkedFetch(new URL(`/r/${restaurant.id}/menu`,base));assert.equal(page.status,200);assert.ok((await page.text()).includes('/takomenu-public/assets/'));
 const api=await checkedFetch(new URL(`/api/customer/restaurant/${restaurant.id}/menu`,base));assert.equal(api.status,200,restaurant.name);const dto=await api.json();assert.equal(api.headers.get('set-cookie'),null);assert.ok(dto.data.sections.length>0,restaurant.name);
 const urls=new Set();const scan=v=>{if(typeof v==='string'&&v.startsWith('/takomenu-public/uploads/'))urls.add(v);else if(v&&typeof v==='object')for(const x of Object.values(v))scan(x)};scan(dto);for(const asset of restaurant.assets||[])urls.add('/takomenu-public'+asset.target);
 for(const url of urls){const asset=await checkedFetch(new URL(url,base),{method:'HEAD'});assert.equal(asset.status,200,restaurant.name+' '+url);assert.ok(/image\//.test(asset.headers.get('content-type')||''),url)}
 const selections=Object.keys(restaurant.responses);
 for(let start=0;start<selections.length;start+=4){await Promise.all(selections.slice(start,start+4).map(async key=>{const [menuId,language]=key.split(':');const response=await checkedFetch(new URL(`/api/customer/restaurant/${restaurant.id}/menu?menuId=${menuId}&lang=${language}`,base));assert.equal(response.status,200,restaurant.name+':'+key);const data=await response.json();assert.equal(data.data.id,menuId);assert.equal(data.features?.customerOrderingEnabled,false)}))}
 const mutation=await checkedFetch(new URL(`/api/customer/restaurant/${restaurant.id}/menu`,base),{method:'POST'});assert.equal(mutation.status,405);
 results.push({restaurant:restaurant.name,id:restaurant.id,sections:dto.data.sections.length,assets:urls.size,languages:restaurant.languages.length,selections:selections.length,release:api.headers.get('x-takomenu-release')});
}
await mkdir('docs/webapp/public-menus',{recursive:true});await writeFile('docs/webapp/public-menus/live-verification.json',JSON.stringify({base,at:new Date().toISOString(),results},null,2));console.log(JSON.stringify({base,restaurants:results.length,results},null,2));
