-- 19/10 (decisione Manuel): accesso alla dashboard del titolare collegato su WhatsApp.
-- DA APPLICARE PRIMA dell'edge v118 (pannello e bot leggono owner_email). Idempotente. NON applicata automaticamente.
BEGIN;
-- Email del titolare salvata nel pannello «WhatsApp del titolare»: diventa l'utente della sua dashboard al primo messaggio.
ALTER TABLE tako_whatsapp_links ADD COLUMN IF NOT EXISTS owner_email text;
COMMIT;
