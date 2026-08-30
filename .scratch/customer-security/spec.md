# Customer Security — Consent, Anti-bot, Second Factor

Three independent security/privacy features for the platform's business-facing and first-party surfaces. Rollout order: **consent → test → captcha → test → TOTP → test**.

## Design (grilled + confirmed)

### A. Analytics Consent
- Records Accept/Reject per origin in local storage (the platform sets no cookies — ADR-0043), blocking until a choice is made, GA4 deferred until Accept, withdrawable.
- Versioned so a privacy-policy change re-prompts.
- Surfaces: landing app (GA4 today), marketplace user app (GA4 added), dedicated sites. The admin and owner consoles have **no** consent banner and no analytics.
- Covers analytics only. PDPA-primary, GDPR-compatible copy.

### B. Anti-bot Check (Google reCAPTCHA v3)
- One shared key, domain verification off, hostname validated server-side against the request origin (250-domain cap + iframe physics → ADR-0042).
- Dedicated Site sign-in/register/checkout — server-verified. Low score on login/register → email-OTP escalation; on checkout → reject.
- Owner-lead form (landing): low score → reject.
- The Booking Widget iframe is explicitly **out of scope** (ADR-0042): relies on its verified phone+email gate and rate limits.

### C. Second Factor (own TOTP, Site Customers only)
- Own TOTP verified server-side in the backend on the scrypt/bearer-token Site Customer auth stack; applies to email+password and Google sign-in; every sign-in, no trusted devices; secrets encrypted at rest.
- Voluntary by default; per-Business "require 2FA" toggle in the owner console.
- Enrollment in the Dedicated Site account panel (QR, 10 single-use Backup Codes, disable); the widget challenges an enrolled customer in the iframe but never enrolls.
- Recovery: Venue Owner resets their own customers' factor, Admin as backstop; reset revokes all of that customer's active sessions.
- Marketplace Players, Admins, Venue Owners, and the widget's no-live-site Firebase fallback: **out of scope**.

## Tickets
- 01 — Consent banner + gating on landing app
- 02 — Consent on marketplace user app (+ GA4)
- 03 — Consent on dedicated sites (admin/owner consoles excluded)
- 04 — reCAPTCHA backend verification service
- 05 — reCAPTCHA on Dedicated Site (login, register, checkout)
- 06 — reCAPTCHA on owner-lead form
- 07 — TOTP backend, schema, backup codes, require-toggle, recovery
- 08 — TOTP sign-in challenge (Dedicated Site + widget iframe)
- 09 — TOTP enrollment UI (account panel) + owner console require toggle
