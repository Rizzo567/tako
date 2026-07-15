# Revisione completa + load test "ristorante pieno" — 2026-07-15

Sistema sotto test: **bundle 0.1.4 installato nella VM Windows** (ambiente reale del
ristoratore: node embedded + Postgres embedded, guidato via SSH dal Mac).
Metodo: simulazione di servizio con 45 telefoni concorrenti + review multi-agente
(5 layer × Opus, ogni finding verificato da 2 scettici indipendenti; 45 agenti totali,
10 finding confermati, 10 refutati).

## Parte 1 — Load test: TUTTO VERDE

Scenario: 20 tavoli, 45 clienti (2-3 per tavolo), menu 13 piatti.
Fasi: scan QR in onde → **45 ordini simultanei** → 8 doppi-tap con stessa
idempotencyKey → seconda ondata (30 ordini + 15 chiamate cameriere in parallelo) →
terza ondata → 3 asporti. Totale: **108 ordini, €4.231,50, zero 5xx**.

Invarianti verificate sul DB (tutte ✅): nessun ordine perso; zero duplicati;
doppio-tap → stesso ordine restituito 8/8; totali esatti al centesimo; order_items
combacianti con l'inviato; zero ordini senza voci; max 1 conto aperto per tavolo;
conteggio esatto (+75 nella run principale); server vivo a fine test.

Risorse VM durante il carico: node 93→176MB max (assestato 160MB), Postgres
110→304MB max, 15-20 processi pg. Nessun leak. La latenza scala con la dimensione
del burst (45 simultanei: p50 ~1.2s su VM **emulata** ARM→x64; 15 simultanei:
p50 0.4-1.6s) e **non degrada nel tempo**. Su hardware x64 vero i tempi saranno
molto più bassi.

Nota metodo: waiter-call e asporto fallirono al primo giro per errori del
simulatore (body incompleto; takeawayEnabled spento = gating corretto del server).
Corretti: 15/15 e 3/3 verdi.

## Parte 2 — Findings confermati dalla review (10)

