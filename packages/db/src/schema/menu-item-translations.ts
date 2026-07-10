import { pgTable, text, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants.js'
import { menuItems } from './menu.js'

export const menuItemTranslations = pgTable('menu_item_translations', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  lang: text('lang').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // Una sola traduzione per (item, lingua).
  itemLangUnique: unique('menu_item_translations_item_lang_unique').on(t.itemId, t.lang),
}))
