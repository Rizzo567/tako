# Tako — Threat Model

> Last updated: 2026-05-07
> Methodology: STRIDE

---

## System Overview

```
                    ┌─────────────────────────────────────────────────────┐
                    │                   Internet                          │
                    └──────────┬──────────────┬──────────────┬────────────┘
                               │              │              │
                    ┌──────────▼──┐  ┌────────▼───┐  ┌──────▼──────────┐
                    │  Customer   │  │   Staff    │  │  Restaurant     │
                    │  PWA :3002  │  │  Dashboard │  │  Owner (web)    │
                    │  (web/PWA)  │  │  :3000     │  │                 │
                    └──────────┬──┘  └────────┬───┘  └──────┬──────────┘
                               │              │              │
                    ┌──────────▼──────────────▼──────────────▼────────────┐
                    │               Fastify API Server :3001               │
                    │         REST + Socket.io (WebSocket)                 │
                    └──────────┬──────────────────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
      ┌────────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
      │  PostgreSQL   │  │   Redis    │  │  File      │
      │  :5432        │  │  :6379     │  │  Storage   │
      └───────────────┘  └────────────┘  └────────────┘
```

---

## Actors

| Actor | Trust Level | Auth Mechanism |
|-------|-------------|----------------|
| Restaurant Owner | High | Email/password + Bearer token |
| Manager | High | Email/password + Bearer token |
| Waiter / Chef / Cashier | Medium | PIN (4 digit) + Bearer token |
| Customer | Low | QR token (unauthenticated) |
| Shared Tablet | Medium | PIN login |
| Anonymous Internet | Zero | None |

---

## Trust Boundaries

1. **Internet → API Server** — all traffic is untrusted at network level
2. **API Server → PostgreSQL** — trusted, same Docker network
3. **API Server → Redis** — trusted, same Docker network
4. **Authenticated Staff → API** — medium trust, scoped to `restaurantId`
5. **Customer → API** — zero trust, validated per-request by QR token scope

---

## Assets to Protect

| Asset | Sensitivity | Location |
|-------|------------|---------|
| Customer order data | Medium | PostgreSQL `orders` table |
| Financial data (bills, revenue) | High | PostgreSQL `bills` table |
| Staff credentials (passwords, PINs) | High | PostgreSQL `users.passwordHash`, `users.pin` |
| Session tokens | High | PostgreSQL `sessions.token` / client localStorage |
| Restaurant configuration | Medium | PostgreSQL `restaurants` table |
| Menu data | Low | PostgreSQL `menus`, `menu_items` |
| Uploaded images | Low | Filesystem `./uploads/` |
| API keys (OpenAI) | High | Environment variable `OPENAI_API_KEY` |
| JWT Secret | Critical | Environment variable `JWT_SECRET` |
| Database credentials | Critical | Environment variable `DATABASE_URL` |

---

## STRIDE Analysis

### Spoofing

| Threat | Target | Likelihood | Impact | Mitigation |
|--------|--------|-----------|--------|-----------|
| S1 | Token theft via XSS | Stored in localStorage | Medium | High | Planned: HttpOnly cookie migration |
| S2 | Session fixation | Bearer token | Low | High | Tokens are random 64-char nanoid, not predictable |
| S3 | PIN brute force | PIN login endpoint | Medium | Medium | 5-attempt lockout per IP/15min; bcrypt cost 10 |
| S4 | Tenant impersonation | Any authenticated endpoint | Low | Critical | `restaurantId` extracted from verified session, never from request body |

### Tampering

| Threat | Target | Likelihood | Impact | Mitigation |
|--------|--------|-----------|--------|-----------|
| T1 | Price tampering on customer orders | `POST /api/customer/orders` | Low | High | Prices always fetched from DB, never accepted from client |
| T2 | Cross-tenant order mutation (IDOR) | `PATCH /api/orders/:id/status` | Medium | High | Fixed 2026-05-07: `restaurantId` check on all mutations |
| T3 | Inventory manipulation via SQL injection | `POST /api/inventory/:id/movements` | Low (was High) | Critical | Fixed 2026-05-07: parameterized query |
| T4 | Menu mass assignment | `PATCH /api/menus/items/:id` | Medium | Medium | Fixed 2026-05-07: Zod schema on all PATCH endpoints |
| T5 | File upload with malicious payload | `POST /api/uploads/image` | Low (was High) | High | Fixed 2026-05-07: MIME whitelist, ext from MIME |

### Repudiation

