# Tako — Architettura di sistema

> Dettaglio tecnico dei componenti. Per lo stato di avanzamento (fatto/da fare) vedi
> `STATO-TAKO.md` nella root. Per l'avvio locale vedi `docs/AVVIO-LOCALE.md`.
> Per i contratti API vedi `docs/API-CONTRATTI.md`.

---

## Visione d'insieme

Tako è il sistema operativo di un ristorante. Tutto gira **in locale** su un mini PC nel
ristorante (il core POS funziona senza internet; solo le feature AI richiedono rete). Lo staff
usa la dashboard su tablet; i clienti scansionano il QR del tavolo e ordinano dal telefono senza
installare niente.

```
                        ┌─────────────────────────────────────────┐
                        │            MINI PC (locale)               │
                        │                                           │
  Cliente (telefono) ──▶│  apps/web      Next.js 15   :3002  (PWA)  │
   scan QR tavolo        │     │                                    │
                        │     ▼  /api (rewrite)                     │
  Staff (tablet) ──────▶│  apps/server   Fastify+Socket.io  :3001   │◀── realtime
   dashboard            │     │            (Drizzle ORM)            │    socket
                        │     ▼                                     │
  App nativa ──────────▶│  PostgreSQL  :5432   +   Redis  :6379     │
   (Expo/Tauri)         │                                           │
                        │  apps/dashboard  Next.js 15  :3000        │
                        │     └─ serve la SPA staff in /public/staff │
                        └─────────────────────────────────────────┘
```

---

## I quattro componenti

### 1. `apps/server` — Backend (porta :3001)
Fastify + Socket.io + Drizzle ORM su PostgreSQL.

- **Multi-tenant**: ogni entità è scoped per `restaurantId`. Isolamento verificato dai test.
- **Route registrate** (prefisso `/api/...`): `auth`, `restaurants`, `menus`, `tables`,
  `orders`, `bills`, `inventory`, `stats`, `customer`, `uploads`, `staff`, `insights`,
  `print`, `ai`. Dettaglio in `docs/API-CONTRATTI.md`.
- **Realtime**: Socket.io con rooms `restaurant:{id}` (staff) e `table:{id}` (cliente).
- **Regola di sicurezza dei prezzi**: il totale di un ordine è **sempre** ricalcolato dal DB,
  mai dal client.
- **AI** (`apps/server/src/ai/`): loop function-calling provider-agnostico (`agent.ts`),
  `registry.ts` (registry tool con scope/conferma), `provider.ts` (client Anthropic),
  `personas.ts` (system prompt owner vs customer), `tools/owner.ts` + `tools/customer.ts`.

### 2. `apps/web` — Customer PWA (porta :3002)
Next.js 15. Flusso cliente: scan QR → risoluzione tavolo → menu (dal DB) → carrello → ordine →
tracking realtime → chiamata cameriere / AI chat. Chiama il backend via rewrite `/api` →
same-origin (cookie HttpOnly puliti, niente attriti CORS).

### 3. `apps/dashboard` — Dashboard staff (porta :3000)
Next.js 15. **La UI definitiva è una SPA statica** ricostruita verbatim dal prototipo "Tako
Dashboard", servita da `apps/dashboard/public/staff/` e collegata al backend reale:
login via cookie, dati reali, realtime via socket, azioni wirate su tutte le schermate
(ordini, KDS, cassa, sala, comanda, menu, inventario, staff, tavoli, QR, impostazioni).

- Sorgente di riferimento del prototipo: `apps/dashboard/prototype-ref/`.
- Le vecchie pagine Next in `apps/dashboard/src/app/dashboard/*` sono **bypassate** da `/staff`.

### 4. `apps/app` — App nativa (thin client)
Expo (mobile) + Tauri (desktop). È un thin-client che carica la dashboard staff via
`http://<server>:3000/staff`. Icona = logo Tako (polpo col telefono).

---

## Pacchetti condivisi
- `packages/db` — schema PostgreSQL con Drizzle (tabelle: restaurants, menus/sezioni/items,
  itemVariants, tables, table_sessions, orders/order_items, bills, inventory, staff/sessions,
  ai actions/log). **Non modificare senza leggere l'intera schema prima.**
- `packages/types` — tipi condivisi Socket.io + API.
- `packages/ui` — componenti UI condivisi.

---

## Decisioni architetturali vincolanti
Vedi la sezione "Decisioni vincolanti" in `STATO-TAKO.md`. In sintesi: niente pagamenti
digitali nel sistema, prezzi sempre dal DB, AI owner su Anthropic (cliente su Groq),
dashboard = prototipo verbatim wired, core POS 100% locale.
