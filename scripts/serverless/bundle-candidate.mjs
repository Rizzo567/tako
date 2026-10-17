import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {builtinModules} from 'node:module';
import {build} from 'esbuild';
/** Build only: no credentials, provider requests or deployments. */
export async function bundleCandidate(source,root){
 const versions=new Map(),builtins=new Set([...builtinModules,...builtinModules.map(name=>'node:'+name)]);
 const result=await build({stdin:{contents:source,resolveDir:root,sourcefile:'candidate-entry.ts',loader:'ts'},bundle:true,format:'esm',platform:'neutral',target:'es2022',write:false,treeShaking:true,metafile:true,plugins:[{name:'pinned-runtime-imports',setup(context){context.onResolve({filter:/.*/},async argument=>{
  if(argument.path.startsWith('@tako/db')){const pkg=JSON.parse(await readFile(path.join(root,'packages/db/package.json'),'utf8'));const sub=argument.path==='@tako/db'?'.':'.'+argument.path.slice(8);if(!pkg.exports[sub])throw new Error('Unknown database export');return {path:path.resolve(root,'packages/db',pkg.exports[sub])};}
  if(argument.path==='@tako/types')return {path:path.join(root,'packages/types/src/index.ts')};
  // sharp è un addon nativo: sull'Edge non si carica mai (vedi edge-sharp-stub.mjs). Fuori dal bundle Edge.
  // magick-wasm: file separato accanto a index.ts nel deploy (vedi build-operational-candidate), mai fuso nel bundle.
  if(argument.path==='./magick-wasm-0.0.44.js')return {path:argument.path,external:true};
  if(argument.path==='sharp')return {path:path.join(root,'scripts/serverless/edge-sharp-stub.mjs')};
  if(builtins.has(argument.path))return {path:argument.path.startsWith('node:')?argument.path:'node:'+argument.path,external:true};
  if(argument.path.startsWith('.')||argument.path.startsWith('/')||argument.path.startsWith('node:'))return;
  if(argument.path.startsWith('npm:'))return {path:argument.path,external:true};
  const parts=argument.path.split('/'),name=argument.path.startsWith('@')?parts.slice(0,2).join('/'):parts[0],sub=argument.path.slice(name.length);
  let version=versions.get(name);
  if(!version){for(const directory of ['apps/server/node_modules','packages/db/node_modules','node_modules']){try{version=JSON.parse(await readFile(path.join(root,directory,name,'package.json'),'utf8')).version;break;}catch{}}if(!version)throw new Error('Unresolved runtime package '+name);versions.set(name,version);}
  return {path:`npm:${name}@${version}${sub}`,external:true};
 });}}]});
 return {code:result.outputFiles[0].text,inventory:{bytes:result.outputFiles[0].contents.length,inputs:Object.keys(result.metafile.inputs),externals:Object.fromEntries(versions),production:false}};
}
