# STATO TAKO

> File di stato generale unico. Verità più recente al **2026-06-22**.
> Prevale sui piani storici (`PIANO-PERFEZIONE-TAKO.md`, `BACKLOG.md`, `UI-REVISION-PLAN.md`,
> `.claude/MASTER_PLAN.md`), che restano come archivio.
> Il dettaglio tecnico vive in `docs/` (vedi ultima sezione).

---

## Cos'è e architettura

Tako = sistema operativo del ristorante. Gira **in locale** su un mini PC nel locale. Lo staff
usa la dashboard su tablet; i clienti scansionano il QR del tavolo e ordinano dal telefono
senza installare nulla. Il core POS funziona senza internet; solo le feature AI richiedono rete.

Quattro componenti:

```
  apps/server     Fastify + Socket.io + Drizzle/Postgres   :3001   ← cuore, multi-tenant
  apps/web        Customer PWA (Next.js 15)                 :3002   ← cliente da QR
  apps/dashboard  Dashboard staff (SPA in /public/staff)    :3000   ← staff su tablet
  apps/app        App nativa Expo + Tauri (thin client)             ← carica /staff
```

Dettaglio: `docs/ARCHITETTURA.md`.

---

## ✅ Fatto

**Backend (`apps/server`)**
- Fastify + Socket.io + Drizzle/Postgres funzionante, **37/37 test di integrazione live verdi**.
- Multi-tenant con isolamento per `restaurantId` verificato.
- Route complete: auth, restaurants, menus, tables, orders, bills, inventory, stats, customer,
  staff, insights, print, ai, uploads.
- `POST /api/orders` (comanda staff) aggiunto di recente.
- Realtime via Socket.io rooms `restaurant:{id}` / `table:{id}`.
- Prezzi ordini sempre ricalcolati dal DB, mai dal client.
- Simulazione "ristorante pieno" (12 ordini concorrenti) verde: conti coerenti, isolamento,
  pagamento.

**Sicurezza (già chiusa)**
- PIN bcrypt, JWT obbligatorio con startup assertion, IDOR su ordini/menu, MIME whitelist +
  magic-bytes su upload, Socket.io auth, leak cross-tenant in `POST /bills` chiuso,
  fallback PIN plaintext rimosso.
- Auth a cookie HttpOnly progettata e in corso (vedi `.claude/MASTER_PLAN.md`, sezione "A metà").

**Cliente PWA (`apps/web`)**
- Flusso completo: QR → tavolo → menu (dal DB) → ordine → tracking realtime, prezzi dal server.

**Dashboard staff (`apps/dashboard`)**
- UI definitiva = prototipo "Tako Dashboard" ricostruito **verbatim** come SPA in
  `public/staff/`, collegata al backend reale: login cookie, dati reali, realtime socket,
  azioni wirate su tutte le schermate (ordini, KDS, cassa, sala, comanda, menu, inventario,
  staff, tavoli, QR, impostazioni). Rimossi dati finti, generatore ordini finti, toolbar
  prototipo. Sorgente di riferimento in `prototype-ref/`.

**App nativa (`apps/app`)**
- Thin-client Expo (mobile) + Tauri (desktop) che carica `http://<server>:3000/staff`.
  Icona = logo Tako (polpo col telefono).

**Analytics**
- Peak hours (scansioni QR per ora), tasso di conversione, tempo al primo ordine,
  menu engineering (Boston Matrix via Groq).

**UI / Design system**
- Revisione UI completa (10 task) e design system unificato — chiusi (vedi `UI-REVISION-PLAN.md`).
  Nota: la dashboard è poi stata sostituita dalla SPA verbatim.

---

## 🟡 A metà / parziale

- **Owner-assistant AI** su Anthropic SDK (key assente → 503 graceful), mentre l'AI cliente è
  su Groq e funziona. → **Allineare l'owner-assistant a Groq.**
- **Auth cookie HttpOnly** (T3): progettata in `.claude/MASTER_PLAN.md`, `@fastify/cookie`
  installato. Da completare: set/clear cookie staff + logout, JWT tavolo al resolve QR +
  `requireTableSession` su waiter-call/ai-chat/orders, client `withCredentials`, stop
  localStorage dashboard.
- **Multi-tenant RLS in prod**: `withRestaurantContext()` definita; resta 1 task di codice per
  attivare la RLS in produzione (vedi `docs/deploy/RUNBOOK.md`).
- **Varianti piatto** (S/M/L): `itemVariants` in schema e mostrate nella PWA, ma **manca
  l'endpoint/UI di scrittura** dalla dashboard.
- **Coordinate mappa sala** (`tables.posX/posY`): campi in schema, **senza endpoint di scrittura**.
- **Deploy**: artefatti container preparati (RUNBOOK), **non ancora deployati**.

---

## ⛔ Da fare

### P0 — Sicurezza (chiude i prerequisiti dell'AI cliente sicura)
- [ ] Completare auth cookie HttpOnly (set/clear staff + logout, JWT tavolo, `requireTableSession`).
- [ ] Customer session via QR token: `POST /api/customer/waiter-call` oggi unauthenticated →
      richiedere il JWT tavolo (senza token → 401). (Coperto dal punto sopra.)
