# 05 — Rate limiting (app-level + targeted)

**What to build:** add `express-rate-limit` so brute-force, webhook hammering, upload floods, and checkout abuse are bounded.

**Blocked by:** none (01 recommended first so `FRONTEND_URL`/env assumptions are solid)

**Status:** ready-for-agent

## Scope

- Add `express-rate-limit` dependency (only new dep).
- Global: `app.use` limiter ~300 req/min per IP; `app.set('trust proxy', 1)` (Railway/behind proxy) — do NOT trust proxies blindly; align with Railway's header behavior.
- Targeted (per-route stricter):
  - `POST /bookings/checkout` — 10/min.
  - `POST /bookings/:id/cancel` — 10/min.
  - `POST /payhere/notify` (webhook) — 60/min per IP (per-IP only; no auth to count on).
  - Uploads — 30/min/IP.
  - OTP: keep DB-level caps (5/hr per phone+user, 60s resend) — they cannot be bypassed by reconnects; optionally add a cheap IP limiter in front.
- Admin routes — 120/min.
- Respond `429` with a `Retry-After` rather than a generic 500; structured error code `RATE_LIMITED`.
- Exempt none by default; Socket.io connection endpoint unaffected by the HTTP limiter (it uses its own path).
- Tune numbers after launch; record the guesses in a comment.

## Verification

- Vitest + supertest: burst past a targeted limit → `429`; global limiter trips only after the configured count; webhook path independently limited.
- Confirm normal flows (checkout, OTP send, uploads) pass under limits.

## Done criteria

- [ ] `express-rate-limit` wired: global + targeted limits above.
- [ ] `429 RATE_LIMITED` with `Retry-After` on trip.
- [ ] Full suite still green (limit keys reset between tests — use `keyGenerator`/disable in test or reset).
- [ ] Railway `trust proxy` correct.