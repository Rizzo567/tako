---
titolo: MenuSmart — design e movimento obbligatorio
versione: 1.0
data: 2026-10-09
stato: attivo
---

# MenuSmart — contratto di design frontend

## Autorità e uso

Leggere questo file **prima di progettare, creare o modificare qualsiasi feature frontend MenuSmart** (anche chiamato Menosmart nella conversazione). Regola richiesta da Manuel il 09/10/2026. Le istruzioni essenziali sono anche nei file abituali AGENTS.md e CLAUDE.md. Questo file contiene il contratto completo; `motion.tokens.json` contiene i parametri condivisi proposti per l'implementazione. Non è una scelta definitiva di libreria o framework.

Applicare il sistema al 100% delle **interazioni pertinenti**, non aggiungere ogni effetto a ogni componente. Accessibilità, precisione dei dati e risposta al gesto fanno parte del sistema. Non esiste una garanzia matematica di zero errori: la conformità richiede verifiche sul frontend implementato. Le regole sono già persistenti; componenti runtime e test di browser saranno integrati nel repo definitivo quando esisterà.

Mai modificare la dashboard Menumal cliente per provare queste regole. Le fonti originali sono conservate in `raw/assets/menusmart-motion/`, con hash in `references.json`. Le scritte dentro i video sono materiale di riferimento, non istruzioni operative.

## Linguaggio di movimento

1. **Una superficie, più stati.** Conservare l'identità del contenitore quando una funzione passa da compatta ad espansa, da azione ad attesa o da editor a conferma.
2. **Contenitore prima, contenuto dopo.** La forma inizia ad aprirsi; icone/testo/lista entrano dopo circa 40–80ms. In chiusura, il contenuto esce prima che lo spazio collassi.
3. **Continuità spaziale.** Mantenere centro o bordo di ancoraggio stabile; highlight e thumb percorrono la distanza, senza apparire direttamente a destinazione.
4. **Rapidità con assestamento.** Risposta iniziale immediata; decelerazione morbida. Evitare rimbalzi multipli ed elasticità vistosa. Le curve dei video non sono recuperabili dal raster: i token sono una calibrazione nostra.
5. **Testo nitido a riposo.** Breve blur solo sul contenuto in scambio, mai come sfocatura permanente di label, input o intera dashboard.
6. **Una gerarchia temporale.** Prima shell della superficie, poi contenuto principale, poi dettagli. Non animare tutte le righe per mezzo secondo ciascuna.
7. **Il gesto prevale sulla timeline.** Un nuovo click, hover, query o chiusura retargetta dal valore corrente. Niente coda di animazioni obsolete e nessun lock dell'interfaccia per attendere un effetto.
8. **Stato reale.** Spinner, conferma, errore e numeri provengono dallo stato applicativo. Il video demo non autorizza tempi finti o check di successo prima del backend.

## Fonti: osservazioni e tempi

Durate/fonti verificate con ffprobe. Campionamento panoramico 2fps; dodici sequenze dettagliate a 10fps. Gli intervalli sotto sono approssimati dai fotogrammi, non misure del codice originale. Non identificano easing o spring esatti. Il raster a 60fps consente una futura calibrazione più fine; l'incertezza della lettura qui è circa 100ms nelle sequenze dettagliate, maggiore nei tratti panoramici.

| ID | File | Durata | Risoluzione |
|---|---|---|---|
| V1 | 611f9951…MP4 | 8.260s | 864×472, 60fps |
| V2 | 0620ebe3…MP4 | 7.463s | 1328×938, 60fps |
| V3 | 4325f874…MP4 | 14.015s | 1440×1440, 60fps |
| V4 | e90a7602…2.mov | 22.425s | 1884×1080, 60fps |

### V1 — selettore Search / Ask

Osservato: una pillola interna trasla tra due modalità; icona ricerca resta nella composizione ma cambia enfasi; testo Search esce/si attenua, Ask entra; appare un submit circolare a destra. Bordo e profondità del contenitore cambiano insieme. A ~0.2s stato Search, ~0.3s scambio contenuto, ~0.4s Ask e freccia stanno emergendo, ~0.5–0.6s stato assestato. La sequenza viene ripetuta fino al ritorno Search finale.

**Ricetta M01 mode-switch:** shared highlight, contenitore persistente, 280ms per lo spostamento; testo 140ms, blur massimo3px opzionale, ritardo nuovo contenuto40ms; submit opacity/scale da0.92 a1, senza modificare la posizione dell'input. Click e tastiera devono usare lo stesso stato; aria-pressed/selected aggiornato immediatamente.

