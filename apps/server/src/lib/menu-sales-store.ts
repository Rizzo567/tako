// F4: «quando il piatto diventa esaurito, l'etichetta Ultime porzioni si rimuove» anche dall'esaurito OPERATIVO
// (PATCH /menus/items/:id/availability, schermata Gestione), che non passa dal documento del menu (UNKNOWNS B5).
// Tocca solo la chiave scarcity del piatto in bozza e pubblicato, senza cambiare revisione: un editor aperto non va in conflitto.
import { db, type DB } from '@tako/db'
import { sql } from 'drizzle-orm'

type Doc = { menus?: { sections?: { items?: { id: string, scarcity?: { lastPortions?: boolean, onlyToday?: string | null } }[] }[] }[] } | null
export function stripLastPortions(doc: Doc, itemId: string): boolean {
  let changed = false
  for (const menu of doc?.menus ?? []) for (const section of menu.sections ?? []) for (const item of section.items ?? []) {
    if (item.id !== itemId || !item.scarcity?.lastPortions) continue
    item.scarcity.lastPortions = false; if (!item.scarcity.onlyToday) delete item.scarcity; changed = true
  }
  return changed
}
export async function clearLastPortionsOnSoldOut(restaurantId: string, itemId: string, connection: Pick<DB, 'transaction'> = db): Promise<boolean> {
  return connection.transaction(async tx => {
    const rows = await tx.execute(sql`SELECT draft,published FROM menu_workspaces WHERE restaurant_id=${restaurantId} FOR UPDATE`)
    const row = rows[0] as { draft: Doc, published: Doc } | undefined
    if (!row) return false
    const draft = stripLastPortions(row.draft, itemId), published = stripLastPortions(row.published, itemId)
    if (draft) await tx.execute(sql`UPDATE menu_workspaces SET draft=${JSON.stringify(row.draft)}::jsonb WHERE restaurant_id=${restaurantId}`)
    if (published) await tx.execute(sql`UPDATE menu_workspaces SET published=${JSON.stringify(row.published)}::jsonb WHERE restaurant_id=${restaurantId}`)
    return draft || published
  })
}
