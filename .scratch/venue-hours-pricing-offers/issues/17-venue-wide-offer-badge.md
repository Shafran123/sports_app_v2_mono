# 17 — Venue-wide offer badge on the player booking section

**What to build:** A venue-wide offer is invisible to players today because it only applies at checkout. Show a small badge in the "Book a slot" header when any venue-wide offer is active for the venue on the selected date (e.g. "20% off today"), so players see the promotion before they start booking. The offer itself still applies only at checkout (unchanged).

**Blocked by:** 14 — Availability offer discounts

**Status:** ready-for-agent

- [ ] The venue payload or availability response exposes whether a venue-wide offer is active on the requested date.
- [ ] The "Book a slot" header renders the badge when active, and nothing when not.
- [ ] An offer outside its start/end date, or paused, renders no badge.
- [ ] The badge is derived server-side (the client never guesses the discount).