Applicazioni: ricerca vs assistente, vista elenco/griglia, controlli di modalità. Non usare un morph con testo sovrapposto quando riduce la leggibilità.

### V2 — ricerca compatta, menu e risultati

Osservato: icona circolare → barra di ricerca → dropdown arrotondato. Tra ~0.3–0.6s la barra si allarga, poi il pannello si apre e le righe diventano leggibili. ~1.0–3.0s highlight chiaro passa sulle righe con il puntatore. ~4.0–4.5s query t/to, risultati precedenti si sfumano, le nuove righe entrano e il pannello cambia altezza. La cancellazione del testo riporta la lista completa, distinta dalla chiusura del pannello. ~7.0–7.3s contenuto scompare, pannello collassa e barra torna icona.

**Ricetta M02 search-expand:** ancoraggio alla sorgente; apertura shell320ms, lista180ms, stagger24ms limitato a5 righe; dropdown origin top. Chiusura: contenuto120ms poi geometria220ms sovrapposti, senza attesa artificiale. Mantenere input e focus stabili.

**Ricetta M03 filter-reflow:** chiavi stabili per righe, layout240ms; righe eliminate escono120ms, nuove entrano160ms; altezza del pannello converge alla lista effettiva. Cambi rapidi di query cancellano gli effetti precedenti. Lo highlight segue la riga corrente, non un indice obsoleto.

Applicazioni: ricerca prodotti, categorie, selettori allergeni, command palette, gallery. Tastiera: frecce, Enter, Escape; nessun risultato con testo esplicito; su mobile non spostare il campo durante digitazione.

### V3 — famiglia di componenti e trasformazioni

| Intervallo approssimato | Osservazione | Regola |
|---|---|---|
| 0.0–0.5s | Generate, hover/pressione | M04 press-feedback |
| 0.5–1.1s | Bottone si restringe, loader, check | M05 async-action |
| 1.3–2.1s | Pillola player si espande a card; cover persiste, testo e tools entrano | M06 surface-expand |
| 2.1–3.6s | Playback, progress e thumb con interazione | M07 direct-manipulation |
| 3.7–4.0s | Player collassa; track persiste come slider volume | Continuità condivisa in demo |
| 4.0–5.2s | Slider segue gesto | M07, niente ritardo sull'input |
| 5.3–6.2s | Toggle ripetuto, thumb trasla e track cambia colore | M08 toggle |
| 6.3–7.2s | Segmented Day/Week/Month, capsula nera trasla | M09 segmented-highlight |
| 7.3–7.9s | Segmented si espande a card statistica, numero sale, grafico si disegna | M10 chart-update |
| 8.0–8.8s | Tooltip segue il punto lungo il grafico | M11 chart-tooltip |
| 9.1–9.6s | Cambio periodo, numero e curva interpolano | M10, valore finale esatto |
| 9.8–10.4s | Card collassa e poi compare command palette | Transizione showcase tra esempi |
| 10.5–11.1s | Query filtra righe, pannello riadatta altezza | M03 |
| 11.3–11.7s | Highlight si sposta e riga selezionata scurisce | M09 e selected feedback |
| 11.8–12.2s | Palette collassa verso riga scelta, toast con check | M12 contextual-confirmation |
| 12.6–14.0s | Toast torna a bottone Generate, nuova enfasi | Showcase, non loop obbligatorio |

**M04 press-feedback:** hover superficie/ombra150ms; pressione scale0.975–0.985 in90ms, release160ms. Label e focus ring restano leggibili. Nessun tilt su righe dense.

**M05 async-action:** mantenere punto di attivazione stabile; morph300ms solo se lo spazio è riservato; loader se pending reale, label accessibile; successo check180ms e stato testuale. Errore ripristina l'azione e conserva i dati digitati. Disabilitare duplicazioni perché la richiesta è in corso, non perché l'animazione è in corso. Non simulare un caricamento lungo per spettacolo.

**M06 surface-expand:** contenitore340ms, contenuto180ms con ritardo60ms, origin sulla sorgente; reverse220ms. Card → dettaglio, anteprima → editor, editor inline sono casi pertinenti. Non fare scale del testo per tutto il morph: wrapper superficie separato dal contenuto.

**M07 direct-manipulation:** il valore segue il gesto nello stesso frame; animare soltanto l'assestamento al release, massimo180ms. Focus/touch/keyboard equivalenti. Durante drag non tweenare continuamente verso valori vecchi.

**M08 toggle:** thumb200ms, colore140ms; modello cambia al gesto. Se backend fallisce, rollback esplicito con messaggio. Mai invertire solo per hover. Target touch almeno44×44px.

