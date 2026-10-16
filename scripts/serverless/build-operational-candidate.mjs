import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {candidateEntry} from './candidate-entry.mjs';
import {imageInitializerEntry} from './image-initializer-entry.mjs';
import {bundleCandidate} from './bundle-candidate.mjs';
const root=path.resolve(new URL('../../',import.meta.url).pathname),temporary=await mkdtemp(path.join(tmpdir(),'tako-candidate-build-'));
try{
 const initializerEntry=path.join(temporary,'image-entry.ts');
 await writeFile(initializerEntry,imageInitializerEntry({initializerEntry:path.join(root,'apps/server/src/lib/edge-image-initializer.ts'),databaseEntry:path.join(root,'packages/db/src/client.ts')}));
 const source=candidateEntry({appEntry:path.join(root,'apps/server/src/index.ts'),initializerEntry,fontInitializerEntry:path.join(root,'apps/server/src/lib/edge-pdf-runtime-assets.ts'),bridgeEntry:path.join(root,'scripts/serverless/fetch-bridge.mjs')});
 const result=await bundleCandidate(source,root);
 const destination=path.join(root,'release/serverless/candidate');await mkdir(destination,{recursive:true});
 await writeFile(path.join(destination,'index.ts'),result.code);
 await writeFile(path.join(destination,'inventory.json'),JSON.stringify(result.inventory,null,2));
 console.log(JSON.stringify({build:'PASS',bundleBytes:result.inventory.bytes,deployed:false,production:false}));
}finally{await rm(temporary,{recursive:true,force:true});}
