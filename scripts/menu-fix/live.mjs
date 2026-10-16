// Parti condivise tra apply-ops.mjs e rollback.mjs: percorsi, argomenti, sessione, salvataggio+pubblicazione verificati.
import {readFile} from 'node:fs/promises';import {homedir} from 'node:os';import {fileURLToPath} from 'node:url';import {dirname,resolve} from 'node:path'
import {atomic,client,login,json} from '../translations/common.mjs'
import {zodAvailable,zodLoadError,canonical} from './ops-engine.mjs'
export {atomic,json}
// Sessione PRIVATA per processo: il locale attivo è salvato lato server per token di sessione (web_session_locations),
// quindi condividere il cookie (es. live-translations/session.txt) con altri script/agenti fa sì che uno "switch" altrui
// tra openLocation e la PUT faccia scrivere sul locale sbagliato. Login nuovo a ogni avvio, logout alla fine; mai su file.
export async function sessionClient(){const api=client('');await login(api);return api}
export async function saveSession(api){await api.call('/api/auth/logout',json({})).catch(()=>{})}
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
export const fixDir=root+'/docs/webapp/menu-fix-2026-10-16'
export const backupDir=homedir()+'/.config/tako-webapp/menu-fix-20261016'
export const arg=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)
export const flag=name=>process.argv.includes(`--${name}`)
export const onlyList=()=>{const v=arg('only');if(!v)throw Error('--only=<slug,...> obbligatorio');return v.split(',').map(s=>s.trim()).filter(Boolean)}
export const clientLinksFile=root+'/docs/webapp/customer-links/links.json'
// Locali tecnici di collaudo (mai clienti). Solo questi sono ammessi con --qa-links=<file>.
export const QA_RESTAURANT_IDS=new Set(['26050ecd-2e55-4057-a4c5-bff2b449cd47'/* Tako · Verifica web */])
export const qaMode=()=>arg('qa-links')!==undefined
// Report di default: clienti -> docs/webapp/menu-fix-2026-10-16; QA -> cartella privata, mai dentro i report clienti.
export const defaultOutDir=()=>qaMode()?backupDir+'/qa-runs':fixDir
// Senza --qa-links: i 21 locali clienti di links.json (comportamento invariato).
// Con --qa-links=<file>: SOLO quel file, che deve contenere esattamente 1 locale, presente in QA_RESTAURANT_IDS e assente da links.json clienti.
export async function links(){
 const clients=JSON.parse(await readFile(clientLinksFile,'utf8'))
 if(!qaMode())return clients
 const file=arg('qa-links');if(!file)throw Error('--qa-links=<file> vuoto')
 const list=JSON.parse(await readFile(file,'utf8'))
 if(!Array.isArray(list)||list.length!==1)throw Error('--qa-links: il file deve contenere esattamente 1 locale QA')
 const [r]=list
 if(!r||typeof r.slug!=='string'||!r.slug||!QA_RESTAURANT_IDS.has(r.id))throw Error(`--qa-links: ${r?.id} non è un locale QA ammesso (${[...QA_RESTAURANT_IDS].join(', ')})`)
 if(clients.some(c=>c.id===r.id||c.slug===r.slug))throw Error(`--qa-links: ${r.slug} è tra i locali clienti: vietato`)
 return list
}
export function requireZodForWrites(){if(!zodAvailable())throw Error(`scrittura rifiutata: validazione zod non caricata (${zodLoadError()}). Lancia con: node --experimental-strip-types`)}

async function assertActive(api,restaurantId){
 const me=await api.call('/api/auth/me'),active=me?.data?.restaurantId??me?.restaurantId??me?.user?.restaurantId
 if(active!==restaurantId)throw Error(`sessione su ${active}, atteso ${restaurantId}: interrotto`)
}
export async function openLocation(api,restaurantId){
 await api.call('/api/web-locations/switch',json({restaurantId}))
 await assertActive(api,restaurantId);api.restaurantId=restaurantId
 const w=await api.call('/api/menu-workspace')
 await assertActive(api,restaurantId)
 return w
}

const menusKey=w=>canonical(w.menus)
// PUT con expectedRevision -> rilettura identica (menus canonici) -> publish -> verifica revisione pubblicata e dati pubblicati.
export async function saveAndPublish(api,current,workspace,expected){
 if(!api.restaurantId)throw Error('saveAndPublish senza openLocation')
 await assertActive(api,api.restaurantId)
 const put=await api.call('/api/menu-workspace',{...json({expectedRevision:current.revision,workspace}),method:'PUT'})
 const readback=await api.call('/api/menu-workspace')
 if(menusKey(readback.data)!==menusKey(expected))return {state:'errore-rilettura',revision:readback.revision,putRevision:put?.revision??null,note:'salvato in bozza ma diverso dall’atteso: NON pubblicato'}
 if(readback.revision===current.revision)return {state:'errore-rilettura',revision:readback.revision,note:'revisione invariata dopo PUT'}
 await assertActive(api,api.restaurantId)
 await api.call('/api/menu-workspace/publish',json({expectedRevision:readback.revision}))
 const published=await api.call('/api/menu-workspace')
 const ok=published.revision===published.publishedRevision&&menusKey(published.data)===menusKey(expected)
 return {state:ok?'pubblicato':'errore-pubblicazione',revision:published.revision,publishedRevision:published.publishedRevision,data:published.data}
}
