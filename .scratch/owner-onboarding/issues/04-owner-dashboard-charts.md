# 04 — Owner dashboard charts

**What to build:** the owner dashboard shows the same charts the admin has. A new owner reports endpoint returns a time series (per-day bookings, revenue, taxes), bookings by sport, and the online-vs-cash payment split, scoped to the owner and filterable by venue. The dashboard renders recharts (revenue & tax bar, bookings/day line, by-sport bar, payment pie) with a 7/30/90 range toggle and a venue filter when the owner owns several venues. With no venues yet, a "create your first venue" empty state replaces the charts.

**Blocked by:** 01 — Inclusive tax engine

**Status:** ready-for-agent

- [ ] Owner reports endpoint returns series, by-sport, payment split for the owner's venues
- [ ] Charts render on the owner dashboard with the range toggle
- [ ] Venue filter appears only when the owner has multiple venues
- [ ] Empty state with a "create your first venue" CTA when the owner has no venues
- [ ] Owner revenue is net of both taxes; the owner's Venue Tax is reported separately