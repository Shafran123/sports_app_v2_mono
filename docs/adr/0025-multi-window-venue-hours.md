# 0025 — Multi-window venue hours

- **Status:** accepted
- **Date:** 2026-08-24

## Context

`venue_hours` enforces exactly one open/close pair per `(venue_id, day_of_week)` via a unique constraint, so a venue cannot express a mid-day closure (09:00–12:00, then 14:00–23:00). The availability engine and checkout both read only the first row per day, making a split day structurally impossible.

## Decision

Allow **multiple opening windows per day**: drop the `unique (venue_id, day_of_week)` constraint and treat each row as one contiguous open→close window. A day with no rows is closed. Server-side, windows on the same day must not overlap. Availability and checkout iterate **all** windows for the day instead of the first row.

A **Slot** remains a grid segment of the court's `slot_duration_min`; a booking must fit entirely inside one opening window and never spans a gap. Existing rows (one window per day) read as-is — a single window is the special case.

## Consequences

- Owner Hours editor becomes a per-day window list with add/remove/copy-day-to-week.
- Availability, checkout, and the walk-in quick-book path all iterate windows, not `rows[0]`.
- `courts.slot_duration_min` stays the grid; minimum bookable time = one slot (30/60 min), which the picker only offers where a full slot fits in a window.
- The same window concept is reused by variable pricing and slot-based offers.