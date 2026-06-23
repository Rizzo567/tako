# Tako — Agent Backlog

> Questo file è l'interfaccia tra Manuel e gli agenti.
> Manuel scrive qui. Agenti leggono, eseguono, spostano i task in DONE.
> Ordine = priorità. P0 prima di tutto.

---

## ❌ FUORI SCOPE (rimandato a futuro)
> Non toccare finché Manuel non lo rimette in backlog.

- Stripe / pagamenti digitali
- Registratore telematico (RT)
- Corrispettivi Agenzia delle Entrate
- WhatsApp / SMS notifiche
- Login cliente / account cliente

---

## P0 — Sicurezza (ancora aperta)

- [ ] **[SEC] Customer session via QR token** — `POST /api/customer/waiter-call` è unauthenticated. Emettere JWT al resolve QR, richiederlo su waiter-call e ai-chat. Done: waiter-call senza token → 401.
- [ ] **[SEC] Abilita ContentSecurityPolicy** — `apps/server/src/index.ts:28` ha `contentSecurityPolicy: false`. Done: header CSP presente, nessuna violazione console sul flusso normale.
- [ ] **[SEC] Session token in HttpOnly cookie** — token in localStorage esposto a XSS. Migrare a cookie HttpOnly+Secure+SameSite=Strict. Done: nessun token in localStorage.
- [ ] **[SEC] Rate limit AI chat per tableId** — max 1 req/5s per tableId. Done: >1 req/5s stesso tableId → 429.

---

## FASE 1 — Operatività solida
> Must-have prima di mostrare Tako a un ristorante vero.

- [ ] **Edit staff esistente** — ora si può solo aggiungere o eliminare. Aggiungere bottone modifica su ogni card staff: apre form pre-compilato (nome, email, ruolo, PIN, telefono). Done: ogni membro modificabile senza delete+recreate. | Owner: Both | ~1g
- [ ] **Varianti piatto (S/M/L, opzioni)** — `itemVariants` esiste già in schema e customer PWA le mostra, ma il form "Nuovo piatto" nella dashboard non permette di crearle/modificarle. Aggiungere sezione varianti nel modal piatto: lista varianti con nome + modificatore prezzo + add/remove. Done: chef crea piatto con 3 taglie, cliente le vede sul menu. | Owner: Both | ~2g
- [ ] **Allergen filter cliente** — il menu mostra gli allergeni per piatto ma il cliente non può filtrare. Aggiungere chip filtro allergen in cima al menu PWA (multi-select). Piatti con quell'allergene vengono nascosti o marcati. Done: cliente seleziona "glutine", tutti i piatti con glutine spariscono dalla lista. | Owner: Frontend | ~1g
- [ ] **Drag&drop riordino menu** — sezioni e piatti non hanno ordine modificabile dalla UI. Aggiungere handle drag&drop su sezioni e piatti (dnd-kit già installato). PATCH `/menus/sections/:id` e `/menus/items/:id` con campo `position`. Done: chef trascina "Dolci" dopo "Secondi", ordine persiste al refresh. | Owner: Both | ~2g
- [ ] **Upload immagine piatto diretto** — ora solo URL esterno. Usare endpoint `/api/uploads` già esistente: aggiungere `<input type="file">` nel modal piatto, upload → URL → salva su item. Done: chef carica foto dal telefono, appare sul menu cliente. | Owner: Both | ~1g
- [ ] **Upload logo ristorante** — impostazioni ha color picker ma nessun upload logo. Aggiungere campo logo in `/dashboard/impostazioni`, stesso flusso upload. Done: logo appare nella customer PWA al posto della "T" coral. | Owner: Both | ~0.5g
- [ ] **Stampa comanda su stampante termica** — nessuna integrazione stampante. Installare `escpos` o compatibile Node. Aggiungere settings per IP/porta stampante. Quando staff clicca "Conferma" su un ordine in `/dashboard/ordini`, stampa riga automaticamente. Done: ordine confermato → comanda fisica esce dalla stampante. | Owner: Backend | ~3g

---

## FASE 2 — Analytics che fanno capire il business
> Dati che fanno tornare il ristoratore a guardare la dashboard ogni mattina.

