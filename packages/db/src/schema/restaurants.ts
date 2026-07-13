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
  aiPhotoEnabled?: boolean               // foto piatto stilizzata AI (base/flash) — richiede GEMINI_API_KEY
  aiPhotoProCode?: string                // codice Pro firmato (Ed25519) → sblocca il modello Nano Banana Pro
  menuEngineeringEnabled?: boolean       // analisi menu engineering (default ON)
  // ── Coperto / cassa / UX ──
  coverCharge?: number                   // coperto a persona (€)
  coverChargeEnabled?: boolean           // coperto attivo
  suggestedTips?: boolean                // mostra mance suggerite in cassa
  orderSounds?: boolean                  // suoni nuovi ordini
  autoConfirm?: boolean                  // ordini cliente nascono già 'confirmed'
  kdsWarnMinutes?: number                // KDS: soglia "in ritardo" (warn)
  kdsLateMinutes?: number                // KDS: soglia "molto in ritardo"
  kdsCompact?: boolean                   // KDS layout compatto
  showOnboarding?: boolean               // mostra la checklist di onboarding
  // ── Resilienza rete ──
  qrMode?: 'lan' | 'cloud'               // QR tavolo: 'lan' (default, tako.local, resiliente a internet giù) | 'cloud' (resolver pubblico)
  customerOrderingEnabled?: boolean      // self-service ordini cliente (default ON); spegnilo se la rete non regge → menu in sola lettura
}
