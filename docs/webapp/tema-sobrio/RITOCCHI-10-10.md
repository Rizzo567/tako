# Ritocchi del 10/10 — tema Sobrio unico, sidebar, Team, onboarding menu

Branch `codex/tako-webapp`. Perimetro: `apps/dashboard/public/staff/**`, `apps/server/**`, test e `scripts/qa-*`. `apps/web` non è stato toccato.

| commit | contenuto |
|---|---|
| `bdcb49c` | server: la libreria immagini salta gli oggetti fuori formato invece di dare 500 (causa di «Errore interno») |
| `da9e996` | staff: tema Sobrio unico, via il «Tako classico» e ogni arancione tranne il logo |
| `7e4e204` | staff: sidebar con Panoramica in Servizio, Team dentro Impostazioni |
| `f2397eb` | server: `POST /api/menu-workspace/brand-from-site`, colori e logo dal sito con fetch anti-SSRF |
| `e565b75` | staff: onboarding «Configura menu cliente» e schede Menu in stile Sobrio |
| (ultimo) | qa: `scripts/qa-ritocchi-sobrio.mjs`, questo documento, immagini |

## 1. Tema Sobrio unico

- I valori Sobrio sono i token di base in `styles.css` (`:root`): bianco, grigi neutri, primario `#0a0a0a`, raggi 12/16/24, pulsanti a pillola, Inter rimappata («Tako Sobrio»). `src/sobrio.css` contiene solo carattere, stati hover/focus e primitive di movimento; nessun selettore `data-ui`.
- Tolti: la scheda «Tema dell'interfaccia» in Impostazioni › Aspetto, `UI_THEMES`/`loadUi`/`saveUi` e la chiave `localStorage` `tako-dash-ui:*`, `UiCtx`, `TakoCtx`, `BRAND_PALETTES` (e la scheda «Colore brand» che serviva solo al classico), i rami classici di `Btn`, `IconBtn`, `Badge`, `Overlay`, scorciatoie della Panoramica e copia link QR, le regole CSS sostituite, i font DM Sans e Nunito (7 file `.woff2`) e la cornice «prototipo» inutilizzata in `styles.css`.
- Sempre attivi: `MorphOverlay`, `PageMorphLayer`, `sbInstallTriggerTracker` (pulsante → riquadro e pulsante → pagina). `qa-tema-sobrio-motion.mjs`: 8/8 scenari ok (conto, modale, retarget, comanda, errore, pagina, ridotto, mobile).
- **Arancione**: l'unico elemento arancione è il logo Tako in alto a sinistra (sidebar desktop; su mobile la mascotte dell'intestazione, che fa da logo). Le altre mascotte sono in scala di grigi (`Tako` senza `logo` → `grayscale(1)`). Neutralizzati: `--brand*` (nero/grigi), badge e contatori, confetti, assistente (fallback `#ED7159`/`#D97757`, rosso salmone → rosso), schermata di avvio (`index.html`), login, schermata d'errore, avvisi `#9A6912`. Stati: ok `#15803d`, errore `#b91c1c`, attesa in ambra scura `#8a6a00` (tonalità 46°, fuori dalla fascia arancione), tavolo in attesa `#ca8a04`.
- Non sono dashboard ma contenuto del cliente, quindi restano con i colori del locale: l'anteprima del menu cliente (iframe di `apps/web`), il PDF renderizzato nella scheda PDF (canvas) e i campioni colore dell'onboarding.

## 2. Sidebar e Team

