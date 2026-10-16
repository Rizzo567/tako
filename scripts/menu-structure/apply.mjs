// Applica plan.mjs ai workspace live: node scripts/menu-structure/apply.mjs --only=<nome,...> [--apply]
// Guardie: nessuna bozza non pubblicata, controlli del motore verdi sui dati freschi, backup privato,
// salvataggio con expectedRevision, rilettura identica, pubblicazione e verifica della revisione pubblicata.
import {readFile} from 'node:fs/promises';import {homedir} from 'node:os'
import {atomic,sessionClient,saveSession,json} from '../translations/common.mjs'
import {plans as basePlans,renamePlans} from './plan.mjs';import {restructure,summary} from './restructure.mjs'
const apply=process.argv.includes('--apply'),plans=process.argv.includes('--plan=rename')?renamePlans:basePlans,only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split('|')
const backups=homedir()+'/.config/tako-webapp/menu-structure-20261014'
const links=JSON.parse(await readFile('docs/webapp/customer-links/links.json','utf8')).filter(r=>(!only||only.includes(r.name))&&plans[r.name])
const api=await sessionClient(),report=[]
const items=w=>new Map(w.menus.flatMap(m=>m.sections.flatMap(s=>s.items)).map(i=>[i.id,JSON.stringify(i)]))
for(const r of links){
 const entry={name:r.name,restaurantId:r.id}
 try{
  await api.call('/api/web-locations/switch',json({restaurantId:r.id}))
  const current=await api.call('/api/menu-workspace')
  if(current.revision!==current.publishedRevision){report.push({...entry,state:'bloccato-bozze-non-pubblicate',revision:current.revision,published:current.publishedRevision});continue}
  const out=restructure(current.data,plans[r.name])
  if(out.errors.length){report.push({...entry,state:'bloccato-controlli',errors:out.errors});continue}
  if(JSON.stringify(out.workspace.menus)===JSON.stringify(current.data.menus)){report.push({...entry,state:'già-a-posto'});continue}
  if(!apply){report.push({...entry,state:'pronto',after:summary(out.workspace),removed:out.removed.length});continue}
  await atomic(`${backups}/${r.id}-before-${Date.now()}.json`,current)
  await api.call('/api/menu-workspace',{...json({expectedRevision:current.revision,workspace:out.workspace}),method:'PUT'})
  const readback=await api.call('/api/menu-workspace'),want=items(out.workspace),got=items(readback.data)
  const same=readback.data.menus.map(m=>m.id+m.name+m.type+m.sections.map(s=>s.id+s.name+(s.parentSectionId||'')).join()).join()===out.workspace.menus.map(m=>m.id+m.name+m.type+m.sections.map(s=>s.id+s.name+(s.parentSectionId||'')).join()).join()
  if(!same||want.size!==got.size||[...want].some(([id,v])=>got.get(id)!==v)){report.push({...entry,state:'errore-rilettura',revision:readback.revision});continue}
  await api.call('/api/menu-workspace/publish',json({expectedRevision:readback.revision}))
  const published=await api.call('/api/menu-workspace')
  report.push({...entry,state:published.revision===published.publishedRevision?'pubblicato':'errore-pubblicazione',revision:published.revision,removed:out.removed.length,after:summary(published.data)})
 }catch(e){report.push({...entry,state:'errore',message:String(e?.message||e).slice(0,300)})}
}
await saveSession(api);await atomic(`${backups}/report-${apply?'apply':'dry'}-${Date.now()}.json`,report)
for(const x of report)console.log(x.state.padEnd(30),x.name,x.errors?JSON.stringify(x.errors):'',x.message||'')
