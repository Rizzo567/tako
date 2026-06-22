# Tako — Avvio in locale

> Per il deploy in produzione (container, RLS, provider) vedi `docs/deploy/RUNBOOK.md` e
> `docs/security/hardening-guide.md`.

---

## Porte

| Servizio | Porta |
|---|---|
| Dashboard staff (`apps/dashboard`) | 3000 |
| Server (`apps/server`, Fastify + Socket.io) | 3001 |
| Customer PWA (`apps/web`) | 3002 |
| PostgreSQL | 5432 |
| Redis | 6379 |

La UI staff definitiva è servita su `http://localhost:3000/staff`.

---

## Comandi

```bash
# Dalla root, avvia tutto
pnpm dev

# Solo server
cd apps/server && node_modules/.bin/tsx src/index.ts

# Solo dashboard
cd apps/dashboard && pnpm dev

# Solo customer PWA
cd apps/web && pnpm dev
```

---

## Prerequisiti
- PostgreSQL in ascolto su `localhost:5432` (solo localhost).
- Redis su `:6379`.
- `JWT_SECRET` impostata (obbligatoria, il server asserisce allo startup).
- Per le feature AI: `ANTHROPIC_API_KEY` (owner-assistant) e/o `GROQ_API_KEY` (AI cliente +
  insights). Se assenti, le feature AI degradano con 503 graceful; il resto del sistema funziona.

---

## App nativa (`apps/app`)
Thin-client Expo (mobile) / Tauri (desktop) che carica `http://<server>:3000/staff`.
Vedi `apps/app/CLAUDE.md` per build e run.

---

## Note operative
- Il core POS funziona **senza internet**; solo le feature AI richiedono rete.
- La dashboard blocca la porta 3000 dalla rete WiFi via firewall (Windows).
- PostgreSQL ascolta solo localhost.
- Verifica TypeScript prima di committare: `pnpm tsc --noEmit` dalla root.
