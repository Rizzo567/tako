#!/usr/bin/env node
/** Local webapp runtime (pnpm webapp): staff, API and customer renderer on loopback ports. */
import {parseEnv} from 'node:util';
import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildStaffWeb} from './build-staff-web.mjs';
import {readConfig,main as startGateway} from './web-render-entry.mjs';
const rootDefault=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function localEnvironment(values,root=rootDefault,base=process.env) {
 return {...base,...values,NODE_ENV:'development',TAKO_MODE:'web',TAKO_MULTI_TENANT:'1',TAKO_DISABLE_REGISTRATION:'1',EMBEDDED_DB:'0',TAKO_HTTPS:'0',SERVER_HOST:'127.0.0.1',WEB_ORIGIN:'http://localhost:5137',ALLOWED_ORIGINS:'http://localhost:5137',PORT:'5137',API_PORT:'5131',CUSTOMER_PORT:'5132',CLIENT_PORT:'5132',TRUST_PROXY:'127.0.0.1,::1',TAKO_APP_ROOT:root,STAFF_DIR:resolve(root,'release/local-web/staff'),UPLOADS_DRIVER:'supabase',UPLOADS_DIR:resolve(root,'release/local-web/upload-cache'),NEXT_PUBLIC_API_URL:'http://127.0.0.1:5131',NEXT_TELEMETRY_DISABLED:'1'};
}
export async function loadLocalEnvironment(root=rootDefault) {
 let raw;
 try {raw=await readFile(resolve(root,'.env.web'),'utf8');} catch {throw new Error('Missing .env.web at project root. Configure managed DB and Supabase Storage before starting.');}
 const env=localEnvironment(parseEnv(raw),root);
 readConfig(env);
 return env;
}
export async function checkPorts(ports=[5137,5131,5132]) {
 for(const port of ports) await new Promise((resolveCheck,reject)=> {
  const socket=createServer();socket.once('error',()=>reject(new Error(`Port ${port} is occupied. Existing services were not stopped.`)));
  socket.listen(port,'127.0.0.1',()=>socket.close(resolveCheck));
 });
}
async function fingerprint(root) {
 const hash=createHash('sha256');hash.update('http://127.0.0.1:5131');
 const src=resolve(root,'apps/web/src');
 for(const file of (await readdir(src,{recursive:true,withFileTypes:true})).filter(f=>f.isFile()).map(f=>resolve(f.parentPath || f.path,f.name)).sort()) {hash.update(file.slice(src.length));hash.update(await readFile(file));}
 for(const file of ['apps/web/next.config.ts','apps/web/package.json','pnpm-lock.yaml']) hash.update(await readFile(resolve(root,file)));
 return hash.digest('hex');
}
function buildNext(root,env) {
 return new Promise((resolveBuild,reject)=> {
  const child=spawn(process.execPath,[resolve(root,'apps/web/node_modules/next/dist/bin/next'),'build'],{cwd:resolve(root,'apps/web'),env:{...env,NODE_ENV:'production'},stdio:'inherit'});
  child.once('error',()=>reject(new Error('Next build failed to start. Install project dependencies first.')));
  child.once('exit',code=>code===0 ? resolveBuild() : reject(new Error('Next build failed; no webapp services were started.')));
 });
}
export async function prepareLocal(root=rootDefault) {
 const env=await loadLocalEnvironment(root);await checkPorts();
 const cache=resolve(root,'release/local-web');await mkdir(cache,{recursive:true});await writeFile(resolve(cache,'.metadata_never_index'),'');
 await buildStaffWeb(env.STAFF_DIR);
 const standalone=resolve(root,'apps/web/.next/standalone/apps/web');const stamp=resolve(cache,'customer-build.json');const hash=await fingerprint(root);
 let previous={};try{previous=JSON.parse(await readFile(stamp,'utf8'));}catch{}
 const buildIdPath=resolve(root,'apps/web/.next/BUILD_ID');let buildId='';try{buildId=await readFile(buildIdPath,'utf8');}catch{}
 if(!existsSync(resolve(standalone,'server.js')) || previous.hash!==hash || previous.buildId!==buildId) {
  await buildNext(root,env);buildId=await readFile(buildIdPath,'utf8');
  await writeFile(stamp,JSON.stringify({hash,buildId}));
 }
 await cp(resolve(root,'apps/web/.next/static'),resolve(standalone,'.next/static'),{recursive:true});
 await cp(resolve(root,'apps/web/public'),resolve(standalone,'public'),{recursive:true});
 return env;
}
export async function main(args=process.argv.slice(2)) {
 if(args.includes('--check')) {await loadLocalEnvironment();await checkPorts();console.log('Local webapp configuration and isolated ports verified.');return;}
 const env=await prepareLocal();
 if(args.includes('--prepare')) {console.log('Local webapp prepared; no service started.');return;}
 await startGateway(env);console.log('Tako webapp: http://localhost:5137 — press Ctrl+C to stop all webapp processes.');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.error('[local-web]',error.message);process.exit(1);});
