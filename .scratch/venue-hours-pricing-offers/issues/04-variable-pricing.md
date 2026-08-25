# 04 — Variable pricing (peak/off-peak)

**What to build:** A court gets pricing rules — day+time windows with their own price per slot, plus the court's base price. A slot whose start falls inside a matching rule uses that rule's price; otherwise it falls back to the court's base price. Overlapping rules resolve most-specific-wins (a matching weekday beats a null weekday; the narrower window wins). Rules must fit inside an opening window for that day. The availability endpoint returns a price **per slot**, and the player's total sums per-slot prices instead of count × base price.

**Blocked by:** 01 — Multi-window opening hours

**Status:** ready-for-agent

- [ ] Owner configures pricing windows per court, each with a start, end, and price.
- [ ] The server rejects a pricing rule that does not fit inside an opening window for that day.
- [ ] Overlapping pricing rules resolve most-specific-wins without a save-time conflict error.
- [ ] A slot whose start falls in a matching rule is priced at the rule's price; all other slots use the court's base price.
- [ ] Availability returns each slot with its own price, and the selection total sums per-slot prices.
- [ ] The same pricing is used by checkout for online and cash bookings.