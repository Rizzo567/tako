// Read-only check of the active operational edge function (Supabase Management API, GET only).
// Origin: ~/.config/tako-webapp/rollback-edge-20261016/check-active.mjs (sha c55eed29…, used in REPORT-R7-2 and the
// v116–v119 rollbacks). Same contract, plus a no-argument info mode and an optional local-bundle hash.
//
//   node scripts/serverless/check-active.mjs                      → prints active {version, ezbr}, exit 0 (info)
//   node scripts/serverless/check-active.mjs <version> <ezbr>     → exit 1 unless active is exactly that version+ezbr
//   ... --local                                                   → also prints sha256 of release/serverless/candidate/index.ts
//   ... --compare-file=<path>                                     → also says if the local index.ts equals <path> (e.g. a rollback copy)
//
// The token is read from ~/.config/tako-webapp/supabase-management.env and never printed. Never writes anything.
// NB: ezbr_sha256 is the hash of the deployed eszip, not of index.ts: the "same code online" proof is
// version+ezbr recorded right after deploy-projection, while --local/--compare-file prove which index.ts was deployed.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
const args=process.argv.slice(2),flags=args.filter(a=>a.startsWith('--')),[version,ezbr]=args.filter(a=>!a.startsWith('--'))
const tok=fs.readFileSync(process.env.HOME+'/.config/tako-webapp/supabase-management.env','utf8').match(/SUPABASE_ACCESS_TOKEN=['"]?([^'"\n]+)/)?.[1]
if(!tok)throw new Error('Management token unavailable')
let ref='tcfccmvpycivxuxkoqpw'
try{const url=fs.readFileSync('.env.web','utf8').match(/^SUPABASE_URL=['"]?([^'"\n]+)/m)?.[1];if(url)ref=new URL(url).hostname.split('.')[0]}catch{}
const slug=process.env.TAKO_CHECK_SLUG||'tako-operational-candidate'
const res=await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/${slug}`,{headers:{authorization:'Bearer '+tok},signal:AbortSignal.timeout(20000)})
if(!res.ok){console.log(JSON.stringify({error:'management GET failed',status:res.status}));process.exit(2)}
const j=await res.json()
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const out={projectRef:ref,slug,active:{version:j.version,ezbr:String(j.ezbr_sha256),status:j.status,updatedAt:j.updated_at}}
const local='release/serverless/candidate/index.ts'
if(flags.includes('--local')||flags.some(f=>f.startsWith('--compare-file='))){
 out.local=fs.existsSync(local)?{file:local,sha256:sha(local),bytes:fs.statSync(local).size}:{file:local,missing:true}
 const cmp=flags.find(f=>f.startsWith('--compare-file='))?.slice('--compare-file='.length)
 if(cmp&&out.local.sha256){const other=sha(cmp);out.compare={file:cmp,sha256:other,result:other===out.local.sha256?'uguale':'diverso'}}
}
if(version===undefined){console.log(JSON.stringify(out));process.exit(0)}
const ok=String(j.version)===version&&j.ezbr_sha256===ezbr
out.expected={version,ezbr};out.ok=ok;out.result=ok?'uguale':'diverso'
console.log(JSON.stringify(out))
if(!ok)process.exit(1)
