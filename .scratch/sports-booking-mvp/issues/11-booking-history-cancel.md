# 11 — Booking history + cancel/rebook

**What to build:** players see Upcoming, Past, and Cancelled bookings with receipts; cancelling a booking computes the refund from the configured policy tiers (>24h: 100%, 12–24h: 50%, <12h: 0%) and triggers the refund; a cancelled slot returns to availability and "rebook" starts a fresh checkout.

**Blocked by:** 10 — Payment webhooks + refunds.

**Status:** ready-for-agent

- [ ] Booking history pages render all states with venue, court, date, time, price, status, and QR for upcoming
- [ ] Cancel applies the correct tier based on the DB-configured policy; refund fires and slot is released
- [ ] Cancelling an already-cancelled booking errors cleanly (no double refund)
- [ ] Rebook action from a past/cancelled booking lands on that court's availability

## Comments
Completed: 2026-08-19
