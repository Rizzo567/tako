import { randomUUID } from 'node:crypto'
import { db, menus, menuSections, menuItems, itemVariants, menuItemTranslations, restaurants, type DB } from '@tako/db'
import { eq, asc, sql } from 'drizzle-orm'
import { baselineLanguageConfiguration, normalizeBaselineTranslations } from './menu-workspace-languages.js'
import { menuLayoutDefaults } from './menu-layout-defaults.js'
import { workspaceSchema, botConflictSchema, type Workspace, type BotConflict } from './menu-workspace-contract.js'
import { z } from 'zod'
import { applyOps, type Op, type OpResult } from '@tako/menu-ops'
import { jsonEqual } from './menu-workspace-pending.js'
export type WorkspaceRow={draft:Workspace;published:Workspace|null;revision:number;published_revision:number|null}
export async function readWorkspace(tenant:string, connection:Pick<DB,'execute'>=db):Promise<WorkspaceRow|null>{
 const rows=await connection.execute(sql`SELECT draft,published,revision,published_revision FROM menu_workspaces WHERE restaurant_id=${tenant}`)
 return (rows[0] as unknown as WorkspaceRow)??null
}
export async function ensureWorkspace(tenant:string):Promise<WorkspaceRow>{
 const existing=await readWorkspace(tenant);if(existing)return existing
 const ms=await db.select().from(menus).where(eq(menus.restaurantId,tenant)).orderBy(asc(menus.position))
 const ss=await db.select().from(menuSections).innerJoin(menus,eq(menuSections.menuId,menus.id)).where(eq(menus.restaurantId,tenant)).orderBy(asc(menuSections.position))
 const ii=await db.select().from(menuItems).where(eq(menuItems.restaurantId,tenant)).orderBy(asc(menuItems.position))
 const vv=await db.select({variant:itemVariants}).from(itemVariants).innerJoin(menuItems,eq(itemVariants.itemId,menuItems.id)).where(eq(menuItems.restaurantId,tenant))
 const tt=await db.select().from(menuItemTranslations).where(eq(menuItemTranslations.restaurantId,tenant))
 const [restaurant]=await db.select().from(restaurants).where(eq(restaurants.id,tenant))
 const observedLanguages=[...tt.map(t=>t.lang),...ss.flatMap(s=>Object.keys(s.menu_sections.nameTranslations??{})),...ii.flatMap(i=>[...Object.keys(i.nameTranslations??{}),...Object.keys(i.descriptionTranslations??{})])]
 const languageConfiguration=baselineLanguageConfiguration(restaurant?.settings,observedLanguages)
 const draft=workspaceSchema.parse({...languageConfiguration,menus:ms.map(m=>({...m,translations:{},sections:ss.filter(s=>s.menu_sections.menuId===m.id).map(({menu_sections:s})=>({...s,translations:Object.fromEntries(Object.entries(s.nameTranslations??{}).map(([lang,name])=>[lang,{name}])),items:ii.filter(i=>i.sectionId===s.id).map(i=>({...i,translations:Object.fromEntries([...[...new Set([...Object.keys(i.nameTranslations??{}),...Object.keys(i.descriptionTranslations??{})])].map(lang=>[lang,{name:i.nameTranslations?.[lang]??i.name,description:i.descriptionTranslations?.[lang]??''}] as const),...tt.filter(t=>t.itemId===i.id).map(t=>[t.lang,{name:t.name,description:t.description??''}] as const)]),variants:vv.filter(v=>v.variant.itemId===i.id).map(v=>v.variant)}))}))})),design:{...menuLayoutDefaults,primary:restaurant?.primaryColor??'#ed725b',logoUrl:restaurant?.logoUrl??null}})
 for(const m of draft.menus){m.translations=normalizeBaselineTranslations(m.translations);for(const s of m.sections){s.translations=normalizeBaselineTranslations(s.translations);for(const i of s.items)i.translations=normalizeBaselineTranslations(i.translations)}}
 await db.transaction(async tx=>{const inserted=await tx.execute(sql`INSERT INTO menu_workspaces(restaurant_id,draft,published,published_revision) VALUES(${tenant},${JSON.stringify(draft)}::jsonb,${JSON.stringify(draft)}::jsonb,1) ON CONFLICT DO NOTHING RETURNING restaurant_id`);if(inserted.length)await tx.execute(sql`INSERT INTO menu_workspace_versions(id,restaurant_id,revision,label,snapshot) VALUES(${randomUUID()},${tenant},1,'Menu originale',${JSON.stringify(draft)}::jsonb)`)} )
 return (await readWorkspace(tenant))!
}
export class WorkspaceConflict extends Error{}
/** Nessuna riga workspace per il locale: è un conflitto per chi lo gestiva già così; le rotte la creano e riprovano. */
export class WorkspaceMissing extends WorkspaceConflict{}
export class WorkspaceOwnership extends Error{}
/** Menu PROVA della campagna lead (settings.takomenuTrial=true): privato, visibile solo dal link di prova.
 * Non va mai sul menu pubblico, da nessuna strada (dashboard, preset automatici, WhatsApp, script): il blocco
 * sta qui perché ogni pubblicazione passa da mutateWorkspace(publish). La bozza si salva comunque.
 * Sblocco quando il lead diventa cliente: togliere il flag (settings.takomenuTrial=false), vedi
 * docs/webapp/feature-vendita-2026-10-16/blocco-pubblicazione-prova.md. */
