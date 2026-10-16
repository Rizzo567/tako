// Public verification, strictly sequential (the public API is rate limited).
// For every restaurant, language and active menu: GET /api/customer/restaurant/<id>/menu?lang=<l>&menuId=<m>
// and count fields marked as untranslated fallback (nameLang / descriptionLang) plus missing food labels.
// Usage: node scripts/translations/verify-public.mjs [--ids=<id,...>]   (default: published/already-complete in publication-status.json)
import {readFile} from 'node:fs/promises';import {dir,atomic,client,restaurantsFromLinks} from './common.mjs';
const api=client(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ids=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(',').filter(Boolean);
const links=await restaurantsFromLinks();
if(!ids){const status=JSON.parse(await readFile(dir+'/publication-status.json','utf8'));ids=status.report.filter(r=>['published','already-complete'].includes(r.state)).map(r=>r.restaurantId)}
const results=[];
for(const id of ids){
 const name=links.find(l=>l.restaurantId===id)?.name??id;const first=await api.call(`/api/customer/restaurant/${id}/menu`);await sleep(400);
 const languages=(first.languages??[]).filter(l=>l!==first.defaultLanguage),menus=first.menus??[];const r={restaurantId:id,name,languages:languages.length,menus:menus.length,requests:0,untranslatedFields:0,missingFoodLabels:0,samples:[]};
 for(const language of languages)for(const menu of menus){
  const res=await api.call(`/api/customer/restaurant/${id}/menu?lang=${language}&menuId=${menu.id}`);r.requests++;await sleep(400);
  const walk=(node,path)=>{if(Array.isArray(node))return node.forEach((x,i)=>walk(x,path));if(!node||typeof node!=='object')return;for(const k of ['nameLang','descriptionLang'])if(k in node&&node[k]!==language){r.untranslatedFields++;if(r.samples.length<8)r.samples.push({language,menu:menu.name,field:k,name:node.name})}for(const [k,v] of Object.entries(node))if(v&&typeof v==='object')walk(v,path+'.'+k)};
  walk(res.data,'data');
  const labels=res.foodTranslations?.[language]??{};for(const group of ['allergens','traits','additives'])for(const e of res.foodCatalogs?.[group]??[])if(!labels[e.id]?.trim())r.missingFoodLabels++;
 }
 results.push(r);console.log(JSON.stringify({name,requests:r.requests,untranslatedFields:r.untranslatedFields,missingFoodLabels:r.missingFoodLabels}));
}
await atomic(dir+'/public-verification.json',{at:new Date().toISOString(),results});
console.log(JSON.stringify({restaurants:results.length,clean:results.filter(r=>!r.untranslatedFields&&!r.missingFoodLabels).length}));
