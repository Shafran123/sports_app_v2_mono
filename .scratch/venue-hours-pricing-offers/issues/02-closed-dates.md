# 02 — Closed dates

**What to build:** Venue owners mark specific dates closed (holidays, maintenance). On a closed date the venue shows no availability, checkout rejects new bookings, and pricing/offer rules for that day don't apply. Existing confirmed bookings on the date are preserved — the owner cancels them manually if needed.

**Blocked by:** 01 — Multi-window opening hours

**Status:** ready-for-agent

- [ ] Owner can add and remove closed dates (with an optional reason) per venue.
- [ ] A closed date shows no availability to players.
- [ ] Checkout rejects a booking whose slot range touches a closed date.
- [ ] Pricing and offer rules for a closed date do not apply (no slots exist).
- [ ] Marking a date closed never cancels or alters existing confirmed bookings on that date.