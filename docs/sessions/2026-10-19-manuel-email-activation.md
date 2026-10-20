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

## Rilascio autorizzato e verificato

Manuel ha confermato esplicitamente lo sblocco del solo aggiornamento email. Online rilevata v119, non v116: il bundle è stato scaricato prima del delta; preservate le correzioni password recenti di feat/qr-titolare-benvenuto (0715cd0).

- Base online: v119 ezbr 51a472bceb6400b21eb094c636a348ae615d6e46ea076b50696cca65713821ce; sorgente SHA256 00e3a4a09ae73a60c572f1b9de66a4fbc407d2b95921c665ad9ce0acd130665c.
- Configurati solo 5 secret TAKO_CANDIDATE_: WEB_EMAIL_ENABLED, RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO, EMAIL_LOGO_URL. Valori fuori Git. Aggiornamento secret → v120, bundle invariato e check-active passato.
- Creato bucket pubblico takomenu-email-assets con il solo logo PNG. Gli altri bucket restano privati.
- Delta solo web-mail, helper template web-accounts e lettura config email nell'entry; 152 moduli originali byte-identici, magick-wasm identico. Script scripts/email/patch-online-bundle.mjs rifiuta precondizioni diverse.
- Deploy PASS: v121 ACTIVE ezbr 16bba092788f222b1ac9f62e9182f5a039a30cbbfb394894312ad6314abbefa0. Capability pubblica email:true. Nessun Worker/read-edge/frontend deployato.
- QA reale: email reset Delivered, token valido prima, reset200, riuso400, token non valido dopo, login200; conferma password Delivered. Test esclusivamente account QA; email e hash password originali ripristinati e verificati. Sessioni QA revocate. Nessun dato menu cliente modificato.
- Gli invii di prova arrivano solo alla casella di Manuel. Nessun invio retroattivo.

### Limiti ancora attuali
Il recupero password è operativo con layout condiviso, logo e Reply-To assistenza. La conferma viene inviata dopo reset riuscito. Il cambio password dalla dashboard conserva il comportamento precedente senza nuova notifica. Benvenuto, cambio email, trial, Stripe e comunicazioni servizio non ancora collegati. Outbox generale/worker non implementati: le notifiche esistenti sono ancora best-effort, non garanzia universale di consegna. La frase iniziale «nessun deploy» descrive solo la fase preparatoria, superata da questo aggiornamento.

Rollback: bundle originale e allegato in ~/.config/tako-webapp/email-activation-20261019/; prima verificare v121/hash corrente. Tornare al bundle precedente disattiva la lettura dei 5 secret email, senza toccare altri secret; nessuna migrazione da annullare.