export const TRIAL_PUBLISH_BLOCKED_MESSAGE='Questo è un menu di prova privato: non si può pubblicare sul menu pubblico finché il locale non diventa cliente. Le modifiche restano salvate in bozza.'
export class WorkspaceTrialLocked extends Error{constructor(){super(TRIAL_PUBLISH_BLOCKED_MESSAGE)}}
export async function isTrialRestaurant(tenant:string,connection:Pick<DB,'execute'>=db){return (await connection.execute(sql`SELECT 1 FROM restaurants WHERE id=${tenant} AND settings->>'takomenuTrial'='true'`)).length>0}
export async function verifyOwnership(tx:Pick<DB,'execute'>,tenant:string,w:Workspace){
 for(const url of [w.pdf.backgroundImageUrl,...w.pdfPresets.map(p=>p.config.backgroundImageUrl)].filter((u):u is string=>!!u))if(!url.startsWith(`/uploads/${tenant}/`)||/[?#]/.test(url)||url.slice(`/uploads/${tenant}/`.length).includes('/'))throw new WorkspaceOwnership('Foreign or invalid PDF image URL')
 const imageUrls=[w.design.logoUrl,w.design.coverUrl,w.design.backgroundImageUrl,w.pdf.backgroundImageUrl,...w.pdfPresets.map(p=>p.config.backgroundImageUrl),...w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>i.imageUrl)))].filter((u):u is string=>!!u)
 for(const url of imageUrls){if(!url.startsWith(`/uploads/${tenant}/`) && !url.startsWith('https://'))throw new WorkspaceOwnership('Foreign or invalid image URL');if(url.startsWith('https://')&&new URL(url).pathname.startsWith('/uploads/')&&!new URL(url).pathname.startsWith(`/uploads/${tenant}/`))throw new WorkspaceOwnership('Foreign image URL')}
 const ids=w.menus.flatMap(m=>[m.id,...m.sections.flatMap(s=>[s.id,...s.items.flatMap(i=>[i.id,...i.variants.map(v=>v.id)])])])
 if(!ids.length)return
 const encoded=JSON.stringify(ids)
 const rows=await tx.execute(sql`WITH ids AS (SELECT jsonb_array_elements_text(${encoded}::jsonb)::uuid id) SELECT id FROM menus WHERE id IN(SELECT id FROM ids) AND restaurant_id<>${tenant} UNION ALL SELECT s.id FROM menu_sections s JOIN menus m ON m.id=s.menu_id WHERE s.id IN(SELECT id FROM ids) AND m.restaurant_id<>${tenant} UNION ALL SELECT id FROM menu_items WHERE id IN(SELECT id FROM ids) AND restaurant_id<>${tenant} UNION ALL SELECT v.id FROM item_variants v JOIN menu_items i ON i.id=v.item_id WHERE v.id IN(SELECT id FROM ids) AND i.restaurant_id<>${tenant}`)
 if(rows.length)throw new WorkspaceOwnership('Foreign resource')
}
/** Riga del workspace bloccata FOR UPDATE + flag PROVA nella stessa istruzione (prima erano due). */
export async function lockWorkspace(tx:Pick<DB,'execute'>,tenant:string){
 const rows=await tx.execute(sql`SELECT revision,draft,published,EXISTS(SELECT 1 FROM restaurants WHERE id=${tenant} AND settings->>'takomenuTrial'='true') AS trial FROM menu_workspaces WHERE restaurant_id=${tenant} FOR UPDATE`)
 return rows[0] as {revision:unknown,draft:unknown,published:unknown,trial:boolean}|undefined
}
const keep=<T>(value:T|undefined,fallback:T)=>value===undefined?fallback:value
/** Righe delle tabelle del menu come le scriveva la pubblicazione (stessi valori, stessi default di colonna). */
function publicationRows(tenant:string,w:Workspace){
 const menuRows:unknown[]=[],sectionRows:unknown[]=[],itemRows:unknown[]=[],variantRows:unknown[]=[],translationRows:unknown[]=[]
 for(const [mp,m] of w.menus.entries()){
  menuRows.push({id:m.id,name:m.name,description:keep(m.description,null),type:keep(m.type,'main'),active:keep(m.active,true),position:mp})
  for(const [sp,s] of m.sections.entries()){
   sectionRows.push({id:s.id,menu_id:m.id,name:s.name,description:keep(s.description,null),active:keep(s.active,true),position:sp,name_translations:Object.fromEntries(Object.entries(s.translations).map(([lang,t])=>[lang,t.name]))})
   for(const [ip,i] of s.items.entries()){
    itemRows.push({id:i.id,section_id:s.id,name:i.name,description:keep(i.description,null),price:i.price,image_url:keep(i.imageUrl,null),allergens:keep(i.allergens,[]),tags:keep(i.tags,[]),available:m.active&&s.active&&!i.hidden&&i.available,featured:keep(i.featured,false),position:ip,kitchen_station:keep(i.kitchenStation,null),prep_time_minutes:keep(i.prepTimeMinutes,10),cost_price:keep(i.costPrice,null),calories:keep(i.calories,null),name_translations:Object.fromEntries(Object.entries(i.translations).map(([lang,t])=>[lang,t.name])),description_translations:Object.fromEntries(Object.entries(i.translations).map(([lang,t])=>[lang,t.description??'']))})
    for(const v of i.variants)variantRows.push({id:v.id,item_id:i.id,name:v.name,price_modifier:keep(v.priceModifier,0),available:keep(v.available,true)})
    for(const [lang,t] of Object.entries(i.translations))translationRows.push({item_id:i.id,lang,name:t.name,description:t.description??null})
   }
  }
 }
 return {menus:menuRows,sections:sectionRows,items:itemRows,variants:variantRows,translations:translationRows}
}
/**
 * Pubblicazione a delta in UNA istruzione (CTE): stesso risultato finale della riscrittura completa di prima
 * (stesse righe, stessi id, stessi valori, menu/piatti fuori dal documento ritirati, varianti e traduzioni dei
 * piatti correnti allineate), ma tocca solo le righe che cambiano. Le righe identiche non vengono riscritte
 * (updated_at e id delle traduzioni restano quelli di prima). Una sola istruzione = un solo giro col DB.
 */
