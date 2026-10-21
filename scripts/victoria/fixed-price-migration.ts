// Migrazione di Victoria (528e263c) al Menu «a prezzo fisso» (21/10/2026, via di Manuel). Stesso formato che produce la dashboard:
// menu.pricing='fisso', menu.formulas[{id,name,price,note,sectionIds,translations}], menu.included (+ translations[lang].included).
// Oggi è un trucco: sottomenu COMPLETO/PRIMO/SECONDO con il prezzo nella descrizione, zero piatti, e Sezioni figlie (Primi, Secondi,
// Contorni) ripetute sotto ogni opzione. Qui: i figli diventano Sottomenu UNA volta (deduplicati per nome, i dati mancanti presi dai
// doppioni, nessun piatto distinto perso), le opzioni diventano formule con i Sottomenu compresi.
// Uso:  tsx scripts/victoria/fixed-price-migration.ts --plan  --out <cartella>
//       tsx scripts/victoria/fixed-price-migration.ts --execute --out <cartella> --expected-revision N --expected-host H
// --plan legge e basta (backup + migrato + rapporto). --execute pubblica con mutateWorkspace SOLO se la revisione è quella del piano.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {randomUUID,createHash} from 'node:crypto'
import {workspaceSchema,type Workspace} from '../../apps/server/src/lib/menu-workspace-contract.js'

export const VICTORIA='528e263c-634e-4695-9632-6c5cc6a3302f'
const plain=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const NAMES:Record<string,string>={completo:'Completo',primo:'Solo primo',secondo:'Solo secondo'}
const PRICE=/^\s*(?:€\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\w*)?\s*[·•\-–:]\s*/i
export function splitDescription(d:string){const m=d.match(PRICE);if(!m)return null;const price=Number(m[1]!.replace(',','.')),rest=d.slice(m[0].length).trim()
 const parts=rest.split(/(?<=[.!])\s+/).map(x=>x.trim()).filter(Boolean),note=(parts[0]??'').replace(/[.]\s*$/,''),included=parts.slice(1).join(' ').replace(/[.]\s*$/,'')
 return{price,note:note||null,included:included||null}}
const isTrick=(s:any)=>!s.parentSectionId&&s.items.length===0&&typeof s.description==='string'&&!!splitDescription(s.description)

export function migrateMenu(menu:any):{menu:any,report:any}|null{
 const tricks=menu.sections.filter(isTrick);if(!tricks.length)return null
 const canon=new Map<string,any>(),kept:any[]=[],dupItems:{id:string,name:string,into:string}[]=[],added:string[]=[]
 const childrenOf=(t:any)=>menu.sections.filter((s:any)=>s.parentSectionId===t.id)
 for(const t of tricks)for(const c of childrenOf(t)){const k=plain(c.name);let target=canon.get(k)
  if(!target){target={...structuredClone(c),parentSectionId:null};canon.set(k,target);kept.push(target);continue}
  for(const it of c.items){const same=target.items.find((x:any)=>plain(x.name)===plain(it.name))
   if(same){for(const f of ['imageUrl','description'])if(!same[f]&&it[f])same[f]=it[f];if(!(same.allergens?.length)&&it.allergens?.length)same.allergens=it.allergens
    for(const [lang,tr] of Object.entries(it.translations??{}))if(!same.translations?.[lang])(same.translations??={})[lang]=tr;dupItems.push({id:it.id,name:it.name,into:same.id})}
   else{target.items.push(structuredClone(it));added.push(it.name)}}}
 const included=tricks.map((t:any)=>splitDescription(t.description)!.included).find(Boolean)??null
 const formulas=tricks.map((t:any)=>{const p=splitDescription(t.description)!,name=NAMES[plain(t.name)]??(t.name.charAt(0)+t.name.slice(1).toLowerCase())
  const translations:Record<string,{name:string,description?:string}>={}
  for(const [lang,tr] of Object.entries<any>(t.translations??{})){const sd=typeof tr?.description==='string'?splitDescription(tr.description)??{note:tr.description.replace(/^[^·]*·\s*/,'').split(/(?<=[.!])\s+/)[0]?.replace(/[.]\s*$/,''),included:null}:null
   if(tr?.name)translations[lang]={name:String(tr.name).charAt(0).toUpperCase()+String(tr.name).slice(1).toLowerCase(),...(sd?.note?{description:sd.note}:{})}}
  return{id:randomUUID(),name,price:p.price,note:p.note,sectionIds:childrenOf(t).map((c:any)=>canon.get(plain(c.name))!.id),translations}})
 const others=menu.sections.filter((s:any)=>!tricks.includes(s)&&!tricks.some((t:any)=>s.parentSectionId===t.id))
 const out={...structuredClone(menu),pricing:'fisso',formulas,included,sections:[...kept,...structuredClone(others)]}
 // «Compreso» tradotto: dalla descrizione tradotta della prima opzione
 const t0=tricks[0];for(const [lang,tr] of Object.entries<any>(t0.translations??{})){const sd=typeof tr?.description==='string'?splitDescription(tr.description):null;if(sd?.included){out.translations??={};out.translations[lang]={...(out.translations[lang]??{name:out.translations?.[lang]?.name??menu.name}),included:sd.included}}}
 return{menu:out,report:{menu:menu.name,formulas:formulas.map(f=>({name:f.name,price:f.price,note:f.note,sections:f.sectionIds.map(id=>kept.find(k=>k.id===id)?.name)})),included,sections:kept.map(k=>({name:k.name,items:k.items.length})),duplicatesRemoved:dupItems.length,addedFromDuplicates:added}}
}
export function migrateWorkspace(w:Workspace){const report:any[]=[],next=structuredClone(w) as any
 next.menus=next.menus.map((m:any)=>{const r=migrateMenu(m);if(!r)return m;report.push(r.report);return r.menu})
 return{workspace:workspaceSchema.parse(next),report}}
