# 28 — Venue map link + SelectSheet dropdowns

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
1. **Venue map** (`venue-detail/venue-info.tsx`): replace/annotate the address with a **"Get directions" link** → `https://www.google.com/maps/search/?api=1&query=<address>,<city>` (use `lat`/`lng` when present). Link only — no embedded iframe.
2. **SelectSheet primitive** (`packages/ui/src/components/ui/`):
   - On `md+` render a native `<select>` (unchanged look).
   - On touch/mobile render a **bottom sheet** with tappable option rows + selected check.
   - Swap all existing `<select>` usages: explore filters (sport), quick-book (venue, court), manual booking (venue, court), venue form (sports), anywhere else with a native dropdown.

## Acceptance
- [ ] "Get directions" opens Google Maps with the venue address (or lat/lng)
- [ ] No embedded map/iframe
- [ ] `SelectSheet` renders native select on desktop, bottom sheet on mobile
- [ ] All dropdowns use `SelectSheet`; selection reflects back to the form/query state
- [ ] Bottom sheet handles long option lists (scroll), cancel/dismiss works, keyboard-safe