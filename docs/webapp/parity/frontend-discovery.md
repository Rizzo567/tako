# Parità Menumal — contratto UX frontend Tako originale

Data: 2026-10-10. Discovery in lettura; unico output questo documento. Nessuna modifica a frontend, runtime attivo, database o dashboard Menumal del cliente. WhatsApp è rinviato alla fase finale, senza collegamenti o nuove integrazioni ora.

## Fonti e metodo

Letti `.claude/CLAUDE.md`, skill `redesign-existing-projects`, audit canonico `/Users/manuel/Documents/brain/output/menumal-analisi-2026-10-09/analisi-dashboard.md`, dashboard originale `apps/dashboard/public/staff/src/06-screens-gestione.js`, schema menu e componenti cliente `apps/web/src/components/MenuView.tsx`/`CustomerApp.tsx`.

La skill guida scan → diagnose → interventi mirati nello stack esistente. La richiesta di mantenere il design prevale sui suggerimenti generici di cambiare font, palette, icone o framework: conservare Nunito/DM Sans, palette brand, superfici calde, sidebar scura, mascotte, Card/Btn/Overlay e motion già presenti. L'obiettivo è aggiungere capacità, non replicare il tema scuro specifico del cliente Menumal.

L'audit distingue osservato, documentato e da verificare. HACCP, comportamenti esatti di backup e completezza della suite organizzativa sono ancora parzialmente ignoti; non dichiarare conformità 100% basata sui soli controlli visibili.

## Stato effettivo e rischi da correggere

- ScreenMenu offre un elenco unico di sezioni/piatti, creazione immediata di un piatto minimale, upload foto, varianti, traduzioni per piatto e importazione da testo con anteprima.
- Il DB ha già più menu, tipo/ordine/active e sezioni; lo staff attuale non espone una selezione completa multi-menu. Mancano rappresentazione di sottocategorie, calendario visibilità, stili/PDF/versioni nel modello corrente.
- L'icona trascinamento è decorativa nell'elenco attuale: non deve diventare promessa di riordino senza API e interazione reali.
- Alcune operazioni ottimistiche senza ID mostrano falso successo locale; nel nuovo editor nessun salvataggio è riuscito prima della risposta reale.
- Salvataggio piatto, varianti e traduzioni usa più richieste: un fallimento intermedio può lasciare un risultato parziale. Necessaria operazione editoriale atomica o revisione/riprova esplicita delle parti fallite.
- Il menu cliente è un'app Next diversa dalla SPA staff: anteprima va resa dallo stesso renderer cliente e schema pubblico; una miniatura ricostruita a mano divergerebbe.
- Il preview non deve creare sessioni tavolo, ordini, chiamate o eventi statistici. Nessun token tavolo reale nell'anteprima editoriale.

## Architettura di navigazione

Sidebar invariata rispetto alla riorganizzazione approvata: Menu dentro Gestione. In Menu quattro tab: **Contenuti**, **Aspetto**, **Lingue**, **Condividi e stampa**. Libreria immagini è selettore riutilizzabile raggiungibile dagli editor e da Aspetto; Versioni è pulsante in toolbar, non un'ennesima voce sidebar. Team controlla i permessi; Report contiene statistiche menu. Nessuna sezione WhatsApp in questa fase.

Toolbar comune: selettore menu, ultimo salvataggio/versione, Anteprima, Versioni. Nuovo menu/import disponibili secondo capacità effettive dell'utente. Non introdurre un sistema di bozze/pubblicazione senza contratto dati: prima versione usa **Salva modifiche**, aggiornando il pubblico solo dopo risposta; gli input non salvati restano nell'anteprima con badge **Anteprima non pubblicata**. Esaurito/disponibile è azione operativa separata con conferma del server.

### Contenuti

Desktop: albero menu → categoria → sottocategoria sul lato editor e anteprima mobile affiancata; ricerca e filtro stato. Selezione riga apre inspector inline, senza sovrapporre modali per ogni campo. Mobile: elenco/editor a pagina e pulsante Anteprima con ritorno allo stesso elemento e scroll.

Form piatto in gruppi progressivi: Informazioni (nome/descrizione/foto), Prezzi e varianti, Informazioni alimentari, Disponibilità, Avanzate (stazione/costo/preparazione/link/tipo visualizzazione). Creare nuovo elemento nel form locale, senza inserire "Nuovo piatto" a prezzo zero nel pubblico prima del salvataggio.

Riordino via pointer e pulsanti su/giù accessibili; stessa API di ordinamento. Move categoria/piatto deve conservare ID. Nome non è identità. Prezzi compositi sono presentazione di opzioni con prezzi numerici; mai testo ambiguo trasmesso al checkout. Piatti centered/link non ordinabili devono essere rappresentati esplicitamente e non entrare nel carrello.

