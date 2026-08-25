# 13 — Checkout shows duration, not slot count

**What to build:** The checkout page's Rate line renders as "3 × Rs 1,500" (a slot count). Show the duration instead — "1h 30m × Rs 1,500" — matching the venue page, in both the cash and online payment summaries.

**Blocked by:** 12 — Venue summary shows duration (the checkout link now carries the duration).

**Status:** ready-for-agent

- [ ] The checkout Rate line uses the duration from the checkout link (falling back to the existing rate math when absent).
- [ ] The duration renders with `formatDuration` ("1h 30m", "2h").
- [ ] Both the cash and online payment summaries show the duration line.
- [ ] A booking with a 30-min grid shows "30m"; a 3-slot × 30-min booking shows "1h 30m".