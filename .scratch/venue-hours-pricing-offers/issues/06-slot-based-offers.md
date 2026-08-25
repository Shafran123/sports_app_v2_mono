# 06 — Slot-based offers

**What to build:** Venue owners create a slot-based offer — a percentage or flat discount applied to **each matching slot**, scoped to one or more courts and/or a day+time window. Matching slots use the discounted price, computed on the peak-adjusted slot price. Stacking is best-single-per-kind: the best venue-wide offer plus the best slot-based offer apply, never compounding. The player sees the discounted per-slot price with the offer marked.

**Blocked by:** 04 — Variable pricing; 05 — Venue-wide offers

**Status:** ready-for-agent

- [ ] Owner creates a slot-based offer scoped to specific courts and/or a day+time window, with % or flat discount, start/end dates, and active toggle.
- [ ] The server applies the best slot-based offer to each matching slot, on the peak-adjusted slot price.
- [ ] Stacking is best venue-wide + best slot-based — never two offers of the same kind compounding.
- [ ] Availability returns the discounted price per slot for matching slots, and the selection total reflects it.
- [ ] The player sees the offer-marked price on matching slots (struck-through base, offer badge), while the server owns the calculation.
- [ ] A slot-based offer never discounts a slot outside its court/time scope.