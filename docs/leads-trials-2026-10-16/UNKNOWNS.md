# Incognite e criteri della fase Lead e PROVA

| Sappiamo | Sappiamo di non sapere | Ipotesi e verifica | Punti ciechi |
| --- | --- | --- | --- |
| 50 lead fuori Lombardia, primi10 ordinati | Menu/prezzi attuali disponibili per tutti10 | Ricerca fonte ufficiale per ciascuno; segnalare fonti storiche/mancanti, nessuna invenzione | Carta fissa non equivale al menu giornaliero |
| Dashboard agenzia autenticata e DB esistenti | Permessi DB per nuove tabelle CRM | Migrazione idempotente con ruolo backend e nessun accesso anonimo; API auth/409 test | Concorrenza Manuel/Ale, note perse |
| Menu renderer/anteprima draft disponibili | Link persistenti di demo senza pubblicazione | Token casuale hashato + onlyPROVA + noindex, lettura draft; verificare anonimo con/senza token | Non confondere demo con prova30giorni attivata |
| User chiede pagina operativa condivisa | Comportamento UI desktop/mobile | Filtri, note, attività manuali e refresh reale; screenshot e test salvataggio/readback | Click WhatsApp non prova invio |

Stop: 50lead leggibili/salvabili da agenzia, non accessibili ad anonimo/ristoratore; 10locali PROVA creati senza duplicati e anteprime fondate sui dati disponibili, con limiti visibili. Test API/TypeScript/build, verifica live delle operazioni e dei dati. Max2riparazioni per errore ripetuto, poi blocco esplicito. Nessun contatto, invito titolare o pubblicazione ufficiale implicita.
