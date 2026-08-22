# 38 — Booking confirmed shows "-" instead of venue name

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- On the **booking confirmed** screen the venue field renders as `-` — the venue name is missing.
- Trace the data passed to the confirmation page: likely the venue name is dropped by a schema parse (cf. ticket 30 — `VenueSchema` stripping fields) or the confirmation payload omits it.
- Show venue name (and court name) on the confirmation screen; keep the QR + booking ID.

## Acceptance
- [ ] Confirmation screen shows the venue name (never `-`)
- [ ] Court name shows correctly too
- [ ] Both online and cash bookings display it

## Notes
- Screenshot: 2026-08-22 10.09.48.