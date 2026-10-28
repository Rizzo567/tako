// R10 (18/10): sola lettura del QA — turni del cervello 16:00–16:10 UTC, proposta, menu attuale (fixture della batteria R10).
import {readFile,writeFile} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..'),require=createRequire(resolve(repo,'package.json')),postgres=require('postgres')
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
const env=await loadLocalEnvironment(repo),dbUrl=new URL(env.DATABASE_URL);dbUrl.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(dbUrl.toString(),{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const out=await db.begin('read only',async tx=>{
 const [link]=await tx`SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${QA} ORDER BY created_at DESC LIMIT 1`;const P=link.phone
 const turns=await tx`SELECT role,body,created_at FROM tako_owner_brain_turns WHERE phone=${P} AND created_at>='2026-10-18T15:55:00Z' ORDER BY created_at`
 const prop=await tx`SELECT command,revision,expires_at FROM tako_whatsapp_proposals WHERE phone=${P}`
 const [w]=await tx`SELECT published,draft,revision,published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`
 const vers=await tx`SELECT revision,created_at FROM menu_workspace_versions WHERE restaurant_id=${QA} AND created_at>='2026-10-18T15:55:00Z' ORDER BY revision`.catch(()=>[])
 const errs=await tx`SELECT count(*)::int n FROM tako_whatsapp_errors`
 return {turns,prop,rev:w.revision,prev:w.published_revision,published:w.published,vers,errs:errs[0].n}})
await writeFile(process.argv[2],JSON.stringify(out,null,1));await db.end()
