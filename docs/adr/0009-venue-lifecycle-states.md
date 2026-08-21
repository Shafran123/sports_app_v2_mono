# ADR-0009 — Venue lifecycle states (suspend / ban / archive)

- **Status:** accepted
- **Date:** 2026-08-21

## Context
Admin control today is only approve/reject. Real venue operations need to pause a venue (suspension), remove a bad operator permanently (ban), and retire a venue without deleting data (archive) — all without destroying existing confirmed bookings.

## Decision
Extend `venues.status` to `pending / approved / rejected / suspended / banned / archived`. Ban is owner-account-level (the owner loses console access and all their venues become unbookable). Suspend and ban stop new bookings but **let existing confirmed bookings play out** (no auto-cancel). A rejected venue enters a "changes requested" state the owner can edit and resubmit. All admin actions are recorded in a `venue_audit` table.

## Trade-offs
- Hard delete would be simpler but destroys financial/booking history needed for refunds and disputes.
- Banning the owner (not just the venue) prevents a bad operator from bypassing via another venue.
- Letting existing bookings play out avoids player harm and refund storms; it does mean a suspended venue still shows its existing bookings to the owner.

## Consequences
- Availability engine filters to the bookable states only.
- Auth/business routes reject banned owners.
- Admin console gains suspend/ban/archive + audit-log views.