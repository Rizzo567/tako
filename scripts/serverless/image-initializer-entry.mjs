/** One output buffer; reject truncated/oversized pinned assets without chunk retention. */
export async function readPinnedWasm(response,expectedBytes=15447097){
 const cap=18*1024*1024;
 if(!response.ok||!response.body)throw new Error('WASM unavailable');
 const declared=Number(response.headers.get('content-length')||0);
 if(expectedBytes>cap||declared>cap||(declared&&declared!==expectedBytes))throw new Error('WASM size mismatch');
 const bytes=new Uint8Array(expectedBytes),reader=response.body.getReader();let total=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;if(value.length>expectedBytes-total)throw new Error('WASM too large');bytes.set(value,total);total+=value.length}
  if(total!==expectedBytes)throw new Error('WASM truncated');return bytes;
 }finally{await reader.cancel().catch(()=>{})}
}
/** Packaging source: caller's bundler pins bare package imports to installed versions. */
/** Modulo JS di magick-wasm 0.0.44 copiato dal pacchetto npm (dist/index.js, Apache-2.0, sha256 qui sotto): dentro il bundle
 * al posto di `npm:@imagemagick/magick-wasm`, che portava nel pacchetto Edge anche i due magick.wasm (31 MB) e costava
 * ~0,3-0,45 s a OGNI richiesta all'edge operativa. Il wasm resta scaricato da jsDelivr con verifica sha256, come prima. */
export const magickModuleSha256='cf1db24f7e63f560118ef434fd581dc9ef66ad099dc417184765cd6076fb4a1b';
export function imageInitializerEntry({initializerEntry,databaseEntry,magickEntry=null}){
 return `import process from 'node:process';
import postgres from 'postgres';
import {databaseOptions} from ${JSON.stringify(databaseEntry)};
import {initializeEdgeImages as initialize} from ${JSON.stringify(initializerEntry)};
const url='https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.44/dist/x86/magick.wasm';
const digest='b7d6710436b150dc5bd1ca04d80b6b7614c54854d7470f888f7e69a2a41b00e4';
${readPinnedWasm.toString()}
let initialized;
function milestone(stage){console.log(JSON.stringify({scope:'candidate-image-boot',stage,memory:Deno.memoryUsage()}))}
async function boundedWasm(){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),20000);
 try{
  milestone('image_before_wasm_fetch');
  const response=await fetch(url,{signal:abort.signal,redirect:'error'});
  milestone('image_wasm_fetch_headers');
  const bytes=await readPinnedWasm(response);
  milestone('image_wasm_download_complete');return bytes;
 }finally{clearTimeout(timer)}
}
export function initializeEdgeImages(){
 return initialized??=(async()=>{
  const env=process.env;
  if(env.TAKO_EXECUTION_RUNTIME!=='edge'||env.UPLOADS_DRIVER!=='supabase'||!env.DATABASE_URL||!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Edge image provider configuration required');
  const raw=env.TAKO_IMAGE_SEEDS_JSON;
  if(!raw||raw.length>65536)throw new Error('Image seed configuration required');
  const seeds=JSON.parse(raw);
  if(!Array.isArray(seeds)||!seeds.length||seeds.some(s=>!s||typeof s.tenantId!=='string'||typeof s.checkpoint!=='string'||Object.keys(s).some(k=>!['tenantId','checkpoint'].includes(k))))throw new Error('Invalid image seed configuration');
  // Match canonical pool TLS policy; reject filesystem CA paths in Edge.
  milestone('image_before_postgres_construct');
  const connection=postgres(env.DATABASE_URL,databaseOptions(env));
  milestone('image_after_postgres_construct');
  try{
   const magick=await import(${JSON.stringify(magickEntry??'npm:@imagemagick/magick-wasm@0.0.44')});const wasm=await boundedWasm();
   return await initialize({env,runtime:magick,runtimeVersion:'0.0.44',wasm,expectedWasmSha256:digest,seeds,milestone,query:async(statement,parameters)=>await connection.unsafe(statement,[...parameters])});
  }catch(error){await connection.end({timeout:1}).catch(()=>{});throw error}
 })();
}
`;
}
