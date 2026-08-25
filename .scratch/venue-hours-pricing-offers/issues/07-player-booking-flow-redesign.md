# 07 — Player booking flow redesign

**What to build:** The player booking flow becomes **court → date → duration → slot start-time**. A date picker replaces the fixed 14-day strip and is bounded by the venue's advance horizon (0 = unlimited, no past dates). Duration chips derive from the court's slot duration (30/60), capped at the 8-slot maximum and at the remaining open window. Tapping an available start-time auto-highlights the run of the chosen duration; the run can never span a closed gap, a closed date, or a past slot. Court cards show the sport, a price range (base–peak), and duration chips, and disable when fully booked.

**Blocked by:** 03 — Owner-configurable advance horizon; 04 — Variable pricing

**Status:** ready-for-agent

- [ ] Player picks a court first, then a date, then a duration, then a start time.
- [ ] The date picker replaces the strip, allows only in-horizon dates (or any future date when 0 = unlimited), and never allows past dates.
- [ ] Duration chips offer only valid multiples of the court's slot duration, capped at 8 slots and at the remaining window.
- [ ] Tapping an available start time selects the exact run of the chosen duration; tapping another start moves the run.
- [ ] A run can never span a closed gap, a closed date, or a slot whose start is already past.
- [ ] Court cards show the sport, a price range, and duration chips; a court with no availability that date is disabled.
- [ ] The checkout flow receives the exact selected run and shows the summed per-slot price.