| Threat | Target | Likelihood | Impact | Mitigation |
|--------|--------|-----------|--------|-----------|
| R1 | Staff denies status change | Order workflow | Low | Medium | `orderStatusHistory` table records `changedBy` user ID |
| R2 | No audit log for financial actions | Bills, payments | Medium | High | Partial: `closedBy` on bills. Gap: no append-only audit log |

### Information Disclosure

| Threat | Target | Likelihood | Impact | Mitigation |
|--------|--------|-----------|--------|-----------|
| I1 | Password hash exposure | `users.passwordHash` | Low | High | Staff list endpoint never returns `passwordHash` |
| I2 | Cross-tenant data leak | Any data endpoint | Low | Critical | Every query scoped with `restaurantId` from session |
| I3 | Error message leaks | Stack traces in 500 errors | Medium | Low | Fastify `logger: { level: 'error' }`, errors caught globally |
| I4 | Unauthenticated socket room | Real-time events | Low (was High) | High | Fixed 2026-05-07: `join:restaurant` requires valid token |
| I5 | Secret leak via git | `.env` committed | Low | Critical | `.gitignore` includes `.env`; `.env.example` has no real values |

### Denial of Service

| Threat | Target | Likelihood | Impact | Mitigation |
|--------|--------|-----------|--------|-----------|
| D1 | AI chat abuse | `POST /api/customer/ai-chat` | Medium | Medium | Zod: max 500 chars, max 10 history items; global rate limit 100/min |
| D2 | Large file upload | `POST /api/uploads/image` | Medium | Low | `@fastify/multipart` limits: 10MB max |
| D3 | Mass order submission | `POST /api/customer/orders` | Medium | Medium | Idempotency key; max 15 items per order; global rate limit |
| D4 | Password spraying | `POST /api/auth/login` | Medium | Medium | In-memory brute-force: 5 attempts/15min per IP |

### Elevation of Privilege

| Threat | Target | Likelihood | Impact | Mitigation |
|--------|--------|-----------|--------|-----------|
| E1 | Waiter promotes self to owner | `PATCH /api/staff/:userId` | Low | High | `requireRole('owner', 'manager')` on staff mutation endpoints |
| E2 | Customer accesses staff endpoints | Any `/api/` route with `requireAuth` | Low | High | `requireAuth` verifies session exists and is unexpired |
| E3 | Manager creates another owner | `POST /api/staff` | Low | Medium | Role enum in schema: `['manager', 'waiter', 'chef', 'cashier']` — owner cannot be created via this endpoint |

---

## Attack Surfaces Summary

| Surface | Exposure | Notes |
|---------|----------|-------|
| `POST /api/auth/login` | Public | Rate-limited, bcrypt compare |
| `POST /api/auth/pin-login` | Public | Rate-limited, bcrypt compare |
| `POST /api/auth/register` | Public | Email + slug uniqueness enforced |
| `GET /api/customer/table/:token` | Public | Token is 24-char nanoid |
| `GET /api/customer/restaurant/:id/menu` | Public | Read-only, no sensitive data |
| `POST /api/customer/orders` | Public | Price from DB, idempotency key required |
| `POST /api/customer/waiter-call` | Public | Rate limited; validated with Zod |
| `POST /api/customer/ai-chat` | Public | Validated, rate limited |
| All `/api/` staff routes | Auth required | Bearer token |
| Socket `join:restaurant` | Auth required | Token verified |
| Socket `join:table` | Public | Customer table tracking |

---

## Residual Risks (Open)

| ID | Risk | Priority | Tracking |
|----|------|----------|---------|
| RR-01 | Session token in localStorage (XSS exposure) | P2 | BACKLOG [SEC] Session token in HttpOnly cookie |
| RR-02 | Brute-force state lost on restart (in-memory) | P1 | BACKLOG [SEC] Fix PIN security — Redis-backed |
| RR-03 | DB/Redis ports exposed in docker-compose | P1 | BACKLOG [SEC] Rimuovere porte DB/Redis |
| RR-04 | CSP disabled in helmet config | P1 | BACKLOG [SEC] Abilita ContentSecurityPolicy |
| RR-05 | Customer routes fully unauthenticated | P1 | BACKLOG [SEC] Customer session via QR token |
| RR-06 | No append-only financial audit log | P2 | Not yet in BACKLOG |
| RR-07 | Drizzle RLS wired but never called | P2 | BACKLOG [SEC] Wiring RLS |
| RR-08 | `itemVariants` in menu loaded without tenant scope | P2 | Not yet patched |
