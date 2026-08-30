# Sports Arena Booking - Backend

Express.js API for the sports venue booking marketplace (MySlot.LK).

## Tech Stack

- Express.js
- PostgreSQL (Supabase in pre-prod) via `pg`
- Firebase Admin SDK (identity verification)
- PayHere (sandbox payments)
- Resend (email notifications)
- Vitest + Supertest (integration tests)

## Local Development

1. **Install dependencies:** `npm install`
2. **Database:** create a local Postgres DB: `createdb sports_dev`
3. **Configure environment:** `cp .env.example .env` and fill in values
4. **Migrate + seed:** `npm run db:setup` (DATABASE_URL required)
5. **Run:** `npm run dev` → http://localhost:2400

## Scripts

| Script | What it does |
| ------ | ------------ |
| `npm run migrate` | Apply `migrations/*.sql` in order (tracked in `schema_migrations`) |
| `npm run seed` | Idempotent seed: 18 sports, venues, courts, demo accounts, events |
| `npm test` | Full integration suite (Vitest + Supertest against a throwaway test DB) |

## Environment Variables

See `.env.example`. Key variables: `DATABASE_URL`, `GOOGLE_APPLICATION_CREDENTIALS`
(Firebase service account path), `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`,
`PAYHERE_AUTHORIZATION` (for refunds), `PAYHERE_NOTIFY_URL`,
`RESEND_API_KEY`, `FROM_EMAIL`, `FRONTEND_URL`, `JWT_SECRET` (test tokens only),
`FCM_ENABLED` (optional).

## Secrets (Google Secret Manager, ADR-0047)

The **platform secrets** — platform PayHere keys, Mailgun, SMSGo, OTP HMAC,
Supabase service-role key, Firebase service account — stay in the deployment env
(`.env` locally, Railway env vars), unchanged.

The **per-Business PayHere credentials** a Venue Owner supplies for their own
gateway (merchant secret, app secret) live in **GCP Secret Manager**
(`myslot-preprod`): one secret per Business named `business-payhere-<businessId>`,
payload the four PayHere fields as JSON. The DB keeps only the non-secret IDs
(`merchant_id`, `app_id`), so no credential material ever rides in Postgres,
backups, or test copies.

- Enabled by `SECRET_MANAGER_CREDENTIALS` (base64 or raw service-account JSON).
  Deliberately its **own** var — `GOOGLE_APPLICATION_CREDENTIALS` is consumed by
  firebase-admin. Project id from `SECRET_MANAGER_PROJECT` (default
  `myslot-preprod`).
- Saving credentials adds a new secret version (rotation without redeploy);
  "remove keys" deletes the secret. The owner save/remove endpoints refuse to
  run without `SECRET_MANAGER_CREDENTIALS`.
- Without `SECRET_MANAGER_CREDENTIALS` (local dev, tests) credential resolution
  falls back to the platform env PayHere keys — checkout and webhook tests run
  against those, and production never takes this path.
- Credentials resolve through a 5-minute in-memory cache (invalidated on owner
  save/remove) so IPN verification and checkout signing never block on GSM per
  request; a GSM outage fails the request closed.

## Booking Engine

Availability is server-authoritative and derived from venue hours, blocks, holds, and
bookings. A Postgres exclusion constraint on `bookings` makes double-booking impossible.
Checkout creates a 10-minute hold (configurable); the PayHere webhook
(`POST /api/v1/payments/payhere/notify`, HMAC-verified, idempotent by order id) converts
the hold to a confirmed booking on success or releases it on failure. Cancellation refund
tiers come from `platform_config`. Money is integer LKR.

## Pre-prod Deployment (Railway)

`railway.toml` is configured. Deploy with all env vars set; run `npm run db:setup` against
the Supabase pre-prod DB once.

**Smoke checklist:** player signup → book → pay → QR; owner login → calendar → check-in;
admin login → approve venue → refund.

## Test Accounts (seeded)

| Email | Role | Firebase UID |
| ----- | ---- | ------------ |
| admin@spots.lk | admin | demo-admin-uid |
| owner@spots.lk | venue_owner | demo-owner-uid |
| player@spots.lk | player | demo-player-uid |

Note: Firebase Auth accounts must be created with matching UIDs, or use the test-token
mode (`NODE_ENV=test`, `JWT_SECRET`).
