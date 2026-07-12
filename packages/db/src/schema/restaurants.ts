import { pgTable, text, uuid, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core'

export const restaurants = pgTable('restaurants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  logoUrl: text('logo_url'),
  coverUrl: text('cover_url'),
  primaryColor: text('primary_color').default('#ED7159'),
  plan: text('plan', { enum: ['free', 'pro', 'enterprise'] }).default('free').notNull(),
  planExpiresAt: timestamp('plan_expires_at'),
  settings: jsonb('settings').default({}).$type<RestaurantSettings>(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type RestaurantSettings = {
  currency?: string
  timezone?: string
  vatRate?: number
  languages?: string[]
  defaultLanguage?: string
  tableServiceEnabled?: boolean
  takeawayEnabled?: boolean
  payAtTableEnabled?: boolean
  reservationsEnabled?: boolean          // prenotazioni self-service dai clienti
  aiEnabled?: boolean
  printerIp?: string
  printerPort?: number
  autoPrint?: boolean                    // stampa automatica comande/ricevute
  // ── Feature flag (default OFF salvo dove indicato): il ristorante le attiva a scelta ──
  loyaltyEnabled?: boolean               // fedeltà / punti
  reviewRequestEnabled?: boolean         // richiesta recensione post-pagamento
  reviewUrl?: string                     // link recensione (es. Google) per la richiesta
  autoStockDeductEnabled?: boolean       // scarico automatico magazzino da ricetta
  dailyBriefingEnabled?: boolean         // briefing proattivo WhatsApp programmato
  dailyBriefingHour?: number             // ora del briefing (0-23, default 9)
  aiContentEnabled?: boolean             // generazione AI descrizioni/traduzioni (default ON)
  aiPhotoEnabled?: boolean               // foto piatto stilizzata AI (Nano Banana/Gemini, richiede GEMINI_API_KEY)
  menuEngineeringEnabled?: boolean       // analisi menu engineering (default ON)
}