export async function writePublication(tx:Pick<DB,'execute'>,tenant:string,w:Workspace,now:Date){
 const rows=publicationRows(tenant,w)
 const data=JSON.stringify({...rows,now:now.toISOString()})
 await tx.execute(sql`WITH d AS (SELECT ${data}::jsonb AS j),
 wm AS (SELECT x.* FROM d,jsonb_to_recordset(d.j->'menus') AS x(id uuid,name text,description text,type text,active boolean,position integer)),
 ws AS (SELECT x.* FROM d,jsonb_to_recordset(d.j->'sections') AS x(id uuid,menu_id uuid,name text,description text,active boolean,position integer,name_translations jsonb)),
 wi AS (SELECT x.* FROM d,jsonb_to_recordset(d.j->'items') AS x(id uuid,section_id uuid,name text,description text,price numeric,image_url text,allergens text[],tags text[],available boolean,featured boolean,position integer,kitchen_station text,prep_time_minutes integer,cost_price numeric,calories integer,name_translations jsonb,description_translations jsonb)),
 wv AS (SELECT x.* FROM d,jsonb_to_recordset(d.j->'variants') AS x(id uuid,item_id uuid,name text,price_modifier numeric,available boolean)),
 wt AS (SELECT x.* FROM d,jsonb_to_recordset(d.j->'translations') AS x(item_id uuid,lang text,name text,description text)),
 menus_off AS (UPDATE menus SET active=false WHERE restaurant_id=${tenant} AND active AND id NOT IN (SELECT id FROM wm) RETURNING 1),
 items_off AS (UPDATE menu_items SET available=false WHERE restaurant_id=${tenant} AND available AND id NOT IN (SELECT id FROM wi) RETURNING 1),
 menus_up AS (INSERT INTO menus(id,restaurant_id,name,description,type,active,position) SELECT id,${tenant},name,description,type,active,position FROM wm
  ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,type=excluded.type,active=excluded.active,position=excluded.position,updated_at=((SELECT j->>'now' FROM d))::timestamp
  WHERE (menus.name,menus.description,menus.type,menus.active,menus.position) IS DISTINCT FROM (excluded.name,excluded.description,excluded.type,excluded.active,excluded.position) RETURNING 1),
 sections_up AS (INSERT INTO menu_sections(id,menu_id,name,description,active,position,name_translations) SELECT id,menu_id,name,description,active,position,name_translations FROM ws
  ON CONFLICT(id) DO UPDATE SET menu_id=excluded.menu_id,name=excluded.name,description=excluded.description,active=excluded.active,position=excluded.position,name_translations=excluded.name_translations
  WHERE (menu_sections.menu_id,menu_sections.name,menu_sections.description,menu_sections.active,menu_sections.position,menu_sections.name_translations) IS DISTINCT FROM (excluded.menu_id,excluded.name,excluded.description,excluded.active,excluded.position,excluded.name_translations) RETURNING 1),
 items_up AS (INSERT INTO menu_items(id,section_id,restaurant_id,name,description,price,image_url,allergens,tags,available,featured,position,kitchen_station,prep_time_minutes,cost_price,calories,name_translations,description_translations)
  SELECT id,section_id,${tenant},name,description,price,image_url,allergens,tags,available,featured,position,kitchen_station,prep_time_minutes,cost_price,calories,name_translations,description_translations FROM wi
  ON CONFLICT(id) DO UPDATE SET section_id=excluded.section_id,restaurant_id=excluded.restaurant_id,name=excluded.name,description=excluded.description,price=excluded.price,image_url=excluded.image_url,allergens=excluded.allergens,tags=excluded.tags,available=excluded.available,featured=excluded.featured,position=excluded.position,kitchen_station=excluded.kitchen_station,prep_time_minutes=excluded.prep_time_minutes,cost_price=excluded.cost_price,calories=excluded.calories,name_translations=excluded.name_translations,description_translations=excluded.description_translations,updated_at=((SELECT j->>'now' FROM d))::timestamp
  WHERE (menu_items.section_id,menu_items.restaurant_id,menu_items.name,menu_items.description,menu_items.price,menu_items.image_url,menu_items.allergens,menu_items.tags,menu_items.available,menu_items.featured,menu_items.position,menu_items.kitchen_station,menu_items.prep_time_minutes,menu_items.cost_price,menu_items.calories,menu_items.name_translations,menu_items.description_translations)
   IS DISTINCT FROM (excluded.section_id,excluded.restaurant_id,excluded.name,excluded.description,excluded.price,excluded.image_url,excluded.allergens,excluded.tags,excluded.available,excluded.featured,excluded.position,excluded.kitchen_station,excluded.prep_time_minutes,excluded.cost_price,excluded.calories,excluded.name_translations,excluded.description_translations) RETURNING 1),
 variants_off AS (UPDATE item_variants SET available=false WHERE item_id IN (SELECT id FROM wi) AND available AND id NOT IN (SELECT id FROM wv) RETURNING 1),
 variants_up AS (INSERT INTO item_variants(id,item_id,name,price_modifier,available) SELECT id,item_id,name,price_modifier,available FROM wv
  ON CONFLICT(id) DO UPDATE SET item_id=excluded.item_id,name=excluded.name,price_modifier=excluded.price_modifier,available=excluded.available
  WHERE (item_variants.item_id,item_variants.name,item_variants.price_modifier,item_variants.available) IS DISTINCT FROM (excluded.item_id,excluded.name,excluded.price_modifier,excluded.available) RETURNING 1),
 translations_off AS (DELETE FROM menu_item_translations t WHERE t.restaurant_id=${tenant} AND t.item_id IN (SELECT id FROM wi) AND NOT EXISTS (SELECT 1 FROM wt WHERE wt.item_id=t.item_id AND wt.lang=t.lang) RETURNING 1),
 translations_up AS (INSERT INTO menu_item_translations(restaurant_id,item_id,lang,name,description) SELECT ${tenant},item_id,lang,name,description FROM wt
  ON CONFLICT(item_id,lang) DO UPDATE SET restaurant_id=excluded.restaurant_id,name=excluded.name,description=excluded.description,updated_at=((SELECT j->>'now' FROM d))::timestamptz
  WHERE (menu_item_translations.restaurant_id,menu_item_translations.name,menu_item_translations.description) IS DISTINCT FROM (excluded.restaurant_id,excluded.name,excluded.description) RETURNING 1)
 SELECT (SELECT count(*) FROM menus_off)+(SELECT count(*) FROM items_off)+(SELECT count(*) FROM menus_up)+(SELECT count(*) FROM sections_up)+(SELECT count(*) FROM items_up)+(SELECT count(*) FROM variants_off)+(SELECT count(*) FROM variants_up)+(SELECT count(*) FROM translations_off)+(SELECT count(*) FROM translations_up) AS changed`)
}
/** Bozza (e pubblicato) + riga di storico in una sola istruzione. */
export async function writeWorkspace(tx:Pick<DB,'execute'>,tenant:string,actor:string,revision:number,w:Workspace,publish:boolean,label:string){
 const doc=JSON.stringify(w)
 await tx.execute(sql`WITH v AS (INSERT INTO menu_workspace_versions(id,restaurant_id,revision,label,snapshot,created_by) VALUES(${randomUUID()},${tenant},${revision},${label},${doc}::jsonb,${actor}) RETURNING 1)
 UPDATE menu_workspaces SET draft=${doc}::jsonb,revision=${revision},published=CASE WHEN ${publish} THEN ${doc}::jsonb ELSE published END,published_revision=CASE WHEN ${publish} THEN ${revision} ELSE published_revision END,updated_at=now() WHERE restaurant_id=${tenant}`)
}
/** Conflitti bot al Pubblica (22/10): la bozza ha modifiche da WhatsApp già online che pubblicandola verrebbero tolte.
 * Lanciata solo dalla pubblicazione della dashboard (guard) senza conferma esplicita; bot e preset non passano da qui. */