- [x] **Peak hours chart (scansioni QR per ora)** — `table_sessions` + grafico 24h in `/dashboard/statistiche`. — 2026-05-11
- [x] **Tasso conversione + tempo al primo ordine** — KPI in statistiche da `table_sessions`. — 2026-05-11
- [ ] **Piatti top per fascia oraria** — "Cosa ordina la gente a pranzo vs cena?". Query `order_items` grouped per ora del giorno + nome piatto. Nuova sezione in Insights: heatmap o top-5 per fascia (pranzo 12-15 / aperitivo 18-20 / cena 20-23). Done: owner vede che la carbonara tira solo a pranzo. | Owner: Both | ~2g
- [ ] **Stats settimana su settimana** — confronto questa settimana vs settimana scorsa per revenue, coperti, ticket medio. Badge +/- percentuale accanto a ogni KPI. Done: ogni KPI mostra "↑ +12% vs settimana scorsa". | Owner: Both | ~1g
- [ ] **Tempo medio permanenza tavolo** — da `tables.openedAt` a chiusura conto. Aggiungere `closedAt` su bills (già esiste). Media per giorno/ora. Done: owner vede "tavolo occupato in media 52 minuti". | Owner: Both | ~1g
- [ ] **Export CSV statistiche** — bottone "Esporta" in `/dashboard/statistiche`. Endpoint `GET /api/stats/export?from=&to=` → CSV con righe per ordine (data, tavolo, totale, piatti, metodo pagamento). Done: owner scarica CSV, lo apre in Excel. | Owner: Both | ~1g
- [ ] **Report settimanale email** — ogni lunedì mattina, email al proprietario con: incasso settimana, piatto più venduto, giorno più alto, confronto settimana precedente. Usare `nodemailer`. Configurabile da impostazioni (on/off + email destinatario). Done: owner riceve email il lunedì senza aprire la dashboard. | Owner: Backend | ~2g

---

## FASE 3 — Differenziatori operativi
> Features che nessun competitor locale italiano fa bene insieme.

- [ ] **Assegnazione cameriere a tavolo** — `tables.assignedWaiterId` esiste già in schema ma non è usato. Aggiungere selector cameriere nel modal tavolo in `/dashboard/sala`. Filtrare ordini per cameriere in `/dashboard/ordini`. Done: ogni tavolo ha il suo cameriere, le statistiche mostrano performance per cameriere. | Owner: Both | ~2g
- [ ] **Inventory scarico automatico da ordini** — quando un ordine passa a "served", scaricare gli ingredienti collegati. Serve tabella di collegamento `menu_item_ingredients` (menuItemId → ingredientId + qty). UI in modal piatto per aggiungere ingredienti. Done: ogni pizza venduta scala 200g di farina dall'inventario automaticamente. | Owner: Both | ~3g
- [ ] **Prenotazioni semplici** — niente login cliente. Form pubblico `/prenota/:slug`: nome, telefono, data, ora, n° coperti, nota. Staff vede lista prenotazioni in nuova sezione `/dashboard/prenotazioni`. Può confermare/rifiutare. Done: cliente prenota da link QR o Google, staff gestisce dalla dashboard. | Owner: Both | ~5g
- [ ] **Pianta sala visuale drag&drop** — griglia visiva in `/dashboard/sala/tavoli` dove staff posiziona i tavoli su una mappa. `tables.posX` e `tables.posY` già in schema. Render dei tavoli come elementi posizionabili. Done: sala digitale rispecchia la sala fisica, cameriere capisce subito dove andare. | Owner: Frontend | ~5g

---

## FASE DEPLOY — "Scarica, apri, opera" (app desktop)
> Obiettivo: il ristorante scarica un'app, la apre ed è subito operativa, setup
> connessione automatico. Modello AIKE. Piano completo in `docs/MASTER-PLAN.md`.

