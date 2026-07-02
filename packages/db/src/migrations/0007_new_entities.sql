-- Migration 0007: nuove entità per feature imminenti — prenotazioni (reservations),
-- turni staff (staff_shifts), traduzioni menu multilingua (menu_item_translations).
-- IDEMPOTENTE: CREATE TABLE/INDEX IF NOT EXISTS, così i DB già avviati non rompono.

CREATE TABLE IF NOT EXISTS "reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  "table_id" uuid REFERENCES "tables"("id") ON DELETE SET NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text NOT NULL,
  "party_size" integer NOT NULL,
  "starts_at" timestamptz NOT NULL,
  "duration_min" integer NOT NULL DEFAULT 90,
  "status" text NOT NULL DEFAULT 'requested',
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "reservations_restaurant_starts_at_idx"
  ON "reservations"("restaurant_id", "starts_at");

CREATE INDEX IF NOT EXISTS "reservations_table_starts_at_idx"
  ON "reservations"("table_id", "starts_at");

CREATE TABLE IF NOT EXISTS "staff_shifts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz,
  "role" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "staff_shifts_restaurant_starts_at_idx"
  ON "staff_shifts"("restaurant_id", "starts_at");

CREATE TABLE IF NOT EXISTS "menu_item_translations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  "item_id" uuid NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
  "lang" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "menu_item_translations_item_lang_unique" UNIQUE ("item_id", "lang")
);
