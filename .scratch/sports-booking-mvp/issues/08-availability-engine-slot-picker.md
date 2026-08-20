# 08 — Availability engine + slot picker

**What to build:** players see server-authoritative availability. The API derives each slot's state (available / held / booked / blocked) from venue hours, blocks, holds, and bookings; the venue page's slot picker renders that live state and enforces the advance booking window.

**Blocked by:** 05 — Venue discovery.

**Status:** ready-for-agent

- [ ] Availability endpoint returns per-court slot states for a date range, respecting opening hours, blocks, holds, bookings, and the 14-day advance window
- [ ] Slot duration comes from the court config (60 min default); past slots are not bookable
- [ ] Slot picker on the venue page shows available/held/booked/blocked states and shows price for the selection
- [ ] Two concurrent requests can never see a conflicting slot as available (DB-backed, not in-memory)

## Comments
Completed: 2026-08-19
