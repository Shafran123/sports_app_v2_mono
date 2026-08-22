# Mailgun: live email wiring (sandbox)

Status: ready-for-agent

## Problem Statement

Email delivery exists in code (`sp_be/utils/emailService.js`) — a fire-and-forget Mailgun client via raw `fetch` + Basic auth, unit-tested in `test/emailService.test.js` — but local `.env` has no `MAILGUN_API_KEY` / `MAILGUN_DOMAIN`, so every transactional email (booking confirmation, reminder, welcome, venue approved/rejected) logs-and-skips. Emails have never actually left the box. The provider of record is now Mailgun; a stale Resend block remains in `.env`.

## Solution

Wire real Mailgun sandbox credentials into local `.env` and prove a live send to an authorized recipient.

- Keep the existing raw-`fetch` client (`emailService.js:14-48`) — no `mailgun.js` SDK dependency; the client already performs the identical wire call the SDK would.
- Set in local `.env` (gitignored; production Railway env keeps real domain + key):
  - `MAILGUN_API_KEY=<your-mailgun-api-key>`
  - `MAILGUN_DOMAIN=sandbox32dbf2cd39464d2abd0955f3e0f5d22b.mailgun.org`
  - `FROM_EMAIL=Mailgun Sandbox <postmaster@sandbox32dbf2cd39464d2abd0955f3e0f5d22b.mailgun.org>` (sandbox requires `from` on the sandbox domain)
  - `ADMIN_EMAIL=devshaf@proton.me`
- Remove the stale `RESEND_API_KEY` placeholder block.
- Smoke test: one-off `sendEmail` to `devshaf@proton.me` (authorized sandbox recipient) must return `{ success: true }` and appear in the Mailgun dashboard.

Sandbox constraints: only authorized recipients receive mail; anything else is rejected. US region endpoint `api.mailgun.net` (as hardcoded — no EU endpoint switch).

## Done criteria

- [ ] Local `.env` carries the sandbox `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and sandbox `FROM_EMAIL`; Resend block removed
- [ ] `sendEmail` to `devshaf@proton.me` returns success and the message appears in the Mailgun sandbox dashboard
- [ ] Existing `emailService.test.js` still passes
- [ ] `docs/agents` triage: no glossary changes — "Email Notification" already defined in `CONTEXT.md` as fire-and-forget via Mailgun