# Tako — matrice delle funzionalità e gate reali

Aggiornata 2026-10-10, dopo build e verifiche runtime QA. Riferimenti: `VERIFICATION.md`, `frontend-discovery.md`, `qa-discovery.md`, `accounts.contract.md`. Questa matrice descrive il codice verificato e i limiti; **non attesta parità completa con Menumal**. Dashboard del cliente Menumal esclusa da tutte le scritture/test.

| Area | Implementato nel codice | Gate ancora aperto / limite |
|---|---|---|
| Navigazione web e ruoli | Sidebar servizio/gestione, Sala/Team con tab interne, scorciatoie mobile; editor menu limitato a Menu | Isolamento API, restrizioni editor, socket e revoca verificati su PostgreSQL isolato; navigazione desktop verificata. Responsive mobile e flussi editor nel browser restano da completare |
| Editor contenuti | Menu multipli, categorie/sottocategorie, piatti, varianti/disponibilità, spostamento e riordino su/giù, ID conservati; bozza e pubblicazione separate | Ricerca/filtro stato e albero categorie implementati; non ancora drag pointer; form avanzati ancora estesi, nessun claim UX identica a Menumal |
| Protezione bozze | Guard cambio sidebar/copilot, logout, cambio locale e reload globale; beforeunload; conflitto409 conserva modifiche | QA browser conferma/scarta/tastiera, doppio clic e rete; conferme native browser |
| Calendari | Editor giorni/orari/timezone/date per menu/categorie/piatti; backend filtra il pubblico | Filtri calendario, timezone/overnight e DST verificati dai test mirati; menu fuori finestra escluso dal pubblico su DB isolato. Anteprima simula un istante UTC esplicito senza scritture |
| Aspetto e preset | Campi contratto standard/centered/link, immagini/sfondo/bordi/categorie/navigazione/header/logo; preset integrati e personali POST/DELETE | Thumbnail preset non implementate; ItemSheet applica font/stili nome/descrizione/prezzo, forma/visibilità immagini e allergeni; quantità e totale checkout reale preservati; contrasto/font/mobile da verificare |
| Renderer cliente e preview | Renderer condiviso, anteprima autenticata iframe same-origin senza ordini/tracking, lingua; digital menu `/r/:restaurantId/menu` e selezione menu | Anteprima cliente verificata nel browser e separazione bozza/pubblico verificata su DB e runtime QA; responsive/cache tra browser da completare. Simulazione calendario locale; gerarchia come sezioni successive |
| Libreria immagini | Upload, ricerca, sort, quota reale, riuso, usi piatto/design/versioni; cancellazione disabilitata in uso e backend409 | Archiviazione remota e quota verificate sul tenant QA; asset estranei e retention delle immagini storiche verificati su PostgreSQL isolato. Nessun crop o progresso upload percentuale |
| Cataloghi alimentari | Checkbox 14 allergeni, 8 caratteristiche, 13 additivi; testo legacy conservato; legende etichette tradotte | Dichiarazioni curate dal ristoratore; nessuna equivalenza HACCP/certificazione |
| Lingue manuali | Menu e descrizione, categorie, nomi/descrizioni piatti, etichette alimentari | Descrizione categoria tradotta e tabella completezza/mancanti implementate; chrome cliente ha le lingue originali disponibili |
| Traduzione assistita | Richiesta esplicita → preview → revisione locale → salvataggio; risultati tardivi non sovrascrivono bozza cambiata; testi esistenti conservati | Provider GROQ richiesto; assenza chiave503 esplicito; massimo200 etichette per richiesta, nessun test a pagamento/invio reale; non promettere rigenerazione completa |
| Importazione | CSV mapping e JSON workspace, preview senza scrittura, applicazione clonata nell’editor, selezione menu riallineata, Salva bozza esplicito | CSV opzionali devono essere svuotati nel mapping se non presenti; QA file grandi/errori/payload foreign/reload |
| PDF | Configurazione estesa, menu/lingua, anteprima blob e download vero dalla bozza salvata; layout/font/margini/legende/QR gestiti backend | PDF reale di 3 pagine, due colonne, testo arabo/euro e QR decodificato verificati. Visualizzatore canvas del PDF reale e testo accessibile verificati in IAB mobile. Preset PDF personali in bozza implementati; nessuna attestazione completa per ogni layout RTL |
| Link e QR pubblico | Apri/Copia link specifico menu, route pubblica con lingua/multi-menu; PDF include QR secondo configurazione | Download PNG/SVG del QR digitale collegato al backend e menu pubblicato; modalità menu esclusivo non ancora nell’editor; pagina digitale consente consultazione/link, nessun ordine senza sessione tavolo |
| Versioni | Titolo, elenco, diff aggiunti/rimossi/cambiati, restore confermato per intero workspace come nuova bozza; ordini/conti esclusi | Diff e restore come nuova revisione verificati su DB isolato e runtime QA; retention immagini verificata su DB isolato. Autore non risolto a nome |
| Metriche menu | Endpoint analytics e UI Report menu implementati | UI Report menu integrata; deduplica visite/menu/giorno/lingua verificata con DB isolato. Conteggia consultazioni, non scansioni fisiche o persone uniche. Click esterni non tracciati |
| Locali e agenzie | Selettore locale, crea locale, assegna/revoca menu_editor, guard bozza prima dello switch | Due tenant, cambio locale, editor senza accesso a ordini/cassa/statistiche/socket, revoca e riferimenti foreign verificati su PostgreSQL isolato. Switch con reload; bozza non persistita tra tenant |
| Account | UI registrazione/login/reset operativo collega endpoint; capability email prima di richiesta | Reset con hash, scadenza, consumo singolo concorrente, revoca sessioni e credenziale legacy verificato su PostgreSQL isolato. Delivery Resend e attivazione registrazione iniziale richiedono configurazione esplicita; nessun invio email reale verificato |
| Prenotazioni/promemoria | UI email/consenso, capienza e fuso ristorante/DST, outbox durevole con revisioni e annullamento reminder obsoleti | Capienza e consumo concorrente verificati su PostgreSQL isolato, DST e fuso ristorante verificati. Delivery outbox esterna disattivata; carta a garanzia non implementata/capability false |
| Voce web | SpeechRecognition browser attivato dal gesto, risultato testuale da confermare; errori/cleanup/cancellazione testati | Microfono reale e compatibilità browser da verificare; browser senza API usa input scritto |
| Hosting e WhatsApp | Runtime locale web; design Tako mantenuto nei componenti gestionali | Render rinviato; WhatsApp rinviato esplicitamente alla fine, nessuna integrazione attiva |

