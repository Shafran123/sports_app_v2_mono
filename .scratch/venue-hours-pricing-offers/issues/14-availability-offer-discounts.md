# 14 — Backend: availability returns offer-discounted slots

**What to build:** Slot-based offers actually reach the player. The availability endpoint's courts query selects the court's `venue_id` so the pricing engine can match the venue's offers; each available slot that matches a slot-based offer returns `offer_price` (the discounted price) alongside the base `price`. Venue-wide offers stay checkout-only.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The availability courts query selects `c.venue_id` and passes a court object that carries it into `slotPricing`.
- [ ] Creating a slot-based 20% offer (all courts, any day, any time) and requesting availability returns `price: 1500, offer_price: 1200` for an available slot.
- [ ] A slot outside the offer's day/time window or court scope returns `offer_price: null`.
- [ ] Regression test (the probe that went red): create slot offer → availability → assert `offer_price` is the discounted price. This test must fail before the fix and pass after.