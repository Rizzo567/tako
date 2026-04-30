import { pgTable, text, uuid, timestamp, real, integer } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants.js'
import { tables } from './tables.js'
import { users } from './users.js'

export const bills = pgTable('bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  tableId: uuid('table_id').references(() => tables.id),
  tableNumber: text('table_number'),
  subtotal: real('subtotal').notNull(),
  discount: real('discount').default(0),
  discountNote: text('discount_note'),
  tip: real('tip').default(0),
  total: real('total').notNull(),
  covers: integer('covers').default(1),
  status: text('status', { enum: ['open', 'closed', 'refunded'] }).default('open').notNull(),
  closedBy: uuid('closed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
})

export const billPayments = pgTable('bill_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: uuid('bill_id').notNull().references(() => bills.id),
  amount: real('amount').notNull(),
  method: text('method', { enum: ['cash', 'card', 'digital', 'split'] }).notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  status: text('status', { enum: ['pending', 'completed', 'failed', 'refunded'] }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
