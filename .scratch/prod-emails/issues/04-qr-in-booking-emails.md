# 04 — QR in booking emails (inline CID)

**What to build:** embed the booking QR inside the player's confirmation + reminder emails (and inline on the bill, which already emails the PDF).

**Depends on:** 02

**Status:** ready-for-agent

**Seam:** `notificationCatalog.js` email builders + `emailService.sendEmail` (attachment path).

- [ ] `bookingLoader.js`: keep `qr_token` OUT of the shared payload; add a dedicated `loadQrToken(bookingId)` (single-column `select qr_token … where id = $1`).
- [ ] `emailTemplates.js`: new `buildBookingQrCid(token)` → `data:image/png;base64` buffer via `qrcode` (already a dep) → `cid:booking-qr@myslot.lk` inline `<img>` + microcopy *"Single-use check-in code — don't forward this email."*
- [ ] `notificationCatalog.js`: for `booking.confirmed`, `booking.reminder`, and (optionally) `booking.bill`, the player role builder loads `loadQrToken(booking.id)` and includes the inline image; **assert recipient** — only when `role === 'player'` and `to === booking.user_email` (guard the secret, CONTEXT).
- [ ] `emailService.sendEmail`: support inline CID attachment (multipart `inline` disposition) — reuse the existing attachment branch, add `inline: true` handling.
- [ ] Owner email: never renders the QR (inherit from 02's no-player-data rule + the assert).
- [ ] Tests (new seam, `test/emailTemplates.test.js` + `test/notificationCatalog.test.js` additions):
  - confirm/reminder contain `cid:booking-qr` + the warning line;
  - owner email contains no `cid:` image and no `qr_token`;
  - `notificationCatalog` player path calls `loadQrToken`; admin/owner path never does;
  - `emailService` posts multipart with the inline image when `attachment.inline`.
- [ ] `npm test` green.

## Comments

QR reaches the player's own inbox only; the shared loader payload stays QR-free (CONTEXT: disclosed to the player's own app/inbox). Single-use mitigates forwarding risk (user Q12: "send in email its fine").