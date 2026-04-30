import { pgTable, text, uuid, timestamp, boolean, integer, real, jsonb } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants.js'

export const menus = pgTable('menus', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type', { enum: ['main', 'lunch', 'dinner', 'seasonal', 'event', 'drinks'] }).default('main').notNull(),
  active: boolean('active').default(true).notNull(),
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const menuSections = pgTable('menu_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  menuId: uuid('menu_id').notNull().references(() => menus.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameTranslations: jsonb('name_translations').default({}).$type<Record<string, string>>(),
  description: text('description'),
  position: integer('position').default(0).notNull(),
  active: boolean('active').default(true).notNull(),
})

export const menuItems = pgTable('menu_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id').notNull().references(() => menuSections.id, { onDelete: 'cascade' }),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  name: text('name').notNull(),
  nameTranslations: jsonb('name_translations').default({}).$type<Record<string, string>>(),
  description: text('description'),
  descriptionTranslations: jsonb('description_translations').default({}).$type<Record<string, string>>(),
  price: real('price').notNull(),
  imageUrl: text('image_url'),
  allergens: text('allergens').array().default([]),
  tags: text('tags').array().default([]),
  calories: integer('calories'),
  available: boolean('available').default(true).notNull(),
  featured: boolean('featured').default(false).notNull(),
  position: integer('position').default(0).notNull(),
  kitchenStation: text('kitchen_station'),
  prepTimeMinutes: integer('prep_time_minutes').default(10),
  costPrice: real('cost_price'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const itemVariants = pgTable('item_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  priceModifier: real('price_modifier').default(0).notNull(),
  available: boolean('available').default(true).notNull(),
})
