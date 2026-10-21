import {db,menuItems} from '@tako/db'
import {and,eq,sql} from 'drizzle-orm'
import { readWorkspace } from './menu-workspace-store.js'
import { publicWorkspace } from './menu-workspace-schedule.js'
import { salesTimezone } from './menu-sales.js'
import type { Workspace } from './menu-workspace-contract.js'
import type { PublicMenu, PublicFormula } from '@tako/types'
import { isFixed, visibleFormulas } from './menu-fixed-price.js'

/** Never initialize an editor or expose drafts from a public request. */
export async function publishedMenu(restaurantId: string,options:{catalogOnly?:boolean}={}): Promise<Workspace | null> {
  const row = await readWorkspace(restaurantId)
  if(!row?.published)return null
  const workspace=publicWorkspace(row.published,new Date(),{ignoreSchedules:options.catalogOnly===true})
  const available=await db.select({id:menuItems.id}).from(menuItems).where(and(eq(menuItems.restaurantId,restaurantId),eq(menuItems.available,true)))
  const ids=new Set(available.map(item=>item.id))
  applyPublicAvailability(row.published,workspace,ids)
  return workspace
}
/** One consistent DB snapshot; no cache of operational availability or draft exposure. */
export async function readPublishedCatalog(restaurantId:string,options:{catalogOnly?:boolean}={}) {
 const rows=await db.execute(sql`SELECT r.name,r.settings,w.published,
 COALESCE((SELECT jsonb_agg(i.id) FROM menu_items i WHERE i.restaurant_id=r.id AND i.available=true),'[]'::jsonb) AS available
 FROM restaurants r LEFT JOIN menu_workspaces w ON w.restaurant_id=r.id WHERE r.id=${restaurantId} AND r.active=true LIMIT 1`)
 const row=rows[0];if(!row?.published)return null
 const workspace=publicWorkspace(row.published as Workspace,new Date(),{ignoreSchedules:options.catalogOnly===true,timezone:salesTimezone((row.settings as {timezone?:unknown}|null)?.timezone)})
 const ids=new Set(row.available as string[])
 applyPublicAvailability(row.published as Workspace,workspace,ids)
 return {workspace,restaurant:{name:String(row.name),settings:row.settings}}
}
/**
 * Regola 21/10: si vede tutto ciò che è attivo, anche vuoto. Un Menu/Sottomenu vuoto GIÀ nel documento pubblicato
 * (zero piatti, nascosti compresi, prima di esauriti e filtri) resta con `empty:true` → la pagina mostra «Menu in arrivo».
 * Un Menu che ha piatti nel documento ma oggi nessuno visibile (tutti esauriti/nascosti) sparisce come prima.
 * Un Sottomenu rimasto senza piatti per gli esauriti resta come prima (senza flag).
 */
export function applyPublicAvailability(published:Workspace,workspace:Workspace,ids:Set<string>){
  const rawMenus=new Map(published.menus.map(menu=>[menu.id,menu]))
  for(const menu of workspace.menus){
    for(const section of menu.sections)section.items=section.items.filter(item=>ids.has(item.id))
    const raw=rawMenus.get(menu.id)
    if(!raw)continue
    // Sottomenu vuoto nel documento: nessun piatto suo né dei sotto-livelli (in qualsiasi stato).
    const rawById=new Map(raw.sections.map(section=>[section.id,section]))
    const hasDishes=(id:string,seen=new Set<string>()):boolean=>{if(seen.has(id))return false;seen.add(id);const section=rawById.get(id);return !!section&&(section.items.length>0||raw.sections.some(child=>child.parentSectionId===id&&hasDishes(child.id,seen)))}
    for(const section of menu.sections)if(rawById.has(section.id)&&!hasDishes(section.id))(section as PublishedSection).empty=true
    if(!raw.sections.some(section=>section.items.length>0))(menu as PublishedMenuEntry).empty=true
  }
  workspace.menus=workspace.menus.filter(menu=>(menu as PublishedMenuEntry).empty===true||menu.sections.some(section=>section.items.length>0))
}
type PublishedMenuEntry=Workspace['menus'][number]&{empty?:boolean}
type PublishedSection=Workspace['menus'][number]['sections'][number]&{empty?:boolean}
/** Menu da aprire quando la richiesta non ne indica uno: il primo con piatti, altrimenti il primo («in arrivo»). */
export function defaultPublicMenu<T extends {sections:{items:unknown[]}[]}>(menus:T[]):T|undefined{
  return menus.find(menu=>!(menu as {empty?:boolean}).empty&&menu.sections.some(section=>section.items.length>0))??menus[0]
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
    ...((menu as PublishedMenuEntry).empty ? { empty: true } : {}),
    ...fixedPriceProjection(menu, language),
    sections: menu.sections.map(section => ({
      id: section.id, sourceName: section.name, name: translated(section)?.name || section.name,
      parentSectionId: section.parentSectionId, description: translated(section)?.description ?? section.description ?? undefined,
      ...fallback(section),
      ...((section as PublishedSection).empty ? { empty: true } : {}),
      items: section.items.map(item => ({
        id: item.id, name: translated(item)?.name || item.name,
        description: translated(item)?.description ?? item.description ?? undefined,
        ...fallback(item),
        price: item.price, imageUrl: item.imageUrl ?? undefined,
        allergens: item.allergens, tags: item.tags, additives: item.additives,
        available: item.available, displayMode:item.displayMode,externalLink:item.externalLink??undefined,priceDisplay:item.priceDisplay??undefined,
        variants: item.variants.filter(variant => variant.available).map(({id, name, priceModifier}) => ({id, name, priceModifier})),
        // F3+F4: già risolti da publicWorkspace (scaduti tolti); qui solo la forma pubblica.
        ...(item.promo ? { promoPrice: item.promo.price } : {}), ...(item.scarcity?.lastPortions ? { lastPortions: true } : {}), ...(item.scarcity?.onlyToday ? { onlyToday: true } : {}),
      })),
    })),
  }
}
/** Menu «a prezzo fisso» (21/10): opzioni e «Compreso» tradotti come nome/descrizione; alla carta nessun campo (identico a prima). */
export function fixedPriceProjection(menu: Workspace['menus'][number], language?: string): Pick<PublicMenu, 'pricing' | 'formulas' | 'included'> {
  if (!isFixed(menu)) return {}
  const formulas: PublicFormula[] = visibleFormulas(menu).map(formula => {
    const t = language ? formula.translations?.[language] : undefined
    const note = t?.description?.trim() || formula.note?.trim() || ''
    return { id: formula.id, name: t?.name?.trim() || formula.name.trim(), price: formula.price, ...(note ? { note } : {}) }
  })
  const included = (language ? menu.translations[language]?.included?.trim() : '') || menu.included?.trim() || ''
  return { pricing: 'fisso', formulas, ...(included ? { included } : {}) }
}
