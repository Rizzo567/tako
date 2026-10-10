# Tako webapp su Render + Supabase

Questo template prepara **Tako originale** come servizio operativo online. Non modifica né sostituisce il `render.yaml` di root, che resta il control-plane storico. Non esegue deploy, migrazioni, creazione utenti o cancellazione dell'app Mac.

## Topologia

Un servizio Docker Render (`tako-webapp`) espone `https://app.takoitalia.com`. Il gateway Node ascolta `PORT` su `0.0.0.0`; nello stesso container avvia l'API operativa sulla porta 3001 e il renderer Next cliente sulla 3002. Solo il gateway è l'ingresso pubblico.

- `/` rimanda a `/staff/`: dashboard originale con il suo design.
- `/staff/`, `/api/`, `/socket.io/`, `/uploads/` sono inoltrati all'API.
- `/r/<slug>` e gli asset Next vanno al renderer cliente.
- Socket.io conserva polling e upgrade WebSocket; cookie, upload e risposte streaming attraversano lo stesso dominio.
- `/health` verifica che entrambi i processi rispondano. Il controllo API attuale non interroga il database: una risposta verde non sostituisce il collaudo delle operazioni dati.

Il runtime usa `TAKO_MODE=web`, distinto da `cloud`, con `TAKO_MULTI_TENANT=1` e `TAKO_DISABLE_REGISTRATION=1`. Il cutover iniziale usa account operativi migrati o provisionati individualmente: la registrazione pubblica resta chiusa finché onboarding, verifica email e recupero password non sono unificati con il control-plane. Se un figlio termina il supervisore arresta anche l'altro e restituisce un errore, così Render può riavviare il servizio. Nessun server o PostgreSQL viene installato nel ristorante. Il servizio richiede internet.

## Template e configurazione

Creare un nuovo Blueprint indicando **`deploy/render/render.yaml`**, con Docker context radice del repository e Dockerfile `deploy/render/Dockerfile`. Il piano `1c-2g` è un valore iniziale del template da confermare nel dashboard Render; nessun servizio a pagamento è stato creato. Deploy automatici disattivati; un solo processo API/istanza evita di introdurre un adattatore Socket.io distribuito non ancora presente.

Segreti runtime nel dashboard Render, mai nei file o negli argomenti del build:

| Variabile | Uso |
|---|---|
| `DATABASE_URL` | Connessione PostgreSQL Supabase dedicata al database operativo, con TLS. Non riutilizzare implicitamente il database identity/control-plane. |
| `JWT_SECRET` | Generata da Render; conservarla fra i deploy per non invalidare tutte le sessioni. |
| `SUPABASE_URL` | URL HTTPS del progetto che ospita Storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo backend; mai `NEXT_PUBLIC_*`, bundle browser o frontend. |
| `SUPABASE_STORAGE_BUCKET` | Bucket privato `tako-menu-images`. |

`UPLOADS_DRIVER=supabase`: l'API gestisce autorizzazione tenant e proxy delle immagini tramite `/uploads/`; `/tmp/tako-upload-cache` è una directory transitoria, non archivio permanente. Nessun disco Render richiesto per le immagini. Le chiavi dei provider AI e l'eventuale configurazione email vanno aggiunte separatamente secondo le funzionalità attivate.

`WEB_ORIGIN` e `ALLOWED_ORIGINS` sono `https://app.takoitalia.com`; il supervisore imposta `TRUST_PROXY=127.0.0.1,::1` per l'API. Il gateway ricostruisce gli header forwarded senza fidarsi del protocollo/host forniti dal browser. Il sottodominio `onrender.com` è disabilitato per mantenere cookie e controlli Origin coerenti; collegare/verificare il DNS del dominio prima dell'accesso pubblico.

La build Next usa `http://127.0.0.1:3001` solo come destinazione interna dei rewrite. Le richieste del browser restano relative alla stessa origine. Nessuna stringa di connessione Supabase o chiave server deve essere aggiunta come argomento Docker o variabile pubblica Next.

## Gate prima dell'attivazione

1. Verificare lo schema operativo Supabase e importare i dati con il piano di migrazione; questo template non migra il database automaticamente.
2. Verificare il bucket privato e l'isolamento dei file dei diversi ristoranti.
3. Impostare credenziali titolare separate dall'account usato per l'analisi Menumal; non creare password condivise o predefinite.
4. Eseguire build Docker, health check e flussi reali su ambiente di prova: login, menu, cliente QR, ordine, cucina, cassa, upload e riconnessione.
5. Verificare HTTPS/DNS e assenza di segreti nel browser. Stampanti e voce locale richiedono verifica separata nel percorso web.
6. Attivare il servizio e migrare l'utilizzo prima di rimuovere l'unico bundle desktop; nessuna rimozione preventiva in questa fase.

## Build frontend hosted

`node scripts/build-staff-web.mjs --out /percorso/separato/staff-web`

Esbuild compila i 12 script JSX nell'ordine dell'HTML originale in un unico scope, preservando i globali condivisi. CSS, font, asset, React e ReactDOM locali vengono copiati; Babel e i sorgenti JSX vengono esclusi dall'output. Il watchdog di avvio è un `boot.js` esterno, con testo inserito tramite `textContent` e pulsante collegato tramite listener: niente script inline o `onclick`.

Nel Dockerfile il risultato è `/app/staff-web`, servito tramite `STAFF_DIR`. Il sorgente `apps/dashboard/public/staff` e i bundle desktop non vengono riscritti. La CSP hosted può quindi usare `script-src 'self'` senza `unsafe-eval` o `unsafe-inline` per gli script; gli stili inline dell'interfaccia esistente restano necessari. Il test esegue realmente il bundle compilato in un contesto VM con DOM/React stub, verificando mount e globali delle schermate.

## Verifiche locali disponibili

`node --check scripts/web-render-entry.mjs`

`node --test deploy/render/gateway.test.mjs tests/web/staff-build.test.mjs`

I test usano piccoli server HTTP/WebSocket di prova su loopback e porte casuali, senza collegarsi a Render, Supabase o al ristorante. Verificano fail-fast, routing, forwarding dei cookie, health check e WebSocket bidirezionale. Il Blueprint è stato parsato e validato contro lo schema JSON ufficiale Render il 09/10/2026. La build Docker e il deploy effettivo restano gate distinti.

Riferimenti ufficiali: [Blueprint specification](https://render.com/docs/blueprint-spec), [schema JSON](https://render.com/schema/render.yaml.json), [Web services e PORT](https://render.com/docs/web-services), [Health checks](https://render.com/docs/health-checks).
