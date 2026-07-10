# MASTER_PLAN.md — Migrazione auth a cookie HttpOnly (T3, microtask 1+4)

*Orchestratore (Opus 4.8) | 2026-06-13 | Tako | Revisione 1*

---

## 1. Panoramica
Spostare l'autenticazione da **token in localStorage + header Bearer** a **cookie HttpOnly**,
sia staff sia cliente, e introdurre un **JWT legato alla sessione tavolo** (emesso al resolve del
QR) che vincola le azioni del cliente al proprio tavolo. Chiude 2 P0 (token XSS-esposto;
waiter-call/ai-chat senza auth) e prepara il binding sicuro dei tool AI cliente.

## 2. Stato attuale
- **Staff:** login/pin → token opaco `nanoid` (tabella `sessions`) nel body JSON → client in
  `localStorage('tako_token')` → header `Authorization: Bearer`. `requireAuth` legge il Bearer.
- **Cliente:** `/customer/table/:token` non emette nulla; `waiter-call`/`ai-chat` **non autenticati**.
- **Proxy:** entrambe le app Next chiamano `/api` via rewrite verso `:3001` → dal **browser** è
  **same-origin** con l'app. ⇒ i cookie HttpOnly funzionano in modo pulito (niente attriti SameSite/CORS).
- `@fastify/cookie` **non installato**. CORS già `credentials:true` + origini esplicite.

## 3. Design

### 3a. Staff (cookie di sessione)
- Registrare `@fastify/cookie` in `index.ts` (firmato con `JWT_SECRET`).
- `auth.ts` login/register/pin → oltre (o invece) al body, **set cookie** `tako_session=<token opaco>`
  `HttpOnly; SameSite=Lax; Path=/; Max-Age=<scadenza sessione>; Secure(in prod)`.
- `middleware/auth.ts` `requireAuth`: legge il token da **`req.cookies.tako_session`**, con
  **fallback al Bearer** durante la transizione (così nulla si rompe a metà).
- Nuovo `POST /api/auth/logout`: cancella il cookie + elimina la riga `sessions`.

### 3b. Cliente (JWT legato al tavolo)
- `/customer/table/:token`: oltre ai dati, **firma un JWT** `{restaurantId, tableId, sessionId, exp:+4h}`
  (con `@fastify/jwt`, già registrato) e lo **set come cookie** `tako_table` `HttpOnly; SameSite=Lax;
  Path=/api/customer`.
- Nuovo preHandler `requireTableSession` su **`waiter-call`, `ai-chat`, `orders`**: verifica il JWT del
  cookie e che `restaurantId`/`tableId` combacino con la richiesta (lega l'azione al tavolo scansionato).

### 3c. Client
- `apps/web/lib/api.ts` e `apps/dashboard/lib/api.ts`: `withCredentials: true`.
- Dashboard: rimuovere la logica `localStorage`/Bearer (store: niente persist del token); logout →
  chiama `/api/auth/logout`. Cliente: nessuna gestione token (cookie automatico).

## 4. Sicurezza / note
- **SameSite=Lax** basta in locale e in prod **stesso dominio**; per prod **cross-dominio** servirà
  `SameSite=None; Secure` (documentato, non ora).
- **CSRF:** Lax + same-origin proxy mitiga; token CSRF esplicito = follow-up (non bloccante locale).
- `@fastify/cookie` è una **nuova dipendenza** (motivo chiaro: cookie auth). ⚠️ deroga alla regola
  "no nuove deps senza motivo".

## 5. File toccati
- **server:** `index.ts` (register cookie), `routes/auth.ts` (set/clear + logout), `middleware/auth.ts`
  (legge cookie + fallback), `routes/customer.ts` (mint+set JWT tavolo, `requireTableSession`).
- **web:** `lib/api.ts` (withCredentials).
- **dashboard:** `lib/api.ts` (withCredentials, via Bearer), `lib/store.ts` (stop persist token), pagina login (logout).

## 6. QA (prima di chiudere)
- Login staff → cookie settato, richiesta autenticata OK, logout svuota il cookie.
- Resolve QR → cookie `tako_table` settato; `waiter-call` con cookie = OK, **senza = 401**.
- `tsc` verde su server + dashboard + web. Login dashboard non regredito.

## 7. Microtask (build, dopo l'OK)
1. `pnpm add @fastify/cookie` + register in index.ts.
2. Staff: set/clear cookie in auth.ts + logout + requireAuth legge cookie (fallback Bearer).
3. Cliente: JWT al resolve + `requireTableSession` su waiter-call/ai-chat/orders.
4. Client: withCredentials (web+dashboard) + dashboard stop localStorage.
5. QA manuale + tsc; commit atomici per layer.
