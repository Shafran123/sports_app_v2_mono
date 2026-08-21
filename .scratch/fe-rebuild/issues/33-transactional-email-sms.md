# 33 — Transactional email (Mailgun) + SMS (SMSGo)

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
Email (`sp_be/utils/emailService.js`):
- Replace `resend` with **Mailgun** (REST or `mailgun-js`). Env: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `FROM_EMAIL`. Loud warning at startup when unconfigured (never fail requests).
- Emails to send:
  - **Signup welcome** — fired when `upsertUser` in `middleware/authenticate.js` *creates* a new user row (detect insert vs update).
  - **Booking confirmed** (online + cash) — venue, court, date, time, price, payment method, QR note. Currently only payment-confirm emails; cash checkout sends nothing — wire cash + online both.
  - **Booking reminder** — 1 day before slot start (scheduled; a lightweight interval job in `index.js` scanning upcoming confirmed bookings).
  - **Venue approved** and **venue rejected/changes-requested** (already exist — keep, restyle to Mailgun).
- Remove dead legacy `notifyBookingCreated/Accepted/Rejected`.

SMS (`sp_be/utils/smsService.js`):
- **SMSGo.lk**: `POST https://api.smsgo.lk/api/v1/sms/send`, header `X-API-Key`, body `{ to: "<9477…>", message, mask }`. Env: `SMSGO_API_KEY`, `SMSGO_MASK`.
- Send on **booking confirmed** (online + cash) and **admin-initiated cancellation only**.
- Phone source: booking `player_phone`, else user phone. Fire-and-forget; log failures; never throw.

## Acceptance
- [ ] Mailgun sends work with real key/domain; startup warns loudly when missing
- [ ] Booking confirmed email fires for **both** online and cash checkout
- [ ] Signup welcome fires only on new user creation (not every login)
- [ ] Reminder email scheduled for confirmed bookings ~1 day ahead
- [ ] SMS sends on booking confirm + admin cancellation only (SMSGo API shape per docs)
- [ ] All sends non-blocking; HTTP requests never fail because of email/SMS
- [ ] Backend tests green (email/SMS mocked or skipped without creds)