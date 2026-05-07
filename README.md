# Tako — Restaurant OS

Self-hosted restaurant operating system: customers order from their phone via QR code, staff manages everything from a tablet dashboard, kitchen gets orders in real time.

## What it does

Customers scan a QR code on the table, open a PWA in their browser (no app install), browse the menu, and place orders directly. Orders flow in real time to the kitchen display and the staff dashboard. Staff handles table management, order tracking, billing, and payments from a single interface.

## Architecture

```
customer phone
     |
  (WiFi / LAN)
     |
  QR code --> web PWA (port 3002)
                  |
             API + Socket.io (port 3001)
                  |
           +------+-------+
           |              |
      PostgreSQL        Redis
      (port 5432)     (port 6379)

staff tablet --> dashboard (port 3000)
                      |
             API + Socket.io (port 3001)
```

### Apps and packages

| Name | Path | Description |
|---|---|---|
| `@tako/server` | `apps/server` | Fastify API + Socket.io real-time server |
| `@tako/dashboard` | `apps/dashboard` | Next.js 15 staff app (owner, waiter, cook, cashier) |
| `@tako/web` | `apps/web` | Next.js 15 customer-facing PWA, served over LAN |
| `@tako/db` | `packages/db` | Drizzle ORM schema + migrations for PostgreSQL |
| `@tako/types` | `packages/types` | Shared TypeScript types for Socket.io events and API |
| `@tako/ui` | `packages/ui` | Shared UI component library |

## Tech Stack

| Component | Tech | Default port |
|---|---|---|
| API server | Fastify 5, Socket.io 4 | 3001 |
| Staff dashboard | Next.js 15, React 19, Tailwind CSS | 3000 |
| Customer PWA | Next.js 15, React 19, Tailwind CSS | 3002 |
| Database | PostgreSQL 16 | 5432 |
| Cache / rate limiting | Redis 7 | 6379 |
| ORM | Drizzle ORM + drizzle-kit | — |
| Monorepo | Turborepo + pnpm workspaces | — |

## Prerequisites

- **Node.js** >= 20
- **pnpm** 9.x (`npm install -g pnpm@9`)
- **Docker** and **Docker Compose** (for PostgreSQL and Redis)
- **Git**

## Quick Start (local dev)

```bash
# 1. Clone the repo
git clone <repo-url> tako
cd tako

# 2. Copy and fill environment variables
cp .env.example .env

# 3. Generate a strong JWT secret and paste it into .env
openssl rand -hex 64

# 4. Start PostgreSQL and Redis
docker compose up -d postgres redis

# 5. Install dependencies
pnpm install

# 6. Run database migrations
pnpm db:migrate

# 7. Start all services in parallel
pnpm dev
```

> Note: `pnpm dev` uses Turborepo to start `apps/server`, `apps/dashboard`, and `apps/web` concurrently with file watching.

## Database Setup

Generate migration files from the schema (after changing `packages/db/src/schema`):

```bash
pnpm db:generate
```

Apply pending migrations to the database:

```bash
pnpm db:migrate
```

Open Drizzle Studio (visual DB browser):

```bash
pnpm db:studio
```

These commands delegate to `drizzle-kit` inside `@tako/db`. The root `package.json` scripts proxy them via `turbo --filter=@tako/db`.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values below. The server refuses to start if `JWT_SECRET` or `DATABASE_URL` are missing.

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Yes | — | Random secret for JWT signing. Generate with `openssl rand -hex 64`. |
| `DATABASE_URL` | Yes | `postgresql://tako:tako@localhost:5432/takodb` | PostgreSQL connection string. |
| `DASHBOARD_URL` | No | `http://localhost:3000` | Staff dashboard origin (used for CORS). |
| `CLIENT_BASE_URL` | No | `http://localhost:3002` | Customer PWA origin (used for CORS and QR code generation). |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string (rate limiting and caching). |
| `OPENAI_API_KEY` | No | — | Required only if the AI chat feature is enabled. |
| `UPLOADS_DIR` | No | `./uploads` | Directory for uploaded images. Use an absolute path in production. |
| `PORT` | No | `3001` | Port the API server listens on. |

## Development URLs

| Service | URL | Description |
|---|---|---|
| API server | http://localhost:3001 | Fastify REST + Socket.io |
| API health check | http://localhost:3001/health | Returns 200 when server is ready |
| Staff dashboard | http://localhost:3000 | Owner, waiter, cook, cashier views |
| Customer PWA | http://localhost:3002 | Menu + ordering interface |

> In a real restaurant deployment, `apps/web` binds to `0.0.0.0` (all interfaces) so customers on the same WiFi can reach it. The dashboard (`apps/dashboard`) should be restricted to localhost or an internal interface only.

## Project Structure

```
tako/
├── apps/
│   ├── server/          # Fastify API server
│   ├── dashboard/       # Next.js staff app
│   └── web/             # Next.js customer PWA
├── packages/
│   ├── db/              # Drizzle schema + migrations
│   ├── types/           # Shared TypeScript types
│   └── ui/              # Shared component library
├── docs/                # Additional documentation
├── .env.example         # Environment variable template
├── docker-compose.yml   # PostgreSQL + Redis (+ optional full-stack)
├── turbo.json           # Turborepo task configuration
├── package.json         # Root workspace scripts
└── CLAUDE.md            # Architecture notes and agent instructions
```

## Agent Workflow

Tako uses two files to coordinate work with autonomous agents:

**`BACKLOG.md`** — the task queue. Manuel writes tasks here ordered by priority (P0 first). Each task starts as `- [ ]` and is marked `- [x]` with a date when completed. Agents always pick the first uncompleted task in priority order, one task per run.

**`AGENT-LOG.md`** — the execution log. After completing (or getting blocked on) a task, agents append an entry here with the date, task title, what was done, and current status. If an agent is blocked (missing API key, unclear architectural decision), it writes `Stato: bloccato` with the reason and stops.

The full agent protocol is in `CLAUDE.md`.

## Security

See [SECURITY.md](./SECURITY.md) for the security policy, scope, and how to report vulnerabilities.

## License

MIT
