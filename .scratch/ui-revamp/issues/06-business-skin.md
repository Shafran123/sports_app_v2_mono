# 06 — Business dashboard skin

**What to build:** the supply side gets the same class: overview cards with giant numerals, calendar and booking views, court management, hours/blocks, manual booking and check-in screens — dark with sidebar shell.

**Blocked by:** 01 — Design system; 02 — App shells.

**Status:** ready-for-agent

- [ ] `/business` overview: metric cards with large numerals, status pils, empty state
- [ ] `/business/venues/[id]` courts/hours/blocks restyled; segmented tabs dark
- [ ] Bookings/calendar visuals: booking cards/rows with status colors (lemon pending, green active, red cancelled)
- [ ] Manual booking + check-in screens restyled (mobile-friendly)
- [ ] table/cell contrast on dark, responsive 375-1440; `npm run build` green