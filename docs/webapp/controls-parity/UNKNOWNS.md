# Controlli completi — incognite

| Sappiamo | Sappiamo di non sapere | Ipotesi e verifica | Punti ciechi |
|---|---|---|---|
| Manuel richiede tutti i controlli Style/PDF e stessa organizzazione | Catalogo totale font Menumal | Quattro famiglie osservate distribuite localmente con OFL; verificare menu e PDF | Font mancanti per scritture CJK; non promettere copertura universale |
| Schema workspace JSON revisionato, tenant QA separata | Effetti estremi di font/spazi su pagine | PDF.js estrae tutti i piatti e coordinate; render pagine reali | Descrizioni molto lunghe e salti pagina |
| Asset upload privati scoped al locale | Contenuto documento HACCP riferimento | Tentativo sola lettura senza download: non attestare equivalenza o certificazione | HACCP richiede dati/processi specifici del ristorante |
| Vecchi menu esistenti e pubblicati | Compatibilità nuove impostazioni con storico | Campi additivi opzionali e fallback; test vecchio DTO e stale409 | Versioni con asset storici devono rimanere recuperabili |
| Traduzioni salvate disponibili | Provider esterno non esercitato in QA | Opzione auto preserva nomi con descrizione, usa traduzioni salvate | Lingue mancanti evidenziate e fallback esplicito |
