import { pgTable, text, uuid, timestamp, index } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants.js'
import { users } from './users.js'

export const staffShifts = pgTable('staff_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  // endsAt nullable = turno ancora aperto (in corso).
  endsAt: timestamp('ends_at', { withTimezone: true }),
  role: text('role'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  restaurantStartsAtIdx: index('staff_shifts_restaurant_starts_at_idx').on(t.restaurantId, t.startsAt),
}))
