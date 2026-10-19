# Email transazionali: preparazione e stato reale

Branch: codex/manuel-email-activation, base origin/main ee70594. Checkout separato per preservare il lavoro Claude.

## Verificato
- Resend dominio takoitalia.com verificato e chiave limitata all'invio. Due messaggi tecnici consegnati a Manuel; nessun invio ai clienti.
- Endpoint pubblico /api/web-accounts/capabilities restituisce email:false il 19 ottobre.
- Catalogo 12 varianti del copy approvato; renderer condiviso con escaping dati, validazione HTTPS, azione opzionale servizio, fallback testo.
- Recupero password Node utilizza il renderer; transport imposta Reply-To assistenza. Nessuna modifica alle credenziali.
- 19 test renderer PASS; typecheck server PASS; diff --check PASS.

## Non attivo / lavoro necessario
- Nessun deploy, secret di produzione o migrazione eseguito da questa sessione.
- Password cambiata, benvenuto e cambio email non ancora collegati agli eventi applicativi.
- Outbox transazionale generale e worker con dedupe/retry ancora da implementare; quella esistente riguarda prenotazioni.
- Scadenza prova e sottoscrizioni richiedono fonte autorevole del lifecycle: non trovata integrazione subscription Stripe, nessun prezzo inventato.
- Non effettuata prova reset end-to-end con account QA, né QA client email.
- Coordinamento: AGENTS del checkout condiviso blocca deploy operational/read-edge fino a conferma Claude e richiede delta sul bundle online attuale. Chiesta conferma a Manuel, non presumere risposta.

Non dichiarare che tutte le email siano operative: Resend è pronto, la parte applicativa è parziale.
