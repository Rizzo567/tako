import {db,menuItems} from '@tako/db'
import {and,eq,sql} from 'drizzle-orm'
import { readWorkspace } from './menu-workspace-store.js'
import { publicWorkspace } from './menu-workspace-schedule.js'
import type { Workspace } from './menu-workspace-contract.js'
import type { PublicMenu } from '@tako/types'

/** Never initialize an editor or expose drafts from a public request. */
export async function publishedMenu(restaurantId: string,options:{catalogOnly?:boolean}={}): Promise<Workspace | null> {
  const row = await readWorkspace(restaurantId)
  if(!row?.published)return null
  const workspace=publicWorkspace(row.published,new Date(),{ignoreSchedules:options.catalogOnly===true})
  const available=await db.select({id:menuItems.id}).from(menuItems).where(and(eq(menuItems.restaurantId,restaurantId),eq(menuItems.available,true)))
  const ids=new Set(available.map(item=>item.id))
  for(const menu of workspace.menus)for(const section of menu.sections)section.items=section.items.filter(item=>ids.has(item.id))
  workspace.menus=workspace.menus.filter(menu=>menu.sections.some(section=>section.items.length>0))
  return workspace
}
/** One consistent DB snapshot; no cache of operational availability or draft exposure. */
export async function readPublishedCatalog(restaurantId:string,options:{catalogOnly?:boolean}={}) {
 const rows=await db.execute(sql`SELECT r.name,r.settings,w.published,
 COALESCE((SELECT jsonb_agg(i.id) FROM menu_items i WHERE i.restaurant_id=r.id AND i.available=true),'[]'::jsonb) AS available
 FROM restaurants r LEFT JOIN menu_workspaces w ON w.restaurant_id=r.id WHERE r.id=${restaurantId} AND r.active=true LIMIT 1`)
 const row=rows[0];if(!row?.published)return null
 const workspace=publicWorkspace(row.published as Workspace,new Date(),{ignoreSchedules:options.catalogOnly===true})
 const ids=new Set(row.available as string[])
 for(const menu of workspace.menus)for(const section of menu.sections)section.items=section.items.filter(item=>ids.has(item.id))
 workspace.menus=workspace.menus.filter(menu=>menu.sections.some(section=>section.items.length>0))
 return {workspace,restaurant:{name:String(row.name),settings:row.settings}}
}
/** With sourceLanguage, texts left untranslated carry nameLang/descriptionLang so the client can mark them. */
export function publicMenuProjection(menu: Workspace['menus'][number], language?: string, sourceLanguage?: string): PublicMenu {
  const translated = <T extends { name: string; description?: string | null; translations: Record<string, { name: string; description?: string }> }>(value: T) => language ? value.translations[language] : undefined
  const marking = !!language && !!sourceLanguage && language !== sourceLanguage
  const fallback = (value: { name: string; description?: string | null; translations: Record<string, { name: string; description?: string }> }) => {
    if (!marking) return {}
    const t = translated(value)
    return { ...(!t?.name && value.name ? { nameLang: sourceLanguage } : {}), ...(t?.description == null && value.description ? { descriptionLang: sourceLanguage } : {}) }
  }
  const menuNote = translated(menu)?.description?.trim() || menu.description?.trim() || undefined
  return {
    id: menu.id, name: translated(menu)?.name || menu.name,
    ...(menuNote ? { description: menuNote, ...(marking && !translated(menu)?.description?.trim() ? { descriptionLang: sourceLanguage } : {}) } : {}),
    sections: menu.sections.map(section => ({
      id: section.id, sourceName: section.name, name: translated(section)?.name || section.name,
      parentSectionId: section.parentSectionId, description: translated(section)?.description ?? section.description ?? undefined,
      ...fallback(section),
      items: section.items.map(item => ({
        id: item.id, name: translated(item)?.name || item.name,
        description: translated(item)?.description ?? item.description ?? undefined,
        ...fallback(item),
        price: item.price, imageUrl: item.imageUrl ?? undefined,
        allergens: item.allergens, tags: item.tags, additives: item.additives,
        available: item.available, displayMode:item.displayMode,externalLink:item.externalLink??undefined,priceDisplay:item.priceDisplay??undefined,
        variants: item.variants.filter(variant => variant.available).map(({id, name, priceModifier}) => ({id, name, priceModifier})),
      })),
    })),
  }
}
