# API reference

Interactive OpenAPI docs: **http://localhost:4000/docs** (JSON: `/docs/openapi.json`; disabled when `NODE_ENV=production`).

Base URL `/api/v1`. JSON everywhere. **Money is a decimal string** (`"2000000.00"`). Errors:

```json
{ "statusCode": 422, "error": "UNPROCESSABLE_ENTITY", "message": "Amount must be between …", "code": "AMOUNT_OUT_OF_RANGE", "requestId": "…" }
```

Auth: customer endpoints use `Authorization: Bearer <accessToken>` (15 min JWT bound to a revocable session; refresh tokens rotate). Admin endpoints use a separate admin JWT (30 min) and per-route permissions.

## Customer

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/otp/request` | `{phone, purpose: REGISTER\|RESET_PASSWORD}` — 60 s cooldown, 5/hour. `devCode` only when `OTP_DEV_ECHO=true` (never in production) |
| POST | `/auth/otp/verify` | `{phone, purpose, code}` → `{verificationToken}` (5 attempts) |
| POST | `/auth/register` | `{verificationToken, password, deviceName?}` → tokens |
| POST | `/auth/login` | `{phone, password}` → tokens; 5 failures lock 15 min (HTTP 423) |
| POST | `/auth/refresh` | `{refreshToken}` → rotated tokens |
| POST | `/auth/password/reset` | `{verificationToken, password}` — revokes all sessions |
| POST | `/auth/password/change` | 🔒 `{currentPassword, newPassword}` — revokes other sessions |
| POST | `/auth/logout` | 🔒 |
| GET | `/me` | 🔒 profile, prefs, indicative credit limit |
| GET | `/me/dashboard` | 🔒 limit, active loans, next payment, recent transactions, open applications, 6-month overview |
| PUT | `/me/profile/personal` | 🔒 register number encrypted + blind-indexed; locked after KYC verification |
| PUT | `/me/profile/employment` | 🔒 |
| PATCH | `/me/settings` | 🔒 language, biometricEnabled, notificationPrefs |
| GET | `/me/banks` | 🔒 supported banks |
| GET/POST | `/me/bank-accounts` | 🔒 account numbers encrypted |
| POST | `/me/bank-accounts/:id/primary` · DELETE `/me/bank-accounts/:id` | 🔒 |
| GET · DELETE | `/me/sessions` · `/me/sessions/:id` | 🔒 device management |
| GET | `/kyc/status` | 🔒 |
| POST | `/kyc/documents` | 🔒 multipart `type` + `file` (JPEG/PNG/PDF by magic bytes, ≤ `MAX_UPLOAD_MB`, AES-GCM at rest) |
| POST | `/kyc/submit` | 🔒 → `PENDING` manual review |
| GET | `/products` · `/products/:id` | Only `ACTIVE` + `isAuthorized` products |
| POST | `/products/:id/quote` | `{amount, termMonths}` → full quote + schedule (`isDemonstration: true`) |
| POST | `/applications/preview` | 🔒 `{productId, amount, termMonths, bankAccountId}` → final quote + agreement `{body, contentHash}` |
| POST | `/applications` | 🔒 + `{contractHash, acceptTerms: true, consentDataProcessing: true}`; hash mismatch → 409 `CONTRACT_CHANGED` |
| GET | `/applications` · `/applications/:id` · `/applications/:id/contract` | 🔒 |
| POST | `/applications/:id/cancel` · `/applications/:id/respond` | 🔒 |
| GET | `/loans?status=active\|completed` · `/loans/:id` | 🔒 schedule, repayments, payoff amount |
| GET | `/repayments/:id` | 🔒 receipt data |
| GET | `/payments/providers` | which adapters are configured |
| POST | `/payments/intents` | 🔒 header `Idempotency-Key` (16–80 chars) · `{loanId, amount, provider}` |
| GET | `/payments/intents/:id` | 🔒 verifies with provider while pending |
| POST | `/payments/intents/:id/sandbox-confirm` | 🔒 **dev only**, sandbox provider, no real money |
| POST/GET | `/payments/callbacks/:provider?intent&sig` | provider webhook → server-side verification |
| GET | `/transactions?type&from&to&page` | 🔒 |
| GET | `/notifications` · POST `/notifications/:id/read` · POST `/notifications/read-all` | 🔒 |
| GET | `/documents/receipts/:id` · `/documents/contracts/:applicationId` | 🔒 PDF |
| GET | `/health` | liveness + DB check |

## Admin (`/admin/*`)

| Method | Path | Permission |
|---|---|---|
| POST | `/admin/auth/login` → `{mfaRequired, mfaToken}` or token | — |
| POST | `/admin/auth/mfa/verify` · `/mfa/setup` · `/mfa/enable` · GET `/auth/me` | — / 🔒 |
| GET | `/admin/overview` | reports.read |
| GET | `/admin/users?search&status&kyc` · `/admin/users/:id` | users.read (full register number only with kyc.review; audited) |
| PATCH | `/admin/users/:id/status` | users.write |
| POST | `/admin/users/:id/kyc` · GET `/admin/users/:id/documents/:docId` | kyc.review (audited) |
| GET | `/admin/applications?status=A,B&search` · `/admin/applications/:id` | applications.read |
| POST | `/admin/applications/:id/decision` `{action: APPROVE\|REJECT\|REQUEST_INFO, reason}` | applications.decide |
| POST | `/admin/applications/:id/notes` · `/rescore` | applications.read / decide |
| POST | `/admin/applications/:id/disburse` `{payoutReference}` | loans.disburse (approver ≠ disburser) |
| GET/POST/PUT | `/admin/products` · `/admin/products/:id` | products.read / write (engine dry-run validates config) |
| GET | `/admin/loans?status&search` · `/admin/loans/:id` (incl. ledger) | loans.read |
| POST | `/admin/loans/jobs/refresh-overdue` | loans.disburse |
| GET | `/admin/payments/reconciliation` · POST `/admin/payments/:id/refund` | loans.read / loans.disburse |
| GET | `/admin/reports/:type?from&to&granularity&format=json\|xlsx\|pdf` (`summary`, `disbursements`, `repayments`, `overdue`) | reports.read (+ reports.export for files) |
| GET/PUT | `/admin/notifications/templates[/:code]` | notifications.write |
| GET/POST | `/admin/notifications/announcements` · POST `/:id/send` · `/:id/cancel` | notifications.write |
| GET/POST/PATCH | `/admin/admins[/:id]` · GET/POST/PUT `/admin/roles[/:id]` · GET `/admin/permissions` | admins.manage |
| GET/PUT | `/admin/settings[/:key]` | settings.write |
| GET | `/admin/audit-logs?action&entityType&entityId&actorId&from&to` | audit.read |

## Rate limits
Global 120 req/min/IP; OTP request 5/min, OTP verify 10/min, login 10/min (plus per-phone OTP limits in Redis). Callbacks are exempt.
