import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {homedir} from 'node:os'
import path from 'node:path'
const apply=process.argv.includes('--apply'),root=path.resolve(new URL('../../',import.meta.url).pathname),raw=await readFile(path.join(homedir(),'.config/tako-webapp/candidate.env'),'utf8'),config={}
for(const line of raw.split('\n')){const match=line.match(/^TAKO_CANDIDATE_(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|PDF_FONT_BUCKET|PDF_FONT_PREFIX)=(.*)$/);if(match)config[match[1]]=match[2].replace(/^['"]|['"]$/g,'')}
const bucket=config.PDF_FONT_BUCKET,prefix=config.PDF_FONT_PREFIX??'fonts',origin=new URL(config.SUPABASE_URL??'')
if(bucket!=='tako-pdf-fonts'||origin.protocol!=='https:'||!origin.hostname.endsWith('.supabase.co')||origin.pathname!=='/'||origin.search||origin.hash||!config.SUPABASE_SERVICE_ROLE_KEY||prefix!=='fonts')throw Error('Unexpected private font target configuration')
const headers={Authorization:`Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,apikey:config.SUPABASE_SERVICE_ROLE_KEY},storage=origin.origin+'/storage/v1',hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const text=await readFile(root+'/apps/server/src/lib/pdf-runtime-font-manifest.ts','utf8'),manifest=JSON.parse(text.slice(text.indexOf('{'),text.lastIndexOf('}')+1)),files=[]
for(const[name,expected]of Object.entries(manifest)){if(!/^[A-Za-z0-9-]+\.(ttf|otf)$/.test(name))throw Error('Invalid pinned filename');const bytes=await readFile(root+'/apps/server/assets/fonts/'+name);if(bytes.length!==expected.bytes||hash(bytes)!==expected.sha256)throw Error('Repository font differs from pinned manifest');files.push({name,bytes,expected,key:prefix+'/'+name})}
const request=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(120000)})
async function missing(response){if(response.status===404)return true;if(response.status===400){const body=await response.json().catch(()=>({}));return String(body.statusCode??body.code)==='404'||body.error==='not_found'||body.message==='Object not found'||body.message==='Bucket not found'}return false}
let bucketExists=false;const bucketResponse=await request(storage+'/bucket/'+bucket,{headers})
if(bucketResponse.ok){const metadata=await bucketResponse.json();if(metadata.public!==false)throw Error('Existing font bucket must already be private');bucketExists=true}else if(!await missing(bucketResponse))throw Error('Bucket inventory HTTP'+bucketResponse.status)
const states=[]
// Inspect all existing objects before any mutation. Never overwrite a mismatch.
for(const file of files){if(!bucketExists){states.push({...file,present:false});continue}const response=await request(storage+'/object/authenticated/'+bucket+'/'+file.key,{headers});if(response.ok){const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==file.expected.bytes||hash(bytes)!==file.expected.sha256)throw Error('Existing font mismatch; no overwrite allowed: '+file.name);states.push({...file,present:true})}else if(await missing(response))states.push({...file,present:false});else throw Error('Font inventory HTTP'+response.status)}
const proof={mode:apply?'apply':'dry-run',bucket,public:false,fontCount:files.length,totalBytes:files.reduce((sum,f)=>sum+f.bytes.length,0),existingVerified:states.filter(f=>f.present).length,missing:states.filter(f=>!f.present).map(f=>f.name),objects:[],createdBucket:false}
if(apply){
 if(!bucketExists){const response=await request(storage+'/bucket',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id:bucket,name:bucket,public:false,file_size_limit:20000000})});if(!response.ok)throw Error('Private font bucket create HTTP'+response.status);proof.createdBucket=true}
 for(const file of states){let uploadStatus=null;if(!file.present){const response=await request(storage+'/object/'+bucket+'/'+file.key,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','x-upsert':'false'},body:file.bytes});uploadStatus=response.status;if(!response.ok)throw Error('Font create-only upload HTTP'+response.status)}const download=await request(storage+'/object/authenticated/'+bucket+'/'+file.key,{headers});if(!download.ok)throw Error('Font proof GET HTTP'+download.status);const bytes=Buffer.from(await download.arrayBuffer());if(bytes.length!==file.expected.bytes||hash(bytes)!==file.expected.sha256)throw Error('Font proof mismatch');proof.objects.push({name:file.name,key:file.key,bytes:bytes.length,sha256:hash(bytes),uploadStatus,verified:true});console.log(JSON.stringify({font:file.name,verified:true,uploadStatus}))}
 const metadata=await request(storage+'/bucket/'+bucket,{headers});if(!metadata.ok||(await metadata.json()).public!==false)throw Error('Private bucket proof failed');proof.privateBucketVerified=true
 const anonymous=await request(storage+'/object/authenticated/'+bucket+'/'+files[0].key);proof.anonymousAuthenticatedStatus=anonymous.status;if(anonymous.ok)throw Error('Anonymous font read unexpectedly allowed')
 const publicResponse=await request(storage+'/object/public/'+bucket+'/'+files[0].key);proof.anonymousPublicStatus=publicResponse.status;if(publicResponse.ok)throw Error('Public font read unexpectedly allowed')
 proof.completed=true
}
await mkdir(root+'/docs/webapp/activation',{recursive:true});await writeFile(root+'/docs/webapp/activation/pdf-fonts-'+(apply?'proof':'plan')+'.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({...proof,objects:proof.objects.length}));
