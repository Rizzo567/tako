import {db,menuItems} from '@tako/db'
import {and,eq} from 'drizzle-orm'
import { readWorkspace } from './menu-workspace-store.js'
import { publicWorkspace } from './menu-workspace-schedule.js'
import { isWebMode } from './web-runtime.js'
import type { Workspace } from './menu-workspace-contract.js'
import type { PublicMenu } from '@tako/types'

/** Never initialize an editor or expose drafts from a public request. */
export async function publishedMenu(restaurantId: string): Promise<Workspace | null> {
  if (!isWebMode()) return null
  const row = await readWorkspace(restaurantId)
  if(!row?.published)return null
  const workspace=publicWorkspace(row.published)
  const available=await db.select({id:menuItems.id}).from(menuItems).where(and(eq(menuItems.restaurantId,restaurantId),eq(menuItems.available,true)))
  const ids=new Set(available.map(item=>item.id))
  for(const menu of workspace.menus)for(const section of menu.sections)section.items=section.items.filter(item=>ids.has(item.id))
  return workspace
}
export function publicMenuProjection(menu: Workspace['menus'][number], language?: string): PublicMenu {
  const translated = <T extends { name: string; description?: string | null; translations: Record<string, { name: string; description?: string }> }>(value: T) => language ? value.translations[language] : undefined
  return {
    id: menu.id, name: translated(menu)?.name || menu.name,
    sections: menu.sections.map(section => ({
      id: section.id, name: translated(section)?.name || section.name,
      parentSectionId: section.parentSectionId, description: translated(section)?.description ?? section.description ?? undefined,
      items: section.items.map(item => ({
        id: item.id, name: translated(item)?.name || item.name,
        description: translated(item)?.description ?? item.description ?? undefined,
        price: item.price, imageUrl: item.imageUrl ?? undefined,
        allergens: item.allergens, tags: item.tags, additives: item.additives,
        available: item.available, displayMode:item.displayMode,externalLink:item.externalLink??undefined,priceDisplay:item.priceDisplay??undefined,
        variants: item.variants.filter(variant => variant.available).map(({id, name, priceModifier}) => ({id, name, priceModifier})),
      })),
    })),
  }
}
