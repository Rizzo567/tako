# Tako originale — parità funzionale menu, 10 ottobre 2026

Contesto: core operativo web collaudato, design Tako da conservare. Obiettivo: integrare tutti i gap approvati; WhatsApp per ultimo, nessun acquisto. Non toccare Menumal cliente o il progetto Takomenu.

| Sappiamo | Sappiamo di non sapere | Ipotesi da verificare / conseguenza | Punti ciechi |
|---|---|---|---|
| SPA staff e Next cliente, API Fastify, Supabase operativo | Schema migliore per stile/versioni/analytics | Configurazioni additive senza rompere menu attuale; spike e test rollback | Concorrenza restore e modifiche |
| Menu, traduzioni, prenotazioni già presenti | Copertura reale di fasce orarie/cataloghi | Audit codice prima di aggiungere duplicati | DST e fasce oltre mezzanotte |
| PDF equivalente manca | Renderer e font disponibili | PDF server con librerie ufficiali già presenti o gratuite, verifica pagine renderizzate | Legende lunghe e lingue RTL |
| Account operativi separati | Provider email operativo e hosting utilizzabile senza acquisti | Ricerca accessi autorizzata, nessun servizio a pagamento | Reset account e abusi agenzia |
| WhatsApp rinviato | Carta a garanzia e promemoria richiedono provider | Implementare flussi testabili; attivazione reale solo con provider verificato | Costi e consensi |

Stop discovery: contratti dati/API e ownership disgiunte, test e condizioni di completamento scrivibili. Due tentativi falliti riportano alla scoperta; nessun retry cieco. Tutti i gap devono avere stato verificabile, inclusi blocchi esterni.
