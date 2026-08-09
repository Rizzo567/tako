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
  // 'staff' = dashboard (90 giorni, rolling); 'mobile' = telefono arruolato via QR
  // (30 giorni, rolling — un telefono si perde più facilmente). Vedi migrazione 0017.
  kind: text('kind', { enum: ['staff', 'mobile'] }).default('staff').notNull(),
  // Metadati mostrati in "Dispositivi": servono a riconoscere QUALE telefono revocare.
  deviceName: text('device_name'),
  devicePlatform: text('device_platform'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userKindIdx: index('sessions_user_kind_idx').on(t.userId, t.kind),
}))

// Codici di arruolamento del telefono (F2.1). Stessa disciplina del device-code
// cloud (routes/cloud/pair.ts): alta entropia, HMAC a riposo (mai il codice in
// chiaro), TTL breve, single-use atomico.
export const deviceEnrollCodes = pgTable('device_enroll_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  sessionId: uuid('session_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// Subscription Web Push del telefono arruolato (F3.1, migrazione 0018).
// Il legame con `sessions` è ON DELETE CASCADE: revocare il dispositivo spegne le
// sue notifiche senza che nessun codice se ne debba ricordare.
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  // Errori CONSECUTIVI (azzerato a ogni successo): 404/410 cancellano subito, il
  // contatore pota le subscription che falliscono per sempre senza dire mai 410.
  failCount: integer('fail_count').default(0).notNull(),
}, (t) => ({
  restaurantIdx: index('push_subscriptions_restaurant_idx').on(t.restaurantId),
  sessionIdx: index('push_subscriptions_session_idx').on(t.sessionId),
}))
