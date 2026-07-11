-- Migration 0011: fedeltà a punti (loyalty_accounts) + ricette piatto→ingredienti (recipes).
-- Entrambe additive e gated da feature-flag (loyaltyEnabled / autoStockDeductEnabled).
-- IDEMPOTENTE: CREATE TABLE/INDEX IF NOT EXISTS, così i DB già avviati non rompono.
-- NB: la migrazione drizzle-kit generate risulta inquinata da drift storico (le snapshot
-- meta erano ferme a 0000); qui la migrazione è scritta a mano con solo il delta reale,
-- come le migrazioni 0001-0010 di questo repo.

-- Fedeltà: un account punti per (ristorante, telefono).
CREATE TABLE IF NOT EXISTS "loyalty_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  "phone" text NOT NULL,
  "name" text,
  "points" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "loyalty_accounts_restaurant_phone_unique" UNIQUE ("restaurant_id", "phone")
);

-- Ricetta: quantità di un ingrediente d'inventario per 1 unità di piatto.
CREATE TABLE IF NOT EXISTS "recipes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  "menu_item_id" uuid NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
  "inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id") ON DELETE CASCADE,
  "quantity" real NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "recipes_menu_item_inventory_unique" UNIQUE ("menu_item_id", "inventory_item_id")
);
