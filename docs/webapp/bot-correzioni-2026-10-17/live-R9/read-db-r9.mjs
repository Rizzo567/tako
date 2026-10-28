// R9 (18/10): sola lettura del QA — turni del cervello, messaggi, proposta, menu attuale (per la riproduzione).
import {readFile,writeFile} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..'),require=createRequire(resolve(repo,'package.json')),postgres=require('postgres')
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
const env=await loadLocalEnvironment(repo),dbUrl=new URL(env.DATABASE_URL);dbUrl.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(dbUrl.toString(),{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const out=await db.begin('read only',async tx=>{
 const [link]=await tx`SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${QA} ORDER BY created_at DESC LIMIT 1`;const P=link.phone
 const turns=await tx`SELECT role,body,created_at FROM tako_owner_brain_turns WHERE phone=${P} AND created_at>='2026-10-18T12:00:00Z' ORDER BY created_at`
 const cols=await tx`SELECT table_name,column_name FROM information_schema.columns WHERE table_name in ('tako_whatsapp_messages','tako_whatsapp_proposals')`
 const msgs=await tx`SELECT sid,response,created_at FROM tako_whatsapp_messages WHERE created_at>='2026-10-18T12:25:00Z' AND created_at<'2026-10-18T12:40:00Z' ORDER BY created_at`
 const prop=await tx`SELECT * FROM tako_whatsapp_proposals WHERE phone=${P}`
 const [w]=await tx`SELECT published,revision FROM menu_workspaces WHERE restaurant_id=${QA}`
 return {turns,cols:cols.map(c=>c.table_name+'.'+c.column_name),msgs,prop:prop.map(r=>({...r,phone:undefined})),rev:w.revision,published:w.published}})
await writeFile(process.argv[2],JSON.stringify(out,null,1));await db.end()