- [x] **F0 — Un solo processo serve tutto** — Fastify serve API + Socket.io + dashboard staff statica (`/staff`, redirect `/`), same-origin. CSP reale presente. — 2026-06-23
- [x] **F1 — Postgres embedded automatico** — `EMBEDDED_DB=1` avvia Postgres portatile + migrazioni idempotenti; bootstrap.ts imposta `DATABASE_URL` prima dell'import del client. — 2026-06-23
- [x] **F2 — Shell Tauri spawna il server** — `apps/app/src-tauri` avvia il server figlio all'apertura, lo termina alla chiusura (cargo check OK). — 2026-06-23
- [x] **F3a — Zero-config rete** — mDNS `tako.local` + `GET /api/system/info` (IP LAN + QR collega-dispositivi). — 2026-06-23
- [x] **Avvio unico `pnpm tako`** — tutto in un processo, segreto JWT persistente in `~/.tako`. — 2026-06-23
- [x] **F3b.1 — Schermata "Collega dispositivi"** — voce menu owner + `ScreenCollega` che mostra QR + URL (tako.local/IP) da `/api/system/info`. — 2026-06-23
- [ ] **F3b.2 — Onboarding obbligatorio primo avvio** — rendere il wizard `SETUP` un gate obbligatorio finché il setup non è completo (tutorial per pagina). Done: al primo avvio l'owner è guidato step-by-step prima di usare la dashboard. | Owner: Frontend | ~2g
- [ ] **F4 — Packaging installer** — `tauri build` con node + server compilato + binari Postgres impacchettati come risorse Tauri; `spawn_server` punta alla risorsa `server/bootstrap.js`. Output `.exe`/`.dmg`/`.AppImage`. Firma/notarizzazione dove serve. Done: doppio click su installer → app che apre e opera. | Owner: DevOps | ~5g
- [ ] **F-web — Consolida PWA cliente** — la rotta dinamica `apps/web` blocca lo static export; refactor per servirla dal Fastify (o secondo child). Toglie il processo Next `:3002`. Done: anche il menu cliente servito dal singolo processo. | Owner: Frontend | ~3g

---

## Backlog tecnico (non product)

- [ ] **Pagination ordini** — `/dashboard/ordini` carica tutto. Chunk da 50, scroll infinito. | ~1g
- [ ] **Error handling globale server** — try/catch + risposta JSON strutturata su tutte le route. | ~1g
- [ ] **Test coverage server** — Vitest su route principali, coverage > 70%. | ~3g
- [ ] **Multi-tenant RLS completo** — `withRestaurantContext()` su ogni route autenticata (ora definita ma non usata). | ~2g
- [ ] **Mobile responsive dashboard** — sezioni usabili su iPad Mini (< 768px). | ~2g

---

### Branches pronti per merge (non ancora su main)
| Branch | Cosa fa |
|---|---|
| `fix/item-variants-tenant-isolation` | itemVariants scoped per tenant |
| `fix/bills-reliability-shutdown` | reject payment su bill closed + graceful shutdown |
| `feat/customer-pwa-realtime` | menu realtime socket + stati cancelled/paid in OrderTracking |
| `fix/db-indexes` | composite indexes per query multi-tenant |
| `fix/menu-idor-ownership` | IDOR check su menu sections/items/variants |
| `fix/stats-top-items-query` | Fix stats top-items inArray + aggregazione |
| `perf/orders-parallel-queries` | GET /active e /table/:tableId via LEFT JOIN |

---

## DONE ✅

- [x] **Tracking sessioni QR + peak hours analytics** — `table_sessions`, scansioni/conversione/tempo al primo ordine, grafico 24h — 2026-05-11
- [x] **[SEC] Fix SQL injection inventory** — Drizzle `sql` template, tenant isolation — 2026-05-07
- [x] **[SEC] Autenticare Socket.io connections** — `join:restaurant` richiede token valido — 2026-05-07
- [x] **[SEC] Rotazione secrets + startup assertion** — `JWT_SECRET` obbligatorio — 2026-05-07
- [x] **[SEC] Ownership check su order mutations (IDOR)** — restaurantId check su status, cancel, item status — 2026-05-07
- [x] **[SEC] Fix PIN security** — PIN hashato con bcrypt — 2026-05-07
- [x] **[SEC] Validazione file upload** — MIME whitelist — 2026-05-07
- [x] **[SEC] Fix mass assignment menu endpoints** — Zod schema + ownership check — 2026-05-07
- [x] UI Revision completa (10 task) — 2026-04-28
- [x] Analisi Menu AI (Boston Matrix + GPT suggerimenti) — 2026-04-30
- [x] TypeScript zero errori — 2026-04-30