Il load test è passato perché le finestre di rottura richiedono condizioni che la
simulazione non ha prodotto (cadute di rete a metà insert, timeout del pool, tap
dell'owner su ordini pagati). La review le ha trovate col codice alla mano; ogni
finding è stato confermato da 2 verificatori avversariali indipendenti.

Priorità consigliata: i tre P1 (ordine fantasma, resurrezione ordine pagato,
doppio addebito) toccano SOLDI del ristoratore o del cliente.

### [P1] Creazione ordine NON transazionale: order, order_items e bill sono insert separati → ordine fantasma fatturabile senza voci

**Dove:** `apps/server/src/routes/customer.ts:390` (layer db)

**Scenario:** Serata piena, 40 clienti ordinano dal telefono su LAN instabile (vedi memory tako-resilienza-rete). Un cliente invia l'ordine: `insert(orders)` con total=34€ va a buon fine (riga 390-404), poi la connessione cade / il pool va in timeout PRIMA di `insert(orderItems)` (riga 419). L'errore risale come 500, ma la riga `orders` resta committata con total=34€ e status 'pending'/'confirmed' (fatturabile) e ZERO order_items. `ensureOpenBill`/`billTotalsFromOrders` sommano `orders.total` a prescindere dalle voci → il cliente viene addebitato 34€ per un ordine senza righe, senza comanda in cucina. Il cliente ri-tocca 'invia': stessa idempotencyKey → riga 329-330 ritorna l'ordine esistente (senza voci) e NON reinserisce mai gli item. Il fantasma è permanente e non si auto-ripara. Stesso difetto nel path staff (orders.ts: insert order riga 127, insert items riga 146, nessuna transazione).

**Evidenza:** customer.ts:390 `;[order] = await db.insert(orders).values({...total...}).returning()` — poi SEPARATAMENTE customer.ts:419 `const insertedItems = await db.insert(orderItems).values(...)` e customer.ts:440 `insert(bills)`. Nessun `db.transaction()` avvolge orders+orderItems+bill. billing.ts:115 `tx.select({ id, total }).from(orders)` somma orders.total senza mai controllare l'esistenza di order_items.

### [P2] Indice order_items.order_id dichiarato in schema.ts ma MAI creato da una migrazione → seq scan su ogni lettura ordine

**Dove:** `packages/db/src/schema/orders.ts:56` (layer db)

**Scenario:** L'embedded avvia il DB via `migrate()` che applica SOLO i file .sql in migrations/ (embedded.ts:214). L'indice `order_items_order_id_idx` è definito solo in schema.ts (riga 56, con commento 'senza indice era un seq scan') ma nessuna migrazione lo crea: nel DB reale del ristorante l'indice NON esiste (in Postgres le colonne FK non sono auto-indicizzate). order_items cresce senza limiti (ogni voce di ogni ordine di ogni servizio). Con 40 clienti che aggiornano lo stato ordine e la KDS che fa polling, ogni `select from order_items where order_id=X` (customer.ts:412, bills, insights, dettaglio ordine) fa un seq scan dell'intera tabella. Dopo settimane = decine di migliaia di righe scandite ad ogni richiesta → latenza crescente sotto carico.

**Evidenza:** schema/orders.ts:56 `orderIdIdx: index('order_items_order_id_idx').on(t.orderId)` presente. `grep -rni 'order_items_order_id_idx' packages/db/src/migrations/` → 0 risultati; l'unico riferimento a order_items.order_id nelle migrazioni è il FK constraint 0000_minor_victor_mancha.sql:232, che NON crea un indice.

### [P1] Bump portata (PATCH items/status) resuscita un ordine appena marcato 'paid' dalla cassa → cibo regalato / riconciliazione rotta

**Dove:** `apps/server/src/routes/orders.ts:252` (layer server-orders)

**Scenario:** Servizio pieno: la cassiera incassa il conto del tavolo 12 (POST /bills/:id/payments) mentre un cameriere, sullo stesso ordine, fa il bump dell'ultima portata a 'served' dal KDS. La PATCH /:orderId/items/:itemId/status legge l'ordine a riga 232 (ancora billable), supera il guard a riga 236 (lettura stantìa: non ancora 'paid'), poi la transazione di pagamento committa marcando l'ordine 'paid' e chiudendo il conto. Subito dopo la riga 252 esegue `db.update(orders).set({ status: derivedStatus })` SENZA alcun guard sullo stato: sovrascrive 'paid' → 'served'. L'ordine torna in BILLABLE_STATUSES pur essendo già stato pagato: il pagamento resta registrato ma l'ordine risulta non pagato e verrà rifatturato su un nuovo conto (doppio addebito) oppure resta appeso rompendo la quadratura di cassa. Stessa dinamica con PATCH /cancel concorrente (resuscita un ordine 'cancelled').

**Evidenza:** riga 232: const [order] = await db.select()...  riga 236: if (order.status === 'paid' || order.status === 'cancelled') return 409 (lettura STANTIA)  riga 252: await db.update(orders).set({ status: derivedStatus as any, updatedAt: new Date() }).where(eq(orders.id, orderId))  // nessun eq(orders.status, ...) — CONTRASTA con lo stesso file righe 185-188/278-279 dove il guard eq(orders.status, current.status) è presente e documentato proprio contro la 'resurrezione' di ordini pagati/annullati

### [P1] Insert ordine e orderItems NON in transazione → ordine fantasma con totale ma zero voci, addebitato sul conto e mai cucinato

**Dove:** `apps/server/src/routes/customer.ts:419` (layer server-orders)

**Scenario:** 40 clienti ordinano in parallelo dai telefoni; il Postgres embedded è sotto pressione (pool/connessioni). La insert `orders` a riga 390 committa (ordine con `total` calcolato e status pending/confirmed), ma la insert separata di `orderItems` a riga 419 fallisce (errore transitorio/connessione persa). Non essendoci `db.transaction` attorno alle due insert, l'ordine resta persistito senza NESSUna voce. L'ordine è billable: ensureOpenBill/recomputeOpenBill sommano `orders.total` → il conto del tavolo include l'addebito, ma autoPrintOrder stampa una comanda vuota e la cucina non prepara nulla. Alla chiusura il fantasma viene marcato 'paid': il cliente paga cibo mai ricevuto (o l'ordine è perso). Il retry con stessa idempotencyKey ritorna l'ordine esistente privo di items (riga 330). Stesso identico difetto sulla route staff orders.ts (insert orders riga 127, insert orderItems riga 146, senza transazione).

