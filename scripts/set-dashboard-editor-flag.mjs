#!/usr/bin/env node
// Accende/spegne il nuovo editor «Piatti» per UN locale: restaurants.settings.dashboardEditor (dashboard editor 22/10, CONTRATTO §3).
// Uso: node scripts/set-dashboard-editor-flag.mjs <restaurantId> on|off --yes
//      node scripts/set-dashboard-editor-flag.mjs <restaurantId> on|off        (prova: mostra cosa farebbe, nessuna scrittura)
//      node scripts/set-dashboard-editor-flag.mjs --help
// Connessione: DATABASE_URL di .env.web (stessa regola di apply-web-migrations.mjs); TAKO_FLAG_DATABASE_URL la sostituisce (DB locale/isolato).
// Solo questa chiave di settings viene toccata (jsonb_set), una riga, in una transazione. Effetto immediato, nessun deploy.
// MAI eseguito dagli agenti su locali veri: lo lancia Manuel, un locale alla volta.
import postgres from 'postgres'
import {parseEnv} from 'node:util'
import {readFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'

const USAGE='Uso: node scripts/set-dashboard-editor-flag.mjs <restaurantId> on|off --yes   (senza --yes: solo prova)'
const args=process.argv.slice(2)
if(args.includes('--help')||args.includes('-h')){console.log(USAGE);process.exit(0)}
const [restaurantId,mode]=args.filter(a=>!a.startsWith('--'))
const yes=args.includes('--yes')
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if(!restaurantId||!UUID.test(restaurantId)){console.error('Serve l\'id esplicito del locale (uuid).\n'+USAGE);process.exit(2)}
if(mode!=='on'&&mode!=='off'){console.error('Secondo argomento: on oppure off.\n'+USAGE);process.exit(2)}
const value=mode==='on'

function connection(){
 if(process.env.TAKO_FLAG_DATABASE_URL)return postgres(process.env.TAKO_FLAG_DATABASE_URL,{max:1,onnotice:()=>{}})
 const file=resolve('.env.web');if(!existsSync(file))throw new Error('.env.web mancante (oppure TAKO_FLAG_DATABASE_URL)')
 const env=parseEnv(readFileSync(file,'utf8'))
 const url=new URL(env.DATABASE_URL)
 if(!url.hostname.endsWith('.pooler.supabase.com')||!env.DATABASE_CA_CERT_PATH)throw new Error('Destinazione gestita inattesa')
 url.searchParams.delete('sslmode')
 return postgres(url.toString(),{max:1,onnotice:()=>{},ssl:{ca:readFileSync(env.DATABASE_CA_CERT_PATH,'utf8'),rejectUnauthorized:true}})
}

const sql=connection()
try{
 const [row]=await sql`SELECT id,name,settings->'dashboardEditor' AS flag FROM restaurants WHERE id=${restaurantId}`
 if(!row){console.error(`Locale ${restaurantId} non trovato`);process.exitCode=1}
 else if(!yes)console.log(JSON.stringify({dryRun:true,restaurantId,name:row.name,current:row.flag===true,next:value,hint:'aggiungi --yes per scrivere'}))
 else{
  const [after]=await sql.begin(tx=>tx`UPDATE restaurants SET settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{dashboardEditor}',${sql.json(value)},true) WHERE id=${restaurantId} RETURNING name,settings->'dashboardEditor' AS flag`)
  console.log(JSON.stringify({restaurantId,name:after.name,dashboardEditor:after.flag===true}))
 }
}finally{await sql.end({timeout:5})}
