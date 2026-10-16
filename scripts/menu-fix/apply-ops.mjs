// Applica docs/webapp/menu-fix-2026-10-16/ops/<slug>.json ai workspace live.
// Uso: node --experimental-strip-types scripts/menu-fix/apply-ops.mjs --only=<slug,...> [--apply] [--ops-dir=<dir>] [--out-dir=<dir>]
// Collaudo: --qa-links=scripts/menu-fix/qa/qa-links.json (ops da scripts/menu-fix/qa/ops; solo il locale QA; report in ~/.config/tako-webapp/menu-fix-20261016/qa-runs)
// Senza --apply: dry-run (solo GET), scrive <out-dir>/dryrun/<slug>.json. Con --apply: backup privato, PUT con expectedRevision,
// rilettura identica, pubblicazione, verifica revisione pubblicata, report <out-dir>/applied/<slug>.json.
// Un locale alla volta; errore in un locale = stop di quel locale e passa al successivo. Blocca se ci sono bozze non pubblicate.
import {readFile} from 'node:fs/promises'
import {applyOps,diffWorkspaces,countOps,parseWorkspace,zodAvailable} from './ops-engine.mjs'
import {root,fixDir,backupDir,defaultOutDir,qaMode,arg,flag,onlyList,links,requireZodForWrites,openLocation,saveAndPublish,atomic,sessionClient,saveSession} from './live.mjs'

const apply=flag('apply'),slugs=onlyList(),opsDir=arg('ops-dir')||(qaMode()?root+'/scripts/menu-fix/qa/ops':fixDir+'/ops'),outDir=arg('out-dir')||defaultOutDir()
if(apply)requireZodForWrites()
const all=await links(),api=await sessionClient(),summary=[]

for(const slug of slugs){
 const entry={slug,mode:apply?'apply':'dry-run',at:new Date().toISOString()}
 const out=apply?`${outDir}/applied/${slug}.json`:`${outDir}/dryrun/${slug}.json`
 try{
  const file=JSON.parse(await readFile(`${opsDir}/${slug}.json`,'utf8'))
  const link=all.find(r=>r.slug===slug)
  if(!link)throw Error(`slug ${slug} non in ${qaMode()?'--qa-links':'customer-links/links.json'}`)
  if(file.slug&&file.slug!==slug)throw Error(`file ops con slug ${file.slug} diverso da ${slug}`)
  if(file.restaurantId!==link.id)throw Error(`restaurantId del file ops (${file.restaurantId}) diverso da links.json (${link.id})`)
  Object.assign(entry,{name:link.name,restaurantId:link.id,opsFile:`${opsDir}/${slug}.json`,opCount:file.ops?.length??0,opsByType:countOps(file.ops||[]),skipped:file.skipped?.length??0})
  const current=await openLocation(api,link.id)
  Object.assign(entry,{revision:current.revision,publishedRevision:current.publishedRevision})
  if(current.revision!==current.publishedRevision){entry.state='bloccato-bozze-non-pubblicate';throw null}
  const allergenIds=Array.isArray(current.presentation?.foodCatalogs?.allergens)?current.presentation.foodCatalogs.allergens.map(a=>a.id).filter(Boolean):undefined
  const res=applyOps(current.data,file.ops,{allergenIds})
  Object.assign(entry,{errors:res.errors,warnings:res.warnings,log:res.log.map(l=>`${l.ok?'ok ':'ERR'} #${l.index} ${l.op}: ${l.text}`),temps:res.temps,diff:diffWorkspaces(current.data,res.workspace)})
  if(res.errors.length){entry.state='bloccato-errori-ops';throw null}
  if(!zodAvailable())entry.warnings.push('dry-run senza zod: --apply la richiederà')
  if(!apply){entry.state='pronto';throw null}
  const backup=`${backupDir}/${link.id}-before-${Date.now()}.json`
  await atomic(backup,{...current,slug,savedAt:new Date().toISOString(),reason:'menu-fix-2026-10-16 apply-ops'});entry.backup=backup
  const r=await saveAndPublish(api,current,res.workspace,parseWorkspace(res.workspace))
  Object.assign(entry,{state:r.state,revisionAfter:r.revision,publishedRevisionAfter:r.publishedRevision,note:r.note})
 }catch(e){if(e!==null){entry.state='errore';entry.message=String(e?.message||e).slice(0,400)+(entry.backup?' (backup presente: valuta rollback.mjs)':'')}}
 await atomic(out,JSON.stringify(entry,null,1))
 summary.push(entry)
 const d=entry.diff
 console.log(`\n== ${slug} (${entry.name??'?'}) -> ${entry.state}${entry.message?': '+entry.message:''}`)
 if(entry.opsByType)console.log('   op:',JSON.stringify(entry.opsByType),'skipped:',entry.skipped,'rev:',entry.revision,'/',entry.publishedRevision)
 for(const x of entry.errors||[])console.log('   ERRORE',x.index>=0?`op #${x.index} ${x.op}`:x.op,'-',x.message)
 for(const x of entry.warnings||[])console.log('   avviso',x)
 if(d){for(const x of d.removedItems)console.log(`   - ${x.name} (${x.price}) [${x.menu} / ${x.section}]`)
  for(const x of d.addedItems)console.log(`   + ${x.name} (${x.price}) [${x.menu} / ${x.section}]`)
  const ch=c=>Object.entries(c).map(([k,v])=>`${k}: ${JSON.stringify(v[0])} -> ${JSON.stringify(v[1])}`).join('; ')
  for(const x of d.changedItems)console.log(`   ~ ${x.item} [${x.section}]`,ch(x.changes))
  for(const x of d.movedItems)console.log(`   > ${x.name}: ${x.from} -> ${x.to}`)
  for(const x of d.menus)console.log(`   # menu ${x.change} "${x.menu}"`,ch(x.changes))
  for(const x of d.sections)console.log(`   # sezione ${x.change} "${x.section}"`,ch(x.changes))}
 console.log('   report:',out)
}
await saveSession(api)
console.log('\nRiepilogo:');for(const x of summary)console.log(' ',x.state.padEnd(30),x.slug)
