// Pulizia dati UNA TANTUM (22/10/2026 notte, approvata da Manuel): «per i piatti non esiste più nascondere» → i piatti con hidden:true
// si ELIMINANO, SOLO in Victoria Bar (528e263c) e nel QA (26050ecd). Gli altri locali non si toccano.
// Stesse primitive del bot: applyBotChange (pubblicato + bozza, versioni salvate = annullabile da «versioni» in dashboard), azioni
// {kind:'delete'} sul pubblicato; se la bozza ha modifiche in attesa, la bozza perde i suoi piatti nascosti con la trasformazione `draft`.
// MAI SQL grezzo sui JSON (la sola lettura iniziale è una SELECT).
// Uso:  tsx scripts/victoria/hidden-cleanup-1022.ts --plan    [--only victoria|qa]
//       tsx scripts/victoria/hidden-cleanup-1022.ts --execute [--only victoria|qa] --expected-host H
// --plan: copia completa dei due workspace in ~/.config/tako-webapp/rollback-edge-20261022/victoria-qa-before-hidden-cleanup-<ts>.json
//         + elenco dei piatti nascosti. --execute: rifà il piano (stessa revisione), pubblica, verifica (0 nascosti, resto identico).
import {writeFile,mkdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {homedir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {workspaceSchema,type Workspace} from '../../apps/server/src/lib/menu-workspace-contract.js'

export const TENANTS={victoria:'528e263c-634e-4695-9632-6c5cc6a3302f',qa:'26050ecd-2e55-4057-a4c5-bff2b449cd47'} as const
type Hidden={id:string,menu:string,section:string,name:string}
export const hiddenOf=(w:Workspace):Hidden[]=>w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.filter(i=>i.hidden).map(i=>({id:i.id,menu:m.name,section:s.name,name:i.name}))))
/** Il documento senza i piatti nascosti (tutto il resto identico, ordine compreso). */
export const withoutHidden=(w:Workspace):Workspace=>{const n=structuredClone(w);for(const m of n.menus)for(const s of m.sections)s.items=s.items.filter(i=>!i.hidden);return n}

async function main(args=process.argv.slice(2)){
 const get=(n:string)=>{const i=args.indexOf(n);return i<0?undefined:args[i+1]},execute=args.includes('--execute')
 if(execute===args.includes('--plan'))throw Error('Uso: --plan | --execute')
 const only=get('--only'),targets=Object.entries(TENANTS).filter(([k])=>!only||k===only)
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');const {loadLocalEnvironment}=await import('../start-webapp.mjs');Object.assign(process.env,await loadLocalEnvironment(root))
 const require=createRequire(resolve(root,'apps/server/package.json')),{sql}=require('drizzle-orm');const {db}=await import('../../packages/db/src/index.js')
 const rows:Record<string,any>={}
 for(const [k,id] of targets){const r=(await db.execute(sql`SELECT restaurant_id,revision,published_revision,draft,published,updated_at FROM menu_workspaces WHERE restaurant_id=${id}`))[0] as any;if(!r?.published)throw Error(k+': nessun pubblicato');rows[k]=r}
 const dir=resolve(homedir(),'.config/tako-webapp/rollback-edge-20261022');await mkdir(dir,{recursive:true,mode:0o700})
 const ts=new Date().toISOString().replace(/[:.]/g,'-'),backup=resolve(dir,`victoria-qa-before-hidden-cleanup-${ts}.json`)
 await writeFile(backup,JSON.stringify({at:new Date().toISOString(),rows},null,1),{mode:0o600})
 const plan=Object.fromEntries(targets.map(([k])=>{const r=rows[k],pub=workspaceSchema.parse(r.published),dr=workspaceSchema.parse(r.draft);return[k,{revision:Number(r.revision),publishedRevision:Number(r.published_revision),draftPending:JSON.stringify(r.draft)!==JSON.stringify(r.published),published:hiddenOf(pub),draftOnly:hiddenOf(dr).filter(h=>!hiddenOf(pub).some(x=>x.id===h.id))}]}))
 if(!execute){console.log(JSON.stringify({mode:'plan',backup,plan},null,1));process.exit(0)}
 const target=new URL(process.env.DATABASE_URL!);if(get('--expected-host')!==target.hostname)throw Error('Host di destinazione non confermato')
 const {applyBotChange}=await import('../../apps/server/src/lib/menu-workspace-bot.js')
 const out:Record<string,any>={}
 for(const [k,id] of targets){const r=rows[k],p=plan[k]!,pub=workspaceSchema.parse(r.published)
  if(!p.published.length&&!p.draftOnly.length){out[k]={skipped:'nessun piatto nascosto'};continue}
  // attore della versione: il titolare (membership) o, nel QA senza membership, l'attore del bot collegato al locale
  const owner=((await db.execute(sql`SELECT user_id FROM web_location_memberships WHERE restaurant_id=${id} ORDER BY created_at LIMIT 1`))[0] as any)??((await db.execute(sql`SELECT actor_id AS user_id FROM tako_whatsapp_links WHERE restaurant_id=${id} ORDER BY created_at LIMIT 1`))[0] as any)
  if(!owner?.user_id)throw Error(k+': nessun titolare per la versione')
  const saved=await applyBotChange(id,String(owner.user_id),['Pulizia 22/10: piatti nascosti eliminati (bozza)','Pulizia 22/10: piatti nascosti eliminati'],
   {expectedPublishedRevision:p.publishedRevision,actions:p.published.map(h=>({kind:'delete',id:h.id}) as any),draft:d=>withoutHidden(d)})
  // verifica: 0 nascosti in pubblicato e bozza; il pubblicato è esattamente quello di prima meno i nascosti
  const a=(await db.execute(sql`SELECT revision,published_revision,draft,published FROM menu_workspaces WHERE restaurant_id=${id}`))[0] as any
  const pa=workspaceSchema.parse(a.published),da=workspaceSchema.parse(a.draft),expect=withoutHidden(pub)
  const strip=(w:Workspace)=>JSON.stringify(w.menus.map(m=>({...m,sections:m.sections.map(s=>({...s,items:s.items.map(i=>({...i,available:undefined}))}))})))
  out[k]={revisionBefore:p.revision,saved,after:{revision:Number(a.revision),publishedRevision:Number(a.published_revision)},deleted:p.published.map(h=>`${h.menu} › ${h.section} › ${h.name}`),draftOnlyDeleted:p.draftOnly.map(h=>`${h.menu} › ${h.section} › ${h.name}`),
   hiddenLeftPublished:hiddenOf(pa).length,hiddenLeftDraft:hiddenOf(da).length,restIdentical:strip(pa)===strip(expect),availabilityChanged:JSON.stringify(pa)!==JSON.stringify(expect)&&strip(pa)===strip(expect)}}
 await writeFile(resolve(dir,`hidden-cleanup-executed-${ts}.json`),JSON.stringify({backup,out},null,1),{mode:0o600})
 console.log(JSON.stringify({mode:'execute',backup,out},null,1));process.exit(0)}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))main().catch(e=>{console.error(String(e?.stack??e));process.exit(1)})
