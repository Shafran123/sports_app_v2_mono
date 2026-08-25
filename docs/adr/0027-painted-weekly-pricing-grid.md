# 0027 — Painted weekly pricing grid replaces the rule-window form

Owners set variable pricing by painting prices onto a grid of slot-times (day picker Mon–Sun, then slot chips), replacing the add-one-window-at-a-time form (court, day, start time, end time, price). A price entry field + tap/drag paints cells; an eraser reverts cells to the court base price. Painting the base price also clears a cell, and clearing every paint deletes all rules for the court. Each day's slot-times are derived from that day's opening windows at the court's `slot_duration_min` (no cross-day column alignment — Mon's grid comes from Mon's windows, Sat's from Sat's). Contiguous same-price painted cells coalesce into one window; painted slot-times that fall outside opening hours are warned about and dropped on save. The whole week is one schedule and saving replaces all rules for that court in one transaction.

The editor paints per-day only — day-agnostic (`day_of_week = null`) rules that already exist are flattened to the same paint on all 7 days on load and become per-day rules on save, so the grid always shows what players actually pay and saving never drops data. Slot-based Offers are out of scope and keep the existing window form.

## Status

- **Status:** accepted
- **Date:** 2026-08-25

## Decision

Replace the Pricing tab's inline rule form with a per-court painted grid of recurring slot-times. See the design tree above for the full decision set; the three non-obvious consequences are the whole-schedule save, the per-day-only flatten, and the "base price clears" rule.

## Consequences

- New backend endpoint `PUT /business/courts/:id/pricing` replaces all rules for a court in one transaction (delete all + insert), alongside the existing add/list/delete.
- Contiguous same-price runs are coalesced into single windows so the painted grid and the pricing engine always agree.
- `CONTEXT.md` gains **Slot-time** (a day-of-week × start-time position in the weekly schedule, distinct from a dated **Slot**), and **Variable Pricing** is reworded around it.