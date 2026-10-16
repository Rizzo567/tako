import {edgeStaticImageCodec} from '../../apps/server/src/lib/edge-static-image-codec.js'
import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import {pathToFileURL,fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
const root=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(root+'apps/server/package.json'),sharp=require('sharp'),base='/tmp/tako-image-runtime-spike'
const runtime=await import(pathToFileURL(base+'/node_modules/@imagemagick/magick-wasm/dist/index.js').href)
const codec=edgeStaticImageCodec(runtime,new Uint8Array(await readFile(base+'/node_modules/@imagemagick/magick-wasm/dist/x86/magick.wasm')))
const rgba=randomBytes(2000*1000*4);for(let i=3;i<rgba.length;i+=4)rgba[i]=(i>>>2)%256
const original=await sharp(rgba,{raw:{width:2000,height:1000,channels:4}}).withMetadata().png().toBuffer(),output=await codec(new Uint8Array(original))
const inputRaw=await sharp(original).ensureAlpha().raw().toBuffer(),outputRaw=await sharp(output.bytes).ensureAlpha().raw().toBuffer(),metadata=await sharp(output.bytes).metadata()
assert.equal(output.format,'webp');assert.equal(inputRaw.length,outputRaw.length);let pixels=0
for(let i=3;i<inputRaw.length;i+=4){assert.equal(outputRaw[i],inputRaw[i]);pixels++}
assert.equal(metadata.hasAlpha,true);assert.equal(!!metadata.exif,false);assert.equal(!!metadata.icc,false)
const result={passed:true,alphaPixelsCompared:pixels,exactAlpha:true,alphaLevels:256,format:output.format,width:metadata.width,height:metadata.height,metadataStripped:true}
await writeFile(root+'docs/webapp/activation/static-image-alpha-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
