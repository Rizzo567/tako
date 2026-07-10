import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { cloudOwners } from './owners.js'

// Audit log di sicurezza (SEC §7bis): login/reset/link-OAuth/claim/cambio-password.
// owner_id nullable: alcuni eventi (es. tentativi su email inesistente) non hanno owner.
// onDelete 'set null' per preservare la traccia anche dopo cancellazione owner (GDPR erasure).
export const cloudAuditLog = pgTable('cloud_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').references(() => cloudOwners.id, { onDelete: 'set null' }),
  event: text('event').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  meta: jsonb('meta').default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  ownerIdx: index('cloud_audit_log_owner_idx').on(t.ownerId),
  eventCreatedIdx: index('cloud_audit_log_event_created_idx').on(t.event, t.createdAt),
}))
