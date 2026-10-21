-- 21/10 (richiesta Manuel): fino a DUE numeri WhatsApp del titolare per locale, ognuno con la sua email e il suo account.
-- DA APPLICARE PRIMA dell'edge con il pannello a due numeri. Idempotente. NON applicata automaticamente.
-- Retro-compatibile: l'edge attuale (v129) cancella sempre gli altri numeri del locale prima di inserirne uno, quindi con questo
-- indice tolto continua a lavorare con un numero per locale. Il limite di due lo verifica il server (lock per locale).
-- Il telefono resta chiave primaria: un telefono = un locale.
-- Rollback (solo se nessun locale ha due numeri): CREATE UNIQUE INDEX tako_whatsapp_links_one_per_restaurant ON tako_whatsapp_links(restaurant_id);
BEGIN;
DROP INDEX IF EXISTS tako_whatsapp_links_one_per_restaurant;
-- Indice semplice per le letture per locale (pannello, scollega, conteggio del limite).
CREATE INDEX IF NOT EXISTS tako_whatsapp_links_restaurant ON tako_whatsapp_links(restaurant_id);
COMMIT;
