import { pgTable, text, uuid, timestamp, integer, unique } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants.js'

// Fedeltà a punti per numero di telefono. Un account = un numero, scoped al ristorante.
// Pilotata dal copilot (lo staff aggiunge/consulta/riscatta punti): NESSUN hook automatico
// sul pagamento, così non tocca il flusso conti. Gated dal flag settings.loyaltyEnabled.
export const loyaltyAccounts = pgTable('loyalty_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  phone: text('phone').notNull(),
  name: text('name'),
  points: integer('points').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // Un solo account per numero per ristorante → upsert deterministico su (restaurantId, phone).
  restaurantPhoneUnique: unique('loyalty_accounts_restaurant_phone_unique').on(t.restaurantId, t.phone),
}))