## Verifica frontend eseguita

`pnpm --filter @tako/web exec tsc --noEmit`: verde.

`node --test tests/web/staff-navigation.test.mjs tests/web/menu-workspace-frontend.test.mjs tests/web/staff-build.test.mjs tests/web/customer-workspace-renderer.test.mjs tests/web/pdf-preview.test.mjs`: **22/22 verdi**. Verifica compilazione18script, CSS copiata e assenza Babel/eval, role guard e guard SPA eseguito, adapter revision/preset/import/translate, renderer SSR, preview same-origin e pagina QR priva di ordini/sessione tavolo.

Questi test non sostituiscono browser/DB/PDF/provider. Nessun riavvio runtime, email, pagamento o modifica ai dati live eseguiti nel pass frontend.

## Review avversariale e riparazioni

1. Corretti perdita bozza in navigazione React/logout/cambio locale/reload; copilot aggiornato alla route corrente. Preview import/traduzioni invalidata su cambi DTO/mapping/target e controllata contro fingerprint prima di applicare. Rimosso “Tutti i contenuti” perché backend conserva traduzioni esistenti.
2. Corretti selezione menu/piatto dopo import JSON, selezione PDF con menu eliminati, spread cataloghi opzionali e testo di conferma restore (intero workspace + nuova bozza + pubblicazione separata). Test adattato al nuovo routing ed esteso con rifiuto guard e restrizioni editor.

Massimo due riparazioni del batch rispettato; stop al gate verde. Rischi UX sopra passano al QA runtime, senza attestazioni di completamento100%.

## Batch gap successivo

Implementati ricerca/filtro/albero, descrizione categoria tradotta e status di completezza, simulazione calendario UTC/fusi/overnight, download QR PNG/SVG tramite endpoint autenticato, PDFpresets personali nel DTO revisionato, diff human-readable con direzione **bozza corrente → versione selezionata**, ItemSheet grafico mantenendo quantità/note/totale checkout.

