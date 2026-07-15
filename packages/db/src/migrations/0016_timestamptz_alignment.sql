-- Deriva di schema: queste colonne sono dichiarate `withTimezone: true` in
-- packages/db/src/schema/{orders,bills,sessions}.ts ma la migrazione 0000 le
-- creò `timestamp` NAIVE. Conseguenza (bug topItems): orders.created_at è
-- scritto da now() SQL (ora LOCALE del ristorante) mentre i parametri Date di
-- Drizzle arrivano in UTC → su colonna naive il confronto slitta dell'offset
-- del fuso e il dashboard con finestra default perdeva TUTTI gli ordini delle
-- ultime ~2 ore (top piatti vuoti per l'intero servizio serale).
--
-- Conversione: interpretiamo i valori esistenti come ora locale della macchina
-- (current_setting('TimeZone')) — corretto per i valori scritti da now();
-- per i pochi scritti da JS (già wall-UTC: bills.closed_at, sessions.*) i dati
-- STORICI restano sfasati dell'offset, accettabile perché non esistono ancora
-- installazioni di produzione. Da qui in poi timestamptz = istanti assoluti,
-- coerenti sia con now() sia con i bind di Drizzle.

ALTER TABLE "orders" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "orders" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "orders" ALTER COLUMN "served_at" TYPE timestamptz USING "served_at" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "orders" ALTER COLUMN "paid_at" TYPE timestamptz USING "paid_at" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "order_items" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "order_status_history" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "bills" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "bills" ALTER COLUMN "closed_at" TYPE timestamptz USING "closed_at" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "bill_payments" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "sessions" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "sessions" ALTER COLUMN "expires_at" TYPE timestamptz USING "expires_at" AT TIME ZONE current_setting('TimeZone');
