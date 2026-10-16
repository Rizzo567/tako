# Compito 2 — Menu in tempo reale: scoperta (16/10/2026)

Solo lettura: nessun codice cambiato, nessun deploy, nessuna scrittura su locali. Misure fatte con GET (`prefetch=1`, così non entrano nelle statistiche) sul locale QA `26050ecd…` e su L'Osterietta (solo `GET`), più SELECT in transazione `read only` sul DB.

## 0. Domande che può decidere SOLO Manuel

1. **«Pubblica» nella dashboard ristoratore: il live deve saltarlo?** Oggi il ristoratore che modifica dalla dashboard salva una *bozza* e il cliente non vede nulla finché non preme **Pubblica** (e conferma il riepilogo). Il WhatsApp del titolare invece pubblica già da solo. Per la vendita porta a porta il caso è WhatsApp, quindi **non serve cambiare il flusso**: il live mostra ciò che è *pubblicato*. Raccomando di NON toccare Pubblica. Se invece vuoi che anche il «Salva» della dashboard sia subito visibile ai clienti, è un cambio di prodotto (le bozze non esisterebbero più): fermarsi e decidere.
2. **Da quando si misurano i 10 secondi?** (a) dal momento in cui il dato è *pubblicato* nel database, oppure (b) dal messaggio WhatsApp inviato? Con (b) pesa il tempo del bot (vedi §4: mediana ~4 s, ma fino a ~40 s con l'AI sotto carico) e 10 s non è garantibile. Proposta: 10 s dalla pubblicazione, e in parallelo ridurre il tempo del bot.
3. **Piano Cloudflare Workers (Free o Paid 5 $/mese)?** Il polling passa dal Worker: 30 telefoni a 1 richiesta ogni 5 s = 21.600 richieste/ora per locale; il piano Free ha 100.000 richieste/giorno per tutto l'account. Con più locali aperti serve Paid. Non verificabile da qui (wrangler non mostra il piano). Serve anche per le Durable Objects, se si farà la fase push.
4. **Il cambio disponibilità («esaurito») fatto fuori dal workspace** (`PATCH` su `menu_items.available`, `routes/menu.ts:201`) deve apparire live? Oggi cambia il menu pubblico senza toccare la revisione. Proposta: sì, lo includiamo nel numero di versione (costa una query in più).
5. **Aggiornamento visibile al cliente:** basta una transizione discreta sul pezzo cambiato (evidenziazione leggera ~600 ms) o vuoi anche un avviso tipo «Menu aggiornato»? Proposta: solo evidenziazione, niente toast (regola Tako: niente UI non richiesta).
6. Se un telefono è in *standby* per ore, ok che al risveglio si riallinei con una sola richiesta (non c'è push di sistema)? Proposta: sì.

## 1. Cosa sappiamo (con prove)

**Bozza o pubblicato**
- Il modello è `menu_workspaces(draft, published, revision, published_revision)`; `mutateWorkspace(..., publish)` in `apps/server/src/lib/menu-workspace-store.ts` scrive `draft` e, solo se `publish=true`, anche `published`/`published_revision` + riscrive `menus/menu_sections/menu_items/...` in una transazione.
- **Dashboard ristoratore** (`apps/server/src/routes/menu-workspace.ts`): `PUT /` = bozza (publish=false); `POST /publish` = pubblica. Frontend: «Salva» manuale e «Pubblica» con riepilogo e conferma (`apps/dashboard/public/staff/src/13-menu-workspace.js:131-136`); intestazione «Modifiche non pubblicate» quando `revision !== publishedRevision` (riga ~146). **Quindi dalla dashboard le modifiche NON sono live senza Pubblica.**
- **WhatsApp titolare** (`apps/server/src/routes/twilio-menu.ts`): fino a 3 modifiche → bozza + pubblicazione nella stessa transazione (righe 74: `'WhatsApp: aggiornamento automatico'` poi `'WhatsApp: pubblicazione automatica'`); oltre 3 o azioni a rischio → riepilogo e attesa di «OK/CONFERMA», poi bozza + pubblicazione (riga 46). Copy: «Fino a 3 modifiche le pubblico subito» (`twilio-menu-copy.ts:8`). **Quindi da WhatsApp sono pubblicate subito, atomicamente.** Dati: nel DB le due righe di versione hanno lo stesso `created_at` (stessa transazione); 14 giorni: 50 voci «WhatsApp:…» (6 auto, 27 confermate…).
- Blocco: se c'è una bozza pendente dalla dashboard (`revision !== published_revision`) il bot risponde `dashboardPending` e non modifica (twilio-menu.ts:40, copy:40). **Interazione da ricordare:** un ristoratore con bozza non pubblicata blocca il bot.
- Il bot di onboarding (`onboarding-*`, altro agente) lavora su bozze di nuovi locali, fuori scopo.

**Catena della risposta pubblica** `/api/customer/restaurant/<id>/menu`
1. Browser → Cloudflare zona takoitalia.com → route `takoitalia.com/api/customer/restaurant/*` → Worker `takomenu-public` (`deploy/cloudflare/wrangler-public.jsonc`).
2. Worker (`deploy/cloudflare/worker.mjs:78-95`): con `TAKO_BACKEND_READY=true` proxy verso la **read-edge** Supabase (`tako-read-candidate`), aggiunge `catalogOnly=1`, secret/IP di gateway; fallback sulla edge operativa se 501/502/503/504. Poi `readOnlyMenu` forza `Cache-Control: no-store` e `customerOrderingEnabled=false`.
3. Gli snapshot statici `public-menu-data/*.json` (`public-snapshots.mjs`, `Cache-Control: public, max-age=60`) sono usati **solo se il backend è spento**: oggi NON sono nel percorso (dossier 12/10: «Cache-Control:no-store sui dati»).
4. Read-edge (`apps/server/src/lib/edge-read-handler.ts:82-83`): contatore rate limit durevole in Postgres → `readPublishedCatalog` (una query su `restaurants ⨝ menu_workspaces` + id piatti `available`) → `publicMenuProjection`. Risposta con `Cache-Control: no-store`.
- **Misure curl (16/10, 09:12–09:13 UTC, dal Mac, edge FCO):** QA: `cf-cache-status: DYNAMIC`, `cache-control: no-store`, nessun `ETag`/`Last-Modified`, 4,4 KB; 9 chiamate in sequenza 450–605 ms totali (mediana ~510 ms), `Server-Timing: read;dur=` 168–241 ms (contatore + lettura). Osterietta: 19,3 KB raw / 5,7 KB br, 470–670 ms. HTML pagina `/l-osterietta-1`: `no-store`, 205 ms, `cf-cache-status: HIT` (solo asset).
- **Niente cache CDN, niente cache HTTP nel browser, nessun service worker** (grep su `apps/web-static`, `apps/web`: nessun `serviceWorker`). Unica cache: `apps/web/src/lib/public-menu-cache.ts`, in memoria della scheda, che mostra subito il già visto e **riconferma sempre dal server** (da qui i ~15 ms al cambio menu). Il payload **non contiene un numero di revisione**.
- Header immagini `public, max-age=31536000, immutable` (Worker `caches.default` per `/uploads/...`): l'immagine nuova ha URL nuovo, quindi il live non ha problemi di cache sulle foto.

**Come la pagina carica/cambia menu:** `main.tsx:38` lancia `loadMenu()` prima del rendering; `DigitalMenu.tsx` tiene `result` in `useState`, mostra la cache e poi `setResult(data)` con la risposta fresca (stesso meccanismo che un refresh live può riusare). Prefetch in idle: fino a 2 menu fratelli + lingua del telefono (+ lingue al tocco bandiera), tutti con `prefetch=1`.

**Infrastruttura**
- Rate limit: `edge-read-handler.ts:43,69` — contatore `consume_edge_rate_counter` su Postgres, **un solo namespace `global` per tutte le letture**, chiave = IP del client (`CF-Connecting-IP` passato dal Worker), finestra 60 s, soglia 100 (`quota.current>100` → 429). Si applica a menu pubblico, immagini non cachate e letture staff. Il client ritenta sui 429 fino a 2 volte (`public-menu-cache.ts:12-21`), amplificando. Una singola apertura di pagina fa già ~1 + 2 (fratelli) + 1 (lingua telefono) ≈ 4 richieste: **30 telefoni che aprono insieme sullo stesso IP (≈120) sforano già oggi**, a prescindere dal live.
- Supabase Realtime: la publication `supabase_realtime` **esiste ma è vuota** (SELECT su `pg_publication_tables`: 0 tabelle). Quindi Postgres Changes oggi è spento; `pg_net` non è installato (un trigger non può chiamare un Worker); `pg_cron` sì. Il piano Supabase non è leggibile (MCP Supabase senza permesso sul progetto `tcfccmvpycivxuxkoqpw`).
- Cloudflare: account `6978af99…` autenticato con wrangler (OAuth). Piano non rilevabile da qui. Nel repo nessun Durable Object, KV, né cron nei wrangler. Il Worker è già su zona custom e usa `caches.default` per le immagini, quindi la Cache API è utilizzabile.
- Esiste già un precedente di polling in dashboard: `13-menu-live-sync.js` (15/10) controlla ogni 5 s `GET /api/menu-workspace/versions` lato staff (non pubblico, autenticato).
- Colonna già pronta: `menu_workspaces.published_revision` (intero che cresce a ogni pubblicazione). Il DB ha 25 workspace, `published` medio 26 KB, max 129 KB.

**Rendering**
- `WorkspaceMenuRenderer.tsx` è puro rispetto al `menu` ricevuto: sezioni con `key={s.id}`, stato locale solo per categoria scelta, ricerca, indicatore, header. L'effetto a riga 87 reagisce a `menu.id`/`allGroups`: stesso `menu.id` = mantiene la categoria (se esiste ancora; altrimenti ripiega). Nessuna transizione di entrata sui singoli piatti (le animazioni sono solo al cambio categoria).
- **Il «dettaglio piatto aperto» sulla pagina pubblica non esiste**: `DigitalMenu` non passa `onOpen`, le righe sono `disabled` (riga 139 del renderer). Resta da preservare scroll, categoria scelta, ricerca, pannello lingue aperto.
- Lingue: il payload è per `lang`; se la traduzione manca c'è fallback sul testo italiano con `nameLang`/`descriptionLang` (`published-menu.ts`). Un refresh della lingua corrente porta quindi subito il testo italiano nuovo.

## 2. Sappiamo di non sapere

| # | Cosa manca | Come si chiude |
|---|---|---|
| S1 | Tempo reale di commit di una pubblicazione WhatsApp su menu grandi (277 piatti): `mutateWorkspace` riscrive tutte le righe `menu_items`, due volte (bozza + pubblica) | Misura sul QA con 270 piatti sintetici via API dashboard + messaggio firmato simulato |
| S2 | Piano Cloudflare e piano Supabase (limiti richieste/connessioni) | Chiederlo a Manuel/dashboard |
| S3 | Se `mutateWorkspace` aggiorna `menu_items.updated_at` ad ogni pubblicazione (serve per il numero di versione) | Leggere righe 50-60 dello store e provare sul QA |
| S4 | Costo reale di una query «versione» (senza contatore) sulla read-edge | Spike sul QA dopo deploy separato della funzione (o misura query via SQL read-only) |
| S5 | Comportamento delle cache Worker (`caches.default`) su `workers.dev` vs dominio: la route è su zona custom | Prova a deploy su QA |
| S6 | Rete reale del locale (NAT, WiFi ospiti con IP condiviso, browser in-app di Instagram) | Prova sul telefono di Manuel |
| S7 | Come un telefono iOS/Android sospende i timer a schermo spento | Uso di `visibilitychange` + riallineamento al ritorno, da provare su dispositivo reale |

## 3. Ipotesi da verificare

| # | Ipotesi | Come si verifica | Se falsa |
|---|---|---|---|
| H1 | Un endpoint `GET /api/customer/restaurant/<id>/version`, servito dal Worker con cache breve (2 s) e rigenerato dalla read-edge, regge 30+ telefoni sullo stesso IP senza toccare il limite 100/min | Test di carico: 40 client simulati a 1 req/4 s per 5 min dallo stesso IP; contare 429 e chiamate arrivate alla read-edge (Server-Timing `read` presente = miss) | Servire la versione da un DO (fase push) o esentare l'endpoint dal contatore con un limite separato più alto |
| H2 | `published_revision` + max(`menu_items.updated_at`) + `restaurants.updated_at` identifica ogni cambio visibile al cliente (prezzo, nome, piatto nuovo/tolto, categoria, menu, esaurito, nome locale) | Per ciascuno dei 6 tipi: modifica sul QA, confronta payload prima/dopo e versione prima/dopo; test che il token cambia sempre quando il JSON cambia | Aggiungere un contatore `public_version` mantenuto da `mutateWorkspace` e dal PATCH disponibilità (migrazione su DB remoto: chiede il via) |
| H3 | Re-render in-place con `setResult` mantiene scroll e stato senza lampeggio | Puppeteer 390 px: scroll a metà, categoria, ricerca, pannello lingue aperto; applicare cambio; scroll Y identico (±0), nessun unmount (marcatore sul nodo DOM), nessun errore console | Stabilizzare le chiavi/memoizzare per sezione; applicare patch solo alle sezioni cambiate |
| H4 | Una pubblicazione normale (1–3 piatti, locale medio) commit in ≤2 s, quindi ≤6 s totali con poll 3 s + cache 1 s | Cronometro su QA: invio API → comparsa nel DOM, 10 giri per tipo | Alleggerire `mutateWorkspace` (aggiornare solo righe cambiate invece di riscrivere tutto) |
| H5 | Il polling di un tab in background può essere sospeso del tutto senza perdere correttezza | Test headless con `visibilitychange`: nessuna richiesta mentre `hidden`, una sola al ritorno | Aggiungere un controllo al `focus`/`pageshow` |
| H6 | Il ritiro del cliente dal rate limit (429) con backoff + jitter non lascia la pagina ferma | Simulare 429 sul `/version` (solo in test locale/stub) | Tenere l'ultimo menu mostrato e riprovare con backoff esponenziale fino a 60 s |
| H7 | Il WhatsApp titolare simulato sul QA è possibile come l'E2E 16/10 (webhook firmato Twilio, numero finto collegato al QA) | Riusare `docs/webapp/whatsapp-fix-2026-10-16/e2e.mjs` come modello; richiede un collegamento `tako_whatsapp_links` del numero finto al QA (scrittura su QA, ok) | Verifier solo con API dashboard per il QA e misura del WhatsApp da log reali |

## 4. Tempo delle scritture (stime con dati esistenti)

- Dashboard, dai report perf 14/10 (`performance/2026-10-14/PHASE2.md`): salvataggio bozza usa il PUT diretto (~1,7–2 s di avvio a freddo dell'edge operativa); preparazione di Pubblica 2,3–2,7 s; conferma → «Menu pubblicato» ~2 s. Dossier 12/10: pubblicazione batch Osterietta (277 piatti) entro 10 s. **Per il live conta solo l'ultimo passaggio: circa 2 s su QA, fino a diversi secondi su locali grandi.**
- WhatsApp titolare: proxy dal DB (36 messaggi degli ultimi 14 giorni): dal messaggio in entrata (`tako_whatsapp_messages.created_at`) alla riga di versione di pubblicazione (inizio transazione) **p50 4,2 s, p90 38,6 s**. È una stima approssimativa: include i test, Groq con retry su 429, domande di chiarimento; non include la durata della transazione né l'invio della risposta. Il tempo di commit vero non è registrato: **da misurare (S1)**.
- Quindi, dopo il commit, il percorso pubblico aggiunge: cache Worker (≤2 s) + poll (≤3–5 s) + fetch menu (~0,5 s) + render. Budget stimato nel caso normale: ~3–8 s.

## 5. Punti ciechi (cose a cui non stavamo pensando)

- **Statistiche:** un refresh live non deve contare come nuova visita: usare `prefetch=1` (o un flag nuovo) sul fetch di riallineamento. Verificare che `recordMenuEvents` non scatti.
- **Cache in memoria della pagina:** `public-menu-cache.ts` conserva altri menu/lingue già visti; con una nuova versione vanno invalidati tutti (non solo quello a schermo), altrimenti il cambio menu successivo mostra dati vecchi per un attimo.
- **Orari del menu (schedule):** le fasce `availableNow` cambiano con l'ora senza revisione; le pagine pubbliche usano `catalogOnly=1` che le ignora, ma va confermato che il live non le renda incoerenti.
- **Doppio scatto del bot:** bozza e pubblicazione nella stessa transazione producono due revisioni (N e N+1). Il token di versione deve cambiare una volta sola, ok.
- **Traduzioni in sospeso:** il supervisor traduzioni (`translation-supervisor.py` in `~/.config/tako-webapp`) scrive revisioni anche in background; ogni pubblicazione di traduzione scatenerebbe un riallineamento su tutti i telefoni in lingua. Basso impatto, ma inaspettato.
- **Deploy:** read-edge e Worker sono deployati da altri agenti (WhatsApp/compito 1) con working tree sporco; una nuova versione della read-edge richiede rollback pronto (`~/.config/tako-webapp/rollback-edge-20261016/read-index-v16-source.ts`).
- **Il blocco «dashboardPending» del bot** può far sembrare «rotto» il live in demo: se il ristoratore ha una bozza aperta, il WhatsApp non pubblica. Va mostrato a Manuel come comportamento da conoscere prima di una demo.
- **Cookie `tako_menu_visit`** viene impostato a ogni chiamata menu: per il `/version` non va impostato (renderebbe la risposta non cacheabile).
- **Rate limit esistente non risolto da questo compito:** apertura simultanea di molte pagine dallo stesso IP (~4 richieste ciascuna). Proposta: ridurre i prefetch (o servire il menu anch'esso con cache breve dal Worker). Fuori scope salvo accordo.

## 6. Architettura consigliata

**Fase 1 (consigliata, nessun cambio di flusso e nessuna nuova infrastruttura):**
1. **Numero di versione leggero.** Nuova route della read-edge `GET /api/customer/restaurant/<id>/version` che restituisce `{v: "<published_revision>.<t_menu_items>.<t_restaurant>"}` (una query indicizzata, nessun contatore, nessun cookie). Il payload del menu esistente riceve lo stesso campo `v` (additivo).
2. **Cache nel Worker `takomenu-public`.** La route è già coperta da `takoitalia.com/api/customer/restaurant/*`. Il Worker risponde a `/version` con `caches.default`, TTL 2 s (`s-maxage=2`, `stale-while-revalidate` breve), con una sola chiamata alla read-edge per scadenza per sede; i telefoni non toccano il limite 100/min. Header `Cache-Control: public, max-age=0, s-maxage=2`.
3. **Client** (`DigitalMenu.tsx` + piccolo modulo, es. `public-menu-live.ts`): poll ogni 4 s con jitter ±1 s, solo con scheda visibile, `visibilitychange`/`online`/`pageshow` → controllo immediato; backoff esponenziale sugli errori (max 60 s); se `v` ≠ versione mostrata → svuota la cache in memoria e `loadMenu(..., prefetch=true)` per menu e lingua correnti; `setResult` solo se `v` è cambiata; se il menu a schermo è sparito, ripiego sul primo disponibile. Evidenziazione breve (token 600 ms `data`, reduced motion rispettato) solo dei piatti cambiati (confronto per `id` come in `13-menu-live-sync.js`).
4. **Preservare scroll e stato:** nessun cambio di `key` sulla radice, scroll mai toccato dopo il refresh, categoria mantenuta se esiste.
5. **Misure di consegna:** p50/p95 per tipo di modifica, carico da N client per IP, 0 errori di console.

**Fase 2 (solo se p95 > 10 s o per un effetto «istantaneo»):** push con Durable Object (SQLite, hibernation WebSocket) per locale: la edge operativa/WhatsApp, dopo il commit, chiama `POST /internal/notify` del Worker con firma; il DO manda `{v}` ai telefoni connessi. Il polling resta come riserva. Richiede Workers Paid (S2), migrazione DO, secret e test di robustezza.

### Alternative scartate
- **Supabase Realtime (Postgres Changes) su `menu_workspaces`:** publication vuota; esporrebbe anche la `draft` agli anonimi senza RLS accurata; 30 WebSocket per locale contro i limiti di connessioni del piano (non noto). Realtime *Broadcast* da trigger richiederebbe di mettere la chiave pubblica nel browser e non c'è `pg_net`. Rinviata alla fase 2 come alternativa al DO.
- **SSE direttamente dal Worker:** senza DO ogni connessione deve interrogare l'origine per conto suo, quindi stesso carico del polling ma con connessioni lunghe per ogni telefono; nessun vantaggio.
- **Polling dell'endpoint menu esistente:** 30 telefoni × 12 richieste/min = 360/min dallo stesso IP, ben oltre 100; 19 KB ogni volta; ~510 ms ciascuna.
- **Esentare l'endpoint dal rate limit nella read-edge:** meno invasivo ma lascia il DB a pagare ogni richiesta; si fa solo se la cache Worker non basta.
- **Cache CDN del menu stesso (Cache-Control pubblico):** invaliderebbe la garanzia «dati sempre confermati dal server» di Phase 1 perf e introdurrebbe staleness fino al TTL.
- **Eliminare «Pubblica» dalla dashboard:** cambio di prodotto, vedi §0.1.

## 7. Loop di implementazione

**Goal:** per i 6 tipi di modifica (prezzo, nome, piatto nuovo, piatto eliminato, categoria nuova, menu nuovo) la pagina pubblica aperta sul QA si aggiorna da sola.
**Verifier (script ripetibile, `scripts/perf/verify-public-live.mjs`):**
1. Login di servizio con sessione propria; salva stato iniziale del QA `26050ecd-2e55-4057-a4c5-bff2b449cd47`.
2. Apri la pagina in puppeteer-core headless (390×844), scorri a metà, memorizza `scrollY` e un marcatore sul nodo.
3. Per ciascun tipo, 10 giri: scrittura via API dashboard (salva + pubblica) e, quando possibile, messaggio WhatsApp firmato simulato; cronometra fino alla modifica nel DOM; verifica scroll e categoria invariati e nessun errore console.
4. Ripristina il QA e verifica l'hash identico.
5. Carico: N client simulati dallo stesso IP (poll `/version`), contare 429 = 0 e chiamate alla read-edge.
**Stop:** p95 ≤ 10 s per ogni tipo su ≥10 giri, scroll ±0, 0 errori console, ripristino identico, 0 × 429 con 40 client/IP, `tsc` server/web verdi, test unitari del modulo live e di parità del token (H2) verdi.
**Max iterazioni:** 4 giri di correzione per sottoagente; poi fermarsi e riportare.
**Exit di fallimento:** (a) il token di versione non copre un tipo → passare a `public_version` esplicito (chiedere il via per la migrazione); (b) p95 > 10 s per tempo di commit (H4) → fase 2 o alleggerire `mutateWorkspace`; (c) il limite 100/min si sfora anche con cache Worker → endpoint esentato o DO; (d) Piano Free insufficiente → decisione di Manuel.
**Sottoagenti, perimetri disgiunti:**
- A: read-edge (`edge-read-handler.ts`, `published-menu.ts`) + test di parità del token. Deploy `--read` con rollback v16 pronto.
- B: Worker (`deploy/cloudflare/worker.mjs`) + test unitario della cache `/version`.
- C: client (`apps/web/src/lib/public-menu-live.ts`, `DigitalMenu.tsx`, `public-menu-cache.ts`) + contratto movimento FEATURE-MOTION (evidenziazione) e test.
- D: verifier headless e carico (`scripts/perf/…`), nessuna modifica ai sorgenti.
Il root esegue deploy in sequenza (A → B → C) con rollback preparato, poi verifica; `implementation-notes.md` per ogni deviazione.
