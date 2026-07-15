-- L'indice era dichiarato in schema/orders.ts ma nessuna migrazione lo creava:
-- nel DB reale (embedded, migrate() applica solo i .sql) ogni lettura per
-- order_id era un seq scan su una tabella che cresce a ogni servizio.
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items" ("order_id");
