# 03 — apps/user: verify-phone flow + Google signup phone capture

**What to build:** the player-facing verification UX and phone capture on Google signup.

**Blocked by:** 01

**Status:** ready-for-agent

## Scope

- Reusable `VerifyPhoneModal` (new component, e.g. `apps/user/src/features/verify-phone/`):
  - Step 1 phone input (normalize, country code), Step 2 6-digit code entry.
  - 60s resend countdown; error states for wrong code / expired / attempts exceeded / rate-limited / invalid phone (map backend codes).
  - On success: refresh the auth context user (`setUser` — context exposes it) so the verified badge and checkout gate update immediately.
- **Google signup** (`register-form.tsx` `handleGoogle` and `login-form.tsx` `handleGoogle`): after `loginWithGoogle()`, if the user has no verified phone, show the verify prompt (skip allowed — hard gate remains at checkout). Keep the existing email-path behavior; the phone field already exists there.
- **Profile** (`profile-page.tsx`): verified badge next to phone; "Verify phone" action opens the modal; when the user edits the phone to a new number, show "you'll need to verify the new number before booking" and clear-verification happens server-side (02).

## Verification

- Widget tests per repo conventions (`apps/user/src/features/verify-phone/verify-phone-modal.test.tsx`): happy path, resend countdown, wrong code, rate-limited, success updates context.
- Manual: real SMSGo sandbox send → code entry → badge appears; Google signup shows prompt.

## Done criteria

- [ ] Modal works end-to-end against 01's endpoints
- [ ] Google signup prompts for phone verification (skippable)
- [ ] Profile badge + verify action
- [ ] Tests green; typecheck green