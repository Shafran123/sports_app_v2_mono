# 08 — Widget sign-in cutover: email+Google (Firebase redirect) + verified-gate identity

**What to build:** The Booking Widget's identity step becomes the same sign-in as the app: a compact email+password form (with "Forgot password?" reset), a "Continue with Google" button that uses Firebase's redirect flow (popups are blocked in cross-origin iframes), and registration inline for fresh users (name + email + password, no phone field). After sign-in, the widget shows an inline details step whenever the Player lacks a Verified Phone or Verified Email — phone-OTP and email-OTP (Google-verified emails skip the email OTP) — and the picker stays locked until both are verified. Legacy auto-created phone-only accounts do not sign in under the new scheme.

**Blocked by:** None — can start immediately (independent of the app cutover; both rework the identity).

**Status:** ready-for-agent

- [ ] Widget identity step offers email+password and "Continue with Google" (Firebase redirect, no popup), plus inline registration and "Forgot password?"
- [ ] No phone-OTP sign-in is offered in the widget
- [ ] After sign-in, the widget shows the details step until the Player has name, a Verified Phone, and a Verified Email; the picker is locked until then
- [ ] Returning fully-verified Players skip straight to the picker
- [ ] Google sign-in marks the account email verified (no email OTP); email+password accounts pass the email OTP
- [ ] Tests cover email login, Google login, registration, forgot-password, and the verification gate