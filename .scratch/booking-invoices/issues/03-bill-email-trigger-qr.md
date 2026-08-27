# 03 — Bill email: trigger to mark-paid, no QR, no attachment duplication

Type: task
Status: ready-for-agent

## Completed

Implemented and verified. Evidence: backend suite 398/398, admin 59/59, api 25/25, typechecks green.

## Purpose

Cash bookings email the bill when the owner marks them paid (not at check-in). Online bookings keep billing at check-in. The confirmation email never carries a bill. The bill email body carries no QR.

## Changes

- `sp_be/controller/businessController.js` `markPaid`: after flipping the cash payment `due → paid`, `void billService.emailBillForBooking(id)` (fire-and-forget, same as check-in).
- `sp_be/controller/businessController.js` `checkIn` / `qrCheckIn`: still email the bill (online bookings) — unchanged.
- `sp_be/utils/notificationCatalog.js`:
  - Remove `'booking.bill'` from `QR_KEYS` so the generic dispatch loop never loads/attaches a QR for it.
  - `booking.bill` `buildEmail`: drop the inline QR attachment and pass no `qr` to `buildBillHtml`.
- `sp_be/utils/emailTemplates.js` `buildBillHtml`: remove the QR block, the QR attachment, and the "carries the QR code" copy (email body + plain text); keep the summary card.

## Audit

- [ ] markPaid emails the bill for cash bookings; check-in still emails it (online).
- [ ] bill email has the PDF attachment but no `booking-qr.png` inline image, in HTML or text.
- [ ] confirmation email unchanged (still has QR, still no PDF).
- [ ] notificationCatalog/emailTemplates tests updated.

