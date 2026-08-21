# 0012 — Transactional email via Mailgun + SMS via SMSGo.lk

- **Status:** accepted
- **Date:** 2026-08-21

## Context

Launch needs working transactional notifications: booking confirmations (online + cash), signup welcome, reminders, and venue approval/rejection emails, plus SMS for booking confirmation and admin-initiated cancellation. The current `emailService.js` uses Resend with a placeholder key and sends nothing for cash bookings.

## Decision

- **Email:** Mailgun (its 100-free-emails/month tier). Replace `resend`; env `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `FROM_EMAIL`. Startup logs a loud warning when unconfigured; sends are fire-and-forget and never fail the HTTP request.
- **SMS:** SMSGo.lk (`POST https://api.smsgo.lk/api/v1/sms/send`, `X-API-Key`, body `{ to, message, mask }`), env `SMSGO_API_KEY`, `SMSGO_MASK`. SMS is limited to **booking confirmation** and **admin-initiated cancellation** only.

## Why

- Mailgun chosen over Resend for the free tier + Sri Lanka deliverability; SMSGo is a Sri Lanka SMS gateway (matches operator/country reach, local pricing).
- Restricting SMS to two critical events keeps cost low and avoids notification fatigue; email carries the richer detail (QR note, venue info).
- Fire-and-forget keeps booking writes fast and resilient when a provider is down.

## Consequences

- Two provider integrations behind thin service wrappers (`emailService.js`, `smsService.js`), so swapping providers later is contained.
- New config surface: `MAILGUN_*`, `SMSGO_*` in `sp_be/.env`; `.env.example` updated.
- Tests mock or skip sends without credentials.