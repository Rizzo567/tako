import { pgTable, uuid, text, boolean, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

// Sorgente di verità dell'identità owner nel cloud control-plane.
// Vedi MASTER_PLAN-cloud-auth §3.1.
export const cloudOwners = pgTable('cloud_owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  // email normalizzata lowercase/trim a livello applicativo (SEC-015).
  email: text('email').notNull().unique(),
  // null se l'owner è solo-OAuth (nessuna password impostata) — SEC-014.
  passwordHash: text('password_hash'),
  name: text('name'),
  emailVerified: boolean('email_verified').default(false).notNull(),
  // Opt-in newsletter espresso alla registrazione (sito o appliance). L'iscrizione
  // alla Resend Audience avviene SOLO dopo la verifica email (double opt-in di fatto).
  newsletterOptIn: boolean('newsletter_opt_in').default(false).notNull(),
  // Bump su reset/cambio-pw/unlink → invalida sessioni e login offline appliance (SEC-007).
  credentialsVersion: integer('credentials_version').default(0).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  emailIdx: uniqueIndex('cloud_owners_email_idx').on(t.email),
}))

// Account OAuth (Google/GitHub) collegati a un owner cloud.
export const cloudOauthAccounts = pgTable('cloud_oauth_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => cloudOwners.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['google', 'github'] }).notNull(),
  providerUserId: text('provider_user_id').notNull(),
  emailAtProvider: text('email_at_provider'),
  // true solo se il provider conferma la verifica email (SEC-002).
  emailVerifiedAtProvider: boolean('email_verified_at_provider').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // Un provider+account esterno appartiene a un solo owner.
  providerUserIdx: uniqueIndex('cloud_oauth_provider_user_idx').on(t.provider, t.providerUserId),
  // Un owner ha al massimo un account per provider.
  ownerProviderIdx: uniqueIndex('cloud_oauth_owner_provider_idx').on(t.ownerId, t.provider),
}))
