import { pgTable, text, uuid, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants.js'
import { tables } from './tables.js'
import { menuItems, itemVariants } from './menu.js'
import { users } from './users.js'
import { money } from './money.js'

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  tableId: uuid('table_id').references(() => tables.id),
  tableNumber: text('table_number'),
  type: text('type', { enum: ['table', 'takeaway'] }).default('table').notNull(),
  status: text('status', {
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'],
  }).default('pending').notNull(),
  total: money('total').notNull(),
  notes: text('notes'),
  customerName: text('customer_name'),
  assignedWaiterId: uuid('assigned_waiter_id').references(() => users.id),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  servedAt: timestamp('served_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
}, (t) => ({
  restaurantStatusIdx: index('orders_restaurant_status_idx').on(t.restaurantId, t.status),
  restaurantCreatedAtIdx: index('orders_restaurant_created_at_idx').on(t.restaurantId, t.createdAt),
  restaurantTableStatusIdx: index('orders_restaurant_table_status_idx').on(t.restaurantId, t.tableId, t.status),
}))

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  menuItemId: uuid('menu_item_id').references(() => menuItems.id),
  variantId: uuid('variant_id').references(() => itemVariants.id),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: money('unit_price').notNull(),
  notes: text('notes'),
  kitchenStation: text('kitchen_station'),
  status: text('status', {
    enum: ['pending', 'preparing', 'ready', 'served'],
  }).default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // JOIN order_items↔orders (insights /menu): senza indice era un seq scan.
  orderIdIdx: index('order_items_order_id_idx').on(t.orderId),
}))

export const orderStatusHistory = pgTable('order_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  changedBy: uuid('changed_by').references(() => users.id),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
