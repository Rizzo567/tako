# Build from the repository root. No desktop/native bundles are built.
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/menu-ops/package.json packages/menu-ops/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @tako/server... --filter @tako/web...
COPY packages/db packages/db
COPY packages/types packages/types
COPY packages/menu-ops packages/menu-ops
COPY apps/server apps/server
COPY apps/web apps/web
# Staff is the original SPA, copied unchanged.
COPY apps/dashboard/public/staff apps/dashboard/public/staff
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=http://server:3001
RUN pnpm --filter @tako/web build

FROM build AS server
ENV NODE_ENV=production
WORKDIR /app/apps/server
CMD ["pnpm", "exec", "tsx", "src/bootstrap.ts"]

FROM node:22-bookworm-slim AS customer
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3002 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
CMD ["node", "apps/web/server.js"]
