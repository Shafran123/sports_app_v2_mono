# ADR-0008 — Cash as a recorded payment

- **Status:** accepted
- **Date:** 2026-08-21

## Context
Players can book with payment at the venue (cash). We need a single source of truth for money across online (PayHere) and cash, so the owner can record collection and admin sees true revenue.

## Decision
Cash payments live in the same `payments` table as online payments, with a method column. The owner records a cash payment (on collection) as a `payments` row with `payment_method=cash`, `status=paid`, `paid_at` set. Cash payments never sit in `pending` — they are recorded as paid at collection time.

## Trade-offs
- A separate cash flag on bookings would be simpler but fragments revenue reporting and can't express "booking exists but not yet paid."
- A dedicated `payments` row per cash collection gives idempotency (marking twice doesn't double-count) and matches the existing online payment shape.

## Consequences
- `payments.payment_method` (online/cash) column added.
- Owner "mark payment received" writes a paid cash payment row and flips the booking's badge.
- Admin reporting sums cash + online and can break out cash.