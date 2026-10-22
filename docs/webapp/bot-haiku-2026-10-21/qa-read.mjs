import fs from 'node:fs';import path from 'node:path';import {homedir} from 'node:os'
const cfg=path.join(homedir(),'.config/tako-webapp');const token=fs.readFileSync(path.join(cfg,'supabase-management.env'),'utf8').match(/SUPABASE_ACCESS_TOKEN=['"]?([^'"\n]+)/)?.[1]
export async function q(query){let last;for(let a=0;a<9;a++){if(a)await new Promise(r=>setTimeout(r,1500*a));let r,t;try{r=await fetch('https://api.supabase.com/v1/projects/tcfccmvpycivxuxkoqpw/database/query',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(30000)});t=await r.text()}catch(e){last=e;continue}
 if(r.ok)return JSON.parse(t);last=new Error('SQL '+r.status+' '+t.slice(0,200));if(!(r.status===401||r.status===429||r.status>=500))break}throw last} // retry: Management API con 401/5xx transitori (22/10)
if(process.argv[1].endsWith('qa-read.mjs')){
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
const [w]=await q(`SELECT revision, published FROM menu_workspaces WHERE restaurant_id='${QA}'`)
const st=await q(`SELECT settings->>'botEngine' e, settings->>'botBrain' b FROM restaurants WHERE id='${QA}'`);console.log('rev',w.revision,st)
for(const m of w.published.menus){console.log('MENU',m.name,m.active,m.pricing??'',JSON.stringify(m.formulas??[]));for(const s of m.sections)console.log('  ',s.name,s.parentSectionId?'(sez)':'',s.items.map(i=>i.name+':'+i.price+(i.hidden?'(h)':'')).slice(0,8).join(', '))}}
