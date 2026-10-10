# Bootstrap database operativo Tako Webapp

Questo script prepara esclusivamente il database operativo di Tako originale in un progetto dedicato nuovo. Non usa le migrazioni del control plane account, non inserisce ristoranti/utenti demo e non modifica gli schemi Supabase `auth` e `storage`.

```sh
node scripts/prepare-web-schema.mjs /tmp/tako-web-operational-bootstrap.sql
node --test tests/web/schema-bootstrap.test.mjs
```

Il generatore legge `packages/db/src/migrations/meta/_journal.json` e applica le migrazioni nell'ordine del journal. Include una transazione unica, un lock contro bootstrap simultanei e una verifica iniziale: qualsiasi tabella operativa esistente in `public` o tabella dello storico Drizzle fa fallire tutto. Non esegue reset o sovrascritture. Lo SQL contiene i record `drizzle.__drizzle_migrations` con SHA256 del contenuto originale e timestamp del journal; il successivo `drizzle migrate` riconosce quanto applicato e non lo riesegue. I commenti riportano inoltre gli hash del SQL effettivamente eseguito.

Lo SQL richiede privilegi per creare tabelle, policy e schema Drizzle e revocare permessi. Se l'operatore non li possiede la transazione deve fallire: non saltare questi passaggi. Un'unica trasformazione esplicita riguarda la migrazione 0002: viene omesso il blocco finale di provisioning/grant del ruolo locale `tako_app`, che contiene una password iniziale nota. Tutte le policy RLS sono preservate. Il generatore verifica il marker del blocco prima di ometterlo e fallisce se il sorgente cambia. Non viene creato né alterato alcun ruolo. Lo storico mantiene l'hash del sorgente originale per compatibilità Drizzle; la verifica del mancato replay è eseguita realmente nei test. Il file non contiene credenziali.

Alla fine vengono revocati tutti i privilegi di tabelle operative e relative sequenze da `PUBLIC` e, se esistono, `anon` e `authenticated`. Lo storico Drizzle e la sua sequenza sono protetti allo stesso modo. I client browser devono accedere al backend Tako autenticato; non alle tabelle operative attraverso il Data API Supabase. I file dello Storage sono configurati separatamente.

## Limite RLS del runtime attuale

Le policy delle migrazioni leggono `app.current_restaurant_id`. Il runtime attuale non imposta questo contesto nelle transazioni. Il collegamento iniziale del backend deve quindi usare il ruolo server previsto `postgres`/`BYPASSRLS`; l'isolamento dei ristoranti viene applicato dai controlli HTTP e Socket.io verificati dai test. Non dichiarare l'isolamento RLS attivo nel runtime e non passare a un ruolo senza bypass senza introdurre contesto transazionale e verificare login, query e realtime. Le credenziali database restano esclusivamente nell'ambiente Render, mai nel frontend. `tako_app` non è un'alternativa valida.

I test eseguono realmente lo SQL su PostgreSQL temporaneo isolato, controllano hash e ordine dello storico, verificano che Drizzle non ripeta le migrazioni, che non ci siano seed, che i ruoli pubblici non abbiano privilegi e che i dati sentinella negli schemi `auth`/`storage` restino presenti. Verificano inoltre il rifiuto atomico di schemi parziali e storico preesistente. Non si collegano al progetto Supabase reale.
