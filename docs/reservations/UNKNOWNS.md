# Piantina prenotazioni — 20 ottobre 2026

| Sappiamo | Sappiamo di non sapere | Ipotesi / verifica | Punti ciechi |
|---|---|---|---|
| Sale, tavoli, posti e coordinate percentuali esistono. | Quali locali hanno attivato le prenotazioni. | Gate server reservationsEnabled; nessuna attivazione automatica. | Posizioni incomplete: elenco separato, nessuna disposizione inventata. |
| Serve scelta tavolo dal sito, richiesta poi confermata dal titolare. | Orari/turni commerciali dei singoli locali. | Si conserva durata corrente 90 minuti; disponibilità per sovrapposizione e capienza. | Nessun nuovo calendario orari/aperture inventato. |
| La dashboard online coincide con feat/qr-titolare-benvenuto. | Concorrenza reale su DB remoto non ancora provata. | Hash compilato baseline confrontato col JS online; helper testati e lock già condiviso da tutti gli scrittori. | Test mockati non sostituiscono gara concorrente reale. |
| Edge online v125 al download. | Eventuali deploy concorrenti. | Check versione e hash subito prima del deploy; stop se diversi. | Nessun bundle ricostruito integralmente da main. |
| Il gateway forza menu pubblico in sola lettura. | Collegamenti nei siti esterni. | Pagina /prenota/:id e endpoint info dedicato, senza cambiare ordinazioni/menu pubblico. | Il titolare deve collegare la pagina dal proprio sito. |

Stop: build, typecheck server, test mirati, preview visuale, hash base attivo e smoke HTTP. Max due riparazioni per verifica fallita; blocchi dichiarati, nessun retry cieco. Nessuna scrittura QA su locali clienti.
