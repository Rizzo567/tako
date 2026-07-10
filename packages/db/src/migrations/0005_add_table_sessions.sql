CREATE TABLE IF NOT EXISTS "table_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  "table_id" uuid REFERENCES "tables"("id") ON DELETE SET NULL,
  "table_number" text NOT NULL,
  "scanned_at" timestamptz NOT NULL DEFAULT now(),
  "first_order_at" timestamptz,
  "time_to_first_order_sec" integer
);

CREATE INDEX IF NOT EXISTS "table_sessions_restaurant_scanned_idx"
  ON "table_sessions"("restaurant_id", "scanned_at");

CREATE INDEX IF NOT EXISTS "table_sessions_table_scanned_idx"
  ON "table_sessions"("table_id", "scanned_at");
