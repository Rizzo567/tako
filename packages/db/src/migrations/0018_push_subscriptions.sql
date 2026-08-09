-- Notifiche push (piano §3 D5, F3.1). UNICA tabella nuova: nessuna entità di dominio.
--
-- Una subscription Web Push è un tris {endpoint, p256dh, auth} che il BROWSER
-- consegna all'app; l'appliance la usa come indirizzo verso Apple/Google/Mozilla.
-- Non è un segreto dell'utente (non dà accesso a nulla), ma è un identificatore di
-- dispositivo: vive e muore con la sessione mobile che l'ha registrata.
--
-- IL VINCOLO CHE CONTA: `session_id ... ON DELETE CASCADE`. Revocare un telefono
-- (DELETE /api/auth/devices/:id cancella la riga in `sessions`) deve spegnere anche
-- le sue notifiche, senza che nessun codice se ne debba ricordare. Farlo in
-- applicazione avrebbe significato un telefono revocato che continua a squillare
-- con gli ordini del ristorante — la peggior forma di revoca: quella che sembra
-- fatta e non lo è.
--
-- Idempotente (IF NOT EXISTS ovunque): può essere riapplicata senza danni.

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  -- Il legame con la sessione mobile: revoca del device → revoca del push.
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  -- L'endpoint è già univoco per installazione lato push service: UNIQUE qui rende
  -- la re-registrazione (il browser ri-sottoscrive a ogni avvio) un UPSERT, non una
  -- riga nuova a ogni apertura dell'app.
  "endpoint" text NOT NULL UNIQUE,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "last_success_at" timestamptz,
  -- Errori CONSECUTIVI. Un 5xx del push service è transitorio e non deve cancellare
  -- niente; solo 404/410 (endpoint morto) cancellano subito. Il contatore serve a
  -- potare le subscription che falliscono per sempre senza mai dire 410.
  "fail_count" integer DEFAULT 0 NOT NULL
);

-- Query dominante: tutte le subscription vive di un ristorante, al momento di un evento.
CREATE INDEX IF NOT EXISTS "push_subscriptions_restaurant_idx" ON "push_subscriptions" ("restaurant_id");
-- Query di servizio: le subscription di UN dispositivo (disiscrizione, elenco).
CREATE INDEX IF NOT EXISTS "push_subscriptions_session_idx" ON "push_subscriptions" ("session_id");
