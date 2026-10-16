// Guasti del bot WhatsApp (tabella tako_whatsapp_errors) e stato dell'avviso a Manuel. Solo lettura.
// node scripts/whatsapp/errors.mjs [giorni=7]
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'
import {loadLocalEnvironment} from '../start-webapp.mjs'
const root=path.resolve(new URL('../../',import.meta.url).pathname),env=await loadLocalEnvironment(root)
const days=Math.max(1,Math.min(90,Number(process.argv[2])||7))
const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const url=new URL(env.DATABASE_URL);url.searchParams.delete('sslmode')
const db=postgres(url.toString(),{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const when=d=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',dateStyle:'short',timeStyle:'medium'}).format(d)
try{
 const [rows,byKind,alert]=await db.begin('read only',async tx=>[
  await tx`SELECT e.created_at,e.kind,r.name,e.phone_tail,e.detail,e.alerted FROM tako_whatsapp_errors e LEFT JOIN restaurants r ON r.id=e.restaurant_id WHERE e.created_at>now()-make_interval(days=>${days}) ORDER BY e.created_at DESC LIMIT 200`,
  await tx`SELECT kind,count(*)::int n,max(created_at) last FROM tako_whatsapp_errors WHERE created_at>now()-make_interval(days=>${days}) GROUP BY kind ORDER BY n DESC`,
  await tx`SELECT last_sent_at FROM tako_whatsapp_alerts WHERE channel='guasti'`])
 console.log(`Ultimo avviso a Manuel: ${alert[0]?when(alert[0].last_sent_at):'mai'}${alert[0]&&Date.now()-alert[0].last_sent_at.getTime()<3600000?' (prossimo possibile tra '+Math.ceil((3600000-(Date.now()-alert[0].last_sent_at.getTime()))/60000)+' min)':''}`)
 console.log(`\nErrori negli ultimi ${days} giorni: ${rows.length}${rows.length===200?'+':''}`)
 for(const k of byKind)console.log(`  ${k.kind.padEnd(22)} ${String(k.n).padStart(4)} · ultimo ${when(k.last)}`)
 if(rows.length)console.log('\nUltimi errori')
 for(const r of rows.slice(0,50))console.log(`  ${when(r.created_at)}  ${r.kind.padEnd(20)} ${(r.name??'—').slice(0,24).padEnd(24)} ${r.phone_tail?'…'+r.phone_tail:'    '}  ${r.alerted?'[avviso] ':''}${r.detail??''}`)
}finally{await db.end()}
