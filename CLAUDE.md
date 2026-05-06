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

---

## Istruzioni per agenti autonomi

Quando sei un agente che lavora su Tako in modo autonomo, segui questo protocollo:

### Loop standard

1. Leggi `BACKLOG.md` — prendi il **primo task non completato** in ordine di priorità (P0 prima)
2. Leggi il codice rilevante prima di modificare
3. Implementa il task
4. Verifica: `pnpm tsc --noEmit` dalla root — zero errori TypeScript prima di procedere
5. Committa con messaggio descrittivo
6. Aggiorna `BACKLOG.md`: sposta il task da `- [ ]` a `- [x]` con data
7. Aggiungi entry a `AGENT-LOG.md`

### Regole

- Un task per run. Non iniziare il secondo se il primo non è done.
- Se bloccato (API key mancante, decisione architetturale non chiara): scrivi in AGENT-LOG.md con `Stato: bloccato` e motivo, poi fermati.
- Non toccare `packages/db/schema` senza aver letto l'intera schema prima.
- Non fare `pnpm install` di nuove dipendenze senza motivo chiaro.
- Commit atomici: un commit per task, messaggio in italiano.
