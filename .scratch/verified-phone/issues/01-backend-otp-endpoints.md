# 01 — Backend: OTP issuance + verification endpoints (SMSGo)

**What to build:** the phone-verification OTP backend — migration, send/confirm endpoints, rate limits, SMSGo wiring.

**Blocked by:** none

**Status:** ready-for-agent

## Scope

- Migration `sp_be/migrations/0009_phone_verification.sql`:
  - `alter table users add column phone_verified_at timestamptz;`
  - `verification_otps` table: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references users(id)`, `phone text not null`, `code_hash text not null`, `expires_at timestamptz not null`, `attempts int not null default 0`, `created_at timestamptz default now()`; index on `(user_id, phone)`.
  - Code is stored **hashed** (sha-256 or similar), never plaintext.
- `POST /auth/verify-phone/send` — body `{phone}`:
  - Normalize via existing phone normalization (Sri Lanka format, `+94…`).
  - Rate limits: per phone + per user — 5 sends/hour, resend only after 60s since last send. Prior outstanding codes for that phone are invalidated.
  - Generate 6-digit code, store hash, send via `utils/smsService.sendSms` (`SMSGO_API_KEY` env; fire-and-forget; sandbox mode enabled where available for testing).
  - Response: `{sent: true, resend_after_seconds}` — never return the code.
- `POST /auth/verify-phone/confirm` — body `{phone, code}`:
  - Verify hash, expiry (10 min), attempt cap (5 wrong attempts → code invalidated).
  - On success: `users.phone = <phone>`, `users.phone_verified_at = now()`. Return the updated user.
- Errors: structured codes (`OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED`, `OTP_RATE_LIMITED`, `PHONE_INVALID`).
- Reuse the existing `utils/smsService.js` — do not add a second SMSGo client.

## Verification

- Backend tests (`sp_be/test/`): send + confirm happy path (mock SMSGo), wrong code, expiry, attempt cap, rate limit, hash-not-plaintext assertion.
- Manual: sandbox-mode SMSGo with a real number; confirm flow in the UI once 03 lands.

## Done criteria

- [ ] Migration applied; OTP hashed in DB
- [ ] Send/confirm endpoints behave per spec (expiry, cap, rate limits, resend)
- [ ] SMSGo sandbox send works with `SMSGO_API_KEY` from env (never hardcoded)
- [ ] Tests green