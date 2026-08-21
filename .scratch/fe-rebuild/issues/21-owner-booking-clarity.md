# 21 — Owner booking clarity: Today timeline + status explanations

**Status:** ready-for-agent
**Depends on:** 20 (status transitions to explain)

## What to build
- Owner console **"Today" timeline**: chronological list of today's bookings — time, court, player, status chip, payment badge (paid / cash-due).
- Every booking in list AND detail shows a **status chip + explanation**:
  - confirmed, checked-in at HH:MM, cancelled-by-player, no-show, payment collected at HH:MM.
- Booking detail shows all scan info + actions: check-in, mark paid, no-show.

## Acceptance
- [ ] Today timeline lists bookings chronologically with all the fields above
- [ ] Status chips + human explanations on list and detail
- [ ] Detail has check-in / mark-paid / no-show actions with correct state gating
- [ ] Cash-due vs paid badges accurate (from ticket 17 payments)

## Notes
- Business list endpoint (`/business/bookings`) already returns b.* — add payment status join (paid via payments table) and venue filter.
- No-show: only allowed for confirmed, non-checked-in bookings; after slot start. Marking no-show frees the slot for the overlapping state model.