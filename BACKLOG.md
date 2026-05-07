# Tako — Agent Backlog

> Questo file è l'interfaccia tra Manuel e gli agenti.
> Manuel scrive qui. Agenti leggono, eseguono, spostano i task in DONE.
> Ordine = priorità. P0 prima di tutto.

---

## P0 — Critico (blocca produzione o vendita)

- [x] **[SEC] Fix SQL injection inventory** — Drizzle `sql` template, tenant isolation aggiunta. — 2026-05-07
- [x] **[SEC] Autenticare Socket.io connections** — `join:restaurant` richiede token valido, CORS ristretto a origini note. — 2026-05-07
- [x] **[SEC] Rotazione secrets + startup assertion** — `JWT_SECRET` obbligatorio, server crasha se mancante. `.env.example` aggiornato. — 2026-05-07
- [ ] **Multi-tenant base** — ogni ristorante ha il suo schema DB isolato con Drizzle RLS. Senza questo Tako non può servire più di un cliente | contesto: ora tutto è single-tenant | done quando: un secondo ristorante può registrarsi e vedere solo i suoi dati
- [ ] **Auth multi-ristorante** — owner può avere più ristoranti sotto lo stesso account | contesto: ora 1 account = 1 ristorante | done quando: dropdown ristorante nella dashboard funziona
- [ ] **Stripe integration base** — pagamenti con carta dalla customer PWA | contesto: ora solo contanti/tavolo | done quando: cliente può pagare online dal telefono

---

## P1 — Alta priorità

- [x] **[SEC] Ownership check su order mutations (IDOR)** — `restaurantId` check su status, cancel, item status. — 2026-05-07
- [x] **[SEC] Fix PIN security (parziale)** — PIN hashato con bcrypt, login usa `bcrypt.compare`. Redis brute-force ancora in-memory (P1 rimasto aperto). — 2026-05-07
- [x] **[SEC] Validazione file upload** — MIME whitelist, estensione da MIME non da filename. — 2026-05-07
- [ ] **[SEC] Customer session via QR token** — endpoint `/api/customer/waiter-call` è unauthenticated. Emettere JWT firmato al resolve del QR token (`GET /api/customer/table/:token`), richiederlo su waiter-call, ai-chat, order tracking. Done quando: waiter-call senza customer token restituisce 401.
- [ ] **[SEC] Abilita ContentSecurityPolicy** — `apps/server/src/index.ts:28` ha `contentSecurityPolicy: false`. Definire CSP strict: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' wss: ws:; font-src 'self'`. Done quando: header CSP presente nelle response, nessuna violazione in console su flusso normale.
- [ ] **[SEC] Rimuovere porte DB/Redis da docker-compose prod** — Ora legate a `127.0.0.1` (localhost only). Per produzione: rimuovere completamente i `ports`, aggiungere `redis-server --requirepass`. Done quando: porta 5432 e 6379 non raggiungibili dall'esterno in produzione.
- [x] **[SEC] Fix mass assignment menu endpoints** — Zod schema su `PATCH /sections/:sectionId` e `PATCH /items/:itemId`, ownership check su items. — 2026-05-07
- [ ] **Test coverage server** — unit test per le route Fastify principali (ordini, menu, tavoli) con Vitest | done quando: coverage > 70% su apps/server/src/routes
- [ ] **Pagination ordini** — la pagina ordini carica tutto il DB, serve pagination | done quando: ordini caricano in chunk da 50, scroll infinito
- [ ] **Export report CSV** — owner può esportare ordini e incassi del periodo selezionato | done quando: bottone export nella pagina statistiche scarica CSV corretto
- [ ] **Error handling globale** — errori non gestiti crashano il server senza messaggio utile | done quando: ogni route ha try/catch con risposta JSON strutturata
- [ ] **Landing page completamento** — la folder /landing esiste ma è incompleta | done quando: landing ha hero, features, pricing, CTA, deploy su Cloudflare
- [ ] **Mobile responsive dashboard** — alcune sezioni dashboard non funzionano bene su tablet < 768px | done quando: tutte le sezioni usabili su iPad Mini

### Branches pronti per merge (non ancora su main)
| Branch | Cosa fa |
|---|---|
| `fix/item-variants-tenant-isolation` | #04 itemVariants scoped per tenant |
| `fix/bills-reliability-shutdown` | #06 reject payment su bill closed + #09 graceful shutdown |
| `feat/customer-pwa-realtime` | #07 menu realtime socket + #08 stati cancelled/paid in OrderTracking |
| `fix/db-indexes` | #10 composite indexes per query multi-tenant |
| `fix/menu-idor-ownership` | IDOR check su menu sections/items/variants |
| `fix/stats-top-items-query` | Fix stats top-items inArray + aggregazione |
| `docs/readme-setup` | README con setup guide |
| `perf/orders-parallel-queries` | GET /active e /table/:tableId via LEFT JOIN |

---

## P2 — Miglioramento continuo

- [ ] **[SEC] Wiring RLS** — `packages/db/src/rls.ts` definisce `withRestaurantContext()` ma zero route la chiamano. Fix: aggiungere Fastify `onRequest` hook nel plugin auth che chiama `withRestaurantContext(req.user.restaurantId)` per ogni richiesta autenticata. Done quando: ogni query autenticata va in esecuzione con `app.current_restaurant_id` settato.
- [ ] **[SEC] Rate limit AI chat** — `POST /api/customer/ai-chat` è unauthenticated con solo rate limit globale. Fix: aggiungere rate limit specifico per endpoint: max 1 req/5s per tableId (dopo fix customer session). Validare che history array alterni ruoli user/assistant, max 6 elementi, max 500 char per messaggio. Done quando: >1 req/5s dallo stesso tableId restituisce 429.
- [ ] **[SEC] Session token in HttpOnly cookie** — `apps/dashboard/src/lib/store.ts`: token in localStorage esposto a XSS. Migrare a cookie HttpOnly+Secure+SameSite=Strict. Richiede modifica al login endpoint per Set-Cookie header e rimozione `Authorization: Bearer` header. Done quando: nessun token in localStorage, cookie presente con flag corretti.
- [ ] **Analytics avanzati** — grafico revenue per ora del giorno, heatmap giorni settimana
- [ ] **Email notifiche owner** — email giornaliera con summary incassi e ordini
- [ ] **PWA offline mode** — customer PWA funziona anche senza connessione (mostra menu cached)
- [ ] **Dark mode dashboard** — toggle dark/light nella topbar
- [ ] **Multi-lingua** — IT/EN switch nella customer PWA
- [ ] **QR code personalizzato** — owner può customizzare colore/logo del QR tavolo
- [ ] **Notifica push staff** — cameriere riceve push quando cliente chiama o ordine pronto in cucina

---

## DONE ✅

- [x] UI Revision completa (10 task) — 2026-04-28
- [x] Analisi Menu AI (Boston Matrix + GPT suggerimenti) — 2026-04-30
- [x] TypeScript zero errori — 2026-04-30
