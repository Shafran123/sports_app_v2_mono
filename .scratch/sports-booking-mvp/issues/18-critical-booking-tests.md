# 18 — Critical booking tests

**What to build:** an integration test suite covering the money paths: concurrent double-booking, hold expiry, webhook replay, cancellation tier math, event capacity, and check-in validation — the system stays financially and logically consistent under each scenario.

**Blocked by:** 10 — Payment webhooks + refunds; 11 — Booking history + cancel/rebook; 13 — Check-in + manual bookings; 16 — Events register/pay.

**Status:** ready-for-agent

- [ ] Two concurrent bookings for the same slot: exactly one succeeds
- [ ] Hold expiry returns the slot to available
- [ ] Replayed payment webhook does not double-confirm or double-refund
- [ ] Cancellation refund matches policy tier for each boundary (>24h, 12–24h, <12h)
- [ ] Event registration cannot exceed capacity under concurrency
- [ ] Check-in rejected for wrong venue, wrong time window, and non-confirmed states
- [ ] Suite passes in CI-able one-command form against the isolated test project

## Comments
Completed: 2026-08-19
