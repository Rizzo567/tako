# Note implementazione — 9 ottobre 2026

- La nuova modalità `web` va separata dalla modalità `cloud` del control-plane identità.
- Il design viene conservato; la navigazione raggruppa Sala/configurazione, Team/turni, Report/analisi e Impostazioni/dispositivi/QR.
- Le voci esistenti restano raggiungibili tramite alias e controlli del ruolo anche quando non compaiono nella sidebar.
- Il confronto dopo la modifica deve distinguere navigazione e distribuzione da nuove funzionalità: migrare al web non aggiunge automaticamente editor grafico, PDF avanzati o versionamento del menu.
- Online-only confermato da Manuel: nessun server nel ristorante. Le funzioni che richiedono accesso alla LAN o processi locali sono gate di migrazione da risolvere, non funzionalità da promettere come già equivalenti.
- Le modifiche preesistenti al progetto non vengono ripristinate né sovrascritte.
- Manuel approva Render e Supabase su app.takoitalia.com, account personali per titolare e dati per ristorante. Il gateway conserva origine unica per API, staff, Socket.IO e menu cliente.
- Le immagini web usano un bucket Supabase privato, scritture solo dal backend autenticato e percorsi per ristorante. Le immagini del menu sono servite al pubblico dalla stessa origine; chiavi server mai inviate al browser. Quote lette dallo storage durevole, scritture serializzate per ristorante in singola replica.
- Audit hosted: non basta filtrare path testuali per bloccare plugin locali (URL percent-encoded). Print/WhatsApp non vengono registrati; PIN/shutdown hanno guardia interna.
- Credenziali: email normalizzate con compatibilità per account storici; password staff web obbligatoria, rotazione revoca sessioni e rimuove il vecchio hash locale owner. AI non crea account PIN-only sul web.
- Verifica reale a due tenant su PostgreSQL temporaneo: credenziali separate, letture/mutazioni isolate, join Socket.IO altrui negati, reset password e revoca sessioni. Non equivale a collaudo del servizio pubblicato o dei flussi cliente/cassa completi.
- Decisione successiva: Render e pubblicazione rimandati. Avvio unico `pnpm webapp` su localhost:5137, API 5131, renderer 5132; bind loopback, database e immagini Supabase. HTTP consentito solo in sviluppo locale; produzione richiede HTTPS.
- Supabase Tako Webapp creato a Frankfurt: schema operativo 25 tabelle/19 migrazioni applicato con guardia atomica; ruoli API anon/authenticated privati dei privilegi sulle tabelle operative. Bucket `tako-menu-images` privato, 10 MB, solo immagini. Connessione TLS verifica la CA ufficiale; segreti esclusivamente nel `.env.web` ignorato da Git.
- L'integrazione di isolamento usa esplicitamente origine HTTPS fixture e non eredita la CA del deployment quando crea il database temporaneo.
- Collaudo live su Supabase: 10/10 controlli riusciti, inclusi login tenant, isolamento, QR/menu pubblico, ordine cliente e evento Socket.IO, stati KDS, conto/incasso di prova, upload immagine, revoca dopo logout. Tenant QA separati e riconoscibili, senza alterare dati originali.
- Collaudo CUA interfaccia: login, ordine cliente da carrello, ticket KDS, bump pronto, apertura conto QA1 e incasso contanti di prova; UI conferma conto chiuso e aggiornamento statistiche. Screenshot in output brain tako-webapp-2026-10-09.
- Fonte nativa copiata a freddo e letta tramite cluster isolato PostgreSQL 18: originale fermo e intatto. Import remoto iniziale rifiutato atomicamente per numeri tavolo duplicati nello storico sorgente; nessun merge parziale. Normalizzazione solo su snapshot di staging, conservando UUID e backup originale.
- Import finale riuscito dalla snapshot normalizzata: 1 ristorante, 3 utenti, 44 piatti, 14 tavoli, 178 ordini, 177 conti, 81 articoli magazzino, 999 righe comanda. Copiati 8 file immagini privati. Un numero tavolo duplicato riceve suffisso -2 nello staging; UUID e storico invariati. Sessioni/dispositivi nativi non importati.
- Login di un titolare originale verificato tramite API e CUA con la password esistente, senza reset. Nove endpoint core (profilo, tavoli, menu, ordini, conti, staff, inventario, prenotazioni, sale) rispondono 200; Sala Live mostra pianta originale. Screenshot tako-web-sala-importata.png.
- Gate locali finali: 60 test Vitest +20 test Node, nessuno saltato; 10 controlli live QA; TypeScript server e Next build verdi. Hosting/DNS pubblico, stampanti LAN, WhatsApp e ASR locali restano fuori dal completamento della fase locale.

