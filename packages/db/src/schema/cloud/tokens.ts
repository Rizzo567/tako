import { pgTable, uuid, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { cloudOwners } from './owners.js'

// Token di verifica email. Salvati come HMAC-SHA256(token, PEPPER) a riposo (SEC-012).
// Single-use atomico via UPDATE ... WHERE consumed_at IS NULL RETURNING.
export const cloudEmailVerificationTokens = pgTable('cloud_email_verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => cloudOwners.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  tokenHashIdx: uniqueIndex('cloud_email_verification_token_hash_idx').on(t.tokenHash),
  ownerIdx: index('cloud_email_verification_owner_idx').on(t.ownerId),
}))

// Token di reset password. Stesse regole di sicurezza (HMAC a riposo, single-use atomico, TTL 1h).
export const cloudPasswordResetTokens = pgTable('cloud_password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => cloudOwners.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  tokenHashIdx: uniqueIndex('cloud_password_reset_token_hash_idx').on(t.tokenHash),
  ownerIdx: index('cloud_password_reset_owner_idx').on(t.ownerId),
}))
