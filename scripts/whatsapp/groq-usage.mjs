// Uso Groq del bot WhatsApp: oggi e ultimi 7 giorni (fuso Europe/Rome), con percentuali sui limiti del piano gratuito. Solo lettura.
// node scripts/whatsapp/groq-usage.mjs
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'
import {loadLocalEnvironment} from '../start-webapp.mjs'
const root=path.resolve(new URL('../../',import.meta.url).pathname),env=await loadLocalEnvironment(root)
const limits={'openai/gpt-oss-120b':{rpd:1000,tpd:200000},'openai/gpt-oss-20b':{rpd:1000,tpd:200000},'whisper-large-v3-turbo':{rpd:2000,asd:28800}}
const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const url=new URL(env.DATABASE_URL);url.searchParams.delete('sslmode')
const db=postgres(url.toString(),{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(new Date())
try{
 const rows=await db.begin('read only',tx=>tx`SELECT day::text,model,requests,prompt_tokens::int,completion_tokens::int,rate_limited,audio_seconds::float,warned_at FROM tako_whatsapp_ai_usage WHERE day>=${today}::date-6 ORDER BY day DESC,model`)
 const pct=(v,l)=>l?` (${Math.round(v/l*100)}%)`:''
 console.log(`Oggi ${today}`)
 for(const r of rows.filter(r=>r.day===today)){const l=limits[r.model]??{},tokens=r.prompt_tokens+r.completion_tokens;console.log(`  ${r.model.padEnd(24)} richieste ${r.requests}${pct(r.requests,l.rpd)} · token ${tokens}${pct(tokens,l.tpd)} (prompt ${r.prompt_tokens}, risposta ${r.completion_tokens}) · 429 ${r.rate_limited}${r.audio_seconds?` · audio ${Math.round(r.audio_seconds)} s${pct(r.audio_seconds,l.asd)}`:''}${r.warned_at?' · avviso inviato':''}`)}
 if(!rows.some(r=>r.day===today))console.log('  nessun uso')
 console.log('\nUltimi 7 giorni')
 for(const r of rows){const tokens=r.prompt_tokens+r.completion_tokens;console.log(`  ${r.day} ${r.model.padEnd(24)} richieste ${String(r.requests).padStart(4)} · token ${String(tokens).padStart(7)} · media ${r.requests?Math.round(tokens/r.requests):0}/richiesta · 429 ${r.rate_limited}${r.audio_seconds?` · audio ${Math.round(r.audio_seconds)} s`:''}`)}
}finally{await db.end()}
