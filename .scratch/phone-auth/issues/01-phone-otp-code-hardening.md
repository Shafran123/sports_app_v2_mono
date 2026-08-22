# 01 — Phone OTP code hardening

**What to build:** make the existing phone OTP sign-in flow robust: fix the reCAPTCHA re-render bug, normalize phone input, record the phone on the backend user upsert, add the SMS disclosure line and device-language localization, and verify with a manual script using fictional console numbers.

**Blocked by:** none (final end-to-end verification also needs 02 — Firebase console config — for SMS region policy and test numbers).

**Status:** done

- [x] `sendPhoneOtp` creates ONE `RecaptchaVerifier` per component lifecycle and reuses it on resend; on error or resend the verifier is reset (`grecaptcha.reset`) so retries never hit `auth/captcha-check-failed`
- [x] Phone input is normalized before `signInWithPhoneNumber` (strip spaces/dashes/parens, require leading `+`); malformed input errors locally before any SMS is sent, with a friendly message
- [x] `sp_be/middleware/authenticate.js` upsert writes `users.phone` from `decoded.phone_number` with the same fill-if-unset (`coalesce`) semantics as `email`/`name`; OTP-first accounts get their phone recorded, later link/email sign-in does not overwrite it
- [x] Disclosure copy under the phone input: "We'll text you a 6-digit code. Standard SMS rates apply."
- [x] `auth.useDeviceLanguage()` called before verifier creation (respecting any explicit `languageCode`)
- [ ] Manual test script (telephone `+94 7x xxx xxxx` → real web flow against fictional console numbers; resend, wrong code, change number, close-and-reopen) passes without consuming SMS quota
- [x] Typecheck + tests green (lint is pre-existing-broken repo-wide — no ESLint configs)

## Manual test script

Uses the fictional numbers from 02 (e.g. `+1 650 555 3434`, code `654321`). No real SMS is sent; no quota is consumed.

1. Open `/login` in a private window. Phone OTP tab.
2. Enter a **malformed** number (spaces, no `+`) → local error, no SMS attempt, no reCAPTCHA flash.
3. Enter a real-but-unconfigured number → friendly error (`invalid-phone-number` after captcha), then **resend works** (no `captcha-check-failed`).
4. Enter the fictional number → OTP screen. Submit wrong 6 digits → friendly error, resend still works.
5. Submit the configured fictional code → lands on `/dashboard`; reload persists the session.
6. Close and reopen the browser → login again via OTP; `users.phone` is set in Postgres (check via admin or `SELECT phone FROM users`).
7. Sign in on a second device with the same number → same account, phone still intact.

## Comments

Verification of step 3 requires the SMS region policy + authorized domains from 02 to be in place.
Completed: 2026-08-22 — code done; 02 (Firebase console) still pending.
