// Temporary JWT-protected probe: no Storage/database/client data writes.
import * as magick from 'npm:@imagemagick/magick-wasm@0.0.44'
import {edgeStaticImageCodec} from '../../../apps/server/src/lib/edge-static-image-codec.ts'
const wasm=await Deno.readFile(new URL('./magick.wasm',import.meta.url))
const codec=edgeStaticImageCodec(magick,wasm)
Deno.serve(async request=>{
 try{const length=Number(request.headers.get('content-length'));if(length>10485760)return Response.json({error:'INPUT_BYTE_LIMIT'},{status:413})
 const bytes=new Uint8Array(await request.arrayBuffer());const start=performance.now(),output=await codec(bytes)
 return Response.json({ok:true,scope:'image-codec-probe',operational:false,format:output.format,width:output.width,height:output.height,bytes:output.bytes.length,wallMs:performance.now()-start,memory:Deno.memoryUsage()})
 }catch(error){return Response.json({ok:false,error:String(error)},{status:422})}
})
