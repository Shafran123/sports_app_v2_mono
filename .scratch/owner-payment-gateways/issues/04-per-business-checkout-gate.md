# 04 — Per-business checkout gate

**What to build:** the checkout paths (Dedicated Site, Booking Widget, player checkout) read the Business's enabled methods instead of `venues.accepts_cash` + platform flag; server rejects unavailable methods; the site-customer 409 is lifted to per-business logic.

- Replace the `accepts_cash` gate in `bookingController.js` (currently rejects `cash` with `400 CASH_NOT_ACCEPTED`) with a per-Business read: the venue's Business's `business_payment_methods` rows.
- `payment_method='payhere'`: allowed when the Business has `payhere` enabled **and** credentials configured **and** the global `payhere_enabled` kill switch is on (both must hold). Cash: Business has `cash` enabled. No enabled methods at all → `400 NO_PAYMENT_METHODS` (fail-closed, ADR-0015).
- Lift the site-customer hard-reject (`409 PAYMENT_UNAVAILABLE` for `site_customer_id` online bookings) — site/widget bookings now pay via the Business's own gateway, gated by the per-business check above.
- Events keep their existing platform-gateway gate unchanged (13).
- Disable semantics: a method flipped off blocks new checkouts only — existing pending/paid bookings and their refunds are unaffected (05 handles credential retention).

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] Checkout gate reads business methods; `accepts_cash` references gone
- [ ] PayHere requires enabled + configured + kill switch; tests for each combination
- [ ] Site-customer online checkout passes per-business check (no 409 when enabled)
- [ ] No-payment-methods Business → 400, cash fallback never silently assumed