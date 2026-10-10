# Docker context: repository root. No native app build/install.
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter . --filter @tako/server... --filter @tako/web...
COPY packages/db packages/db
COPY packages/types packages/types
COPY apps/server apps/server
COPY apps/web apps/web
COPY apps/dashboard/public/staff apps/dashboard/public/staff
COPY scripts/web-render-entry.mjs scripts/web-render-entry.mjs
COPY scripts/build-staff-web.mjs scripts/build-staff-web.mjs
RUN node scripts/build-staff-web.mjs --out /app/staff-web
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
RUN pnpm --filter @tako/web build
# Standalone Next expects static/public beside its generated server.
RUN cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static && cp -r apps/web/public apps/web/.next/standalone/apps/web/public

FROM build AS runtime
ENV NODE_ENV=production TAKO_MODE=web EMBEDDED_DB=0 TAKO_HTTPS=0 TAKO_APP_ROOT=/app
EXPOSE 10000
CMD ["node", "scripts/web-render-entry.mjs"]
