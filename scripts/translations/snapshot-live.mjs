// Authenticated snapshot of the live workspaces listed in docs/webapp/customer-links/links.json.
// Usage: node scripts/translations/snapshot-live.mjs [--only=<restaurantId,...>]
// --only refreshes the listed restaurants inside an existing current.json (source changed during a job).
import {readFile,mkdir} from 'node:fs/promises';import {dir,previousDirs,atomic,sessionClient,saveSession,json,restaurantsFromLinks} from './common.mjs';
await mkdir(dir,{recursive:true,mode:0o700});
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',').filter(Boolean);
const api=await sessionClient();
const inventory=(await api.call('/api/agency/restaurants')).data;const rows=Array.isArray(inventory)?inventory:inventory.restaurants;const accessible=new Set(rows.map(r=>r.id));
const wanted=await restaurantsFromLinks();const inaccessible=wanted.filter(r=>!accessible.has(r.restaurantId));if(inaccessible.length)throw Error('Account cannot access: '+inaccessible.map(r=>r.name).join(', '));
let restaurants=[];if(only){restaurants=JSON.parse(await readFile(dir+'/current.json','utf8')).restaurants}
for(const row of wanted){if(only&&!only.includes(row.restaurantId))continue;await api.call('/api/web-locations/switch',json({restaurantId:row.restaurantId}));const before=await api.call('/api/menu-workspace');await atomic(dir+'/'+row.restaurantId+'-before.json',before);const entry={restaurantId:row.restaurantId,name:row.name,revision:before.revision,publishedRevision:before.publishedRevision,workspace:before.data};const i=restaurants.findIndex(r=>r.restaurantId===row.restaurantId);if(i>=0)restaurants[i]=entry;else restaurants.push(entry)}
await atomic(dir+'/current.json',{at:new Date().toISOString(),restaurants});await saveSession(api);
// Merge existing caches (newest first wins). Quality filtering happens in translate.ts where the source text is known.
let cache={};try{cache=JSON.parse(await readFile(dir+'/translation-cache.json','utf8'))}catch{}
const merged={};for(const d of previousDirs.slice().reverse()){try{Object.assign(merged,JSON.parse(await readFile(d+'/translation-cache.json','utf8')))}catch{}}Object.assign(merged,cache);await atomic(dir+'/translation-cache.json',merged);
console.log(JSON.stringify({restaurants:restaurants.length,unpublished:restaurants.filter(r=>r.revision!==r.publishedRevision).map(r=>r.name),items:restaurants.reduce((n,r)=>n+r.workspace.menus.flatMap(m=>m.sections.flatMap(s=>s.items)).length,0),cacheEntries:Object.keys(merged).length,dir}));