- [ ] Abilitare ContentSecurityPolicy (oggi `contentSecurityPolicy: false`).
- [ ] Rate limit AI chat per `tableId` (max 1 req/5s → 429 oltre).

### P0 — Pulizia / debito immediato
- [ ] Ripulire `apps/web/.env.local`: usa `NEXT_PUBLIC_SERVER_URL` (inutilizzata); il config
      legge `NEXT_PUBLIC_API_URL`.
- [ ] Endpoint di scrittura per varianti piatto (sblocca la UI varianti in dashboard).
- [ ] Endpoint di scrittura per `posX/posY` (sblocca la mappa sala).

### P1 — Operatività solida
- [ ] Edit staff esistente (oggi solo add/delete).
- [ ] UI varianti piatto nel form "Nuovo piatto" (lista varianti + modificatore prezzo).
- [ ] Allergen filter lato cliente (chip multi-select nel menu PWA).
- [ ] Drag&drop riordino sezioni/piatti (dnd-kit installato; campo `position`).
- [ ] Upload immagine piatto diretto da file (riusa `/api/uploads`).
- [ ] Upload logo ristorante.
- [ ] Stampa comanda termica (escpos; settings IP/porta; stampa su conferma ordine).
- [ ] Allineare owner-assistant a Groq.

### P1 — Analytics che fanno tornare il ristoratore
- [ ] Piatti top per fascia oraria (pranzo/aperitivo/cena).
- [ ] Stats settimana-su-settimana (badge +/- su ogni KPI).
- [ ] Tempo medio permanenza tavolo (da `openedAt` a chiusura conto).
- [ ] Export CSV statistiche (`GET /api/stats/export?from=&to=`).
- [ ] Report settimanale via email (nodemailer, configurabile).

### P2 — Differenziatori operativi
- [ ] Assegnazione cameriere a tavolo (`tables.assignedWaiterId` già in schema).
- [ ] Scarico magazzino automatico da ordini (tabella `menu_item_ingredients`).
- [ ] Prenotazioni semplici (form pubblico `/prenota/:slug`, sezione dashboard).
- [ ] Pianta sala visuale drag&drop (usa `posX/posY`).
- [ ] AI agentica completa: tool cliente che **ordinano** + copilot owner (Cmd+K). Vedi
      `PIANO-PERFEZIONE-TAKO.md` parte 1 per il design.

### P2 — Backlog tecnico
- [ ] Pagination ordini (chunk 50, scroll infinito).
- [ ] Error handling globale server (JSON strutturato su tutte le route).
- [ ] Test coverage server > 70% (Vitest).
- [ ] Multi-tenant RLS completo su ogni route autenticata.
- [ ] Mobile responsive dashboard (iPad Mini < 768px).

### Esplicitamente FUORI SCOPE (decisione attiva, non in roadmap)
Pagamenti digitali/Stripe, registratore telematico (RT), corrispettivi Agenzia Entrate,
fattura elettronica SDI, WhatsApp/SMS, login/account cliente.

> Nota: `PIANO-PERFEZIONE-TAKO.md` proponeva di rimettere in scope conformità fiscale e
> pagamenti come "must". Allo stato 2026-06-22 restano **fuori scope** finché Manuel non
> decide diversamente.

---

## 📌 Decisioni vincolanti

- **Niente pagamenti digitali** nel sistema (e niente RT/corrispettivi/SDI) — fuori scope.
- **Prezzi sempre dal DB**, mai dal client.
- **Core POS 100% locale**, funziona senza internet; solo le feature AI richiedono rete.
- **AI cliente su Groq**; owner-assistant da allineare a Groq (oggi su Anthropic).
- **Dashboard = prototipo "Tako Dashboard" verbatim**, wirato al backend reale, servito da
  `/staff`. Le vecchie pagine Next in `apps/dashboard/src/app/dashboard/*` sono bypassate.
- **App nativa = thin client** che carica `/staff` (nessuna logica duplicata).
- **Multi-tenant**: ogni entità scoped per `restaurantId`.
- **Merge su main: solo Manuel.**

---

## 🔗 Dove sta la documentazione di dettaglio

| Argomento | File |
|---|---|
| Architettura dei 4 componenti, schema, AI | `docs/ARCHITETTURA.md` |
| Contratti API (route, realtime, ENV, AI) | `docs/API-CONTRATTI.md` |
| Avvio locale, porte, comandi | `docs/AVVIO-LOCALE.md` |
| Deploy / runbook / RLS prod | `docs/deploy/RUNBOOK.md` |
| Threat model | `docs/security/threat-model.md` |
| Hardening produzione | `docs/security/hardening-guide.md` |
| Pentest report | `docs/security/pentest-report-2026-05-07.md` |
| Brief design dashboard | `docs/design/dashboard-redesign-brief.md` |
| Brief design customer PWA | `docs/design/customer-pwa-redesign-brief.md` |
| Design AI agentico (storico) | `PIANO-PERFEZIONE-TAKO.md` |
| Design auth cookie HttpOnly | `.claude/MASTER_PLAN.md` |
