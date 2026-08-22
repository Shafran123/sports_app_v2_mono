# 07 — OTP generation & storage hardening

**What to build:** replace weak OTP RNG + unsalted storage with crypto-strength generation and salted hashes.

**Blocked by:** none

**Status:** ready-for-agent

## Scope

Current: 6-digit code from `Math.random()` (`verifyPhoneController.js:48`) stored as unsalted `sha256(code)` (`:12-14`). Predictable-ish and trivially brute-forced from a leaked DB (space 10^6).

- Generation: `crypto.randomInt(0, 1000000)` zero-padded to 6 digits. No `Math.random` in the code path.
- Storage: salted hash — either `bcrypt` (cost 10) or `HMAC-SHA256` over the code with a per-phone random salt persisted on the OTP row (keep a `salt` column; or bcrypt which embeds its own salt). If `verification_otps` rows exist for live users, invalidate/expire all outstanding codes (best) or migrate them — must not leave legacy unsalted hashes comparable.
- Comparison: constant-time (`timingSafeEqual` on buffers of equal length, or bcrypt.compare) — never loose `===`.
- Keep: 10-min expiry, 5-attempt cap, 60s resend, 5/hour per phone+user (they're already there).
- Regenerate-and-invalidate semantics stay: send replaces outstanding codes for that phone.

## Verification

- Vitest: generated codes are 6-digit zero-padded; hashes salted: same code twice → different stored hashes; wrong code → constant failure; max-attempt kills code; stored value is never the plaintext (assert `!hash.includes(code)` and hash != code).
- `crypto.randomInt` vs `Math.random` grep.

## Done criteria

- [ ] Codes from `Math.random()` gone; `crypto.randomInt` in place.
- [ ] Salted hash storage; legacy hashes invalidated in migration.
- [ ] Constant-time compare; caps/expiry intact; suite green.