# Onboarding menu cliente — verifica10/10/2026

## Risultato
Percorso Identità visiva → Menu → Anteprima, accessibile da Panoramica/Configura menu cliente e dal menu editor. Logo/sfondo caricabili o riutilizzabili dalla libreria; colori; importazione testo completo con sezioni, piatti, prezzi espliciti e descrizioni multilinea. Candidato revisionato localmente prima di applicazione alla bozza. Salvataggio e pubblicazione separati.

PDF: azione finale Applica alla bozza e prepara PDF seleziona il menu appena importato e apre PDF e QR. Generazione/download disabilitati finché non si salva. Il PDF usa gli stessi contenuti salvati; il suo editor ha configurazioni estese ma non la stessa organizzazione visiva del riferimento Menumal.

## Gate
-108/108 Vitest mirati e39/39 Node, nessuno saltato.
-Server/web TypeScript e build Next produzione verdi;18 script staff compilati senza Babel/eval.
-PostgreSQL isolato+auth reale: target estranei rifiutati, revisione obsoleta409, preview conserva bozza/pubblicato/IDs/versioni.
-Browser live su tenant QA: ingresso Home, selezione logo+sfondo, testo con2sezioni/2piatti,6€ e14€, descrizione multilinea, anteprima di un menu nuovo non persistito, passaggio PDF con selezione menu nuovo e download disabilitato prima di save.
-Nessuna bozza/nuovo menu di prova salvato o pubblicato; immagini riutilizzate dalla libreria esistente.

## Limite browser finale
Al tentativo di uscire e scartare la configurazione QA locale, il browser integrato si è bloccato sulla conferma nativa: i comandi CUA ricevono timeout. Non aggirata la restrizione di accesso alla finestra Codex. Lo scarto richiede risposta manuale alla conferma; i dati persistiti restano invariati. Screenshot: output/tako-parita-2026-10-10/onboarding-anteprima.png nel brain.

## Editor organizzati — verifica 2026-10-10

Menumal Style e PDF Document osservati in sola lettura; nessun salvataggio o modifica alla dashboard cliente. Tako Aspetto ora suddivide i controlli per argomento e testo Standard/Centrato/Link, Nome/Prezzo/Descrizione. PDF usa Documento/Temi con Formato, Stile testo, Contenuti, Traduzione, Spazi e Avanzate.

Build staff locale riuscito; 7/7 test mirati Style/PDF layout/PDF.js verdi. Verifica browser sulla sola tenant QA: accesso onboarding con logo/sfondo/colori, Aspetto con anteprima cliente reale, PDF Documento con canvas e pagina 1/1. Nessun salvataggio/pubblicazione nel test; viewport ripristinato. Screenshot in brain/output/tako-parita-2026-10-10/style-editor-organizzato.png e pdf-editor-organizzato.png.

Limiti: organizzazione allineata, non parità completa dei controlli. Restano tipografia PDF distinta per elemento, sottolineatura, centratura verticale, sfondo immagine PDF, spazi per singola area e legende indipendenti. Sottocategorie ereditano stile categorie.
