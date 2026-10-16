/** Staging entry source. Secrets are read from provider configuration, never bundled.
 * A successful boot is not a production readiness claim. */
export function candidateEntry({appEntry,initializerEntry,fontInitializerEntry,bridgeEntry,gatewayEntry=new URL('./gateway-context.mjs',import.meta.url).pathname,slug='tako-operational-candidate'}) {
 if(!/^[a-z0-9-]+$/.test(slug))throw new Error('Invalid function slug');
 return `import process from 'node:process';
import {verifyGatewayContext} from ${JSON.stringify(gatewayEntry)};
import {createApp} from ${JSON.stringify(appEntry)};
const required=['DATABASE_URL','JWT_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','TAKO_GATEWAY_SECRET','TAKO_RATE_LIMIT_SECRET','WEB_ORIGIN','PDF_FONT_BUCKET','TAKO_IMAGE_SEEDS_JSON'];
const config=Object.fromEntries(required.map(key=>[key,Deno.env.get('TAKO_CANDIDATE_'+key)||'']));
for(const key of ['DATABASE_CA_CERT','UPLOADS_MAX_BYTES','SUPABASE_STORAGE_BUCKET','PDF_FONT_PREFIX','PDF_FONT_TIMEOUT_MS','PDF_FONT_MAX_BYTES','TAKOMENU_AGENCY_USER_IDS','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_WHATSAPP_NUMBER','TWILIO_WEBHOOK_URL','GROQ_API_KEY','GEMINI_API_KEY','TAKO_WHATSAPP_ONBOARDING_ENABLED','TAKO_WHATSAPP_ALERT_PHONE','TAKO_WHATSAPP_USAGE_PHONE']){const value=Deno.env.get('TAKO_CANDIDATE_'+key);if(value!==undefined)config[key]=value;}
for(const key of required)if(!config[key])throw new Error('Missing provider configuration: '+key);
for(const key of ['JWT_SECRET','TAKO_GATEWAY_SECRET','TAKO_RATE_LIMIT_SECRET'])if(config[key].length<32)throw new Error('Weak provider configuration: '+key);
const origin=new URL(config.WEB_ORIGIN);if(origin.protocol!=='https:'||origin.origin!==config.WEB_ORIGIN)throw new Error('HTTPS origin required');
// Node compatibility reads this object; no unsupported Deno.env.set call.
Object.defineProperty(process,'env',{value:{...process.env,...config,TAKO_MODE:'web',TAKO_EXECUTION_RUNTIME:'edge',NODE_ENV:'development',TAKO_DURABLE_RATE_LIMIT:'1',TAKO_DISABLE_REGISTRATION:'1',TAKO_MULTI_TENANT:'1',UPLOADS_DRIVER:'supabase'},configurable:true});
function milestone(phase){const memory=process.memoryUsage();console.info(JSON.stringify({event:'candidate_boot_memory',phase,rss:memory.rss,heapUsed:memory.heapUsed,external:memory.external,arrayBuffers:memory.arrayBuffers}));}
let boot;
function ensureBoot(){return boot??=(async()=>{
 // Named import excludes the unused Node listener and cloud control plane from this Edge bundle.
 milestone('app_module_ready');
 const imageStore=await import(${JSON.stringify(new URL('../../apps/server/src/lib/image-store.ts',import.meta.url).pathname)});
 imageStore.configureImageInitializer(async()=>{milestone('before_image_initializer');const imageInitializer=await import(${JSON.stringify(initializerEntry)});const result=await imageInitializer.initializeEdgeImages();milestone('after_image_initializer');return result});
 const fontInitializer=await import(${JSON.stringify(fontInitializerEntry)});
 milestone('after_initializer_imports');
 // Initializer export contracts are verified before deployment.
 milestone('before_font_initializer');
 await fontInitializer.initializeEdgePdf();
 milestone('after_font_initializer');
 milestone('before_create_app');
 const app=await createApp({runtime:'edge-candidate'});
 milestone('after_create_app');
 const {createFetchBridge}=await import(${JSON.stringify(bridgeEntry)});
 const bridge=createFetchBridge(app,{gateway:{secret:config.TAKO_GATEWAY_SECRET,origin:config.WEB_ORIGIN}});
 return request=>{const url=new URL(request.url);for(const prefix of ['/functions/v1/${slug}','/${slug}'])if(url.pathname===prefix||url.pathname.startsWith(prefix+'/')){url.pathname=url.pathname.slice(prefix.length)||'/';break;}return bridge(new Request(url,request));};
})().then(handle=>({handle}),error=>({error}));}
Deno.serve(async request=>{if(!verifyGatewayContext(request,{secret:config.TAKO_GATEWAY_SECRET,origin:config.WEB_ORIGIN}))return Response.json({error:{code:'GATEWAY_REQUIRED',message:'Gateway richiesto'}},{status:403,headers:{'Cache-Control':'no-store'}});try{const bootStarted=performance.now();const result=await ensureBoot();const bootMs=performance.now()-bootStarted;if(result.error)throw result.error;const response=await result.handle(request);const headers=new Headers(response.headers);const timing=headers.get('Server-Timing');headers.set('Server-Timing',(timing?timing+',':'')+'boot;dur='+bootMs.toFixed(1));return new Response(response.body,{status:response.status,headers})}catch(error){console.error('Candidate runtime unavailable',error instanceof Error?error.name:'Error');return Response.json({error:{code:'RUNTIME_UNAVAILABLE',message:'Servizio temporaneamente non disponibile'}},{status:503,headers:{'Cache-Control':'no-store'}})}});
`;
}
