import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants.js'
import { tables } from './tables.js'

export const tableSessions = pgTable('table_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  tableId: uuid('table_id').references(() => tables.id, { onDelete: 'set null' }),
  tableNumber: text('table_number').notNull(),
  scannedAt: timestamp('scanned_at', { withTimezone: true }).defaultNow().notNull(),
  firstOrderAt: timestamp('first_order_at', { withTimezone: true }),
  timeToFirstOrderSec: integer('time_to_first_order_sec'),
}, (t) => ({
  restaurantScannedIdx: index('table_sessions_restaurant_scanned_idx').on(t.restaurantId, t.scannedAt),
  tableScannedIdx: index('table_sessions_table_scanned_idx').on(t.tableId, t.scannedAt),
}))
