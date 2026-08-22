# Backend Security Hardening

Status: ready-for-agent

## Problem Statement

A full audit of `sp_be` (Express + Postgres + Firebase Auth + Socket.io) found the API is well-behaved in the core (parameterized SQL everywhere, no client-side price trust for online bookings, HMAC-verified PayHere webhooks with idempotent confirmation) but carries real gaps:

- **Forgeable payments if env is misconfigured** — PayHere secret falls back to a public test string (`paymentController.js:9,14`, `utils/payhere.js:3-5`).
- **A dead-but-dangerous legacy auth stack** mints self-issued JWTs with `role` in the payload, signed with a known fallback secret (`controller/adminController.js:134-142`, `controller/userController.js:138-146`, `middleware/authMiddleware.js`, `middleware/userMiddleware.js`) — not mounted today, a total-takeover landmine if ever wired up.
- **Ban/suspension not enforced on player routes**: `authenticate` (`middleware/authenticate.js:48-68`) never checks `users.is_suspended` / `status='banned'`; only `requireRole` does, and it is only mounted on admin/business routers (`app.js:47-56`).
- **Cross-tenant booking read**: `GET /bookings/:id` lets *any* `venue_owner` read *any* booking including player name, phone, and the secret `qr_token` (`bookingController.js:268-270`).
- **OTP codes and request bodies written to logs** (`middleware/requestLogger.js` masks only `password`), **OTP generated with `Math.random()`** and stored as unsalted `sha256` (`verifyPhoneController.js:48, 12-14`).
- **No rate limiting anywhere** except DB-level OTP caps; a player can **hold unlimited Slots** for free (`bookingController.js:150-158, 194-199`) → availability DoS / squatting.
- **No security headers** (no helmet), CORS falls back to `*` + credentials when `FRONTEND_URL` is missing (`app.js:30-36`, `realtime.js:14`).
- **Uploads broken + unsafe**: `express.json()` 100KB cap makes every realistic image 500 (`app.js:27` vs 8MB claim in `routes/uploads.js`); no magic-byte check (sniffable HTML payloads).
- **Email XSS**: `utils/emailService.js` interpolates raw user strings into HTML templates.
- **Host-header trust**: `utils/tokens.js` `requestBaseUrl` builds PayHere return/notify URLs from the request `Host` header.

