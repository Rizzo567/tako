-- order_items.menu_item_id deve essere NULLABLE: quando si elimina un piatto dal menu
-- il riferimento viene azzerato ma la riga d'ordine resta (conserva nome+prezzo storici).
-- Il DB aveva ancora il vincolo NOT NULL → l'eliminazione di piatti/sezioni falliva (500).
-- Idempotente: DROP NOT NULL su colonna già nullable non dà errore.
ALTER TABLE "order_items" ALTER COLUMN "menu_item_id" DROP NOT NULL;
