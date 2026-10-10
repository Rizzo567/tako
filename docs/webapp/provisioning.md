# Provisioning Tako originale — 9 ottobre 2026

## Stato verificato

- Account Supabase indicato da Manuel: rekth.paypal, organizzazione gratuita Tako.
- Progetto **Tako Webapp** creato, ref `tcfccmvpycivxuxkoqpw`, regione Central EU (Frankfurt).
- Schema operativo applicato: **25 tabelle e 19 migrazioni**; journal Drizzle conservato. Bootstrap atomico, senza account/segreti SQL di esempio.
- Data API disattivata. Zero privilegi sulle tabelle operative per PUBLIC/anon/authenticated; RLS presente su 16 tabelle. Le route autenticano il tenant e filtrano i suoi dati; il backend usa la connessione amministrativa, quindi non dichiarare enforcement RLS di ogni query tramite ruolo limitato.
- Bucket **tako-menu-images** privato, limite 10 MB, MIME immagini JPEG/PNG/WebP/GIF. Accesso server tramite chiave esistente, mai nel browser.
- TLS database verificato con certificato CA ufficiale. Credenziali in `.env.web` (0600, ignorato da Git), certificato in cartella privata fuori dal progetto.
- Avvio web locale operativo: **pnpm webapp**, http://localhost:5137, API 5131 e renderer cliente 5132. Health gateway verifica entrambi i processi.
- **Render e pubblicazione online rimandati da Manuel.** Nessun servizio Render creato, nessun acquisto. Template in deploy/ sono materiale preparatorio.
- Originale desktop e database locale conservati: nessun ritiro preventivo.
- Import completato da copia a freddo: 1 ristorante, 3 utenti, 44 piatti, 14 tavoli, 178 ordini e 177 conti; 8 file immagini conservati nel bucket. Un numero tavolo duplicato normalizzato solo nello staging, con UUID/storico invariati. Nessuna sessione nativa importata.
- Login originale verificato senza reset via API e browser; nove endpoint operativi rispondono 200. Ristoranti QA separati creati per collaudo, con ordine/incasso esclusivamente di prova.

## Verifiche e limiti

80 test passati (60 Vitest +20 Node), nessuno saltato: runtime, storage, cookie socket, isolamento tra ristoranti, gateway HTTP/WebSocket, compilazione staff, navigazione per ruolo, bootstrap e trasferimento dati. 10 controlli live aggiuntivi passati su tenant QA Supabase. TypeScript server e build Next cliente completati con warning lint preesistenti. Browser verificato sul percorso ordine cliente → KDS → apertura conto → incasso QA → conto chiuso e sulle sale originali importate.

Credenziali titolare operative sono distinte dagli account del control-plane api.takoitalia.com. Registrazione pubblica disabilitata fino ad allineamento di verifica email e recupero password. Gli account esistenti vanno importati con gli hash originali, senza condividere password tra titolari.

La disponibilità localhost non equivale a pubblicazione: telefoni e altri computer richiedono un hosting raggiungibile. Mancanza internet impedisce l'accesso a database e immagini Supabase. Stampa termica LAN, WhatsApp locale e trascrizione locale non sono disponibili nella modalità web.

## Gate del passaggio definitivo

1. Backup dei dati e delle immagini originali; import conservando identificativi e hash, senza trasferire sessioni.
2. Collaudo reale delle credenziali migrate, QR cliente, ordine, cucina, conto e immagini.
3. Scelta hosting, HTTPS/DNS, segreti produzione e collaudo su takoitalia.com quando Manuel riprende la pubblicazione.
4. Verifica perdita rete e backup/ripristino, poi ritiro effettivo dell'app dopo il passaggio.
