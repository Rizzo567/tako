import { readdir,stat } from 'node:fs/promises'
import { join } from 'node:path'
import { imageObjectKey,remoteStorageConfig,remoteStorageEnabled } from './remote-image-store.js'
export type GalleryInventory={url:string;name:string;bytes:number;mime:string}
export async function galleryInventory(tenant:string):Promise<GalleryInventory[]>{
 const entries:GalleryInventory[]=[];const mime=(name:string)=>name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':name.endsWith('.gif')?'image/gif':'image/jpeg'
 // Oggetti estranei al formato di upload (es. `_style_ref.jpg` caricato a mano, cartelle,
 // segnaposto) non sono immagini della libreria: si saltano come nel ramo locale
 // invece di far fallire tutta la libreria con un 500 «Errore interno».
 if(remoteStorageEnabled()){
 const cfg=remoteStorageConfig()
 for(let offset=0;offset<100000;offset+=1000){const response=await fetch(`${cfg.origin}/storage/v1/object/list/${cfg.bucket}`,{method:'POST',headers:{apikey:cfg.key,Authorization:`Bearer ${cfg.key}`,'Content-Type':'application/json'},body:JSON.stringify({prefix:tenant,offset,limit:1000,sortBy:{column:'name',order:'asc'}}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Storage inventory unavailable');const rows:unknown=await response.json();if(!Array.isArray(rows))throw new Error('Invalid storage inventory');for(const row of rows){const name=String(row?.name??'');try{imageObjectKey(tenant,name)}catch{continue}const bytes=Number(row.metadata?.size);if(!Number.isFinite(bytes)||bytes<0)continue;entries.push({url:`/uploads/${tenant}/${name}`,name,bytes,mime:mime(name)})}if(rows.length<1000)return entries}
 throw new Error('Image inventory limit exceeded')
 }
 try{for(const name of await readdir(join(process.env.UPLOADS_DIR??'uploads',tenant))){try{imageObjectKey(tenant,name)}catch{continue}const info=await stat(join(process.env.UPLOADS_DIR??'uploads',tenant,name));if(info.isFile())entries.push({url:`/uploads/${tenant}/${name}`,name,bytes:info.size,mime:mime(name)})}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}return entries
}
