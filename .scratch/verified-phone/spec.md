# Verified Phone — booking requires a verified phone number

Status: ready-for-agent

## Problem Statement

Court bookings are created without any phone-verification requirement:

- **Google signup captures no phone at all** — `loginWithGoogle` (`packages/auth/src/firebaseAuth.ts:31-35`) and the Google buttons (`register-form.tsx` `handleGoogle`, `login-form.tsx` `handleGoogle`) never touch a phone field; a Google account has `users.phone = NULL`.
- **Email signup** collects a phone as unverified free text; profile edits accept any phone.
- **Checkout sends no phone and requires nothing** — `checkout-page.tsx:51-60` posts only `{court_id, start_at, end_at, idempotency_key, payment_method}`; `bookingController.js` `checkout` has no phone check; `users.phone` may be `NULL`.
- **No verified-phone concept exists** — no `users.phone_verified_at` column, no type field, no claim handling. Firebase Phone Sign-in sets `users.phone` from the token claim but nothing records *verification*.
- **Backend has no gate** — a user with `phone = NULL` can create a booking through the API directly.

Decided (grilled with the user, see Comments): bookings must be gated on a **Verified Phone** — a phone proven to belong to the Player via an SMS OTP challenge sent by **our backend through SMSGo.lk**. Firebase Phone Sign-in does **not** confer verified status. The gate is hard at checkout (client + server), with a dismissible prompt at venue entry. Admins can mark players verified (pre-prod/test users). Walk-in quick-book is exempt. Events are out of scope this phase.

## Solution

### Domain rule

- A **Verified Phone** is a phone number that passed an SMS OTP challenge (SMSGo.lk) sent by the Spots backend, **or** was explicitly marked verified by an Admin. Stamped as `users.phone_verified_at` (timestamp; `NULL` = unverified).
- Entering a phone in a form, or signing in via Firebase Phone Sign-in, **never** verifies it by itself.
- Changing `users.phone` (profile edit) **clears** verification until the new number passes a challenge.
- Court booking creation (online or cash-at-venue, logged-in players) **requires** a verified phone. Walk-in quick-book is exempt. Event registrations are exempt (deferred).
- Bookings snapshot the verified phone into `player_phone` at creation; later phone changes never rewrite booking history.

### Backend (`sp_be`)

- Migration `0009`: `users.phone_verified_at timestamptz NULL` + `verification_otps` table (`id, user_id, phone, code_hash, expires_at, attempts, created_at`; index on `(user_id, phone)`; code stored **hashed**, never plaintext).
- `POST /auth/verify-phone/send` — body `{phone}`; normalizes (reuse `normalizePhone`/Sri Lanka format), rate-limits (per phone + per user: 5 sends/hour, resend after 60s), generates a 6-digit code, stores hash, sends via existing `utils/smsService.sendSms` (fire-and-forget `SMSGO_API_KEY`). Invalidates prior outstanding codes for that phone.
- `POST /auth/verify-phone/confirm` — body `{phone, code}`; checks hash, expiry (10 min), attempts (max 5 then code dies); on success sets `users.phone = <verified phone>` and `users.phone_verified_at = now()`.
- `bookingController.checkout` — before creating hold/cash booking: `if (!req.user.phone_verified_at || !req.user.phone) return 409 { code: 'VERIFIED_PHONE_REQUIRED' }`. Gate is **server-side truth**; client UX is cosmetic.
- `authController.updateMe` — when `phone` in payload differs from current `users.phone`, set `phone_verified_at = NULL` (re-verification required). Admin-only override endpoint `POST /admin/players/:id/verify` sets the flag.
- SMSGo secrets stay in env (`SMSGO_API_KEY`); **never** in code or repo.

### apps/user (player web app)

- **Google signup** gains a phone field (optional, pre-fillable from profile later): capture phone on the Google flow — after `loginWithGoogle()`, if no verified phone, open the verify prompt.
- **Verify phone UI** — reusable `VerifyPhoneModal` (phone input → send code → 6-digit entry, 60s resend countdown, error states for wrong code/expired/rate-limited), surfaced from profile, venue entry, and checkout.
- **Profile** — verified badge next to phone; "Verify phone" action; editing phone shows "you'll need to verify the new number before booking".
- **Venue entry** — dismissible prompt ("Verify now" / "I'll do it later") on clicking a sports facility (venue detail).
- **Checkout** — hard gate: verify modal blocks the booking action; handle `409 VERIFIED_PHONE_REQUIRED` from the API; after verification completes, retry/continue checkout. Checkout payload additionally sends `player_phone` (from the verified user).

### apps/admin

- **Players section** — list + search players; "Mark verified" action on a player row (for test users / pre-prod); shows verified status.

## Glossary

**Verified Phone** — a phone number on a Player account proven to belong to that Player by passing an SMS OTP challenge (sent via SMSGo.lk) or by explicit Admin marking. Only Verified Phones may be used to create court bookings. Firebase Phone Sign-in does not verify a number; form-entered numbers are never verified until the challenge completes. Changing the phone clears verified status until re-verified.
_Avoid_: confirmed phone, validated phone, trusted number.

## Done criteria

- [ ] `users.phone_verified_at` + `verification_otps` migration applied (0009).
- [ ] Send/confirm endpoints work end-to-end with real SMSGo (sandbox mode where available); code hashed, 10-min expiry, 5-attempt cap, 60s resend, per-phone/per-user hourly rate limit.
- [ ] `checkout` returns `409 VERIFIED_PHONE_REQUIRED` for unverified users; verified users can book; `player_phone` stamped on bookings.
- [ ] `updateMe` clears `phone_verified_at` on phone change; admin mark-verified endpoint works.
- [ ] Google signup captures phone and offers verification; profile shows badge + verify action.
- [ ] Venue entry shows dismissible prompt; checkout hard-blocks with verify modal; 409 handled gracefully.
- [ ] Admin console Players section with mark-verified.
- [ ] Regression tests for backend gate + frontend flows green; typecheck green; existing suite green.
- [ ] `CONTEXT.md` updated with **Verified Phone**; ADR recorded.

## Out of scope

- Event registration verification (deferred).
- Walk-in quick-book gating (exempt by design).
- Native mobile app.
- Account linking between Firebase providers.

## Comments

Decision log (grilled 2026-08-22):
- Q1: verification via **SMSGo.lk OTP sent by our backend**, not Firebase phone auth. Firebase phone sign-in does not confer verified status.
- Q2: same as Q1 (no Firebase linking path).
- Q3: gate placement — collect at Google signup but allow skip; **hard gate at checkout** (client + server); dismissible prompt at venue entry.
- Q4: pre-prod — no retroactive marking; users are unverified until verified; test users can be marked by admin.
- Q5: walk-in quick-book exempt.
- Q6: bookings snapshot the verified phone (`player_phone`).
- Q7: phone changes require re-verification.
- Round 2: OTP mechanics (6-digit, 10-min expiry, 5 attempts, 60s resend, hourly cap, hashed storage); venue modal dismissible; admin console Players section; phone edit clears verification; events out of scope; bookings immutable snapshot.
- Note: user pasted live SMSGo keys in chat — regenerate `SMSGO_API_KEY` after setup; never commit it.