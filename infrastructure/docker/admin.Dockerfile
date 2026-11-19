# syntax=docker/dockerfile:1.7
# Orgil admin dashboard (Next.js) — multi-stage build from the monorepo root.
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages ./packages
COPY apps/admin apps/admin
RUN npm ci --workspace @orgil/admin --include-workspace-root --ignore-scripts \
 && npm run build -w @orgil/ui -w @orgil/shared -w @orgil/validation -w @orgil/financial-engine \
 && npm run build -w @orgil/admin

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
RUN useradd --system --uid 10001 orgil
COPY --from=build --chown=orgil /repo /repo
USER orgil
WORKDIR /repo/apps/admin
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
