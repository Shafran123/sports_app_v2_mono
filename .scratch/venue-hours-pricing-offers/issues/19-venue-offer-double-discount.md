# 19 — Venue-wide offer applied twice (double discount) on the player flow

**What to build:** A venue-wide offer was discounted **twice** in the player flow: once when building the checkout link and again in checkout, so a Rs 4,500 slot with a 20% venue-wide offer showed Rs 2,880 (4500 × 0.8 × 0.8) instead of Rs 3,600. The venue page's "Continue" link now carries the **slot-level** price (`price_per_slot`) plus the venue-wide offer params, and checkout applies the offer exactly once, so the displayed total matches the server's (Rs 3,600). The venue page badge/CTA still show the discounted total for the player.

**Blocked by:** None — implemented in this session.

**Status:** ready-for-agent

- [ ] With a Rs 4,500 slot and a 20% venue-wide offer, the checkout total is Rs 3,600 — never Rs 2,880.
- [ ] The checkout link's `price_per_slot` is the slot-level price (4500), not the venue-wide-discounted price.
- [ ] The venue page summary badge and "Continue · Rs X" CTA show the discounted total (Rs 3,600).
- [ ] The server-returned amount (Rs 3,600) matches the displayed total once checkout responds.
- [ ] Regression test: selecting a slot with a venue-wide offer produces a link whose `price_per_slot` is slot-level, so the discount is not compounded.

## Context / cause

The venue page passed its **venue-wide-discounted** summary (`displaySummary`, total 3600) into `buildCtaHref`, so the URL's `price_per_slot` was already 3600. Checkout then applied the venue-wide offer again on top (3600 × 0.8 = 2880). Verified with a red-capable component test asserting the link carried `price_per_slot=3600` (red) and `price_per_slot=4500` (green) after the fix.