import { pgTable, text, uuid, timestamp, boolean, index } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants.js'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  role: text('role', { enum: ['owner', 'dipendente', 'chef', 'cassiere'] }).notNull(),
  pin: text('pin'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  active: boolean('active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  restaurantActiveIdx: index('users_restaurant_active_idx').on(t.restaurantId, t.active),
}))

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