Decided (grilled with user, see Comments): harden all of it in one pass, Firebase-ID-token-only auth stays (no server sessions — leaked tokens live ≤1h, that's accepted), the legacy JWT stack is **deleted**, secrets are **fail-closed at boot**, and the QR Token disclosure contract is tightened: a Token is never exposed through read/list APIs to anyone except its own Player, and only the owning Venue's Owner may consume it at check-in.

## Solution

### Auth & identity (`sp_be`)

- **Delete the legacy stack** — `routes/admin.js`, `routes/user.js`, `middleware/authMiddleware.js`, `middleware/userMiddleware.js`, and the JWT-minting controllers (`adminController.js`, `userController.js`, `yardController.js` if unused) are dead code and get removed; no custom JWT is ever minted or trusted again. Tests referencing them are removed too.
- **Fail-closed secrets**: at boot (non-`test` env), `config/env.js` (or `app.js`) refuses to start if any required secret is missing: `DATABASE_URL`, `FRONTEND_URL`, `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `GOOGLE_APPLICATION_CREDENTIALS`/`FIREBASE_SERVICE_ACCOUNT`, `MAILGUN_API_KEY`, `SMSGO_API_KEY`, and any `JWT_SECRET` fallback. Remove all `|| 'public-fallback'` defaults in `paymentController.js`, `utils/payhere.js`, `middleware/authenticate.js` (test-path secret may stay but only under `NODE_ENV=test`).
- **Player ban/suspension**: `authenticate` loads the user with `is_suspended`, `status` and blocks the request (`403 ACCOUNT_SUSPENDED` / `ACCOUNT_BANNED`). Every player route inherits it; no per-route changes needed.
- **No server session tokens** — Firebase ID tokens remain the only credential (ADR-0014). Out of scope: revocation, refresh, logout.

### Authorization & QR contract

- `GET /bookings/:id` authorization: only the booking's Player, an Admin, or the Owner of the venue the booking is on (`bookings.venue_id` joined against owner venues). Response shape: `qr_token` is **only** included when `req.user.id === booking.user_id` (own booking). Never present in list payloads.
- Check-in already validates venue ownership (`businessController.js:357-360`); keep — scan validates venue *and* token.
- Player Suspension: reversible admin action — stops new book/register/hold; existing bookings still check in. Player Ban: permanent — sign-in revoked. (Terms added to `CONTEXT.md`.)

### Abuse resistance

- **Rate limiting**: `express-rate-limit` — app-level (e.g. 300 req/min per IP, `trust proxy` set for Railway) plus targeted: checkout 10/min, booking cancel, webhook, uploads, admin routes stricter. OTP send keeps its DB-level 5/hr per phone+user and 60s resend (extend if needed).
- **Hold caps**: max 3 active Holds per Player; max 1 Hold per Court per date-window (a checkout must see the count of *other* active holds that overlap the requested slot for unblocking logic if the requester already holds one). Enforced in the same transaction that inserts the Hold (`bookingController.js`).

### Secrets hygiene

- **OTP**: `crypto.randomInt(0, 1e6)` zero-padded; store salted hash (bcrypt cost 10, or HMAC-SHA256 with a server secret derived from env) — migration to re-format existing `verification_otps` rows or roll them; constant-time compare; keep 10-min expiry and 5-attempt cap.
- **Log redaction**: `requestLogger` masks any field whose key matches `code`, `otp`, `token`, `password`, `key`, `idempotency_key`, `fcm_token`, and phone numbers (partial `+94xxxxxx`). SMS body written to any log is forbidden.

### Transport & I/O

- **Headers/CORS**: add `helmet` (nosniff etc.), lock CORS `origin` and Socket.io `origin` to `FRONTEND_URL` with **no wildcard fallback** (fails closed with the env check).
- **Host trust**: `requestBaseUrl` derives the base from `FRONTEND_URL` (or a new `APP_BASE_URL`) — never the raw `Host` header.
- **Uploads**: mount body limit raised to `10mb` (fix the 100KB 500 bug), magic-byte sniffing (PNG/JPG/WebP headers) before `fs.writeFileSync`, keep extension allow-list.
- **Emails**: escape all user-sourced strings interpolated into HTML (`venue name`, `player name`) via a single `escapeHtml` helper in `emailService`.

## Glossary

Added to `CONTEXT.md` during the grill:

- **QR Token** — disclosure rule: only to its own Player; consumed only by the owning Venue Owner, validating Venue ownership as well as Token identity; never surfaced through read APIs.
- **Check-in** — only the Venue Owner of the Booking's venue may scan; validates ownership + token.
- **Player Suspension** / **Player Ban** — player-level equivalents of the venue lifecycle.

## Done criteria

- [ ] Boot fails with a clear error if any required secret is missing (non-test).
- [ ] Legacy JWT mint/verify code deleted; no custom JWT anywhere in the codebase.
- [ ] Banned/suspended players get `403` on book / event-register / hold / profile routes; existing bookings stay readable.
- [ ] Cross-venue booking reads blocked; `qr_token` returned only for one's own booking; forgery of webhook rejected even with the old test secret.
- [ ] Rate limits in place (`app` + targeted); holds capped (3/player, ≤1 per court per window).
- [ ] OTP codes generated with `crypto.randomInt`, stored as salted hashes, constant-time compare; attempt caps intact.
- [ ] Request logs contain no OTP codes, tokens, or idempotency keys; SMS body never logged.
- [ ] `helmet` on; CORS locked to configured origins; no wildcard fallback.
- [ ] Uploads > 100KB work (body limit raised); non-image bytes rejected; nosniff on `/uploads` static.
- [ ] Email templates escape user strings; `<img onerror>` in a venue name is inert.
- [ ] One vitest regression per fix (see tickets) — all green; `npm test` green; typecheck/static analysis green.
- [ ] ADR-0014 (auth: Firebase ID tokens only, no server sessions) and ADR-0015 (payment trust: server-derived amounts + fail-closed webhook) recorded.

## Out of scope

- Server-side sessions / refresh tokens / logout revocation (Firebase ID tokens only).
- Native app changes; frontend code is untouched unless the API contract shifts (it should not).
- Email-template redesign or in-app rate-limit banking: DB 5/hr caps remain the OTP backstop.
- Attack traffic thresholds: default `express-rate-limit` guesses are a starting point — calibrate after launch with real numbers.
- Third-party: Firebase will keep its own brute-force protection on client SDKs.

## Comments

Decision log (grilled 2026-08-22, skills: grilling + domain-modeling):
- Q1: all 11 audit gaps included in one spec, one ticket per gap.
- Q2: auth stays Firebase ID tokens only (no server-issued sessions).
- Q3: legacy self-minted JWT stack deleted, not parked.
- Q4: fail-closed secrets at boot; no public-string fallbacks in prod code.
- Q5: rate limiting (global + targeted) plus hold caps enforced server-side.
- Q6: caps = 3 concurrent holds/player, ≤1 hold per court per slot window.
- Q7: `crypto.randomInt` + salted hash + constant-time compare.
- Q8: log redaction by field denylist (`code`/`otp`/`token`/`key`…).
- Q9: uploads keep 8MB intent — body limit raised to 10mb, add magic bytes, nosniff.
- Q10: escape HTML everywhere user strings meet output.
- Q11/Q12: QR Token is never disclosed via read APIs; only its own Player sees it; only the owning Venue Owner can consume it at check-in (venue ownership validated at scan) — `CONTEXT.md` updated.
- Glossary updated during the session: QR Token disclosure, Check-in owner validation, Player Suspension, Player Ban.
- ADR pair: 0014 (auth), 0015 (payment trust) — written with the domain-modeling skill.