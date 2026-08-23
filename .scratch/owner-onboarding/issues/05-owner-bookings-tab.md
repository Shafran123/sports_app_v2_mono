# 05 — Owner Bookings tab

**What to build:** a server-side bookings lookup surface for the owner. A new "Bookings" sidebar item lists the owner's bookings with a date range (default all time), status, venue, sport, and pagination. Front desk stays day-of operations (check-in, QR, quick-book, cash) — the tab is for lookup and audit.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Backend endpoint lists the owner's bookings with date-range, status, venue, sport filters and pagination
- [ ] Owner sidebar gains a "Bookings" item
- [ ] The bookings table/cards show the filter set and a clear reset
- [ ] Filters are server-side (not a client-side memory filter)
- [ ] Front desk behavior is unchanged