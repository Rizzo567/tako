// Ripristina l'ultimo backup di apply-ops per un locale.
// Uso: node --experimental-strip-types scripts/menu-fix/rollback.mjs --only=<slug> [--apply] [--backup=<file>] [--out-dir=<dir>] [--qa-links=<file>]
// Dry-run: mostra cosa cambierebbe (menus e campi fuori menus). --apply: backup dello stato attuale (<id>-prerollback-<ts>.json),
// PUT del workspace di backup con expectedRevision, rilettura identica, pubblicazione, verifica.
// Ripristina TUTTO il workspace del backup: modifiche fatte dopo il backup (anche design) vengono perse -> leggere il dry-run.
import {readFile,readdir} from 'node:fs/promises'
import {diffWorkspaces,canonical,parseWorkspace} from './ops-engine.mjs'
import {fixDir,backupDir,defaultOutDir,arg,flag,onlyList,links,requireZodForWrites,openLocation,saveAndPublish,atomic,sessionClient,saveSession} from './live.mjs'

const apply=flag('apply'),slugs=onlyList()
if(slugs.length!==1)throw Error('rollback: un solo slug alla volta')
if(apply)requireZodForWrites()
const slug=slugs[0],link=(await links()).find(r=>r.slug===slug)
if(!link)throw Error(`slug ${slug} non in links.json`)
let file=arg('backup')
if(!file){const names=(await readdir(backupDir).catch(()=>[])).filter(n=>n.startsWith(link.id+'-before-')&&n.endsWith('.json')).sort((a,b)=>Number(b.match(/-before-(\d+)/)[1])-Number(a.match(/-before-(\d+)/)[1]));if(!names.length)throw Error(`nessun backup per ${slug} in ${backupDir}`);file=`${backupDir}/${names[0]}`}
const backup=JSON.parse(await readFile(file,'utf8'))
if(!backup?.data?.menus)throw Error('backup senza data.menus')
const api=await sessionClient(),entry={slug,name:link.name,restaurantId:link.id,mode:apply?'apply':'dry-run',backupFile:file,backupRevision:backup.revision,at:new Date().toISOString()}
try{
 const current=await openLocation(api,link.id)
 Object.assign(entry,{revision:current.revision,publishedRevision:current.publishedRevision})
 const strip=w=>{const c={...w};delete c.menus;return canonical(c)}
 entry.outsideMenusDiffer=strip(current.data)!==strip(backup.data)
 entry.diff=diffWorkspaces(current.data,backup.data)
 if(canonical(current.data)===canonical(backup.data))entry.state='già-uguale-al-backup'
 else if(current.revision!==current.publishedRevision)entry.state='bloccato-bozze-non-pubblicate'
 else if(!apply)entry.state='pronto'
 else{
  await atomic(`${backupDir}/${link.id}-prerollback-${Date.now()}.json`,{...current,slug,savedAt:new Date().toISOString(),reason:'prima del rollback'})
  const r=await saveAndPublish(api,current,backup.data,parseWorkspace(backup.data))
  Object.assign(entry,{state:r.state,revisionAfter:r.revision,publishedRevisionAfter:r.publishedRevision,note:r.note})
 }
}catch(e){entry.state='errore';entry.message=String(e?.message||e).slice(0,400)}
await saveSession(api)
await atomic(`${arg('out-dir')||defaultOutDir()}/applied/${slug}-rollback-${apply?'apply':'dry'}.json`,JSON.stringify(entry,null,1))
const d=entry.diff
console.log(`${slug} -> ${entry.state}${entry.message?': '+entry.message:''}\n backup: ${file} (rev ${backup.revision})\n attuale rev ${entry.revision}/${entry.publishedRevision}`)
if(entry.outsideMenusDiffer)console.log(' ATTENZIONE: anche campi fuori dai menu (design/pdf/lingue) differiscono e verrebbero riportati al backup')
if(d)console.log(` item da ripristinare/eliminare: ${d.removedItems.length} spariscono, ${d.addedItems.length} ritornano, ${d.changedItems.length} cambiano, ${d.movedItems.length} si spostano, ${d.sections.length} sezioni, ${d.menus.length} menu`)
