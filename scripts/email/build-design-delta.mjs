// Prepare ONLY the email renderer delta. Does not upload, deploy, send or touch queued payloads.
import fs from 'node:fs/promises';import {build} from 'esbuild';import {createHash} from 'node:crypto';
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Specify fresh private online source and private output');
const original=await fs.readFile(input,'utf8'),marker='// apps/server/src/lib/transactional-email/render.ts\n';
if(original.split(marker).length!==2||original.includes('var TakomenuEmailDesign20261023'))throw Error('Unexpected renderer graph; reconcile manually');
const start=original.indexOf(marker),end=original.indexOf('\n// ',start+marker.length);if(end<0)throw Error('Renderer boundary missing');
const section=original.slice(start,end),a=section.indexOf('function renderTransactionalEmail('),b=section.indexOf('\nvar escape, support;',a);if(a<0||b<0||!section.includes('var init_render = __esm('))throw Error('Unexpected renderer shape');
const bundle=await build({entryPoints:['apps/server/src/lib/transactional-email/render.ts'],bundle:true,format:'iife',globalName:'TakomenuEmailDesign20261023',platform:'neutral',target:'es2022',write:false});
const replacement=section.slice(0,marker.length)+bundle.outputFiles[0].text+'\n'+section.slice(marker.length,a)+'function renderTransactionalEmail(id, values, logoUrl) { return TakomenuEmailDesign20261023.renderTransactionalEmail(id, values, logoUrl); }'+section.slice(b);
const updated=original.slice(0,start)+replacement+original.slice(end);
if(updated.slice(0,start)!==original.slice(0,start)||!updated.endsWith(original.slice(end)))throw Error('Unrelated bundle bytes changed');
await fs.writeFile(output,updated,{mode:0o600});const hash=s=>createHash('sha256').update(s).digest('hex');
console.log(JSON.stringify({baseSha256:hash(original),candidateSha256:hash(updated),onlyChanged:'apps/server/src/lib/transactional-email/render.ts',deployed:false}));
