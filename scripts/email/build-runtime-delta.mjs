import fs from 'node:fs/promises';import {build} from 'esbuild';import {createHash} from 'node:crypto';
const [input,output]=process.argv.slice(2);if(!input||!output)throw new Error('Specify private online source and output');
const original=await fs.readFile(input,'utf8');
const existingRuntime=original.includes('var TakomenuEmailRuntime20261019');
const shims={
 '@tako/db':'const emailRuntimeDb=db,emailRuntimeUsers=users,emailRuntimeSessions=sessions;export {emailRuntimeDb as db,emailRuntimeUsers as users,emailRuntimeSessions as sessions};',
 'drizzle-orm':'const emailRuntimeSql=sql28,emailRuntimeEq=eq11;export{emailRuntimeSql as sql,emailRuntimeEq as eq};',
 'bcryptjs':'const emailRuntimeBcrypt=bcrypt4;export default emailRuntimeBcrypt;',
 'zod':'const emailRuntimeZod=z17;export{emailRuntimeZod as z};',
 'node:crypto':'export const createHash=TakomenuEmailCrypto.createHash,randomBytes=TakomenuEmailCrypto.randomBytes,randomUUID=TakomenuEmailCrypto.randomUUID,timingSafeEqual=TakomenuEmailCrypto.timingSafeEqual,createCipheriv=TakomenuEmailCrypto.createCipheriv,createDecipheriv=TakomenuEmailCrypto.createDecipheriv;',
 'node:buffer':'export const Buffer=TakomenuEmailBuffer.Buffer;',
};
const result=await build({stdin:{contents:"export async function register(app,deliver){const mod=await import('./apps/server/src/routes/web-accounts.ts');return mod.webAccountRoutesWithDelivery(deliver)(app)}",resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'iife',globalName:'TakomenuEmailRuntime20261019',target:'es2022',platform:'neutral',write:false,plugins:[{name:'preserve-live-dependencies',setup(ctx){
 ctx.onResolve({filter:/.*/},args=>{
  if(shims[args.path])return{path:args.path,namespace:'email-live'};
  if(args.path.endsWith('/middleware/auth.js')||args.path==='../middleware/auth.js')return{path:'auth',namespace:'email-live'};
  if(args.path.endsWith('/agency-access.js'))return{path:'agency',namespace:'email-live'};
  if(args.path.endsWith('/web-mail.js'))return{path:'mail',namespace:'email-live'};
 });
 ctx.onLoad({filter:/.*/,namespace:'email-live'},args=>({contents:shims[args.path]||({auth:'const emailRuntimeAuth=requireAuth;export{emailRuntimeAuth as requireAuth};',agency:'const emailRuntimeAgency=isAgencyUser;export{emailRuntimeAgency as isAgencyUser};',mail:'const emailRuntimeDeliver=deliverWebMail;export{emailRuntimeDeliver as deliverWebMail};'}[args.path]),loader:'js'}));
}}]});
let updated=original;const replace=(before,after)=>{if(updated.split(before).length!==2)throw new Error('Live patch precondition failed');updated=updated.replace(before,after);};
const runtimeMarker='// Takomenu durable email runtime — 2026-10-19\n',accountMarker='// apps/server/src/routes/web-accounts.ts\n';
const runtimeCode=runtimeMarker+'import * as TakomenuEmailCrypto from "node:crypto";\nimport * as TakomenuEmailBuffer from "node:buffer";\n'+result.outputFiles[0].text+'\n';
if(existingRuntime){
 const a=updated.indexOf(runtimeMarker),b=updated.indexOf('\n'+accountMarker,a+runtimeMarker.length)+1;
 if(a<0||b<=0)throw new Error('Current email runtime boundary missing');
 replace(updated.slice(a,b),runtimeCode);
}else{
 const start=updated.indexOf('function webAccountRoutesWithDelivery('),end=updated.indexOf('\nvar hash4, generic,',start);if(start<0||end<0)throw new Error('Unknown account route module');
 replace(updated.slice(start,end),'function webAccountRoutesWithDelivery(deliver = deliverWebMail) { return async function(app) { return TakomenuEmailRuntime20261019.register(app,deliver); }; }');
 replace('  "EMAIL_LOGO_URL"\n]){','  "EMAIL_LOGO_URL",\n  "EMAIL_OUTBOX_KEY",\n  "EMAIL_CRON_SECRET"\n]){');
 replace(accountMarker,runtimeCode+accountMarker);
}
const split=text=>new Map([...text.matchAll(/^\/\/ ([^\n]+)\n/gm)].map((m,i,all)=>[m[1],text.slice(m.index,all[i+1]?.index??text.length)]));
const oldSections=split(original),newSections=split(updated),changed=[];
for(const[name,body]of oldSections){if(body!==newSections.get(name)){if(!['apps/server/src/routes/web-accounts.ts','candidate-entry.ts','Takomenu durable email runtime — 2026-10-19'].includes(name))throw new Error('Unrelated module changed: '+name);changed.push(name);}}
await fs.mkdir('release/serverless/candidate',{recursive:true});await fs.writeFile(output,updated,{mode:0o600});
console.log(JSON.stringify({baseSha256:createHash('sha256').update(original).digest('hex'),candidateSha256:createHash('sha256').update(updated).digest('hex'),preservedModules:oldSections.size-changed.length,changed,newRuntimeBytes:result.outputFiles[0].contents.length,deployed:false}));
