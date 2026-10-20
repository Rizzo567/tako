# Takomenu — contesto comune

Aggiornamento: 16 ottobre 2026. Referenti: Manuel e Ale.

## Riferimento del codice

Repo: https://github.com/Rizzo567/tako . Branch iniziale comune: `codex/takomenu-handoff-2026-10-16`. Non usare il vecchio main come equivalente della consegna prima dell'integrazione. Setup: HANDOFF-ALE.md. Regole sessione: SESSION_PROTOCOL.md.

## Obiettivo attuale

Consegna del sistema completo ad Ale tramite GitHub. Account GitHub Ale ancora da comunicare; nessun invito effettuato. I servizi reali richiedono accessi personali separati dal codice. Space ChatGPT non è più il percorso scelto per questo passaggio.

## Lavori

| Attività | Responsabile | Stato | Prossimo passo |
| --- | --- | --- | --- |
| Consegna completa sorgenti e prompt | Manuel / Codex | Push completato; verifiche locali passate | Condividere con account GitHub Ale |
| Accesso GitHub Ale | Manuel | In attesa identificazione account | Invitare account corretto dopo comunicazione |
| Ricerca 50 ristoranti fuori Lombardia | Codex, sottoagenti autorizzati | 50 candidati raccolti in 13 regioni | Verificare menu recenti prima delle demo |
| Collaudo WhatsApp dopo correzioni | Da assegnare | Test locali disponibili; QA reale non completa | Riprodurre casi su bozza privata autorizzata |

## Stato verificato della consegna

Installazione frozen-lockfile su copia pulita, typecheck web e server, build statico e build menu pubblici riproducibili senza credenziali. Suite mirata onboarding 501 test e categorie 11 test passate anche nella copia pulita; 24 test WhatsApp passati nel checkout principale. Non è certificazione completa desktop/mobile o servizi reali.

## Vincoli

Non toccare clienti reali per QA. Bozze private WhatsApp scadono dopo 10 minuti. Nessun segreto, numero personale o dump nel repository. Destinazioni avvisi personali ora lette da variabili; configurarle prima di futuri deploy. Conservare menu e prezzi provenienti da fonti reali e distinguere draft/pubblicato/verificato.

## Campagna iniziale

Circa 50 ristoranti esclusivamente fuori Lombardia, priorità menu quotidiani o ogni 2–3 giorni con evidenza. Demo prima della chiamata; prova 30 giorni gratis; condizioni successive da definire. Niente contatti avviati nella ricerca. Non citare agency.

## 2026-10-20 — Logo header dashboard

Branch `codex/dashboard-header-logo`: mascotte originale del sito locale (`tako-peek-avatar-v1.webp`) accanto al wordmark canonico in sidebar desktop e header mobile. Asset copiato senza rigenerazione, proporzioni preservate e nome accessibile unico. Build staff e diff check passati; nessun deploy e nessuna modifica backend.

## 2026-10-20 — Piantina prenotazioni online
Rilasciata schermata Prenotazioni in Gestione con piantina sale/tavoli e scelta pubblica su `/prenota/:restaurantId`. Worker frontend 3b2efc60, operativa v126 da patch chirurgica della v125 (156 moduli invariati), read-edge/pubblico invariati. Preservata base frontend effettivamente online feat/qr-titolare-benvenuto. Dettagli, verifiche e limiti in docs/reservations/RELEASE-2026-10-20.md. Nessun locale reale modificato per QA; attivazione prenotazioni resta per locale nelle impostazioni.

Revisione UX prenotazioni: data sopra Sale, toolbar unica con tooltip neri brevi e CTA principali testuali; nessuna spiegazione permanente superflua. Frontend finale 3e3b3572, backend v126 invariato.

Header dashboard: ripristinata larghezza esplicita del wordmark accanto alla mascotte per impedirne il collasso flex; rimosso sottotitolo Dashboard. Modifica solo frontend.
