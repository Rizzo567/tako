import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {candidateEntry} from './candidate-entry.mjs';
import {imageInitializerEntry,magickModuleSha256} from './image-initializer-entry.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {bundleCandidate} from './bundle-candidate.mjs';
const root=path.resolve(new URL('../../',import.meta.url).pathname),temporary=await mkdtemp(path.join(tmpdir(),'tako-candidate-build-'));
try{
 const initializerEntry=path.join(temporary,'image-entry.ts');
  const magickSource=path.join(root,'scripts/serverless/vendor/magick-wasm-0.0.44.js'),magickEntry='./magick-wasm-0.0.44.js';
 const magickBytes=await readFile(magickSource);if(createHash('sha256').update(magickBytes).digest('hex')!==magickModuleSha256)throw new Error('magick-wasm vendor file changed');
 await writeFile(initializerEntry,imageInitializerEntry({initializerEntry:path.join(root,'apps/server/src/lib/edge-image-initializer.ts'),databaseEntry:path.join(root,'packages/db/src/client.ts'),magickEntry}));
 const source=candidateEntry({appEntry:path.join(root,'apps/server/src/index.ts'),initializerEntry,fontInitializerEntry:path.join(root,'apps/server/src/lib/edge-pdf-runtime-assets.ts'),bridgeEntry:path.join(root,'scripts/serverless/fetch-bridge.mjs')});
 const result=await bundleCandidate(source,root);
 const destination=path.join(root,'release/serverless/candidate');await mkdir(destination,{recursive:true});
 await writeFile(path.join(destination,'index.ts'),result.code);
 // File accanto a index.ts: il deploy lo carica nello stesso pacchetto (import relativo, fuori dal bundle esbuild).
 await writeFile(path.join(destination,'magick-wasm-0.0.44.js'),magickBytes);
 await writeFile(path.join(destination,'inventory.json'),JSON.stringify(result.inventory,null,2));
 console.log(JSON.stringify({build:'PASS',bundleBytes:result.inventory.bytes,deployed:false,production:false}));
}finally{await rm(temporary,{recursive:true,force:true});}
