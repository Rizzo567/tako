# Trasferimento dati dalla copia del database nativo

Il sorgente originale non deve essere avviato, aggiornato o scritto durante questa procedura. Una copia a freddo è valida solo se il processo PostgreSQL originale è fermo; controllare PID e versione prima della copia. Conservare `pgdata` originale e una copia completa privata, directory `0700`, fuori dal repository. Avviare esclusivamente la copia con PostgreSQL della stessa versione maggiore, porta libera e host loopback. Nessuna finestra dell'app è necessaria.

`scripts/web-data-transfer.mjs` richiede connessioni sorgente/destinazione esplicite nelle variabili d'ambiente. Non legge `.env` generici e non stampa utenti, indirizzi email, password/hash, contenuti dei piatti o stringhe di connessione. `inspect` produce esclusivamente conteggi, disponibilità degli hash e numero di account staff senza password. Export usa una transazione `REPEATABLE READ READ ONLY`; preserva UUID, prezzi, configurazioni, storico e hash delle credenziali. Le credenziali non vengono rigenerate né mostrate.

```sh
node scripts/web-data-transfer.mjs inspect
node scripts/web-data-transfer.mjs export /percorso/privato/nuovo-backup
```

Usare `SOURCE_DATABASE_URL` per la copia isolata e `SOURCE_UPLOADS_DIR` per gli upload nativi. La destinazione export deve essere nuova: nessun backup viene sovrascritto. `data.json` e manifest sono `0600`. Il manifest registra SHA256 e conteggi; le immagini vengono copiate con hash mantenendo percorso `<restaurantUUID>/<file>`. I symlink e le sottocartelle negli upload sono rifiutati. Questi file contengono dati privati e hash di password: non committarli né allegarli al brain.

Le tabelle `sessions`, `table_sessions`, `device_enroll_codes` e `push_subscriptions` sono escluse: token, visite e arruolamenti nativi non devono diventare sessioni valide online. I membri dello staff senza password richiedono credenziali personali assegnate dal titolare prima del servizio; i PIN nativi non consentono login web. Il trasferimento conserva gli hash del titolare, compreso quello della credenziale appliance, compatibile con il login verificato. Un reset password web elimina il vecchio hash appliance.

## Import — azione separata, dopo revisione

Il comando di import non viene eseguito dalla preparazione. Richiede `TARGET_DATABASE_URL`, `EXPECTED_TARGET_HOST`, `EXPECTED_TARGET_DATABASE`, `EXPECTED_TARGET_USER` corrispondenti al progetto nuovo e `--execute` esplicito. Il pooler Supabase condivide hostname/database tra progetti: la verifica dell'utente qualificato `postgres.<project-ref>` è obbligatoria. Connessioni remote richiedono `DATABASE_CA_CERT_PATH` con certificato attendibile e TLS `rejectUnauthorized: true`; nessun fallback TLS permissivo è previsto. Prima dell'import verificare che destinazione, account progetto e manifest siano quelli concordati. Richiede il backend server role con bypass RLS: nessun contesto tenant viene impostato dallo script.

```sh
node scripts/web-data-transfer.mjs import /percorso/privato/backup --execute
```

L'import verifica SHA256 dei dati e delle foto, corrispondenza delle colonne, assenza di righe in tutte le tabelle operative e ordine topologico delle foreign key. Un tenant QA separato già creato può essere conservato solo indicando esplicitamente i suoi UUID verificati in `ALLOWED_EXISTING_RESTAURANT_IDS` (separati da virgole). Qualsiasi altro ristorante esistente o qualsiasi UUID sorgente già presente nella destinazione causa rifiuto; nessun upsert viene eseguito. I conteggi verificati riguardano gli UUID importati. Inserisce senza disattivare vincoli/trigger e senza modificare lo storico Drizzle. Una transazione unica rende atomico il trasferimento; un errore o conteggi diversi provoca rollback. Duplicati email senza distinzione tra maiuscole/minuscole provocano rollback. Nessun reset o overwrite automatico è previsto.

## Foto e verifica di cutover

### Duplicati storici dei numeri tavolo

Il database nativo può avere saltato il vincolo unico `(restaurant_id, number)` quando esistevano duplicati. La destinazione nuova applica il vincolo: non disabilitarlo. Dopo revisione esplicita, `scripts/normalize-web-snapshot.mjs /backup-originale /nuovo-backup-staging` conserva la copia originale e crea una copia privata separata. Mantiene il numero del tavolo attivo in una sala reale, poi ordina per data/UUID; aggiunge suffissi `-2`, `-3` ai duplicati, evitando numeri già utilizzati. Preserva tutti gli UUID, le associazioni e le etichette storiche di ordini/conti. Il manifest viene ricalcolato e contiene hash della fonte e del rapporto di normalizzazione. Il rapporto privato indica esattamente gli UUID/etichette modificati. Prima e dopo la normalizzazione controlla le altre unicità del journal: slug, email, QR, chiavi idempotenza, traduzioni, loyalty, ricette, chiamate aperte e ID; anomalie diverse richiedono revisione separata. Test reali confermano rollback dell'import grezzo e successo della copia normalizzata con vincoli attivi.

La copia dei file è un backup, non un upload Supabase. Caricare separatamente gli oggetti del manifest nel bucket privato previsto, conservando UUID/percorso, verificare SHA256/dimensioni e verificare che il backend risolva gli URL `/uploads/<UUID>/<file>`. Le immagini con URL esterni restano esterne. Controllare anche logo, copertina e avatar oltre alle foto piatti. Non sostituire i riferimenti DB prima di avere una mappa verificata.

Prima del cutover: bloccare nuove scritture native, esportare una copia finale coerente, confrontare conteggi e ID, verificare login titolare e ruoli staff, menu/foto, tavoli/QR e storico conti. Verificare i vincoli FK senza disabilitarli e il funzionamento HTTP/realtime per ristoranti diversi. Una snapshot presa mentre si continua a lavorare diventa obsoleta: non ritirare l'app prima della verifica della copia finale e del flusso web. Conservare backup e originale per il ripristino fino al termine della verifica.
