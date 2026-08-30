# 05 — reCAPTCHA on Dedicated Site (login, register, checkout)

**What to build:** A Dedicated Site visitor's email+password sign-in, registration, and booking checkout each include a reCAPTCHA v3 token verified server-side before a session is issued or a booking created. Low score on login/register escalates to an email-OTP challenge; low score on checkout rejects the booking. The Booking Widget iframe is explicitly **out of scope** (ADR-0042).

**Blocked by:** 04 — reCAPTCHA backend verification

**Status:** ready-for-agent

- [ ] Sign-in and register carry and server-verify a reCAPTCHA token
- [ ] Checkout carries and server-verifies a reCAPTCHA token
- [ ] Login/register low score → email-OTP escalation, not hard block
- [ ] Checkout low score → booking rejected
- [ ] Widget iframe untouched
- [ ] Tests cover happy path and both low-score behaviours
