-- Impone l'unicità del NUMERO tavolo per ristorante (era dichiarata nello schema ma il
-- vincolo NON esisteva sul DB: la 0006 lo saltava se c'erano duplicati → numeri doppi
-- accettati, con rischio di conti/ordini sul tavolo sbagliato quando si risolve per numero).
-- Passo 1: deduplica gli attivi (tiene il più vecchio, archivia gli altri) così l'indice
-- si può creare senza far fallire lo startup. Passo 2: indice UNIQUE PARZIALE sugli attivi
-- (i tavoli archiviati/soft-deleted possono riusare un numero). Idempotente.
UPDATE "tables" t SET "active" = false
WHERE t."active" = true AND EXISTS (
  SELECT 1 FROM "tables" o
  WHERE o."restaurant_id" = t."restaurant_id" AND o."number" = t."number" AND o."active" = true
    AND (o."created_at" < t."created_at" OR (o."created_at" = t."created_at" AND o."id" < t."id"))
);
CREATE UNIQUE INDEX IF NOT EXISTS "tables_restaurant_number_active_uq"
  ON "tables" ("restaurant_id", "number") WHERE "active" = true;
