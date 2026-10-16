# Note implementazione

CRM integrato nella dashboard agenzia e salvato in due tabelle Postgres con RLS e guard agenzia. Non usa localStorage come archivio dei lead. Ogni scrittura richiede revisione per evitare perdita dati in parallelo. Cronologia chiamate/messaggi è manuale: nessun invio implicito.

50 lead importati separatamente dal codice. Primi10 associati a locali nuovi marcati settings.takomenuTrial=true, nessun account proprietario o pubblicazione. Anteprima persistente su URL casuale, tokenSHA256 nel DB e nonindicizzazione. Fonti e prezzi mancanti visibili; 8voci di Verdurine hanno priceDisplay “Da confermare”. Fonte storica IlPrimino esplicitamenteetichettata. Preservati tutti25localipreesistenti con baselineperverifica.

Sorgenti pubbliche e asset remoti ufficiali (10loghi,8cover) verificati dall'agente ricerca. 262voci totali,254conprezzo. Le formule non sono state trasformate in prezziindividuali. Dataset e token restano fuori dalla repo pubblica.

Durante il lavoro compaiono modifiche a onboarding-chat/clauses/menu-merge e test da altra sessione. Non sono parte di questa feature: build/deploy dalla copia pulita del solo commit della feature, lasciando intatti quei file nel checkout condiviso.

Rilevato rilascio concorrente backend v81 dopo il primo deploy e QA riuscito; le API CRM sono state rimosse dal rilascio altrui. Adattamento: funzione tako-leads e Worker takomenu-leads con percorsi /leads/, /leads-demo/* e /api/agency/leads*. Isolamento per evitare ulteriori sovrascritture del bot. Le credenziali e i dati sono gli stessi già autorizzati; nessun accesso nuovo per il pubblico al CRM.
