# 01 — Multi-window opening hours

**What to build:** Venue owners set several contiguous open→close windows per day (e.g. 09:00–12:00 and 14:00–23:00) instead of a single pair; a day with no windows is closed. Availability and booking honor **all** windows of a day, and a booking must fit entirely inside one window — it never spans a gap. Existing venues with a single window per day keep working unchanged.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Owner can add and remove windows per weekday in the Hours editor, and copy one day's pattern to the rest of the week.
- [ ] The server rejects overlapping windows on the same day.
- [ ] The availability endpoint returns slots from every window of a day, and no slot straddles a gap between windows.
- [ ] Checkout rejects a booking whose range does not fit entirely inside one window.
- [ ] A venue with a single window per day renders and books exactly as today.
- [ ] The player's venue detail page shows all of a day's windows (open → close per window).