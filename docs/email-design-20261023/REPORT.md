# Template email — preparazione 23 ottobre 2026

## Stato
Nessun deploy, modifica DNS/secret, invio o retry clienti. Dopo la richiesta «verifica che funzioni», caricati soltanto sei asset grafici nel bucket pubblico email esistente e inviate due prove tecniche alla casella di Manuel: entrambe presenti in INBOX Gmail. Manuel ha risposto «aspettiamo» al gate backend. Branch codex/manuel-email-design-1023 derivato dalla consegna email 5c136e1e. Non rilasciare il checkout intero: è precedente al backend attuale.

## Diagnosi dal vivo (sola lettura)
Scaricata edge v178, bundle sha 6d27e84afb12ee14357768b541a8c1d7cda6fbc26285eb1607e98aaa70320aab: renderer precedente ancora presente. Le bozze del 20 ottobre non erano integrate. Coda aggregata osservata: benvenuto 7 sent, 6 failed, 1 pending, 2 cancelled. Gli errori sono DELIVERY_FAILED; i falliti hanno 6 tentativi. Le altre cinque varianti hanno invii storici segnati sent. Sent significa accettazione provider, non verifica inbox.

Resend GET /emails restituisce restricted_api_key: la chiave locale consente soltanto invii. Nessuna chiave cambiata; questa risposta alla lettura non dimostra una chiave di invio non valida. Causa dei fallimenti non ricavabile dal solo errore generico: servono log dashboard provider o un successivo test tecnico autorizzato. Nessun destinatario o payload privato nel rapporto.

## Preparazione
Sei varianti con arancione/petrolio, grafica delle bozze, layout a tabelle, CSS inline essenziale, font con fallback, testo alternativo, link effettivi e plain text. Scene benvenuto esportate dalla composizione originale: niente JavaScript/matrici nel client mail. I contenuti dimostrativi sono indicati come tali; il nome locale è dinamico. Pulsanti di reset/conferma mantengono i token del chiamante.

Il nuovo renderer rimuove l’affermazione obsoleta «password su WhatsApp». La pipeline attuale non riceve password_temporanea: non si può ricavare da un hash. Supporto di visualizzazione opzionale presente se fornita dal chiamante; altrimenti accesso e indicazione Password dimenticata. Non modificato il provisioning credenziali.

Newsletter/social non configurati: niente pulsanti finti, promozione 15% o iscrizione implicita. Prima di riattivare la card promozionale servono destinazione e condizioni reali. Nessuna email pagamenti, abbonamenti o scadenza prova.

## Verifiche
- 41 test Vitest PASS: renderer, design, outbox, route.
- 4 test gateway Node PASS.
- Typecheck server PASS.
- Browser desktop/mobile: immagini caricate e assenza overflow orizzontale PASS; screenshot allegati.
- Delta preparato: byte prima/dopo sezione renderer identici. Nessun rebuild di altre route, cron o bot.
- Due invii Resend tecnici a Manuel: HTTP200 e presenza INBOX Gmail verificati tramite connettore. Uno diagnostico, uno con il nuovo template reset e destinazione demo priva di token. Nessun reset avviato. Outlook e Apple Mail non verificati.

## Ripresa dopo sblocco
1. Verificare che il backend sia libero; riscaricare bundle e versione correnti. Non usare la vecchia base v178 se cambiata.
2. Caricare soltanto gli asset grafici nel bucket pubblico esistente takomenu-email-assets/design-20261023, confrontando assets.json; nessun cambio permessi o secret. Verificare HTTP200 senza autenticazione prima di attivare il renderer.
3. Eseguire scripts/email/build-design-delta.mjs sul bundle appena scaricato. Si ferma se il modulo non ha la forma attesa; non usare il vecchio builder completo del runtime.
4. Verificare nuovamente versione/hash prima del deploy del solo delta. Nessun altro Worker/edge da rilasciare.
5. Verificare con inbox QA controllata e identificativi sintetici; non resettare account clienti. Controllare accettazione provider, consegna e link prima di dichiarare operativo.
6. Le email già accodate sono snapshot cifrati: il renderer nuovo vale per nuovi eventi. Non riscrivere né rinviare la coda storica automaticamente.

## Aggiornamento verifica reale
- La coda contiene ora 9 benvenuti failed, tutti con destinatario sul dominio dimostrativo riservato example.com; nessun pending osservato nell’ultimo controllo. Non interpretarli come 9 clienti non raggiunti. Nessun retry o cancellazione eseguito.
- La chiave locale Resend funziona per inviare: prova diagnostica e nuovo template ricevuti in INBOX. La lettura API resta vietata dalla chiave solo invio.
- Asset: 6 PNG caricati in design-20261023, HTTP200 anonimo e hash identico verificati per tutti. Il bucket consente solo PNG e massimo1MiB: due fotografie convertite in PNG a tavolozza256 colori sotto il limite, senza cambiare i permessi del bucket. Il font remoto non viene richiesto: tipografia con fallback Georgia, senza URL font non disponibile.
- Il backend operativo resta invariato. I nuovi eventi automatici continuano a usare il vecchio renderer finché non viene autorizzato il delta.