Orari: giorni/intervalli/timezone del locale visibili, gestione overnight e indicatori disponibilità attuale; filtro anteprima data/ora non cambia il server né il servizio.

### Aspetto

Preset selezionabili con miniatura e comando Applica; modifica crea stato locale, salva preset e seleziona stile assegnato al menu. Un pannello semplice per sezioni: Testi, Immagini, Categorie, Allergeni e legende, Navigazione, Header, Sfondo, Link/recensioni. Opzioni avanzate progressivamente aperte mantengono tutte le proprietà osservate nell'audit (nome/prezzo/descrizione per standard/centered/link; stati active, gap, bordi, raggio, logo/header scroll, background repeat/cover/blur/opacità).

Ogni controllo usa unità esplicite, limiti validati e valore effettivo; nessuno slider "50" mentre il campo è vuoto. Sanitizzazione lato server: niente CSS arbitrario, script, URL javascript o font esterni arbitrari. Font ospitati localmente/licenziati e fallback leggibili. Stile pubblico usa variabili CSS limitate, non altera la gerarchia gestionale Tako o i componenti checkout.

### Libreria immagini

Selettore comune per piatto/logo/sfondo: griglia miniature, ricerca, ordinamento nome/peso/data, quota reale e upload con progresso/errore. Riusa asset senza duplicarlo. Metadati ID, nome, dimensione, data, usi; eliminazione impedita o confermata con elenco degli usi. Asset e permessi isolati per locale. Crop opzionale solo se implementato e verificato; non necessario per dichiarare le sole opzioni osservate. Quota 50MB è riferimento dell'account Menumal, non limite da imporre senza decisione commerciale.

### Lingue

Selettore lingue + tabella stato completo/mancante/da aggiornare; testo originale e traduzione affiancati. Copertura menu/categorie/sottocategorie/piatti/descrizioni e cataloghi alimentari. Modifiche manuali protette dalla rigenerazione; traduzione massiva sempre revisione e conferma prima del salvataggio. Copertura 26 lingue dell'account osservato non equivale a 100 lingue verificate. Costi/provider e politica dei nomi piatti vanno resi espliciti prima di automatizzare.

### Condividi e stampa

Due modalità: Digitale (link generale, specifico/esclusivo menu, QR scaricabile) e PDF. PDF editor dedicato con anteprima paginata dello stesso documento che viene scaricato. Gruppi Format/Testi/Contenuti/Lingua/Margini/Avanzate e preset originali Tako (nessuna copia dei nomi proprietari dei temi Menumal).

Tutte le opzioni osservate: colonne/allineamento/centered/interruzione categoria/sfondo, font/enfasi/colore/dimensioni, menu selezionati, lingue e politica traduzione, margini quattro lati, logo/forma, legende, nome menu/data/pagina/QR. Pagine senza tagli, prezzo collegato al piatto, titoli mantenuti con il primo elemento. Esclusione hidden distinta da esaurito; PDF esplicita cosa include. Rendering server o browser automatizzato da scegliere con spike; non spacciare un window.print() per download PDF impaginato verificato.

HACCP: offrire un registro ingredienti/allergeni solo dopo specifica del contenuto. Il controllo Menumal è osservato, non il documento; niente claim di certificazione o equivalenza normativa non dimostrati.

### Versioni

Drawer cronologico per menu con autore/data/operazione. Compare evidenzia aggiunti/rimossi/spostati/modificati con valori prima/dopo. Restore mostra perimetro e impatto, chiede conferma, crea una nuova versione senza sovrascrivere lo storico; ripristina solo contenuti editoriali concordati, mai ordini/conti/staff. Immagini referenziate devono sopravvivere alla retention dei backup.

## Contratto API atteso (proposta, non endpoint già presenti)

DTO unico MenuDocument revisionato: menu multipli, albero stabile, items/variant prezzi, cataloghi/schedules, traduzioni e riferimenti asset. Save richiede revision/If-Match, autorizza capacità e applica tutto in transazione; conflitto 409 offre confronto e ricarica senza perdere modifiche locali. GET preview restituisce identico DTO pubblico più overrides temporanei autorizzati, senza persisterli. StylePreset/PdfPreset versionati e tipizzati; asset CRUD/quota; snapshot list/diff/restore. Lingue automatiche restituiscono preview/job e mai scrivono tramite GET. Accesso server per capacità content/style/pdf/assets/report separato dai ruoli sala già esistenti.