- `NAV`: «Servizio» = Panoramica, Sala, Ordini, Cucina, Cassa, Prenotazioni; «Gestione» = Menu, Magazzino, Report; sotto, Assistente e il menu utente. Via il gruppo «Tako» e le voci Team e Impostazioni.
- Impostazioni si apre dal menu utente («Titolare/Demo owner» › Impostazioni) su desktop e dall'icona ingranaggio accanto all'utente nel drawer mobile; tolta anche dal gruppo «Altro» del drawer.
- Team dentro Impostazioni: le schede in cima a Impostazioni ora sono Locale · **Team** · **Turni** · Dispositivi · QR tavoli · Collegamenti. `staff` (collaboratori) e `turni` restano route valide (`NAV_PARENT` → `impostazioni`, `staff` in `EXTRA_NAV` con etichetta «Team»): link interni, copilot (`takoGo`), checklist di setup e percorsi salvati funzionano come prima. Titolo della pagina «Team».
- Ruoli: cameriere, chef e cassiere non vedono Impostazioni; i loro turni sono la voce «Turni» in Gestione (sidebar e drawer), con la stessa guardia `canNavigate`. Owner: bottom bar invariata (Panoramica, Sala, Ordini, Cassa + Altro).
- Test aggiornati in `tests/web/staff-navigation.test.mjs`.

## 3. Onboarding «Configura menu cliente»

### Causa di «Errore interno»
All'apertura il passo 1 chiama `GET /api/menu-workspace/assets`. `galleryInventory` elenca lo storage Supabase del locale e, se un oggetto non ha il nome generato dagli upload (`[A-Za-z0-9_-]{16}.ext`), lanciava `Invalid stored image inventory` → 500 → messaggio «Errore interno» nel riquadro. Nel locale «Pizzeria» (utenti Demo Owner, Manuel) c'è `_style_ref.jpg`, caricato a mano il 09/10 (verificato in sola lettura). Correzione: gli oggetti fuori formato si saltano, come già nel ramo locale (`tests/menu-workspace-gallery.test.ts`). In più il client non mostra più un alert bloccante se la libreria non risponde: compare una nota discreta e il caricamento resta possibile.

### Interfaccia
- Card a raggio 24, intestazione con «Chiudi», passi a pillola numerati (spunta verde sui passi fatti), piede con azioni a destra; tutto in `src/menu-workspace.css` sotto `.mw-setup`.
- **Logo** (a sinistra) e **Sfondo**: riquadri «Trascina qui il logo / lo sfondo» che accettano trascinamento e clic; anteprima su scacchiera, «Sostituisci», «Rimuovi», stato di caricamento, errori di formato (PNG/JPG/WebP) e dimensione (10 MB). Il caricamento usa l'upload esistente nella libreria (`adapter.uploadAsset`), come prima. «Scegli dalla libreria» resta, con «Logo»/«Sfondo» per ogni immagine.
- **Colori**: tre campioni modificabili (Principale, Sfondo, Testo) con selettore colore e codice esadecimale, indicatore di contrasto testo/sfondo, riga d'esempio con prezzo.
- **Dal logo**: al caricamento (o scelta dalla libreria) il logo viene letto lato client con canvas (96 px): grappoli di colori, sfondo dal bordo (trasparente → tinta chiarissima del principale), principale = primo colore saturo, testo = tinta scura del principale o `#111`/`#fff` con contrasto ≥ 4,5:1.
- **Dal sito**: campo indirizzo + «Analizza sito» → `POST /api/menu-workspace/brand-from-site`; usa `suggested` del server, `theme-color`, colori CSS e logo (data URL, ricolorato anche lato client). Se non c'è ancora un logo, «Usa il logo del sito» lo carica nella libreria.
- I colori estratti sono una **proposta** con campioni modificabili e «Usa questi colori» / «Scarta»: nulla entra nella configurazione finché non la si usa, e nulla va nella bozza finché non si preme «Applica alla bozza»; poi restano Salva bozza → Pubblica come prima.
- Passo «Menu»: destinazione, testo con `#CATEGORIA`, aiuto compatto in tre righe (`# ANTIPASTI` categoria · `Bruschetta — 6,00 €` nome e prezzo · riga sotto descrizione) al posto del blocco di codice. Passo «Anteprima»: conteggio importati, avvisi in lista, iframe in cornice, «Applica e prepara PDF» / «Applica alla bozza». Logica (`analyze`, `stale`, controllo `result.base`, `onApply`) invariata.

