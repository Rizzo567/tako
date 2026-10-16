/** Local-only WASM viability spike. No uploads, database, or application changes.
 * Install: npm install --prefix /tmp/tako-image-runtime-spike @imagemagick/magick-wasm@0.0.44
 * Run: pnpm --filter @tako/server exec tsx ../../scripts/serverless/image-runtime-spike.ts
 */
import {createRequire} from 'node:module'
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
const self=fileURLToPath(import.meta.url),root=resolve(dirname(self),'../..'),tmp=process.env.TAKO_IMAGE_SPIKE_DIR??'/tmp/tako-image-runtime-spike'
const packageDir=resolve(tmp,'node_modules/@imagemagick/magick-wasm'),fixtures=resolve(tmp,'fixtures'),results=resolve(root,'docs/webapp/serverless/image-runtime-metrics.json')
const req=createRequire(resolve(root,'apps/server/package.json'))
const formats:Record<string,string>={jpeg:'Jpeg',png:'Png',webp:'WebP',gif:'Gif'}
function sniff(b:Uint8Array){if(b.length<12)throw Error('INVALID_FILE_CONTENT');if(b[0]===255&&b[1]===216&&b[2]===255)return'jpeg';if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)return'png';if(String.fromCharCode(...b.slice(0,4))==='GIF8')return'gif';if(String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return'webp';throw Error('INVALID_FILE_CONTENT')}
async function child(name:string){
 const m=await import(pathToFileURL(resolve(packageDir,'dist/index.js')).href),wasm=await readFile(resolve(packageDir,'dist/x86/magick.wasm'))
 const start=performance.now(),cpu0=process.cpuUsage();await m.initializeImageMagick(wasm);const initMs=performance.now()-start,initCpu=process.cpuUsage(cpu0)
 // Disable disk spill; bound allocation before decoding. Area is not a rejection limit.
 m.ResourceLimits.memory=192n*1024n*1024n;m.ResourceLimits.disk=0n;m.ResourceLimits.listLength=120n;m.ResourceLimits.maxProfileSize=1024n*1024n
 const input=new Uint8Array(await readFile(resolve(fixtures,name))),fmt=sniff(input),settings=new m.MagickReadSettings({format:m.MagickFormat[formats[fmt]!]})
 const cpu1=process.cpuUsage(),warm=performance.now();let output:Uint8Array|undefined,error:string|undefined
 try{const info=m.MagickImageInfo.create(input,settings);if(info.width*info.height>24_000_000)throw Error('INPUT_PIXEL_LIMIT')
 output=m.ImageMagick.readCollection(input,settings,(images:any)=>{let pixels=0;for(const image of images)pixels+=image.width*image.height;if(pixels>24_000_000)throw Error('INPUT_PIXEL_LIMIT');if(fmt==='gif')images.coalesce();for(const image of images){image.autoOrient();const ratio=Math.min(1,2000/image.width,2000/image.height);if(ratio<1)image.resize(Math.max(1,Math.floor(image.width*ratio)),Math.max(1,Math.floor(image.height*ratio)));image.strip()}return images.write(m.MagickFormat[formats[fmt]!],(bytes:Uint8Array)=>Uint8Array.from(bytes))})
 }catch(e){error=String(e)}
 const wallMs=performance.now()-warm,cpu=process.cpuUsage(cpu1),usage=process.resourceUsage();let verified:any
 if(output){await writeFile(resolve(fixtures,'out-'+name),output);const meta=await req('sharp')(output,{animated:fmt==='gif'}).metadata();verified={format:meta.format,width:meta.width,height:meta.height,pageHeight:meta.pageHeight,pages:meta.pages??1,delay:meta.delay,loop:meta.loop,orientation:meta.orientation,exif:!!meta.exif,icc:!!meta.icc};if(fmt==='gif'&&name==='animated.gif'&&(meta.pages!==2||meta.loop!==0||JSON.stringify(meta.delay)!=='[120,240]'))throw Error('ANIMATION_CONTRACT_FAILED');if(meta.width>2000||(meta.pageHeight??meta.height)>2000||meta.exif||meta.icc)throw Error('OUTPUT_CONTRACT_FAILED')}
 console.log(JSON.stringify({name,inputBytes:input.length,outputBytes:output?.length,initMs,initCpuMs:(initCpu.user+initCpu.system)/1000,wallMs,cpuMs:(cpu.user+cpu.system)/1000,maxRssBytes:usage.maxRSS*1024,error,verified}))
}
async function main(){if(process.argv[2]==='--child'){await child(process.argv[3]!);return}await mkdir(fixtures,{recursive:true});const sharp=req('sharp');
 for(const fmt of ['jpeg','png','webp'])await sharp({create:{width:2400,height:1600,channels:3,background:'#de9146'}}).withMetadata({orientation:6}).toFormat(fmt).toFile(resolve(fixtures,'normal.'+fmt))
 await sharp({create:{width:6000,height:4000,channels:3,background:'#de9146'}}).jpeg().toFile(resolve(fixtures,'worst24mp.jpeg'))
 await sharp({create:{width:6000,height:4000,channels:3,background:'#de9146'}}).png().toFile(resolve(fixtures,'worst24mp.png'))
 await sharp({create:{width:6001,height:4000,channels:3,background:'#de9146'}}).png().toFile(resolve(fixtures,'over24mp.png'))
 // Pillow builds genuine distinct-frame GIF fixtures; Sharp verifies output independently.
 const python=spawnSync('python3',['-c',`from PIL import Image
from pathlib import Path
p=Path(${JSON.stringify(fixtures)})
frames=[Image.new('RGB',(300,200),c) for c in ['red','blue']]
frames[0].save(p/'animated.gif',save_all=True,append_images=frames[1:],duration=[120,240],loop=0)
frames=[Image.new('RGB',(1000,1000),(i*10,255-i*10,100)) for i in range(24)]
frames[0].save(p/'animated24mp.gif',save_all=True,append_images=frames[1:],duration=100,loop=0)
`],{encoding:'utf8'});if(python.status!==0)throw Error(python.stderr)
 await writeFile(resolve(fixtures,'invalid.png'),'not an image, reject without decode')
 const cases=['normal.jpeg','normal.png','normal.webp','animated.gif','worst24mp.jpeg','worst24mp.png','animated24mp.gif','over24mp.png','invalid.png'],observations=[]
 for(const name of cases){const child=spawnSync(process.execPath,[...process.execArgv,self,'--child',name],{encoding:'utf8',timeout:45000,maxBuffer:2*1024*1024});try{observations.push(JSON.parse(child.stdout.trim().split('\n').at(-1)!))}catch{observations.push({name,status:child.status,error:child.error?.message??child.stderr.slice(-1500)})}}
 const evidence={runtime:process.version,platform:process.platform,arch:process.arch,packageVersion:JSON.parse(await readFile(resolve(packageDir,'package.json'),'utf8')).version,wasmBytes:(await stat(resolve(packageDir,'dist/x86/magick.wasm'))).size,jsBytes:(await stat(resolve(packageDir,'dist/index.js'))).size,observations};await mkdir(dirname(results),{recursive:true});await writeFile(results,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2))
}
main().catch(e=>{console.error(String(e));process.exitCode=1})
