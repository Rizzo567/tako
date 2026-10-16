import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {workspaceSchema,type Workspace} from '../../apps/server/src/lib/menu-workspace-contract.js'
import {contentHash,completeness,mergeTranslations,ADMIN_OWNER_ID} from './import.js'
import type {Row} from './convert.js'
export function mappedWorkspace(base:Workspace,map:Record<string,string>){
const w=structuredClone(base);
const replace=(url:string|null|undefined)=>{
if(!url)return null;
if(!map[url])throw Error('Private asset mapping missing');
return map[url]
};
for(const key of ['logoUrl','coverUrl','backgroundImageUrl']as const)w.design[key]=replace(w.design[key]);
w.pdf.backgroundImageUrl=replace(w.pdf.backgroundImageUrl);
for(const p of w.pdfPresets)p.config.backgroundImageUrl=replace(p.config.backgroundImageUrl);
for(const m of w.menus)for(const c of m.sections)for(const i of c.items)i.imageUrl=replace(i.imageUrl);
return workspaceSchema.parse(w)
}
export function finalizationState(state:Row,baseline:Workspace,translated:Workspace,publishedHash?:string){
if(Number(state.revision)===1&&contentHash(state.draft)===contentHash(baseline)&&!state.published)return 'save';
if(Number(state.revision)===2&&contentHash(state.draft)===contentHash(translated)&&!state.published)return 'publish';
if(Number(state.revision)===3&&contentHash(state.published)===contentHash(translated)&&contentHash(state.draft)===contentHash(translated)&&(!publishedHash||publishedHash===contentHash(translated)))return 'complete';
throw Error('Finalization refused: target was edited or publication changed')
}
export async function main(args=process.argv.slice(2)){

 const get=(name:string)=>{
const index=args.indexOf(name);
return index<0?undefined:args[index+1]
},execute=args.includes('--execute');
if(execute===args.includes('--plan'))throw Error('Choose exactly --plan or --execute');
const baselinePath=get('--baseline'),translatedPath=get('--translated'),output=get('--output');
if(!baselinePath||!translatedPath||!output)throw Error('Required --baseline converted-v3.json --translated translated.json --output existing-private-import-folder');
const baseline=JSON.parse(await readFile(baselinePath,'utf8')),translation=JSON.parse(await readFile(translatedPath,'utf8'));
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const {loadLocalEnvironment}=await import('../start-webapp.mjs');
Object.assign(process.env,await loadLocalEnvironment(root));
const target=new URL(process.env.DATABASE_URL!);
if(execute&&(get('--expected-host')!==target.hostname||get('--expected-user')!==decodeURIComponent(target.username)))throw Error('Explicit target mismatch');
const require=createRequire(resolve(root,'apps/server/package.json')),{sql}=require('drizzle-orm');
const {db}=await import('../../packages/db/src/index.js');
const prepared:Row[]=[];

 for(const entry of baseline.restaurants){
const receipt=JSON.parse(await readFile(resolve(output,entry.restaurantId+'-result.json'),'utf8'));
const inputHash=contentHash({sourceId:entry.sourceId,workspace:workspaceSchema.parse(entry.workspace)});
if(receipt.sourceId!==entry.sourceId||receipt.inputHash!==inputHash||receipt.restaurantId!==entry.restaurantId)throw Error('Private baseline receipt mismatch');
const rows=await db.execute(sql`SELECT r.settings,w.revision,w.draft,w.published FROM restaurants r JOIN menu_workspaces w ON w.restaurant_id=r.id JOIN web_location_memberships member ON member.restaurant_id=r.id AND member.user_id=${ADMIN_OWNER_ID} AND member.role='owner' WHERE r.id=${entry.restaurantId}`);
const state=rows[0],marker=(state?.settings as any)?.menusmartImport;
if(!state||marker?.sourceId!==entry.sourceId||marker?.inputHash!==inputHash||(state.settings as any)?.customerOrderingEnabled!==false)throw Error('Target ownership/import marker mismatch');
const translated=translation.restaurants.find((r:Row)=>r.sourceId===entry.sourceId&&r.restaurantId===entry.restaurantId);
if(!translated)throw Error('Translated tenant missing');
const original=mappedWorkspace(workspaceSchema.parse(entry.workspace),receipt.assetMapping),final=mergeTranslations(original,workspaceSchema.parse(translated.workspace));
if(completeness(final).length)throw Error('Finalization requires all twelve languages complete');
const action=finalizationState(state,original,final,marker.publishedHash);
prepared.push({entry,receipt,inputHash,original,final,action})
}
 console.log(JSON.stringify({mode:execute?'execute':'plan',tenants:prepared.length,complete:prepared.filter(p=>p.action==='complete').length,orderingEnabled:false}));
if(!execute)return;
const {mutateWorkspace}=await import('../../apps/server/src/lib/menu-workspace-store.js');

 for(const p of prepared){
if(p.action==='complete')continue;let revision=2;
if(p.action==='save')await mutateWorkspace(p.entry.restaurantId,ADMIN_OWNER_ID,1,p.final,false,'Traduzioni MenuSmart complete');
await mutateWorkspace(p.entry.restaurantId,ADMIN_OWNER_ID,revision,p.final,true,'Pubblicazione MenuSmart in dodici lingue');
const publishedHash=contentHash(p.final);
await db.execute(sql`UPDATE restaurants SET settings=jsonb_set(jsonb_set(settings,'{menusmartImport,status}','"complete"'::jsonb),'{menusmartImport,publishedHash}',${JSON.stringify(publishedHash)}::jsonb),updated_at=now() WHERE id=${p.entry.restaurantId}`);
await writeFile(resolve(output,p.entry.restaurantId+'-result.json'),JSON.stringify({...p.receipt,published:true,publishedHash,missingTranslations:[]},null,2),{mode:0o600});
console.log(JSON.stringify({restaurantId:p.entry.restaurantId,result:'published',orderingEnabled:false}))
}
 const exportPath=get('--export');
if(exportPath){
const path=resolve(exportPath);
if(path===root||path.startsWith(root+'/'))throw Error('Private export must remain outside repository');
for(const p of prepared){
const verified=await db.execute(sql`SELECT revision,draft,published FROM menu_workspaces WHERE restaurant_id=${p.entry.restaurantId}`);
if(finalizationState(verified[0],p.original,p.final,contentHash(p.final))!=='complete')throw Error('Export verification failed');
}
 const exportData={...baseline,restaurants:prepared.map(p=>({...p.entry,workspace:p.final})),imported:true,orderingEnabled:false};
await mkdir(dirname(path),{recursive:true,mode:0o700});
await chmod(dirname(path),0o700);
try{
const existing=JSON.parse(await readFile(path,'utf8'));
if(contentHash(existing)!==contentHash(exportData))throw Error('Private export exists with different content')
}catch(e){
if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;
await writeFile(path,JSON.stringify(exportData,null,2),{mode:0o600,flag:'wx'})
}
 console.log(JSON.stringify({exportedRestaurants:prepared.length,verified:true}));
}

}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().then(()=>process.exit(0)).catch(e=>{
console.error(e.message);
process.exit(1)
})
