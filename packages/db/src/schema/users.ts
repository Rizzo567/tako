import { pgTable, text, uuid, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core'
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
  // Identità unificata sito↔app (cloud control-plane). Vedi MASTER_PLAN-cloud-auth §3.2.
  emailVerified: boolean('email_verified').default(false).notNull(),
  // Link all'identità owner nel cloud (cloud_owners.id). null per lo staff locale.
  cloudOwnerId: uuid('cloud_owner_id'),
  // Credenziale owner LOCALE dedicata per il login offline (SEC-001): NON è l'hash cloud.
  localOwnerSecretHash: text('local_owner_secret_hash'),
  // Confrontata col cloud all'heartbeat per invalidare il login offline dopo reset/cambio-pw.
  credentialsVersion: integer('credentials_version').default(0).notNull(),
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
