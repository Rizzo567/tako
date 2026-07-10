import { pgTable, text, uuid, timestamp, integer, index } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants.js'
import { tables } from './tables.js'

export const reservations = pgTable('reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  tableId: uuid('table_id').references(() => tables.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  partySize: integer('party_size').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  durationMin: integer('duration_min').default(90).notNull(),
  status: text('status', {
    enum: ['requested', 'confirmed', 'seated', 'no_show', 'cancelled'],
  }).default('requested').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  restaurantStartsAtIdx: index('reservations_restaurant_starts_at_idx').on(t.restaurantId, t.startsAt),
  tableStartsAtIdx: index('reservations_table_starts_at_idx').on(t.tableId, t.startsAt),
}))
