# Migrazione MenuSmart — accesso provvisorio e stato del passaggio

## Stato verificato

- Produzione Supabase `tcfccmvpycivxuxkoqpw`, `tako-operational-candidate` **v192 ACTIVE**: solo delta migrazione applicato al bundle realmente online v191, con download e controllo hash immediatamente prima del deploy.
- `takomenu-web`: modulo originale e asset online conservati; aggiunto adapter di accesso. Binding e secret invariati. Dashboard: https://takoitalia.com/staff/ . Nessun rilascio della read-edge.
- Schema additivo applicato: username, cambio obbligatorio, scadenza provvisoria, archivio cifrato degli accessi. Nessun account cliente reimpostato.
- Credenziali: due parole distinte + trattino + due cifre, provvisorie per 48 ore; nuova password al primo accesso; blocco API lato server; revoca sessioni e rimozione del segreto provvisorio dopo il cambio.
- `MENU` intercetta il contesto migrazione anche se il numero è già attivo. Retry di preparazione non reimposta nuovamente la password; replay MessageSid non duplica la consegna.

## Prove

- Typecheck server PASS; 6 test unitari PASS, inclusi cifratura vincolata a locale/utente e 19 percorsi QR disattivati per default.
- 28 verifiche API PASS su staging e produzione, con webhook firmato simulato esclusivamente su QA: scadenza, autenticazione, idempotenza, cambio concorrente, impossibilità di riusare la provvisoria, isolamento agenzia e revoca vecchie sessioni.
- Prova **reale WhatsApp Mac → bot → Twilio** sul solo numero di Manuel: template approvato, `MENU`, credenziali consegnate e lette, login, blocco prima del cambio, cambio via API, accesso esclusivo QA, provvisoria invalidata. Il cambio password UI è stato verificato separatamente con fixture locale senza credenziali reali.
- Numero Manuel ripristinato esattamente su Victoria alle 16:57:49 UTC. Account degli altri clienti, tutti i workspace e contesto del telefono invariati nel test. Owner QA e sue sessioni ripristinati. Nessun messaggio ai clienti.
- HTTP pubblicato: staff200, adapter200 e hash identico; cache della pagina no-store. Adapter collegato anche alla sorgente dashboard per futuri build.

## Menu e destinatari

- Fonte MenuSmart riletta il 28 ottobre, snapshot 16:36 UTC. Riallineati mediante API e pubblicati **L'Osterietta, PortoFranco, Pupos Pizza, L'AGORA, La Bottega del Gusto**. Backup prima della scrittura; controllo revisioni, round-trip e logout di sessioni proprie.
- Readback SQL e API pubbliche PASS. 71 workspace esterni ai cinque locali e righe ristoranti invariati.
- Parità finale italiana e ordine PASS sui 19 clienti, con eccezione approvata San Galdino: MENÙ41, Bevande20, Caffetteria1; pranzo/eventi nascosti. Demo escluso. Traduzioni universali e QR stampati personalizzati non certificati da questo controllo.
- Mappa `chat_channel_mappings` recuperata dal database originale tramite Lovable in sola lettura: 6 locali clienti con numeri, 13 senza. Un numero contiene U+202C; L'AGORA ha due referenti. Bim Bum Bar ha già un collegamento in Takomenu e tre owner da disambiguare tramite il collegamento esistente.
- Manuel sta fornendo i numeri mancanti. San Galdino non ha ancora un owner in Takomenu: creare l'accesso soltanto con identità e numero approvati, senza inventare email cliente.

## Restante prima dello switch

1. Integrare i numeri forniti da Manuel e risolvere i referenti ambigui. Verificare conflitti numero/locale/owner, nessuno spostamento silenzioso.
2. Preparare per ciascun locale il suo accesso **nel proprio passaggio**, non resettare tutti in anticipo.
3. Installare il gate nel progetto originale MenuSmart, dopo revisione delle modifiche non pubblicate; helper e wrapper pronti in `scripts/migration-access/menusmart/`, tutti i redirect OFF. Non è ancora installato o pubblicato.
4. Pilota: fonte menu appena riletta, vecchio URL QR → pubblico corretto, avviso v4 approvato con richiesta MENU, invio verificato. Poi proseguire per locale con registro persistente degli invii e idempotenza; nessuna simultaneità atomica garantita tra provider.
5. Ricontrollare le modifiche MenuSmart subito prima di ciascun passaggio. I locali continuano a lavorare sul vecchio sistema.

## Evidenze private e ripresa

Cartella privata `~/.config/tako-webapp/migration-access-20261028/`: ricevute schema/backend/Worker, staging e live test, prova WhatsApp e ripristino, snapshot contenuti/destinatari, report readback. Nessun dump, recapito privato o segreto in Git.

`scripts/migration-access/release-backend.mjs --apply` rifiuta drift del bundle online. La ricevuta include il sorgente di rollback: non eseguire rollback alla cieca dopo rilasci successivi. `release-worker.mjs` è vincolato alla base originale acquisita; dopo il rilascio i moduli online sono due, quindi un altro rilascio richiede riacquisizione e rebase, non ripetizione automatica.

Il branch locale contiene anche integrazioni native; il bundle di produzione resta la fonte per i rilasci finché Git e online non sono riallineati. Non deployare il server completo dal branch storico.