### Endpoint `brand-from-site` (sicurezza)
Solo `http/https`, porte 80/443, niente credenziali nell'URL; DNS risolto e bloccato se un indirizzo è loopback, privato, link-local/metadata (169.254.169.254), CGNAT, multicast/riservato, IPv4-mapped/NAT64/6to4 verso questi, `localhost`/`*.local`/`*.internal`; connessione all'IP verificato (niente DNS rebinding); redirect manuali (max 3) rivalidati; timeout 5 s, limite 2 MB in streaming (logo 1 MB); nessun cookie o header inoltrato; rate limit 6/min per utente (vale anche da loopback); solo owner e menu_editor (capability `style`). Errori 400/422/429 con messaggi in italiano, mai 500. Prova sul server acceso: anonimo 401, `169.254.169.254` 422, `file://` 400, `https://example.com` 200.

## 4. Schede del Menu
Restyling in `.mw` (wrapper di `ScreenMenuWorkspace`), senza cambi di funzioni: campi 40 px raggio 12 con focus nero, select con freccia, textarea, checkbox e colori neri, file input a pillola, `details` con freccia, fieldset raggio 16, tabelle leggere; schede e navigazioni (Aspetto, PDF) a pillola nera/bianca; anteprima cliente in card raggio 24; albero categorie, righe piatto, storico versioni e confronto coerenti.

## 5. Verifiche

| verifica | esito |
|---|---|
| `npx vitest run` | 170 verdi (118 baseline + 1 libreria + 51 `site-brand`), 13 file rossi = baseline (Postgres :5432) |
| `node --test tests/web/*.test.mjs deploy/render/gateway.test.mjs` | 65/65 (incluso `menu-setup-colors.test.mjs` nuovo e i test aggiunti in parallelo da `apps/web`) |
| `tsc --noEmit` server e web | 0 errori |
| build staff | ok, 19 sorgenti |
| `scripts/qa-ritocchi-sobrio.mjs` | 30/30 schermate ok (15 desktop + 15 telefono 390): nessun colore arancione (H 5–35°, S > 40 %) tra 56–228 colori campionati per schermata, nessun errore di pagina/console, nessun «Errore interno». Dettaglio in `ritocchi-10-10/qa-ritocchi.json` |
| `scripts/qa-tema-sobrio-motion.mjs` | 8/8 ok |

Il QA non scrive sul Supabase remoto: upload logo/sfondo, analisi del sito e anteprima d'importazione sono mockati con `request.respond`; ogni altra richiesta non GET riceve 403 (l'unica lasciata passare è `POST /pdf`, rendering in sola lettura). Il logo viene caricato via `uploadFile` sul campo del riquadro e lo sfondo con un vero `drop` (`DataTransfer` con `File`).

Immagini: `ritocchi-10-10/desktop-panoramica-impostazioni-team.png`, `desktop-onboarding.png`, `desktop-menu-schede.png`, `mobile.png`.

## 6. Domande aperte

- `brand-from-site` ammette owner e menu_editor (capability `style`); le altre route del workspace ammettono anche `manager`. Va aperto anche al manager?
- Il rate limit dell'endpoint è in memoria (si azzera al riavvio, non è condiviso tra istanze): va bene per ora o serve Redis?
- Su mobile il «logo in alto a sinistra» è la mascotte dell'intestazione, che cambia posa per pagina ed è rimasta arancione. Si preferisce il logo fisso (`logo-chef`) anche lì?
- Il PDF e l'anteprima cliente mostrano i colori del locale (es. il salmone del menu QA): restano così perché sono contenuto del cliente.
- `docs/webapp/tema-sobrio/VERIFICA.md` §1 e §7 descrivono la scelta del tema per utente, ora rimossa: il documento resta come storico.
