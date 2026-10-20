# Email Takomenu — operative dal 19 ottobre 2026

## Perimetro approvato

- Benvenuto alle nuove attivazioni: titolare attivo, email valida e WhatsApp collegato; una volta per titolare/locale. Nessun backfill.
- Recupero password richiesto dall’utente: link monouso 30 minuti; una nuova richiesta invalida la precedente; 3 link/ora per account, ulteriore limite IP.
- Password cambiata dopo reset o cambio autenticato dalla dashboard.
- Cambio email: password attuale, conferma al nuovo indirizzo entro 30 minuti e avviso al vecchio. L’indirizzo cambia solo alla conferma; sessioni revocate. Un cambio password invalida le richieste pendenti.
- Servizio: solo agenzia autenticata, destinatari espliciti, testo approvato (`approved:true`), massimo 20 per richiesta. Nessuna campagna automatica. Endpoint pronto, nessuna console grafica di composizione implementata in questa fase.

Pagamenti e abbonamenti gestiti internamente: esclusi email relative, scadenze prova con CTA di abbonamento, Stripe e checkout. Decisione Manuel 19 ottobre, successiva al primo catalogo.

Mittente `Takomenu <noreply@takoitalia.com>`; Reply-To/assistenza `manuelrizzo474@gmail.com`. Sei varianti, stesso layout, niente password in email. Il bot WhatsApp continua a consegnare le credenziali secondo il suo flusso esistente.

## Runtime e sicurezza

`transactional-email/outbox.ts` salva il messaggio renderizzato con mittente/Reply-To immutabili, cifrato AES-256-GCM con `EMAIL_OUTBOX_KEY`. Nel DB i token di reset/conferma sono solo SHA256; copie necessarie per il retry sono dentro il payload cifrato. Payload eliminato negli stati terminali. Non ruotare la chiave senza gestire la coda esistente.

Deduplica applicativa, claim `FOR UPDATE SKIP LOCKED`, fencing del claim, recupero dopo 2 minuti, massimo 6 tentativi entro 23 ore. La finestra resta inferiore alle 24 ore delle chiavi idempotenti Resend: https://resend.com/docs/dashboard/emails/idempotency-keys . Controlli di validità prima dell’invio; messaggi scaduti o collegamenti non più validi annullati. L’accettazione provider non garantisce universalmente arrivo in inbox o assenza spam.

Cron `takomenu-email-delivery` ogni minuto: pg_cron → funzione SECURITY DEFINER → pg_net → gateway → `/api/web-accounts/email/tick`. Il segreto è in Vault e nella config edge, non in cron.job. Il bridge inoltra `x-tako-cron-secret`, usato qui con un segreto distinto da quello dei preset. Le tabelle non sono leggibili da anon/authenticated Supabase; accesso solo runtime con RLS.

Pagina account: `https://takoitalia.com/api/web-accounts/email/settings`. La conferma è una pagina GET senza effetti: solo il POST esplicito consuma il token. Il gateway ripristina HTML/CSP per le sole due pagine fisse con nonce generato dal server. Nessun nuovo collegamento nel menu profilo della dashboard in questa fase.

## Verifiche

31 test Vitest (catalogo, cifratura, coda, route) + 4 test gateway Node; typecheck server PASS. Database reale con provider finto: dedupe, concorrenza, retry, mittente immutabile, cancellazione token invalido e pulizia payload PASS.

Live sul solo account `qa-web-verifica`: entrambe le email cambio indirizzo Delivered; vecchia email preservata prima della conferma; GET non consuma; conferme simultanee 200/400; vecchia sessione revocata; login nuovo indirizzo; cambio password dashboard; richieste email pendenti invalidate; reset con coda 200 e riuso400; benvenuto Delivered una volta; invio cron autonomo sent e Delivered senza tick manuale. Credenziali QA ripristinate e sessioni QA revocate; telefono sintetico rimosso. Nessuna email ai clienti.

Pagina account verificata via Computer Use desktop. Non certificati Outlook, Apple Mail, inbox placement o dispositivo fisico mobile. Comunicazioni servizio testate su template/coda/permessi e invio cron tecnico; nessuna comunicazione operativa inviata ai clienti.

## Rilascio e rollback

Edge v125 ACTIVE; ezbr `3ef3072d5e69cf8197c145cfada35c30cb9c6c9b7d58f80ca7828ec586d7ae61`. Base v121 scaricata; delta solo email + config, preservati gli altri moduli. Le correzioni successive hanno sostituito il solo modulo email, preservando altri 156 moduli. Worker `takomenu-web`: delta su bundle scaricato, solo gestione Content-Type/CSP delle due pagine email; asset, binding e route conservati. Nessun deploy read-edge o takomenu-public.

Backup privati `~/.config/tako-webapp/email-automation-20261019/` e `email-activation-20261019/`. Prima di rollback verificare attivo e riconciliare eventuali modifiche successive. Sospendere il solo cron email; conservare tabelle e dati per audit, nessun DROP necessario. Ripristinare il bundle edge/Worker appropriato da backup senza toccare asset/binding. Ripristino a v121 rimuove il worker applicativo della coda ma mantiene il recupero diretto già operativo.

Script migrazione: `node scripts/email/apply-email-migration.mjs` dry-run; `--apply` è una scrittura di produzione esplicita. Script QA richiedono alias email controllati dall’operatore e alterano solo il locale QA: non eseguirli sui clienti o con una coda attiva durante test a provider finto. Leggere il codice e i gate prima del rilascio. Credenziali mai nel repository.
