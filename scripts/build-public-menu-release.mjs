import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildStaticWeb} from './build-static-web.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const input=process.argv[2];if(!input)throw Error('Pass sanitized snapshot manifest path');
const manifest=JSON.parse(await readFile(input,'utf8'));
if(!Array.isArray(manifest.restaurants)||!manifest.restaurants.length)throw Error('Empty manifest');
const out=resolve(repo,'release/public-menus');
await buildStaticWeb(out,{base:'/takomenu-public/'});
const pwaPath=resolve(out,'manifest.json'),pwa=JSON.parse(await readFile(pwaPath,'utf8'));
await writeFile(pwaPath,JSON.stringify({...pwa,name:'Takomenu',short_name:'Takomenu',description:'I menu dei nostri ristoranti',start_url:'/menu/',icons:pwa.icons.map(icon=>({...icon,src:'/takomenu-public'+icon.src}))}));
const htmlPath=resolve(out,'index.html');await writeFile(htmlPath,(await readFile(htmlPath,'utf8')).replace('Menu, ordinazione e prenotazioni · Tako','Menu digitali · Takomenu').replace('<title>Menu · Tako</title>','<title>Menu · Takomenu</title>'));
// Il menu è l'unica pagina di questa release: i suoi chunk e il font partono insieme all'entry, senza attendere il JS.
{const assets=await readdir(resolve(out,'assets')),seen=new Set(),queue=assets.filter(f=>/^DigitalMenu-.*\.js$/.test(f));while(queue.length){const file=queue.shift();if(seen.has(file)||/^index-/.test(file))continue;seen.add(file);for(const m of (await readFile(resolve(out,'assets',file),'utf8')).matchAll(/["']\.\/([\w.-]+\.js)["']/g))queue.push(m[1])}
 const css=assets.filter(f=>/^WorkspaceMenuRenderer-.*\.css$/.test(f)),font=assets.find(f=>/^Nunito-.*\.woff2$/.test(f));
 const links=[...[...seen].map(f=>`<link rel="modulepreload" crossorigin href="/takomenu-public/assets/${f}">`),...css.map(f=>`<link rel="stylesheet" crossorigin href="/takomenu-public/assets/${f}">`),...(font?[`<link rel="preload" as="font" type="font/woff2" crossorigin href="/takomenu-public/assets/${font}">`]:[])].join('');
 await writeFile(htmlPath,(await readFile(htmlPath,'utf8')).replace('</head>',links+'</head>'));}
const release=new Date().toISOString();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await mkdir(resolve(out,'public-menu-data'),{recursive:true});
for(const r of manifest.restaurants){
 if(!/^[a-f0-9-]{36}$/.test(r.id)||!r.defaultMenuId||!r.responses)throw Error('Invalid restaurant manifest');
 const text=JSON.stringify({defaultMenuId:r.defaultMenuId,defaultLanguage:r.defaultLanguage,languages:r.languages,responses:r.responses,availability:r.availability,release},(key,value)=>typeof value==='string'&&value.startsWith('/uploads/')?'/takomenu-public'+value:value);
 if(/postgres(?:ql)?:\/\/|sb_secret_|passwordHash|password_hash|expectedRevision/.test(text))throw Error('Private data rejected');
 await writeFile(resolve(out,'public-menu-data',r.id+'.json'),text);
 for(const asset of r.assets||[]){
  if(!asset.source||!asset.target||asset.target.includes('..')||!asset.target.startsWith('/'))throw Error('Invalid asset descriptor');
  const target=resolve(out,'.'+asset.target);await mkdir(dirname(target),{recursive:true});await cp(asset.source,target);
 }
}
await writeFile(resolve(out,'_redirects'),'');
console.log(JSON.stringify({out,release,restaurants:manifest.restaurants.length}));
