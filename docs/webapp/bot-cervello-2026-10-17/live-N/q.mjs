// Query di sola lettura/ammin. sul DB via Management API (stesso token degli altri script). Uso: node q.mjs "<SQL>"
import fs from 'node:fs';import {homedir} from 'node:os'
const tok=fs.readFileSync(homedir()+'/.config/tako-webapp/supabase-onboarding.env','utf8').match(/SUPABASE_ACCESS_TOKEN=['"]?([^'"\n]+)/)[1]
export const q=async query=>{const r=await fetch('https://api.supabase.com/v1/projects/tcfccmvpycivxuxkoqpw/database/query',{method:'POST',headers:{authorization:'Bearer '+tok,'content-type':'application/json'},body:JSON.stringify({query})});const t=await r.text();if(!r.ok)throw Error('SQL '+r.status+' '+t.slice(0,300));return JSON.parse(t)}
if(process.argv[2])console.log(JSON.stringify(await q(process.argv[2]),null,1))
