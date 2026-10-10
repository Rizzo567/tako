# Hosted operational Tako — deployment candidate

This is TAKO_MODE=web, not the existing TAKO_MODE=cloud identity control plane.
The original staff SPA and customer Next app share one HTTPS origin. /api,
/socket.io and /uploads go directly to Fastify; customer /r routes go to Next.
Only the proxy exposes ports. Database and uploads require backups.

## Before launch

1. Supply a domain, DNS and managed PostgreSQL using a restricted application role.
2. Copy .env.example to an untracked secret file. Generate an independent JWT secret.
3. Create an isolated staging database and apply the operational migrations there.
   This template does not migrate or write any database automatically.
4. Restore a consistent backup of restaurant data and uploads into staging, verify
   logins (including cloud-paired owners lacking classic password hashes), tenant
   isolation, orders, bills, QR routes and realtime. Keep the native app intact.
5. Review the source and build both images. From this directory use:
   `docker compose --env-file /absolute/path/to/secrets.env config`
   then build. Start only after staging review and backup verification.
6. Make the final data cutover during a controlled write-free interval, verify
   restore/rollback and hosted flows, then retire the native installation.

## Constraints and explicit gaps

- Online-only: no LAN discovery, embedded PostgreSQL, tunnel or offline ordering.
  A server connectivity probe does not measure the customer's internet connection.
- LAN ESC/POS printing, shared PIN login/roster, appliance setup and WhatsApp are
  disabled in web mode. Printing needs browser printing or a separately designed
  remote printer integration. WhatsApp currently uses one global Baileys session,
  not a tenant-scoped provider. Local whisper dictation is disabled.
- All staff roles sign in with email/password. New web staff need at least 10
  characters; an owner can set a password for imported PIN-only staff via the
  tenant-scoped staff PATCH API. Password updates revoke existing sessions.
- Registration stays disabled until the hosted onboarding and email verification
  lifecycle have been reviewed. Existing imported staff accounts can sign in.
- One operational replica only: sessions are stored in PostgreSQL, but rate limits,
  Socket.io rooms and image quotas use process-local state. Redis adapters and
  durable shared limits are required before horizontal scaling.
- Persist and back up the uploads volume together with the database. Ephemeral
  containers without this volume lose menu photos. No object storage is configured.
- Staff currently uses inline/Babel scripts; CSP retains unsafe-inline/unsafe-eval.
  A precompiled frontend is required for a stricter production CSP.
- Browser writes must include the configured Origin; API automation needs an
  explicit allowed Origin as well as valid authentication. Cross-origin cookie
  writes are rejected. Proxy subnet is trusted; never publish the server port.
- Customer service-worker/offline UX and current local-first owner frontend need
  separate review before calling the whole product online-only.

No deployment, migration, native app deletion or live write was performed by
creating these files.
