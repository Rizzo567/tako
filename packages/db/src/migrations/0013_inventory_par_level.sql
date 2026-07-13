-- Livello di scorta OBIETTIVO (par level) per la lista di riordino: al riordino si
-- riporta l'articolo a questo valore. Nullable → fallback a minQuantity*2 lato codice.
-- Idempotente.
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "par_level" real;
