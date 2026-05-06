/**
 * RLS (Row Level Security) helper for Tako.
 *
 * Sets the PostgreSQL session variable `app.current_restaurant_id` so that
 * all RLS policies activate for the duration of the wrapped function call.
 *
 * Usage:
 *   const result = await withRestaurantContext(restaurantId, async () => {
 *     return db.select().from(orders).where(...)
 *   })
 */

import { sql } from 'drizzle-orm'
import { db } from './client.js'

/**
 * Wrap a database operation in a transaction with the restaurant RLS context set.
 *
 * Internally runs:
 *   BEGIN;
 *   SET LOCAL app.current_restaurant_id = '<restaurantId>';
 *   <fn()>
 *   COMMIT;
 *
 * `SET LOCAL` means the variable is automatically reset at transaction end,
 * so there is no risk of context leaking across requests.
 */
export async function withRestaurantContext<T>(
  restaurantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // SET LOCAL is scoped to the current transaction — safe for connection pooling
    await tx.execute(
      sql`SET LOCAL app.current_restaurant_id = ${restaurantId}`,
    )
    return fn()
  })
}

/**
 * Build a raw SQL fragment that sets the restaurant context.
 * Useful when you need to embed the SET inside a larger SQL block.
 */
export function restaurantContextSql(restaurantId: string) {
  return sql`SET LOCAL app.current_restaurant_id = ${restaurantId}`
}
