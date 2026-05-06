# Tako — Agent Backlog

> Questo file è l'interfaccia tra Manuel e gli agenti.
> Manuel scrive qui. Agenti leggono, eseguono, spostano i task in DONE.
> Ordine = priorità. P0 prima di tutto.

---

## P0 — Critico (blocca produzione o vendita)

- [ ] **[SEC] Fix SQL injection inventory** — `apps/server/src/routes/inventory.ts:56` usa raw string interpolation `WHERE id = '${itemId}'`. Sostituire con Drizzle `sql` template: `import { sql } from 'drizzle-orm'` + `db.update(inventoryItems).set({ quantity: sql\`quantity + ${delta}\`, updatedAt: new Date() }).where(eq(inventoryItems.id, itemId))`. Rimuovere anche il doppio update (prima ORM poi raw SQL — bug logico). Done quando: zero raw string interpolation in inventory.ts, pnpm tsc --noEmit passa.
- [ ] **[SEC] Autenticare Socket.io connections** — `apps/server/src/index.ts:74` ha `cors: { origin: '*' }` e `socket/handlers.ts` accetta `join:restaurant` e `join:table` senza nessun token. Fix: (1) cambiare cors origin a `process.env.ALLOWED_ORIGINS?.split(',') ?? []`, (2) aggiungere middleware `io.use()` che verifica JWT/session token nell'auth handshake, (3) validare che il restaurantId del token corrisponda al room richiesto. Done quando: un client senza token non può joinare nessuna room.
- [ ] **[SEC] Rotazione secrets + startup assertion** — Aggiungere in `apps/server/src/index.ts` assertion all'avvio: se `JWT_SECRET` è assente o uguale a `'tako-super-secret-change-in-production'` → throw Error e non partire. Stessa logica per `DATABASE_URL` che contenga password di default `tako:tako`. Aggiornare `.env.example` con istruzioni chiare. Done quando: il server non parte con secret di default.
- [ ] **Multi-tenant base** — ogni ristorante ha il suo schema DB isolato con Drizzle RLS. Senza questo Tako non può servire più di un cliente | contesto: ora tutto è single-tenant | done quando: un secondo ristorante può registrarsi e vedere solo i suoi dati
- [ ] **Auth multi-ristorante** — owner può avere più ristoranti sotto lo stesso account | contesto: ora 1 account = 1 ristorante | done quando: dropdown ristorante nella dashboard funziona
- [ ] **Stripe integration base** — pagamenti con carta dalla customer PWA | contesto: ora solo contanti/tavolo | done quando: cliente può pagare online dal telefono

---

## P1 — Alta priorità

- [ ] **[SEC] Ownership check su order mutations (IDOR)** — `apps/server/src/routes/orders.ts` lines 53-108: `PATCH /:orderId/status`, `PATCH /:orderId/cancel`, `PATCH /:orderId/items/:itemId/status` non verificano che l'ordine appartenga al ristorante dell'utente autenticato. Fix: aggiungere `.where(and(eq(orders.id, orderId), eq(orders.restaurantId, req.user!.restaurantId)))` a ogni query di update. Done quando: un utente di Restaurant A non può modificare ordini di Restaurant B.
- [ ] **[SEC] Fix PIN security** — (1) `packages/db/src/schema/users.ts`: colonna `pin` è `text` plaintext. Aggiungere hashing bcrypt al momento del set PIN in `routes/auth.ts`. (2) Spostare il `loginAttempts` Map da in-memory a Redis con TTL 15min. Key: `brute:pin:{restaurantId}:{ip}`. (3) Limite 5 tentativi per restaurantId+IP. Done quando: PIN hashato in DB, brute-force persiste su Redis tra restart.
- [ ] **[SEC] Validazione file upload** — `apps/server/src/routes/uploads.ts`: l'estensione viene presa da `data.filename.split('.').pop()` senza whitelist. Fix: (1) whitelist estensioni `['jpg', 'jpeg', 'png', 'webp', 'gif']`, (2) validare MIME type con `file-type` package dai magic bytes, (3) re-encodare con `sharp` (già in node_modules) per strippare payload embedded. Done quando: upload di .php, .html, .svg viene rifiutato con 400.
- [ ] **[SEC] Customer session via QR token** — endpoint `/api/customer/waiter-call` è unauthenticated e accetta qualsiasi restaurantId+tableId dal body. Fix: al momento della risoluzione del QR token (`GET /api/customer/table/:token`) il server emette un customer session token firmato (JWT con payload `{restaurantId, tableId, exp: now+4h}`). Questo token è richiesto per waiter-call, ai-chat, order tracking. Done quando: waiter-call senza customer token restituisce 401.
- [ ] **[SEC] Abilita ContentSecurityPolicy** — `apps/server/src/index.ts:28` ha `contentSecurityPolicy: false`. Definire CSP strict: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' wss: ws:; font-src 'self'`. Done quando: header CSP presente nelle response, nessuna violazione in console su flusso normale.
- [ ] **[SEC] Rimuovere porte DB/Redis da docker-compose** — `docker-compose.yml`: rimuovere `ports` da postgres e redis (lasciarli solo sulla rete interna Docker). Aggiungere `command: redis-server --requirepass ${REDIS_PASSWORD}` a redis. Done quando: porta 5432 e 6379 non raggiungibili dall'host.
- [ ] **[SEC] Fix mass assignment menu endpoints** — `apps/server/src/routes/menu.ts`: `PATCH /sections/:sectionId` e `PATCH /items/:itemId` passano `req.body as any` direttamente a Drizzle `.set()`. Fix: definire schema Zod per ogni PATCH con solo i campi permessi (nome, descrizione, prezzo, disponibilità). Aggiungere ownership check `eq(menuSections.menuId, userMenuId)`. Done quando: Zod schema su tutti i PATCH menu, impossibile aggiornare `menuId` o campi non autorizzati.
- [ ] **Test coverage server** — unit test per le route Fastify principali (ordini, menu, tavoli) con Vitest | done quando: coverage > 70% su apps/server/src/routes
- [ ] **Pagination ordini** — la pagina ordini carica tutto il DB, serve pagination | done quando: ordini caricano in chunk da 50, scroll infinito
- [ ] **Export report CSV** — owner può esportare ordini e incassi del periodo selezionato | done quando: bottone export nella pagina statistiche scarica CSV corretto
- [ ] **Error handling globale** — errori non gestiti crashano il server senza messaggio utile | done quando: ogni route ha try/catch con risposta JSON strutturata
- [ ] **Landing page completamento** — la folder /landing esiste ma è incompleta | done quando: landing ha hero, features, pricing, CTA, deploy su Cloudflare
- [ ] **Mobile responsive dashboard** — alcune sezioni dashboard non funzionano bene su tablet < 768px | done quando: tutte le sezioni usabili su iPad Mini

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
