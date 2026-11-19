# Security & compliance

> This document describes technical controls. It is **not** a statement of regulatory compliance. Before launch the provider must complete a legal and technical assessment covering, at minimum, Mongolian personal-data protection law, the Law on Non-Bank Financial Activities and Financial Regulatory Commission (FRC) requirements, Mongolbank credit-information rules, consumer-protection and lending-disclosure obligations, electronic-signature/transactions law, and AML/CFT obligations.

## Implemented controls

| Area | Control | Where |
|---|---|---|
| Transport | TLS 1.2+/HSTS at nginx; Helmet headers; admin security headers | `infrastructure/deployment/nginx.conf`, `apps/api/src/main.ts`, `apps/admin/next.config.mjs` |
| Passwords | scrypt (N=16384, r=8, p=1, 16-byte salt), timing-safe compare, equalised timing for unknown users | `common/crypto.service.ts` |
| Customer auth | OTP (6 digits, 5 min, 5 attempts, cooldown + hourly cap), 15-min access JWT bound to a server session, rotating refresh tokens (hash-stored), lockout after 5 failures, session list & remote revoke | `modules/auth`, `common/auth.ts` |
| Biometrics | Face ID/fingerprint gates resuming the keystore-held session on-device (never sent to server) | `apps/mobile/src/lib/auth.tsx` |
| Token storage | Mobile: refresh token in iOS Keychain / Android Keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), access token in memory. Admin: httpOnly, `SameSite=Strict`, `Secure` cookie; browser never sees the JWT; same-origin proxy with Origin check (CSRF) | `apps/mobile/src/lib/storage.ts`, `apps/admin/src/app/api/*` |
| Admin auth | Separate signing secret, 30-min tokens, TOTP MFA, 30-min lockout, strong-password policy | `modules/admin/admin-auth.controller.ts` |
| Authorization | RBAC with 15 granular permissions; principal re-read every 60 s so revocations apply quickly; four-eyes: approver cannot disburse; KYC gate on approval | `common/auth.ts`, `admin-applications.controller.ts` |
| Data at rest | AES-256-GCM for register numbers, account numbers, MFA secrets, KYC files; HMAC blind indexes for lookup; PII shown masked; full register number only for `kyc.review` and audited | `common/crypto.service.ts`, `modules/kyc/storage.service.ts` |
| Input | Global `ValidationPipe` (whitelist + forbidNonWhitelisted), DTO regexes, JSON body limit 256 KB, uploads verified by magic bytes with size limits and random storage keys | `main.ts`, DTOs |
| Money integrity | Decimal-only arithmetic, serializable transactions, optimistic locking, balanced-journal enforcement, idempotency keys, compare-and-set settlement, provider verification instead of trusting callbacks, overpayment rejection | `financial-engine`, `loans/*`, `payments/*` |
| Abuse | Global and per-route throttling; Redis counters per phone; nginx rate limits | `app.module.ts`, `auth.service.ts` |
| Audit | Append-only audit log for auth, profile, KYC, decisions (incl. AI override flag), disbursement, payments, settings, RBAC; secrets/PII redacted; request ids | `common/audit.service.ts` |
| Errors | Uniform envelope, no stack traces/SQL to clients | `common/http-exception.filter.ts` |
| Dev safety rails | `OTP_DEV_ECHO` and sandbox payments are force-disabled when `NODE_ENV=production`; Swagger disabled in production; Redis required in production | `config/env.ts` |
| Backups | Encrypted (GPG) `pg_dump` with retention; keys stored separately | `infrastructure/database/backup.sh` |

## Before production — required work
1. **Secrets** in a secret manager (KMS/Vault); rotate `JWT_*`, `HMAC_KEY`; plan `ENCRYPTION_KEY` rotation (re-encrypt job).
2. **Integrations**: contracted SMS gateway, QPay merchant certification in sandbox, bank payout API, credit bureau (with consent flow), state registry/e-Mongolia identity verification, liveness check for selfies.
3. **Policy values** in `system_settings` and product pricing reviewed by risk/legal (DTI cap, penalty cap, limits, rates, fees, disclosures).
4. **Credit model** validation (back-testing, bias testing, monitoring) and risk-committee approval; adverse-action reason wording.
5. **Contract template** wording from legal counsel; e-signature method acceptable under applicable law.
6. **Pen test** + dependency scanning in CI; mobile hardening (certificate pinning, jailbreak/root signals, screenshot protection on sensitive screens).
7. **Data protection**: retention schedule, data-subject request process, DPIA, processor agreements, breach procedure.
8. **Observability**: centralized logs (no PII), metrics, alerting on payment sweeps, reconciliation mismatches, job failures.
9. **Accrual accounting** for interest if statutory reports require it.
