# Оргил · Orgil — digital lending platform

A digital lending platform for the Mongolian market, with three parts:

- **Mobile app** (Expo / React Native): Mongolian by default, English ready, light and dark themes.
- **Admin console** (Next.js).
- **API** (NestJS + PostgreSQL).

The apps share one design system and one decimal-only financial engine.

> All pricing (rates, fees, limits, terms) is configured by the lender in the admin console. Seeded values are **demo placeholders**. The credit bureau is **simulated**, SMS is **mocked** and the sandbox payment provider **never moves real money**. See [documentation/security](documentation/security/README.md) for what must happen before production.

## Project structure

```
apps/
  api/        NestJS API · Prisma schema, migrations, seed · jobs · tests (unit + e2e smoke)
  admin/      Next.js 14 admin console (Tailwind, shadcn-style components, Recharts)
  mobile/     Expo SDK 52 app (Expo Router, NativeWind v4, TanStack Query, Lucide)
packages/
  financial-engine/  schedules, quotes, APR (IRR), payoff, allocation, penalties — decimal.js, unit-tested
  shared/            enums, API types, formatting, MN/EN dictionaries
  validation/        zod schemas shared by clients
  ui/                design tokens + Tailwind preset
infrastructure/
  docker/      docker-compose (postgres, redis, api, admin) + Dockerfiles
  deployment/  nginx TLS reverse proxy
  database/    encrypted backup script
documentation/ architecture · api · database · security
```

## Prerequisites
- Node.js ≥ 20.11 (tested on 24), npm ≥ 10
- PostgreSQL 16 and Redis 7. The easiest way to get both is Docker (`npm run infra:up`). Redis is optional in development, where an in-memory fallback is used.
- For the mobile app: Expo Go on a phone, or an Android emulator / iOS simulator

## Installation & local development

```bash
npm install                                  # installs all workspaces, builds shared packages, generates Prisma client
npm run infra:up                             # postgres :5432 + redis :6379 (Docker)

cp apps/api/.env.example apps/api/.env       # then generate real secrets (command inside the file)
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env

npm run db:migrate                           # apply migrations
npm run db:seed                              # roles, staff, products, demo customers & loan history

npm run dev:api                              # http://localhost:4000   (Swagger: /docs)
npm run dev:admin                            # http://localhost:3000
npm run dev:mobile                           # Expo — press i / a, or scan QR with Expo Go
```

On a physical phone, set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:4000` and add that origin to the API's `CORS_ORIGINS` (CORS only matters for web).

### Demo accounts (seed)
| App | Login | Password |
|---|---|---|
| Mobile | `99112233` (also 88223344, 95334455, 80445566, 99887766) | `Demo1234` |
| Admin – super admin | `admin@orgil.local` | `ChangeMe!2026` (`SEED_ADMIN_PASSWORD`) |
| Admin – credit officer / finance / support / auditor | `officer@` / `finance@` / `support@` / `auditor@orgil.local` | same |

To register a new mobile user in development, the OTP is shown on screen and in the API log (`OTP_DEV_ECHO=true`).

## Commands

| Command | What it does |
|---|---|
| `npm test` | Financial-engine unit tests (9) + credit-scoring tests (5) |
| `npm -w @orgil/api run smoke` | End-to-end lifecycle against a running, seeded API (`API_URL=…`) |
| `npm run typecheck` | Type-check every workspace |
| `npm run build:packages` | Rebuild shared packages after editing them |
| `npm run db:studio` | Prisma Studio |
| `npm -w @orgil/mobile run export:web` | Static web build of the mobile app (preview) |
| `npm run infra:down` | Stop local infrastructure |

## Environment variables
- `apps/api/.env.example`: database, Redis, JWT and admin secrets, the `ENCRYPTION_KEY` (32 bytes, base64), `HMAC_KEY`, token TTLs, OTP dev echo, uploads, payment sandbox, webhook secret, QPay and SocialPay credentials, and seed admin.
- `apps/admin/.env.example`: `API_URL`. This is server-side only; the browser talks to the same-origin proxy.
- `apps/mobile/.env.example`: `EXPO_PUBLIC_API_URL`. This is public, so never put secrets in it.

## Deployment
1. Build images: `docker compose -f infrastructure/docker/docker-compose.yml --profile app build`. Or build `infrastructure/docker/api.Dockerfile` and `admin.Dockerfile` in CI and push them to your registry.
2. Provision managed PostgreSQL 16 (UTF-8) and Redis, then put secrets in a secret manager. Set `NODE_ENV=production`; this force-disables OTP echo, sandbox payments and Swagger, and requires Redis.
3. Run migrations as a release step: `npx prisma migrate deploy` (in the API image). Seed only roles, permissions and settings, or create staff manually.
4. Put nginx (or a cloud load balancer) with TLS in front. See `infrastructure/deployment/nginx.conf`. Restrict the admin host to VPN or office IPs.
5. Schedule `infrastructure/database/backup.sh`, and back up the uploads volume separately from `ENCRYPTION_KEY`.
6. Build the mobile app with EAS (`eas build -p android|ios`) with `EXPO_PUBLIC_API_URL=https://api.your-domain`.
7. Scheduled jobs (overdue/penalties 00:05, reminders 10:00 Asia/Ulaanbaatar, payment sweep every 5 min, announcements every minute) run inside the API with Redis locks, so it is safe to run several replicas.

## Documentation
- [Architecture & flows](documentation/architecture/README.md)
- [API reference](documentation/api/README.md) (plus live OpenAPI at `/docs`)
- [Database](documentation/database/README.md)
- [Security & compliance](documentation/security/README.md)