## Parità Menumal — 10 ottobre 2026, gate locali
- Workspace draft/published revisionato introdotto: preview in memoria senza scritture; pubblicazione atomica conserva UUID e storico. Editor legacy bloccato dopo adozione; disponibilità operativa rimane live e non viene annullata da modifiche allo stile.
- Migrazioni19–21 applicate Supabase dopo test isolati, backup privato before-parity-1791642315526. Nessun reset né sostituzione dati originali.
- Permessi menu_editor scoping per sessione e membership rivalidata per richiesta; nessun accesso a ordini/cassa/socketstaff. Multilocale con credenziali proprie e concessioni esplicite.
- Prenotazioni: capacità concorrente, DST rigoroso, consenso email e outbox; invio reale disabilitato. Registrazione pubblica/hosting/carta garanzia dipendono dai gate esterni, WhatsApp ultimo.
- Metriche: letture anonime deduplicate per visita/menu/giorno e lingua; non attestano scansioni QR fisiche né persone uniche. Anteprima editor esclusa.
- Verifica precedente:85 test mirati Vitest +24 Node verdi. Suite appliance generale non avviata sul servizio3001; non confondere quel prerequisito assente con una verifica del runtimeweb. QA locale finale ancora in corso.

- Gate aggiornati:99 Vitest +30 Node, TypeScript server/web e Next produzione verdi.20 verifiche live QA su Supabase; editor/preview cliente desktop e disposizione mobile verificati. PDF reale renderizzato e QR decodificabile; visualizzatore incorporato in riparazione finale. Font web originali DM Sans/DM Serif locali con OFL, eliminata dipendenza rete next/font/google. Dettagli in parity/VERIFICATION.md.

- PDF incorporato: sostituito iframe/plugin browser con PDF.js locale e canvas paginato, file reale condiviso con download e testo accessibile. Verificato IAB mobile;2 test aggiunti (32 Node complessivi). Nuova direttiva Manuel: tutti i menu cliente struttura unica dal riferimento10/10, renderer pubblico/anteprima/ordine in allineamento, theme personale preservato.

- Struttura cliente unica implementata su preview/digitale/tavolo/asporto, incluso fallback senza design. Niente alternative card/drawer nell’editor; DTO storici preservati. Logo/ricerca/lingua condivisi, azioni cameriere/carrello/filtro mantenute, carrello1×12€ verificato viaCUA senza invio ordine. Test Node totali37/37.

- Gate finale:101 test Vitest (99 suite consolidata +2 nuovi presentation scoped),37 Node; ultimo server/web TypeScript e Next build verdi. CUA layout cliente pubblico desktop/390px, ricerca/reset, tavolo dettaglio+carrello12€, anteprima nome/cataloghi uguali verificati. Ultimo runtime locale attivo; hosting/email reale/carta garanzia/WhatsApp non attivati.

## Onboarding menu cliente —10/10/2026
-Logo, sfondo, colori e testo completo con sezioni integrati nel wizard; parser prezzi espliciti e descrizioni multilinea, warning per ambiguità/duplicati, append conservativo.
-Passaggio esplicito a PDF/QR dopo applicazione alla bozza; save necessario per generazione, publish separata.
-Gate108 Vitest+39 Node, TSC/Next/buildstaff verdi. QA browser nuovo menu in anteprima e passaggioPDF riusciti; scarto finale prova locale richiede risposta manuale perché CUA bloccato sulla conferma nativa. Nessun test salvato/pubblicato. Dettagli onboarding/VERIFICATION.md.

## Rimozione app nativa e appliance — 10/10/2026
- Resta solo la webapp (`TAKO_MODE=web`) più il control-plane del sito (`TAKO_MODE=cloud`): il server rifiuta ogni altro modo. Rimossi app Expo/Tauri, PWA owner, Postgres embedded, mDNS `tako.local`, TLS self-signed, tunnel, pairing appliance↔cloud (anche `/api/pair` e il resolver `/t/:applianceId` del cloud), heartbeat, push dell'app owner, dettatura ASR locale e CI/collaudo Windows. Dettagli e numeri in `cleanup/REPORT.md`.
- **Stampa termica LAN rimossa**: era legata solo all'appliance (socket TCP verso stampanti ESC/POS su IP privati, `/api/print` già spento nel servizio web, auto-stampa comanda a ogni ordine cliente). Un server ospitato non raggiunge la LAN del ristorante, quindi `lib/printer.ts`, `lib/escpos.ts`, `routes/print.ts` e la chiamata `autoPrintOrder` sono stati eliminati. La scheda «Stampante» della dashboard resta identica (vincolo UI) e il pulsante di prova riceve lo stesso 404 `NOT_AVAILABLE_WEB` di prima. Una stampa in webapp va riprogettata (es. stampa dal browser o bridge locale): decisione aperta per Manuel.
- Opzione conservativa sulla UI: le schermate staff che citano l'appliance (Dispositivi/collegamento telefono, Collegamenti, righe QR «tako.local»/«IP diretto», scheda Stampante, scheda WhatsApp) sono rimaste invariate; i loro endpoint rispondono come prima. Il codice WhatsApp (Baileys) resta nel repo ma non montato, come già nel servizio web.
