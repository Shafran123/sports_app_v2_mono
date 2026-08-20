# 06 — Venue detail and slot picker

**What to build:** a Player opens a venue, sees its gallery and info, and picks real available slots — the entry to booking.

**Blocked by:** 04 — Player auth and app shell.

**Status:** ready-for-agent

- [ ] Venue page: gallery (photos with thumbnails when the venue has more than one), info grid, sports and amenities, courts, opening hours, rules, cancellation policy
- [ ] Slot picker: date strip, court list, and slot chips with clear state colors (available / selected / taken) driven by the live availability endpoint
- [ ] Selection summary and a Continue action that carries court/date/slot(s) into the booking flow
- [ ] Skeleton loading, empty, and error + retry states; build green