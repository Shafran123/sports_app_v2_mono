# 06 — Tests + docs (ADR supersedes 0039)

Type: task
Status: ready-for-agent

## Completed

Implemented and verified. Evidence: backend suite 398/398, admin 59/59, api 25/25, typechecks green.

## Purpose

Back the behavior with tests and record the decision that reverses ADR-0039.

## Changes

Tests (`sp_be/test/`):
- `bill.test.js`: mark-paid cash booking emails a bill; check-in (online) still emails; invoice number allocated once and stable; walk-in (player row = owner) still never emails; walkin SMS carries a bill link; no QR in the bill email.
- `notificationCatalog.test.js`: `booking.bill` no longer in QR keys; walkin SMS shape.
- `emailTemplates.test.js`: `buildBillHtml` has no QR block/attachment.

Docs:
- `docs/adr/0041-booking-invoice-numbers-and-bill-trigger.md` — reverses ADR-0039's "at completion" for cash bookings: cash bills at mark-paid, online at check-in, per-Business sequential invoice numbers, no QR on bills, walk-in SMS bill link. Mark `0039` superseded.

## Audit

- [ ] backend suite green; frontend typecheck/lint green.

