# 12 — Admin calendar, manual booking, bookings table

**What to build:** the operator's day-loop. A Venue Owner sees their availability as a calendar, creates walk-in bookings by clicking free slots, and runs check-in / no-show / cancel from the bookings table.

**Blocked by:** 11 — Admin venue management and add-venue.

**Status:** ready-for-agent

- [ ] Day + week availability calendar: court rows × slot columns, status colors (available / booked / blocked / checked-in / maintenance), today highlighted
- [ ] Click an available slot → manual booking sheet (court, start/end, player name/phone, amount) → creates a confirmed cash booking; slot conflicts surface as a clear error
- [ ] Click a booked slot → booking detail with check-in, no-show, and cancel actions
- [ ] Bookings table with filters, status pills, and row actions; loading/empty/error states
- [ ] Responsive: calendar usable on mobile (horizontal slot scroll, sticky summary); build green