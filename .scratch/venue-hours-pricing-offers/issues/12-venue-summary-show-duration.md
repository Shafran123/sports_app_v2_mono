# 12 — Venue summary shows duration, not slot count

**What to build:** On the player's venue detail page, the summary badge reads "3 slots · Rs 4,500" and the booking CTA reads "3 slots". The player picked a **duration**, not a count — show the duration instead ("1h 30m · Rs 4,500", "1h 30m"). Add a shared duration formatter and carry the duration through to the checkout link so the checkout page can show it too.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A `formatDuration(min)` helper exists in `@myslot/utils` (renders "45m", "1h 30m", "2h").
- [ ] The selection summary computes a duration (slot count × court `slot_duration_min`) alongside the count.
- [ ] The venue-page summary badge shows `formatDuration(duration)` instead of "N slots".
- [ ] The booking CTA shows the duration instead of "N slots".
- [ ] The checkout URL carries the duration (e.g. a `slot_min`/`duration` param) so ticket 13 can render it.