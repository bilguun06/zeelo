# syntax=docker/dockerfile:1.7
# Orgil API — multi-stage build from the monorepo root.
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages ./packages
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace @orgil/api --include-workspace-root --ignore-scripts \
 && npm run build -w @orgil/ui -w @orgil/shared -w @orgil/validation -w @orgil/financial-engine \
 && npx -w @orgil/api prisma generate

FROM deps AS build
COPY apps/api apps/api
RUN npm run build -w @orgil/api && npm prune --omit=dev --workspace @orgil/api --include-workspace-root

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl tini && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 orgil && mkdir -p /data/uploads && chown orgil /data/uploads
COPY --from=build --chown=orgil /repo/node_modules ./node_modules
COPY --from=build --chown=orgil /repo/packages ./packages
COPY --from=build --chown=orgil /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=orgil /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=orgil /repo/apps/api/package.json ./apps/api/package.json
USER orgil
WORKDIR /repo/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then start. (Run migrations as a separate release job in multi-replica deployments.)
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
