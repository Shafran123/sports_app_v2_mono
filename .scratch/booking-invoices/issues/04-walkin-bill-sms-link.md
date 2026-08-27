# 04 — Walk-in SMS bill link + public download

Type: task
Status: ready-for-agent

## Completed

Implemented and verified. Evidence: backend suite 398/398, admin 59/59, api 25/25, typechecks green.

## Purpose

A walk-in customer gives a phone at quick-book; their bill reaches them via SMS with a tokenized download link (they have no inbox and no app). Prints lose the QR — the front desk checks in via the console.

## Changes

- `sp_be/utils/smsService.js`: `bookingBillUrl(bookingId, qrToken)` → `${FRONTEND_URL}/api/v1/public/bill/<id>?t=<token>` (same bearer model as `bookingQrUrl`); `buildWalkinSms` takes an optional `billUrl` and drops the "Show the QR at check-in." copy in favour of the bill link.
- `sp_be/routes/publicQr.js` (or new `routes/publicBill.js` mounted in app.js): `GET /api/v1/public/bill/:bookingId?t=<token>` — timing-safe token compare like the QR endpoint, then stream the generated invoice PDF (which allocates the invoice number on first render). 404 on unknown id/token mismatch.
- `sp_be/controller/businessController.js` `createManualBooking`: after insert, dispatch the walkin SMS carrying the bill link (allocate the invoice number first so the SMS can include it if desired).
- `sp_be/utils/notificationCatalog.js` `booking.walkin_created`: build SMS with the bill URL for the player recipient.

## Audit

- [ ] quick-book with a phone sends an SMS containing a working bill link.
- [ ] public bill URL requires the correct secret token; wrong token → 404.
- [ ] walkin SMS no longer instructs "show the QR at check-in".

