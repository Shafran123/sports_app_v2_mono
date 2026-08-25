# 07 — App sign-in cutover: email+Google only, gate bookings on Verified Phone + Email

**What to build:** The player app's sign-in and registration surface drops Phone Sign-in entirely — login becomes email+password and "Continue with Google"; register becomes name + email + password (+ Google). The phone-OTP tab and the phone field at registration disappear. In parallel, booking is hard-gated platform-wide: checkout rejects a Player who lacks a Verified Phone or a Verified Email, with a first-sign-in / pre-checkout "complete your details" step (name if missing, phone-OTP, email-OTP; Google emails skip the email OTP). Verified attributes persist on the account so returning players skip the step.

**Blocked by:** None — can start immediately (backend gates are independent of the widget cutover).

**Status:** ready-for-agent

- [ ] App login form shows email+password and "Continue with Google"; the phone-OTP tab is removed
- [ ] App register form asks name, email, password, and Google; the phone field is removed
- [ ] Checkout (backend) rejects a Player missing `phone_verified_at` or `email_verified_at`, independent of the `phone_verification_required` flag, with an actionable error
- [ ] First sign-in / pre-checkout shows a details step collecting name, phone-OTP, and email-OTP (Google-verified emails skip the email OTP); verified state persists
- [ ] Existing verified players book without re-verification; unverified players are prompted before checkout
- [ ] Tests cover both gates (phone, email) and the Google-email skip