Build produzione Next finale verde: la dipendenza di build dal download Google Fonts è stata eliminata usando i font originali locali con licenza OFL. TypeScript server/web e test frontend verdi; dettagli e conteggi consolidati in `VERIFICATION.md`.

## Gate consolidati finali
101 test Vitest e 37 test Node verdi; build produzione Next e TypeScript server/web verdi; 20 controlli live su tenant QA Supabase verdi. Isolamento tenant/agenzia, bozza separata, pubblicazione, restore e disponibilità operativa preservata verificati; nessun P0 irrisolto emerso in queste verifiche. PDF generato e QR decodificato verificati realmente. PDF incorporato e disposizione editor mobile verificati; layout menu cliente dal riferimento verificato, oltre ai limiti specifici della tabella. Nessuna attestazione di parità totale, invio email reale, pagamento, WhatsApp o pubblicazione sul dominio.

## Anteprima PDF senza plugin (ultimo blocco IAB)

L’iframe blob, bianco nel browser integrato, è stato sostituito da PDF.js ufficiale6.4.299 con canvas paginato. Legge gli stessi byte Blob del PDF scaricabile; una sola pagina/canvas alla volta limita la memoria. Worker ESM, CMap, font standard, WASM e licenza copiati nel build statico locale `lib/pdfjs/`; nessuna dipendenza CDN, nessun eval abilitato, nessun cambiamento a frameAncestors none. Pagination accessibile, testo estratto consultabile, resize con limite pixelratio2 e cleanup task/worker/render/observer/blob.

Verifier aggiuntivo: PDF reale di2pagine generato internamente con PDFKit, parsing PDF.js, rendering canvas e controllo pixel colorati/testo della prima pagina. Entrambi asset MJS rispondono200 application/javascript nel runtime5137. Build staff statico live aggiornato senza riavviare servizi o build Next. QA visiva IAB del parent conclusa: titolo, prezzo, legenda, QR e testo estratto visibili; screenshot output/tako-parita-2026-10-10/pdf-preview-mobile.png. Riferimento API ufficiale: https://mozilla.github.io/pdf.js/examples/index.html

## Nuova direttiva UI cliente
Il10/10 Manuel richiede struttura unica dal riferimento fornito: tab menu in alto, categorie pill wrap, elenco nome/prezzo sulla stessa riga con divider, descrizione sotto e allergeni. Temi personali conservati. Renderer condiviso su consultazione, tavolo, asporto e anteprima. Struttura unica anche per dati storici senza design; controlli layout/cards e navigation/drawer rimossi dall’editor (DTO storici preservati). Logo/ricerca/lingua sopra, comandi servizio su riga separata, tab menu, categorie wrap centrate e lista con divisore. Larghezza di lettura massima768px, sfondo intero. SSR e TypeScript verdi; browser desktop/390px ricerca e aggiunta carrello1×12€ verificati. Toolbar finale verificata in IAB390px; prezzo/carrello12€ corretto. Anteprima con nome locale e cataloghi scoped verificata nel browser, senza contaminare DTO/versioni.

## Struttura cliente unica — decisione successiva screenshot Menumal

L’ultimo screenshot utente (`Screenshot 2026-10-10 alle 16.35.02.png`) definisce una struttura comune a tutti i menu cliente: logo e comandi ricerca/lingua in alto, tab menu, categorie a pillole centrali con wrap (attiva piena, altre bordate), elenco senza card con nome/divisore puntinato/prezzo sulla stessa riga, descrizione e badge alimentari sotto. `WorkspaceMenuRenderer` applica questa struttura a tutti i valori legacy layout/list/cards/compact e navigation/tabs/list/drawer; i controlli layout/navigation sono nascosti dall’editor, senza cancellare il DTO storico. Temi, colori e font restano personalizzabili. Foto reali e background compaiono solo se configurati, con overlay per la leggibilità; nessuna foto o palette del cliente Menumal imposta agli altri ristoranti.

DigitalMenu e MenuPreview usano gli stessi controlli e renderer. La toolbar ammette azioni servizio/filtro aggiuntive (`toolbarExtra`) e un reset filtri nello stesso sfondo (`emptyState`). Ricerca locale tollerante agli accenti; headersticky misurato con ResizeObserver e offset di scorrimento effettivo. I pulsanti esterni link restano sicuri; preview non abilita ordini o navigazione esterna.