Il frontend non deve dipendere da nuovi endpoint prima che il backend abbia pubblicato schema/contratto testato. L'enforcement UI completa, non sostituisce, quello server.

## Ownership proposta per implementazione

| Workstream | File esclusivi | Dipendenze |
|---|---|---|
| Editor staff | nuovo `apps/dashboard/public/staff/src/13-menu-workspace.js`; nuovo `menu-workspace.css` | DTO/permessi/preset backend |
| Integrazione staff serializzata | `06-screens-gestione.js` solo delega ScreenMenu; `01-data.js` API/mapping; `07-app-root.js` integrazione; `index.html` ordine script; `styles.css` import CSS | nessun altro agente in parallelo sugli stessi file |
| Renderer preview/cliente | nuovi `apps/web/src/components/menu/` condivisi; `MenuView.tsx`, `CustomerApp.tsx`, nuovo route preview autorizzato | PublicMenu espanso; non alterare cart/tracking |
| PDF staff | nuovo `14-menu-print.js` e nuovi template styles dedicati | API PDF + artefatto renderizzato |
| Libreria/versioni staff | nuovo `15-menu-assets-history.js` | asset/snapshot API e capacità |
| Tipi/dati | `packages/types`, `packages/db` | owner backend/database distinto, frontend read-only |
| Backend | nuove route/services parity, `menus.ts` integration | transazioni, tenant, prezzi/schedules |
| Verifica | nuovi `tests/web/parity-*`, fixtures proprie | headless su ambiente test, nessuna scrittura cliente Menumal |

I numeri file sono ordine proposto; verificare collisioni prima di crearli. Nessun nuovo framework/libreria per il solo editor. Il build staff legge gli script dall'HTML, quindi basta integrare l'ordine una volta senza cambiare il compilatore.

## Inventario incognite

| Sappiamo | Sappiamo di non sapere | Ipotesi da verificare / effetto se falsa | Punti ciechi |
|---|---|---|---|
| DB supporta più menu ma UI è singola | nuovi DTO/policy della fase backend | renderer condiviso supporta override draft; spike senza sessione, altrimenti route preview dedicata | side effects analytics/carrello nelle anteprime |
| cliente usa Next, staff JSX globali | portata preset già progettata altrove | token tipizzati coprono audit; se falsa integrare schema prima UI | font/contrast/readability configurabili male |
| Supabase Storage funziona | metadati gallery/retention assegnazioni | registro asset transazionale; se falsa impossibile calcolare usi/eliminazione sicura | asset di backup cancellati |
| varianti sono modifier oggi | prezzo assoluto e disponibilità per formato | migrazione mantiene checkout storico; se falsa adattare API prima nuove opzioni | comande/inventario basati su nomi |
| PDF audit controlli completo | motore PDF/layout e documento HACCP esatto | spike 1/2colonne con lingue lunghe; se falsa cambiare motore | RTL, glyph mancanti, QR, page breaks |
| utenti operativi hanno ruoli | granularità autorizzazioni e multi-locale | capacità editoriali aggiuntive senza ampliare ruolo cameriere; se falsa schema memberships | preview diff rivela altri tenant |
| orari hanno timezone | DST/overnight e esclusività menu | intervalli timezone-aware backend; se falsa visibilità incoerente | PDF fuori orario e ordini piatto appena nascosto |

Incognite non richiedono scelte utente immediate: usare opzioni conservative, esplicitare nelle note e verificare spike. HACCP e provider/pricing traduzioni possono restare gate specifici senza impedire editor base; equivalenza totale non dichiarabile finché mancanti.

## Loop e criterio di completamento

Fase 1 contratto e fixtures → Fase 2 editor multi-menu con albero/variant/capacità → Fase 3 renderer preview/preset/gallery → Fase 4 lingue/PDF/versioni/report → Fase 5 QA per ruoli e locale → solo alla fine WhatsApp. Ogni batch act/observe/verify/decide; massimo due riparazioni per failure, poi adattare piano o dichiarare gate bloccato specifico.

Verifier: salvataggio→reload→pubblico coerente; prezzi ordine server invariati; tenant e ruoli négativi; conflitto concorrente; disponibilità con datetime; preview senza analytics/write; riuso/eliminazione asset; snapshot restore senza toccare servizio; PDF render pagine reali con long text/RTL; mobile/tastiera/focus/reduced motion/loading/error/rapidi input. Registrazione motion su ambiente proprio prima rilascio, non soli screenshot. Build completa e test core ordini/KDS/cassa senza regressioni. Il runtime corrente si conserva durante implementazione e il collaudo usa fixture/locali dedicati.
