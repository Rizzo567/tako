#!/usr/bin/env node
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir,writeFile,cp,readFile} from 'node:fs/promises';
import {build as bundle} from 'esbuild';
import {buildStaffWeb} from './build-staff-web.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(repo,'apps/web-static/package.json'));
export const STATIC_REDIRECTS=`/staff /staff/ 301\n/staff/ /staff/index.html 200\n/r/* /index.html 200\n/prenota/* /index.html 200\n/menu-preview/* /index.html 200\n/privacy /index.html 200\n`;
export async function buildStaticWeb(out=resolve(repo,'release/serverless/static'),options={}){
 out=resolve(out);
 if(out===repo||repo.startsWith(out+'/')||['apps','packages','scripts','.claude','.git'].some(dir=>out===resolve(repo,dir)||out.startsWith(resolve(repo,dir)+'/')))throw new Error('Static output must be separate from source trees');
 const {build}=await import(pathToFileURL(require.resolve('vite')).href);
 await build({configFile:resolve(repo,'apps/web-static/vite.config.ts'),...(options.base?{base:options.base}:{}),build:{outDir:out,emptyOutDir:true},logLevel:'error'});
 const staff=await buildStaffWeb(resolve(out,'staff'));
 const staffIndex=resolve(out,'staff/index.html'),staffHtml=await readFile(staffIndex,'utf8');
 if(!staffHtml.includes('<script src="/socket.io/socket.io.js"></script>'))throw new Error('Staff Socket.IO script contract changed');
 await bundle({entryPoints:[resolve(repo,'apps/web-static/src/staff-polling-entry.mjs')],outfile:resolve(out,'staff/polling.js'),bundle:true,format:'iife',target:'es2020',minify:true});
 await writeFile(staffIndex,staffHtml.replace('<script src="/socket.io/socket.io.js"></script>','<script src="polling.js"></script>'));
 await mkdir(resolve(out,'licenses'),{recursive:true});
 for(const name of ['DMSans-OFL.txt','DMSerifDisplay-OFL.txt','Nunito-OFL.txt'])await cp(resolve(repo,'apps/web/src/fonts',name),resolve(out,'licenses',name));
 await writeFile(resolve(out,'_redirects'),STATIC_REDIRECTS);
 await writeFile(resolve(out,'.metadata_never_index'),'');
 return {out,staffSources:staff.sources?.length??staff.sourceCount??staff.scripts??null};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildStaticWeb(process.argv[2])));