**Evidenza:** riga 390: ;[order] = await db.insert(orders).values({...total...}).returning()  // commit #1  riga 419: const insertedItems = await db.insert(orderItems).values(resolvedItems.map(...)).returning()  // commit #2 SEPARATO, nessun db.transaction che avvolga i due; se fallisce, l'ordine con total resta orfano di voci ed è già conteggiato da ensureOpenBill (riga 487) che somma orders.total

### [P2] Gli handler socket non hanno rate-limit: join:table / join:restaurant eseguono JWT verify + 2 query DB a OGNI emit, senza throttle

**Dove:** `apps/server/src/socket/handlers.ts:72` (layer server-platform)

**Scenario:** Il rate-limit di @fastify/rate-limit copre solo le route HTTP; gli eventi socket.io (join:table, join:restaurant, join:menu) non passano da nessun limitatore. Il guard `if (socket.rooms.size >= MAX_ROOMS_PER_SOCKET) return` NON protegge: dopo il primo join il socket ha rooms.size=2 (il proprio id + table:{id}), ben sotto il cap di 20, quindi ogni ulteriore emit di join:table con lo STESSO tableId (socket.join è idempotente, rooms.size resta 2) supera il guard e riesegue ogni volta: cookieFromHandshake + fastify.jwt.verify + `SELECT ... FROM tables` (riga 86) + `SELECT ... FROM bills` (riga 92). join:restaurant riesegue verifyStaffToken, che è una JOIN sessions⋈users (riga 12-19). Un solo client LAN (o un bug di reconnect nella PWA che ri-emette join a ogni render) che cicla l'emit genera query DB illimitate. Il pool postgres.js è al default max=10 (packages/db/src/client.ts:15), condiviso tra tutte le route HTTP e i socket: con uno o pochi client in flood le 10 connessioni si saturano e le INSERT di ordini dei 40 tavoli si accodano dietro il flood → invio ordini degradato o in timeout per tutta la sala. Nessun cap di eventi/sec per socket, nessun cap di connessioni socket per IP.

**Evidenza:** riga 74: `if (socket.rooms.size >= MAX_ROOMS_PER_SOCKET) return` (non impedisce ri-join alla stessa room); righe 86 e 92-98: due SELECT eseguite ad ogni emit join:table; riga 48: `await verifyStaffToken(authToken)` (JOIN) ad ogni emit join:restaurant. Nessun rateLimit/throttle registrato in setupSocketHandlers né sull'io.

### [P3] JWT tavolo con scadenza rigida 4h e nessun refresh sull'attività: cene/eventi lunghi (>4h) perdono ordinazione e aggiornamenti live a metà servizio

**Dove:** `apps/server/src/routes/customer.ts:150` (layer server-platform)