/** Nessun piatto distinto perso: ogni (menu, sottomenu figlio, nome) di prima esiste dopo. */
export function lostDishes(before:Workspace,after:Workspace){const key=(m:string,s:string,i:string)=>plain(m)+'|'+plain(s)+'|'+plain(i)
 const have=new Set(after.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>key(m.name,s.name,i.name)))))
 return before.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>({m:m.name,s:s.name,i:i.name})))).filter(x=>!have.has(key(x.m,x.s,x.i)))}

async function main(args=process.argv.slice(2)){
 const get=(n:string)=>{const i=args.indexOf(n);return i<0?undefined:args[i+1]},execute=args.includes('--execute'),out=get('--out')
 if(execute===args.includes('--plan')||!out)throw Error('Uso: --plan|--execute --out <cartella>')
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');const {loadLocalEnvironment}=await import('../start-webapp.mjs');Object.assign(process.env,await loadLocalEnvironment(root))
 const require=createRequire(resolve(root,'apps/server/package.json')),{sql}=require('drizzle-orm');const {db}=await import('../../packages/db/src/index.js')
 await mkdir(out,{recursive:true,mode:0o700})
 const rows=await db.execute(sql`SELECT draft,published,revision,published_revision FROM menu_workspaces WHERE restaurant_id=${VICTORIA}`);const row=rows[0] as any
 if(!row?.published)throw Error('Victoria senza menu pubblicato')
 if(Number(row.revision)!==Number(row.published_revision))throw Error('Bozza diversa dal pubblicato: qualcuno sta modificando dalla dashboard, stop')
 const before=workspaceSchema.parse(row.published),{workspace:after,report}=migrateWorkspace(before),lost=lostDishes(before,after)
 const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16)
 if(!execute){await writeFile(resolve(out,'backup.json'),JSON.stringify(row,null,1),{mode:0o600});await writeFile(resolve(out,'migrated.json'),JSON.stringify(after,null,1),{mode:0o600})
  await writeFile(resolve(out,'plan.json'),JSON.stringify({revision:Number(row.revision),beforeHash:hash(before),afterHash:hash(after),report,lost,dishesBefore:before.menus.reduce((n,m)=>n+m.sections.reduce((a,s)=>a+s.items.length,0),0),dishesAfter:after.menus.reduce((n,m)=>n+m.sections.reduce((a,s)=>a+s.items.length,0),0)},null,1),{mode:0o600})
  console.log(JSON.stringify({mode:'plan',revision:Number(row.revision),menusMigrated:report.length,lost:lost.length,report},null,1));return}
 const plan=JSON.parse(await readFile(resolve(out,'plan.json'),'utf8')),target=new URL(process.env.DATABASE_URL!)
 if(get('--expected-host')!==target.hostname)throw Error('Host di destinazione non confermato')
 if(Number(get('--expected-revision'))!==Number(row.revision)||plan.revision!==Number(row.revision)||plan.beforeHash!==hash(before))throw Error('Il menu è cambiato dopo il piano: rifai --plan')
 if(lost.length)throw Error('Piatti persi: stop')
 const planned=workspaceSchema.parse(JSON.parse(await readFile(resolve(out,'migrated.json'),'utf8')))
 const owner=(await db.execute(sql`SELECT user_id FROM web_location_memberships WHERE restaurant_id=${VICTORIA} ORDER BY created_at LIMIT 1`))[0] as any
 const {mutateWorkspace}=await import('../../apps/server/src/lib/menu-workspace-store.js')
 const saved=await mutateWorkspace(VICTORIA,owner?.user_id,Number(row.revision),planned,false,'Menu a prezzo fisso (migrazione)')
 const pub=await mutateWorkspace(VICTORIA,owner?.user_id,saved.revision,planned,true,'Menu a prezzo fisso pubblicato')
 await writeFile(resolve(out,'executed.json'),JSON.stringify({at:new Date().toISOString(),from:Number(row.revision),saved:saved.revision,published:(pub as any).revision??null},null,1),{mode:0o600})
 console.log(JSON.stringify({mode:'execute',from:Number(row.revision),saved:saved.revision}))
 process.exit(0)}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))main().catch(e=>{console.error(String(e?.message??e));process.exit(1)})
