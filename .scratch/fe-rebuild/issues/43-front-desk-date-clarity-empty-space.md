# 43 — Front desk: booking day clarity (today vs tomorrow) + empty space in consoles

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
1. **Front desk day clarity** — the front desk (owner console) doesn't make clear whether a booking is today or tomorrow. Each booking row should show an explicit day label (e.g. "Today", "Tomorrow", or the date) next to its time, so staff can tell at a glance.
2. **Empty space** — the admin and owner consoles show large empty/dead space with the nav bar (content doesn't fill the viewport). Apply consistent gutters and spacing (see tickets 29/40) so pages don't look hollow; content should use the available width on mobile.

## Acceptance
- [ ] Front desk bookings explicitly labeled Today / Tomorrow / date
- [ ] No ambiguous time-only rows on the front desk
- [ ] Admin and owner pages fill the viewport without dead empty space
- [ ] No regression on the shared gutter pattern

## Notes
- Screenshot: 2026-08-22 10.14.20.