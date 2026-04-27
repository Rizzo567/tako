import { pgTable, text, uuid, timestamp, boolean, integer } from 'drizzle-orm/pg-core'
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
})
