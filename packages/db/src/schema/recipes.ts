import { pgTable, uuid, timestamp, real, unique } from 'drizzle-orm/pg-core'
import { restaurants } from './restaurants.js'
import { menuItems } from './menu.js'
import { inventoryItems } from './inventory.js'

// Ricetta: collega un piatto a ingredienti d'inventario + quantità per singola unità di
// piatto. Alla conferma di un ordine, se il flag settings.autoStockDeductEnabled è ON, gli
// ingredienti vengono scalati dal magazzino (best-effort). La quantità usa `real` come
// inventoryItems.quantity, per coerenza di tipo numerico.
export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  menuItemId: uuid('menu_item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  inventoryItemId: uuid('inventory_item_id').notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  quantity: real('quantity').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // Una riga per coppia piatto↔ingrediente → upsert su (menuItemId, inventoryItemId).
  menuItemInventoryUnique: unique('recipes_menu_item_inventory_unique').on(t.menuItemId, t.inventoryItemId),
}))
