# Tako — Runbook di deploy (T14, bozza deploy-ready)

> Stato: **artefatti preparati, non ancora deployati**. Prodotti in sessione 2026-06-13.
> Il core (API + Postgres + Redis) è containerizzato; restano scelte di provider/dominio (tue)
> e 1 task di codice per attivare la RLS in prod (vedi §4).

---

## 1. Architettura di produzione

```
[ dashboard :3000 ]  [ web/PWA :3002 ]      ← 2 app Next (build separata, vedi §5)
          \                /
           → /api proxy →  [ server :3001 (Fastify, via tsx) ]
                                   |
                     [ Postgres 16 ]   [ Redis 7 ]   ← docker-compose.prod.yml
```
Il core gira **locale al ristorante** (mini-PC) o su un VPS. Solo le feature AI richiedono internet.

## 2. Prerequisiti
- Docker + Docker Compose sull'host.
- Un dominio (consigliati 2 sottodomini: `dashboard.` e `ordina.`) + TLS (reverse proxy: Caddy/Traefik/nginx).
- Segreti pronti (vedi `.env.production.example`): `JWT_SECRET`, `POSTGRES_PASSWORD`, `GROQ_API_KEY`, ecc.

## 3. Bring-up del core
```bash
cp .env.production.example .env.production   # compila i valori VERI (mai nel repo)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# Applica le migrazioni (idempotenti, vedi Epica T2):
docker compose -f docker-compose.prod.yml exec server pnpm --filter @tako/db db:migrate
```
Health: `curl http://localhost:3001/health` → `{"status":"ok"}`.

## 4. Attivare la RLS in produzione  ⚠️ (1 task di codice ancora aperto)
Oggi l'app si connette come superuser `tako` → **RLS bypassata** (in locale va bene). In prod si
passa al ruolo **non-superuser `tako_app`** (creato dalla migration `0002`) così la RLS isola i
tenant a livello DB. La readiness è **già provata**: `node packages/db/rls-check.mjs` (senza
contesto 0 righe; con contesto vede solo il proprio ristorante).

Procedura:
1. **[CODICE — TODO]** Aggiungere un preHandler globale che esegua ogni richiesta autenticata dentro
   `withRestaurantContext(restaurantId, …)` (`packages/db/src/rls.ts`, già pronto):
   - staff → `req.user.restaurantId`;
   - cliente → `restaurantId` dalla sessione tavolo (cookie `tako_table`).
   Senza questo, connettersi come `tako_app` fa tornare **0 righe** (la RLS nega tutto). È l'unico
   pezzo che resta del piano T9-A.
2. Imposta una password vera per `tako_app`:
   `ALTER ROLE tako_app PASSWORD '<forte>';`
3. Punta `DATABASE_URL` a `tako_app` (vedi `.env.production.example`) e riavvia il server.
4. Verifica con un test anti-leak (vedi Epica T9-B) che un tenant non veda i dati di un altro.

## 5. App Next (dashboard + web)
Le 2 app Next si buildano e servono separatamente (`next build && next start`), containerizzabili
con un Dockerfile analogo o su hosting serverless. Devono puntare il proxy `/api` al server prod
(`NEXT_PUBLIC_API_URL`) e girare **stesso sito** dei cookie (vedi §6).

## 6. Checklist sicurezza prod
- [ ] `NODE_ENV=production` → i cookie diventano `Secure` (già gestito in `lib/cookies.ts`).
- [ ] **Cookie cross-dominio:** `lib/cookies.ts` usa `SameSite=Lax`. Se dashboard/web e API stanno
      su **domini diversi** (cross-site), servirà `SameSite=None; Secure` → **modifica di codice**.
      Se sono sottodomini dello **stesso** dominio, `Lax` va bene.
- [ ] **Token CSRF** esplicito (oggi mitigato da SameSite + proxy same-origin) — consigliato in prod.
- [ ] Ruota tutti i segreti; `tako_app` con password forte (mai il placeholder della migration).
- [ ] CORS: `DASHBOARD_URL`/`CLIENT_BASE_URL` impostati ai domini reali.
- [ ] TLS ovunque (reverse proxy). DB/Redis mai esposti su rete pubblica (compose li lega a localhost).
- [ ] Backup automatici di Postgres (cron `pg_dump` o managed DB con snapshot).

## 7. Onboarding self-serve (stato)
`POST /api/auth/register` crea ristorante+owner e setta il cookie di sessione → un ristoratore può
registrarsi da solo. Mancano: wizard guidato end-to-end post-registrazione (esiste la sezione
onboarding in dashboard) e la doc utente (§8). Da rifinire prima dell'apertura pubblica.

## 8. Doc utente (da scrivere)
- Avvio sistema (accensione mini-PC / accesso dashboard).
- Generazione e stampa QR tavoli.
- Ruoli e PIN staff.
- Flusso cassa e chiusura conto.

## 9. TODO residui di T14
- [ ] Wiring `withRestaurantContext` per-route (§4.1) — sblocca RLS DB-enforced.
- [ ] Dockerfile/hosting per le 2 app Next (§5).
- [ ] `SameSite=None;Secure` se deploy cross-dominio (§6).
- [ ] Backup automatici + reverse proxy TLS.
- [ ] Doc utente (§8).
