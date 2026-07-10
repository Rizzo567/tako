import { pgTable, uuid, text, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { cloudOwners } from './owners.js'

// Registry dei ristoranti nel cloud (il dato operativo completo resta sull'appliance locale).
export const cloudRestaurants = pgTable('cloud_restaurants', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => cloudOwners.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan', { enum: ['free', 'pro', 'enterprise'] }).default('free').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  slugIdx: uniqueIndex('cloud_restaurants_slug_idx').on(t.slug),
  ownerIdx: index('cloud_restaurants_owner_idx').on(t.ownerId),
}))

// Appliance locali collegate a un ristorante via pairing (device-code + proof-of-possession).
export const cloudAppliances = pgTable('cloud_appliances', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => cloudRestaurants.id, { onDelete: 'cascade' }),
  // Chiave pubblica dell'appliance per proof-of-possession (SEC-003).
  pubkey: text('pubkey').notNull(),
  publicLabel: text('public_label'),
  // Ultima credentials_version vista dall'appliance (heartbeat).
  seenCredentialsVersion: integer('seen_credentials_version').default(0).notNull(),
  // Rete LAN CORRENTE pubblicata dall'appliance via heartbeat: il resolver pubblico
  // `/t/:applianceId` reindirizza qui il QR stabile del tavolo. lanIp è validato RFC1918
  // in scrittura (heartbeat) e in lettura (resolver) → nessun open-redirect. lanHost è il
  // nome mDNS stabile (`tako.local`) usato come fallback LAN indipendente dall'IP.
  lanIp: text('lan_ip'),
  clientPort: integer('client_port'),
  lanHost: text('lan_host'),
  pairedAt: timestamp('paired_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => ({
  restaurantIdx: index('cloud_appliances_restaurant_idx').on(t.restaurantId),
  pubkeyIdx: uniqueIndex('cloud_appliances_pubkey_idx').on(t.pubkey),
}))

// Codici di pairing (device-code flow con conferma owner — SEC-003). code_hash = HMAC, TTL 10min.
export const cloudPairingCodes = pgTable('cloud_pairing_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => cloudOwners.id, { onDelete: 'cascade' }),
  restaurantId: uuid('restaurant_id').notNull().references(() => cloudRestaurants.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull().unique(),
  // Pubkey proposta dall'appliance al claim.
  devicePubkey: text('device_pubkey'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  codeHashIdx: uniqueIndex('cloud_pairing_codes_code_hash_idx').on(t.codeHash),
  ownerIdx: index('cloud_pairing_codes_owner_idx').on(t.ownerId),
  restaurantIdx: index('cloud_pairing_codes_restaurant_idx').on(t.restaurantId),
}))
