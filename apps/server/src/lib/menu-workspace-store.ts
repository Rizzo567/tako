import { randomUUID } from 'node:crypto'
import { db, menus, menuSections, menuItems, itemVariants, menuItemTranslations, restaurants, type DB } from '@tako/db'
import { eq, and, asc, sql, inArray } from 'drizzle-orm'
import { baselineLanguageConfiguration, normalizeBaselineTranslations } from './menu-workspace-languages.js'
import { menuLayoutDefaults } from './menu-layout-defaults.js'
import { workspaceSchema, type Workspace } from './menu-workspace-contract.js'
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
export class WorkspaceOwnership extends Error{}
/** Menu PROVA della campagna lead (settings.takomenuTrial=true): privato, visibile solo dal link di prova.
 * Non va mai sul menu pubblico, da nessuna strada (dashboard, preset automatici, WhatsApp, script): il blocco
 * sta qui perché ogni pubblicazione passa da mutateWorkspace(publish). La bozza si salva comunque.
 * Sblocco quando il lead diventa cliente: togliere il flag (settings.takomenuTrial=false), vedi
 * docs/webapp/feature-vendita-2026-10-16/blocco-pubblicazione-prova.md. */
export const TRIAL_PUBLISH_BLOCKED_MESSAGE='Questo è un menu di prova privato: non si può pubblicare sul menu pubblico finché il locale non diventa cliente. Le modifiche restano salvate in bozza.'
export class WorkspaceTrialLocked extends Error{constructor(){super(TRIAL_PUBLISH_BLOCKED_MESSAGE)}}
export async function isTrialRestaurant(tenant:string,connection:Pick<DB,'execute'>=db){return (await connection.execute(sql`SELECT 1 FROM restaurants WHERE id=${tenant} AND settings->>'takomenuTrial'='true'`)).length>0}
async function verifyOwnership(tx:Pick<DB,'execute'>,tenant:string,w:Workspace){
 for(const url of [w.pdf.backgroundImageUrl,...w.pdfPresets.map(p=>p.config.backgroundImageUrl)].filter((u):u is string=>!!u))if(!url.startsWith(`/uploads/${tenant}/`)||/[?#]/.test(url)||url.slice(`/uploads/${tenant}/`.length).includes('/'))throw new WorkspaceOwnership('Foreign or invalid PDF image URL')
 const imageUrls=[w.design.logoUrl,w.design.coverUrl,w.design.backgroundImageUrl,w.pdf.backgroundImageUrl,...w.pdfPresets.map(p=>p.config.backgroundImageUrl),...w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>i.imageUrl)))].filter((u):u is string=>!!u)
 for(const url of imageUrls){if(!url.startsWith(`/uploads/${tenant}/`) && !url.startsWith('https://'))throw new WorkspaceOwnership('Foreign or invalid image URL');if(url.startsWith('https://')&&new URL(url).pathname.startsWith('/uploads/')&&!new URL(url).pathname.startsWith(`/uploads/${tenant}/`))throw new WorkspaceOwnership('Foreign image URL')}
 const ids=w.menus.flatMap(m=>[m.id,...m.sections.flatMap(s=>[s.id,...s.items.flatMap(i=>[i.id,...i.variants.map(v=>v.id)])])])
 if(!ids.length)return
 const encoded=JSON.stringify(ids)
 const rows=await tx.execute(sql`WITH ids AS (SELECT jsonb_array_elements_text(${encoded}::jsonb)::uuid id) SELECT id FROM menus WHERE id IN(SELECT id FROM ids) AND restaurant_id<>${tenant} UNION ALL SELECT s.id FROM menu_sections s JOIN menus m ON m.id=s.menu_id WHERE s.id IN(SELECT id FROM ids) AND m.restaurant_id<>${tenant} UNION ALL SELECT id FROM menu_items WHERE id IN(SELECT id FROM ids) AND restaurant_id<>${tenant} UNION ALL SELECT v.id FROM item_variants v JOIN menu_items i ON i.id=v.item_id WHERE v.id IN(SELECT id FROM ids) AND i.restaurant_id<>${tenant}`)
 if(rows.length)throw new WorkspaceOwnership('Foreign resource')
}
export async function mutateWorkspace(tenant:string,actor:string,expected:number,w:Workspace,publish=false,label='Salvataggio',connection:DB=db){
 return connection.transaction(async tx=>{
 const rows=await tx.execute(sql`SELECT revision,draft,published FROM menu_workspaces WHERE restaurant_id=${tenant} FOR UPDATE`)
 if(publish&&await isTrialRestaurant(tenant,tx))throw new WorkspaceTrialLocked()
 if(Number(rows[0]?.revision)!==expected)throw new WorkspaceConflict('Revision conflict')
 if(publish){w=workspaceSchema.parse(rows[0]!.draft);const previous=rows[0]!.published?workspaceSchema.parse(rows[0]!.published):null;const previousItems=new Map(previous?.menus.filter(m=>m.active).flatMap(m=>m.sections.filter(s=>s.active).flatMap(s=>s.items.filter(i=>!i.hidden).map(i=>[i.id,i.available] as const)))??[]);const liveItems=await tx.select({id:menuItems.id,available:menuItems.available}).from(menuItems).where(eq(menuItems.restaurantId,tenant)).for('update');const live=new Map(liveItems.map(i=>[i.id,i.available]));for(const m of w.menus)for(const s of m.sections)for(const i of s.items)if(previousItems.get(i.id)===i.available&&live.has(i.id))i.available=live.get(i.id)!}
 await verifyOwnership(tx,tenant,w)
 const revision=expected+1
 if(publish){
 // Soft retirement keeps all IDs referenced by historical orders.
 await tx.update(menus).set({active:false}).where(eq(menus.restaurantId,tenant))
 await tx.update(menuItems).set({available:false}).where(eq(menuItems.restaurantId,tenant))
 const menuRows:typeof menus.$inferInsert[]=[],sectionRows:typeof menuSections.$inferInsert[]=[],itemRows:typeof menuItems.$inferInsert[]=[],variantRows:typeof itemVariants.$inferInsert[]=[],translationRows:typeof menuItemTranslations.$inferInsert[]=[]
 for(const [mp,m] of w.menus.entries()){
 menuRows.push({id:m.id,restaurantId:tenant,name:m.name,description:m.description,type:m.type,active:m.active,position:mp})
 for(const [sp,s] of m.sections.entries()){
 sectionRows.push({id:s.id,menuId:m.id,name:s.name,description:s.description,active:s.active,position:sp,nameTranslations:Object.fromEntries(Object.entries(s.translations).map(([lang,t])=>[lang,t.name]))})
 for(const [ip,i] of s.items.entries()){
 itemRows.push({id:i.id,sectionId:s.id,restaurantId:tenant,name:i.name,description:i.description,price:i.price,imageUrl:i.imageUrl,allergens:i.allergens,tags:i.tags,available:m.active&&s.active&&!i.hidden&&i.available,featured:i.featured,position:ip,kitchenStation:i.kitchenStation,prepTimeMinutes:i.prepTimeMinutes,costPrice:i.costPrice,calories:i.calories,nameTranslations:Object.fromEntries(Object.entries(i.translations).map(([lang,t])=>[lang,t.name])),descriptionTranslations:Object.fromEntries(Object.entries(i.translations).map(([lang,t])=>[lang,t.description??'']))})
 for(const v of i.variants)variantRows.push({id:v.id,itemId:i.id,name:v.name,priceModifier:v.priceModifier,available:v.available})
 for(const [lang,t] of Object.entries(i.translations))translationRows.push({restaurantId:tenant,itemId:i.id,lang,name:t.name,description:t.description??null})
 }
 }
 }
 const chunks=<T>(rows:T[])=>Array.from({length:Math.ceil(rows.length/200)},(_,index)=>rows.slice(index*200,index*200+200))
 const excluded=(fields:Record<string,string>)=>Object.fromEntries(Object.entries(fields).map(([key,column])=>[key,sql`excluded.${sql.identifier(column)}`]))
 for(const batch of chunks(menuRows))await tx.insert(menus).values(batch).onConflictDoUpdate({target:menus.id,set:{...excluded({name:'name',description:'description',type:'type',active:'active',position:'position'}),updatedAt:new Date()}})
 for(const batch of chunks(sectionRows))await tx.insert(menuSections).values(batch).onConflictDoUpdate({target:menuSections.id,set:excluded({menuId:'menu_id',name:'name',description:'description',active:'active',position:'position',nameTranslations:'name_translations'})})
 for(const batch of chunks(itemRows))await tx.insert(menuItems).values(batch).onConflictDoUpdate({target:menuItems.id,set:{...excluded({sectionId:'section_id',restaurantId:'restaurant_id',name:'name',description:'description',price:'price',imageUrl:'image_url',allergens:'allergens',tags:'tags',available:'available',featured:'featured',position:'position',kitchenStation:'kitchen_station',prepTimeMinutes:'prep_time_minutes',costPrice:'cost_price',calories:'calories',nameTranslations:'name_translations',descriptionTranslations:'description_translations'}),updatedAt:new Date()}})
 const currentItemIds=itemRows.map(i=>i.id!)
 if(currentItemIds.length){
 await tx.update(itemVariants).set({available:false}).where(inArray(itemVariants.itemId,currentItemIds))
 await tx.delete(menuItemTranslations).where(and(eq(menuItemTranslations.restaurantId,tenant),inArray(menuItemTranslations.itemId,currentItemIds)))
 }
 for(const batch of chunks(variantRows))await tx.insert(itemVariants).values(batch).onConflictDoUpdate({target:itemVariants.id,set:excluded({itemId:'item_id',name:'name',priceModifier:'price_modifier',available:'available'})})
 for(const batch of chunks(translationRows))await tx.insert(menuItemTranslations).values(batch)

 }
 await tx.execute(sql`UPDATE menu_workspaces SET draft=${JSON.stringify(w)}::jsonb,revision=${revision},published=CASE WHEN ${publish} THEN ${JSON.stringify(w)}::jsonb ELSE published END,published_revision=CASE WHEN ${publish} THEN ${revision} ELSE published_revision END,updated_at=now() WHERE restaurant_id=${tenant}`)
 await tx.execute(sql`INSERT INTO menu_workspace_versions(id,restaurant_id,revision,label,snapshot,created_by) VALUES(${randomUUID()},${tenant},${revision},${label},${JSON.stringify(w)}::jsonb,${actor})`)
 return {data:w,revision,publishedRevision:publish?revision:undefined}
 })
}
