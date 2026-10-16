/* Experimental isolated worker; deliberately not loaded by the production UI.
 * Serve this module beside magick.js and magick.wasm from the pinned0.0.44 package.
 * Client processing never replaces independent server validation.
 */
import {ImageMagick,initializeImageMagick,MagickReadSettings,MagickImageCollection,MagickFormat,ResourceLimits} from './magick.js';
const ready=fetch(new URL('./magick.wasm',import.meta.url)).then(r=>{if(!r.ok)throw Error('WASM_UNAVAILABLE');return r.arrayBuffer();}).then(initializeImageMagick);
const types={jpeg:['Jpeg','image/jpeg'],png:['Png','image/png'],webp:['WebP','image/webp'],gif:['Gif','image/gif']};
function mime(bytes){if(bytes.length<12)throw Error('INVALID_FILE_CONTENT');if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'jpeg';if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return'png';if(String.fromCharCode(...bytes.slice(0,4))==='GIF8')return'gif';if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return'webp';throw Error('INVALID_FILE_CONTENT');}
let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{const start=performance.now();try{await ready;const bytes=new Uint8Array(data.bytes);if(bytes.length>20*1024*1024)throw Error('INPUT_BYTES_LIMIT');const format=mime(bytes),settings=new MagickReadSettings({format:MagickFormat[types[format][0]]});ResourceLimits.disk=0n;ResourceLimits.memory=384n*1024n*1024n;ResourceLimits.listLength=120n;ResourceLimits.maxProfileSize=1024n*1024n;
 // Ping all frame/canvas dimensions before full decoding/coalescing.
 const probe=new MagickImageCollection();try{probe.ping(bytes,settings);const frames=probe.length,canvas=probe.reduce((n,img)=>Math.max(n,(img.page.width||0)*(img.page.height||0),img.width*img.height),0);if(probe.reduce((n,img)=>n+img.width*img.height,0)>24000000||canvas*frames>24000000)throw Error('INPUT_PIXEL_LIMIT');}finally{probe.dispose();}
 const output=ImageMagick.readCollection(bytes,settings,images=>{if(format==='gif')images.coalesce();for(const img of images){img.autoOrient();const ratio=Math.min(1,2000/img.width,2000/img.height);if(ratio<1)img.resize(Math.max(1,Math.floor(img.width*ratio)),Math.max(1,Math.floor(img.height*ratio)));img.strip();}return images.write(MagickFormat[types[format][0]],out=>Uint8Array.from(out));});
 if(output.length>10*1024*1024)throw Error('OUTPUT_BYTES_LIMIT');self.postMessage({id:data.id,bytes:output.buffer,mime:types[format][1],wallMs:performance.now()-start},[output.buffer]);
 }catch(error){self.postMessage({id:data.id,error:String(error),wallMs:performance.now()-start});}});};
