# 08 — Owner cancel & refund (PayHere)

**What to build:** the Venue Owner cancels a PayHere booking from their console and the platform refunds it through the **Business's own credentials** (app ID/app secret OAuth, sandbox). Cancel-and-refund only — no standalone refunds this round (Q28).

- Extend the owner booking-cancellation path (existing `business.js` cancel route): when the booking is PayHere-paid and the Business has app creds, call the PayHere refund API with the Business's OAuth token (per 05's resolution), then record the refund on the `payments` row; cancellation tiers apply as today (100% for pending, tier % for confirmed).
- Cash bookings: unchanged — nothing to refund.
- Legacy platform-credentialed payments (pre-change marketplace bookings, Events): refund path stays admin-only (existing admin refund screen); owner sees "contact support" if they try.
- Failed refunds: `needs_manual_refund` flag + surfaced to admin, matching today's flow.
- Owner UI: cancel dialog on a PayHere booking states the refund amount/tier before confirming.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Owner cancel-&-refund works with Business app creds in sandbox (test payment round-trip)
- [ ] Tiers applied; legacy/event payments refuse owner refund with clear message
- [ ] Refund failure escalates to `needs_manual_refund`
- [ ] Tests: refund round-trip, tier calc, legacy rejection