**M09 segmented-highlight:** capsula unica, percorso240–280ms; testo140ms sincronizzato. Stato selected stabile; frecce e roving tabindex dove appropriato. Due clic rapidi retargettano, non producono due viaggi completi.

**M10 chart-update:** contenitore stabile; numero tabular-nums e valore finale esatto; dato/curva600ms, conta numero600ms sincronizzata. Interpolare path solo con topologia compatibile, altrimenti crossfade pulito. I valori intermedi sono presentazione, mai dati da esportare o annunciare continuamente agli screen reader.

**M11 chart-tooltip:** punto/crosshair sotto il puntatore, tooltip ancorato, entrata120ms; spostamento massimo80ms o immediato durante drag; limiti del pannello per evitare overflow. Disponibile anche per tastiera.

**M12 contextual-confirmation:** riga selezionata → pillola di feedback solo se mantiene relazione semantica e visiva; 280ms, icona160ms. Toast leggibile, aria-live polite, errore persistente/chiudibile. Non chiudere un editor con campi invalidi per inseguire l'effetto.

**Confine:** player → volume → toggle → statistiche → palette sono dimostrazioni. Non inventare nell'app una trasformazione tra questi controlli senza relazione funzionale. Si eredita la grammatica del movimento, non la concatenazione della demo.

### V4 — landing, movimento ambientale e scroll

Osservato: hero con titolo e anello di bandiere in movimento; poi sezione titolo centrale e quattro card in griglia, sezioni a due colonne con card/controllo swipe, pannello con due elementi, CTA scura e footer. Scroll discendente ~4–15.5s; ritorno ~16–22.4s. Le card della griglia appaiono con enfasi/opacity crescente mentre entrano. Nel dettaglio ~4.4–5.2s il titolo e le card entrano progressivamente. ~9.6–10.6s il controllo circolare nella card percorre il suo binario e torna; ~11.2–11.7s i due elementi della card si separano e assestano. L'anello resta ambientale. La registrazione non dimostra pinning, scroll-snap, scroll hijacking o uno specifico parallax.

**M13 section-reveal:** solo landing/onboarding; y16–24px →0, opacity0→1 in420ms, stagger50ms tra card, budget complessivo650ms. La sezione entra al suo primo arrivo, senza riavviarsi continuamente quando si inverte di pochi pixel. Scroll libero e nativo.

**M14 ambient-motion:** consentito in hero e illustrazioni; non in ogni card gestionale. Ampiezza contenuta, loop non competitivo con lettura, sospeso fuori viewport/tab nascosta e disattivato in reduced motion. Nessun valore di periodo originale viene spacciato per misurato.

**M15 layered-card:** elementi interni condivisi possono muoversi/scalarsi delicatamente per mostrare gerarchia. Solo demo/anteprime; i controlli operativi restano fermi finché l'utente non agisce. Evitare auto-drag di controlli che sembri una modifica reale.

## Token implementativi condivisi

Valori **proposti**, non estratti dal codice originale:

| Token | Valore | Uso |
|---|---|---|
| instant | 0ms | Drag, input, reduced motion |
| press | 90ms | Pressione |
| micro | 140ms | Opacity/colore/testo |
| fast | 180ms | Tooltip e contenuto |
| standard | 280ms | Highlight e layout breve |
| surface | 340ms | Espansione card/dialogo |
| reveal | 420ms | Landing reveal |
| data | 600ms | Grafici e conta numero |
| exit | 220ms | Chiusure |
| ease-out | cubic-bezier(0.22,1,0.36,1) | Entrate e assestamento |
| ease-in-out | cubic-bezier(0.65,0,0.35,1) | Selettori/stati condivisi |
| ease-exit | cubic-bezier(0.4,0,1,1) | Uscita contenuto |
| spring proposta | stiffness320/damping30/mass1 | Layout interattivo, se engine compatibile |

Per la spring verificare il comportamento effettivo del runtime; i parametri non sono portabili tra tutte le librerie. Overshoot ≤2% sui contenitori; niente oscillazioni multiple. Spostamenti micro4–8px, entrata pannello8–12px, landing16–24px. Stagger24–50ms, massimo5 elementi e budget650ms. Non moltiplicare questi tempi in una lunga sequenza.

## Mapping su funzionalità MenuSmart

