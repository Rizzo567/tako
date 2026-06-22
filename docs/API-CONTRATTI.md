# Tako — Contratti API e realtime

> Riferimento delle interfacce esposte dal backend `apps/server`. Per l'architettura
> generale vedi `docs/ARCHITETTURA.md`. I contratti formali esposti dagli agenti stanno in
> `.claude/comms/contracts/`.

---

## Route HTTP (registrate in `apps/server/src/index.ts`)

Tutte sotto prefisso `/api`. Le route staff richiedono sessione autenticata (cookie HttpOnly
`tako_session`, con fallback Bearer durante la transizione). Le route cliente sono legate alla
sessione del tavolo (JWT emesso al resolve del QR, cookie `tako_table`).

| Prefisso | File route | Scopo |
|---|---|---|
| `/api/auth` | `routes/auth.ts` | login/register/pin staff, logout, gestione sessione |
| `/api/restaurants` | `routes/restaurants.ts` | dati ristorante, impostazioni, branding |
| `/api/menus` | `routes/menu.ts` | menu, sezioni, items, varianti (CRUD, ownership check) |
| `/api/tables` | `routes/tables.ts` | sale, tavoli, QR |
| `/api/orders` | `routes/orders.ts` | ordini (incl. `POST /api/orders` comanda staff), stati, item status |
| `/api/bills` | `routes/bills.ts` | conti, chiusura, split (tenant-isolated) |
| `/api/inventory` | `routes/inventory.ts` | magazzino, livelli scorte |
| `/api/stats` | `routes/stats.ts` | KPI, peak hours, conversione, top items |
| `/api/customer` | `routes/customer.ts` | resolve QR→tavolo, menu cliente, ordine, waiter-call, ai-chat |
| `/api/uploads` | `routes/uploads.ts` | upload file (MIME whitelist + magic-bytes) |
| `/api/staff` | `routes/staff.ts` | gestione membri staff |
| `/api/insights` | `routes/insights.ts` | menu engineering (Boston Matrix via Groq) |
| `/api/print` | `routes/print.ts` | stampa (comanda) |
| `/api/ai` | `routes/ai.ts` | assistente AI agentico (owner) |

File statici: `/uploads/` serviti da disco; SPA staff servita da `apps/dashboard/public/staff/`.

---

## Realtime (Socket.io)

- **Rooms**: `restaurant:{id}` per lo staff (tutti gli eventi del ristorante),
  `table:{id}` per il singolo cliente (eventi del proprio tavolo/ordine).
- **Auth socket**: `join:restaurant` richiede un token valido.
- Flusso tipico: ordine cliente → broadcast su `restaurant:{id}` → KDS/ordini si aggiornano
  live; cambio stato ordine → broadcast su `table:{id}` → il tracking cliente si aggiorna.

---

## Sottosistema AI (`apps/server/src/ai/`)

| File | Ruolo |
|---|---|
| `agent.ts` | loop function-calling provider-agnostico |
| `registry.ts` | registry tool: nome → { schema zod, scope, requiresConfirmation, handler } |
| `provider.ts` | client Anthropic; modello default `claude-haiku-4-5` (override `TAKO_AI_MODEL`) |
| `personas.ts` | system prompt OWNER vs CUSTOMER |
| `tools/owner.ts` | tool lato ristoratore |
| `tools/customer.ts` | tool lato cliente (vincolati a sessione/tavolo) |

**Stato provider (importante):**
- **Owner-assistant** (`/api/ai`): su Anthropic SDK. Se `ANTHROPIC_API_KEY` è assente →
  degrada con 503 graceful (nessuna azione rischiosa).
- **AI cliente** (`/api/customer` ai-chat): fallback Q&A read-only su **Groq**
  (`llama-3.3-70b-versatile`). Se `GROQ_API_KEY` assente → 503.
- **Allineamento previsto**: portare l'owner-assistant su Groq per uniformare i provider
  (vedi "A metà" in `STATO-TAKO.md`).

**Principio dei tool**: ogni tool riusa la logica delle route esistenti (non reimplementa).
Il prezzo resta sempre dal DB. I tool cliente sono vincolati a `sessionId`/`tableId` del JWT.

---

## Variabili d'ambiente rilevanti

| Variabile | Dove | Note |
|---|---|---|
| `JWT_SECRET` | server | obbligatoria, startup assertion |
| `ANTHROPIC_API_KEY` | server | owner-assistant; se assente → 503 graceful |
| `GROQ_API_KEY` | server | AI cliente + insights; se assente → 503 |
| `TAKO_AI_MODEL` | server | override modello AI (default `claude-haiku-4-5`) |
| `NEXT_PUBLIC_API_URL` | web | **var letta** dal config (`apps/web/next.config.ts`) |
| `NEXT_PUBLIC_SERVER_URL` | web | **NON usata dal config** — presente in `.env.local`, da ripulire |

> Nota debito: `apps/web/.env.local` definisce `NEXT_PUBLIC_SERVER_URL`, ma il rewrite legge
> `NEXT_PUBLIC_API_URL`. Allineare per evitare confusione.
