# Tako originale — passaggio alla webapp

Decisione Manuel: interfacce ristoratore, camerieri e clienti sul web, design esistente, servizio online come Menumal. Non riguarda TakoMenu. La dashboard Menumal cliente resta esclusivamente in lettura.

| Sappiamo | Sappiamo di non sapere | Ipotesi da verificare | Punti ciechi |
|---|---|---|---|
| Il frontend staff è già una SPA servita da Fastify. | Hosting operativo e credenziali disponibili per un nuovo servizio. | Origine HTTPS unica per staff, API, Socket.IO e menu clienti: verificare proxy e cookie. Se falsa, rivedere routing e autenticazione. | Ripristino dei dati dopo guasto del servizio remoto. |
| Il modo cloud attuale gestisce identità, non il servizio ristorante. | Quale database operativo remoto usare e quali dati locali migrare. | Modalità web distinta dal control-plane: verificare mancato avvio di DB embedded, tunnel e mDNS. | Confini tra tenant: non dichiarare il server operativo multi-ristorante pronto senza audit delle query. |
| Sono presenti schermate per sala, ordini, cucina, cassa, menu, team e report. | Stato di funzionamento completo di tutte le integrazioni esistenti. | Alias di navigazione conservano le schermate e i permessi: testare ciascun ruolo e gli accessi diretti. | Stampanti LAN non raggiungibili da un server pubblico; integrazione da riprogettare. |
| Il cliente ha richiesto solo-online. | Disponibilità reale delle notifiche nei browser target. | La disconnessione deve essere visibile e non produrre conferme false: simulare perdita di rete e riconnessione. | WhatsApp e trascrizione locale dipendono da componenti del vecchio runtime. |

## Criterio di uscita

Aggiornamento: Manuel approva Render + Supabase su app.takoitalia.com e credenziali separate per ogni titolare. I vecchi segreti database sono in `materiali/Tako-Credenziali/` (ignorato da Git), ma non ci sono token di gestione Render/Supabase. Richiesto accesso alle dashboard per il provisioning.

L'onboarding pubblico sul sito registra identità nel control-plane; da solo non crea il tenant operativo. Il primo cutover tiene chiuse le registrazioni e migra/provisiona account distinti. Prima di aprire il signup pubblico bisogna allineare verifica email e reset password, senza ripristinare l'heartbeat appliance.

Codice verificato con test di navigazione, configurazione runtime e compilazione. Pubblicazione e ritiro app richiedono servizio HTTPS operativo, dati migrati con backup, collaudo per ruolo e dispositivo. Non eliminare l'app o i dati prima di questi gate.

## Loop
Agire → osservare diff e risultati → verificare → correggere. Massimo due tentativi per lo stesso errore prima di descrivere la causa e cambiare strategia. Nessuna migrazione sulla dashboard cliente Menumal. Nessun rilascio sul control-plane esistente come sostituto improprio del server operativo.
