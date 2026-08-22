# 06 — Booking Bill PDF — generation + email + print

Type: task
Status: ready-for-agent

## Purpose

Players and venues get a professional, immutable invoice that doubles as a check-in pass.

## Changes

- Add `pdfkit` to sp_be; `utils/billService.js` — `generateBill(booking | registration)` → PDF buffer, stateless (no storage).
- Contents: venue, court/sport, date + slots, player name, phone, booking ID, payment method + status, base, tax line (or "Tax not applicable"), total, QR token barcode (use existing `qrToken`).
- Trigger: payment confirmed (online webhook when PayHere live; cash recorded by owner; event registration confirmed). Email via `emailService.sendEmail` with attachment (walk-in Guest: no email — print-only at venue).
- Refunded/cancelled: regenerate showing **REFUNDED** state.
- Public download endpoint for the player app (re-download anytime).

## Audit

- [ ] PDF buffer generated for booking + event registration; barcode renders; refunded marker works.
- [ ] Email sent on payment confirmation (except walk-in); download endpoint works.
- [ ] tests: pdfkit output non-empty, refund state, walk-in skip.

Blocked by: 05