import {edgeStaticImageCodec} from '../../apps/server/src/lib/edge-static-image-codec.js'
import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
const root=fileURLToPath(new URL('../../',import.meta.url)),base='/tmp/tako-image-runtime-spike',require=createRequire(root+'apps/server/package.json'),sharp=require('sharp')
if(process.argv[2]==='--child'){
 const format=process.argv[3]!,runtime=await import(pathToFileURL(base+'/node_modules/@imagemagick/magick-wasm/dist/index.js').href)
 const wasm=new Uint8Array(await readFile(base+'/node_modules/@imagemagick/magick-wasm/dist/x86/magick.wasm'))
 const codec=edgeStaticImageCodec(runtime,wasm),input=new Uint8Array(await readFile(base+'/fixtures/static2mp.'+format)),start=performance.now(),cpu=process.cpuUsage()
 const output=await codec(input),meta=await sharp(output.bytes).metadata(),used=process.cpuUsage(cpu)
 console.log(JSON.stringify({format,wallMs:performance.now()-start,cpuMs:(used.user+used.system)/1000,maxRssBytes:process.resourceUsage().maxRSS*1024,inputBytes:input.length,outputBytes:output.bytes.length,width:meta.width,height:meta.height,metadataStripped:!meta.exif&&!meta.icc}))
}else{
 const noise=Buffer.alloc(2000*1000*3);for(let i=0;i<noise.length;i++)noise[i]=(i*53+(i>>>5)*97)&255
 for(const format of ['jpeg','png','webp'])await sharp(noise,{raw:{width:2000,height:1000,channels:3}}).withMetadata().toFormat(format).toFile(base+'/fixtures/static2mp.'+format)
 const results=[]
 for(const format of ['jpeg','png','webp']){const result=spawnSync(process.execPath,[...process.execArgv,fileURLToPath(import.meta.url),'--child',format],{encoding:'utf8',timeout:30000});results.push(result.status===0?JSON.parse(result.stdout.trim()):{format,error:result.stderr.slice(-1500),status:result.status})}
 await writeFile(root+'docs/webapp/activation/static-image-codec-metrics.json',JSON.stringify({pinned:'@imagemagick/magick-wasm@0.0.44',limits:{pixels:2000000,bytes:10485760},results},null,2));console.log(JSON.stringify(results,null,2))
}
