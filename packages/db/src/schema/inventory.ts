import { pgTable, text, uuid, timestamp, real, boolean } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants'
import { users } from './users'

export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  quantity: real('quantity').default(0).notNull(),
  minQuantity: real('min_quantity').default(0).notNull(),
  costPerUnit: real('cost_per_unit'),
  supplier: text('supplier'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const inventoryMovements = pgTable('inventory_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull().references(() => inventoryItems.id),
  type: text('type', { enum: ['load', 'unload', 'adjustment', 'waste'] }).notNull(),
  quantity: real('quantity').notNull(),
  note: text('note'),
  userId: uuid('user_id').references(() => users.id),
  orderId: uuid('order_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
