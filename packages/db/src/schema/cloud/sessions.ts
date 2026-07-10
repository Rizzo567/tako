import { pgTable, uuid, text, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { cloudOwners } from './owners.js'

// Sessioni cloud dell'owner. Il token opaco vive solo lato client; a riposo si salva
// solo il token_hash HMAC (SEC-016). `credentialsVersion` è lo snapshot al momento della
// creazione: se l'owner bumpa credentials_version (reset/cambio-pw) la sessione è invalidata.
export const cloudSessions = pgTable('cloud_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => cloudOwners.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  // Retention/anonimizzazione GDPR (SEC-016).
  userAgent: text('user_agent'),
  ip: text('ip'),
  credentialsVersion: integer('credentials_version').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  tokenHashIdx: uniqueIndex('cloud_sessions_token_hash_idx').on(t.tokenHash),
  ownerIdx: index('cloud_sessions_owner_idx').on(t.ownerId),
}))
