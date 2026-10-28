// R7b (18/10): numero di Manuel da MANUEL_WA (mai nel file); senza, conta i link di Victoria.
// stato in sola lettura prima/dopo la prova live: cervello acceso per locale, errori, link di Victoria (mai stampato il numero), versioni menu di Victoria.
import {readFile} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {createHash} from 'node:crypto'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..'),postgres=createRequire(resolve(repo,'package.json'))('postgres')
const env=await loadLocalEnvironment(repo),u=new URL(env.DATABASE_URL);u.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(u.toString(),{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const V='528e263c-634e-4695-9632-6c5cc6a3302f',M=process.env.MANUEL_WA||''
await db.begin('read only',async tx=>{
 const on=await tx`SELECT id,name FROM restaurants WHERE (settings->>'botBrain')='true'`
 const [e]=await tx`SELECT count(*)::int n FROM tako_whatsapp_errors`
 const links=M?await tx`SELECT restaurant_id FROM tako_whatsapp_links WHERE phone=${M}`:await tx`SELECT restaurant_id FROM tako_whatsapp_links WHERE restaurant_id=${V}`
 const [w]=await tx`SELECT revision,published_revision,md5(draft::text) d,md5(published::text) p FROM menu_workspaces WHERE restaurant_id=${V}`
 const qa=await tx`SELECT count(*)::int n FROM tako_whatsapp_links WHERE restaurant_id='26050ecd-2e55-4057-a4c5-bff2b449cd47'`
 console.log(JSON.stringify({brainOn:on,errors:e.n,manuelLinks:links.map(l=>l.restaurant_id===V?'Victoria':l.restaurant_id),victoria:{rev:w?.revision,pub:w?.published_revision,hash:createHash('sha256').update((w?.d||'')+(w?.p||'')).digest('hex').slice(0,16)},qaLinks:qa[0].n}))})
await db.end()
