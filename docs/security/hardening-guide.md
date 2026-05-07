# Tako — Production Hardening Guide

> This guide covers what must be done before deploying Tako to a production environment.
> Default values in `.env.example` and `docker-compose.yml` are intentionally insecure for local dev.

---

## 1. Environment Variables

### Required — server will refuse to start without these

```bash
# Generate with: openssl rand -hex 64
JWT_SECRET=<64-char random hex>

# PostgreSQL — change user/password from defaults
DATABASE_URL=postgresql://takouser:<strong-password>@db:5432/takodb
```

### Recommended

```bash
# Restrict API origins
DASHBOARD_URL=https://dashboard.yourdomain.com
CLIENT_BASE_URL=https://order.yourdomain.com

# OpenAI (only if AI chat feature is enabled)
OPENAI_API_KEY=sk-...

# Uploads directory (use a persistent volume path)
UPLOADS_DIR=/var/tako/uploads
```

### Secrets checklist before deploy

- [ ] `JWT_SECRET` is at least 64 chars, randomly generated, unique per environment
- [ ] `DATABASE_URL` contains a non-default username and a strong password
- [ ] `REDIS_URL` includes a password if Redis is exposed to a network
- [ ] No `.env` file is committed to git (verify with `git log -- .env`)
- [ ] `.env.example` contains no real values

---

## 2. Docker Compose — Production Overrides

The default `docker-compose.yml` exposes PostgreSQL (5432) and Redis (6379) to the host. In production, remove these bindings.

Create `docker-compose.prod.yml`:

```yaml
version: '3.9'

services:
  postgres:
    # Remove host port binding — only accessible within Docker network
    ports: !reset []
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # Must be set

  redis:
    # Remove host port binding
    ports: !reset []
    command: redis-server --requirepass ${REDIS_PASSWORD}

  server:
    environment:
      JWT_SECRET: ${JWT_SECRET}
      DATABASE_URL: postgresql://takouser:${POSTGRES_PASSWORD}@postgres:5432/takodb
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      DASHBOARD_URL: ${DASHBOARD_URL}
      CLIENT_BASE_URL: ${CLIENT_BASE_URL}
    # Do not publish port 3001 directly — put it behind a reverse proxy
    ports: !reset []

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - server
      - dashboard
      - web
```

Deploy with:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 3. TLS / HTTPS

All production traffic must be served over HTTPS.

### Option A — Nginx reverse proxy + Let's Encrypt

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://server:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

### Option B — Cloudflare Tunnel (simplest for early stage)

```bash
# No open ports needed — Cloudflare handles TLS termination
cloudflared tunnel --url http://localhost:3001
```

---

## 4. Content Security Policy

The server currently disables CSP (`contentSecurityPolicy: false` in helmet). Enable it in `apps/server/src/index.ts`:

```typescript
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
})
```

Test CSP violations in the browser console before deploying to production.

---

## 5. Database Security

### PostgreSQL

```sql
-- Create a dedicated user with minimal privileges (not superuser)
CREATE USER takouser WITH PASSWORD 'strong-random-password';
GRANT CONNECT ON DATABASE takodb TO takouser;
GRANT USAGE ON SCHEMA public TO takouser;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO takouser;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO takouser;

-- Revoke superuser from app user
REVOKE SUPERUSER FROM takouser;
```

### Backups

```bash
# Daily backup via cron
0 2 * * * pg_dump -U takouser takodb | gzip > /backups/tako-$(date +%Y%m%d).sql.gz

# Retain last 30 days
find /backups -name "tako-*.sql.gz" -mtime +30 -delete
```

### Row-Level Security (Planned)

The codebase includes `packages/db/src/rls.ts` with a `withRestaurantContext()` helper that sets `app.current_restaurant_id`. This is not yet wired to the Fastify auth middleware (tracked as BACKLOG [SEC] Wiring RLS). When enabled, it provides defense-in-depth: even if application-level `restaurantId` checks are bypassed, Postgres RLS will block cross-tenant queries.

