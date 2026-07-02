import { db, bills, orders, tables, restaurants } from '@tako/db'
import { and, eq, inArray, sql } from 'drizzle-orm'

// I soldi sono in colonne float (`real`): arrotonda SEMPRE a 2 decimali nelle
// somme e nei confronti per evitare derive del tipo 30.299999... vs 30.30.
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// Stati ordine che concorrono al conto del tavolo. Definizione UNICA, usata sia
// dal flusso cliente sia dalla cassa, così le due viste non divergono mai.
// 'cancelled' e 'paid' sono esclusi per definizione.
export const BILLABLE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'served'] as const

// Coperto UNITARIO (€/persona) letto dalle impostazioni del ristorante. Il coperto
// contribuisce solo al totale (bills NON ha una colonna coverCharge dedicata: per
// non toccare lo schema DB, l'importo è calcolato al volo come covers × unitario e
// sommato nel `total`). Restituisce 0 se il coperto è disattivato o non configurato.
export async function coverUnit(restaurantId: string): Promise<number> {
  const [r] = await db.select({ settings: restaurants.settings }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
  const s = (r?.settings as any) ?? {}
  return s.coverChargeEnabled ? round2(Number(s.coverCharge ?? 0) || 0) : 0
}

// Fuso orario del ristorante per definire "la giornata" in modo coerente tra
// statistiche e conti (oggi, bucket giornalieri, parse from/to). Default Europe/Rome.
export async function restaurantTimezone(restaurantId: string): Promise<string> {
  const [r] = await db.select({ settings: restaurants.settings }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
  return ((r?.settings as any)?.timezone as string) || 'Europe/Rome'
}

// Offset (ms) del fuso `tz` all'istante `date`: (ora locale nel fuso) − (UTC).
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value
  const asUtc = Date.UTC(+map['year']!, +map['month']! - 1, +map['day']!, +map['hour']!, +map['minute']!, +map['second']!)
  return asUtc - date.getTime()
}

// Chiave giorno 'YYYY-MM-DD' di una data NEL fuso indicato.
export function dayKeyInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

// Istante UTC della mezzanotte locale (inizio giornata) di 'YYYY-MM-DD' nel fuso.
export function dayStartInTz(dayKey: string, tz: string): Date {
  const guess = new Date(`${dayKey}T00:00:00Z`)
  return new Date(guess.getTime() - tzOffsetMs(guess, tz))
}

// Istante UTC di fine giornata locale (23:59:59.999) di 'YYYY-MM-DD' nel fuso.
export function dayEndInTz(dayKey: string, tz: string): Date {
  return new Date(dayStartInTz(dayKey, tz).getTime() + 24 * 60 * 60 * 1000 - 1)
}

// Ricalcola subtotale e totale del conto APERTO di un tavolo a partire dagli
// ordini fatturabili. Va richiamata ad ogni evento che cambia gli importi:
// nuovo ordine, annullamento, cambio voci. Ritorna il bill aggiornato o null.
export async function recomputeOpenBill(restaurantId: string, tableId: string) {
  // Conto aperto più VECCHIO del tavolo (coerente con ensureOpenBill): se per un
  // qualsiasi motivo ne esistessero due, si opera sempre sullo stesso.
  const [bill] = await db.select().from(bills)
    .where(and(eq(bills.restaurantId, restaurantId), eq(bills.tableId, tableId), eq(bills.status, 'open')))
    .orderBy(bills.createdAt)
    .limit(1)
  if (!bill) return null

  const activeOrders = await db.select({ total: orders.total }).from(orders)
    .where(and(
      eq(orders.restaurantId, restaurantId),
      eq(orders.tableId, tableId),
      inArray(orders.status, [...BILLABLE_STATUSES]),
    ))
  const subtotal = round2(activeOrders.reduce((s, o) => s + o.total, 0))
  // Riclampa lo sconto al subtotale RICALCOLATO: se gli ordini vengono annullati e
  // il subtotale scende sotto lo sconto salvato, senza riclamp il totale diventerebbe
  // NEGATIVO. Persistiamo anche lo sconto clampato per coerenza.
  const discount = Math.min(bill.discount ?? 0, subtotal)
  // Coperto = coperti × unitario (dalle impostazioni). Nessuna colonna dedicata:
  // entra solo nel totale (vedi coverUnit).
  const coverCharge = round2((bill.covers ?? 1) * (await coverUnit(restaurantId)))
  const total = round2(subtotal - discount + (bill.tip ?? 0) + coverCharge)

  await db.update(bills).set({ subtotal, discount, total }).where(eq(bills.id, bill.id))
  return { ...bill, subtotal, discount, total }
}

// Get-or-create del conto aperto di un tavolo, ATOMICO e a prova di concorrenza.
// Senza un vincolo unique sui conti aperti, due ordini paralleli sullo stesso
// tavolo creavano conti duplicati con subtotali incoerenti: qui un advisory lock
// Postgres per (ristorante,tavolo) serializza il check+insert+ricalcolo.
export async function ensureOpenBill(restaurantId: string, tableId: string) {
  // Coperto unitario letto FUORI dalla transazione (le impostazioni cambiano di rado).
  const unit = await coverUnit(restaurantId)
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${restaurantId + ':' + tableId}))`)
    const rows = await tx.select({ total: orders.total }).from(orders).where(and(
      eq(orders.restaurantId, restaurantId),
      eq(orders.tableId, tableId),
      inArray(orders.status, [...BILLABLE_STATUSES]),
    ))
    const subtotal = round2(rows.reduce((s, o) => s + o.total, 0))
    const [existing] = await tx.select().from(bills)
      .where(and(eq(bills.restaurantId, restaurantId), eq(bills.tableId, tableId), eq(bills.status, 'open')))
      .orderBy(bills.createdAt).limit(1)
    if (existing) {
      // Riclampa lo sconto al subtotale ricalcolato (vedi recomputeOpenBill): evita
      // totale negativo quando il subtotale scende sotto lo sconto salvato.
      const discount = Math.min(existing.discount ?? 0, subtotal)
      const coverCharge = round2((existing.covers ?? 1) * unit)
      const total = round2(subtotal - discount + (existing.tip ?? 0) + coverCharge)
      await tx.update(bills).set({ subtotal, discount, total }).where(eq(bills.id, existing.id))
      return existing.id
    }
    // numero + posti del tavolo sul conto: covers reali = posti del tavolo (default),
    // il numero altrimenti la cassa mostra "Tavolo —".
    const [tbl] = await tx.select({ number: tables.number, seats: tables.seats }).from(tables).where(eq(tables.id, tableId)).limit(1)
    const covers = tbl?.seats ?? 1
    const coverCharge = round2(covers * unit)
    const total = round2(subtotal + coverCharge)
    const [created] = await tx.insert(bills).values({ restaurantId, tableId, tableNumber: tbl?.number ?? null, covers, subtotal, total, status: 'open' }).returning()
    return created!.id
  })
}
