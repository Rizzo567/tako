export const STATIC_IMAGE_LIMITS=Object.freeze({bytes:10*1024*1024,pixels:2_000_000})
export type StaticImageInfo={format:'jpeg'|'png'|'webp';width:number;height:number}
const invalid=()=>new Error('INVALID_FILE_CONTENT')
const ascii=(b:Uint8Array,start:number,end:number)=>String.fromCharCode(...b.subarray(start,end))
export function inspectStaticImage(b:Uint8Array,maxPixels:number=STATIC_IMAGE_LIMITS.pixels):StaticImageInfo {
 if(!b.length||b.length>STATIC_IMAGE_LIMITS.bytes)throw new Error('INPUT_BYTE_LIMIT')
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);let width=0,height=0,format:StaticImageInfo['format']
 if(ascii(b,0,4)==='GIF8')throw new Error('ANIMATION_NOT_SUPPORTED')
 if(b.length>=24&&ascii(b,1,4)==='PNG'&&b[0]===137){
  format='png';if(ascii(b,12,16)!=='IHDR'||v.getUint32(8)!==13)throw invalid();width=v.getUint32(16);height=v.getUint32(20)
  let p=8,ended=false
  while(p+12<=b.length){const size=v.getUint32(p),type=ascii(b,p+4,p+8);if(size>b.length-p-12)throw invalid();if(type==='acTL'||type==='fcTL'||type==='fdAT')throw new Error('ANIMATION_NOT_SUPPORTED');p+=size+12;if(type==='IEND'){ended=true;break}}
  if(!ended)throw invalid()
 }else if(b.length>=12&&ascii(b,0,4)==='RIFF'&&ascii(b,8,12)==='WEBP'){
  format='webp';if(v.getUint32(4,true)+8!==b.length)throw invalid();let p=12
  while(p+8<=b.length){const type=ascii(b,p,p+4),size=v.getUint32(p+4,true),data=p+8;if(size>b.length-data)throw invalid()
   if(type==='ANIM'||type==='ANMF')throw new Error('ANIMATION_NOT_SUPPORTED')
   if(type==='VP8X'){if(size<10)throw invalid();if(v.getUint8(data)&2)throw new Error('ANIMATION_NOT_SUPPORTED');width=1+v.getUint8(data+4)+(v.getUint8(data+5)<<8)+(v.getUint8(data+6)<<16);height=1+v.getUint8(data+7)+(v.getUint8(data+8)<<8)+(v.getUint8(data+9)<<16)}
   else if(type==='VP8 '&&!width){if(size<10||b[data+3]!==157||v.getUint8(data+4)!==1||v.getUint8(data+5)!==42)throw invalid();width=v.getUint16(data+6,true)&16383;height=v.getUint16(data+8,true)&16383}
   else if(type==='VP8L'&&!width){if(size<5||b[data]!==47)throw invalid();const bits=v.getUint32(data+1,true);width=(bits&16383)+1;height=((bits>>>14)&16383)+1}
   p=data+size+(size%2)
  }
  if(p!==b.length)throw invalid()
 }else if(b.length>=4&&b[0]===255&&b[1]===216){
  format='jpeg';let p=2
  while(p+4<=b.length){if(b[p++]!==255)throw invalid();while(b[p]===255)p++;const marker=b[p++];if(marker===undefined)throw invalid();if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;if(p+2>b.length)throw invalid();const size=v.getUint16(p);if(size<2||p+size>b.length)throw invalid();if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(size<8)throw invalid();height=v.getUint16(p+3);width=v.getUint16(p+5);break}p+=size}
 }else throw invalid()
 if(!width||!height)throw invalid();if(width*height>maxPixels)throw new Error('INPUT_PIXEL_LIMIT')
 return {format,width,height}
}
