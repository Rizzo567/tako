import fs from 'node:fs/promises';import {homedir} from 'node:os';import {parseEnv} from 'node:util';import {createHash} from 'node:crypto';
const dir=process.argv[2];if(!dir)throw new Error('Private output directory required');
await fs.mkdir(dir,{recursive:true,mode:0o700});
const {SUPABASE_ACCESS_TOKEN:token}=parseEnv(await fs.readFile(homedir()+'/.config/tako-webapp/supabase-management.env','utf8'));
const api='https://api.supabase.com/v1/projects/tcfccmvpycivxuxkoqpw/functions/tako-operational-candidate',headers={authorization:'Bearer '+token};
async function metadata(){const r=await fetch(api,{headers});if(!r.ok)throw new Error('Metadata '+r.status);return r.json();}
const before=await metadata(),r=await fetch(api+'/body',{headers});if(!r.ok)throw new Error('Bundle '+r.status);const bytes=Buffer.from(await r.arrayBuffer()),after=await metadata();
if(before.version!==after.version||before.ezbr_sha256!==after.ezbr_sha256)throw new Error('Online bundle changed while downloading');
if(bytes.subarray(0,8).toString()!=='ESZIP2.3')throw new Error('Unsupported ESZIP format');
// v2.3 modules header: options length+options, header length, first module name/type/source offsets.
const options=bytes.readUInt32BE(8),headerStart=12+options+4;
let at=headerStart;const nameLength=bytes.readUInt32BE(at);at+=4;const name=bytes.subarray(at,at+nameLength).toString();at+=nameLength;
if(name!=='tako-operational-candidate/index.ts'||bytes[at]!==0||bytes.readUInt32BE(at+1)!==0)throw new Error('Unexpected first ESZIP module');
const sourceLength=bytes.readUInt32BE(at+5);
const prefix=Buffer.from('var __defProp = Object.defineProperty;\nvar __getOwnPropNames = Object.getOwnPropertyNames;');
const start=bytes.indexOf(prefix);if(start<0)throw new Error('Cannot identify candidate source');
const source=bytes.subarray(start,start+sourceLength);if(!source.subarray(-10).toString().includes('});'))throw new Error('Unexpected candidate boundary');
at+=18;const auxNameLength=bytes.readUInt32BE(at);at+=4;const auxName=bytes.subarray(at,at+auxNameLength).toString();at+=auxNameLength;
if(auxName!=='tako-operational-candidate/magick-wasm-0.0.44.js')throw new Error('Unexpected auxiliary module');
const offset=bytes.readUInt32BE(at+1),length=bytes.readUInt32BE(at+5),aux=bytes.subarray(start+offset,start+offset+length);
if(createHash('sha256').update(aux).digest('hex')!=='cf1db24f7e63f560118ef434fd581dc9ef66ad099dc417184765cd6076fb4a1b')throw new Error('Auxiliary differs');
await fs.writeFile(dir+'/online-index.ts',source,{mode:0o600});await fs.writeFile(dir+'/magick-wasm-0.0.44.js',aux,{mode:0o600});await fs.writeFile(dir+'/active.json',JSON.stringify(before),{mode:0o600});
console.log(JSON.stringify({version:before.version,ezbr:before.ezbr_sha256,sourceSha256:createHash('sha256').update(source).digest('hex'),bytes:source.length}));
