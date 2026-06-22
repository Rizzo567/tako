// Migrazione 0006: soldi real(float)→numeric(10,2), indici sulle query calde,
// unique sul numero tavolo. Idempotente. Run: node migrate-0006.mjs
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://tako:tako@localhost:5432/takodb')

const moneyCols = [
  ['bills', 'subtotal'], ['bills', 'discount'], ['bills', 'tip'], ['bills', 'total'],
  ['bill_payments', 'amount'],
  ['orders', 'total'],
  ['order_items', 'unit_price'],
  ['menu_items', 'price'], ['menu_items', 'cost_price'],
  ['item_variants', 'price_modifier'],
  ['inventory_items', 'cost_per_unit'],
]

for (const [table, col] of moneyCols) {
  await sql.unsafe(`ALTER TABLE ${table} ALTER COLUMN ${col} TYPE numeric(10,2) USING ${col}::numeric(10,2)`)
  console.log(`[0006] ${table}.${col} → numeric(10,2)`)
}

await sql.unsafe(`CREATE INDEX IF NOT EXISTS orders_restaurant_table_status_idx ON orders (restaurant_id, table_id, status)`)
await sql.unsafe(`CREATE INDEX IF NOT EXISTS bills_restaurant_table_status_idx ON bills (restaurant_id, table_id, status)`)
console.log('[0006] indici (restaurant,table,status) creati')

// Unique numero tavolo per ristorante (solo se non già presente).
const dupes = await sql`
  select restaurant_id, number, count(*) from tables group by restaurant_id, number having count(*) > 1`
if (dupes.length) {
  console.log(`[0006] ATTENZIONE: ${dupes.length} numeri tavolo duplicati — unique constraint saltato. Risolvere prima i duplicati.`)
} else {
  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tables_restaurant_number_unique') THEN
        ALTER TABLE tables ADD CONSTRAINT tables_restaurant_number_unique UNIQUE (restaurant_id, number);
      END IF;
    END $$;`)
  console.log('[0006] unique(restaurant_id, number) su tables')
}

console.log('[0006] done')
await sql.end()
