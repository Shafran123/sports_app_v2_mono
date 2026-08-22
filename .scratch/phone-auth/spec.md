# Phone Sign-in readiness (web OTP hardening + Firebase console config)

Status: ready-for-agent

## Problem Statement

Phone-number (OTP) sign-in is already implemented in the web user app (`packages/auth/src/firebaseAuth.ts`, `apps/user/src/features/auth/login-form.tsx`) but is not "ready" for real use:

- `sendPhoneOtp` creates a new `RecaptchaVerifier` on every call, rendering into the same `#recaptcha-container` — reCAPTCHA cannot render twice into one container, so resend/failure retries fail with `auth/captcha-check-failed`.
- The phone input is passed to Firebase raw; malformed input (spaces/dashes, missing country code) burns an SMS send and surfaces only Firebase's raw error.
- The backend upserts `users` rows from the Firebase token but never records the phone number, so OTP-first accounts have an empty `users.phone`.
- The SMS disclosure line (standard rates / consent) advised by Google is missing under the phone input.
- reCAPTCHA is rendered against the default locale instead of the user's device language.
- Firebase console configuration that only a human can do is undocumented and un-tracked: **SMS region policy defaults to no allowed regions for new projects**, so SMS silently fails until it is set; authorized domains and fictional test numbers also need to be configured.

## Solution

Harden the OTP flow in code and provide a separate, human-executable checklist for the Firebase console.

- Create **one** `RecaptchaVerifier` per login component lifecycle; reuse it for resend, reset it on error and on resend (per Firebase docs' own guidance).
- Normalize the phone number client-side before sending: strip spaces/dashes/parens, require a leading `+`, reject locally with a friendly message instead of burning an SMS.
- Backend (`sp_be/middleware/authenticate.js`): feed `decoded.phone_number` into the `users` upsert using the same fill-if-unset semantics as email/name (`coalesce`), so OTP-first accounts get their phone recorded.
- Add the disclosure copy under the phone input: "We'll text you a 6-digit code. Standard SMS rates apply."
- Call `auth.useDeviceLanguage()` before creating the verifier so reCAPTCHA and the SMS are localized to the device locale (developer-localized via `auth.languageCode` where already set).
- Deliver the Firebase console steps as a separate ticket with a reproducible click-through checklist (SMS region policy, authorized domains, fictional test numbers), so human-console work is trackable independently of code.

The phone OTP flow itself is scoped to the existing **web user app** login form. No native mobile app is in scope. No new sign-in methods are added. The existing `auth.signOut()` before `sendPhoneOtp` (which prevents account-linking on the same device) is preserved.

## Glossary

**Phone Sign-in** added to `CONTEXT.md` — *signing in using a one-time code received by SMS to the player's phone number (Firebase Auth)*, distinct from **SMS Notification** (outbound transactional booking SMS via SMSGo), and noted as opportunistic (linkable to richer methods later).

## Done criteria

- [ ] Resend after a failed/expired code works (reCAPTCHA reset, no `captcha-check-failed`).
- [ ] Phone numbers are normalized before send; local friendly errors for missing `+` / malformed input.
- [ ] `users.phone` is populated on first OTP sign-in (fill-if-unset on later sign-ins).
- [ ] SMS disclosure line visible under the phone input; `useDeviceLanguage()` applied.
- [ ] Manual test script passes (fictional console numbers, no SMS quota consumed).
- [ ] Lint + typecheck + existing tests green.
- [ ] Firebase console checklist completed by a human (SMS region policy, authorized domains, test numbers) and verified end-to-end with a real device.