---

## 6. Session Security

### Current state
- Session tokens are 64-char random strings (`nanoid(64)`), stored in `sessions` table
- Tokens expire after 30 days (password sessions) or 12 hours (PIN sessions)
- Frontend stores token in `localStorage`

### Production recommendation

Migrate session token storage to `HttpOnly` cookies:

**Server changes:**
```typescript
// In login response, set cookie instead of returning token in body
reply.setCookie('tako_session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
  maxAge: 30 * 24 * 60 * 60,
  path: '/',
})
```

**`requireAuth` middleware:**
```typescript
const token = req.cookies['tako_session'] ?? req.headers.authorization?.replace('Bearer ', '')
```

This eliminates the XSS attack surface for token theft.

---

## 7. Rate Limiting — Production Config

Current: 100 req/min globally. Tighten for sensitive endpoints:

```typescript
// In auth routes plugin
await instance.register(rateLimit, {
  max: 10,
  timeWindow: 60000,
  keyGenerator: (req) => req.ip,
})

// In customer AI chat
await instance.register(rateLimit, {
  max: 12,          // 1 req/5s average
  timeWindow: 60000,
  keyGenerator: (req) => (req.body as any)?.tableId ?? req.ip,
})
```

Move brute-force state to Redis so it survives server restarts:
```typescript
// Replace in-memory loginAttempts Map with Redis INCR + EXPIRE
await redis.incr(`brute:login:${ip}`)
await redis.expire(`brute:login:${ip}`, 900) // 15 min TTL
```

---

## 8. File Upload Security

Current state: MIME type whitelist active, extension derived from MIME.

Additional recommendation for production: re-encode uploaded images with `sharp` (already in dependencies) to strip any embedded payloads (steganography, EXIF with scripts):

```typescript
// In uploads.ts, after saving:
import sharp from 'sharp'

const sanitizedFilepath = filepath.replace(/\.[^.]+$/, '_safe.jpg')
await sharp(filepath)
  .jpeg({ quality: 85 })
  .toFile(sanitizedFilepath)
// Replace original with sanitized version
```

---

## 9. Monitoring & Alerting

### Health check endpoint
```bash
curl https://api.yourdomain.com/health
# Expected: { "status": "ok", "ts": "2026-..." }
```

### Recommended alerts

| Event | Alert |
|-------|-------|
| 5xx error rate > 1% | PagerDuty / email |
| Login failures > 20/min from single IP | Email |
| DB connection failures | PagerDuty |
| Disk > 80% (uploads volume) | Email |
| Server restart | Email |

### Application logging

Add structured logging for security events:

```typescript
// Log failed auth attempts
fastify.log.warn({ ip: req.ip, email }, 'Failed login attempt')

// Log privilege escalation attempts
fastify.log.warn({ userId: req.user?.id, requestedRole }, 'Forbidden: insufficient role')
```

---

## 10. Pre-Deploy Security Checklist

```
SECRETS
[ ] JWT_SECRET generated: openssl rand -hex 64
[ ] DATABASE_URL has non-default credentials
[ ] REDIS_URL has password if exposed
[ ] .env not committed to git

NETWORK
[ ] DB port 5432 not exposed to internet
[ ] Redis port 6379 not exposed to internet
[ ] All traffic behind HTTPS / TLS 1.2+
[ ] CORS origins set to actual production domains

APPLICATION
[ ] CSP header enabled and tested
[ ] Rate limits tuned for production load
[ ] Session token in HttpOnly cookie (or accepted risk logged)
[ ] Brute-force state in Redis (or accepted risk logged)
[ ] File upload: sharp re-encoding enabled

DATABASE
[ ] App DB user has no superuser privileges
[ ] Daily backups configured and tested
[ ] RLS wired to auth middleware (or accepted risk logged)

MONITORING
[ ] Health check endpoint reachable
[ ] Error alerting configured
[ ] Security event logging active
```
