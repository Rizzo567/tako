# Avvio locale della webapp Tako

Il percorso locale consente di provare il frontend web di Tako e i ruoli operativi. La pubblicazione online è rimandata; nessun servizio Render viene attivato. Non avvia, modifica o installa il bundle desktop e non interrompe i servizi esistenti sulle porte 4317, 3001 o 3002.

## Configurazione

Inserire nel file privato `.env.web` alla radice del progetto le credenziali del database operativo Supabase e di Storage, oltre a un `JWT_SECRET` robusto. Sono richiesti `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_STORAGE_BUCKET=tako-menu-images`. `DATABASE_CA_CERT_PATH` indica il certificato CA per verificare la connessione TLS al database. Il file resta escluso da Git; nessuno script stampa password o chiavi.

Gli account titolare e staff devono essere già provisionati o migrati nel database operativo, con credenziali individuali. Il launcher disabilita la registrazione pubblica. Le funzionalità AI necessitano anche delle rispettive chiavi provider.

## Un solo comando

Dalla radice del repository:

```sh
pnpm webapp
```

Aprire **http://localhost:5137**. Il gateway locale rimanda alla dashboard `/staff/`; il cliente usa `/r/<restaurantId>/t/<qrToken>`, `/asporto/<restaurantId>` o `/prenota/<restaurantId>` sulla stessa origine. Tutti i processi si fermano con **Ctrl+C**. La finestra dell'app Mac non viene aperta.

| Processo | Indirizzo interno |
|---|---|
| Gateway | `127.0.0.1:5137` |
| API operativa | `127.0.0.1:5131` |
| Menu cliente Next | `127.0.0.1:5132` |

Il browser deve usare `localhost:5137` coerentemente per cookie e controlli Origin. Questo percorso è accessibile solo dalla macchina locale; l'eccezione HTTP non si applica alla produzione o alla rete LAN. Il database e le immagini restano gestiti da Supabase: serve connessione internet.

## Cosa prepara il launcher

1. Legge `.env.web` con il parser Node, verifica configurazione e disponibilità delle tre porte. Se una porta è occupata, si ferma senza terminare il processo esistente.
2. Compila la dashboard originale, con gli stessi asset e stili, in `release/local-web/staff`; niente Babel runtime, nessuna riscrittura dei sorgenti.
3. Compila Next solo quando il server standalone manca o il fingerprint di sorgenti/configurazione/build è cambiato. I rewrite puntano all'API interna **5131**, indipendentemente dalla precedente build su 3001.
4. Copia static e public accanto al server standalone, poi avvia gateway, API e renderer. Non crea database embedded né reclaim dei pid desktop.

La cartella `release/local-web` contiene `.metadata_never_index` e nessun bundle `.app`. Il primo avvio può richiedere una build Next; errori di configurazione o build impediscono l'avvio dei servizi.

Verifica senza build o avvio: `node scripts/start-webapp.mjs --check`.

Preparazione senza avvio: `node scripts/start-webapp.mjs --prepare`.

Test con sole fixture, senza database o app reali: `node --test tests/web/local-start.test.mjs deploy/render/gateway.test.mjs`.

## Limiti

Questo avvio è un ambiente di sviluppo, non il deploy pubblico né la garanzia di funzionamento durante blackout internet. Stampa termica, provider voce/AI e dati operativi vanno collaudati separatamente. L'app desktop si rimuove soltanto dopo il collaudo e il passaggio effettivo alla webapp.
