-- 19/10 sera (revisioni v119): consegna della password del titolare via WhatsApp. Additiva, idempotente. DA APPLICARE PRIMA dell'edge v119.
BEGIN;
-- Quando il bot ha consegnato al titolare le credenziali (invio Twilio riuscito) o ha agganciato al collegamento un account già in uso.
-- NULL + mai entrato (last_login_at NULL e nessuna sessione) = password mai arrivata: al prossimo «dashboard» il bot la rigenera e la rimanda.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_delivered_at timestamptz;
-- Ricollegamento con la stessa email di un titolare già consegnato: al primo messaggio password nuova (sessioni già chiuse dal pannello).
ALTER TABLE tako_whatsapp_links ADD COLUMN IF NOT EXISTS password_reissue boolean NOT NULL DEFAULT false;
COMMIT;
