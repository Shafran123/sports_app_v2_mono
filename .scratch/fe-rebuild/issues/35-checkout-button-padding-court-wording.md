# 35 — Checkout "Continue" button lacks padding + "changing_room" wording

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- On the booking/checkout screen the primary **Continue** button renders with no left/right padding — text is flush against the button edges.
- Fix via the shared `Button` component (enforce horizontal padding, see ticket 27) or the call site.
- A court/slot label shows the raw slug `changing_room` — replace with proper human wording (e.g. "Changing Room" / the court's display name). Sweep the checkout + slot picker for any other raw slug/kebab-case strings leaking into UI.

## Acceptance
- [ ] Continue button has correct horizontal padding on mobile and desktop
- [ ] No raw slugs (e.g. `changing_room`) appear anywhere in the booking flow
- [ ] No other button on the checkout screen renders bare

## Notes
- Screenshot: 2026-08-22 10.06.57.