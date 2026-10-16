// Checks (default) or applies (--apply) generated translations restaurant by restaurant.
// Only complete restaurants are written; only missing translation fields are filled (existing/manual texts win).
// Guards: revision unchanged since snapshot, no unpublished drafts, non-translation content identical, completeness
// before save, after readback and after publish. Private backup before each write.
// Usage: node scripts/translations/publish-live.mjs [--apply] [--only=<restaurantId,...>]
import {readFile} from 'node:fs/promises';import {dir,atomic,sessionClient,saveSession,json,entities,foodKeyList,missing,strip,targetLanguages} from './common.mjs';
import {qualityIssue} from './quality.mjs';
const repairable=(l,source,old)=>!!old?.name?.trim()&&old.approved!==true&&!!old.sourceFingerprint&&!!qualityIssue(l,source,old);
const apply=process.argv.includes('--apply'),only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',').filter(Boolean);
const data=JSON.parse(await readFile(dir+'/translated.json','utf8'));const report=[];let api;
const source=e=>JSON.stringify([e.name,e.description||'']);
const src=e=>({name:e.name,...(e.description?.trim()?{description:e.description}:{})});
for(const row of data.restaurants){
 if(only&&!only.includes(row.restaurantId))continue;
 const baseline=JSON.parse(await readFile(dir+'/'+row.restaurantId+'-before.json','utf8'));const foodKeys=foodKeyList(baseline.presentation?.foodCatalogs??{});
 const gaps=missing(row.workspace,foodKeys);const entry={name:row.name,restaurantId:row.restaurantId,missing:gaps.length};
 // Quality of the full translated workspace (existing live texts are reported, never modified here).
 const baseById=new Map(entities(baseline.data).map(e=>[e.id,e]));let generated=0,generatedIssues=0,liveIssues=0,identicalNames=0;const issueSamples=[];
 for(const e of entities(row.workspace))for(const l of targetLanguages(row.workspace)){const v=e.translations[l];if(!v?.name)continue;const before=baseById.get(e.id)?.translations?.[l];const isLive=!!before?.name?.trim()&&(!e.description?.trim()||!!before.description?.trim());const issue=qualityIssue(l,src(e),v);if(v.name===e.name)identicalNames++;if(isLive&&JSON.stringify(v)===JSON.stringify(before)){if(issue)liveIssues++;continue}generated++;if(issue){generatedIssues++;if(issueSamples.length<5)issueSamples.push({id:e.id,l,issue})}}
 Object.assign(entry,{generatedFields:generated,generatedIssues,liveIssues,identicalNames,issueSamples});
 if(gaps.length){report.push({...entry,state:'pending'});continue}
 if(generatedIssues){report.push({...entry,state:'blocked-quality'});continue}
 api??=await sessionClient();
 await api.call('/api/web-locations/switch',json({restaurantId:row.restaurantId}));const current=await api.call('/api/menu-workspace');
 if(current.revision!==current.publishedRevision){report.push({...entry,state:'blocked-unpublished-drafts',revision:current.revision,publishedRevision:current.publishedRevision});continue}
 if(current.revision!==baseline.revision||strip(current.data)!==strip(baseline.data)){report.push({...entry,state:'blocked-source-changed',snapshotRevision:baseline.revision,liveRevision:current.revision});continue}
 const target=structuredClone(current.data),translated=new Map(entities(row.workspace).map(e=>[e.id,e]));let changed=0,repaired=0,blocked;
 for(const e of entities(target)){const incoming=translated.get(e.id);if(!incoming||source(e)!==source(incoming)){blocked='blocked-source-changed';break}
  for(const l of targetLanguages(target)){const old=e.translations[l],value=incoming.translations[l];if(repairable(l,src(e),old)&&value?.name?.trim()&&!qualityIssue(l,src(e),value)){e.translations[l]={...old,...value};changed++;repaired++;continue}if(!old?.name?.trim()||(e.description?.trim()&&!old?.description?.trim())){e.translations[l]={...value,...old,name:old?.name?.trim()?old.name:value.name,...(e.description?.trim()?{description:old?.description?.trim()?old.description:value.description}:{})};changed++}}}
 if(blocked){report.push({...entry,state:blocked});continue}
 const liveFood=current.data.foodTranslations||{};target.foodTranslations={};for(const l of new Set([...Object.keys(row.workspace.foodTranslations||{}),...Object.keys(liveFood)]))target.foodTranslations[l]={...row.workspace.foodTranslations?.[l],...Object.fromEntries(Object.entries(liveFood[l]||{}).filter(([,v])=>v?.trim()))};
 if(JSON.stringify(target.foodTranslations)!==JSON.stringify(liveFood))changed++;
 if(missing(target,foodKeys).length){report.push({...entry,state:'blocked-completeness'});continue}
 if(strip(target)!==strip(baseline.data)){report.push({...entry,state:'blocked-non-translation-diff'});continue}
 if(!changed){report.push({...entry,state:'already-complete',changed});continue}
 if(!apply){report.push({...entry,state:'ready',changed,repaired});continue}
 await atomic(dir+'/backups/'+row.restaurantId+'-pre-publish-'+Date.now()+'.json',current);
 await api.call('/api/menu-workspace',{...json({expectedRevision:current.revision,workspace:target}),method:'PUT'});
 const readback=await api.call('/api/menu-workspace');if(missing(readback.data,foodKeys).length||strip(readback.data)!==strip(baseline.data)){report.push({...entry,state:'error-readback',revision:readback.revision});break}
 await api.call('/api/menu-workspace/publish',json({expectedRevision:readback.revision}));
 const published=await api.call('/api/menu-workspace');if(published.revision!==published.publishedRevision||missing(published.data,foodKeys).length){report.push({...entry,state:'error-publish-verification'});break}
 report.push({...entry,state:'published',changed,repaired,revision:published.revision});
 await atomic(dir+'/publication-status.json',{at:new Date().toISOString(),apply,partial:true,report});
}
if(api)await saveSession(api);
await atomic(dir+'/publication-status.json',{at:new Date().toISOString(),apply,report});
for(const r of report)console.log(JSON.stringify({name:r.name,state:r.state,missing:r.missing,changed:r.changed,generatedIssues:r.generatedIssues,liveIssues:r.liveIssues}));
console.log(JSON.stringify({apply,published:report.filter(r=>r.state==='published').length,ready:report.filter(r=>r.state==='ready').length,pending:report.filter(r=>r.state==='pending').length,blocked:report.filter(r=>r.state.startsWith('blocked')).map(r=>r.name+':'+r.state),missing:report.reduce((n,r)=>n+r.missing,0)}));
