# 03 — Owner-configurable advance booking horizon

**What to build:** Each venue gets its own advance-booking horizon (`advance_days`), with 0 meaning no limit. The server returns the venue's effective horizon so the client can build a date picker, and it returns no availability for dates beyond the horizon. Past dates are never bookable. There is no platform-wide cap.

**Blocked by:** 01 — Multi-window opening hours

**Status:** ready-for-agent

- [ ] Owner can set the venue's advance horizon (whole days ahead, 0 = unlimited).
- [ ] The venue payload exposes the effective horizon (venue value, falling back to the platform default when unset).
- [ ] Availability returns no slots for dates beyond the venue's horizon.
- [ ] The player date picker allows only dates within the horizon (or any future date when 0 = unlimited), never past dates.
- [ ] A date beyond the horizon cannot be selected or booked even if the client attempts it — the server stays authoritative.