# 17 — Owner records cash received; cash revenue for admin

**Status:** ready-for-agent
**Depends on:** 16

## What to build
- Owner console: on a cash booking, a "Mark payment received" action (from Today timeline and booking detail).
- Creates a `payments` row (method=cash, status=paid, paid_at) linked to the booking — single source of truth.
- Cash bookings show a clear badge: **cash due** until marked, **paid** after.
- Admin reporting includes cash revenue (read-only) alongside online.

## Acceptance
- [ ] Owner can mark a cash booking paid (records who/when + `payments` row)
- [ ] Booking badge flips cash-due → paid
- [ ] Admin sees cash revenue in overview/reporting
- [ ] Payments table has a method column so cash and online are distinguishable

## Notes
- `payments` currently has no `method` column — add `payment_method` text (online/cash). Migration.
- Business overview (`/business/overview`) should sum cash + online, and break out cash.
- Idempotent: marking paid twice must not double-create the payment row.