export class WorkspaceBotConflicts extends Error{constructor(public conflicts:BotConflict[],public currentRevision:number){super('Da WhatsApp sono state fatte modifiche che non sono in questa bozza')}}
/** Elenco dei conflitti bot di un documento grezzo (bozza): [] se assente o illeggibile. */
export function botConflictsOf(doc:unknown):BotConflict[]{const raw=(doc as {botConflicts?:unknown}|null)?.botConflicts;if(!Array.isArray(raw))return [];const p=z.array(botConflictSchema).safeParse(raw);return p.success?p.data:[]}
/** guard (solo dashboard: POST /publish): con conflitti bot in bozza e senza confirmBotConflicts → WorkspaceBotConflicts, nessuna scrittura.
 * Senza guard (bot, preset, onboarding, traduzioni) nessun blocco. In ogni pubblicazione il campo botConflicts si toglie (mai nel pubblicato,
 * e la bozza pubblicata lo azzera). Nei salvataggi di bozza il campo resta quello del server (il client non lo decide). */
export async function mutateWorkspace(tenant:string,actor:string,expected:number,w:Workspace,publish=false,label='Salvataggio',connection:DB=db,guard?:{confirmBotConflicts?:boolean}){
 return connection.transaction(async tx=>{
 const row=await lockWorkspace(tx,tenant)
 if(publish&&(row?row.trial===true:await isTrialRestaurant(tenant,tx)))throw new WorkspaceTrialLocked()
 if(!row)throw new WorkspaceMissing('Revision conflict')
 if(Number(row?.revision)!==expected)throw new WorkspaceConflict('Revision conflict')
 const serverConflicts=botConflictsOf(row.draft)
 if(publish&&guard&&!guard.confirmBotConflicts&&serverConflicts.length)throw new WorkspaceBotConflicts(serverConflicts,Number(row.revision))
 if(!publish){w={...w};if(serverConflicts.length)w.botConflicts=serverConflicts;else delete w.botConflicts}
 if(publish){w=workspaceSchema.parse(row!.draft);delete w.botConflicts;const previous=row!.published?workspaceSchema.parse(row!.published):null;const previousItems=new Map(previous?.menus.filter(m=>m.active).flatMap(m=>m.sections.filter(s=>s.active).flatMap(s=>s.items.filter(i=>!i.hidden).map(i=>[i.id,i.available] as const)))??[]);const liveItems=await tx.select({id:menuItems.id,available:menuItems.available}).from(menuItems).where(eq(menuItems.restaurantId,tenant)).for('update');const live=new Map(liveItems.map(i=>[i.id,i.available]));for(const m of w.menus)for(const s of m.sections)for(const i of s.items)if(previousItems.get(i.id)===i.available&&live.has(i.id))i.available=live.get(i.id)!}
 await verifyOwnership(tx,tenant,w)
 const revision=expected+1
 // Soft retirement keeps all IDs referenced by historical orders.
 if(publish)await writePublication(tx,tenant,w,new Date())
 await writeWorkspace(tx,tenant,actor,revision,w,publish,label)
 return {data:w,revision,publishedRevision:publish?revision:undefined}
 })
}
/** Esegue la scrittura; solo se la riga workspace non esiste ancora la crea (ensureWorkspace) e riprova una volta.
 * Prima le rotte chiamavano ensureWorkspace a ogni salvataggio/pubblicazione: un giro col DB in più ogni volta. */
