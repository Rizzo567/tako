# Aspetto e PDF — verifica avversariale

Obiettivo: ogni controllo mostrato salva un valore valido, sopravvive a reload/versione e produce un effetto nel renderer cliente o nel PDF reale. Confronto con Menumal soltanto in lettura. Nessun build runtime/Next o modifica dati originali richiesta dal pass QA.

| Sappiamo | Sappiamo di non sapere | Ipotesi e verifica / conseguenza | Punti ciechi |
|---|---|---|---|
| DTO schemaVersion1 preesistenti nel DB | Nomi canonical e default dei controlli estesi | Schema parse di payload legacy e roundtrip HTTP DB; default non deve annullare colori/stili presenti | Versioni salvate prima dei campi nuovi |
| PDF server PDFKit e pdfjs-dist installati | Ogni campo PDF influenza il documento? | Aprire byte PDF con pdfjs, verificare testo/posizioni/numero pagine/dimensioni, non hash bytes | Font incorporati bold/italic diversi dal font selezionato; titoli/QR/logo |
| Renderer unico cliente/preview | Nuovi campi normali/attivi e sottocategorie sono realmente applicati? | SSR con valori sentinella distinti e gerarchia reale; QA browser mobile per clipping/interazioni | Impostazioni esposte ma ignorate, fallback che sovrascrive default legacy |
| Asset tenant scoped e versioni ne impediscono cancellazione | Nuovi URL immagini entrano in tutti i boundary? | HTTP foreign asset404 e bozza invariata; own asset roundtrip; loader PDF non legge altro tenant | URL nested nel PDF, riferimenti solo nelle versioni/preset |
| Revisioni ottimistiche e restore come nuova bozza | Stili/PDF nuovi persistono e stale write non modifica la versione | HTTP stale409 e SQL before/after; restore conserva snapshot pubblicato finché Pubblica esplicito | Concorrenza salvataggio/export e restore vecchio schema |

Loop: audit → contratto agenti → test mirati → osservazione → riparazione agenti proprietari. Massimo due riparazioni motivate per batch. Stop verde: persistenza/compatibilità/boundary/effetto reale attestati; gate browser rimasti sono dichiarati, non sostituiti da SSR. Blocco dati/tenant è stop esplicito.

## Audit iniziale
- Screenshot riferimento locale `menumal-style-reference.png`: font/colore, grassetto/corsivo/sottolineato, dimensioni per nome/prezzo/descrizione, testo centrato, gap centrato e divisore nome/prezzo visibili.
- Renderer precedente ignora `design.coverUrl`; controlli nuovi devono applicarlo oppure non mostrarlo. Colori categoria inattiva non applicati: fix già preso in carico da frontend.
- Asset ownership e gallery devono includere nuovi riferimenti immagine: lista di soli logo/copertina/sfondo/piatti non basta se il DTO introduce URL aggiuntivi.
- PDF precedente usa NotoSans per bold/italic anche selezionando serif/mono: l'effetto reale delle nuove famiglie per elemento richiede verifica.

## Evidenza conclusa nel pass QA
- `tests/menu-controls-output.test.ts`: 6 verifiche su PDF reale letto con pdfjs. Visibilità nomi/prezzi/descrizioni/allergeni e traduzione; dimensioni A5/orientamento e margini; font-size separato nome/prezzo e spazi; centratura verticale e disattivazione traduzioni; footer48px; stress due colonne, font48px, grandi spazi, descrizioni/prezzi lunghi e16 piatti.
- Stress: ogni identificativo piatto estratto esattamente una volta dalla famiglia font del nome; prezzi e descrizioni hanno font distinti. Controllate coordinate testo `x + width` e `y + height` rispetto alla pagina fisica, comprese tutte le pagine prodotte. Non equivale a copertura di ogni combinazione o assenza di overlap tra colonne.
- `tests/parity/menu-controls-persistence.integration.test.ts`: PostgreSQL temporaneo e auth reali, DTO precedente con nuovi default, persistenza campi estesi, rifiuto stale409 e asset PDF/preset foreign404; restore di snapshot precedente all’estensione crea nuova revisione senza cambiare il pubblico. Test aggiuntivo della proiezione pubblica sottocategoria/descrizione tradotta.
- Difetto concreto riprodotto: footer48px con margine inferiore15pt veniva tagliato. Backend ha riservato spazio dinamico al footer; test reale ora verde.
- Difetto concreto rilevato: proiezione pubblica perdeva parentSectionId/descrizione della sezione, quindi lo stile sottocategoria funzionava solo nell’anteprima. Root ha aggiunto entrambi e il test verifica il passaggio.
- PDF immagini nuove: riferimenti sfondo/preset controllati dal boundary tenant; il loader PDF usa solo upload relativi, come dichiarato nell’editor. Non attesta download di immagini esterne HTTPS.

Gate da chiudere dall’orchestratore: QA browser mobile/desktop dei nuovi controlli, scrolling/header, tap rapidi e resa visiva finale. I test SSR frontend del batch coprono gli effetti DOM, ma non misurano geometria/mobile/touch nel browser.

## Gate immagini PDF aggiuntivo
`tests/menu-controls-images-output.test.ts`: **2/2 verdi**, PDF reale rasterizzato con PDF.js e canvas nativo già installato. PNG sintetici in cartella temporanea, `UPLOADS_DRIVER=local`; nessuna rete o Storage remoto.

Verificati operatori image paint e grafica/opacità0.5; trasformazioni cover/contain diverse e pixel effettivi (cover tinge tutta pagina, contain lascia il fondo bianco); opacità0 lascia bianco. Logo trasparente: fondo verde/arancione effettivo, centro blu, angoli ritagliati per cerchio/arrotondato e conservati per quadrato. URL di tenant diverso non produce operatori immagine, pur esistendo il file della fixture. Ambiente ripristinato e directory temporanea rimossa dopo i test. Nessuna modifica a codice produzione.
