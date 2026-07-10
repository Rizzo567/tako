-- Migration 0006: soldi real(float) → numeric(10,2), indici sulle query calde,
-- unique(restaurant_id, number) sui tavoli. Porta nel sistema Drizzle lo script
-- manuale migrate-0006.mjs. IDEMPOTENTE: i DB dev esistenti potrebbero averlo
-- già eseguito a mano, quindi ogni passo controlla lo stato prima di agire.

-- 1) Colonne soldi → numeric(10,2). Convertiamo SOLO se il tipo attuale non è
--    già numeric: niente riscrittura inutile della tabella su DB già migrati.
DO $$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT * FROM (VALUES
      ('bills', 'subtotal'),
      ('bills', 'discount'),
      ('bills', 'tip'),
      ('bills', 'total'),
      ('bill_payments', 'amount'),
      ('orders', 'total'),
      ('order_items', 'unit_price'),
      ('menu_items', 'price'),
      ('menu_items', 'cost_price'),
      ('item_variants', 'price_modifier'),
      ('inventory_items', 'cost_per_unit')
    ) AS t(tbl, colname)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = col.tbl
        AND c.column_name = col.colname
        AND c.data_type <> 'numeric'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE numeric(10,2) USING %I::numeric(10,2)',
        col.tbl, col.colname, col.colname
      );
    END IF;
  END LOOP;
END
$$;

-- 2) Indici sulle query calde (restaurant, table, status).
CREATE INDEX IF NOT EXISTS "orders_restaurant_table_status_idx" ON "orders" ("restaurant_id", "table_id", "status");
CREATE INDEX IF NOT EXISTS "bills_restaurant_table_status_idx" ON "bills" ("restaurant_id", "table_id", "status");

-- 3) Niente due tavoli con lo stesso numero nello stesso ristorante.
--    Se un DB pre-esistente ha già duplicati, NON facciamo fallire la migrazione
--    (bloccherebbe ogni avvio): warning e skip, come lo script manuale. Sui DB
--    freschi (zero righe) il constraint viene sempre creato.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tables_restaurant_number_unique') THEN
    IF EXISTS (SELECT 1 FROM tables GROUP BY restaurant_id, number HAVING count(*) > 1) THEN
      RAISE WARNING '[0006] numeri tavolo duplicati: unique(restaurant_id, number) SALTATO. Risolvere i duplicati e rieseguire migrate-0006.mjs.';
    ELSE
      ALTER TABLE tables ADD CONSTRAINT tables_restaurant_number_unique UNIQUE (restaurant_id, number);
    END IF;
  END IF;
END
$$;
