# Tako server — immagine di produzione.
# NB: @tako/db e @tako/types esportano TypeScript sorgente (niente build step),
# quindi il server gira con `tsx` anche in produzione (non `node dist/`).
# Build dal ROOT del monorepo:
#   docker build -f apps/server/Dockerfile -t tako-server .
FROM node:20-slim AS base
ENV NODE_ENV=production
RUN corepack enable
WORKDIR /app

# Manifesti workspace prima → layer di install cacheabile.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY apps/server/package.json ./apps/server/package.json

# Dipendenze del server + workspace che usa (tsx incluso: è il runtime in prod).
RUN pnpm install --frozen-lockfile --filter @tako/server...

# Codice sorgente (server + package workspace, consumati come .ts via tsx).
COPY packages/db ./packages/db
COPY packages/types ./packages/types
COPY apps/server ./apps/server

WORKDIR /app/apps/server
EXPOSE 3001
# Env iniettate dal container/orchestratore (NON usare --env-file in prod).
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
