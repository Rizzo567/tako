import {describe,it,expect} from 'vitest'
import {inspectStaticImage} from '../apps/server/src/lib/static-image-policy.js'
import {edgeStaticImageCodec} from '../apps/server/src/lib/edge-static-image-codec.js'
function png(width:number,height:number,animated=false){const b=Buffer.alloc(animated?57:45);b.set([137,80,78,71,13,10,26,10]);b.writeUInt32BE(13,8);b.write('IHDR',12);b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);let p=33;if(animated){b.writeUInt32BE(0,p);b.write('acTL',p+4);p+=12}b.writeUInt32BE(0,p);b.write('IEND',p+4);return b}
describe('predecode static image policy',()=>{
 it('accepts exactly2MP and rejects overlimit before codec initialization',async()=>{
  expect(inspectStaticImage(png(2000,1000))).toMatchObject({width:2000,height:1000,format:'png'})
  let initialized=false;const codec=edgeStaticImageCodec({initializeImageMagick:()=>{initialized=true}},new Uint8Array())
  await expect(codec(png(2001,1000))).rejects.toThrow('INPUT_PIXEL_LIMIT');expect(initialized).toBe(false)
 })
 it('rejects GIF, APNG and animatedWebP before decode',()=>{
  expect(()=>inspectStaticImage(Buffer.from('GIF89a000000'))).toThrow('ANIMATION_NOT_SUPPORTED')
  expect(()=>inspectStaticImage(png(10,10,true))).toThrow('ANIMATION_NOT_SUPPORTED')
  const webp=Buffer.alloc(30);webp.write('RIFF');webp.writeUInt32LE(22,4);webp.write('WEBP',8);webp.write('VP8X',12);webp.writeUInt32LE(10,16);webp[20]=2
  expect(()=>inspectStaticImage(webp)).toThrow('ANIMATION_NOT_SUPPORTED')
 })
 it('rejects byte limits/truncated files',()=>{
  expect(()=>inspectStaticImage(new Uint8Array(10485761))).toThrow('INPUT_BYTE_LIMIT')
  expect(()=>inspectStaticImage(png(10,10).subarray(0,40))).toThrow('INVALID_FILE_CONTENT')
 })
})
