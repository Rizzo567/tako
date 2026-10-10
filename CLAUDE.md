# Tako

## Cos'è

Tako = sistema operativo ristorante, come **webapp unica** (dal 2026-10-10 non esistono più app nativa né appliance locale). Staff usa la dashboard nel browser; clienti scansionano il QR del tavolo e ordinano dal telefono, niente app da scaricare.

Stack: Next.js + Fastify + Socket.io + PostgreSQL gestito (Supabase) + Supabase Storage. Serve internet.

## Chi usa

- **Ristoratore/owner**: dashboard gestione completa (menu, Aspetto, PDF/QR, staff, report)
- **Agenzia / menu_editor**: accesso per locale, solo editor menu
- **Cameriere**: vista sala, ordini, chiamate tavolo
- **Cuoco**: KDS cucina real-time
- **Cassiere**: cassa, conti, pagamenti
- **Cliente**: menu web da QR (consultazione, tavolo, asporto, prenotazione)

## Obiettivo finale

Sistema indispensabile. Ristoratore non torna più a carta e penna. Ordini vanno diretto in cucina senza cameriere. Cliente ordina da solo. Zero errori di comunicazione. Statistiche fanno capire cosa funziona. Staff lavora meglio, guadagna di più.

Tako non sostituisce l'ospitalità — la potenzia.

## Stack

- `apps/server` — Fastify + Socket.io + Drizzle ORM. `TAKO_MODE=web` = webapp (entry `src/bootstrap.ts`); `TAKO_MODE=cloud` = control-plane del sito takoitalia.com (entry `src/cloud/entry.ts`, deploy separato). Nessun altro modo è accettato.
- `apps/dashboard/public/staff` — SPA staff (script a globali), precompilata da `scripts/build-staff-web.mjs`
- `apps/web` — Next.js 15: menu cliente `/r/...`, tavolo, asporto, prenotazione, anteprima editor
- `packages/db` — schema PostgreSQL con Drizzle (migrazioni web e cloud)
- `packages/types` — tipi condivisi Socket.io + API
- `landing/` — sito pubblico; `deploy/render` — gateway e Dockerfile della webapp su Render

## Comandi avvio

```bash
# Webapp locale: staff http://localhost:5137/staff/ (API 5131, Next 5132 su loopback)
pnpm webapp          # legge .env.web (mai committare né stampare)

# Test
pnpm test            # Vitest; la suite webapp usa Postgres isolato (embedded-postgres solo nei test)
node --test tests/web/*.test.mjs deploy/render/gateway.test.mjs
pnpm --filter @tako/server test:cloud   # control-plane cloud
pnpm --filter @tako/server exec tsc --noEmit && pnpm --filter @tako/web exec tsc --noEmit
```

## Note architettura

- Real-time via Socket.io rooms: `restaurant:{id}` per staff, `table:{id}` per cliente
- Prezzi ordini sempre dal DB (mai dal client)
- Confine web in `apps/server/src/lib/web-runtime.ts`: origine pubblica unica, scritture solo dalla stessa origine, endpoint dell'ex appliance (`/internal`, `/api/setup`, `/api/print`, `/api/whatsapp`, PIN) → 404 `NOT_AVAILABLE_WEB`
- Mai scrivere sul Supabase remoto dai test (niente migrazioni/seed): usare DB isolati o il tenant QA
- Stato e verifiche della webapp: `docs/webapp/` (FEATURE-MATRIX, controls-parity/VERIFICATION, cleanup/REPORT)

---

## Istruzioni per agenti autonomi (routine remota / schedulata)

> Questo protocollo vale **solo** per la routine autonoma schedulata (un singolo agente che
> pesca un task dal backlog senza supervisione). **Non** vincola l'orchestratore del team
> multi-agente (vedi "## Team di agenti" sotto), che lavora più microtask in parallelo.

Quando sei un agente che lavora su Tako in modo autonomo, segui questo protocollo:

### Loop standard

1. Leggi `TAKO.md` (§5 "Da fare") — prendi il **primo task non completato** in ordine di priorità (P0 prima)
2. Leggi il codice rilevante prima di modificare
3. Implementa il task
4. Verifica: `tsc --noEmit` di server e web (vedi «Comandi avvio») — zero errori TypeScript prima di procedere
5. Committa con messaggio descrittivo
6. Aggiorna `TAKO.md` (§5): sposta il task da `- [ ]` a `- [x]` con data
7. Aggiungi entry a `.claude/comms/AGENT-LOG.md`

### Regole

- Un task per run. Non iniziare il secondo se il primo non è done.
- Se bloccato (API key mancante, decisione architetturale non chiara): scrivi in `.claude/comms/AGENT-LOG.md` con `Stato: bloccato` e motivo, poi fermati.
- Non toccare `packages/db/schema` senza aver letto l'intera schema prima.
- Non fare `pnpm install` di nuove dipendenze senza motivo chiaro.
- Commit atomici: un commit per task, messaggio in italiano.

---

## Team di agenti (claude-agent-team)

Tako ha installato il **team unificato** di 13 sottoagenti specialisti (architect, backend,
database, frontend, integrations, testing, devops, refactor, security-review, docs, planner,
verifier, ledger-writer — più `prompt-architect` come utility), allineato agli altri progetti.

- **Contratto madre:** `.claude/CLAUDE.md` governa orchestratore + sottoagenti (modelli per
  ruolo, Normal/Master mode, ownership file, regole di merge). Leggilo prima di orchestrare.
- **Bus a file:** `.claude/comms/` — `TASK_LEDGER.json` (stato microtask), `contracts/*.contract.md`
  (interfacce esposte), `handoffs/*.json` (passaggi), `AGENT-LOG.md` (log sessione). Ogni
  specialista legge i contratti rilevanti **prima** e scrive il proprio **dopo**.
- **Parallelismo:** microtask senza `depends_on` e su **file disgiunti** vanno in parallelo;
  overlap sullo stesso file → l'orchestratore **serializza**.
- **Modalità [MASTER]** (modifiche grosse/UI/architettura): Design → ⏸ gate (attendi OK di
  Manuel) → Foundation → Build → QA. Merge su main: **solo Manuel**.
- **Ownership Tako (monorepo):** frontend → `apps/web/src`, `apps/dashboard/public/staff`; backend →
  `apps/server/src/routes`, `apps/server/src/ai`, `apps/server/src/lib`; database →
  `packages/db`; integrations → `apps/server/src` (socket, provider esterni). Aggiorna §8 del
  contratto madre se cambiano.

> La regola "un task per run" sopra **non** si applica qui: è propria della sola routine remota.