Verifier di questo batch: TypeScript verde,16test pertinenti (8rendererSSR/customer +6adapter/editor +2build). Due nuovi test provano struttura invariata su tutti i temi/layout legacy e empty filters con reset. Build Next e QA visiva successivi sono serializzati dal parent, nessuna build Next parallela eseguita da questo agente.

### Onboarding pagina cliente (10 ottobre 2026)

Configurazione guidata in Menu → Configura menu cliente: identità visiva (logo e sfondo tramite libreria/upload, colori principale/sfondo/testo), menu completo incollato come testo, anteprima con renderer condiviso. Importazione usa preview backend `format:text`, preserva i contenuti esistenti e segnala ambiguità/possibili duplicati. Applicazione modifica solo la bozza locale nell’editor; salvataggio e pubblicazione restano azioni esplicite. Azione finale alternativa apre PDF e QR, da generare dopo il salvataggio. Protezione uscita include configurazione locale e caricamenti pendenti; risultato importato viene invalidato se cambia la bozza. Upload immagine salva realmente l’asset nella libreria, senza pubblicare il menu.

Verificati: 8 test adapter/editor (2 nuovi onboarding), 2 build staff in cartella temporanea, 8 renderer cliente. Corretto handshake anteprima per menu appena creato e non ancora salvato, mantenendo autenticazione e controllo same-origin/parent. Build Next e verifica CUA onboarding demandati al gate serializzato del coordinatore; non dichiarati eseguiti.

### Editor Aspetto organizzato per sezioni (10 ottobre 2026)

Sidebar interna verticale desktop: stili salvati, piatti, immagini, allergeni e legende, categorie, sottocategorie, menu, header, sfondo, link e recensioni. Al centro vengono mostrati solo i controlli della sezione selezionata; la preview cliente condivisa resta nella colonna di destra quando lo spazio lo consente. Su schermi stretti la navigazione interna scorre orizzontalmente e la preview si dispone sotto i controlli. Piatti usa selettori Standard/Centrato/Link e Nome/Prezzo/Descrizione per modificare il nodo corretto del tema. Tutti i campi di stile esistenti sono raggiungibili, eccetto layout/navigation legacy che il renderer unificato non applica. Le sottocategorie condividono lo stile delle categorie, dichiarato esplicitamente; non sono offerti controlli indipendenti inesistenti. Lo stile separato di macronutrienti non è supportato dal contratto attuale e non è simulato.

Verificati 12 test pertinenti (2 nuovi SSR Aspetto, 8 adapter/editor, 2 build staff in cartella temporanea). Layout mobile/desktop e somiglianza visiva con il riferimento richiedono QA CUA del coordinatore. Nessuna dichiarazione di replica esatta al 100%.

### Controlli Aspetto estesi (supersede i limiti Aspetto precedenti)

Il contratto e il renderer supportano ora stili indipendenti normale/attivo/titolo per categorie e sottocategorie, menu normale/attivo e posizione top/bottom; font locali Poppins/Staatliches/Amaranth/Italiana oltre sans/serif/mono, grassetto/corsivo/sottolineato/allineamento per le parti dei piatti; dimensioni e raggio foto; dimensioni/colori/spazi indipendenti per allergeni e caratteristiche; 14 pittogrammi SVG originali con etichette/numero persistenti; strumenti e tipografia header, dimensione logo, sfondo/raggio/opacità header in scorrimento; filtro sfondo; sei profili social, link e pulsante recensioni con stile e dimensioni dedicati. Il + del piatto apre realmente i dettagli/opzioni di ordinazione, conservando varianti e checkout. In sola lettura non viene esposto come azione d’ordine. I colori legacy delle categorie non attive ora sono applicati. Layout/navigation e categoryAlign legacy sono conservati nel DTO ma nascosti nell’editor: la struttura richiesta resta lista con divider puntinati e categorie centrate.

Verificati 24 test pertinenti: 12 renderer (4 nuovi effetti stili/SVG), 2 editor Aspetto, 8 adapter/editor, 2 build staff in temp. Nessun Next build/restart effettuato da questo agente; gate compilazione serializzato e CUA del coordinatore restano necessari. Le modifiche alla proiezione pubblica per conservare parentSectionId sono gestite dal coordinatore: senza quel dato lo stile sottocategorie non può applicarsi al menu pubblicato.