export async function withWorkspace<T>(tenant:string,run:()=>Promise<T>):Promise<T>{
 try{return await run()}catch(e){if(!(e instanceof WorkspaceMissing))throw e;await ensureWorkspace(tenant);return run()}
}
// ── Dashboard editor 22/10: bozza a operazioni (CONTRATTO §3). Scrive SOLO la bozza, sotto lock di riga, senza expectedRevision. ──
export const DRAFT_VERSION_LABEL='Bozza dashboard'
export const DISCARD_VERSION_LABEL='Bozza scartata'
/** Al massimo una riga di storico «Bozza dashboard» ogni 30 minuti per locale (le op non scrivono più uno snapshot ciascuna). */
export const DRAFT_VERSION_MINUTES=30
/** Il documento risultante dalle op non supera workspaceSchema: 422, nessuna scrittura. */
export class WorkspaceInvalid extends Error{constructor(public issues:string){super('Il menu risultante non è valido')}}
export type DraftOpsResult={revision:number;publishedRevision:number|null;pending:boolean;results:OpResult[];versioned:boolean}
/** Applica le op e valida il documento. Prima il gruppo intero (un solo parse); solo se il risultato non è valido si rifà
 * op per op: l'op che rende il documento invalido diventa {ok:false,code:'FIELD'} e si scarta, le altre restano.
 * Il documento restituito è sempre valido (correzioni revisione 22/10, punto 1). */
