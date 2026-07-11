import { db, restaurants, orderItems, recipes, inventoryItems } from '@tako/db'
import { and, eq, inArray, sql } from 'drizzle-orm'

// Scarico automatico del magazzino da ricetta. Chiamato quando un ordine passa a
// 'confirmed'. Gated dal flag settings.autoStockDeductEnabled (default OFF): se OFF, no-op.
//
// BEST-EFFORT: tutto in try/catch, NON lancia MAI. Un errore qui (flag mancante, ricetta
// incompleta, race sul magazzino) non deve mai rompere la conferma ordine — lo scarico
// scorte è un effetto collaterale, non parte della transazione dell'ordine.
//
// Va chiamato UNA sola volta per ordine, al passaggio a 'confirmed' (vedi hook nelle route).
export async function deductStockForOrder(restaurantId: string, orderId: string): Promise<void> {
  try {
    // 1) Flag del ristorante: se lo scarico automatico è OFF, non fare nulla.
    const [row] = await db.select({ settings: restaurants.settings }).from(restaurants)
      .where(eq(restaurants.id, restaurantId)).limit(1)
    if ((row?.settings as any)?.autoStockDeductEnabled !== true) return

    // 2) Voci dell'ordine (piatto + quantità ordinata). Ignora le voci senza menuItemId.
    const items = await db.select({ menuItemId: orderItems.menuItemId, quantity: orderItems.quantity })
      .from(orderItems).where(eq(orderItems.orderId, orderId))
    const menuItemIds = Array.from(new Set(items.map(i => i.menuItemId).filter((v): v is string => !!v)))
    if (!menuItemIds.length) return

    // 3) Ricette dei piatti ordinati (scoped al ristorante).
    const recipeRows = await db.select({
      menuItemId: recipes.menuItemId,
      inventoryItemId: recipes.inventoryItemId,
      quantity: recipes.quantity,
    }).from(recipes).where(and(
      eq(recipes.restaurantId, restaurantId),
      inArray(recipes.menuItemId, menuItemIds),
    ))
    if (!recipeRows.length) return

    // 4) Somma il fabbisogno per ingrediente: Σ (qtà piatto ordinata × qtà ingrediente in ricetta).
    const needByInventory = new Map<string, number>()
    for (const it of items) {
      if (!it.menuItemId) continue
      const orderedQty = Number(it.quantity) || 0
      if (orderedQty <= 0) continue
      for (const r of recipeRows) {
        if (r.menuItemId !== it.menuItemId) continue
        const per = Number(r.quantity) || 0
        if (per <= 0) continue
        needByInventory.set(r.inventoryItemId, (needByInventory.get(r.inventoryItemId) ?? 0) + per * orderedQty)
      }
    }
    if (!needByInventory.size) return

    // 5) Scala ogni ingrediente, mai sotto zero (GREATEST(0, ...)). Best-effort: se una
    //    UPDATE fallisce, prosegui con le altre (nessuna transazione atomica: lo scarico
    //    scorte non deve legarsi al successo/fallimento delle altre righe).
    for (const [inventoryItemId, delta] of needByInventory) {
      if (delta <= 0) continue
      try {
        await db.update(inventoryItems).set({
          quantity: sql`GREATEST(0, ${inventoryItems.quantity} - ${delta})`,
          updatedAt: new Date(),
        }).where(and(
          eq(inventoryItems.id, inventoryItemId),
          eq(inventoryItems.restaurantId, restaurantId),
        ))
      } catch { /* singolo ingrediente best-effort */ }
    }
  } catch { /* scarico scorte best-effort: non deve mai propagare errori */ }
}