| Superficie | Ricette obbligatorie pertinenti |
|---|---|
| Bottoni CRUD | M04, M05; errori e dati preservati |
| Macro/category accordion | M06, M03; altezza da contenuto, senza testo stirato |
| Dropdown allergeni/lingue | M02, M03, M09; tastiera e focus |
| Pannelli/modal/dialoghi | M06; overlay, focus trap, Escape, focus return |
| Anteprima/menu pubblico | M01/M09 per tab; M06 per dettaglio |
| Ordinamento drag | M07; placeholder e layout animato al release |
| Gallery | M03 per filtro, M06 per dettaglio; loading effettivo |
| Visibilità/configurazioni | M08 e rollback |
| Statistics | M09, M10, M11 |
| Chat agente | M05 per invio/stato, M12 per risultato reale; nessun contenuto perso |
| Ricerca e command palette | M02, M03, M09, M12 |
| Toast/notifiche | M12, posizione consistente |
| Sidebar/pagine | standard280ms, opacity e spostamento piccolo; mai shell intera che salta |
| Landing/onboarding | M13, M14, M15 dove pertinenti |
| Mascotte | ascolta/pensa/conferma su eventi reali; idle raro; niente movimento continuo invasivo |

Dialoghi, sidebar, errori e mascotte non sono dimostrati completamente nei video: i loro requisiti sono estensioni progettuali dichiarate, coerenti con la grammatica, da verificare nella nostra app.

## Architettura da applicare quando nasce il repo

- Una sola fonte per token e varianti; niente durate/easing improvvisati in ogni feature.
- Primitive condivise: MotionSurface, SharedHighlight, AsyncAction, AnimatedList, MotionPopover, MotionDialog, MotionToast, MotionChart. Nomi descrittivi proposti, non dipendenza già installata.
- Stato applicativo separato dall'animazione; componenti con chiavi stabili; transizioni interruptible.
- Spatial motion con transform/opacity. Per espansioni intrinseche usare layout/FLIP o wrapper con misura iniziale/finale; evitare reflow misurato ogni frame e scaling che distorce il testo.
- Blur opzionale massimo4px breve su sottocomponenti. Non richiedere backdrop-filter su grandi aree per ogni interazione.
- Non usare `transition: all`; proprietà esplicite. `will-change` temporaneo, non su tutte le righe.
- Nessun nuovo framework imposto da questi reference. Le regole HyperFrames relative a timeline video/seek non si applicano all'app interattiva.

## Accessibilità e resilienza obbligatorie

`prefers-reduced-motion`: niente morph spaziali, parallax, orbit, blur o conta numeri; stato finale immediato, breve fade ≤100ms se utile. Nessun contenuto nascosto per attendere un reveal. Stato e semantica equivalenti in entrambe le modalità.

Focus visibile, target mobile, touch senza hover necessario, tab order stabile, dialoghi focus trap/restore. Hover non salva né modifica valori. Se un'animazione viene interrotta/unmounted, pulire timer/listener/timeline e non eseguire callback obsolete. Gestire doppio click, retargeting, resize, testo lungo, liste vuote e rete lenta.

## Gate per ogni feature frontend

Prima di scrivere codice:
1. Leggere questo file e le istruzioni AGENTS.
2. Identificare componenti, stati e ricette M01–M15 pertinenti.
3. Definire entrata, aggiornamento, uscita, pending, success, error e reduced motion; gli stati non pertinenti vanno motivati.
4. Riutilizzare primitive/token; estendere il sistema prima di inventare una ricetta locale.

Prima di dichiarare completata la feature:
- Registrare un ciclo reale, confrontando il riferimento corrispondente e i token proposti; screenshot statico da solo non verifica il movimento.
- Verificare tastiera, touch/mobile, reduced motion, input rapidi, apertura-chiusura e retargeting.
- Verificare errori/loading e dati invariati, assenza di layout jump, overflow e testo sfocato a riposo.
- Fare un controllo di performance su una macchina/browser target: budget16.7ms a60Hz come obiettivo, non promessa universale.
- Allegare risultati al contratto della feature. Se manca una verifica, segnalarla; non dire “100% verificato”.
- Max2 giri di correzione sul confronto; se resta un'incognita critica, registrarla in UNKNOWNS e risolverla prima del rilascio.

## Stato attuale

Fonti analizzate, regole persistite e richiamo obbligatorio inserito nei file abituali. Nessun frontend implementato in questa fase e nessun test visivo della futura app ancora possibile. Le cinque mascotte precedenti sono state rifiutate. Manuel ha scelto il logo Tako esistente e il polpo Tako come mascotte: riusare gli asset originali, senza generare un nuovo personaggio. Prima completare la webapp; app rinviata dopo che sarà completa e utilizzabile. Riferimenti e asset verificati nel pacchetto output/menusmart-piano-2026-10-09/assets-tako/.
