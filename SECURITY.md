# Security Policy

## Scope

This policy covers the Tako platform:
- `apps/server` — Fastify REST API + Socket.io
- `apps/dashboard` — Staff management Next.js app
- `apps/web` — Customer-facing PWA
- `packages/db` — Drizzle ORM schema and migrations

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` branch | Yes |
| Older branches | No |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report via email: **manuelrizzo474@gmail.com**

Include in your report:
1. Description of the vulnerability
2. Steps to reproduce
3. Affected component (server route, frontend, DB schema)
4. Potential impact assessment
5. (Optional) Suggested fix

**Response SLA:**
- Acknowledgement within 48 hours
- Triage and severity assessment within 5 business days
- Fix timeline communicated within 10 business days

## Security Model

### Authentication
- Staff authenticate via Bearer token (opaque, 64-char random, stored in `sessions` table with expiry)
- Tablets/shared devices use 4-digit PIN (bcrypt-hashed) with 12h session tokens
- Customers are unauthenticated — they interact via QR token scoped to a single table

### Multi-tenancy
- Every authenticated request is scoped to `req.user.restaurantId`
- All DB queries on authenticated routes include `eq(table.restaurantId, req.user.restaurantId)`
- Customers can only access data for the restaurant whose QR token they scanned

### Rate Limiting
- Global: 100 req/min per IP (Fastify rate-limit)
- Login brute-force: 5 attempts per IP per 15 minutes (in-memory, moves to Redis in a future release)

### Input Validation
- All request bodies validated with Zod before touching the DB
- File uploads: MIME type whitelist + extension derived from MIME, not filename

## Known Limitations (Accepted Risk)

| Item | Risk | Mitigation |
|------|------|-----------|
| Session token in localStorage | XSS can steal token | Planned: migrate to HttpOnly cookie (BACKLOG P2) |
| In-memory brute-force tracker | Resets on server restart | Planned: Redis-backed (BACKLOG P1) |
| DB ports exposed in docker-compose dev | Local dev only | Production deploy must remove port bindings |
| CSP disabled | Reduces XSS protection surface | Planned: strict CSP header (BACKLOG P1) |
| Customer routes unauthenticated | Waiter-call/AI-chat spammable | Rate limiting active; customer session token planned |

## Security Changelog

| Date | Severity | Fix |
|------|----------|-----|
| 2026-05-07 | Critical | SQL injection in `inventory.ts` — replaced raw string interpolation with Drizzle `sql` template |
| 2026-05-07 | High | IDOR on `orders.ts` status/cancel endpoints — added `restaurantId` scope to all mutations |
| 2026-05-07 | High | IDOR on `bills.ts` payment endpoint — added tenant ownership check |
| 2026-05-07 | High | Socket.io unauthenticated room join — `join:restaurant` now requires valid session token |
| 2026-05-07 | High | File upload MIME bypass — whitelist + extension derived from MIME magic bytes |
| 2026-05-07 | Medium | PIN stored in plaintext — bcrypt-hashed at creation, verified with `bcrypt.compare` |
| 2026-05-07 | Medium | JWT_SECRET insecure default — server throws on startup if env var is missing |
| 2026-05-07 | Medium | Socket.io CORS `origin: '*'` — restricted to known origins |
| 2026-05-07 | Medium | Mass assignment on menu PATCH — Zod schema on all PATCH endpoints |
| 2026-05-07 | Low | Missing Zod on status PATCH endpoints — replaced type casts with schema validation |