export function applyOpsValidated(current:Workspace,ops:Op[]):{workspace:Workspace;results:OpResult[]}{
 const all=applyOps(current,ops)
 const parsed=workspaceSchema.safeParse(all.workspace)
 if(parsed.success)return {workspace:parsed.data,results:all.results}
 let w=current;const results:OpResult[]=[]
 for(const op of ops){
  const one=applyOps(w,[op]),r=one.results[0]!
  if(!r.ok){results.push(r);continue}
  const p=workspaceSchema.safeParse(one.workspace)
  if(p.success){w=p.data;results.push(r)}
  else results.push({ok:false,code:'FIELD',message:p.error.issues.slice(0,3).map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')})
 }
 return {workspace:w,results}
}
export async function applyDraftOps(tenant:string,actor:string,ops:Op[],_clientId:string,connection:DB=db):Promise<DraftOpsResult>{
 return connection.transaction(async tx=>{
  const row=await lockWorkspace(tx,tenant)
  if(!row)throw new WorkspaceMissing('Workspace missing')
  // Confronti sempre fra documenti normalizzati (zod): un documento salvato prima di un campo con default non è «diverso».
  const current=workspaceSchema.parse(row.draft)
  const published=row.published==null?null:workspaceSchema.parse(row.published)
  const {workspace:w,results}=applyOpsValidated(current,ops)
  const revision=Number(row.revision)
  const pending=published==null||!jsonEqual(w,published)
  // Nessun cambiamento reale (op rifiutate o ripetute): nessuna scrittura, la revisione non sale.
  if(jsonEqual(w,current)){const pr=await tx.execute(sql`SELECT published_revision FROM menu_workspaces WHERE restaurant_id=${tenant}`);return {revision,publishedRevision:pr[0]?.published_revision==null?null:Number(pr[0].published_revision),pending:published==null?true:!jsonEqual(current,published),results,versioned:false}}
  await verifyOwnership(tx,tenant,w)
  const doc=JSON.stringify(w)
  // Pubblicato grezzo (scritto prima di un nuovo default): si riscrive normalizzato (stesso contenuto), così il confronto SQL
  // `draft IS DISTINCT FROM published` di /status resta valido. Le tabelle del menu non cambiano.
  const normalizedPublished=published!=null&&!jsonEqual(published,row.published)?JSON.stringify(published):null
  const out=await tx.execute(sql`WITH u AS (UPDATE menu_workspaces SET draft=${doc}::jsonb,published=coalesce(${normalizedPublished}::jsonb,published),revision=revision+1,updated_at=now() WHERE restaurant_id=${tenant} RETURNING revision,published_revision),
  v AS (INSERT INTO menu_workspace_versions(id,restaurant_id,revision,label,snapshot,created_by) SELECT ${randomUUID()},${tenant},u.revision,${DRAFT_VERSION_LABEL},${doc}::jsonb,${actor} FROM u
   WHERE NOT EXISTS (SELECT 1 FROM menu_workspace_versions WHERE restaurant_id=${tenant} AND label=${DRAFT_VERSION_LABEL} AND created_at>now()-make_interval(mins=>${DRAFT_VERSION_MINUTES})) RETURNING 1)
  SELECT u.revision,u.published_revision,(SELECT count(*)::int FROM v) AS versioned FROM u`)
  const r=out[0]!
  return {revision:Number(r.revision),publishedRevision:r.published_revision==null?null:Number(r.published_revision),pending,results,versioned:Number(r.versioned)>0}
 })
}
export class WorkspaceNotPublished extends WorkspaceConflict{}
/** «Scarta le modifiche»: salva la bozza corrente come versione «Bozza scartata» (recuperabile dalle Versioni), poi bozza = pubblicato. */
export async function discardDraft(tenant:string,actor:string,expectedRevision:number,connection:DB=db){
 return connection.transaction(async tx=>{
  const row=await lockWorkspace(tx,tenant)
  if(!row)throw new WorkspaceMissing('Workspace missing')
  if(Number(row.revision)!==expectedRevision)throw new WorkspaceConflict('Revision conflict')
  if(row.published==null)throw new WorkspaceNotPublished('Menu mai pubblicato')
  // Confronto fra documenti normalizzati; si scrivono sempre documenti già passati da zod in entrambe le colonne.
  const draftDoc=workspaceSchema.parse(row.draft),publishedDoc=workspaceSchema.parse(row.published)
  delete publishedDoc.botConflicts // conflitti bot: solo in bozza; Scarta li azzera (bozza = pubblicato)
  const published=JSON.stringify(publishedDoc)
  if(jsonEqual(draftDoc,publishedDoc)){
   // Stesso contenuto ma colonne grezze diverse (default aggiunti dopo): si normalizzano, così /status non resta «pendente».
   if(!jsonEqual(row.draft,row.published))await tx.execute(sql`UPDATE menu_workspaces SET draft=${published}::jsonb,published=${published}::jsonb WHERE restaurant_id=${tenant}`)
   return {revision:Number(row.revision),discarded:false}
  }
  const revision=Number(row.revision)+1
  await tx.execute(sql`WITH v AS (INSERT INTO menu_workspace_versions(id,restaurant_id,revision,label,snapshot,created_by) VALUES(${randomUUID()},${tenant},${Number(row.revision)},${DISCARD_VERSION_LABEL},${JSON.stringify(row.draft)}::jsonb,${actor}) RETURNING 1)
  UPDATE menu_workspaces SET draft=${published}::jsonb,published=${published}::jsonb,revision=${revision},updated_at=now() WHERE restaurant_id=${tenant}`)
  return {revision,discarded:true}
 })
}