**Scenario:** Il JWT del tavolo è firmato con `expiresIn: '4h'` (riga 150 per il tavolo, riga 196 per l'asporto) e il cookie ha maxAge fisso TABLE_SESSION_MAX_AGE = 4h (cookies.ts:33). A differenza della sessione staff, che ha un refresh rolling che sposta avanti la scadenza ad ogni uso (middleware/auth.ts:30-38), la sessione tavolo NON viene mai rinnovata sull'attività: nessuna route customer re-emette il cookie. Per un tavolo occupato oltre 4 ore (banchetti, cene di gruppo, eventi — scenario reale con 40+ coperti), al superamento delle 4h: (a) requireTableSession risponde 401 INVALID_TABLE_SESSION su POST /orders e /waiter-call → il cliente non può più ordinare né chiamare il cameriere; (b) il socket viene disconnesso dall'interval di rivalidazione quando `fastify.jwt.verify` lancia (handlers.ts:112, catch → socket.disconnect) → smette di ricevere order:updated. Il recupero richiede che il cliente si accorga del blocco e riscansioni il QR fisico per ottenere un JWT con visitStart nuovo; non c'è alcun rinnovo trasparente né avviso lato server.

**Evidenza:** customer.ts:150 `{ expiresIn: '4h' }` e :196 idem; cookies.ts:33 `export const TABLE_SESSION_MAX_AGE = 60 * 60 * 4`; handlers.ts:110-126 l'interval di rivalidazione fa `fastify.jwt.verify(socket.data.tableToken)` e nel catch `socket.leave(...); socket.disconnect(true)`; nessun setCookie di refresh nelle route customer (contrasto con middleware/auth.ts:33-36 che rinnova le sessioni staff).

### [P1] Doppio addebito: modificare il carrello dopo un invio andato in timeout resetta l'idempotencyKey → il reinvio crea un SECONDO ordine sullo stesso conto

**Dove:** `apps/web/src/lib/store.ts:48` (layer web-pwa)

**Scenario:** Tavolo occupato, LAN instabile (contesto Tako noto). Il cliente ha [Margherita, 2 Birre] nel carrello e tocca 'Invia'. La POST /customer/orders arriva al server, l'ordine viene creato e fatturato, ma la RISPOSTA si perde (timeout WiFi). Il client cade nel catch generico (orderError): NON pulisce il carrello (clear() solo on-success, CartView.tsx:60) e conserva checkoutKey=k1. Il cliente, credendo fallito, aggiunge un'altra birra o corregge una quantità: add()/updateQty azzerano checkoutKey (store.ts:48,54,60). Ritocca 'Invia' → ensureCheckoutKey() (store.ts:74-78) genera una NUOVA chiave k2. Server: l'idempotency-check per k2 (customer.ts:329) non trova nulla → crea un SECONDO ordine. Ora order1[Margherita,2 Birre] e order2[Margherita,3 Birre] sono entrambi billable sullo stesso tableId → ensureOpenBill somma entrambi → il cliente paga due volte gli stessi piatti. Con 40 clienti su rete ballerina il timeout-poi-ritocca è ricorrente.

**Evidenza:** store.ts:48 add() → `return { items, touchedAt: Date.now(), checkoutKey: null }`; store.ts:54/60 idem per remove/updateQty; store.ts:74-78 ensureCheckoutKey rigenera se null; CartView.tsx:60 `clear: () => set(...)` chiamato SOLO nel try dopo successo; CartView.tsx:66-80 il catch NON preserva l'idempotenza perché una successiva mutazione del carrello la invalida; server customer.ts:329 `where(eq(orders.idempotencyKey, body.data.idempotencyKey)...)` non trova k2 → insert nuovo ordine.

### [P2] 409 ITEM_UNAVAILABLE: remove(id) ignora variantId → i piatti con variante non vengono mai rimossi dal carrello → checkout dell'INTERO ordine bloccato in loop 409

**Dove:** `apps/web/src/components/CartView.tsx:73` (layer web-pwa)

**Scenario:** Durante il servizio l'owner esaurisce il Vino della casa (che ha varianti Calice/Litro). Un cliente ha in carrello la variante 'Litro' (variantId valorizzato da ItemSheet, MenuView.tsx:119-126) più 2 piatti validi. Invia → server risponde 409 ITEM_UNAVAILABLE con items:[menuItemId] (solo il menuItemId, senza variantId — customer.ts:361). Il client fa `remove(id)` con variantId=undefined; lo store filtra su `i.variantId === variantId` cioè `=== undefined` (store.ts:51), che è FALSE per la riga con variantId='xxx' → la voce NON viene rimossa. Ritocca 'Invia' → di nuovo 409 → di nuovo nessuna rimozione → loop infinito: neppure i 2 piatti validi possono essere ordinati finché il cliente non capisce di dover azzerare manualmente la quantità della variante. Stesso difetto nella chat AI (AiChat.tsx:211).

**Evidenza:** CartView.tsx:72-74 `const ids = ...err.items; for (const id of ids) remove(id)`; store.ts:50-53 `remove: (menuItemId, variantId) => set(s => ({ items: s.items.filter(i => !(i.menuItemId === menuItemId && i.variantId === variantId)) ...}))` → con variantId undefined non matcha le righe con variante; customer.ts:361 `items: unavailable.map(u => u.menuItemId)` (nessun variantId nella risposta); AiChat.tsx:211 stessa `remove(id)`.

### [P2] 409 VARIANT_INVALID non gestito dal client → errore generico e voce mai corretta → checkout bloccato

**Dove:** `apps/web/src/components/CartView.tsx:71` (layer web-pwa)

**Scenario:** L'owner, sotto carico, modifica/rimuove una variante di un piatto (es. cambia i formati del vino) mentre un cliente ha già la vecchia variantId nel carrello persistito. All'invio il server risponde 409 con code 'VARIANT_INVALID' (customer.ts:372-376). Il client controlla solo `err?.code === 'ITEM_UNAVAILABLE'` (CartView.tsx:71) → cade nel ramo else → toast 'orderError' generico, nessuna rimozione della voce, checkoutKey non azzerato. Ogni retry ripete lo stesso 409: il carrello è bloccato finché il cliente non intuisce di dover togliere a mano la voce. Idem in AiChat.tsx:209.

**Evidenza:** customer.ts:372-376 `const badVariant = ...; return reply.code(409).send({ error: { code: 'VARIANT_INVALID', ... } })`; CartView.tsx:71 `if (e?.response?.status === 409 && err?.code === 'ITEM_UNAVAILABLE')` — nessun ramo per VARIANT_INVALID; CartView.tsx:75-77 else → `toast.error(t('orderError'))`.

### [P3] Item aggiunti al carrello mentre un ordine è in volo vengono cancellati da clear() al successo

**Dove:** `apps/web/src/components/CartView.tsx:60` (layer web-pwa)

**Scenario:** Su LAN lenta il cliente tocca 'Invia' con [A]; il pulsante si disabilita ma il bottom-sheet del carrello resta chiudibile (backdrop/swipe): il cliente chiude la sheet e torna al menu mentre la richiesta è ancora in volo, e aggiunge B (add() non è bloccato). Quando la POST si risolve con successo, l'handler esegue `clear()` che svuota TUTTO il carrello (store.ts:62), cancellando anche B che non faceva parte dell'ordine e che il cliente crede ancora nel carrello. Perdita silenziosa dell'intento utente; l'ordine di B non partirà mai a meno che il cliente non se ne accorga.

**Evidenza:** CartView.tsx:51 `const snapshot = items.slice()` (lo snapshot è usato solo per la POST, non per la pulizia); CartView.tsx:60 dopo il successo `clear()`; store.ts:62 `clear: () => set({ items: [], checkoutKey: null })` svuota l'intero array invece di rimuovere solo lo snapshot inviato.

## Refutati dagli scettici (non sono bug reali)

pool cap 10 vs 40 client (le query sono brevi, il pool regge); indice bill_payments
(volumi irrisori); unique globale idempotency_key (il recovery filtra per
ristorante); asporto non atomico (protetto a valle); trustProxy (nessun reverse
proxy nel deployment reale); menu stantìo alla riconnessione (esiste refetch);
backup a copia fredda ad ogni avvio (rotazione ok); watchdog che si arrende
(comportamento voluto con notifica); drain richieste in volo allo shutdown
(finestra trascurabile); updates-worker senza cache (rate GitHub sufficiente).

## Evidenze

- Timeline e risultati: results.json / vm-resources.csv (sessione di collaudo)
- Verifica invarianti: script invariants.mjs (9 controlli SQL)
- Run multi-agente: 45 agenti, journal wf_c58843b6-704
