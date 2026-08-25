# 15 — Player selection total uses offer price

**What to build:** The selection summary, the "Continue · Rs X" CTA, and the checkout link all reflect the discount. `summarizeSelection` sums `slot.offer_price ?? slot.price ?? court.price_per_slot` instead of the base `slot.price`, and `buildCtaHref` carries the discounted per-slot price.

**Blocked by:** 14 — Availability offer discounts

**Status:** ready-for-agent

- [ ] Selecting a slot that has `offer_price` shows the discounted total in the summary badge and CTA.
- [ ] The checkout link's `price_per_slot` is the discounted price per slot.
- [ ] A slot with no offer (`offer_price: null`) totals at the base price, unchanged.
- [ ] `selection.test.ts` covers both cases (offer present → discounted total; no offer → base total).