import { db, bills, orders } from '@tako/db'
import { and, eq, inArray } from 'drizzle-orm'

// I soldi sono in colonne float (`real`): arrotonda SEMPRE a 2 decimali nelle
// somme e nei confronti per evitare derive del tipo 30.299999... vs 30.30.
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// Stati ordine che concorrono al conto del tavolo. Definizione UNICA, usata sia
// dal flusso cliente sia dalla cassa, così le due viste non divergono mai.
// 'cancelled' e 'paid' sono esclusi per definizione.
export const BILLABLE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'served'] as const

// Ricalcola subtotale e totale del conto APERTO di un tavolo a partire dagli
// ordini fatturabili. Va richiamata ad ogni evento che cambia gli importi:
// nuovo ordine, annullamento, cambio voci. Ritorna il bill aggiornato o null.
export async function recomputeOpenBill(restaurantId: string, tableId: string) {
  const [bill] = await db.select().from(bills)
    .where(and(eq(bills.restaurantId, restaurantId), eq(bills.tableId, tableId), eq(bills.status, 'open')))
    .limit(1)
  if (!bill) return null

  const activeOrders = await db.select({ total: orders.total }).from(orders)
    .where(and(
      eq(orders.restaurantId, restaurantId),
      eq(orders.tableId, tableId),
      inArray(orders.status, [...BILLABLE_STATUSES]),
    ))
  const subtotal = round2(activeOrders.reduce((s, o) => s + o.total, 0))
  const total = round2(subtotal - (bill.discount ?? 0) + (bill.tip ?? 0))

  await db.update(bills).set({ subtotal, total }).where(eq(bills.id, bill.id))
  return { ...bill, subtotal, total }
}
