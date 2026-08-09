import { pgTable, text, uuid, timestamp, boolean, integer, unique } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants.js'
import { users } from './users.js'

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').default(0).notNull(),
  active: boolean('active').default(true).notNull(),
})

export const tables = pgTable('tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  roomId: uuid('room_id').references(() => rooms.id),
  number: text('number').notNull(),
  seats: integer('seats').default(4).notNull(),
  shape: text('shape', { enum: ['round', 'square', 'rectangle'] }).default('square'),
  qrToken: text('qr_token').notNull().unique(),
  status: text('status', { enum: ['free', 'occupied', 'waiting', 'cleaning', 'reserved'] }).default('free').notNull(),
  assignedWaiterId: uuid('assigned_waiter_id').references(() => users.id),
  openedAt: timestamp('opened_at'),
  active: boolean('active').default(true).notNull(),
  posX: integer('pos_x').default(0),
  posY: integer('pos_y').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  // Niente due tavoli con lo stesso numero nello stesso ristorante.
  restaurantNumberUnique: unique('tables_restaurant_number_unique').on(t.restaurantId, t.number),
}))

// Chiamate cameriere PERSISTITE (migrazione 0017). Prima erano solo un emit socket:
// un dispositivo che si collegava dopo la chiamata non la vedeva mai. Una sola
// chiamata aperta per tavolo (indice unico parziale su resolved_at IS NULL).
export const waiterCalls = pgTable('waiter_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  tableId: uuid('table_id').notNull().references(() => tables.id, { onDelete: 'cascade' }),
  tableNumber: text('table_number'),
  type: text('type', { enum: ['help', 'bill', 'water'] }).default('help').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by').references(() => users.id),
})
