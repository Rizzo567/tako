import {buildStaticWeb} from './build-static-web.mjs';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const result=await buildStaticWeb(undefined,{base:'/takomenu-app/'});
// SPA routing is validated by the Worker, rather than wildcard rewrites.
await writeFile(resolve(result.out,'_redirects'),'');
console.log(JSON.stringify(result));
