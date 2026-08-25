# 16 — Checkout Total shows the server's discounted amount

**What to build:** The checkout page's Total renders the server's `result.amount` (the discounted amount the player actually pays), not the base `slotsCount × pricePerSlot` from the URL. When the server amount is lower than the displayed base, show a "You saved Rs X" line (and the pre-discount total struck through). Both cash and online payment summaries.

**Blocked by:** 15 — Player selection total uses offer price

**Status:** ready-for-agent

- [ ] With a 20% offer on a Rs 1,500 slot, checkout shows Total Rs 1,200 (the server amount), not Rs 1,500.
- [ ] A "You saved Rs 300" line appears when the server amount is lower than the base total.
- [ ] The Rate line still explains base price × duration; the Total always matches what the server returns.
- [ ] A booking with no offer shows no "You saved" line and the base Total.