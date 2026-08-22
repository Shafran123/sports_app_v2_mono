# 01 — Wire Mailgun sandbox credentials + live smoke test

**What to build:** put real Mailgun sandbox credentials in local `.env` so `utils/emailService.js` stops log-and-skipping, remove the stale Resend placeholder, and prove a live send to an authorized recipient.

**Status:** ready-for-agent

- [ ] `.env`: `MAILGUN_API_KEY=<your-mailgun-api-key>`, `MAILGUN_DOMAIN=sandbox32dbf2cd39464d2abd0955f3e0f5d22b.mailgun.org`
- [ ] `.env`: `FROM_EMAIL=Mailgun Sandbox <postmaster@sandbox32dbf2cd39464d2abd0955f3e0f5d22b.mailgun.org>` (sandbox `from` must be on the sandbox domain), `ADMIN_EMAIL=devshaf@proton.me`
- [ ] `.env`: remove the stale `RESEND_API_KEY=re_xxxxxxxxxx` block
- [ ] Smoke test: one-off `sendEmail({ to: 'devshaf@proton.me', ... })` returns `{ success: true }`; message visible in Mailgun dashboard
- [ ] `npm test` (`test/emailService.test.js`) still green

## Comments

Wired + smoke-tested 2026-08-22 by agent: sandbox accepted the send (`{"success":true}`) to devshaf@proton.me. No code changes needed — client already uses Mailgun via raw `fetch` (utils/emailService.js:27-34); keeping it, per decision in spec.