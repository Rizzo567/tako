import {mkdir,writeFile} from 'node:fs/promises';
import sharp from '../apps/server/node_modules/sharp/lib/index.js';
import {publicMenuAliases} from '../apps/web-static/src/public-menu-aliases.mjs';
const previews={};await mkdir('apps/web/public/menu-social',{recursive:true});
for(const [slug,id] of Object.entries(publicMenuAliases)){
 const response=await fetch(`https://takoitalia.com/api/customer/restaurant/${id}/menu`);if(!response.ok)throw Error(slug+' catalog '+response.status);
 const d=await response.json();const name=d.features?.restaurantName;if(!name)throw Error('Missing restaurant name '+slug);
 const source=d.design?.coverUrl||d.design?.logoUrl;if(!source)throw Error('Missing cover '+slug);
 const image=await fetch(new URL(source,'https://takoitalia.com'));if(!image.ok)throw Error(slug+' image '+image.status);
 const buffer=await sharp(Buffer.from(await image.arrayBuffer())).resize(1200,630,{fit:'contain',background:'#181613'}).jpeg({quality:90}).toBuffer();
 const {createHash}=await import('node:crypto');const hash=createHash('sha256').update(buffer).digest('hex').slice(0,12);const file=`${slug}-${hash}.jpg`;await writeFile('apps/web/public/menu-social/'+file,buffer);
 previews[id]={slug,name,image:`https://takoitalia.com/takomenu-public/menu-social/${file}`,width:1200,height:630};
 console.log(slug);
}
await writeFile('deploy/cloudflare/menu-social-data.mjs','// Published restaurant sharing metadata. Regenerate with scripts/build-menu-social-previews.mjs.\nexport const menuSocialData='+JSON.stringify(previews,null,2)+';\n');
