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
  aiEnabled?: boolean
}
