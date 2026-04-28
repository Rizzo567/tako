# Tako

## Cos'è

Tako = sistema operativo ristorante. App web locale gira su mini PC nel ristorante. Staff usa dashboard su tablet. Clienti scansionano QR tavolo, ordinano da telefono, niente app da scaricare.

Stack: Next.js + Fastify + Socket.io + PostgreSQL. Tutto locale, funziona senza internet.

## Chi usa

- **Ristoratore/owner**: dashboard gestione completa
- **Cameriere**: vista sala, ordini, chiamate tavolo
- **Cuoco**: KDS cucina real-time
- **Cassiere**: cassa, conti, pagamenti
- **Cliente**: menu PWA da QR, ordina, traccia, paga

## Obiettivo finale

Sistema indispensabile. Ristoratore non torna più a carta e penna. Ordini vanno diretto in cucina senza cameriere. Cliente ordina da solo. Zero errori di comunicazione. Statistiche fanno capire cosa funziona. Staff lavora meglio, guadagna di più.

Tako non sostituisce l'ospitalità — la potenzia.

## Stack

- `apps/server` — Fastify + Socket.io + Drizzle ORM
- `apps/dashboard` — Next.js 15 staff app (porta 3000)
- `apps/web` — Next.js 15 customer PWA (porta 3002)
- `packages/db` — schema PostgreSQL con Drizzle
- `packages/types` — tipi condivisi Socket.io + API

## Comandi avvio

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

## Note architettura

- Real-time via Socket.io rooms: `restaurant:{id}` per staff, `table:{id}` per cliente
- Prezzi ordini sempre dal DB (mai dal client)
- Dashboard blocca porta 3000 da rete WiFi via firewall Windows
- PostgreSQL ascolta solo localhost
