# 01 — Inclusive tax engine

**What to build:** a listed price is now the total a player pays, and the platform splits out base + Platform Tax + Venue Tax at checkout. Backend migration adds `venue_tax_rate` to Venues and per-row snapshots (`tax_rate`, `tax_amount`, `venue_tax_rate`, `venue_tax_amount`) to bookings, holds, payments, and event registrations. The tax helper derives the inclusive split; player checkout, cash walk-in back-derive, event registration, and the PayHere webhook all use it.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Migration adds `venues.venue_tax_rate` and snapshot columns; idempotent
- [ ] `applyTax` derives `{ base, platform_tax, venue_tax, total }` from an inclusive price using both rates, half-up rounding
- [ ] Online checkout snapshots both taxes and reports the split to the player
- [ ] Cash walk-in (venue-entered total) back-derives the same way
- [ ] Event registration snapshots both taxes
- [ ] PayHere webhook copies the snapshots onto the payment row
- [ ] Existing tests updated for inclusive math; new tests for the split