# Piano e loop di verifica

## Decisioni modificabili
Campi additivi nel JSON workspace e nei preset; default compatibili. Ogni controllo deve avere un effetto nel renderer corrispondente. Identità/asset per ristorante, bozza e pubblicazione separate.

## Obiettivo e stop
Controlli Style/PDF osservati nel riferimento collegati a schema, editor e output reali; build server/web/staff verde, test persistenza tenant/revisioni e output PDF/mobile verdi. Il documento HACCP non verificabile è un limite esplicito, non un controllo finto.

## Ownership
Navigation: Aspetto/CSS/renderer mobile. Runtime: schema/PDF/editorPDF/guard asset. QA: test e audit avversariale. Root: font locali/licenze, riferimento in sola lettura, integrazione build/runtime e verifica browser.

## Loop
act → test mirato → osservazione output → correzione specifica → ripetizione. Massimo due correzioni per errore prima di fermare quel gate con una spiegazione concreta. Test automatici PDF.js con testo/coordinate, HTTP con PostgreSQL isolato, SSR renderer e verifica browser reale desktop/mobile. Nessun test scritture Menumal cliente, nessun acquisto o traduzione esterna durante QA.
