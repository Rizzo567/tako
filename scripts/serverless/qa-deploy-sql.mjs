// Runner delle sezioni SQL del deploy QA Haiku (21/10/2026) via Supabase Management API (POST /database/query).
// Stesso metodo degli script live R (docs/webapp/bot-cervello-2026-10-17/live-N/q.mjs), token da supabase-management.env (mai stampato).
//
//   node scripts/serverless/qa-deploy-sql.mjs <comando> [--dry-run]
//     engine-on       bot-engine.sql [1]  settings.botEngine='haiku' solo sul QA (RAISE se ≠ 1 riga)
//     engine-status   bot-engine.sql [2]  sola lettura
//     engine-off      bot-engine.sql [3]  rollback (toglie botEngine)
//     link-status     qa-manuel-link.sql [1]+[3]  sola lettura (numero mascherato)
//     link            salva i collegamenti QA attuali in ~/.config/tako-webapp/rollback-edge-20261021/qa-links-before.json
//                     (mai sovrascritto se esiste) → qa-manuel-link.sql [2] → [3]
//     link-rollback   qa-manuel-link.sql [4] → rimette i collegamenti QA salvati → [3]
//   --dry-run: stampa l'SQL che verrebbe eseguito (numero mascherato) e non contatta nessuno.
import fs from 'node:fs'
import path from 'node:path'
import {homedir} from 'node:os'
const here=path.dirname(new URL(import.meta.url).pathname)
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
const backupDir=path.join(homedir(),'.config/tako-webapp/rollback-edge-20261021'),backupFile=path.join(backupDir,'qa-links-before.json')
const [cmd]=process.argv.slice(2).filter(a=>!a.startsWith('--')),dry=process.argv.includes('--dry-run')
export function section(text,n){
 const start=text.indexOf(`-- ===== [${n}]`),end=text.indexOf(`-- ===== fine [${n}] =====`)
 if(start<0||end<0)throw new Error('sezione mancante: '+n)
 return text.slice(text.indexOf('\n',start)+1,end).trim()
}
export const PHONE_RE=/^whatsapp:\+39\d{9,10}$/
function manuelPhone(){
 const file=path.join(homedir(),'.config/tako-webapp/owner-service-qa-backup.json')
 const phone=JSON.parse(fs.readFileSync(file,'utf8'))?.link?.phone
 if(typeof phone!=='string'||!PHONE_RE.test(phone)||!phone.endsWith('0927'))throw new Error('numero di Manuel non valido nel backup (atteso whatsapp:+39…0927)')
 return phone
}
const mask=s=>s.replace(/whatsapp:\+39\d{5,6}(\d{4})/g,'whatsapp:+39…$1')
let token
async function q(query){
 if(dry){console.log('--- SQL (dry-run) ---\n'+mask(query));return []}
 token??=fs.readFileSync(path.join(homedir(),'.config/tako-webapp/supabase-management.env'),'utf8').match(/SUPABASE_ACCESS_TOKEN=['"]?([^'"\n]+)/)?.[1]
 if(!token)throw new Error('Management token unavailable')
 const r=await fetch('https://api.supabase.com/v1/projects/tcfccmvpycivxuxkoqpw/database/query',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(30000)})
 const t=await r.text();if(!r.ok)throw new Error('SQL '+r.status+' '+mask(t.slice(0,400)))
 return JSON.parse(t)
}
const show=(label,rows)=>console.log(label+' '+mask(JSON.stringify(rows)))
const lit=v=>v==null?'NULL':`'${String(v).replace(/'/g,"''")}'`
async function main(){
 const engine=fs.readFileSync(path.join(here,'bot-engine.sql'),'utf8')
 const linkSql=()=>fs.readFileSync(path.join(here,'qa-manuel-link.sql'),'utf8').replaceAll('__MANUEL_PHONE__',manuelPhone())
 if(cmd==='engine-on'){await q(section(engine,1));show('engine-status',await q(section(engine,2)));return}
 if(cmd==='engine-status'){show('engine-status',await q(section(engine,2)));return}
 if(cmd==='engine-off'){await q(section(engine,3));show('engine-left',await q(`SELECT count(*) AS with_bot_engine FROM restaurants WHERE settings ? 'botEngine'`));return}
 if(cmd==='link-status'){const s=linkSql();show('link-rows',await q(section(s,1)));show('link-check',await q(section(s,3)));return}
 if(cmd==='link'){
  const s=linkSql()
  if(!dry){
   const rows=await q(`SELECT phone,restaurant_id,actor_id,created_at,activated_at,owner_email,password_reissue FROM tako_whatsapp_links WHERE restaurant_id='${QA}'`)
   fs.mkdirSync(backupDir,{recursive:true,mode:0o700})
   if(fs.existsSync(backupFile))console.log('backup già presente, NON sovrascritto: '+backupFile)
   else{fs.writeFileSync(backupFile,JSON.stringify({savedAt:new Date().toISOString(),restaurant:QA,rows},null,1),{mode:0o600});console.log('backup collegamenti QA: '+rows.length+' righe → '+backupFile)}
  }
  await q(section(s,2));show('link-check',await q(section(s,3)));return
 }
 if(cmd==='link-rollback'){
  const s=linkSql(),phone=manuelPhone()
  await q(section(s,4))
  const saved=fs.existsSync(backupFile)?JSON.parse(fs.readFileSync(backupFile,'utf8')).rows:[]
  for(const r of saved){
   if(r.phone===phone||r.restaurant_id!==QA)continue // il numero di Manuel non torna sul QA; mai righe di altri locali
   await q(`INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,created_at,activated_at,owner_email,password_reissue) VALUES(${lit(r.phone)},${lit(QA)},${lit(r.actor_id)},${lit(r.created_at)},${lit(r.activated_at)},${lit(r.owner_email)},${r.password_reissue===true?'true':'false'}) ON CONFLICT (phone) DO NOTHING`)
  }
  show('link-check',await q(section(s,3)));return
 }
 throw new Error('comando sconosciuto: '+cmd+' (engine-on|engine-status|engine-off|link-status|link|link-rollback)')
}
if(process.argv[1]===new URL(import.meta.url).pathname)await main()
